document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("search-page");

    if (!page) return;

    const BOOKS_API = page.dataset.booksApi || "/catalog/api/books/";
    const ONLINE_BOOKS_API = page.dataset.onlineBooksApi || "/catalog/api/online-books/";
    const GENRES_API = page.dataset.genresApi || "/catalog/api/genres/choices/";
    const HOME_URL = page.dataset.homeUrl || "/ketabook/";

    const titleEl = document.getElementById("search-page-title");
    const subtitleEl = document.getElementById("search-page-subtitle");
    const countEl = document.getElementById("search-results-count");
    const loadingEl = document.getElementById("search-loading");
    const gridEl = document.getElementById("search-books-grid");
    const emptyEl = document.getElementById("search-empty-state");

    const filterForm = document.getElementById("search-filter-form");
    const genreSelect = document.getElementById("search-genre-select");
    const sortSelect = document.getElementById("search-sort-select");
    const authorInput = document.getElementById("search-author-input");

    const template = document.getElementById("search-book-template");

    const params = new URLSearchParams(window.location.search);

    const originalQuery = (params.get("q") || "").trim();
    const searchNameQuery = (params.get("name") || originalQuery || "").trim();

    let allBooks = [];
    let onlineBookMap = new Map();
    let genreChoices = [];

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
        Religion: "مذهبی"
    };

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

    const ONLINE_ICON = `
        <svg viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="12" rx="2"></rect>
            <path d="M8 20h8"></path>
            <path d="M12 16v4"></path>
        </svg>
    `;

    const PHYSICAL_ICON = `
        <svg viewBox="0 0 24 24">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"></path>
        </svg>
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

    function compactText(value) {
        return normalizeText(value).replace(/\s+/g, "");
    }

    function firstNonEmpty(...values) {
        return values.find(value => value !== undefined && value !== null && String(value).trim() !== "") || "";
    }

    function numberValue(value) {
        const number = Number(String(value ?? "").replace(/[^\d.]/g, ""));

        return Number.isFinite(number) ? number : 0;
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("fa-IR")} تومان`;
    }

    function getRows(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.results)) return payload.results;
        if (Array.isArray(payload?.books)) return payload.books;
        if (Array.isArray(payload?.items)) return payload.items;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.online_books)) return payload.online_books;

        return [];
    }

    function getNextUrl(payload) {
        if (!payload || Array.isArray(payload)) return "";

        return payload.next || payload.links?.next || "";
    }

    async function fetchAllRows(apiUrl) {
        const rows = [];
        let nextUrl = apiUrl;
        let pageCounter = 0;

        while (nextUrl && pageCounter < 20) {
            pageCounter += 1;

            const response = await fetch(nextUrl, {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error("request failed");
            }

            const payload = await response.json();

            rows.push(...getRows(payload));

            const next = getNextUrl(payload);

            if (!next) {
                break;
            }

            nextUrl = next.startsWith("http")
                ? next
                : new URL(next, window.location.origin).toString();
        }

        return rows;
    }

    async function fetchRows(apiUrl) {
        const response = await fetch(apiUrl, {
            method: "GET",
            credentials: "same-origin",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            return [];
        }

        const payload = await response.json();

        return getRows(payload);
    }

    function getBookId(book) {
        return book?.id || book?.book_id || book?.pk || "";
    }

    function getBookTitle(book) {
        return firstNonEmpty(
            book?.book,
            book?.name,
            book?.title,
            book?.book_name,
            "نام کتاب"
        );
    }

    function getBookPhoto(book) {
        return firstNonEmpty(
            book?.book_photo,
            book?.photo,
            book?.image,
            book?.cover
        );
    }

    function getBookAuthor(book) {
        if (typeof book?.author === "string") return book.author;

        return firstNonEmpty(
            book?.author?.name,
            book?.author?.fullname,
            book?.author_name,
            book?.writer,
            "نویسنده نامشخص"
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
        const original = numberValue(getOriginalPrice(book));
        const discounted = numberValue(getDiscountedPrice(book));

        if (!original || !discounted || discounted >= original) {
            return 0;
        }

        return Math.round(((original - discounted) / original) * 100);
    }

    function getCreatedTime(book) {
        const rawDate = firstNonEmpty(
            book?.created_at,
            book?.created,
            book?.createdAt,
            book?.date_created,
            book?.date_joined,
            book?.updated_at,
            ""
        );

        const timestamp = Date.parse(rawDate);

        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function getOnlineBookId(onlineBook) {
        return onlineBook?.id || onlineBook?.online_book_id || onlineBook?.pk || "";
    }

    function getOnlineBookBookIds(onlineBook) {
        const ids = [];

        if (!onlineBook) return ids;

        if (typeof onlineBook.book === "number" || typeof onlineBook.book === "string") {
            ids.push(onlineBook.book);
        }

        if (typeof onlineBook.book === "object" && onlineBook.book !== null) {
            if (onlineBook.book.id) ids.push(onlineBook.book.id);
            if (onlineBook.book.pk) ids.push(onlineBook.book.pk);
            if (onlineBook.book.book_id) ids.push(onlineBook.book.book_id);
        }

        if (onlineBook.book_id) ids.push(onlineBook.book_id);

        if (typeof onlineBook.book_detail === "object" && onlineBook.book_detail !== null) {
            if (onlineBook.book_detail.id) ids.push(onlineBook.book_detail.id);
            if (onlineBook.book_detail.pk) ids.push(onlineBook.book_detail.pk);
            if (onlineBook.book_detail.book_id) ids.push(onlineBook.book_detail.book_id);
        }

        return ids.filter(Boolean).map(String);
    }

    function buildOnlineBookMap(onlineBooks) {
        const map = new Map();

        onlineBooks.forEach(onlineBook => {
            getOnlineBookBookIds(onlineBook).forEach(bookId => {
                if (!map.has(String(bookId))) {
                    map.set(String(bookId), onlineBook);
                }
            });
        });

        return map;
    }

    function getBookUrl(book) {
        const bookId = getBookId(book);

        if (!bookId) return HOME_URL;

        const onlineBook = onlineBookMap.get(String(bookId));
        const onlineBookId = getOnlineBookId(onlineBook);

        if (onlineBookId) {
            return `/ketabook/books/${bookId}/?online_book=${onlineBookId}`;
        }

        return `/ketabook/books/${bookId}/`;
    }

    function normalizeGenreChoice(item) {
        if (Array.isArray(item)) {
            const value = String(item[0] || "");
            const fallback = String(item[1] || item[0] || "");

            return {
                value,
                label: getGenrePersianLabel(value, fallback)
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
                item.label,
                item.title,
                item.display_name,
                item.name,
                value
            );

            return {
                value: String(value || ""),
                label: String(getGenrePersianLabel(value, fallback))
            };
        }

        return {
            value: String(item || ""),
            label: getGenrePersianLabel(item)
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
                item.label,
                item.title,
                item.display_name,
                item.name,
                GENRE_LABELS[item.value],
                item.value
            );
        }

        return GENRE_LABELS[item] || item || "";
    }

    function getBookGenreItems(book) {
        const genres = [];

        if (Array.isArray(book?.genres)) {
            genres.push(...book.genres);
        }

        if (book?.genre) {
            genres.push(book.genre);
        }

        if (book?.genre_name) {
            genres.push(book.genre_name);
        }

        return genres;
    }

    function getGenreLabel(value) {
        const normalizedValue = normalizeText(value);

        const found = genreChoices.find(choice => {
            return normalizeText(choice.value) === normalizedValue;
        });

        return getGenrePersianLabel(
            value,
            found?.label || value
        );
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
                        label: getGenrePersianLabel(value, label)
                    });
                }
            });
        });

        return Array.from(map.values());
    }

    function populateGenreSelect() {
        if (!genreSelect) return;

        const options = [
            `<option value="">همه دسته‌بندی‌ها</option>`,
            ...genreChoices.map(choice => {
                return `<option value="${choice.value}">${choice.label}</option>`;
            })
        ];

        genreSelect.innerHTML = options.join("");
    }

    function bookMatchesTitleQuery(book) {
        const query = searchNameQuery;

        if (!query) return true;

        const normalizedQuery = normalizeText(query);
        const compactQuery = compactText(query);

        const title = getBookTitle(book);
        const normalizedTitle = normalizeText(title);
        const compactTitle = compactText(title);

        if (!normalizedQuery) return true;

        if (normalizedTitle.includes(normalizedQuery)) return true;
        if (compactTitle.includes(compactQuery)) return true;

        const tokens = normalizedQuery
            .split(" ")
            .map(token => token.trim())
            .filter(token => token.length > 1);

        if (!tokens.length) return true;

        return tokens.every(token => {
            return (
                normalizedTitle.includes(token) ||
                compactTitle.includes(compactText(token))
            );
        });
    }

    function bookMatchesGenre(book, selectedGenre) {
        if (!selectedGenre) return true;

        const selectedLabel = getGenreLabel(selectedGenre);

        const allowedValues = [
            normalizeText(selectedGenre),
            normalizeText(selectedLabel),
            compactText(selectedGenre),
            compactText(selectedLabel)
        ].filter(Boolean);

        const bookGenreItems = getBookGenreItems(book);

        return bookGenreItems.some(item => {
            const value = getGenreItemValue(item);
            const label = getGenreItemLabel(item);

            const candidates = [
                normalizeText(value),
                normalizeText(label),
                compactText(value),
                compactText(label)
            ].filter(Boolean);

            return candidates.some(candidate => allowedValues.includes(candidate));
        });
    }

    function bookMatchesAuthor(book, authorQuery) {
        if (!authorQuery) return true;

        const author = getBookAuthor(book);

        const normalizedAuthor = normalizeText(author);
        const normalizedQuery = normalizeText(authorQuery);

        if (!normalizedQuery) return true;

        if (normalizedAuthor.includes(normalizedQuery)) return true;

        const tokens = normalizedQuery
            .split(" ")
            .map(token => token.trim())
            .filter(token => token.length > 1);

        if (!tokens.length) return true;

        return tokens.every(token => normalizedAuthor.includes(token));
    }

    function sortBooks(books, sortValue) {
        if (!sortValue) return books;

        return [...books].sort((a, b) => {
            const aTime = getCreatedTime(a);
            const bTime = getCreatedTime(b);

            if (sortValue === "newest") {
                return bTime - aTime;
            }

            if (sortValue === "oldest") {
                return aTime - bTime;
            }

            return 0;
        });
    }

    function getFilteredBooks() {
        const selectedGenre = genreSelect ? genreSelect.value : "";
        const selectedSort = sortSelect ? sortSelect.value : "";
        const authorQuery = authorInput ? authorInput.value.trim() : "";

        let books = allBooks.filter(book => {
            return (
                bookMatchesTitleQuery(book) &&
                bookMatchesGenre(book, selectedGenre) &&
                bookMatchesAuthor(book, authorQuery)
            );
        });

        books = sortBooks(books, selectedSort);

        return books;
    }

    function setLoading(isLoading) {
        if (loadingEl) {
            loadingEl.hidden = !isLoading;
        }
    }

    function showEmpty(show) {
        if (emptyEl) {
            emptyEl.hidden = !show;
        }
    }

    function updateCount(count) {
        if (countEl) {
            countEl.textContent = Number(count || 0).toLocaleString("fa-IR");
        }
    }

    function renderCard(book) {
        if (!template || !gridEl) return;

        const clone = template.content.cloneNode(true);

        const link = clone.querySelector("[data-book-link]");
        const cover = clone.querySelector("[data-book-cover]");
        const fallback = clone.querySelector("[data-book-cover-fallback]");
        const badge = clone.querySelector("[data-book-type-badge]");
        const typeIcon = clone.querySelector("[data-book-type-icon]");
        const title = clone.querySelector("[data-book-title]");
        const author = clone.querySelector("[data-book-author]");
        const price = clone.querySelector("[data-book-price]");
        const oldPrice = clone.querySelector("[data-book-old-price]");

        const bookTitle = getBookTitle(book);
        const bookPhoto = getBookPhoto(book);
        const onlineBook = onlineBookMap.get(String(getBookId(book)));
        const isOnline = Boolean(onlineBook);
        const discountPercent = getDiscountPercent(book);

        if (link) {
            link.href = getBookUrl(book);
        }

        if (cover && fallback) {
            if (bookPhoto) {
                cover.src = bookPhoto;
                cover.alt = bookTitle;
                cover.hidden = false;
                fallback.hidden = true;
            } else {
                cover.removeAttribute("src");
                cover.alt = "";
                cover.hidden = true;
                fallback.hidden = false;
            }
        }

        if (badge) {
            badge.classList.toggle("is-online", isOnline);
            badge.classList.toggle("is-physical", !isOnline);
            badge.title = isOnline ? "کتاب آنلاین" : "کتاب فیزیکی";
        }

        if (typeIcon) {
            typeIcon.innerHTML = isOnline ? ONLINE_ICON : PHYSICAL_ICON;
        }

        if (title) {
            title.textContent = bookTitle;
        }

        if (author) {
            author.textContent = getBookAuthor(book);
        }

        if (price) {
            price.textContent = formatMoney(getDiscountedPrice(book));
        }

        if (oldPrice) {
            if (discountPercent) {
                oldPrice.hidden = false;
                oldPrice.textContent = formatMoney(getOriginalPrice(book));
            } else {
                oldPrice.hidden = true;
            }
        }

        gridEl.appendChild(clone);
    }

    function renderResults() {
        if (!gridEl) return;

        const books = getFilteredBooks();

        gridEl.innerHTML = "";

        books.forEach(book => {
            renderCard(book);
        });

        updateCount(books.length);
        showEmpty(!books.length);
    }

    function cycleSelect(select, direction) {
        if (!select) return;

        const maxIndex = select.options.length - 1;

        if (maxIndex < 0) return;

        let nextIndex = select.selectedIndex;

        if (direction === "up") {
            nextIndex -= 1;
        } else {
            nextIndex += 1;
        }

        if (nextIndex < 0) {
            nextIndex = maxIndex;
        }

        if (nextIndex > maxIndex) {
            nextIndex = 0;
        }

        select.selectedIndex = nextIndex;

        select.dispatchEvent(new Event("change", {
            bubbles: true
        }));
    }

    function bindFilters() {
        if (filterForm) {
            filterForm.addEventListener("submit", event => {
                event.preventDefault();
                renderResults();
            });
        }

        if (genreSelect) {
            genreSelect.addEventListener("change", renderResults);
        }

        if (sortSelect) {
            sortSelect.addEventListener("change", renderResults);
        }

        if (authorInput) {
            let authorTimer = null;

            authorInput.addEventListener("input", () => {
                window.clearTimeout(authorTimer);

                authorTimer = window.setTimeout(() => {
                    renderResults();
                }, 180);
            });
        }

        document.querySelectorAll("[data-step-select]").forEach(button => {
            button.addEventListener("click", () => {
                const selectId = button.dataset.stepSelect || "";
                const direction = button.dataset.stepDirection || "down";
                const select = document.getElementById(selectId);

                cycleSelect(select, direction);
            });
        });
    }

    function updateHeading() {
        if (titleEl) {
            titleEl.textContent = originalQuery
                ? `نتیجه جستجو برای «${originalQuery}»`
                : "جستجوی کتاب";
        }

        if (subtitleEl) {
            subtitleEl.textContent = originalQuery
                ? "برای دقیق‌تر شدن نتیجه‌ها می‌توانید دسته‌بندی، ترتیب یا نویسنده را تغییر دهید."
                : "با دسته‌بندی، ترتیب یا نام نویسنده می‌توانید کتاب مورد نظر خود را پیدا کنید.";
        }
    }

    async function loadSearchPage() {
        try {
            setLoading(true);
            showEmpty(false);
            updateHeading();

            const [books, onlineBooks, genres] = await Promise.all([
                fetchAllRows(BOOKS_API),
                fetchAllRows(ONLINE_BOOKS_API),
                fetchRows(GENRES_API).catch(() => [])
            ]);

            allBooks = books;
            onlineBookMap = buildOnlineBookMap(onlineBooks);

            const normalizedChoices = genres
                .map(normalizeGenreChoice)
                .filter(choice => choice.value && choice.label);

            genreChoices = normalizedChoices.length
                ? normalizedChoices
                : collectGenresFromBooks(allBooks);

            populateGenreSelect();
            bindFilters();

            renderResults();
            setLoading(false);

        } catch (error) {
            console.error("Search page load failed:", error);

            allBooks = [];
            updateCount(0);
            setLoading(false);
            showEmpty(true);
        }
    }

    loadSearchPage();
});