"use strict";
const admin = require("firebase-admin");
global.__vibeFirebaseAdmin = admin;
const fs = require("fs");
const path = require("path");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");

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

const { buildI18nFilenameCandidates, unitIdsMatch, normalizeLegacyId } = require("vibe-functions-core/id-utils");
const { getContentRuntimeConfig } = require("vibe-functions-core/runtime-state");
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
    hasAnyQualifiedTutorStatus,
    indexAuthorizedTutorConfigForDashboard,
    queryTutorApplications,
    resolveNameFromUserData,
    resolveAssignmentUrlMaps,
    upsertTutorApplicationLegacyEntry,
    upsertTutorConfigForUser,
    ensureTutorPromotionCode
} = bindLazyExports("vibe-functions-core/tutor-utils", [
    "buildTutorApplicationLegacyEntry",
    "buildTutorApplicationRecord",
    "buildTutorConfigEntry",
    "fallbackNameFromEmail",
    "generatePromotionCode",
    "getEffectiveTutorConfig",
    "getPreferredAssignmentUrl",
    "getUserTutorConfig",
    "hasQualifiedTutorStatus",
    "hasAnyQualifiedTutorStatus",
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
} = bindLazyExports("vibe-functions-core/order-utils", [
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
    "isPhysicalMetadataLesson",
    "isPhysicalOrderItem",
    "itemContainsUnit",
    "normalizeGitHubUrl",
    "normalizeLogisticsData",
    "normalizeOrderItems"
]);




const {
    ensureGithubOrgMembership
} = bindLazyExports("vibe-functions-core/github-utils", [
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
} = require("vibe-functions-core/email-service");
const {
    runPendingAssignmentReminder,
    runPendingShipmentReminder
} = require("./lib/shared-reminders");
const {
    normalizeRoutingRegionCode,
    distributorMatchesRegion,
    collectDistributorRegions,
    chooseRecommendedDistributor
} = require("./lib/routing-utils");
const {
    getUserDistributorScope,
    loadDistributorScopedUsers
} = require("./lib/distributor-utils");
const {
    evaluateDeleteDistributorBlockers
} = require("./lib/delete-distributor-checks");
const {
    isStarterCourseReference,
    resolveRegistrationTimestampMs,
    isAdminEmail,
    lookupAuthUserEmailByUid,
    nowIsoTimestamp
} = require("vibe-functions-core/access-utils-core");
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
    findParentCourseIdByUnit,
    findLessonByCourseRef,
    buildStudentAssignmentTutorRows,
    extractHiddenSectionContent,
    getTutorAssignmentUrlFromConfig
} = require("./dashboard-utils");
const {
    assertAuthenticated,
    assertRequiredValue
} = require("vibe-functions-core/access-utils-core");
const { withAssignmentUrlAliases } = require("vibe-functions-core/dashboard-utils-core");
const {
    getRole,
    assertAdminRole,
    resolveAdminRole,
    syncReferralLink,
    upsertStudentUnitAssignment,
    resolveSubmissionAccessOrThrowAdmin,
    backfillTutorReferralForPaidOrders,
    loadLessonsWithOptionalDistributorOverride,
    assertTutorApplicationState,
    findUserDocByEmail,
    assertTutorRecommendationPermission,
    isTutorFullyQualifiedForCourseAdmin,
    assertDistributorScope,
    getSeedableDistributorProducts,
    getLessonsForAdmin,
    normalizeLessonMetadataPatch,
    loadDistributorPortalOrders,
    loadDistributorPortalTutors,
    loadDistributorPortalSettlement,
    runPendingAssignmentReminderTask,
    runPendingShipmentReminderTask,
    lookupClassroomInviteBindingAdmin,
    resolveStudentAssignmentAccessAdmin
} = require("./lib/admin-utils");
const { getLessonsMetadata, getLearningPathCategoryLabels, getDashboardData } = require("./lib/dashboard-data");


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

const CONTENT_REPO_TOKEN = defineSecret("CONTENT_REPO_TOKEN");

setGlobalOptions({
    region: "asia-east1",
    minInstances: 0,
    memory: 128
});

const getStudentAssignmentTutorReport = onCall(async (request) => {
    const data = request?.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, "請先登入");

    const uid = auth.uid;
    const requesterRole = await getRole(uid, auth?.token?.email || "");
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
            const role = resolveAdminRole(userData, request.auth?.token?.email || "");
            return role !== "admin" && !hasAnyQualifiedTutorStatus(userData);
        }).length,
        rows
    };
});

const assignStudentToTutor = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const uid = auth.uid;
    const requesterRole = await getRole(uid, auth?.token?.email || "");
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
const GITHUB_CLASSROOM_ORG = process.env.GITHUB_CLASSROOM_ORG || "vibe-coding-classroom";
const GITHUB_ORG_ADMIN_TOKEN = process.env.GITHUB_ORG_ADMIN_TOKEN || "";









const bindTutorToUnit = onCall(async (request) => {
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
                logger.info(`[bindTutorToUnit] Cascade-assigned ${uid} -> ${tutorEmail} for ${course.courseUnits.length} units in ${effectiveCourseId}`);
            }
        }

        await backfillTutorReferralForPaidOrders(dbRef, {
            uid,
            unitId: canonicalUnitId,
            tutorEmail,
            assignmentUrl: normalizedLink,
            lessons,
            source: "bindTutorToUnit"
        });

        return { success: true, tutorEmail };
    } catch (error) {
        logger.error("bindTutorToUnit failed:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", error.message);
    }
});

const bindTutorByPromotionCode = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const unitIdRaw = normalizeText(data?.unitId || "");
    const courseIdRaw = normalizeText(data?.courseId || "");
    const promoCodeRaw = normalizeText(data?.promotionCode || "");
    assertRequiredValue(unitIdRaw, "缺少必要參數（unitId）");

    const dbRef = admin.firestore();
    const uid = auth.uid;
    const requesterRole = await getRole(uid, auth?.token?.email || "");

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
            logger.warn(`[bindTutorByPromotionCode] Default tutor selected for ${canonicalUnitId}, but no assignmentUrl was configured. Proceeding without referral link.`);
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
            source: "bindTutorByPromotionCode"
        });

        return {
            success: true,
            tutorEmail,
            tutorName: tutorData.name || tutorEmail,
            promotionCode: resolvedPromotionCode,
            assignmentUrl
        };
    } catch (error) {
        logger.error("bindTutorByPromotionCode failed:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", error.message);
    }
});

// SECURITY (2026-07-15 fix): this was a completely unauthenticated public endpoint
// that returned any user's full Firestore document (PII + tutorConfigs) by email query
// param, defaulting to a hardcoded personal email if none was given. Now requires a
// valid Bearer token (via resolveRestAuth, same helper distributorApi below uses) that
// resolves to an admin, requires an explicit `email` query param (no default), and no
// longer returns the full document — only the `tutorConfigs` field this was actually
// meant to inspect.
const debugTutorAuth = onRequest(async (req, res) => {
    try {
        const auth = await resolveRestAuth(req);
        if (!auth) {
            return res.status(401).json({ error: "unauthenticated" });
        }
        const role = await getRole(auth.uid, auth.token?.email || "");
        if (role !== "admin") {
            return res.status(403).json({ error: "admin role required" });
        }
        const email = normalizeText(req.query.email || "");
        if (!email) {
            return res.status(400).json({ error: "missing required query param: email" });
        }
        const usersSnap = await db.collection("users").where("email", "==", email).get();
        if (usersSnap.empty) return res.status(404).send("User document not found.");
        const doc = usersSnap.docs[0];
        const data = doc.data() || {};
        return res.status(200).json({
            email,
            docId: doc.id,
            tutorConfigs: data.tutorConfigs || {}
        });
    } catch (err) {
        return res.status(500).send(err.message);
    }
});









const updateLessonI18n = onCall(async (request) => {
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
    logger.info(`[updateLessonI18n] Updated i18n fields for courseId=${courseId} by uid=${auth.uid}`);

    return { success: true, courseId };
});

const upsertLessonMetadata = onCall(async (request) => {
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
    logger.info(`[upsertLessonMetadata] Upserted lesson metadata for docId=${patch.docId} by uid=${auth.uid}`);

    return {
        success: true,
        docId: patch.docId
    };
});

const updateSystemConfig = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const role = await getRole(auth.uid);
    assertAdminRole(role);

    const {
        contentVersion,
        defaultRegion,
        defaultDistributorId,
        defaultLocale,
        supportedLocales,
        localeLabels
    } = data || {};
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
    if (supportedLocales !== undefined) {
        updates.supportedLocales = Array.isArray(supportedLocales)
            ? supportedLocales.map((item) => String(item || "").trim()).filter(Boolean)
            : [];
    }
    if (localeLabels !== undefined) {
        updates.localeLabels = localeLabels && typeof localeLabels === "object" && !Array.isArray(localeLabels) ? localeLabels : {};
    }

    if (Object.keys(updates).length > 0) {
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        updates.updatedBy = auth.uid;

        await db.collection("metadata_settings").doc("content_runtime").set(updates, { merge: true });
        logger.info(`[updateSystemConfig] Updated config to ${JSON.stringify(updates)} by uid=${auth.uid}`);

    }

    return { success: true };
});

const getSystemConfig = onCall(async (request) => {
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
        localeLabels: data.localeLabels && typeof data.localeLabels === "object" && !Array.isArray(data.localeLabels) ? data.localeLabels : {}
    };
});

const upsertLessonPricing = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    assertAdminRole(resolveAdminRole(userData, request.auth?.token?.email || ""));

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

    logger.info(`[upsertLessonPricing] Updated default price books for docId=${cleanProductId} by uid=${auth.uid}`);
    return {
        success: true,
        courseId: cleanProductId,
        pricing: { tw, en }
    };
});

async function enrichPriceBooksWithHiddenStatus(db, items) {
    const lessonsSnap = await db.collection("metadata_lessons").get();
    const allLessons = [];
    lessonsSnap.forEach((ds) => {
        const d = ds.data() || {};
        allLessons.push({ ...d, docId: d.docId || ds.id, id: ds.id });
    });
    return items.map((item) => {
        const docId = item.docId || item.sourceDocId || "";
        const lesson = findLessonByDocumentId(allLessons, docId);
        return { ...item, hiddenFromCatalog: lesson ? lesson.hiddenFromCatalog === true : false };
    });
}

// 2026-07-14：抽出成獨立的 core function，讓 onCall（callable，既有前端呼叫端不變）跟
// 新增的 REST 層（onRequest，見本檔案下方 distributorApi）共用同一份邏輯，避免兩邊各寫
//一次、之後又對不上。core function 的參數形狀刻意跟 onCall 的 request.{auth,data} 對齊。
async function getDistributorPriceBooksCore(auth, data) {
    assertAuthenticated(auth);

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const requesterRole = await getRole(auth.uid, auth.token?.email || "");
    const distributorId = normalizeText(data?.distributorId || userData.distributorId || userData.commercial?.distributorId || "");

    if (requesterRole !== "admin") {
        assertRequiredValue(distributorId, "missing-distributor-id");
        assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員查看價格表", auth.token?.email || "");
        const items = await listDistributorPriceBooks(db, distributorId);
        const enriched = await enrichPriceBooksWithHiddenStatus(db, items);
        return { success: true, distributorId, items: enriched };
    }

    if (distributorId) {
        assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員查看價格表", auth.token?.email || "");
        const items = await listDistributorPriceBooks(db, distributorId);
        const enriched = await enrichPriceBooksWithHiddenStatus(db, items);
        return { success: true, distributorId, items: enriched };
    }

    const snap = await db.collection("dealer_price_books").get();
    const items = [];
    snap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...normalizePriceBookDoc(docSnap.data() || {}) });
    });
    items.sort((a, b) => {
        const aKey = `${normalizeText(a.distributorId)}::${normalizeText(a.docId || a.sourceDocId)}::${normalizeText(a.id)}`;
        const bKey = `${normalizeText(b.distributorId)}::${normalizeText(b.docId || b.sourceDocId)}::${normalizeText(b.id)}`;
        return aKey.localeCompare(bKey);
    });
    const enriched = await enrichPriceBooksWithHiddenStatus(db, items);
    return { success: true, distributorId: "", items: enriched };
}

const getDistributorPriceBooks = onCall(async (request) => getDistributorPriceBooksCore(request.auth, request.data));

async function upsertDistributorPriceBookCore(auth, data) {
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
    assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員編輯價格表", auth.token?.email || "");

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
}

const upsertDistributorPriceBook = onCall(async (request) => upsertDistributorPriceBookCore(request.auth, request.data));

const deleteDistributorPriceBook = onCall(async (request) => {
    const { auth, data } = request;
    assertAuthenticated(auth);

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const payload = data || {};

    const distributorId = normalizeText(payload.distributorId || userData.distributorId || userData.commercial?.distributorId || "");
    const priceBookId = normalizeText(payload.priceBookId || "");
    const docId = normalizeText(payload.docId || "");

    assertRequiredValue(distributorId, "missing-distributor-id");
    assertRequiredValue(priceBookId || docId, "missing-pricebook-id");
    assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員刪除價格表", auth.token?.email || "");

    const targetId = priceBookId || `${distributorId}_${docId}`.toLowerCase().replace(/[^a-z0-9_-]/gi, "-");
    await db.collection("dealer_price_books").doc(targetId).delete();

    return { success: true, priceBookId: targetId };
});

const getLessonPriceBooks = onCall(async (request) => {
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

const seedDistributorPriceBooksFromLessons = onCall(async (request) => {
    const { auth, data } = request;
    assertAuthenticated(auth);

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const payload = data || {};

    const distributorId = normalizeText(payload.distributorId || userData.distributorId || userData.commercial?.distributorId || "");
    assertRequiredValue(distributorId, "missing-distributor-id");
    assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員套用商品價格", auth.token?.email || "");

    const distributorDoc = await db.collection("distributors").doc(distributorId).get();
    const distributorData = distributorDoc.exists ? (distributorDoc.data() || {}) : {};
    const distributorCurrency = normalizeText(payload.currency || distributorData.defaultCurrency || userData.defaultCurrency || "TWD").toUpperCase() || "TWD";
    const overwrite = payload.overwrite === true;
    const defaultSalePrice = payload.salePrice != null ? Number(payload.salePrice) : undefined;

    const lessons = await getLessonsForAdmin(distributorId);
    let products = getSeedableDistributorProducts(lessons, distributorCurrency);

    const requestedDocIds = Array.isArray(payload.docIds) ? payload.docIds.map((d) => normalizeText(d)).filter(Boolean) : [];
    if (requestedDocIds.length > 0) {
        products = products.filter((p) => {
            const normalized = normalizeText(p.docId || "");
            return normalized && requestedDocIds.includes(normalized);
        });
    }

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
            salePrice: defaultSalePrice ?? item.salePrice,
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
        skipped,
        requested: requestedDocIds.length > 0 ? requestedDocIds.length : "all"
    };
});

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

// 這一個 core function 同時服務兩個文件裡描述的獨立端點：
// GET /api/checkout/distributor-resolution 跟 GET /api/checkout/distributor-recommendation。
// 實作上這兩個 doc 描述的「路由/推薦」邏輯從一開始就是同一個函式算出來的，response 裡的
// eligibleDistributors 對應 resolution 端點的用途、recommendation 對應 recommendation
// 端點的用途，一次回傳而不是拆兩個 function，見本檔案下方 distributorApi 的路由註解。
const getDistributorRoutingOptions = onCall(async (request) => getDistributorRoutingOptionsCore(request.auth, request.data));

async function resolveDistributorCheckoutQuoteCore(auth, data) {
    assertAuthenticated(auth);
    const dbRef = admin.firestore();
    const payload = data || {};
    const { loadLessons, normalizeText } = require("vibe-functions-core/access-utils-core");
    const { resolveDistributorCheckoutQuote: resolveQuote, findLessonByDocumentId } = require('./lib/distributor-pricing');
    const lessons = await loadLessons(dbRef);
    const normalizedDocId = normalizeText(payload.docId || payload.courseId || payload.itemId || "");
    const matchedLesson =
        findLessonByDocumentId(lessons, normalizedDocId) ||
        findLessonByDocumentId(lessons, `${normalizedDocId}.html`);
    const quote = await resolveQuote(dbRef, {
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

// ============================================================================
// REST API layer — 2026-07-14
//
// docs/distributor/distributor-tutor-api-contract.md 描述的是一組 REST endpoints
// （GET/POST /api/...），但實際前端（distributor-portal.js 等）從頭到尾都是走 Firebase
// httpsCallable，從來沒有真的存在過對應的 REST 路徑，文件跟實作對不上。
//
// 這裡補上文件描述的 REST 路徑，但刻意不動任何既有 callable：兩者都呼叫同一份
// xxxCore(auth, data) 邏輯（見上面每個 core function），callable 前端呼叫端完全不用改。
//
// 已對齊文件、確實可用的路徑：
//   GET/POST /api/admin/distributors/:distributorId/price-books
//   GET      /api/checkout/distributor-resolution
//   GET      /api/checkout/distributor-recommendation
//   PATCH    /api/users/me/distributor-preference
//   POST     /api/checkout/quote
//
// 文件裡另外兩個 endpoint 刻意沒有實作，因為找不到（或不安全直接曝光）對應的既有邏輯，
// 不是漏做，是查證後判斷不該在這裡順手補：
//   POST /api/admin/settlements/run
//     — 對應的 calculateMonthlySharing()（functions-payment/lib/finance-callables.js）
//       目前完全沒有被任何 onCall/onSchedule 呼叫，是死碼，而且內部會實際觸發
//       distributor commission 撥款。在沒有先跟平台方確認過這段邏輯是否可信、是否
//       該啟用之前，不應該只是為了對齊文件就順手接一個能觸發真實撥款的 REST 入口。
//   GET /api/admin/tutors/:tutorId
//     — 全部程式碼找不到 serviceSplitRuleId 欄位的任何讀寫，文件描述的「tutor профиль +
//       distributor binding 查詢」沒有對應實作；現有的 getTutorConfigs() 語意完全不同
//       （它是查某堂課的授權 tutor 清單，不是查某個 tutorId 的 profile），硬套會回傳
//       錯誤語意的資料，比不做還糟。
//
// 部署細節：Cloud Function 本身叫 distributorApi，靠 firebase.json 的 hosting rewrite
// 把 /api/** 導過來（見 firebase.json "rewrites"），region 跟其他 function 一致用
// asia-east1（setGlobalOptions 已經設好，這裡不用重複指定）。

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
            // 文件裡這個端點的 response 只描述 distributorId/priceBookId/routingReason 三個
            // 欄位，但實作是跟 distributor-recommendation 共用的同一份邏輯（見上面 core
            // function 的註解），回傳內容比文件描述的更完整（eligibleDistributors 等），
            // 這裡不刻意砍成文件那個窄版形狀，保留完整資訊給呼叫端自己取需要的欄位。
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




const logActivity = onCall(async (request) => {
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
        logger.error("Activity Log Error:", error);
        throw new HttpsError("internal", "Failed to log activity.");
    }
});

exports.remindAdminPendingAssignments = onSchedule({
    schedule: "0 9 * * *",
    timeZone: "Asia/Taipei"
}, async () => {
    try {
        await runPendingAssignmentReminderTask();
    } catch (error) {
        logger.error("Error in remindAdminPendingAssignments:", error);
    }
});

exports.remindAdminPendingShipments = onSchedule({
    schedule: "30 9 * * *",
    timeZone: "Asia/Taipei"
}, async () => {
    try {
        await runPendingShipmentReminderTask();
    } catch (error) {
        logger.error("Error in remindAdminPendingShipments:", error);
    }
});


const verifyReferralLink = onCall(async (request) => {
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
        logger.error(`[Referral] Error: ${e.message}`);
        throw new HttpsError("internal", e.message);
    }
});

const findClassroomInviteBinding = onCall(async (request) => {
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

const findClassroomInviteBindingHttp = onRequest(async (req, res) => {
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
        logger.error("[findClassroomInviteBindingHttp] failed:", error);
        return res.status(500).json({ error: error.message || "internal error" });
    }
});

const precheckGithubClassroomAccess = onCall(async (request) => {
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
        logger.error("[precheckGithubClassroomAccess] failed:", error);
        return {
            success: false,
            precheckEnabled: true,
            state: "error",
            message: error.message || "precheck failed",
            settingsUrl: "https://github.com/settings/organizations"
        };
    }
});

const setUserRole = onCall(async (request) => {
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


const updateUserRelationships = onCall(async (request) => {
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
    logger.info(`[updateUserRelationships] ✅ Updated user relationships for targetUid=${targetUid} by uid=${auth.uid}`);

    return { success: true };
});

const getUserRelationships = onCall(async (request) => {
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

const saveTutorConfigs = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, "User must be logged in.");

    const uid = auth.uid;
    const email = auth.token?.email || "";
    const role = await getRole(uid, auth?.token?.email || "");
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
        logger.info(`[saveTutorConfigs] Admin ${email} saving configs to users collection...`);
    }

    if (unitIds.length > 0) {
        logger.info(`[saveTutorConfigs] Syncing assignment URLs to user documents for ${courseId}...`);
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
                    logger.info(`[saveTutorConfigs] ✅ Synced ${unitId} (from ${rawUnitId}) for ${tEmail}`);
                } catch (err) {
                    logger.warn(`[saveTutorConfigs] Failed to sync ${tEmail} for ${unitId}: ${err.message}`);
                }
            }
        }
    }

    if (configs.tutorConfigs) {
        logger.info("[saveTutorConfigs] Syncing custom tutorConfigs to user documents...");
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

                logger.info(`[saveTutorConfigs] ✅ Saved custom config for ${unitId} (from ${rawUnitId}) and tutor ${tEmail}`);
            } catch (err) {
                logger.warn(`[saveTutorConfigs] Failed to save custom config for ${tEmail} on ${unitId}: ${err.message}`);
            }
        }
    }

    return { success: true, message: "Configs saved and synced to user documents." };
});

const getTutorConfigs = onCall(async (request) => {
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

async function fetchExternalCourseContentHelper(candidateFileName, runtimeConfig, locales) {
    if (!runtimeConfig?.enabled) return null;
    const contentRepoToken = CONTENT_REPO_TOKEN.value();
    if (!contentRepoToken) {
        logger.warn("[content-runtime] CONTENT_REPO_TOKEN missing, skip external fetch.");
        return null;
    }

    const repoOwner = runtimeConfig.repoOwner;
    const repoName = runtimeConfig.repoName;
    const ref = runtimeConfig.contentVersion || "main";

    for (const locale of locales) {
        const localeCandidates = buildI18nFilenameCandidates(candidateFileName, locale);
        for (const localeCandidate of localeCandidates) {
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
                return { content, source: "external", locale, file: localeCandidate };
            } catch (err) {
                logger.warn(`[content-runtime] external fetch failed for ${contentPath}:`, err.message || err);
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






const resolveAssignmentAccess = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const { unitId, courseId, docId, tutorMode, assignmentId } = data || {};
    assertRequiredValue(unitId || docId, "缺少單元 ID");

    const dbRef = admin.firestore();
    const lessons = await getLessonsForAdmin(data?.distributorId || "");
    const access = await resolveStudentAssignmentAccessAdmin(
        dbRef,
        auth.uid,
        courseId || docId,
        unitId || docId,
        lessons,
        tutorMode === true
    );
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
            logger.warn(`[resolveAssignmentAccess] Failed to fetch tutor ${assignedTutorEmail} config:`, tutorErr.message);
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
        logger.warn("[resolveAssignmentAccess] Failed to lookup personal repo:", e.message);
    }

    let githubUsername = null;
    try {
        const studentDoc = await dbRef.collection("users").doc(auth.uid).get();
        if (studentDoc.exists) {
            githubUsername = studentDoc.data().githubUsername || null;
        }
    } catch (studentErr) {
        logger.warn(`[resolveAssignmentAccess] Failed to fetch student ${auth.uid} githubUsername:`, studentErr.message);
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

const authorizeTutorForCourse = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const uid = auth.uid;
    const requesterRole = await getRole(uid, auth?.token?.email || "");
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
                logger.info(`[Role] Metadata skip: ${err.message}`);
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
                logger.warn(`[Role] Failed to sync user doc for ${tutorEmail}: ${authSyncErr.message}`);
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
                logger.error("[Auth] Failed to generate promo code or send email:", authExtraErr);
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
                logger.warn(`[Role] Failed to sync user doc removal for ${tutorEmail}: ${authSyncErr.message}`);
            }
            return { success: true };
        }
        return { success: true };
    } catch (e) {
        throw new HttpsError("internal", e.message);
    }
});

const recommendTutorForUnit = onCall(async (request) => {
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

const decideTutorApplication = onCall(async (request) => {
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

const applyForTutorRole = onCall(async (request) => {
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

const submitTutorRecommendationInviteLink = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, "User must be logged in.");

    const { applicationId, assignmentLink, classroomInviteUrl: legacyInviteUrl } = data;
    const candidateAssignmentLink = assignmentLink || legacyInviteUrl || "";
    assertRequiredValue(applicationId, "Missing applicationId or assignmentLink");
    assertRequiredValue(candidateAssignmentLink, "Missing applicationId or assignmentLink");

    const normalizedAssignmentLink = normalizeText(candidateAssignmentLink);
    try {
        const parsed = new URL(normalizedAssignmentLink);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("invalid-assignment-link");
        }
    } catch (_) {
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

exports.getLessonsMetadata = getLessonsMetadata;
exports.getLearningPathCategoryLabels = getLearningPathCategoryLabels;
exports.getDashboardData = getDashboardData;
exports.updateSystemConfig = updateSystemConfig;
exports.getSystemConfig = getSystemConfig;
exports.getDistributorRoutingOptions = getDistributorRoutingOptions;
exports.resolveDistributorCheckoutQuote = resolveDistributorCheckoutQuoteFn;
exports.getDistributorPriceBooks = getDistributorPriceBooks;
exports.getLessonPriceBooks = getLessonPriceBooks;
exports.upsertDistributor = upsertDistributor;
exports.deleteDistributor = deleteDistributor;
exports.assignDistributorOperator = assignDistributorOperator;
exports.getDistributorPortalData = getDistributorPortalData;
exports.logActivity = logActivity;
exports.saveTutorConfigs = saveTutorConfigs;
exports.getTutorConfigs = getTutorConfigs;
exports.resolveAssignmentAccess = resolveAssignmentAccess;
exports.getStudentAssignmentTutorReport = getStudentAssignmentTutorReport;
exports.assignStudentToTutor = assignStudentToTutor;
exports.bindTutorToUnit = bindTutorToUnit;
exports.bindTutorByPromotionCode = bindTutorByPromotionCode;
exports.updateLessonI18n = updateLessonI18n;
exports.upsertLessonMetadata = upsertLessonMetadata;
exports.upsertLessonPricing = upsertLessonPricing;
exports.upsertDistributorPriceBook = upsertDistributorPriceBook;
exports.deleteDistributorPriceBook = deleteDistributorPriceBook;
exports.seedDistributorPriceBooksFromLessons = seedDistributorPriceBooksFromLessons;
exports.updateUserRoutingPreference = updateUserRoutingPreference;
exports.distributorApi = distributorApi;
exports.findClassroomInviteBinding = findClassroomInviteBinding;
exports.findClassroomInviteBindingHttp = findClassroomInviteBindingHttp;
exports.precheckGithubClassroomAccess = precheckGithubClassroomAccess;
exports.debugTutorAuth = debugTutorAuth;
exports.verifyReferralLink = verifyReferralLink;
exports.setUserRole = setUserRole;
exports.updateUserRelationships = updateUserRelationships;
exports.getUserRelationships = getUserRelationships;
exports.authorizeTutorForCourse = authorizeTutorForCourse;
exports.recommendTutorForUnit = recommendTutorForUnit;
exports.decideTutorApplication = decideTutorApplication;
exports.applyForTutorRole = applyForTutorRole;
exports.submitTutorRecommendationInviteLink = submitTutorRecommendationInviteLink;
