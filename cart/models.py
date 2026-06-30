from django.core.exceptions import ValidationError
from django.db import models

from account.models import User

from .choices import (
    ORDER_STATUS_CHOICES,
    PAYMENT_STATUS_CHOICES,
)


class Cart(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="user_cart",
        verbose_name="cart user",
        help_text="the owner of the cart",
    )

    total_price = models.DecimalField(
        verbose_name="total price",
        help_text="the total price of cart",
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    order_status = models.CharField(
        verbose_name="order status",
        help_text="the status of the order",
        max_length=30,
        choices=ORDER_STATUS_CHOICES,
    )

    payment_status = models.CharField(
        verbose_name="payment status",
        help_text="the status of payment",
        max_length=30,
        choices=PAYMENT_STATUS_CHOICES,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    last_update = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "1.Cart"
        verbose_name_plural = "1.Carts"

    def __str__(self):
        return f"{self.user.number} - {self.order_status}"


class CartItem(models.Model):
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="cart_item",
        verbose_name="cart",
        help_text="the cart of this item",
    )

    book = models.ForeignKey(
        "catalog.Book",
        on_delete=models.CASCADE,
        related_name="cart_book_item",
        verbose_name="physical book",
        help_text="the physical book inside the cart",
        blank=True,
        null=True,
    )

    online_book = models.ForeignKey(
        "catalog.OnlineBook",
        on_delete=models.CASCADE,
        related_name="cart_online_book_item",
        verbose_name="online book",
        help_text="the online book inside the cart",
        blank=True,
        null=True,
    )

    quantity = models.PositiveIntegerField(
        verbose_name="quantity",
        help_text="the quantity of the item",
        default=1,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    last_update = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "2.Cart Item"
        verbose_name_plural = "2.Cart Items"

    def clean(self):
        if self.book and self.online_book:
            raise ValidationError(
                "cart item can not have both book and online book"
            )

        if not self.book and not self.online_book:
            raise ValidationError(
                "cart item must have a book or online book"
            )

        if self.online_book:
            self.quantity = 1

    def save(self, *args, **kwargs):
        self.clean()

        super().save(*args, **kwargs)

    @property
    def item_type(self):
        if self.online_book:
            return "online_book"

        return "book"

    def __str__(self):
        if self.online_book:
            title = getattr(self.online_book, "title", None)
            return f"{title.name if title else 'Online Book'} x 1"

        title = getattr(self.book, "title", None)
        return f"{title.name if title else 'Book'} x {self.quantity}"