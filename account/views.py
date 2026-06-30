import os
import random
from django.utils import timezone

import redis

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated, SAFE_METHODS
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from account.models import (
    Profile,
    Review,
    User,
    Factor,
    UserOnlineBook,
)

from account.tasks import send_otp_sms


from apps_serializers.user_serializer import (
    CompleteProfileSerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
    ReviewSerializer,
    FactorSerializer,
    UserOnlineBookSerializer,
)
from catalog.models import Book
from rest_framework.decorators import action
from kombu.exceptions import OperationalError

from catalog.models import OnlineBook
from payment.models import Premium


redis_client = redis.Redis.from_url(
    os.getenv("REDIS_URL", "redis://127.0.0.1:6379/1"),
    decode_responses=True,
)


# =========================================================
# HELPERS
# =========================================================


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


def get_book_title(book):
    if not book:
        return None

    return getattr(book, "title", None)


def get_online_book_title(online_book):
    if not online_book:
        return None

    return getattr(online_book, "title", None)


def get_book_name(book):
    title = get_book_title(book)

    if title:
        return getattr(title, "name", "") or ""

    return ""


def get_online_book_name(online_book):
    title = get_online_book_title(online_book)

    if title:
        return getattr(title, "name", "") or ""

    return ""


def get_book_photo_url(request, book):
    title = get_book_title(book)

    if not title:
        return ""

    return file_url(request, getattr(title, "photo", None))


def get_online_book_photo_url(request, online_book):
    title = get_online_book_title(online_book)

    if not title:
        return ""

    return file_url(request, getattr(title, "photo", None))


def get_title_authors_text(title):
    if not title:
        return ""

    try:
        return "، ".join(
            author.name
            for author in title.author.all()
        )
    except Exception:
        return ""


def get_title_publishers_text(title):
    if not title:
        return ""

    try:
        return "، ".join(
            publisher.publisher
            for publisher in title.publisher.all()
        )
    except Exception:
        return ""


def get_physical_book_for_title(title):
    if not title:
        return None

    try:
        return title.physical_versions.all().order_by("-pk").first()
    except Exception:
        return None


def is_default_profile_photo(profile):
    if not profile.photo or not profile.photo.name:
        return True

    photo_name = str(profile.photo.name)

    return (
        photo_name == "default.jpg"
        or photo_name.endswith("/default.jpg")
        or "profile_photos/default" in photo_name
    )


def get_profile_photo_url(request, profile):
    if not profile or is_default_profile_photo(profile):
        return None

    try:
        url = profile.photo.url
    except ValueError:
        return None

    if request:
        return request.build_absolute_uri(url)

    return url


def get_profile_payload(request, user, profile=None):
    if profile is None:
        try:
            profile = user.profile_user
        except Exception:
            profile = None

    profile_photo = ""

    if profile:
        try:
            profile_photo = get_profile_photo_url(request, profile)
        except Exception:
            profile_photo = ""

    post_code = ""

    if profile:
        post_code = (
            getattr(profile, "post_code", "") or ""
        )

    return {
        "id": user.pk,
        "user_id": user.pk,
        "number": user.number,
        "email": user.email or "",

        "profile_id": profile.pk if profile else None,
        "fullname": getattr(profile, "fullname", "") if profile else "",
        "username": getattr(profile, "username", "") if profile else "",
        "photo": profile_photo,
        "profile_photo": profile_photo,
        "age": getattr(profile, "age", None) if profile else None,

        # Real database field
        "post_code": post_code,

        # Frontend compatibility alias only
        "address": post_code,

        "has_profile": bool(profile),
        "is_profile_complete": bool(
            profile
            and getattr(profile, "fullname", "")
            and getattr(profile, "username", "")
        ),
    }

def get_review_user_payload(request, user):
    profile = getattr(user, "profile_user", None)

    profile_pic_url = get_profile_photo_url(request, profile) if profile else None

    return {
        "id": user.id,
        "number": user.number,
        "fullname": profile.fullname if profile else "",
        "username": profile.username if profile else "",
        "profile_pic": profile_pic_url,
    }


def get_review_payload(request, review):
    user_payload = get_review_user_payload(request, review.user)

    username = user_payload.get("username") or ""

    display_name = (
        username.strip()
        if username and str(username).strip()
        else "کاربر کتابوک"
    )

    return {
        "id": review.id,
        "book": review.book_id,
        "book_name": review.book.name,
        "user": user_payload,
        "fullname": user_payload.get("fullname"),
        "username": username,
        "user_number": user_payload.get("number"),
        "display_name": display_name,
        "profile_pic": user_payload.get("profile_pic"),
        "text": review.text,
        "created_at": review.created_at,
        "last_update": review.last_update,
        "is_owner": bool(
            request
            and request.user
            and request.user.is_authenticated
            and review.user_id == request.user.id
        ),
    }

class IsAuthenticatedOrReadOnlyForReviews(IsAuthenticated):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        return bool(request.user and request.user.is_authenticated)




class GenerateOTPViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = OTPRequestSerializer
    queryset = User.objects.none()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        number = serializer.validated_data["number"]
        cooldown_key = f"otp_cooldown:{number}"

        if redis_client.exists(cooldown_key):
            ttl = redis_client.ttl(cooldown_key)

            return Response(
                {
                    "error": (
                        f"code already sent, "
                        f"try again in {ttl} seconds"
                    )
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        otp_code = "".join([str(random.randint(0, 9)) for _ in range(6)])

        redis_client.setex(
            f"otp:{number}",
            120,
            otp_code,
        )

        redis_client.setex(
            cooldown_key,
            120,
            "locked",
        )

        print(f"✅ OTP: {otp_code}")

        return Response(
            {
                "message": "OTP sent , expiration in 2 minutes"
            },
            status=status.HTTP_200_OK
        )

        # try:
        #     send_otp_sms.delay(number, otp_code)
        # except OperationalError:
        #     print(f"✅ OTP fallback: {otp_code}")
        #
        # return Response(
        #     {
        #         "message": "OTP sent , expiration in 2 minutes",
        #     },
        #     status=status.HTTP_200_OK,
        # )


class VerifyOTPViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = OTPVerifySerializer
    queryset = User.objects.none()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        number = serializer.validated_data["number"]
        otp = serializer.validated_data["otp"]

        stored_otp = redis_client.get(f"otp:{number}")

        if not stored_otp:
            return Response(
                {"error": "OTP expired or not found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if isinstance(stored_otp, bytes):
            stored_otp = stored_otp.decode("utf-8")

        if str(stored_otp) != str(otp):
            return Response(
                {"error": "Invalid OTP"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        redis_client.delete(f"otp:{number}")

        user, is_new = User.objects.get_or_create(number=number)
        profile, _ = Profile.objects.get_or_create(user=user)

        refresh = RefreshToken.for_user(user)

        payload = get_profile_payload(request, user, profile)

        display_name = (
            profile.fullname
            or profile.username
            or user.number
        )

        return Response(
            {
                "message": (
                    "OTP verified. Have your tokens:"
                    if is_new
                    else f"Welcome back {display_name}"
                ),
                "is_new": is_new,
                **payload,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            },
            status=status.HTTP_200_OK,
        )


class SetProfileViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CompleteProfileSerializer
    queryset = Profile.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        user = request.user
        profile, _ = Profile.objects.get_or_create(user=user)

        return Response(
            get_profile_payload(request, user, profile),
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        user = request.user
        profile, created = Profile.objects.get_or_create(user=user)

        data = request.data.copy()

        email = data.get("email")

        if "email" in data:
            data.pop("email", None)

        if email is not None:
            user.email = str(email).strip()
            user.save(update_fields=["email"])

        if not request.FILES.get("photo"):
            data.pop("photo", None)

        if data.get("address") is not None and not data.get("post_code"):
            data["post_code"] = data.get("address")

        data.pop("address", None)

        age = data.get("age")

        if age in ["", None]:
            data.pop("age", None)
        else:
            try:
                age = int(age)
            except (TypeError, ValueError):
                return Response(
                    {
                        "age": "age must be a number.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if age < 0 or age > 120:
                return Response(
                    {
                        "age": "age must be between 0 and 120.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            data["age"] = age

        if data.get("fullname") is not None:
            data["fullname"] = str(data.get("fullname", "")).strip()

        username = data.get("username")

        if username in ["", None]:
            data["username"] = None
        else:
            username = str(username).strip()

            exists = Profile.objects.filter(
                username=username,
            ).exclude(
                pk=profile.pk,
            ).exists()

            if exists:
                return Response(
                    {
                        "username": "this username is already taken.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            data["username"] = username

        serializer = self.get_serializer(
            profile,
            data=data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)

        profile = serializer.save()

        return Response(
            {
                "message": "Profile created" if created else "Profile updated",
                **get_profile_payload(request, user, profile),
            },
            status=status.HTTP_200_OK,
        )

    def update(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)


# =========================================================
# REVIEWS
# =========================================================

class ReviewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnlyForReviews]
    serializer_class = ReviewSerializer

    def get_queryset(self):
        queryset = Review.objects.select_related(
            "user",
            "book",
            "book__title",
            "user__profile_user",
        ).prefetch_related(
            "book__title__author",
        ).all()

        book_id = self.request.query_params.get("book")
        user_id = self.request.query_params.get("user")
        search = self.request.query_params.get("search")

        if book_id:
            queryset = queryset.filter(book_id=book_id)

        if user_id:
            queryset = queryset.filter(user_id=user_id)

        if search:
            queryset = queryset.filter(
                Q(text__icontains=search)
                | Q(book__title__name__icontains=search)
                | Q(book__title__author__name__icontains=search)
                | Q(user__number__icontains=search)
                | Q(user__profile_user__fullname__icontains=search)
                | Q(user__profile_user__username__icontains=search)
            ).distinct()

        return queryset.order_by("-created_at")

    def list(self, request, *args, **kwargs):
        reviews = self.get_queryset()

        data = [
            get_review_payload(request, review)
            for review in reviews
        ]

        return Response(data, status=status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
        review = self.get_object()

        return Response(
            get_review_payload(request, review),
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        profile, _ = Profile.objects.get_or_create(
            user=request.user,
        )

        username = profile.username or ""

        if not username or not str(username).strip():
            return Response(
                {
                    "error": "username is required.",
                    "message": "لطفا ابتدا نام کاربری خود را در پروفایل تکمیل کنید",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        book_id = request.data.get("book")

        text = (
            request.data.get("text")
            or request.data.get("review")
            or request.data.get("comment")
        )

        if not book_id:
            raise ValidationError(
                {
                    "book": "book id is required.",
                }
            )

        if not text or not str(text).strip():
            raise ValidationError(
                {
                    "text": "review text is required.",
                }
            )

        try:
            book = Book.objects.select_related("title").get(pk=book_id)
        except Book.DoesNotExist:
            raise ValidationError(
                {
                    "book": "book not found.",
                }
            )

        review = Review.objects.create(
            user=request.user,
            book=book,
            text=str(text).strip(),
        )

        return Response(
            {
                "message": "review created successfully.",
                "review": get_review_payload(request, review),
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        review = self.get_object()

        if review.user != request.user:
            raise PermissionDenied("you can only edit your own review.")

        text = (
            request.data.get("text")
            or request.data.get("review")
            or request.data.get("comment")
        )

        if not text or not str(text).strip():
            raise ValidationError(
                {
                    "text": "review text is required.",
                }
            )

        review.text = str(text).strip()
        review.save(update_fields=["text", "last_update"])

        return Response(
            {
                "message": "review updated successfully.",
                "review": get_review_payload(request, review),
            },
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()

        if review.user != request.user:
            raise PermissionDenied("you can only delete your own review.")

        review.delete()

        return Response(
            {
                "detail": "review deleted successfully.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="my-reviews")
    def my_reviews(self, request):
        reviews = Review.objects.filter(
            user=request.user,
        ).select_related(
            "book",
            "book__title",
        ).order_by("-created_at")

        data = []

        for review in reviews:
            book = review.book
            title = get_book_title(book)

            data.append(
                {
                    "id": review.pk,
                    "text": review.text,
                    "created_at": review.created_at,
                    "last_update": review.last_update,
                    "book_id": book.pk if book else None,
                    "title_id": title.pk if title else None,
                    "book_name": title.name if title else "کتاب حذف شده",
                    "book_photo": file_url(request, title.photo) if title else "",
                }
            )

        return Response(
            {
                "reviews": data,
            },
            status=status.HTTP_200_OK,
        )


# =========================================================
# FACTORS
# =========================================================

class FactorViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FactorSerializer

    def get_queryset(self):
        return Factor.objects.filter(
            user=self.request.user,
        ).order_by("-created_at")

    def list(self, request, *args, **kwargs):
        factors = self.get_queryset()

        serializer = self.get_serializer(
            factors,
            many=True,
            context={
                "request": request,
            },
        )

        return Response(
            {
                "factors": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        factor = self.get_object()

        serializer = self.get_serializer(
            factor,
            context={
                "request": request,
            },
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


# =========================================================
# USER ONLINE BOOKS
# =========================================================

class UserOnlineBookViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = UserOnlineBookSerializer

    def get_queryset(self):
        return UserOnlineBook.objects.filter(
            user=self.request.user,
        ).select_related(
            "online_book",
            "online_book__title",
        ).prefetch_related(
            "online_book__title__author",
            "online_book__title__publisher",
            "online_book__title__physical_versions",
        ).order_by("-created_at")

    def list(self, request, *args, **kwargs):
        user_online_books = self.get_queryset()

        serializer = self.get_serializer(
            user_online_books,
            many=True,
            context={
                "request": request,
            },
        )

        return Response(
            {
                "online_books": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        user_online_book = self.get_object()

        serializer = self.get_serializer(
            user_online_book,
            context={
                "request": request,
            },
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="open")
    def open(self, request, pk=None):
        user_online_book = self.get_object()

        if not user_online_book.is_access_active:
            return Response(
                {
                    "error": "access is not active.",
                    "message": "برای دسترسی مجدد اشتراک تهیه کنید.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        online_book = user_online_book.online_book
        title = get_online_book_title(online_book)

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
                "id": user_online_book.pk,
                "online_book_id": online_book.pk,
                "title_id": title.pk if title else None,
                "book_name": title.name if title else "",
                "file_url": request.build_absolute_uri(online_book.url.url),
                "format": online_book.format,
                "access_source": user_online_book.access_source,
                "premium_until": user_online_book.premium_until,
                "is_access_active": user_online_book.is_access_active,
                "reader_url": f"/ketabook/online-books/{online_book.pk}/reader/",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="add-premium")
    def add_premium(self, request):
        online_book_id = (
            request.data.get("online_book")
            or request.data.get("online_book_id")
            or request.data.get("id")
        )

        if not online_book_id:
            return Response(
                {
                    "error": "online_book is required.",
                    "message": "شناسه کتاب آنلاین ارسال نشده است.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        online_book = OnlineBook.objects.select_related(
            "title",
        ).prefetch_related(
            "title__author",
            "title__publisher",
            "title__physical_versions",
        ).filter(
            pk=online_book_id,
        ).first()

        if not online_book:
            return Response(
                {
                    "error": "online book not found.",
                    "message": "کتاب آنلاین پیدا نشد.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        premium = Premium.objects.filter(
            user=request.user,
            premium_account=True,
            premium_expiration__gt=timezone.now(),
        ).order_by(
            "-premium_expiration",
        ).first()

        if not premium:
            return Response(
                {
                    "error": "premium is not active.",
                    "message": "برای افزودن این کتاب باید اشتراک ویژه فعال داشته باشید.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        old_user_online_book = UserOnlineBook.objects.filter(
            user=request.user,
            online_book=online_book,
        ).first()

        if (
            old_user_online_book
            and old_user_online_book.access_source == UserOnlineBook.PURCHASED
        ):
            serializer = self.get_serializer(
                old_user_online_book,
                context={
                    "request": request,
                },
            )

            return Response(
                {
                    "message": "این کتاب قبلا خریداری شده است.",
                    "online_book": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        user_online_book, created = UserOnlineBook.objects.update_or_create(
            user=request.user,
            online_book=online_book,
            defaults={
                "access_source": UserOnlineBook.PREMIUM,
                "premium_until": premium.premium_expiration,
            },
        )

        serializer = self.get_serializer(
            user_online_book,
            context={
                "request": request,
            },
        )

        return Response(
            {
                "message": "کتاب به کتاب های من اضافه شد.",
                "created": created,
                "online_book": serializer.data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["delete"], url_path="delete-selected")
    def delete_selected(self, request):
        ids = request.data.get("ids", [])

        if not ids:
            return Response(
                {
                    "error": "ids is required.",
                    "message": "هیچ کتابی انتخاب نشده است.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted_count, deleted_data = UserOnlineBook.objects.filter(
            user=request.user,
            pk__in=ids,
        ).delete()

        return Response(
            {
                "message": "کتاب‌های انتخاب شده حذف شدند.",
                "deleted_count": deleted_count,
            },
            status=status.HTTP_200_OK,
        )