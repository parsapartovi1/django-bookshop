from decimal import Decimal
from datetime import timedelta

from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from cart.models import Cart
from cart.choices import ORDER_STATUS_CHOICES, PAYMENT_STATUS_CHOICES

from payment.models import Premium, Wallet

from apps_serializers.payment_serializer import (
    PremiumSerializer,
    WalletSerializer,
    ChargeWalletSerializer,
    BuyPremiumSerializer,
)


class WalletViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

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

    def get_or_create_premium(self):
        premium = Premium.objects.filter(
            user=self.request.user
        ).first()

        if premium:
            return premium

        return Premium.objects.create(
            user=self.request.user,
            premium_account=False,
            premium_expiration=None,
        )

    def get_or_create_wallet(self):
        cart = self.get_or_create_cart()
        premium = self.get_or_create_premium()

        wallet = Wallet.objects.filter(
            user=self.request.user,
        ).select_related(
            "user",
            "cart",
            "premium",
        ).first()

        if wallet:
            return wallet

        return Wallet.objects.create(
            user=self.request.user,
            cart=cart,
            premium=premium,
            amount=Decimal("0.00"),
        )

    def list(self, request):
        wallet = self.get_or_create_wallet()

        serializer = WalletSerializer(
            wallet,
            context={"request": request},
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, pk=None):
        wallet = self.get_or_create_wallet()

        if str(wallet.id) != str(pk):
            return Response(
                {"error": "wallet not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = WalletSerializer(
            wallet,
            context={"request": request},
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def create(self, request):
        """
        Fake wallet charge.
        Later you can connect this to PayPal/Zarinpal/etc.
        """
        serializer = ChargeWalletSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        charge_amount = serializer.validated_data["amount"]

        wallet = self.get_or_create_wallet()
        wallet.amount += charge_amount
        wallet.save(update_fields=["amount", "updated_at"])

        return Response(
            {
                "message": "wallet charged successfully.",
                "charged_amount": str(charge_amount),
                "wallet": WalletSerializer(
                    wallet,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="charge")
    def charge(self, request):
        """
        Same as POST /payment/api/wallet/
        Optional cleaner URL:
        POST /payment/api/wallet/charge/
        """
        return self.create(request)


class PremiumViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_or_create_premium(self):
        premium = Premium.objects.filter(
            user=self.request.user
        ).first()

        if premium:
            return premium

        return Premium.objects.create(
            user=self.request.user,
            premium_account=False,
            premium_expiration=None,
        )

    def get_wallet(self):
        return Wallet.objects.filter(
            user=self.request.user
        ).select_related(
            "premium",
            "cart",
        ).first()

    def list(self, request):
        premium = self.get_or_create_premium()

        serializer = PremiumSerializer(
            premium,
            context={"request": request},
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="buy")
    def buy(self, request):
        """
        Fake premium purchase using wallet balance.
        Example body:
        {
            "months": 1
        }
        """
        serializer = BuyPremiumSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        months = serializer.validated_data["months"]

        wallet = self.get_wallet()

        if not wallet:
            raise ValidationError(
                {"wallet": "wallet not found. Charge wallet first."}
            )

        price_per_month = Decimal("100000.00")
        total_price = price_per_month * months

        if wallet.amount < total_price:
            return Response(
                {
                    "error": "not enough wallet balance.",
                    "wallet_amount": str(wallet.amount),
                    "required_amount": str(total_price),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        premium = self.get_or_create_premium()

        wallet.amount -= total_price
        wallet.save(update_fields=["amount", "updated_at"])

        now = timezone.now()

        if (
            premium.premium_account
            and premium.premium_expiration
            and premium.premium_expiration > now
        ):
            premium.premium_expiration += timedelta(days=30 * months)
        else:
            premium.premium_expiration = now + timedelta(days=30 * months)

        premium.premium_account = True
        premium.save(
            update_fields=[
                "premium_account",
                "premium_expiration",
                "updated_at",
            ]
        )

        return Response(
            {
                "message": "premium activated successfully.",
                "paid_amount": str(total_price),
                "wallet_amount": str(wallet.amount),
                "premium": PremiumSerializer(
                    premium,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )