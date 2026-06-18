from django.urls import path, include
from rest_framework.routers import DefaultRouter


from .views import (
    GenerateOTPViewSet,
    VerifyOTPViewSet)

router = DefaultRouter()
router.register("api/send-otp", GenerateOTPViewSet, basename="send-otp")
router.register("api/verify-otp", VerifyOTPViewSet, basename="verify-otp")

urlpatterns = [
    path("", include(router.urls)),

]