document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("book-detail-page");

    if (!page) return;

    const BOOK_API_BASE = page.dataset.bookApiBase || "/catalog/api/books/";
    const AUTHOR_API_BASE = page.dataset.authorApiBase || "/catalog/api/authors/";
    const REVIEW_API = page.dataset.reviewApi || "/account/api/review/";
    const CART_ADD_API = page.dataset.cartAddApi || "/cart/api/carts/add-item/";
    const ONLINE_BOOKS_API = page.dataset.onlineBooksApi || "/catalog/api/online-books/";
    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";
    const CART_URL = page.dataset.cartUrl || "/cart/";
    const TRANSLATOR_DETAIL_BASE = page.dataset.translatorDetailBase || "/ketabook/translators/";
    const TRANSLATOR_DETAIL_FALLBACK = page.dataset.translatorDetailFallback || "/ketabook/translators/translator-detail/";

    const breadcrumbTitle = document.getElementById("book-breadcrumb-title");

    const cover = document.getElementById("book-cover");
    const coverFallback = document.getElementById("book-cover-fallback");
    const discountBadge = document.getElementById("book-discount-badge");

    const topGenre = document.getElementById("book-top-genre");
    const title = document.getElementById("book-title");
    const description = document.getElementById("book-description");

    const authorCard = document.getElementById("book-author-card");
    const authorName = document.getElementById("book-author-name");
    const authorImage = document.getElementById("book-author-image");
    const authorFallback = document.getElementById("book-author-fallback");

    const publisherCard = document.getElementById("book-publisher-card");
    const publisherName = document.getElementById("book-publisher-name");
    const publisherImage = document.getElementById("book-publisher-image");
    const publisherFallback = document.getElementById("book-publisher-fallback");

    const translatorCard = document.getElementById("book-translator-card");
    const translatorName = document.getElementById("book-translator-name");
    const translatorImage = document.getElementById("book-translator-image");
    const translatorFallback = document.getElementById("book-translator-fallback");

    const language = document.getElementById("book-language");
    const level = document.getElementById("book-level");
    const genre = document.getElementById("book-genre");

    const buyBox = document.getElementById("book-buy-box");
    const versionSwitch = document.getElementById("book-version-switch");
    const versionPhysicalButton = document.getElementById("book-version-physical");
    const versionOnlineButton = document.getElementById("book-version-online");
    const versionNote = document.getElementById("book-version-note");

    const price = document.getElementById("book-price");
    const oldPrice = document.getElementById("book-old-price");

    const addCartButton = document.getElementById("book-add-cart-button");
    const cartLink = document.getElementById("book-cart-link");

    const onlineBox = document.getElementById("book-online-box");
    const onlineTitle = document.getElementById("book-online-title");
    const onlineFormat = document.getElementById("book-online-format");
    const onlinePremiumButton = document.getElementById("book-online-premium-button");
    const onlineReadButton = document.getElementById("book-online-read-button");
    const onlineMessage = document.getElementById("book-online-message");

    const reviewSummaryText = document.getElementById("book-review-summary-text");
    const statusMessage = document.getElementById("book-status-message");

    const commentsSection = document.getElementById("book-comments-section");
    const commentsSubtitle = document.getElementById("book-comments-subtitle");
    const addReviewButtons = document.querySelectorAll("[data-add-review-button]");
    const reviewForm = document.getElementById("book-review-form");
    const reviewText = document.getElementById("book-review-text");
    const reviewSubmit = document.getElementById("book-review-submit");
    const reviewCancel = document.getElementById("book-review-cancel");
    const reviewFormStatus = document.getElementById("book-review-form-status");
    const reviewsList = document.getElementById("book-reviews-list");
    const reviewsEmpty = document.getElementById("book-reviews-empty");

    let currentBook = null;
    let currentOnlineBook = null;
    let selectedBookVersion = "physical";

    const LANGUAGE_LABELS = {
        farsi: "فارسی",
        persian: "فارسی",
        fa: "فارسی",
        english: "انگلیسی",
        en: "انگلیسی",
        spanish: "اسپانیایی",
        french: "فرانسوی",
        arabic: "عربی",
        german: "آلمانی",
        italian: "ایتالیایی",
        turkish: "ترکی",
    };

    const LEVEL_LABELS = {
        kid: "کودک",
        kids: "کودک",
        child: "کودک",
        children: "کودک",
        middle_grade: "میان‌رده",
        teen: "نوجوان",
        teenager: "نوجوان",
        young_adult: "جوان",
        adult: "بزرگسال",
    };

    const GENRE_LABELS = {
        adventure: "ماجراجویی",
        fantasy: "فانتزی",
        science: "علمی",
        mystery: "معمایی",
        romance: "عاشقانه",
        horror: "ترسناک",
        comedy: "کمدی",
        historical: "تاریخی",
        biography: "زندگی‌نامه",
        self_help: "خودیاری",
        educational: "آموزشی",
        business: "کسب و کار",
        religion: "مذهبی",

        Adventure: "ماجراجویی",
        Fantasy: "فانتزی",
        Science: "علمی",
        Mystery: "معمایی",
        Romance: "عاشقانه",
        Horror: "ترسناک",
        Comedy: "کمدی",
        Historical: "تاریخی",
        Biography: "زندگی‌نامه",
        "Self Help": "خودیاری",
        Educational: "آموزشی",
        Business: "کسب و کار",
        Religion: "مذهبی",
    };

    function getBookIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const queryBook = params.get("book");

        if (queryBook) return queryBook;

        const parts = window.location.pathname.split("/").filter(Boolean);
        const booksIndex = parts.indexOf("books");

        if (booksIndex >= 0 && parts[booksIndex + 1]) {
            return parts[booksIndex + 1];
        }

        return "";
    }

    function getOnlineBookIdFromUrl() {
        const params = new URLSearchParams(window.location.search);

        return params.get("online_book") || "";
    }

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
            Accept: "application/json",
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

    function numberValue(value) {
        const number = Number(String(value ?? "").replace(/[^\d.]/g, ""));

        return Number.isFinite(number) ? number : 0;
    }

    function hasValue(value) {
        return value !== undefined && value !== null && String(value).trim() !== "";
    }

    function firstNonEmpty(...values) {
        return values.find(value => hasValue(value)) || "";
    }

    function objectOrNull(value) {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            return value;
        }

        return null;
    }

    function arrayOrEmpty(value) {
        return Array.isArray(value) ? value : [];
    }

    function toPersianDigits(value) {
        return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("fa-IR")} تومان`;
    }

    function firstLetter(value) {
        const clean = String(value || "").trim();

        return clean ? clean[0] : "ن";
    }

    function normalizeChoice(value) {
        return String(value || "")
            .trim()
            .replace(/_/g, " ")
            .replace(/\s+/g, " ");
    }

    function choiceKey(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");
    }

    function translateLanguage(value) {
        const key = choiceKey(value);

        return LANGUAGE_LABELS[key] || normalizeChoice(value) || "---";
    }

    function translateLevel(value) {
        if (Array.isArray(value)) {
            const labels = value
                .map(item => {
                    if (typeof item === "string") return translateLevel(item);

                    if (typeof item === "object" && item !== null) {
                        return firstNonEmpty(
                            item.label,
                            item.display,
                            item.name,
                            item.value,
                            ""
                        );
                    }

                    return "";
                })
                .filter(Boolean);

            return labels.length ? labels.join("، ") : "---";
        }

        const key = choiceKey(value);

        return LEVEL_LABELS[key] || normalizeChoice(value) || "---";
    }

    function translateGenre(value) {
        const raw = String(value || "").trim();
        const key = choiceKey(raw);

        return (
            GENRE_LABELS[raw] ||
            GENRE_LABELS[key] ||
            normalizeChoice(raw) ||
            "---"
        );
    }

    function showStatus(message, type = "success") {
        if (!statusMessage) return;

        statusMessage.hidden = false;
        statusMessage.textContent = message;
        statusMessage.className = `book-status-message is-${type}`;
    }

    function hideStatus() {
        if (!statusMessage) return;

        statusMessage.hidden = true;
        statusMessage.textContent = "";
        statusMessage.className = "book-status-message";
    }

    function showReviewStatus(message, type = "success") {
        if (!reviewFormStatus) return;

        reviewFormStatus.hidden = false;
        reviewFormStatus.textContent = message;
        reviewFormStatus.className = `book-review-form-status is-${type}`;
    }

    function hideReviewStatus() {
        if (!reviewFormStatus) return;

        reviewFormStatus.hidden = true;
        reviewFormStatus.textContent = "";
        reviewFormStatus.className = "book-review-form-status";
    }

    function formatDate(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "";

        return new Intl.DateTimeFormat("fa-IR", {
            year: "numeric",
            month: "long",
            day: "numeric",
        }).format(date);
    }

    function getBookTitle(book) {
        return firstNonEmpty(
            book?.book,
            book?.name,
            typeof book?.title === "string" ? book.title : "",
            book?.book_title?.name,
            book?.title_detail?.name,
            "نام کتاب"
        );
    }

    function getBookPhoto(book) {
        return firstNonEmpty(
            book?.book_photo,
            book?.photo,
            book?.image,
            book?.cover,
            book?.book_title?.photo,
            book?.book_title?.photo_url,
            book?.title_detail?.photo,
            book?.title_detail?.photo_url
        );
    }

    function getOriginalPrice(book) {
        return firstNonEmpty(
            book?.price,
            book?.original_price,
            book?.book_price,
            0
        );
    }

    function getDiscountedPrice(book) {
        return firstNonEmpty(
            book?.discounted_price,
            book?.final_price,
            book?.payable_price,
            book?.price,
            0
        );
    }

    function getDiscountPercent(book) {
        const directPercent = numberValue(firstNonEmpty(
            book?.discount_percent,
            book?.discountPercentage,
            ""
        ));

        if (directPercent > 0) {
            return Math.round(directPercent);
        }

        const original = numberValue(getOriginalPrice(book));
        const discounted = numberValue(getDiscountedPrice(book));

        if (!original || !discounted || discounted >= original) return 0;

        return Math.round(((original - discounted) / original) * 100);
    }

    function getGenres(book) {
        const genres = [];

        if (Array.isArray(book?.genres)) {
            genres.push(...book.genres);
        }

        if (Array.isArray(book?.book_title?.genres)) {
            genres.push(...book.book_title.genres);
        }

        if (Array.isArray(book?.title_detail?.genres)) {
            genres.push(...book.title_detail.genres);
        }

        return genres;
    }

    function getGenreRawValue(item) {
        if (typeof item === "string") return item;

        if (typeof item === "object" && item !== null) {
            return item.value || item.label || item.title || item.name || "";
        }

        return "";
    }

    function getGenreText(book) {
        const genres = getGenres(book)
            .map(getGenreRawValue)
            .filter(Boolean)
            .map(translateGenre);

        return genres.length ? genres.join("، ") : "---";
    }

    function getTopGenre(book) {
        const genres = getGenres(book)
            .map(getGenreRawValue)
            .filter(Boolean)
            .map(translateGenre);

        return genres.length ? genres[0] : "---";
    }

    function getAuthorData(book) {
        const authorDetail = objectOrNull(book?.author_detail);
        const authorObject = objectOrNull(book?.author);

        const authors = arrayOrEmpty(book?.authors);
        const firstAuthor = objectOrNull(authors[0]);

        return {
            id: firstNonEmpty(
                book?.author_id,
                authorDetail?.id,
                authorObject?.id,
                firstAuthor?.id
            ),
            name: firstNonEmpty(
                authorDetail?.name,
                authorObject?.name,
                firstAuthor?.name,
                book?.author_name,
                typeof book?.author === "string" ? book.author : "",
                typeof authors[0] === "string" ? authors[0] : "",
                "نویسنده نامشخص"
            ),
            picture: firstNonEmpty(
                authorDetail?.picture,
                authorDetail?.photo,
                authorObject?.picture,
                authorObject?.photo,
                firstAuthor?.picture,
                firstAuthor?.photo,
                book?.author_photo
            ),
        };
    }

    function getPublisherData(book) {
        const publisher = book?.publisher || book?.publishers || null;
        const publisherDetail = objectOrNull(book?.publisher_detail);

        if (publisherDetail) {
            return {
                id: firstNonEmpty(
                    publisherDetail.id,
                    publisherDetail.publisher_id,
                    book?.publisher_id,
                    book?.publishers_id
                ),
                name: firstNonEmpty(
                    publisherDetail.publisher,
                    publisherDetail.name,
                    "ناشر نامشخص"
                ),
                picture: firstNonEmpty(
                    publisherDetail.picture,
                    publisherDetail.picture_url,
                    publisherDetail.photo,
                    publisherDetail.image
                ),
            };
        }

        if (!publisher) return null;

        if (typeof publisher === "string") {
            return {
                id: firstNonEmpty(book?.publisher_id, book?.publishers_id),
                name: publisher,
                picture: "",
            };
        }

        if (Array.isArray(publisher)) {
            const firstPublisher = publisher[0];

            if (typeof firstPublisher === "string") {
                return {
                    id: "",
                    name: firstPublisher,
                    picture: "",
                };
            }

            if (typeof firstPublisher === "object" && firstPublisher !== null) {
                return {
                    id: firstNonEmpty(
                        firstPublisher.id,
                        firstPublisher.publisher_id,
                        book?.publisher_id,
                        book?.publishers_id
                    ),
                    name: firstNonEmpty(
                        firstPublisher.publisher,
                        firstPublisher.name,
                        "ناشر نامشخص"
                    ),
                    picture: firstNonEmpty(
                        firstPublisher.picture,
                        firstPublisher.picture_url,
                        firstPublisher.photo,
                        firstPublisher.image
                    ),
                };
            }
        }

        return {
            id: firstNonEmpty(
                publisher.id,
                publisher.publisher_id,
                book?.publisher_id,
                book?.publishers_id
            ),
            name: firstNonEmpty(
                publisher.publisher,
                publisher.name,
                "ناشر نامشخص"
            ),
            picture: firstNonEmpty(
                publisher.picture,
                publisher.picture_url,
                publisher.photo,
                publisher.image
            ),
        };
    }

    function normalizeTranslatorItem(item) {
        if (!item) return null;

        if (typeof item === "string") {
            return {
                id: "",
                name: item,
                picture: "",
                translate_to: "",
                translate_to_display: "",
            };
        }

        if (typeof item !== "object") return null;

        return {
            id: firstNonEmpty(
                item.id,
                item.pk,
                item.translator_id,
                item.translatorId,
                ""
            ),
            name: firstNonEmpty(
                item.name,
                item.translator,
                item.fullname,
                ""
            ),
            picture: firstNonEmpty(
                item.picture,
                item.picture_url,
                item.photo,
                item.photo_url,
                item.image,
                ""
            ),
            translate_to: firstNonEmpty(
                item.translate_to,
                item.language,
                ""
            ),
            translate_to_display: firstNonEmpty(
                item.translate_to_display,
                item.language_display,
                item.translate_to,
                item.language,
                ""
            ),
        };
    }

    function getTranslatorData(book) {
        const candidates = [];

        if (Array.isArray(book?.translators)) {
            candidates.push(...book.translators);
        }

        if (Array.isArray(book?.translator)) {
            candidates.push(...book.translator);
        }

        if (Array.isArray(book?.translator_detail)) {
            candidates.push(...book.translator_detail);
        }

        if (Array.isArray(book?.book_title?.translators)) {
            candidates.push(...book.book_title.translators);
        }

        if (Array.isArray(book?.book_title?.translator)) {
            candidates.push(...book.book_title.translator);
        }

        if (Array.isArray(book?.title_detail?.translators)) {
            candidates.push(...book.title_detail.translators);
        }

        if (Array.isArray(book?.title_detail?.translator)) {
            candidates.push(...book.title_detail.translator);
        }

        const translatorObject = objectOrNull(book?.translator);
        const translatorDetail = objectOrNull(book?.translator_detail);

        if (translatorObject) {
            candidates.push(translatorObject);
        }

        if (translatorDetail) {
            candidates.push(translatorDetail);
        }

        if (book?.translator_name) {
            candidates.push(book.translator_name);
        }

        const translators = candidates
            .map(normalizeTranslatorItem)
            .filter(item => item && item.name);

        if (!translators.length) {
            return null;
        }

        const firstTranslator = translators[0];

        return {
            id: firstTranslator.id,
            name: translators.map(item => item.name).join("، "),
            picture: firstTranslator.picture,
            count: translators.length,
            items: translators,
            translate_to_display: firstTranslator.translate_to_display,
        };
    }

    function getTranslatorDetailUrl(translator) {
        if (!translator) {
            return TRANSLATOR_DETAIL_FALLBACK;
        }

        if (translator.id) {
            return `${TRANSLATOR_DETAIL_BASE}${translator.id}/translator-detail/`;
        }

        return TRANSLATOR_DETAIL_FALLBACK;
    }

    function getBookLevelText(book) {
        if (Array.isArray(book?.levels)) {
            return translateLevel(book.levels);
        }

        if (Array.isArray(book?.book_title?.levels)) {
            return translateLevel(book.book_title.levels);
        }

        if (Array.isArray(book?.title_detail?.levels)) {
            return translateLevel(book.title_detail.levels);
        }

        return translateLevel(firstNonEmpty(
            book?.level_display,
            book?.level,
            book?.book_level_display,
            book?.book_level,
            ""
        ));
    }

    function getBookLanguageText(book) {
        return firstNonEmpty(
            book?.language_display,
            book?.book_language_display,
            translateLanguage(book?.language),
            translateLanguage(book?.book_language),
            "---"
        );
    }

    function getOnlineBooksFromResponse(data) {
        const candidates = [
            data?.online_books,
            data?.results,
            data?.items,
            data?.books,
            data?.data,
            data,
        ];

        for (const item of candidates) {
            if (Array.isArray(item)) return item;
        }

        return [];
    }

    function getOnlineBookId(onlineBook) {
        return firstNonEmpty(
            onlineBook?.id,
            onlineBook?.online_book_id,
            onlineBook?.pk
        );
    }

    function getOnlineBookBookId(onlineBook) {
        const bookObject = objectOrNull(onlineBook?.book);

        if (typeof onlineBook?.book === "number" || typeof onlineBook?.book === "string") {
            return onlineBook.book;
        }

        return firstNonEmpty(
            onlineBook?.book_id,
            onlineBook?.bookId,
            bookObject?.id,
            bookObject?.pk,
            currentBook?.id,
            currentBook?.book_id
        );
    }

    function getOnlineBookPrice(onlineBook) {
        return firstNonEmpty(
            onlineBook?.final_price,
            onlineBook?.price,
            onlineBook?.online_price,
            ""
        );
    }

    function normalizeOnlineBook(onlineBook) {
        if (!onlineBook) return null;

        const nestedBook = objectOrNull(onlineBook.book);

        const id = getOnlineBookId(onlineBook);
        const bookId = getOnlineBookBookId(onlineBook);

        return {
            ...onlineBook,

            id,
            online_book_id: id,
            book_id: bookId,

            name: firstNonEmpty(
                onlineBook.name,
                onlineBook.online_book_name,
                typeof onlineBook.title === "string" ? onlineBook.title : "",
                nestedBook?.name,
                nestedBook?.title,
                currentBook ? getBookTitle(currentBook) : "",
                "کتاب آنلاین"
            ),

            price: firstNonEmpty(
                onlineBook.price,
                onlineBook.final_price,
                ""
            ),

            final_price: firstNonEmpty(
                onlineBook.final_price,
                onlineBook.price,
                ""
            ),

            format: firstNonEmpty(
                onlineBook.format,
                "pdf"
            ),

            format_display: firstNonEmpty(
                onlineBook.format_display,
                onlineBook.format,
                "PDF"
            ),

            access_type: firstNonEmpty(
                onlineBook.access_type,
                ""
            ),

            access_type_display: firstNonEmpty(
                onlineBook.access_type_display,
                onlineBook.access_type,
                ""
            ),

            detail_url: bookId
                ? `/ketabook/books/${bookId}/?online_book=${id}`
                : `/ketabook/online-books/${id}/`,

            reader_url: firstNonEmpty(
                onlineBook.reader_url,
                `/ketabook/online-books/${id}/reader/`
            ),

            cart_payload: onlineBook.cart_payload || {
                online_book: id,
                online_book_id: id,
                quantity: 1,
            },
        };
    }

    function getOnlineVersionsFromBook(book) {
        const versions = Array.isArray(book?.online_versions)
            ? book.online_versions
            : [];

        return versions
            .map(normalizeOnlineBook)
            .filter(Boolean);
    }

    function chooseOnlineBook(onlineBooks) {
        const safeOnlineBooks = onlineBooks
            .map(normalizeOnlineBook)
            .filter(Boolean);

        if (!safeOnlineBooks.length) {
            return null;
        }

        const requestedOnlineBookId = getOnlineBookIdFromUrl();

        if (requestedOnlineBookId) {
            const matched = safeOnlineBooks.find(item => {
                return String(getOnlineBookId(item)) === String(requestedOnlineBookId);
            });

            if (matched) return matched;
        }

        return safeOnlineBooks[0];
    }

    async function fetchBook(bookId) {
        const response = await fetch(`${BOOK_API_BASE}${bookId}/`, {
            method: "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            throw new Error("book request failed");
        }

        return response.json();
    }

    async function fetchAuthor(authorId) {
        if (!authorId) return null;

        try {
            const response = await fetch(`${AUTHOR_API_BASE}${authorId}/`, {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) return null;

            return response.json();
        } catch (error) {
            console.warn("Author picture load failed:", error);
            return null;
        }
    }

    async function fetchOnlineBookForBook(bookId) {
        try {
            const response = await fetch(`${ONLINE_BOOKS_API}?book=${bookId}`, {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) return null;

            const data = await response.json();
            const onlineBooks = getOnlineBooksFromResponse(data);

            return chooseOnlineBook(onlineBooks);
        } catch (error) {
            console.warn("Online book load failed:", error);
            return null;
        }
    }

    function renderCover(book) {
        const bookTitle = getBookTitle(book);
        const bookPhoto = getBookPhoto(book);

        if (cover && coverFallback) {
            if (bookPhoto) {
                cover.src = bookPhoto;
                cover.alt = bookTitle;
                cover.hidden = false;
                coverFallback.hidden = true;
            } else {
                cover.removeAttribute("src");
                cover.alt = "";
                cover.hidden = true;
                coverFallback.hidden = false;
            }
        }

        const percent = getDiscountPercent(book);

        if (discountBadge) {
            if (percent) {
                discountBadge.hidden = false;
                discountBadge.textContent = `٪${toPersianDigits(percent)}`;
            } else {
                discountBadge.hidden = true;
            }
        }
    }

    function renderAuthorData(author) {
        if (!author) return;

        if (authorName) {
            authorName.textContent = author.name;
        }

        if (authorFallback) {
            authorFallback.textContent = firstLetter(author.name);
        }

        if (authorImage && authorFallback) {
            if (author.picture) {
                authorImage.src = author.picture;
                authorImage.alt = author.name;
                authorImage.hidden = false;
                authorFallback.hidden = true;
            } else {
                authorImage.removeAttribute("src");
                authorImage.alt = "";
                authorImage.hidden = true;
                authorFallback.hidden = false;
            }
        }

        if (authorCard) {
            authorCard.href = author.id ? `/ketabook/authors/${author.id}/` : "#";
        }
    }

    async function renderAuthor(book) {
        const baseAuthor = getAuthorData(book);

        renderAuthorData(baseAuthor);

        if (!baseAuthor.picture && baseAuthor.id) {
            const authorFromApi = await fetchAuthor(baseAuthor.id);

            if (authorFromApi) {
                renderAuthorData({
                    id: authorFromApi.id || baseAuthor.id,
                    name: authorFromApi.name || baseAuthor.name,
                    picture: (
                        authorFromApi.picture ||
                        authorFromApi.photo ||
                        authorFromApi.image ||
                        baseAuthor.picture
                    ),
                });
            }
        }
    }

    function renderPublisher(book) {
        const publisher = getPublisherData(book);

        if (!publisher || !publisher.name) {
            if (publisherCard) {
                publisherCard.hidden = true;
            }

            return;
        }

        if (publisherCard) {
            publisherCard.hidden = false;
            publisherCard.href = publisher.id ? `/ketabook/publishers/${publisher.id}/` : "#";
        }

        if (publisherName) {
            publisherName.textContent = publisher.name;
        }

        if (publisherFallback) {
            publisherFallback.textContent = firstLetter(publisher.name);
        }

        if (publisherImage && publisherFallback) {
            if (publisher.picture) {
                publisherImage.src = publisher.picture;
                publisherImage.alt = publisher.name;
                publisherImage.hidden = false;
                publisherFallback.hidden = true;
            } else {
                publisherImage.removeAttribute("src");
                publisherImage.alt = "";
                publisherImage.hidden = true;
                publisherFallback.hidden = false;
            }
        }
    }

    function renderTranslators(book) {
        const translator = getTranslatorData(book);

        if (!translator || !translator.name) {
            if (translatorCard) {
                translatorCard.hidden = true;
            }

            return;
        }

        if (translatorCard) {
            translatorCard.hidden = false;
            translatorCard.href = getTranslatorDetailUrl(translator);
            translatorCard.title = "مشاهده مترجمان";
            translatorCard.setAttribute("aria-label", "مشاهده مترجمان");
        }

        if (translatorName) {
            translatorName.textContent = translator.name;
        }

        if (translatorFallback) {
            translatorFallback.textContent = firstLetter(translator.name) || "م";
        }

        if (translatorImage && translatorFallback) {
            if (translator.picture) {
                translatorImage.src = translator.picture;
                translatorImage.alt = translator.name;
                translatorImage.hidden = false;
                translatorFallback.hidden = true;
            } else {
                translatorImage.removeAttribute("src");
                translatorImage.alt = "";
                translatorImage.hidden = true;
                translatorFallback.hidden = false;
            }
        }
    }

    function renderPhysicalPrice() {
        const original = numberValue(getOriginalPrice(currentBook));
        const discounted = numberValue(getDiscountedPrice(currentBook));
        const hasDiscount = discounted && original && discounted < original;

        if (price) {
            price.textContent = formatMoney(hasDiscount ? discounted : original);
        }

        if (oldPrice) {
            if (hasDiscount) {
                oldPrice.hidden = false;
                oldPrice.textContent = formatMoney(original);
            } else {
                oldPrice.hidden = true;
            }
        }
    }

    function renderOnlinePrice() {
        const onlinePrice = getOnlineBookPrice(currentOnlineBook);

        if (oldPrice) {
            oldPrice.hidden = true;
        }

        if (!price) return;

        if (!hasValue(onlinePrice)) {
            price.textContent = "قیمت ثبت نشده";
            return;
        }

        price.textContent = formatMoney(onlinePrice);
    }

    function hasActiveOnlineAccess(onlineBook) {
        const userAccess = onlineBook?.user_access || {};

        return Boolean(userAccess.is_access_active);
    }

    function canOnlineBookBeBought(onlineBook) {
        return Boolean(onlineBook);
    }

    function canOnlineBookUsePremium(onlineBook) {
        if (!onlineBook) return false;

        if (onlineBook.user_access?.can_access_with_premium) return true;
        if (onlineBook.allows_premium_access) return true;

        const accessType = String(onlineBook.access_type || "").toLowerCase();

        return (
            accessType.includes("premium") ||
            accessType.includes("subscription") ||
            accessType.includes("vip") ||
            accessType.includes("both") ||
            accessType.includes("all") ||
            accessType.includes("free")
        );
    }

    function hasPhysicalVersion() {
        if (!currentBook) return false;

        if (currentBook.has_physical_version === false) return false;
        if (currentBook.is_physical === false) return false;
        if (currentBook.physical_available === false) return false;
        if (currentBook.has_physical === false) return false;

        if (currentBook.has_physical_version === true) return true;
        if (currentBook.is_physical === true) return true;
        if (currentBook.physical_available === true) return true;
        if (currentBook.has_physical === true) return true;

        const originalPrice = numberValue(getOriginalPrice(currentBook));
        const discountedPrice = numberValue(getDiscountedPrice(currentBook));

        return Boolean(originalPrice || discountedPrice);
    }

    function updateBuyBoxState() {
        const hasOnlineBook = Boolean(currentOnlineBook);
        const hasPhysicalBook = hasPhysicalVersion();

        if (selectedBookVersion === "online" && !hasOnlineBook) {
            selectedBookVersion = "physical";
        }

        if (selectedBookVersion === "physical" && !hasPhysicalBook && hasOnlineBook) {
            selectedBookVersion = "online";
        }

        if (buyBox) {
            buyBox.classList.toggle("is-physical", selectedBookVersion === "physical");
            buyBox.classList.toggle("is-online", selectedBookVersion === "online");
        }

        if (versionSwitch) {
            versionSwitch.hidden = false;
            versionSwitch.classList.toggle("is-physical", selectedBookVersion === "physical");
            versionSwitch.classList.toggle("is-online", selectedBookVersion === "online");
        }

        if (versionPhysicalButton) {
            versionPhysicalButton.disabled = !hasPhysicalBook;
            versionPhysicalButton.classList.toggle("is-active", selectedBookVersion === "physical");
            versionPhysicalButton.setAttribute(
                "aria-selected",
                selectedBookVersion === "physical" ? "true" : "false"
            );
            versionPhysicalButton.setAttribute(
                "aria-disabled",
                hasPhysicalBook ? "false" : "true"
            );
        }

        if (versionOnlineButton) {
            versionOnlineButton.disabled = !hasOnlineBook;
            versionOnlineButton.classList.toggle("is-active", selectedBookVersion === "online");
            versionOnlineButton.setAttribute(
                "aria-selected",
                selectedBookVersion === "online" ? "true" : "false"
            );
            versionOnlineButton.setAttribute(
                "aria-disabled",
                hasOnlineBook ? "false" : "true"
            );
        }

        if (versionNote) {
            versionNote.textContent = selectedBookVersion === "online"
                ? "قیمت نسخه آنلاین"
                : "قیمت نسخه چاپی";
        }

        if (selectedBookVersion === "online") {
            renderOnlinePrice();
        } else {
            renderPhysicalPrice();
        }

        if (!addCartButton) return;

        if (selectedBookVersion === "physical") {
            if (!hasPhysicalBook) {
                addCartButton.disabled = true;
                addCartButton.textContent = "نسخه چاپی موجود نیست";
                return;
            }

            addCartButton.disabled = false;
            addCartButton.textContent = "افزودن به سبد خرید";
            return;
        }

        if (!currentOnlineBook) {
            addCartButton.disabled = true;
            addCartButton.textContent = "نسخه آنلاین موجود نیست";
            return;
        }

        if (hasActiveOnlineAccess(currentOnlineBook)) {
            addCartButton.disabled = true;
            addCartButton.textContent = "در کتاب‌های من موجود است";
            return;
        }

        addCartButton.disabled = false;
        addCartButton.textContent = "افزودن به سبد خرید";
    }

    function switchBookVersion(version) {
        const hasOnlineBook = Boolean(currentOnlineBook);
        const hasPhysicalBook = hasPhysicalVersion();

        if (version === "online" && !hasOnlineBook) {
            showStatus("نسخه آنلاین برای این کتاب ثبت نشده است.", "error");
            return;
        }

        if (version === "physical" && !hasPhysicalBook) {
            showStatus("نسخه چاپی برای این کتاب موجود نیست.", "error");
            return;
        }

        selectedBookVersion = version === "online" ? "online" : "physical";

        hideStatus();
        updateBuyBoxState();
    }

    function renderReviewSummary(reviews) {
        const safeReviews = Array.isArray(reviews) ? reviews : [];
        const count = safeReviews.length;

        if (reviewSummaryText) {
            reviewSummaryText.textContent = count
                ? `${toPersianDigits(count)} نظر ثبت شده`
                : "بدون نظر";
        }

        if (commentsSubtitle) {
            commentsSubtitle.textContent = count
                ? `${toPersianDigits(count)} نظر برای این کتاب ثبت شده است.`
                : "هنوز نظری برای این کتاب ثبت نشده است.";
        }
    }

    function getReviewName(review) {
        const username =
            review.username ||
            review.user?.username ||
            review.display_name ||
            "";

        if (username && String(username).trim()) {
            return String(username).trim();
        }

        return "کاربر کتابوک";
    }

    function getReviewText(review) {
        return review.text || review.review || review.comment || "";
    }

    function getReviewPhoto(review) {
        return review.profile_pic || review.profile_photo || review.user_photo || "";
    }

    function renderReviews(reviews) {
        const safeReviews = Array.isArray(reviews) ? reviews : [];

        if (!reviewsList || !reviewsEmpty) return;

        reviewsList.innerHTML = "";

        if (!safeReviews.length) {
            reviewsEmpty.hidden = false;
            return;
        }

        reviewsEmpty.hidden = true;

        safeReviews.forEach(review => {
            const card = document.createElement("article");
            card.className = "book-review-card";

            const avatar = document.createElement("div");
            avatar.className = "book-review-avatar";

            const photo = getReviewPhoto(review);
            const name = getReviewName(review);

            if (photo) {
                const img = document.createElement("img");
                img.src = photo;
                img.alt = name;
                avatar.appendChild(img);
            } else {
                const fallback = document.createElement("span");
                fallback.textContent = firstLetter(name);
                avatar.appendChild(fallback);
            }

            const content = document.createElement("div");
            content.className = "book-review-content";

            const head = document.createElement("div");
            head.className = "book-review-head";

            const nameEl = document.createElement("strong");
            nameEl.textContent = name;

            const timeEl = document.createElement("time");
            timeEl.textContent = formatDate(review.created_at || review.last_update);

            head.appendChild(nameEl);
            head.appendChild(timeEl);

            const text = document.createElement("p");
            text.textContent = getReviewText(review);

            content.appendChild(head);
            content.appendChild(text);

            card.appendChild(avatar);
            card.appendChild(content);

            reviewsList.appendChild(card);
        });
    }

    function renderOnlineBookAccess(onlineBook) {
        currentOnlineBook = normalizeOnlineBook(onlineBook);

        if (!onlineBox) {
            updateBuyBoxState();
            return;
        }

        if (!currentOnlineBook) {
            onlineBox.hidden = true;
            updateBuyBoxState();
            return;
        }

        onlineBox.hidden = false;

        const userAccess = currentOnlineBook.user_access || {};
        const hasActiveAccess = hasActiveOnlineAccess(currentOnlineBook);

        if (onlineTitle) {
            onlineTitle.textContent = currentOnlineBook.name || currentOnlineBook.online_book_name || "کتاب آنلاین";
        }

        if (onlineFormat) {
            onlineFormat.textContent = currentOnlineBook.format_display || currentOnlineBook.format || "PDF";
        }

        if (onlinePremiumButton) {
            onlinePremiumButton.hidden = hasActiveAccess || !canOnlineBookUsePremium(currentOnlineBook);
        }

        if (onlineReadButton) {
            onlineReadButton.hidden = !hasActiveAccess;
        }

        if (onlineMessage) {
            if (hasActiveAccess) {
                onlineMessage.textContent = userAccess.access_message || "شما به نسخه آنلاین این کتاب دسترسی دارید.";
            } else if (canOnlineBookUsePremium(currentOnlineBook)) {
                onlineMessage.textContent = "می‌توانید نسخه آنلاین را به سبد خرید اضافه کنید یا با اشتراک ویژه مطالعه کنید.";
            } else {
                onlineMessage.textContent = "با افزودن نسخه آنلاین به سبد خرید، بعد از پرداخت این کتاب به بخش کتاب‌های من اضافه می‌شود.";
            }
        }

        updateBuyBoxState();
    }

    async function renderBook(book) {
        currentBook = book;

        const bookTitle = getBookTitle(book);
        const bookDescription = book.description || "توضیحاتی برای این کتاب ثبت نشده است.";

        document.title = `${bookTitle} | کتابوک`;

        if (breadcrumbTitle) breadcrumbTitle.textContent = bookTitle;
        if (topGenre) topGenre.textContent = getTopGenre(book);
        if (title) title.textContent = bookTitle;
        if (description) description.textContent = bookDescription;

        if (language) language.textContent = getBookLanguageText(book);
        if (level) level.textContent = getBookLevelText(book);
        if (genre) genre.textContent = getGenreText(book);

        if (cartLink) {
            cartLink.href = CART_URL;
        }

        renderCover(book);
        await renderAuthor(book);
        renderPublisher(book);
        renderTranslators(book);
        renderReviewSummary(book.reviews);
        renderReviews(book.reviews);
        updateBuyBoxState();
    }

    async function reloadCurrentBookReviews() {
        if (!currentBook) return;

        const bookId = currentBook.id || currentBook.book_id || getBookIdFromUrl();

        if (!bookId) return;

        const freshBook = await fetchBook(bookId);

        currentBook = {
            ...currentBook,
            reviews: freshBook.reviews || [],
        };

        renderReviewSummary(currentBook.reviews);
        renderReviews(currentBook.reviews);
    }

    function getSelectedCartPayload() {
        if (selectedBookVersion === "online") {
            if (!currentOnlineBook) return null;

            const onlineBookId = getOnlineBookId(currentOnlineBook);

            if (!onlineBookId) return null;

            return {
                online_book: onlineBookId,
                quantity: 1,
            };
        }

        const bookId = currentBook?.id || currentBook?.book_id || getBookIdFromUrl();

        if (!bookId) return null;

        return {
            book: bookId,
            quantity: 1,
        };
    }

    function getSelectedCartSuccessMessage() {
        if (selectedBookVersion === "online") {
            return "نسخه آنلاین به سبد خرید اضافه شد. بعد از پرداخت در کتاب‌های من قرار می‌گیرد.";
        }

        return "کتاب چاپی به سبد خرید اضافه شد.";
    }

    async function addSelectedVersionToCart() {
        if (!currentBook) return;

        const token = getAccessToken();

        if (!token) {
            sessionStorage.setItem("ketabook_toast", "برای افزودن کتاب به سبد خرید وارد حساب شوید");
            window.location.href = LOGIN_URL;
            return;
        }

        if (selectedBookVersion === "online") {
            if (!currentOnlineBook) {
                showStatus("نسخه آنلاین برای این کتاب پیدا نشد.", "error");
                return;
            }

            if (hasActiveOnlineAccess(currentOnlineBook)) {
                showStatus("این نسخه آنلاین از قبل در کتاب‌های من فعال است.", "success");
                return;
            }
        }

        if (selectedBookVersion === "physical" && !hasPhysicalVersion()) {
            showStatus("نسخه چاپی برای این کتاب موجود نیست.", "error");
            return;
        }

        const payload = getSelectedCartPayload();

        if (!payload) {
            showStatus("شناسه نسخه انتخاب‌شده پیدا نشد.", "error");
            return;
        }

        try {
            hideStatus();

            if (addCartButton) {
                addCartButton.disabled = true;
                addCartButton.textContent = "در حال افزودن...";
            }

            const response = await fetch(CART_ADD_API, {
                method: "POST",
                credentials: "same-origin",
                headers: authHeaders({
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));

            if (response.status === 401 || response.status === 403) {
                clearAuthState();
                sessionStorage.setItem("ketabook_toast", "برای افزودن کتاب به سبد خرید وارد حساب شوید");
                window.location.href = LOGIN_URL;
                return;
            }

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    data.detail ||
                    data.message ||
                    "افزودن کتاب به سبد انجام نشد."
                );
            }

            const count =
                data?.cart?.total_items ||
                data?.total_items ||
                localStorage.getItem("ketabook_cart_count") ||
                "";

            if (count !== "") {
                localStorage.setItem("ketabook_cart_count", String(count));
            }

            if (window.ketabookAuth?.refreshNavbar) {
                window.ketabookAuth.refreshNavbar();
            }

            showStatus(getSelectedCartSuccessMessage(), "success");
        } catch (error) {
            console.error("Add to cart failed:", error);
            showStatus(error.message || "افزودن کتاب به سبد انجام نشد.", "error");
        } finally {
            updateBuyBoxState();
        }
    }

    function openPremiumReader() {
        if (!currentOnlineBook) {
            showStatus("نسخه آنلاین برای این کتاب پیدا نشد.", "error");
            return;
        }

        const token = getAccessToken();

        if (!token) {
            sessionStorage.setItem("ketabook_toast", "برای مطالعه آنلاین وارد حساب شوید");
            window.location.href = LOGIN_URL;
            return;
        }

        const onlineBookId = getOnlineBookId(currentOnlineBook);

        if (!onlineBookId) {
            showStatus("شناسه نسخه آنلاین پیدا نشد.", "error");
            return;
        }

        window.location.href = `/ketabook/online-books/${onlineBookId}/reader/`;
    }

    function openOwnedOnlineBookReader() {
        if (!currentOnlineBook) {
            showStatus("نسخه آنلاین برای این کتاب پیدا نشد.", "error");
            return;
        }

        const token = getAccessToken();

        if (!token) {
            sessionStorage.setItem("ketabook_toast", "برای مطالعه آنلاین وارد حساب شوید");
            window.location.href = LOGIN_URL;
            return;
        }

        const readerUrl = currentOnlineBook.reader_url || (
            getOnlineBookId(currentOnlineBook)
                ? `/ketabook/online-books/${getOnlineBookId(currentOnlineBook)}/reader/`
                : ""
        );

        if (!readerUrl) {
            showStatus("لینک مطالعه آنلاین پیدا نشد.", "error");
            return;
        }

        window.location.href = readerUrl;
    }

    function openReviewForm() {
        const token = getAccessToken();

        if (!token) {
            sessionStorage.setItem("ketabook_toast", "برای ثبت نظر وارد حساب شوید");
            window.location.href = LOGIN_URL;
            return;
        }

        if (reviewForm) {
            reviewForm.hidden = false;
        }

        if (commentsSection) {
            commentsSection.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }

        setTimeout(() => {
            if (reviewText) {
                reviewText.focus();
            }
        }, 320);

        hideReviewStatus();
    }

    function closeReviewForm() {
        if (reviewForm) {
            reviewForm.hidden = true;
        }

        if (reviewText) {
            reviewText.value = "";
        }

        hideReviewStatus();
    }

    async function postReviewPayload(payload) {
        const response = await fetch(REVIEW_API, {
            method: "POST",
            credentials: "same-origin",
            headers: authHeaders({
                "Content-Type": "application/json",
            }),
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 401 || response.status === 403) {
            clearAuthState();
            sessionStorage.setItem("ketabook_toast", "برای ثبت نظر وارد حساب شوید");
            window.location.href = LOGIN_URL;

            return {
                ok: false,
                redirected: true,
                data,
            };
        }

        return {
            ok: response.ok,
            status: response.status,
            data,
        };
    }

    function getReviewErrorMessage(data) {
        if (!data) return "ثبت نظر انجام نشد.";

        if (data.message) return data.message;

        if (typeof data.error === "string") return data.error;
        if (typeof data.detail === "string") return data.detail;

        if (data.username) {
            if (Array.isArray(data.username)) return data.username[0];
            return String(data.username);
        }

        if (data.text) {
            if (Array.isArray(data.text)) return data.text[0];
            return String(data.text);
        }

        if (data.book) {
            if (Array.isArray(data.book)) return data.book[0];
            return String(data.book);
        }

        return "ثبت نظر انجام نشد.";
    }

    async function submitReview(event) {
        event.preventDefault();

        if (!currentBook) return;

        const token = getAccessToken();

        if (!token) {
            sessionStorage.setItem("ketabook_toast", "برای ثبت نظر وارد حساب شوید");
            window.location.href = LOGIN_URL;
            return;
        }

        const bookId = currentBook.id || currentBook.book_id || getBookIdFromUrl();
        const text = String(reviewText?.value || "").trim();

        if (!bookId) {
            showReviewStatus("شناسه کتاب پیدا نشد.", "error");
            return;
        }

        if (!text) {
            showReviewStatus("متن نظر را وارد کنید.", "error");
            return;
        }

        try {
            if (reviewSubmit) {
                reviewSubmit.disabled = true;
                reviewSubmit.textContent = "در حال ثبت...";
            }

            hideReviewStatus();

            const payloads = [
                { book: bookId, text },
                { book: bookId, review: text },
                { book: bookId, comment: text },
            ];

            let lastData = {};

            for (const payload of payloads) {
                const result = await postReviewPayload(payload);

                if (result.redirected) return;

                lastData = result.data || {};

                if (result.ok) {
                    showReviewStatus("نظر شما با موفقیت ثبت شد.", "success");

                    if (reviewText) {
                        reviewText.value = "";
                    }

                    await reloadCurrentBookReviews();

                    setTimeout(() => {
                        closeReviewForm();
                    }, 700);

                    return;
                }
            }

            throw new Error(getReviewErrorMessage(lastData));
        } catch (error) {
            console.error("Review submit failed:", error);
            showReviewStatus(error.message || "ثبت نظر انجام نشد.", "error");
        } finally {
            if (reviewSubmit) {
                reviewSubmit.disabled = false;
                reviewSubmit.textContent = "ثبت نظر";
            }
        }
    }

    async function loadBook() {
        const bookId = getBookIdFromUrl();

        if (!bookId) {
            if (title) title.textContent = "کتاب پیدا نشد";
            if (description) description.textContent = "شناسه کتاب در آدرس صفحه وجود ندارد.";
            return;
        }

        try {
            const book = await fetchBook(bookId);

            currentBook = book;
            selectedBookVersion = "physical";

            const onlineVersions = getOnlineVersionsFromBook(book);
            currentOnlineBook = chooseOnlineBook(onlineVersions);

            await renderBook(book);
            renderOnlineBookAccess(currentOnlineBook);

            const fullOnlineBook = await fetchOnlineBookForBook(bookId);

            if (fullOnlineBook) {
                renderOnlineBookAccess(fullOnlineBook);
            }
        } catch (error) {
            console.error("Book detail load failed:", error);

            if (title) {
                title.textContent = "کتاب پیدا نشد";
            }

            if (description) {
                description.textContent = "دریافت اطلاعات کتاب انجام نشد.";
            }

            showStatus("دریافت اطلاعات کتاب انجام نشد.", "error");
        }
    }

    if (versionPhysicalButton) {
        versionPhysicalButton.addEventListener("click", () => {
            switchBookVersion("physical");
        });
    }

    if (versionOnlineButton) {
        versionOnlineButton.addEventListener("click", () => {
            switchBookVersion("online");
        });
    }

    if (addCartButton) {
        addCartButton.addEventListener("click", addSelectedVersionToCart);
    }

    if (onlinePremiumButton) {
        onlinePremiumButton.addEventListener("click", openPremiumReader);
    }

    if (onlineReadButton) {
        onlineReadButton.addEventListener("click", openOwnedOnlineBookReader);
    }

    addReviewButtons.forEach(button => {
        button.addEventListener("click", openReviewForm);
    });

    if (reviewCancel) {
        reviewCancel.addEventListener("click", closeReviewForm);
    }

    if (reviewForm) {
        reviewForm.addEventListener("submit", submitReview);
    }

    loadBook();
});