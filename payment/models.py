from django.db import models

from catalog.models import Book
from account.models import User



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

    premium_expiration = models.DateTimeField(
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        verbose_name = "1.premium account"

    def __str__(self):
        return f"{self.user.number} premium account"



class Wallet(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='user_wallet',
    )

    cart = models.ForeignKey(
        "cart.Cart",
        on_delete=models.CASCADE,
        related_name='user_cart_wallet',
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    premium = models.ForeignKey(
        Premium,
        on_delete=models.CASCADE,
        related_name='user_premium',
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        verbose_name = "2.users wallet"


