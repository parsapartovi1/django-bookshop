from django.urls import include, path
from rest_framework.routers import DefaultRouter

from cart.views import CartViewSet


router = DefaultRouter()

router.register("carts", CartViewSet, basename="carts")

urlpatterns = [
    path("api/", include(router.urls)),
]