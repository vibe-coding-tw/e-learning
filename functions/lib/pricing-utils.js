function normalizeLocale(raw = "") {
    const v = String(raw || "").trim().toLowerCase();
    if (!v) return "en";
    if (v.startsWith("zh")) return "zh-TW";
    return "en";
}

function normalizeCurrency(raw = "", fallback = "") {
    const v = String(raw || fallback || "").trim().toUpperCase();
    if (v === "NTD") return "TWD";
    if (v === "USD") return "USD";
    if (v === "TWD") return "TWD";
    if (v === "HKD") return "HKD";
    if (v === "JPY") return "JPY";
    if (v === "CNY") return "CNY";
    return v || fallback || "";
}

function normalizeAmount(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function normalizeText(value = "") {
    return String(value || "").trim();
}

function isPriceEntryObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function readPriceEntry(value, fallbackCurrency = "") {
    if (value == null) return null;
    if (typeof value === "number" || typeof value === "string") {
        return {
            amount: normalizeAmount(value),
            currency: normalizeCurrency(fallbackCurrency),
        };
    }
    if (!isPriceEntryObject(value)) return null;

    const amountCandidates = [value.amount, value.price, value.value, value.total];
    let amount = 0;
    for (const candidate of amountCandidates) {
        const n = Number(candidate);
        if (Number.isFinite(n)) {
            amount = n;
            break;
        }
    }

    const currency = normalizeCurrency(
        value.currency || value.currencyCode || value.isoCurrency || value.unitCurrency || fallbackCurrency
    );

    return {
        amount,
        currency,
        meta: value,
    };
}

function hasLessonPriceData(lesson = {}) {
    return normalizeText(lesson.dealerPriceBookId || lesson.dealerPriceBookLessonId || "") !== "";
}

function resolveLessonPrice(lesson = {}, currencyHint = "") {
    // Dealer price is the primary source of truth.
    // If dealerPrice is present, use it before any legacy catalog fallback.
    const hasPriceData = hasLessonPriceData(lesson);
    if (hasPriceData && lesson.dealerPrice != null) {
        const dealerCurrency = normalizeCurrency(
            lesson.dealerCurrency || lesson.currency || lesson.price_currency || lesson.priceCurrency || lesson.currencyCode || "",
            ""
        );
        return {
            amount: normalizeAmount(lesson.dealerPrice),
            currency: dealerCurrency || normalizeCurrency(currencyHint, ""),
            source: "dealer:lesson",
            hasPriceData: true
        };
    }
    const fallbackCurrency = normalizeCurrency(
        lesson.dealerCurrency || lesson.currency || lesson.price_currency || lesson.priceCurrency || lesson.currencyCode || currencyHint || "",
        ""
    );
    return {
        amount: 0,
        currency: fallbackCurrency,
        source: "none",
        hasPriceData: false
    };
}

function resolveCartPrice(item = {}, currencyHint = "") {
    const explicitCurrency = normalizeCurrency(item.price_currency || item.currency || item.priceCurrency || "");
    if (item.price != null && explicitCurrency) {
        return {
            amount: normalizeAmount(item.price),
            currency: explicitCurrency,
            source: "cart:snapshot",
        };
    }

    if (item.price_usd != null) {
        return {
            amount: normalizeAmount(item.price_usd),
            currency: "USD",
            source: "cart:price_usd",
        };
    }

    if (item.price_twd != null) {
        return {
            amount: normalizeAmount(item.price_twd),
            currency: "TWD",
            source: "cart:price_twd",
        };
    }

    return {
        amount: normalizeAmount(item.price),
        currency: normalizeCurrency(item.currency, ""),
        source: "cart:legacy",
    };
}

function formatPrice(priceEntry = {}, locale = "zh-TW") {
    const normalizedLocale = normalizeLocale(locale);
    const amount = normalizeAmount(priceEntry.amount ?? priceEntry);
    const currency = normalizeCurrency(priceEntry.currency, "");
    if (amount <= 0) return normalizedLocale === "en" ? "Free" : "免費";

    try {
        const options = {
            style: "currency",
            currency,
            currencyDisplay: "symbol",
        };
        if (currency === "TWD") {
            options.minimumFractionDigits = 0;
            options.maximumFractionDigits = 0;
        }
        return new Intl.NumberFormat(normalizedLocale === "en" ? "en-US" : "zh-TW", options).format(amount);
    } catch (_) {
        if (currency === "TWD") {
            return `NT$ ${Math.round(amount).toLocaleString()}`;
        }
        return `${currency} ${amount.toLocaleString()}`;
    }
}

module.exports = {
    formatPrice,
    normalizeAmount,
    normalizeCurrency,
    normalizeLocale,
    readPriceEntry,
    resolveCartPrice,
    resolveLessonPrice,
    hasLessonPriceData,
};
