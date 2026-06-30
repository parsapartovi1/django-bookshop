from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from account.models import Factor, UserOnlineBook
from apps_serializers.cart_serializer import (
    AddCartItemSerializer,
    CartSerializer,
    UpdateCartItemSerializer,
)
from cart.choices import (
    ORDER_STATUS_CHOICES,
    PAYMENT_STATUS_CHOICES,
    PAID,
    PROCESSING,
)
from cart.models import Cart, CartItem
from catalog.models import Book, OnlineBook


class CartViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CartSerializer

    MAX_PHYSICAL_QUANTITY = 10

    def get_queryset(self):
        return Cart.objects.filter(
            user=self.request.user,
        ).select_related(
            "user",
        ).prefetch_related(
            "cart_item",
            "cart_item__book",
            "cart_item__book__discount",
            "cart_item__book__title",
            "cart_item__book__title__discount",
            "cart_item__book__title__author",
            "cart_item__book__title__publisher",
            "cart_item__book__title__translator",
            "cart_item__book__title__genres",
            "cart_item__book__title__genres__discount",
            "cart_item__online_book",
            "cart_item__online_book__discount",
            "cart_item__online_book__title",
            "cart_item__online_book__title__discount",
            "cart_item__online_book__title__author",
            "cart_item__online_book__title__publisher",
            "cart_item__online_book__title__translator",
            "cart_item__online_book__title__genres",
            "cart_item__online_book__title__genres__discount",
            "cart_item__online_book__title__physical_versions",
        ).order_by("-created_at")

    @staticmethod
    def get_default_order_status():
        return ORDER_STATUS_CHOICES[0][0]

    @staticmethod
    def get_default_payment_status():
        return PAYMENT_STATUS_CHOICES[0][0]

    def money_value(self, value):
        if value is None or value == "":
            return Decimal("0.00")

        try:
            return Decimal(str(value))
        except Exception:
            return Decimal("0.00")

    def money(self, value):
        if value is None:
            return None

        return str(value)

    def get_discount_start(self, discount):
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

    def is_discount_active(self, discount):
        if not discount:
            return False

        if hasattr(discount, "is_currently_active"):
            return discount.is_currently_active

        if not getattr(discount, "is_active", False):
            return False

        now = timezone.now()
        start_time = self.get_discount_start(discount)

        if start_time and start_time > now:
            return False

        expiration = getattr(discount, "expiration", None)

        if not expiration:
            return False

        if expiration <= now:
            return False

        percent = self.money_value(getattr(discount, "amount", None))

        return Decimal("0") < percent <= Decimal("100")

    def get_best_genre_discount(self, title):
        if not title:
            return None

        active_discounts = []

        try:
            genres = title.genres.all()
        except Exception:
            return None

        for genre in genres:
            discount = getattr(genre, "discount", None)

            if self.is_discount_active(discount):
                active_discounts.append(discount)

        if not active_discounts:
            return None

        return max(
            active_discounts,
            key=lambda discount: self.money_value(discount.amount),
        )

    def get_printed_book_active_discount(self, book):
        if not book:
            return None

        if self.is_discount_active(getattr(book, "discount", None)):
            return book.discount

        title = getattr(book, "title", None)

        if title and self.is_discount_active(getattr(title, "discount", None)):
            return title.discount

        return self.get_best_genre_discount(title)

    def get_online_book_active_discount(self, online_book):
        if not online_book:
            return None

        if self.is_discount_active(getattr(online_book, "discount", None)):
            return online_book.discount

        title = getattr(online_book, "title", None)

        if title and self.is_discount_active(getattr(title, "discount", None)):
            return title.discount

        return self.get_best_genre_discount(title)

    def get_percentage_discount_amount(self, price, discount):
        price = self.money_value(price)

        if not self.is_discount_active(discount):
            return Decimal("0.00")

        percent = self.money_value(discount.amount)
        discount_amount = price * percent / Decimal("100")

        return discount_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def apply_percentage_discount(self, price, discount):
        price = self.money_value(price)
        discount_amount = self.get_percentage_discount_amount(price, discount)
        final_price = price - discount_amount

        if final_price < 0:
            return Decimal("0.00")

        return final_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def get_final_book_price(self, book):
        if not book:
            return Decimal("0.00")

        discount = self.get_printed_book_active_discount(book)

        return self.apply_percentage_discount(book.price, discount)

    def get_book_discount_amount(self, book):
        if not book:
            return Decimal("0.00")

        discount = self.get_printed_book_active_discount(book)

        return self.get_percentage_discount_amount(book.price, discount)

    def get_final_online_book_price(self, online_book):
        if not online_book:
            return Decimal("0.00")

        discount = self.get_online_book_active_discount(online_book)

        return self.apply_percentage_discount(online_book.price, discount)

    def get_online_book_discount_amount(self, online_book):
        if not online_book:
            return Decimal("0.00")

        discount = self.get_online_book_active_discount(online_book)

        return self.get_percentage_discount_amount(online_book.price, discount)

    def clamp_physical_quantity(self, quantity):
        try:
            quantity = int(quantity or 1)
        except Exception:
            quantity = 1

        return min(max(quantity, 1), self.MAX_PHYSICAL_QUANTITY)

    def get_cart_item_quantity(self, item):
        if item.online_book:
            return 1

        return self.clamp_physical_quantity(item.quantity)

    def get_cart_item_unit_price(self, item):
        if item.online_book:
            return self.get_final_online_book_price(item.online_book)

        if item.book:
            return self.get_final_book_price(item.book)

        return Decimal("0.00")

    def get_cart_item_subtotal(self, item):
        return self.get_cart_item_unit_price(item) * self.get_cart_item_quantity(item)

    def normalize_cart_item_quantity(self, item):
        correct_quantity = self.get_cart_item_quantity(item)

        if item.quantity != correct_quantity:
            item.quantity = correct_quantity
            item.save(update_fields=["quantity", "last_update"])

        return item

    def get_or_create_cart(self):
        cart = Cart.objects.filter(
            user=self.request.user,
            order_status=self.get_default_order_status(),
            payment_status=self.get_default_payment_status(),
        ).first()

        if cart:
            return cart

        return Cart.objects.create(
            user=self.request.user,
            total_price=Decimal("0.00"),
            order_status=self.get_default_order_status(),
            payment_status=self.get_default_payment_status(),
        )

    def update_cart_total(self, cart):
        total = Decimal("0.00")

        items = CartItem.objects.filter(
            cart=cart,
        ).select_related(
            "book",
            "book__discount",
            "book__title",
            "book__title__discount",
            "online_book",
            "online_book__discount",
            "online_book__title",
            "online_book__title__discount",
        ).prefetch_related(
            "book__title__genres",
            "book__title__genres__discount",
            "online_book__title__genres",
            "online_book__title__genres__discount",
        )

        for item in items:
            item = self.normalize_cart_item_quantity(item)
            total += self.get_cart_item_subtotal(item)

        cart.total_price = total
        cart.save(update_fields=["total_price", "last_update"])

        return cart

    def get_cart_item_by_payload(self, cart, data):
        online_book_id = data.get("online_book") or data.get("online_book_id")
        book_id = data.get("book")

        if online_book_id:
            return CartItem.objects.get(
                cart=cart,
                online_book_id=online_book_id,
            )

        if book_id:
            return CartItem.objects.get(
                cart=cart,
                book_id=book_id,
            )

        raise ValidationError("book or online_book is required.")

    def get_title_authors_text(self, title):
        if not title:
            return ""

        return "، ".join(
            author.name
            for author in title.author.all()
        )

    def get_physical_book_for_title(self, title):
        if not title:
            return None

        return title.physical_versions.order_by("-id").first()

    def get_book_factor_type(self):
        return getattr(
            Factor,
            "BOOK_PURCHASE",
            getattr(Factor, "BOOK", "book_purchase"),
        )

    def get_factor_item_payload(self, item):
        quantity = self.get_cart_item_quantity(item)
        unit_price = self.get_cart_item_unit_price(item)
        item_total = unit_price * quantity

        if item.online_book:
            online_book = item.online_book
            title = online_book.title
            physical_book = self.get_physical_book_for_title(title)
            discount = self.get_online_book_active_discount(online_book)
            discount_amount = self.get_online_book_discount_amount(online_book)

            return {
                "item_type": "online_book",
                "name": title.name if title else "",
                "book_id": physical_book.id if physical_book else None,
                "title_id": title.id if title else None,
                "online_book_id": online_book.id,
                "online_book_name": title.name if title else "",
                "author": self.get_title_authors_text(title),
                "price": str(self.money_value(online_book.price)),
                "final_price": str(unit_price),
                "quantity": 1,
                "discount": str(discount_amount) if discount_amount > 0 else None,
                "discount_percent": int(discount.amount) if discount else 0,
                "format": online_book.format,
                "access_type": online_book.access_type,
                "bought_at": timezone.now().isoformat(),
                "total": str(item_total),
            }

        book = item.book
        title = book.title if book else None
        discount = self.get_printed_book_active_discount(book)
        discount_amount = self.get_book_discount_amount(book)

        return {
            "item_type": "book",
            "name": title.name if title else "",
            "book_id": book.id if book else None,
            "title_id": title.id if title else None,
            "author": self.get_title_authors_text(title),
            "price": str(self.money_value(book.price if book else 0)),
            "final_price": str(unit_price),
            "quantity": quantity,
            "discount": str(discount_amount) if discount_amount > 0 else None,
            "discount_percent": int(discount.amount) if discount else 0,
            "bought_at": timezone.now().isoformat(),
            "total": str(item_total),
        }

    def create_cart_factor(self, request, cart):
        items = []
        total = Decimal("0.00")

        cart_items = CartItem.objects.filter(
            cart=cart,
        ).select_related(
            "book",
            "book__discount",
            "book__title",
            "book__title__discount",
            "online_book",
            "online_book__discount",
            "online_book__title",
            "online_book__title__discount",
        ).prefetch_related(
            "book__title__author",
            "book__title__genres",
            "book__title__genres__discount",
            "online_book__title__author",
            "online_book__title__genres",
            "online_book__title__genres__discount",
            "online_book__title__physical_versions",
        )

        for item in cart_items:
            item = self.normalize_cart_item_quantity(item)

            if not item.book and not item.online_book:
                continue

            item_payload = self.get_factor_item_payload(item)
            total += self.money_value(item_payload["total"])
            items.append(item_payload)

        title = "فاکتور خرید کتاب"

        if len(items) == 1:
            title = f"فاکتور {items[0]['name']}"

        return Factor.objects.create(
            user=request.user,
            factor_type=self.get_book_factor_type(),
            title=title,
            amount=total,
            items=items,
        )

    def create_purchased_online_books(self, request, cart):
        granted = []

        cart_items = CartItem.objects.filter(
            cart=cart,
            online_book__isnull=False,
        ).select_related(
            "online_book",
            "online_book__title",
        )

        for item in cart_items:
            user_online_book, created = UserOnlineBook.objects.update_or_create(
                user=request.user,
                online_book=item.online_book,
                defaults={
                    "access_source": UserOnlineBook.PURCHASED,
                    "premium_until": None,
                },
            )

            granted.append(
                {
                    "id": user_online_book.id,
                    "online_book_id": item.online_book.id,
                    "book_name": item.online_book.title.name if item.online_book.title else "",
                    "created": created,
                    "access_source": user_online_book.access_source,
                    "is_access_active": user_online_book.is_access_active,
                }
            )

        return granted

    def list(self, request, *args, **kwargs):
        cart = self.get_or_create_cart()
        cart = self.update_cart_total(cart)

        serializer = self.get_serializer(
            cart,
            context={"request": request},
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        cart = self.get_object()
        cart = self.update_cart_total(cart)

        serializer = self.get_serializer(
            cart,
            context={"request": request},
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        cart = self.get_or_create_cart()
        cart = self.update_cart_total(cart)

        serializer = self.get_serializer(
            cart,
            context={"request": request},
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="add-item")
    def add_item(self, request):
        serializer = AddCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        online_book_id = serializer.validated_data.get("online_book")
        book_id = serializer.validated_data.get("book")
        quantity = serializer.validated_data.get("quantity", 1)

        cart = self.get_or_create_cart()

        if online_book_id:
            try:
                online_book = OnlineBook.objects.select_related(
                    "title",
                    "discount",
                    "title__discount",
                ).prefetch_related(
                    "title__author",
                    "title__publisher",
                    "title__genres",
                    "title__genres__discount",
                ).get(pk=online_book_id)
            except OnlineBook.DoesNotExist:
                raise ValidationError({"online_book": "online book not found."})

            cart_item, created = CartItem.objects.get_or_create(
                cart=cart,
                book=None,
                online_book=online_book,
                defaults={
                    "quantity": 1,
                },
            )

            if not created and cart_item.quantity != 1:
                cart_item.quantity = 1
                cart_item.save(update_fields=["quantity", "last_update"])

            cart = self.update_cart_total(cart)

            return Response(
                {
                    "message": "online book added to cart successfully.",
                    "cart": CartSerializer(
                        cart,
                        context={"request": request},
                    ).data,
                },
                status=status.HTTP_200_OK,
            )

        if book_id:
            try:
                book = Book.objects.select_related(
                    "title",
                    "discount",
                    "title__discount",
                ).prefetch_related(
                    "title__author",
                    "title__publisher",
                    "title__genres",
                    "title__genres__discount",
                ).get(pk=book_id)
            except Book.DoesNotExist:
                raise ValidationError({"book": "book not found."})

            quantity = self.clamp_physical_quantity(quantity)

            cart_item, created = CartItem.objects.get_or_create(
                cart=cart,
                book=book,
                online_book=None,
                defaults={
                    "quantity": quantity,
                },
            )

            if not created:
                cart_item.quantity = self.clamp_physical_quantity(
                    cart_item.quantity + quantity
                )
                cart_item.save(update_fields=["quantity", "last_update"])

            cart = self.update_cart_total(cart)

            return Response(
                {
                    "message": "book added to cart successfully.",
                    "cart": CartSerializer(
                        cart,
                        context={"request": request},
                    ).data,
                },
                status=status.HTTP_200_OK,
            )

        raise ValidationError({"detail": "book or online_book is required."})

    @action(detail=False, methods=["patch"], url_path="update-item")
    def update_item(self, request):
        serializer = UpdateCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cart = self.get_or_create_cart()

        try:
            cart_item = self.get_cart_item_by_payload(cart, request.data)
        except CartItem.DoesNotExist:
            return Response(
                {"error": "item not found in cart."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if cart_item.online_book:
            cart_item.quantity = 1
        else:
            cart_item.quantity = self.clamp_physical_quantity(
                serializer.validated_data["quantity"]
            )

        cart_item.save(update_fields=["quantity", "last_update"])

        cart = self.update_cart_total(cart)

        return Response(
            {
                "message": "cart item updated successfully.",
                "cart": CartSerializer(
                    cart,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["delete"], url_path="remove-item")
    def remove_item(self, request):
        cart = self.get_or_create_cart()

        try:
            cart_item = self.get_cart_item_by_payload(cart, request.data)
        except CartItem.DoesNotExist:
            return Response(
                {"error": "item not found in cart."},
                status=status.HTTP_404_NOT_FOUND,
            )

        cart_item.delete()

        cart = self.update_cart_total(cart)

        return Response(
            {
                "message": "item removed from cart successfully.",
                "cart": CartSerializer(
                    cart,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["delete"], url_path="clear")
    def clear_cart(self, request):
        cart = self.get_or_create_cart()

        CartItem.objects.filter(
            cart=cart,
        ).delete()

        cart = self.update_cart_total(cart)

        return Response(
            {
                "message": "cart cleared successfully.",
                "cart": CartSerializer(
                    cart,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="checkout-paid")
    def checkout_paid(self, request):
        cart = self.get_or_create_cart()
        cart = self.update_cart_total(cart)

        if not cart.cart_item.exists():
            return Response(
                {"error": "cart is empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        factor = self.create_cart_factor(request, cart)
        granted_online_books = self.create_purchased_online_books(request, cart)

        cart.order_status = PROCESSING
        cart.payment_status = PAID
        cart.save(
            update_fields=[
                "order_status",
                "payment_status",
                "total_price",
                "last_update",
            ]
        )

        return Response(
            {
                "message": "cart paid successfully.",
                "factor_id": factor.id,
                "granted_online_books": granted_online_books,
                "cart": CartSerializer(
                    cart,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )