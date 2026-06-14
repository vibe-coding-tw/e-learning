const { normalizeCurrency, resolveLessonPrice } = require("./pricing-utils");

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeMoney(value = 0) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeRegionCode(value = "") {
    const raw = normalizeText(value).toLowerCase();
    if (!raw) return "";
    if (raw === "zh-tw" || raw === "tw") return "tw";
    if (raw === "en" || raw === "us" || raw === "en-us") return "en";
    return raw;
}

function normalizeStatus(value = "") {
    return normalizeText(value).toUpperCase() || "ACTIVE";
}

function isActiveDistributor(data = {}) {
    return normalizeStatus(data.status) === "ACTIVE";
}

function findLessonByDocumentId(lessons = [], docId = "") {
    const normalized = normalizeText(docId).replace(/\.html$/i, "");
    if (!normalized) return null;
    return (Array.isArray(lessons) ? lessons : []).find((lesson) => 
        normalizeText(lesson.id).replace(/\.html$/i, "") === normalized ||
        normalizeText(lesson.courseId).replace(/\.html$/i, "") === normalized ||
        normalizeText(lesson.courseKey).replace(/\.html$/i, "") === normalized
    ) || null;
}

function normalizePriceBookDoc(doc = {}, { distributorId = "", docId = "" } = {}) {
    const salePrice = normalizeMoney(doc.salePrice);
    const promoPrice = doc.promoPrice == null ? null : normalizeMoney(doc.promoPrice);
    const currency = normalizeCurrency(doc.currency, "USD");
    const normalizedDocId = normalizeText(doc.docId || doc.sourceDocId || docId);
    return {
        distributorId: normalizeText(doc.distributorId || distributorId),
        docId: normalizedDocId,
        sourceDocId: normalizeText(doc.sourceDocId || normalizedDocId),
        currency,
        salePrice,
        promoPrice,
        effectiveFrom: doc.effectiveFrom || null,
        effectiveTo: doc.effectiveTo || null,
        promoEffectiveFrom: doc.promoEffectiveFrom || null,
        promoEffectiveTo: doc.promoEffectiveTo || null,
        isActive: doc.isActive !== false,
        version: normalizeText(doc.version || doc.pricingVersion || "v1"),
        updatedBy: normalizeText(doc.updatedBy || ""),
        updatedAt: doc.updatedAt || null,
    };
}

function toMillis(value = null) {
    if (!value) return 0;
    try {
        if (typeof value.toMillis === "function") return value.toMillis();
        if (typeof value.toDate === "function") return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    } catch (_) {
        return 0;
    }
}

function isWithinWindow(startValue, endValue, now = Date.now()) {
    const startMs = toMillis(startValue);
    const endMs = toMillis(endValue);
    if (startMs && now < startMs) return false;
    if (endMs && now > endMs) return false;
    return true;
}

function resolvePriceBookAmount(priceBook = {}) {
    const now = Date.now();
    const promoActive = priceBook.promoPrice != null
        && isWithinWindow(priceBook.promoEffectiveFrom, priceBook.promoEffectiveTo, now);
    const amount = promoActive ? Number(priceBook.promoPrice || 0) : Number(priceBook.salePrice || 0);
    return {
        amount,
        currency: normalizeCurrency(priceBook.currency, ""),
        pricingVersion: priceBook.version || "v1",
        isPromoActive: promoActive
    };
}

async function resolveDistributorFromUsers(db, { tutorId = "", promotionCode = "", customerId = "" } = {}) {
    const candidates = [];
    const safeGet = async (docId) => {
        if (!docId) return null;
        const snap = await db.collection("users").doc(docId).get();
        return snap.exists ? (snap.data() || null) : null;
    };

    if (tutorId) {
        const tutorData = await safeGet(tutorId);
        if (tutorData) {
            candidates.push({
                distributorId: normalizeText(
                    tutorData.distributorId ||
                    tutorData.commercial?.distributorId ||
                    tutorData.tutorDistributorId ||
                    ""
                ),
                source: "tutor"
            });
        }
    }

    if (promotionCode) {
        const promo = normalizeText(promotionCode).toUpperCase();
        if (promo) {
            const snap = await db.collection("users").where("promotionCode", "==", promo).limit(10).get();
            snap.forEach((doc) => {
                const data = doc.data() || {};
                candidates.push({
                    distributorId: normalizeText(
                        data.distributorId ||
                        data.commercial?.distributorId ||
                        data.tutorDistributorId ||
                        ""
                    ),
                    source: "promotionCode",
                    userId: doc.id
                });
            });
        }
    }

    if (customerId) {
        const customerData = await safeGet(customerId);
        if (customerData) {
            candidates.push({
                distributorId: normalizeText(
                    customerData.distributorId ||
                    customerData.preferredDistributorId ||
                    customerData.commercial?.distributorId ||
                    ""
                ),
                source: "customer"
            });
        }
    }

    const match = candidates.find(item => item.distributorId);
    if (match) return { distributorId: match.distributorId, source: match.source, candidates };
    return { distributorId: "", source: "", candidates };
}

async function resolveDistributorForCheckout(db, {
    distributorId = "",
    tutorId = "",
    promotionCode = "",
    region = "",
    customerId = "",
    docId = ""
} = {}) {
    const explicitDistributorId = normalizeText(distributorId);
    if (explicitDistributorId) {
        const distSnap = await db.collection("distributors").doc(explicitDistributorId).get();
        if (!distSnap.exists) {
            return {
                distributorId: "",
                distributor: null,
                state: "missing",
                reason: "explicit distributor not found"
            };
        }
        const distributor = { id: distSnap.id, ...(distSnap.data() || {}) };
        return {
            distributorId: distributor.id,
            distributor,
            state: isActiveDistributor(distributor) ? "resolved" : "inactive",
            reason: "explicit distributor"
        };
    }

    const userResolution = await resolveDistributorFromUsers(db, { tutorId, promotionCode, customerId });
    if (userResolution.distributorId) {
        const distSnap = await db.collection("distributors").doc(userResolution.distributorId).get();
        if (distSnap.exists) {
            const distributor = { id: distSnap.id, ...(distSnap.data() || {}) };
            return {
                distributorId: distributor.id,
                distributor,
                state: isActiveDistributor(distributor) ? "resolved" : "inactive",
                reason: userResolution.source || "user-binding",
                candidates: userResolution.candidates
            };
        }
    }

    const regionCode = normalizeRegionCode(region);
    if (regionCode) {
        const regionSnap = await db.collection("distributors")
            .where("regions", "array-contains", regionCode)
            .get();
        const active = [];
        regionSnap.forEach((doc) => {
            const data = doc.data() || {};
            if (isActiveDistributor(data)) {
                active.push({ id: doc.id, ...data });
            }
        });

        if (active.length === 1) {
            return {
                distributorId: active[0].id,
                distributor: active[0],
                state: "resolved",
                reason: "region-single-match"
            };
        }

        if (active.length > 1) {
            active.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
            return {
                distributorId: "",
                distributor: null,
                state: "ambiguous",
                reason: "multiple-region-matches",
                candidates: active.map((item) => ({
                    distributorId: item.id,
                    name: item.name || item.id,
                    regions: item.regions || []
                }))
            };
        }
    }

    return {
        distributorId: "",
        distributor: null,
        state: "unresolved",
        reason: "no distributor binding"
    };
}

async function loadDistributorPriceBook(db, {
    distributorId = "",
    docId = "",
    priceBookId = "",
    locale = "zh-TW"
} = {}) {
    const normalizedDistributorId = normalizeText(distributorId);
    const normalizedDocId = normalizeText(docId);
    const normalizedPriceBookId = normalizeText(priceBookId);
    if (!normalizedDistributorId || !normalizedDocId) {
        return null;
    }

    if (normalizedPriceBookId) {
        const doc = await db.collection("dealer_price_books").doc(normalizedPriceBookId).get();
        if (!doc.exists) return null;
        const data = normalizePriceBookDoc(doc.data() || {}, { distributorId: normalizedDistributorId, docId: normalizedDocId });
        if (data.distributorId !== normalizedDistributorId || data.docId !== normalizedDocId) {
            return null;
        }
        return { id: doc.id, ...data, source: "direct" };
    }

    const querySnap = await db.collection("dealer_price_books")
        .where("distributorId", "==", normalizedDistributorId)
        .get();

    const books = [];
    querySnap.forEach((doc) => {
        const data = normalizePriceBookDoc(doc.data() || {}, { distributorId: normalizedDistributorId, docId: normalizedDocId });
        if (data.isActive === false) return;
        if (normalizedDocId && data.docId && data.docId !== normalizedDocId) return;
        const effectiveFromMs = data.effectiveFrom?.toMillis ? data.effectiveFrom.toMillis() : (data.effectiveFrom?.seconds ? data.effectiveFrom.seconds * 1000 : 0);
        const effectiveToMs = data.effectiveTo?.toMillis ? data.effectiveTo.toMillis() : (data.effectiveTo?.seconds ? data.effectiveTo.seconds * 1000 : 0);
        const now = Date.now();
        if (effectiveFromMs && effectiveFromMs > now) return;
        if (effectiveToMs && effectiveToMs < now) return;
        books.push({ id: doc.id, ...data, source: "book-query" });
    });

    books.sort((a, b) => {
        const aFrom = a.effectiveFrom?.toMillis ? a.effectiveFrom.toMillis() : 0;
        const bFrom = b.effectiveFrom?.toMillis ? b.effectiveFrom.toMillis() : 0;
        return bFrom - aFrom;
    });

    if (books.length === 0) return null;
    const chosen = books[0];
    const resolvedAmount = resolvePriceBookAmount(chosen);
    return {
        ...chosen,
        amount: resolvedAmount.amount,
        currency: resolvedAmount.currency,
        pricingVersion: resolvedAmount.pricingVersion,
        isPromoActive: resolvedAmount.isPromoActive
    };
}

async function resolveDistributorCheckoutQuote(db, {
    lessons = [],
    distributorId = "",
    tutorId = "",
    promotionCode = "",
    region = "",
    customerId = "",
    docId = "",
    locale = "zh-TW",
    priceBookId = ""
} = {}) {
    const normalizedDocId = normalizeText(docId);
    if (!normalizedDocId) {
        return {
            success: false,
            state: "missing-doc",
            reason: "docId is required"
        };
    }

    const distributorResolution = await resolveDistributorForCheckout(db, {
        distributorId,
        tutorId,
        promotionCode,
        region,
        customerId,
        docId: normalizedDocId
    });

    const targetLesson = findLessonByDocumentId(lessons, normalizedDocId);
    const legacyLessonPrice = targetLesson ? resolveLessonPrice(targetLesson, locale) : null;
    const priceBook = distributorResolution.distributorId
        ? await loadDistributorPriceBook(db, {
            distributorId: distributorResolution.distributorId,
            docId: normalizedDocId,
            priceBookId,
            locale
        })
        : null;

    const selectedPrice = priceBook
        ? (priceBook.currency ? {
            amount: Number(priceBook.amount || 0),
            currency: priceBook.currency,
            source: `dealer_price_books:${priceBook.source || "book"}`,
            pricingVersion: priceBook.pricingVersion || "v1"
        } : null)
        : (legacyLessonPrice && legacyLessonPrice.currency ? {
            amount: Number(legacyLessonPrice.amount || 0),
            currency: legacyLessonPrice.currency,
            source: legacyLessonPrice.source || "metadata_lessons",
            pricingVersion: targetLesson?.pricingVersion || "legacy"
        } : null);

    const state = distributorResolution.state === "ambiguous"
        ? "ambiguous"
        : (selectedPrice ? "resolved" : "unresolved");

    return {
        success: !!selectedPrice || distributorResolution.state === "ambiguous",
        state,
        reason: distributorResolution.reason,
        distributor: distributorResolution.distributor || null,
        distributorId: distributorResolution.distributorId || "",
        distributorCandidates: distributorResolution.candidates || [],
        priceBook: priceBook || null,
        price: selectedPrice,
        docId: targetLesson ? (targetLesson.id || targetLesson.courseId || targetLesson.courseKey || normalizedDocId) : normalizedDocId,
        fallbackSource: priceBook ? "dealer_price_books" : (legacyLessonPrice ? "metadata_lessons" : "none")
    };
}

async function listDistributorPriceBooks(db, distributorId = "") {
    const normalizedDistributorId = normalizeText(distributorId);
    if (!normalizedDistributorId) return [];
    const snap = await db.collection("dealer_price_books")
        .where("distributorId", "==", normalizedDistributorId)
        .get();

    const items = [];
    snap.forEach((doc) => {
        items.push({ id: doc.id, ...normalizePriceBookDoc(doc.data() || {}, { distributorId: normalizedDistributorId }) });
    });
    items.sort((a, b) => {
        const aTime = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const bTime = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        return bTime - aTime;
    });
    return items;
}

module.exports = {
    findLessonByDocumentId,
    listDistributorPriceBooks,
    loadDistributorPriceBook,
    normalizeMoney,
    normalizePriceBookDoc,
    normalizeRegionCode,
    resolveDistributorCheckoutQuote,
    resolveDistributorForCheckout,
    resolvePriceBookAmount,
    resolveLessonPrice
};
