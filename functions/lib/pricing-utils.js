function normalizeLocale(raw = "") {
    const v = String(raw || "").trim().toLowerCase();
    if (!v) return "zh-TW";
    if (v.startsWith("zh")) return "zh-TW";
    return "en";
}

function regionFromLocale(locale = "") {
    return normalizeLocale(locale) === "en" ? "en" : "tw";
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

function priceCatalogFromLesson(lesson = {}) {
    return lesson.pricing
        || lesson.prices
        || lesson.priceByLocale
        || lesson.priceByRegion
        || lesson.priceMap
        || lesson.localizedPrices
        || lesson.localizedPricing
        || lesson.priceLocales
        || lesson.pricesByRegion
        || null;
}

function lookupCatalogPrice(catalog, locale = "zh-TW") {
    if (!isPriceEntryObject(catalog)) return null;
    const normalizedLocale = normalizeLocale(locale);
    const region = regionFromLocale(normalizedLocale);
    const candidates = [
        normalizedLocale,
        region,
        normalizedLocale.toLowerCase(),
        region.toLowerCase(),
        normalizedLocale === "en" ? "en-US" : "zh-TW",
        normalizedLocale === "en" ? "USD" : "TWD",
        normalizedLocale === "en" ? "usd" : "twd",
        normalizedLocale === "en" ? "us" : "tw",
        normalizedLocale === "en" ? "en" : "zh",
        normalizedLocale === "en" ? "english" : "chinese",
    ];

    for (const key of candidates) {
        if (catalog[key] == null) continue;
        const entry = readPriceEntry(catalog[key], normalizedLocale === "en" ? "USD" : "TWD");
        if (entry) return { ...entry, source: `catalog:${key}` };
    }

    return null;
}

function resolveLessonPrice(lesson = {}, locale = "zh-TW") {
    const normalizedLocale = normalizeLocale(locale);
    const catalog = priceCatalogFromLesson(lesson);
    const catalogHit = lookupCatalogPrice(catalog, normalizedLocale);
    if (catalogHit) return catalogHit;

    if (normalizedLocale === "en") {
        if (lesson.price_usd != null) {
            return { amount: normalizeAmount(lesson.price_usd), currency: "USD", source: "legacy:price_usd" };
        }
        if (lesson.price_twd != null) {
            return { amount: normalizeAmount(lesson.price_twd), currency: "TWD", source: "legacy:price_twd" };
        }
    } else {
        if (lesson.price_twd != null) {
            return { amount: normalizeAmount(lesson.price_twd), currency: "TWD", source: "legacy:price_twd" };
        }
        if (lesson.price_usd != null) {
            return { amount: normalizeAmount(lesson.price_usd), currency: "USD", source: "legacy:price_usd" };
        }
    }

    const fallbackCurrency = normalizeCurrency(lesson.currency, normalizedLocale === "en" ? "USD" : "TWD");
    return {
        amount: normalizeAmount(lesson.price),
        currency: fallbackCurrency || (normalizedLocale === "en" ? "USD" : "TWD"),
        source: "legacy:price",
    };
}

function resolveCartPrice(item = {}, locale = "zh-TW") {
    const normalizedLocale = normalizeLocale(locale);
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
        currency: normalizeCurrency(item.currency, normalizedLocale === "en" ? "USD" : "TWD"),
        source: "cart:legacy",
    };
}

function formatPrice(priceEntry = {}, locale = "zh-TW") {
    const normalizedLocale = normalizeLocale(locale);
    const amount = normalizeAmount(priceEntry.amount ?? priceEntry);
    const currency = normalizeCurrency(priceEntry.currency, normalizedLocale === "en" ? "USD" : "TWD");
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
    lookupCatalogPrice,
    normalizeAmount,
    normalizeCurrency,
    normalizeLocale,
    readPriceEntry,
    resolveCartPrice,
    resolveLessonPrice,
};
