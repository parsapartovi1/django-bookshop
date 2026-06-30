document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("author-page");

    if (!page) return;

    const AUTHOR_API_BASE = page.dataset.authorApiBase || "/catalog/api/authors/";
    const BOOKS_API = page.dataset.booksApi || "/catalog/api/books/";
    const ONLINE_BOOKS_API = page.dataset.onlineBooksApi || "/catalog/api/online-books/";

    const authorStatus = document.getElementById("author-status");
    const authorName = document.getElementById("author-name");
    const authorBio = document.getElementById("author-bio");
    const authorPicture = document.getElementById("author-picture");
    const authorPictureFallback = document.getElementById("author-picture-fallback");

    const authorMetaRow = document.getElementById("author-meta-row");
    const authorBirthPill = document.getElementById("author-birth-pill");
    const authorBirthDate = document.getElementById("author-birth-date");
    const authorAgePill = document.getElementById("author-age-pill");
    const authorAge = document.getElementById("author-age");

    const booksCount = document.getElementById("author-books-count");
    const booksGrid = document.getElementById("author-books-grid");
    const emptyState = document.getElementById("author-empty-state");
    const bookTemplate = document.getElementById("author-book-template");

    const LANGUAGE_LABELS = {
        farsi: "فارسی",
        persian: "فارسی",
        fa: "فارسی",
        فارسی: "فارسی",

        english: "انگلیسی",
        en: "انگلیسی",
        انگلیسی: "انگلیسی",

        arabic: "عربی",
        ar: "عربی",
        عربی: "عربی",

        french: "فرانسوی",
        fr: "فرانسوی",
        فرانسوی: "فرانسوی",

        german: "آلمانی",
        de: "آلمانی",
        آلمانی: "آلمانی",
    };

    const LEVEL_LABELS = {
        child: "کودک",
        children: "کودک",
        kids: "کودک",
        kid: "کودک",
        کودک: "کودک",

        teenager: "نوجوان",
        teen: "نوجوان",
        نوجوان: "نوجوان",

        young_adult: "جوان",
        "young adult": "جوان",
        youngadult: "جوان",
        جوان: "جوان",

        adult: "بزرگسال",
        بزرگسال: "بزرگسال",

        beginner: "مبتدی",
        مبتدی: "مبتدی",

        intermediate: "متوسط",
        متوسط: "متوسط",

        advanced: "پیشرفته",
        پیشرفته: "پیشرفته",
    };

    function toPersianDigits(value) {
        return String(value ?? "").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function numberValue(value) {
        const number = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
        return Number.isFinite(number) ? number : 0;
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("fa-IR")} تومان`;
    }

    function normalizeTextValue(value) {
        return String(value || "")
            .replace(/_/g, " ")
            .trim();
    }

    function labelFromMap(value, map, fallback = "نامشخص") {
        const raw = String(value || "").trim();

        if (!raw) return fallback;

        const key = raw.toLowerCase().trim();

        if (map[key]) return map[key];

        const normalizedKey = key.replace(/\s+/g, "_");

        if (map[normalizedKey]) return map[normalizedKey];

        return normalizeTextValue(raw);
    }

    function getAuthorIdFromUrl() {
        const match = window.location.pathname.match(/\/authors\/(\d+)\/?/);
        return match ? String(match[1]) : "";
    }

    function buildAbsoluteUrl(value) {
        if (!value) return "";

        const stringValue = String(value);

        if (
            stringValue.startsWith("http://") ||
            stringValue.startsWith("https://")
        ) {
            return stringValue;
        }

        if (stringValue.startsWith("/")) {
            return stringValue;
        }

        return `/${stringValue}`;
    }

    function showStatus(message) {
        if (!authorStatus) return;

        authorStatus.hidden = false;
        authorStatus.textContent = message;
    }

    function hideStatus() {
        if (!authorStatus) return;

        authorStatus.hidden = true;
        authorStatus.textContent = "";
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

    function calculateAge(birthDateValue) {
        if (!birthDateValue) return "";

        const birthDate = new Date(birthDateValue);

        if (Number.isNaN(birthDate.getTime())) return "";

        const today = new Date();

        let age = today.getFullYear() - birthDate.getFullYear();

        const monthDiff = today.getMonth() - birthDate.getMonth();
        const dayDiff = today.getDate() - birthDate.getDate();

        if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
            age -= 1;
        }

        if (age < 0 || age > 150) return "";

        return age;
    }

    async function requestJson(url, allowFail = false) {
        try {
            const response = await fetch(url, {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json",
                },
            });

            if (!response.ok) {
                if (allowFail) return null;
                throw new Error(`request failed: ${response.status}`);
            }

            return response.json();
        } catch (error) {
            if (allowFail) return null;
            throw error;
        }
    }

    function getListFromResponse(data) {
        const candidates = [
            data?.books,
            data?.author_books,
            data?.results,
            data?.items,
            data?.data,
            data,
        ];

        for (const item of candidates) {
            if (Array.isArray(item)) return item;
        }

        return [];
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

    function getOnlineBookBookId(item) {
        if (!item) return "";

        if (item.book_id) return String(item.book_id);
        if (item.bookId) return String(item.bookId);

        if (item.book) {
            if (typeof item.book === "object") {
                return String(item.book.id || item.book.pk || "");
            }

            return String(item.book);
        }

        return "";
    }

    function buildOnlineBookIdSet(onlineBooks) {
        const set = new Set();

        onlineBooks.forEach(item => {
            const bookId = getOnlineBookBookId(item);

            if (bookId) {
                set.add(bookId);
            }
        });

        return set;
    }

    function getAuthorFromResponse(data) {
        if (!data) return null;

        if (data.author && typeof data.author === "object") return data.author;

        if (
            data.data &&
            typeof data.data === "object" &&
            !Array.isArray(data.data)
        ) {
            return data.data;
        }

        if (data.id || data.name || data.bio || data.picture || data.photo) {
            return data;
        }

        return null;
    }

    function getNestedBookObject(book) {
        if (book.book && typeof book.book === "object") return book.book;
        if (book.book_data && typeof book.book_data === "object") return book.book_data;
        if (book.book_info && typeof book.book_info === "object") return book.book_info;

        return {};
    }

    function getBookAuthorId(book) {
        const nestedBook = getNestedBookObject(book);

        if (book.author_id) return String(book.author_id);
        if (book.book_author_id) return String(book.book_author_id);

        if (nestedBook.author_id) return String(nestedBook.author_id);
        if (nestedBook.book_author_id) return String(nestedBook.book_author_id);

        if (book.author && typeof book.author === "object") {
            return String(book.author.id || book.author.pk || "");
        }

        if (nestedBook.author && typeof nestedBook.author === "object") {
            return String(nestedBook.author.id || nestedBook.author.pk || "");
        }

        return "";
    }

    function getAuthorName(author) {
        if (!author) return "نویسنده بدون نام";

        return (
            author.name ||
            author.author ||
            author.fullname ||
            author.title ||
            "نویسنده بدون نام"
        );
    }

    function getAuthorPicture(author) {
        if (!author) return "";

        return buildAbsoluteUrl(
            author.picture ||
            author.photo ||
            author.image ||
            author.author_photo ||
            author.photo_url ||
            ""
        );
    }

    function getAuthorBio(author) {
        if (!author) return "";

        return String(author.bio || author.description || "").trim();
    }

    function getAuthorBirthDate(author) {
        if (!author) return "";

        return author.birth_date || author.birthDate || "";
    }

    function getAuthorFromBooks(books, authorId) {
        const targetBook = books.find(book => {
            return getBookAuthorId(book) === String(authorId);
        });

        if (!targetBook) return null;

        if (targetBook.author && typeof targetBook.author === "object") {
            return targetBook.author;
        }

        const nestedBook = getNestedBookObject(targetBook);

        if (nestedBook.author && typeof nestedBook.author === "object") {
            return nestedBook.author;
        }

        return {
            id: authorId,
            name:
                targetBook.author_name ||
                targetBook.author ||
                nestedBook.author_name ||
                nestedBook.author ||
                "نویسنده بدون نام",
            picture:
                targetBook.author_picture ||
                targetBook.author_photo ||
                "",
            bio: "",
        };
    }

    function getBookId(book) {
        const nestedBook = getNestedBookObject(book);

        return (
            book.id ||
            book.book_id ||
            book.pk ||
            nestedBook.id ||
            nestedBook.book_id ||
            nestedBook.pk
        );
    }

    function getBookTitle(book) {
        const nestedBook = getNestedBookObject(book);

        const value =
            book.name ||
            book.title ||
            book.book ||
            book.book_name ||
            nestedBook.name ||
            nestedBook.title ||
            nestedBook.book ||
            "کتاب بدون نام";

        if (typeof value === "object") return "کتاب بدون نام";

        return value;
    }

    function getBookPhoto(book) {
        const nestedBook = getNestedBookObject(book);

        return buildAbsoluteUrl(
            book.book_photo ||
            book.photo ||
            book.image ||
            book.cover ||
            nestedBook.book_photo ||
            nestedBook.photo ||
            nestedBook.image ||
            nestedBook.cover ||
            ""
        );
    }

    function getBookLanguage(book) {
        const nestedBook = getNestedBookObject(book);

        return (
            book.language_display ||
            book.book_language_display ||
            book.language ||
            book.book_language ||
            book.bookLanguage ||
            book.lang ||
            nestedBook.language_display ||
            nestedBook.book_language_display ||
            nestedBook.language ||
            nestedBook.book_language ||
            nestedBook.lang ||
            ""
        );
    }

    function getBookLevel(book) {
        const nestedBook = getNestedBookObject(book);

        return (
            book.level_display ||
            book.book_level_display ||
            book.level ||
            book.book_level ||
            book.bookLevel ||
            book.reader_level ||
            book.readerLevel ||
            nestedBook.level_display ||
            nestedBook.book_level_display ||
            nestedBook.level ||
            nestedBook.book_level ||
            nestedBook.reader_level ||
            ""
        );
    }

    function getBookPrice(book) {
        const nestedBook = getNestedBookObject(book);

        return (
            book.discounted_price ||
            book.final_price ||
            book.price ||
            nestedBook.discounted_price ||
            nestedBook.final_price ||
            nestedBook.price ||
            0
        );
    }

    function getBookOldPrice(book) {
        const nestedBook = getNestedBookObject(book);

        const price = numberValue(book.price || nestedBook.price);
        const discounted = numberValue(
            book.discounted_price ||
            book.final_price ||
            nestedBook.discounted_price ||
            nestedBook.final_price
        );

        if (discounted && price && discounted < price) {
            return price;
        }

        return 0;
    }

    function hasDiscount(book) {
        return getBookOldPrice(book) > 0;
    }

    function filterBooksByAuthor(list, authorId) {
        return list.filter(book => {
            return getBookAuthorId(book) === String(authorId);
        });
    }

    function getPhysicalBookIcon() {
        return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 4h10.5A2.5 2.5 0 0 1 19 6.5V20H7a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2z"></path>
                <path d="M7 4v13a3 3 0 0 0-3 3"></path>
                <path d="M9 8h6"></path>
                <path d="M9 12h5"></path>
            </svg>
        `;
    }

    function getOnlineBookIcon() {
        return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="5" width="16" height="12" rx="2"></rect>
                <path d="M8 21h8"></path>
                <path d="M12 17v4"></path>
                <path d="M8 9h8"></path>
                <path d="M8 13h5"></path>
            </svg>
        `;
    }

    function getBookTypeIcon(type) {
        return type === "online" ? getOnlineBookIcon() : getPhysicalBookIcon();
    }

    function normalizeAuthorBooks(list, onlineBookIdSet = new Set()) {
        return list
            .map(book => {
                const bookId = getBookId(book);
                const languageValue = getBookLanguage(book);
                const levelValue = getBookLevel(book);
                const isOnline = onlineBookIdSet.has(String(bookId));

                return {
                    id: bookId,
                    title: getBookTitle(book),
                    photo: getBookPhoto(book),
                    price: getBookPrice(book),
                    oldPrice: getBookOldPrice(book),
                    language: labelFromMap(languageValue, LANGUAGE_LABELS, "زبان نامشخص"),
                    level: labelFromMap(levelValue, LEVEL_LABELS, "سطح نامشخص"),
                    type: isOnline ? "online" : "physical",
                    typeLabel: isOnline ? "کتاب آنلاین" : "کتاب فیزیکی",
                    hasDiscount: hasDiscount(book),
                    raw: book,
                };
            })
            .filter(book => book.id);
    }

    function renderAuthor(author, books) {
        const name = getAuthorName(author);
        const picture = getAuthorPicture(author);
        const bio = getAuthorBio(author);
        const birthDate = getAuthorBirthDate(author);
        const age = calculateAge(birthDate);

        if (authorName) {
            authorName.textContent = name;
        }

        if (authorBio) {
            authorBio.textContent = bio || "کتاب‌های این نویسنده در ادامه نمایش داده می‌شوند.";
        }

        if (authorBirthPill && authorBirthDate) {
            if (birthDate) {
                authorBirthPill.hidden = false;
                authorBirthDate.textContent = formatDate(birthDate);
            } else {
                authorBirthPill.hidden = true;
            }
        }

        if (authorAgePill && authorAge) {
            if (age) {
                authorAgePill.hidden = false;
                authorAge.textContent = `${toPersianDigits(age)} سال`;
            } else {
                authorAgePill.hidden = true;
            }
        }

        if (authorMetaRow) {
            authorMetaRow.hidden = !(birthDate || age);
        }

        if (authorPicture && authorPictureFallback) {
            if (picture) {
                authorPicture.src = picture;
                authorPicture.alt = name;
                authorPicture.hidden = false;
                authorPictureFallback.hidden = true;

                authorPicture.addEventListener("error", () => {
                    authorPicture.hidden = true;
                    authorPictureFallback.hidden = false;
                    authorPictureFallback.textContent = name.slice(0, 12);
                });
            } else {
                authorPicture.hidden = true;
                authorPictureFallback.hidden = false;
                authorPictureFallback.textContent = name.slice(0, 12);
            }
        }
    }

    function renderBooks(books) {
        if (!booksGrid || !emptyState || !bookTemplate) return;

        booksGrid.innerHTML = "";

        if (!books.length) {
            emptyState.hidden = false;

            if (booksCount) {
                booksCount.textContent = "هیچ کتابی برای این نویسنده پیدا نشد";
            }

            return;
        }

        emptyState.hidden = true;

        if (booksCount) {
            booksCount.textContent = `${toPersianDigits(books.length)} کتاب`;
        }

        books.forEach(book => {
            const clone = bookTemplate.content.cloneNode(true);

            const links = clone.querySelectorAll("[data-book-link]");
            const cover = clone.querySelector("[data-book-cover]");
            const coverFallback = clone.querySelector("[data-book-cover-fallback]");
            const title = clone.querySelector("[data-book-title]");
            const language = clone.querySelector("[data-book-language]");
            const level = clone.querySelector("[data-book-level]");
            const price = clone.querySelector("[data-book-price]");
            const oldPrice = clone.querySelector("[data-book-old-price]");
            const discountBadge = clone.querySelector("[data-book-discount]");
            const typeBadge = clone.querySelector("[data-book-type-badge]");

            const bookUrl = `/ketabook/books/${book.id}/`;

            links.forEach(link => {
                link.href = bookUrl;
            });

            title.textContent = book.title;
            language.textContent = book.language;
            level.textContent = book.level;
            price.textContent = formatMoney(book.price);

            if (book.oldPrice) {
                oldPrice.hidden = false;
                oldPrice.textContent = formatMoney(book.oldPrice);
            } else {
                oldPrice.hidden = true;
            }

            if (book.hasDiscount) {
                discountBadge.hidden = false;
                discountBadge.textContent = "تخفیف";
            } else {
                discountBadge.hidden = true;
            }

            if (typeBadge) {
                const typeIcon = typeBadge.querySelector("[data-book-type-icon]");

                typeBadge.classList.toggle("is-online", book.type === "online");
                typeBadge.classList.toggle("is-physical", book.type !== "online");
                typeBadge.setAttribute("title", book.typeLabel);

                if (typeIcon) {
                    typeIcon.innerHTML = getBookTypeIcon(book.type);
                }
            }

            if (book.photo) {
                cover.src = book.photo;
                cover.alt = book.title;
                cover.hidden = false;
                coverFallback.hidden = true;

                cover.addEventListener("error", () => {
                    cover.hidden = true;
                    coverFallback.hidden = false;
                });
            } else {
                cover.hidden = true;
                coverFallback.hidden = false;
            }

            booksGrid.appendChild(clone);
        });
    }

    async function loadAuthorPage() {
        const authorId = getAuthorIdFromUrl();

        if (!authorId) {
            showStatus("شناسه نویسنده پیدا نشد.");
            return;
        }

        hideStatus();

        if (authorName) {
            authorName.textContent = "در حال دریافت اطلاعات نویسنده...";
        }

        if (booksCount) {
            booksCount.textContent = "در حال دریافت کتاب‌ها...";
        }

        try {
            const authorData = await requestJson(
                `${AUTHOR_API_BASE}${authorId}/`,
                true
            );

            let author = getAuthorFromResponse(authorData);
            let books = getListFromResponse(authorData);

            if (!books.length) {
                const filteredBooksData = await requestJson(
                    `${BOOKS_API}?author=${authorId}`,
                    true
                );

                books = getListFromResponse(filteredBooksData);
            }

            if (!books.length) {
                const allBooksData = await requestJson(BOOKS_API, false);
                const allBooks = getListFromResponse(allBooksData);

                books = filterBooksByAuthor(allBooks, authorId);

                if (!author) {
                    author = getAuthorFromBooks(allBooks, authorId);
                }
            }

            if (!author && books.length) {
                author = getAuthorFromBooks(books, authorId);
            }

            if (!author) {
                author = {
                    id: authorId,
                    name: `نویسنده شماره ${toPersianDigits(authorId)}`,
                    picture: "",
                    bio: "",
                };
            }

            const onlineBooksData = await requestJson(ONLINE_BOOKS_API, true);
            const onlineBooks = getOnlineBooksFromResponse(onlineBooksData);
            const onlineBookIdSet = buildOnlineBookIdSet(onlineBooks);

            const normalizedBooks = normalizeAuthorBooks(books, onlineBookIdSet);

            renderAuthor(author, normalizedBooks);
            renderBooks(normalizedBooks);
        } catch (error) {
            console.error("Author page failed:", error);

            showStatus("دریافت اطلاعات نویسنده انجام نشد.");

            if (authorName) {
                authorName.textContent = "نویسنده پیدا نشد";
            }

            if (booksCount) {
                booksCount.textContent = "دریافت کتاب‌ها انجام نشد";
            }

            renderBooks([]);
        }
    }

    loadAuthorPage();
});