from django.contrib import admin
from .models import (
    Genre,
    Discount,
    Author,
    Book,
    OnlineBook,
    Publishers,
    Translators,
    BookTitle,
    BookLevel
)


admin.site.register(Genre)
admin.site.register(Discount)
admin.site.register(Author)
admin.site.register(Book)
admin.site.register(OnlineBook)
admin.site.register(Publishers)
admin.site.register(Translators)
admin.site.register(BookTitle)
admin.site.register(BookLevel)