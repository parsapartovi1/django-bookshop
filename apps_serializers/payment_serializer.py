from rest_framework import serializers
from django.utils import timezone

from payment.models import Premium, Wallet


class PremiumSerializer(serializers.ModelSerializer):
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = Premium
        fields = [
            "id",
            "premium_account",
            "premium_expiration",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

    def get_is_active(self, obj):
        if not obj.premium_account:
            return False

        if obj.premium_expiration is None:
            return True

        return obj.premium_expiration > timezone.now()


class WalletSerializer(serializers.ModelSerializer):
    user_number = serializers.CharField(
        source="user.number",
        read_only=True,
    )

    premium_status = serializers.SerializerMethodField()
    premium_expiration = serializers.DateTimeField(
        source="premium.premium_expiration",
        read_only=True,
    )

    cart_id = serializers.IntegerField(
        source="cart.id",
        read_only=True,
    )

    class Meta:
        model = Wallet
        fields = [
            "id",
            "user",
            "user_number",
            "cart",
            "cart_id",
            "amount",
            "premium",
            "premium_status",
            "premium_expiration",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "user",
            "user_number",
            "cart_id",
            "amount",
            "premium_status",
            "premium_expiration",
            "created_at",
            "updated_at",
        ]

    def get_premium_status(self, obj):
        premium = obj.premium

        if not premium.premium_account:
            return False

        if premium.premium_expiration is None:
            return True

        return premium.premium_expiration > timezone.now()


class WalletSummarySerializer(serializers.ModelSerializer):
    premium_status = serializers.SerializerMethodField()
    premium_expiration = serializers.DateTimeField(
        source="premium.premium_expiration",
        read_only=True,
    )

    class Meta:
        model = Wallet
        fields = [
            "id",
            "amount",
            "premium_status",
            "premium_expiration",
        ]

    def get_premium_status(self, obj):
        premium = obj.premium

        if not premium.premium_account:
            return False

        if premium.premium_expiration is None:
            return True

        return premium.premium_expiration > timezone.now()


class ChargeWalletSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=1,
    )


class BuyPremiumSerializer(serializers.Serializer):
    months = serializers.IntegerField(
        min_value=1,
        max_value=12,
    )