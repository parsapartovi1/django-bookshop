from django.db import models

from account.models import User

from .choices import (
    ORDER_STATUS_CHOICES,
    PAYMENT_STATUS_CHOICES
)


class Cart(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="user_cart"
    )

    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    order_status = models.CharField(
        max_length=30,
        choices=ORDER_STATUS_CHOICES,
    )

    payment_status = models.CharField(
        max_length=30,
        choices=PAYMENT_STATUS_CHOICES,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    last_update = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        verbose_name_plural = '1.Cart'

    def __str__(self):
        return self.order_status



class CartItem(models.Model):
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="cart_item"
    )
    book = models.ForeignKey(
        "catalog.Book",
        on_delete=models.CASCADE,
        related_name="cart_book_item"
    )

    quantity = models.IntegerField(
        default=0
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    last_update = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        verbose_name_plural = '2.CartItem'

    def __str__(self):
        return f"{self.book} x {self.quantity}"