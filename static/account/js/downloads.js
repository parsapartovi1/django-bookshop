document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("downloads-page");

    if (!page) return;

    const MY_ONLINE_BOOKS_API = page.dataset.myOnlineBooksApi || "/account/api/my-online-books/";
    const DELETE_SELECTED_API = page.dataset.deleteSelectedApi || "/account/api/my-online-books/delete-selected/";
    const ONLINE_BOOKS_API = page.dataset.onlineBooksApi || "/catalog/api/online-books/";
    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";
    const HOME_URL = page.dataset.homeUrl || "/ketabook/";

    const downloadsCountLabel = document.getElementById("downloads-count-label");
    const downloadsStatus = document.getElementById("downloads-status");

    const deleteSelectedButton = document.getElementById("downloads-delete-selected-button");
    const selectedCounter = document.getElementById("downloads-selected-counter");

    const downloadsGrid = document.getElementById("downloads-items-grid");
    const downloadsEmptyState = document.getElementById("downloads-empty-state");
    const downloadBookTemplate = document.getElementById("download-book-template");

    let onlineBooks = [];
    const selectedIds = new Set();

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

    function redirectToLogin() {
        clearAuthState();

        if (window.ketabookAuth?.refreshNavbar) {
            window.ketabookAuth.refreshNavbar();
        }

        window.location.href = LOGIN_URL;
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
            ...extraHeaders,
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

    /* =====================================================
       BASIC HELPERS
    ===================================================== */

    function toPersianDigits(value) {
        return String(value ?? "").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function formatDate(value) {
        if (!value) return "---";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "---";

        return new Intl.DateTimeFormat("fa-IR", {
            year: "numeric",
            month: "long",
            day: "numeric",
        }).format(date);
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

    function buildApiDetailUrl(apiUrl, id) {
        const baseUrl = String(apiUrl || "").endsWith("/")
            ? String(apiUrl || "")
            : `${String(apiUrl || "")}/`;

        return `${baseUrl}${id}/`;
    }

    function showStatus(message, type = "success") {
        if (!downloadsStatus) return;

        downloadsStatus.hidden = false;
        downloadsStatus.textContent = message;
        downloadsStatus.className = `downloads-status is-${type}`;
    }

    function hideStatus() {
        if (!downloadsStatus) return;

        downloadsStatus.hidden = true;
        downloadsStatus.textContent = "";
        downloadsStatus.className = "downloads-status";
    }

    /* =====================================================
       BOOK / ONLINE BOOK ID HELPERS
    ===================================================== */

    function getNestedBook(rawItem) {
        const onlineBookObject = objectOrNull(rawItem?.online_book);
        const onlineBookDetailObject = objectOrNull(rawItem?.online_book_detail);

        const candidates = [
            objectOrNull(rawItem?.book_detail),
            objectOrNull(rawItem?.book_data),
            objectOrNull(rawItem?.book_info),
            objectOrNull(rawItem?.book),
            objectOrNull(onlineBookObject?.book_detail),
            objectOrNull(onlineBookObject?.book),
            objectOrNull(onlineBookDetailObject?.book_detail),
            objectOrNull(onlineBookDetailObject?.book),
        ];

        return candidates.find(item => item && Object.keys(item).length) || {};
    }

    function getBookId(rawItem) {
        const nestedBook = getNestedBook(rawItem);
        const onlineBookObject = objectOrNull(rawItem?.online_book);
        const onlineBookDetailObject = objectOrNull(rawItem?.online_book_detail);

        if (typeof rawItem?.book === "number" || typeof rawItem?.book === "string") {
            return rawItem.book;
        }

        if (
            onlineBookObject &&
            (typeof onlineBookObject.book === "number" || typeof onlineBookObject.book === "string")
        ) {
            return onlineBookObject.book;
        }

        if (
            onlineBookDetailObject &&
            (typeof onlineBookDetailObject.book === "number" || typeof onlineBookDetailObject.book === "string")
        ) {
            return onlineBookDetailObject.book;
        }

        return firstNonEmpty(
            rawItem?.book_id,
            rawItem?.bookId,
            rawItem?.book_pk,
            rawItem?.original_book_id,
            rawItem?.online_book_book_id,

            nestedBook?.id,
            nestedBook?.pk,
            nestedBook?.book_id,

            onlineBookObject?.book_id,
            onlineBookObject?.bookId,
            onlineBookObject?.book_pk,

            onlineBookDetailObject?.book_id,
            onlineBookDetailObject?.bookId,
            onlineBookDetailObject?.book_pk
        );
    }

    function getOnlineBookId(rawItem) {
        const onlineBookObject = objectOrNull(rawItem?.online_book);
        const onlineBookDetailObject = objectOrNull(rawItem?.online_book_detail);

        if (typeof rawItem?.online_book === "number" || typeof rawItem?.online_book === "string") {
            return rawItem.online_book;
        }

        return firstNonEmpty(
            rawItem?.online_book_id,
            rawItem?.onlineBookId,
            rawItem?.online_book_pk,
            rawItem?.online_book_detail_id,
            rawItem?.onlineBookDetailId,

            onlineBookObject?.id,
            onlineBookObject?.pk,
            onlineBookObject?.online_book_id,

            onlineBookDetailObject?.id,
            onlineBookDetailObject?.pk,
            onlineBookDetailObject?.online_book_id
        );
    }

    function buildBookDetailUrl(bookId, onlineBookId) {
        const safeBookId = String(bookId || "").trim();
        const safeOnlineBookId = String(onlineBookId || "").trim();

        if (!safeBookId) {
            return HOME_URL;
        }

        if (safeOnlineBookId) {
            return `/ketabook/books/${safeBookId}/?online_book=${safeOnlineBookId}`;
        }

        return `/ketabook/books/${safeBookId}/`;
    }

    async function fetchOnlineBookDetail(onlineBookId) {
        if (!onlineBookId) return {};

        try {
            const response = await fetch(buildApiDetailUrl(ONLINE_BOOKS_API, onlineBookId), {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json",
                },
            });

            if (!response.ok) {
                return {};
            }

            return await response.json();

        } catch (error) {
            console.warn("Online book detail request failed:", error);
            return {};
        }
    }

    /* =====================================================
       NORMALIZE API DATA
    ===================================================== */

    function normalizeOnlineBook(rawItem) {
        const nestedBook = getNestedBook(rawItem);

        const bookId = getBookId(rawItem);
        const onlineBookId = getOnlineBookId(rawItem);

        return {
            id: rawItem.id,
            bookId,
            onlineBookId,
            detailUrl: buildBookDetailUrl(bookId, onlineBookId),

            title: firstNonEmpty(
                rawItem.book_name,
                rawItem.online_book_name,
                rawItem.name,
                rawItem.title,
                nestedBook.name,
                nestedBook.title,
                "کتاب آنلاین"
            ),

            author: firstNonEmpty(
                rawItem.author_name,
                rawItem.author,
                nestedBook.author_name,
                objectOrNull(nestedBook.author)?.name,
                "نویسنده نامشخص"
            ),

            photo: firstNonEmpty(
                rawItem.book_photo,
                rawItem.photo,
                rawItem.image,
                rawItem.cover,
                nestedBook.book_photo,
                nestedBook.photo,
                nestedBook.image,
                nestedBook.cover,
                ""
            ),

            format: firstNonEmpty(
                rawItem.online_book_format,
                rawItem.format,
                "online"
            ),

            createdAt: firstNonEmpty(
                rawItem.created_at,
                rawItem.createdAt,
                rawItem.date_joined,
                ""
            ),

            raw: rawItem,
        };
    }

    async function enrichOnlineBook(book) {
        if (book.bookId || !book.onlineBookId) {
            book.detailUrl = buildBookDetailUrl(book.bookId, book.onlineBookId);
            return book;
        }

        const detail = await fetchOnlineBookDetail(book.onlineBookId);

        if (!detail || !Object.keys(detail).length) {
            book.detailUrl = buildBookDetailUrl(book.bookId, book.onlineBookId);
            return book;
        }

        const nestedBook = getNestedBook(detail);

        const detailBookId = getBookId(detail);
        const detailOnlineBookId = firstNonEmpty(
            getOnlineBookId(detail),
            detail.id,
            book.onlineBookId
        );

        const finalBookId = firstNonEmpty(book.bookId, detailBookId);
        const finalOnlineBookId = firstNonEmpty(book.onlineBookId, detailOnlineBookId);

        return {
            ...book,

            bookId: finalBookId,
            onlineBookId: finalOnlineBookId,
            detailUrl: buildBookDetailUrl(finalBookId, finalOnlineBookId),

            title: firstNonEmpty(
                book.title,
                detail.book_name,
                detail.name,
                detail.title,
                nestedBook.name,
                nestedBook.title,
                "کتاب آنلاین"
            ),

            author: firstNonEmpty(
                book.author,
                detail.author_name,
                nestedBook.author_name,
                objectOrNull(nestedBook.author)?.name,
                "نویسنده نامشخص"
            ),

            photo: firstNonEmpty(
                book.photo,
                detail.book_photo,
                detail.photo,
                detail.image,
                nestedBook.book_photo,
                nestedBook.photo,
                nestedBook.image,
                nestedBook.cover,
                ""
            ),
        };
    }

    async function normalizeOnlineBooks(data) {
        const list =
            data?.online_books ||
            data?.results ||
            data?.items ||
            data ||
            [];

        if (!Array.isArray(list)) return [];

        const normalized = list
            .map(normalizeOnlineBook)
            .filter(item => item.id);

        return Promise.all(
            normalized.map(book => enrichOnlineBook(book))
        );
    }

    function updateSelectionState() {
        const count = selectedIds.size;

        if (selectedCounter) {
            selectedCounter.textContent = `${toPersianDigits(count)} انتخاب شده`;
        }

        if (deleteSelectedButton) {
            deleteSelectedButton.disabled = count === 0;
        }
    }

    /* =====================================================
       API
    ===================================================== */

    async function requestJson(url, options = {}) {
        const token = getAccessToken();

        if (!token) {
            redirectToLogin();
            return null;
        }

        const response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers: authHeaders(options.headers || {}),
        });

        if (response.status === 401 || response.status === 403) {
            redirectToLogin();
            return null;
        }

        if (response.status === 204) {
            return {};
        }

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            const message =
                data?.detail ||
                data?.error ||
                "request failed";

            throw new Error(message);
        }

        return data;
    }

    async function loadOnlineBooks() {
        try {
            hideStatus();

            if (downloadsCountLabel) {
                downloadsCountLabel.textContent = "در حال دریافت کتاب‌های آنلاین شما...";
            }

            const data = await requestJson(MY_ONLINE_BOOKS_API);

            onlineBooks = await normalizeOnlineBooks(data);
            selectedIds.clear();

            renderOnlineBooks(onlineBooks);
            updateSelectionState();

            if (downloadsCountLabel) {
                downloadsCountLabel.textContent = onlineBooks.length
                    ? `${toPersianDigits(onlineBooks.length)} کتاب آنلاین در کتاب‌های من`
                    : "هنوز کتاب آنلاینی ندارید";
            }

        } catch (error) {
            console.error("Online books load failed:", error);

            onlineBooks = [];
            selectedIds.clear();

            renderOnlineBooks([]);
            updateSelectionState();

            showStatus("دریافت کتاب‌های آنلاین انجام نشد.", "error");

            if (downloadsCountLabel) {
                downloadsCountLabel.textContent = "دریافت کتاب‌های آنلاین انجام نشد";
            }
        }
    }

    async function deleteSelectedBooks() {
        const ids = Array.from(selectedIds);

        if (!ids.length) return;

        if (ids.length > 10) {
            showStatus("حداکثر می‌توانید ۱۰ کتاب را هم‌زمان حذف کنید.", "error");
            return;
        }

        const confirmed = window.confirm(
            `آیا از حذف ${ids.length} کتاب از کتاب‌های من مطمئن هستید؟`
        );

        if (!confirmed) return;

        try {
            deleteSelectedButton.disabled = true;

            await requestJson(DELETE_SELECTED_API, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ids,
                }),
            });

            onlineBooks = onlineBooks.filter(book => !selectedIds.has(String(book.id)));
            selectedIds.clear();

            renderOnlineBooks(onlineBooks);
            updateSelectionState();

            if (downloadsCountLabel) {
                downloadsCountLabel.textContent = onlineBooks.length
                    ? `${toPersianDigits(onlineBooks.length)} کتاب آنلاین در کتاب‌های من`
                    : "هنوز کتاب آنلاینی ندارید";
            }

            showStatus("کتاب‌های انتخاب‌شده با موفقیت حذف شدند.", "success");

        } catch (error) {
            console.error("Delete online books failed:", error);
            showStatus("حذف کتاب‌های انتخاب‌شده انجام نشد.", "error");
            updateSelectionState();
        }
    }

    /* =====================================================
       RENDER
    ===================================================== */

    function renderOnlineBooks(list) {
        if (!downloadsGrid || !downloadsEmptyState || !downloadBookTemplate) return;

        downloadsGrid.innerHTML = "";

        if (!list.length) {
            downloadsEmptyState.hidden = false;
            return;
        }

        downloadsEmptyState.hidden = true;

        list.forEach((book) => {
            const clone = downloadBookTemplate.content.cloneNode(true);
            const card = clone.querySelector("[data-online-book-card]");

            const checkbox = clone.querySelector("[data-select-online-book]");
            const bookLink = clone.querySelector("[data-online-book-link]");
            const bookCover = clone.querySelector("[data-book-cover]");
            const bookCoverFallback = clone.querySelector("[data-book-cover-fallback]");
            const bookTitle = clone.querySelector("[data-book-title]");
            const bookAuthor = clone.querySelector("[data-book-author]");
            const onlineBookFormat = clone.querySelector("[data-online-book-format]");
            const onlineBookDate = clone.querySelector("[data-online-book-date]");

            const savedItemId = String(book.id);
            const detailUrl = book.detailUrl || buildBookDetailUrl(book.bookId, book.onlineBookId);

            if (card) {
                card.dataset.savedOnlineBookId = savedItemId;
                card.dataset.bookId = String(book.bookId || "");
                card.dataset.onlineBookId = String(book.onlineBookId || "");
                card.dataset.detailUrl = detailUrl;

                card.addEventListener("click", event => {
                    const target = event.target instanceof Element
                        ? event.target
                        : null;

                    if (!target) return;

                    if (
                        target.closest(".download-select-box") ||
                        target.closest("input")
                    ) {
                        return;
                    }

                    window.location.href = detailUrl;
                });
            }

            if (bookLink) {
                bookLink.href = detailUrl;
            }

            if (bookTitle) {
                bookTitle.href = detailUrl;
                bookTitle.textContent = book.title;
            }

            if (bookAuthor) {
                bookAuthor.textContent = book.author;
            }

            if (onlineBookFormat) {
                onlineBookFormat.textContent = book.format || "online";
            }

            if (onlineBookDate) {
                onlineBookDate.textContent = formatDate(book.createdAt);
            }

            if (bookCover && bookCoverFallback) {
                if (book.photo) {
                    bookCover.src = book.photo;
                    bookCover.alt = book.title;
                    bookCover.hidden = false;
                    bookCoverFallback.hidden = true;

                    bookCover.addEventListener("error", () => {
                        bookCover.hidden = true;
                        bookCoverFallback.hidden = false;
                    });
                } else {
                    bookCover.hidden = true;
                    bookCoverFallback.hidden = false;
                }
            }

            if (checkbox && card) {
                checkbox.checked = selectedIds.has(savedItemId);
                card.classList.toggle("is-selected", checkbox.checked);

                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) {
                        if (selectedIds.size >= 10) {
                            checkbox.checked = false;
                            showStatus("حداکثر می‌توانید ۱۰ کتاب را انتخاب کنید.", "error");
                            return;
                        }

                        selectedIds.add(savedItemId);
                    } else {
                        selectedIds.delete(savedItemId);
                    }

                    card.classList.toggle("is-selected", checkbox.checked);
                    updateSelectionState();
                });
            }

            downloadsGrid.appendChild(clone);
        });
    }

    if (deleteSelectedButton) {
        deleteSelectedButton.addEventListener("click", deleteSelectedBooks);
    }

    loadOnlineBooks();
});