document.addEventListener("DOMContentLoaded", () => {
    const page = document.getElementById("factor-page");

    if (!page) return;

    const FACTOR_API = page.dataset.factorApi || "/account/api/factors/";
    const PROFILE_API = page.dataset.profileApi || "/account/api/set-profile/";
    const LOGIN_URL = page.dataset.loginUrl || "/account/login/";

    const factorCountLabel = document.getElementById("factor-count-label");
    const factorStatus = document.getElementById("factor-status");

    const factorItemsList = document.getElementById("factor-items-list");
    const factorEmptyState = document.getElementById("factor-empty-state");
    const factorItemTemplate = document.getElementById("factor-item-template");

    let profileData = null;
    let factors = [];

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

    function redirectToLogin() {
        clearAuthState();

        if (window.ketabookAuth?.refreshNavbar) {
            window.ketabookAuth.refreshNavbar();
        }

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
            ...extraHeaders,
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
        return String(value ?? "").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    }

    function numberValue(value) {
        const number = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
        return Number.isFinite(number) ? number : 0;
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("fa-IR")} تومان`;
    }

    function formatDate(value) {
        if (!value) return "---";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "---";

        return new Intl.DateTimeFormat("fa-IR", {
            year: "numeric",
            month: "long",
            day: "numeric",
        }).format(date);
    }

    function formatShortDate(value) {
        if (!value) return "---";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "---";

        return new Intl.DateTimeFormat("fa-IR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(date);
    }

    function cleanQuotes(value) {
        return String(value || "")
            .replace(/^["“”«»]+/g, "")
            .replace(/["“”«»]+$/g, "")
            .trim();
    }

    function removeFactorPrefix(value) {
        return cleanQuotes(
            String(value || "")
                .replace(/^فاکتور\s+کتاب\s+آنلاین\s*/i, "")
                .replace(/^فاکتور\s+کتاب\s*/i, "")
                .replace(/^فاکتور\s+خرید\s+کتاب\s*/i, "")
                .replace(/^فاکتور\s+خرید\s*/i, "")
                .replace(/^فاکتور\s*/i, "")
                .trim()
        );
    }

    function showStatus(message, type = "success") {
        if (!factorStatus) return;

        factorStatus.hidden = false;
        factorStatus.textContent = message;
        factorStatus.className = `factor-status is-${type}`;
    }

    function hideStatus() {
        if (!factorStatus) return;

        factorStatus.hidden = true;
        factorStatus.textContent = "";
        factorStatus.className = "factor-status";
    }

    function getProfileUser() {
        return profileData?.user || {};
    }

    function getProfile() {
        return profileData?.user?.profile || profileData?.profile || {};
    }

    function getUserFullName() {
        const profile = getProfile();
        const user = getProfileUser();

        return (
            profile.fullname ||
            profile.username ||
            user.fullname ||
            user.username ||
            user.number ||
            "کاربر کتابوک"
        );
    }

    function getUserAddress() {
        const profile = getProfile();

        return profile.address || "---";
    }

    function getFactorTypeLabel(type) {
        const normalized = String(type || "").toLowerCase();

        if (normalized === "book" || normalized === "cart" || normalized === "physical_book") {
            return "کتاب";
        }

        if (normalized === "online_book") {
            return "کتاب آنلاین";
        }

        if (normalized === "wallet" || normalized === "wallet_charge") {
            return "شارژ کیف پول";
        }

        if (normalized === "premium") {
            return "اشتراک ویژه";
        }

        return "تراکنش";
    }

    function getFactorItems(rawFactor) {
        if (Array.isArray(rawFactor.items)) return rawFactor.items;
        if (Array.isArray(rawFactor.products)) return rawFactor.products;
        if (Array.isArray(rawFactor.books)) return rawFactor.books;

        return [
            {
                name: rawFactor.name || rawFactor.title || getFactorTypeLabel(rawFactor.type || rawFactor.factor_type),
                price: rawFactor.price || rawFactor.amount || rawFactor.total || 0,
                quantity: rawFactor.quantity || 1,
                discount: rawFactor.discount || rawFactor.discount_amount || 0,
                bought_at: rawFactor.bought_at || rawFactor.created_at || rawFactor.date,
                total: rawFactor.total || rawFactor.amount || rawFactor.price || 0,
            },
        ];
    }

    function getFactorTotal(rawFactor) {
        const explicitTotal =
            rawFactor.total ||
            rawFactor.final_price ||
            rawFactor.amount ||
            rawFactor.price ||
            rawFactor.payable_price;

        if (explicitTotal !== undefined && explicitTotal !== null) {
            return numberValue(explicitTotal);
        }

        return getFactorItems(rawFactor).reduce((sum, item) => {
            return sum + numberValue(item.total || item.price) * numberValue(item.quantity || 1);
        }, 0);
    }

    function getFactorTitle(rawFactor) {
        const type = String(rawFactor.type || rawFactor.factor_type || "").toLowerCase();
        const rawTitle = String(rawFactor.title || "").trim();

        if (type === "wallet" || type === "wallet_charge") {
            return "فاکتور شارژ کیف پول";
        }

        if (type === "premium") {
            return "فاکتور خرید اشتراک ویژه";
        }

        const items = getFactorItems(rawFactor);
        const firstItem = items[0] || {};
        const cleanItemName = removeFactorPrefix(firstItem.name || firstItem.book || firstItem.product || firstItem.title || "");

        if (type === "online_book") {
            return cleanItemName ? `فاکتور کتاب آنلاین "${cleanItemName}"` : "فاکتور کتاب آنلاین";
        }

        if (rawTitle && rawTitle.startsWith("فاکتور کتاب")) {
            const cleanTitleName = removeFactorPrefix(rawTitle);
            return cleanTitleName ? `فاکتور کتاب "${cleanTitleName}"` : "فاکتور خرید کتاب";
        }

        return cleanItemName ? `فاکتور کتاب "${cleanItemName}"` : "فاکتور خرید کتاب";
    }

    function getFactorDescription(rawFactor) {
        const date = formatDate(rawFactor.bought_at || rawFactor.created_at || rawFactor.date);
        return `${getFactorTitle(rawFactor)} در تاریخ ${date}`;
    }

    function getFactorId(rawFactor, index) {
        return rawFactor.id || rawFactor.factor_id || rawFactor.transaction_id || `KT-${Date.now()}-${index + 1}`;
    }

    function normalizeFactor(rawFactor, index) {
        return {
            id: getFactorId(rawFactor, index),
            type: rawFactor.type || rawFactor.factor_type || rawFactor.transaction_type || "book",
            title: getFactorTitle(rawFactor),
            description: getFactorDescription(rawFactor),
            date: rawFactor.bought_at || rawFactor.created_at || rawFactor.date || new Date().toISOString(),
            total: getFactorTotal(rawFactor),
            raw: rawFactor,
        };
    }

    function normalizeFactors(data) {
        const list =
            data?.factors ||
            data?.results ||
            data?.items ||
            data?.transactions ||
            data ||
            [];

        if (!Array.isArray(list)) return [];

        return list.map(normalizeFactor);
    }

    function findFactor(factorId) {
        return factors.find(item => String(item.id) === String(factorId));
    }

    /* =====================================================
       API
    ===================================================== */

    async function requestJson(url) {
        const token = getAccessToken();

        if (!token) {
            redirectToLogin();
            return null;
        }

        const response = await fetch(url, {
            method: "GET",
            credentials: "same-origin",
            headers: authHeaders(),
        });

        if (response.status === 401 || response.status === 403) {
            redirectToLogin();
            return null;
        }

        if (!response.ok) {
            throw new Error("request failed");
        }

        return response.json();
    }

    async function loadProfile() {
        try {
            profileData = await requestJson(PROFILE_API);
        } catch (error) {
            console.warn("Profile load failed:", error);
            profileData = null;
        }
    }

    async function loadFactors() {
        try {
            hideStatus();

            if (factorCountLabel) {
                factorCountLabel.textContent = "در حال دریافت فاکتورهای شما...";
            }

            const data = await requestJson(FACTOR_API);
            factors = normalizeFactors(data);

            renderFactorList(factors);

            if (factorCountLabel) {
                factorCountLabel.textContent = factors.length
                    ? `${toPersianDigits(factors.length)} فاکتور ثبت شده`
                    : "هیچ فاکتوری ثبت نشده است";
            }
        } catch (error) {
            console.error("Factors load failed:", error);
            renderFactorList([]);
            showStatus("دریافت فاکتورها انجام نشد.", "error");

            if (factorCountLabel) {
                factorCountLabel.textContent = "دریافت فاکتورها انجام نشد";
            }
        }
    }

    /* =====================================================
       LIST
    ===================================================== */

    function renderFactorList(list) {
        if (!factorItemsList || !factorEmptyState || !factorItemTemplate) return;

        factorItemsList.innerHTML = "";

        if (!list.length) {
            factorEmptyState.hidden = false;
            return;
        }

        factorEmptyState.hidden = true;

        list.forEach((factor) => {
            const clone = factorItemTemplate.content.cloneNode(true);
            const item = clone.querySelector("[data-factor-item]");

            item.dataset.factorId = factor.id;

            clone.querySelector("[data-factor-title]").textContent = factor.title;
            clone.querySelector("[data-factor-description]").textContent = factor.description;
            clone.querySelector("[data-factor-type]").textContent = getFactorTypeLabel(factor.type);
            clone.querySelector("[data-factor-date]").textContent = formatShortDate(factor.date);
            clone.querySelector("[data-factor-price]").textContent = formatMoney(factor.total);

            const openButton = clone.querySelector("[data-open-factor]");
            const downloadButton = clone.querySelector("[data-download-factor]");

            openButton.addEventListener("click", () => {
                const tab = window.open("", "_blank");

                if (tab) {
                    tab.document.open();
                    tab.document.write(`
                        <!doctype html>
                        <html lang="fa" dir="rtl">
                            <head>
                                <meta charset="utf-8">
                                <title>در حال آماده‌سازی فاکتور</title>
                                <style>
                                    body {
                                        margin: 0;
                                        min-height: 100vh;
                                        display: grid;
                                        place-items: center;
                                        font-family: Tahoma, Arial, sans-serif;
                                        background: #f3f4f6;
                                        color: #111827;
                                        direction: rtl;
                                    }
                                </style>
                            </head>
                            <body>در حال آماده‌سازی فاکتور...</body>
                        </html>
                    `);
                    tab.document.close();
                }

                openFactorInNewTab(factor.id, tab);
            });

            downloadButton.addEventListener("click", () => {
                downloadFactor(factor.id);
            });

            factorItemsList.appendChild(clone);
        });
    }

    /* =====================================================
       FACTOR DATA
    ===================================================== */

    function getPaperRows(factor) {
        const rawFactor = factor.raw || factor;
        const rawType = String(factor.type || rawFactor.type || rawFactor.factor_type || "").toLowerCase();

        if (rawType === "wallet" || rawType === "wallet_charge") {
            return [
                {
                    name: "شارژ کیف پول",
                    price: rawFactor.amount || rawFactor.total || factor.total,
                    quantity: 1,
                    discount: null,
                    bought_at: factor.date,
                    total: rawFactor.amount || rawFactor.total || factor.total,
                },
            ];
        }

        if (rawType === "premium") {
            return [
                {
                    name: rawFactor.name || rawFactor.plan_name || "اشتراک ویژه کتابوک",
                    price: rawFactor.amount || rawFactor.total || factor.total,
                    quantity: rawFactor.months ? `${rawFactor.months} ماه` : 1,
                    discount: null,
                    bought_at: factor.date,
                    total: rawFactor.amount || rawFactor.total || factor.total,
                },
            ];
        }

        const rows = getFactorItems(rawFactor).map(item => {
            const cleanName = removeFactorPrefix(
                item.name || item.book || item.product || item.title || "محصول کتابوک"
            );

            return {
                name: cleanName || "محصول کتابوک",
                price: item.price || item.unit_price || item.amount || 0,
                quantity: item.quantity || item.count || 1,
                discount: item.discount || item.discount_amount || item.discounted_price_difference || null,
                bought_at: item.bought_at || item.created_at || factor.date,
                total: item.total || item.final_price || item.payable_price || (
                    numberValue(item.price || item.amount || 0) * numberValue(item.quantity || 1)
                ),
            };
        });

        while (rows.length < 5) {
            rows.push({
                name: "---",
                price: null,
                quantity: "---",
                discount: null,
                bought_at: null,
                total: null,
                isEmpty: true,
            });
        }

        return rows;
    }

    function shouldHideAddress(factor) {
        const type = String(factor.type || "").toLowerCase();

        return (
            type === "online_book" ||
            type === "wallet" ||
            type === "wallet_charge" ||
            type === "premium"
        );
    }

    /* =====================================================
       CANVAS DRAWING
    ===================================================== */

    function makeCanvas() {
        const canvas = document.createElement("canvas");
        canvas.width = 1120;
        canvas.height = 840;

        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.direction = "rtl";
        ctx.textBaseline = "alphabetic";

        return { canvas, ctx };
    }

    function setFont(ctx, size, weight = 800) {
        ctx.font = `${weight} ${size}px Tahoma, Arial, sans-serif`;
    }

    function drawText(ctx, text, x, y, options = {}) {
        const {
            size = 14,
            weight = 800,
            color = "#111827",
            align = "right",
            direction = "rtl",
            maxWidth = undefined,
        } = options;

        ctx.save();
        ctx.direction = direction;
        ctx.textAlign = align;
        ctx.fillStyle = color;
        setFont(ctx, size, weight);

        ctx.fillText(toPersianDigits(text), x, y, maxWidth);

        ctx.restore();
    }

    function drawLine(ctx, x1, y1, x2, y2, color = "#e5e7eb", width = 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.restore();
    }

    function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke = null) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);

        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }

        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();
    }

    function wrapRtlText(ctx, text, x, y, maxWidth, lineHeight, options = {}) {
        const words = String(text || "").split(" ");
        let line = "";
        let currentY = y;

        setFont(ctx, options.size || 13, options.weight || 800);

        ctx.save();
        ctx.direction = "rtl";
        ctx.textAlign = options.align || "right";
        ctx.fillStyle = options.color || "#111827";

        words.forEach((word) => {
            const testLine = line ? `${line} ${word}` : word;
            const width = ctx.measureText(testLine).width;

            if (width > maxWidth && line) {
                ctx.fillText(toPersianDigits(line), x, currentY);
                line = word;
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        });

        if (line) {
            ctx.fillText(toPersianDigits(line), x, currentY);
        }

        ctx.restore();

        return currentY;
    }

    function drawFactorTable(ctx, rows) {
        const tableX = 48;
        const tableY = 220;
        const tableW = 1024;

        const manyRows = rows.length > 7;
        const headerH = 36;
        const rowH = manyRows ? 30 : 38;

        const columns = [
            { title: "ردیف", w: 58 },
            { title: "نام محصول", w: 260 },
            { title: "قیمت", w: 130 },
            { title: "تعداد", w: 110 },
            { title: "تخفیف", w: 120 },
            { title: "تاریخ خرید", w: 160 },
            { title: "مبلغ نهایی", w: 186 },
        ];

        ctx.save();

        ctx.fillStyle = "#c45500";
        ctx.fillRect(tableX, tableY, tableW, headerH);

        let x = tableX + tableW;

        columns.forEach((col) => {
            x -= col.w;

            drawLine(
                ctx,
                x,
                tableY,
                x,
                tableY + headerH + rows.length * rowH,
                "#e5e7eb"
            );

            drawText(ctx, col.title, x + col.w / 2, tableY + 23, {
                size: 11,
                weight: 900,
                color: "#ffffff",
                align: "center",
            });
        });

        drawLine(
            ctx,
            tableX + tableW,
            tableY,
            tableX + tableW,
            tableY + headerH + rows.length * rowH,
            "#e5e7eb"
        );

        drawLine(ctx, tableX, tableY, tableX + tableW, tableY, "#e5e7eb");
        drawLine(ctx, tableX, tableY + headerH, tableX + tableW, tableY + headerH, "#e5e7eb");

        rows.forEach((row, rowIndex) => {
            const y = tableY + headerH + rowIndex * rowH;

            ctx.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#fafafa";
            ctx.fillRect(tableX, y, tableW, rowH);

            const values = [
                toPersianDigits(rowIndex + 1),
                row.name,
                row.isEmpty || row.price === null ? "---" : formatMoney(row.price),
                row.isEmpty ? "---" : toPersianDigits(row.quantity),
                row.isEmpty || !row.discount ? "---" : formatMoney(row.discount),
                row.isEmpty || !row.bought_at ? "---" : formatShortDate(row.bought_at),
                row.isEmpty || row.total === null ? "---" : formatMoney(row.total),
            ];

            let cellRight = tableX + tableW;

            columns.forEach((col, colIndex) => {
                const cellX = cellRight - col.w;
                const centerX = cellX + col.w / 2;
                const textY = y + (manyRows ? 20 : 24);

                if (colIndex === 1) {
                    drawText(ctx, values[colIndex], cellRight - 10, textY, {
                        size: manyRows ? 10 : 11,
                        weight: 900,
                        color: "#111827",
                        align: "right",
                        maxWidth: col.w - 20,
                    });
                } else {
                    drawText(ctx, values[colIndex], centerX, textY, {
                        size: manyRows ? 10 : 11,
                        weight: 850,
                        color: "#111827",
                        align: "center",
                        maxWidth: col.w - 8,
                    });
                }

                cellRight -= col.w;
            });

            drawLine(ctx, tableX, y + rowH, tableX + tableW, y + rowH, "#e5e7eb");
        });

        ctx.restore();

        return tableY + headerH + rows.length * rowH;
    }
    function drawFactorCanvas(factor) {
        const { canvas, ctx } = makeCanvas();

        const rows = getPaperRows(factor);
        const factorTitle = getFactorTitle(factor.raw || factor);
        const hideAddress = shouldHideAddress(factor);

        /* Header */
        drawText(ctx, "کتابوک", 1072, 70, {
            size: 36,
            weight: 950,
            color: "#c45500",
            align: "right",
        });

        drawText(ctx, "مرجع تخصصی خرید کتاب و کتاب آنلاین", 1072, 98, {
            size: 14,
            weight: 850,
            color: "#6b7280",
            align: "right",
        });

        drawRoundRect(ctx, 48, 42, 220, 88, 14, "#fafafa", "#e5e7eb");

        drawText(ctx, "شماره فاکتور", 248, 68, {
            size: 11,
            weight: 800,
            color: "#6b7280",
            align: "right",
        });

        drawText(ctx, factor.id, 248, 88, {
            size: 13,
            weight: 950,
            color: "#111827",
            align: "right",
        });

        drawText(ctx, "تاریخ صدور", 248, 110, {
            size: 11,
            weight: 800,
            color: "#6b7280",
            align: "right",
        });

        drawText(ctx, formatDate(factor.date), 248, 128, {
            size: 13,
            weight: 950,
            color: "#111827",
            align: "right",
        });

        /* Title */
        drawText(ctx, factorTitle, 560, 160, {
            size: 23,
            weight: 950,
            color: "#111827",
            align: "center",
            maxWidth: 720,
        });

        drawText(ctx, getFactorTypeLabel(factor.type), 560, 184, {
            size: 13,
            weight: 800,
            color: "#6b7280",
            align: "center",
        });

        /* Table */
        const tableEndY = drawFactorTable(ctx, rows);

        /* Customer note */
        let noteY = Math.min(tableEndY + 36, 610);

        drawText(ctx, "جناب آقای / خانم", 1072, noteY, {
            size: 15,
            weight: 850,
            color: "#111827",
            align: "right",
        });

        drawText(ctx, getUserFullName(), 905, noteY, {
            size: 15,
            weight: 950,
            color: "#c45500",
            align: "right",
        });

        noteY += 30;

        if (!hideAddress) {
            drawText(ctx, "به آدرس:", 1072, noteY, {
                size: 15,
                weight: 850,
                color: "#111827",
                align: "right",
            });

            wrapRtlText(ctx, getUserAddress(), 1000, noteY, 760, 24, {
                size: 14,
                weight: 900,
                color: "#c45500",
                align: "right",
            });

            noteY += 34;
        }

        drawText(ctx, "از خرید شما متشکریم", 1072, noteY, {
            size: 15,
            weight: 850,
            color: "#111827",
            align: "right",
        });

        /* Footer legal note */
        wrapRtlText(
            ctx,
            "این فاکتور در جهت اطمینان خریدار صادر شده و ارزش قانونی دیگری ندارد",
            1072,
            760,
            430,
            22,
            {
                size: 12,
                weight: 850,
                color: "#4b5563",
                align: "right",
            }
        );

        /* Signature boxes on left */
        drawRoundRect(ctx, 48, 728, 150, 78, 12, "#ffffff", "#9ca3af");
        drawRoundRect(ctx, 214, 728, 150, 78, 12, "#ffffff", "#9ca3af");

        drawText(ctx, "امضای خریدار", 123, 786, {
            size: 12,
            weight: 850,
            color: "#6b7280",
            align: "center",
        });

        drawText(ctx, "امضای فرستنده", 289, 786, {
            size: 12,
            weight: 850,
            color: "#6b7280",
            align: "center",
        });

        return canvas;
    }

    function renderFactorToDataUrl(factor) {
        const canvas = drawFactorCanvas(factor);
        return canvas.toDataURL("image/png");
    }

    /* =====================================================
       OPEN / DOWNLOAD
    ===================================================== */

    async function openFactorInNewTab(factorId, tab) {
        const factor = findFactor(factorId);

        if (!factor) return;

        try {
            const dataUrl = renderFactorToDataUrl(factor);
            const targetTab = tab || window.open("", "_blank");

            if (!targetTab) {
                showStatus("مرورگر اجازه باز کردن صفحه جدید را نداد.", "error");
                return;
            }

            targetTab.document.open();
            targetTab.document.write(`
                <!doctype html>
                <html lang="fa" dir="rtl">
                    <head>
                        <meta charset="utf-8">
                        <title>${factor.title}</title>
                        <style>
                            * {
                                box-sizing: border-box;
                            }

                            body {
                                margin: 0;
                                min-height: 100vh;
                                padding: 34px;
                                display: grid;
                                place-items: center;
                                background: #f3f4f6;
                                font-family: Tahoma, Arial, sans-serif;
                                direction: rtl;
                            }

                            .factor-tab-card {
                                width: min(1120px, 100%);
                                display: grid;
                                gap: 18px;
                            }

                            .factor-tab-header {
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                gap: 16px;
                            }

                            .factor-tab-header h1 {
                                margin: 0;
                                color: #111827;
                                font-size: 20px;
                                font-weight: 900;
                            }

                            .factor-tab-header a {
                                height: 42px;
                                padding: 0 16px;
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                border-radius: 12px;
                                color: #ffffff;
                                text-decoration: none;
                                font-size: 13px;
                                font-weight: 900;
                                background: linear-gradient(135deg, #ff7a18, #c45500, #923b00);
                            }

                            img {
                                width: 100%;
                                height: auto;
                                display: block;
                                background: #ffffff;
                                box-shadow: 0 24px 70px rgba(0, 0, 0, 0.18);
                            }
                        </style>
                    </head>

                    <body>
                        <main class="factor-tab-card">
                            <div class="factor-tab-header">
                                <h1>${factor.title}</h1>
                                <a href="${dataUrl}" download="ketabook-factor-${factor.id}.png">دانلود PNG</a>
                            </div>

                            <img src="${dataUrl}" alt="${factor.title}">
                        </main>
                    </body>
                </html>
            `);
            targetTab.document.close();
        } catch (error) {
            console.error("Open factor failed:", error);
            showStatus("نمایش فاکتور انجام نشد.", "error");

            if (tab) {
                tab.document.open();
                tab.document.write("نمایش فاکتور انجام نشد.");
                tab.document.close();
            }
        }
    }

    function downloadFactor(factorId) {
        const factor = findFactor(factorId);

        if (!factor) return;

        try {
            const dataUrl = renderFactorToDataUrl(factor);

            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = `ketabook-factor-${factor.id}.png`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            showStatus("فاکتور با موفقیت دانلود شد.", "success");
        } catch (error) {
            console.error("Download factor failed:", error);
            showStatus("دانلود فاکتور انجام نشد.", "error");
        }
    }

    /* =====================================================
       INIT
    ===================================================== */

    async function init() {
        await loadProfile();
        await loadFactors();
    }

    init();
});