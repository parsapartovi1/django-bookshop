from django.shortcuts import render

from rest_framework.decorators import action
from rest_framework.permissions import SAFE_METHODS, BasePermission


from catalog.models import (
    Author,
    Discount,
    Genre,
    OnlineBook,
)

from apps_serializers.catalog_serializer import (
    AuthorSerializer,
    DiscountSerializer,
    GenreSerializer,
    OnlineBookSerializer,
)

from django.db.models import Q
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.response import Response

from account.models import Review
from apps_serializers.user_serializer import ReviewSerializer
from apps_serializers.catalog_serializer import BookSerializer
from catalog.models import Book





def home_page(request):
    return render(
        request,
        "main.html",
    )



class IsAdminOrReadOnly(BasePermission):
    """
    everyone can read.
    only admin can create,update,delete.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


class AuthorViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = AuthorSerializer
    queryset = Author.objects.all()

    def get_queryset(self):
        qs = Author.objects.all()

        search = self.request.query_params.get("search")

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(bio__icontains=search)
            )

        return qs.order_by("name")

    def get_author_photo_url(self, author):
        if not author.photo:
            return None

        request = self.request
        url = author.photo.url

        if request:
            return request.build_absolute_uri(url)

        return url

    def get_book_photo_url(self, book):
        if not book.photo:
            return None

        request = self.request
        url = book.photo.url

        if request:
            return request.build_absolute_uri(url)

        return url

    def list(self, request, *args, **kwargs):
        authors = self.get_queryset()

        data = []

        for author in authors:
            data.append(
                {
                    "id": author.id,
                    "name": author.name,
                    "picture": self.get_author_photo_url(author),
                }
            )

        return Response(data, status=status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
        author = self.get_object()

        books = Book.objects.filter(
            author=author
        ).select_related(
            "author",
            "discount",
        ).order_by("-id")

        books_data = []

        for book in books:
            books_data.append(
                {
                    "id": book.id,
                    "book": book.name,
                    "price": str(book.price),
                    "book_photo": self.get_book_photo_url(book),
                }
            )

        return Response(
            {
                "id": author.id,
                "name": author.name,
                "bio": author.bio,
                "picture": self.get_author_photo_url(author),
                "birth_date": author.birth_date,
                "books": books_data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def books(self, request, pk=None):
        author = self.get_object()

        books = Book.objects.filter(
            author=author
        ).select_related(
            "author",
            "discount",
        ).order_by("-id")

        books_data = []

        for book in books:
            books_data.append(
                {
                    "id": book.id,
                    "book": book.name,
                    "price": str(book.price),
                    "book_photo": self.get_book_photo_url(book),
                }
            )

        return Response(books_data, status=status.HTTP_200_OK)

class DiscountViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = DiscountSerializer
    queryset = Discount.objects.all()

    def get_queryset(self):
        qs = Discount.objects.all()
        active = self.request.query_params.get("active")
        if active == "true":
            qs = qs.filter(expiration__gt=timezone.now())

        if active == "false":
            qs = qs.filter(expiration__lte=timezone.now())

        return qs.order_by("-created_at")

    @action(detail=False, methods=["get"])
    def active(self, request):
        discounts = Discount.objects.filter(
            expiration__gt=timezone.now()
        ).order_by("-created_at")

        serializer = self.get_serializer(
            discounts,
            many=True,
        )

        return Response(serializer.data)



class GenreViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = GenreSerializer
    queryset = Genre.objects.all()

    def get_queryset(self):
        qs = Genre.objects.all()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)

        return qs.order_by("name")



class BookViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = BookSerializer

    queryset = Book.objects.select_related(
        "author",
        "discount",
    ).all()

    def get_queryset(self):
        qs = Book.objects.select_related(
            "author",
            "discount",
        ).all()

        search = self.request.query_params.get("search")
        author = self.request.query_params.get("author")
        language = self.request.query_params.get("language")
        level = self.request.query_params.get("level")
        min_price = self.request.query_params.get("min_price")
        max_price = self.request.query_params.get("max_price")

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(author__name__icontains=search)
            )

        if author:
            qs = qs.filter(author_id=author)

        if language:
            qs = qs.filter(language=language)

        if level:
            qs = qs.filter(level=level)

        if min_price:
            qs = qs.filter(price__gte=min_price)

        if max_price:
            qs = qs.filter(price__lte=max_price)

        return qs.order_by("-id")

    def get_book_photo_url(self, book):
        if not book.photo:
            return None

        request = self.request
        url = book.photo.url

        if request:
            return request.build_absolute_uri(url)

        return url

    def get_discounted_price(self, book):
        if not book.discount:
            return None

        if book.discount.expiration <= timezone.now():
            return None

        discounted_price = book.price - book.discount.amount

        if discounted_price < 0:
            discounted_price = 0

        return str(discounted_price)

    def build_book_list_item(self, book):
        return {
            "id": book.id,
            "book": book.name,
            "author": book.author.name,
            "author_id": book.author.id,
            "price": str(book.price),
            "book_photo": self.get_book_photo_url(book),
        }

    def build_discounted_book_item(self, book):
        return {
            "id": book.id,
            "book": book.name,
            "author": book.author.name,
            "author_id": book.author.id,
            "price": str(book.price),
            "discounted_price": self.get_discounted_price(book),
            "book_photo": self.get_book_photo_url(book),
        }

    def list(self, request, *args, **kwargs):
        books = self.get_queryset()

        normal_books_data = [
            self.build_book_list_item(book)
            for book in books
        ]

        discounted_books = books.filter(
            discount__isnull=False,
            discount__expiration__gt=timezone.now(),
        )

        discounted_books_data = [
            self.build_discounted_book_item(book)
            for book in discounted_books
        ]

        return Response(
            {
                "books": normal_books_data,
                "discounted_books": {
                    "message": "discounted books",
                    "items": discounted_books_data,
                },
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        book = self.get_object()

        reviews = Review.objects.filter(
            book=book,
        ).select_related(
            "user",
        ).order_by("-created_at")

        review_serializer = ReviewSerializer(
            reviews,
            many=True,
            context={"request": request},
        )

        return Response(
            {
                "id": book.id,
                "book": book.name,
                "author": book.author.name,
                "author_id": book.author.id,
                "price": str(book.price),
                "discounted_price": self.get_discounted_price(book),
                "book_photo": self.get_book_photo_url(book),
                "description": book.description,
                "level": book.level,
                "language": book.language,
                "reviews": review_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

class OnlineBookViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = OnlineBookSerializer
    queryset = OnlineBook.objects.select_related("book").all()

    def get_queryset(self):
        qs = OnlineBook.objects.select_related(
            "book",
            "book__author",
            "book__discount",
        ).all()

        book = self.request.query_params.get("book")
        book_format = self.request.query_params.get("format")
        access_type = self.request.query_params.get("access_type")
        search = self.request.query_params.get("search")

        if book:
            qs = qs.filter(book_id=book)

        if book_format:
            qs = qs.filter(format=book_format)

        if access_type:
            qs = qs.filter(access_type=access_type)

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(book__name__icontains=search)
                | Q(book__description__icontains=search)
                | Q(book__author__name__icontains=search)
            )

        return qs.order_by("-id")