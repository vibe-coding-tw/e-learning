"use strict";

const admin = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getRole, assertAdminRole, resolveAdminRole, loadLessonsWithOptionalDistributorOverride, upsertStudentUnitAssignment, resolveSubmissionAccessOrThrowAdmin, backfillTutorReferralForPaidOrders, findUserDocByEmail, getLessonsForAdmin, isTutorFullyQualifiedForCourseAdmin, lookupClassroomInviteBindingAdmin, resolveStudentAssignmentAccessAdmin } = require("./admin-utils");
const { normalizeText, normalizeEmail, resolveCanonicalUnitId, findParentCourseIdByUnit, findLessonByCourseRef, getTutorAssignmentUrlFromConfig, buildStudentAssignmentTutorRows } = require("../dashboard-utils");
const { assertAuthenticated, assertRequiredValue, normalizeGitHubUrl, ensureGithubOrgMembership } = require("vibe-functions-core/access-utils-core");
const { buildReferralLinkDocId } = require("vibe-functions-core/order-utils");
const { getUserTutorConfig, ensureTutorPromotionCode, hasAnyQualifiedTutorStatus, resolveNameFromUserData, fallbackNameFromEmail, buildTutorConfigEntry } = require("vibe-functions-core/tutor-utils");
const { isAssignmentAuthorized } = require("./assignment-flow");
const { normalizeRoutingRegionCode, distributorMatchesRegion } = require("./routing-utils");

const GITHUB_CLASSROOM_ORG = process.env.GITHUB_CLASSROOM_ORG || "vibe-coding-classroom";
const GITHUB_ORG_ADMIN_TOKEN = process.env.GITHUB_ORG_ADMIN_TOKEN || "";
const db = admin.firestore();

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

module.exports = {
    getStudentAssignmentTutorReport,
    assignStudentToTutor,
    bindTutorToUnit,
    bindTutorByPromotionCode,
    resolveAssignmentAccess,
    verifyReferralLink,
    findClassroomInviteBinding,
    findClassroomInviteBindingHttp,
    precheckGithubClassroomAccess
};
