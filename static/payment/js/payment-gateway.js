document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("payment-gateway-page");

    if (!page) return;

    const WALLET_CHARGE_API = page.dataset.walletChargeApi || "/payment/api/wallet/charge/";
    const CART_ADD_ITEM_API = page.dataset.cartAddItemApi || "/cart/api/carts/add-item/";
    const CART_CHECKOUT_API = page.dataset.cartCheckoutApi || "/cart/api/carts/checkout-paid/";

    const WALLET_URL = page.dataset.walletUrl || "/payment/wallet/";
    const CART_URL = page.dataset.cartUrl || "/cart/";
    const HOME_URL = page.dataset.homeUrl || "/ketabook/";
    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";

    const statusBox = document.getElementById("payment-gateway-status");
    const subtitle = document.getElementById("payment-gateway-subtitle");
    const taskLabel = document.getElementById("payment-task-label");
    const payableAmount = document.getElementById("payment-payable-amount");
    const walletAmountRow = document.getElementById("payment-wallet-amount-row");
    const walletAmountInput = document.getElementById("payment-wallet-amount");
    const gatewayCards = document.querySelectorAll("[data-gateway]");
    const submitButton = document.getElementById("payment-submit-button");
    const backLink = document.getElementById("payment-back-link");

    const INTENT_KEY = "ketabook_payment_intent";

    let selectedGateway = "";
    let currentIntent = null;
    let isSubmitting = false;

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
    }

    function getToken() {
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

    function authHeaders(extraHeaders = {}) {
        const token = getToken();

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

    function numberValue(value) {
        const number = Number(String(value || "").replace(/[^\d.]/g, ""));
        return Number.isFinite(number) ? number : 0;
    }

    function toPersianDigits(value) {
        return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("fa-IR")} تومان`;
    }

    function showStatus(message, type = "error") {
        if (!statusBox) return;

        statusBox.hidden = false;
        statusBox.textContent = message;
        statusBox.className = `payment-gateway-status is-${type}`;
    }

    function hideStatus() {
        if (!statusBox) return;

        statusBox.hidden = true;
        statusBox.textContent = "";
        statusBox.className = "payment-gateway-status";
    }

    function readIntentFromUrl() {
        const params = new URLSearchParams(window.location.search);

        return {
            source: params.get("source") || "",
            task: params.get("task") || "",
            book_id: params.get("book_id") || "",
            quantity: params.get("quantity") || "1",
            amount: params.get("amount") || "",
        };
    }

    function readStoredIntent() {
        try {
            return JSON.parse(sessionStorage.getItem(INTENT_KEY) || "{}");
        } catch {
            return {};
        }
    }

    function saveIntent(intent) {
        sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
    }

    function clearIntent() {
        sessionStorage.removeItem(INTENT_KEY);
    }

    function getIntent() {
        const urlIntent = readIntentFromUrl();
        const storedIntent = readStoredIntent();

        return {
            ...storedIntent,
            ...Object.fromEntries(
                Object.entries(urlIntent).filter(([, value]) => value)
            )
        };
    }

    function getTaskLabel(task) {
        if (task === "wallet_charge") return "شارژ کیف پول";
        if (task === "cart_checkout") return "پرداخت سبد خرید";
        if (task === "book_buy") return "خرید مستقیم کتاب";

        return "نامشخص";
    }

    function getBackUrl(task) {
        if (task === "wallet_charge") return WALLET_URL;
        if (task === "cart_checkout") return CART_URL;
        if (task === "book_buy") return HOME_URL;

        return HOME_URL;
    }

    function renderIntent() {
        currentIntent = getIntent();

        if (!currentIntent.task) {
            showStatus("نوع پرداخت مشخص نیست. لطفا دوباره از سبد خرید یا کیف پول اقدام کنید.", "error");
            if (submitButton) submitButton.disabled = true;
            return;
        }

        if (taskLabel) {
            taskLabel.textContent = getTaskLabel(currentIntent.task);
        }

        if (subtitle) {
            subtitle.textContent = `${getTaskLabel(currentIntent.task)} از طریق درگاه بانکی`;
        }

        if (backLink) {
            backLink.href = getBackUrl(currentIntent.task);
        }

        if (currentIntent.task === "wallet_charge") {
            if (walletAmountRow) walletAmountRow.hidden = false;

            if (walletAmountInput && currentIntent.amount) {
                walletAmountInput.value = currentIntent.amount;
            }

            updatePayableAmount();
        } else {
            if (walletAmountRow) walletAmountRow.hidden = true;

            if (payableAmount) {
                payableAmount.textContent = "بر اساس اطلاعات سفارش";
            }
        }

        updateSubmitState();
    }

    function updatePayableAmount() {
        if (!payableAmount) return;

        if (currentIntent?.task === "wallet_charge") {
            const amount = numberValue(walletAmountInput?.value || currentIntent.amount || 0);
            payableAmount.textContent = amount ? formatMoney(amount) : "مبلغ شارژ را وارد کنید";
            return;
        }

        payableAmount.textContent = "بر اساس اطلاعات سفارش";
    }

    function updateSubmitState() {
        if (!submitButton) return;

        if (!currentIntent?.task || !selectedGateway) {
            submitButton.disabled = true;
            return;
        }

        if (currentIntent.task === "wallet_charge") {
            submitButton.disabled = numberValue(walletAmountInput?.value || currentIntent.amount || 0) <= 0;
            return;
        }

        submitButton.disabled = false;
    }

    async function postJson(url, body = {}) {
        const response = await fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: authHeaders({
                "Content-Type": "application/json"
            }),
            body: JSON.stringify(body)
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 401 || response.status === 403) {
            clearAuthState();
            window.location.href = LOGIN_URL;
            return null;
        }

        if (!response.ok) {
            throw new Error(data.error || data.detail || data.message || "عملیات پرداخت انجام نشد.");
        }

        return data;
    }

    async function finalizeWalletCharge(intent) {
        const amount = numberValue(intent.amount);

        if (!amount) {
            throw new Error("مبلغ شارژ کیف پول مشخص نیست.");
        }

        return postJson(WALLET_CHARGE_API, {
            amount: String(amount)
        });
    }

    async function finalizeCartCheckout() {
        return postJson(CART_CHECKOUT_API, {});
    }

    async function finalizeBookBuy(intent) {
        const bookId = intent.book_id;
        const quantity = numberValue(intent.quantity || 1) || 1;

        if (!bookId) {
            throw new Error("شناسه کتاب برای خرید مستقیم مشخص نیست.");
        }

        await postJson(CART_ADD_ITEM_API, {
            book: bookId,
            quantity: quantity
        });

        return finalizeCartCheckout();
    }

    async function finalizePayment() {
        const params = new URLSearchParams(window.location.search);
        const status = params.get("status");

        if (status !== "success") return;

        const intent = readStoredIntent();

        if (!intent.task) {
            showStatus("اطلاعات پرداخت پیدا نشد.", "error");
            return;
        }

        try {
            isSubmitting = true;
            if (submitButton) submitButton.disabled = true;

            showStatus("پرداخت موفق بود. در حال ثبت نتیجه در کتابوک...", "success");

            if (intent.task === "wallet_charge") {
                await finalizeWalletCharge(intent);
                clearIntent();
                showStatus("کیف پول شما با موفقیت شارژ شد.", "success");

                setTimeout(() => {
                    window.location.href = WALLET_URL;
                }, 1000);

                return;
            }

            if (intent.task === "cart_checkout") {
                await finalizeCartCheckout();
                clearIntent();
                showStatus("پرداخت سبد خرید با موفقیت ثبت شد.", "success");

                setTimeout(() => {
                    window.location.href = CART_URL;
                }, 1000);

                return;
            }

            if (intent.task === "book_buy") {
                await finalizeBookBuy(intent);
                clearIntent();
                showStatus("خرید کتاب با موفقیت ثبت شد.", "success");

                setTimeout(() => {
                    window.location.href = CART_URL;
                }, 1000);

                return;
            }

            throw new Error("نوع پرداخت پشتیبانی نمی‌شود.");
        } catch (error) {
            console.error("Finalize payment failed:", error);
            showStatus(error.message || "ثبت نتیجه پرداخت انجام نشد.", "error");
            if (submitButton) submitButton.disabled = false;
        } finally {
            isSubmitting = false;
        }
    }

    function goToFakeBank() {
        if (isSubmitting || !currentIntent?.task || !selectedGateway) return;

        const intent = {
            ...currentIntent,
            gateway: selectedGateway,
            amount: currentIntent.task === "wallet_charge"
                ? String(numberValue(walletAmountInput?.value || currentIntent.amount || 0))
                : currentIntent.amount || "",
        };

        if (intent.task === "wallet_charge" && !numberValue(intent.amount)) {
            showStatus("مبلغ شارژ کیف پول را وارد کنید.", "error");
            return;
        }

        saveIntent(intent);

        const nextUrl = new URL(window.location.href);
        nextUrl.search = "";
        nextUrl.searchParams.set("status", "success");

        window.location.href = nextUrl.toString();
    }

    gatewayCards.forEach(card => {
        card.addEventListener("click", () => {
            selectedGateway = card.dataset.gateway || "";

            gatewayCards.forEach(item => {
                item.classList.toggle("active", item === card);
            });

            hideStatus();
            updateSubmitState();
        });
    });

    if (walletAmountInput) {
        walletAmountInput.addEventListener("input", () => {
            walletAmountInput.value = walletAmountInput.value.replace(/[^\d]/g, "");
            updatePayableAmount();
            updateSubmitState();
        });
    }

    if (submitButton) {
        submitButton.addEventListener("click", goToFakeBank);
    }

    if (!getToken()) {
        window.location.href = LOGIN_URL;
        return;
    }

    renderIntent();
    finalizePayment();
});