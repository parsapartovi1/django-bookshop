from django.contrib import admin
from django.urls import path ,include
from django.shortcuts import redirect

from catalog.views import (
    home_page
)


urlpatterns = [
    path("", lambda request: redirect("ketabook/"), name="home"),
    path('admin/', admin.site.urls),

    path("ketabook/", home_page, name="ketabook-home"),

    path('catalog/', include('catalog.urls')),
    path("account/", include("account.urls")),
    path("cart/", include("cart.urls")),
    path("payment/", include("payment.urls")),

]
