import random

from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

import os
import redis

from account.models import (
    User,
    Profile,
    Review
)

from catalog.models import Book

from apps_serializers.user_serializer import (
    OTPVerifySerializer,
    OTPRequestSerializer,
    CompleteProfileSerializer,
    ReviewSerializer,
)

from rest_framework_simplejwt.tokens import RefreshToken

from kombu.exceptions import OperationalError
from account.tasks import send_otp_sms

from rest_framework.exceptions import ValidationError, PermissionDenied

redis_client = redis.Redis.from_url(
    os.getenv("REDIS_URL", "redis://127.0.0.1:6379/1"),
    decode_responses=True,
)

class GenerateOTPViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = OTPRequestSerializer
    queryset = User.objects.none()

    def create(self, request, *args, **kwargs):

            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            number = serializer.validated_data["number"]

            cooldown_key = f"otp_cooldown:{number}"

            if redis_client.exists(cooldown_key):

                ttl = redis_client.ttl(cooldown_key)

                return Response(
                    {
                        "error": (
                            f"code already sent, "
                            f"try again in 2 minutes"
                        )
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )


            otp_code = ''.join(
                [str(random.randint(0, 9)) for _ in range(6)]
            )

            redis_client.setex(
                f"otp:{number}",
                120,
                otp_code
            )

            # redis_client.setex(
            #     cooldown_key,
            #     120,
            #     "locked"
            # )

#             try:
#                 send_otp_sms.delay(number, otp_code)
#
#             except OperationalError:
#                 return Response(
#                     {"error": "OTP service temporarily unavailable"},
#                     status=status.HTTP_503_SERVICE_UNAVAILABLE,
#
# )
#             exists = User.objects.filter(
#                 number=number
#             ).exists()

            # return Response(
            #     {
            #         "message": "OTP sent successfully",
            #     },
            #     status=status.HTTP_200_OK
            # )

            print(f"✅ OTP: {otp_code}")

            return Response(
                {
                    "message": "OTP sent , expiration in 2 minutes"
                },
                status=status.HTTP_200_OK
            )


class VerifyOTPViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = OTPVerifySerializer
    queryset = User.objects.none()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        number = serializer.validated_data["number"]
        otp = serializer.validated_data["otp"]

        stored_otp = redis_client.get(f"otp:{number}")

        if not stored_otp:
            return Response(
                {"error": "OTP expired or not found"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if str(stored_otp) != str(otp):
            return Response(
                {"error": "Invalid OTP"},
                status=status.HTTP_400_BAD_REQUEST
            )

        redis_client.delete(f"otp:{number}")

        user, is_new = User.objects.get_or_create(number=number)
        profile, _ = Profile.objects.get_or_create(user=user)

        refresh = RefreshToken.for_user(user)

        profile_pic_url = None

        if profile.photo and profile.photo.name:
            photo_name = str(profile.photo.name)

            if not (
                photo_name == "default.jpg"
                or photo_name.endswith("/default.jpg")
                or "profile_photos/default" in photo_name
            ):
                try:
                    profile_pic_url = profile.photo.url
                except ValueError:
                    profile_pic_url = None

        profile_completed = bool(
            profile.fullname
            or user.email
            or profile.age
            or profile.address
            or profile_pic_url
        )

        display_name = profile.fullname or user.number

        return Response(
            {
                "message": (
                    "OTP verified.have your tokens:"
                    if is_new
                    else f"Welcome back {display_name}"
                ),

                "is_new": is_new,
                "profile_completed": profile_completed,

                "catalog": {
                    "id": user.id,
                    "number": user.number,
                    "email": user.email,
                    "is_active": user.is_active,
                    "profile_completed": profile_completed,

                    "profile": {
                        "fullname": profile.fullname,
                        "age": profile.age,
                        "address": profile.address,
                        "profile_pic": profile_pic_url,
                    }
                },

                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token)
                }
            },
            status=status.HTTP_200_OK
        )


class SetProfileViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CompleteProfileSerializer
    queryset = Profile.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        user = request.user
        profile, _ = Profile.objects.get_or_create(user=user)

        profile_pic_url = None

        if profile.photo and profile.photo.name:
            photo_name = str(profile.photo.name)

            if not (
                photo_name == "default.jpg"
                or photo_name.endswith("/default.jpg")
                or "profile_photos/default" in photo_name
            ):
                try:
                    profile_pic_url = profile.photo.url
                except ValueError:
                    profile_pic_url = None

        profile_completed = bool(
            profile.fullname
            or user.email
            or profile.age
            or profile.address
            or profile_pic_url
        )

        return Response(
            {
                "profile_completed": profile_completed,

                "user": {
                    "id": user.id,
                    "number": user.number,
                    "email": user.email,
                    "is_active": user.is_active,
                    "profile_completed": profile_completed,

                    "profile": {
                        "fullname": profile.fullname,
                        "age": profile.age,
                        "address": profile.address,
                        "profile_pic": profile_pic_url,
                    }
                }
            },
            status=status.HTTP_200_OK
        )

    def create(self, request, *args, **kwargs):
        user = request.user
        profile, created = Profile.objects.get_or_create(user=user)

        data = request.data.copy()

        email = data.get("email")

        if "email" in data:
            data.pop("email", None)

        if email is not None:
            user.email = email.strip()
            user.save(update_fields=["email"])

        if not request.FILES.get("photo"):
            data.pop("photo", None)

        if data.get("age") in ["", None]:
            data.pop("age", None)

        serializer = self.get_serializer(
            profile,
            data=data,
            partial=True
        )

        serializer.is_valid(raise_exception=True)

        profile = serializer.save()

        profile_pic_url = None

        if profile.photo and profile.photo.name:
            photo_name = str(profile.photo.name)

            if not (
                photo_name == "default.jpg"
                or photo_name.endswith("/default.jpg")
                or "profile_photos/default" in photo_name
            ):
                try:
                    profile_pic_url = profile.photo.url
                except ValueError:
                    profile_pic_url = None

        profile_completed = bool(
            profile.fullname
            or user.email
            or profile.age
            or profile.address
            or profile_pic_url
        )

        return Response(
            {
                "message": (
                    "Profile created"
                    if created
                    else "Profile updated"
                ),

                "profile_completed": profile_completed,

                "user": {
                    "id": user.id,
                    "number": user.number,
                    "email": user.email,
                    "is_active": user.is_active,
                    "profile_completed": profile_completed,

                    "profile": {
                        "fullname": profile.fullname,
                        "age": profile.age,
                        "address": profile.address,
                        "profile_pic": profile_pic_url,
                    }
                }
            },
            status=status.HTTP_200_OK
        )

    def update(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)


class ReviewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReviewSerializer
    queryset = Review.objects.all()

    def get_queryset(self):
        qs = Review.objects.all()

        book_id = self.request.query_params.get("book")

        if book_id:
            qs = qs.filter(book_id=book_id)

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        book_id = self.request.data.get("book")

        if not book_id:
            raise ValidationError({"book": "book id is required."})

        try:
            book = Book.objects.get(pk=book_id)
        except Book.DoesNotExist:
            raise ValidationError({"book": "book not found"})

        serializer.save(
            user=self.request.user,
            book=book,
        )

    def update(self, request, *args, **kwargs):
        review = self.get_object()

        if review.user != request.user:
            raise PermissionDenied("you can only edit your own review.")

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        review = self.get_object()

        if review.user != request.user:
            raise PermissionDenied("you can only edit your own review.")

        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()

        if review.user != request.user:
            raise PermissionDenied("you can only delete your own review.")

        review.delete()

        return Response(
            {"detail": "review deleted successfully."},
            status=status.HTTP_200_OK,
        )







