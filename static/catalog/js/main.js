document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.getElementById("theme-toggle");
    const themeIcon = document.getElementById("theme-icon");

    const profileLink = document.getElementById("profile-link");
    const profileText = document.getElementById("profile-text");

    const cartLink = document.getElementById("cart-link");
    const cartCount = document.getElementById("cart-count");

    const searchForm = document.getElementById("navbar-search-form");
    const searchInput = document.getElementById("navbar-search-input");

    const categoryButton = document.getElementById("category-button");
    const categoryMenu = document.getElementById("category-menu");
    const categoryMenuList = document.getElementById("category-menu-list");

    const ROUTES = {
        home: "/ketabook/",
        login: "/account/login/",
        profile: "/account/profile/",
        cart: "/cart/",
        search: "/ketabook/search/",
        categories: "/ketabook/categories/"
    };

    const STORAGE_KEYS = {
        theme: "ketabook_theme",
        oldTheme: "theme",

        access: "ketabook_access_token",
        oldAccess: "access_token",

        refresh: "ketabook_refresh_token",
        oldRefresh: "refresh_token",

        user: "ketabook_user",
        oldUser: "user",

        loggedIn: "ketabook_is_logged_in",
        cartCount: "ketabook_cart_count",

        toast: "ketabook_toast"
    };

    const CATEGORY_ICONS = {
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
        religion: `<svg viewBox="0 0 24 24"><path d="M12 3l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 18.8 5.8 22 7 15.2l-5-4.9 6.9-1z"></path></svg>`
    };

    /* =====================================================
       JWT / AUTH
    ===================================================== */

    function decodeJwtPayload(token) {
        try {
            const payload = token.split(".")[1];
            if (!payload) return null;

            let base64 = payload.replace(/-/g, "+").replace(/_/g, "/");

            while (base64.length % 4) {
                base64 += "=";
            }

            const json = decodeURIComponent(
                atob(base64)
                    .split("")
                    .map(char => "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2))
                    .join("")
            );

            return JSON.parse(json);
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
        localStorage.removeItem(STORAGE_KEYS.access);
        localStorage.removeItem(STORAGE_KEYS.oldAccess);

        localStorage.removeItem(STORAGE_KEYS.refresh);
        localStorage.removeItem(STORAGE_KEYS.oldRefresh);

        localStorage.removeItem(STORAGE_KEYS.user);
        localStorage.removeItem(STORAGE_KEYS.oldUser);

        localStorage.removeItem(STORAGE_KEYS.loggedIn);
        localStorage.removeItem("is_new");

        localStorage.removeItem(STORAGE_KEYS.cartCount);
    }

    function getRawAccessToken() {
        return (
            localStorage.getItem(STORAGE_KEYS.access) ||
            localStorage.getItem(STORAGE_KEYS.oldAccess) ||
            ""
        );
    }

    function getAccessToken() {
        const token = getRawAccessToken();

        if (!token || isTokenExpired(token)) {
            clearAuthState();
            return "";
        }

        return token;
    }

    function getStoredUser() {
        const rawUser =
            localStorage.getItem(STORAGE_KEYS.user) ||
            localStorage.getItem(STORAGE_KEYS.oldUser);

        if (!rawUser) return null;

        try {
            return JSON.parse(rawUser);
        } catch {
            return null;
        }
    }

    function isLoggedIn() {
        return Boolean(getAccessToken());
    }

    function getDisplayName(user) {
        if (!user) return "";

        return (
            user.fullname ||
            user.full_name ||
            user.name ||
            user.profile?.fullname ||
            user.catalog?.profile?.fullname ||
            user.user?.profile?.fullname ||
            user.number ||
            user.phone ||
            ""
        );
    }

    function updateProfileNavbar() {
        if (!profileLink || !profileText) return;

        if (isLoggedIn()) {
            const user = getStoredUser();
            const displayName = getDisplayName(user);

            profileText.textContent = "حساب من";
            profileLink.href = ROUTES.profile;

            if (displayName) {
                profileLink.setAttribute("title", displayName);
            } else {
                profileLink.removeAttribute("title");
            }
        } else {
            profileText.textContent = "وارد شوید";
            profileLink.href = ROUTES.login;
            profileLink.removeAttribute("title");
        }
    }

    function checkAuthFreshness() {
        const token = getRawAccessToken();

        if (token && isTokenExpired(token)) {
            clearAuthState();
            updateProfileNavbar();
            updateCartBadge(0);
        }
    }

    function initAuthGuards() {
        checkAuthFreshness();

        document.addEventListener("click", () => {
            checkAuthFreshness();
        }, true);

        window.addEventListener("focus", () => {
            checkAuthFreshness();
        });

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                checkAuthFreshness();
            }
        });

        window.addEventListener("storage", () => {
            checkAuthFreshness();
            updateProfileNavbar();
        });
    }

    /* =====================================================
       THEME
    ===================================================== */

    function getSystemTheme() {
        return window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    }

    function getSavedTheme() {
        const savedTheme =
            localStorage.getItem(STORAGE_KEYS.theme) ||
            localStorage.getItem(STORAGE_KEYS.oldTheme);

        if (savedTheme === "dark" || savedTheme === "light") {
            return savedTheme;
        }

        return null;
    }

    function applyTheme(theme) {
        const selectedTheme = theme === "dark" ? "dark" : "light";

        document.documentElement.setAttribute("data-theme", selectedTheme);
        document.body.setAttribute("data-theme", selectedTheme);

        localStorage.setItem(STORAGE_KEYS.theme, selectedTheme);
        localStorage.setItem(STORAGE_KEYS.oldTheme, selectedTheme);

        updateThemeIcon(selectedTheme);
    }

    function updateThemeIcon(theme) {
        if (!themeIcon) return;

        const iconUse = themeIcon.querySelector("use");

        if (iconUse) {
            iconUse.setAttribute(
                "href",
                theme === "dark" ? "#icon-sun" : "#icon-moon"
            );
        }

        if (themeToggle) {
            themeToggle.setAttribute(
                "aria-label",
                theme === "dark"
                    ? "تغییر به حالت روشن"
                    : "تغییر به حالت تاریک"
            );

            themeToggle.setAttribute(
                "title",
                theme === "dark" ? "حالت روشن" : "حالت تاریک"
            );
        }
    }

    function initTheme() {
        applyTheme(getSavedTheme() || getSystemTheme());

        if (!themeToggle) return;

        themeToggle.addEventListener("click", () => {
            const currentTheme =
                document.documentElement.getAttribute("data-theme") ||
                document.body.getAttribute("data-theme") ||
                "light";

            applyTheme(currentTheme === "dark" ? "light" : "dark");
        });
    }

    /* =====================================================
       SEARCH
    ===================================================== */

    function initSearch() {
        if (!searchForm || !searchInput) return;

        const resultsPanel = document.getElementById("navbar-search-results");
        const BOOKS_API = "/catalog/api/books/";

        let searchTimer = null;
        let allBooksCache = null;
        let lastSuggestions = [];

        const EN_TO_FA_WORDS = {
            green: "سبز",
            light: "چراغ",
            lights: "چراغ",
            lamp: "چراغ",
            lamps: "چراغ",
            bright: "روشن",
            red: "قرمز",
            blue: "آبی",
            black: "سیاه",
            white: "سفید",
            little: "کوچک",
            small: "کوچک",
            big: "بزرگ",
            old: "قدیمی",
            new: "جدید",
            book: "کتاب",
            books: "کتاب",
            forest: "جنگل",
            sea: "دریا",
            night: "شب",
            day: "روز",
            sun: "خورشید",
            moon: "ماه",
            star: "ستاره",
            stars: "ستاره",
            girl: "دختر",
            boy: "پسر",
            man: "مرد",
            woman: "زن",
            child: "کودک",
            children: "کودک",
            house: "خانه",
            home: "خانه",
            city: "شهر",
            love: "عشق",
            story: "داستان",
            stories: "داستان"
        };

        const FA_TO_EN_PHRASES = {
            چراغسبزها: "green lights",
            چراغسبز: "green light",
            چراغروشن: "bright light"
        };

        const FA_TO_EN_WORDS = {
            چراغ: "light",
            سبزها: "green lights",
            سبز: "green",
            روشن: "bright",
            قرمز: "red",
            آبی: "blue",
            سیاه: "black",
            سفید: "white",
            کوچک: "little",
            بزرگ: "big",
            قدیمی: "old",
            جدید: "new",
            کتاب: "book",
            جنگل: "forest",
            دریا: "sea",
            شب: "night",
            روز: "day",
            خورشید: "sun",
            ماه: "moon",
            ستاره: "star",
            دختر: "girl",
            پسر: "boy",
            مرد: "man",
            زن: "woman",
            کودک: "child",
            خانه: "house",
            شهر: "city",
            عشق: "love",
            داستان: "story"
        };

        function escapeHTML(value) {
            return String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function hasEnglish(value) {
            return /[a-zA-Z]/.test(String(value || ""));
        }

        function normalizeText(value) {
            return String(value || "")
                .trim()
                .toLowerCase()
                .replace(/ي/g, "ی")
                .replace(/ك/g, "ک")
                .replace(/ۀ/g, "ه")
                .replace(/ة/g, "ه")
                .replace(/أ|إ|آ/g, "ا")
                .replace(/[‌\u200c]/g, "")
                .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, "")
                .replace(/\s+/g, " ");
        }

        function normalizeCompact(value) {
            return normalizeText(value).replace(/\s+/g, "");
        }

        function englishToPersianQuery(query) {
            const words = String(query || "")
                .trim()
                .toLowerCase()
                .replace(/[^a-zA-Z0-9\s]/g, " ")
                .split(/\s+/)
                .filter(Boolean);

            const translated = words.map(word => {
                return EN_TO_FA_WORDS[word] || word;
            });

            return translated.join(" ");
        }

        function persianTitleToEnglish(title) {
            const compactTitle = normalizeCompact(title);

            if (FA_TO_EN_PHRASES[compactTitle]) {
                return FA_TO_EN_PHRASES[compactTitle];
            }

            let normalized = normalizeText(title);

            Object.entries(FA_TO_EN_WORDS)
                .sort((a, b) => b[0].length - a[0].length)
                .forEach(([fa, en]) => {
                    normalized = normalized.replaceAll(fa, en);
                });

            return normalized
                .replace(/\s+/g, " ")
                .trim();
        }

        function getRows(payload) {
            if (Array.isArray(payload)) return payload;
            if (Array.isArray(payload?.results)) return payload.results;
            if (Array.isArray(payload?.books)) return payload.books;
            if (Array.isArray(payload?.items)) return payload.items;
            return [];
        }

        function getBookId(book) {
            return book?.id || book?.book_id || book?.pk || "";
        }

        function getBookTitle(book) {
            return book?.book || book?.name || book?.title || "نام کتاب";
        }

        function getBookUrl(book) {
            const id = getBookId(book);

            if (!id) return "#";

            return `/ketabook/books/${id}/`;
        }

        function showResultsPanel() {
            if (resultsPanel) {
                resultsPanel.hidden = false;
            }
        }

        function hideResultsPanel() {
            if (resultsPanel) {
                resultsPanel.hidden = true;
            }
        }

        function renderSearchMessage(message) {
            if (!resultsPanel) return;

            resultsPanel.innerHTML = `
                <div class="search-results-empty">
                    ${escapeHTML(message)}
                </div>
            `;

            showResultsPanel();
        }

        async function getAllBooks() {
            if (Array.isArray(allBooksCache)) {
                return allBooksCache;
            }

            const response = await fetch(BOOKS_API, {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error("books request failed");
            }

            const payload = await response.json();
            allBooksCache = getRows(payload);

            return allBooksCache;
        }

        function queryTokens(value) {
            return normalizeText(value)
                .split(/\s+/)
                .map(item => item.trim())
                .filter(Boolean);
        }

        function matchBooksByName(books, query) {
            const userTypedEnglish = hasEnglish(query);
            const rawQuery = normalizeText(query);
            const faQuery = userTypedEnglish ? normalizeText(englishToPersianQuery(query)) : rawQuery;

            const rawCompact = normalizeCompact(rawQuery);
            const faCompact = normalizeCompact(faQuery);
            const faTokens = queryTokens(faQuery);
            const rawTokens = queryTokens(rawQuery);

            if (!faCompact && !rawCompact) return [];

            return books.filter(book => {
                const title = getBookTitle(book);
                const normalizedTitle = normalizeText(title);
                const compactTitle = normalizeCompact(title);

                const hasPhraseMatch =
                    normalizedTitle.includes(faQuery) ||
                    compactTitle.includes(faCompact) ||
                    normalizedTitle.includes(rawQuery) ||
                    compactTitle.includes(rawCompact);

                const hasFaTokenMatch =
                    faTokens.length > 0 &&
                    faTokens.every(token => normalizedTitle.includes(token) || compactTitle.includes(token));

                const hasRawTokenMatch =
                    rawTokens.length > 0 &&
                    rawTokens.every(token => normalizedTitle.includes(token) || compactTitle.includes(token));

                return hasPhraseMatch || hasFaTokenMatch || hasRawTokenMatch;
            });
        }

        function renderNameSuggestions(books, query) {
            if (!resultsPanel) return;

            const safeBooks = Array.isArray(books) ? books.slice(0, 8) : [];
            const userTypedEnglish = hasEnglish(query);

            lastSuggestions = safeBooks;

            if (!safeBooks.length) {
                renderSearchMessage("کتابی با این نام پیدا نشد.");
                return;
            }

            resultsPanel.innerHTML = safeBooks.map(book => {
                const title = getBookTitle(book);
                const suggestionText = userTypedEnglish
                    ? persianTitleToEnglish(title)
                    : title;

                return `
                    <a href="${escapeHTML(getBookUrl(book))}" class="search-name-suggestion">
                        ${escapeHTML(suggestionText || title)}
                    </a>
                `;
            }).join("");

            showResultsPanel();
        }

        async function searchBookNames(query) {
            const cleanQuery = String(query || "").trim();

            if (!cleanQuery) {
                lastSuggestions = [];
                hideResultsPanel();
                return;
            }

            if (cleanQuery.length < 2) {
                renderSearchMessage("برای جستجو حداقل ۲ حرف وارد کنید.");
                return;
            }

            try {
                renderSearchMessage("در حال جستجو...");

                const books = await getAllBooks();
                const matchedBooks = matchBooksByName(books, cleanQuery);

                renderNameSuggestions(matchedBooks, cleanQuery);

            } catch (error) {
                console.error("Navbar name search failed:", error);
                renderSearchMessage("جستجو انجام نشد.");
            }
        }

        searchInput.addEventListener("input", () => {
            const query = searchInput.value.trim();

            clearTimeout(searchTimer);

            if (!query) {
                lastSuggestions = [];
                hideResultsPanel();
                return;
            }

            searchTimer = setTimeout(() => {
                searchBookNames(query);
            }, 220);
        });

        searchInput.addEventListener("focus", () => {
            if (searchInput.value.trim()) {
                showResultsPanel();
            }
        });

        searchForm.addEventListener("submit", event => {
            event.preventDefault();

            const query = searchInput.value.trim();

            if (!query) {
                searchInput.focus();
                return;
            }

            const searchUrl = new URL(ROUTES.search, window.location.origin);
            searchUrl.searchParams.set("q", query);

            const translatedQuery = hasEnglish(query)
                ? englishToPersianQuery(query)
                : query;

            searchUrl.searchParams.set("name", translatedQuery);

            window.location.href = searchUrl.toString();
        });

        document.addEventListener("click", event => {
            if (!resultsPanel) return;

            const clickedInsideSearch =
                searchForm.contains(event.target) ||
                resultsPanel.contains(event.target);

            if (!clickedInsideSearch) {
                hideResultsPanel();
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                hideResultsPanel();
            }
        });
    }

    /* =====================================================
       CART
    ===================================================== */

    function getLocalCartCount() {
        const savedCount = Number(localStorage.getItem(STORAGE_KEYS.cartCount));

        if (Number.isFinite(savedCount) && savedCount > 0) {
            return savedCount;
        }

        return 0;
    }

    function updateCartBadge(count) {
        if (!cartCount) return;

        const safeCount = Number(count) || 0;

        cartCount.textContent = String(safeCount);
        cartCount.hidden = safeCount <= 0;

        cartCount.classList.toggle("has-items", safeCount > 0);
    }

    async function fetchCartCount() {
        const token = getAccessToken();

        if (!token) {
            updateCartBadge(getLocalCartCount());
            return;
        }

        try {
            const response = await fetch("/cart/api/carts/", {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                credentials: "same-origin"
            });

            if (response.status === 401 || response.status === 403) {
                clearAuthState();
                updateProfileNavbar();
                updateCartBadge(0);
                return;
            }

            if (!response.ok) {
                updateCartBadge(getLocalCartCount());
                return;
            }

            const data = await response.json();

            const count =
                data.total_items ??
                data.items_count ??
                data.count ??
                data.cart_count ??
                data.items?.length ??
                data.results?.length ??
                0;

            localStorage.setItem(STORAGE_KEYS.cartCount, String(count));
            updateCartBadge(count);
        } catch {
            updateCartBadge(getLocalCartCount());
        }
    }

    function initCartLink() {
        const allCartLinks = document.querySelectorAll(
            "#cart-link, .cart-link, a[href='cart/'], a[href='/ketabook/cart/'], a[href='/cart/cart/']"
        );

        allCartLinks.forEach(link => {
            link.setAttribute("href", ROUTES.cart);
        });
    }

    /* =====================================================
       CATEGORY / GENRES FROM BACKEND
    ===================================================== */

    function getCategoryApiUrl() {
        return categoryMenu?.dataset.categoryApi || "/catalog/api/genres/choices/";
    }

    function positionCategoryMenu() {
        if (!categoryButton || !categoryMenu) return;

        const rect = categoryButton.getBoundingClientRect();
        const isMobile = window.innerWidth <= 880;

        if (isMobile) {
            categoryMenu.style.top = "";
            categoryMenu.style.right = "";
            categoryMenu.style.left = "";
            return;
        }

        const top = rect.bottom + 12;
        const right = window.innerWidth - rect.right;

        categoryMenu.style.top = `${top}px`;
        categoryMenu.style.right = `${Math.max(14, right)}px`;
        categoryMenu.style.left = "auto";
    }

    function openCategoryMenu() {
        if (!categoryMenu || !categoryButton) return;

        positionCategoryMenu();

        categoryMenu.classList.add("is-open");
        categoryButton.classList.add("is-active");
        categoryButton.setAttribute("aria-expanded", "true");
    }

    function closeCategoryMenu() {
        if (!categoryMenu || !categoryButton) return;

        categoryMenu.classList.remove("is-open");
        categoryButton.classList.remove("is-active");
        categoryButton.setAttribute("aria-expanded", "false");
    }

    function toggleCategoryMenu() {
        if (!categoryMenu) {
            window.location.href = ROUTES.categories;
            return;
        }

        if (categoryMenu.classList.contains("is-open")) {
            closeCategoryMenu();
        } else {
            openCategoryMenu();
        }
    }

    function renderCategoryMenu(genres) {
        if (!categoryMenuList) return;

        if (!Array.isArray(genres) || !genres.length) {
            categoryMenuList.innerHTML = `
                <div class="category-menu-error">
                    دسته‌بندی‌ای پیدا نشد.
                </div>
            `;
            return;
        }

        const currentPath = window.location.pathname;

        categoryMenuList.innerHTML = genres.map(genre => {
            const value = genre.value || "";
            const title = genre.title || genre.label || value;
            const url = genre.url || `/ketabook/genres/${value}/`;
            const iconKey = genre.icon || value || "book";
            const iconSvg = CATEGORY_ICONS[iconKey] || CATEGORY_ICONS[value] || CATEGORY_ICONS.educational;
            const isActive = currentPath === url;

            return `
                <a
                    href="${url}"
                    class="category-menu-link ${isActive ? "active" : ""}"
                    data-genre-value="${value}"
                >
                    <span class="category-menu-title">${title}</span>
                    <span class="category-menu-icon">${iconSvg}</span>
                </a>
            `;
        }).join("");
    }

    async function loadCategoryMenu() {
        if (!categoryMenu || !categoryMenuList) return;

        try {
            categoryMenuList.innerHTML = `
                <div class="category-menu-loading">
                    در حال دریافت دسته‌بندی‌ها...
                </div>
            `;

            const response = await fetch(getCategoryApiUrl(), {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                credentials: "same-origin"
            });

            if (!response.ok) {
                throw new Error("genres request failed");
            }

            const data = await response.json();
            renderCategoryMenu(data);
        } catch (error) {
            console.error("Category menu load failed:", error);

            categoryMenuList.innerHTML = `
                <div class="category-menu-error">
                    دریافت دسته‌بندی‌ها انجام نشد.
                </div>
            `;
        }
    }

    function initCategoryButton() {
        if (!categoryButton) return;

        let closeTimer = null;

        function cancelCloseTimer() {
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }
        }

        function scheduleCloseMenu() {
            cancelCloseTimer();

            closeTimer = setTimeout(() => {
                closeCategoryMenu();
            }, 180);
        }

        function openByPointer() {
            checkAuthFreshness();
            cancelCloseTimer();
            openCategoryMenu();
        }

        categoryButton.addEventListener("mouseenter", openByPointer);
        categoryButton.addEventListener("focus", openByPointer);

        categoryButton.addEventListener("click", event => {
            event.preventDefault();
            checkAuthFreshness();
            toggleCategoryMenu();
        });

        categoryButton.addEventListener("mouseleave", () => {
            scheduleCloseMenu();
        });

        if (categoryMenu) {
            categoryMenu.addEventListener("mouseenter", () => {
                cancelCloseTimer();
                openCategoryMenu();
            });

            categoryMenu.addEventListener("mouseleave", () => {
                scheduleCloseMenu();
            });

            categoryMenu.addEventListener("focusin", () => {
                cancelCloseTimer();
                openCategoryMenu();
            });

            categoryMenu.addEventListener("focusout", event => {
                if (!categoryMenu.contains(event.relatedTarget) && event.relatedTarget !== categoryButton) {
                    scheduleCloseMenu();
                }
            });
        }

        document.addEventListener("click", event => {
            if (!categoryMenu) return;

            const clickedInsideMenu = categoryMenu.contains(event.target);
            const clickedButton = categoryButton.contains(event.target);

            if (!clickedInsideMenu && !clickedButton) {
                closeCategoryMenu();
            }
        });

        window.addEventListener("resize", () => {
            if (categoryMenu?.classList.contains("is-open")) {
                positionCategoryMenu();
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeCategoryMenu();
            }
        });

        loadCategoryMenu();
    }
    /* =====================================================
       TOAST
    ===================================================== */

    function showSiteToast(message) {
        if (!message) return;

        let toast = document.getElementById("ketabook-site-toast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "ketabook-site-toast";

            toast.style.position = "fixed";
            toast.style.top = "18px";
            toast.style.left = "50%";
            toast.style.transform = "translateX(-50%) translateY(-18px)";
            toast.style.zIndex = "99999";
            toast.style.padding = "13px 22px";
            toast.style.borderRadius = "999px";
            toast.style.background = "linear-gradient(135deg, #ff7a18, #c45500)";
            toast.style.color = "#ffffff";
            toast.style.fontWeight = "900";
            toast.style.fontSize = "14px";
            toast.style.boxShadow = "0 18px 38px rgba(196, 85, 0, 0.28)";
            toast.style.opacity = "0";
            toast.style.transition = "opacity 0.25s ease, transform 0.25s ease";
            toast.style.pointerEvents = "none";
            toast.style.direction = "rtl";

            document.body.appendChild(toast);
        }

        toast.textContent = message;

        requestAnimationFrame(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateX(-50%) translateY(0)";
        });

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(-50%) translateY(-18px)";
        }, 2600);
    }

    function initSiteToast() {
        const message = sessionStorage.getItem(STORAGE_KEYS.toast);

        if (!message) return;

        sessionStorage.removeItem(STORAGE_KEYS.toast);

        setTimeout(() => {
            showSiteToast(message);
        }, 250);
    }

    /* =====================================================
       PUBLIC HELPERS
    ===================================================== */

    window.ketabookAuth = {
        isLoggedIn,
        getAccessToken,
        getStoredUser,
        refreshNavbar: updateProfileNavbar,
        clearAuthState,

        logout() {
            clearAuthState();
            updateProfileNavbar();
            updateCartBadge(0);

            sessionStorage.setItem(STORAGE_KEYS.toast, "از حساب خارج شدید");

            window.location.href = ROUTES.home;
        }
    };

    window.ketabookToast = showSiteToast;

    /* =====================================================
       INIT
    ===================================================== */

    initAuthGuards();
    initTheme();
    updateProfileNavbar();
    initSearch();
    initCartLink();
    initCategoryButton();
    fetchCartCount();
    initSiteToast();
});