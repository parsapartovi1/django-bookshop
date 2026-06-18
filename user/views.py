from django.shortcuts import render
import random
from django.core import serializers
from rest_framework import status, viewsets, settings
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
import requests

import os
import redis

from user.models import User

from config.settings import KAVENEGAR_API_KEY

from apps_serializers.user_serializer import (
    OTPVerifySerializer,
    OTPRequestSerializer,
)


from rest_framework_simplejwt.tokens import RefreshToken

# Create your views here.


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

            redis_client.setex(
                cooldown_key,
                120,
                "locked"
            )

            try:

                api_key = KAVENEGAR_API_KEY

                url = (
                    f"https://api.kavenegar.com/v1/"
                    f"{api_key}/sms/send.json"
                )

                payload = {
                    "sender": "2000660110",
                    "receptor": number,
                    "message": f"کد ورود: {otp_code}"
                }

                response = requests.post(
                    url,
                    data=payload,
                    timeout=5
                )

                if response.status_code != 200:

                    return Response(
                        {"error": "Failed to send SMS"},
                        status=(
                            status.HTTP_500_INTERNAL_SERVER_ERROR
                        )
                    )

            except Exception:

                return Response(
                    {"error": "SMS service unavailable"},
                    status=(
                        status.HTTP_503_SERVICE_UNAVAILABLE
                    )
                )


            exists = User.objects.filter(
                number=number
            ).exists()

            return Response(
                {
                    "message": "OTP sent successfully",

                    "status": (
                        "login"
                        if exists
                        else "registration"
                    )
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

        # user exists
        if User.objects.filter(number=number).exists():

            user = User.objects.get(number=number)
            # profile, _ = Profile.objects.get_or_create(user=user)

            refresh = RefreshToken.for_user(user)

            # profile_pic_url = None
            # if profile.profile_pic and profile.profile_pic.name:
            #     try:
            #         profile_pic_url = profile.profile_pic.url
            #     except ValueError:
            #         profile_pic_url = None

            # display_name = (
            #         profile.fullname
            #         or profile.username
            #         or user.number
            # )

            return Response(
                {
                    # "message": f"Welcome back {display_name}",
                    "is_new": False,
                    "user": {
                        "id": user.id,
                        "number": user.number,
                        "email": user.email,
                        "is_active": user.is_active,

                        # "profile": {
                        #     "fullname": profile.fullname,
                        #     "bio": profile.bio,
                        #     "username": profile.username,
                        #     "profile_pic": profile_pic_url
                        # }
                    },

                    "tokens": {
                        "refresh": str(refresh),
                        "access": str(refresh.access_token)
                    }
                },
                status=status.HTTP_200_OK
            )

        user = User.objects.create(number=number)

        # profile = Profile.objects.create(
        #     user=user,
        #     username=generate_unique_profile_username()
        # )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "OTP verified. Please complete registration.",
                "is_new": True,

                "user": {
                    "id": user.id,
                    "number": user.number
                },

                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token)
                }
            },
            status=status.HTTP_200_OK
        )



