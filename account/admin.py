from django.contrib import admin
from .models import (
    User,
    Profile,
    Review,
    UserOnlineBook,
    Factor,
)

admin.site.register(Profile)
admin.site.register(Review)
admin.site.register(Factor)
admin.site.register(UserOnlineBook)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):

    readonly_fields = ("created_at", "last_update", "last_login")

    fieldsets = (
        ("Login Info", {
            "fields": ("number","password")
        }),
        ("Personal Info", {
            "fields": ("email",)
        }),
        ("Permissions", {
            "fields": ("is_active", "is_superuser","is_staff")
        }),
        ("Dates", {
            "fields": ("last_login", "created_at", "last_update")
        })
    )

