from django.urls import include, path
from rest_framework.routers import DefaultRouter

from catalog.views import (
    AuthorViewSet,
    BookViewSet,
    DiscountViewSet,
    GenreViewSet,
    OnlineBookViewSet,
    PublishersViewSet,
    BookTitleViewSet,
    TranslatorsViewSet,
)


router = DefaultRouter()

router.register("authors",AuthorViewSet,basename="authors",)
router.register("books",BookViewSet,basename="books",)
router.register("discounts",DiscountViewSet,basename="discounts",)
router.register("publishers", PublishersViewSet, basename="publishers")
router.register("genres",GenreViewSet,basename="genres",)
router.register("online-books",OnlineBookViewSet,basename="online-books",)
router.register("book-titles", BookTitleViewSet, basename="book-titles")
router.register("translators", TranslatorsViewSet, basename="translators")



urlpatterns = [
    path("api/", include(router.urls)),

]