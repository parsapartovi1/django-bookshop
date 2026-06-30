document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("reviews-page");

    if (!page) return;

    const MY_REVIEWS_API = page.dataset.myReviewsApi || "/account/api/review/my-reviews/";
    const REVIEW_API_BASE = page.dataset.reviewApiBase || "/account/api/review/";
    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";

    const reviewsCountLabel = document.getElementById("reviews-count-label");
    const reviewsStatus = document.getElementById("reviews-status");

    const reviewsItemsList = document.getElementById("reviews-items-list");
    const reviewsEmptyState = document.getElementById("reviews-empty-state");
    const reviewItemTemplate = document.getElementById("review-item-template");

    let reviews = [];

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
       HELPERS
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

    function buildReviewUrl(reviewId) {
        return `${REVIEW_API_BASE.replace(/\/$/, "")}/${reviewId}/`;
    }

    function buildBookUrl(bookId) {
        if (!bookId) return "/ketabook/";
        return `/ketabook/books/${bookId}/`;
    }

    function showStatus(message, type = "success") {
        if (!reviewsStatus) return;

        reviewsStatus.hidden = false;
        reviewsStatus.textContent = message;
        reviewsStatus.className = `reviews-status is-${type}`;
    }

    function hideStatus() {
        if (!reviewsStatus) return;

        reviewsStatus.hidden = true;
        reviewsStatus.textContent = "";
        reviewsStatus.className = "reviews-status";
    }

    function normalizeReview(rawReview) {
        const rawBook = rawReview.book_data || rawReview.book_info || rawReview.book || {};

        const bookIsObject = rawBook && typeof rawBook === "object";

        const bookId =
            rawReview.book_id ||
            rawReview.book ||
            rawReview.book_pk ||
            (bookIsObject ? rawBook.id : null);

        const bookName =
            rawReview.book_name ||
            rawReview.book_title ||
            rawReview.book ||
            (bookIsObject ? rawBook.name || rawBook.title || rawBook.book : "") ||
            "کتاب بدون نام";

        const bookPhoto =
            rawReview.book_photo ||
            rawReview.book_image ||
            rawReview.photo ||
            rawReview.image ||
            (bookIsObject ? rawBook.photo || rawBook.book_photo || rawBook.image || rawBook.cover : "");

        return {
            id: rawReview.id,
            text: rawReview.text || rawReview.review || rawReview.comment || "",
            date: rawReview.created_at || rawReview.date || rawReview.last_update || "",
            bookId,
            bookName: typeof bookName === "object" ? "کتاب بدون نام" : bookName,
            bookPhoto,
            raw: rawReview,
        };
    }

    function normalizeReviews(data) {
        const list =
            data?.reviews ||
            data?.results ||
            data?.items ||
            data ||
            [];

        if (!Array.isArray(list)) return [];

        return list
            .map(normalizeReview)
            .filter(review => review.id);
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
                data?.text ||
                "request failed";

            throw new Error(message);
        }

        return data;
    }

    async function loadReviews() {
        try {
            hideStatus();

            if (reviewsCountLabel) {
                reviewsCountLabel.textContent = "در حال دریافت نظرهای شما...";
            }

            const data = await requestJson(MY_REVIEWS_API);

            reviews = normalizeReviews(data);

            renderReviews(reviews);

            if (reviewsCountLabel) {
                reviewsCountLabel.textContent = reviews.length
                    ? `${toPersianDigits(reviews.length)} نظر ثبت شده`
                    : "هنوز نظری ثبت نشده است";
            }
        } catch (error) {
            console.error("Reviews load failed:", error);

            reviews = [];
            renderReviews([]);

            showStatus("دریافت نظرهای شما انجام نشد.", "error");

            if (reviewsCountLabel) {
                reviewsCountLabel.textContent = "دریافت نظرها انجام نشد";
            }
        }
    }

    async function updateReview(reviewId, text) {
        return requestJson(buildReviewUrl(reviewId), {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text,
            }),
        });
    }

    async function deleteReview(reviewId) {
        return requestJson(buildReviewUrl(reviewId), {
            method: "DELETE",
        });
    }

    /* =====================================================
       RENDER
    ===================================================== */

    function renderReviews(list) {
        if (!reviewsItemsList || !reviewsEmptyState || !reviewItemTemplate) return;

        reviewsItemsList.innerHTML = "";

        if (!list.length) {
            reviewsEmptyState.hidden = false;
            return;
        }

        reviewsEmptyState.hidden = true;

        list.forEach((review) => {
            const clone = reviewItemTemplate.content.cloneNode(true);
            const item = clone.querySelector("[data-review-item]");

            const bookLink = clone.querySelector("[data-book-link]");
            const bookCover = clone.querySelector("[data-book-cover]");
            const bookCoverFallback = clone.querySelector("[data-book-cover-fallback]");
            const bookTitle = clone.querySelector("[data-book-title]");
            const reviewText = clone.querySelector("[data-review-text]");
            const reviewDate = clone.querySelector("[data-review-date]");

            const editButton = clone.querySelector("[data-edit-review]");
            const deleteButton = clone.querySelector("[data-delete-review]");
            const editForm = clone.querySelector("[data-review-edit-form]");
            const editTextarea = clone.querySelector("[data-review-edit-textarea]");
            const cancelEditButton = clone.querySelector("[data-cancel-edit]");

            item.dataset.reviewId = review.id;

            const bookUrl = buildBookUrl(review.bookId);

            bookLink.href = bookUrl;
            bookTitle.href = bookUrl;

            bookTitle.textContent = review.bookName;
            reviewText.textContent = review.text || "بدون متن";
            reviewDate.textContent = formatDate(review.date);

            if (review.bookPhoto) {
                bookCover.src = review.bookPhoto;
                bookCover.alt = review.bookName;
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

            editButton.addEventListener("click", () => {
                editTextarea.value = review.text || "";
                editForm.hidden = false;
                reviewText.hidden = true;
                editButton.disabled = true;
                editTextarea.focus();
            });

            cancelEditButton.addEventListener("click", () => {
                editForm.hidden = true;
                reviewText.hidden = false;
                editButton.disabled = false;
                editTextarea.value = review.text || "";
            });

            editForm.addEventListener("submit", async (event) => {
                event.preventDefault();

                const newText = String(editTextarea.value || "").trim();

                if (newText.length < 3) {
                    showStatus("متن نظر باید حداقل ۳ کاراکتر باشد.", "error");
                    return;
                }

                try {
                    editButton.disabled = true;
                    deleteButton.disabled = true;

                    await updateReview(review.id, newText);

                    review.text = newText;
                    reviewText.textContent = newText;

                    editForm.hidden = true;
                    reviewText.hidden = false;

                    showStatus("نظر شما با موفقیت ویرایش شد.", "success");
                } catch (error) {
                    console.error("Review update failed:", error);
                    showStatus("ویرایش نظر انجام نشد.", "error");
                } finally {
                    editButton.disabled = false;
                    deleteButton.disabled = false;
                }
            });

            deleteButton.addEventListener("click", async () => {
                const confirmed = window.confirm("آیا از حذف این نظر مطمئن هستید؟");

                if (!confirmed) return;

                try {
                    editButton.disabled = true;
                    deleteButton.disabled = true;

                    await deleteReview(review.id);

                    reviews = reviews.filter(item => String(item.id) !== String(review.id));
                    renderReviews(reviews);

                    if (reviewsCountLabel) {
                        reviewsCountLabel.textContent = reviews.length
                            ? `${toPersianDigits(reviews.length)} نظر ثبت شده`
                            : "هنوز نظری ثبت نشده است";
                    }

                    showStatus("نظر شما با موفقیت حذف شد.", "success");
                } catch (error) {
                    console.error("Review delete failed:", error);
                    showStatus("حذف نظر انجام نشد.", "error");

                    editButton.disabled = false;
                    deleteButton.disabled = false;
                }
            });

            reviewsItemsList.appendChild(clone);
        });
    }

    loadReviews();
})