document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("premium-page");

    if (!page) return;

    const PREMIUM_API = page.dataset.premiumApi || "/payment/api/premium/";
    const PREMIUM_BUY_API = page.dataset.premiumBuyApi || "/payment/api/premium/buy/";
    const WALLET_API = page.dataset.walletApi || "/payment/api/wallet/";
    const CART_API = page.dataset.cartApi || "/cart/api/carts/";

    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";
    const WALLET_URL = page.dataset.walletUrl || "/payment/wallet/";

    const premiumSubtitle = document.getElementById("premium-subtitle");
    const currentStatusEl = document.getElementById("premium-current-status");
    const expirationEl = document.getElementById("premium-expiration");
    const walletBalanceEl = document.getElementById("premium-wallet-balance");

    const loginState = document.getElementById("premium-login-state");
    const guideBox = document.querySelector(".premium-guide-box");
    const plansPanel = document.querySelector(".premium-plans-panel");
    const statusGrid = document.querySelector(".premium-status-grid");

    const planButtons = document.querySelectorAll(".premium-plan-card");
    const selectedBox = document.getElementById("premium-selected-box");
    const selectedText = document.getElementById("premium-selected-text");

    const statusMessage = document.getElementById("premium-status-message");
    const buyButton = document.getElementById("premium-buy-button");

    const sideCartCount = document.getElementById("premium-side-cart-count");
    const sideWalletAmount = document.getElementById("premium-side-wallet-amount");
    const sidePremiumStatus = document.getElementById("premium-side-premium-status");

    let selectedPlan = null;
    let currentWalletAmount = 0;
    let isBuying = false;

    /* =====================================================
       AUTH
    ===================================================== */

    function decodeJwtPayload(token) {
        try {
            const payload = token.split(".")[1];

            if (!payload) return null;

            let base64 = payload.replace(/-/g, "+").replace(/_/g, "/");

            while (base64.length % 4) {
                base64 += "=";
            }

            const json = decodeURIComponent(
                atob(base64)
                    .split("")
                    .map(char => {
                        return "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2);
                    })
                    .join("")
            );

            return JSON.parse(json);
        } catch (error) {
            console.warn("JWT decode failed. Keeping token instead of logging user out.", error);
            return null;
        }
    }

    function isTokenExpired(token) {
        if (!token) return true;

        const payload = decodeJwtPayload(token);

        if (!payload || !payload.exp) {
            return false;
        }

        const now = Math.floor(Date.now() / 1000);
        const safetySeconds = 10;

        return payload.exp <= now + safetySeconds;
    }

    function readTokenFromStoredObject(key) {
        const raw = localStorage.getItem(key);

        if (!raw) return "";

        try {
            const parsed = JSON.parse(raw);

            return (
                parsed.access ||
                parsed.access_token ||
                parsed.token ||
                parsed.tokens?.access ||
                ""
            );
        } catch {
            return "";
        }
    }

    function getRawAccessToken() {
        if (window.ketabookAuth && typeof window.ketabookAuth.getAccessToken === "function") {
            const tokenFromMain = window.ketabookAuth.getAccessToken();

            if (tokenFromMain) {
                return tokenFromMain;
            }
        }

        return (
            localStorage.getItem("ketabook_access_token") ||
            localStorage.getItem("access_token") ||
            localStorage.getItem("access") ||
            localStorage.getItem("jwt_access") ||
            localStorage.getItem("token") ||
            readTokenFromStoredObject("ketabook_tokens") ||
            readTokenFromStoredObject("tokens") ||
            readTokenFromStoredObject("auth") ||
            ""
        );
    }

    function clearAuthState() {
        localStorage.removeItem("ketabook_access_token");
        localStorage.removeItem("access_token");
        localStorage.removeItem("access");
        localStorage.removeItem("jwt_access");
        localStorage.removeItem("token");

        localStorage.removeItem("ketabook_refresh_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("refresh");

        localStorage.removeItem("ketabook_user");
        localStorage.removeItem("user");

        localStorage.removeItem("ketabook_is_logged_in");
        localStorage.removeItem("is_new");

        localStorage.removeItem("ketabook_cart_count");
    }

    function getToken() {
        const token = getRawAccessToken();

        if (!token) {
            console.warn("Premium page: no access token found in localStorage.");
            return "";
        }

        if (isTokenExpired(token)) {
            console.warn("Premium page: access token is expired.");

            clearAuthState();

            if (window.ketabookAuth) {
                window.ketabookAuth.clearAuthState?.();
                window.ketabookAuth.refreshNavbar?.();
            }

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

    function authHeaders(isJson = false) {
        const token = getToken();

        const headers = {
            "Accept": "application/json"
        };

        if (isJson) {
            headers["Content-Type"] = "application/json";
        }

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const csrfToken = getCSRFToken();

        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }

        return headers;
    }

    function handleUnauthorized(source = "unknown") {
        console.warn(`Premium page: backend returned 401/403 from ${source}.`);

        clearAuthState();

        if (window.ketabookAuth) {
            window.ketabookAuth.clearAuthState?.();
            window.ketabookAuth.refreshNavbar?.();
        }

        showLoginState();
    }

    /* =====================================================
       FORMATTERS
    ===================================================== */

    function toPersianDigits(value) {
        return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function numberValue(value) {
        const number = Number(value);

        return Number.isFinite(number) ? number : 0;
    }

    function formatMoney(value) {
        const number = numberValue(value);

        return `${number.toLocaleString("fa-IR")} تومان`;
    }

    function formatDateFa(value) {
        if (!value) return "---";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "---";
        }

        return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
            year: "numeric",
            month: "long",
            day: "numeric"
        }).format(date);
    }

    function getRemainingDays(expiration) {
        if (!expiration) return 0;

        const expirationDate = new Date(expiration);
        const now = new Date();

        const remainingMs = expirationDate.getTime() - now.getTime();

        if (Number.isNaN(remainingMs) || remainingMs <= 0) {
            return 0;
        }

        return Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
    }

    /* =====================================================
       UI
    ===================================================== */

    function showStatus(message, type = "error") {
        if (!statusMessage) return;

        statusMessage.hidden = false;
        statusMessage.textContent = message;
        statusMessage.className = `premium-status-message is-${type}`;
    }

    function hideStatus() {
        if (!statusMessage) return;

        statusMessage.hidden = true;
        statusMessage.textContent = "";
        statusMessage.className = "premium-status-message";
    }

    function setLoading(isLoading) {
        if (!buyButton) return;

        buyButton.disabled = isLoading || !selectedPlan;
        buyButton.classList.toggle("is-loading", isLoading);

        const text = buyButton.querySelector(".button-text");

        if (text) {
            text.textContent = isLoading ? "در حال فعال‌سازی..." : "خرید اشتراک";
        }
    }

    function showLoginState() {
        if (premiumSubtitle) {
            premiumSubtitle.textContent = "برای مشاهده اشتراک ویژه وارد حساب کاربری شوید.";
        }

        if (currentStatusEl) currentStatusEl.textContent = "اشتراک ندارید";
        if (expirationEl) expirationEl.textContent = "---";
        if (walletBalanceEl) walletBalanceEl.textContent = "۰ تومان";

        if (statusGrid) statusGrid.hidden = true;
        if (guideBox) guideBox.hidden = true;
        if (plansPanel) plansPanel.hidden = true;
        if (loginState) loginState.hidden = false;

        setEmptySidebarStats();
    }

    function showPremiumState() {
        if (statusGrid) statusGrid.hidden = false;
        if (guideBox) guideBox.hidden = false;
        if (plansPanel) plansPanel.hidden = false;
        if (loginState) loginState.hidden = true;
    }

    function setPremiumStatus(premiumData, walletData = null) {
        const isActive = Boolean(
            premiumData?.is_active ||
            premiumData?.premium_account ||
            walletData?.premium_status
        );

        const expiration =
            premiumData?.premium_expiration ||
            walletData?.premium_expiration ||
            null;

        const remainingDays = getRemainingDays(expiration);

        if (!isActive || remainingDays <= 0) {
            if (currentStatusEl) currentStatusEl.textContent = "اشتراک ندارید";
            if (expirationEl) expirationEl.textContent = "---";
            if (premiumSubtitle) premiumSubtitle.textContent = "اشتراک ویژه شما فعال نیست.";
            if (sidePremiumStatus) sidePremiumStatus.textContent = "اشتراک ندارید";
            return;
        }

        if (currentStatusEl) {
            currentStatusEl.textContent = `${remainingDays.toLocaleString("fa-IR")} روز باقی مانده`;
        }

        if (expirationEl) {
            expirationEl.textContent = formatDateFa(expiration);
        }

        if (premiumSubtitle) {
            premiumSubtitle.textContent = "اشتراک ویژه شما فعال است.";
        }

        if (sidePremiumStatus) {
            sidePremiumStatus.textContent = `${remainingDays.toLocaleString("fa-IR")} روز باقی مانده`;
        }
    }

    function setWalletBalance(amount) {
        currentWalletAmount = numberValue(amount);

        if (walletBalanceEl) {
            walletBalanceEl.textContent = formatMoney(currentWalletAmount);
        }

        if (sideWalletAmount) {
            sideWalletAmount.textContent = formatMoney(currentWalletAmount);
        }
    }

    function clearPlanSelection() {
        selectedPlan = null;

        planButtons.forEach(button => {
            button.classList.remove("active");
        });

        if (selectedBox) {
            selectedBox.hidden = true;
        }

        if (selectedText) {
            selectedText.textContent = "---";
        }

        if (buyButton) {
            buyButton.disabled = true;
        }
    }

    function selectPlan(button) {
        const months = Number(button.dataset.months || 0);
        const price = Number(button.dataset.price || 0);

        if (!months || !price) return;

        if (
            selectedPlan &&
            selectedPlan.months === months &&
            selectedPlan.price === price
        ) {
            clearPlanSelection();
            return;
        }

        selectedPlan = {
            months,
            price
        };

        planButtons.forEach(item => {
            item.classList.toggle("active", item === button);
        });

        if (selectedBox) {
            selectedBox.hidden = false;
        }

        if (selectedText) {
            selectedText.textContent =
                `${months.toLocaleString("fa-IR")} ماهه - ${formatMoney(price)}`;
        }

        if (buyButton) {
            buyButton.disabled = false;
        }
    }

    /* =====================================================
       BACKEND DATA NORMALIZATION
    ===================================================== */

    function getWalletAmount(walletData) {
        if (!walletData) return 0;

        return (
            walletData.amount ??
            walletData.wallet?.amount ??
            walletData.wallet_amount ??
            0
        );
    }

    function getCartItems(cartData) {
        if (!cartData) return [];

        if (Array.isArray(cartData.items)) return cartData.items;
        if (Array.isArray(cartData.results)) return cartData.results;
        if (cartData.cart && Array.isArray(cartData.cart.items)) return cartData.cart.items;

        return [];
    }

    function getCartItemsCount(cartData) {
        if (!cartData) return 0;

        if (cartData.total_items !== undefined) return numberValue(cartData.total_items);
        if (cartData.items_count !== undefined) return numberValue(cartData.items_count);
        if (cartData.count !== undefined) return numberValue(cartData.count);

        return getCartItems(cartData).reduce((sum, item) => {
            return sum + numberValue(item.quantity || 0);
        }, 0);
    }

    /* =====================================================
       API
    ===================================================== */

    async function fetchJson(url, options = {}, source = url) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options
        });

        if (response.status === 401 || response.status === 403) {
            handleUnauthorized(source);
            return null;
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message =
                data.error ||
                data.detail ||
                data.message ||
                data.wallet ||
                "درخواست انجام نشد.";

            const error = new Error(Array.isArray(message) ? message.join(" ") : String(message));
            error.data = data;
            throw error;
        }

        return data;
    }

    async function loadPremium() {
        const token = getToken();

        hideStatus();

        if (!token) {
            showLoginState();
            return;
        }

        try {
            showPremiumState();

            const [premiumData, walletData, cartData] = await Promise.all([
                fetchJson(
                    PREMIUM_API,
                    {
                        method: "GET",
                        headers: authHeaders()
                    },
                    "premium"
                ),
                fetchJson(
                    WALLET_API,
                    {
                        method: "GET",
                        headers: authHeaders()
                    },
                    "wallet"
                ),
                fetchJson(
                    CART_API,
                    {
                        method: "GET",
                        headers: authHeaders()
                    },
                    "cart"
                )
            ]);

            if (!premiumData || !walletData || !cartData) return;

            const walletAmount = getWalletAmount(walletData);
            const cartItemsCount = getCartItemsCount(cartData);

            setWalletBalance(walletAmount);
            setPremiumStatus(premiumData, walletData);

            if (sideCartCount) {
                sideCartCount.textContent = toPersianDigits(cartItemsCount);
            }

            localStorage.setItem("ketabook_cart_count", String(cartItemsCount));
        } catch (error) {
            console.error("Premium load failed:", error);

            showPremiumState();
            showStatus(error.message || "دریافت اطلاعات اشتراک انجام نشد.", "error");
        }
    }

    async function buyPremium() {
        const token = getToken();

        hideStatus();

        if (!token) {
            showLoginState();
            return;
        }

        if (!selectedPlan) {
            showStatus("ابتدا یک پلن اشتراک انتخاب کنید.", "error");
            return;
        }

        if (currentWalletAmount < selectedPlan.price) {
            showStatus(
                `موجودی کیف پول کافی نیست. مبلغ مورد نیاز ${formatMoney(selectedPlan.price)} است.`,
                "error"
            );
            return;
        }

        try {
            isBuying = true;
            page.classList.add("is-busy");
            setLoading(true);

            const data = await fetchJson(
                PREMIUM_BUY_API,
                {
                    method: "POST",
                    headers: authHeaders(true),
                    body: JSON.stringify({
                        months: selectedPlan.months
                    })
                },
                "premium buy"
            );

            if (!data) return;

            const premiumData = data.premium || data;
            const walletAmount = data.wallet_amount ?? currentWalletAmount - selectedPlan.price;

            setWalletBalance(walletAmount);
            setPremiumStatus(premiumData);

            showStatus("اشتراک ویژه شما با موفقیت فعال شد.", "success");
            clearPlanSelection();

            if (window.ketabookToast) {
                window.ketabookToast("اشتراک ویژه فعال شد");
            }
        } catch (error) {
            console.error("Premium buy failed:", error);

            const data = error.data || {};

            if (data.error === "not enough wallet balance.") {
                showStatus(
                    `موجودی کیف پول کافی نیست. موجودی شما ${formatMoney(data.wallet_amount)} و مبلغ مورد نیاز ${formatMoney(data.required_amount)} است.`,
                    "error"
                );
                return;
            }

            showStatus(error.message || "خرید اشتراک انجام نشد.", "error");
        } finally {
            isBuying = false;
            page.classList.remove("is-busy");
            setLoading(false);
        }
    }

    /* =====================================================
       SIDEBAR FALLBACK
    ===================================================== */

    function setEmptySidebarStats() {
        if (sideCartCount) sideCartCount.textContent = "۰";
        if (sideWalletAmount) sideWalletAmount.textContent = "۰ تومان";
        if (sidePremiumStatus) sidePremiumStatus.textContent = "اشتراک ندارید";
    }

    /* =====================================================
       EVENTS
    ===================================================== */

    planButtons.forEach(button => {
        button.addEventListener("click", () => {
            selectPlan(button);
        });
    });

    if (buyButton) {
        buyButton.addEventListener("click", () => {
            if (!isBuying) {
                buyPremium();
            }
        });
    }

    window.addEventListener("focus", () => {
        loadPremium();
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            loadPremium();
        }
    });

    /* =====================================================
       INIT
    ===================================================== */

    clearPlanSelection();
    loadPremium();
});