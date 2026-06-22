from django.urls import include, path
from rest_framework.routers import DefaultRouter
from django.views.generic import TemplateView

from cart.views import CartViewSet


router = DefaultRouter()

router.register("carts", CartViewSet, basename="carts")

urlpatterns = [
    path("api/", include(router.urls)),

    path("", TemplateView.as_view(template_name="cart.html"), name="cart-page"),
]