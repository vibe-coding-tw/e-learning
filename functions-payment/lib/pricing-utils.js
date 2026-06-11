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

function lookupCatalogPrice(catalog, currencyHint = "") {
    if (!isPriceEntryObject(catalog)) return null;
    const normalizedCurrencyHint = normalizeCurrency(currencyHint, "");
    const candidates = [
        "default",
        "base",
        "price",
        "salePrice",
        "amount",
        "current",
        "primary",
    ];
    const hintCandidates = [];
    if (normalizedCurrencyHint) {
        hintCandidates.push(
            normalizedCurrencyHint,
            normalizedCurrencyHint.toLowerCase()
        );
        if (normalizedCurrencyHint === "TWD") {
            hintCandidates.push("tw", "TW", "zh-TW", "zh-tw");
        }
        if (normalizedCurrencyHint === "USD") {
            hintCandidates.push("us", "US", "en", "en-US", "en-us");
        }
    }
    candidates.push(...hintCandidates);
    candidates.push(
        "TWD",
        "USD",
        "HKD",
        "JPY",
        "CNY",
        "twd",
        "usd",
        "hkd",
        "jpy",
        "cny",
        "tw",
        "us"
    );

    for (const key of candidates) {
        if (catalog[key] == null) continue;
        const entry = readPriceEntry(catalog[key], "");
        if (entry) return { ...entry, source: `catalog:${key}` };
    }

    const fallbackKey = Object.keys(catalog).find((key) => catalog[key] != null);
    if (fallbackKey) {
        const entry = readPriceEntry(catalog[fallbackKey], "");
        if (entry) return { ...entry, source: `catalog:${fallbackKey}` };
    }

    return null;
}

function resolveLessonPrice(lesson = {}, currencyHint = "") {
    if (lesson.dealerPrice != null && lesson.dealerPrice !== "") {
        return {
            amount: normalizeAmount(lesson.dealerPrice),
            currency: normalizeCurrency(lesson.dealerCurrency || lesson.currency || currencyHint || "", ""),
            source: "dealer_price"
        };
    }

    const catalog = priceCatalogFromLesson(lesson);
    const normalizedCurrencyHint = normalizeCurrency(
        lesson.currency || lesson.price_currency || lesson.priceCurrency || lesson.currencyCode || "",
        ""
    );
    const catalogHit = lookupCatalogPrice(catalog, normalizedCurrencyHint || currencyHint);
    if (catalogHit) return catalogHit;

    const effectiveCurrencyHint = normalizedCurrencyHint || normalizeCurrency(currencyHint, "");

    if (effectiveCurrencyHint === "USD" && lesson.price_usd != null) {
        return { amount: normalizeAmount(lesson.price_usd), currency: "USD", source: "legacy:price_usd" };
    }
    if (effectiveCurrencyHint === "TWD" && lesson.price_twd != null) {
        return { amount: normalizeAmount(lesson.price_twd), currency: "TWD", source: "legacy:price_twd" };
    }
    if (lesson.price_usd != null) {
        return { amount: normalizeAmount(lesson.price_usd), currency: "USD", source: "legacy:price_usd" };
    }
    if (lesson.price_twd != null) {
        return { amount: normalizeAmount(lesson.price_twd), currency: "TWD", source: "legacy:price_twd" };
    }

    const fallbackCurrency = effectiveCurrencyHint || normalizeCurrency(lesson.currency, "");
    return {
        amount: normalizeAmount(lesson.price),
        currency: fallbackCurrency,
        source: "legacy:price",
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
    lookupCatalogPrice,
    normalizeAmount,
    normalizeCurrency,
    normalizeLocale,
    readPriceEntry,
    resolveCartPrice,
    resolveLessonPrice,
};
