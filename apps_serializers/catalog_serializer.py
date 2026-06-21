from django.utils import timezone
from rest_framework import serializers

from catalog.models import (
    Author,
    Book,
    Discount,
    Genre,
    OnlineBook,
)


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = "__all__"


class DiscountSerializer(serializers.ModelSerializer):
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = Discount
        fields = "__all__"

    def get_is_active(self, obj):
        return obj.expiration > timezone.now()


class GenreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genre
        fields = "__all__"


class OnlineBookSerializer(serializers.ModelSerializer):
    class Meta:
        model = OnlineBook
        fields = "__all__"


class BookSerializer(serializers.ModelSerializer):
    author_detail = AuthorSerializer(
        source="author",
        read_only=True,
    )

    discount_detail = DiscountSerializer(
        source="discount",
        read_only=True,
    )

    online_versions = OnlineBookSerializer(
        source="onlinebook_set",
        many=True,
        read_only=True,
    )

    final_price = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = "__all__"

    def get_final_price(self, obj):
        if not obj.discount:
            return obj.price

        if obj.discount.expiration <= timezone.now():
            return obj.price

        final_price = obj.price - obj.discount.amount

        if final_price < 0:
            return 0

        return final_price