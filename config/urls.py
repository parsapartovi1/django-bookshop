from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.shortcuts import redirect
from django.urls import include, path
from django.views.generic import TemplateView

from catalog.views import home_page



urlpatterns = [

    path(
        "admin/",
        admin.site.urls,
    ),

    path(
        "",
        include("config.front_urls"),
    ),

    path(
        "catalog/",
        include("catalog.urls"),
    ),

    path(
        "account/",
        include("account.urls"),
    ),

    path(
        "cart/",
        include("cart.urls"),
    ),

    path(
        "payment/",
        include("payment.urls"),
    ),
]


if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )