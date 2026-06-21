from decimal import Decimal

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from catalog.models import Book
from cart.models import Cart, CartItem
from cart.choices import ORDER_STATUS_CHOICES, PAYMENT_STATUS_CHOICES

from apps_serializers.cart_serializer import (
    CartSerializer,
    AddCartItemSerializer,
    UpdateCartItemSerializer,
)


class CartViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CartSerializer

    def get_queryset(self):
        return Cart.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "cart_item",
            "cart_item__book",
            "cart_item__book__author",
        ).order_by("-created_at")

    def get_default_order_status(self):
        return ORDER_STATUS_CHOICES[0][0]

    def get_default_payment_status(self):
        return PAYMENT_STATUS_CHOICES[0][0]

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
            cart=cart
        ).select_related(
            "book"
        )

        for item in items:
            total += item.book.price * item.quantity

        cart.total_price = total
        cart.save(update_fields=["total_price", "last_update"])

        return cart

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

        book_id = serializer.validated_data["book"]
        quantity = serializer.validated_data["quantity"]

        try:
            book = Book.objects.get(pk=book_id)
        except Book.DoesNotExist:
            raise ValidationError({"book": "book not found."})

        cart = self.get_or_create_cart()

        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            book=book,
            defaults={
                "quantity": quantity,
            },
        )

        if not created:
            cart_item.quantity += quantity
            cart_item.save(update_fields=["quantity", "last_update"])

        cart = self.update_cart_total(cart)

        return Response(
            {
                "message": "item added to cart successfully.",
                "cart": CartSerializer(
                    cart,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["patch"], url_path="update-item")
    def update_item(self, request):
        serializer = UpdateCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        book_id = request.data.get("book")
        quantity = serializer.validated_data["quantity"]

        if not book_id:
            raise ValidationError({"book": "book id is required."})

        cart = self.get_or_create_cart()

        try:
            cart_item = CartItem.objects.get(
                cart=cart,
                book_id=book_id,
            )
        except CartItem.DoesNotExist:
            return Response(
                {"error": "item not found in cart."},
                status=status.HTTP_404_NOT_FOUND,
            )

        cart_item.quantity = quantity
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
        book_id = request.data.get("book")

        if not book_id:
            raise ValidationError({"book": "book id is required."})

        cart = self.get_or_create_cart()

        try:
            cart_item = CartItem.objects.get(
                cart=cart,
                book_id=book_id,
            )
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
            cart=cart
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
