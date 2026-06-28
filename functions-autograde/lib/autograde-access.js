const admin = require("firebase-admin");

const {
    assertAuthenticated,
    assertRequiredValue,
    loadLessons,
    normalizeEmail,
    normalizeText,
    nowIsoTimestamp
} = require("vibe-functions-core/access-utils-core");
const { normalizeLegacyId } = require("vibe-functions-core/id-utils");
const { hasActiveOrderForCourse, isPhysicalMetadataLesson } = require("vibe-functions-core/order-utils");
const { resolveLessonPrice } = require("./pricing-utils");
const { getUserTutorConfig } = require("vibe-functions-core/tutor-utils");
const {
    findCourseByPageOrUnit,
    findLessonByCourseRef,
    findParentCourseIdByUnit,
    getCanonicalLessonIdentity,
    resolveCanonicalUnitId,
    cleanUnitId,
    getLessonLookupKeys,
    resolveLessonForOrderItem
} = require("../dashboard-utils");
const { HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const orderNormalizationResolvers = {
    resolveLessonForOrderItem,
    resolveCanonicalUnitId,
    findLessonByCourseRef,
    findParentCourseIdByUnit,
    normalizeText,
    cleanUnitId,
    getLessonLookupKeys
};

function assertAdminOrAssignedTutor(isAdmin, isAssignedTutor) {
    if (isAdmin || isAssignedTutor) return;
    throw new HttpsError("permission-denied", "您沒有權限執行此操作。");
}

function isTutorFullyQualifiedForCourse(userData = {}, courseId = "", lessons = []) {
    const tutorConfigs = userData.tutorConfigs || {};
    const lesson = findLessonByCourseRef(courseId, lessons);
    if (!lesson || !Array.isArray(lesson.courseUnits)) return false;

    return lesson.courseUnits.every((unitId) => {
        const canonical = resolveCanonicalUnitId(unitId, lessons);
        const config = getUserTutorConfig({ tutorConfigs }, canonical);
        return !!(config && config.authorized === true);
    });
}

async function resolveStudentAssignmentAccess(db, uid, courseId, unitId, lessons = [], tutorMode = false) {
    const normalizedCourseId = normalizeLegacyId(courseId || "");
    const normalizedUnitId = normalizeLegacyId(unitId || "");

    let canonicalUnitId = resolveCanonicalUnitId(normalizedUnitId, lessons);
    const course = findCourseByPageOrUnit(normalizedCourseId, canonicalUnitId, lessons) || findCourseByPageOrUnit(normalizedCourseId, normalizedUnitId, lessons);
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
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const isAdminRole = userData.role === "admin";

    const lookupUnitId = canonicalUnitId || normalizedUnitId || "";
    const assignedTutorEmail = userData.unitAssignments?.[lookupUnitId] || null;
    const assignedPromotionCode = userData.unitAssignmentMeta?.[lookupUnitId]?.promotionCode || null;

    if (isPhysicalProduct) {
        logger.info(`[resolveAccess] ENFORCING Purchase Flow for Physical Product: ${effectiveCourseId}`);
    } else {
        if (tutorMode && isAdminRole) {
            logger.info(`[resolveAccess] SUCCESS: Admin Simulation Bypass for ${uid}`);
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
            if (effectiveCourseId && isTutorFullyQualifiedForCourse(userData, effectiveCourseId, lessons)) {
                logger.info(`[resolveAccess] SUCCESS: Fully Qualified Tutor Bypass for ${uid} on ${effectiveCourseId}`);
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

            const effectiveTutorCfg = getUserTutorConfig(userData, canonicalUnitId);
            const isQualifiedTutorForThisUnit = !!(effectiveTutorCfg && effectiveTutorCfg.authorized === true);
            if (isQualifiedTutorForThisUnit) {
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

        const now = Date.now();
        const userRecord = await admin.auth().getUser(uid);
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const isTrialCourse = !!(course && (course.category === "start" || course.category === "started") && ((now - new Date(userRecord.metadata.creationTime).getTime()) < THIRTY_DAYS_MS));
        if (isTrialCourse) {
            return { authorized: true, accessMode: "trial_course", canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course };
        }
    }

    if (!effectiveCourseId) {
        logger.warn(`[resolveAccess] FAIL: Missing context for UID:${uid} Page:${courseId} Unit:${unitId}`);
        return { authorized: false, reason: "missing-context", canonicalUnitId, effectiveCourseId };
    }

    const ordersSnapshot = await db.collection("orders")
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

async function resolveSubmissionAccessOrThrow(db, uid, courseId, unitId, lessons = [], tutorMode = false) {
    const access = await resolveStudentAssignmentAccess(db, uid, courseId, unitId, lessons, tutorMode);
    if (!access.authorized) {
        throw new HttpsError("permission-denied", access.reason || "尚未完成此課程付款授權。");
    }
    if (access.requiresTutorAssignment && !access.assignedTutorEmail) {
        throw new HttpsError("failed-precondition", "此單元尚未完成老師指派，暫時無法建立作業紀錄。");
    }
    return access;
}

module.exports = {
    assertAuthenticated,
    assertRequiredValue,
    normalizeText,
    normalizeEmail,
    nowIsoTimestamp,
    loadLessons,
    assertAdminOrAssignedTutor,
    isTutorFullyQualifiedForCourse,
    resolveStudentAssignmentAccess,
    resolveSubmissionAccessOrThrow
};
