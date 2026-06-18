from django.db import models

from cart.models import Cart
from catalog.models import Book
from user.models import User


# Create your models here.


class Premium(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
    )

    premium_account = models.BooleanField(
        default=False,
        blank=True,
        null=True,
    )

    premium_expiration = models.TimeField(
        blank=True,
        null=True,
    )

class Wallet(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='userwallet',
    )

    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name='usercart',
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    premium = models.ForeignKey(
        Premium,
        on_delete=models.CASCADE,
        related_name='userpremium',
    )


class Discount(models.Model):
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    expiration = models.TimeField(
        verbose_name='expiration',
        help_text='Expiration time',
    )