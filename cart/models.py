from django.db import models

from catalog.models import Book
from user.models import User


# Create your models here.



class Cart(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    order_status = models.CharField(
        max_length=20,
    )

    payment_status = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    last_update = models.DateTimeField(
        auto_now=True
    )

class CartItem(models.Model):
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        verbose_name="cartbookitem"
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
