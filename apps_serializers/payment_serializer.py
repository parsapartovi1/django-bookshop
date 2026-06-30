from rest_framework import serializers

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
        if hasattr(obj, "is_active"):
            return obj.is_active

        return False


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
        premium = getattr(obj, "premium", None)

        if not premium:
            return False

        if hasattr(premium, "is_active"):
            return premium.is_active

        return False


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
        premium = getattr(obj, "premium", None)

        if not premium:
            return False

        if hasattr(premium, "is_active"):
            return premium.is_active

        return False


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