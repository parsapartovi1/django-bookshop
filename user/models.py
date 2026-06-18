from django.db import models
from django.core.validators import FileExtensionValidator
from django.contrib.auth.models import AbstractUser, BaseUserManager
import random
import string
from django.core.exceptions import ValidationError
from catalog.models import Book
# Create your models here.


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
        verbose_name = "1. user"

    def __str__(self):
        return self.number


class Profile(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        verbose_name="profileuser",
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

    address = models.CharField(
        verbose_name="address",
        help_text="Enter your address",
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    last_update = models.DateTimeField(
        auto_now=True,
    )

class Review(models.Model) :
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        verbose_name="userreview",
    )

    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        verbose_name="bookreview",
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