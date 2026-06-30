from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone
from rest_framework import serializers

from cart.models import Cart, CartItem
from catalog.models import Book, OnlineBook


MAX_PHYSICAL_QUANTITY = 10


def money_value(value):
    if value is None or value == "":
        return Decimal("0.00")

    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0.00")


def clean_quantity(value):
    try:
        quantity = int(value or 1)
    except Exception:
        quantity = 1

    return max(1, quantity)


def clean_physical_quantity(value):
    return min(clean_quantity(value), MAX_PHYSICAL_QUANTITY)


def money(value):
    if value is None:
        return None

    return str(value)


def file_url(request, file_field):
    if not file_field:
        return ""

    try:
        url = file_field.url
    except Exception:
        return ""

    if request:
        return request.build_absolute_uri(url)

    return url


def get_discount_start(discount):
    if not discount:
        return None

    for field_name in [
        "start_time",
        "start",
        "starts_at",
        "valid_from",
        "started_at",
    ]:
        value = getattr(discount, field_name, None)

        if value:
            return value

    return None


def is_discount_active(discount):
    if not discount:
        return False

    if hasattr(discount, "is_currently_active"):
        return discount.is_currently_active

    if not getattr(discount, "is_active", False):
        return False

    now = timezone.now()

    start_time = get_discount_start(discount)

    if start_time and start_time > now:
        return False

    expiration = getattr(discount, "expiration", None)

    if not expiration:
        return False

    if expiration <= now:
        return False

    percent = money_value(getattr(discount, "amount", None))

    return Decimal("0") < percent <= Decimal("100")


def get_best_genre_discount(title):
    if not title:
        return None

    active_discounts = []

    try:
        genres = title.genres.all()
    except Exception:
        return None

    for genre in genres:
        discount = getattr(genre, "discount", None)

        if is_discount_active(discount):
            active_discounts.append(discount)

    if not active_discounts:
        return None

    return max(
        active_discounts,
        key=lambda discount: money_value(discount.amount),
    )


def get_printed_book_active_discount(book):
    if not book:
        return None

    if is_discount_active(getattr(book, "discount", None)):
        return book.discount

    title = getattr(book, "title", None)

    if title and is_discount_active(getattr(title, "discount", None)):
        return title.discount

    return get_best_genre_discount(title)


def get_online_book_active_discount(online_book):
    if not online_book:
        return None

    if is_discount_active(getattr(online_book, "discount", None)):
        return online_book.discount

    title = getattr(online_book, "title", None)

    if title and is_discount_active(getattr(title, "discount", None)):
        return title.discount

    return get_best_genre_discount(title)


def get_percentage_discount_amount(price, discount):
    price = money_value(price)

    if not is_discount_active(discount):
        return Decimal("0.00")

    percent = money_value(discount.amount)
    discount_amount = price * percent / Decimal("100")

    return discount_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def apply_percentage_discount(price, discount):
    price = money_value(price)
    discount_amount = get_percentage_discount_amount(price, discount)
    final_price = price - discount_amount

    if final_price < 0:
        return Decimal("0.00")

    return final_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_final_book_price(book):
    if not book:
        return Decimal("0.00")

    discount = get_printed_book_active_discount(book)

    return apply_percentage_discount(book.price, discount)


def get_book_discount_amount(book):
    if not book:
        return Decimal("0.00")

    discount = get_printed_book_active_discount(book)

    return get_percentage_discount_amount(book.price, discount)


def get_final_online_book_price(online_book):
    if not online_book:
        return Decimal("0.00")

    discount = get_online_book_active_discount(online_book)

    return apply_percentage_discount(online_book.price, discount)


def get_online_book_discount_amount(online_book):
    if not online_book:
        return Decimal("0.00")

    discount = get_online_book_active_discount(online_book)

    return get_percentage_discount_amount(online_book.price, discount)


def authors_text(title):
    if not title:
        return ""

    return "، ".join(
        author.name
        for author in title.author.all()
    )


def publishers_text(title):
    if not title:
        return ""

    return "، ".join(
        publisher.publisher
        for publisher in title.publisher.all()
    )


class CartBookSerializer(serializers.ModelSerializer):
    title_id = serializers.IntegerField(
        source="title.id",
        read_only=True,
    )
    name = serializers.CharField(
        source="title.name",
        read_only=True,
    )
    author = serializers.SerializerMethodField()
    publisher = serializers.SerializerMethodField()
    book_photo = serializers.SerializerMethodField()
    original_price = serializers.SerializerMethodField()
    final_price = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id",
            "title_id",
            "name",
            "price",
            "original_price",
            "final_price",
            "discounted_price",
            "discount_amount",
            "discount_percent",
            "has_discount",
            "author",
            "publisher",
            "book_photo",
        ]

    def get_author(self, obj):
        return authors_text(obj.title)

    def get_publisher(self, obj):
        return publishers_text(obj.title)

    def get_book_photo(self, obj):
        request = self.context.get("request")

        return file_url(request, obj.title.photo if obj.title else None)

    def get_original_price(self, obj):
        return money(obj.price)

    def get_final_price(self, obj):
        return money(get_final_book_price(obj))

    def get_discounted_price(self, obj):
        original_price = money_value(obj.price)
        final_price = get_final_book_price(obj)

        if final_price < original_price:
            return money(final_price)

        return None

    def get_discount_amount(self, obj):
        return money(get_book_discount_amount(obj))

    def get_discount_percent(self, obj):
        discount = get_printed_book_active_discount(obj)

        if not discount:
            return 0

        return int(discount.amount)

    def get_has_discount(self, obj):
        return bool(get_printed_book_active_discount(obj))


class CartOnlineBookSerializer(serializers.ModelSerializer):
    title_id = serializers.IntegerField(
        source="title.id",
        read_only=True,
    )
    name = serializers.CharField(
        source="title.name",
        read_only=True,
    )
    book_id = serializers.SerializerMethodField()
    book_name = serializers.CharField(
        source="title.name",
        read_only=True,
    )
    author = serializers.SerializerMethodField()
    publisher = serializers.SerializerMethodField()
    book_photo = serializers.SerializerMethodField()
    original_price = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    final_price = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()

    class Meta:
        model = OnlineBook
        fields = [
            "id",
            "title_id",
            "name",
            "book_id",
            "book_name",
            "author",
            "publisher",
            "book_photo",
            "format",
            "access_type",
            "price",
            "original_price",
            "final_price",
            "discounted_price",
            "discount_amount",
            "discount_percent",
            "has_discount",
        ]

    def get_book_id(self, obj):
        physical_book = obj.title.physical_versions.order_by("-id").first()

        return physical_book.id if physical_book else None

    def get_author(self, obj):
        return authors_text(obj.title)

    def get_publisher(self, obj):
        return publishers_text(obj.title)

    def get_book_photo(self, obj):
        request = self.context.get("request")

        return file_url(request, obj.title.photo if obj.title else None)

    def get_original_price(self, obj):
        return money(obj.price)

    def get_price(self, obj):
        return money(money_value(obj.price))

    def get_final_price(self, obj):
        return money(get_final_online_book_price(obj))

    def get_discounted_price(self, obj):
        original_price = money_value(obj.price)
        final_price = get_final_online_book_price(obj)

        if final_price < original_price:
            return money(final_price)

        return None

    def get_discount_amount(self, obj):
        return money(get_online_book_discount_amount(obj))

    def get_discount_percent(self, obj):
        discount = get_online_book_active_discount(obj)

        if not discount:
            return 0

        return int(discount.amount)

    def get_has_discount(self, obj):
        return bool(get_online_book_active_discount(obj))


class CartItemSerializer(serializers.ModelSerializer):
    book_detail = CartBookSerializer(
        source="book",
        read_only=True,
    )

    online_book_detail = CartOnlineBookSerializer(
        source="online_book",
        read_only=True,
    )

    item_type = serializers.SerializerMethodField()
    item_name = serializers.SerializerMethodField()
    item_photo = serializers.SerializerMethodField()
    item_author = serializers.SerializerMethodField()
    item_publisher = serializers.SerializerMethodField()
    item_link = serializers.SerializerMethodField()
    quantity = serializers.SerializerMethodField()
    unit_price = serializers.SerializerMethodField()
    original_unit_price = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            "id",
            "cart",

            "book",
            "book_detail",

            "online_book",
            "online_book_detail",

            "item_type",
            "item_name",
            "item_photo",
            "item_author",
            "item_publisher",
            "item_link",

            "quantity",
            "original_unit_price",
            "unit_price",
            "discount_amount",
            "discount_percent",
            "has_discount",
            "subtotal",

            "created_at",
            "last_update",
        ]

        read_only_fields = [
            "id",
            "cart",
            "created_at",
            "last_update",
        ]

    def get_title(self, obj):
        if obj.online_book:
            return obj.online_book.title

        if obj.book:
            return obj.book.title

        return None

    def get_item_type(self, obj):
        if obj.online_book:
            return "online_book"

        return "book"

    def get_item_name(self, obj):
        title = self.get_title(obj)

        return title.name if title else ""

    def get_item_photo(self, obj):
        request = self.context.get("request")
        title = self.get_title(obj)

        return file_url(request, title.photo if title else None)

    def get_item_author(self, obj):
        return authors_text(self.get_title(obj))

    def get_item_publisher(self, obj):
        return publishers_text(self.get_title(obj))

    def get_item_link(self, obj):
        if obj.online_book:
            physical_book = obj.online_book.title.physical_versions.order_by("-id").first()

            if physical_book:
                return f"/ketabook/books/{physical_book.id}/?online_book={obj.online_book.id}"

            return f"/ketabook/online-books/{obj.online_book.id}/reader/"

        if obj.book:
            return f"/ketabook/books/{obj.book.id}/"

        return "/ketabook/"

    def get_quantity(self, obj):
        if obj.online_book:
            return 1

        return clean_physical_quantity(obj.quantity)

    def get_original_unit_price(self, obj):
        if obj.online_book:
            return money(obj.online_book.price)

        return money(obj.book.price if obj.book else Decimal("0.00"))

    def get_unit_price(self, obj):
        if obj.online_book:
            return money(get_final_online_book_price(obj.online_book))

        return money(get_final_book_price(obj.book))

    def get_discount_amount(self, obj):
        if obj.online_book:
            return money(get_online_book_discount_amount(obj.online_book))

        return money(get_book_discount_amount(obj.book))

    def get_discount_percent(self, obj):
        if obj.online_book:
            discount = get_online_book_active_discount(obj.online_book)
        else:
            discount = get_printed_book_active_discount(obj.book)

        if not discount:
            return 0

        return int(discount.amount)

    def get_has_discount(self, obj):
        if obj.online_book:
            return bool(get_online_book_active_discount(obj.online_book))

        return bool(get_printed_book_active_discount(obj.book))

    def get_subtotal(self, obj):
        quantity = self.get_quantity(obj)

        if obj.online_book:
            return money(get_final_online_book_price(obj.online_book))

        return money(get_final_book_price(obj.book) * quantity)


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(
        source="cart_item",
        many=True,
        read_only=True,
    )

    user_number = serializers.CharField(
        source="user.number",
        read_only=True,
    )

    total_items = serializers.SerializerMethodField()
    calculated_total = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = [
            "id",
            "user",
            "user_number",
            "total_price",
            "calculated_total",
            "total_items",
            "order_status",
            "payment_status",
            "items",
            "created_at",
            "last_update",
        ]

        read_only_fields = [
            "id",
            "user",
            "total_price",
            "calculated_total",
            "total_items",
            "created_at",
            "last_update",
        ]

    def get_total_items(self, obj):
        total = 0

        for item in obj.cart_item.all():
            if item.online_book:
                total += 1
            else:
                total += clean_physical_quantity(item.quantity)

        return total

    def get_calculated_total(self, obj):
        total = Decimal("0.00")

        for item in obj.cart_item.all():
            if item.online_book:
                total += get_final_online_book_price(item.online_book)
            else:
                total += get_final_book_price(item.book) * clean_physical_quantity(item.quantity)

        return money(total)


class AddCartItemSerializer(serializers.Serializer):
    book = serializers.IntegerField(required=False)
    online_book = serializers.IntegerField(required=False)
    online_book_id = serializers.IntegerField(required=False)
    quantity = serializers.IntegerField(min_value=1, required=False, default=1)

    def validate(self, attrs):
        book = attrs.get("book")
        online_book = attrs.get("online_book") or attrs.get("online_book_id")

        if book and online_book:
            raise serializers.ValidationError(
                "send either book or online_book, not both."
            )

        if not book and not online_book:
            raise serializers.ValidationError(
                "book or online_book is required."
            )

        if online_book:
            attrs["online_book"] = online_book
            attrs["quantity"] = 1
            return attrs

        attrs["quantity"] = clean_physical_quantity(attrs.get("quantity", 1))

        return attrs


class UpdateCartItemSerializer(serializers.Serializer):
    book = serializers.IntegerField(required=False)
    online_book = serializers.IntegerField(required=False)
    online_book_id = serializers.IntegerField(required=False)
    quantity = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        book = attrs.get("book")
        online_book = attrs.get("online_book") or attrs.get("online_book_id")

        if book and online_book:
            raise serializers.ValidationError(
                "send either book or online_book, not both."
            )

        if not book and not online_book:
            raise serializers.ValidationError(
                "book or online_book is required."
            )

        if online_book:
            attrs["online_book"] = online_book
            attrs["quantity"] = 1
            return attrs

        attrs["quantity"] = clean_physical_quantity(attrs.get("quantity", 1))

        return attrs