document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("genre-page");

    if (!page) return;

    const BOOKS_API = page.dataset.booksApi || "/catalog/api/books/";
    const ONLINE_BOOKS_API = page.dataset.onlineBooksApi || "/catalog/api/online-books/";

    const pageTitle = document.getElementById("genre-page-title");
    const pageSubtitle = document.getElementById("genre-page-subtitle");
    const booksCount = document.getElementById("genre-books-count");
    const searchInput = document.getElementById("genre-search-input");
    const booksGrid = document.getElementById("genre-books-grid");
    const emptyState = document.getElementById("genre-empty-state");
    const bookTemplate = document.getElementById("genre-book-template");

    let allGenreBooks = [];
    let currentOnlineBookIds = new Set();
    let currentOnlineBookMap = new Map();

    const GENRE_DATA = {
        mystery: {
            title: "جنایی",
            subtitle: "کتاب‌های جنایی، معمایی و پرتعلیق",
            aliases: ["mystery", "Mystery", "معمایی", "جنایی", "crime", "Crime"],
        },
        romance: {
            title: "عاشقانه",
            subtitle: "داستان‌های عاشقانه و احساسی",
            aliases: ["romance", "Romance", "عاشقانه"],
        },
        fantasy: {
            title: "فانتزی",
            subtitle: "دنیاهای جادویی و خیال‌انگیز",
            aliases: ["fantasy", "Fantasy", "فانتزی"],
        },
        horror: {
            title: "ترسناک",
            subtitle: "کتاب‌های دلهره‌آور و ترسناک",
            aliases: ["horror", "Horror", "ترسناک"],
        },
        historical: {
            title: "تاریخی",
            subtitle: "روایت‌هایی از گذشته و تاریخ",
            aliases: ["historical", "Historical", "تاریخی"],
        },
        business: {
            title: "کسب و کار",
            subtitle: "کتاب‌های رشد، مدیریت و موفقیت",
            aliases: ["business", "Business", "کسب و کار", "کسب‌وکار"],
        },
        adventure: {
            title: "ماجراجویی",
            subtitle: "داستان‌های پرهیجان و ماجراجویانه",
            aliases: ["adventure", "Adventure", "ماجراجویی"],
        },
        science: {
            title: "علمی",
            subtitle: "کتاب‌های علمی و دانستنی",
            aliases: ["science", "Science", "علمی"],
        },
        educational: {
            title: "آموزشی",
            subtitle: "کتاب‌های آموزشی و کاربردی",
            aliases: ["educational", "Educational", "آموزشی"],
        },
        biography: {
            title: "زندگی‌نامه",
            subtitle: "زندگی افراد الهام‌بخش",
            aliases: ["biography", "Biography", "زندگی‌نامه", "زندگینامه"],
        },
        self_help: {
            title: "خودیاری",
            subtitle: "رشد فردی و توسعه شخصی",
            aliases: ["self_help", "Self help", "Self Help", "خودیاری"],
        },
        religion: {
            title: "مذهبی",
            subtitle: "کتاب‌های مذهبی و معنوی",
            aliases: ["religion", "Religion", "مذهبی"],
        },
    };

    const BOOK_TYPE_ICONS = {
        online: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 17V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"></path>
                <path d="M8 21h8"></path>
                <path d="M12 17v4"></path>
                <path d="M8 10h8"></path>
                <path d="M8 14h5"></path>
            </svg>
        `,
        physical: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"></path>
                <path d="M8 4v16"></path>
                <path d="M9 8h6"></path>
            </svg>
        `,
    };

    function getGenreSlugFromUrl() {
        const parts = window.location.pathname.split("/").filter(Boolean);
        const index = parts.indexOf("genres");

        if (index >= 0 && parts[index + 1]) {
            return decodeURIComponent(parts[index + 1]);
        }

        const params = new URLSearchParams(window.location.search);

        return params.get("genre") || "";
    }

    function normalizeText(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/‌/g, " ")
            .replace(/_/g, " ")
            .replace(/-/g, " ")
            .replace(/\s+/g, " ");
    }

    function numberValue(value) {
        const number = Number(String(value ?? "").replace(/[^\d.]/g, ""));

        return Number.isFinite(number) ? number : 0;
    }

    function toPersianDigits(value) {
        return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("fa-IR")} تومان`;
    }

    async function fetchJson(url) {
        const response = await fetch(url, {
            method: "GET",
            credentials: "same-origin",
            headers: {
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`${url} request failed`);
        }

        return response.json();
    }

    async function fetchBooks() {
        return fetchJson(BOOKS_API);
    }

    async function fetchOnlineBooks() {
        try {
            return await fetchJson(ONLINE_BOOKS_API);
        } catch (error) {
            console.warn("Online books request failed:", error);
            return [];
        }
    }

    function getBooks(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.books)) return payload.books;
        if (Array.isArray(payload?.results)) return payload.results;
        if (Array.isArray(payload?.items)) return payload.items;

        return [];
    }

    function getOnlineBookRows(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.online_books)) return payload.online_books;
        if (Array.isArray(payload?.results)) return payload.results;
        if (Array.isArray(payload?.items)) return payload.items;

        return [];
    }

    function getOnlineBookId(item) {
        return item?.id || item?.online_book_id || item?.pk || "";
    }

    function getOnlineBookBookIds(item) {
        const ids = [];

        if (!item) return ids;

        if (typeof item.book === "number" || typeof item.book === "string") {
            ids.push(item.book);
        }

        if (typeof item.book === "object" && item.book !== null) {
            if (item.book.id) ids.push(item.book.id);
            if (item.book.pk) ids.push(item.book.pk);
            if (item.book.book_id) ids.push(item.book.book_id);
        }

        if (item.book_id) ids.push(item.book_id);

        if (typeof item.book_detail === "object" && item.book_detail !== null) {
            if (item.book_detail.id) ids.push(item.book_detail.id);
            if (item.book_detail.pk) ids.push(item.book_detail.pk);
            if (item.book_detail.book_id) ids.push(item.book_detail.book_id);
        }

        return ids.filter(Boolean);
    }

    function getOnlineBookIdSet(payload) {
        const rows = getOnlineBookRows(payload);
        const ids = new Set();

        rows.forEach(item => {
            getOnlineBookBookIds(item).forEach(bookId => {
                ids.add(String(bookId));
            });
        });

        return ids;
    }

    function getOnlineBookMap(payload) {
        const rows = getOnlineBookRows(payload);
        const map = new Map();

        rows.forEach(item => {
            const onlineBookId = getOnlineBookId(item);

            if (!onlineBookId) return;

            getOnlineBookBookIds(item).forEach(bookId => {
                map.set(String(bookId), item);
            });
        });

        return map;
    }

    function getBookId(book) {
        return book.id || book.book_id || book.pk || "";
    }

    function getBookTitle(book) {
        return book.book || book.name || book.title || "نام کتاب";
    }

    function getBookAuthor(book) {
        if (typeof book.author === "object" && book.author !== null) {
            return book.author.name || "نام نویسنده";
        }

        if (typeof book.author_detail === "object" && book.author_detail !== null) {
            return book.author_detail.name || "نام نویسنده";
        }

        return book.author || book.author_name || "نام نویسنده";
    }

    function getBookCover(book) {
        return (
            book.book_photo ||
            book.photo ||
            book.image ||
            book.cover ||
            ""
        );
    }

    function getOriginalPrice(book) {
        return (
            book.price ??
            book.original_price ??
            book.book_price ??
            0
        );
    }

    function getDiscountedPrice(book) {
        return (
            book.discounted_price ??
            book.final_price ??
            book.payable_price ??
            book.price ??
            0
        );
    }

    function getDiscountPercent(book) {
        const original = numberValue(getOriginalPrice(book));
        const discounted = numberValue(getDiscountedPrice(book));

        if (!original || !discounted || discounted >= original) return 0;

        return Math.round(((original - discounted) / original) * 100);
    }

    function getOnlineBookForBook(book, onlineBookMap) {
        const bookId = getBookId(book);

        if (!bookId) return null;

        return onlineBookMap.get(String(bookId)) || null;
    }

    function getBookUrl(book, onlineBookMap = new Map()) {
        const bookId = getBookId(book);

        if (!bookId) return "#";

        const onlineBook = getOnlineBookForBook(book, onlineBookMap);
        const onlineBookId = onlineBook ? getOnlineBookId(onlineBook) : "";

        if (onlineBookId) {
            return `/ketabook/books/${bookId}/?online_book=${onlineBookId}`;
        }

        return `/ketabook/books/${bookId}/`;
    }

    function getBookGenreTexts(book) {
        const genres = Array.isArray(book.genres) ? book.genres : [];
        const texts = [];

        genres.forEach(genre => {
            if (typeof genre === "string") {
                texts.push(genre);
                return;
            }

            if (typeof genre === "object" && genre !== null) {
                texts.push(genre.value);
                texts.push(genre.label);
                texts.push(genre.title);
                texts.push(genre.name);
            }
        });

        if (book.genre) texts.push(book.genre);
        if (book.genre_name) texts.push(book.genre_name);
        if (book.category) texts.push(book.category);

        return texts
            .filter(Boolean)
            .map(normalizeText);
    }

    function bookMatchesGenre(book, genre) {
        if (!genre) return true;

        const bookGenres = getBookGenreTexts(book);
        const aliases = genre.aliases.map(normalizeText);

        return bookGenres.some(item => aliases.includes(item));
    }

    function bookMatchesSearch(book, query) {
        const cleanQuery = normalizeText(query);

        if (!cleanQuery) return true;

        const searchable = [
            getBookTitle(book),
            getBookAuthor(book),
            ...getBookGenreTexts(book),
        ].map(normalizeText);

        return searchable.some(item => item.includes(cleanQuery));
    }

    function isBookOnline(book, onlineBookIds) {
        const bookId = getBookId(book);

        if (bookId && onlineBookIds.has(String(bookId))) {
            return true;
        }

        return Boolean(
            book.is_online ||
            book.online ||
            book.online_book ||
            book.online_book_id ||
            book.has_online_book ||
            book.reader_url ||
            book.file_url ||
            book.access_type === "online" ||
            book.type === "online" ||
            book.format === "online" ||
            book.format === "pdf" ||
            book.book_format === "online"
        );
    }

    function renderBookTypeBadge(book, onlineBookIds, card) {
        const badge = card.querySelector("[data-book-type-badge]");
        const iconBox = card.querySelector("[data-book-type-icon]");

        if (!badge || !iconBox) return;

        const online = isBookOnline(book, onlineBookIds);

        badge.classList.toggle("is-online", online);
        badge.classList.toggle("is-physical", !online);

        badge.title = online ? "نسخه آنلاین" : "نسخه فیزیکی";
        badge.setAttribute("aria-label", online ? "نسخه آنلاین" : "نسخه فیزیکی");

        iconBox.innerHTML = online ? BOOK_TYPE_ICONS.online : BOOK_TYPE_ICONS.physical;
    }

    function setImage(cover, fallback, bookCover, bookTitle) {
        if (!cover || !fallback) return;

        if (bookCover) {
            cover.src = bookCover;
            cover.alt = bookTitle;
            cover.hidden = false;
            fallback.hidden = true;
        } else {
            cover.hidden = true;
            fallback.hidden = false;
        }
    }

    function renderBookCard(book, onlineBookIds, onlineBookMap) {
        if (!bookTemplate) return null;

        const clone = bookTemplate.content.cloneNode(true);

        const card = clone.querySelector("[data-book-card]");
        const link = clone.querySelector("[data-book-link]");
        const cover = clone.querySelector("[data-book-cover]");
        const coverFallback = clone.querySelector("[data-book-cover-fallback]");
        const title = clone.querySelector("[data-book-title]");
        const author = clone.querySelector("[data-book-author]");
        const price = clone.querySelector("[data-book-price]");
        const oldPrice = clone.querySelector("[data-book-old-price]");

        const bookTitle = getBookTitle(book);
        const bookCover = getBookCover(book);
        const bookUrl = getBookUrl(book, onlineBookMap);

        const originalPrice = numberValue(getOriginalPrice(book));
        const discountedPrice = numberValue(getDiscountedPrice(book));
        const percent = getDiscountPercent(book);

        if (card) {
            card.dataset.bookId = String(getBookId(book));
        }

        if (link) {
            link.href = bookUrl;
        }

        if (title) {
            title.textContent = bookTitle;
        }

        if (author) {
            author.textContent = getBookAuthor(book);
        }

        if (price) {
            price.textContent = formatMoney(discountedPrice || originalPrice);
        }

        if (oldPrice) {
            if (percent) {
                oldPrice.hidden = false;
                oldPrice.textContent = formatMoney(originalPrice);
            } else {
                oldPrice.hidden = true;
            }
        }

        setImage(cover, coverFallback, bookCover, bookTitle);

        if (card) {
            renderBookTypeBadge(book, onlineBookIds, card);
        }

        return clone;
    }

    function updateCount(count) {
        if (booksCount) {
            booksCount.textContent = toPersianDigits(count);
        }
    }

    function renderBooks(
        books,
        onlineBookIds = new Set(),
        onlineBookMap = new Map()
    ) {
        if (!booksGrid || !emptyState) return;

        booksGrid.innerHTML = "";

        const safeBooks = Array.isArray(books) ? books : [];

        updateCount(safeBooks.length);

        if (!safeBooks.length) {
            emptyState.hidden = false;
            return;
        }

        emptyState.hidden = true;

        safeBooks.forEach(book => {
            const card = renderBookCard(book, onlineBookIds, onlineBookMap);

            if (card) {
                booksGrid.appendChild(card);
            }
        });
    }

    function renderFilteredBooks() {
        const query = searchInput ? searchInput.value : "";

        const filtered = allGenreBooks.filter(book => {
            return bookMatchesSearch(book, query);
        });

        renderBooks(filtered, currentOnlineBookIds, currentOnlineBookMap);
    }

    function setupSearch() {
        if (!searchInput) return;

        searchInput.addEventListener("input", () => {
            renderFilteredBooks();
        });
    }

    function setupGenreHeader(genreSlug, genre) {
        const title = genre?.title || genreSlug || "کتاب‌ها";
        const subtitle = genre?.subtitle || "کتاب‌های مرتبط با این دسته‌بندی";

        document.title = `${title} | کتابوک`;

        if (pageTitle) {
            pageTitle.textContent = title;
        }

        if (pageSubtitle) {
            pageSubtitle.textContent = subtitle;
        }
    }

    async function initGenrePage() {
        setupSearch();

        const genreSlug = getGenreSlugFromUrl();

        const genre = GENRE_DATA[genreSlug] || {
            title: genreSlug || "کتاب‌ها",
            subtitle: "کتاب‌های مرتبط با این دسته‌بندی",
            aliases: [genreSlug],
        };

        setupGenreHeader(genreSlug, genre);

        try {
            const [booksPayload, onlineBooksPayload] = await Promise.all([
                fetchBooks(),
                fetchOnlineBooks(),
            ]);

            const allBooks = getBooks(booksPayload);

            currentOnlineBookIds = getOnlineBookIdSet(onlineBooksPayload);
            currentOnlineBookMap = getOnlineBookMap(onlineBooksPayload);

            allGenreBooks = allBooks.filter(book => bookMatchesGenre(book, genre));

            renderFilteredBooks();

        } catch (error) {
            console.error("Genre page load failed:", error);

            allGenreBooks = [];

            if (pageTitle) {
                pageTitle.textContent = "دریافت کتاب‌ها انجام نشد";
            }

            if (pageSubtitle) {
                pageSubtitle.textContent = "لطفاً دوباره صفحه را بارگذاری کنید.";
            }

            renderBooks([], currentOnlineBookIds, currentOnlineBookMap);
        }
    }

    initGenrePage();
});