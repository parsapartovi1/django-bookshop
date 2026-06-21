from django.urls import include, path
from rest_framework.routers import DefaultRouter

from catalog.views import (
    AuthorViewSet,
    BookViewSet,
    DiscountViewSet,
    GenreViewSet,
    OnlineBookViewSet,
)

from django.views.generic import TemplateView

router = DefaultRouter()

router.register(
    "authors",
    AuthorViewSet,
    basename="authors",
)

router.register(
    "books",
    BookViewSet,
    basename="books",
)

router.register(
    "discounts",
    DiscountViewSet,
    basename="discounts",
)

router.register(
    "genres",
    GenreViewSet,
    basename="genres",
)

router.register(
    "online-books",
    OnlineBookViewSet,
    basename="online-books",
)

urlpatterns = [
    path("api/", include(router.urls)),
    path(
        "ketabook/",
        TemplateView.as_view(template_name="home.html"),
        name="ketabook-home",
    ),
]