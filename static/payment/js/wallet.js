document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("wallet-page");

    if (!page) return;

    const WALLET_API = page.dataset.walletApi || "/payment/api/wallet/";
    const PREMIUM_API = page.dataset.premiumApi || "/payment/api/premium/";
    const CART_API = page.dataset.cartApi || "/cart/api/carts/";

    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";
    const PAYMENT_GATEWAY_URL = page.dataset.paymentGatewayUrl || "/payment/gateway/";

    const walletMainBalance = document.getElementById("wallet-main-balance");

    const walletStatus = document.getElementById("wallet-status");
    const walletLoginState = document.getElementById("wallet-login-state");
    const walletChargeButton = document.getElementById("wallet-charge-button");

    const sideCartCount = document.getElementById("profile-side-cart-count");
    const sideWalletAmount = document.getElementById("profile-side-wallet-amount");
    const sidePremiumStatus = document.getElementById("profile-side-premium-status");

    /* =====================================================
       AUTH
    ===================================================== */

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

    function refreshNavbar() {
        if (window.ketabookAuth) {
            window.ketabookAuth.clearAuthState?.();
            window.ketabookAuth.refreshNavbar?.();
        }
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

    function authHeaders(extraHeaders = {}) {
        const token = getAccessToken();

        const headers = {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`,
            ...extraHeaders
        };

        const csrfToken = getCSRFToken();

        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }

        return headers;
    }

    /* =====================================================
       HELPERS
    ===================================================== */

    function numberValue(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function toPersianDigits(value) {
        return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("fa-IR")} تومان`;
    }

    function showStatus(message, type = "error") {
        if (!walletStatus) return;

        walletStatus.hidden = false;
        walletStatus.textContent = message;
        walletStatus.className = `wallet-status is-${type}`;
    }

    function hideStatus() {
        if (!walletStatus) return;

        walletStatus.hidden = true;
        walletStatus.textContent = "";
        walletStatus.className = "wallet-status";
    }

    function showLoginState(show) {
        if (walletLoginState) {
            walletLoginState.hidden = !show;
        }
    }

    function setLoadingTexts() {
        if (walletMainBalance) {
            walletMainBalance.textContent = "در حال دریافت...";
        }

        if (sideWalletAmount) {
            sideWalletAmount.textContent = "در حال دریافت...";
        }

        if (sidePremiumStatus) {
            sidePremiumStatus.textContent = "در حال دریافت...";
        }
    }

    function setLoggedOutTexts() {
        if (walletMainBalance) {
            walletMainBalance.textContent = "۰ تومان";
        }

        if (sideCartCount) {
            sideCartCount.textContent = "۰";
        }

        if (sideWalletAmount) {
            sideWalletAmount.textContent = "وارد نشده‌اید";
        }

        if (sidePremiumStatus) {
            sidePremiumStatus.textContent = "وارد نشده‌اید";
        }
    }

    function buildGatewayUrl() {
        const url = new URL(PAYMENT_GATEWAY_URL, window.location.origin);

        url.searchParams.set("source", "wallet");
        url.searchParams.set("task", "wallet_charge");

        return url.pathname + url.search;
    }

    /* =====================================================
       API
    ===================================================== */

    async function requestData(url) {
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
                refreshNavbar();
                return {};
            }

            if (!response.ok) {
                console.error("Wallet page API failed:", url, response.status);
                return {};
            }

            return await response.json();
        } catch (error) {
            console.error("Wallet page fetch failed:", url, error);
            return {};
        }
    }

    /* =====================================================
       NORMALIZERS
    ===================================================== */

    function normalizeWallet(wallet) {
        return wallet?.wallet || wallet || {};
    }

    function normalizePremium(premium) {
        return premium?.premium || premium || {};
    }

    function normalizeCart(cart) {
        return cart?.cart || cart || {};
    }

    function getCartItems(cart) {
        const cartData = normalizeCart(cart);

        return Array.isArray(cartData.items)
            ? cartData.items
            : [];
    }

    function getCartCount(cart) {
        const cartData = normalizeCart(cart);

        if (cartData.total_items !== undefined && cartData.total_items !== null) {
            return numberValue(cartData.total_items);
        }

        return getCartItems(cartData).reduce((total, item) => {
            return total + (Number(item.quantity) || 0);
        }, 0);
    }

    function getWalletAmount(wallet) {
        const walletData = normalizeWallet(wallet);

        return (
            walletData.amount ??
            walletData.balance ??
            walletData.wallet_amount ??
            0
        );
    }

    function getPremiumStatus(premium, wallet = {}) {
        const premiumData = normalizePremium(premium);
        const walletData = normalizeWallet(wallet);

        const isActive =
            premiumData.is_active ||
            premiumData.premium_status ||
            walletData.premium_status ||
            false;

        const expiration =
            premiumData.premium_expiration ||
            premiumData.expiration ||
            walletData.premium_expiration ||
            "";

        if (!isActive) {
            return "اشتراک ندارید";
        }

        if (!expiration) {
            return "فعال";
        }

        const endDate = new Date(expiration);
        const today = new Date();

        if (Number.isNaN(endDate.getTime())) {
            return "فعال";
        }

        const diffDays = Math.ceil((endDate - today) / 86400000);

        return diffDays > 0
            ? `${toPersianDigits(diffDays)} روز باقی مانده`
            : "اشتراک ندارید";
    }

    /* =====================================================
       RENDER
    ===================================================== */

    function renderWallet(wallet) {
        const amount = getWalletAmount(wallet);

        if (walletMainBalance) {
            walletMainBalance.textContent = formatMoney(amount);
        }

        if (sideWalletAmount) {
            sideWalletAmount.textContent = formatMoney(amount);
        }

        localStorage.setItem("ketabook_wallet_amount", String(amount));
    }

    function renderCart(cart) {
        const count = getCartCount(cart);

        if (sideCartCount) {
            sideCartCount.textContent = toPersianDigits(count);
        }

        localStorage.setItem("ketabook_cart_count", String(count));
    }

    function renderPremium(premium, wallet) {
        const status = getPremiumStatus(premium, wallet);

        if (sidePremiumStatus) {
            sidePremiumStatus.textContent = status;
        }
    }

    function renderPageData(wallet, premium, cart) {
        renderWallet(wallet);
        renderPremium(premium, wallet);
        renderCart(cart);
    }

    /* =====================================================
       LOAD
    ===================================================== */

    async function loadWalletPage() {
        hideStatus();

        const token = getAccessToken();

        if (!token) {
            showLoginState(true);
            setLoggedOutTexts();
            refreshNavbar();
            return;
        }

        showLoginState(false);
        setLoadingTexts();

        const [wallet, premium, cart] = await Promise.all([
            requestData(WALLET_API),
            requestData(PREMIUM_API),
            requestData(CART_API)
        ]);

        renderPageData(wallet, premium, cart);
    }

    /* =====================================================
       EVENTS
    ===================================================== */

    if (walletChargeButton) {
        walletChargeButton.href = buildGatewayUrl();

        walletChargeButton.addEventListener("click", event => {
            const token = getAccessToken();

            if (!token) {
                event.preventDefault();
                sessionStorage.setItem("ketabook_toast", "برای شارژ کیف پول وارد حساب شوید");
                window.location.href = LOGIN_URL;
                return;
            }

            walletChargeButton.href = buildGatewayUrl();
        });
    }

    window.addEventListener("focus", loadWalletPage);
    window.addEventListener("storage", loadWalletPage);

    /* =====================================================
       INIT
    ===================================================== */

    loadWalletPage();
});