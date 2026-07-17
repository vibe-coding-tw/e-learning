"use strict";

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getRole, assertAdminRole, getLessonsForAdmin, getSeedableDistributorProducts, loadDistributorPortalOrders, loadDistributorPortalTutors, loadDistributorPortalSettlement, assertDistributorScope, findUserDocByEmail } = require("./admin-utils");
const { normalizeText, normalizeEmail } = require("../dashboard-utils");
const { assertAuthenticated, assertRequiredValue } = require("vibe-functions-core/access-utils-core");
const { getUserDistributorScope, loadDistributorScopedUsers } = require("./distributor-utils");
const { evaluateDeleteDistributorBlockers } = require("./delete-distributor-checks");

function normalizeDistributorStatus(value = "") {
    const normalized = String(value || "").trim().toUpperCase();
    return ["ACTIVE", "PAUSED", "INACTIVE"].includes(normalized) ? normalized : "ACTIVE";
}

function normalizePricePolicyMode(value = "") {
    const normalized = String(value || "").trim().toUpperCase();
    return ["FREE", "GUIDED", "ADMIN_ONLY"].includes(normalized) ? normalized : "GUIDED";
}

function parseDistributorRegions(value = "") {
    const source = Array.isArray(value)
        ? value
        : String(value || "").split(/[\n,]/g);
    const regions = [];
    source.forEach((item) => {
        const region = normalizeText(item || "").toUpperCase();
        if (!region || regions.includes(region)) return;
        regions.push(region);
    });
    return regions;
}

function buildDistributorPayload(data = {}, existing = {}) {
    const id = normalizeText(data.distributorId || data.id || existing.id || "");
    const name = String(data.name || existing.name || "").trim();
    const status = normalizeDistributorStatus(data.status || existing.status || "ACTIVE");
    const regions = parseDistributorRegions(data.regions || existing.regions || []);
    const defaultCurrency = normalizeText(data.defaultCurrency || existing.defaultCurrency || "TWD").toUpperCase() || "TWD";
    const pricePolicyMode = normalizePricePolicyMode(data.pricePolicyMode || existing.pricePolicyMode || "GUIDED");
    const settlementMethod = String(data.settlementMethod || existing.settlementMethod || "").trim();
    return { id, name, status, regions, defaultCurrency, pricePolicyMode, settlementMethod };
}

function mapDistributorDoc(doc = null) {
    if (!doc) return null;
    return { id: doc.id, ...(doc.data ? (doc.data() || {}) : {}) };
}

const upsertDistributor = onCall(async (request) => {
    const { auth, data } = request;
    assertAuthenticated(auth, "請先登入");

    const dbRef = admin.firestore();
    const role = await getRole(auth.uid, auth?.token?.email || "");
    assertAdminRole(role, "僅限管理員新增或修改經銷商");

    const payload = data || {};
    const existingId = normalizeText(payload.distributorId || payload.id || "");
    const existingDoc = existingId ? await dbRef.collection("distributors").doc(existingId).get() : null;
    const existingData = existingDoc && existingDoc.exists ? (existingDoc.data() || {}) : {};
    const distributor = buildDistributorPayload(payload, existingData);

    assertRequiredValue(distributor.id, "missing-distributor-id");
    assertRequiredValue(distributor.name, "missing-distributor-name");

    const docRef = dbRef.collection("distributors").doc(distributor.id);
    const createdAt = existingDoc && existingDoc.exists && existingData.createdAt
        ? existingData.createdAt
        : admin.firestore.FieldValue.serverTimestamp();

    await docRef.set({
        name: distributor.name,
        status: distributor.status,
        regions: distributor.regions,
        defaultCurrency: distributor.defaultCurrency,
        pricePolicyMode: distributor.pricePolicyMode,
        settlementMethod: distributor.settlementMethod,
        updatedBy: auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt
    }, { merge: true });

    return {
        success: true,
        distributor: {
            id: distributor.id,
            name: distributor.name,
            status: distributor.status,
            regions: distributor.regions,
            defaultCurrency: distributor.defaultCurrency,
            pricePolicyMode: distributor.pricePolicyMode,
            settlementMethod: distributor.settlementMethod
        }
    };
});

const deleteDistributor = onCall(async (request) => {
    const { auth, data } = request;
    assertAuthenticated(auth, "請先登入");

    const dbRef = admin.firestore();
    const role = await getRole(auth.uid, auth?.token?.email || "");
    assertAdminRole(role, "僅限管理員刪除經銷商");

    const distributorId = normalizeText(data?.distributorId || data?.id || "");
    assertRequiredValue(distributorId, "missing-distributor-id");

    try {
        const [
            priceBooksSnap,
            ordersByDistributorSnap,
            ordersByOwnerSnap,
            ordersByPartnerSnap,
            scopedUsers,
            defaultRuleSnap,
            backupRuleSnap
        ] = await Promise.all([
            dbRef.collection("dealer_price_books").where("distributorId", "==", distributorId).limit(1).get(),
            dbRef.collection("orders").where("distributorId", "==", distributorId).limit(1).get(),
            dbRef.collection("orders").where("fulfillmentOwnerId", "==", distributorId).limit(1).get(),
            dbRef.collection("orders").where("fulfillmentPartnerId", "==", distributorId).limit(1).get(),
            loadDistributorScopedUsers(dbRef, distributorId),
            dbRef.collection("region_distributor_rules").where("defaultDistributorId", "==", distributorId).limit(1).get(),
            dbRef.collection("region_distributor_rules").where("backupDistributorIds", "array-contains", distributorId).limit(1).get()
        ]);

        const blockers = evaluateDeleteDistributorBlockers({
            priceBooksSnap,
            ordersByDistributorSnap,
            ordersByOwnerSnap,
            ordersByPartnerSnap,
            scopedUsers,
            defaultRuleSnap,
            backupRuleSnap
        });

        if (blockers.blocked) {
            throw new HttpsError(
                "failed-precondition",
                `請先清除關聯資料再刪除：價格表 ${blockers.summary.priceBooks}、操作者 ${blockers.summary.operators}、訂單 ${blockers.summary.orders}、區域規則 ${blockers.summary.regionRules}。`
            );
        }

        await dbRef.collection("distributors").doc(distributorId).delete();
        return { success: true, distributorId };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error("[deleteDistributor] unexpected failure", {
            distributorId,
            message: error?.message || String(error),
            stack: error?.stack || null
        });
        throw new HttpsError("internal", "刪除經銷商時發生未預期錯誤，請稍後重試");
    }
});

const assignDistributorOperator = onCall(async (request) => {
    const { auth, data } = request;
    assertAuthenticated(auth, "請先登入");

    const dbRef = admin.firestore();
    const role = await getRole(auth.uid, auth?.token?.email || "");
    assertAdminRole(role, "僅限管理員指派經銷商操作者");

    const payload = data || {};
    const distributorId = normalizeText(payload.distributorId || "");
    const operatorUid = normalizeText(payload.uid || "");
    const operatorEmail = normalizeEmail(payload.email || "");
    const clear = payload.clear === true;

    assertRequiredValue(distributorId, "missing-distributor-id");
    assertRequiredValue(operatorUid || operatorEmail, "missing-operator-identifier");

    const distributorDoc = await dbRef.collection("distributors").doc(distributorId).get();
    if (!distributorDoc.exists) {
        throw new HttpsError("not-found", `distributor-not-found: ${distributorId}`);
    }

    let userDoc = null;
    if (operatorUid) {
        userDoc = await dbRef.collection("users").doc(operatorUid).get();
    } else if (operatorEmail) {
        userDoc = await findUserDocByEmail(dbRef, operatorEmail);
    }
    if (!userDoc || !userDoc.exists) {
        throw new HttpsError("not-found", `user-not-found: ${operatorUid || operatorEmail}`);
    }

    const userRef = userDoc.ref;
    await userRef.set({
        distributorId: clear ? "" : distributorId,
        "commercial.distributorId": clear ? "" : distributorId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return {
        success: true,
        distributorId,
        uid: userDoc.id,
        email: (userDoc.data() || {}).email || operatorEmail || "",
        assigned: !clear
    };
});

const getDistributorPortalData = onCall(async (request) => {
    const { auth } = request;
    assertAuthenticated(auth, "請先登入");

    const uid = auth.uid;
    const dbRef = admin.firestore();
    const userDoc = await dbRef.collection("users").doc(uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const role = await getRole(uid, auth?.token?.email || "");
    assertAdminRole(role, "僅限管理員存取經銷商管理頁");

    const requestedDistributorId = normalizeText(request.data?.distributorId || "");
    const distributorQuerySnap = await dbRef.collection("distributors").get();
    const allDistributors = [];
    distributorQuerySnap.forEach((doc) => {
        allDistributors.push(mapDistributorDoc(doc));
    });
    allDistributors.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));

    const selectedDistributorId = requestedDistributorId || (allDistributors[0]?.id || "");

    const lessons = await getLessonsForAdmin(selectedDistributorId);
    const distributorDoc = selectedDistributorId ? await dbRef.collection("distributors").doc(selectedDistributorId).get() : null;
    const distributorData = distributorDoc && distributorDoc.exists ? (distributorDoc.data() || {}) : {};
    const selectedDistributor = selectedDistributorId
        ? {
            id: selectedDistributorId,
            ...(distributorData || {})
        }
        : null;
    const seedableProducts = getSeedableDistributorProducts(
        lessons,
        distributorData.defaultCurrency || userData.defaultCurrency || "TWD"
    );
    const distributorOperatorsRaw = selectedDistributorId
        ? await loadDistributorScopedUsers(dbRef, selectedDistributorId)
        : [];
    const distributorOperators = distributorOperatorsRaw.map((operator) => ({
        uid: operator.id || operator.uid || "",
        email: operator.email || "",
        name: operator.name || operator.displayName || operator.email || operator.id || "",
        distributorId: getUserDistributorScope(operator) || "",
        role: operator.role || "user",
        tutorCount: operator.tutorConfigs ? Object.keys(operator.tutorConfigs || {}).length : 0,
        authorizedUnitCount: operator.tutorConfigs
            ? Object.values(operator.tutorConfigs || {}).filter((cfg) => cfg && cfg.authorized === true).length
            : 0,
        updatedAt: operator.updatedAt || null
    }));

    const lessonHiddenMap = {};
    lessons.forEach((l) => { lessonHiddenMap[l.docId] = !!l.hiddenFromCatalog; });

    const [orderData, tutorData, settlementData] = selectedDistributorId
        ? await Promise.all([
            loadDistributorPortalOrders(dbRef, selectedDistributorId, lessons, distributorData.name || selectedDistributorId),
            loadDistributorPortalTutors(dbRef, selectedDistributorId),
            loadDistributorPortalSettlement(dbRef, selectedDistributorId)
        ])
        : [
            { items: [], summary: { totalOrders: 0, physicalOrderCount: 0, pendingShipmentCount: 0, shippedCount: 0, grossAmount: 0 } },
            { items: [], summary: { tutorCount: 0, authorizedUnitCount: 0 } },
            { period: "", rows: [], summary: { period: "", paidTotal: 0, plannedTotal: 0, blockedTotal: 0, rowCount: 0, tutorCount: 0 } }
        ];

    return {
        success: true,
        role: "admin",
        isTutor: !!userData.tutorConfigs && Object.keys(userData.tutorConfigs || {}).length > 0,
        uid,
        email: auth.token?.email || userData.email || "",
        name: userData.name || auth.token?.name || "",
        selectedDistributorId,
        canManagePricing: true,
        canManageDistributors: true,
        distributors: allDistributors,
        accessibleDistributors: allDistributors,
        orders: orderData.items,
        orderSummary: orderData.summary,
        tutors: tutorData.items,
        tutorSummary: tutorData.summary,
        settlement: settlementData,
        selectedDistributor,
        distributorOperators,
        seedableProductCount: seedableProducts.length,
        seedableProducts: seedableProducts.map((p) => ({
            docId: p.docId || "",
            title: p.title || "",
            titleEn: p.titleEn || "",
            lessonIndex: Number(p.lessonIndex) || 0,
            level: p.level || "",
            category: p.category || "",
            hiddenFromCatalog: p.hiddenFromCatalog === true
        })),
        totalLessons: lessons.length,
        lessonHiddenMap,
        user: {
            uid,
            email: auth.token?.email || userData.email || "",
            name: userData.name || auth.token?.name || "",
            distributorId: selectedDistributorId,
            role: "admin"
        }
    };
});

module.exports = {
    upsertDistributor,
    deleteDistributor,
    assignDistributorOperator,
    getDistributorPortalData
};
