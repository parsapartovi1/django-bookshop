
document.addEventListener("DOMContentLoaded", () => {
    const sideNav = document.querySelector("[data-side-nav]");

    if (!sideNav) return;

    const CART_API = sideNav.dataset.cartApi || "/cart/api/carts/";
    const WALLET_API = sideNav.dataset.walletApi || "/payment/api/wallet/";
    const PREMIUM_API = sideNav.dataset.premiumApi || "/payment/api/premium/";

    const cartCount = document.getElementById("profile-side-cart-count");
    const walletAmount = document.getElementById("profile-side-wallet-amount");
    const premiumStatus = document.getElementById("profile-side-premium-status");

    function getRawAccessToken() {
        return (
            localStorage.getItem("ketabook_access_token") ||
            localStorage.getItem("access_token") ||
            ""
        );
    }

    function decodeJwtPayload(token) {
        try {
            const payload = token.split(".")[1];

            if (!payload) return null;

            const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
            return JSON.parse(atob(base64));
        } catch {
            return null;
        }
    }

    function isTokenExpired(token) {
        if (!token) return true;

        const payload = decodeJwtPayload(token);

        if (!payload || !payload.exp) return false;

        return payload.exp <= Math.floor(Date.now() / 1000) + 10;
    }

    function clearAuthState() {
        localStorage.removeItem("ketabook_access_token");
        localStorage.removeItem("access_token");

        localStorage.removeItem("ketabook_refresh_token");
        localStorage.removeItem("refresh_token");

        localStorage.removeItem("ketabook_user");
        localStorage.removeItem("user");

        localStorage.removeItem("ketabook_is_logged_in");
        localStorage.removeItem("is_new");

        localStorage.removeItem("ketabook_cart_count");
        localStorage.removeItem("ketabook_wallet_amount");
        localStorage.removeItem("ketabook_premium_days");
    }

    function getAccessToken() {
        if (window.ketabookAuth && typeof window.ketabookAuth.getAccessToken === "function") {
            const token = window.ketabookAuth.getAccessToken();

            if (token && !isTokenExpired(token)) {
                return token;
            }
        }

        const token = getRawAccessToken();

        if (!token || isTokenExpired(token)) {
            clearAuthState();
            return "";
        }

        return token;
    }

    function getCSRFToken() {
        const cookies = document.cookie ? document.cookie.split(";") : [];

        for (let cookie of cookies) {
            cookie = cookie.trim();

            if (cookie.startsWith("csrftoken=")) {
                return decodeURIComponent(cookie.substring("csrftoken=".length));
            }
        }

        return "";
    }

    function authHeaders() {
        const token = getAccessToken();

        const headers = {
            "Accept": "application/json"
        };

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const csrfToken = getCSRFToken();

        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }

        return headers;
    }

    function toPersianDigits(value) {
        return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function numberValue(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("fa-IR")} تومان`;
    }

    async function requestJson(url) {
        const token = getAccessToken();

        if (!token) {
            return {};
        }

        try {
            const response = await fetch(url, {
                method: "GET",
                credentials: "same-origin",
                headers: authHeaders()
            });

            if (response.status === 401 || response.status === 403) {
                clearAuthState();

                if (window.ketabookAuth?.refreshNavbar) {
                    window.ketabookAuth.refreshNavbar();
                }

                return {};
            }

            if (!response.ok) {
                return {};
            }

            return response.json();
        } catch (error) {
            console.warn("Side nav request failed:", error);
            return {};
        }
    }

    function renderLoggedOutState() {
        if (cartCount) {
            cartCount.textContent = "۰";
        }

        if (walletAmount) {
            walletAmount.textContent = "وارد نشده‌اید";
        }

        if (premiumStatus) {
            premiumStatus.textContent = "وارد نشده‌اید";
        }
    }

    function renderCart(data) {
        const cart = data?.cart || data || {};
        const totalItems = cart.total_items ?? cart.items_count ?? cart.count ?? 0;

        if (cartCount) {
            cartCount.textContent = toPersianDigits(totalItems);
        }

        localStorage.setItem("ketabook_cart_count", String(totalItems));
    }

    function renderWallet(data) {
        const wallet = data?.wallet || data || {};
        const amount = wallet.amount ?? wallet.balance ?? wallet.wallet_amount ?? 0;

        if (walletAmount) {
            walletAmount.textContent = formatMoney(amount);
        }

        localStorage.setItem("ketabook_wallet_amount", String(amount));
    }

    function renderPremium(data) {
        const premium = data?.premium || data || {};

        const isActive = Boolean(
            premium.is_active ||
            premium.premium_status ||
            premium.active
        );

        const expiration =
            premium.premium_expiration ||
            premium.expiration ||
            premium.end_date ||
            "";

        if (!premiumStatus) return;

        if (!isActive) {
            premiumStatus.textContent = "اشتراک ندارید";
            localStorage.setItem("ketabook_premium_days", "0");
            return;
        }

        if (!expiration) {
            premiumStatus.textContent = "فعال";
            return;
        }

        const endDate = new Date(expiration);
        const today = new Date();

        if (Number.isNaN(endDate.getTime())) {
            premiumStatus.textContent = "فعال";
            return;
        }

        const diffDays = Math.ceil((endDate - today) / 86400000);

        if (diffDays > 0) {
            premiumStatus.textContent = `${toPersianDigits(diffDays)} روز باقی مانده`;
            localStorage.setItem("ketabook_premium_days", String(diffDays));
        } else {
            premiumStatus.textContent = "اشتراک ندارید";
            localStorage.setItem("ketabook_premium_days", "0");
        }
    }

    async function loadSideNavStats() {
        const token = getAccessToken();

        if (!token) {
            renderLoggedOutState();
            return;
        }

        if (walletAmount) {
            walletAmount.textContent = "در حال دریافت...";
        }

        if (premiumStatus) {
            premiumStatus.textContent = "در حال دریافت...";
        }

        const [cartData, walletData, premiumData] = await Promise.all([
            requestJson(CART_API),
            requestJson(WALLET_API),
            requestJson(PREMIUM_API)
        ]);

        renderCart(cartData);
        renderWallet(walletData);
        renderPremium(premiumData);
    }

    function setActiveByUrl() {
        const activeFromTemplate = sideNav.dataset.active || "";

        if (activeFromTemplate) return;

        const path = window.location.pathname;

        const links = sideNav.querySelectorAll(".profile-side-link");

        links.forEach(link => {
            link.classList.remove("active");

            const href = link.getAttribute("href") || "";

            if (href && path.startsWith(href)) {
                link.classList.add("active");
            }
        });
    }

    setActiveByUrl();
    loadSideNavStats();

    window.addEventListener("focus", loadSideNavStats);

    window.addEventListener("ketabook:side-nav-refresh", loadSideNavStats);

    window.ketabookSideNav = {
        refresh: loadSideNavStats
    };
});