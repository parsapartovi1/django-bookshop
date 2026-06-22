from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.views.generic import TemplateView

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

    path("login/", TemplateView.as_view(template_name="login.html"), name="account-login"),
    path("set-profile/", TemplateView.as_view(template_name="set-profile.html"), name="set-profile"),
    path("profile/", TemplateView.as_view(template_name="set-profile.html"), name="account-profile"),
]
