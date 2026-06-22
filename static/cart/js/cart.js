document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("cart-page");

    if (!page) return;

    const CART_API = page.dataset.cartApi || "/cart/api/cart/";
    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";

    const emptyState = document.getElementById("cart-empty-state");
    const emptyTitle = document.getElementById("cart-empty-title");
    const emptyDescription = document.getElementById("cart-empty-description");
    const emptyAction = document.getElementById("cart-empty-action");

    const itemsList = document.getElementById("cart-items-list");
    const countLabel = document.getElementById("cart-count-label");

    const subtotalEl = document.getElementById("cart-subtotal");
    const discountEl = document.getElementById("cart-discount");
    const totalEl = document.getElementById("cart-total");

    const clearButton = document.getElementById("cart-clear-button");
    const checkoutButton = document.getElementById("cart-checkout-button");

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

        const now = Math.floor(Date.now() / 1000);

        return payload.exp <= now + 10;
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

    function getAccessToken() {
        const token = getRawAccessToken();

        if (!token || isTokenExpired(token)) {
            clearAuthState();
            return "";
        }

        return token;
    }

    function formatPrice(value) {
        const number = Number(value) || 0;

        return `${number.toLocaleString("fa-IR")} تومان`;
    }

    function setTotals(subtotal = 0, discount = 0, total = 0) {
        if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
        if (discountEl) discountEl.textContent = formatPrice(discount);
        if (totalEl) totalEl.textContent = formatPrice(total);
    }

    function showLoginEmptyCart() {
        if (itemsList) itemsList.innerHTML = "";

        if (countLabel) {
            countLabel.textContent = "۰ کالا در سبد خرید";
        }

        setTotals(0, 0, 0);

        if (clearButton) clearButton.disabled = true;
        if (checkoutButton) checkoutButton.disabled = true;

        if (emptyTitle) {
            emptyTitle.textContent = "سبد خرید شما خالی است وارد حساب کاربری خود شوید";
        }

        if (emptyDescription) {
            emptyDescription.textContent = "برای دیدن و ذخیره کتاب‌های سبد خرید، ابتدا وارد حساب کاربری شوید.";
        }

        if (emptyAction) {
            emptyAction.textContent = "حساب کاربری";
            emptyAction.href = LOGIN_URL;
        }

        if (emptyState) {
            emptyState.hidden = false;
        }
    }

    function showNormalEmptyCart() {
        if (itemsList) itemsList.innerHTML = "";

        if (countLabel) {
            countLabel.textContent = "۰ کالا در سبد خرید";
        }

        setTotals(0, 0, 0);

        if (clearButton) clearButton.disabled = true;
        if (checkoutButton) checkoutButton.disabled = true;

        if (emptyTitle) {
            emptyTitle.textContent = "سبد خرید شما خالی است";
        }

        if (emptyDescription) {
            emptyDescription.textContent = "کتاب‌های مورد علاقه‌ات را انتخاب کن و بعد به سبد خرید برگرد.";
        }

        if (emptyAction) {
            emptyAction.textContent = "رفتن به فروشگاه";
            emptyAction.href = "/ketabook/";
        }

        if (emptyState) {
            emptyState.hidden = false;
        }
    }

    async function loadCart() {
        const token = getAccessToken();

        if (!token) {
            showLoginEmptyCart();

            if (window.ketabookAuth) {
                window.ketabookAuth.clearAuthState();
                window.ketabookAuth.refreshNavbar();
            }

            return;
        }

        try {
            const response = await fetch(CART_API, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                credentials: "same-origin"
            });

            if (response.status === 401 || response.status === 403) {
                clearAuthState();

                if (window.ketabookAuth) {
                    window.ketabookAuth.clearAuthState();
                    window.ketabookAuth.refreshNavbar();
                }

                showLoginEmptyCart();
                return;
            }

            if (!response.ok) {
                showNormalEmptyCart();
                return;
            }

            const data = await response.json();

            const items =
                data.items ||
                data.results ||
                data.cart_items ||
                [];

            if (!items.length) {
                showNormalEmptyCart();
                return;
            }

            if (emptyState) {
                emptyState.hidden = true;
            }

            if (countLabel) {
                countLabel.textContent = `${items.length.toLocaleString("fa-IR")} کالا در سبد خرید`;
            }

            localStorage.setItem("ketabook_cart_count", String(items.length));

            if (clearButton) clearButton.disabled = false;
            if (checkoutButton) checkoutButton.disabled = false;

            const subtotal =
                data.subtotal ||
                data.total_price ||
                data.total ||
                0;

            const discount = data.discount || 0;
            const total = data.payable || data.final_total || subtotal - discount;

            setTotals(subtotal, discount, total);

        } catch {
            showNormalEmptyCart();
        }
    }

    loadCart();
});