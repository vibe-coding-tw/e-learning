"use strict";
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { buildI18nFilenameCandidates, unitIdsMatch } = require("vibe-functions-core/id-utils");
const { getContentRuntimeConfig } = require("vibe-functions-core/runtime-state");
const { normalizeText, normalizeEmail, normalizeCourseFile, resolveCanonicalUnitId, findCourseByPageOrUnit, findCourseByUnitId, findLessonByCourseRef, findParentCourseIdByUnit, canonicalizeLessonForDashboard, ensureStudentStatsEntry, ensureCourseProgressBucket, appendCourseProgressActivity, buildDashboardReferenceEntry, addDashboardUserEntry, buildTutorList, buildStudentAssignmentTutorRows, buildDashboardSummary, finalizeHardwareOrders, extractHiddenSectionContent, getTutorAssignmentUrlFromConfig } = require("../dashboard-utils");
const { getRole, assertAdminRole, resolveAdminRole, loadLessonsWithOptionalDistributorOverride, buildStudentsRelevantToTutor, hasActiveOrderForCourseSnapshot, resolveStudentAssignmentAccessAdmin, orderNormalizationResolvers, getDb } = require("./admin-utils");
const { getPhysicalUnitIdSet, isPhysicalOrderItem, buildOrderRecordSummary, buildStudentOrderRecord, hasActiveOrderForCourse } = require("vibe-functions-core/order-utils");
const { isAdminEmail, assertAuthenticated } = require("vibe-functions-core/access-utils-core");
const { hasQualifiedTutorStatus, hasAnyQualifiedTutorStatus, hasAnyQualifiedTutorStatus: hasAnyTutorStatus, getEffectiveTutorConfig, ensureTutorPromotionCode, indexAuthorizedTutorConfigForDashboard, fallbackNameFromEmail, resolveNameFromUserData, getUserTutorConfig, buildTutorConfigEntry, queryTutorApplications, upsertTutorApplicationLegacyEntry } = require("vibe-functions-core/tutor-utils");
const { resolveLessonPrice } = require("./distributor-pricing");
const { isAssignmentAuthorized } = require("./assignment-flow");

const logger = require("firebase-functions/logger");

const CONTENT_REPO_TOKEN = defineSecret("CONTENT_REPO_TOKEN");

function normalizeLearningPathCategoryLabels(sourceMap = {}) {
    const normalizeCanonicalLearningPathKeyLocal = (value = "") => {
        const v = String(value || "").trim().toLowerCase().split("/").pop().split("?")[0].split("#")[0].replace(/\.html$/i, "");
        if (!v) return "";
        if (v === "common" || v === "car-starter" || v === "car-basic" || v === "car-advanced") return v;
        if (/^(?:tw|en)-common$/i.test(v)) return "common";
        if (/^(?:tw|en)-car-(starter|basic|advanced)$/i.test(v)) return v.replace(/^(?:tw|en)-/i, "");
        if (/^(?:tw|en)-drone-(starter|basic|advanced)$/i.test(v)) return v.replace(/^(?:tw|en)-/i, "");
        if (/^drone-(starter|basic|advanced)$/i.test(v)) return v;
        if (/^start-\d{2}-unit-/i.test(v)) return "car-starter";
        if (/^basic-\d{2}-unit-/i.test(v)) return "car-basic";
        if (/^(?:adv|advanced)-\d{2}-unit-/i.test(v)) return "car-advanced";
        if (/^\d{2}-unit-/i.test(v)) return "common";
        if (/^prepare-\d+/i.test(v)) return "common";
        return v;
    };
    const normalizeLearningPathCategoryLabelEntryLocal = (value = {}) => {
        if (typeof value === "string") {
            return { "zh-TW": String(value || "").trim(), en: "" };
        }
        if (!value || typeof value !== "object" || Array.isArray(value)) return {};
        const zh = String(value["zh-TW"] || value.zhTW || value.zh || value.tw || value.labelZh || value.twLabel || value.label || value.title || "").trim();
        const en = String(value.en || value["en-US"] || value.labelEn || value.titleEn || "").trim();
        const enOnly = String(value.enOnly || value["en-only"] || "").trim();
        return { "zh-TW": zh, en, enOnly };
    };
    if (!sourceMap || typeof sourceMap !== "object") return {};
    const normalized = {};
    for (const [rawKey, value] of Object.entries(sourceMap)) {
        const key = normalizeCanonicalLearningPathKeyLocal(rawKey);
        if (key) normalized[key] = normalizeLearningPathCategoryLabelEntryLocal(value);
    }
    return normalized;
}

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
                    headers: { "Authorization": `Bearer ${contentRepoToken}`, "Accept": "application/vnd.github+json", "User-Agent": "vibe-coding-runtime" }
                });
                if (!resp.ok) continue;
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
    const privateCoursesDir = path.join(__dirname, "..", "private_courses");
    const course = findLessonByCourseRef(courseId || unitId || "", lessons);
    if (!course) return {};
    const entryUnitId = normalizeCourseFile(Array.isArray(course.courseUnits) ? course.courseUnits[0] : "");
    const legacyLessonUrl = course.classroomUrl || "";
    const assignmentFile = normalizeCourseFile(legacyLessonUrl);
    const units = Array.isArray(course.courseUnits) ? [...course.courseUnits] : [];
    const relatedFiles = Array.from(new Set([entryUnitId, ...units, (assignmentFile && assignmentFile.endsWith(".html")) ? assignmentFile : ""].filter(Boolean)));
    const aggregatedGuides = {};
    for (const file of relatedFiles) {
        let html = "";
        let source = "none";
        const runtimeConfig = await getContentRuntimeConfig(getDb());
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
                    if (matched) { localFile = matched; break; }
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

exports.getLessonsMetadata = onCall({ region: "asia-east1" }, async (request) => {
    try {
        const data = request?.data || {};
        const requestedDistributorId = normalizeText(data.distributorId || "");
        let distributorId = requestedDistributorId;
        if (!distributorId && request.auth?.uid) {
            try {
                const userDoc = await getDb().collection("users").doc(request.auth.uid).get();
                const userData = userDoc.exists ? (userDoc.data() || {}) : {};
                distributorId = normalizeText(userData.preferredDistributorId || userData.distributorId || userData.commercial?.distributorId || "");
            } catch (err) {
                logger.warn("[getLessonsMetadata] failed to resolve user distributor:", err.message || err);
            }
        }
        distributorId = distributorId || "default-usd";
        const lessons = await loadLessonsWithOptionalDistributorOverride(distributorId);
        const settingsSnap = await getDb().collection("metadata_settings").doc("learning_paths").get();
        const rawCategoryLabels = settingsSnap.exists ? ((settingsSnap.data() || {}).categoryLabels || {}) : {};
        const categoryLabels = normalizeLearningPathCategoryLabels(rawCategoryLabels);
        return { lessons, distributorId, categoryLabels };
    } catch (err) {
        logger.error("[admin/getLessonsMetadata] failed:", err);
        throw new HttpsError("internal", err.message || "Failed to load lessons metadata");
    }
});

exports.getLearningPathCategoryLabels = onCall({ region: "asia-east1" }, async () => {
    try {
        const settingsSnap = await getDb().collection("metadata_settings").doc("learning_paths").get();
        const rawCategoryLabels = settingsSnap.exists ? ((settingsSnap.data() || {}).categoryLabels || {}) : {};
        const categoryLabels = normalizeLearningPathCategoryLabels(rawCategoryLabels);
        return { categoryLabels };
    } catch (err) {
        logger.error("[admin/getLearningPathCategoryLabels] failed:", err);
        throw new HttpsError("internal", err.message || "Failed to load learning path category labels");
    }
});

exports.getDashboardData = onCall({ region: "asia-east1", secrets: [CONTENT_REPO_TOKEN] }, async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, "User must be logged in.");
    const uid = auth.uid;
    const email = normalizeEmail(auth.token.email || "");
    const requesterRole = await getRole(uid, auth?.token?.email || "");
    const lessons = await loadLessonsWithOptionalDistributorOverride(data.distributorId || "");
    const physicalUnitIds = getPhysicalUnitIdSet(lessons);
    if (!data.unitId && !data.courseId && requesterRole !== "admin" && !(typeof isAdminEmail === "function" && isAdminEmail(email))) {
        throw new HttpsError("permission-denied", "You must specify a unitId or courseId to view your dashboard.");
    }
    const canonicalCourseId = (value) => String(value || "");
    try {
        const authorizedCourseIds = [];
        const courseGuideIndex = {};
        const unitTutorConfigs = {};
        const unitToDocId = {};
        const myApplicationsMapping = {};
        const userDoc = await getDb().collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        try {
            const myAppsSnapshot = await queryTutorApplications(getDb(), { userId: uid, limit: 100 });
            myAppsSnapshot.forEach((doc) => {
                const app = doc.data() || {};
                if (!app.unitId || myApplicationsMapping[app.unitId]) return;
                myApplicationsMapping[app.unitId] = { status: app.status, appliedAt: app.appliedAt, applicationId: doc.id };
            });
        } catch (appErr) {
            logger.warn("[getDashboardData] Failed to fetch user applications:", appErr.message);
        }
        const myTutorConfigs = userData.tutorConfigs || {};
        let tutorTerms = "";
        try {
            const termsDoc = await getDb().collection("metadata_settings").doc("tutor_terms").get();
            tutorTerms = termsDoc.exists ? (termsDoc.data().content || "") : "尚未設定合格教師權利義務細則。";
        } catch (e) {
            logger.warn("[getDashboardData] Failed to fetch tutor terms:", e);
        }
        let allPendingApplications = [];
        if (requesterRole === "admin" && data.tutorMode !== false) {
            const pendingAppsSnapshot = await queryTutorApplications(getDb(), { statuses: ["pending"], limit: 1000 });
            pendingAppsSnapshot.forEach((doc) => {
                const app = doc.data() || {};
                allPendingApplications.push({ id: doc.id, applicationId: doc.id, ...app });
            });
            allPendingApplications.sort((a, b) => {
                const timeA = a.appliedAt?.toMillis ? a.appliedAt.toMillis() : (new Date(a.appliedAt || 0).getTime() || 0);
                const timeB = b.appliedAt?.toMillis ? b.appliedAt.toMillis() : (new Date(b.appliedAt || 0).getTime() || 0);
                return timeB - timeA;
            });
        }
        const usersSnapshot = await getDb().collection("users").get();
        const synthesizedConfigs = {};
        usersSnapshot.forEach((doc) => {
            const uData = doc.data();
            const userEmail = uData.email;
            const tutorConfigs = uData.tutorConfigs || {};
            for (const [unitId, config] of Object.entries(tutorConfigs)) {
                indexAuthorizedTutorConfigForDashboard({
                    uData, email: userEmail, unitId, config, lessons, synthesizedConfigs,
                    unitTutorConfigs, unitToDocId, authorizedCourseIds,
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
                            if (unitIdsMatch(candidateUnit, unitId)) equivalentUnits.push(candidateUnit);
                        });
                        equivalentUnits.forEach((candidateUnit) => {
                            if (!candidateUnit) return;
                            const existingDocId = unitToDocId[candidateUnit];
                            if (!existingDocId || !existingDocId.includes(".html")) unitToDocId[candidateUnit] = docId;
                        });
                    });
                }
                if (docId.includes(".html")) {
                    unitToDocId[docId] = docId;
                    const parentCourse = findCourseByUnitId(docId, lessons);
                    (Array.isArray(parentCourse?.courseUnits) ? parentCourse.courseUnits : []).forEach((candidateUnit) => {
                        if (unitIdsMatch(candidateUnit, docId)) unitToDocId[candidateUnit] = docId;
                    });
                }
                if (isAuthorized) {
                    if (docId.includes(".html")) {
                        const parentCourse = findCourseByUnitId(mappedId, lessons);
                        if (parentCourse && !authorizedCourseIds.includes(parentCourse.courseId)) authorizedCourseIds.push(parentCourse.courseId);
                    } else if (!authorizedCourseIds.includes(mappedId)) authorizedCourseIds.push(mappedId);
                    courseGuideIndex[mappedId] = cfg;
                    if (mappedId !== docId) courseGuideIndex[docId] = cfg;
                }
            } catch (err) { logger.error(`Error processing config for course ${docId}:`, err); }
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
            lessons.forEach((lesson) => { if (!authorizedCourseIds.includes(lesson.courseId)) authorizedCourseIds.push(lesson.courseId); });
        }
        for (const cid of requestedGuideCourseIds) {
            const aggregatedGuides = await fetchGuideContentFromLocalFiles({ lessons, courseId: cid, unitId: requestedUnitId, preferredLocales });
            if (Object.keys(aggregatedGuides).length > 0) {
                if (!courseGuideIndex[cid]) courseGuideIndex[cid] = {};
                if (aggregatedGuides.tutor) courseGuideIndex[cid].tutorGuide = Object.assign({}, courseGuideIndex[cid].tutorGuide || {}, aggregatedGuides.tutor);
                if (aggregatedGuides.attachment) courseGuideIndex[cid].attachmentGuide = Object.assign({}, courseGuideIndex[cid].attachmentGuide || {}, aggregatedGuides.attachment);
                if (aggregatedGuides.assignment) courseGuideIndex[cid].assignmentGuide = Object.assign({}, courseGuideIndex[cid].assignmentGuide || {}, aggregatedGuides.assignment);
            }
        }
        const isAdminGlobal = requesterRole === "admin";
        const isManagementView = isAdminGlobal || authorizedCourseIds.length > 0;
        const result = {
            role: requesterRole, summary: {}, students: [], assignments: [],
            courseGuideIndex, unitTutorConfigs, myTutorConfigs, unitToDocId,
            myReferralLink: null, myPromotionCode: null, earnings: [],
            myApplications: myApplicationsMapping, tutorTerms,
            pendingApplications: allPendingApplications, hardwareOrders: [], myDistributorId: ""
        };
        result.myDistributorId = normalizeText(userData.distributorId || userData.commercial?.distributorId || userData.tutorDistributorId || userData.partnerDistributorId || "") || "";
        if (isManagementView) {
            try {
                if (requesterRole === "admin" || hasAnyQualifiedTutorStatus(userData)) {
                    const userRef = getDb().collection("users").doc(uid);
                    result.myPromotionCode = await ensureTutorPromotionCode(getDb(), userRef, userData, uid, email);
                }
                if (data.unitId) {
                    const canonicalId = resolveCanonicalUnitId(data.unitId, lessons);
                    const unitConfig = getEffectiveTutorConfig(canonicalId, myTutorConfigs);
                    if ((unitConfig && unitConfig.authorized) || requesterRole === "admin") {
                        const unitCourse = findLessonByCourseRef(canonicalId, lessons);
                        result.myReferralLink = getTutorAssignmentUrlFromConfig(unitConfig || {}, unitCourse, canonicalId, email, lessons) || null;
                    }
                }
                const ledgerSnap = await getDb().collection("profit_ledger").where("tutorEmail", "==", email).limit(500).get();
                result.earnings = ledgerSnap.docs.map((doc) => { const row = { id: doc.id, ...doc.data() }; row.month = row.month || row.period || "-"; return row; }).sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));
            } catch (err) { logger.error("Error fetching profit data for dashboard:", err); }
        }
        let usersMap = {};
        if (isManagementView) {
            let usersSnapshotForMap = usersSnapshot;
            if (requesterRole === "admin" && !data.unitId && !data.courseId) {
                try {
                    const listUsersResult = await admin.auth().listUsers(1000);
                    const authUsers = listUsersResult.users;
                    const existingUids = usersSnapshot.docs.map((doc) => doc.id);
                    const batch = getDb().batch();
                    let syncCount = 0;
                    for (const au of authUsers) {
                        const userRef = getDb().collection("users").doc(au.uid);
                        const existingDoc = usersSnapshot.docs.find((d) => d.id === au.uid);
                        const role = existingDoc?.data()?.role || "user";
                        batch.set(userRef, { email: au.email || "", name: au.displayName || fallbackNameFromEmail(au.email || "", "New User"), role, createdAt: au.metadata.creationTime ? new Date(au.metadata.creationTime) : admin.firestore.FieldValue.serverTimestamp(), joinedAt: au.metadata.creationTime ? new Date(au.metadata.creationTime) : admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                        syncCount++;
                    }
                    if (syncCount > 0) { await batch.commit(); usersSnapshotForMap = await getDb().collection("users").get(); }
                } catch (syncErr) { logger.error("[getDashboardData] Internal User Sync failed:", syncErr); }
            }
            usersSnapshotForMap.forEach((doc) => { addDashboardUserEntry(usersMap, doc.id, doc.data(), requesterRole); });
        } else {
            const userDocOnly = await getDb().collection("users").doc(uid).get();
            if (userDocOnly.exists) usersMap[uid] = userDocOnly.data();
        }
        if (Object.keys(usersMap).length === 0) return result;
        let logsQuery = getDb().collection("activity_logs").limit(5000);
        if (!isManagementView) logsQuery = logsQuery.where("uid", "==", uid);
        const logsSnapshot = await logsQuery.get();
        const studentStats = {};
        logsSnapshot.forEach((doc) => {
            const log = doc.data();
            if (log.action === "PAGE_VIEW") return;
            const sid = log.uid;
            const cid = canonicalCourseId(log.courseId || "unknown");
            const isAuthorizedForLog = (sid === uid) || (requesterRole === "admin") || authorizedCourseIds.includes(cid);
            if (isAuthorizedForLog && usersMap[sid]) {
                if (!studentStats[sid]) ensureStudentStatsEntry(studentStats, sid, usersMap[sid] || {}, { accountStatus: null });
                const duration = log.duration || 0;
                studentStats[sid].totalTime += duration;
                if (log.action === "VIDEO") studentStats[sid].videoTime += duration;
                if (log.action === "DOC") studentStats[sid].docTime += duration;
                if (!studentStats[sid].lastActive) studentStats[sid].lastActive = log.timestamp ? log.timestamp.toDate() : null;
                appendCourseProgressActivity(studentStats[sid], cid, log);
            }
        });
        if (isManagementView) {
            try {
                const ordersSnapshot = await getDb().collection("orders").where("status", "==", "SUCCESS").get();
                ordersSnapshot.forEach((doc) => {
                    const order = doc.data();
                    const sid = order.uid;
                    if (!sid || sid === "GUEST") return;
                    if (usersMap[sid] || studentStats[sid]) ensureStudentStatsEntry(studentStats, sid, usersMap[sid] || {}, { accountStatus: "paid" });
                    if (studentStats[sid] && order.items) {
                        if (!studentStats[sid].orderRecords) studentStats[sid].orderRecords = [];
                        studentStats[sid].orderRecords.push(buildStudentOrderRecord(order, doc.id));
                        Object.keys(order.items).forEach((originalCid) => {
                            const cid = canonicalCourseId(originalCid);
                            if (!studentStats[sid].orders.includes(cid)) studentStats[sid].orders.push(cid);
                            ensureCourseProgressBucket(studentStats[sid], cid, { isLicenseOnly: true });
                        });
                    }
                });
            } catch (orderErr) { logger.error("Error fetching orders for dashboard:", orderErr); }
        }
        if (!isManagementView) {
            try {
                const myOrdersSnapshot = await getDb().collection("orders").where("uid", "==", uid).where("status", "==", "SUCCESS").get();
                if (!studentStats[uid] && usersMap[uid]) ensureStudentStatsEntry(studentStats, uid, usersMap[uid] || {}, { includeOrderRecords: true });
                myOrdersSnapshot.forEach((doc) => {
                    const order = doc.data() || {};
                    studentStats[uid].orderRecords.push(buildStudentOrderRecord(order, doc.id));
                    Object.keys(order.items || {}).forEach((originalCid) => {
                        const cid = canonicalCourseId(originalCid);
                        if (!studentStats[uid].orders) studentStats[uid].orders = [];
                        if (!studentStats[uid].orders.includes(cid)) studentStats[uid].orders.push(cid);
                    });
                });
            } catch (myOrderErr) { logger.error("Error fetching student's own orders for dashboard:", myOrderErr); }
        }
        const shouldIncludeAllRegisteredUsers = isManagementView && requesterRole === "admin" && !data.unitId && !data.courseId;
        if (isManagementView) {
            Object.keys(usersMap).forEach((sid) => {
                const userRole = usersMap[sid].role || "user";
                const shouldIncludeUser = shouldIncludeAllRegisteredUsers || userRole === "user" || !userRole;
                if (!studentStats[sid] && shouldIncludeUser) { ensureStudentStatsEntry(studentStats, sid, usersMap[sid] || {}, { accountStatus: "free", includeOrderRecords: true }); studentStats[sid].createdAt = usersMap[sid].createdAt || null; }
                else if (studentStats[sid] && !studentStats[sid].createdAt) studentStats[sid].createdAt = usersMap[sid].createdAt || null;
            });
        }
        const targetUnitId = data.unitId ? resolveCanonicalUnitId(data.unitId, lessons) : null;
        const targetCourseId = data.courseId || null;
        const isTutorModeAdmin = requesterRole === "admin" && data.tutorMode !== false;
        const tutorRelevantEntries = buildStudentsRelevantToTutor({ usersMap, lessons, email, targetUnitId, targetCourseId, isTutorModeAdmin });
        if (isManagementView && (targetUnitId || targetCourseId || hasAnyQualifiedTutorStatus(userData))) {
            tutorRelevantEntries.forEach(([sid, studentData]) => {
                if (!studentData) return;
                ensureStudentStatsEntry(studentStats, sid, studentData, { accountStatus: studentStats[sid]?.accountStatus ?? "free", includeOrderRecords: !!studentStats[sid]?.orderRecords });
                if (studentStats[sid] && !studentStats[sid].createdAt) studentStats[sid].createdAt = studentData.createdAt || null;
            });
        }
        const filteredStudentStats = [];
        const isAdmin = requesterRole === "admin";
        Object.values(studentStats).forEach((s) => {
            if (isAdmin && !targetUnitId && !targetCourseId) { filteredStudentStats.push(s); return; }
            let isRelevant = false;
            if (targetUnitId) {
                const assignedTutor = normalizeEmail(s.unitAssignments?.[targetUnitId]);
                if (assignedTutor === email || isTutorModeAdmin) isRelevant = true;
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
        let assignQuery = getDb().collection("assignments");
        if (!isManagementView) assignQuery = assignQuery.where("userId", "==", uid);
        const assignSnapshot = await assignQuery.get();
        assignSnapshot.forEach((doc) => {
            const assignData = doc.data();
            let targetUid = assignData.userId || assignData.uid;
            if (!targetUid && doc.id.includes("_")) targetUid = doc.id.split("_")[0];
            const originalCid = assignData.courseId || "unknown";
            const mappedCid = canonicalCourseId(originalCid);
            const assignmentTutor = assignData.assignedTutorEmail || null;
            const requesterHasTutorAccess = hasAnyQualifiedTutorStatus(userData);
            const isAuthorizedForAssign = isAssignmentAuthorized({
                targetUid, uid, requesterRole, requesterHasTutorAccess,
                assignmentTutor, requesterEmail: email, mappedCid,
                authorizedCourseIds, unitId: assignData.unitId
            });
            if (isAuthorizedForAssign) {
                result.assignments.push(buildDashboardReferenceEntry(usersMap, targetUid, {
                    id: doc.id, ...assignData, userId: targetUid,
                    courseId: mappedCid,
                    unitId: resolveCanonicalUnitId(assignData.unitId, lessons) || assignData.unitId
                }));
            }
        });
        let interventions = [];
        const isTutorOrAdmin = requesterRole === "admin" || hasAnyQualifiedTutorStatus(userData);
        if (isTutorOrAdmin) {
            try {
                const intSnapshot = await getDb().collection("assignment_interventions").get();
                intSnapshot.forEach((doc) => {
                    const intData = doc.data();
                    const studentUid = intData.studentUid;
                    if (requesterRole !== "admin" && intData.ownerTutorEmail && intData.ownerTutorEmail !== email) return;
                    interventions.push(buildDashboardReferenceEntry(usersMap, studentUid, { id: doc.id, ...intData }));
                });
            } catch (intErr) { logger.warn("[getDashboardData] Failed to fetch assignment_interventions:", intErr.message); }
        }
        result.interventions = interventions;
        result.summary = buildDashboardSummary(result.students);
        if (requesterRole === "admin") {
            try {
                const shipmentsSnapshot = await getDb().collection("orders").where("status", "==", "SUCCESS").get();
                shipmentsSnapshot.forEach((doc) => {
                    const orderData = doc.data();
                    const items = orderData.items || {};
                    const physicalItems = Object.keys(items).filter((id) => isPhysicalOrderItem(id, items[id] || {}, physicalUnitIds));
                    if (physicalItems.length > 0) {
                        const student = usersMap[orderData.uid] || {};
                        const logistics = orderData.logistics || {};
                        result.hardwareOrders.push(buildOrderRecordSummary({ docId: doc.id, uid: orderData.uid, student, data: orderData, logistics, items, physicalItems, lessons, canonicalCourseId }));
                    }
                });
                const shipmentSummary = finalizeHardwareOrders(result.hardwareOrders);
                result.hardwareOrders = shipmentSummary.hardwareOrders;
                result.pendingShipments = shipmentSummary.pendingShipments;
                result.pendingShipmentsCount = shipmentSummary.pendingShipmentsCount;
            } catch (shipErr) { logger.error("Error aggregating shipments:", shipErr); }
        }
        if (requesterRole === "admin") {
            try {
                const configDoc = await getDb().collection("metadata_settings").doc("content_runtime").get();
                if (configDoc.exists) {
                    const cData = configDoc.data() || {};
                    result.contentVersion = cData.contentVersion || "";
                    result.defaultRegion = cData.defaultRegion || "US";
                    result.defaultDistributorId = cData.defaultDistributorId || "default-usd";
                    result.defaultLocale = cData.defaultLocale || "en";
                }
            } catch (err) { logger.warn("[getDashboardData] Failed to fetch content_runtime version:", err.message); }
        }
        result.lessons = lessons.map((lesson) => canonicalizeLessonForDashboard(lesson, lessons));
        return result;
    } catch (error) {
        logger.error("Dashboard Data Error:", error);
        throw new HttpsError(error?.code || "internal", error?.message || "Failed to fetch dashboard data.");
    }
});
