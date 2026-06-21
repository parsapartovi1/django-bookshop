from django.urls import include, path
from rest_framework.routers import DefaultRouter

from payment.views import WalletViewSet, PremiumViewSet


router = DefaultRouter()

router.register("wallet", WalletViewSet, basename="wallet")
router.register("premium", PremiumViewSet, basename="premium")

urlpatterns = [
    path("api/", include(router.urls)),
]