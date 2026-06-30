from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone
from rest_framework import serializers

from catalog.models import (
    Author,
    Book,
    BookTitle,
    Genre,
    OnlineBook,
    Publishers,
    Translators,
)
from payment.models import Discount


def money_value(value):
    if value is None or value == "":
        return Decimal("0.00")

    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0.00")


def get_discount_start(discount):
    if not discount:
        return None

    for field_name in [
        "start",
        "start_time",
        "starts_at",
        "valid_from",
        "started_at",
    ]:
        value = getattr(discount, field_name, None)

        if value:
            return value

    return None


def is_discount_currently_active(discount):
    if not discount:
        return False

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

    amount = money_value(getattr(discount, "amount", None))

    return Decimal("0") < amount <= Decimal("100")


def apply_discount(price, discount):
    price = money_value(price)

    if not is_discount_currently_active(discount):
        return price

    percent = money_value(discount.amount)
    final_price = price - ((price * percent) / Decimal("100"))

    if final_price < 0:
        return Decimal("0.00")

    return final_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def best_genre_discount(title):
    if not title:
        return None

    discounts = []

    try:
        genres = title.genres.all()
    except Exception:
        return None

    for genre in genres:
        discount = getattr(genre, "discount", None)

        if is_discount_currently_active(discount):
            discounts.append(discount)

    if not discounts:
        return None

    return max(
        discounts,
        key=lambda discount: money_value(discount.amount),
    )


def printed_book_discount(book):
    if not book:
        return None

    if is_discount_currently_active(book.discount):
        return book.discount

    title = getattr(book, "title", None)

    if title and is_discount_currently_active(title.discount):
        return title.discount

    return best_genre_discount(title)


def online_book_discount(online_book):
    if not online_book:
        return None

    if is_discount_currently_active(online_book.discount):
        return online_book.discount

    title = getattr(online_book, "title", None)

    if title and is_discount_currently_active(title.discount):
        return title.discount

    return best_genre_discount(title)


class AuthorSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Author
        fields = "__all__"

    def get_photo_url(self, obj):
        request = self.context.get("request")

        if not obj.photo:
            return ""

        if request:
            return request.build_absolute_uri(obj.photo.url)

        return obj.photo.url


class PublishersSerializer(serializers.ModelSerializer):
    picture_url = serializers.SerializerMethodField()

    class Meta:
        model = Publishers
        fields = "__all__"

    def get_picture_url(self, obj):
        request = self.context.get("request")

        if not obj.picture:
            return ""

        if request:
            return request.build_absolute_uri(obj.picture.url)

        return obj.picture.url


class TranslatorsSerializer(serializers.ModelSerializer):
    translate_to_display = serializers.SerializerMethodField()

    class Meta:
        model = Translators
        fields = "__all__"

    def get_translate_to_display(self, obj):
        try:
            return obj.get_translate_to_display()
        except Exception:
            return obj.translate_to or ""


class DiscountSerializer(serializers.ModelSerializer):
    is_currently_active = serializers.SerializerMethodField()

    class Meta:
        model = Discount
        fields = "__all__"

    def get_is_currently_active(self, obj):
        return is_discount_currently_active(obj)


class GenreSerializer(serializers.ModelSerializer):
    discount_detail = DiscountSerializer(
        source="discount",
        read_only=True,
    )
    label = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()

    class Meta:
        model = Genre
        fields = "__all__"

    def get_label(self, obj):
        try:
            return obj.get_name_display()
        except Exception:
            return obj.name

    def get_has_discount(self, obj):
        return is_discount_currently_active(obj.discount)

    def get_discount_percent(self, obj):
        if not is_discount_currently_active(obj.discount):
            return 0

        return int(obj.discount.amount)


class BookTitleSerializer(serializers.ModelSerializer):
    authors = serializers.SerializerMethodField()
    publishers = serializers.SerializerMethodField()
    translators = serializers.SerializerMethodField()
    genres_detail = serializers.SerializerMethodField()
    discount_detail = DiscountSerializer(
        source="discount",
        read_only=True,
    )
    photo_url = serializers.SerializerMethodField()
    level_display = serializers.SerializerMethodField()
    language_display = serializers.SerializerMethodField()
    has_physical_version = serializers.SerializerMethodField()
    has_online_version = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()

    class Meta:
        model = BookTitle
        fields = "__all__"

    def get_authors(self, obj):
        return AuthorSerializer(
            obj.author.all(),
            many=True,
            context=self.context,
        ).data

    def get_publishers(self, obj):
        return PublishersSerializer(
            obj.publisher.all(),
            many=True,
            context=self.context,
        ).data

    def get_translators(self, obj):
        return TranslatorsSerializer(
            obj.translator.all(),
            many=True,
            context=self.context,
        ).data

    def get_genres_detail(self, obj):
        return GenreSerializer(
            obj.genres.all(),
            many=True,
            context=self.context,
        ).data

    def get_photo_url(self, obj):
        request = self.context.get("request")

        if not obj.photo:
            return ""

        if request:
            return request.build_absolute_uri(obj.photo.url)

        return obj.photo.url

    def get_level_display(self, obj):
        try:
            return obj.get_level_display()
        except Exception:
            return obj.level or ""

    def get_language_display(self, obj):
        try:
            return obj.get_language_display()
        except Exception:
            return obj.language or ""

    def get_has_physical_version(self, obj):
        return obj.physical_versions.exists()

    def get_has_online_version(self, obj):
        return obj.online_versions.exists()

    def get_has_discount(self, obj):
        return is_discount_currently_active(obj.discount) or bool(best_genre_discount(obj))

    def get_discount_percent(self, obj):
        if is_discount_currently_active(obj.discount):
            return int(obj.discount.amount)

        genre_discount = best_genre_discount(obj)

        if genre_discount:
            return int(genre_discount.amount)

        return 0


class OnlineBookSerializer(serializers.ModelSerializer):
    title_detail = BookTitleSerializer(
        source="title",
        read_only=True,
    )
    discount_detail = DiscountSerializer(
        source="discount",
        read_only=True,
    )
    final_price = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = OnlineBook
        fields = "__all__"

    def get_final_price(self, obj):
        discount = online_book_discount(obj)

        return str(apply_discount(obj.price, discount))

    def get_discounted_price(self, obj):
        original_price = money_value(obj.price)
        final_price = money_value(self.get_final_price(obj))

        if final_price < original_price:
            return str(final_price)

        return None

    def get_discount_amount(self, obj):
        original_price = money_value(obj.price)
        final_price = money_value(self.get_final_price(obj))
        discount_amount = original_price - final_price

        if discount_amount <= 0:
            return "0.00"

        return str(discount_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    def get_discount_percent(self, obj):
        discount = online_book_discount(obj)

        if not discount:
            return 0

        return int(discount.amount)

    def get_has_discount(self, obj):
        return bool(online_book_discount(obj))

    def get_file_url(self, obj):
        request = self.context.get("request")

        if not obj.url:
            return ""

        if request:
            return request.build_absolute_uri(obj.url.url)

        return obj.url.url


class BookSerializer(serializers.ModelSerializer):
    title_detail = BookTitleSerializer(
        source="title",
        read_only=True,
    )
    discount_detail = DiscountSerializer(
        source="discount",
        read_only=True,
    )
    online_versions = serializers.SerializerMethodField()
    final_price = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = "__all__"

    def get_online_versions(self, obj):
        online_versions = OnlineBook.objects.filter(
            title=obj.title,
        ).select_related(
            "title",
            "discount",
            "title__discount",
        ).prefetch_related(
            "title__author",
            "title__publisher",
            "title__translator",
            "title__genres",
            "title__genres__discount",
        )

        return OnlineBookSerializer(
            online_versions,
            many=True,
            context=self.context,
        ).data

    def get_final_price(self, obj):
        discount = printed_book_discount(obj)

        return str(apply_discount(obj.price, discount))

    def get_discounted_price(self, obj):
        original_price = money_value(obj.price)
        final_price = money_value(self.get_final_price(obj))

        if final_price < original_price:
            return str(final_price)

        return None

    def get_discount_amount(self, obj):
        original_price = money_value(obj.price)
        final_price = money_value(self.get_final_price(obj))
        discount_amount = original_price - final_price

        if discount_amount <= 0:
            return "0.00"

        return str(discount_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    def get_discount_percent(self, obj):
        discount = printed_book_discount(obj)

        if not discount:
            return 0

        return int(discount.amount)

    def get_has_discount(self, obj):
        return bool(printed_book_discount(obj))