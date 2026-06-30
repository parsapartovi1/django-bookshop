from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.views.generic import TemplateView

from .views import (
    GenerateOTPViewSet,
    VerifyOTPViewSet,
    SetProfileViewSet,
    ReviewViewSet,
    FactorViewSet,
UserOnlineBookViewSet

)


router = DefaultRouter()
router.register("api/send-otp", GenerateOTPViewSet, basename="send-otp")
router.register("api/verify-otp", VerifyOTPViewSet, basename="verify-otp")
router.register("api/set-profile", SetProfileViewSet, basename="set-profile")
router.register("api/review", ReviewViewSet, basename="review-act")
router.register("api/factors", FactorViewSet, basename="factors")
router.register("api/my-online-books", UserOnlineBookViewSet, basename="my-online-books")



urlpatterns = [
    path("", include(router.urls)),
]
