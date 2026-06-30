from django.utils import timezone
from django.db import models
from django.core.validators import FileExtensionValidator
from django.contrib.auth.models import AbstractUser, BaseUserManager

from .choices import FACTOR_TYPE_CHOICES



class UserManager(BaseUserManager):
    def create_user(self, number, password=None, **extra_fields):
        if not number:
            raise ValueError("Users must have a phone number")

        user = self.model(number=number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(number, password, **extra_fields)



class User(AbstractUser):
    username = None

    number = models.CharField(
        max_length=11,
        verbose_name="number",
        help_text="Enter your number",
        unique=True,
    )

    email = models.EmailField(
        verbose_name="email address",
        help_text="Enter your email",
        blank=True,
        null=True,
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="active",
    )

    created_at = models.DateTimeField(
        verbose_name="creation date",
        auto_now_add=True,
    )

    last_update = models.DateTimeField(
        verbose_name="last update",
        auto_now=True,
    )

    USERNAME_FIELD = "number"
    REQUIRED_FIELDS = ["email"]

    objects = UserManager()

    class Meta:
        verbose_name = "1. account"

    def __str__(self):
        return self.number



class Profile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile_user",
    )

    fullname = models.CharField(
        max_length=36,
        verbose_name="name",
        help_text="whats your name?",
        default="",
    )

    username=models.CharField(
        verbose_name="username",
        help_text="useres username",
        max_length=100,
        unique=True,
        null=True,
        blank=True
    )

    photo = models.ImageField(
        upload_to="profile_photos",
        validators=[FileExtensionValidator(["jpg", "png"])],
        verbose_name="profile photo",
        help_text="upload your photo",
        default="profile_photos/default.jpg",
    )

    age = models.IntegerField(
        verbose_name="age",
        help_text="Enter your age",
        blank=True,
        null=True,
    )

    post_code = models.CharField(
        verbose_name="post code",
        help_text="Enter your postcode",
        max_length=20,
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    last_update = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "2.profile"

    def __str__(self):
        return f"profile of {self.user.number}"



class Review(models.Model) :
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="user_review",
    )

    book = models.ForeignKey(
        "catalog.Book",
        on_delete=models.CASCADE,
        related_name="book_reviews",
    )

    text = models.TextField(
        verbose_name="review text",
        help_text="Enter your review",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )
    last_update = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "3. review"

    def __str__(self):
        return f"review of {self.user.number}"



class Factor(models.Model):
    BOOK_PURCHASE = "book_purchase"
    BOOK = "book"  # legacy compatibility
    WALLET_CHARGE = "wallet_charge"
    PREMIUM = "premium"

    FACTOR_TYPE_CHOICES = (
        (BOOK_PURCHASE, "Book Purchase"),
        (BOOK, "Book"),
        (WALLET_CHARGE, "Wallet Charge"),
        (PREMIUM, "Premium"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="user_factors",
    )

    factor_type = models.CharField(
        max_length=30,
        choices=FACTOR_TYPE_CHOICES,
        default=BOOK_PURCHASE,
    )

    title = models.CharField(
        max_length=255,
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    items = models.JSONField(
        default=list,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    last_update = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "4. factor"
        verbose_name_plural = "4. factors"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} - {self.user.number}"


class UserOnlineBook(models.Model):
    PURCHASED = "purchased"
    PREMIUM = "premium"

    ACCESS_SOURCE_CHOICES = (
        (PURCHASED, "Purchased"),
        (PREMIUM, "Premium"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="user_online_books",
    )

    online_book = models.ForeignKey(
        "catalog.OnlineBook",
        on_delete=models.CASCADE,
        related_name="user_online_book_items",
    )

    access_source = models.CharField(
        max_length=30,
        choices=ACCESS_SOURCE_CHOICES,
        default=PURCHASED,
    )

    premium_until = models.DateTimeField(
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    last_update = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "5. user online book"
        verbose_name_plural = "5. user online books"
        ordering = ["created_at"]
        unique_together = ("user", "online_book")

    def __str__(self):
        title = getattr(self.online_book, "title", None)
        return f"{self.user.number} - {title.name if title else 'Online Book'}"

    @property
    def is_access_active(self):
        if self.access_source == self.PURCHASED:
            return True

        if self.access_source == self.PREMIUM:
            if not self.premium_until:
                return False

            return self.premium_until > timezone.now()

        return False

    @property
    def access_message(self):
        if self.access_source == self.PURCHASED:
            return "bought"

        if self.access_source == self.PREMIUM and self.is_access_active:
            return "premium active"

        if self.access_source == self.PREMIUM and not self.is_access_active:
            return "to access again but premium"

        return ""