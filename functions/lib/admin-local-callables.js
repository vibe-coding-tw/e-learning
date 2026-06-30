"use strict";
const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");

const { getContentRuntimeConfig } = require("vibe-functions-core/runtime-state");
const { loadLessons, normalizeText } = require("vibe-functions-core/access-utils-core");
const { getUserDistributorScope } = require("vibe-functions-core/distributor-utils-core");
const {
    collectDistributorRegions,
    chooseRecommendedDistributor,
    distributorMatchesRegion,
    normalizeRoutingRegionCode
} = require("vibe-functions-core/routing-utils-core");
const {
    resolveDistributorCheckoutQuote,
    findLessonByDocumentId,
} = require("vibe-functions-core/distributor-pricing");

if (!admin.apps.length) {
    admin.initializeApp();
}

async function loadUserData(db, uid = "") {
    if (!uid) return {};
    const userDoc = await db.collection("users").doc(uid).get();
    return userDoc.exists ? (userDoc.data() || {}) : {};
}

async function loadDistributorRoutingOptions(request = {}) {
    const db = admin.firestore();
    const { auth, data } = request;
    const runtimeConfig = await getContentRuntimeConfig(db);
    const defaultRegion = runtimeConfig.defaultRegion || "";
    const defaultDistributorId = runtimeConfig.defaultDistributorId || "";

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
