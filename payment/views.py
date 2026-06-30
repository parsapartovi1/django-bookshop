from decimal import Decimal
from datetime import timedelta

from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from account.models import Factor
from apps_serializers.payment_serializer import (
    BuyPremiumSerializer,
    ChargeWalletSerializer,
    PremiumSerializer,
    WalletSerializer,
)
from cart.choices import ORDER_STATUS_CHOICES, PAYMENT_STATUS_CHOICES
from cart.models import Cart
from payment.models import Premium, Wallet


class WalletViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def get_default_order_status():
        return ORDER_STATUS_CHOICES[0][0]

    @staticmethod
    def get_default_payment_status():
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
            user=self.request.user,
        ).order_by("-pk").first()

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
        ).order_by("-pk").first()

        if wallet:
            changed_fields = []

            if wallet.cart.pk != cart.pk:
                wallet.cart = cart
                changed_fields.append("cart")

            if wallet.premium.pk != premium.pk:
                wallet.premium = premium
                changed_fields.append("premium")

            if changed_fields:
                changed_fields.append("updated_at")
                wallet.save(update_fields=changed_fields)

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

        if str(wallet.pk) != str(pk):
            return Response(
                {
                    "error": "wallet not found.",
                },
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
        serializer = ChargeWalletSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        charge_amount = serializer.validated_data["amount"]

        wallet = self.get_or_create_wallet()
        wallet.amount += charge_amount
        wallet.save(update_fields=["amount", "updated_at"])

        Factor.objects.create(
            user=request.user,
            factor_type=Factor.WALLET_CHARGE,
            title="فاکتور شارژ کیف پول",
            amount=charge_amount,
            items=[
                {
                    "name": "شارژ کیف پول",
                    "price": str(charge_amount),
                    "quantity": 1,
                    "discount": None,
                    "bought_at": timezone.now().isoformat(),
                    "total": str(charge_amount),
                }
            ],
        )

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
        return self.create(request)


class PremiumViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    PRICE_PER_MONTH = Decimal("100000.00")

    @staticmethod
    def get_default_order_status():
        return ORDER_STATUS_CHOICES[0][0]

    @staticmethod
    def get_default_payment_status():
        return PAYMENT_STATUS_CHOICES[0][0]

    def get_or_create_premium(self):
        premium = Premium.objects.filter(
            user=self.request.user,
        ).order_by("-pk").first()

        if premium:
            return premium

        return Premium.objects.create(
            user=self.request.user,
            premium_account=False,
            premium_expiration=None,
        )

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

    def get_or_create_wallet(self):
        premium = self.get_or_create_premium()
        cart = self.get_or_create_cart()

        wallet = Wallet.objects.filter(
            user=self.request.user,
        ).select_related(
            "premium",
            "cart",
            "user",
        ).order_by("-pk").first()

        if wallet:
            changed_fields = []

            if wallet.premium.pk != premium.pk:
                wallet.premium = premium
                changed_fields.append("premium")

            if wallet.cart.pk != cart.pk:
                wallet.cart = cart
                changed_fields.append("cart")

            if changed_fields:
                changed_fields.append("updated_at")
                wallet.save(update_fields=changed_fields)

            return wallet

        return Wallet.objects.create(
            user=self.request.user,
            cart=cart,
            premium=premium,
            amount=Decimal("0.00"),
        )

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
        serializer = BuyPremiumSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        months = serializer.validated_data["months"]

        wallet = self.get_or_create_wallet()
        premium = self.get_or_create_premium()

        total_price = self.PRICE_PER_MONTH * months

        if wallet.amount < total_price:
            return Response(
                {
                    "error": "not enough wallet balance.",
                    "wallet_amount": str(wallet.amount),
                    "required_amount": str(total_price),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        wallet.amount -= total_price
        wallet.save(update_fields=["amount", "updated_at"])

        now = timezone.now()

        if premium.is_active and premium.premium_expiration:
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

        Factor.objects.create(
            user=request.user,
            factor_type=Factor.PREMIUM,
            title="فاکتور خرید اشتراک ویژه",
            amount=total_price,
            items=[
                {
                    "name": f"اشتراک ویژه {months} ماهه",
                    "price": str(total_price),
                    "quantity": f"{months} ماه",
                    "discount": None,
                    "bought_at": timezone.now().isoformat(),
                    "total": str(total_price),
                }
            ],
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