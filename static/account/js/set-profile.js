document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("set-profile-page");

    if (!page) return;

    const SET_PROFILE_API = page.dataset.setProfileApi || "/account/api/set-profile/";
    const CART_API = page.dataset.cartApi || "/cart/api/carts/";
    const WALLET_API = page.dataset.walletApi || "/payment/api/wallet/";
    const PREMIUM_API = page.dataset.premiumApi || "/payment/api/premium/";

    const HOME_URL = page.dataset.homeUrl || "/ketabook/";
    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";
    const DEFAULT_PHOTO_URL = page.dataset.defaultPhotoUrl || "/static/account/default.jpg";

    const form = document.getElementById("set-profile-form");

    const photoInput = document.getElementById("profile-photo");
    const photoPreview = document.getElementById("profile-photo-preview");
    const photoPlaceholder = document.getElementById("profile-photo-placeholder");

    const fullnameInput = document.getElementById("profile-fullname");
    const usernameInput = document.getElementById("profile-username");
    const emailInput = document.getElementById("profile-email");
    const ageInput = document.getElementById("profile-age");
    const addressInput = document.getElementById("profile-address");

    const statusBox = document.getElementById("profile-status");
    const submitButton = document.getElementById("submit-profile-button");
    const submitText = submitButton?.querySelector(".button-text");
    const logoutButton = document.getElementById("profile-logout-button");

    const headingTitle = document.getElementById("profile-heading-title");
    const headingSubtitle = document.getElementById("profile-heading-subtitle");

    const sideCartCount = document.getElementById("profile-side-cart-count");
    const sideWalletAmount = document.getElementById("profile-side-wallet-amount");
    const sidePremiumStatus = document.getElementById("profile-side-premium-status");

    let selectedPhotoFile = null;

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
        localStorage.removeItem("ketabook_wallet_amount");
        localStorage.removeItem("ketabook_premium_days");
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

    function refreshNavbar() {
        if (window.ketabookAuth) {
            window.ketabookAuth.clearAuthState?.();
            window.ketabookAuth.refreshNavbar?.();
        }
    }

    function redirectToLogin() {
        clearAuthState();
        refreshNavbar();
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
            ...extraHeaders
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
        return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function numberValue(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("fa-IR")} تومان`;
    }

    function showStatus(message, type = "error") {
        if (!statusBox) return;

        statusBox.hidden = false;
        statusBox.textContent = message;
        statusBox.className = `profile-status is-${type}`;
    }

    function hideStatus() {
        if (!statusBox) return;

        statusBox.hidden = true;
        statusBox.textContent = "";
        statusBox.className = "profile-status";
    }

    function setLoading(loading) {
        if (!submitButton) return;

        submitButton.disabled = loading;
        submitButton.classList.toggle("is-loading", loading);

        if (submitText) {
            submitText.textContent = loading ? "در حال ذخیره..." : "ذخیره و ادامه";
        }
    }

    function setPhotoPreview(url) {
        if (!photoPreview || !photoPlaceholder) return;

        photoPreview.src = url || DEFAULT_PHOTO_URL;
        photoPreview.hidden = false;
        photoPlaceholder.hidden = true;
    }

    function saveAuthUser(data) {
        const user = data?.user || data;

        if (!user) return;

        localStorage.setItem("ketabook_user", JSON.stringify(user));
        localStorage.setItem("user", JSON.stringify(user));

        if (window.ketabookAuth?.refreshNavbar) {
            window.ketabookAuth.refreshNavbar();
        }
    }

    function getProfileFromPayload(data) {
        return data?.user?.profile || data?.profile || {};
    }

    function getUserFromPayload(data) {
        return data?.user || data || {};
    }

    function setProfileFields(data) {
        const user = getUserFromPayload(data);
        const profile = getProfileFromPayload(data);

        if (fullnameInput) {
            fullnameInput.value = profile.fullname || "";
        }

        if (usernameInput) {
            usernameInput.value = profile.username || "";
        }

        if (emailInput) {
            emailInput.value = user.email || "";
        }

        if (ageInput) {
            ageInput.value = profile.age ?? "";
        }

        if (addressInput) {
            addressInput.value = profile.address || "";
        }

        setPhotoPreview(profile.profile_pic || DEFAULT_PHOTO_URL);

        if (headingTitle) {
            headingTitle.textContent = profile.fullname
                ? "پروفایل شما"
                : "تکمیل پروفایل";
        }

        if (headingSubtitle) {
            headingSubtitle.textContent = profile.fullname
                ? "اطلاعات حساب کاربری خود را مدیریت کنید."
                : "اطلاعات حساب کاربری خود را وارد کنید.";
        }
    }

    function buildProfileFormData() {
        const formData = new FormData();

        formData.append("fullname", String(fullnameInput?.value || "").trim());
        formData.append("username", String(usernameInput?.value || "").trim());
        formData.append("email", String(emailInput?.value || "").trim());
        formData.append("address", String(addressInput?.value || "").trim());

        const ageValue = String(ageInput?.value || "").trim();

        if (ageValue) {
            formData.append("age", ageValue);
        }

        if (selectedPhotoFile) {
            formData.append("photo", selectedPhotoFile);
        }

        return formData;
    }

    function validateProfileForm() {
        const ageValue = String(ageInput?.value || "").trim();

        if (ageValue) {
            const age = Number(ageValue);

            if (!Number.isInteger(age) || age < 8) {
                showStatus("!سن کمه .", "error");
                return false;
            }

            if (!Number.isInteger(age) || age > 120) {
                showStatus("!سن زیاده .", "error");
                return false;
            }
        }

        const usernameValue = String(usernameInput?.value || "").trim();

        if (usernameValue && usernameValue.length < 3) {
            showStatus("نام کاربری باید حداقل ۳ کاراکتر باشد.", "error");
            return false;
        }

        return true;
    }

    /* =====================================================
       API
    ===================================================== */

    async function requestJson(url) {
        const token = getAccessToken();

        if (!token) {
            redirectToLogin();
            return {};
        }

        const response = await fetch(url, {
            method: "GET",
            credentials: "same-origin",
            headers: authHeaders()
        });

        if (response.status === 401 || response.status === 403) {
            redirectToLogin();
            return {};
        }

        if (!response.ok) {
            return {};
        }

        return response.json();
    }

    async function loadExistingProfile() {
        try {
            const data = await requestJson(SET_PROFILE_API);

            if (!data) return;

            setProfileFields(data);
            saveAuthUser(data);
        } catch (error) {
            console.error("Profile load failed:", error);
            showStatus("دریافت اطلاعات پروفایل انجام نشد.", "error");
        }
    }

    async function saveProfile(event) {
        event.preventDefault();

        hideStatus();

        const token = getAccessToken();

        if (!token) {
            redirectToLogin();
            return;
        }

        if (!validateProfileForm()) {
            return;
        }

        try {
            setLoading(true);

            const response = await fetch(SET_PROFILE_API, {
                method: "POST",
                credentials: "same-origin",
                headers: authHeaders(),
                body: buildProfileFormData()
            });

            const data = await response.json().catch(() => ({}));

            if (response.status === 401 || response.status === 403) {
                redirectToLogin();
                return;
            }

            if (!response.ok) {
                const errorMessage =
                    data.username ||
                    data.age ||
                    data.email ||
                    data.detail ||
                    data.error ||
                    "ذخیره پروفایل انجام نشد.";

                throw new Error(errorMessage);
            }

            selectedPhotoFile = null;
            setProfileFields(data);
            saveAuthUser(data);

            showStatus("پروفایل با موفقیت ذخیره شد.", "success");
        } catch (error) {
            console.error("Profile save failed:", error);
            showStatus(error.message || "ذخیره پروفایل انجام نشد.", "error");
        } finally {
            setLoading(false);
        }
    }

    async function loadSideStats() {
        const token = getAccessToken();

        if (!token) {
            if (sideCartCount) sideCartCount.textContent = "۰";
            if (sideWalletAmount) sideWalletAmount.textContent = "وارد نشده‌اید";
            if (sidePremiumStatus) sidePremiumStatus.textContent = "وارد نشده‌اید";
            return;
        }

        if (sideWalletAmount) sideWalletAmount.textContent = "در حال دریافت...";
        if (sidePremiumStatus) sidePremiumStatus.textContent = "در حال دریافت...";

        const [cart, wallet, premium] = await Promise.all([
            requestJson(CART_API),
            requestJson(WALLET_API),
            requestJson(PREMIUM_API),
        ]);

        const cartData = cart?.cart || cart || {};
        const walletData = wallet?.wallet || wallet || {};
        const premiumData = premium?.premium || premium || {};

        const totalItems = cartData.total_items ?? 0;
        const walletAmount = walletData.amount ?? walletData.balance ?? 0;

        const isPremiumActive =
            premiumData.is_active ||
            premiumData.premium_status ||
            walletData.premium_status ||
            false;

        const premiumExpiration =
            premiumData.premium_expiration ||
            premiumData.expiration ||
            walletData.premium_expiration ||
            "";

        if (sideCartCount) {
            sideCartCount.textContent = toPersianDigits(totalItems);
        }

        if (sideWalletAmount) {
            sideWalletAmount.textContent = formatMoney(walletAmount);
        }

        if (sidePremiumStatus) {
            if (!isPremiumActive) {
                sidePremiumStatus.textContent = "اشتراک ندارید";
            } else if (!premiumExpiration) {
                sidePremiumStatus.textContent = "فعال";
            } else {
                const endDate = new Date(premiumExpiration);
                const today = new Date();

                if (Number.isNaN(endDate.getTime())) {
                    sidePremiumStatus.textContent = "فعال";
                } else {
                    const diffDays = Math.ceil((endDate - today) / 86400000);

                    sidePremiumStatus.textContent = diffDays > 0
                        ? `${toPersianDigits(diffDays)} روز باقی مانده`
                        : "اشتراک ندارید";
                }
            }
        }
    }

    /* =====================================================
       EVENTS
    ===================================================== */

    if (photoInput) {
        photoInput.addEventListener("change", () => {
            const file = photoInput.files?.[0];

            if (!file) return;

            selectedPhotoFile = file;

            const reader = new FileReader();

            reader.onload = event => {
                setPhotoPreview(event.target.result);
            };

            reader.readAsDataURL(file);
        });
    }

    if (form) {
        form.addEventListener("submit", saveProfile);
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            clearAuthState();
            refreshNavbar();
            window.location.href = HOME_URL;
        });
    }

    window.addEventListener("focus", () => {
        loadSideStats();
    });

    /* =====================================================
       INIT
    ===================================================== */

    setPhotoPreview(DEFAULT_PHOTO_URL);
    loadExistingProfile();
    loadSideStats();
});