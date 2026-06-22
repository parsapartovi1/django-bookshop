document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("set-profile-page");
    const form = document.getElementById("set-profile-form");

    if (!page || !form) {
        console.error("Set profile page/form not found.");
        return;
    }

    const API_URL = page.dataset.setProfileApi || "/account/api/set-profile/";
    const HOME_URL = page.dataset.homeUrl || "/ketabook/";
    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";

    const DEFAULT_PHOTO_URL =
        page.dataset.defaultPhotoUrl ||
        document.getElementById("profile-photo-preview")?.getAttribute("src") ||
        "/static/account/default.jpg";

    const fullnameInput = document.getElementById("profile-fullname");
    const emailInput = document.getElementById("profile-email");
    const addressInput = document.getElementById("profile-address");

    const birthYearInput = document.getElementById("birth-year-shamsi");
    const birthMonthInput = document.getElementById("birth-month-shamsi");
    const birthDayInput = document.getElementById("birth-day-shamsi");
    const ageInput = document.getElementById("profile-age");

    const photoInput = document.getElementById("profile-photo");
    const photoPreview = document.getElementById("profile-photo-preview");
    const photoPlaceholder = document.getElementById("profile-photo-placeholder");

    const statusBox = document.getElementById("profile-status");
    const submitButton = document.getElementById("submit-profile-button");

    const headingTitle = document.getElementById("profile-heading-title");
    const headingSubtitle = document.getElementById("profile-heading-subtitle");

    const logoutButton = document.getElementById("profile-logout-button");

    const sideCartCount = document.getElementById("profile-side-cart-count");
    const sideWalletAmount = document.getElementById("profile-side-wallet-amount");
    const sidePremiumStatus = document.getElementById("profile-side-premium-status");

    const BIRTH_STORAGE_KEYS = {
        year: "ketabook_birth_year_shamsi",
        month: "ketabook_birth_month_shamsi",
        day: "ketabook_birth_day_shamsi"
    };

    let isSaving = false;

    /* =====================================================
       AUTH
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

    function getRawAccessToken() {
        return (
            localStorage.getItem("ketabook_access_token") ||
            localStorage.getItem("access_token") ||
            ""
        );
    }

    function getToken() {
        const token = getRawAccessToken();

        if (!token || isTokenExpired(token)) {
            clearAuthState();

            if (window.ketabookAuth) {
                window.ketabookAuth.clearAuthState();
                window.ketabookAuth.refreshNavbar();
            }

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

    /* =====================================================
       TEXT / DIGITS
    ===================================================== */

    function normalizeDigits(value) {
        const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
        const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

        return String(value)
            .replace(/[۰-۹]/g, digit => persianDigits.indexOf(digit))
            .replace(/[٠-٩]/g, digit => arabicDigits.indexOf(digit));
    }

    function onlyDigits(value) {
        return normalizeDigits(value).replace(/\D/g, "");
    }

    function toPersianDigits(value) {
        return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function formatMoney(value) {
        const number = Number(value) || 0;
        return `${number.toLocaleString("fa-IR")} تومان`;
    }

    /* =====================================================
       UI HELPERS
    ===================================================== */

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

    function setLoading(isLoading) {
        if (!submitButton) return;

        submitButton.disabled = isLoading;
        submitButton.classList.toggle("is-loading", isLoading);

        const text = submitButton.querySelector(".button-text");

        if (text) {
            text.textContent = isLoading ? "در حال ذخیره..." : "ذخیره و ادامه";
        }
    }

    function isBadDefaultPhotoUrl(url) {
        if (!url) return true;

        return (
            url.includes("/profile_photos/default") ||
            (url.endsWith("/default.jpg") && !url.includes("/static/"))
        );
    }

    function setProfilePhoto(url) {
        if (!photoPreview) return;

        photoPreview.src = isBadDefaultPhotoUrl(url)
            ? DEFAULT_PHOTO_URL
            : url;

        photoPreview.hidden = false;

        if (photoPlaceholder) {
            photoPlaceholder.hidden = true;
        }
    }

    function ensureDefaultPhoto() {
        setProfilePhoto(DEFAULT_PHOTO_URL);
    }

    function updateProfileHeading(user = {}, profile = {}) {
        if (!headingTitle || !headingSubtitle) return;

        const fullname = profile.fullname || "";
        const age = profile.age || ageInput?.value || "";

        if (fullname) {
            headingTitle.textContent = fullname;

            if (age) {
                headingSubtitle.textContent = `${toPersianDigits(age)} ساله`;
            } else {
                headingSubtitle.textContent = "به حساب کاربری کتابوک خوش آمدید";
            }

            return;
        }

        headingTitle.textContent = "تکمیل پروفایل";
        headingSubtitle.textContent = "اطلاعات حساب کاربری خود را وارد کنید.";
    }

    /* =====================================================
       AGE / BIRTH
    ===================================================== */

    function getCurrentShamsiDate() {
        const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
            year: "numeric",
            month: "numeric",
            day: "numeric"
        }).formatToParts(new Date());

        const year = Number(onlyDigits(parts.find(part => part.type === "year")?.value || ""));
        const month = Number(onlyDigits(parts.find(part => part.type === "month")?.value || ""));
        const day = Number(onlyDigits(parts.find(part => part.type === "day")?.value || ""));

        return { year, month, day };
    }

    function calculateAge() {
        if (!birthYearInput || !birthMonthInput || !birthDayInput || !ageInput) {
            return "";
        }

        const birthYear = Number(onlyDigits(birthYearInput.value));
        const birthMonth = Number(onlyDigits(birthMonthInput.value));
        const birthDay = Number(onlyDigits(birthDayInput.value));

        if (!birthYear || !birthMonth || !birthDay) {
            ageInput.value = "";
            return "";
        }

        const today = getCurrentShamsiDate();

        let age = today.year - birthYear;

        if (
            today.month < birthMonth ||
            (today.month === birthMonth && today.day < birthDay)
        ) {
            age -= 1;
        }

        ageInput.value = age > 0 ? String(age) : "";

        return ageInput.value;
    }

    function saveBirthDateToStorage() {
        if (birthYearInput) {
            localStorage.setItem(BIRTH_STORAGE_KEYS.year, onlyDigits(birthYearInput.value));
        }

        if (birthMonthInput) {
            localStorage.setItem(BIRTH_STORAGE_KEYS.month, onlyDigits(birthMonthInput.value));
        }

        if (birthDayInput) {
            localStorage.setItem(BIRTH_STORAGE_KEYS.day, onlyDigits(birthDayInput.value));
        }
    }

    function restoreBirthDateFromStorage() {
        if (birthYearInput) {
            birthYearInput.value = localStorage.getItem(BIRTH_STORAGE_KEYS.year) || "";
        }

        if (birthMonthInput) {
            birthMonthInput.value = localStorage.getItem(BIRTH_STORAGE_KEYS.month) || "";
        }

        if (birthDayInput) {
            birthDayInput.value = localStorage.getItem(BIRTH_STORAGE_KEYS.day) || "";
        }

        calculateAge();
    }

    function clearBirthDateStorage() {
        localStorage.removeItem(BIRTH_STORAGE_KEYS.year);
        localStorage.removeItem(BIRTH_STORAGE_KEYS.month);
        localStorage.removeItem(BIRTH_STORAGE_KEYS.day);
    }

    /* =====================================================
       SIDEBAR STATS
    ===================================================== */

    function updateProfileSidebarStats() {
        if (sideCartCount) {
            const cartCount =
                localStorage.getItem("ketabook_cart_count") ||
                localStorage.getItem("cart_count") ||
                "0";

            sideCartCount.textContent = toPersianDigits(cartCount);
        }

        if (sideWalletAmount) {
            const walletAmount =
                localStorage.getItem("ketabook_wallet_amount") ||
                "0";

            sideWalletAmount.textContent = formatMoney(walletAmount);
        }

        if (sidePremiumStatus) {
            const premiumDays = Number(localStorage.getItem("ketabook_premium_days") || 0);

            if (premiumDays > 0) {
                sidePremiumStatus.textContent = `${premiumDays.toLocaleString("fa-IR")} روز باقی مانده`;
            } else {
                sidePremiumStatus.textContent = "اشتراک ندارید";
            }
        }
    }

    /* =====================================================
       STORAGE
    ===================================================== */

    function saveAuthUser(data) {
        const user = data?.user || data?.catalog;

        if (user) {
            localStorage.setItem("ketabook_user", JSON.stringify(user));
            localStorage.setItem("user", JSON.stringify(user));
        }

        localStorage.setItem("ketabook_is_logged_in", "true");
    }

    function logoutUser() {
        clearAuthState();
        clearBirthDateStorage();

        if (window.ketabookAuth) {
            window.ketabookAuth.clearAuthState();
            window.ketabookAuth.refreshNavbar();
        }

        sessionStorage.setItem("ketabook_toast", "از حساب خارج شدید");

        window.location.href = HOME_URL;
    }

    /* =====================================================
       API
    ===================================================== */

    async function loadExistingProfile() {
        const token = getToken();

        ensureDefaultPhoto();
        restoreBirthDateFromStorage();
        updateProfileSidebarStats();

        if (!token) {
            window.location.href = LOGIN_URL;
            return;
        }

        try {
            const response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                credentials: "same-origin"
            });

            if (response.status === 401 || response.status === 403) {
                logoutUser();
                return;
            }

            if (!response.ok) {
                ensureDefaultPhoto();
                updateProfileHeading();
                return;
            }

            const data = await response.json();

            const user = data?.user || data?.catalog || {};
            const profile = user?.profile || {};

            if (fullnameInput) {
                fullnameInput.value = profile.fullname || "";
            }

            if (emailInput) {
                emailInput.value = user.email || "";
            }

            if (addressInput) {
                addressInput.value = profile.address || "";
            }

            if (ageInput && profile.age) {
                ageInput.value = profile.age;
            }

            setProfilePhoto(profile.profile_pic || DEFAULT_PHOTO_URL);

            saveAuthUser(data);
            restoreBirthDateFromStorage();

            if (!ageInput?.value && profile.age) {
                ageInput.value = profile.age;
            }

            updateProfileHeading(user, profile);
            updateProfileSidebarStats();
        } catch (error) {
            console.error("Profile GET failed:", error);
            ensureDefaultPhoto();
            restoreBirthDateFromStorage();
            updateProfileHeading();
            updateProfileSidebarStats();
        }
    }

    function buildProfileFormData() {
        calculateAge();
        saveBirthDateToStorage();

        const formData = new FormData();

        formData.append("fullname", fullnameInput?.value.trim() || "");
        formData.append("email", emailInput?.value.trim() || "");
        formData.append("address", addressInput?.value.trim() || "");

        if (ageInput?.value) {
            formData.append("age", ageInput.value);
        }

        if (photoInput?.files?.[0]) {
            formData.append("photo", photoInput.files[0]);
        }

        return formData;
    }

    async function submitProfile(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (isSaving) return;

        hideStatus();

        const token = getToken();

        if (!token) {
            window.location.href = LOGIN_URL;
            return;
        }

        if (!fullnameInput || !fullnameInput.value.trim()) {
            showStatus("نام و نام خانوادگی را وارد کنید.", "error");
            fullnameInput?.focus();
            return;
        }

        const formData = buildProfileFormData();

        const headers = {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`
        };

        const csrfToken = getCSRFToken();

        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }

        try {
            isSaving = true;
            setLoading(true);

            const response = await fetch(API_URL, {
                method: "POST",
                headers,
                credentials: "same-origin",
                body: formData
            });

            const data = await response.json().catch(() => ({}));

            if (response.status === 401 || response.status === 403) {
                logoutUser();
                return;
            }

            if (!response.ok) {
                const message =
                    data.error ||
                    data.detail ||
                    data.message ||
                    JSON.stringify(data) ||
                    "ذخیره پروفایل انجام نشد.";

                throw new Error(message);
            }

            saveAuthUser(data);

            const savedUser = data?.user || data?.catalog || {};
            const savedProfile = savedUser?.profile || {};

            updateProfileHeading(savedUser, savedProfile);
            updateProfileSidebarStats();

            sessionStorage.setItem("ketabook_toast", "پروفایل ذخیره شد");

            window.location.href = HOME_URL;
        } catch (error) {
            showStatus(error.message, "error");
        } finally {
            isSaving = false;
            setLoading(false);
        }
    }

    /* =====================================================
       EVENTS
    ===================================================== */

    if (birthYearInput) {
        birthYearInput.addEventListener("input", () => {
            birthYearInput.value = onlyDigits(birthYearInput.value).slice(0, 4);
            saveBirthDateToStorage();
            calculateAge();

            updateProfileHeading({}, {
                fullname: fullnameInput?.value.trim() || "",
                age: ageInput?.value || ""
            });
        });
    }

    if (birthDayInput) {
        birthDayInput.addEventListener("input", () => {
            birthDayInput.value = onlyDigits(birthDayInput.value).slice(0, 2);
            saveBirthDateToStorage();
            calculateAge();

            updateProfileHeading({}, {
                fullname: fullnameInput?.value.trim() || "",
                age: ageInput?.value || ""
            });
        });
    }

    if (birthMonthInput) {
        birthMonthInput.addEventListener("change", () => {
            saveBirthDateToStorage();
            calculateAge();

            updateProfileHeading({}, {
                fullname: fullnameInput?.value.trim() || "",
                age: ageInput?.value || ""
            });
        });
    }

    if (fullnameInput) {
        fullnameInput.addEventListener("input", () => {
            updateProfileHeading({}, {
                fullname: fullnameInput.value.trim(),
                age: ageInput?.value || ""
            });
        });
    }

    if (photoInput && photoPreview) {
        photoInput.addEventListener("change", () => {
            const file = photoInput.files?.[0];

            if (!file) {
                setProfilePhoto(DEFAULT_PHOTO_URL);
                return;
            }

            setProfilePhoto(URL.createObjectURL(file));
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", logoutUser);
    }

    form.addEventListener("submit", submitProfile, true);

    if (submitButton) {
        submitButton.addEventListener("click", submitProfile, true);
    }

    window.addEventListener("storage", updateProfileSidebarStats);

    /* =====================================================
       INIT
    ===================================================== */

    ensureDefaultPhoto();
    restoreBirthDateFromStorage();
    updateProfileSidebarStats();
    loadExistingProfile();
});