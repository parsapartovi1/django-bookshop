from rest_framework import serializers
from account.models import (
    User,
    Profile,
    Review
)
from rest_framework.exceptions import PermissionDenied


class OTPRequestSerializer(serializers.Serializer):
    number = serializers.CharField(
        max_length=11,
        required=True
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
            }
        }

class CompleteProfileSerializer(serializers.ModelSerializer):

    email = serializers.EmailField(
        source="user.email",
        required=False,
        allow_null=True,
        allow_blank=True
    )

    class Meta:
        model = Profile

        fields = "__all__"
        read_only_fields =["id","user","created_at","last_update"]

    def update(self, instance, validated_data):

        user_data = validated_data.pop("user", {})
        user = instance.user

        if "email" in user_data:
            user.email = user_data["email"]

        user.save()

        if (
            "profile_pic" in validated_data
            and validated_data["profile_pic"] is None
        ):
            instance.profile_pic.delete(save=False)
            instance.profile_pic = None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        return instance

    def create(self, validated_data):

        user_data = validated_data.pop("user", {})
        user = self.context["request"].user

        profile, created = Profile.objects.get_or_create(
            user=user
        )

        for attr, value in validated_data.items():
            setattr(profile, attr, value)

        if "email" in user_data:
            user.email = user_data["email"]

        user.save()
        profile.save()

        return profile




class ReviewSerializer(serializers.ModelSerializer):
    fullname = serializers.CharField(
        source="user.user_profile.fullname",
        read_only=True
    )

    profile_pic = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = "__all__"
        read_only_fields = [
            "id",
            "user",
            "book",
            "created_at",
            "last_update",
        ]

    def get_profile_pic(self, obj):
        profile = getattr(obj.user, "user_profile", None)

        if not profile or not profile.profile_pic:
            return None

        request = self.context.get("request")
        url = profile.profile_pic.url

        if request:
            return request.build_absolute_uri(url)

        return url

    def create(self, validated_data):
        user = self.context["request"].user

        return Review.objects.create(
            user=user,
            **validated_data
        )

    def update(self, instance, validated_data):
        user = self.context["request"].user

        if instance.user != user:
            raise PermissionDenied(
                "You do not have permission to edit this review."
            )

        return super().update(instance, validated_data)

