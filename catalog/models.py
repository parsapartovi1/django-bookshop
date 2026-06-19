from datetime import timezone, datetime

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


def default_expiration():
    return timezone.now() + timedelta(hours=24)


class Author(models.Model):
    name = models.CharField(
        max_length=100,
        verbose_name='Author Name',
        help_text='enter Author Name',
    )

    bio = models.TextField(
        verbose_name='Author Bio',
        help_text='enter Author Bio',
        blank=True,
        null=True,
    )

    photo = models.ImageField(
        verbose_name='Author Photo',
        help_text='enter Author Photo',
        validators=[FileExtensionValidator(['jpg', 'png'])],
        blank=True,
        null=True,
    )

    birth_date = models.DateField(
        verbose_name='Author Birth Date',
        help_text='enter Author Birth Date',
        blank=True,
        null=True,
    )

    class Meta:
        verbose_name = '2.Author Name'

    def __str__(self):
        return self.name + self.bio[0:10] or " " + "..."

class Discount(models.Model):
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    expiration = models.DateTimeField(
        verbose_name='expiration',
        help_text='Expiration time',
        default=default_expiration,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        verbose_name = "3.discount"

    def __str__(self):
        return f"{self.amount} in {self.expiration}"


class Book(models.Model):
    name = models.CharField(
        max_length=100,
        verbose_name='Book Name',
        help_text='enter Books Name',
         )

    description = models.TextField(
        verbose_name='Book Description',
        help_text='enter Books Description'
    )

    price = models.DecimalField(
        verbose_name='Book Price',
    )

    author = models.ForeignKey(
        Author,
        on_delete=models.CASCADE,
        verbose_name='BookAuthor',
    )

    photo = models.ImageField(
        verbose_name='Book Image',
        help_text='enter Books Image',
        validators=[FileExtensionValidator(['jpg', 'png'])],
    )

    level = models.CharField(
        verbose_name='Book Level',
        max_length=100,
        help_text='enter Books reader Level',
        choices=LEVEL_CHOICES,
    )

    language = models.CharField(
        verbose_name='Book Language',
        max_length=100,
        help_text='enter Books Language',
        choices=LANGUAGE_CHOICES,
    )

    discount = models.ForeignKey(
        Discount,
        on_delete=models.CASCADE,
        verbose_name='BookDiscount',
        help_text='enter Books Discount',
        blank=True,
        null=True,
    )

    class Meta:
        verbose_name = '1.Book'

    def __str__(self):
        return self.name + " " + self.description[0:10]+"..."


class Genre(models.Model):
    name = models.CharField(
        max_length=100,
        verbose_name='Category Name',
        choices=GENRE_CHOICES,
    )
    class Meta:
        verbose_name = '3.Category Name'

    def __str__(self):
        return self.name


class OnlineBook(models.Model):
    name = models.CharField(
        max_length=100,
    )

    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        verbose_name='Online Book',
    )

    url = models.URLField(
        verbose_name='Online Book URL',
        help_text='enter Online Book URL',
    )

    format =models.CharField(
         max_length=100,
        verbose_name='Online Book Format',
        help_text='enter Online Book Format',
        choices=FORMAT_CHOICES
    )

    access_type = models.CharField(
        max_length=100,
        verbose_name='Online Book Access Type',
        help_text='enter Online Book Access Type',
         choices=ACCESS_TYPE_CHOICES
    )

    class Meta:
        verbose_name = '4.Online Book'

    def __str__(self):
        return self.name + self.format