from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    GenerateOTPViewSet,
    VerifyOTPViewSet,
    SetProfileViewSet,
    ReviewViewSet,
)

router = DefaultRouter()
router.register("api/send-otp", GenerateOTPViewSet, basename="send-otp")
router.register("api/verify-otp", VerifyOTPViewSet, basename="verify-otp")
router.register("api/set-profile", SetProfileViewSet, basename="set-profile")
router.register("api/review", ReviewViewSet, basename="review-act")

urlpatterns = [
    path("", include(router.urls)),
]
