document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("online-reader-page");

    if (!page) return;

    const MY_ONLINE_BOOKS_API = page.dataset.myOnlineBooksApi || "/account/api/my-online-books/";
    const ONLINE_BOOKS_API = page.dataset.onlineBooksApi || "/catalog/api/online-books/";
    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";

    const readerTitle = document.getElementById("reader-title");
    const readerStatus = document.getElementById("reader-status");
    const readerPageImage = document.getElementById("reader-page-image");
    const readerPageLabel = document.getElementById("reader-page-label");
    const prevButton = document.getElementById("reader-prev-button");
    const nextButton = document.getElementById("reader-next-button");
    const addMyBooksButton = document.getElementById("reader-add-mybooks-button");

    const currentOnlineBookId = getOnlineBookIdFromUrl();

    let currentPage = 1;
    let pageCount = 0;
    let pageImageApi = "";
    let currentBookName = "";
    let currentPageBlobUrl = "";

    function getOnlineBookIdFromUrl() {
        const match = window.location.pathname.match(/online-books\/(\d+)\/reader/);

        if (match && match[1]) {
            return match[1];
        }

        return "";
    }

    function getAccessToken() {
        if (window.ketabookAuth && typeof window.ketabookAuth.getAccessToken === "function") {
            const token = window.ketabookAuth.getAccessToken();

            if (token) {
                return token;
            }
        }

        return (
            localStorage.getItem("access") ||
            localStorage.getItem("access_token") ||
            localStorage.getItem("ketabook_access_token") ||
            localStorage.getItem("ketabook_access") ||
            localStorage.getItem("jwt_access") ||
            localStorage.getItem("token") ||
            ""
        );
    }

    function authHeaders(extraHeaders = {}) {
        const headers = {
            "Accept": "application/json",
            ...extraHeaders,
        };

        const token = getAccessToken();

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        return headers;
    }

    function getCsrfToken() {
        const cookies = document.cookie ? document.cookie.split(";") : [];

        for (const cookie of cookies) {
            const item = cookie.trim();

            if (item.startsWith("csrftoken=")) {
                return decodeURIComponent(item.substring("csrftoken=".length));
            }
        }

        return "";
    }

    function postHeaders() {
        const headers = authHeaders({
            "Content-Type": "application/json",
        });

        const csrfToken = getCsrfToken();

        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }

        return headers;
    }

    function setStatus(message) {
        if (readerStatus) {
            readerStatus.textContent = message;
        }
    }

    function setTitle(message) {
        if (readerTitle) {
            readerTitle.textContent = message;
        }
    }

    function getReaderCacheKey() {
        return `ketabook_reader_access_${currentOnlineBookId}`;
    }

    function loadCachedAccess() {
        try {
            const cachedAccess = sessionStorage.getItem(getReaderCacheKey());

            if (!cachedAccess) {
                return null;
            }

            return JSON.parse(cachedAccess);
        } catch (error) {
            sessionStorage.removeItem(getReaderCacheKey());
            return null;
        }
    }

    function updatePageLabel() {
        if (readerPageLabel) {
            readerPageLabel.textContent = `صفحه ${currentPage} از ${pageCount}`;
        }

        if (prevButton) {
            prevButton.disabled = currentPage <= 1;
        }

        if (nextButton) {
            nextButton.disabled = currentPage >= pageCount;
        }
    }

    function setPagingDisabled(disabled) {
        if (prevButton) {
            prevButton.disabled = disabled || currentPage <= 1;
        }

        if (nextButton) {
            nextButton.disabled = disabled || currentPage >= pageCount;
        }
    }

    async function getReaderInfo() {
        const response = await fetch(`${ONLINE_BOOKS_API}${currentOnlineBookId}/reader-info/`, {
            method: "GET",
            credentials: "same-origin",
            headers: authHeaders(),
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            throw new Error("برای مطالعه دوباره، از صفحه جزئیات کتاب روی دسترسی با اشتراک بزنید.");
        }

        if (response.status === 403) {
            throw new Error(data.message || "برای دسترسی به این کتاب باید اشتراک ویژه فعال داشته باشید.");
        }

        if (!response.ok) {
            throw new Error(data.message || data.error || "دسترسی امکان‌پذیر نیست.");
        }

        return data;
    }

    async function loadPageImage() {
        if (!readerPageImage || !pageImageApi) return;

        try {
            setPagingDisabled(true);
            setStatus("در حال بارگذاری صفحه...");

            const pageUrl = `${pageImageApi}?page=${currentPage}&t=${Date.now()}`;

            const response = await fetch(pageUrl, {
                method: "GET",
                credentials: "same-origin",
                headers: authHeaders({
                    "Accept": "image/png,*/*",
                }),
            });

            if (response.status === 401) {
                throw new Error("برای مطالعه کتاب باید وارد حساب شوید.");
            }

            if (response.status === 403) {
                throw new Error("دسترسی به این صفحه مجاز نیست.");
            }

            if (!response.ok) {
                throw new Error("صفحه کتاب بارگذاری نشد.");
            }

            const blob = await response.blob();

            if (!blob || !blob.size) {
                throw new Error("صفحه کتاب خالی است.");
            }

            if (currentPageBlobUrl) {
                URL.revokeObjectURL(currentPageBlobUrl);
                currentPageBlobUrl = "";
            }

            currentPageBlobUrl = URL.createObjectURL(
                new Blob(
                    [blob],
                    {
                        type: "image/png",
                    }
                )
            );

            readerPageImage.onload = () => {
                setStatus("کتاب آماده مطالعه است.");
                updatePageLabel();
            };

            readerPageImage.onerror = () => {
                setStatus("صفحه کتاب نمایش داده نشد.");
            };

            readerPageImage.src = currentPageBlobUrl;

        } catch (error) {
            console.error("Page image error:", error);
            setStatus(error.message || "صفحه کتاب بارگذاری نشد.");
        } finally {
            setPagingDisabled(false);
            updatePageLabel();
        }
    }

    async function goToPreviousPage() {
        if (currentPage <= 1) return;

        currentPage -= 1;
        await loadPageImage();
    }

    async function goToNextPage() {
        if (currentPage >= pageCount) return;

        currentPage += 1;
        await loadPageImage();
    }

    async function addPremiumBookToMyBooks() {
        if (!currentOnlineBookId || !addMyBooksButton) return;

        try {
            addMyBooksButton.disabled = true;
            addMyBooksButton.textContent = "در حال افزودن...";

            const response = await fetch(`${MY_ONLINE_BOOKS_API}add-premium/`, {
                method: "POST",
                credentials: "same-origin",
                headers: postHeaders(),
                body: JSON.stringify({
                    online_book: currentOnlineBookId,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (response.status === 401) {
                throw new Error("برای افزودن کتاب، ابتدا وارد حساب شوید.");
            }

            if (response.status === 403) {
                throw new Error(data.message || "برای افزودن این کتاب باید اشتراک ویژه فعال داشته باشید.");
            }

            if (response.status === 405) {
                throw new Error("اکشن add-premium در بک‌اند ثبت نشده است.");
            }

            if (!response.ok) {
                throw new Error(data.message || data.error || "افزودن کتاب انجام نشد.");
            }

            addMyBooksButton.disabled = true;
            addMyBooksButton.textContent = "اضافه شد";

            setStatus(data.message || "کتاب به کتاب های من اضافه شد.");

        } catch (error) {
            console.error("Add premium book failed:", error);

            setStatus(error.message || "درخواست ناموفق بود.");

            addMyBooksButton.disabled = false;
            addMyBooksButton.textContent = "افزودن به کتاب‌های من";
        }
    }

    async function loadReader() {
        if (!currentOnlineBookId) {
            setTitle("دسترسی امکان‌پذیر نیست");
            setStatus("شناسه کتاب آنلاین پیدا نشد.");
            return;
        }

        try {
            setTitle("در حال دریافت کتاب...");
            setStatus("لطفاً چند لحظه صبر کنید.");

            const cachedAccess = loadCachedAccess();
            const readerInfo = await getReaderInfo();

            currentBookName =
                readerInfo.book_name ||
                cachedAccess?.book_name ||
                "مطالعه کتاب آنلاین";

            pageCount = readerInfo.page_count || 0;
            pageImageApi = readerInfo.page_image_api || `${ONLINE_BOOKS_API}${currentOnlineBookId}/reader-page/`;

            if (!pageCount) {
                throw new Error("تعداد صفحات کتاب پیدا نشد.");
            }

            currentPage = 1;

            setTitle(currentBookName);
            updatePageLabel();

            await loadPageImage();

        } catch (error) {
            console.error("Reader error:", error);

            setTitle("دسترسی امکان‌پذیر نیست");
            setStatus(error.message || "در دریافت کتاب مشکلی پیش آمد.");

            if (addMyBooksButton) {
                addMyBooksButton.hidden = true;
            }
        }
    }

    if (prevButton) {
        prevButton.addEventListener("click", goToPreviousPage);
    }

    if (nextButton) {
        nextButton.addEventListener("click", goToNextPage);
    }

    if (addMyBooksButton) {
        addMyBooksButton.addEventListener("click", addPremiumBookToMyBooks);
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") {
            goToPreviousPage();
        }

        if (event.key === "ArrowLeft") {
            goToNextPage();
        }
    });

    window.addEventListener("beforeunload", () => {
        if (currentPageBlobUrl) {
            URL.revokeObjectURL(currentPageBlobUrl);
        }
    });

    loadReader();
});