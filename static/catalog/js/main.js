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

    const ROUTES = {
        home: "/ketabook/",
        login: "/account/login/",
        profile: "/account/profile/",
        cart: "/ketabook/cart/",
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

    /* =====================================================
       JWT / AUTH
    ===================================================== */

    function decodeJwtPayload(token) {
        try {
            const payload = token.split(".")[1];

            if (!payload) return null;

            const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
            const json = decodeURIComponent(
                atob(base64)
                    .split("")
                    .map(char => {
                        return "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2);
                    })
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
        const safetySeconds = 10;

        return payload.exp <= now + safetySeconds;
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
                theme === "dark"
                    ? "حالت روشن"
                    : "حالت تاریک"
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

        searchForm.addEventListener("submit", event => {
            event.preventDefault();

            const query = searchInput.value.trim();

            if (!query) {
                searchInput.focus();
                return;
            }

            const searchUrl = new URL(ROUTES.search, window.location.origin);
            searchUrl.searchParams.set("q", query);

            window.location.href = searchUrl.toString();
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

        const possibleCartKeys = [
            "cart",
            "ketabook_cart",
            "cart_items",
            "ketabook_cart_items"
        ];

        for (const key of possibleCartKeys) {
            const rawValue = localStorage.getItem(key);

            if (!rawValue) continue;

            try {
                const parsedValue = JSON.parse(rawValue);

                if (Array.isArray(parsedValue)) {
                    return parsedValue.length;
                }

                if (parsedValue && typeof parsedValue === "object") {
                    return Object.keys(parsedValue).length;
                }
            } catch {
                continue;
            }
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
            const response = await fetch("/cart/api/cart/", {
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
                data.count ??
                data.total_items ??
                data.items_count ??
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
        if (!cartLink) return;

        cartLink.href = ROUTES.cart;
    }

    /* =====================================================
       CATEGORY
    ===================================================== */

    function initCategoryButton() {
        if (!categoryButton) return;

        const categoryMenu =
            document.getElementById("category-menu") ||
            document.querySelector("[data-category-menu]") ||
            document.querySelector(".category-menu") ||
            document.querySelector(".category-dropdown");

        categoryButton.addEventListener("click", event => {
            checkAuthFreshness();

            if (categoryMenu) {
                event.preventDefault();

                categoryMenu.classList.toggle("is-open");
                categoryButton.classList.toggle("is-active");

                const isOpen = categoryMenu.classList.contains("is-open");
                categoryButton.setAttribute("aria-expanded", String(isOpen));

                return;
            }

            window.location.href = ROUTES.categories;
        });

        document.addEventListener("click", event => {
            if (!categoryMenu) return;

            const clickedInsideMenu = categoryMenu.contains(event.target);
            const clickedButton = categoryButton.contains(event.target);

            if (!clickedInsideMenu && !clickedButton) {
                categoryMenu.classList.remove("is-open");
                categoryButton.classList.remove("is-active");
                categoryButton.setAttribute("aria-expanded", "false");
            }
        });
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