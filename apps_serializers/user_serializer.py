from rest_framework import serializers

from account.models import (
    Factor,
    Profile,
    Review,
    User,
    UserOnlineBook,
)


class OTPRequestSerializer(serializers.Serializer):
    number = serializers.CharField(
        max_length=11,
        required=True,
    )


class OTPVerifySerializer(serializers.Serializer):
    number = serializers.CharField(max_length=11)
    otp = serializers.CharField(max_length=6)


class UserCreationSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "number",
            "email",
            "is_active",
        ]

        extra_kwargs = {
            "number": {
                "required": True,
            },
            "email": {
                "required": False,
                "allow_null": True,
                "allow_blank": True,
            },
        }


class CompleteProfileSerializer(serializers.ModelSerializer):
    address = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = Profile
        fields = [
            "fullname",
            "username",
            "photo",
            "age",
            "post_code",
            "address",
        ]

        extra_kwargs = {
            "fullname": {
                "required": False,
                "allow_blank": True,
            },
            "username": {
                "required": False,
                "allow_blank": True,
                "allow_null": True,
            },
            "photo": {
                "required": False,
                "allow_null": True,
            },
            "age": {
                "required": False,
                "allow_null": True,
            },
            "post_code": {
                "required": False,
                "allow_blank": True,
                "allow_null": True,
            },
        }

    def validate(self, attrs):
        address = attrs.pop("address", None)

        if address is not None and not attrs.get("post_code"):
            attrs["post_code"] = address

        return attrs


class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    profile_pic = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    book_name = serializers.SerializerMethodField()
    book_photo = serializers.SerializerMethodField()
    title_id = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            "id",
            "user",
            "book",
            "title_id",
            "book_name",
            "book_photo",
            "text",
            "username",
            "display_name",
            "profile_pic",
            "created_at",
            "last_update",
            "is_owner",
        ]

        read_only_fields = [
            "id",
            "user",
            "title_id",
            "book_name",
            "book_photo",
            "username",
            "display_name",
            "profile_pic",
            "created_at",
            "last_update",
            "is_owner",
        ]

    def get_profile(self, obj):
        return getattr(obj.user, "profile_user", None)

    def get_username(self, obj):
        profile = self.get_profile(obj)

        if profile and profile.username:
            return str(profile.username).strip()

        return ""

    def get_display_name(self, obj):
        username = self.get_username(obj)

        if username:
            return username

        return "کاربر کتابوک"

    def get_profile_pic(self, obj):
        request = self.context.get("request")
        profile = self.get_profile(obj)

        if not profile or not profile.photo:
            return None

        try:
            url = profile.photo.url
        except ValueError:
            return None

        if request:
            return request.build_absolute_uri(url)

        return url

    def get_is_owner(self, obj):
        request = self.context.get("request")

        return bool(
            request
            and request.user
            and request.user.is_authenticated
            and obj.user.pk == request.user.pk
        )

    def get_title_id(self, obj):
        if not obj.book or not obj.book.title:
            return None

        return obj.book.title.pk

    def get_book_name(self, obj):
        if not obj.book or not obj.book.title:
            return "کتاب حذف شده"

        return obj.book.title.name

    def get_book_photo(self, obj):
        request = self.context.get("request")

        if not obj.book or not obj.book.title or not obj.book.title.photo:
            return ""

        url = obj.book.title.photo.url

        if request:
            return request.build_absolute_uri(url)

        return url


class FactorSerializer(serializers.ModelSerializer):
    type = serializers.CharField(
        source="factor_type",
        read_only=True,
    )

    type_label = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    date = serializers.DateTimeField(
        source="created_at",
        read_only=True,
    )

    class Meta:
        model = Factor
        fields = [
            "id",
            "user",
            "factor_type",
            "type",
            "type_label",
            "title",
            "amount",
            "total",
            "items",
            "date",
            "created_at",
            "last_update",
        ]

        read_only_fields = [
            "id",
            "user",
            "factor_type",
            "type",
            "type_label",
            "title",
            "amount",
            "total",
            "items",
            "date",
            "created_at",
            "last_update",
        ]

    def get_total(self, obj):
        return str(obj.amount)

    def get_type_label(self, obj):
        if obj.factor_type == Factor.WALLET_CHARGE:
            return "شارژ کیف پول"

        if obj.factor_type == Factor.PREMIUM:
            return "اشتراک ویژه"

        return "خرید کتاب"

    def get_item_book_type(self, obj, item):
        item_type = str(item.get("item_type", "") or "").strip().lower()

        if item_type == "online_book":
            return "کتاب آنلاین"

        if item_type in ["book", "physical_book"]:
            return "کتاب چاپی"

        if obj.factor_type == Factor.WALLET_CHARGE:
            return "شارژ کیف پول"

        if obj.factor_type == Factor.PREMIUM:
            return "اشتراک ویژه"

        return "کتاب چاپی"

    def normalize_item(self, obj, item):
        if not isinstance(item, dict):
            return {
                "name": str(item),
                "price": "",
                "quantity": "",
                "book_type": self.get_item_book_type(obj, {}),
                "total": "",
            }

        normalized = {}

        preferred_keys = [
            "item_type",
            "name",
            "book_id",
            "title_id",
            "online_book_id",
            "online_book_name",
            "author",
            "price",
            "final_price",
            "quantity",
        ]

        for key in preferred_keys:
            if key in item:
                normalized[key] = item.get(key)

        # This is the backend value for the new column:
        # تعداد -> نوع کتاب
        normalized["book_type"] = self.get_item_book_type(obj, item)
        normalized["type_label"] = normalized["book_type"]

        for key, value in item.items():
            if key not in normalized:
                normalized[key] = value

        return normalized

    def get_items(self, obj):
        raw_items = obj.items or []

        if not isinstance(raw_items, list):
            return []

        return [
            self.normalize_item(obj, item)
            for item in raw_items
        ]


class UserOnlineBookSerializer(serializers.ModelSerializer):
    online_book_id = serializers.SerializerMethodField()
    online_book_name = serializers.SerializerMethodField()
    online_book_url = serializers.SerializerMethodField()
    online_book_format = serializers.SerializerMethodField()
    online_book_format_display = serializers.SerializerMethodField()
    online_book_access_type = serializers.SerializerMethodField()
    online_book_access_type_display = serializers.SerializerMethodField()

    title_id = serializers.SerializerMethodField()
    book_id = serializers.SerializerMethodField()
    book_name = serializers.SerializerMethodField()
    book_photo = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()
    publisher_name = serializers.SerializerMethodField()
    book_type = serializers.SerializerMethodField()

    access_source_label = serializers.SerializerMethodField()
    is_access_active = serializers.SerializerMethodField()
    access_message = serializers.SerializerMethodField()
    reader_url = serializers.SerializerMethodField()

    class Meta:
        model = UserOnlineBook
        fields = [
            "id",

            "online_book_id",
            "online_book_name",
            "online_book_url",
            "online_book_format",
            "online_book_format_display",
            "online_book_access_type",
            "online_book_access_type_display",

            "title_id",
            "book_id",
            "book_name",
            "book_photo",
            "author_name",
            "publisher_name",
            "book_type",

            "access_source",
            "access_source_label",
            "premium_until",
            "is_access_active",
            "access_message",
            "reader_url",

            "created_at",
            "last_update",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "last_update",
        ]

    def get_title(self, obj):
        online_book = getattr(obj, "online_book", None)

        if not online_book:
            return None

        return getattr(online_book, "title", None)

    def get_online_book_id(self, obj):
        return obj.online_book.pk if obj.online_book else None

    def get_online_book_name(self, obj):
        title = self.get_title(obj)

        return title.name if title else ""

    def get_online_book_url(self, obj):
        if not obj.is_access_active:
            return ""

        request = self.context.get("request")

        if not obj.online_book or not obj.online_book.url:
            return ""

        if request:
            return request.build_absolute_uri(obj.online_book.url.url)

        return obj.online_book.url.url

    def get_online_book_format(self, obj):
        return obj.online_book.format if obj.online_book else ""

    def get_online_book_format_display(self, obj):
        if not obj.online_book:
            return ""

        try:
            return obj.online_book.get_format_display()
        except Exception:
            return obj.online_book.format or ""

    def get_online_book_access_type(self, obj):
        return obj.online_book.access_type if obj.online_book else ""

    def get_online_book_access_type_display(self, obj):
        if not obj.online_book:
            return ""

        try:
            return obj.online_book.get_access_type_display()
        except Exception:
            return obj.online_book.access_type or ""

    def get_title_id(self, obj):
        title = self.get_title(obj)

        return title.pk if title else None

    def get_book_id(self, obj):
        title = self.get_title(obj)

        if not title:
            return None

        physical_book = title.physical_versions.order_by("-id").first()

        return physical_book.pk if physical_book else None

    def get_book_name(self, obj):
        title = self.get_title(obj)

        return title.name if title else ""

    def get_book_photo(self, obj):
        request = self.context.get("request")
        title = self.get_title(obj)

        if not title or not title.photo:
            return ""

        if request:
            return request.build_absolute_uri(title.photo.url)

        return title.photo.url

    def get_author_name(self, obj):
        title = self.get_title(obj)

        if not title:
            return ""

        return "، ".join(
            author.name
            for author in title.author.all()
        )

    def get_publisher_name(self, obj):
        title = self.get_title(obj)

        if not title:
            return ""

        return "، ".join(
            publisher.publisher
            for publisher in title.publisher.all()
        )

    def get_book_type(self, obj):
        return "کتاب آنلاین"

    def get_access_source_label(self, obj):
        if obj.access_source == UserOnlineBook.PURCHASED:
            return "خریداری‌شده"

        if obj.access_source == UserOnlineBook.PREMIUM:
            return "اشتراک ویژه"

        return ""

    def get_is_access_active(self, obj):
        return obj.is_access_active

    def get_access_message(self, obj):
        return obj.access_message

    def get_reader_url(self, obj):
        if not obj.is_access_active:
            return ""

        return f"/ketabook/online-books/{obj.online_book.pk}/reader/"