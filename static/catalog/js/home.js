document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("home-page");

    if (!page) return;

    const HOME_API = page.dataset.homeApi || "/catalog/api/books/home/";
    const BOOKS_API = page.dataset.booksApi || "/catalog/api/books/";
    const ONLINE_BOOKS_API = page.dataset.onlineBooksApi || "/catalog/api/online-books/";
    const GENRES_API = page.dataset.genresApi || "/catalog/api/genres/choices/";
    const CART_API = page.dataset.cartApi || "/cart/api/carts/";
    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";
    const HOME_URL = page.dataset.homeUrl || "/ketabook/";

    const sliderTrack = document.getElementById("home-slider-track");
    const sliderLoading = document.getElementById("home-slider-loading");
    const prevButton = document.getElementById("home-slider-prev");
    const nextButton = document.getElementById("home-slider-next");

    const discountSection = document.getElementById("home-discount-section");
    const discountGrid = document.getElementById("home-discount-grid");

    const recommendedSection = document.getElementById("home-recommended-section");
    const recommendedGrid = document.getElementById("home-recommended-grid");
    const recommendedSubtitle = document.getElementById("home-recommended-subtitle");

    const discountedGenresSection = document.getElementById("home-discounted-genres-section");
    const discountedGenresGrid = document.getElementById("home-discounted-genres-grid");

    const genreSections = document.getElementById("home-genre-sections");
    const emptyState = document.getElementById("home-empty-state");

    const slideTemplate = document.getElementById("home-slide-template");
    const cardTemplate = document.getElementById("home-book-card-template");

    let allBooks = [];
    let onlineBookMap = new Map();
    let physicalBookByTitleMap = new Map();
    let genreChoices = [];

    let slideElements = [];
    let activeSlideIndex = 0;
    let slideTimer = null;
    let isSliding = false;

    const SLIDE_DELAY = 10000;

    const GENRE_LABELS = {
        adventure: "ماجراجویی",
        fantasy: "فانتزی",
        science: "علمی",
        mystery: "معمایی",
        romance: "عاشقانه",
        horror: "ترسناک",
        comedy: "کمدی",
        historical: "تاریخی",
        biography: "زندگی نامه",
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
        Biography: "زندگی نامه",
        Educational: "آموزشی",
        Business: "کسب و کار",
        Religion: "مذهبی",
    };

    const ONLINE_ICON = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="12" rx="2"></rect>
            <path d="M8 20h8"></path>
            <path d="M12 16v4"></path>
            <path d="M8 8h8"></path>
            <path d="M8 12h5"></path>
        </svg>
    `;

    const PHYSICAL_ICON = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"></path>
            <path d="M8 7h7"></path>
            <path d="M8 11h6"></path>
        </svg>
    `;

    const GENRE_ICON = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3z"></path>
        </svg>
    `;

    const MIXED_ICON = `
        <span class="home-mixed-icon" aria-hidden="true">
            ${PHYSICAL_ICON}
            <strong>+</strong>
            ${ONLINE_ICON}
        </span>
    `;

    function normalizeText(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/ي/g, "ی")
            .replace(/ى/g, "ی")
            .replace(/ك/g, "ک")
            .replace(/أ|إ|آ/g, "ا")
            .replace(/\u200c/g, " ")
            .replace(/[ًٌٍَُِّْ]/g, "")
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function firstNonEmpty(...values) {
        return values.find(
            value => value !== undefined && value !== null && String(value).trim() !== ""
        ) || "";
    }

    function booleanFlag(value) {
        if (value === true || value === 1) return true;

        const cleanValue = String(value || "").trim().toLowerCase();

        return ["true", "1", "yes", "y"].includes(cleanValue);
    }

    function numberValue(value) {
        const persian = "۰۱۲۳۴۵۶۷۸۹";
        const arabic = "٠١٢٣٤٥٦٧٨٩";

        const normalized = String(value ?? "")
            .replace(/[۰-۹]/g, digit => String(persian.indexOf(digit)))
            .replace(/[٠-٩]/g, digit => String(arabic.indexOf(digit)))
            .replace(/,/g, "");

        const number = Number(normalized.replace(/[^\d.]/g, ""));

        return Number.isFinite(number) ? number : 0;
    }

    function toPersianDigits(value) {
        return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("fa-IR")} تومان`;
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

    function authHeaders(extraHeaders = {}) {
        const token = getAccessToken();

        const headers = {
            Accept: "application/json",
            ...extraHeaders,
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return headers;
    }

    function getRows(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.results)) return payload.results;
        if (Array.isArray(payload?.books)) return payload.books;
        if (Array.isArray(payload?.items)) return payload.items;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.online_books)) return payload.online_books;
        if (Array.isArray(payload?.book_titles)) return payload.book_titles;

        return [];
    }

    function getNextUrl(payload) {
        if (!payload || Array.isArray(payload)) return "";

        return payload.next || payload.links?.next || "";
    }

    async function fetchJson(apiUrl) {
        const response = await fetch(apiUrl, {
            method: "GET",
            credentials: "same-origin",
            headers: authHeaders(),
        });

        const contentType = response.headers.get("content-type") || "";

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");

            console.error("Home API failed:", {
                url: apiUrl,
                status: response.status,
                statusText: response.statusText,
                responseText: errorText.slice(0, 1200),
            });

            throw new Error(`request failed: ${apiUrl}`);
        }

        if (!contentType.includes("application/json")) {
            const text = await response.text().catch(() => "");

            console.error("Home API did not return JSON:", {
                url: apiUrl,
                contentType,
                responseText: text.slice(0, 1200),
            });

            throw new Error(`invalid json response: ${apiUrl}`);
        }

        return response.json();
    }

    async function fetchRows(apiUrl) {
        try {
            const payload = await fetchJson(apiUrl);

            return getRows(payload);
        } catch {
            return [];
        }
    }

    async function fetchAllRows(apiUrl) {
        const rows = [];
        let nextUrl = apiUrl;
        let pageCounter = 0;

        while (nextUrl && pageCounter < 20) {
            pageCounter += 1;

            const payload = await fetchJson(nextUrl);

            rows.push(...getRows(payload));

            const next = getNextUrl(payload);

            if (!next) break;

            nextUrl = next.startsWith("http")
                ? next
                : new URL(next, window.location.origin).toString();
        }

        return rows;
    }

    async function cartApiRequest(url, options = {}) {
        const token = getAccessToken();

        if (!token) {
            window.location.href = LOGIN_URL;
            throw new Error("not authenticated");
        }

        const response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(options.headers || {}),
            },
        });

        if (response.status === 401 || response.status === 403) {
            clearAuthState();

            if (window.ketabookAuth) {
                window.ketabookAuth.clearAuthState();
                window.ketabookAuth.refreshNavbar();
            }

            window.location.href = LOGIN_URL;
            throw new Error("not authenticated");
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || data.detail || "request failed");
        }

        return data;
    }

    function getSlideType(item) {
        const rawType = String(firstNonEmpty(
            item?.slide_type,
            item?.item_type,
            item?.type,
            item?.type_label,
            ""
        )).toLowerCase();

        if (rawType.includes("genre")) return "genre";
        if (rawType.includes("online")) return "online";

        if (
            rawType.includes("physical") ||
            rawType.includes("printed") ||
            rawType === "book" ||
            rawType.includes("چاپ")
        ) {
            return "physical";
        }

        if (item?.online_book_id || item?.online_book) return "online";

        if (item?.value && item?.discount_percent && !item?.price) {
            return "genre";
        }

        return "physical";
    }

    function isGenreItem(item) {
        return getSlideType(item) === "genre" || Boolean(
            item?.value &&
            item?.url &&
            !item?.price &&
            !item?.book_id &&
            !item?.online_book_id
        );
    }

    function isOnlineItem(item) {
        return getSlideType(item) === "online";
    }

    function getTitleId(item) {
        return firstNonEmpty(
            item?.title_id,
            item?.titleId,
            item?.book_title_id,
            item?.bookTitleId,
            item?.book_title?.id,
            item?.book_title?.pk,
            item?.title_detail?.id,
            item?.title_detail?.pk,
            item?.title?.id,
            item?.title?.pk,
            ""
        );
    }

    function getPhysicalBookId(item) {
        const slideType = getSlideType(item);
        const titleId = getTitleId(item);

        if (slideType === "online") {
            const directBookId = firstNonEmpty(
                item?.book_id,
                item?.bookId,
                item?.physical_book_id,
                item?.physicalBookId,
                item?.physical_version_id,
                item?.printed_book_id,
                item?.book?.id,
                item?.book?.pk,
                item?.physical_book?.id,
                item?.physical_book?.pk,
                ""
            );

            if (directBookId) {
                return directBookId;
            }

            if (titleId && physicalBookByTitleMap.has(String(titleId))) {
                return physicalBookByTitleMap.get(String(titleId));
            }

            return "";
        }

        return firstNonEmpty(
            item?.book_id,
            item?.bookId,
            item?.physical_book_id,
            item?.physicalBookId,
            item?.physical_version_id,
            item?.printed_book_id,
            item?.book?.id,
            item?.book?.pk,
            item?.physical_book?.id,
            item?.physical_book?.pk,
            item?.id,
            item?.pk,
            ""
        );
    }

    function getBookId(item) {
        return getPhysicalBookId(item);
    }

    function getOnlineBookId(item) {
        const slideType = getSlideType(item);

        if (slideType === "online") {
            return firstNonEmpty(
                item?.online_book_id,
                item?.onlineBookId,
                item?.online_book,
                item?.online_book_detail?.id,
                item?.online_book_detail?.pk,
                item?.id,
                item?.pk,
                ""
            );
        }

        const physicalBookId = getPhysicalBookId(item);
        const titleId = getTitleId(item);

        const onlineByBook = physicalBookId
            ? onlineBookMap.get(String(physicalBookId))
            : null;

        const onlineByTitle = titleId
            ? onlineBookMap.get(`title:${titleId}`)
            : null;

        return firstNonEmpty(
            item?.online_book_id,
            item?.onlineBookId,
            onlineByBook?.id,
            onlineByBook?.pk,
            onlineByBook?.online_book_id,
            onlineByTitle?.id,
            onlineByTitle?.pk,
            onlineByTitle?.online_book_id,
            ""
        );
    }

    function hasOnlineVersion(item) {
        if (isGenreItem(item)) return false;

        if (
            booleanFlag(item?.has_online_version) ||
            booleanFlag(item?.hasOnlineVersion)
        ) {
            return true;
        }

        if (Array.isArray(item?.online_versions) && item.online_versions.length) {
            return true;
        }

        if (getSlideType(item) === "online") {
            return true;
        }

        const physicalBookId = getPhysicalBookId(item);
        const titleId = getTitleId(item);

        return Boolean(
            (physicalBookId && onlineBookMap.has(String(physicalBookId))) ||
            (titleId && onlineBookMap.has(`title:${titleId}`))
        );
    }

    function hasPhysicalVersion(item) {
        if (isGenreItem(item)) return false;

        if (
            booleanFlag(item?.has_physical_version) ||
            booleanFlag(item?.hasPhysicalVersion)
        ) {
            return true;
        }

        const slideType = getSlideType(item);

        if (slideType === "physical") {
            return true;
        }

        if (slideType === "online") {
            return Boolean(getPhysicalBookId(item));
        }

        return false;
    }

    function isBothVersionItem(item) {
        return hasPhysicalVersion(item) && hasOnlineVersion(item);
    }

    function slideVersionChipHTML(type, icon, text) {
        return `
            <span class="home-slide-version-chip is-${type}">
                ${icon}
                <span>${text}</span>
            </span>
        `;
    }

    function getItemTitle(item) {
        if (typeof item?.title === "string") return item.title;

        return firstNonEmpty(
            item?.name,
            item?.book,
            item?.book_name,
            item?.online_book_name,
            item?.title?.name,
            item?.title_detail?.name,
            item?.book_title?.name,
            item?.label,
            "نام کتاب"
        );
    }

    function getItemAuthor(item) {
        if (isGenreItem(item)) {
            return "تخفیف ویژه روی همه کتاب‌های این ژانر";
        }

        if (typeof item?.author === "string") return item.author;
        if (typeof item?.authors === "string") return item.authors;

        if (Array.isArray(item?.authors)) {
            return item.authors
                .map(author => author?.name || author)
                .filter(Boolean)
                .join("، ");
        }

        if (Array.isArray(item?.author_detail)) {
            return item.author_detail
                .map(author => author?.name || author)
                .filter(Boolean)
                .join("، ");
        }

        return firstNonEmpty(
            item?.author?.name,
            item?.author_detail?.name,
            item?.author_name,
            item?.writer,
            "نویسنده نامشخص"
        );
    }

    function getItemDescription(item) {
        if (isGenreItem(item)) {
            const percent = getDiscountPercent(item);

            return percent
                ? `برای دیدن کتاب‌های این ژانر با تخفیف ٪${toPersianDigits(percent)} وارد صفحه ژانر شوید.`
                : "کتاب‌های این ژانر را ببینید.";
        }

        const rawDescription = firstNonEmpty(
            item?.description,
            item?.book_description,
            item?.about_book,
            item?.about,
            item?.summary,
            item?.short_description,
            item?.intro,
            item?.book?.description,
            item?.book_detail?.description,
            item?.book_title?.description,
            item?.title_detail?.description,
            ""
        );

        const cleanDescription = String(rawDescription || "")
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&zwnj;/g, "‌")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, " ")
            .trim();

        if (!cleanDescription) {
            return "توضیحی برای این کتاب ثبت نشده است...";
        }

        return `${cleanDescription.slice(0, 200).trim()}...`;
    }

    function getItemPhoto(item) {
        return firstNonEmpty(
            item?.photo,
            item?.photo_url,
            item?.book_photo,
            item?.image,
            item?.cover,
            item?.book?.photo,
            item?.book?.book_photo,
            item?.book_title?.photo,
            item?.book_title?.photo_url,
            item?.title_detail?.photo,
            item?.title_detail?.photo_url,
            ""
        );
    }

    function getOriginalPrice(item) {
        return firstNonEmpty(
            item?.original_price,
            item?.price,
            item?.book_price,
            0
        );
    }

    function getFinalPrice(item) {
        return firstNonEmpty(
            item?.final_price,
            item?.discounted_price,
            item?.payable_price,
            item?.price,
            0
        );
    }

    function getDiscountPercent(item) {
        const directPercent = numberValue(firstNonEmpty(
            item?.discount_percent,
            item?.discountPercentage,
            ""
        ));

        if (directPercent > 0) {
            return Math.round(directPercent);
        }

        const original = numberValue(getOriginalPrice(item));
        const finalPrice = numberValue(getFinalPrice(item));

        if (!original || !finalPrice || finalPrice >= original) {
            return 0;
        }

        return Math.round(((original - finalPrice) / original) * 100);
    }

    function getCreatedTime(item) {
        const rawDate = firstNonEmpty(
            item?.created_at,
            item?.created,
            item?.createdAt,
            item?.updated_at,
            item?.last_update,
            ""
        );

        const timestamp = Date.parse(rawDate);

        if (Number.isFinite(timestamp)) {
            return timestamp;
        }

        return numberValue(firstNonEmpty(item?.book_id, item?.id, 0));
    }

    function getItemUrl(item) {
        if (isGenreItem(item)) {
            const value = firstNonEmpty(
                item?.value,
                item?.name,
                item?.slug,
                ""
            );

            return value
                ? `/ketabook/genres/${encodeURIComponent(value)}/`
                : HOME_URL;
        }

        const slideType = getSlideType(item);
        const physicalBookId = getPhysicalBookId(item);
        const onlineBookId = getOnlineBookId(item);

        if (physicalBookId) {
            if (slideType === "online" && onlineBookId) {
                return `/ketabook/books/${physicalBookId}/?online_book=${onlineBookId}`;
            }

            return `/ketabook/books/${physicalBookId}/`;
        }

        if (onlineBookId) {
            return `/ketabook/online-books/${onlineBookId}/`;
        }

        return HOME_URL;
    }
    function getGenrePersianLabel(value, fallback = "") {
        const rawValue = String(value || "").trim();
        const lowerValue = rawValue.toLowerCase();

        return (
            GENRE_LABELS[rawValue] ||
            GENRE_LABELS[lowerValue] ||
            fallback ||
            rawValue
        );
    }

    function normalizeGenreChoice(item) {
        if (Array.isArray(item)) {
            const value = String(item[0] || "");
            const fallback = String(item[1] || item[0] || "");

            return {
                value,
                label: getGenrePersianLabel(value, fallback),
                title: getGenrePersianLabel(value, fallback),
            };
        }

        if (typeof item === "object" && item !== null) {
            const value = firstNonEmpty(
                item.value,
                item.key,
                item.slug,
                item.name,
                item.id,
                item.title,
                item.label
            );

            const fallback = firstNonEmpty(
                item.title,
                item.label,
                item.display_name,
                item.name,
                value
            );

            return {
                value: String(value || ""),
                label: String(getGenrePersianLabel(value, fallback)),
                title: String(getGenrePersianLabel(value, fallback)),
                url: item.url || "",
            };
        }

        return {
            value: String(item || ""),
            label: getGenrePersianLabel(item),
            title: getGenrePersianLabel(item),
            url: "",
        };
    }

    function getGenreItemValue(item) {
        if (Array.isArray(item)) return item[0] || item[1] || "";

        if (typeof item === "object" && item !== null) {
            return firstNonEmpty(
                item.value,
                item.key,
                item.slug,
                item.name,
                item.id,
                item.title,
                item.label
            );
        }

        return item || "";
    }

    function getGenreItemLabel(item) {
        if (Array.isArray(item)) return item[1] || item[0] || "";

        if (typeof item === "object" && item !== null) {
            return firstNonEmpty(
                item.title,
                item.label,
                item.display_name,
                item.name,
                getGenrePersianLabel(item.value),
                item.value
            );
        }

        return getGenrePersianLabel(item);
    }

    function getBookGenreItems(book) {
        const genres = [];

        if (Array.isArray(book?.genres)) {
            genres.push(...book.genres);
        }

        if (Array.isArray(book?.genres_detail)) {
            genres.push(...book.genres_detail);
        }

        if (book?.genre) {
            genres.push(book.genre);
        }

        if (book?.genre_name) {
            genres.push(book.genre_name);
        }

        if (book?.book_title && Array.isArray(book.book_title.genres)) {
            genres.push(...book.book_title.genres);
        }

        if (book?.title_detail && Array.isArray(book.title_detail.genres)) {
            genres.push(...book.title_detail.genres);
        }

        return genres;
    }

    function collectGenresFromBooks(books) {
        const map = new Map();

        books.forEach(book => {
            getBookGenreItems(book).forEach(item => {
                const value = String(getGenreItemValue(item) || "").trim();
                const label = String(getGenreItemLabel(item) || value).trim();

                if (value && !map.has(value)) {
                    map.set(value, {
                        value,
                        label: getGenrePersianLabel(value, label),
                        title: getGenrePersianLabel(value, label),
                        url: `/ketabook/genres/${encodeURIComponent(value)}/`,
                    });
                }
            });
        });

        return Array.from(map.values());
    }

    function booksForGenre(books, genreValue) {
        const normalizedGenre = normalizeText(genreValue);

        return books.filter(book => {
            return getBookGenreItems(book).some(item => {
                return (
                    normalizeText(getGenreItemValue(item)) === normalizedGenre ||
                    normalizeText(getGenreItemLabel(item)) === normalizedGenre
                );
            });
        });
    }

    function buildPhysicalBookByTitleMap(books = []) {
        const map = new Map();

        books.forEach(book => {
            if (isGenreItem(book)) return;

            const slideType = getSlideType(book);

            const titleId = firstNonEmpty(
                book?.title_id,
                book?.titleId,
                book?.book_title_id,
                book?.bookTitleId,
                book?.book_title?.id,
                book?.book_title?.pk,
                book?.title_detail?.id,
                book?.title_detail?.pk,
                book?.title?.id,
                book?.title?.pk,
                ""
            );

            let bookId = "";

            if (slideType === "online") {
                bookId = firstNonEmpty(
                    book?.book_id,
                    book?.bookId,
                    book?.physical_book_id,
                    book?.physicalBookId,
                    book?.physical_version_id,
                    book?.printed_book_id,
                    book?.book?.id,
                    book?.book?.pk,
                    book?.physical_book?.id,
                    book?.physical_book?.pk,
                    ""
                );
            } else {
                bookId = firstNonEmpty(
                    book?.book_id,
                    book?.bookId,
                    book?.physical_book_id,
                    book?.physicalBookId,
                    book?.physical_version_id,
                    book?.printed_book_id,
                    book?.book?.id,
                    book?.book?.pk,
                    book?.physical_book?.id,
                    book?.physical_book?.pk,
                    book?.id,
                    book?.pk,
                    ""
                );
            }

            if (titleId && bookId && !map.has(String(titleId))) {
                map.set(String(titleId), String(bookId));
            }
        });

        return map;
    }

    function buildOnlineBookMap(onlineBooks = []) {
        const map = new Map();

        onlineBooks.forEach(onlineBook => {
            const onlineBookId = firstNonEmpty(
                onlineBook?.id,
                onlineBook?.pk,
                onlineBook?.online_book_id,
                ""
            );

            const titleId = firstNonEmpty(
                onlineBook?.title_id,
                onlineBook?.titleId,
                onlineBook?.book_title_id,
                onlineBook?.bookTitleId,
                onlineBook?.title?.id,
                onlineBook?.title?.pk,
                onlineBook?.book_title?.id,
                onlineBook?.book_title?.pk,
                ""
            );

            const bookIds = [];

            if (onlineBook?.book_id) bookIds.push(onlineBook.book_id);
            if (onlineBook?.bookId) bookIds.push(onlineBook.bookId);
            if (onlineBook?.physical_book_id) bookIds.push(onlineBook.physical_book_id);
            if (onlineBook?.physicalBookId) bookIds.push(onlineBook.physicalBookId);
            if (onlineBook?.printed_book_id) bookIds.push(onlineBook.printed_book_id);

            if (
                typeof onlineBook?.book === "number" ||
                typeof onlineBook?.book === "string"
            ) {
                bookIds.push(onlineBook.book);
            }

            if (typeof onlineBook?.book === "object" && onlineBook.book !== null) {
                if (onlineBook.book.id) bookIds.push(onlineBook.book.id);
                if (onlineBook.book.pk) bookIds.push(onlineBook.book.pk);
                if (onlineBook.book.book_id) bookIds.push(onlineBook.book.book_id);
            }

            const mappedOnlineBook = {
                ...onlineBook,
                id: onlineBookId || onlineBook.id,
                online_book_id: onlineBookId || onlineBook.online_book_id,
                title_id: titleId || onlineBook.title_id,
            };

            if (titleId && onlineBookId && !map.has(`title:${titleId}`)) {
                map.set(`title:${titleId}`, mappedOnlineBook);
            }

            bookIds.filter(Boolean).forEach(bookId => {
                if (!map.has(String(bookId))) {
                    map.set(String(bookId), mappedOnlineBook);
                }
            });
        });

        return map;
    }

    function addOnlineSlidesToMap(slides = []) {
        slides.forEach(slide => {
            const bookId = firstNonEmpty(
                slide?.book_id,
                slide?.bookId,
                slide?.physical_book_id,
                slide?.physicalBookId,
                slide?.printed_book_id,
                ""
            );

            const titleId = getTitleId(slide);

            const onlineBookId = firstNonEmpty(
                slide?.online_book_id,
                slide?.onlineBookId,
                getSlideType(slide) === "online" ? slide?.id : "",
                ""
            );

            if (bookId && titleId && !physicalBookByTitleMap.has(String(titleId))) {
                physicalBookByTitleMap.set(String(titleId), String(bookId));
            }

            if (bookId && onlineBookId && !onlineBookMap.has(String(bookId))) {
                onlineBookMap.set(String(bookId), {
                    ...slide,
                    id: onlineBookId,
                    online_book_id: onlineBookId,
                    book_id: bookId,
                    title_id: titleId,
                });
            }

            if (titleId && onlineBookId && !onlineBookMap.has(`title:${titleId}`)) {
                onlineBookMap.set(`title:${titleId}`, {
                    ...slide,
                    id: onlineBookId,
                    online_book_id: onlineBookId,
                    book_id: bookId,
                    title_id: titleId,
                });
            }
        });
    }

    async function fetchBookDetail(book) {
        const bookId = getPhysicalBookId(book);

        /*
            Do not fetch printed detail for online slides.
            Otherwise printed payload can overwrite online slide_type / online_book_id.
        */
        if (!bookId || isGenreItem(book) || getSlideType(book) === "online") {
            return book;
        }

        try {
            const response = await fetch(
                `${BOOKS_API}${String(BOOKS_API).endsWith("/") ? "" : "/"}${bookId}/`,
                {
                    method: "GET",
                    credentials: "same-origin",
                    headers: authHeaders(),
                }
            );

            if (!response.ok) return book;

            const detail = await response.json();

            return {
                ...book,
                ...detail,
            };
        } catch {
            return book;
        }
    }

    function setSlideBadges(clone, item) {
        const typeBadge = clone.querySelector("[data-slide-type-badge]");
        const typeIcon = clone.querySelector("[data-slide-type-icon]");
        const typeText = clone.querySelector("[data-slide-type-text]");
        const discountBadge = clone.querySelector("[data-slide-discount-badge]");

        const slideType = getSlideType(item);
        const percent = getDiscountPercent(item);

        const hasPhysical = hasPhysicalVersion(item);
        const hasOnline = hasOnlineVersion(item);
        const hasBoth = hasPhysical && hasOnline;

        if (typeBadge) {
            typeBadge.classList.toggle("is-online", slideType === "online" && !hasBoth);
            typeBadge.classList.toggle("is-physical", slideType === "physical" && !hasBoth);
            typeBadge.classList.toggle("is-genre", slideType === "genre");
            typeBadge.classList.toggle("is-both", hasBoth);

            if (slideType === "genre") {
                typeBadge.innerHTML = slideVersionChipHTML(
                    "genre",
                    GENRE_ICON,
                    "تخفیف ژانر"
                );

                typeBadge.title = "تخفیف ژانر";
                typeBadge.setAttribute("aria-label", "تخفیف ژانر");
            } else if (hasBoth) {
                typeBadge.innerHTML =
                    slideVersionChipHTML("physical", PHYSICAL_ICON, "نسخه چاپی") +
                    slideVersionChipHTML("online", ONLINE_ICON, "نسخه آنلاین");

                typeBadge.title = "نسخه چاپی و نسخه آنلاین";
                typeBadge.setAttribute("aria-label", "نسخه چاپی و نسخه آنلاین");
            } else if (hasOnline) {
                typeBadge.innerHTML = slideVersionChipHTML(
                    "online",
                    ONLINE_ICON,
                    "نسخه آنلاین"
                );

                typeBadge.title = "نسخه آنلاین";
                typeBadge.setAttribute("aria-label", "نسخه آنلاین");
            } else {
                typeBadge.innerHTML = slideVersionChipHTML(
                    "physical",
                    PHYSICAL_ICON,
                    "نسخه چاپی"
                );

                typeBadge.title = "نسخه چاپی";
                typeBadge.setAttribute("aria-label", "نسخه چاپی");
            }
        } else {
            if (typeIcon) {
                typeIcon.innerHTML = slideType === "genre"
                    ? GENRE_ICON
                    : hasBoth
                        ? MIXED_ICON
                        : hasOnline
                            ? ONLINE_ICON
                            : PHYSICAL_ICON;
            }

            if (typeText) {
                typeText.textContent = slideType === "genre"
                    ? "تخفیف ژانر"
                    : hasBoth
                        ? "نسخه چاپی / نسخه آنلاین"
                        : hasOnline
                            ? "نسخه آنلاین"
                            : "نسخه چاپی";
            }
        }

        if (discountBadge) {
            if (percent) {
                discountBadge.hidden = false;
                discountBadge.textContent = `٪${toPersianDigits(percent)} تخفیف`;
            } else {
                discountBadge.hidden = true;
            }
        }
    }

    function renderSlide(item, index) {
        if (!slideTemplate || !sliderTrack) return;

        const clone = slideTemplate.content.cloneNode(true);
        const slide = clone.querySelector(".home-hero-slide");

        const title = clone.querySelector("[data-slide-title]");
        const author = clone.querySelector("[data-slide-author]");
        const description = clone.querySelector("[data-slide-description]");
        const link = clone.querySelector("[data-slide-link]");
        const coverLink = clone.querySelector("[data-slide-cover-link]");
        const cover = clone.querySelector("[data-slide-cover]");
        const fallback = clone.querySelector("[data-slide-cover-fallback]");
        const cartButton = clone.querySelector("[data-slide-cart-button]");

        const itemTitle = getItemTitle(item);
        const itemPhoto = getItemPhoto(item);
        const itemUrl = getItemUrl(item);
        const slideType = getSlideType(item);

        if (slide) {
            slide.dataset.slideIndex = String(index);
            slide.classList.toggle("is-online-slide", slideType === "online");
            slide.classList.toggle("is-physical-slide", slideType === "physical");
            slide.classList.toggle("is-genre-slide", slideType === "genre");
            slide.classList.toggle("is-both-slide", isBothVersionItem(item));
        }

        setSlideBadges(clone, item);

        if (title) title.textContent = itemTitle;
        if (author) author.textContent = getItemAuthor(item);
        if (description) description.textContent = getItemDescription(item);

        if (link) {
            link.href = itemUrl;
            link.textContent = slideType === "genre"
                ? "مشاهده ژانر"
                : "مشاهده کتاب";
        }

        if (coverLink) {
            coverLink.href = itemUrl;
            coverLink.setAttribute("aria-label", itemTitle);
        }

        if (cover && fallback) {
            if (itemPhoto && slideType !== "genre") {
                cover.src = itemPhoto;
                cover.alt = itemTitle;
                cover.hidden = false;
                fallback.hidden = true;
            } else {
                cover.removeAttribute("src");
                cover.alt = "";
                cover.hidden = true;
                fallback.hidden = false;
                fallback.textContent = slideType === "genre"
                    ? `٪${toPersianDigits(getDiscountPercent(item) || 0)}`
                    : "کتابوک";
            }
        }

        if (cartButton) {
            if (slideType === "genre") {
                cartButton.hidden = true;
            } else {
                cartButton.hidden = false;

                cartButton.addEventListener("click", event => {
                    event.preventDefault();
                    event.stopPropagation();

                    addItemToCart(item, cartButton);
                });
            }
        }

        sliderTrack.appendChild(clone);
    }

    async function setupSlider(items) {
        if (!sliderTrack) return;

        sliderTrack.innerHTML = "";

        const sliderItems = [...items]
            .filter(Boolean)
            .slice(0, 16);

        const itemsWithDetails = await Promise.all(
            sliderItems.map(item => isGenreItem(item) ? item : fetchBookDetail(item))
        );

        itemsWithDetails.forEach((item, index) => {
            renderSlide(item, index);
        });

        slideElements = Array.from(sliderTrack.querySelectorAll(".home-hero-slide"));
        activeSlideIndex = 0;

        if (sliderLoading) {
            sliderLoading.hidden = true;
        }

        if (!slideElements.length) {
            if (sliderLoading) {
                sliderLoading.hidden = false;
                sliderLoading.textContent = "کتابی برای اسلایدر پیدا نشد.";
            }

            return;
        }

        updateSlidePreviewClasses();
        startSliderTimer();
    }

    function updateSlidePreviewClasses() {
        if (!slideElements.length) return;

        const total = slideElements.length;
        const previousIndex = (activeSlideIndex - 1 + total) % total;
        const nextIndex = (activeSlideIndex + 1) % total;

        slideElements.forEach((slide, index) => {
            slide.classList.remove(
                "is-active",
                "is-side-left",
                "is-side-right"
            );

            if (index === activeSlideIndex) {
                slide.classList.add("is-active");
                return;
            }

            if (index === previousIndex) {
                slide.classList.add("is-side-left");
                return;
            }

            if (index === nextIndex) {
                slide.classList.add("is-side-right");
            }
        });
    }

    function showSlide(nextIndex) {
        if (isSliding || !slideElements.length) return;

        const total = slideElements.length;
        const normalizedNextIndex = (nextIndex + total) % total;

        if (normalizedNextIndex === activeSlideIndex) return;

        isSliding = true;
        activeSlideIndex = normalizedNextIndex;

        updateSlidePreviewClasses();

        window.setTimeout(() => {
            isSliding = false;
        }, 620);
    }

    function nextSlide() {
        showSlide(activeSlideIndex + 1);
    }

    function previousSlide() {
        showSlide(activeSlideIndex - 1);
    }

    function startSliderTimer() {
        stopSliderTimer();

        if (slideElements.length <= 1) return;

        slideTimer = window.setInterval(nextSlide, SLIDE_DELAY);
    }

    function stopSliderTimer() {
        if (slideTimer) {
            window.clearInterval(slideTimer);
            slideTimer = null;
        }
    }

    function resetSliderTimer() {
        startSliderTimer();
    }

    async function addItemToCart(item, button) {
        if (!button || button.dataset.cartBusy === "1") return;

        const physicalBookId = getPhysicalBookId(item);
        const onlineBookId = getOnlineBookId(item);

        const shouldAddOnline = isOnlineItem(item) && onlineBookId;

        if (!physicalBookId && !onlineBookId) return;

        const wasAdded = button.classList.contains("is-added");

        const addBody = shouldAddOnline
            ? {
                online_book: onlineBookId,
                quantity: 1,
            }
            : {
                book: physicalBookId,
                quantity: 1,
            };

        const removeBody = shouldAddOnline
            ? {
                online_book: onlineBookId,
            }
            : {
                book: physicalBookId,
            };

        button.dataset.cartBusy = "1";
        button.disabled = true;
        button.classList.toggle("is-added", !wasAdded);
        button.setAttribute(
            "aria-label",
            wasAdded ? "افزودن به سبد خرید" : "به سبد خرید اضافه شد"
        );

        try {
            if (wasAdded) {
                await cartApiRequest(`${CART_API}remove-item/`, {
                    method: "DELETE",
                    body: JSON.stringify(removeBody),
                });

                const currentCount = Number(localStorage.getItem("ketabook_cart_count") || "0") || 0;
                localStorage.setItem("ketabook_cart_count", String(Math.max(0, currentCount - 1)));
            } else {
                await cartApiRequest(`${CART_API}add-item/`, {
                    method: "POST",
                    body: JSON.stringify(addBody),
                });

                const currentCount = Number(localStorage.getItem("ketabook_cart_count") || "0") || 0;
                localStorage.setItem("ketabook_cart_count", String(currentCount + 1));
            }

            if (window.ketabookAuth) {
                window.ketabookAuth.refreshNavbar();
            }
        } catch (error) {
            console.error("Cart toggle failed:", error);

            button.classList.toggle("is-added", wasAdded);
            button.setAttribute(
                "aria-label",
                wasAdded ? "به سبد خرید اضافه شد" : "افزودن به سبد خرید"
            );
        }

        button.dataset.cartBusy = "0";
        button.disabled = false;
    }

    function renderCard(item, target) {
        if (!cardTemplate || !target) return;

        const clone = cardTemplate.content.cloneNode(true);

        const card = clone.querySelector("[data-home-book-card]");
        const link = clone.querySelector("[data-home-book-link]");
        const cover = clone.querySelector("[data-home-book-cover]");
        const fallback = clone.querySelector("[data-home-book-cover-fallback]");
        const discountBadge = clone.querySelector("[data-home-book-discount-badge]");
        const typeBadge = clone.querySelector("[data-home-book-type-badge]");
        const typeIcon = clone.querySelector("[data-home-book-type-icon]");
        const title = clone.querySelector("[data-home-book-title]");
        const author = clone.querySelector("[data-home-book-author]");
        const price = clone.querySelector("[data-home-book-price]");
        const oldPrice = clone.querySelector("[data-home-book-old-price]");

        const itemTitle = getItemTitle(item);
        const itemPhoto = getItemPhoto(item);
        const itemUrl = getItemUrl(item);
        const percent = getDiscountPercent(item);

        const hasPhysical = hasPhysicalVersion(item);
        const hasOnline = hasOnlineVersion(item);
        const hasBoth = hasPhysical && hasOnline;

        if (card) {
            card.classList.toggle("is-online-card", hasOnline && !hasPhysical);
            card.classList.toggle("is-physical-card", hasPhysical && !hasOnline);
            card.classList.toggle("is-both-card", hasBoth);
        }

        if (link) {
            link.href = itemUrl;
            link.setAttribute("aria-label", itemTitle);
        }

        if (cover && fallback) {
            if (itemPhoto) {
                cover.src = itemPhoto;
                cover.alt = itemTitle;
                cover.hidden = false;
                fallback.hidden = true;
            } else {
                cover.removeAttribute("src");
                cover.alt = "";
                cover.hidden = true;
                fallback.hidden = false;
            }
        }

        if (discountBadge) {
            if (percent) {
                discountBadge.hidden = false;
                discountBadge.textContent = `٪${toPersianDigits(percent)}`;
            } else {
                discountBadge.hidden = true;
            }
        }

        if (typeBadge) {
            typeBadge.classList.toggle("is-online", hasOnline && !hasPhysical);
            typeBadge.classList.toggle("is-physical", hasPhysical && !hasOnline);
            typeBadge.classList.toggle("is-both", hasBoth);

            typeBadge.title = hasBoth
                ? "کتاب چاپی + کتاب آنلاین"
                : hasOnline
                    ? "کتاب آنلاین"
                    : "کتاب چاپی";

            typeBadge.setAttribute("aria-label", typeBadge.title);
        }

        if (typeIcon) {
            typeIcon.innerHTML = hasBoth
                ? MIXED_ICON
                : hasOnline
                    ? ONLINE_ICON
                    : PHYSICAL_ICON;
        }

        if (title) title.textContent = itemTitle;
        if (author) author.textContent = getItemAuthor(item);
        if (price) price.textContent = formatMoney(getFinalPrice(item));

        if (oldPrice) {
            if (percent) {
                oldPrice.hidden = false;
                oldPrice.textContent = formatMoney(getOriginalPrice(item));
            } else {
                oldPrice.hidden = true;
            }
        }

        target.appendChild(clone);
    }

    function renderGrid(items, target, limit = 8) {
        if (!target) return;

        target.innerHTML = "";

        items.slice(0, limit).forEach(item => {
            renderCard(item, target);
        });
    }

    function getSectionItems(sectionPayload) {
        if (Array.isArray(sectionPayload)) return sectionPayload;

        return getRows(sectionPayload);
    }

    function renderDiscountSection(sectionPayload) {
        if (!discountSection || !discountGrid) return;

        const items = getSectionItems(sectionPayload)
            .filter(item => getDiscountPercent(item) > 0);

        if (!items.length) {
            discountSection.hidden = true;
            discountGrid.innerHTML = "";
            return;
        }

        discountSection.hidden = false;
        renderGrid(items, discountGrid, 12);
    }

    function renderRecommendedSection(sectionPayload) {
        if (!recommendedSection || !recommendedGrid) return;

        const items = getSectionItems(sectionPayload);
        const shouldShow = Boolean(sectionPayload?.show) && items.length > 0;

        if (!shouldShow) {
            recommendedSection.hidden = true;
            recommendedGrid.innerHTML = "";
            return;
        }

        recommendedSection.hidden = false;

        if (recommendedSubtitle) {
            const levelLabel = firstNonEmpty(
                sectionPayload?.level_label,
                "مطابق سن شما"
            );

            recommendedSubtitle.textContent = `بر اساس گروه سنی ${levelLabel}`;
        }

        renderGrid(items, recommendedGrid, 8);
    }

    function renderDiscountedGenres(sectionPayload) {
        if (!discountedGenresSection || !discountedGenresGrid) return;

        const items = getSectionItems(sectionPayload)
            .filter(item => getDiscountPercent(item) > 0 || numberValue(item?.discount_percent) > 0);

        discountedGenresGrid.innerHTML = "";

        if (!items.length) {
            discountedGenresSection.hidden = true;
            return;
        }

        discountedGenresSection.hidden = false;

        items.slice(0, 10).forEach(genre => {
            const percent = getDiscountPercent(genre) || numberValue(genre?.discount_percent);

            const value = firstNonEmpty(
                genre?.value,
                genre?.name,
                genre?.slug,
                ""
            );

            const label = firstNonEmpty(
                genre?.label,
                genre?.title,
                getGenrePersianLabel(value),
                "ژانر تخفیف‌دار"
            );

            const url = firstNonEmpty(
                genre?.url,
                value ? `/ketabook/genres/${encodeURIComponent(value)}/` : HOME_URL
            );

            const card = document.createElement("a");
            card.className = "home-discount-genre-card";
            card.href = url;

            card.innerHTML = `
                <span class="home-discount-genre-spark">${GENRE_ICON}</span>
                <strong>${escapeHtml(label)}</strong>
                <em>٪${toPersianDigits(Math.round(percent))}</em>
                <small>مشاهده کتاب‌های این ژانر</small>
            `;

            discountedGenresGrid.appendChild(card);
        });
    }

    function createGenreSection(genre, books) {
        const section = document.createElement("section");
        section.className = "home-books-section home-genre-section";

        const label = genre.title || genre.label || genre.value || "دسته‌بندی";
        const genreValue = String(genre.value || "").trim();

        const genreUrl = genre.url || (
            genreValue
                ? `/ketabook/genres/${encodeURIComponent(genreValue)}/`
                : HOME_URL
        );

        section.innerHTML = `
            <header class="home-section-head">
                <div>
                    <p>Category</p>
                    <h2>${escapeHtml(label)}</h2>
                </div>

                <a href="${genreUrl}" class="home-section-link">
                    مشاهده همه
                </a>
            </header>

            <div class="home-books-grid"></div>
        `;

        const grid = section.querySelector(".home-books-grid");

        renderGrid(books, grid, 6);

        return section;
    }

    function renderGenreSections(books) {
        if (!genreSections) return;

        genreSections.innerHTML = "";

        genreChoices.forEach(genre => {
            const sectionBooks = booksForGenre(books, genre.value);

            if (!sectionBooks.length) return;

            genreSections.appendChild(createGenreSection(genre, sectionBooks));
        });
    }

    function showEmpty(show) {
        if (emptyState) {
            emptyState.hidden = !show;
        }
    }

    function bindSliderButtons() {
        if (nextButton) {
            nextButton.addEventListener("click", () => {
                nextSlide();
                resetSliderTimer();
            });
        }

        if (prevButton) {
            prevButton.addEventListener("click", () => {
                previousSlide();
                resetSliderTimer();
            });
        }
    }

    async function loadHomePage() {
        try {
            showEmpty(false);

            const [homePayload, books, onlineBooks, genres] = await Promise.all([
                fetchJson(HOME_API),
                fetchAllRows(BOOKS_API).catch(() => []),
                fetchAllRows(ONLINE_BOOKS_API).catch(() => []),
                fetchRows(GENRES_API).catch(() => []),
            ]);

            allBooks = books.length
                ? books
                : [
                    ...getSectionItems(homePayload?.discounted_books),
                    ...getSectionItems(homePayload?.recommended_books),
                ];

            physicalBookByTitleMap = buildPhysicalBookByTitleMap(allBooks);
            onlineBookMap = buildOnlineBookMap(onlineBooks);

            addOnlineSlidesToMap(homePayload?.slides || []);
            addOnlineSlidesToMap(allBooks);

            const normalizedGenres = genres
                .map(normalizeGenreChoice)
                .filter(genre => genre.value && genre.label);

            genreChoices = normalizedGenres.length
                ? normalizedGenres
                : collectGenresFromBooks(allBooks);

            const slides = Array.isArray(homePayload?.slides) && homePayload.slides.length
                ? homePayload.slides
                : [...allBooks]
                    .sort((a, b) => getCreatedTime(b) - getCreatedTime(a))
                    .slice(0, 10);

            await setupSlider(slides);

            renderDiscountSection(homePayload?.discounted_books);
            renderRecommendedSection(homePayload?.recommended_books);
            renderDiscountedGenres(homePayload?.discounted_genres);
            renderGenreSections(allBooks);

            if (!slides.length && !allBooks.length) {
                showEmpty(true);
            }
        } catch (error) {
            console.error("Home page load failed:", error);

            await loadLegacyHomePage();
        }
    }

    async function loadLegacyHomePage() {
        try {
            const [books, onlineBooks, genres] = await Promise.all([
                fetchAllRows(BOOKS_API),
                fetchAllRows(ONLINE_BOOKS_API),
                fetchRows(GENRES_API).catch(() => []),
            ]);

            allBooks = books;
            physicalBookByTitleMap = buildPhysicalBookByTitleMap(allBooks);
            onlineBookMap = buildOnlineBookMap(onlineBooks);

            addOnlineSlidesToMap(allBooks);

            const normalizedGenres = genres
                .map(normalizeGenreChoice)
                .filter(genre => genre.value && genre.label);

            genreChoices = normalizedGenres.length
                ? normalizedGenres
                : collectGenresFromBooks(allBooks);

            await setupSlider(allBooks);

            renderDiscountSection(
                allBooks.filter(book => getDiscountPercent(book) > 0)
            );

            renderRecommendedSection({
                show: false,
                items: [],
            });

            renderDiscountedGenres({
                show: false,
                items: [],
            });

            renderGenreSections(allBooks);

            if (!allBooks.length) {
                showEmpty(true);
            }
        } catch (error) {
            console.error("Legacy home page load failed:", error);

            if (sliderLoading) {
                sliderLoading.hidden = false;
                sliderLoading.textContent = "دریافت کتاب‌ها انجام نشد.";
            }

            showEmpty(true);
        }
    }

    bindSliderButtons();
    loadHomePage();
});