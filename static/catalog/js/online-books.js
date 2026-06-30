document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("online-books-page");

    if (!page) return;

    const ONLINE_BOOKS_API = page.dataset.onlineBooksApi || "/catalog/api/online-books/";
    const BOOKS_API = page.dataset.booksApi || "/catalog/api/books/";
    const GENRES_API = page.dataset.genresApi || "/catalog/api/genres/choices/";
    const HOME_URL = page.dataset.homeUrl || "/ketabook/";

    const genreList = document.getElementById("online-books-genres-list");
    const statusEl = document.getElementById("online-books-status");
    const sectionsEl = document.getElementById("online-books-sections");
    const emptyEl = document.getElementById("online-books-empty-state");

    const discountSection = document.getElementById("online-books-discount-section");
    const discountGrid = document.getElementById("online-books-discount-grid");
    const discountSeeAll = document.getElementById("online-books-discount-see-all");

    const template = document.getElementById("online-book-card-template");

    let allEntries = [];
    let genreChoices = [];
    let activeGenre = "all";

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
        religion: "مذهبی"
    };

    const GENRE_ICONS = {
        adventure: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z"></path></svg>`,
        fantasy: `<svg viewBox="0 0 24 24"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"></path><path d="M19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8z"></path></svg>`,
        science: `<svg viewBox="0 0 24 24"><path d="M10 2v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8V2"></path><path d="M8 2h8"></path><path d="M7 16h10"></path></svg>`,
        mystery: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path><path d="M11 8v.1"></path><path d="M9.8 13a2 2 0 0 1 1.5-3.3 2 2 0 0 1 .7 3.9"></path></svg>`,
        romance: `<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>`,
        horror: `<svg viewBox="0 0 24 24"><path d="M4 13a8 8 0 1 1 16 0v7l-3-2-2 2-3-2-3 2-2-2-3 2z"></path><path d="M9 10h.01"></path><path d="M15 10h.01"></path><path d="M10 15h4"></path></svg>`,
        comedy: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M8 10h.01"></path><path d="M16 10h.01"></path><path d="M8 15s1.5 2 4 2 4-2 4-2"></path></svg>`,
        historical: `<svg viewBox="0 0 24 24"><path d="M6 3h11a3 3 0 0 1 0 6H6z"></path><path d="M6 9h12a3 3 0 0 1 0 6H6z"></path><path d="M6 15h10a3 3 0 0 1 0 6H6z"></path></svg>`,
        biography: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>`,
        self_help: `<svg viewBox="0 0 24 24"><path d="M12 21s-6-4.5-6-10a6 6 0 0 1 12 0c0 5.5-6 10-6 10z"></path><path d="M12 11v6"></path><path d="M9 14h6"></path></svg>`,
        educational: `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"></path></svg>`,
        business: `<svg viewBox="0 0 24 24"><path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1"></path><rect x="3" y="6" width="18" height="14" rx="2"></rect><path d="M3 12h18"></path></svg>`,
        religion: `<svg viewBox="0 0 24 24"><path d="M12 3l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 18.8 5.8 22 7 15.2l-5-4.9 6.9-1z"></path></svg>`,
        all: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8"></path><path d="M12 16v4"></path></svg>`
    };

    function setStatus(message) {
        if (!statusEl) return;

        statusEl.hidden = !message;
        statusEl.textContent = message || "";
    }

    function showEmpty(show) {
        if (emptyEl) {
            emptyEl.hidden = !show;
        }
    }

    function toPersianDigits(value) {
        return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function numberValue(value) {
        const number = Number(String(value ?? "").replace(/[^\d.]/g, ""));

        return Number.isFinite(number) ? number : 0;
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("fa-IR")} تومان`;
    }

    function firstNonEmpty(...values) {
        return values.find(value => value !== undefined && value !== null && String(value).trim() !== "") || "";
    }

    function getRows(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.results)) return payload.results;
        if (Array.isArray(payload?.online_books)) return payload.online_books;
        if (Array.isArray(payload?.books)) return payload.books;
        if (Array.isArray(payload?.items)) return payload.items;
        if (Array.isArray(payload?.data)) return payload.data;

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

    async function fetchJsonRows(apiUrl) {
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

    function buildBookMap(books) {
        const map = new Map();

        if (!Array.isArray(books)) return map;

        books.forEach(book => {
            const id = getBookId(book);

            if (id) {
                map.set(String(id), book);
            }
        });

        return map;
    }

    function getNestedBook(onlineBook) {
        if (!onlineBook) return null;

        if (typeof onlineBook.book === "object" && onlineBook.book !== null) {
            return onlineBook.book;
        }

        if (typeof onlineBook.book_detail === "object" && onlineBook.book_detail !== null) {
            return onlineBook.book_detail;
        }

        return null;
    }

    function buildEntries(onlineBooks, bookMap) {
        if (!Array.isArray(onlineBooks)) return [];

        return onlineBooks
            .map(onlineBook => {
                const ids = getOnlineBookBookIds(onlineBook);
                const nestedBook = getNestedBook(onlineBook);

                let book = nestedBook;

                if (!book && ids.length) {
                    book = bookMap.get(String(ids[0])) || null;
                }

                if (!book) {
                    book = {
                        id: ids[0] || "",
                        name: onlineBook.book_name || onlineBook.name || onlineBook.online_book_name || "کتاب آنلاین",
                        book_photo: onlineBook.cover || onlineBook.photo || onlineBook.image || ""
                    };
                }

                return {
                    onlineBook,
                    book
                };
            })
            .filter(entry => getOnlineBookId(entry.onlineBook));
    }

    function getBookTitle(entry) {
        return firstNonEmpty(
            entry?.book?.book,
            entry?.book?.name,
            entry?.book?.title,
            entry?.onlineBook?.book_name,
            entry?.onlineBook?.online_book_name,
            entry?.onlineBook?.name,
            "نام کتاب"
        );
    }

    function getBookPhoto(entry) {
        return firstNonEmpty(
            entry?.book?.book_photo,
            entry?.book?.photo,
            entry?.book?.image,
            entry?.book?.cover,
            entry?.onlineBook?.cover,
            entry?.onlineBook?.photo,
            entry?.onlineBook?.image
        );
    }

    function getBookAuthor(entry) {
        const book = entry?.book;

        if (typeof book?.author === "string") return book.author;

        return firstNonEmpty(
            book?.author?.name,
            book?.author_name,
            book?.writer,
            entry?.onlineBook?.author_name,
            "نویسنده نامشخص"
        );
    }

    function getOriginalPrice(entry) {
        return firstNonEmpty(
            entry?.book?.price,
            entry?.book?.original_price,
            entry?.book?.book_price,
            entry?.onlineBook?.price,
            entry?.onlineBook?.original_price,
            0
        );
    }

    function getDiscountedPrice(entry) {
        return firstNonEmpty(
            entry?.book?.discounted_price,
            entry?.book?.final_price,
            entry?.book?.payable_price,
            entry?.onlineBook?.discounted_price,
            entry?.onlineBook?.final_price,
            entry?.onlineBook?.payable_price,
            entry?.book?.price,
            entry?.onlineBook?.price,
            0
        );
    }

    function getDiscountPercent(entry) {
        const original = numberValue(getOriginalPrice(entry));
        const discounted = numberValue(getDiscountedPrice(entry));

        if (!original || !discounted || discounted >= original) {
            return 0;
        }

        return Math.round(((original - discounted) / original) * 100);
    }

    function isDiscounted(entry) {
        return getDiscountPercent(entry) > 0;
    }

    function getBookIdForEntry(entry) {
        const bookId = getBookId(entry?.book);

        if (bookId) return bookId;

        const ids = getOnlineBookBookIds(entry?.onlineBook);

        return ids[0] || "";
    }

    function getBookUrl(entry) {
        const bookId = getBookIdForEntry(entry);
        const onlineBookId = getOnlineBookId(entry?.onlineBook);

        if (!bookId) {
            return HOME_URL;
        }

        if (onlineBookId) {
            return `/ketabook/books/${bookId}/?online_book=${onlineBookId}`;
        }

        return `/ketabook/books/${bookId}/`;
    }

    function getGenreRawValue(item) {
        if (typeof item === "string") return item;

        if (typeof item === "object" && item !== null) {
            return item.value || item.name || item.title || item.label || "";
        }

        return "";
    }

    function getEntryGenreValues(entry) {
        const book = entry?.book;
        const onlineBook = entry?.onlineBook;

        const rawGenres = [];

        if (Array.isArray(book?.genres)) {
            rawGenres.push(...book.genres);
        }

        if (Array.isArray(onlineBook?.genres)) {
            rawGenres.push(...onlineBook.genres);
        }

        if (book?.genre) {
            rawGenres.push(book.genre);
        }

        if (onlineBook?.genre) {
            rawGenres.push(onlineBook.genre);
        }

        return rawGenres
            .map(getGenreRawValue)
            .filter(Boolean)
            .map(String);
    }

    function getGenreLabel(value) {
        const found = genreChoices.find(item => {
            return String(item.value || item.name || "").toLowerCase() === String(value).toLowerCase();
        });

        return (
            found?.title ||
            found?.label ||
            GENRE_LABELS[value] ||
            String(value || "").replace(/_/g, " ")
        );
    }

    function getUsedGenreValues(entries) {
        const set = new Set();

        entries.forEach(entry => {
            getEntryGenreValues(entry).forEach(value => {
                set.add(value);
            });
        });

        return Array.from(set);
    }

    function entriesForGenre(entries, genreValue) {
        if (genreValue === "all") return entries;

        return entries.filter(entry => {
            return getEntryGenreValues(entry).includes(genreValue);
        });
    }

    function setActiveGenreButton() {
        if (!genreList) return;

        genreList.querySelectorAll("[data-online-genre]").forEach(button => {
            button.classList.toggle(
                "is-active",
                button.dataset.onlineGenre === activeGenre
            );
        });
    }

    function renderGenreSidebar(entries) {
        if (!genreList) return;

        const usedValues = getUsedGenreValues(entries);

        const orderedValues = [];

        genreChoices.forEach(choice => {
            const value = choice.value || choice.name || "";

            if (value && usedValues.includes(String(value))) {
                orderedValues.push(String(value));
            }
        });

        usedValues.forEach(value => {
            if (!orderedValues.includes(value)) {
                orderedValues.push(value);
            }
        });

        const allButton = `
            <button
                type="button"
                class="online-books-genre-link ${activeGenre === "all" ? "is-active" : ""}"
                data-online-genre="all"
            >
                <span>همه کتاب‌های آنلاین</span>
                ${GENRE_ICONS.all}
            </button>
        `;

        const genreButtons = orderedValues.map(value => {
            const label = getGenreLabel(value);
            const icon = GENRE_ICONS[value] || GENRE_ICONS.educational;

            return `
                <button
                    type="button"
                    class="online-books-genre-link ${activeGenre === value ? "is-active" : ""}"
                    data-online-genre="${value}"
                >
                    <span>${label}</span>
                    ${icon}
                </button>
            `;
        }).join("");

        genreList.innerHTML = allButton + genreButtons;

        genreList.querySelectorAll("[data-online-genre]").forEach(button => {
            button.addEventListener("click", () => {
                activeGenre = button.dataset.onlineGenre || "all";
                setActiveGenreButton();
                renderPage();
            });
        });
    }

    function renderCard(entry, target) {
        if (!template || !target) return;

        const clone = template.content.cloneNode(true);

        const link = clone.querySelector("[data-online-book-link]");
        const cover = clone.querySelector("[data-online-book-cover]");
        const coverFallback = clone.querySelector("[data-online-book-cover-fallback]");
        const discountBadge = clone.querySelector("[data-online-book-discount-badge]");
        const title = clone.querySelector("[data-online-book-title]");
        const author = clone.querySelector("[data-online-book-author]");
        const price = clone.querySelector("[data-online-book-price]");
        const oldPrice = clone.querySelector("[data-online-book-old-price]");

        const bookTitle = getBookTitle(entry);
        const bookPhoto = getBookPhoto(entry);
        const percent = getDiscountPercent(entry);

        if (link) {
            link.href = getBookUrl(entry);
        }

        if (cover && coverFallback) {
            if (bookPhoto) {
                cover.src = bookPhoto;
                cover.alt = bookTitle;
                cover.hidden = false;
                coverFallback.hidden = true;
            } else {
                cover.hidden = true;
                coverFallback.hidden = false;
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

        if (title) {
            title.textContent = bookTitle;
        }

        if (author) {
            author.textContent = getBookAuthor(entry);
        }

        if (price) {
            price.textContent = formatMoney(getDiscountedPrice(entry));
        }

        if (oldPrice) {
            if (percent) {
                oldPrice.hidden = false;
                oldPrice.textContent = formatMoney(getOriginalPrice(entry));
            } else {
                oldPrice.hidden = true;
            }
        }

        target.appendChild(clone);
    }

    function renderGrid(entries, target, limit = null) {
        if (!target) return;

        target.innerHTML = "";

        const rows = typeof limit === "number"
            ? entries.slice(0, limit)
            : entries;

        rows.forEach(entry => {
            renderCard(entry, target);
        });
    }

    function createGenreSection(genreValue, entries, limit = 4) {
        const section = document.createElement("section");
        section.className = "online-books-section";

        const label = genreValue === "all"
            ? "همه کتاب‌های آنلاین"
            : getGenreLabel(genreValue);

        section.innerHTML = `
            <header class="online-books-section-head">
                <div>
                    <p>دسته‌بندی</p>
                    <h2>${label}</h2>
                </div>

                <button
                    type="button"
                    class="online-books-see-all"
                    data-see-genre="${genreValue}"
                >
                    مشاهده همه
                </button>
            </header>

            <div class="online-books-grid"></div>
        `;

        const grid = section.querySelector(".online-books-grid");
        const button = section.querySelector("[data-see-genre]");

        renderGrid(entries, grid, limit);

        if (button) {
            button.addEventListener("click", () => {
                activeGenre = genreValue;
                setActiveGenreButton();
                renderPage();
                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            });
        }

        return section;
    }

    function renderDiscountSection(entries) {
        if (!discountSection || !discountGrid) return;

        const discountedEntries = entries.filter(isDiscounted);

        if (activeGenre !== "all" || !discountedEntries.length) {
            discountSection.hidden = true;
            discountGrid.innerHTML = "";
            return;
        }

        discountSection.hidden = false;
        renderGrid(discountedEntries, discountGrid, 4);

        if (discountSeeAll) {
            discountSeeAll.onclick = () => {
                activeGenre = "discounted";
                renderPage();
                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            };
        }
    }

    function renderDiscountOnly(entries) {
        if (!sectionsEl) return;

        const discountedEntries = entries.filter(isDiscounted);

        sectionsEl.innerHTML = "";

        if (!discountedEntries.length) {
            showEmpty(true);
            return;
        }

        showEmpty(false);

        const section = createGenreSection("all", discountedEntries, null);
        const title = section.querySelector(".online-books-section-head h2");
        const eyebrow = section.querySelector(".online-books-section-head p");
        const button = section.querySelector(".online-books-see-all");

        if (eyebrow) eyebrow.textContent = "پیشنهاد ویژه";
        if (title) title.textContent = "همه کتاب‌های آنلاین تخفیف‌دار";
        if (button) button.hidden = true;

        sectionsEl.appendChild(section);
    }

    function renderPage() {
        if (!sectionsEl) return;

        sectionsEl.innerHTML = "";

        if (!allEntries.length) {
            showEmpty(true);
            if (discountSection) discountSection.hidden = true;
            return;
        }

        if (activeGenre === "discounted") {
            if (discountSection) discountSection.hidden = true;
            renderDiscountOnly(allEntries);
            return;
        }

        const visibleEntries = entriesForGenre(allEntries, activeGenre);

        if (!visibleEntries.length) {
            showEmpty(true);
            if (discountSection) discountSection.hidden = true;
            return;
        }

        showEmpty(false);
        renderDiscountSection(allEntries);

        if (activeGenre !== "all") {
            const section = createGenreSection(activeGenre, visibleEntries, null);
            const button = section.querySelector(".online-books-see-all");

            if (button) button.hidden = true;

            sectionsEl.appendChild(section);
            return;
        }

        const usedValues = getUsedGenreValues(allEntries);

        const orderedValues = [];

        genreChoices.forEach(choice => {
            const value = choice.value || choice.name || "";

            if (value && usedValues.includes(String(value))) {
                orderedValues.push(String(value));
            }
        });

        usedValues.forEach(value => {
            if (!orderedValues.includes(value)) {
                orderedValues.push(value);
            }
        });

        orderedValues.forEach(value => {
            const entries = entriesForGenre(allEntries, value);

            if (!entries.length) return;

            sectionsEl.appendChild(createGenreSection(value, entries, 4));
        });
    }

    async function loadOnlineBooksPage() {
        try {
            setStatus("در حال دریافت کتاب‌های آنلاین...");
            showEmpty(false);

            const [onlineBooks, books, genres] = await Promise.all([
                fetchAllRows(ONLINE_BOOKS_API),
                fetchAllRows(BOOKS_API),
                fetchJsonRows(GENRES_API).catch(() => [])
            ]);

            genreChoices = Array.isArray(genres) ? genres : [];

            const bookMap = buildBookMap(books);

            allEntries = buildEntries(onlineBooks, bookMap);

            renderGenreSidebar(allEntries);
            renderPage();

            if (!allEntries.length) {
                showEmpty(true);
            }

            setStatus("");

        } catch (error) {
            console.error("Online books page load failed:", error);

            allEntries = [];
            setStatus("");
            showEmpty(true);
        }
    }

    loadOnlineBooksPage();
});