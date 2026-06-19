from django.contrib import admin
from .models import Genre, Discount, Author, Book, OnlineBook


admin.site.register(Genre)
admin.site.register(Discount)
admin.site.register(Author)
admin.site.register(Book)
admin.site.register(OnlineBook)
