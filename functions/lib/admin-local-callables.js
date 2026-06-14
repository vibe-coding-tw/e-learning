const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");

const { getContentRuntimeConfig } = require("./runtime-state");
const {
    resolveDistributorCheckoutQuote,
    findLessonByDocumentId,
    normalizeRegionCode,
} = require("./distributor-pricing");

if (!admin.apps.length) {
    admin.initializeApp();
}

function normalizeText(value = "") {
    return String(value || "").trim();
}

function getUserDistributorScope(userData = {}) {
    return normalizeText(
        userData.distributorId ||
        userData.commercial?.distributorId ||
        userData.tutorDistributorId ||
        userData.partnerDistributorId ||
        userData.preferredDistributorId ||
        ""
    );
}

function normalizeRoutingRegionCode(value = "") {
    const raw = normalizeText(value).toUpperCase();
    if (!raw) return "";
    if (raw === "ZH-TW" || raw === "TW" || raw === "TWD") return "TW";
    if (raw === "EN" || raw === "EN-US" || raw === "US" || raw === "USD") return "US";
    return raw;
}

function distributorMatchesRegion(distributor = {}, regionCode = "") {
    const normalizedRegionCode = normalizeRoutingRegionCode(regionCode);
    if (!normalizedRegionCode) return true;
    const regions = Array.isArray(distributor.regions) ? distributor.regions : [];
    return regions.some((region) => normalizeRoutingRegionCode(region) === normalizedRegionCode);
}

function collectDistributorRegions(distributors = []) {
    const regions = new Set();
    (Array.isArray(distributors) ? distributors : []).forEach((distributor) => {
        const items = Array.isArray(distributor.regions) ? distributor.regions : [];
        items.forEach((region) => {
            const normalized = normalizeRoutingRegionCode(region);
            if (normalized) regions.add(normalized);
        });
    });
    return Array.from(regions).sort((a, b) => String(a).localeCompare(String(b)));
}

function chooseRecommendedDistributor(distributors = [], {
    regionCode = "",
    preferredDistributorId = "",
    ruleDefaultDistributorId = "",
    ruleBackupDistributorIds = []
} = {}) {
    const active = (Array.isArray(distributors) ? distributors : [])
        .filter((item) => item && item.id && item.status === "ACTIVE");
    const regionMatched = active.filter((item) => distributorMatchesRegion(item, regionCode));
    const pickById = (distributorId = "") => {
        const normalizedId = String(distributorId || "").trim();
        if (!normalizedId) return null;
        return regionMatched.find((item) => item.id === normalizedId)
            || active.find((item) => item.id === normalizedId)
            || null;
    };

    const preferred = pickById(preferredDistributorId);
    if (preferred) {
        return { distributor: preferred, reason: "preferred-distributor" };
    }

    const defaultDistributor = pickById(ruleDefaultDistributorId);
    if (defaultDistributor) {
        return { distributor: defaultDistributor, reason: "region-default" };
    }

    for (const candidateId of Array.isArray(ruleBackupDistributorIds) ? ruleBackupDistributorIds : []) {
        const candidate = pickById(candidateId);
        if (candidate) {
            return { distributor: candidate, reason: "region-backup" };
        }
    }

    if (regionMatched.length === 1) {
        return { distributor: regionMatched[0], reason: "single-region-match" };
    }

    const fallback = regionMatched[0] || active[0] || null;
    return fallback
        ? { distributor: fallback, reason: regionMatched.length > 1 ? "first-region-match" : "first-active-distributor" }
        : { distributor: null, reason: "no-active-distributor" };
}

async function loadUserData(db, uid = "") {
    if (!uid) return {};
    const userDoc = await db.collection("users").doc(uid).get();
    return userDoc.exists ? (userDoc.data() || {}) : {};
}

async function loadLessons(db) {
    const snap = await db.collection("metadata_lessons").orderBy("orderWeight", "asc").get();
    return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id, docId: doc.id }));
}

async function loadDistributorRoutingOptions(request = {}) {
    const db = admin.firestore();
    const { auth, data } = request;
    const runtimeConfig = await getContentRuntimeConfig(db);
    const defaultRegion = runtimeConfig.defaultRegion || "US";
    const defaultDistributorId = runtimeConfig.defaultDistributorId || "default-usd";

    const userData = auth?.uid ? await loadUserData(db, auth.uid) : {};
    const requestedRegion = normalizeRoutingRegionCode(
        data?.region || userData.preferredRegion || userData.region || defaultRegion
    );

    const distributorSnap = await db.collection("distributors").get();
    const distributors = [];
    distributorSnap.forEach((doc) => {
        const item = { id: doc.id, ...(doc.data() || {}) };
        if (item.status === "ACTIVE") distributors.push(item);
    });
    distributors.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));

    const ruleDoc = requestedRegion
        ? await db.collection("region_distributor_rules").doc(requestedRegion).get()
        : null;
    const ruleData = ruleDoc && ruleDoc.exists ? (ruleDoc.data() || {}) : {};
    const eligibleDistributors = requestedRegion
        ? distributors.filter((item) => distributorMatchesRegion(item, requestedRegion))
        : distributors.slice();
    const recommendation = chooseRecommendedDistributor(distributors, {
        regionCode: requestedRegion,
        preferredDistributorId: userData.preferredDistributorId || getUserDistributorScope(userData),
        ruleDefaultDistributorId: ruleData.defaultDistributorId || defaultDistributorId,
        ruleBackupDistributorIds: ruleData.backupDistributorIds || []
    });
    const selectedDistributor = recommendation.distributor || null;

    return {
        success: true,
        region: requestedRegion,
        regions: collectDistributorRegions(distributors),
        eligibleDistributors: eligibleDistributors.map((item) => ({
            id: item.id,
            name: item.name || item.id,
            regions: Array.isArray(item.regions) ? item.regions : [],
            defaultCurrency: item.defaultCurrency || "",
            status: item.status || "ACTIVE"
        })),
        recommendation: selectedDistributor ? {
            distributorId: selectedDistributor.id,
            distributorName: selectedDistributor.name || selectedDistributor.id,
            reason: recommendation.reason,
            regions: Array.isArray(selectedDistributor.regions) ? selectedDistributor.regions : []
        } : {
            distributorId: "",
            distributorName: "",
            reason: recommendation.reason,
            regions: []
        },
        userPreference: {
            preferredRegion: normalizeRoutingRegionCode(userData.preferredRegion || userData.region || ""),
            preferredDistributorId: getUserDistributorScope(userData) || normalizeText(userData.preferredDistributorId || ""),
            bindingSource: normalizeText(userData.bindingSource || ""),
            bindingUpdatedAt: userData.bindingUpdatedAt || null
        }
    };
}

async function loadDistributorCheckoutQuote(request = {}) {
    const db = admin.firestore();
    const { auth, data } = request;
    if (!auth?.uid) {
        throw new HttpsError("unauthenticated", "請先登入");
    }

    const payload = data || {};
    const lessons = await loadLessons(db);
    const normalizedDocId = normalizeText(payload.docId || payload.courseId || payload.itemId || "");
    const matchedLesson =
        findLessonByDocumentId(lessons, normalizedDocId) ||
        findLessonByDocumentId(lessons, `${normalizedDocId}.html`);

    const quote = await resolveDistributorCheckoutQuote(db, {
        lessons,
        distributorId: payload.distributorId || "",
        tutorId: payload.tutorId || "",
        promotionCode: payload.promotionCode || payload.promoCode || "",
        region: payload.region || "",
        customerId: payload.customerId || auth.uid || "",
        docId: matchedLesson?.id || matchedLesson?.courseId || normalizedDocId || "",
        locale: payload.locale || "en",
        priceBookId: payload.priceBookId || ""
    });

    return {
        success: true,
        ...quote
    };
}

module.exports = {
    loadDistributorRoutingOptions,
    loadDistributorCheckoutQuote
};
