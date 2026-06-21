from rest_framework import serializers

from cart.models import Cart, CartItem


class CartBookSerializer(serializers.ModelSerializer):
    author = serializers.CharField(
        source="author.name",
        read_only=True,
    )

    book_photo = serializers.SerializerMethodField()

    class Meta:
        model = CartItem._meta.get_field("book").remote_field.model
        fields = [
            "id",
            "name",
            "price",
            "author",
            "book_photo",
        ]

    def get_book_photo(self, obj):
        if not obj.photo:
            return None

        request = self.context.get("request")
        url = obj.photo.url

        if request:
            return request.build_absolute_uri(url)

        return url


class CartItemSerializer(serializers.ModelSerializer):
    book_detail = CartBookSerializer(
        source="book",
        read_only=True,
    )

    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            "id",
            "cart",
            "book",
            "book_detail",
            "quantity",
            "subtotal",
            "created_at",
            "last_update",
        ]

        read_only_fields = [
            "id",
            "cart",
            "created_at",
            "last_update",
        ]

    def get_subtotal(self, obj):
        return str(obj.book.price * obj.quantity)


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(
        source="cart_item",
        many=True,
        read_only=True,
    )

    user_number = serializers.CharField(
        source="user.number",
        read_only=True,
    )

    total_items = serializers.SerializerMethodField()
    calculated_total = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = [
            "id",
            "user",
            "user_number",
            "total_price",
            "calculated_total",
            "total_items",
            "order_status",
            "payment_status",
            "items",
            "created_at",
            "last_update",
        ]

        read_only_fields = [
            "id",
            "user",
            "total_price",
            "calculated_total",
            "total_items",
            "created_at",
            "last_update",
        ]

    def get_total_items(self, obj):
        return sum(
            item.quantity
            for item in obj.cart_item.all()
        )

    def get_calculated_total(self, obj):
        total = sum(
            item.book.price * item.quantity
            for item in obj.cart_item.all()
        )

        return str(total)


class AddCartItemSerializer(serializers.Serializer):
    book = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)