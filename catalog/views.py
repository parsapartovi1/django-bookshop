from decimal import Decimal, ROUND_HALF_UP

import fitz

from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import render
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import (
    SAFE_METHODS,
    AllowAny,
    BasePermission,
    IsAuthenticated,
)
from rest_framework.response import Response

from account.models import Review, UserOnlineBook
from apps_serializers.catalog_serializer import (
    AuthorSerializer,
    BookSerializer,
    BookTitleSerializer,
    DiscountSerializer,
    GenreSerializer,
    OnlineBookSerializer,
    PublishersSerializer,
    TranslatorsSerializer,
)
from apps_serializers.user_serializer import ReviewSerializer

from catalog.choices import GENRE_CHOICES, LEVEL_CHOICES
from catalog.models import (
    Author,
    Book,
    BookTitle,
    Genre,
    OnlineBook,
    Publishers,
    Translators,
)
from payment.models import Discount


def home_page(request):
    return render(request, "home.html")


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


# =========================================================
# SHARED HELPERS
# =========================================================

def model_has_field(model_class, field_name):
    try:
        model_class._meta.get_field(field_name)
        return True
    except Exception:
        return False


def file_url(request, file_field):
    if not file_field:
        return ""

    try:
        url = file_field.url
    except Exception:
        return ""

    if request:
        return request.build_absolute_uri(url)

    return url


def display_value(obj, field_name):
    if not obj:
        return ""

    getter = getattr(obj, f"get_{field_name}_display", None)

    if callable(getter):
        try:
            return getter()
        except Exception:
            pass

    return getattr(obj, field_name, "") or ""


def money(value):
    if value is None:
        return None

    return str(value)


def money_value(value):
    if value is None or value == "":
        return Decimal("0.00")

    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0.00")


def get_discount_start(discount):
    if not discount:
        return None

    for field_name in [
        "start",
        "start_time",
        "starts_at",
        "valid_from",
        "started_at",
    ]:
        value = getattr(discount, field_name, None)

        if value:
            return value

    return None


def is_discount_active(discount):
    if not discount:
        return False

    if hasattr(discount, "is_currently_active"):
        return bool(discount.is_currently_active)

    if not getattr(discount, "is_active", False):
        return False

    now = timezone.now()
    start_time = get_discount_start(discount)

    if start_time and start_time > now:
        return False

    expiration = getattr(discount, "expiration", None)

    if not expiration:
        return False

    if expiration <= now:
        return False

    percent = money_value(getattr(discount, "amount", None))

    return Decimal("0") < percent <= Decimal("100")


def get_percentage_discount_amount(price, discount):
    price = money_value(price)

    if not is_discount_active(discount):
        return Decimal("0.00")

    percent = money_value(discount.amount)
    discount_amount = price * percent / Decimal("100")

    return discount_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def apply_percentage_discount(price, discount):
    price = money_value(price)
    discount_amount = get_percentage_discount_amount(price, discount)
    final_price = price - discount_amount

    if final_price < 0:
        return Decimal("0.00")

    return final_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_best_genre_discount(title):
    if not title:
        return None

    active_discounts = []

    try:
        genres = title.genres.all()
    except Exception:
        return None

    for genre in genres:
        discount = getattr(genre, "discount", None)

        if is_discount_active(discount):
            active_discounts.append(discount)

    if not active_discounts:
        return None

    return max(
        active_discounts,
        key=lambda discount: money_value(discount.amount),
    )


def get_printed_book_active_discount(book):
    if not book:
        return None

    if is_discount_active(book.discount):
        return book.discount

    title = getattr(book, "title", None)

    if title and is_discount_active(title.discount):
        return title.discount

    return get_best_genre_discount(title)


def get_online_book_active_discount(online_book):
    if not online_book:
        return None

    if is_discount_active(online_book.discount):
        return online_book.discount

    title = getattr(online_book, "title", None)

    if title and is_discount_active(title.discount):
        return title.discount

    return get_best_genre_discount(title)


def get_book_discount_amount(book):
    if not book:
        return Decimal("0.00")

    discount = get_printed_book_active_discount(book)

    return get_percentage_discount_amount(book.price, discount)


def get_final_book_price(book):
    if not book:
        return Decimal("0.00")

    discount = get_printed_book_active_discount(book)

    return apply_percentage_discount(book.price, discount)


def get_discounted_price(book):
    if not book:
        return None

    original_price = money_value(book.price)
    final_price = get_final_book_price(book)

    if final_price < original_price:
        return final_price

    return None


def get_online_book_discount_amount(online_book):
    if not online_book:
        return Decimal("0.00")

    base_price = money_value(getattr(online_book, "price", None))
    discount = get_online_book_active_discount(online_book)

    return get_percentage_discount_amount(base_price, discount)


def get_final_online_book_price(online_book):
    if not online_book:
        return Decimal("0.00")

    base_price = money_value(getattr(online_book, "price", None))
    discount = get_online_book_active_discount(online_book)

    return apply_percentage_discount(base_price, discount)


def get_discounted_online_book_price(online_book):
    if not online_book:
        return None

    original_price = money_value(online_book.price)
    final_price = get_final_online_book_price(online_book)

    if final_price < original_price:
        return final_price

    return None


def first_physical_book(title):
    if not title:
        return None

    try:
        return title.physical_versions.all().order_by("-pk").first()
    except Exception:
        return None


# =========================================================
# USER AGE / RECOMMENDED BOOK HELPERS
# =========================================================

def calculate_age_from_birth_date(birth_date):
    if not birth_date:
        return None

    today = timezone.localdate()

    return today.year - birth_date.year - (
        (today.month, today.day) < (birth_date.month, birth_date.day)
    )


def safe_int(value):
    if value is None or value == "":
        return None

    try:
        return int(value)
    except Exception:
        return None


def get_age_from_object(obj):
    if not obj:
        return None

    age = safe_int(getattr(obj, "age", None))

    if age is not None:
        return age

    birth_date = (
        getattr(obj, "birth_date", None)
        or getattr(obj, "birthday", None)
        or getattr(obj, "date_of_birth", None)
    )

    return calculate_age_from_birth_date(birth_date)


def get_user_profile_object(user):
    if not user or not user.is_authenticated:
        return None

    possible_profile_attrs = [
        "profile_user",
        "profile",
        "user_profile",
    ]

    for attr in possible_profile_attrs:
        try:
            profile = getattr(user, attr, None)
        except Exception:
            continue

        if not profile:
            continue

        if hasattr(profile, "all"):
            try:
                return profile.all().first()
            except Exception:
                continue

        return profile

    return None


def get_user_age(user):
    if not user or not user.is_authenticated:
        return None

    age = get_age_from_object(user)

    if age is not None:
        return age

    profile = get_user_profile_object(user)

    return get_age_from_object(profile)


def get_level_from_age(age):
    age = safe_int(age)

    if age is None:
        return None

    if age <= 10:
        return "kid"

    if 11 <= age <= 12:
        return "middle_grade"

    if 13 <= age <= 17:
        return "teen"

    if 18 <= age <= 24:
        return "young_adult"

    if age >= 25:
        return "adult"

    return None


def get_user_recommended_level(user):
    age = get_user_age(user)

    if age is None:
        return None

    return get_level_from_age(age)


# =========================================================
# PAYLOAD HELPERS
# =========================================================

def author_payload(request, author):
    if not author:
        return None

    return {
        "id": author.pk,
        "name": author.name,
        "bio": author.bio,
        "birth_date": author.birth_date,
        "picture": file_url(request, author.photo),
        "photo": file_url(request, author.photo),
    }


def publisher_payload(request, publisher):
    if not publisher:
        return None

    return {
        "id": publisher.pk,
        "publisher": publisher.publisher,
        "name": publisher.publisher,
        "picture": file_url(request, publisher.picture),
        "picture_url": file_url(request, publisher.picture),
    }


def translator_payload(translator):
    if not translator:
        return None

    return {
        "id": translator.pk,
        "name": translator.name,
        "translate_to": translator.translate_to,
        "translate_to_display": display_value(translator, "translate_to"),
    }


def authors_payload(request, title):
    if not title:
        return []

    return [
        author_payload(request, author)
        for author in title.author.all()
    ]


def publishers_payload(request, title):
    if not title:
        return []

    return [
        publisher_payload(request, publisher)
        for publisher in title.publisher.all()
    ]


def translators_payload(title):
    if not title:
        return []

    return [
        translator_payload(translator)
        for translator in title.translator.all()
    ]


def first_author_name(title):
    if not title:
        return ""

    names = [
        author.name
        for author in title.author.all()
    ]

    return "، ".join(names)


def first_publisher_name(title):
    if not title:
        return ""

    names = [
        publisher.publisher
        for publisher in title.publisher.all()
    ]

    return "، ".join(names)


def genres_payload(title):
    if not title:
        return []

    return [
        {
            "id": genre.pk,
            "value": genre.name,
            "label": genre.get_name_display(),
            "has_discount": is_discount_active(genre.discount),
            "discount_percent": (
                int(genre.discount.amount)
                if is_discount_active(genre.discount)
                else 0
            ),
        }
        for genre in title.genres.all()
    ]


def levels_payload(title):
    if not title:
        return []

    try:
        levels = title.level.all()
    except Exception:
        return []

    return [
        {
            "id": level.pk,
            "value": level.value,
            "label": level.get_value_display(),
        }
        for level in levels
    ]


def level_text(title):
    if not title:
        return ""

    try:
        return "، ".join(
            level.get_value_display()
            for level in title.level.all()
        )
    except Exception:
        return ""


def title_language_value(title):
    if not title:
        return ""

    if not model_has_field(BookTitle, "language"):
        return ""

    return getattr(title, "language", "") or ""


def title_language_display(title):
    if not title:
        return ""

    if not model_has_field(BookTitle, "language"):
        return ""

    return display_value(title, "language")


def title_payload(request, title, include_description=True):
    if not title:
        return None

    title_discount = (
        title.discount
        if is_discount_active(title.discount)
        else get_best_genre_discount(title)
    )

    authors = authors_payload(request, title)
    publishers = publishers_payload(request, title)

    data = {
        "id": title.pk,
        "title_id": title.pk,

        "book": title.name,
        "name": title.name,
        "title": title.name,

        "authors": authors,
        "author": first_author_name(title),
        "author_detail": authors[0] if authors else None,

        "publishers": publishers,
        "publisher": first_publisher_name(title),
        "publisher_detail": publishers[0] if publishers else None,

        "translators": translators_payload(title),

        "book_photo": file_url(request, title.photo),
        "photo": file_url(request, title.photo),

        "levels": levels_payload(title),
        "level": level_text(title),
        "level_display": level_text(title),
        "book_level": level_text(title),
        "book_level_display": level_text(title),

        "language": title_language_value(title),
        "language_display": title_language_display(title),
        "book_language": title_language_value(title),
        "book_language_display": title_language_display(title),

        "genres": genres_payload(title),

        "has_title_discount": bool(title_discount),
        "title_discount_percent": int(title_discount.amount) if title_discount else 0,

        "has_physical_version": title.physical_versions.exists(),
        "has_online_version": title.online_versions.exists(),
    }

    if include_description:
        data["description"] = title.description or ""

    return data


def online_version_payload(request, online_book):
    title = getattr(online_book, "title", None)
    physical_book = first_physical_book(title)

    online_price = money_value(online_book.price)
    final_price = get_final_online_book_price(online_book)
    discounted_price = get_discounted_online_book_price(online_book)
    discount_amount = get_online_book_discount_amount(online_book)
    active_discount = get_online_book_active_discount(online_book)

    book_id = physical_book.pk if physical_book else None

    detail_url = (
        f"/ketabook/books/{book_id}/?online_book={online_book.pk}"
        if book_id
        else f"/ketabook/online-books/{online_book.pk}/reader/"
    )

    data = {
        "id": online_book.pk,
        "online_book_id": online_book.pk,
        "book_id": book_id,
        "title_id": title.pk if title else None,

        "slide_type": "online_book",
        "item_type": "online_book",
        "type_label": "کتاب آنلاین",

        "book": title.name if title else "",
        "name": title.name if title else "",
        "title": title.name if title else "",
        "online_book_name": title.name if title else "",

        "authors": authors_payload(request, title),
        "author": first_author_name(title),
        "author_detail": (
            authors_payload(request, title)[0]
            if authors_payload(request, title)
            else None
        ),

        "publishers": publishers_payload(request, title),
        "publisher": first_publisher_name(title),
        "publisher_detail": (
            publishers_payload(request, title)[0]
            if publishers_payload(request, title)
            else None
        ),

        "translators": translators_payload(title),

        "description": title.description if title else "",

        "book_photo": file_url(request, title.photo) if title else "",
        "photo": file_url(request, title.photo) if title else "",

        "price": money(online_price),
        "discounted_price": money(discounted_price),
        "final_price": money(final_price),
        "discount_amount": money(discount_amount),
        "discount_percent": int(active_discount.amount) if active_discount else 0,
        "has_discount": bool(active_discount),
        "has_price": online_book.price is not None,

        "format": online_book.format,
        "format_display": display_value(online_book, "format"),

        "access_type": online_book.access_type,
        "access_type_display": display_value(online_book, "access_type"),

        "levels": levels_payload(title),
        "level": level_text(title),
        "level_display": level_text(title),

        "language": title_language_value(title),
        "language_display": title_language_display(title),

        "genres": genres_payload(title),

        "url": detail_url,
        "detail_url": detail_url,
        "reader_url": f"/ketabook/online-books/{online_book.pk}/reader/",
        "access_status_api": f"/catalog/api/online-books/{online_book.pk}/access-status/",

        "has_online_version": True,
        "has_physical_version": bool(physical_book),

        "cart_payload": {
            "online_book": online_book.pk,
            "online_book_id": online_book.pk,
            "quantity": 1,
        },
    }

    data["book_title"] = title_payload(request, title)

    return data


def book_payload(
    request,
    book,
    include_description=False,
    include_online_versions=False,
    include_reviews=False,
):
    title = getattr(book, "title", None)

    original_price = money_value(book.price)
    discounted_price = get_discounted_price(book)
    final_price = get_final_book_price(book)
    discount_amount = get_book_discount_amount(book)
    active_discount = get_printed_book_active_discount(book)

    authors = authors_payload(request, title)
    publishers = publishers_payload(request, title)

    data = {
        "id": book.pk,
        "book_id": book.pk,
        "title_id": title.pk if title else None,

        "slide_type": "physical_book",
        "item_type": "physical_book",
        "type_label": "کتاب چاپی",

        "book": title.name if title else "",
        "name": title.name if title else "",
        "title": title.name if title else "",

        "authors": authors,
        "author": first_author_name(title),
        "author_detail": authors[0] if authors else None,

        "publishers": publishers,
        "publisher": first_publisher_name(title),
        "publisher_detail": publishers[0] if publishers else None,

        "translators": translators_payload(title),

        "price": money(original_price),
        "discounted_price": money(discounted_price),
        "final_price": money(final_price),
        "discount_amount": money(discount_amount),
        "discount_percent": int(active_discount.amount) if active_discount else 0,
        "has_discount": bool(active_discount),

        "book_photo": file_url(request, title.photo) if title else "",
        "photo": file_url(request, title.photo) if title else "",

        "levels": levels_payload(title),
        "level": level_text(title),
        "level_display": level_text(title),
        "book_level": level_text(title),
        "book_level_display": level_text(title),

        "language": title_language_value(title),
        "language_display": title_language_display(title),
        "book_language": title_language_value(title),
        "book_language_display": title_language_display(title),

        "genres": genres_payload(title),

        "url": f"/ketabook/books/{book.pk}/",
        "detail_url": f"/ketabook/books/{book.pk}/",

        "has_physical_version": True,
        "has_online_version": title.online_versions.exists() if title else False,

        "cart_payload": {
            "book": book.pk,
            "book_id": book.pk,
            "quantity": 1,
        },
    }

    if include_description:
        data["description"] = title.description if title else ""

    if include_online_versions:
        online_versions = OnlineBook.objects.filter(
            title=title,
        ).select_related(
            "title",
            "discount",
            "title__discount",
        ).prefetch_related(
            "title__author",
            "title__publisher",
            "title__translator",
            "title__genres",
            "title__genres__discount",
            "title__level",
        ).order_by("-pk")

        data["has_online_version"] = online_versions.exists()
        data["online_versions"] = [
            online_version_payload(request, online_book)
            for online_book in online_versions
        ]

    if include_reviews:
        reviews = Review.objects.filter(
            book=book,
        ).select_related(
            "user",
        ).order_by("-created_at")

        data["reviews"] = ReviewSerializer(
            reviews,
            many=True,
            context={"request": request},
        ).data

    data["book_title"] = title_payload(request, title)

    return data


# =========================================================
# AUTHOR
# =========================================================

class AuthorViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = AuthorSerializer

    def get_queryset(self):
        queryset = Author.objects.all()

        search = self.request.query_params.get("search")

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(bio__icontains=search)
            )

        return queryset.order_by("name")

    def list(self, request, *args, **kwargs):
        return Response(
            [
                author_payload(request, author)
                for author in self.get_queryset()
            ],
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        author = self.get_object()

        physical_books = Book.objects.filter(
            title__author=author,
        ).select_related(
            "title",
            "discount",
            "title__discount",
        ).prefetch_related(
            "title__author",
            "title__publisher",
            "title__translator",
            "title__genres",
            "title__genres__discount",
            "title__level",
        ).order_by("-pk")

        online_books = OnlineBook.objects.filter(
            title__author=author,
        ).select_related(
            "title",
            "discount",
            "title__discount",
        ).prefetch_related(
            "title__author",
            "title__publisher",
            "title__translator",
            "title__genres",
            "title__genres__discount",
            "title__level",
        ).order_by("-pk")

        data = author_payload(request, author)
        data["books"] = [
            book_payload(request, book, include_description=True)
            for book in physical_books
        ]
        data["online_books"] = [
            online_version_payload(request, online_book)
            for online_book in online_books
        ]

        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def books(self, request, pk=None):
        author = self.get_object()

        books = Book.objects.filter(
            title__author=author,
        ).select_related(
            "title",
            "discount",
            "title__discount",
        ).prefetch_related(
            "title__author",
            "title__publisher",
            "title__translator",
            "title__genres",
            "title__genres__discount",
            "title__level",
        ).order_by("-pk")

        return Response(
            [
                book_payload(request, book, include_description=True)
                for book in books
            ],
            status=status.HTTP_200_OK,
        )


# =========================================================
# PUBLISHERS
# =========================================================

class PublishersViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = PublishersSerializer

    def get_queryset(self):
        return Publishers.objects.all().order_by("publisher")

    def list(self, request, *args, **kwargs):
        publishers = self.get_queryset()

        serializer = self.get_serializer(
            publishers,
            many=True,
            context={"request": request},
        )

        return Response(
            {
                "publishers": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        publisher = self.get_object()

        physical_books = Book.objects.filter(
            title__publisher=publisher,
        ).select_related(
            "title",
            "discount",
            "title__discount",
        ).prefetch_related(
            "title__author",
            "title__publisher",
            "title__translator",
            "title__genres",
            "title__genres__discount",
            "title__level",
        ).order_by("-pk")

        online_books = OnlineBook.objects.filter(
            title__publisher=publisher,
        ).select_related(
            "title",
            "discount",
            "title__discount",
        ).prefetch_related(
            "title__author",
            "title__publisher",
            "title__translator",
            "title__genres",
            "title__genres__discount",
            "title__level",
        ).order_by("-pk")

        serializer = self.get_serializer(
            publisher,
            context={"request": request},
        )

        return Response(
            {
                "publisher": serializer.data,
                "books": [
                    book_payload(request, book, include_description=True)
                    for book in physical_books
                ],
                "online_books": [
                    online_version_payload(request, online_book)
                    for online_book in online_books
                ],
            },
            status=status.HTTP_200_OK,
        )


# =========================================================
# TRANSLATORS
# =========================================================

class TranslatorsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = TranslatorsSerializer

    def get_queryset(self):
        queryset = Translators.objects.all()

        search = self.request.query_params.get("search")

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(translate_to__icontains=search)
            )

        return queryset.order_by("name")


# =========================================================
# BOOK TITLES
# =========================================================

class BookTitleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = BookTitleSerializer

    def get_queryset(self):
        queryset = BookTitle.objects.select_related(
            "discount",
        ).prefetch_related(
            "author",
            "publisher",
            "translator",
            "genres",
            "genres__discount",
            "level",
        ).all()

        search = self.request.query_params.get("search")
        author = self.request.query_params.get("author")
        publisher = self.request.query_params.get("publisher")
        language = self.request.query_params.get("language")
        level = self.request.query_params.get("level")
        genre = self.request.query_params.get("genre")

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(author__name__icontains=search)
                | Q(publisher__publisher__icontains=search)
                | Q(translator__name__icontains=search)
            ).distinct()

        if author:
            queryset = queryset.filter(author__id=author).distinct()

        if publisher:
            queryset = queryset.filter(publisher__id=publisher).distinct()

        if language and model_has_field(BookTitle, "language"):
            queryset = queryset.filter(language=language)

        if level:
            queryset = queryset.filter(level__value=level).distinct()

        if genre:
            queryset = queryset.filter(genres__name=genre).distinct()

        return queryset.order_by("-pk")

    def list(self, request, *args, **kwargs):
        titles = self.get_queryset()

        return Response(
            {
                "book_titles": [
                    title_payload(request, title)
                    for title in titles
                ],
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        title = self.get_object()

        physical_books = title.physical_versions.all().order_by("-pk")
        online_books = title.online_versions.all().order_by("-pk")

        data = title_payload(request, title, include_description=True)
        data["physical_versions"] = [
            book_payload(request, book, include_description=True)
            for book in physical_books
        ]
        data["online_versions"] = [
            online_version_payload(request, online_book)
            for online_book in online_books
        ]

        return Response(data, status=status.HTTP_200_OK)


# =========================================================
# DISCOUNTS
# =========================================================

class DiscountViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = DiscountSerializer

    def get_queryset(self):
        queryset = Discount.objects.all()
        active = self.request.query_params.get("active")
        now = timezone.now()

        if active == "true":
            queryset = queryset.filter(
                is_active=True,
                start_time__lte=now,
                expiration__gt=now,
                amount__gt=0,
                amount__lte=100,
            )

        if active == "false":
            queryset = queryset.filter(
                Q(is_active=False)
                | Q(start_time__gt=now)
                | Q(expiration__lte=now)
                | Q(amount__lte=0)
                | Q(amount__gt=100)
            )

        return queryset.order_by("-created_at")

    @action(detail=False, methods=["get"])
    def active(self, request):
        discounts = self.get_queryset().filter(
            active=True,
        )

        serializer = self.get_serializer(
            discounts,
            many=True,
        )

        return Response(serializer.data, status=status.HTTP_200_OK)


# =========================================================
# GENRES
# =========================================================

class GenreViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = GenreSerializer

    PERSIAN_GENRE_LABELS = {
        "adventure": "ماجراجویی",
        "fantasy": "فانتزی",
        "science": "علمی",
        "mystery": "معمایی",
        "romance": "عاشقانه",
        "horror": "ترسناک",
        "comedy": "کمدی",
        "historical": "تاریخی",
        "biography": "زندگی‌نامه",
        "self_help": "خودیاری",
        "educational": "آموزشی",
        "business": "کسب و کار",
        "religion": "مذهبی",
    }

    GENRE_ICONS = {
        "adventure": "adventure",
        "fantasy": "fantasy",
        "science": "science",
        "mystery": "mystery",
        "romance": "romance",
        "horror": "horror",
        "comedy": "comedy",
        "historical": "historical",
        "biography": "biography",
        "self_help": "self_help",
        "educational": "educational",
        "business": "business",
        "religion": "religion",
    }

    def get_queryset(self):
        queryset = Genre.objects.select_related(
            "discount",
        ).all()

        search = self.request.query_params.get("search")

        if search:
            queryset = queryset.filter(name__icontains=search)

        return queryset.order_by("name")

    @action(detail=False, methods=["get"], url_path="choices")
    def choices(self, request):
        data = []

        for value, english_label in GENRE_CHOICES:
            data.append(
                {
                    "value": value,
                    "label": english_label,
                    "title": self.PERSIAN_GENRE_LABELS.get(value, english_label),
                    "icon": self.GENRE_ICONS.get(value, "educational"),
                    "url": f"/ketabook/genres/{value}/",
                }
            )

        return Response(data, status=status.HTTP_200_OK)


# =========================================================
# BOOKS / PRINTED BOOKS
# =========================================================

class BookViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = BookSerializer

    def get_queryset(self):
        queryset = Book.objects.select_related(
            "title",
            "discount",
            "title__discount",
        ).prefetch_related(
            "title__author",
            "title__publisher",
            "title__translator",
            "title__genres",
            "title__genres__discount",
            "title__level",
        ).all()

        search = self.request.query_params.get("search")
        author = self.request.query_params.get("author")
        publisher = self.request.query_params.get("publisher")
        language = self.request.query_params.get("language")
        level = self.request.query_params.get("level")
        genre = self.request.query_params.get("genre")
        min_price = self.request.query_params.get("min_price")
        max_price = self.request.query_params.get("max_price")

        if search:
            queryset = queryset.filter(
                Q(title__name__icontains=search)
                | Q(title__description__icontains=search)
                | Q(title__author__name__icontains=search)
                | Q(title__publisher__publisher__icontains=search)
                | Q(title__translator__name__icontains=search)
            ).distinct()

        if author:
            queryset = queryset.filter(title__author__id=author).distinct()

        if publisher:
            if str(publisher).isdigit():
                queryset = queryset.filter(title__publisher__id=publisher).distinct()
            else:
                queryset = queryset.filter(
                    title__publisher__publisher__icontains=publisher,
                ).distinct()

        if language and model_has_field(BookTitle, "language"):
            queryset = queryset.filter(title__language=language)

        if level:
            queryset = queryset.filter(title__level__value=level).distinct()

        if genre:
            genre = genre.strip()
            genre_lookup = Q()

            if genre.isdigit():
                genre_lookup |= Q(title__genres__id=int(genre))

            for value, label in GENRE_CHOICES:
                if genre.lower() in {value.lower(), label.lower()}:
                    genre_lookup |= Q(title__genres__name__iexact=value)
                    genre_lookup |= Q(title__genres__name__iexact=label)

            genre_lookup |= Q(title__genres__name__iexact=genre)

            queryset = queryset.filter(genre_lookup).distinct()

        if min_price:
            queryset = queryset.filter(price__gte=min_price)

        if max_price:
            queryset = queryset.filter(price__lte=max_price)

        return queryset.order_by("-pk")

    def list(self, request, *args, **kwargs):
        books = self.get_queryset()

        discounted_books = [
            book
            for book in books
            if get_printed_book_active_discount(book)
        ]

        return Response(
            {
                "books": [
                    book_payload(request, book)
                    for book in books
                ],
                "discounted_books": {
                    "message": "discounted books",
                    "items": [
                        book_payload(request, book)
                        for book in discounted_books
                    ],
                },
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        book = self.get_object()

        return Response(
            book_payload(
                request,
                book,
                include_description=True,
                include_online_versions=True,
                include_reviews=True,
            ),
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="home")
    def home(self, request):
        books = self.get_queryset()

        online_books_queryset = OnlineBook.objects.select_related(
            "title",
            "discount",
            "title__discount",
        ).prefetch_related(
            "title__author",
            "title__publisher",
            "title__translator",
            "title__genres",
            "title__genres__discount",
            "title__level",
        ).order_by("-pk")

        discounted_books = [
            book
            for book in books
            if get_printed_book_active_discount(book)
        ][:12]

        discounted_online_books = [
            online_book
            for online_book in online_books_queryset
            if get_online_book_active_discount(online_book)
        ][:12]

        recommended_level = get_user_recommended_level(request.user)
        recommended_items = []

        if recommended_level:
            recommended_physical_books = books.filter(
                title__level__value=recommended_level,
            ).distinct()[:12]

            recommended_online_books = online_books_queryset.filter(
                title__level__value=recommended_level,
                title__physical_versions__isnull=True,
            ).distinct()[:12]

            recommended_items = [
                book_payload(request, book, include_description=True)
                for book in recommended_physical_books
            ] + [
                online_version_payload(request, online_book)
                for online_book in recommended_online_books
            ]

        discounted_genres = [
            genre
            for genre in Genre.objects.select_related("discount").all()
            if is_discount_active(genre.discount)
        ][:10]

        online_books = online_books_queryset[:8]
        physical_slide_books = books.order_by("-pk")[:8]

        slide_items = []

        for online_book in online_books:
            slide_items.append(online_version_payload(request, online_book))

        for book in physical_slide_books:
            slide_items.append(book_payload(request, book))

        for genre in discounted_genres:
            discount_percent = (
                int(genre.discount.amount)
                if is_discount_active(genre.discount)
                else 0
            )

            slide_items.append(
                {
                    "slide_type": "discounted_genre",
                    "item_type": "discounted_genre",
                    "type_label": "تخفیف ژانر",
                    "id": genre.pk,
                    "title": genre.get_name_display(),
                    "name": genre.get_name_display(),
                    "value": genre.name,
                    "discount_percent": discount_percent,
                    "has_discount": discount_percent > 0,
                    "url": f"/ketabook/genres/{genre.name}/",
                }
            )

        return Response(
            {
                "slides": slide_items,
                "discounted_books": {
                    "show": bool(discounted_books or discounted_online_books),
                    "title": "پیشنهادهای شگفت انگیز",
                    "items": [
                        book_payload(request, book)
                        for book in discounted_books
                    ] + [
                        online_version_payload(request, online_book)
                        for online_book in discounted_online_books
                    ],
                },
                "recommended_books": {
                    "show": bool(recommended_level and recommended_items),
                    "title": "کتاب های پیشنهادی",
                    "age": get_user_age(request.user),
                    "level": recommended_level or "",
                    "level_label": dict(LEVEL_CHOICES).get(
                        recommended_level,
                        recommended_level or "",
                    ),
                    "items": recommended_items,
                },
                "discounted_genres": {
                    "show": bool(discounted_genres),
                    "title": "ژانرهای تخفیف دار",
                    "items": [
                        {
                            "id": genre.pk,
                            "value": genre.name,
                            "label": genre.get_name_display(),
                            "url": f"/ketabook/genres/{genre.name}/",
                            "discount_percent": (
                                int(genre.discount.amount)
                                if is_discount_active(genre.discount)
                                else 0
                            ),
                        }
                        for genre in discounted_genres
                    ],
                },
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="recommended")
    def recommended(self, request):
        recommended_level = get_user_recommended_level(request.user)

        if not recommended_level:
            return Response(
                {
                    "show": False,
                    "age": None,
                    "level": "",
                    "level_label": "",
                    "books": [],
                },
                status=status.HTTP_200_OK,
            )

        books = self.get_queryset().filter(
            title__level__value=recommended_level,
        ).distinct()[:12]

        level_labels = dict(LEVEL_CHOICES)

        return Response(
            {
                "show": bool(books),
                "age": get_user_age(request.user),
                "level": recommended_level,
                "level_label": level_labels.get(recommended_level, recommended_level),
                "books": [
                    book_payload(
                        request,
                        book,
                        include_description=True,
                    )
                    for book in books
                ],
            },
            status=status.HTTP_200_OK,
        )


# =========================================================
# ONLINE BOOKS
# =========================================================

class OnlineBookViewSet(viewsets.ModelViewSet):
    serializer_class = OnlineBookSerializer

    PREMIUM_ACCESS_VALUES = {
        "premium",
        "subscription",
        "vip",
        "premium_only",
        "premium_access",
        "both",
        "all",
        "free",
    }

    PURCHASE_ACCESS_VALUES = {
        "paid",
        "pay",
        "purchase",
        "buy",
        "payment",
        "paid_access",
        "buy_only",
        "both",
        "all",
    }

    def get_permissions(self):
        if self.action in [
            "create",
            "update",
            "partial_update",
            "destroy",
        ]:
            return [IsAdminOrReadOnly()]

        if self.action in [
            "premium_reader",
            "reader_info",
            "reader_page",
            "access_status",
        ]:
            return [IsAuthenticated()]

        return [AllowAny()]

    def get_queryset(self):
        queryset = OnlineBook.objects.select_related(
            "title",
            "discount",
            "title__discount",
        ).prefetch_related(
            "title__author",
            "title__publisher",
            "title__translator",
            "title__genres",
            "title__genres__discount",
            "title__level",
        ).all()

        book = self.request.query_params.get("book")
        title = self.request.query_params.get("title")
        book_format = self.request.query_params.get("format")
        genre = self.request.query_params.get("genre")
        access_type = self.request.query_params.get("access_type")
        language = self.request.query_params.get("language")
        level = self.request.query_params.get("level")
        search = self.request.query_params.get("search")

        if book:
            physical_book = Book.objects.filter(pk=book).first()

            if physical_book:
                queryset = queryset.filter(title_id=physical_book.title_id)
            else:
                queryset = queryset.none()

        if title:
            queryset = queryset.filter(title_id=title)

        if book_format:
            queryset = queryset.filter(format=book_format)

        if genre:
            queryset = queryset.filter(title__genres__name=genre).distinct()

        if access_type:
            queryset = queryset.filter(access_type=access_type)

        if language and model_has_field(BookTitle, "language"):
            queryset = queryset.filter(title__language=language)

        if level:
            queryset = queryset.filter(title__level__value=level).distinct()

        if search:
            queryset = queryset.filter(
                Q(title__name__icontains=search)
                | Q(title__description__icontains=search)
                | Q(title__author__name__icontains=search)
                | Q(title__publisher__publisher__icontains=search)
                | Q(title__translator__name__icontains=search)
            ).distinct()

        return queryset.order_by("-pk")

    def normalize_access_type(self, access_type):
        return str(access_type or "").strip().lower()

    def allows_premium_access(self, online_book):
        access_type = self.normalize_access_type(online_book.access_type)

        if not access_type:
            return False

        return (
            access_type in self.PREMIUM_ACCESS_VALUES
            or "premium" in access_type
            or "subscription" in access_type
            or "vip" in access_type
            or "both" in access_type
            or "all" in access_type
            or "free" in access_type
        )

    def allows_purchase_access(self, online_book):
        access_type = self.normalize_access_type(online_book.access_type)

        if not access_type:
            return True

        return (
            access_type in self.PURCHASE_ACCESS_VALUES
            or "paid" in access_type
            or "pay" in access_type
            or "purchase" in access_type
            or "buy" in access_type
            or "payment" in access_type
            or "both" in access_type
            or "all" in access_type
        )

    def get_user_active_premium_until(self, request):
        user = request.user

        if not user or not user.is_authenticated:
            return None

        try:
            from payment.models import Premium

            premium = Premium.objects.filter(
                user=user,
                premium_account=True,
                premium_expiration__gt=timezone.now(),
            ).order_by(
                "-premium_expiration",
            ).first()

            if premium:
                return premium.premium_expiration

        except Exception as error:
            print("Premium check error:", error)

        return None

    def get_user_online_book_access(self, request, online_book):
        user = request.user

        if not user or not user.is_authenticated:
            return None

        return UserOnlineBook.objects.filter(
            user=user,
            online_book=online_book,
        ).first()

    def user_can_read_online_book(self, request, online_book):
        user_online_book = self.get_user_online_book_access(
            request,
            online_book,
        )

        if user_online_book and user_online_book.is_access_active:
            return True

        premium_until = self.get_user_active_premium_until(request)

        return bool(
            premium_until
            and self.allows_premium_access(online_book)
        )

    def build_user_access_payload(self, request, online_book):
        user_online_book = self.get_user_online_book_access(
            request,
            online_book,
        )

        premium_until = self.get_user_active_premium_until(request)
        has_active_premium = bool(premium_until)
        allows_premium = self.allows_premium_access(online_book)
        allows_purchase = self.allows_purchase_access(online_book)
        can_access_with_premium = bool(allows_premium and has_active_premium)

        if not user_online_book:
            return {
                "has_in_my_books": False,
                "access_source": "",
                "premium_until": None,
                "is_access_active": can_access_with_premium,
                "access_message": "",
                "has_active_premium": has_active_premium,
                "active_premium_until": premium_until,
                "can_access_with_premium": can_access_with_premium,
                "can_buy": allows_purchase,
                "reader_url": (
                    f"/ketabook/online-books/{online_book.pk}/reader/"
                    if can_access_with_premium
                    else ""
                ),
            }

        is_access_active = bool(user_online_book.is_access_active)
        reader_url = ""

        if is_access_active or can_access_with_premium:
            reader_url = f"/ketabook/online-books/{online_book.pk}/reader/"

        return {
            "has_in_my_books": True,
            "access_source": user_online_book.access_source,
            "premium_until": user_online_book.premium_until,
            "is_access_active": bool(is_access_active or can_access_with_premium),
            "access_message": user_online_book.access_message,
            "has_active_premium": has_active_premium,
            "active_premium_until": premium_until,
            "can_access_with_premium": can_access_with_premium,
            "can_buy": allows_purchase,
            "reader_url": reader_url,
        }

    def build_online_book_payload(self, request, online_book):
        user_access = self.build_user_access_payload(request, online_book)
        payload = online_version_payload(request, online_book)

        file_download_url = ""

        if user_access.get("is_access_active") and online_book.url:
            file_download_url = file_url(request, online_book.url)

        payload.update(
            {
                "allows_premium_access": self.allows_premium_access(online_book),
                "allows_purchase_access": self.allows_purchase_access(online_book),

                "file_url": file_download_url,

                "premium_reader_api": f"/catalog/api/online-books/{online_book.pk}/premium-reader/",
                "access_status_api": f"/catalog/api/online-books/{online_book.pk}/access-status/",
                "add_premium_to_my_books_api": "/account/api/my-online-books/add-premium/",

                "user_access": user_access,
            }
        )

        return payload

    def list(self, request, *args, **kwargs):
        online_books = self.get_queryset()

        return Response(
            {
                "online_books": [
                    self.build_online_book_payload(request, online_book)
                    for online_book in online_books
                ],
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        online_book = self.get_object()

        return Response(
            self.build_online_book_payload(request, online_book),
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="access-status")
    def access_status(self, request, pk=None):
        online_book = self.get_object()

        return Response(
            self.build_user_access_payload(request, online_book),
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="premium-reader")
    def premium_reader(self, request, pk=None):
        online_book = self.get_object()
        title = getattr(online_book, "title", None)
        physical_book = first_physical_book(title)

        if not self.allows_premium_access(online_book):
            return Response(
                {
                    "error": "premium access is not allowed for this online book.",
                    "message": "این کتاب با اشتراک ویژه قابل دسترسی نیست.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        premium_until = self.get_user_active_premium_until(request)

        if not premium_until:
            return Response(
                {
                    "error": "premium is not active.",
                    "message": "برای دسترسی به این کتاب باید اشتراک ویژه فعال داشته باشید.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if not online_book.url:
            return Response(
                {
                    "error": "file not found.",
                    "message": "فایل این کتاب پیدا نشد.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "id": online_book.pk,
                "online_book_id": online_book.pk,
                "book_id": physical_book.pk if physical_book else None,
                "title_id": title.pk if title else None,
                "book_name": title.name if title else "",
                "name": title.name if title else "",
                "file_url": file_url(request, online_book.url),
                "format": online_book.format,
                "access_source": UserOnlineBook.PREMIUM,
                "premium_until": premium_until,
                "is_access_active": True,
                "reader_url": f"/ketabook/online-books/{online_book.pk}/reader/",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="reader-info")
    def reader_info(self, request, pk=None):
        online_book = self.get_object()
        title = getattr(online_book, "title", None)

        if not self.user_can_read_online_book(request, online_book):
            return Response(
                {
                    "error": "access denied.",
                    "message": "برای دسترسی به این کتاب باید اشتراک ویژه فعال داشته باشید.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if not online_book.url:
            return Response(
                {
                    "error": "file not found.",
                    "message": "فایل این کتاب پیدا نشد.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        document = fitz.open(online_book.url.path)

        try:
            page_count = document.page_count
        finally:
            document.close()

        physical_book = first_physical_book(title)

        return Response(
            {
                "id": online_book.pk,
                "online_book_id": online_book.pk,
                "book_id": physical_book.pk if physical_book else None,
                "title_id": title.pk if title else None,
                "book_name": title.name if title else "",
                "name": title.name if title else "",
                "page_count": page_count,
                "page_image_api": f"/catalog/api/online-books/{online_book.pk}/reader-page/",
                "add_premium_to_my_books_api": "/account/api/my-online-books/add-premium/",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="reader-page")
    def reader_page(self, request, pk=None):
        online_book = self.get_object()

        if not self.user_can_read_online_book(request, online_book):
            return Response(
                {
                    "error": "access denied.",
                    "message": "برای دسترسی به این کتاب باید اشتراک ویژه فعال داشته باشید.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if not online_book.url:
            return Response(
                {
                    "error": "file not found.",
                    "message": "فایل این کتاب پیدا نشد.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            page_number = int(request.query_params.get("page", 1))
        except Exception:
            page_number = 1

        document = fitz.open(online_book.url.path)

        try:
            if page_number < 1:
                page_number = 1

            if page_number > document.page_count:
                page_number = document.page_count

            page = document.load_page(page_number - 1)

            pixmap = page.get_pixmap(
                matrix=fitz.Matrix(2.2, 2.2),
                alpha=False,
            )

            image_bytes = pixmap.tobytes("png")

        finally:
            document.close()

        response = HttpResponse(
            image_bytes,
            content_type="image/png",
        )

        response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"

        return response