from django.shortcuts import redirect
from django.urls import path
from django.views.generic import TemplateView

from catalog.views import home_page


urlpatterns = [
    # ================= ROOT =================
    path(
        "",
        lambda request: redirect("/ketabook/"),
        name="home",
    ),

    # ================= HOME =================
    path(
        "ketabook/",
        home_page,
        name="ketabook-home",
    ),

    # ================= BOOK PAGES =================
    path(
        "ketabook/books/<int:book_id>/",
        TemplateView.as_view(template_name="book_pages/book-detail.html"),
        name="book-detail-page",
    ),

    path(
        "ketabook/online-books/",
        TemplateView.as_view(template_name="book_pages/online-books.html"),
        name="online-books-page",
    ),

    path(
        "ketabook/online-books/<int:online_book_id>/",
        TemplateView.as_view(template_name="book_pages/book-detail.html"),
        name="online-book-detail-page",
    ),

    path(
        "ketabook/online-books/<int:online_book_id>/reader/",
        TemplateView.as_view(template_name="book_pages/online-book-reader.html"),
        name="online-book-reader-page",
    ),

    # ================= SEARCH =================
    path(
        "ketabook/search/",
        TemplateView.as_view(template_name="search.html"),
        name="ketabook-search",
    ),

    path(
        "search/",
        TemplateView.as_view(template_name="search.html"),
        name="search",
    ),

    # ================= GENRES =================
    path(
        "ketabook/genres/<str:genre>/",
        TemplateView.as_view(template_name="genre.html"),
        name="genre-page",
    ),

    # ================= AUTHORS =================
    path(
        "ketabook/authors/<int:author_id>/",
        TemplateView.as_view(template_name="author-detail.html"),
        name="author-detail-page",
    ),

    # ================= PUBLISHERS =================
    path(
        "ketabook/publishers/<int:publisher_id>/",
        TemplateView.as_view(template_name="publisher-detail.html"),
        name="publisher-detail-page",
    ),

    # ================= ACCOUNT FRONT PAGES =================
    path(
        "account/login/",
        TemplateView.as_view(template_name="login.html"),
        name="account-login",
    ),

    path(
        "account/set-profile/",
        TemplateView.as_view(template_name="profile/set-profile.html"),
        name="set-profile",
    ),

    path(
        "account/profile/",
        TemplateView.as_view(template_name="profile/set-profile.html"),
        name="account-profile",
    ),

    path(
        "account/cart/",
        TemplateView.as_view(template_name="profile/cart.html"),
        name="cart-page",
    ),

    path(
        "account/factors/",
        TemplateView.as_view(template_name="profile/factor.html"),
        name="account-factors",
    ),

    path(
        "account/reviews/",
        TemplateView.as_view(template_name="profile/reviews.html"),
        name="account-reviews",
    ),

    path(
        "account/downloads/",
        TemplateView.as_view(template_name="profile/downloads.html"),
        name="account-downloads",
    ),

    path(
        "account/wallet/",
        TemplateView.as_view(template_name="profile/wallet.html"),
        name="wallet-page",
    ),

    path(
        "account/premium/",
        TemplateView.as_view(template_name="profile/premium.html"),
        name="premium-page",
    ),

    path(
        "account/gateway/",
        TemplateView.as_view(template_name="profile/payment-gateway.html"),
        name="payment-gateway-page",
    ),
]