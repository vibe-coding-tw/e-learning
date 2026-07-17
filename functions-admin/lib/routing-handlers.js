"use strict";

const admin = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getRole, assertAdminRole, getLessonsForAdmin, assertDistributorScope } = require("./admin-utils");
const { normalizeText, normalizeEmail } = require("../dashboard-utils");
const { assertAuthenticated, assertRequiredValue } = require("vibe-functions-core/access-utils-core");
const { getContentRuntimeConfig } = require("vibe-functions-core/runtime-state");
const { normalizeRoutingRegionCode, distributorMatchesRegion, collectDistributorRegions, chooseRecommendedDistributor } = require("./routing-utils");
const { getUserDistributorScope } = require("./distributor-utils");
const { resolveDistributorCheckoutQuote, findLessonByDocumentId } = require("./distributor-pricing");
const { getDistributorPriceBooksCore, upsertDistributorPriceBookCore } = require("./pricing-handlers");

async function getDistributorRoutingOptionsCore(auth, data) {
    const dbRef = admin.firestore();
    const runtimeConfig = await getContentRuntimeConfig(dbRef);
    const defaultRegion = runtimeConfig.defaultRegion || "US";
    const defaultDistributorId = runtimeConfig.defaultDistributorId || "default-usd";

    let userData = {};
    if (auth && auth.uid) {
        const userDoc = await dbRef.collection("users").doc(auth.uid).get();
        if (userDoc.exists) userData = userDoc.data() || {};
    }

    const requestedRegion = normalizeRoutingRegionCode(data?.region || userData.preferredRegion || userData.region || defaultRegion);
    const distributorSnap = await dbRef.collection("distributors").get();
    const distributors = [];
    distributorSnap.forEach((doc) => {
        const item = { id: doc.id, ...(doc.data() || {}) };
        if (item.status === "ACTIVE") distributors.push(item);
    });
    distributors.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));

    const ruleDoc = requestedRegion
        ? await dbRef.collection("region_distributor_rules").doc(requestedRegion).get()
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

const getDistributorRoutingOptions = onCall(async (request) => getDistributorRoutingOptionsCore(request.auth, request.data));

async function resolveDistributorCheckoutQuoteCore(auth, data) {
    assertAuthenticated(auth);
    const dbRef = admin.firestore();
    const payload = data || {};
    const { loadLessons } = require("vibe-functions-core/access-utils-core");
    const lessons = await loadLessons(dbRef);
    const normalizedDocId = normalizeText(payload.docId || payload.courseId || payload.itemId || "");
    const matchedLesson =
        findLessonByDocumentId(lessons, normalizedDocId) ||
        findLessonByDocumentId(lessons, `${normalizedDocId}.html`);
    const quote = await resolveDistributorCheckoutQuote(dbRef, {
        lessons,
        docId: matchedLesson?.id || matchedLesson?.courseId || normalizedDocId || "",
        region: payload.region || "",
        locale: payload.locale || "en",
        tutorId: payload.tutorId || "",
        promotionCode: payload.promotionCode || payload.promoCode || "",
        customerId: payload.customerId || auth.uid || "",
        distributorId: payload.distributorId || "",
        priceBookId: payload.priceBookId || ""
    });
    return { success: true, ...quote };
}

const resolveDistributorCheckoutQuoteFn = onCall(async (request) => resolveDistributorCheckoutQuoteCore(request.auth, request.data));

async function updateUserRoutingPreferenceCore(auth, data) {
    assertAuthenticated(auth);

    const dbRef = admin.firestore();
    const payload = data || {};
    const preferredRegion = normalizeRoutingRegionCode(payload.preferredRegion || "");
    const preferredDistributorId = normalizeText(payload.preferredDistributorId || "");

    if (!preferredRegion && !preferredDistributorId) {
        return {
            success: true,
            preferredRegion: "",
            preferredDistributorId: ""
        };
    }

    let safePreferredDistributorId = preferredDistributorId;
    if (preferredDistributorId) {
        const distributorDoc = await dbRef.collection("distributors").doc(preferredDistributorId).get();
        if (!distributorDoc.exists) {
            logger.warn("[updateUserRoutingPreference] skip missing distributor", { uid: auth.uid, preferredDistributorId });
            safePreferredDistributorId = "";
        } else {
            const distributorData = distributorDoc.data() || {};
            const requestedRegion = preferredRegion || payload.region || distributorData.regions?.[0] || "";
            if (!distributorMatchesRegion(distributorData, requestedRegion)) {
                logger.warn("[updateUserRoutingPreference] skip mismatched distributor/region", {
                    uid: auth.uid,
                    preferredDistributorId,
                    preferredRegion: requestedRegion
                });
                safePreferredDistributorId = "";
            }
        }
    }

    const updatePayload = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (preferredRegion) {
        updatePayload.preferredRegion = preferredRegion;
        updatePayload.region = preferredRegion;
    }
    if (safePreferredDistributorId) {
        updatePayload.preferredDistributorId = safePreferredDistributorId;
        updatePayload.bindingSource = payload.bindingSource || "manual";
        updatePayload.bindingUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await dbRef.collection("users").doc(auth.uid).set(updatePayload, { merge: true });

    return {
        success: true,
        preferredRegion,
        preferredDistributorId: safePreferredDistributorId
    };
}

const updateUserRoutingPreference = onCall(async (request) => updateUserRoutingPreferenceCore(request.auth, request.data));

function mapHttpsErrorToStatus(code) {
    switch (code) {
        case "invalid-argument":
        case "failed-precondition":
        case "out-of-range":
            return 400;
        case "unauthenticated":
            return 401;
        case "permission-denied":
            return 403;
        case "not-found":
            return 404;
        case "already-exists":
        case "aborted":
            return 409;
        default:
            return 500;
    }
}

async function resolveRestAuth(req) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return null;
    const idToken = authHeader.slice(7).trim();
    if (!idToken) return null;
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        return { uid: decoded.uid, token: decoded };
    } catch (error) {
        logger.warn("[distributorApi] invalid bearer token:", error.message || error);
        return null;
    }
}

function sendRestError(res, error) {
    if (error instanceof HttpsError) {
        const status = mapHttpsErrorToStatus(error.code);
        return res.status(status).json({ error: error.message, code: error.code });
    }
    logger.error("[distributorApi] unhandled error:", error);
    return res.status(500).json({ error: error.message || "internal error" });
}

const distributorApi = onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "https://vibe-coding.tw");
    res.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");

    const pathname = String(req.path || "/").replace(/\/+$/, "") || "/";

    try {
        const auth = await resolveRestAuth(req);

        const priceBooksMatch = pathname.match(/^\/api\/admin\/distributors\/([^/]+)\/price-books$/);
        if (priceBooksMatch) {
            const distributorId = decodeURIComponent(priceBooksMatch[1]);
            if (req.method === "GET") {
                const result = await getDistributorPriceBooksCore(auth, { distributorId });
                return res.json(result);
            }
            if (req.method === "POST") {
                const body = req.body || {};
                const result = await upsertDistributorPriceBookCore(auth, { ...body, distributorId });
                return res.json(result);
            }
            return res.status(405).json({ error: "Method not allowed" });
        }

        if (pathname === "/api/checkout/distributor-resolution" && req.method === "GET") {
            const result = await getDistributorRoutingOptionsCore(auth, {
                region: req.query.region,
                tutorId: req.query.tutorId,
                promotionCode: req.query.promotionCode,
                docId: req.query.docId,
                customerId: req.query.customerId
            });
            return res.json(result);
        }

        if (pathname === "/api/checkout/distributor-recommendation" && req.method === "GET") {
            const result = await getDistributorRoutingOptionsCore(auth, {
                region: req.query.region,
                tutorId: req.query.tutorId,
                docId: req.query.docId,
                customerId: req.query.customerId
            });
            return res.json(result);
        }

        if (pathname === "/api/users/me/distributor-preference" && req.method === "PATCH") {
            const body = req.body || {};
            const result = await updateUserRoutingPreferenceCore(auth, body);
            return res.json(result);
        }

        if (pathname === "/api/checkout/quote" && req.method === "POST") {
            const body = req.body || {};
            const result = await resolveDistributorCheckoutQuoteCore(auth, body);
            return res.json(result);
        }

        if (pathname === "/api/admin/settlements/run" || pathname.match(/^\/api\/admin\/tutors\/[^/]+$/)) {
            return res.status(501).json({
                error: "not-implemented",
                message: "This endpoint is documented but intentionally not wired up yet — see the comment above distributorApi in functions-admin/index.js for why."
            });
        }

        return res.status(404).json({ error: "not-found", message: `No route for ${req.method} ${pathname}` });
    } catch (error) {
        return sendRestError(res, error);
    }
});

module.exports = {
    getDistributorRoutingOptions,
    resolveDistributorCheckoutQuote: resolveDistributorCheckoutQuoteFn,
    updateUserRoutingPreference,
    distributorApi
};
