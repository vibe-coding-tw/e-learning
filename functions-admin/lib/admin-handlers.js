"use strict";

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { getRole, assertAdminRole, normalizeLessonMetadataPatch, runPendingAssignmentReminderTask, runPendingShipmentReminderTask } = require("./admin-utils");
const { normalizeText, normalizeEmail } = require("../dashboard-utils");
const { assertAuthenticated, assertRequiredValue } = require("vibe-functions-core/access-utils-core");

const db = admin.firestore();

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

const remindAdminPendingAssignments = onSchedule({
    schedule: "0 9 * * *",
    timeZone: "Asia/Taipei"
}, async () => {
    try {
        await runPendingAssignmentReminderTask();
    } catch (error) {
        logger.error("Error in remindAdminPendingAssignments:", error);
    }
});

const remindAdminPendingShipments = onSchedule({
    schedule: "30 9 * * *",
    timeZone: "Asia/Taipei"
}, async () => {
    try {
        await runPendingShipmentReminderTask();
    } catch (error) {
        logger.error("Error in remindAdminPendingShipments:", error);
    }
});

module.exports = {
    updateSystemConfig,
    getSystemConfig,
    updateLessonI18n,
    upsertLessonMetadata,
    logActivity,
    setUserRole,
    updateUserRelationships,
    getUserRelationships,
    remindAdminPendingAssignments,
    remindAdminPendingShipments
};
