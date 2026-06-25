function normalizeLocale(raw = "") {
    const v = String(raw || "").trim().toLowerCase();
    if (!v) return "en";
    if (v.startsWith("zh") || v === "tw" || v.startsWith("tw-")) return "zh-TW";
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

function resolveLessonPrice(lesson = {}, currencyHint = "") {
    if (lesson.dealerPrice != null && lesson.dealerPrice !== "") {
        return {
            amount: normalizeAmount(lesson.dealerPrice),
            currency: normalizeCurrency(lesson.dealerCurrency || lesson.currency || currencyHint || "", ""),
            source: "dealer_price",
            hasPriceData: true
        };
    }

    return {
        amount: null,
        currency: normalizeCurrency(lesson.dealerCurrency || lesson.currency || currencyHint || "", ""),
        source: "dealer_price:missing",
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
};
