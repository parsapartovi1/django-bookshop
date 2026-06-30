document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("cart-page");

    if (!page) return;

    const CART_API = page.dataset.cartApi || "/cart/api/carts/";
    const UPDATE_ITEM_API = page.dataset.updateItemApi || "/cart/api/carts/update-item/";
    const REMOVE_ITEM_API = page.dataset.removeItemApi || "/cart/api/carts/remove-item/";
    const CLEAR_CART_API = page.dataset.clearCartApi || "/cart/api/carts/clear/";
    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";
    const HOME_URL = page.dataset.homeUrl || "/ketabook/";
    const CHECKOUT_URL = page.dataset.checkoutUrl || "/payment/gateway/?source=cart&task=cart_checkout";

    const MAX_PRINTED_QUANTITY = 10;

    const emptyState = document.getElementById("cart-empty-state");
    const emptyTitle = document.getElementById("cart-empty-title");
    const emptyDescription = document.getElementById("cart-empty-description");
    const emptyAction = document.getElementById("cart-empty-action");

    const itemsList = document.getElementById("cart-items-list");
    const itemTemplate = document.getElementById("cart-item-template");
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
            "Content-Type": "application/json",
            ...extraHeaders,
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const csrfToken = getCSRFToken();

        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }

        return headers;
    }

    function normalizeDigits(value) {
        const persian = "۰۱۲۳۴۵۶۷۸۹";
        const arabic = "٠١٢٣٤٥٦٧٨٩";

        return String(value || "")
            .replace(/[۰-۹]/g, digit => String(persian.indexOf(digit)))
            .replace(/[٠-٩]/g, digit => String(arabic.indexOf(digit)));
    }

    function numberValue(value) {
        const clean = normalizeDigits(value).replace(/[^\d.]/g, "");
        const number = Number(clean);

        return Number.isFinite(number) ? number : 0;
    }

    function parseQuantity(value) {
        const quantity = Math.floor(numberValue(value)) || 1;

        return Math.min(MAX_PRINTED_QUANTITY, Math.max(1, quantity));
    }

    function formatPrice(value) {
        const number = Number(value) || 0;

        return `${number.toLocaleString("fa-IR")} تومان`;
    }

    function formatCount(value) {
        return Number(value || 0).toLocaleString("fa-IR");
    }

    function firstNonEmpty(...values) {
        return values.find(value => value !== undefined && value !== null && String(value).trim() !== "") || "";
    }

    function objectOrNull(value) {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            return value;
        }

        return null;
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
            emptyAction.href = HOME_URL;
        }

        if (emptyState) {
            emptyState.hidden = false;
        }
    }

    async function apiRequest(url, options = {}) {
        const token = getAccessToken();

        if (!token) {
            showLoginEmptyCart();
            throw new Error("not authenticated");
        }

        const response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers: authHeaders(options.headers || {}),
        });

        if (response.status === 401 || response.status === 403) {
            clearAuthState();

            if (window.ketabookAuth) {
                window.ketabookAuth.clearAuthState();
                window.ketabookAuth.refreshNavbar();
            }

            showLoginEmptyCart();
            throw new Error("not authenticated");
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || data.detail || data.message || "request failed");
        }

        return data;
    }

    function getCartItems(data) {
        return (
            data.items ||
            data.results ||
            data.cart_items ||
            []
        );
    }

    function isOnlineCartItem(item) {
        const rawType = String(item.item_type || item.type || "").toLowerCase();

        return Boolean(
            rawType === "online_book" ||
            rawType === "online" ||
            rawType.includes("online") ||
            item.online_book ||
            item.online_book_id ||
            item.onlineBookId ||
            item.online_book_detail
        );
    }

    function getBookIdFromItem(item, isOnline) {
        const bookDetail = objectOrNull(item.book_detail);
        const onlineBookDetail = objectOrNull(item.online_book_detail);
        const onlineBookBook = objectOrNull(onlineBookDetail?.book);

        if (isOnline) {
            return firstNonEmpty(
                item.book,
                item.book_id,
                item.bookId,
                onlineBookDetail?.book_id,
                onlineBookDetail?.bookId,
                onlineBookBook?.id,
                onlineBookBook?.pk,
                bookDetail?.id,
                bookDetail?.pk
            );
        }

        return firstNonEmpty(
            item.book,
            item.book_id,
            item.bookId,
            bookDetail?.id,
            bookDetail?.pk
        );
    }

    function getOnlineBookIdFromItem(item) {
        const onlineBookDetail = objectOrNull(item.online_book_detail);

        return firstNonEmpty(
            item.online_book,
            item.online_book_id,
            item.onlineBookId,
            onlineBookDetail?.id,
            onlineBookDetail?.pk
        );
    }

    function getItemName(item, isOnline) {
        const bookDetail = objectOrNull(item.book_detail);
        const onlineBookDetail = objectOrNull(item.online_book_detail);
        const onlineBookBook = objectOrNull(onlineBookDetail?.book);

        if (isOnline) {
            return firstNonEmpty(
                item.item_name,
                onlineBookDetail?.book_name,
                onlineBookDetail?.name,
                onlineBookDetail?.title,
                onlineBookBook?.name,
                onlineBookBook?.title,
                bookDetail?.name,
                bookDetail?.title,
                "کتاب بدون نام"
            );
        }

        return firstNonEmpty(
            item.item_name,
            bookDetail?.name,
            bookDetail?.title,
            "کتاب بدون نام"
        );
    }

    function getItemAuthor(item, isOnline) {
        const bookDetail = objectOrNull(item.book_detail);
        const onlineBookDetail = objectOrNull(item.online_book_detail);
        const onlineBookBook = objectOrNull(onlineBookDetail?.book);
        const authorObject = objectOrNull(bookDetail?.author);
        const onlineAuthorObject = objectOrNull(onlineBookBook?.author);

        return firstNonEmpty(
            item.item_author,
            item.author,
            bookDetail?.author_name,
            authorObject?.name,
            onlineBookDetail?.author,
            onlineBookBook?.author_name,
            onlineAuthorObject?.name,
            isOnline ? "نویسنده نسخه آنلاین نامشخص" : "نویسنده نامشخص"
        );
    }

    function getItemPhoto(item, isOnline) {
        const bookDetail = objectOrNull(item.book_detail);
        const onlineBookDetail = objectOrNull(item.online_book_detail);
        const onlineBookBook = objectOrNull(onlineBookDetail?.book);

        return firstNonEmpty(
            item.item_photo,
            item.photo,
            bookDetail?.book_photo,
            bookDetail?.photo,
            bookDetail?.image,
            onlineBookDetail?.book_photo,
            onlineBookDetail?.photo,
            onlineBookDetail?.image,
            onlineBookBook?.book_photo,
            onlineBookBook?.photo,
            onlineBookBook?.image,
            ""
        );
    }

    function getItemUnitPrice(item, isOnline) {
        const bookDetail = objectOrNull(item.book_detail);
        const onlineBookDetail = objectOrNull(item.online_book_detail);

        if (isOnline) {
            return numberValue(firstNonEmpty(
                onlineBookDetail?.final_price,
                onlineBookDetail?.price,
                onlineBookDetail?.online_price,
                onlineBookDetail?.payable_price,

                item.online_book_final_price,
                item.online_final_price,
                item.online_book_price,
                item.online_price,

                0
            ));
        }

        return numberValue(firstNonEmpty(
            item.unit_price,
            item.price,
            item.item_price,
            bookDetail?.discounted_price,
            bookDetail?.final_price,
            bookDetail?.payable_price,
            bookDetail?.price,
            0
        ));
    }

    function getItemLink(itemPayload) {
        if (itemPayload.itemType === "online_book") {
            if (itemPayload.bookId && itemPayload.onlineBookId) {
                return `/ketabook/books/${itemPayload.bookId}/?online_book=${itemPayload.onlineBookId}`;
            }

            if (itemPayload.bookId) {
                return `/ketabook/books/${itemPayload.bookId}/`;
            }

            return HOME_URL;
        }

        if (itemPayload.bookId) {
            return `/ketabook/books/${itemPayload.bookId}/`;
        }

        return HOME_URL;
    }

    function getItemPayload(item) {
        const isOnline = isOnlineCartItem(item);
        const itemType = isOnline ? "online_book" : "printed_book";

        const bookId = getBookIdFromItem(item, isOnline);
        const onlineBookId = isOnline ? getOnlineBookIdFromItem(item) : "";
        const unitPrice = getItemUnitPrice(item, isOnline);

        const rawQuantity = Number(item.quantity || 1);
        const quantity = isOnline
            ? 1
            : Math.min(MAX_PRINTED_QUANTITY, Math.max(1, rawQuantity || 1));

        const subtotal = isOnline
            ? unitPrice
            : numberValue(firstNonEmpty(item.subtotal, item.total, unitPrice * quantity));

        const payload = {
            id: item.id,
            itemType,
            rawItem: item,
            bookId,
            onlineBookId,
            name: getItemName(item, isOnline),
            author: getItemAuthor(item, isOnline),
            photo: getItemPhoto(item, isOnline),
            unitPrice,
            quantity,
            subtotal,
        };

        payload.link = firstNonEmpty(item.item_link, item.link, getItemLink(payload));

        return payload;
    }

    function buildUpdateBody(item, quantity) {
        if (item.itemType === "online_book") {
            return {
                online_book: item.onlineBookId,
                quantity: 1,
            };
        }

        return {
            book: item.bookId,
            quantity: parseQuantity(quantity),
        };
    }

    function buildRemoveBody(item) {
        if (item.itemType === "online_book") {
            return {
                online_book: item.onlineBookId,
            };
        }

        return {
            book: item.bookId,
        };
    }

    async function updateQuantity(item, quantity) {
        if (item.itemType === "online_book") return;

        const nextQuantity = parseQuantity(quantity);

        if (nextQuantity === item.quantity) {
            return;
        }

        await apiRequest(UPDATE_ITEM_API, {
            method: "PATCH",
            body: JSON.stringify(buildUpdateBody(item, nextQuantity)),
        });

        await loadCart();
    }

    async function removeItem(item) {
        await apiRequest(REMOVE_ITEM_API, {
            method: "DELETE",
            body: JSON.stringify(buildRemoveBody(item)),
        });

        await loadCart();
    }

    function getPrintedTypeIcon() {
        return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4z"></path>
                <path d="M5 4v12"></path>
                <path d="M9 8h6"></path>
                <path d="M9 12h5"></path>
            </svg>
        `;
    }

    function getOnlineTypeIcon() {
        return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="5" width="16" height="11" rx="2"></rect>
                <path d="M8 20h8"></path>
                <path d="M12 16v4"></path>
                <path d="M9 9h6"></path>
                <path d="M9 12h4"></path>
            </svg>
        `;
    }

    function setItemTypeBadge(clone, item) {
        const badge = clone.querySelector("[data-item-type-badge]");
        const text = clone.querySelector("[data-item-type-text]");
        const icon = clone.querySelector("[data-item-type-icon]");

        if (!badge) return;

        const isOnline = item.itemType === "online_book";

        badge.classList.toggle("is-online-book", isOnline);
        badge.classList.toggle("is-printed-book", !isOnline);

        if (text) {
            text.textContent = isOnline ? "کتاب آنلاین" : "کتاب چاپی";
        }

        if (icon) {
            icon.innerHTML = isOnline ? getOnlineTypeIcon() : getPrintedTypeIcon();
        }
    }

    function renderItems(items) {
        if (!itemsList || !itemTemplate) return;

        itemsList.innerHTML = "";

        items.forEach(rawItem => {
            const item = getItemPayload(rawItem);
            const clone = itemTemplate.content.cloneNode(true);

            const cartItem = clone.querySelector("[data-cart-item]");
            const coverLink = clone.querySelector("[data-book-link]");
            const cover = clone.querySelector("[data-book-cover]");
            const coverFallback = clone.querySelector("[data-book-cover-fallback]");
            const title = clone.querySelector("[data-book-title]");
            const meta = clone.querySelector("[data-book-meta]");
            const price = clone.querySelector("[data-book-price]");
            const total = clone.querySelector("[data-item-total]");
            const input = clone.querySelector("[data-quantity-input]");
            const plus = clone.querySelector("[data-quantity-plus]");
            const minus = clone.querySelector("[data-quantity-minus]");
            const remove = clone.querySelector("[data-remove-item]");
            const quantityControl = clone.querySelector("[data-quantity-control]");
            const onlineQuantityLock = clone.querySelector("[data-online-quantity-lock]");

            const isOnline = item.itemType === "online_book";

            if (cartItem) {
                cartItem.classList.toggle("is-online-book", isOnline);
                cartItem.classList.toggle("is-printed-book", !isOnline);
            }

            setItemTypeBadge(clone, item);

            if (coverLink) {
                coverLink.href = item.link;
            }

            if (cover) {
                if (item.photo) {
                    cover.src = item.photo;
                    cover.alt = item.name;
                    cover.hidden = false;

                    if (coverFallback) {
                        coverFallback.hidden = true;
                    }
                } else {
                    cover.removeAttribute("src");
                    cover.alt = "";
                    cover.hidden = true;

                    if (coverFallback) {
                        coverFallback.hidden = false;
                    }
                }
            }

            if (title) {
                title.textContent = item.name;
                title.href = item.link;
            }

            if (meta) {
                meta.textContent = item.author;
            }

            if (price) {
                price.textContent = formatPrice(item.unitPrice);
            }

            if (total) {
                total.textContent = formatPrice(item.subtotal || item.unitPrice * item.quantity);
            }

            if (isOnline) {
                if (quantityControl) {
                    quantityControl.hidden = true;
                }

                if (onlineQuantityLock) {
                    onlineQuantityLock.hidden = false;
                }

                if (plus) plus.disabled = true;
                if (minus) minus.disabled = true;

                if (input) {
                    input.disabled = true;
                    input.value = "۱";
                }
            } else {
                if (quantityControl) {
                    quantityControl.hidden = false;
                }

                if (onlineQuantityLock) {
                    onlineQuantityLock.hidden = true;
                }

                if (input) {
                    input.value = item.quantity.toLocaleString("fa-IR");
                    input.maxLength = 2;

                    input.addEventListener("change", () => {
                        const nextQuantity = parseQuantity(input.value);
                        input.value = nextQuantity.toLocaleString("fa-IR");
                        updateQuantity(item, nextQuantity);
                    });

                    input.addEventListener("blur", () => {
                        const nextQuantity = parseQuantity(input.value);
                        input.value = nextQuantity.toLocaleString("fa-IR");
                    });
                }

                if (plus) {
                    plus.disabled = item.quantity >= MAX_PRINTED_QUANTITY;
                    plus.title = item.quantity >= MAX_PRINTED_QUANTITY
                        ? "حداکثر تعداد برای کتاب چاپی ۱۰ عدد است"
                        : "";

                    plus.addEventListener("click", () => {
                        if (item.quantity >= MAX_PRINTED_QUANTITY) return;

                        updateQuantity(item, item.quantity + 1);
                    });
                }

                if (minus) {
                    minus.disabled = item.quantity <= 1;

                    minus.addEventListener("click", () => {
                        const nextQuantity = Math.max(1, item.quantity - 1);

                        updateQuantity(item, nextQuantity);
                    });
                }
            }

            if (remove) {
                remove.addEventListener("click", () => {
                    removeItem(item);
                });
            }

            itemsList.appendChild(clone);
        });
    }

    function getTotalVisibleItemCount(items) {
        return items.reduce((sum, rawItem) => {
            const item = getItemPayload(rawItem);

            return sum + (item.itemType === "online_book" ? 1 : item.quantity);
        }, 0);
    }

    function getClientCalculatedTotal(items) {
        return items.reduce((sum, rawItem) => {
            const item = getItemPayload(rawItem);

            return sum + Number(item.subtotal || item.unitPrice * item.quantity || 0);
        }, 0);
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
            const data = await apiRequest(CART_API, {
                method: "GET",
            });

            const items = getCartItems(data);

            if (!items.length) {
                localStorage.setItem("ketabook_cart_count", "0");
                showNormalEmptyCart();
                return;
            }

            if (emptyState) {
                emptyState.hidden = true;
            }

            const visibleCount = getTotalVisibleItemCount(items);

            if (countLabel) {
                countLabel.textContent = `${formatCount(visibleCount)} کالا در سبد خرید`;
            }

            localStorage.setItem("ketabook_cart_count", String(visibleCount));

            if (clearButton) clearButton.disabled = false;
            if (checkoutButton) checkoutButton.disabled = false;

            const clientCalculatedTotal = getClientCalculatedTotal(items);
            const discount = Number(data.discount || data.total_discount || 0);

            setTotals(
                clientCalculatedTotal,
                discount,
                clientCalculatedTotal
            );

            renderItems(items);
        } catch (error) {
            console.error("Cart load failed:", error);
            showNormalEmptyCart();
        }
    }

    if (clearButton) {
        clearButton.addEventListener("click", async () => {
            try {
                clearButton.disabled = true;

                await apiRequest(CLEAR_CART_API, {
                    method: "DELETE",
                });

                await loadCart();
            } catch (error) {
                console.error("Clear cart failed:", error);
                showNormalEmptyCart();
            }
        });
    }

    if (checkoutButton) {
        checkoutButton.addEventListener("click", () => {
            const token = getAccessToken();

            if (!token) {
                showLoginEmptyCart();

                if (window.ketabookAuth) {
                    window.ketabookAuth.clearAuthState();
                    window.ketabookAuth.refreshNavbar();
                }

                window.location.href = LOGIN_URL;
                return;
            }

            checkoutButton.disabled = true;
            checkoutButton.textContent = "در حال انتقال به پرداخت...";

            window.location.href = CHECKOUT_URL;
        });
    }

    loadCart();
});