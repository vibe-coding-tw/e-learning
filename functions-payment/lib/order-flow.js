const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const {
    buildReferralLinkDocId,
    extractReferralAssignmentsFromOrder,
    hasActiveOrderForCourse,
    isPhysicalMetadataLesson,
    itemContainsUnit
} = require("vibe-functions-core/order-utils");
const {
    normalizeEmail
} = require("vibe-functions-core/tutor-utils");
const {
    normalizeText,
    getLessonLookupKeys,
    getCanonicalLessonIdentity,
    findLessonByCourseRef,
    resolveLessonForOrderItem,
    cleanUnitId,
    findParentCourseIdByUnit,
    getLessons
} = require("./content-runtime");
const { resolveLessonPrice } = require("../lib/pricing-utils");
const {
    isStarterCourseCategory,
    isStarterCourseReference,
    resolveRegistrationTimestampMs
} = require("vibe-functions-core/access-utils-core");
const {
    loadUserProfile,
    isQualifiedTutorUser
} = require("./payment-core");
const {
    recordLedgerEvent
} = require("../lib/ledger-engine");
const {
    recordInvestorFinanceEvent
} = require("vibe-functions-core/investor-ledger");

async function syncUserPurchaseCacheFromOrder(db, orderId, orderData = {}, lessons = []) {
    const uid = orderData.uid;
    if (!uid || uid === "GUEST") return;

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const items = orderData.items || {};
    let hasStarterAccess = !!userData.hasStarterAccess;

    for (const itemKey of Object.keys(items)) {
        const lesson = resolveLessonForOrderItem(itemKey, lessons);
        if (lesson && !isPhysicalMetadataLesson(lesson)) {
            const lessonId = getCanonicalLessonIdentity(lesson).toLowerCase();
            const category = normalizeText(lesson.category || lesson.level || "").toLowerCase();
            if (lessonId.startsWith("car-starter-") || isStarterCourseCategory(category)) {
                hasStarterAccess = true;
                break;
            }
        }
    }

    const patch = {
        paid: true,
        lastPaidOrderId: orderId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (hasStarterAccess) {
        patch.hasStarterAccess = true;
    }

    await userRef.set(patch, { merge: true });
}

async function checkOrderAccessForUnit(db, uid, courseId, unitId, lessons = [], tutorMode = false, authEmail = "") {
    if (!uid || !courseId || !unitId) {
        return { authorized: false, reason: "missing-context" };
    }

    const lesson = findLessonByCourseRef(courseId, lessons) || findLessonByCourseRef(unitId, lessons);
    const starterReference = isStarterCourseReference(courseId) || isStarterCourseReference(unitId);
    if (!lesson) {
        if (starterReference) {
            // Preserve the trial path even if course metadata lookup lags behind naming changes.
            const fallbackLesson = {
                id: courseId || unitId,
                docId: courseId || unitId,
                courseId: courseId || unitId,
                courseKey: courseId || unitId,
                category: "car-starter",
                level: "starter"
            };
            return checkOrderAccessForUnit(db, uid, fallbackLesson.courseId, fallbackLesson.courseId, [fallbackLesson], tutorMode, authEmail);
        }
        return { authorized: false, reason: "missing-course" };
    }

    const resolvedLessonPrice = resolveLessonPrice(lesson, lesson.dealerCurrency || lesson.currency || "");
    const lessonPrice = resolvedLessonPrice?.hasPriceData === true && Number.isFinite(Number(resolvedLessonPrice.amount))
        ? Number(resolvedLessonPrice.amount)
        : Number.POSITIVE_INFINITY;
    if (lessonPrice <= 0) {
        return { authorized: true, reason: "free-course", accessMode: "free" };
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    let registeredAtMs = resolveRegistrationTimestampMs(userData, uid);
    if (!registeredAtMs) {
        const userRecord = await admin.auth().getUser(uid);
        registeredAtMs = userRecord.metadata.creationTime ? new Date(userRecord.metadata.creationTime).getTime() : 0;
    }
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const lessonId = String(getCanonicalLessonIdentity(lesson) || lesson.courseKey || lesson.courseId || lesson.id || "").toLowerCase();
    const category = String(lesson.category || "").toLowerCase();
    const level = String(lesson.level || "").toLowerCase();
    const isStarterLesson = !!(
        lessonId.startsWith("car-starter-") ||
        isStarterCourseCategory(category) ||
        level === "starter" ||
        isStarterCourseCategory(level)
    );
    console.log("[checkOrderAccessForUnit] trial-debug", {
        uid,
        courseId,
        unitId,
        lessonId,
        category,
        level,
        registeredAtMs,
        ageDays: registeredAtMs ? ((Date.now() - registeredAtMs) / THIRTY_DAYS_MS) : null,
        isStarterLesson
    });
    if (isStarterLesson && registeredAtMs && (Date.now() - registeredAtMs) < THIRTY_DAYS_MS) {
        return { authorized: true, reason: "trial_course", accessMode: "trial_course" };
    }

    const userProfile = await loadUserProfile(uid);
    const authEmailProfile = authEmail ? { email: authEmail } : null;
    const tutorEligible = !!(
        (userProfile && isQualifiedTutorUser(userProfile)) ||
        (authEmailProfile && isQualifiedTutorUser(authEmailProfile))
    );
    if (tutorMode && tutorEligible) {
        return { authorized: true, reason: "qualified-tutor", accessMode: "tutor" };
    }

    const ordersSnap = await db.collection("orders")
        .where("uid", "==", uid)
        .where("status", "==", "SUCCESS")
        .get();

    if (hasActiveOrderForCourse(ordersSnap, courseId, lessons, {
        findLessonByCourseRef,
        resolveCanonicalUnitId: (value) => cleanUnitId(value),
        getLessonLookupKeys,
        itemContainsUnit: (itemKey, allLessons, targetUnitId) => itemContainsUnit(itemKey, allLessons, targetUnitId, {
            resolveCanonicalUnitId: (value) => cleanUnitId(value),
            resolveLessonForOrderItem
        })
    })) {
        return { authorized: true, reason: "active-order", accessMode: "paid" };
    }

    return { authorized: false, reason: "payment-required" };
}

async function activateOrderPermissionsAndNotify(db, orderId, hooks = {}) {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return { ok: false, reason: "missing-order" };

    const orderData = orderSnap.data() || {};
    const items = orderData.items || {};
    const lessons = await getLessons(db, { currencyHint: orderData.currency || "TWD" });

    const validationAlerts = [];
    const activationCheckedItems = [];

    for (const itemKey of Object.keys(items)) {
        const lesson = resolveLessonForOrderItem(itemKey, lessons);
        if (!lesson) {
            validationAlerts.push(`Item '${itemKey}' does not map to any canonical course.`);
            activationCheckedItems.push({ itemKey, status: "missing-course" });
            continue;
        }

        activationCheckedItems.push({
            itemKey,
            courseId: getCanonicalLessonIdentity(lesson) || null,
            courseKey: lesson.courseKey || null,
            isPhysical: isPhysicalMetadataLesson(lesson),
            status: "mapped"
        });

        if (isPhysicalMetadataLesson(lesson)) {
            activationCheckedItems[activationCheckedItems.length - 1].status = "physical-skipped";
            continue;
        }

        if (!Array.isArray(lesson.courseUnits) || lesson.courseUnits.length === 0) {
            validationAlerts.push(`Course '${getCanonicalLessonIdentity(lesson) || lesson.courseId}' has no units defined.`);
            activationCheckedItems[activationCheckedItems.length - 1].status = "missing-units";
            continue;
        }

        const firstUnitId = lesson.courseUnits[0];
        const access = await checkOrderAccessForUnit(
            db,
            orderData.uid,
            getCanonicalLessonIdentity(lesson),
            firstUnitId,
            lessons,
            false,
            orderData.email || ""
        );
        if (!access.authorized) {
            validationAlerts.push(`Student authorization check failed for course '${getCanonicalLessonIdentity(lesson) || lesson.courseId}' / unit '${firstUnitId}': ${access.reason || "unknown"}`);
            activationCheckedItems[activationCheckedItems.length - 1].status = "authorization-failed";
            activationCheckedItems[activationCheckedItems.length - 1].reason = access.reason || "unknown";
        } else {
            activationCheckedItems[activationCheckedItems.length - 1].status = "authorized";
            activationCheckedItems[activationCheckedItems.length - 1].accessMode = access.accessMode || null;
        }
    }

    const alerts = validationAlerts.length > 0 ? validationAlerts : null;
    await orderRef.update({
        activationAlerts: alerts || admin.firestore.FieldValue.delete(),
        activationValidated: true,
        activationValidationFailed: validationAlerts.length > 0,
        activationValidationStatus: validationAlerts.length > 0 ? "failed" : "passed",
        activationCheckedItems,
        activationValidatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    try {
        await syncUserPurchaseCacheFromOrder(db, orderId, orderData, lessons);
    } catch (cacheErr) {
        console.warn(`[payment] purchase cache sync skipped for order ${orderId}:`, cacheErr.message || cacheErr);
    }

    try {
        await recordLedgerEvent({
            db,
            payload: {
                eventType: "order.paid",
                sourceType: "order",
                sourceId: orderId,
                sourceLabel: `Order ${orderId}`,
                entityType: "order",
                entityId: orderId,
                amount: Number(orderData.amount || 0),
                currency: orderData.currency || "TWD",
                occurredAtDate: orderData.paidAt?.toDate ? orderData.paidAt.toDate() : new Date(),
                metadata: {
                    orderId,
                    studentUid: orderData.uid || "",
                    unitIds: Object.keys(items || {}),
                    note: `Auto ledger entry from successful order ${orderId}`
                }
            },
            createdByUid: "system",
            autoGenerateReports: true
        });
    } catch (ledgerErr) {
        console.warn(`[payment] ledger event skipped for order ${orderId}:`, ledgerErr.message || ledgerErr);
    }

    try {
        const investorProfileCache = new Map();
        await recordInvestorFinanceEvent({
            db,
            profileCache: investorProfileCache,
            payload: {
                eventType: "income",
                sourceType: "order",
                sourceId: orderId,
                sourceLabel: `Order ${orderId}`,
                amount: Number(orderData.amount || 0),
                note: `Auto credit from successful order ${orderId}`,
                occurredAtDate: orderData.paidAt?.toDate ? orderData.paidAt.toDate() : new Date()
            },
            createdByUid: "system"
        });
    } catch (investorErr) {
        console.warn(`[payment] investor credit skipped for order ${orderId}:`, investorErr.message || investorErr);
    }

    try {
        const referralAssignments = extractReferralAssignmentsFromOrder(orderData.items || {}, lessons, {
            resolveLessonForOrderItem,
            resolveCanonicalUnitId: (unitId) => cleanUnitId(unitId),
            findLessonByCourseRef,
            findParentCourseIdByUnit,
            normalizeText,
            cleanUnitId,
            getLessonLookupKeys
        });
        for (const assignment of referralAssignments) {
            if (!assignment.referralLink) continue;
            const linkId = buildReferralLinkDocId(assignment.referralLink);
            const referralDoc = await db.collection("referral_links").doc(linkId).get();
            if (!referralDoc.exists) continue;
            const referralData = referralDoc.data() || {};
            const targetUnitId = cleanUnitId(referralData.unitId || "");
            if (!targetUnitId || !assignment.purchasedUnits.includes(targetUnitId) || !referralData.tutorEmail) continue;

            const normalizedTutorEmail = normalizeEmail(referralData.tutorEmail);
            for (const unitId of assignment.purchasedUnits) {
                await db.collection("users").doc(orderData.uid).set({
                    unitAssignments: {
                        [unitId]: normalizedTutorEmail
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        }
    } catch (referralErr) {
        console.warn(`[payment] referral backfill skipped for order ${orderId}:`, referralErr.message || referralErr);
    }

    if (hooks.sendPaymentSuccessEmail) {
        const userEmail = orderData.uid === "GUEST"
            ? ""
            : (await admin.auth().getUser(orderData.uid).catch(() => null))?.email || "";

        if (userEmail) {
            const itemDesc = Object.values(items).map((item) => `${item.name || item.title || "Item"} x${item.quantity || 1}`).join(", ");
            await hooks.sendPaymentSuccessEmail(userEmail, orderId, orderData.amount, itemDesc, Object.keys(items).some((itemKey) => {
                const lesson = resolveLessonForOrderItem(itemKey, lessons);
                return lesson?.isPhysical === true;
            })).catch((err) => {
                console.warn("[payment] sendPaymentSuccessEmail failed:", err.message || err);
            });
        }
    }

    return { ok: true, orderId, validationAlerts, activationCheckedItems };
}

module.exports = {
    syncUserPurchaseCacheFromOrder,
    checkOrderAccessForUnit,
    activateOrderPermissionsAndNotify
};
