const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");

function bindLazyExports(modulePath, exportNames) {
    let cachedModule = null;
    const loadModule = () => {
        if (!cachedModule) {
            cachedModule = require(modulePath);
        }
        return cachedModule;
    };
    return exportNames.reduce((acc, exportName) => {
        acc[exportName] = (...args) => {
            const mod = loadModule();
            const fn = mod && mod[exportName];
            if (typeof fn !== "function") {
                throw new Error(`[lazy-module] ${modulePath} missing callable export: ${exportName}`);
            }
            return fn(...args);
        };
        return acc;
    }, {});
}

const { buildI18nFilenameCandidates, unitIdsMatch, normalizeLegacyId } = require("./lib/id-utils");
const { getContentRuntimeConfig } = require("./lib/runtime-state");
const {
    findLessonByDocumentId,
    resolvePriceBookAmount,
    resolveLessonPrice,
    loadDistributorPriceBook,
    listDistributorPriceBooks,
    normalizeMoney,
    normalizePriceBookDoc,
    normalizeRegionCode,
    resolveDistributorCheckoutQuote,
    resolveDistributorForCheckout
} = bindLazyExports("./lib/distributor-pricing", [
    "findLessonByDocumentId",
    "resolvePriceBookAmount",
    "resolveLessonPrice",
    "loadDistributorPriceBook",
    "listDistributorPriceBooks",
    "normalizeMoney",
    "normalizePriceBookDoc",
    "normalizeRegionCode",
    "resolveDistributorCheckoutQuote",
    "resolveDistributorForCheckout"
]);
const {
    buildTutorApplicationLegacyEntry,
    buildTutorApplicationRecord,
    buildTutorConfigEntry,
    fallbackNameFromEmail,
    generatePromotionCode,
    getEffectiveTutorConfig,
    getPreferredAssignmentUrl,
    getUserTutorConfig,
    hasQualifiedTutorStatus,
    indexAuthorizedTutorConfigForDashboard,
    queryTutorApplications,
    resolveNameFromUserData,
    resolveAssignmentUrlMaps,
    upsertTutorApplicationLegacyEntry,
    upsertTutorConfigForUser,
    ensureTutorPromotionCode
} = bindLazyExports("./lib/tutor-utils", [
    "buildTutorApplicationLegacyEntry",
    "buildTutorApplicationRecord",
    "buildTutorConfigEntry",
    "fallbackNameFromEmail",
    "generatePromotionCode",
    "getEffectiveTutorConfig",
    "getPreferredAssignmentUrl",
    "getUserTutorConfig",
    "hasQualifiedTutorStatus",
    "indexAuthorizedTutorConfigForDashboard",
    "queryTutorApplications",
    "resolveNameFromUserData",
    "resolveAssignmentUrlMaps",
    "upsertTutorApplicationLegacyEntry",
    "upsertTutorConfigForUser",
    "ensureTutorPromotionCode"
]);
const {
    buildOrderRecordSummary,
    buildPendingShipmentReminderEntry,
    buildReferralLinkDocId,
    buildShippingAddress,
    buildShippingContact,
    buildStudentOrderRecord,
    collectPurchasedUnitIds,
    extractReferralAssignmentsFromOrder,
    hasActiveOrderForCourse,
    getPhysicalUnitIdSet,
    isPhysicalMetadataLesson,
    isPhysicalOrderItem,
    itemContainsUnit,
    normalizeGitHubUrl,
    normalizeLogisticsData,
    normalizeOrderItems
} = bindLazyExports("./lib/order-utils", [
    "buildOrderRecordSummary",
    "buildPendingShipmentReminderEntry",
    "buildReferralLinkDocId",
    "buildShippingAddress",
    "buildShippingContact",
    "buildStudentOrderRecord",
    "collectPurchasedUnitIds",
    "extractReferralAssignmentsFromOrder",
    "hasActiveOrderForCourse",
    "getPhysicalUnitIdSet",
    "isPhysicalOrderItem",
    "itemContainsUnit",
    "normalizeGitHubUrl",
    "normalizeLogisticsData",
    "normalizeOrderItems"
]);
const {
    ensureGithubOrgMembership
} = bindLazyExports("./lib/github-utils", [
    "ensureGithubOrgMembership"
]);
const { isAssignmentAuthorized } = bindLazyExports("./lib/assignment-flow", [
    "isAssignmentAuthorized"
]);
const {
    sendStudentLinkedToTutorEmail,
    sendTutorLinkedToStudentEmail,
    sendTutorAuthorizationEmail,
    sendAdminNewApplicationEmail,
    sendApplicationResultEmail,
    sendTutorRecommendationCandidateEmail,
    sendStudentPendingTutorAssignmentReminder,
    sendAdminShipmentReminder,
} = require("./emailService");
const {
    DEFAULT_REVENUE_SHARE_POLICY,
    buildRevenueShareBalanceRecord,
    buildRevenueShareCreditRecord,
    buildRevenueSharePolicySnapshot,
    buildRevenueSharePayoutRow,
    collectRevenueShareChainTargets,
    loadRevenueSharePolicy,
    resolveRevenueShareRoleEmails
} = require("./lib/revenue-sharing");
const {
    issueInvestorEquity,
    loadActiveBalanceSheetSnapshot,
    loadActiveValuationSnapshot,
    loadBalanceSheetSnapshots,
    loadInvestorConfig,
    loadInvestorProfiles,
    loadValuationSnapshots,
    recordInvestorFinanceEvent,
    round2Amount,
    settleAnnualInvestorDividends,
    upsertBalanceSheetSnapshot,
    upsertValuationSnapshot
} = require("./lib/investor-ledger");
const {
    exportLedgerReport,
    generateLedgerReport,
    recordLedgerEvent
} = bindLazyExports("../functions/lib/ledger-engine", [
    "exportLedgerReport",
    "generateLedgerReport",
    "recordLedgerEvent"
]);
const {
    formatTaipeiDateTime: formatTaipeiDateTimeShared,
    runPendingAssignmentReminder,
    runPendingShipmentReminder
} = require("./lib/shared-reminders");
const {
    toMillis,
    previousYmPeriod
} = require("./lib/date-utils");
const {
    normalizeRoutingRegionCode,
    distributorMatchesRegion,
    collectDistributorRegions,
    chooseRecommendedDistributor
} = require("./lib/routing-utils");
const {
    getUserDistributorScope,
    countAuthorizedTutorUnits,
    loadDistributorScopedUsers
} = require("./lib/distributor-utils");
const {
    normalizeText,
    normalizeEmail,
    normalizeCourseFile,
    normalizeLocale,
    normalizeCourseVariantKey,
    cleanUnitId,
    normalizeLookupValue,
    normalizeCanonicalCourseKey,
    getCanonicalLessonIdentity,
    resolveCanonicalUnitId,
    canonicalizeLessonForDashboard,
    findParentCourseIdByUnit,
    findCourseByUnitId,
    findCourseByPageOrUnit,
    findLessonByCourseRef,
    ensureStudentStatsEntry,
    ensureCourseProgressBucket,
    appendCourseProgressActivity,
    buildDashboardReferenceEntry,
    addDashboardUserEntry,
    buildTutorList,
    buildStudentAssignmentTutorRows,
    buildDashboardSummary,
    finalizeHardwareOrders,
    extractHiddenSectionContent,
    getTutorAssignmentUrlFromConfig
} = require("./dashboard-utils");

const CONTENT_REPO_TOKEN = defineSecret("CONTENT_REPO_TOKEN");

setGlobalOptions({
    region: "asia-east1",
    maxInstances: 10,
    minInstances: 0,
    memory: 128,
    concurrency: 80
});

exports.adminGetStudentAssignmentTutorReport = onCall(async (request) => {
    const data = request?.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, "請先登入");

    const uid = auth.uid;
    const requesterRole = await getRole(uid);
    assertAdminRole(requesterRole, "Only admins can query the student assignment tutor report.");

    const lessons = await loadLessonsWithOptionalDistributorOverride(data.distributorId || "");
    const usersSnapshot = await db.collection("users").get();
    const usersMap = {};

    usersSnapshot.forEach((doc) => {
        const userData = doc.data() || {};
        usersMap[doc.id] = { ...userData, _id: doc.id };
    });

    const rows = buildStudentAssignmentTutorRows(usersMap, lessons);
    return {
        generatedAt: new Date().toISOString(),
        totalRows: rows.length,
        totalStudents: Object.values(usersMap).filter((userData) => {
            const role = userData?.role || "user";
            return role !== "admin" && !hasQualifiedTutorStatus(userData);
        }).length,
        rows
    };
});

exports.adminAssignStudentToTutor = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const uid = auth.uid;
    const requesterRole = await getRole(uid);
    assertAdminRole(requesterRole);

    const { studentUid, unitId: rawUnitId, tutorEmail } = data || {};
    assertRequiredValue(studentUid, "缺少學生 ID");
    assertRequiredValue(rawUnitId, "缺少單元 ID");

    try {
        const lessons = await loadLessonsWithOptionalDistributorOverride(data?.distributorId || "");
        const unitId = resolveCanonicalUnitId(rawUnitId, lessons) || rawUnitId;
        await upsertStudentUnitAssignment(studentUid, unitId, normalizeText(tutorEmail || "") || null, uid, true);

        return { success: true };
    } catch (e) {
        throw new HttpsError("internal", e.message);
    }
});

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "e-learning-942f7"
    });
}

const db = admin.firestore();
const CONTENT_FILE_CACHE = new Map();
const GITHUB_CLASSROOM_ORG = process.env.GITHUB_CLASSROOM_ORG || "vibe-coding-classroom";
const GITHUB_ORG_ADMIN_TOKEN = process.env.GITHUB_ORG_ADMIN_TOKEN || "";

function normalizeCurrency(raw = "", fallback = "") {
    const v = String(raw || fallback || "").trim().toUpperCase();
    if (v === "NTD") return "TWD";
    if (v === "USD") return "USD";
    if (v === "TWD") return "TWD";
    return v || fallback || "";
}

function normalizeAmount(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function withAssignmentUrlAliases(lesson = {}) {
    const currentUrlMap = lesson && typeof lesson.assignmentUrlMap === "object" && lesson.assignmentUrlMap !== null
        ? lesson.assignmentUrlMap
        : null;

    const assignmentUrlMap = currentUrlMap || null;

    return {
        ...lesson,
        ...(assignmentUrlMap ? { assignmentUrlMap } : {})
    };
}

async function resolveLessonMetadataDistributorId(requestedDistributorId = "", uid = "") {
    const requested = normalizeText(requestedDistributorId);
    if (requested) return requested;
    if (uid) {
        try {
            const userDoc = await db.collection("users").doc(uid).get();
            const userData = userDoc.exists ? (userDoc.data() || {}) : {};
            const preferred = normalizeText(
                userData.preferredDistributorId ||
                userData.distributorId ||
                userData.commercial?.distributorId ||
                ""
            );
            if (preferred) return preferred;
        } catch (err) {
            console.warn("[getLessonsMetadata] failed to resolve user distributor:", err.message || err);
        }
    }
    return "default-usd";
}

async function loadLessonsWithOptionalDistributorOverride(distributorId = "") {
    const lessonsSnap = await db.collection("metadata_lessons").orderBy("orderWeight", "asc").get();
    if (lessonsSnap.empty) return [];

    const rawLessons = lessonsSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id, docId: doc.id }));
    rawLessons.sort((a, b) => (a.orderWeight || 0) - (b.orderWeight || 0));

    let lessons = rawLessons.map((lesson) => {
        const cloned = { ...lesson };
        delete cloned.updatedAt;
        delete cloned.orderWeight;
        return withAssignmentUrlAliases(cloned);
    });

    const normalizedDistributorId = normalizeText(distributorId);

    if (normalizedDistributorId) {
        const priceBooksSnap = await db.collection("dealer_price_books")
            .where("distributorId", "==", normalizedDistributorId)
            .get();
        const priceBooks = [];
        priceBooksSnap.forEach((doc) => {
            priceBooks.push({ id: doc.id, ...doc.data() });
        });

        if (priceBooks.length > 0) {
            lessons = lessons.map((lesson) => {
                const matchingBooks = priceBooks.filter((book) => findLessonByDocumentId([lesson], book.docId || book.sourceDocId));
                const activeBooks = matchingBooks.filter((book) => {
                    if (book.isActive === false) return false;
                    const effectiveFromMs = book.effectiveFrom?.toMillis ? book.effectiveFrom.toMillis() : (book.effectiveFrom?.seconds ? book.effectiveFrom.seconds * 1000 : 0);
                    const effectiveToMs = book.effectiveTo?.toMillis ? book.effectiveTo.toMillis() : (book.effectiveTo?.seconds ? book.effectiveTo.seconds * 1000 : 0);
                    const nowMs = Date.now();
                    if (effectiveFromMs && effectiveFromMs > nowMs) return false;
                    if (effectiveToMs && effectiveToMs < nowMs) return false;
                    return true;
                });
                if (activeBooks.length === 0) return lesson;

                activeBooks.sort((a, b) => {
                    const aFrom = a.effectiveFrom?.toMillis ? a.effectiveFrom.toMillis() : (a.effectiveFrom?.seconds ? a.effectiveFrom.seconds * 1000 : 0);
                    const bFrom = b.effectiveFrom?.toMillis ? b.effectiveFrom.toMillis() : (b.effectiveFrom?.seconds ? b.effectiveFrom.seconds * 1000 : 0);
                    return bFrom - aFrom;
                });

                const chosenBook = activeBooks[0];
                const resolvedAmount = resolvePriceBookAmount(chosenBook);
                const cloned = { ...lesson };
                cloned.currency = resolvedAmount.currency;
                cloned.dealerPrice = resolvedAmount.amount;
                cloned.dealerCurrency = resolvedAmount.currency;
                cloned.dealerPriceBookId = chosenBook.id || null;
                cloned.dealerPriceBookDocId = chosenBook.docId || chosenBook.sourceDocId || null;
                cloned.priceBookSource = `dealer_price_books:${chosenBook.id}`;
                cloned.isPromoActive = resolvedAmount.isPromoActive;
                return cloned;
            });
        }
    }

    return lessons;
}

async function getRole(uid) {
    try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists) {
            const role = userDoc.data().role;
            return role === "admin" ? "admin" : "user";
        }
    } catch (e) {
        console.error("[Role] Error in getRole:", e);
    }
    return "user";
}

function assertAdminRole(requesterRole, message = "僅限管理員執行此操作") {
    if (requesterRole !== "admin") {
        throw new HttpsError("permission-denied", message);
    }
}

function assertRequiredValue(value, message = "缺少必要參數") {
    if (value === undefined || value === null || value === "") {
        throw new HttpsError("invalid-argument", message);
    }
}

async function syncReferralLink(dbRef, url, tutorEmail, tutorName, unitId) {
    if (!url) return;
    const normalized = normalizeGitHubUrl(url);
    if (!normalized) return;

    const linkId = buildReferralLinkDocId(normalized);
    await dbRef.collection("referral_links").doc(linkId).set({
        url: normalized,
        tutorEmail,
        tutorName: tutorName || tutorEmail,
        unitId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function upsertStudentUnitAssignment(studentUid, unitId, tutorEmail, assignedByUid = "system", notify = true) {
    const userRef = db.collection("users").doc(studentUid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const previousTutor = userData.unitAssignments?.[unitId] || null;

    await userRef.set({
        unitAssignments: {
            [unitId]: tutorEmail || null
        },
        lastAssignmentUpdate: admin.firestore.FieldValue.serverTimestamp(),
        lastAssignedBy: assignedByUid
    }, { merge: true });

    if (notify && tutorEmail && previousTutor !== tutorEmail) {
        const studentName = resolveNameFromUserData(userData, userData.email, "");
        const studentEmail = userData.email || "";

        if (studentEmail) {
            await sendStudentLinkedToTutorEmail(studentEmail, studentName, unitId, tutorEmail);
        }
        await sendTutorLinkedToStudentEmail(tutorEmail, studentName, unitId);
    }

    return { previousTutor, changed: previousTutor !== (tutorEmail || null) };
}

async function resolveSubmissionAccessOrThrowAdmin(dbRef, uid, courseId, unitId, lessons = []) {
    const access = await resolveStudentAssignmentAccessAdmin(dbRef, uid, courseId, unitId, lessons, false);
    if (!access.authorized) {
        throw new HttpsError("permission-denied", access.reason || "尚未完成此課程付款授權。");
    }
    return access;
}

async function backfillTutorReferralForPaidOrders(dbRef, {
    uid,
    unitId,
    tutorEmail,
    promotionCode = "",
    assignmentUrl = "",
    lessons = [],
    source = "unitBinding"
}) {
    if (!uid || !unitId || !tutorEmail) return { updatedOrders: 0, updatedItems: 0 };

    const ordersSnap = await dbRef.collection("orders")
        .where("uid", "==", uid)
        .where("status", "==", "SUCCESS")
        .get();

    if (ordersSnap.empty) return { updatedOrders: 0, updatedItems: 0 };

    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons) || unitId;
    const normalizedTutorEmail = normalizeText(tutorEmail);
    const normalizedPromotionCode = normalizeText(promotionCode || "").toUpperCase();
    const normalizedAssignmentUrl = normalizeText(assignmentUrl || "");
    const matchesUnit = (itemKey = "") => {
        if (!itemKey) return false;
        const canonicalItemId = resolveCanonicalUnitId(itemKey, lessons);
        if (itemKey === unitId || itemKey === canonicalUnitId || canonicalItemId === canonicalUnitId) return true;
        const lesson = findLessonByCourseRef(itemKey, lessons);
        return !!(lesson && Array.isArray(lesson.courseUnits) && lesson.courseUnits.some((courseUnit) => {
            const canonicalCourseUnit = resolveCanonicalUnitId(courseUnit, lessons);
            return canonicalCourseUnit === canonicalUnitId;
        }));
    };

    let updatedOrders = 0;
    let updatedItems = 0;

    for (const orderDoc of ordersSnap.docs) {
        const orderData = orderDoc.data() || {};
        const items = JSON.parse(JSON.stringify(orderData.items || {}));
        let hasOrderChange = false;

        for (const [itemKey, itemValue] of Object.entries(items)) {
            if (!matchesUnit(itemKey)) continue;
            if (!itemValue || typeof itemValue !== "object") continue;

            itemValue.referredTutorEmail = normalizedTutorEmail;
            itemValue.referralTutor = normalizedTutorEmail;
            if (normalizedAssignmentUrl) {
                itemValue.referralLink = normalizedAssignmentUrl;
                itemValue.promoCode = normalizedAssignmentUrl;
            }
            if (normalizedPromotionCode) {
                itemValue.promotionCode = normalizedPromotionCode;
            }
            hasOrderChange = true;
            updatedItems++;
        }

        if (hasOrderChange) {
            await dbRef.collection("orders").doc(orderDoc.id).set({
                items,
                lastTutorBindingBackfillAt: admin.firestore.FieldValue.serverTimestamp(),
                lastTutorBindingBackfillSource: source
            }, { merge: true });
            updatedOrders++;
        }
    }

    return { updatedOrders, updatedItems };
}

exports.adminBindTutorToUnit = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const { unitId, courseId, referralLink, distributorId = "" } = data || {};
    assertRequiredValue(unitId, "缺少必要參數");
    assertRequiredValue(referralLink, "缺少必要參數");

    const dbRef = admin.firestore();
    const uid = auth.uid;

    try {
        const lessons = await getLessonsForAdmin(distributorId || "");
        await resolveSubmissionAccessOrThrowAdmin(dbRef, uid, courseId, unitId, lessons);

        const normalizedLink = normalizeGitHubUrl(referralLink);
        const linkId = buildReferralLinkDocId(normalizedLink);
        const linkDoc = await dbRef.collection("referral_links").doc(linkId).get();

        if (!linkDoc.exists) {
            throw new HttpsError("not-found", "查無此作業連結對應的導師。");
        }

        const linkData = linkDoc.data() || {};
        const tutorEmail = normalizeText(linkData.tutorEmail || "");
        if (!tutorEmail) {
            throw new HttpsError("failed-precondition", "該作業連結缺少導師 email。");
        }

        const tutorUserDoc = await findUserDocByEmail(dbRef, tutorEmail);
        if (!tutorUserDoc) {
            throw new HttpsError("not-found", "對應的導師帳號已被移除。");
        }

        const tutorData = tutorUserDoc.data() || {};
        const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
        const effectiveCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons) || courseId;

        const config = getUserTutorConfig(tutorData, canonicalUnitId);
        if (!config || config.authorized !== true) {
            throw new HttpsError("permission-denied", "此導師尚未取得該單元的指導認證。");
        }

        await upsertStudentUnitAssignment(uid, canonicalUnitId, tutorEmail, "selfBinding", true);

        const course = findLessonByCourseRef(effectiveCourseId, lessons);
        if (course && Array.isArray(course.courseUnits) && course.courseUnits.includes(canonicalUnitId)) {
            if (isTutorFullyQualifiedForCourseAdmin(tutorData, effectiveCourseId, lessons)) {
                for (const uId of course.courseUnits) {
                    const cId = resolveCanonicalUnitId(uId, lessons);
                    await upsertStudentUnitAssignment(uid, cId, tutorEmail, "selfBinding_cascade", true);
                }
                console.log(`[adminBindTutorToUnit] Cascade-assigned ${uid} -> ${tutorEmail} for ${course.courseUnits.length} units in ${effectiveCourseId}`);
            }
        }

        await backfillTutorReferralForPaidOrders(dbRef, {
            uid,
            unitId: canonicalUnitId,
            tutorEmail,
            assignmentUrl: normalizedLink,
            lessons,
            source: "adminBindTutorToUnit"
        });

        return { success: true, tutorEmail };
    } catch (error) {
        console.error("adminBindTutorToUnit failed:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", error.message);
    }
});

exports.adminBindTutorByPromotionCode = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const unitIdRaw = normalizeText(data?.unitId || "");
    const courseIdRaw = normalizeText(data?.courseId || "");
    const promoCodeRaw = normalizeText(data?.promotionCode || "");
    assertRequiredValue(unitIdRaw, "缺少必要參數（unitId）");

    const dbRef = admin.firestore();
    const uid = auth.uid;
    const requesterRole = await getRole(uid);

    try {
        const lessons = await getLessonsForAdmin(data?.distributorId || "");
        const canonicalUnitId = resolveCanonicalUnitId(unitIdRaw, lessons);
        const effectiveCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons) || courseIdRaw;

        if (requesterRole !== "admin") {
            const access = await resolveStudentAssignmentAccessAdmin(dbRef, uid, effectiveCourseId, canonicalUnitId, lessons, false);
            if (!access.authorized) {
                throw new HttpsError("permission-denied", access.reason || "尚未完成此課程付款授權。");
            }
        }

        const DEFAULT_TUTOR_EMAIL = "rover.k.chen@gmail.com";
        const normalizedInput = promoCodeRaw;
        const promotionCode = normalizedInput.toUpperCase();
        const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInput);
        const isDefaultTutorSelection = !normalizedInput || normalizeEmail(normalizedInput) === normalizeEmail(DEFAULT_TUTOR_EMAIL);
        let tutorSnap;
        let tutorDoc = null;
        let resolvedPromotionCode = promotionCode;

        if (!normalizedInput) {
            tutorDoc = await findUserDocByEmail(dbRef, DEFAULT_TUTOR_EMAIL);
        } else if (looksLikeEmail) {
            tutorDoc = await findUserDocByEmail(dbRef, normalizedInput);
        } else if (promotionCode) {
            tutorSnap = await dbRef.collection("users")
                .where("promotionCode", "==", promotionCode)
                .limit(1)
                .get();
        }

        if (!tutorDoc && (!tutorSnap || tutorSnap.empty)) {
            if (!normalizedInput) {
                throw new HttpsError("not-found", "系統預設導師不存在。");
            }
            throw new HttpsError("not-found", looksLikeEmail ? "查無此 Tutor email 對應的導師。" : "查無此 Promotion code 對應的導師。");
        }

        if (!tutorDoc) {
            tutorDoc = tutorSnap.docs[0];
        }

        const tutorData = tutorDoc.data() || {};
        const tutorEmail = normalizeText(tutorData.email || "");
        if (!tutorEmail) {
            throw new HttpsError("failed-precondition", "該導師資料不完整（缺少 email）。");
        }

        const cfg = getUserTutorConfig(tutorData, canonicalUnitId);
        if (!isDefaultTutorSelection && (!cfg || cfg.authorized !== true)) {
            throw new HttpsError("permission-denied", "此導師尚未取得該單元授權。");
        }

        const course = findLessonByCourseRef(effectiveCourseId, lessons);
        const assignmentUrl = getTutorAssignmentUrlFromConfig(cfg, course, canonicalUnitId, tutorEmail, lessons);
        if (!assignmentUrl && !isDefaultTutorSelection) {
            throw new HttpsError("failed-precondition", "此導師尚未設定該單元作業連結，請通知管理員設定。");
        }
        if (isDefaultTutorSelection && !assignmentUrl) {
            console.warn(`[adminBindTutorByPromotionCode] Default tutor selected for ${canonicalUnitId}, but no assignmentUrl was configured. Proceeding without referral link.`);
        }

        const tutorRef = dbRef.collection("users").doc(tutorDoc.id);
        resolvedPromotionCode = await ensureTutorPromotionCode(dbRef, tutorRef, tutorData, tutorDoc.id, tutorEmail);

        await upsertStudentUnitAssignment(uid, canonicalUnitId, tutorEmail, "promotionCodeBinding", true);

        await dbRef.collection("users").doc(uid).set({
            [`unitAssignmentMeta.${canonicalUnitId}`]: {
                tutorUid: tutorDoc.id,
                tutorEmail,
                promotionCode: resolvedPromotionCode,
                linkedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await backfillTutorReferralForPaidOrders(dbRef, {
            uid,
            unitId: canonicalUnitId,
            tutorEmail,
            promotionCode: resolvedPromotionCode,
            assignmentUrl,
            lessons,
            source: "adminBindTutorByPromotionCode"
        });

        return {
            success: true,
            tutorEmail,
            tutorName: tutorData.name || tutorEmail,
            promotionCode: resolvedPromotionCode,
            assignmentUrl
        };
    } catch (error) {
        console.error("adminBindTutorByPromotionCode failed:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", error.message);
    }
});

exports.adminDebugTutorAuth = onRequest(async (req, res) => {
    const email = req.query.email || "rover.k.chen@gmail.com";
    try {
        const usersSnap = await db.collection("users").where("email", "==", email).get();
        if (usersSnap.empty) return res.status(404).send("User document not found.");
        const doc = usersSnap.docs[0];
        const data = doc.data() || {};
        return res.status(200).json({
            email,
            docId: doc.id,
            tutorConfigs: data.tutorConfigs || {},
            fullDoc: data
        });
    } catch (err) {
        return res.status(500).send(err.message);
    }
});

function nowIsoTimestamp() {
    return new Date().toISOString();
}

function normalizeAssignmentLinkUrl(value = "") {
    return normalizeText(value);
}

function isValidAssignmentLinkUrl(value = "") {
    const normalized = normalizeText(value);
    if (!normalized) return false;
    try {
        const parsed = new URL(normalized);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_) {
        return false;
    }
}

function assertTutorApplicationState(appData = {}, { source = null, status = null } = {}) {
    if (source && appData.source !== source) {
        throw new HttpsError("failed-precondition", "This action is only valid for the expected application type.");
    }
    if (status && appData.status !== status) {
        throw new HttpsError("failed-precondition", "This application is not in the expected state.");
    }
}

async function findUserDocByEmail(dbRef, email = "") {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    const userSnap = await dbRef.collection("users")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();
    return userSnap.empty ? null : userSnap.docs[0];
}

async function assertTutorRecommendationPermission(dbRef, auth, canonicalUnitId, assignment, requesterRole) {
    if (requesterRole === "admin") return;

    const requesterDoc = await dbRef.collection("users").doc(auth.uid).get();
    const requesterData = requesterDoc.exists ? requesterDoc.data() : {};
    const requesterTutorConfigs = requesterData.tutorConfigs || {};
    const isAuthorizedForThisUnit = !!(getEffectiveTutorConfig(canonicalUnitId, requesterTutorConfigs)?.authorized);

    if (!isAuthorizedForThisUnit) {
        throw new HttpsError("permission-denied", "Only the qualified tutor for this unit can recommend students.");
    }
    if (assignment.assignedTutorEmail !== auth.token.email) {
        throw new HttpsError("permission-denied", "Only the assigned tutor can recommend this student.");
    }
}

function isTutorFullyQualifiedForCourseAdmin(userData = {}, courseId = "", lessons = []) {
    const lesson = findLessonByCourseRef(courseId, lessons);
    if (!lesson || !Array.isArray(lesson.courseUnits)) return false;
    return lesson.courseUnits.every((unitId) => {
        const canonical = resolveCanonicalUnitId(unitId, lessons);
        const config = getUserTutorConfig(userData, canonical);
        return !!(config && config.authorized === true);
    });
}

function assertDistributorScope(userData = {}, requestedDistributorId = "", message = "僅限該經銷商執行此操作") {
    if ((userData || {}).role === "admin") return;
    const ownDistributorId = getUserDistributorScope(userData);
    if (ownDistributorId && requestedDistributorId && ownDistributorId === requestedDistributorId) return;
    throw new HttpsError("permission-denied", message);
}

function getSeedableDistributorProducts(lessons = [], distributorCurrency = "TWD") {
    const normalizedCurrency = normalizeText(distributorCurrency || "TWD").toUpperCase() || "TWD";

    return (Array.isArray(lessons) ? lessons : [])
        .filter((lesson) => lesson && (
            isPhysicalMetadataLesson(lesson)
            || lesson.dealerPrice != null
            || lesson.pricing
            || lesson.prices
            || lesson.priceByLocale
            || lesson.priceByRegion
            || lesson.priceMap
            || lesson.priceLocales
            || lesson.pricesByRegion
        ))
        .map((lesson) => {
            const resolvedPrice = resolveLessonPrice(lesson, normalizedCurrency);
            const docId = normalizeText(
                lesson.id ||
                lesson.courseId ||
                lesson.courseKey ||
                lesson.entryUnitId ||
                lesson.sku ||
                ""
            );
            return {
                docId: docId || "",
                title: lesson.title || lesson.name || lesson.id || "未命名商品",
                isPhysical: isPhysicalMetadataLesson(lesson),
                currency: resolvedPrice.currency || normalizedCurrency,
                salePrice: Number(resolvedPrice.amount || 0),
                pricingVersion: lesson.pricingVersion || lesson.pricingSource || "legacy"
            };
        })
        .filter((item) => item.docId && Number.isFinite(item.salePrice) && item.salePrice >= 0);
}

async function getLessonsForAdmin(distributorId = "") {
    return loadLessonsWithOptionalDistributorOverride(distributorId);
}

async function purgeContentCacheHelper(dbRef) {
    console.log(`[purgeContentCacheHelper] Starting cache purge...`);
    const cacheSnap = await dbRef.collection("content_cache").get();
    if (cacheSnap.empty) {
        console.log(`[purgeContentCacheHelper] No cache records found.`);
        return;
    }

    const batchSize = 100;
    let batch = dbRef.batch();
    let count = 0;

    for (const doc of cacheSnap.docs) {
        batch.delete(doc.ref);
        count++;
        if (count % batchSize === 0) {
            await batch.commit();
            batch = dbRef.batch();
        }
    }

    if (count % batchSize !== 0) {
        await batch.commit();
    }

    console.log(`[purgeContentCacheHelper] ✅ Purged ${count} cache files from content_cache.`);
}

function normalizeLessonLocalePayload(localeData = {}) {
    return {
        title: normalizeText(localeData.title || ""),
        summary: normalizeText(localeData.summary || ""),
        description: normalizeText(localeData.description || ""),
        lessonLabel: normalizeText(localeData.lessonLabel || ""),
        coreContent: Array.isArray(localeData.coreContent)
            ? localeData.coreContent.map((item) => normalizeText(item)).filter(Boolean)
            : []
    };
}

function normalizeLessonMetadataPatch(payload = {}) {
    const docId = normalizeText(payload.docId || payload.id || "");
    assertRequiredValue(docId, "missing-doc-id");

    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(payload, key);
    const patch = {
        id: docId,
        docId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: payload.updatedBy || payload.updatedByUid || payload.updatedByEmail || payload.updatedByName || null
    };

    if (hasOwn("courseKey")) patch.courseKey = normalizeText(payload.courseKey || docId);
    if (hasOwn("title")) patch.title = normalizeText(payload.title || "");
    if (hasOwn("summary")) patch.summary = normalizeText(payload.summary || "");
    if (hasOwn("description")) patch.description = normalizeText(payload.description || "");
    if (hasOwn("coreContent")) {
        patch.coreContent = Array.isArray(payload.coreContent)
            ? payload.coreContent.map((item) => normalizeText(item)).filter(Boolean)
            : [];
    }
    if (hasOwn("titleEn")) patch.titleEn = normalizeText(payload.titleEn || "");
    if (hasOwn("summaryEn")) patch.summaryEn = normalizeText(payload.summaryEn || "");
    if (hasOwn("descriptionEn")) patch.descriptionEn = normalizeText(payload.descriptionEn || "");
    if (hasOwn("lessonLabel")) patch.lessonLabel = normalizeText(payload.lessonLabel || "");
    if (hasOwn("lessonLabelEn")) patch.lessonLabelEn = normalizeText(payload.lessonLabelEn || "");
    if (hasOwn("coreContentEn")) {
        patch.coreContentEn = Array.isArray(payload.coreContentEn)
            ? payload.coreContentEn.map((item) => normalizeText(item)).filter(Boolean)
            : [];
    }
    if (hasOwn("track")) patch.track = normalizeText(payload.track || "");
    if (hasOwn("level")) patch.level = normalizeText(payload.level || "");
    if (hasOwn("category")) patch.category = normalizeText(payload.category || "");
    if (hasOwn("metadataType")) patch.metadataType = normalizeText(payload.metadataType || "course") || "course";
    if (hasOwn("orderWeight")) patch.orderWeight = Number(payload.orderWeight || 0) || 0;
    if (hasOwn("isPhysical")) patch.isPhysical = payload.isPhysical === true;
    if (hasOwn("hiddenFromCatalog")) patch.hiddenFromCatalog = payload.hiddenFromCatalog === true;
    if (hasOwn("isDeprecated")) patch.isDeprecated = payload.isDeprecated === true;

    if (payload.i18n && typeof payload.i18n === "object" && !Array.isArray(payload.i18n)) {
        const i18n = {};
        for (const [locale, localeData] of Object.entries(payload.i18n)) {
            const key = normalizeText(locale).replace("_", "-");
            if (!key || !localeData || typeof localeData !== "object" || Array.isArray(localeData)) continue;
            i18n[key] = normalizeLessonLocalePayload(localeData);
        }
        if (Object.keys(i18n).length > 0) patch.i18n = i18n;
    }
    const rawCourseUnits = hasOwn("course_units")
        ? payload.course_units
        : payload.courseUnits;
    if (hasOwn("course_units") || hasOwn("courseUnits")) {
        if (Array.isArray(rawCourseUnits)) {
            const normalizedUnits = rawCourseUnits.map((unit) => normalizeText(unit)).filter(Boolean);
            patch.course_units = normalizedUnits;
            patch.courseUnits = normalizedUnits;
        } else {
            patch.course_units = [];
            patch.courseUnits = [];
        }
    }

    const rawCourseUnitTitles = hasOwn("course_unit_titles")
        ? payload.course_unit_titles
        : payload.courseUnitTitles;
    if (hasOwn("course_unit_titles") || hasOwn("courseUnitTitles")) {
        if (Array.isArray(rawCourseUnitTitles)) {
            const normalizedTitles = rawCourseUnitTitles.map((title) => normalizeText(title)).filter(Boolean);
            patch.course_unit_titles = normalizedTitles;
            patch.courseUnitTitles = normalizedTitles;
        } else {
            patch.course_unit_titles = [];
            patch.courseUnitTitles = [];
        }
    }
    return patch;
}

exports.adminUpdateLessonI18n = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const role = await getRole(auth.uid);
    assertAdminRole(role);

    const { courseId, titleEn, summaryEn, descriptionEn, coreContentEn, lessonLabelEn } = data || {};
    assertRequiredValue(courseId, "missing-course-id");

    const lessonsSnap = await db.collection("metadata_lessons")
        .where("courseId", "==", courseId)
        .limit(1)
        .get();

    if (lessonsSnap.empty) {
        throw new HttpsError("not-found", `lesson-not-found: ${courseId}`);
    }

    const lessonDocRef = lessonsSnap.docs[0].ref;
    const updatePayload = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        i18nUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        i18nUpdatedBy: auth.uid
    };
    if (typeof titleEn === "string") updatePayload.titleEn = normalizeText(titleEn);
    if (typeof summaryEn === "string") updatePayload.summaryEn = normalizeText(summaryEn);
    if (typeof descriptionEn === "string") updatePayload.descriptionEn = normalizeText(descriptionEn);
    if (Array.isArray(coreContentEn)) updatePayload.coreContentEn = coreContentEn.map((s) => normalizeText(s)).filter(Boolean);
    if (typeof lessonLabelEn === "string") updatePayload.lessonLabelEn = normalizeText(lessonLabelEn);
    if (typeof lessonLabelEn === "string") updatePayload["i18n.en.lessonLabel"] = normalizeText(lessonLabelEn);

    await lessonDocRef.set(updatePayload, { merge: true });
    console.log(`[adminUpdateLessonI18n] Updated i18n fields for courseId=${courseId} by uid=${auth.uid}`);

    return { success: true, courseId };
});

exports.adminUpsertLessonMetadata = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const role = await getRole(auth.uid);
    assertAdminRole(role);

    const dbRef = admin.firestore();
    const payload = data || {};
    const patch = normalizeLessonMetadataPatch(payload);
    const docRef = dbRef.collection("metadata_lessons").doc(patch.docId);
    const existing = await docRef.get();

    if (existing.exists && existing.data()?.createdAt) {
        patch.createdAt = existing.data().createdAt;
    } else if (!patch.createdAt) {
        patch.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    if (!patch.updatedBy) {
        patch.updatedBy = auth.uid;
    }

    await docRef.set(patch, { merge: true });
    console.log(`[adminUpsertLessonMetadata] Upserted lesson metadata for docId=${patch.docId} by uid=${auth.uid}`);

    return {
        success: true,
        docId: patch.docId
    };
});

exports.adminUpdateSystemConfig = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const role = await getRole(auth.uid);
    assertAdminRole(role);

    const { contentVersion, defaultRegion, defaultDistributorId, defaultLocale } = data || {};
    const updates = {};

    if (contentVersion !== undefined) {
        if (typeof contentVersion !== "string" || contentVersion.trim().length < 7) {
            throw new HttpsError("invalid-argument", "invalid-content-version-hash");
        }
        updates.contentVersion = contentVersion.trim();
    }
    if (defaultRegion !== undefined) updates.defaultRegion = String(defaultRegion || "").trim().toUpperCase();
    if (defaultDistributorId !== undefined) updates.defaultDistributorId = String(defaultDistributorId || "").trim();
    if (defaultLocale !== undefined) updates.defaultLocale = String(defaultLocale || "").trim();

    if (Object.keys(updates).length > 0) {
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        updates.updatedBy = auth.uid;

        await db.collection("metadata_settings").doc("content_runtime").set(updates, { merge: true });
        console.log(`[adminUpdateSystemConfig] Updated config to ${JSON.stringify(updates)} by uid=${auth.uid}`);

        if (contentVersion !== undefined) {
            await purgeContentCacheHelper(db);
        }
    }

    return { success: true };
});

exports.adminGetSystemConfig = onCall(async (request) => {
    const { auth } = request;

    assertAuthenticated(auth);
    const role = await getRole(auth.uid);
    assertAdminRole(role);

    const docSnap = await db.collection("metadata_settings").doc("content_runtime").get();
    const data = docSnap.exists ? (docSnap.data() || {}) : {};

    return {
        success: true,
        contentVersion: data.contentVersion || "",
        defaultRegion: data.defaultRegion || "US",
        defaultDistributorId: data.defaultDistributorId || "default-usd",
        defaultLocale: data.defaultLocale || "en",
        supportedLocales: Array.isArray(data.supportedLocales) ? data.supportedLocales : [],
        localeLabels: data.localeLabels && typeof data.localeLabels === "object" && !Array.isArray(data.localeLabels) ? data.localeLabels : {},
        localeFallbackMap: data.localeFallbackMap && typeof data.localeFallbackMap === "object" && !Array.isArray(data.localeFallbackMap) ? data.localeFallbackMap : {}
    };
});

exports.adminPurgeContentCache = onCall(async (request) => {
    const { auth } = request;

    assertAuthenticated(auth);
    const role = await getRole(auth.uid);
    assertAdminRole(role);

    await purgeContentCacheHelper(db);
    return { success: true };
});

exports.adminUpsertLessonPricing = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    assertAdminRole(userData.role);

    const { courseId, pricing } = data || {};
    assertRequiredValue(courseId, "missing-course-id");
    assertRequiredValue(pricing && typeof pricing === "object", "missing-pricing");

    const cleanProductId = String(courseId).trim();
    let targetDoc = null;
    const docSnap = await db.collection("metadata_lessons").doc(cleanProductId).get();
    if (docSnap.exists) {
        targetDoc = docSnap;
    } else {
        const lessonsSnap = await db.collection("metadata_lessons")
            .where("courseId", "==", cleanProductId)
            .limit(1)
            .get();
        if (lessonsSnap.empty) {
            throw new HttpsError("not-found", `lesson-not-found: ${cleanProductId}`);
        }
        targetDoc = lessonsSnap.docs[0];
    }

    const normalizePriceEntry = (entry, fallbackCurrency) => {
        const rawAmount = Number(entry?.amount ?? entry?.price ?? entry?.value ?? 0);
        const amount = Number.isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0;
        const rawCurrency = normalizeText(entry?.currency || entry?.currencyCode || fallbackCurrency || "");
        const currency = rawCurrency ? rawCurrency.toUpperCase() : fallbackCurrency;
        return { amount, currency };
    };

    const tw = normalizePriceEntry(pricing.tw, "TWD");
    const en = normalizePriceEntry(pricing.en, "USD");
    const buildPriceBookId = (distributorId, docId) => `${distributorId}_${docId}`.toLowerCase().replace(/[^a-z0-9_-]/gi, "-");
    const twPriceBookId = buildPriceBookId("default-twd", cleanProductId);
    const enPriceBookId = buildPriceBookId("default-usd", cleanProductId);
    const twRef = db.collection("dealer_price_books").doc(twPriceBookId);
    const enRef = db.collection("dealer_price_books").doc(enPriceBookId);
    const [twSnap, enSnap] = await Promise.all([twRef.get(), enRef.get()]);
    const docId = targetDoc.id;
    const twCreatedAt = twSnap.exists && twSnap.data()?.createdAt ? twSnap.data().createdAt : admin.firestore.FieldValue.serverTimestamp();
    const enCreatedAt = enSnap.exists && enSnap.data()?.createdAt ? enSnap.data().createdAt : admin.firestore.FieldValue.serverTimestamp();

    await Promise.all([
        twRef.set({
            docId,
            sourceDocId: docId,
            distributorId: "default-twd",
            currency: "TWD",
            salePrice: tw.amount,
            isActive: true,
            version: "v1",
            updatedBy: auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: twCreatedAt
        }, { merge: true }),
        enRef.set({
            docId,
            sourceDocId: docId,
            distributorId: "default-usd",
            currency: "USD",
            salePrice: en.amount,
            isActive: true,
            version: "v1",
            updatedBy: auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: enCreatedAt
        }, { merge: true })
    ]);

    console.log(`[adminUpsertLessonPricing] Updated default price books for docId=${cleanProductId} by uid=${auth.uid}`);
    return {
        success: true,
        courseId: cleanProductId,
        pricing: { tw, en }
    };
});

exports.adminGetDistributorPriceBooks = onCall(async (request) => {
    const { auth, data } = request;
    assertAuthenticated(auth);

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const distributorId = normalizeText(data?.distributorId || userData.distributorId || userData.commercial?.distributorId || "");

    assertRequiredValue(distributorId, "missing-distributor-id");
    assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員查看價格表");

    const items = await listDistributorPriceBooks(db, distributorId);
    return { success: true, distributorId, items };
});

exports.adminUpsertDistributorPriceBook = onCall(async (request) => {
    const { auth, data } = request;
    assertAuthenticated(auth);

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const payload = data || {};

    const distributorId = normalizeText(payload.distributorId || userData.distributorId || userData.commercial?.distributorId || "");
    const docId = normalizeText(payload.docId || payload.courseId || payload.itemId || "");
    const currency = normalizeText(payload.currency || "TWD").toUpperCase() || "TWD";

    assertRequiredValue(distributorId, "missing-distributor-id");
    assertRequiredValue(docId, "missing-doc-id");
    assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員編輯價格表");

    const salePrice = Number(payload.salePrice);
    const promoPriceRaw = payload.promoPrice;
    const promoPrice = promoPriceRaw == null || promoPriceRaw === "" ? null : Number(promoPriceRaw);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
        throw new HttpsError("invalid-argument", "salePrice must be a non-negative number.");
    }
    if (promoPrice != null && (!Number.isFinite(promoPrice) || promoPrice < 0 || promoPrice > salePrice)) {
        throw new HttpsError("invalid-argument", "promoPrice must be a non-negative number not greater than salePrice.");
    }

    const effectiveFrom = payload.effectiveFrom || null;
    const effectiveTo = payload.effectiveTo || null;
    const promoEffectiveFrom = payload.promoEffectiveFrom || null;
    const promoEffectiveTo = payload.promoEffectiveTo || null;
    if (promoPrice != null && (!promoEffectiveFrom || !promoEffectiveTo)) {
        throw new HttpsError("invalid-argument", "promoEffectiveFrom and promoEffectiveTo are required when promoPrice is set.");
    }
    if (promoPrice != null && promoEffectiveFrom && promoEffectiveTo) {
        const promoFromMs = new Date(promoEffectiveFrom).getTime();
        const promoToMs = new Date(promoEffectiveTo).getTime();
        if (!Number.isFinite(promoFromMs) || !Number.isFinite(promoToMs) || promoToMs < promoFromMs) {
            throw new HttpsError("invalid-argument", "promoEffectiveTo must be greater than or equal to promoEffectiveFrom.");
        }
    }
    const isActive = payload.isActive !== false;
    const priceBookId = normalizeText(payload.priceBookId || payload.id || `${distributorId}_${docId}`.toLowerCase().replace(/[^a-z0-9_-]/gi, "-"));
    const existingDoc = await db.collection("dealer_price_books").doc(priceBookId).get();
    const createdAt = existingDoc.exists && existingDoc.data()?.createdAt
        ? existingDoc.data().createdAt
        : admin.firestore.FieldValue.serverTimestamp();

    await db.collection("dealer_price_books").doc(priceBookId).set({
        distributorId,
        docId,
        sourceDocId: docId,
        currency,
        salePrice,
        ...(promoPrice != null ? { promoPrice } : {}),
        ...(effectiveFrom ? { effectiveFrom } : {}),
        ...(effectiveTo ? { effectiveTo } : {}),
        ...(promoPrice != null && promoEffectiveFrom ? { promoEffectiveFrom } : {}),
        ...(promoPrice != null && promoEffectiveTo ? { promoEffectiveTo } : {}),
        isActive,
        version: normalizeText(payload.version || payload.pricingVersion || "v1") || "v1",
        updatedBy: auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt
    }, { merge: true });

    return { success: true, priceBookId, distributorId, docId };
});

exports.adminGetLessonPriceBooks = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const role = await getRole(auth.uid);
    assertAdminRole(role);

    const dbRef = admin.firestore();
    const docId = normalizeText(data?.docId || data?.courseId || data?.itemId || "");
    const distributorId = normalizeText(data?.distributorId || "");

    const targetKeys = new Set([
        docId,
        docId ? `${docId}.html` : "",
    ].filter(Boolean));

    const snap = await dbRef.collection("dealer_price_books").get();
    const items = [];
    snap.forEach((doc) => {
        const book = { id: doc.id, ...(doc.data() || {}) };
        if (distributorId && normalizeText(book.distributorId) !== distributorId) return;

        const bookKeys = [
            book.id,
            book.priceBookId,
            book.docId,
            book.sourceDocId
        ].map((value) => normalizeText(value)).filter(Boolean);

        const matches = targetKeys.size === 0 || bookKeys.some((value) => targetKeys.has(value));
        if (!matches) return;
        items.push(book);
    });

    items.sort((a, b) => {
        const aKey = `${normalizeText(a.distributorId)}::${normalizeText(a.docId || a.sourceDocId)}::${normalizeText(a.id)}`;
        const bKey = `${normalizeText(b.distributorId)}::${normalizeText(b.docId || b.sourceDocId)}::${normalizeText(b.id)}`;
        return aKey.localeCompare(bKey);
    });

    return {
        success: true,
        docId,
        distributorId,
        items
    };
});

exports.adminSeedDistributorPriceBooksFromLessons = onCall(async (request) => {
    const { auth, data } = request;
    assertAuthenticated(auth);

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const payload = data || {};

    const distributorId = normalizeText(payload.distributorId || userData.distributorId || userData.commercial?.distributorId || "");
    assertRequiredValue(distributorId, "missing-distributor-id");
    assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員套用商品價格");

    const distributorDoc = await db.collection("distributors").doc(distributorId).get();
    const distributorData = distributorDoc.exists ? (distributorDoc.data() || {}) : {};
    const distributorCurrency = normalizeText(payload.currency || distributorData.defaultCurrency || userData.defaultCurrency || "TWD").toUpperCase() || "TWD";
    const overwrite = payload.overwrite === true;

    const lessons = await getLessonsForAdmin(payload.distributorId || "");
    const products = getSeedableDistributorProducts(lessons, distributorCurrency);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of products) {
        const priceBookId = normalizeText(
            payload.priceBookPrefix
                ? `${payload.priceBookPrefix}_${item.docId}`
                : `${distributorId}_${item.docId}`
        ).toLowerCase().replace(/[^a-z0-9_-]/gi, "-");
        const docRef = db.collection("dealer_price_books").doc(priceBookId);
        const existing = await docRef.get();

        if (existing.exists && !overwrite) {
            skipped += 1;
            continue;
        }

        const existingData = existing.exists ? (existing.data() || {}) : {};
        await docRef.set({
            docId: item.docId,
            sourceDocId: item.docId,
            distributorId,
            currency: item.currency || distributorCurrency,
            salePrice: item.salePrice,
            ...(existingData.promoPrice != null && !overwrite ? { promoPrice: existingData.promoPrice } : {}),
            ...(existingData.promoEffectiveFrom != null && !overwrite ? { promoEffectiveFrom: existingData.promoEffectiveFrom } : {}),
            ...(existingData.promoEffectiveTo != null && !overwrite ? { promoEffectiveTo: existingData.promoEffectiveTo } : {}),
            isActive: existingData.isActive !== false,
            version: normalizeText(existingData.version || item.pricingVersion || "v1") || "v1",
            sourceDocId: item.docId,
            sourceLessonTitle: item.title,
            sourceIsPhysical: item.isPhysical === true,
            updatedBy: auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: existing.exists && existingData.createdAt
                ? existingData.createdAt
                : admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        if (existing.exists) updated += 1;
        else created += 1;
    }

    return {
        success: true,
        distributorId,
        currency: distributorCurrency,
        totalProducts: products.length,
        created,
        updated,
        skipped
    };
});

exports.adminGetDistributorRoutingOptions = onCall(async (request) => {
    const { auth, data } = request;
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
});

exports.adminUpdateUserRoutingPreference = onCall(async (request) => {
    const { auth, data } = request;
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
            console.warn("[adminUpdateUserRoutingPreference] skip missing distributor", { uid: auth.uid, preferredDistributorId });
            safePreferredDistributorId = "";
        } else {
            const distributorData = distributorDoc.data() || {};
            const requestedRegion = preferredRegion || payload.region || distributorData.regions?.[0] || "";
            if (!distributorMatchesRegion(distributorData, requestedRegion)) {
                console.warn("[adminUpdateUserRoutingPreference] skip mismatched distributor/region", {
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
});

function buildDistributorPortalOrderRecord(order = {}, orderId = "") {
    const items = order.items || {};
    const itemEntries = Object.entries(items);
    const physicalItemCount = itemEntries.filter(([_, item]) => item && item.isPhysical === true).length;
    const itemNames = itemEntries
        .map(([itemKey, item]) => item?.name || item?.productName || itemKey)
        .filter(Boolean)
        .slice(0, 3);
    return {
        id: orderId,
        orderNumber: order.orderNumber || orderId,
        uid: order.uid || "",
        amount: Number(order.amount || 0),
        currency: order.currency || "TWD",
        status: order.status || "",
        fulfillmentStatus: order.fulfillmentStatus || "PENDING",
        distributorId: order.distributorId || order.commercial?.distributorId || "",
        priceBookId: order.priceBookId || "",
        pricingVersion: order.pricingVersion || "",
        itemCount: itemEntries.length,
        physicalItemCount,
        hasPhysical: physicalItemCount > 0,
        items: itemNames,
        logistics: order.logistics || null,
        shippingContact: order.logistics ? { name: order.logistics.receiverName || order.logistics.ReceiverName || "", phone: order.logistics.receiverPhone || order.logistics.ReceiverPhone || order.logistics.ReceiverCellPhone || "" } : { name: "", phone: "" },
        shippingAddress: order.logistics?.storeAddress || order.logistics?.CVSAddress || order.logistics?.ReceiverAddress || "",
        createdAt: order.createdAt || null,
        paidAt: order.paidAt || order.createdAt || null,
        shippedAt: order.shippedAt || null
    };
}

async function loadDistributorPortalOrders(dbRef, distributorId = "", lessons = []) {
    const normalizedDistributorId = normalizeText(distributorId);
    if (!normalizedDistributorId) {
        return { items: [], summary: { totalOrders: 0, pendingShipmentCount: 0, shippedCount: 0, grossAmount: 0 } };
    }

    const physicalUnitIds = getPhysicalUnitIdSet(lessons);
    const priceBooks = await listDistributorPriceBooks(dbRef, normalizedDistributorId);
    const priceBookIds = new Set(priceBooks.map((book) => String(book.id || book.priceBookId || "").trim()).filter(Boolean));

    const snap = await dbRef.collection("orders").where("status", "==", "SUCCESS").get();

    const items = [];
    snap.forEach((doc) => {
        const order = doc.data() || {};
        const orderDistributorId = normalizeText(order.distributorId || order.commercial?.distributorId || "");
        const orderPriceBookId = normalizeText(order.priceBookId || "");
        const isOwnOrder = orderDistributorId === normalizedDistributorId || (orderPriceBookId && priceBookIds.has(orderPriceBookId));
        if (!isOwnOrder) return;

        const record = buildDistributorPortalOrderRecord(order, doc.id);
        const physicalItems = Object.keys(order.items || {}).filter((itemId) => isPhysicalOrderItem(itemId, order.items?.[itemId] || {}, physicalUnitIds));
        record.physicalItemCount = physicalItems.length;
        record.hasPhysical = physicalItems.length > 0;
        record.needsShipment = physicalItems.length > 0 && String(record.fulfillmentStatus || "").toUpperCase() !== "SHIPPED";
        items.push(record);
    });

    items.sort((a, b) => toMillis(b.paidAt) - toMillis(a.paidAt));

    const summary = items.reduce((acc, item) => {
        acc.totalOrders += 1;
        acc.grossAmount = round2Amount(acc.grossAmount + Number(item.amount || 0));
        if (item.needsShipment) acc.pendingShipmentCount += 1;
        if (String(item.fulfillmentStatus || "").toUpperCase() === "SHIPPED") acc.shippedCount += 1;
        return acc;
    }, { totalOrders: 0, pendingShipmentCount: 0, shippedCount: 0, grossAmount: 0 });

    return { items, summary };
}

async function loadDistributorPortalTutors(dbRef, distributorId = "") {
    const normalizedDistributorId = normalizeText(distributorId);
    if (!normalizedDistributorId) {
        return { items: [], summary: { tutorCount: 0, authorizedUnitCount: 0 } };
    }

    const users = await loadDistributorScopedUsers(dbRef, normalizedDistributorId);
    const tutorItems = users.filter((user) => {
        return countAuthorizedTutorUnits(user) > 0
            || Boolean(normalizeText(user.tutorEmail || ""))
            || Boolean(normalizeText(user.courseDevEmail || ""))
            || Boolean(normalizeText(user.agentEmail || ""))
            || Object.keys(user.tutorConfigs || {}).length > 0;
    }).map((user) => {
        const email = normalizeText(user.email || user.tutorEmail || user.userEmail || "");
        return {
            id: user.id,
            uid: user.id,
            name: user.name || user.displayName || email || user.id,
            email,
            role: user.role === "admin" ? "admin" : "user",
            isTutor: countAuthorizedTutorUnits(user) > 0 || Object.keys(user.tutorConfigs || {}).length > 0,
            distributorId: getUserDistributorScope(user) || normalizedDistributorId,
            authorizedUnitCount: countAuthorizedTutorUnits(user),
            tutorConfigCount: Object.keys(user.tutorConfigs || {}).length,
            payoutAccount: normalizeText(user.payoutAccount || user.paymentAccount || ""),
            promotionCode: normalizeText(user.promotionCode || ""),
            status: user.status || "ACTIVE"
        };
    }).sort((a, b) => String(a.name || a.email || a.id).localeCompare(String(b.name || b.email || b.id)));

    return {
        items: tutorItems,
        summary: {
            tutorCount: tutorItems.length,
            authorizedUnitCount: tutorItems.reduce((sum, tutor) => sum + Number(tutor.authorizedUnitCount || 0), 0)
        }
    };
}

async function loadDistributorPortalSettlement(dbRef, distributorId = "", tutors = []) {
    const normalizedDistributorId = normalizeText(distributorId);
    if (!normalizedDistributorId) {
        return {
            period: "",
            rows: [],
            summary: {
                period: "",
                paidTotal: 0,
                plannedTotal: 0,
                blockedTotal: 0,
                rowCount: 0,
                tutorCount: 0
            }
        };
    }

    const period = previousYmPeriod(new Date());
    const tutorEmailSet = new Set(
        tutors
            .map((tutor) => normalizeText(tutor.email || tutor.tutorEmail || "").toLowerCase())
            .filter(Boolean)
    );

    if (tutorEmailSet.size === 0) {
        return {
            period,
            rows: [],
            summary: {
                period,
                paidTotal: 0,
                plannedTotal: 0,
                blockedTotal: 0,
                rowCount: 0,
                tutorCount: 0
            }
        };
    }

    const snap = await dbRef.collection("profit_ledger").where("period", "==", period).get();
    const byEmail = new Map();
    snap.forEach((doc) => {
        const row = doc.data() || {};
        const email = normalizeText(row.recipientEmail || row.tutorEmail || "").toLowerCase();
        if (!email || (tutorEmailSet.size > 0 && !tutorEmailSet.has(email))) return;

        const current = byEmail.get(email) || {
            email,
            name: "",
            role: "user",
            paidTotal: 0,
            plannedTotal: 0,
            blockedTotal: 0,
            rowCount: 0,
            roleBreakdown: {}
        };

        current.paidTotal = round2Amount(current.paidTotal + Number(row.shareAmount || 0));
        current.plannedTotal = round2Amount(current.plannedTotal + Number(row.plannedShareAmount || row.shareAmount || 0));
        current.blockedTotal = round2Amount(current.blockedTotal + Number(row.blockedShareAmount || 0));
        current.rowCount += 1;
        const role = String(row.recipientRole || row.role || "user").toLowerCase();
        const normalizedRole = role === "admin" ? "admin" : "user";
        current.roleBreakdown[normalizedRole] = round2Amount((current.roleBreakdown[normalizedRole] || 0) + Number(row.shareAmount || 0));
        byEmail.set(email, current);
    });

    const tutorMap = new Map(tutors.map((tutor) => [normalizeText(tutor.email || "").toLowerCase(), tutor]));
    const rows = Array.from(byEmail.values()).map((row) => {
        const tutor = tutorMap.get(row.email) || {};
        return {
            ...row,
            name: tutor.name || tutor.displayName || row.email,
            distributorId: tutor.distributorId || normalizedDistributorId,
            payoutAccount: tutor.payoutAccount || "",
            authorizedUnitCount: Number(tutor.authorizedUnitCount || 0),
            tutorConfigCount: Number(tutor.tutorConfigCount || 0),
            status: tutor.status || "ACTIVE"
        };
    }).sort((a, b) => b.paidTotal - a.paidTotal);

    const summary = rows.reduce((acc, row) => {
        acc.paidTotal = round2Amount(acc.paidTotal + Number(row.paidTotal || 0));
        acc.plannedTotal = round2Amount(acc.plannedTotal + Number(row.plannedTotal || 0));
        acc.blockedTotal = round2Amount(acc.blockedTotal + Number(row.blockedTotal || 0));
        acc.rowCount += Number(row.rowCount || 0);
        return acc;
    }, {
        period,
        paidTotal: 0,
        plannedTotal: 0,
        blockedTotal: 0,
        rowCount: 0,
        tutorCount: rows.length
    });

    return { period, rows, summary };
}

exports.adminGetDistributorPortalData = onCall(async (request) => {
    const { auth } = request;
    assertAuthenticated(auth, "請先登入");

    const uid = auth.uid;
    const dbRef = admin.firestore();
    const userDoc = await dbRef.collection("users").doc(uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const role = await getRole(uid);
    const myDistributorId = getUserDistributorScope(userData) || "";
    const canManagePricing = role === "admin" || !!myDistributorId;
    const requestedDistributorId = normalizeText(request.data?.distributorId || "");
    const lessons = await getLessonsForAdmin("");
    const distributorQuerySnap = await dbRef.collection("distributors").get();
    const allDistributors = [];
    distributorQuerySnap.forEach((doc) => {
        allDistributors.push({ id: doc.id, ...(doc.data() || {}) });
    });
    allDistributors.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));

    const ownDistributorId = myDistributorId || "";
    const adminRequestedDistributorId = role === "admin" && requestedDistributorId
        ? requestedDistributorId
        : "";
    const selectedDistributorId = role === "admin"
        ? (
            adminRequestedDistributorId ||
            ownDistributorId ||
            (allDistributors[0]?.id || "")
        )
        : ownDistributorId;

    const accessibleDistributors = role === "admin"
        ? allDistributors
        : allDistributors.filter((item) => item.id === ownDistributorId);

    const distributorDoc = selectedDistributorId ? await dbRef.collection("distributors").doc(selectedDistributorId).get() : null;
    const distributorData = distributorDoc && distributorDoc.exists ? (distributorDoc.data() || {}) : {};
    const seedableProducts = getSeedableDistributorProducts(
        lessons,
        distributorData.defaultCurrency || userData.defaultCurrency || "TWD"
    );

    const [orderData, tutorData, settlementData] = selectedDistributorId
        ? await Promise.all([
            loadDistributorPortalOrders(dbRef, selectedDistributorId, lessons),
            loadDistributorPortalTutors(dbRef, selectedDistributorId),
            loadDistributorPortalSettlement(dbRef, selectedDistributorId)
        ])
        : [
            { items: [], summary: { totalOrders: 0, pendingShipmentCount: 0, shippedCount: 0, grossAmount: 0 } },
            { items: [], summary: { tutorCount: 0, authorizedUnitCount: 0 } },
            { period: "", rows: [], summary: { period: "", paidTotal: 0, plannedTotal: 0, blockedTotal: 0, rowCount: 0, tutorCount: 0 } }
        ];

    return {
        success: true,
        role: role === "admin" ? "admin" : "user",
        isTutor: !!userData.tutorConfigs && Object.keys(userData.tutorConfigs || {}).length > 0,
        uid,
        email: auth.token?.email || userData.email || "",
        name: userData.name || auth.token?.name || "",
        myDistributorId,
        selectedDistributorId,
        canManagePricing,
        accessibleDistributors,
        orders: orderData.items,
        orderSummary: orderData.summary,
        tutors: tutorData.items,
        tutorSummary: tutorData.summary,
        settlement: settlementData,
        seedableProductCount: seedableProducts.length,
        user: {
            uid,
            email: auth.token?.email || userData.email || "",
            name: userData.name || auth.token?.name || "",
            distributorId: selectedDistributorId,
            role
        }
    };
});

exports.adminResolveDistributorCheckoutQuote = onCall(async (request) => {
    const dbRef = admin.firestore();
    const { auth, data } = request;
    assertAuthenticated(auth, "請先登入");

    const payload = data || {};
    const lessons = await getLessonsForAdmin(payload.distributorId || "");
    const quote = await resolveDistributorCheckoutQuote(dbRef, {
        lessons,
        distributorId: payload.distributorId || "",
        tutorId: payload.tutorId || "",
        promotionCode: payload.promotionCode || payload.promoCode || "",
        region: payload.region || "",
        customerId: payload.customerId || auth.uid || "",
        docId: payload.docId || payload.courseId || payload.itemId || "",
        locale: payload.locale || "en",
        priceBookId: payload.priceBookId || ""
    });

    return {
        success: true,
        ...quote
    };
});

async function adminRunPendingAssignmentReminder() {
    return runPendingAssignmentReminder({
        db,
        admin,
        getLessons: () => getLessonsForAdmin(""),
        resolveLessonPrice,
        collectPurchasedUnitIds,
        orderNormalizationResolvers,
        fallbackNameFromEmail,
        sendStudentPendingTutorAssignmentReminder,
        logger: console
    });
}

async function adminRunPendingShipmentReminder() {
    return runPendingShipmentReminder({
        db,
        admin,
        adminEmail: process.env.ADMIN_EMAIL || process.env.MAIL_USER,
        getLessons: () => getLessonsForAdmin(""),
        getPhysicalUnitIdSet,
        isPhysicalOrderItem,
        buildPendingShipmentReminderEntry,
        formatTaipeiDateTimeFn: formatTaipeiDateTimeShared,
        sendAdminShipmentReminder,
        logger: console
    });
}

exports.adminRunPendingAssignmentReminder = adminRunPendingAssignmentReminder;
exports.adminRunPendingShipmentReminder = adminRunPendingShipmentReminder;

async function adminCalculateMonthlySharing() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    console.log(`Starting profit sharing calculation for: ${lastMonth.toISOString()} to ${endOfLastMonth.toISOString()}`);

    const policyCache = new Map();
    const userByEmailCache = new Map();
    const balanceAgg = new Map();
    const ymFromDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const parseYm = (ym) => {
        const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ""));
        if (!m) return null;
        return { y: Number(m[1]), m: Number(m[2]) };
    };
    const addMonthsYm = (ym, delta) => {
        const parsed = parseYm(ym);
        if (!parsed) return ym;
        const d = new Date(parsed.y, parsed.m - 1 + Number(delta || 0), 1);
        return ymFromDate(d);
    };
    const ymLTE = (a, b) => String(a || "") <= String(b || "");
    const countValidityMonths = (paidAtTs, expiryTs, fallbackMonths = 12) => {
        try {
            if (!paidAtTs?.toDate || !expiryTs?.toDate) return Math.max(1, Number(fallbackMonths || 12));
            const p = paidAtTs.toDate();
            const e = expiryTs.toDate();
            let months = (e.getFullYear() - p.getFullYear()) * 12 + (e.getMonth() - p.getMonth());
            if (e.getDate() >= p.getDate()) months += 1;
            return Math.max(1, months);
        } catch {
            return Math.max(1, Number(fallbackMonths || 12));
        }
    };
    const getPayoutAccountFromUser = (userData = {}) => {
        if (!userData || typeof userData !== "object") return "";
        if (typeof userData.payoutAccount === "string" && userData.payoutAccount.trim()) return userData.payoutAccount.trim();
        if (typeof userData.paymentAccount === "string" && userData.paymentAccount.trim()) return userData.paymentAccount.trim();
        const map = userData.payoutAccounts || {};
        const candidate = map.default || map.bank || "";
        return typeof candidate === "string" ? candidate.trim() : "";
    };
    const getUserByEmail = async (email = "") => {
        const normalized = normalizeEmail(email);
        if (!normalized) return null;
        if (userByEmailCache.has(normalized)) return userByEmailCache.get(normalized);
        const userDoc = await findUserDocByEmail(db, normalized);
        const userData = userDoc ? (userDoc.data() || null) : null;
        userByEmailCache.set(normalized, userData);
        return userData;
    };

    try {
        const revenueConfigDoc = await db.collection("metadata_settings").doc("revenue_share_config").get();
        const revenueConfig = revenueConfigDoc.exists ? (revenueConfigDoc.data() || {}) : {};
        const defaultValidityMonths = Math.max(1, Number(revenueConfig.defaultValidityMonths || 12));
        const fallbackPayoutEmail = normalizeEmail(revenueConfig.defaultPayoutEmail || "info@vibe-coding.tw") || "info@vibe-coding.tw";
        const targetPeriod = ymFromDate(lastMonth);

        const ordersSnapshot = await db.collection("orders")
            .where("status", "==", "SUCCESS")
            .where("paidAt", ">=", admin.firestore.Timestamp.fromDate(lastMonth))
            .where("paidAt", "<=", admin.firestore.Timestamp.fromDate(endOfLastMonth))
            .get();

        const auditTrail = [];
        const creditTrail = [];
        const collectShareTargets = async ({ order, itemValue, lineAmount, policy }) => {
            const targets = [];
            const initialTutor = (itemValue?.referredTutorEmail && itemValue.referredTutorEmail.trim())
                ? normalizeEmail(itemValue.referredTutorEmail)
                : ((itemValue?.referralTutor && itemValue.referralTutor.trim()) ? normalizeEmail(itemValue.referralTutor) : fallbackPayoutEmail);

            await collectRevenueShareChainTargets({
                targets,
                role: "user",
                initialEmail: initialTutor,
                initialShare: lineAmount * Number(policy.tutorRate || DEFAULT_REVENUE_SHARE_POLICY.tutorRate),
                uplineRate: policy.tutorUplineRate || DEFAULT_REVENUE_SHARE_POLICY.tutorUplineRate,
                stopEmail: fallbackPayoutEmail,
                getNextEmail: async (currentEmail) => {
                    const tutorData = await getUserByEmail(currentEmail);
                    return normalizeEmail(tutorData?.tutorEmail || fallbackPayoutEmail);
                }
            });

            const { agentEmail, courseDevEmail, courseDevUplineEmail } = await resolveRevenueShareRoleEmails({
                itemValue,
                order,
                initialTutor,
                getUserByEmail
            });
            if (agentEmail && Number(policy.agentRate || 0) > 0) {
                await collectRevenueShareChainTargets({
                    targets,
                    role: "agent",
                    initialEmail: agentEmail,
                    initialShare: lineAmount * Number(policy.agentRate || 0),
                    uplineRate: policy.agentUplineRate || 0,
                    getNextEmail: async (currentEmail) => {
                        const agentData = await getUserByEmail(currentEmail);
                        return normalizeEmail(agentData?.agentEmail || "");
                    }
                });
            }

            if (courseDevEmail && Number(policy.courseDevRate || 0) > 0) {
                await collectRevenueShareChainTargets({
                    targets,
                    role: "courseDev",
                    initialEmail: courseDevEmail,
                    initialShare: lineAmount * Number(policy.courseDevRate || 0),
                    initialNextEmail: courseDevUplineEmail,
                    uplineRate: policy.courseDevUplineRate || 0,
                    getNextEmail: async (currentEmail) => {
                        const cdData = await getUserByEmail(currentEmail);
                        return normalizeEmail(cdData?.courseDevEmail || cdData?.tutorEmail || "");
                    }
                });
            }
            return targets;
        };

        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            const orderId = orderDoc.id;
            const studentUid = order.uid;
            const items = order.items || {};

            for (const [itemKey, itemValue] of Object.entries(items)) {
                const quantity = parseInt(itemValue?.quantity || 1, 10) || 1;
                const itemPrice = parseFloat(itemValue?.price || 0) || 0;
                const lineAmount = itemPrice * quantity;
                const itemReferralLink = itemValue?.referralLink || itemValue?.promoCode || null;
                const effectivePolicyId = normalizeText(order.policyId || "") || DEFAULT_REVENUE_SHARE_POLICY.policyId;
                const policy = await loadRevenueSharePolicy({ db, policyCache, policyId: effectivePolicyId });

                if (lineAmount <= 0) continue;

                const policySnapshot = buildRevenueSharePolicySnapshot(policy);
                const shareTargets = await collectShareTargets({
                    order,
                    itemValue,
                    lineAmount,
                    policy
                });
                const validityMonths = Math.max(
                    1,
                    Number(itemValue?.validityMonths || order?.validityMonths || countValidityMonths(order?.paidAt, order?.expiryDate, defaultValidityMonths))
                );
                const creditStartPeriod = order?.paidAt?.toDate ? ymFromDate(order.paidAt.toDate()) : targetPeriod;

                for (const target of shareTargets) {
                    const recipientEmail = normalizeEmail(target.recipientEmail || "") || fallbackPayoutEmail;
                    const totalCredit = round2Amount(target.shareAmount);
                    if (totalCredit < 0.01) continue;
                    const creditSeed = `${orderId}|${itemKey}|${target.role}|${target.level}|${recipientEmail}`;
                    const creditId = crypto.createHash("sha256").update(creditSeed).digest("hex").slice(0, 40);
                    const creditRef = db.collection("revenue_share_credits").doc(creditId);
                    const existingCredit = await creditRef.get();
                    if (!existingCredit.exists) {
                        const monthlyInstallment = round2Amount(totalCredit / validityMonths);
                        const creditDoc = buildRevenueShareCreditRecord({
                            creditId,
                            orderId,
                            orderItemId: itemKey,
                            studentUid,
                            role: target.role,
                            recipientEmail,
                            level: target.level,
                            referralLink: itemReferralLink,
                            policyId: policy.policyId,
                            policySnapshot,
                            orderAmount: lineAmount,
                            totalCredit,
                            validityMonths,
                            monthlyInstallment,
                            creditStartPeriod,
                            now: admin.firestore.FieldValue.serverTimestamp()
                        });
                        await creditRef.set(creditDoc, { merge: true });
                        creditTrail.push(creditDoc);
                    }
                }
            }
        }

        const creditsSnapshot = await db.collection("revenue_share_credits")
            .where("status", "in", ["active", "pending_account"])
            .get();

        for (const creditDoc of creditsSnapshot.docs) {
            const credit = creditDoc.data() || {};
            const recipientEmail = normalizeEmail(credit.recipientEmail || "");
            if (!recipientEmail) continue;
            const nextPayoutPeriod = String(credit.nextPayoutPeriod || credit.startPeriod || "");
            const remainingCredit = round2Amount(credit.remainingCredit || 0);
            if (!nextPayoutPeriod || remainingCredit < 0.01) continue;
            if (!ymLTE(nextPayoutPeriod, targetPeriod)) continue;

            const recipientUser = await getUserByEmail(recipientEmail);
            const payoutAccount = getPayoutAccountFromUser(recipientUser);
            const monthlyInstallment = round2Amount(credit.monthlyInstallment || 0);
            const plannedPay = Math.min(remainingCredit, monthlyInstallment > 0 ? monthlyInstallment : remainingCredit);
            const paidAmount = payoutAccount ? round2Amount(plannedPay) : 0;
            const blockedAmount = payoutAccount ? 0 : round2Amount(plannedPay);

            const idempotencySeed = `${targetPeriod}|${creditDoc.id}|payout`;
            const idempotencyKey = crypto.createHash("sha256").update(idempotencySeed).digest("hex").slice(0, 40);
            const payoutRef = db.collection("profit_ledger").doc(idempotencyKey);
            const payoutRow = buildRevenueSharePayoutRow({
                idempotencyKey,
                credit: { ...credit, creditId: creditDoc.id },
                recipientEmail,
                paidAmount,
                plannedPay,
                blockedAmount,
                payoutAccountPresent: Boolean(payoutAccount),
                targetPeriod
            });
            await payoutRef.set(payoutRow, { merge: true });
            auditTrail.push(payoutRow);

            if (paidAmount > 0) {
                try {
                    await recordLedgerEvent({
                        db,
                        payload: {
                            eventType: "commission.paid",
                            sourceType: "revenue_share_payout",
                            sourceId: idempotencyKey,
                            sourceLabel: `Revenue share payout ${idempotencyKey}`,
                            entityType: "recipient",
                            entityId: recipientEmail,
                            amount: paidAmount,
                            currency: "TWD",
                            occurredAtDate: new Date(),
                            metadata: {
                                creditId: creditDoc.id,
                                period: targetPeriod,
                                recipientEmail,
                                payoutAccountPresent: Boolean(payoutAccount),
                                role: credit.role || "",
                                orderId: credit.orderId || "",
                                orderItemId: credit.orderItemId || ""
                            }
                        },
                        createdByUid: "system",
                        autoGenerateReports: false
                    });
                } catch (ledgerErr) {
                    console.warn(`[calculateMonthlySharing] commission payment skipped for ${idempotencyKey}:`, ledgerErr.message || ledgerErr);
                }
            }

            const newPaid = round2Amount((credit.paidCredit || 0) + paidAmount);
            const newRemaining = round2Amount((credit.remainingCredit || 0) - paidAmount);
            const isCompleted = newRemaining < 0.01;
            const nextPeriod = payoutAccount && !isCompleted ? addMonthsYm(nextPayoutPeriod, 1) : nextPayoutPeriod;
            await creditDoc.ref.set({
                paidCredit: newPaid,
                remainingCredit: Math.max(0, newRemaining),
                nextPayoutPeriod: nextPeriod,
                status: isCompleted ? "completed" : (payoutAccount ? "active" : "pending_account"),
                lastSettledPeriod: targetPeriod,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        const allCredits = await db.collection("revenue_share_credits").get();
        for (const cDoc of allCredits.docs) {
            const c = cDoc.data() || {};
            const email = normalizeEmail(c.recipientEmail || "");
            if (!email) continue;
            const acc = balanceAgg.get(email) || buildRevenueShareBalanceRecord({ recipientEmail: email });
            acc.totalCredit = round2Amount(acc.totalCredit + Number(c.totalCredit || 0));
            acc.totalPaid = round2Amount(acc.totalPaid + Number(c.paidCredit || 0));
            acc.remainingBalance = round2Amount(acc.remainingBalance + Number(c.remainingCredit || 0));
            if (String(c.status || "") === "active") acc.activeCredits += 1;
            if (String(c.status || "") === "pending_account") acc.pendingAccountCredits += 1;
            balanceAgg.set(email, acc);
        }
        for (const [email, rec] of balanceAgg.entries()) {
            const user = await getUserByEmail(email);
            const payoutAccount = getPayoutAccountFromUser(user);
            const balanceId = crypto.createHash("sha256").update(email).digest("hex").slice(0, 40);
            await db.collection("revenue_share_balances").doc(balanceId).set({
                ...rec,
                payoutAccountPresent: Boolean(payoutAccount),
                lastCalculatedPeriod: targetPeriod,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        try {
            await Promise.all([
                generateLedgerReport({ db, period: targetPeriod, reportType: "trial_balance", createdByUid: "system" }),
                generateLedgerReport({ db, period: targetPeriod, reportType: "profit_and_loss", createdByUid: "system" }),
                generateLedgerReport({ db, period: targetPeriod, reportType: "balance_sheet", createdByUid: "system" })
            ]);
            console.log(`[calculateMonthlySharing] ✅ Ledger reports generated for period=${targetPeriod}`);
        } catch (reportErr) {
            console.warn(`[calculateMonthlySharing] Ledger report generation skipped for period=${targetPeriod}:`, reportErr.message || reportErr);
        }

        console.log(`Profit sharing completed. createdCredits=${creditTrail.length}, ledgerRows=${auditTrail.length}, balances=${balanceAgg.size}`);
    } catch (error) {
        console.error("Error in calculateMonthlySharing:", error);
    }
}

async function adminCalculateAnnualInvestorDividends() {
    const currentYear = new Date().getFullYear();
    const targetYear = currentYear - 1;
    try {
        const result = await settleAnnualInvestorDividends({
            db,
            year: targetYear,
            profileCache: new Map(),
            configCache: new Map(),
            createdByUid: "system"
        });
        console.log(`[calculateAnnualInvestorDividends] Completed for year=${targetYear} settlements=${result.settlementCount}`);
    } catch (error) {
        console.error("Error in calculateAnnualInvestorDividends:", error);
    }
}

exports.calculateMonthlySharing = onSchedule("0 0 1 * *", async () => {
    await adminCalculateMonthlySharing();
});

exports.calculateAnnualInvestorDividends = onSchedule({
    schedule: "0 0 1 1 *",
    timeZone: "Asia/Taipei"
}, async () => {
    await adminCalculateAnnualInvestorDividends();
});

exports.adminLogActivity = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, "User must be logged in.");

    const uid = auth.uid;
    const { courseId, action, duration, metadata } = data;

    assertRequiredValue(courseId, "Missing courseId or action.");
    assertRequiredValue(action, "Missing courseId or action.");

    if (action === "PAGE_VIEW") {
        return { success: true, message: "Page view logging disabled" };
    }

    try {
        await admin.firestore().collection("activity_logs").add({
            uid,
            courseId,
            action,
            duration: duration || 0,
            metadata: metadata || {},
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Activity Log Error:", error);
        throw new HttpsError("internal", "Failed to log activity.");
    }
});

exports.remindAdminPendingAssignments = onSchedule({
    schedule: "0 9 * * *",
    timeZone: "Asia/Taipei"
}, async () => {
    try {
        await adminRunPendingAssignmentReminder();
    } catch (error) {
        console.error("Error in remindAdminPendingAssignments:", error);
    }
});

exports.remindAdminPendingShipments = onSchedule({
    schedule: "30 9 * * *",
    timeZone: "Asia/Taipei"
}, async () => {
    try {
        await adminRunPendingShipmentReminder();
    } catch (error) {
        console.error("Error in remindAdminPendingShipments:", error);
    }
});

function normalizeClassroomInviteAdmin(value = "") {
    const s = String(value || "").trim();
    if (!s) return "";
    try {
        const url = new URL(s);
        if (url.hostname !== "classroom.github.com") return s;
        return `${url.origin}${url.pathname}`.replace(/\/+$/, "").toLowerCase();
    } catch (_) {
        const token = s.replace(/^https?:\/\/classroom\.github\.com\/a\//i, "").replace(/\/+$/, "");
        return token ? `https://classroom.github.com/a/${token}`.toLowerCase() : "";
    }
}

function extractInviteCandidatesAdmin(cfg) {
    if (!cfg) return [];
    if (typeof cfg === "string") return [normalizeClassroomInviteAdmin(cfg)].filter(Boolean);
    if (typeof cfg === "object") {
        return Object.values(cfg)
            .filter((v) => typeof v === "string" && v.trim())
            .map((v) => normalizeClassroomInviteAdmin(v))
            .filter(Boolean);
    }
    return [];
}

async function lookupClassroomInviteBindingAdmin(inputRaw) {
    const normalizedInvite = normalizeClassroomInviteAdmin(inputRaw);
    if (!normalizedInvite.includes("classroom.github.com/a/")) {
        throw new HttpsError("invalid-argument", "請輸入 GitHub Classroom 邀請連結或 invite code。");
    }

    const lessons = await getLessonsForAdmin("");
    const matches = [];
    for (const lesson of lessons) {
        const urlMap = lesson?.githubClassroomUrls || {};
        for (const [unitKey, cfg] of Object.entries(urlMap)) {
            const candidates = extractInviteCandidatesAdmin(cfg);
            if (!candidates.includes(normalizedInvite)) continue;
            matches.push({
                lessonDocId: lesson.id || null,
                courseId: lesson.courseId || lesson.id || null,
                title: lesson.title || null,
                unitKey,
                courseUnits: Array.isArray(lesson.courseUnits) ? lesson.courseUnits : []
            });
        }
    }
    return { success: true, normalizedInvite, totalMatches: matches.length, matches };
}

exports.adminVerifyReferralLink = onCall(async (request) => {
    const { data } = request;
    const referralLink = data?.referralLink || data?.promoCode;
    const { cartItems = [] } = data || {};
    if (!referralLink) throw new HttpsError("invalid-argument", "缺少老師作業連結");

    try {
        const dbRef = admin.firestore();
        const inputStr = normalizeText(referralLink);
        const isUrl = inputStr.toLowerCase().includes("github.com/classroom/") || inputStr.toLowerCase().includes("classroom.github.com/");

        if (isUrl) {
            const normalizedLink = normalizeGitHubUrl(inputStr);
            const linkId = buildReferralLinkDocId(normalizedLink);
            const linkDoc = await dbRef.collection("referral_links").doc(linkId).get();

            if (!linkDoc.exists) {
                return { success: false, message: "查無此作業連結對應的導師 (若剛更新設定，請稍候 30 秒)" };
            }

            const lData = linkDoc.data();
            const tEmail = lData.tutorEmail;
            const tutorUserDoc = await findUserDocByEmail(dbRef, tEmail);
            if (!tutorUserDoc) {
                return { success: false, message: "對應的導師帳號似乎已被移除" };
            }
            const tutorData = tutorUserDoc.data() || {};
            const lessons = await getLessonsForAdmin("");

            if (cartItems && cartItems.length > 0) {
                const results = cartItems.map((item) => {
                    const courseId = item.courseId || item.id;
                    return {
                        courseId,
                        qualified: isTutorFullyQualifiedForCourseAdmin(tutorData, courseId, lessons)
                    };
                });
                const allQualified = results.every((r) => r.qualified);
                if (!allQualified) {
                    const failId = results.find((r) => !r.qualified).courseId;
                    return { success: false, message: `此導師尚未取得「${failId}」的全單元認證，無法作為推薦人。` };
                }
            }

            return {
                success: true,
                referredTutorEmail: tEmail,
                referredTutorName: tutorData.name || tEmail,
                courseId: lData.unitId,
                isLink: true,
                message: "已成功辨識老師推薦連結"
            };
        }

        return { success: false, message: "目前僅支援以作業連結作為推薦識別，請輸入老師提供的連結。" };
    } catch (e) {
        console.error(`[Referral] Error: ${e.message}`);
        throw new HttpsError("internal", e.message);
    }
});

exports.adminFindClassroomInviteBinding = onCall(async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError("unauthenticated", "User must be logged in.");
    const requesterRole = await getRole(auth.uid);
    if (requesterRole !== "admin") throw new HttpsError("permission-denied", "Only admins can query invite bindings.");

    const inputRaw = String(
        request.data?.inviteCodeOrUrl ||
        request.data?.inviteUrl ||
        request.data?.inviteCode ||
        ""
    ).trim();
    if (!inputRaw) throw new HttpsError("invalid-argument", "缺少 inviteCodeOrUrl");
    return lookupClassroomInviteBindingAdmin(inputRaw);
});

exports.adminFindClassroomInviteBindingHttp = onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "https://vibe-coding.tw");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
        const authHeader = req.headers.authorization || "";
        if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Missing bearer token" });
        const idToken = authHeader.substring(7);
        const decoded = await admin.auth().verifyIdToken(idToken);
        const requesterRole = await getRole(decoded.uid);
        if (requesterRole !== "admin") return res.status(403).json({ error: "Only admins can query invite bindings." });

        const inputRaw = String(
            req.body?.inviteCodeOrUrl ||
            req.body?.inviteUrl ||
            req.body?.inviteCode ||
            req.body?.data?.inviteCodeOrUrl ||
            ""
        ).trim();
        if (!inputRaw) return res.status(400).json({ error: "缺少 inviteCodeOrUrl" });

        const result = await lookupClassroomInviteBindingAdmin(inputRaw);
        return res.json(result);
    } catch (error) {
        console.error("[adminFindClassroomInviteBindingHttp] failed:", error);
        return res.status(500).json({ error: error.message || "internal error" });
    }
});

exports.adminPrecheckGithubClassroomAccess = onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "請先登入");

    if (!GITHUB_ORG_ADMIN_TOKEN) {
        return {
            success: false,
            precheckEnabled: false,
            state: "disabled",
            message: "GitHub precheck is not configured."
        };
    }

    const classroomUrl = String(data?.classroomUrl || "").trim();
    const isClassroom = /classroom\.github\.com\/a\//i.test(classroomUrl);
    if (!isClassroom) {
        return {
            success: true,
            precheckEnabled: true,
            state: "skipped",
            message: "Not a GitHub Classroom invite URL."
        };
    }

    try {
        const result = await ensureGithubOrgMembership({ admin, token: GITHUB_ORG_ADMIN_TOKEN, firebaseUid: auth.uid, org: GITHUB_CLASSROOM_ORG });
        return {
            success: result.ok === true,
            precheckEnabled: true,
            state: result.state,
            org: result.org,
            githubLogin: result.githubLogin || null,
            inviteSent: result.inviteSent === true,
            inviteId: result.inviteId || null,
            settingsUrl: "https://github.com/settings/organizations"
        };
    } catch (error) {
        console.error("[adminPrecheckGithubClassroomAccess] failed:", error);
        return {
            success: false,
            precheckEnabled: true,
            state: "error",
            message: error.message || "precheck failed",
            settingsUrl: "https://github.com/settings/organizations"
        };
    }
});

exports.adminSetUserRole = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, "User must be logged in.");

    const adminUid = auth.uid;
    const adminRole = await getRole(adminUid);
    assertAdminRole(adminRole, "Only admins can set roles.");

    const { email, role } = data || {};
    assertRequiredValue(email, "Invalid role.");
    assertRequiredValue(["user", "admin"].includes(role), "Invalid role.");

    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        await admin.firestore().collection("users").doc(userRecord.uid).set({
            email: email,
            role: role,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return { success: true, message: `User ${email} is now a ${role}.` };
    } catch (error) {
        throw new HttpsError("internal", error.message);
    }
});

exports.adminGetRevenueSharePolicies = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can read revenue policies.");

    const policyCache = new Map();
    const policy = await loadRevenueSharePolicy({ db: dbRef, policyCache });
    return {
        policies: [{
            id: policy.policyId || DEFAULT_REVENUE_SHARE_POLICY.policyId,
            policyId: policy.policyId || DEFAULT_REVENUE_SHARE_POLICY.policyId,
            ...buildRevenueSharePolicySnapshot(policy),
            enabled: policy.enabled !== false
        }]
    };
});

exports.adminUpsertRevenueSharePolicy = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can write revenue policies.");

    const payload = request.data || {};
    const policyId = normalizeText(payload.policyId || "");
    assertRequiredValue(policyId, "policyId is required");
    if (policyId !== DEFAULT_REVENUE_SHARE_POLICY.policyId) {
        throw new HttpsError("failed-precondition", "Only the default revenue sharing policy is supported.");
    }

    const asRate = (value, fallback = 0) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        if (n < 0) return 0;
        if (n > 1) return 1;
        return n;
    };

    await dbRef.collection("revenue_share_policies").doc(policyId).set({
        policyId,
        policyName: normalizeText(payload.policyName || payload.name || policyId) || policyId,
        tutorRate: asRate(payload.tutorRate, DEFAULT_REVENUE_SHARE_POLICY.tutorRate),
        tutorUplineRate: asRate(payload.tutorUplineRate, DEFAULT_REVENUE_SHARE_POLICY.tutorUplineRate),
        agentRate: asRate(payload.agentRate, DEFAULT_REVENUE_SHARE_POLICY.agentRate),
        agentUplineRate: asRate(payload.agentUplineRate, DEFAULT_REVENUE_SHARE_POLICY.agentUplineRate),
        courseDevRate: asRate(payload.courseDevRate, DEFAULT_REVENUE_SHARE_POLICY.courseDevRate),
        courseDevUplineRate: asRate(payload.courseDevUplineRate, DEFAULT_REVENUE_SHARE_POLICY.courseDevUplineRate),
        enabled: payload.enabled !== false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, policyId };
});

exports.adminGetInvestorProfiles = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can read investor profiles.");

    const profileCache = new Map();
    const configCache = new Map();
    const snapshotCache = new Map();
    const [profiles, config] = await Promise.all([
        loadInvestorProfiles({ db: dbRef, profileCache }),
        loadInvestorConfig({ db: dbRef, configCache })
    ]);
    const [valuationSnapshots, activeValuationSnapshot, balanceSheetSnapshots, activeBalanceSheetSnapshot] = await Promise.all([
        loadValuationSnapshots({ db: dbRef, snapshotCache }),
        loadActiveValuationSnapshot({ db: dbRef, snapshotCache }),
        loadBalanceSheetSnapshots({ db: dbRef, snapshotCache }),
        loadActiveBalanceSheetSnapshot({ db: dbRef, snapshotCache })
    ]);

    const balancesSnap = await dbRef.collection("investor_balances").get();
    const balancesByInvestor = new Map(
        balancesSnap.docs.map((doc) => [String((doc.data() || {}).investorId || doc.id), { id: doc.id, ...(doc.data() || {}) }])
    );
    const positionsSnap = await dbRef.collection("investor_equity_positions").get();
    const positionsByInvestor = new Map(
        positionsSnap.docs.map((doc) => [String((doc.data() || {}).investorId || doc.id), { id: doc.id, ...(doc.data() || {}) }])
    );
    const issuancesSnap = await dbRef.collection("equity_issuances").orderBy("createdAt", "desc").limit(25).get();
    const recentIssuances = issuancesSnap.docs.map((doc) => ({ issuanceId: doc.id, ...(doc.data() || {}) }));

    return {
        config,
        valuationSnapshots,
        activeValuationSnapshot,
        balanceSheetSnapshots,
        activeBalanceSheetSnapshot,
        profiles: profiles.map((profile) => {
            const balance = balancesByInvestor.get(profile.investorId) || {};
            const position = positionsByInvestor.get(profile.investorId) || {};
            return {
                ...profile,
                currentBalance: Number(balance.currentBalance || 0),
                lastSettlementYear: balance.lastSettlementYear || null,
                lastCreditEventId: balance.lastCreditEventId || null,
                equityShares: Number(position.totalIssuedShares || profile.equityShares || profile.shareUnits || 0),
                ownershipPct: Number(position.ownershipPct || profile.ownershipPct || 0),
                valuationId: position.valuationId || profile.valuationId || "",
                participantType: position.participantType || profile.participantType || "investor",
                latestIssuanceId: position.latestIssuanceId || null
            };
        }),
        equityPositions: Array.from(positionsByInvestor.values()),
        recentIssuances
    };
});

exports.adminUpsertInvestorProfile = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can write investor profiles.");

    const payload = request.data || {};
    const investorId = normalizeText(payload.investorId || payload.id || "");
    assertRequiredValue(investorId, "investorId is required");

    const shareUnits = Number(payload.shareUnits || payload.share || 0);
    if (!Number.isFinite(shareUnits) || shareUnits < 0) {
        throw new HttpsError("invalid-argument", "shareUnits must be a non-negative number.");
    }

    await dbRef.collection("investor_profiles").doc(investorId).set({
        investorId,
        investorName: normalizeText(payload.investorName || payload.name || investorId) || investorId,
        investorEmail: normalizeText(payload.investorEmail || payload.email || "").toLowerCase(),
        participantType: normalizeText(payload.participantType || "investor"),
        shareUnits: Math.max(0, shareUnits),
        payoutAccount: normalizeText(payload.payoutAccount || payload.paymentAccount || ""),
        notes: normalizeText(payload.notes || ""),
        enabled: payload.enabled !== false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await dbRef.collection("investor_balances").doc(investorId).set({
        investorId,
        investorName: normalizeText(payload.investorName || payload.name || investorId) || investorId,
        investorEmail: normalizeText(payload.investorEmail || payload.email || "").toLowerCase(),
        participantType: normalizeText(payload.participantType || "investor"),
        shareUnits: Math.max(0, shareUnits),
        currentBalance: Number.isFinite(Number(payload.currentBalance)) ? Number(payload.currentBalance) : 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, investorId };
});

exports.adminUpsertValuationSnapshot = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can write valuation snapshots.");

    const payload = request.data || {};
    const snapshotCache = new Map();
    const result = await upsertValuationSnapshot({
        db: dbRef,
        payload,
        createdByUid: uid,
        snapshotCache
    });

    return { success: true, valuationId: result.valuationId, snapshot: result };
});

exports.adminUpsertBalanceSheetSnapshot = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can write balance sheet snapshots.");

    const payload = request.data || {};
    const snapshotCache = new Map();
    const result = await upsertBalanceSheetSnapshot({
        db: dbRef,
        payload,
        createdByUid: uid,
        snapshotCache
    });

    return { success: true, snapshotId: result.snapshotId, snapshot: result };
});

exports.adminIssueInvestorEquity = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can issue investor equity.");

    const payload = request.data || {};
    const profileCache = new Map();
    const snapshotCache = new Map();
    const result = await issueInvestorEquity({
        db: dbRef,
        payload,
        createdByUid: uid,
        profileCache,
        snapshotCache
    });

    return { success: true, ...result };
});

exports.adminRecordInvestorFinanceEvent = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can record investor events.");

    const payload = request.data || {};
    const profileCache = new Map();
    const result = await recordInvestorFinanceEvent({
        db: dbRef,
        profileCache,
        payload,
        createdByUid: uid
    });

    return { success: true, ...result };
});

exports.adminSettleAnnualInvestorDividends = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can settle investor dividends.");

    const payload = request.data || {};
    const targetYear = Number(payload.year || new Date().getFullYear() - 1);
    if (!Number.isFinite(targetYear)) {
        throw new HttpsError("invalid-argument", "year must be a number.");
    }

    const profileCache = new Map();
    const configCache = new Map();
    const result = await settleAnnualInvestorDividends({
        db: dbRef,
        year: targetYear,
        profileCache,
        configCache,
        createdByUid: uid
    });

    return { success: true, ...result };
});

exports.adminRecordLedgerEvent = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can record ledger events.");

    const payload = request.data || {};
    const result = await recordLedgerEvent({
        db: dbRef,
        payload,
        createdByUid: uid,
        autoGenerateReports: payload.autoGenerateReports !== false
    });

    return { success: true, ...result };
});

exports.adminGenerateLedgerReport = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can generate ledger reports.");

    const payload = request.data || {};
    const period = String(payload.period || "").trim();
    const reportType = String(payload.reportType || "trial_balance").trim();
    if (!period) {
        throw new HttpsError("invalid-argument", "period is required.");
    }

    const report = await generateLedgerReport({
        db: dbRef,
        period,
        reportType,
        createdByUid: uid
    });

    return { success: true, report };
});

exports.adminExportLedgerReport = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can export ledger reports.");

    const payload = request.data || {};
    const period = String(payload.period || "").trim();
    const reportType = String(payload.reportType || "trial_balance").trim();
    const format = String(payload.format || "csv").trim();
    if (!period) {
        throw new HttpsError("invalid-argument", "period is required.");
    }

    const result = await exportLedgerReport({
        db: dbRef,
        period,
        reportType,
        format,
        createdByUid: uid
    });

    return { success: true, ...result };
});

exports.adminRecordOrderRefundEvent = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, "Only admins can record order refunds.");

    const payload = request.data || {};
    const orderId = String(payload.orderId || "").trim();
    if (!orderId) {
        throw new HttpsError("invalid-argument", "orderId is required.");
    }

    const orderRef = dbRef.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
        throw new HttpsError("not-found", `Order ${orderId} not found.`);
    }

    const order = orderSnap.data() || {};
    const refundAmount = Number(payload.amount || order.amount || order.totalAmount || 0);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        throw new HttpsError("invalid-argument", "refund amount must be greater than 0.");
    }

    const rawRefundAtDate = payload.refundAtDate ? new Date(payload.refundAtDate) : new Date();
    const refundAtDate = Number.isNaN(rawRefundAtDate.getTime()) ? new Date() : rawRefundAtDate;
    const orderCurrency = String(order.currency || payload.currency || "TWD").toUpperCase();
    const taxAmount = Number(payload.taxAmount ?? order.taxAmount ?? 0) || 0;
    const netAmount = taxAmount > 0 ? Math.max(0, refundAmount - taxAmount) : refundAmount;

    const result = await recordLedgerEvent({
        db: dbRef,
        payload: {
            eventType: "order.refunded",
            sourceType: "order",
            sourceId: payload.refundId || `${orderId}|refund|${refundAtDate.toISOString().slice(0, 10)}`,
            sourceLabel: `Order refund ${orderId}`,
            entityType: "order",
            entityId: orderId,
            amount: refundAmount,
            currency: orderCurrency,
            occurredAtDate: refundAtDate,
            metadata: {
                orderId,
                studentUid: order.uid || "",
                refundReason: String(payload.reason || order.refundReason || ""),
                refundAccount: String(payload.refundAccount || "expense:sales_returns"),
                taxAmount,
                netAmount,
                cashAccount: "asset:cash",
                note: String(payload.note || `Refund recorded for order ${orderId}`)
            }
        },
        createdByUid: uid,
        autoGenerateReports: true
    });

    const updateData = {
        status: "REFUNDED",
        refundAmount: refundAmount,
        refundReason: String(payload.reason || order.refundReason || ""),
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        refundedByUid: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await orderRef.set(updateData, { merge: true });

    return { success: true, ...result };
});

exports.adminUpdateUserRelationships = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const adminRole = await getRole(auth.uid);
    assertAdminRole(adminRole);

    const { targetUid, agentEmail, tutorEmail, courseDevEmail } = data || {};
    assertRequiredValue(targetUid, "missing-target-uid");

    const updatePayload = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (agentEmail !== undefined) updatePayload.agentEmail = agentEmail ? normalizeEmail(agentEmail) : "";
    if (tutorEmail !== undefined) updatePayload.tutorEmail = tutorEmail ? normalizeEmail(tutorEmail) : "";
    if (courseDevEmail !== undefined) updatePayload.courseDevEmail = courseDevEmail ? normalizeEmail(courseDevEmail) : "";

    await db.collection("users").doc(targetUid).set(updatePayload, { merge: true });
    console.log(`[adminUpdateUserRelationships] ✅ Updated user relationships for targetUid=${targetUid} by admin=${auth.uid}`);

    return { success: true };
});

exports.adminGetUserRelationships = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const adminRole = await getRole(auth.uid);
    assertAdminRole(adminRole);

    const { searchKey } = data || {};
    if (!searchKey) {
        throw new HttpsError("invalid-argument", "missing-search-key");
    }

    const cleanKey = String(searchKey).trim();
    let targetDoc = await db.collection("users").doc(cleanKey).get();

    if (!targetDoc.exists) {
        const emailSnap = await db.collection("users")
            .where("email", "==", cleanKey.toLowerCase())
            .limit(1)
            .get();
        if (!emailSnap.empty) {
            targetDoc = emailSnap.docs[0];
        }
    }

    if (!targetDoc.exists) {
        throw new HttpsError("not-found", "user-not-found");
    }

    const targetData = targetDoc.data() || {};
    return {
        uid: targetDoc.id,
        email: targetData.email || "",
        name: targetData.name || targetData.displayName || "",
        role: targetData.role || "user",
        agentEmail: targetData.agentEmail || "",
        tutorEmail: targetData.tutorEmail || "",
        courseDevEmail: targetData.courseDevEmail || ""
    };
});

exports.adminSaveTutorConfigs = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, "User must be logged in.");

    const uid = auth.uid;
    const email = auth.token?.email || "";
    const role = await getRole(uid);
    const { courseId, configs } = data || {};
    assertRequiredValue(courseId, "Missing courseId or configs.");
    assertRequiredValue(configs, "Missing courseId or configs.");

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const effectiveAssignmentUrlMaps = resolveAssignmentUrlMaps(configs) || {};
    const unitIds = Object.keys(effectiveAssignmentUrlMaps || {});
    const canManageAllUnits = role === "admin";
    const canManageRequestedUnits = unitIds.every(unitId => hasQualifiedTutorStatus(userData, unitId));

    if (!canManageAllUnits && !canManageRequestedUnits) {
        throw new HttpsError("permission-denied", "Only admins or qualified tutors for these units can save configs.");
    }

    const lessons = await loadLessonsWithOptionalDistributorOverride(data?.distributorId || "");

    if (role === "admin") {
        console.log(`[saveTutorConfigs] Admin ${email} saving configs to users collection...`);
    }

    if (unitIds.length > 0) {
        console.log(`[saveTutorConfigs] Syncing assignment URLs to user documents for ${courseId}...`);
        for (const [rawUnitId, tutorsMap] of Object.entries(effectiveAssignmentUrlMaps)) {
            const unitId = resolveCanonicalUnitId(rawUnitId, lessons) || rawUnitId;
            for (const [tEmail, url] of Object.entries(tutorsMap || {})) {
                try {
                    const userRecord = await admin.auth().getUserByEmail(tEmail);
                    const tutorUid = userRecord.uid;
                    await upsertTutorConfigForUser(db, tutorUid, unitId, buildTutorConfigEntry({
                        email: tEmail,
                        assignmentUrl: url
                    }), {
                        syncReferralUrl: url,
                        syncReferralLinkFn: syncReferralLink
                    });
                    console.log(`[saveTutorConfigs] ✅ Synced ${unitId} (from ${rawUnitId}) for ${tEmail}`);
                } catch (err) {
                    console.warn(`[saveTutorConfigs] Failed to sync ${tEmail} for ${unitId}: ${err.message}`);
                }
            }
        }
    }

    if (configs.tutorConfigs) {
        console.log("[saveTutorConfigs] Syncing custom tutorConfigs to user documents...");
        for (const [rawUnitId, configObj] of Object.entries(configs.tutorConfigs)) {
            const unitId = resolveCanonicalUnitId(rawUnitId, lessons) || rawUnitId;
            const tEmail = configObj.email || email;
            try {
                const userRecord = await admin.auth().getUserByEmail(tEmail.toLowerCase());
                const tutorUid = userRecord.uid;
                const preferredAssignmentUrl = getPreferredAssignmentUrl(configObj);

                await upsertTutorConfigForUser(db, tutorUid, unitId, buildTutorConfigEntry({
                    email: tEmail.toLowerCase(),
                    assignmentUrl: preferredAssignmentUrl,
                    githubOrg: configObj.githubOrg,
                    templateRepo: configObj.templateRepo,
                    githubToken: configObj.githubToken
                }), {
                    syncReferralUrl: preferredAssignmentUrl || null,
                    syncReferralLinkFn: syncReferralLink
                });

                console.log(`[saveTutorConfigs] ✅ Saved custom config for ${unitId} (from ${rawUnitId}) and tutor ${tEmail}`);
            } catch (err) {
                console.warn(`[saveTutorConfigs] Failed to save custom config for ${tEmail} on ${unitId}: ${err.message}`);
            }
        }
    }

    return { success: true, message: "Configs saved and synced to user documents." };
});

exports.adminGetTutorConfigs = onCall(async (request) => {
    const { data } = request;
    const { courseId } = data || {};

    try {
        if (courseId) {
            const tutorsSnap = await db.collection("users").get();
            const authorizedTutors = [];
            const tutorDetails = {};
            const assignmentUrlMap = { [courseId]: {} };

            tutorsSnap.forEach((tDoc) => {
                const tData = tDoc.data() || {};
                const tutorConfigs = tData.tutorConfigs || {};
                const config = tutorConfigs[courseId];
                if (config && config.authorized === true) {
                    authorizedTutors.push(config.email);
                    tutorDetails[config.email] = config;
                    const assignmentUrl = getPreferredAssignmentUrl(config);
                    if (assignmentUrl) {
                        assignmentUrlMap[courseId][config.email] = assignmentUrl;
                    }
                }
            });

            return {
                [courseId]: {
                    authorizedTutors,
                    tutorDetails,
                    assignmentUrlMap
                }
            };
        }

        const allConfigs = {};
        const usersSnap = await db.collection("users").get();

        usersSnap.forEach((uDoc) => {
            const uData = uDoc.data() || {};
            const tutorConfigs = uData.tutorConfigs || {};
            for (const [uId, config] of Object.entries(tutorConfigs)) {
                if (!config.authorized) continue;
                if (!allConfigs[uId]) {
                    allConfigs[uId] = {
                        authorizedTutors: [],
                        tutorDetails: {},
                        assignmentUrlMap: { [uId]: {} }
                    };
                }
                allConfigs[uId].authorizedTutors.push(config.email);
                allConfigs[uId].tutorDetails[config.email] = config;
                const assignmentUrl = getPreferredAssignmentUrl(config);
                if (assignmentUrl) {
                    allConfigs[uId].assignmentUrlMap[uId][config.email] = assignmentUrl;
                }
            }
        });

        return allConfigs;
    } catch (e) {
        throw new HttpsError("internal", e.message);
    }
});

function assertAuthenticated(auth, message = "請先登入") {
    if (!auth) throw new HttpsError("unauthenticated", message);
}

async function fetchExternalCourseContentHelper(candidateFileName, runtimeConfig, locales) {
    if (!runtimeConfig?.enabled) return null;
    const contentRepoToken = CONTENT_REPO_TOKEN.value();
    if (!contentRepoToken) {
        console.warn("[content-runtime] CONTENT_REPO_TOKEN missing, skip external fetch.");
        return null;
    }

    const repoOwner = runtimeConfig.repoOwner;
    const repoName = runtimeConfig.repoName;
    const ref = runtimeConfig.contentVersion || "main";

    for (const locale of locales) {
        const localeCandidates = buildI18nFilenameCandidates(candidateFileName, locale);
        for (const localeCandidate of localeCandidates) {
            const key = `${repoOwner}/${repoName}@${ref}|${locale}|${localeCandidate}`;
            const cacheDocId = require("crypto").createHash("md5").update(key).digest("hex");

            const cached = CONTENT_FILE_CACHE.get(key);
            if (cached && cached.expiresAt > Date.now()) {
                return { content: cached.content, source: "external-cache", locale, file: localeCandidate };
            }

            try {
                const cacheDoc = await db.collection("course_cache").doc(cacheDocId).get();
                if (cacheDoc.exists) {
                    const cacheData = cacheDoc.data();
                    if (cacheData && cacheData.expiresAt > Date.now()) {
                        CONTENT_FILE_CACHE.set(key, {
                            content: cacheData.content,
                            expiresAt: cacheData.expiresAt
                        });
                        return { content: cacheData.content, source: "external-cache-shared", locale, file: localeCandidate };
                    }
                }
            } catch (err) {
                console.warn("[content-runtime] Firestore cache read error:", err.message || err);
            }

            const contentPath = (localeCandidate === "tutors.html" || localeCandidate === "students.html")
                ? `public/${locale === "en" ? "en" : "zh-TW"}/${localeCandidate}`
                : `courses/${locale}/${localeCandidate}`;
            const apiUrl = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${contentPath}?ref=${encodeURIComponent(ref)}`;

            try {
                const resp = await fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${contentRepoToken}`,
                        "Accept": "application/vnd.github+json",
                        "User-Agent": "vibe-coding-runtime"
                    }
                });
                if (!resp.ok) {
                    continue;
                }
                const payload = await resp.json();
                const encoded = String(payload?.content || "").replace(/\n/g, "");
                if (!encoded) continue;
                const content = Buffer.from(encoded, "base64").toString("utf8");
                const expiresAt = Date.now() + (Math.max(30, Number(runtimeConfig.cacheTtlSec || 300)) * 1000);

                CONTENT_FILE_CACHE.set(key, { content, expiresAt });
                db.collection("course_cache").doc(cacheDocId).set({
                    content,
                    expiresAt,
                    key,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch((err) => {
                    console.warn("[content-runtime] Firestore cache write error:", err.message || err);
                });

                return { content, source: "external", locale, file: localeCandidate };
            } catch (err) {
                console.warn(`[content-runtime] external fetch failed for ${contentPath}:`, err.message || err);
            }
        }
    }
    return null;
}

async function fetchGuideContentFromLocalFiles({ lessons, courseId, unitId, preferredLocales }) {
    const privateCoursesDir = path.join(__dirname, "private_courses");

    const course = findLessonByCourseRef(courseId || unitId || "", lessons);
    if (!course) return {};

    const entryUnitId = normalizeCourseFile(Array.isArray(course.courseUnits) ? course.courseUnits[0] : "");
    const legacyLessonUrl = course.classroomUrl || "";
    const assignmentFile = normalizeCourseFile(legacyLessonUrl);
    const units = Array.isArray(course.courseUnits) ? [...course.courseUnits] : [];

    const relatedFiles = Array.from(new Set([
        entryUnitId,
        ...units,
        (assignmentFile && assignmentFile.endsWith(".html")) ? assignmentFile : ""
    ].filter(Boolean)));

    const aggregatedGuides = {};
    for (const file of relatedFiles) {
        let html = "";
        let source = "none";

        const runtimeConfig = await getContentRuntimeConfig(db);
        if (runtimeConfig?.enabled) {
            const externalHit = await fetchExternalCourseContentHelper(file, runtimeConfig, preferredLocales);
            if (externalHit && externalHit.content) {
                html = externalHit.content;
                source = externalHit.source;
            }
        }

        if (!html && fs.existsSync(privateCoursesDir)) {
            let localFile = null;
            if (fs.existsSync(path.join(privateCoursesDir, file))) {
                localFile = file;
            } else {
                for (const locale of preferredLocales) {
                    const candidates = buildI18nFilenameCandidates(file, locale);
                    const matched = candidates.find((candidate) => fs.existsSync(path.join(privateCoursesDir, candidate)));
                    if (matched) {
                        localFile = matched;
                        break;
                    }
                }
            }

            if (localFile) {
                const filePath = path.join(privateCoursesDir, localFile);
                if (fs.existsSync(filePath)) {
                    html = fs.readFileSync(filePath, "utf8");
                    source = "local";
                }
            }
        }

        if (!html) continue;

        const guideContent = extractHiddenSectionContent(html, "tutor-guide");
        const attachContent = extractHiddenSectionContent(html, "attachment-guide");
        const assignmentContent = extractHiddenSectionContent(html, "assignment-guide");

        if (attachContent) {
            if (!aggregatedGuides.attachment) aggregatedGuides.attachment = {};
            aggregatedGuides.attachment[file] = attachContent;
        }
        if (guideContent) {
            if (!aggregatedGuides.tutor) aggregatedGuides.tutor = {};
            aggregatedGuides.tutor[file] = guideContent;
        }
        if (assignmentContent) {
            if (!aggregatedGuides.assignment) aggregatedGuides.assignment = {};
            aggregatedGuides.assignment[file] = assignmentContent;
        }
    }

    return aggregatedGuides;
}

function normalizeLearningPathCategoryLabelEntry(value = {}) {
    if (typeof value === "string") {
        const text = String(value || "").trim();
        return {
            "zh-TW": text,
            en: "",
        };
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    const zh = String(
        value["zh-TW"] ||
        value.zhTW ||
        value.zh ||
        value.tw ||
        value.labelZh ||
        value.twLabel ||
        value.label ||
        value.title ||
        ""
    ).trim();
    const en = String(
        value.en ||
        value["en-US"] ||
        value.labelEn ||
        value.enLabel ||
        value.titleEn ||
        value.label ||
        value.title ||
        ""
    ).trim();

    return {
        "zh-TW": zh,
        en: en,
    };
}

function normalizeCanonicalLearningPathKey(value = "") {
    const v = String(value || "").trim().toLowerCase().split("/").pop().split("?")[0].split("#")[0].replace(/\.html$/i, "");
    if (!v) return "";
    if (v === "common" || v === "car-starter" || v === "car-basic" || v === "car-advanced") return v;
    if (/^(?:tw|en)-common$/i.test(v)) return "common";
    if (/^(?:tw|en)-car-(starter|basic|advanced)$/i.test(v)) return v.replace(/^(?:tw|en)-/i, "");
    if (/^start-\d{2}-unit-/i.test(v)) return "car-starter";
    if (/^basic-\d{2}-unit-/i.test(v)) return "car-basic";
    if (/^(?:adv|advanced)-\d{2}-unit-/i.test(v)) return "car-advanced";
    if (/^\d{2}-unit-/i.test(v)) return "common";
    if (/^prepare-\d+/i.test(v)) return "common";
    return v;
}

function normalizeLearningPathCategoryLabels(sourceMap = {}) {
    const normalized = {};
    if (!sourceMap || typeof sourceMap !== "object" || Array.isArray(sourceMap)) return normalized;

    const ensureEntry = (canonicalKey) => {
        if (!normalized[canonicalKey]) normalized[canonicalKey] = {};
        return normalized[canonicalKey];
    };

    const assignLabel = (rawKey, rawValue, localeHint = "") => {
        const canonicalKey = normalizeCanonicalLearningPathKey(rawKey);
        if (!canonicalKey) return;

        const entry = ensureEntry(canonicalKey);
        const normalizedEntry = normalizeLearningPathCategoryLabelEntry(rawValue);

        if (localeHint === "zh-TW") {
            const val = (typeof rawValue === "string" ? rawValue : normalizedEntry["zh-TW"]) || "";
            entry["zh-TW"] = entry["zh-TW"] || val.trim();
            return;
        }

        if (localeHint === "en") {
            const val = (typeof rawValue === "string" ? rawValue : normalizedEntry.en) || "";
            entry.en = entry.en || val.trim();
            return;
        }

        if (typeof rawValue === "string") {
            const text = String(rawValue || "").trim();
            if (!text) return;
            const lowerKey = String(rawKey || "").trim().toLowerCase();
            if (lowerKey.startsWith("en-") || lowerKey.startsWith("en_")) {
                entry.en = entry.en || text;
            } else {
                entry["zh-TW"] = entry["zh-TW"] || text;
            }
            return;
        }

        if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
            if (normalizedEntry["zh-TW"]) entry["zh-TW"] = entry["zh-TW"] || normalizedEntry["zh-TW"];
            if (normalizedEntry.en) entry.en = entry.en || normalizedEntry.en;
        }
    };

    for (const [key, value] of Object.entries(sourceMap)) {
        const isLocaleBucket = key === "zh-TW" || key === "zhTW" || key === "zh" || key === "tw" || key === "en" || key === "en-US";
        if (isLocaleBucket && value && typeof value === "object" && !Array.isArray(value)) {
            const localeHint = key.startsWith("en") ? "en" : "zh-TW";
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
                assignLabel(nestedKey, nestedValue, localeHint);
            }
            continue;
        }

        let localeHint = "";
        const lowerKey = String(key || "").trim().toLowerCase();
        if (lowerKey.startsWith("en-") || lowerKey.startsWith("en_")) {
            localeHint = "en";
        } else if (lowerKey.startsWith("tw-") || lowerKey.startsWith("tw_") || lowerKey.startsWith("zh-") || lowerKey.startsWith("zh_")) {
            localeHint = "zh-TW";
        }

        assignLabel(key, value, localeHint);
    }

    for (const [key, value] of Object.entries(normalized)) {
        normalized[key] = {
            "zh-TW": String(value["zh-TW"] || "").trim(),
            en: String(value.en || "").trim(),
        };
    }

    return normalized;
}

exports.getLessonsMetadata = onCall(async (request) => {
    try {
        const data = request?.data || {};
        const distributorId = await resolveLessonMetadataDistributorId(data.distributorId || "", request.auth?.uid || "");
        const lessons = await loadLessonsWithOptionalDistributorOverride(distributorId);

        const settingsSnap = await db.collection("metadata_settings").doc("learning_paths").get();
        const rawCategoryLabels = settingsSnap.exists ? ((settingsSnap.data() || {}).categoryLabels || {}) : {};
        const categoryLabels = normalizeLearningPathCategoryLabels(rawCategoryLabels);

        return {
            lessons,
            distributorId,
            categoryLabels
        };
    } catch (err) {
        console.error("[admin/getLessonsMetadata] failed:", err);
        throw new HttpsError("internal", err.message || "Failed to load lessons metadata");
    }
});

function normalizeCourseContextId(value = "") {
    return String(value || "");
}

function buildStudentsRelevantToTutor({ usersMap = {}, lessons = [], email = "", targetUnitId = null, targetCourseId = null, isTutorModeAdmin = false }) {
    const normalizedEmail = normalizeEmail(email);
    const relevant = [];

    Object.entries(usersMap).forEach(([sid, studentData]) => {
        const unitAssignments = studentData?.unitAssignments || {};
        let isRelevant = false;

        if (targetUnitId) {
            const assignedTutor = normalizeEmail(unitAssignments?.[targetUnitId]);
            if (assignedTutor === normalizedEmail || isTutorModeAdmin) {
                isRelevant = true;
            }
        } else if (targetCourseId) {
            const hasCourseOrder = (studentData.orders || []).includes(targetCourseId);
            const assignedToAnyInCourse = Object.keys(unitAssignments).some((unitId) => {
                const parent = findParentCourseIdByUnit(unitId, lessons);
                return parent === targetCourseId && (normalizeEmail(unitAssignments[unitId]) === normalizedEmail || isTutorModeAdmin);
            });
            if (hasCourseOrder || assignedToAnyInCourse) isRelevant = true;
        } else {
            const hasAnyAssignmentToMe = Object.values(unitAssignments).some((value) => normalizeEmail(value) === normalizedEmail);
            if (hasAnyAssignmentToMe || isTutorModeAdmin) isRelevant = true;
        }

        if (isRelevant) relevant.push([sid, studentData]);
    });

    return relevant;
}

exports.adminGetDashboardData = onCall({ secrets: [CONTENT_REPO_TOKEN] }, async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, "User must be logged in.");

    const uid = auth.uid;
    const email = normalizeEmail(auth.token.email || "");
    const requesterRole = await getRole(uid);
    const lessons = await loadLessonsWithOptionalDistributorOverride(data.distributorId || "");
    const physicalUnitIds = getPhysicalUnitIdSet(lessons);

    if (!data.unitId && !data.courseId && requesterRole !== "admin") {
        throw new HttpsError("permission-denied", "You must specify a unitId or courseId to view your dashboard.");
    }

    const canonicalCourseId = (value) => String(value || "");

    try {
        const authorizedCourseIds = [];
        const courseGuideIndex = {};
        const unitTutorConfigs = {};
        const unitToDocId = {};
        const myApplicationsMapping = {};
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};

        try {
            const myAppsSnapshot = await queryTutorApplications(db, { userId: uid, limit: 100 });
            myAppsSnapshot.forEach((doc) => {
                const app = doc.data() || {};
                if (!app.unitId || myApplicationsMapping[app.unitId]) return;
                myApplicationsMapping[app.unitId] = {
                    status: app.status,
                    appliedAt: app.appliedAt,
                    applicationId: doc.id
                };
            });
        } catch (appErr) {
            console.warn("[adminGetDashboardData] Failed to fetch user applications:", appErr.message);
        }

        const myTutorConfigs = userData.tutorConfigs || {};

        let tutorTerms = "";
        try {
            const termsDoc = await db.collection("metadata_settings").doc("tutor_terms").get();
            tutorTerms = termsDoc.exists ? (termsDoc.data().content || "") : "尚未設定合格教師權利義務細則。";
        } catch (e) {
            console.warn("[adminGetDashboardData] Failed to fetch tutor terms:", e);
        }

        let allPendingApplications = [];
        if (requesterRole === "admin" && data.tutorMode !== false) {
            const pendingAppsSnapshot = await queryTutorApplications(db, {
                statuses: ["pending"],
                limit: 1000
            });

            pendingAppsSnapshot.forEach((doc) => {
                const app = doc.data() || {};
                allPendingApplications.push({
                    id: doc.id,
                    applicationId: doc.id,
                    ...app
                });
            });

            allPendingApplications.sort((a, b) => {
                const timeA = a.appliedAt?.toMillis ? a.appliedAt.toMillis() : (new Date(a.appliedAt || 0).getTime() || 0);
                const timeB = b.appliedAt?.toMillis ? b.appliedAt.toMillis() : (new Date(b.appliedAt || 0).getTime() || 0);
                return timeB - timeA;
            });
        }

        const usersSnapshot = await db.collection("users").get();
        const synthesizedConfigs = {};
        usersSnapshot.forEach((doc) => {
            const uData = doc.data();
            const userEmail = uData.email;
            const tutorConfigs = uData.tutorConfigs || {};
            for (const [unitId, config] of Object.entries(tutorConfigs)) {
                indexAuthorizedTutorConfigForDashboard({
                    uData,
                    email: userEmail,
                    unitId,
                    config,
                    lessons,
                    synthesizedConfigs,
                    unitTutorConfigs,
                    unitToDocId,
                    authorizedCourseIds,
                    findCourseByUnitIdFn: findCourseByUnitId,
                    findCourseByPageOrUnitFn: findCourseByPageOrUnit
                });
            }
        });

        Object.keys(synthesizedConfigs).forEach((docId) => {
            try {
                const cfg = synthesizedConfigs[docId];
                const isTutorModeAdmin = requesterRole === "admin" && data.tutorMode !== false;
                const isAuthorized = isTutorModeAdmin || (Array.isArray(cfg.authorizedTutors) && cfg.authorizedTutors.includes(email));
                const mappedId = docId;

                const cfgAssignmentUrlMaps = cfg.assignmentUrlMap || null;
                if (cfgAssignmentUrlMaps) {
                    Object.keys(cfgAssignmentUrlMaps).forEach((unitId) => {
                        const equivalentUnits = new Set([unitId, resolveCanonicalUnitId(unitId, lessons)]);
                        const parentCourse = findCourseByUnitId(unitId, lessons);
                        (Array.isArray(parentCourse?.courseUnits) ? parentCourse.courseUnits : []).forEach((candidateUnit) => {
                            if (unitIdsMatch(candidateUnit, unitId)) equivalentUnits.add(candidateUnit);
                        });

                        equivalentUnits.forEach((candidateUnit) => {
                            if (!candidateUnit) return;
                            const existingDocId = unitToDocId[candidateUnit];
                            if (!existingDocId || !existingDocId.includes(".html")) {
                                unitToDocId[candidateUnit] = docId;
                            }
                        });
                    });
                }

                if (docId.includes(".html")) {
                    unitToDocId[docId] = docId;
                    const parentCourse = findCourseByUnitId(docId, lessons);
                    (Array.isArray(parentCourse?.courseUnits) ? parentCourse.courseUnits : []).forEach((candidateUnit) => {
                        if (unitIdsMatch(candidateUnit, docId)) {
                            unitToDocId[candidateUnit] = docId;
                        }
                    });
                }

                if (isAuthorized) {
                    if (docId.includes(".html")) {
                        const parentCourse = findCourseByUnitId(mappedId, lessons);
                        if (parentCourse && !authorizedCourseIds.includes(parentCourse.courseId)) {
                            authorizedCourseIds.push(parentCourse.courseId);
                        }
                    } else if (!authorizedCourseIds.includes(mappedId)) {
                        authorizedCourseIds.push(mappedId);
                    }
                    courseGuideIndex[mappedId] = cfg;
                    if (mappedId !== docId) {
                        courseGuideIndex[docId] = cfg;
                    }
                }
            } catch (err) {
                console.error(`Error processing config for course ${docId}:`, err);
            }
        });

        const requestedUnitId = data.unitId ? resolveCanonicalUnitId(data.unitId, lessons) : null;
        const requestedCourseId = data.courseId || (requestedUnitId ? findParentCourseIdByUnit(requestedUnitId, lessons) : null);
        const requestedGuideCourseIds = requestedCourseId ? [requestedCourseId] : [];
        const preferredLocales = [];
        if (data.locale) preferredLocales.push(data.locale);
        if (userData.locale && !preferredLocales.includes(userData.locale)) preferredLocales.push(userData.locale);
        if (!preferredLocales.includes("en")) preferredLocales.push("en");
        if (!preferredLocales.includes("zh-TW")) preferredLocales.push("zh-TW");

        if (requesterRole === "admin" && data.tutorMode !== false) {
            lessons.forEach((lesson) => {
                if (!authorizedCourseIds.includes(lesson.courseId)) {
                    authorizedCourseIds.push(lesson.courseId);
                }
            });
        }

        for (const cid of requestedGuideCourseIds) {
            const aggregatedGuides = await fetchGuideContentFromLocalFiles({
                lessons,
                courseId: cid,
                unitId: requestedUnitId,
                preferredLocales
            });
            if (Object.keys(aggregatedGuides).length > 0) {
                if (!courseGuideIndex[cid]) courseGuideIndex[cid] = {};
                if (aggregatedGuides.tutor) {
                    courseGuideIndex[cid].tutorGuide = Object.assign({}, courseGuideIndex[cid].tutorGuide || {}, aggregatedGuides.tutor);
                }
                if (aggregatedGuides.attachment) {
                    courseGuideIndex[cid].attachmentGuide = Object.assign({}, courseGuideIndex[cid].attachmentGuide || {}, aggregatedGuides.attachment);
                }
                if (aggregatedGuides.assignment) {
                    courseGuideIndex[cid].assignmentGuide = Object.assign({}, courseGuideIndex[cid].assignmentGuide || {}, aggregatedGuides.assignment);
                }
            }
        }

        const isAdminGlobal = requesterRole === "admin";
        const isManagementView = isAdminGlobal || authorizedCourseIds.length > 0;

        const result = {
            role: requesterRole,
            summary: {},
            students: [],
            assignments: [],
            courseGuideIndex,
            unitTutorConfigs,
            myTutorConfigs,
            unitToDocId,
            myReferralLink: null,
            myPromotionCode: null,
            earnings: [],
            myApplications: myApplicationsMapping,
            tutorTerms,
            pendingApplications: allPendingApplications,
            hardwareOrders: [],
            myDistributorId: ""
        };

        result.myDistributorId = normalizeText(
            userData.distributorId ||
            userData.commercial?.distributorId ||
            userData.tutorDistributorId ||
            userData.partnerDistributorId ||
            ""
        ) || "";

        if (isManagementView) {
            try {
                if (requesterRole === "admin" || hasQualifiedTutorStatus(userData)) {
                    const userRef = db.collection("users").doc(uid);
                    result.myPromotionCode = await ensureTutorPromotionCode(db, userRef, userData, uid, email);
                }

                if (data.unitId) {
                    const canonicalId = resolveCanonicalUnitId(data.unitId, lessons);
                    const unitConfig = getEffectiveTutorConfig(canonicalId, myTutorConfigs);
                    if ((unitConfig && unitConfig.authorized) || requesterRole === "admin") {
                        const unitCourse = findLessonByCourseRef(canonicalId, lessons);
                        result.myReferralLink = getTutorAssignmentUrlFromConfig(unitConfig || {}, unitCourse, canonicalId, email, lessons) || null;
                    }
                }

                const ledgerSnap = await db.collection("profit_ledger")
                    .where("tutorEmail", "==", email)
                    .limit(500)
                    .get();

                result.earnings = ledgerSnap.docs
                    .map((doc) => {
                        const row = { id: doc.id, ...doc.data() };
                        row.month = row.month || row.period || "-";
                        return row;
                    })
                    .sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));
            } catch (err) {
                console.error("Error fetching profit data for dashboard:", err);
            }
        }

        let usersMap = {};
        if (isManagementView) {
            let usersSnapshotForMap = usersSnapshot;
            if (requesterRole === "admin" && !data.unitId && !data.courseId) {
                try {
                    const listUsersResult = await admin.auth().listUsers(1000);
                    const authUsers = listUsersResult.users;
                    const existingUids = usersSnapshot.docs.map((doc) => doc.id);
                    const batch = db.batch();
                    let syncCount = 0;

                    for (const au of authUsers) {
                        const userRef = db.collection("users").doc(au.uid);
                        const existingDoc = usersSnapshot.docs.find((d) => d.id === au.uid);
                        const role = existingDoc?.data()?.role || "user";
                        batch.set(userRef, {
                            email: au.email || "",
                            name: au.displayName || fallbackNameFromEmail(au.email || "", "New User"),
                            role,
                            createdAt: au.metadata.creationTime ? new Date(au.metadata.creationTime) : admin.firestore.FieldValue.serverTimestamp(),
                            joinedAt: au.metadata.creationTime ? new Date(au.metadata.creationTime) : admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        syncCount++;
                    }
                    if (syncCount > 0) {
                        await batch.commit();
                        usersSnapshotForMap = await db.collection("users").get();
                    }
                } catch (syncErr) {
                    console.error("[adminGetDashboardData] Internal User Sync failed:", syncErr);
                }
            }

            usersSnapshotForMap.forEach((doc) => {
                const uData = doc.data();
                addDashboardUserEntry(usersMap, doc.id, uData, requesterRole);
            });
        } else {
            const userDocOnly = await db.collection("users").doc(uid).get();
            if (userDocOnly.exists) usersMap[uid] = userDocOnly.data();
        }

        if (Object.keys(usersMap).length === 0) return result;

        let logsQuery = db.collection("activity_logs").limit(5000);
        if (!isManagementView) {
            logsQuery = logsQuery.where("uid", "==", uid);
        }

        const logsSnapshot = await logsQuery.get();
        const studentStats = {};

        logsSnapshot.forEach((doc) => {
            const log = doc.data();
            if (log.action === "PAGE_VIEW") return;

            const sid = log.uid;
            const cid = canonicalCourseId(log.courseId || "unknown");
            const isAuthorizedForLog = (sid === uid) || (requesterRole === "admin") || authorizedCourseIds.includes(cid);

            if (isAuthorizedForLog && usersMap[sid]) {
                if (!studentStats[sid]) {
                    ensureStudentStatsEntry(studentStats, sid, usersMap[sid] || {}, { accountStatus: null });
                }

                const duration = log.duration || 0;
                studentStats[sid].totalTime += duration;
                if (log.action === "VIDEO") studentStats[sid].videoTime += duration;
                if (log.action === "DOC") studentStats[sid].docTime += duration;

                if (!studentStats[sid].lastActive) {
                    studentStats[sid].lastActive = log.timestamp ? log.timestamp.toDate() : null;
                }

                appendCourseProgressActivity(studentStats[sid], cid, log);
            }
        });

        if (isManagementView) {
            try {
                const ordersSnapshot = await db.collection("orders").where("status", "==", "SUCCESS").get();
                ordersSnapshot.forEach((doc) => {
                    const order = doc.data();
                    const sid = order.uid;
                    if (!sid || sid === "GUEST") return;

                    if (usersMap[sid] || studentStats[sid]) {
                        ensureStudentStatsEntry(studentStats, sid, usersMap[sid] || {}, { accountStatus: "paid" });
                    }

                    if (studentStats[sid] && order.items) {
                        if (!studentStats[sid].orderRecords) studentStats[sid].orderRecords = [];
                        studentStats[sid].orderRecords.push(buildStudentOrderRecord(order, doc.id));
                        Object.keys(order.items).forEach((originalCid) => {
                            const cid = canonicalCourseId(originalCid);
                            if (!studentStats[sid].orders.includes(cid)) {
                                studentStats[sid].orders.push(cid);
                            }
                            ensureCourseProgressBucket(studentStats[sid], cid, { isLicenseOnly: true });
                        });
                    }
                });
            } catch (orderErr) {
                console.error("Error fetching orders for dashboard:", orderErr);
            }
        }

        if (!isManagementView) {
            try {
                const myOrdersSnapshot = await db.collection("orders")
                    .where("uid", "==", uid)
                    .where("status", "==", "SUCCESS")
                    .get();

                if (!studentStats[uid] && usersMap[uid]) {
                    ensureStudentStatsEntry(studentStats, uid, usersMap[uid] || {}, { includeOrderRecords: true });
                }

                myOrdersSnapshot.forEach((doc) => {
                    const order = doc.data() || {};
                    studentStats[uid].orderRecords.push(buildStudentOrderRecord(order, doc.id));

                    Object.keys(order.items || {}).forEach((originalCid) => {
                        const cid = canonicalCourseId(originalCid);
                        if (!studentStats[uid].orders) studentStats[uid].orders = [];
                        if (!studentStats[uid].orders.includes(cid)) {
                            studentStats[uid].orders.push(cid);
                        }
                    });
                });
            } catch (myOrderErr) {
                console.error("Error fetching student's own orders for dashboard:", myOrderErr);
            }
        }

        const shouldIncludeAllRegisteredUsers = isManagementView && requesterRole === "admin" && !data.unitId && !data.courseId;
        if (isManagementView) {
            Object.keys(usersMap).forEach((sid) => {
                const userRole = usersMap[sid].role || "user";
                const shouldIncludeUser = shouldIncludeAllRegisteredUsers || userRole === "user" || !userRole;

                if (!studentStats[sid] && shouldIncludeUser) {
                    ensureStudentStatsEntry(studentStats, sid, usersMap[sid] || {}, { accountStatus: "free", includeOrderRecords: true });
                    studentStats[sid].createdAt = usersMap[sid].createdAt || null;
                } else if (studentStats[sid] && !studentStats[sid].createdAt) {
                    studentStats[sid].createdAt = usersMap[sid].createdAt || null;
                }
            });
        }

        const targetUnitId = data.unitId ? resolveCanonicalUnitId(data.unitId, lessons) : null;
        const targetCourseId = data.courseId || null;
        const isTutorModeAdmin = requesterRole === "admin" && data.tutorMode !== false;
        const tutorRelevantEntries = buildStudentsRelevantToTutor({
            usersMap,
            lessons,
            email,
            targetUnitId,
            targetCourseId,
            isTutorModeAdmin
        });

        if (isManagementView && (targetUnitId || targetCourseId || hasQualifiedTutorStatus(userData))) {
            tutorRelevantEntries.forEach(([sid, studentData]) => {
                if (!studentData) return;
                ensureStudentStatsEntry(studentStats, sid, studentData, {
                    accountStatus: studentStats[sid]?.accountStatus ?? "free",
                    includeOrderRecords: !!studentStats[sid]?.orderRecords
                });
                if (studentStats[sid] && !studentStats[sid].createdAt) {
                    studentStats[sid].createdAt = studentData.createdAt || null;
                }
            });
        }

        const filteredStudentStats = [];
        const isAdmin = requesterRole === "admin";

        Object.values(studentStats).forEach((s) => {
            if (isAdmin && !targetUnitId && !targetCourseId) {
                filteredStudentStats.push(s);
                return;
            }

            let isRelevant = false;
            if (targetUnitId) {
                const assignedTutor = normalizeEmail(s.unitAssignments?.[targetUnitId]);
                if (assignedTutor === email || isTutorModeAdmin) {
                    isRelevant = true;
                }
            } else if (targetCourseId) {
                const hasCourseOrder = (s.orders || []).includes(targetCourseId);
                const assignedToAnyInCourse = Object.keys(s.unitAssignments || {}).some((uidKey) => {
                    const parent = findParentCourseIdByUnit(uidKey, lessons);
                    return parent === targetCourseId && (normalizeEmail(s.unitAssignments[uidKey]) === email || isTutorModeAdmin);
                });
                if (hasCourseOrder || assignedToAnyInCourse) isRelevant = true;
            } else {
                const hasAnyAssignmentToMe = Object.values(s.unitAssignments || {}).some((value) => normalizeEmail(value) === email);
                if (hasAnyAssignmentToMe || isTutorModeAdmin) isRelevant = true;
            }

            if (isRelevant) filteredStudentStats.push(s);
        });

        result.students = filteredStudentStats;
        result.tutors = buildTutorList(usersMap);

        let assignQuery = db.collection("assignments");
        if (!isManagementView) {
            assignQuery = assignQuery.where("userId", "==", uid);
        }
        const assignSnapshot = await assignQuery.get();
        assignSnapshot.forEach((doc) => {
            const assignData = doc.data();
            let targetUid = assignData.userId || assignData.uid;
            if (!targetUid && doc.id.includes("_")) {
                targetUid = doc.id.split("_")[0];
            }

            const originalCid = assignData.courseId || "unknown";
            const mappedCid = canonicalCourseId(originalCid);
            const assignmentTutor = assignData.assignedTutorEmail || null;

            const requesterHasTutorAccess = hasQualifiedTutorStatus(userData);
            const isAuthorizedForAssign = isAssignmentAuthorized({
                targetUid,
                uid,
                requesterRole,
                requesterHasTutorAccess,
                assignmentTutor,
                requesterEmail: email,
                mappedCid,
                authorizedCourseIds,
                unitId: assignData.unitId
            });

            if (isAuthorizedForAssign) {
                result.assignments.push(buildDashboardReferenceEntry(usersMap, targetUid, {
                    id: doc.id,
                    ...assignData,
                    userId: targetUid,
                    courseId: mappedCid,
                    unitId: resolveCanonicalUnitId(assignData.unitId, lessons) || assignData.unitId
                }));
            }
        });

        let interventions = [];
        const isTutorOrAdmin = requesterRole === "admin" || hasQualifiedTutorStatus(userData);
        if (isTutorOrAdmin) {
            try {
                const intSnapshot = await db.collection("assignment_interventions").get();
                intSnapshot.forEach((doc) => {
                    const intData = doc.data();
                    const studentUid = intData.studentUid;
                    if (requesterRole !== "admin" && intData.ownerTutorEmail && intData.ownerTutorEmail !== email) {
                        return;
                    }
                    interventions.push(buildDashboardReferenceEntry(usersMap, studentUid, {
                        id: doc.id,
                        ...intData
                    }));
                });
            } catch (intErr) {
                console.warn("[adminGetDashboardData] Failed to fetch assignment_interventions:", intErr.message);
            }
        }
        result.interventions = interventions;
        result.summary = buildDashboardSummary(result.students);

        if (requesterRole === "admin") {
            try {
                const shipmentsSnapshot = await db.collection("orders").where("status", "==", "SUCCESS").get();
                shipmentsSnapshot.forEach((doc) => {
                    const orderData = doc.data();
                    const items = orderData.items || {};
                    const physicalItems = Object.keys(items).filter((id) => isPhysicalOrderItem(id, items[id] || {}, physicalUnitIds));
                    if (physicalItems.length > 0) {
                        const student = usersMap[orderData.uid] || {};
                        const logistics = orderData.logistics || {};
                        const orderRecord = buildOrderRecordSummary({
                            docId: doc.id,
                            uid: orderData.uid,
                            student,
                            data: orderData,
                            logistics,
                            items,
                            physicalItems,
                            lessons,
                            canonicalCourseId
                        });
                        result.hardwareOrders.push(orderRecord);
                    }
                });
                const shipmentSummary = finalizeHardwareOrders(result.hardwareOrders);
                result.hardwareOrders = shipmentSummary.hardwareOrders;
                result.pendingShipments = shipmentSummary.pendingShipments;
                result.pendingShipmentsCount = shipmentSummary.pendingShipmentsCount;
            } catch (shipErr) {
                console.error("Error aggregating shipments:", shipErr);
            }
        }

        if (requesterRole === "admin") {
            try {
                const configDoc = await db.collection("metadata_settings").doc("content_runtime").get();
                if (configDoc.exists) {
                    const cData = configDoc.data() || {};
                    result.contentVersion = cData.contentVersion || "";
                    result.defaultRegion = cData.defaultRegion || "US";
                    result.defaultDistributorId = cData.defaultDistributorId || "default-usd";
                    result.defaultLocale = cData.defaultLocale || "en";
                }
            } catch (err) {
                console.warn("[adminGetDashboardData] Failed to fetch content_runtime version:", err.message);
            }
        }

        result.lessons = lessons.map((lesson) => canonicalizeLessonForDashboard(lesson, lessons));
        return result;
    } catch (error) {
        console.error("Dashboard Data Error:", error);
        throw new HttpsError(error?.code || "internal", error?.message || "Failed to fetch dashboard data.");
    }
});

async function resolveStudentAssignmentAccessAdmin(dbRef, uid, courseId, unitId, lessons = [], tutorMode = false) {
    const normalizedCourseId = normalizeLegacyId(courseId || "");
    const normalizedUnitId = normalizeLegacyId(unitId || "");

    let canonicalUnitId = resolveCanonicalUnitId(normalizedUnitId, lessons);
    const course = findCourseByPageOrUnit(normalizedCourseId, canonicalUnitId, lessons)
        || findCourseByPageOrUnit(normalizedCourseId, normalizedUnitId, lessons);
    const lessonByCourseRef = findLessonByCourseRef(normalizedCourseId, lessons)
        || findLessonByCourseRef(normalizedUnitId, lessons)
        || findLessonByCourseRef(canonicalUnitId, lessons)
        || null;
    const effectiveCourseId = course
        ? (getCanonicalLessonIdentity(course) || course.courseId)
        : (getCanonicalLessonIdentity(lessonByCourseRef) || normalizedCourseId || findParentCourseIdByUnit(canonicalUnitId, lessons));

    if (!canonicalUnitId && course && Array.isArray(course.courseUnits) && course.courseUnits.length > 0) {
        canonicalUnitId = resolveCanonicalUnitId(course.courseUnits[0], lessons);
    }

    const isPhysicalProduct = !!(course && isPhysicalMetadataLesson(course));
    const userDoc = await dbRef.collection("users").doc(uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const isAdminRole = userData.role === "admin";

    const lookupUnitId = canonicalUnitId || normalizedUnitId || "";
    const assignedTutorEmail = userData.unitAssignments?.[lookupUnitId] || null;
    const assignedPromotionCode = userData.unitAssignmentMeta?.[lookupUnitId]?.promotionCode || null;

    if (isPhysicalProduct) {
        console.log(`[resolveAccess] ENFORCING Purchase Flow for Physical Product: ${effectiveCourseId}`);
    } else {
        if (tutorMode && isAdminRole) {
            return {
                authorized: true,
                simulated: true,
                accessMode: "admin_simulated",
                canonicalUnitId,
                effectiveCourseId,
                assignedTutorEmail,
                assignedPromotionCode
            };
        }

        const shouldSkipTutorBypass = isAdminRole && !tutorMode;
        if (!shouldSkipTutorBypass) {
            if (effectiveCourseId && isTutorFullyQualifiedForCourseAdmin(userData, effectiveCourseId, lessons)) {
                return {
                    authorized: true,
                    accessMode: "fully_qualified_tutor",
                    canonicalUnitId,
                    effectiveCourseId,
                    assignedTutorEmail,
                    assignedPromotionCode,
                    course
                };
            }

            if (effectiveCourseId && getUserTutorConfig(userData, canonicalUnitId)?.authorized) {
                return {
                    authorized: true,
                    accessMode: "qualified_tutor",
                    canonicalUnitId,
                    effectiveCourseId,
                    assignedTutorEmail,
                    assignedPromotionCode,
                    course
                };
            }
        }

        const freeCourseContext = course || lessonByCourseRef;
        const lessonPrice = freeCourseContext
            ? Math.max(
                Number(resolveLessonPrice(freeCourseContext, "TWD").amount || 0),
                Number(resolveLessonPrice(freeCourseContext, "USD").amount || 0)
            )
            : Math.max(
                Number(resolveLessonPrice(findLessonByCourseRef(effectiveCourseId, lessons) || {}, "TWD").amount || 0),
                Number(resolveLessonPrice(findLessonByCourseRef(effectiveCourseId, lessons) || {}, "USD").amount || 0)
            ) || 9999;
        const isFreeCourse = !!(freeCourseContext && parseInt(lessonPrice, 10) === 0);
        if (isFreeCourse) {
            return { authorized: true, accessMode: "free_course", canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course: freeCourseContext };
        }

        const isStarterCourseReference = (value = "") => {
            const normalized = String(value || "").trim().toLowerCase();
            return /^start-\d{2}-unit-/.test(normalized) ||
                /^car-starter-/.test(normalized) ||
                /^tw-car-starter-/.test(normalized) ||
                /^en-car-starter-/.test(normalized);
        };
        const starterReference = isStarterCourseReference(courseId) || isStarterCourseReference(unitId);
        const now = Date.now();
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const trialLesson = course || lessonByCourseRef || freeCourseContext || (starterReference ? {
            id: courseId || unitId,
            docId: courseId || unitId,
            courseId: courseId || unitId,
            courseKey: courseId || unitId,
            category: "car-starter",
            level: "starter"
        } : null);
        const registrationCandidates = [userData.createdAt, userData.joinedAt];
        let registeredAtMs = 0;
        for (const value of registrationCandidates) {
            const ts = value?.toMillis
                ? value.toMillis()
                : (value?.seconds ? value.seconds * 1000 : (value ? new Date(value).getTime() : 0));
            if (Number.isFinite(ts) && ts > registeredAtMs) {
                registeredAtMs = ts;
            }
        }
        if (!registeredAtMs) {
            const userRecord = await admin.auth().getUser(uid);
            registeredAtMs = userRecord.metadata.creationTime ? new Date(userRecord.metadata.creationTime).getTime() : 0;
        }
        const starterCategory = String(trialLesson.category || trialLesson.level || "").toLowerCase();
        const isTrialCourse = !!(trialLesson && (
            trialLesson.category === "car-starter" ||
            trialLesson.category === "start" ||
            trialLesson.category === "started" ||
            trialLesson.level === "starter" ||
            starterCategory === "car-starter" ||
            starterCategory === "start" ||
            starterCategory === "started"
        ) && registeredAtMs && ((now - registeredAtMs) < THIRTY_DAYS_MS));
        if (isTrialCourse) {
            return { authorized: true, accessMode: "trial_course", canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course: trialLesson };
        }
    }

    if (!effectiveCourseId) {
        return { authorized: false, reason: "missing-context", canonicalUnitId, effectiveCourseId };
    }

    const ordersSnapshot = await dbRef.collection("orders")
        .where("uid", "==", uid)
        .where("status", "==", "SUCCESS")
        .get();

    const hasPaidCourse = !ordersSnapshot.empty && hasActiveOrderForCourse(ordersSnapshot, effectiveCourseId, lessons, orderNormalizationResolvers);
    if (!hasPaidCourse) {
        return {
            authorized: false,
            reason: "payment-required",
            accessMode: "payment_required",
            canonicalUnitId,
            effectiveCourseId,
            assignedTutorEmail: null,
            course
        };
    }

    return {
        authorized: true,
        accessMode: "paid_student",
        canonicalUnitId,
        effectiveCourseId,
        assignedTutorEmail,
        assignedPromotionCode,
        requiresTutorAssignment: !isPhysicalProduct,
        course
    };
}

exports.adminResolveAssignmentAccess = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const { unitId, courseId, tutorMode, assignmentId } = data || {};
    assertRequiredValue(unitId, "缺少單元 ID");

    const dbRef = admin.firestore();
    const lessons = await getLessonsForAdmin(data?.distributorId || "");
    const access = await resolveStudentAssignmentAccessAdmin(dbRef, auth.uid, courseId, unitId, lessons, tutorMode === true);
    if (!access.authorized) {
        return { authorized: false, reason: access.reason || "forbidden", accessMode: access.accessMode || null };
    }

    const { canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, requiresTutorAssignment, accessMode } = access;

    if (requiresTutorAssignment && !assignedTutorEmail) {
        return {
            authorized: true,
            accessMode,
            classroomUrl: null,
            assignedTutorEmail: null,
            canonicalUnitId,
            courseId: effectiveCourseId,
            requiresTutorAssignment: true
        };
    }

    let assignmentUrl = null;
    let createdVia = "classroom";
    let repositoryUrl = null;
    let feedbackPullRequestUrl = null;

    if (assignedTutorEmail) {
        try {
            const tutorDoc = await findUserDocByEmail(dbRef, assignedTutorEmail);
            const tutorData = tutorDoc ? (tutorDoc.data() || {}) : {};
            const unitConfig = (tutorData.tutorConfigs || {})[canonicalUnitId] || {};
            assignmentUrl = getTutorAssignmentUrlFromConfig(unitConfig, null, canonicalUnitId, assignedTutorEmail) || null;
            if (unitConfig.githubOrg) {
                createdVia = "native-api";
            }

            if (!assignmentUrl && effectiveCourseId) {
                const courseConfig = (tutorData.tutorConfigs || {})[effectiveCourseId] || {};
                assignmentUrl = getTutorAssignmentUrlFromConfig(courseConfig, null, canonicalUnitId, assignedTutorEmail) || null;
                if (courseConfig.githubOrg) {
                    createdVia = "native-api";
                }
            }
        } catch (tutorErr) {
            console.warn(`[resolveAssignmentAccess] Failed to fetch tutor ${assignedTutorEmail} config:`, tutorErr.message);
        }
    }

    if (!assignmentUrl) {
        const course = findLessonByCourseRef(effectiveCourseId, lessons);
        assignmentUrl = getTutorAssignmentUrlFromConfig({}, course, canonicalUnitId, assignedTutorEmail, lessons) || null;
    }

    let personalRepoUrl = null;
    let assignmentDetails = null;
    try {
        let assignmentDoc = null;
        if (assignmentId) {
            const normalizedAssignmentId = (resolveCanonicalUnitId(assignmentId, lessons) || assignmentId).replace(/\.html$/i, "");
            assignmentDoc = await dbRef.collection("assignments").doc(`${auth.uid}_${normalizedAssignmentId}`).get();
        }

        if (!assignmentDoc || !assignmentDoc.exists) {
            const fallbackUnitId = String(canonicalUnitId || unitId || "").replace(/\.html$/i, "");
            if (fallbackUnitId) {
                assignmentDoc = await dbRef.collection("assignments").doc(`${auth.uid}_${fallbackUnitId}`).get();
            }
        }

        if (assignmentDoc && assignmentDoc.exists) {
            const aData = assignmentDoc.data();
            if (aData.createdVia === "native-api") {
                createdVia = "native-api";
                repositoryUrl = aData.repositoryUrl || null;
                feedbackPullRequestUrl = aData.feedbackPullRequestUrl || null;
                personalRepoUrl = aData.repositoryUrl || null;
            } else {
                const existingUrl = aData.assignmentUrl || aData.url;
                if (existingUrl && existingUrl.includes("github.com/") && !existingUrl.includes("classroom.github.com/a/")) {
                    personalRepoUrl = existingUrl;
                }
            }
            assignmentDetails = {
                learningState: aData.learningState || "in_progress",
                latestBlocker: aData.latestBlocker || null,
                hintLevelUsed: aData.hintLevelUsed !== undefined ? aData.hintLevelUsed : null,
                nextAction: aData.nextAction || null,
                attemptSummary: aData.attemptSummary || null,
                grade: aData.grade !== undefined ? aData.grade : null,
                tutorFeedback: aData.tutorFeedback || null
            };
        }
    } catch (e) {
        console.warn("[resolveAssignmentAccess] Failed to lookup personal repo:", e.message);
    }

    let githubUsername = null;
    try {
        const studentDoc = await dbRef.collection("users").doc(auth.uid).get();
        if (studentDoc.exists) {
            githubUsername = studentDoc.data().githubUsername || null;
        }
    } catch (studentErr) {
        console.warn(`[resolveAssignmentAccess] Failed to fetch student ${auth.uid} githubUsername:`, studentErr.message);
    }

    const resolvedAssignmentUrl = personalRepoUrl || assignmentUrl || null;
    return {
        authorized: true,
        accessMode,
        classroomUrl: resolvedAssignmentUrl,
        assignedTutorEmail: assignedTutorEmail || null,
        assignedPromotionCode: assignedPromotionCode || null,
        canonicalUnitId,
        courseId: effectiveCourseId,
        requiresTutorAssignment,
        assignmentDetails,
        githubUsername,
        createdVia,
        repositoryUrl: repositoryUrl || personalRepoUrl || null,
        feedbackPullRequestUrl
    };
});

exports.adminAuthorizeTutorForCourse = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const uid = auth.uid;
    const requesterRole = await getRole(uid);
    assertAdminRole(requesterRole, "僅限管理員");

    const { courseId, tutorEmail, action } = data || {};
    assertRequiredValue(courseId, "缺少必要參數");
    assertRequiredValue(tutorEmail, "缺少必要參數");

    try {
        const lessons = await getLessonsForAdmin(data?.distributorId || "");
        const canonicalCourseId = resolveCanonicalUnitId(courseId, lessons) || courseId;

        if (action === "add") {
            let tutorName = fallbackNameFromEmail(tutorEmail);
            try {
                const tutorDoc = await findUserDocByEmail(admin.firestore(), tutorEmail);
                if (tutorDoc) {
                    tutorName = resolveNameFromUserData(tutorDoc.data() || {}, tutorEmail, "");
                }
            } catch (err) {
                console.log(`[Role] Metadata skip: ${err.message}`);
            }

            try {
                const userRecord = await admin.auth().getUserByEmail(tutorEmail);
                const tutorUid = userRecord.uid;
                await upsertTutorConfigForUser(admin.firestore(), tutorUid, canonicalCourseId, buildTutorConfigEntry({
                    email: tutorEmail,
                    name: tutorName,
                    qualifiedAt: nowIsoTimestamp()
                }));
            } catch (authSyncErr) {
                console.warn(`[Role] Failed to sync user doc for ${tutorEmail}: ${authSyncErr.message}`);
            }

            try {
                const unitMetadata = findLessonByCourseRef(canonicalCourseId, lessons) || lessons.find(l => l.courseUnits && l.courseUnits.includes(canonicalCourseId));
                const unitName = unitMetadata ? (unitMetadata.title || unitMetadata.courseName || canonicalCourseId) : canonicalCourseId;
                const tutorUserRecord = await admin.auth().getUserByEmail(tutorEmail);
                const tutorUid = tutorUserRecord.uid;
                const tutorDoc = await admin.firestore().collection("users").doc(tutorUid).get();
                const tutorData = tutorDoc.exists ? tutorDoc.data() : {};
                const assignmentUrl = getUserTutorConfig(tutorData, canonicalCourseId)?.assignmentUrl || null;
                await sendTutorAuthorizationEmail(tutorEmail, unitName, canonicalCourseId, assignmentUrl);
            } catch (authExtraErr) {
                console.error("[Auth] Failed to generate promo code or send email:", authExtraErr);
            }
        } else if (action === "remove") {
            try {
                const userRecord = await admin.auth().getUserByEmail(tutorEmail);
                const tutorUid = userRecord.uid;
                const updatePatch = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                updatePatch[`tutorConfigs.${canonicalCourseId}`] = admin.firestore.FieldValue.delete();
                await admin.firestore().collection("users").doc(tutorUid).set(updatePatch, { merge: true });
            } catch (authSyncErr) {
                console.warn(`[Role] Failed to sync user doc removal for ${tutorEmail}: ${authSyncErr.message}`);
            }
            return { success: true };
        }
        return { success: true };
    } catch (e) {
        throw new HttpsError("internal", e.message);
    }
});

exports.adminRecommendTutorForUnit = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, "User must be logged in.");

    const requesterRole = await getRole(auth.uid);
    const { assignmentId } = data;
    assertRequiredValue(assignmentId, "Missing assignmentId");

    const dbRef = admin.firestore();
    const lessons = await getLessonsForAdmin(data?.distributorId || "");
    const assignmentRef = dbRef.collection("assignments").doc(assignmentId);
    const assignmentDoc = await assignmentRef.get();
    if (!assignmentDoc.exists) throw new HttpsError("not-found", "Assignment not found");

    const assignment = assignmentDoc.data();
    const candidateUid = assignment.userId;
    const candidateEmail = assignment.userEmail;
    const canonicalUnitId = resolveCanonicalUnitId(assignment.unitId, lessons);
    if (!candidateUid || !candidateEmail || !canonicalUnitId) {
        throw new HttpsError("failed-precondition", "Assignment metadata is incomplete.");
    }
    const autoGradeScore = Number(assignment.autoGrade?.score);
    const recommendationThreshold = 100;
    if (!Number.isFinite(autoGradeScore)) {
        throw new HttpsError("failed-precondition", "Assignment must have a valid auto-grade score before recommendation.");
    }
    if (autoGradeScore < recommendationThreshold) {
        throw new HttpsError("failed-precondition", `Auto-grade score must be >= ${recommendationThreshold} before recommendation.`);
    }

    await assertTutorRecommendationPermission(dbRef, auth, canonicalUnitId, assignment, requesterRole);

    const candidateDoc = await dbRef.collection("users").doc(candidateUid).get();
    const candidateData = candidateDoc.exists ? candidateDoc.data() : {};
    if (getUserTutorConfig(candidateData, canonicalUnitId)?.authorized) {
        throw new HttpsError("already-exists", "Student is already a qualified tutor for this unit.");
    }

    const existingPending = await queryTutorApplications(dbRef, {
        userId: candidateUid,
        unitId: canonicalUnitId,
        statuses: ["pending", "awaiting_candidate_link"],
        limit: 1
    });

    if (!existingPending.empty) {
        const existingStatus = (existingPending.docs[0].data() || {}).status;
        if (existingStatus === "awaiting_candidate_link") {
            throw new HttpsError("already-exists", "Student already has a pending recommendation waiting for the student to submit the assignment link.");
        }
        throw new HttpsError("already-exists", "Student already has a pending application for this unit.");
    }

    const application = buildTutorApplicationRecord({
        userId: candidateUid,
        userEmail: candidateEmail,
        unitId: canonicalUnitId,
        status: "awaiting_candidate_link",
        source: "tutor_recommendation",
        recommendedByUid: auth.uid,
        recommendedByEmail: auth.token.email || "",
        recommendedFromAssignmentId: assignmentId,
        recommendedAt: admin.firestore.FieldValue.serverTimestamp(),
        candidateAssignmentLink: "",
        candidateClassroomInviteUrl: "",
        candidateLinkSubmittedAt: null,
        appliedAt: null
    });

    const newAppRef = await dbRef.collection("tutor_applications").add(application);
    await sendTutorRecommendationCandidateEmail(candidateEmail, canonicalUnitId, auth.token.email || "", newAppRef.id);

    return { success: true, applicationId: newAppRef.id, status: "awaiting_candidate_link" };
});

exports.adminDecideTutorApplication = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, "User must be logged in.");

    const requesterRole = await getRole(auth.uid);
    assertAdminRole(requesterRole, "Only admins can resolve applications.");

    const { applicationId, status, adminMessage } = data || {};
    assertRequiredValue(applicationId, "Invalid parameters");
    if (!["approved", "rejected"].includes(status)) throw new HttpsError("invalid-argument", "Invalid parameters");

    const dbRef = admin.firestore();
    const appRef = dbRef.collection("tutor_applications").doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new HttpsError("not-found", "Pending application not found.");

    const appData = appSnap.data() || {};
    assertTutorApplicationState(appData, { status: "pending" });
    const { userEmail, unitId, userId } = appData;
    const targetUserRef = dbRef.collection("users").doc(userId);
    const targetUserDoc = await targetUserRef.get();
    const userData = targetUserDoc.exists ? (targetUserDoc.data() || {}) : {};

    const lessons = await getLessonsForAdmin(data?.distributorId || "");
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);

    const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (status === "approved") {
        const tutorName = resolveNameFromUserData(userData, userEmail, "");
        const tutorData = buildTutorConfigEntry({
            email: userEmail,
            name: tutorName,
            qualifiedAt: nowIsoTimestamp()
        });

        updateData[new admin.firestore.FieldPath("tutorConfigs", canonicalUnitId)] = tutorData;
    }

    await appRef.update({
        status,
        adminMessage: adminMessage || "",
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedByUid: auth.uid
    });

    const userApplications = upsertTutorApplicationLegacyEntry(
        userData.tutorApplications,
        applicationId,
        {
            userId,
            userEmail,
            unitId: canonicalUnitId,
            source: appData.source || "unknown",
            appliedAt: appData.appliedAt || nowIsoTimestamp()
        },
        {
            status,
            adminMessage: adminMessage || "",
            resolvedAt: nowIsoTimestamp()
        }
    );

    const stillHasPendingSnap = await dbRef.collection("tutor_applications")
        .where("userId", "==", userId)
        .where("status", "==", "pending")
        .limit(1)
        .get();

    await targetUserRef.set({
        ...updateData,
        tutorApplications: userApplications,
        hasPendingApplication: !stillHasPendingSnap.empty
    }, { merge: true });

    await sendApplicationResultEmail(userEmail, canonicalUnitId, status, adminMessage);

    return { success: true };
});

exports.adminApplyForTutorRole = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, "User must be logged in.");

    const { unitId } = data;
    assertRequiredValue(unitId, "Missing unitId");

    const uid = auth.uid;
    const email = auth.token.email || "";
    const lessons = await getLessonsForAdmin(data?.distributorId || "");
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
    const dbRef = admin.firestore();

    const userRef = dbRef.collection("users").doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const tutorConfigs = userData.tutorConfigs || {};
    if (tutorConfigs[canonicalUnitId] && tutorConfigs[canonicalUnitId].authorized) {
        throw new HttpsError("already-exists", "You are already a qualified tutor for this unit.");
    }

    const existingPending = await queryTutorApplications(dbRef, {
        userId: uid,
        unitId: canonicalUnitId,
        statuses: ["pending"],
        limit: 1
    });
    if (!existingPending.empty) {
        throw new HttpsError("already-exists", "You have a pending application for this unit.");
    }

    const application = buildTutorApplicationRecord({
        userId: uid,
        userEmail: email,
        unitId: canonicalUnitId,
        status: "pending",
        source: "self_application"
    });

    const newAppRef = await dbRef.collection("tutor_applications").add({
        ...application,
        appliedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await userRef.set({
        tutorApplications: admin.firestore.FieldValue.arrayUnion(
            buildTutorApplicationLegacyEntry(newAppRef.id, application)
        ),
        hasPendingApplication: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const adminEmail = process.env.ADMIN_EMAIL || "rover.k.chen@gmail.com";
    await sendAdminNewApplicationEmail(adminEmail, email, canonicalUnitId);

    return { success: true, applicationId: newAppRef.id };
});

exports.adminSubmitTutorRecommendationInviteLink = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, "User must be logged in.");

    const { applicationId, assignmentLink, classroomInviteUrl: legacyInviteUrl } = data;
    const candidateAssignmentLink = assignmentLink || legacyInviteUrl || "";
    assertRequiredValue(applicationId, "Missing applicationId or assignmentLink");
    assertRequiredValue(candidateAssignmentLink, "Missing applicationId or assignmentLink");

    const normalizedAssignmentLink = normalizeAssignmentLinkUrl(candidateAssignmentLink);
    if (!isValidAssignmentLinkUrl(normalizedAssignmentLink)) {
        throw new HttpsError("invalid-argument", "作業連結格式不正確，請提供有效的 http/https 連結。");
    }

    const dbRef = admin.firestore();
    const appRef = dbRef.collection("tutor_applications").doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new HttpsError("not-found", "Application not found.");

    const appData = appSnap.data() || {};
    if (appData.userId !== auth.uid) {
        throw new HttpsError("permission-denied", "You can only submit your own application link.");
    }
    assertTutorApplicationState(appData, { source: "tutor_recommendation", status: "awaiting_candidate_link" });

    await appRef.update({
        candidateAssignmentLink: normalizedAssignmentLink,
        candidateClassroomInviteUrl: normalizedAssignmentLink,
        candidateLinkSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
        appliedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const adminEmail = process.env.ADMIN_EMAIL || "rover.k.chen@gmail.com";
    await sendAdminNewApplicationEmail(adminEmail, appData.userEmail || auth.token.email || "", appData.unitId || "");

    return { success: true, status: "pending" };
});
