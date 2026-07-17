"use strict";
const admin = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getRole, assertAdminRole, loadLessonsWithOptionalDistributorOverride, findUserDocByEmail, assertTutorApplicationState, assertTutorRecommendationPermission, isTutorFullyQualifiedForCourseAdmin, resolveAdminRole, syncReferralLink, getLessonsForAdmin } = require("./admin-utils");
const { normalizeText, normalizeEmail, resolveCanonicalUnitId, findParentCourseIdByUnit, findLessonByCourseRef, getTutorAssignmentUrlFromConfig } = require("../dashboard-utils");
const { assertAuthenticated, assertRequiredValue, nowIsoTimestamp } = require("vibe-functions-core/access-utils-core");
const { buildTutorConfigEntry, buildTutorApplicationRecord, buildTutorApplicationLegacyEntry, getUserTutorConfig, getPreferredAssignmentUrl, hasQualifiedTutorStatus, queryTutorApplications, resolveNameFromUserData, resolveAssignmentUrlMaps, upsertTutorApplicationLegacyEntry, upsertTutorConfigForUser, fallbackNameFromEmail } = require("vibe-functions-core/tutor-utils");
const { sendTutorAuthorizationEmail, sendAdminNewApplicationEmail, sendApplicationResultEmail, sendTutorRecommendationCandidateEmail } = require("vibe-functions-core/email-service");

const db = admin.firestore();

async function resolveRestAuth(req) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return null;
    const idToken = authHeader.slice(7).trim();
    if (!idToken) return null;
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        return { uid: decoded.uid, token: decoded };
    } catch (error) {
        logger.warn("[debugTutorAuth] invalid bearer token:", error.message || error);
        return null;
    }
}

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

    const lessons = await getLessonsForAdmin(data?.distributorId || "");
    const assignmentRef = db.collection("assignments").doc(assignmentId);
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

    await assertTutorRecommendationPermission(db, auth, canonicalUnitId, assignment, requesterRole);

    const candidateDoc = await db.collection("users").doc(candidateUid).get();
    const candidateData = candidateDoc.exists ? candidateDoc.data() : {};
    if (getUserTutorConfig(candidateData, canonicalUnitId)?.authorized) {
        throw new HttpsError("already-exists", "Student is already a qualified tutor for this unit.");
    }

    const existingPending = await queryTutorApplications(db, {
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

    const newAppRef = await db.collection("tutor_applications").add(application);
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

    const appRef = db.collection("tutor_applications").doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new HttpsError("not-found", "Pending application not found.");

    const appData = appSnap.data() || {};
    assertTutorApplicationState(appData, { status: "pending" });
    const { userEmail, unitId, userId } = appData;
    const targetUserRef = db.collection("users").doc(userId);
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

    const stillHasPendingSnap = await db.collection("tutor_applications")
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

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const tutorConfigs = userData.tutorConfigs || {};
    if (tutorConfigs[canonicalUnitId] && tutorConfigs[canonicalUnitId].authorized) {
        throw new HttpsError("already-exists", "You are already a qualified tutor for this unit.");
    }

    const existingPending = await queryTutorApplications(db, {
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

    const newAppRef = await db.collection("tutor_applications").add({
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

    const appRef = db.collection("tutor_applications").doc(applicationId);
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

module.exports = {
    debugTutorAuth,
    saveTutorConfigs,
    getTutorConfigs,
    authorizeTutorForCourse,
    recommendTutorForUnit,
    decideTutorApplication,
    applyForTutorRole,
    submitTutorRecommendationInviteLink
};
