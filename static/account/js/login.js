document.addEventListener("DOMContentLoaded", () => {
    const savedTheme =
        localStorage.getItem("ketabook_theme") ||
        localStorage.getItem("theme");

    if (savedTheme === "dark" || savedTheme === "light") {
        document.documentElement.dataset.theme = savedTheme;
    }

    const loginPage = document.getElementById("loginPage");

    const numberScreen = document.getElementById("numberScreen");
    const otpScreen = document.getElementById("otpScreen");

    const numberForm = document.getElementById("numberForm");
    const otpForm = document.getElementById("otpForm");

    const numberInput = document.getElementById("numberInput");
    const otpInput = document.getElementById("otpInput");
    const otpBoxes = Array.from(document.querySelectorAll(".otp-box"));

    const sendOtpBtn = document.getElementById("sendOtpBtn");
    const verifyOtpBtn = document.getElementById("verifyOtpBtn");
    const resendOtpBtn = document.getElementById("resendOtpBtn");
    const changeNumberBtn = document.getElementById("changeNumberBtn");

    const numberPreview = document.getElementById("numberPreview");
    const phoneOtpPreview = document.getElementById("phoneOtpPreview");
    const messageBox = document.getElementById("messageBox");
    const otpTimer = document.getElementById("otpTimer");
    const screenSubtitle = document.getElementById("screenSubtitle");

    const SEND_OTP_URL = loginPage.dataset.sendOtpUrl || "/account/api/send-otp/";
    const VERIFY_OTP_URL = loginPage.dataset.verifyOtpUrl || "/account/api/verify-otp/";
    const SET_PROFILE_URL = loginPage.dataset.setProfileUrl || "/account/set-profile/";
    const HOME_URL = loginPage.dataset.homeUrl || "/ketabook/";

    let currentNumber = "";
    let expireInterval = null;
    let resendInterval = null;
    let bookLoop = null;

    runBookAnimation();

    bookLoop = setInterval(() => {
        runBookAnimation();
    }, 7800);

    function getCSRFToken() {
        const cookies = document.cookie ? document.cookie.split(";") : [];

        for (let cookie of cookies) {
            cookie = cookie.trim();

            if (cookie.startsWith("csrftoken=")) {
                return decodeURIComponent(cookie.substring("csrftoken=".length));
            }
        }

        const metaToken = document.querySelector("meta[name='csrf-token']")?.content;
        return metaToken || "";
    }

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

    function isValidNumber(number) {
        return /^09\d{9}$/.test(number);
    }

    async function apiPost(url, payload) {
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };

        const csrfToken = getCSRFToken();

        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }

        const response = await fetch(url, {
            method: "POST",
            headers,
            credentials: "same-origin",
            body: JSON.stringify(payload)
        });

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            const errorMessage =
                data.error ||
                data.detail ||
                data.message ||
                "مشکلی پیش آمد. دوباره تلاش کنید.";

            throw new Error(errorMessage);
        }

        return data;
    }

    function setLoading(button, isLoading, loadingText, normalText) {
        button.disabled = isLoading;
        button.textContent = isLoading ? loadingText : normalText;
    }

    function showMessage(text, type = "success") {
        messageBox.textContent = text;
        messageBox.className = `message-box ${type}`;
    }

    function clearMessage() {
        messageBox.textContent = "";
        messageBox.className = "message-box";
    }

    function runBookAnimation() {
        document.body.classList.remove("book-playing");
        void document.body.offsetWidth;
        document.body.classList.add("book-playing");

        setTimeout(() => {
            document.body.classList.remove("book-playing");
        }, 5400);
    }

    function playOtpReceivingAnimation() {
        document.body.classList.remove("otp-receiving");
        void document.body.offsetWidth;
        document.body.classList.add("otp-receiving");

        runBookAnimation();

        setTimeout(() => {
            document.body.classList.remove("otp-receiving");
        }, 2700);
    }

    function showOtpScreen() {
        numberScreen.classList.remove("active");
        otpScreen.classList.add("active");

        if (screenSubtitle) {
            screenSubtitle.textContent = "کد تایید ۶ رقمی را وارد کنید";
        }

        playOtpReceivingAnimation();

        setTimeout(() => {
            otpBoxes[0]?.focus();
        }, 260);
    }

    function showNumberScreen() {
        otpScreen.classList.remove("active");
        numberScreen.classList.add("active");

        if (screenSubtitle) {
            screenSubtitle.textContent = "ورود با شماره موبایل";
        }

        setTimeout(() => {
            numberInput.focus();
        }, 220);
    }

    function getOtpCode() {
        return otpBoxes.map(box => box.value).join("");
    }

    function syncOtp() {
        const code = getOtpCode();

        otpInput.value = code;

        if (phoneOtpPreview) {
            phoneOtpPreview.textContent = code.padEnd(6, "•");
        }

        return code;
    }

    function clearOtp() {
        otpBoxes.forEach(box => {
            box.value = "";
            box.classList.remove("filled");
        });

        otpInput.value = "";

        if (phoneOtpPreview) {
            phoneOtpPreview.textContent = "••••••";
        }
    }

    function saveAuth(data) {
        const accessToken = data?.tokens?.access;
        const refreshToken = data?.tokens?.refresh;
        const user = data?.user || data?.catalog || data?.account || null;

        if (accessToken) {
            localStorage.setItem("access_token", accessToken);
            localStorage.setItem("ketabook_access_token", accessToken);
        }

        if (refreshToken) {
            localStorage.setItem("refresh_token", refreshToken);
            localStorage.setItem("ketabook_refresh_token", refreshToken);
        }

        if (user) {
            localStorage.setItem("user", JSON.stringify(user));
            localStorage.setItem("ketabook_user", JSON.stringify(user));
        }

        localStorage.setItem("ketabook_is_logged_in", "true");
        localStorage.setItem("is_new", String(Boolean(data?.is_new)));
    }

    function startExpireTimer(seconds = 120) {
        clearInterval(expireInterval);

        let remaining = seconds;

        updateExpireTimer(remaining);

        expireInterval = setInterval(() => {
            remaining -= 1;
            updateExpireTimer(remaining);

            if (remaining <= 0) {
                clearInterval(expireInterval);
                otpTimer.textContent = "کد منقضی شد. دوباره کد بگیرید.";
            }
        }, 1000);
    }

    function updateExpireTimer(remaining) {
        const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
        const seconds = String(remaining % 60).padStart(2, "0");

        otpTimer.textContent = `اعتبار کد: ${minutes}:${seconds}`;
    }

    function startResendCooldown(seconds = 120) {
        clearInterval(resendInterval);

        let remaining = seconds;

        resendOtpBtn.disabled = true;
        resendOtpBtn.textContent = `ارسال دوباره ${remaining}`;

        resendInterval = setInterval(() => {
            remaining -= 1;
            resendOtpBtn.textContent = `ارسال دوباره ${remaining}`;

            if (remaining <= 0) {
                clearInterval(resendInterval);
                resendOtpBtn.disabled = false;
                resendOtpBtn.textContent = "ارسال دوباره";
            }
        }, 1000);
    }

    numberInput.addEventListener("input", () => {
        numberInput.value = onlyDigits(numberInput.value).slice(0, 11);
        clearMessage();
    });

    numberForm.addEventListener("submit", async event => {
        event.preventDefault();
        clearMessage();

        const number = onlyDigits(numberInput.value.trim()).slice(0, 11);
        numberInput.value = number;

        if (!isValidNumber(number)) {
            showMessage("شماره موبایل باید با 09 شروع شود و ۱۱ رقم باشد.", "error");
            return;
        }

        try {
            setLoading(sendOtpBtn, true, "در حال ارسال...", "دریافت کد تایید");

            await apiPost(SEND_OTP_URL, {
                number
            });

            currentNumber = number;
            numberPreview.textContent = number;

            clearOtp();
            showOtpScreen();
            showMessage("کد تایید ارسال شد.", "success");

            startExpireTimer(120);
            startResendCooldown(120);
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            setLoading(sendOtpBtn, false, "در حال ارسال...", "دریافت کد تایید");
        }
    });

    otpBoxes.forEach((box, index) => {
        box.addEventListener("input", () => {
            box.value = onlyDigits(box.value).slice(-1);
            box.classList.toggle("filled", Boolean(box.value));

            const code = syncOtp();

            if (box.value && index < otpBoxes.length - 1) {
                otpBoxes[index + 1].focus();
            }

            if (code.length === 6 && otpBoxes.every(input => input.value)) {
                otpForm.requestSubmit();
            }
        });

        box.addEventListener("keydown", event => {
            if (event.key === "Backspace" && !box.value && index > 0) {
                otpBoxes[index - 1].focus();
            }

            if (event.key === "ArrowLeft" && index < otpBoxes.length - 1) {
                otpBoxes[index + 1].focus();
            }

            if (event.key === "ArrowRight" && index > 0) {
                otpBoxes[index - 1].focus();
            }
        });

        box.addEventListener("paste", event => {
            event.preventDefault();

            const pasted = onlyDigits(event.clipboardData.getData("text")).slice(0, 6);

            if (!pasted) {
                return;
            }

            otpBoxes.forEach((input, otpIndex) => {
                input.value = pasted[otpIndex] || "";
                input.classList.toggle("filled", Boolean(input.value));
            });

            syncOtp();

            if (pasted.length === 6) {
                otpForm.requestSubmit();
            } else {
                const nextEmpty = otpBoxes.find(input => !input.value);
                nextEmpty?.focus();
            }
        });
    });

    otpForm.addEventListener("submit", async event => {
        event.preventDefault();
        clearMessage();

        const otp = syncOtp();

        if (!currentNumber) {
            showMessage("ابتدا شماره موبایل را وارد کنید.", "error");
            showNumberScreen();
            return;
        }

        if (!/^\d{6}$/.test(otp)) {
            showMessage("کد تایید باید ۶ رقم باشد.", "error");
            return;
        }

        try {
            setLoading(verifyOtpBtn, true, "در حال بررسی...", "تایید و ادامه");

            const data = await apiPost(VERIFY_OTP_URL, {
                number: currentNumber,
                otp
            });

            saveAuth(data);

            clearInterval(expireInterval);
            clearInterval(resendInterval);
            clearInterval(bookLoop);

            showMessage("ورود موفق بود.", "success");

            setTimeout(() => {
                window.location.href = data?.is_new ? SET_PROFILE_URL : HOME_URL;
            }, 700);
        } catch (error) {
            clearOtp();
            otpBoxes[0]?.focus();
            showMessage(error.message, "error");
        } finally {
            setLoading(verifyOtpBtn, false, "در حال بررسی...", "تایید و ادامه");
        }
    });

    resendOtpBtn.addEventListener("click", async () => {
        clearMessage();

        if (!currentNumber) {
            showNumberScreen();
            return;
        }

        try {
            setLoading(resendOtpBtn, true, "در حال ارسال...", "ارسال دوباره");

            await apiPost(SEND_OTP_URL, {
                number: currentNumber
            });

            clearOtp();
            playOtpReceivingAnimation();
            showMessage("کد جدید ارسال شد.", "success");

            startExpireTimer(120);
            startResendCooldown(120);

            otpBoxes[0]?.focus();
        } catch (error) {
            showMessage(error.message, "error");
            resendOtpBtn.disabled = false;
            resendOtpBtn.textContent = "ارسال دوباره";
        }
    });

    changeNumberBtn.addEventListener("click", () => {
        clearInterval(expireInterval);
        clearInterval(resendInterval);

        currentNumber = "";
        clearOtp();
        clearMessage();
        showNumberScreen();
    });
});
