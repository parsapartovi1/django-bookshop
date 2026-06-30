from django.core.validators import FileExtensionValidator
from django.db import models

from .choices import (
    LEVEL_CHOICES,
    LANGUAGE_CHOICES,
    GENRE_CHOICES,
    ACCESS_TYPE_CHOICES,
    FORMAT_CHOICES
)

from django.utils import timezone
from datetime import timedelta

from payment.models  import Discount





class Author(models.Model):
    name = models.CharField(
        verbose_name='Author Name',
        help_text='enter Author Name',
        max_length=100,
    )

    bio = models.TextField(
        verbose_name='Author Bio',
        help_text='enter Author Bio',
        blank=True,
        null=True,
    )

    photo = models.ImageField(
        verbose_name='Author Photo',
        help_text='upload the Authors Photo',
        validators=[FileExtensionValidator(['jpg', 'png', 'jpeg'])],
        upload_to="author_photos",
        blank=True,
        null=True,
    )

    birth_date = models.DateField(
        verbose_name='Author Birth Date',
        help_text='enter Author Birth Date',
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        verbose_name = '3.Authors'

    def __str__(self):
        return f"{self.name} {(self.bio or '')[:10]}..."



class Publishers(models.Model):
    publisher=models.CharField(
        verbose_name="publisher name",
        help_text="the name of the book's publisher",
        max_length = 100,
    )

    picture =models.ImageField(
        verbose_name="publishers_pictures",
        help_text="the picture of the publisher",
        validators=[FileExtensionValidator(['jpg', 'png', 'jpeg'])],
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        verbose_name = "Publisher"
        verbose_name_plural = "4.Publishers"

    def __str__(self):
        return self.publisher



class Translators(models.Model):
    name = models.CharField(
        verbose_name="book translator",
        help_text="the translator of the book",
        max_length = 100,
    )

    translate_to=models.CharField(
        verbose_name="translate to language",
        help_text="the language translator translates to",
        choices=LANGUAGE_CHOICES,
        max_length=100,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        verbose_name = 'Translator'

    def __str__(self):
        return self.name + self.translate_to



def default_expiration():
    return timezone.now() + timedelta(hours=24)

class Genre(models.Model):
    name = models.CharField(
        verbose_name='Category Name',
        help_text="the name of the category",
        max_length=100,
        choices=GENRE_CHOICES,
    )

    discount = models.ForeignKey(
        Discount,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name="BookDiscount",
        help_text="enter Books Discount",
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        verbose_name = '6.Category Name'

    def __str__(self):
        return self.name


class BookLevel(models.Model):
    value = models.CharField(
        max_length=30,
        choices=LEVEL_CHOICES,
        unique=True,
        verbose_name="Book Level",
        help_text="Book reader level",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "book level"
        verbose_name_plural = "book levels"

    def __str__(self):
        return self.get_value_display()


class BookTitle(models.Model):
    name = models.CharField(
        verbose_name="Book Name",
        help_text="enter Book Name",
        max_length=100,

    )

    description = models.TextField(
        verbose_name="Book Description",
        help_text="enter Book Description",
        blank=True,
        null=True,
    )

    genres = models.ManyToManyField(
        Genre,
        related_name="book_titles",
        blank=True,
        verbose_name="book_genre",
        help_text="the genre of the book",
    )

    author = models.ManyToManyField(
        Author,
        verbose_name="Book Author",
        help_text="the author of the book",
        blank=True,
    )

    publisher = models.ManyToManyField(
        Publishers,
        related_name="book_titles",
        verbose_name="publisher",
        help_text="the publisher of the book",
        blank=True,
    )

    translator = models.ManyToManyField(
        Translators,
        related_name="book_translator",
        verbose_name="translator",
        help_text="the translator of the book",
        blank=True,
    )

    photo = models.ImageField(
        verbose_name="Book Image",
        help_text="enter Book Image",
        validators=[FileExtensionValidator(["jpg", "png", "jpeg"])],
        upload_to="book_photos",
        blank=True,
    )

    level = models.ManyToManyField(
        BookLevel,
        related_name="book_titles",
        verbose_name="Book Levels",
        help_text="Choose one or more reader levels",
        blank=True,
    )

    language = models.CharField(
        verbose_name="Book Language",
        help_text="enter Book language",
        max_length=100,
        choices=LANGUAGE_CHOICES,
        blank=True,
        null=True,
    )

    discount = models.ForeignKey(
        Discount,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name="Book Discount",
        help_text="enter Book Discount",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "1.Book Title"

    def __str__(self):
        return self.name




class Book(models.Model):
    title = models.ForeignKey(
        BookTitle,
        on_delete=models.CASCADE,
        related_name="physical_versions",
        verbose_name="Book Title",
    )

    price = models.DecimalField(
        verbose_name="Printed Book Price",
        help_text="the printed book price in Toman",
        max_digits=10,
        decimal_places=2,
    )

    discount = models.ForeignKey(
        Discount,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name="Printed Book Discount",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "2.Printed Book"

    def __str__(self):
        return f"{self.title.name} - printed"




class OnlineBook(models.Model):
    title = models.ForeignKey(
        BookTitle,
        on_delete=models.CASCADE,
        related_name="online_versions",
        verbose_name="Book Title",
        blank=True
    )

    url = models.FileField(
        verbose_name="Online Book File",
        help_text="upload Online Book PDF or TXT file",
        validators=[FileExtensionValidator(["pdf", "txt"])],
        upload_to="online_books",
    )

    price = models.DecimalField(
        verbose_name="Online Book Price",
        help_text="the price of the online book",
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    discount = models.ForeignKey(
        Discount,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name="Online Book Discount",
    )

    format = models.CharField(
        max_length=100,
        verbose_name="Online Book Format",
        help_text="enter Online Book Format",
        choices=FORMAT_CHOICES,
        default="pdf",
    )

    access_type = models.CharField(
        max_length=100,
        verbose_name="Online Book Access Type",
        help_text="enter Online Book Access Type",
        choices=ACCESS_TYPE_CHOICES,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "3.Online Book"

    def __str__(self):
        return f"{self.title.name} - {self.format}"