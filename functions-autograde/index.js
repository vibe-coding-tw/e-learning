"use strict";
require("dotenv").config();
const admin = require("firebase-admin");
global.__vibeFirebaseAdmin = admin;
const crypto = require("crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");

const {
    resolveAssignmentDocRefByUserAndUnit,
    ensureGithubOrgMembership
} = require("vibe-functions-core/github-utils");
const {
    addAssignmentHistoryEntry,
    backfillAutogradeGithubVariables,
    buildAssignmentSubmissionRecord,
    buildGithubAutogradePayload,
    resolveAutogradeAssignmentDocId,
    sendAutogradeNotifications,
    syncAutoGradeInterventions,
    updateActiveAssignmentInterventions
} = require("./lib/assignment-flow");
const {
    assertAdminOrAssignedTutor,
    assertAuthenticated,
    assertRequiredValue,
    loadLessons,
    normalizeText,
    nowIsoTimestamp,
    resolveSubmissionAccessOrThrow
} = require("./lib/autograde-access");
const {
    sendAssignmentNotification,
    sendAutogradeFailureAlertEmail
} = require("vibe-functions-core/email-service");
const {
    normalizeTemplateRepoName,
    templateRepoCandidates
} = require("vibe-functions-core/template-utils");
const {
    findParentCourseIdByUnit,
    resolveCanonicalUnitId,
    resolveNameFromUserData
} = require("./dashboard-utils");
const {
    getUserTutorConfig
} = require("vibe-functions-core/tutor-utils");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const GitHubAPIHelper = require("./github-api-helper");

const GITHUB_API_TOKEN = defineSecret("GITHUB_API_TOKEN");
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const GITHUB_ORG_ADMIN_TOKEN = process.env.GITHUB_ORG_ADMIN_TOKEN || "";

setGlobalOptions({
    region: "asia-east1",
    maxInstances: 10,
    minInstances: 0,
    memory: 128,
    concurrency: 80
});

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "e-learning-942f7"
    });
}

async function submitAssignmentHandler(request) {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const { courseId, unitId, assignmentId, url, note, title, status, assignmentType } = data;
    const userId = auth.uid;
    const userEmail = auth.token.email || "Unknown";

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const userName = resolveNameFromUserData(userData, userEmail, auth.token.name || "");

    const currentStatus = status || "submitted";
    if (!url && currentStatus !== "started") {
        throw new HttpsError("invalid-argument", "請提供作業連結 (GitHub / Demo)");
    }

    try {
        const lessons = await loadLessons();
        const access = await resolveSubmissionAccessOrThrow(db, userId, courseId, unitId, lessons);
        const assignedTutorEmail = access.assignedTutorEmail || null;

        const canonicalUnitId = access.canonicalUnitId;
        const canonicalAssignmentId = canonicalUnitId.replace(/\.html$/i, "");
        const canonicalDocId = `${userId}_${canonicalAssignmentId}`;
        const docRef = db.collection("assignments").doc(canonicalDocId);

        const submissionUrl = normalizeText(url || "");
        const isAssignmentInvite = /classroom\.github\.com\/a\//i.test(submissionUrl);
        if (currentStatus === "submitted" && isAssignmentInvite && GITHUB_ORG_ADMIN_TOKEN) {
            const membership = await ensureGithubOrgMembership({
                admin,
                token: GITHUB_ORG_ADMIN_TOKEN,
                firebaseUid: userId,
                org: "vibe-coding-classroom"
            });
            if (!membership.ok) {
                const base = "尚未完成 GitHub 組織授權。請先到 https://github.com/settings/organizations 接受邀請後重試。";
                const detail = membership.state === "missing_github_identity"
                    ? "（目前帳號尚未綁定 GitHub 登入）"
                    : membership.state === "invited"
                        ? "（系統已自動補發邀請）"
                        : "";
                throw new HttpsError("failed-precondition", `${base}${detail}`);
            }
        }

        const existingDoc = await docRef.get();
        let finalStatus = currentStatus;
        if (existingDoc.exists) {
            const existingData = existingDoc.data();
            const existingStatus = existingData.currentStatus || existingData.status;
            if ((existingStatus === "submitted" || existingStatus === "graded") && currentStatus === "started") {
                finalStatus = existingStatus;
            }
        }

        const historyEntry = {
            timestamp: nowIsoTimestamp(),
            url: url || "",
            note: note || "",
            action: currentStatus === "started" ? "START" : "SUBMIT"
        };

        const assignmentData = {
            ...buildAssignmentSubmissionRecord({
                docId: canonicalDocId,
                userId,
                userEmail,
                userName,
                courseId,
                unitId: canonicalUnitId,
                assignmentId: canonicalAssignmentId,
                title,
                url,
                note,
                finalStatus,
                assignmentType,
                assignedTutorEmail,
                existingLearningState: existingDoc.exists ? (existingDoc.data().learningState || "in_progress") : "in_progress"
            }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const submissionWrite = {
            ...assignmentData,
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
            grade: null,
            tutorFeedback: null
        };

        await addAssignmentHistoryEntry(docRef, submissionWrite, historyEntry, existingDoc.exists ? "update" : "set");

        if (currentStatus === "submitted" && assignedTutorEmail) {
            const dashboardUrl = `https://vibe-coding.tw/dashboard.html?courseId=${encodeURIComponent(access.effectiveCourseId)}&unitId=${encodeURIComponent(access.canonicalUnitId)}&tab=assignments`;
            await sendAssignmentNotification(assignedTutorEmail, userName, assignmentData.assignmentTitle, dashboardUrl, canonicalUnitId);
        }

        return { success: true, message: currentStatus === "started" ? "紀錄已更新" : "作業繳交成功！" };
    } catch (e) {
        logger.error("Submit Assignment Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError("internal", "操作失敗，請稍後再試");
    }
}

async function createStudentRepositoryHandler(request) {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const unitIdRaw = normalizeText(data?.unitId || '');
    const courseIdRaw = normalizeText(data?.courseId || '');
    const githubUsername = normalizeText(data?.githubUsername || '');

    assertRequiredValue(unitIdRaw, '缺少必要參數（unitId）');
    assertRequiredValue(githubUsername, '缺少必要參數（githubUsername）');

    const db = admin.firestore();
    const uid = auth.uid;

    try {
        await db.collection('users').doc(uid).set({
            githubUsername
        }, { merge: true });

        const lessons = await loadLessons();
        const canonicalUnitId = resolveCanonicalUnitId(unitIdRaw, lessons);
        const effectiveCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons) || courseIdRaw;

        const tutorMode = data?.tutorMode === true;
        const access = await resolveSubmissionAccessOrThrow(db, uid, effectiveCourseId, canonicalUnitId, lessons, tutorMode);

        const normalizedUnitId = canonicalUnitId.replace('.html', '');
        const assignmentDocId = `${uid}_${normalizedUnitId}`;
        const assignmentDoc = await db.collection('assignments').doc(assignmentDocId).get();
        const assignmentData = assignmentDoc.exists ? assignmentDoc.data() : null;

        if (assignmentData && assignmentData.repositoryUrl) {
            return {
                repositoryUrl: assignmentData.repositoryUrl,
                feedbackPullRequestUrl: assignmentData.feedbackPullRequestUrl || null
            };
        }

        let targetOrg = 'vibe-coding-classroom';
        let templateRepo = normalizeTemplateRepoName(normalizedUnitId);
        let customToken = null;

        const tutorEmail = access.assignedTutorEmail;
        if (tutorEmail) {
            const tutorSnap = await db.collection('users')
                .where('email', '==', tutorEmail.toLowerCase())
                .limit(1)
                .get();
            if (!tutorSnap.empty) {
                const tutorData = tutorSnap.docs[0].data();
                const config = getUserTutorConfig(tutorData, canonicalUnitId);
                if (config) {
                    if (config.githubOrg) {
                        targetOrg = config.githubOrg;
                    }
                    if (config.templateRepo) {
                        templateRepo = config.templateRepo;
                    }
                    if (config.githubToken) {
                        customToken = config.githubToken;
                    }
                }
            }
        }

        const token = customToken || GITHUB_API_TOKEN.value();
        if (!token) {
            throw new HttpsError('failed-precondition', '系統未配置 GITHUB_API_TOKEN');
        }

        const ghHelper = new GitHubAPIHelper(token);
        const effectiveUnitName = normalizeTemplateRepoName(normalizedUnitId);
        const newRepoName = `${effectiveUnitName}-${uid.substring(0, 8)}`;
        const templateRepoCandidatesList = templateRepoCandidates(templateRepo);

        let studentRepo = null;
        let lastCreateErr = null;
        for (const candidateTemplateRepo of templateRepoCandidatesList) {
            try {
                logger.info(`[createStudentRepository] Creating repo ${newRepoName} from template ${candidateTemplateRepo} in org ${targetOrg}...`);
                studentRepo = await ghHelper.createRepoFromTemplate(targetOrg, candidateTemplateRepo, newRepoName, true);
                templateRepo = candidateTemplateRepo;
                break;
            } catch (err) {
                lastCreateErr = err;
                logger.warn(`[createStudentRepository] Template repo not usable: ${candidateTemplateRepo}`, err?.message || err);
            }
        }
        if (!studentRepo) {
            throw lastCreateErr || new HttpsError('failed-precondition', '無法從樣板倉庫建立作業 repo');
        }

        logger.info(`[createStudentRepository] Adding collaborator ${githubUsername} with push permission...`);
        await ghHelper.addCollaborator(targetOrg, newRepoName, githubUsername, 'push');

        logger.info(`[createStudentRepository] Fetching main branch SHA (with retry)...`);
        let mainRef = null;
        let retries = 5;
        while (retries > 0) {
            try {
                mainRef = await ghHelper.getRef(targetOrg, newRepoName, 'heads/main');
                break;
            } catch (err) {
                retries--;
                if (retries === 0) throw err;
                logger.info(`[createStudentRepository] Main branch not ready yet, retrying in 2 seconds... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        const mainSha = mainRef.object.sha;
        let feedbackSha = mainSha;
        let needPlaceholder = false;

        try {
            logger.info(`[createStudentRepository] Fetching commit details for ${mainSha} to determine branch base...`);
            const commitDetails = await ghHelper.getCommit(targetOrg, newRepoName, mainSha);
            if (commitDetails.parents && commitDetails.parents.length > 0) {
                feedbackSha = commitDetails.parents[0].sha;
                logger.info(`[createStudentRepository] Found parent commit ${feedbackSha}. Using it as feedback branch base.`);
            } else {
                needPlaceholder = true;
                logger.info(`[createStudentRepository] No parent commit found. Will write a placeholder file to force diff.`);
            }
        } catch (commitErr) {
            logger.warn(`[createStudentRepository] Failed to get commit details, falling back to placeholder file:`, commitErr);
            needPlaceholder = true;
        }

        logger.info(`[createStudentRepository] Creating feedback branch at ${feedbackSha}...`);
        await ghHelper.createRef(targetOrg, newRepoName, 'refs/heads/feedback', feedbackSha);

        if (needPlaceholder) {
            logger.info(`[createStudentRepository] Creating placeholder file .github/classroom/feedback.md on main branch...`);
            const fileContent = `# Feedback\n\n這是您的作業回饋專區。請在此 PR 中進行討論與發問。`;
            await ghHelper.createFile(
                targetOrg,
                newRepoName,
                '.github/classroom/feedback.md',
                fileContent,
                'chore: initialize feedback PR [skip ci]',
                'main'
            );
        }

        logger.info(`[createStudentRepository] Opening Feedback PR...`);
        const feedbackPR = await ghHelper.createPullRequest(
            targetOrg,
            newRepoName,
            'classroom-feedback',
            '這是您的作業回饋專區。您每次 push 程式碼後，自動評分結果與老師的評語都會顯示在這裡！\n\n⚠️ **請勿點擊 Merge 按鈕**，保持此 PR 開啟直到學期結束。',
            'main',
            'feedback'
        );

        const now = admin.firestore.FieldValue.serverTimestamp();
        const assignmentPayload = {
            userId: uid,
            userEmail: auth.token.email || '',
            courseId: effectiveCourseId,
            unitId: canonicalUnitId,
            assignmentTitle: data.assignmentTitle || canonicalUnitId,
            assignmentId: normalizedUnitId,
            repositoryUrl: studentRepo.html_url,
            repositoryName: newRepoName,
            feedbackPullRequestUrl: feedbackPR.html_url,
            createdVia: 'native-api',
            currentStatus: 'started',
            assignedTutorEmail: tutorEmail || '',
            updatedAt: now
        };

        if (assignmentDoc.exists) {
            await db.collection('assignments').doc(assignmentDocId).update(assignmentPayload);
        } else {
            assignmentPayload.createdAt = now;
            await db.collection('assignments').doc(assignmentDocId).set(assignmentPayload);
        }

        return {
            repositoryUrl: studentRepo.html_url,
            feedbackPullRequestUrl: feedbackPR.html_url
        };
    } catch (error) {
        logger.error("[createStudentRepository] Failed with error:", error);
        throw new HttpsError('internal', error.message || '作業倉庫建立失敗');
    }
}

exports.autogradeSubmitStudentBlocker = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, "請先登入");

    const { assignmentId, blockerType, blockerNote } = data || {};
    assertRequiredValue(assignmentId);
    assertRequiredValue(blockerType);
    assertRequiredValue(blockerNote);

    const db = admin.firestore();
    const docRef = await resolveAssignmentDocRefByUserAndUnit(db, auth.uid, assignmentId);
    if (!docRef) {
        throw new HttpsError("not-found", "找不到作業紀錄");
    }

    const doc = await docRef.get();
    if (!doc.exists) {
        throw new HttpsError("not-found", "找不到作業紀錄");
    }

    const now = admin.firestore.Timestamp.now();
    const blockerEntry = {
        type: blockerType,
        note: blockerNote,
        createdAt: now
    };

    await addAssignmentHistoryEntry(docRef, {
        learningState: "blocked",
        latestBlocker: blockerEntry,
        updatedAt: now
    }, {
        timestamp: nowIsoTimestamp(),
        action: "BLOCKER_REPORTED",
        content: `Student reported blocker: [${blockerType}] ${blockerNote}`
    });

    return { success: true, message: "已成功標記卡點" };
});

exports.autogradeSubmitAttemptSummary = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, "請先登入");

    const { assignmentId, attemptSummary } = data || {};
    assertRequiredValue(assignmentId);
    assertRequiredValue(attemptSummary);

    const db = admin.firestore();
    const docRef = await resolveAssignmentDocRefByUserAndUnit(db, auth.uid, assignmentId);
    if (!docRef) {
        throw new HttpsError("not-found", "找不到作業紀錄");
    }

    const doc = await docRef.get();
    if (!doc.exists) {
        throw new HttpsError("not-found", "找不到作業紀錄");
    }

    const now = admin.firestore.Timestamp.now();
    await addAssignmentHistoryEntry(docRef, {
        attemptSummary,
        updatedAt: now
    }, {
        timestamp: nowIsoTimestamp(),
        action: "ATTEMPT_LOGGED",
        content: `Student logged attempt: ${attemptSummary}`
    });

    return { success: true, message: "嘗試紀錄提交成功！" };
});

exports.autogradeResolveStudentBlocker = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, "請先登入");

    const { assignmentId, studentUid } = data || {};
    assertRequiredValue(assignmentId);

    const db = admin.firestore();
    const targetUid = studentUid || auth.uid;

    if (studentUid && studentUid !== auth.uid) {
        const requesterUid = auth.uid;
        const reqUserSnap = await db.collection("users").doc(requesterUid).get();
        const reqUserData = reqUserSnap.data() || {};
        const isRequesterAdmin = reqUserData.role === "admin";
        let isTutor = false;
        if (reqUserData.role === "admin" || reqUserData.tutorConfigs) {
            isTutor = true;
        }
        if (!isRequesterAdmin && !isTutor) {
            throw new HttpsError("permission-denied", "您沒有權限解決此學生的卡點。");
        }
    }

    const docRef = await resolveAssignmentDocRefByUserAndUnit(db, targetUid, assignmentId);
    if (!docRef) {
        throw new HttpsError("not-found", "找不到作業紀錄");
    }

    const doc = await docRef.get();
    if (!doc.exists) {
        throw new HttpsError("not-found", "找不到作業紀錄");
    }

    const now = admin.firestore.Timestamp.now();
    await addAssignmentHistoryEntry(docRef, {
        learningState: "in_progress",
        latestBlocker: null,
        updatedAt: now
    }, {
        timestamp: nowIsoTimestamp(),
        action: "BLOCKER_RESOLVED",
        content: `Blocker marked as resolved by ${studentUid ? "Tutor" : "Student"}`
    });

    return { success: true, message: "已成功解決卡點！" };
});

exports.autogradeSubmitTutorCoachingLog = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, "請先登入");

    const { assignmentId, studentUid, hintLevel, blockerType, coachNote, nextAction } = data || {};
    assertRequiredValue(assignmentId);
    assertRequiredValue(studentUid);
    assertRequiredValue(hintLevel !== undefined);
    assertRequiredValue(coachNote);

    const db = admin.firestore();
    const lessons = await loadLessons();
    const canonicalAssignmentId = (resolveCanonicalUnitId(assignmentId, lessons) || assignmentId).replace(/\.html$/, "");
    const docId = `${studentUid}_${canonicalAssignmentId}`;
    const docRef = db.collection("assignments").doc(docId);

    const doc = await docRef.get();
    if (!doc.exists) {
        throw new HttpsError("not-found", "找不到該學生的作業紀錄");
    }

    const assignmentData = doc.data() || {};
    const reqUserSnap = await db.collection("users").doc(auth.uid).get();
    const reqUserData = reqUserSnap.data() || {};
    const isRequesterAdmin = reqUserData.role === "admin";
    const isAssignedTutor = assignmentData.assignedTutorEmail === auth.token.email;
    assertAdminOrAssignedTutor(isRequesterAdmin, isAssignedTutor);

    const now = admin.firestore.Timestamp.now();
    const coachingLogRef = db.collection("assignment_coaching_logs").doc();
    await coachingLogRef.set({
        assignmentId,
        studentUid,
        tutorEmail: auth.token.email,
        hintLevel: Number(hintLevel),
        blockerType: blockerType || "concept",
        coachNote,
        createdAt: now
    });

    await addAssignmentHistoryEntry(docRef, {
        learningState: "coaching",
        hintLevelUsed: Number(hintLevel),
        nextAction: nextAction || "",
        updatedAt: now
    }, {
        timestamp: nowIsoTimestamp(),
        action: "TUTOR_COACHED",
        content: `Tutor logged coaching note (Hint Level: L${hintLevel}). Next action: ${nextAction || "None"}`
    });

    await updateActiveAssignmentInterventions(db, {
        assignmentId,
        studentUid,
        status: "in_progress",
        updatedAt: now,
        ownerTutorEmail: auth.token.email
    });

    return { success: true, message: "指導紀錄已提交" };
});

exports.autogradeSubmitAssignment = onCall(async (request) => {
    return submitAssignmentHandler(request);
});

exports.autogradeCreateStudentRepository = onCall({ secrets: [GITHUB_API_TOKEN] }, async (request) => {
    return createStudentRepositoryHandler(request);
});

exports.autogradeTestGithubToken = onCall({ secrets: [GITHUB_API_TOKEN] }, async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== "admin") {
        throw new HttpsError("permission-denied", "限管理員呼叫此功能");
    }

    const { tutorEmail, unitId } = data || {};
    let customToken = null;
    let customOrg = null;
    let customTemplate = null;

    if (tutorEmail && unitId) {
        const tutorSnap = await db.collection("users")
            .where("email", "==", String(tutorEmail).toLowerCase())
            .limit(1)
            .get();
        if (!tutorSnap.empty) {
            const tutorData = tutorSnap.docs[0].data();
            const config = getUserTutorConfig(tutorData, unitId);
            if (config) {
                customToken = config.githubToken || null;
                customOrg = config.githubOrg || null;
                customTemplate = config.templateRepo || null;
            }
        }
    }

    const globalToken = GITHUB_API_TOKEN.value();
    const activeToken = customToken || globalToken;

    const tokenPreview = (token) => {
        if (!token) return "None";
        const len = token.length;
        if (len < 8) return `Short (length ${len})`;
        return `${token.substring(0, 4)}...${token.substring(len - 4)} (length ${len})`;
    };

    const results = {
        hasTutorEmail: !!tutorEmail,
        hasUnitId: !!unitId,
        customOrg,
        customTemplate,
        customTokenPreview: tokenPreview(customToken),
        globalTokenPreview: tokenPreview(globalToken),
        usingCustomToken: !!customToken,
        githubValidation: null
    };

    if (!activeToken) {
        results.githubValidation = {
            success: false,
            message: "No token resolved (both custom and global are empty)."
        };
        return results;
    }

    try {
        const { Octokit } = require("@octokit/rest");
        const octokit = new Octokit({ auth: activeToken });
        const userResponse = await octokit.users.getAuthenticated();
        const scopes = userResponse.headers["x-oauth-scopes"] || "unknown";
        results.githubValidation = {
            success: true,
            login: userResponse.data.login,
            scopes,
            message: "Token is VALID! GitHub authenticated successfully."
        };
    } catch (err) {
        results.githubValidation = {
            success: false,
            statusCode: err.status || null,
            message: err.message || "Unknown GitHub API error."
        };
    }

    return results;
});

exports.autogradeIngestGithubAutograde = onRequest(async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const signature = req.get("x-hub-signature-256") || "";
        if (GITHUB_WEBHOOK_SECRET) {
            if (!signature.startsWith("sha256=")) {
                return res.status(401).json({ success: false, error: "Missing signature" });
            }
            const expected = "sha256=" + crypto
                .createHmac("sha256", GITHUB_WEBHOOK_SECRET)
                .update(req.rawBody || Buffer.from(JSON.stringify(req.body || {})))
                .digest("hex");
            const sigBuffer = Buffer.from(signature);
            const expectedBuffer = Buffer.from(expected);
            if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
                return res.status(401).json({ success: false, error: "Invalid signature" });
            }
        }

        const db = admin.firestore();
        const payload = (req.body && typeof req.body === "object") ? req.body : {};
        const assignmentDocId = payload.assignmentDocId || payload.assignment?.docId || null;
        const userId = payload.userId || payload.assignment?.userId || null;
        const assignmentId = payload.assignmentId || payload.assignment?.assignmentId || null;
        const unitIdFromPayload = payload.unitId || payload.assignment?.unitId || null;
        const repositoryFullName = payload.repository?.full_name || payload.repo || "";
        const scoreRaw = payload.score ?? payload.grade ?? payload.autoGrade?.score;
        const maxScoreRaw = payload.maxScore ?? payload.autoGrade?.maxScore ?? null;
        const score = Number(scoreRaw);
        const maxScore = maxScoreRaw !== null && maxScoreRaw !== undefined ? Number(maxScoreRaw) : null;

        const lessons = await loadLessons();
        const { resolvedDocId, inferredUnitId, candidateCount, candidateIds } = await resolveAutogradeAssignmentDocId(db, {
            assignmentDocId,
            userId,
            assignmentId,
            unitIdFromPayload,
            repositoryFullName,
            canonicalResolver: (id) => resolveCanonicalUnitId(id, lessons)
        });

        if (!resolvedDocId && candidateCount > 1) {
            await sendAutogradeFailureAlertEmail(
                process.env.ADMIN_EMAIL || process.env.MAIL_USER,
                `Ambiguous assignment mapping for unit ${inferredUnitId}`,
                {
                    repository: repositoryFullName,
                    inferredUnitId,
                    candidateCount,
                    candidateIds,
                    payload
                }
            );
            return res.status(409).json({
                success: false,
                error: "Ambiguous assignment mapping. Please provide userId + unitId.",
                inferredUnitId,
                candidateCount
            });
        }

        if (!resolvedDocId) {
            try {
                await sendAutogradeFailureAlertEmail(
                    process.env.ADMIN_EMAIL || process.env.MAIL_USER,
                    "Missing assignment identifier",
                    payload
                );
            } catch (notifyErr) {
                logger.error("[ingestGithubAutograde] Failed to send alert for missing identifier:", notifyErr);
            }
            return res.status(400).json({
                success: false,
                error: "Missing assignment identifier. Provide userId + unitId."
            });
        }

        if (!Number.isFinite(score)) {
            try {
                await sendAutogradeFailureAlertEmail(process.env.ADMIN_EMAIL || process.env.MAIL_USER, "Invalid score value", payload);
            } catch (notifyErr) {
                logger.error("[ingestGithubAutograde] Failed to send alert for invalid score:", notifyErr);
            }
            return res.status(400).json({ success: false, error: "Invalid score value." });
        }

        const assignmentRef = db.collection("assignments").doc(resolvedDocId);
        const assignmentDoc = await assignmentRef.get();
        if (!assignmentDoc.exists) {
            try {
                await sendAutogradeFailureAlertEmail(process.env.ADMIN_EMAIL || process.env.MAIL_USER, `Assignment not found: ${resolvedDocId}`, payload);
            } catch (notifyErr) {
                logger.error("[ingestGithubAutograde] Failed to send alert for missing assignment doc:", notifyErr);
            }
            return res.status(404).json({ success: false, error: "Assignment not found." });
        }

        const now = admin.firestore.Timestamp.now();
        const assignmentData = assignmentDoc.data() || {};
        const studentUid = assignmentData.userId || userId || resolvedDocId.split("_")[0];
        const assignmentIdVal = assignmentData.assignmentId || assignmentData.unitId || unitIdFromPayload || assignmentId || "";
        const ownerTutorEmail = assignmentData.assignedTutorEmail || "";

        if (repositoryFullName) {
            const parts = repositoryFullName.split("/");
            const repoOwner = parts[0] || "";
            let isAllowedOrg = ["vibe-coding-classroom", "vibe-coding-template"].includes(repoOwner);

            if (!isAllowedOrg && ownerTutorEmail) {
                const tutorSnap = await db.collection("users")
                    .where("email", "==", ownerTutorEmail.toLowerCase())
                    .limit(1)
                    .get();
                if (!tutorSnap.empty) {
                    const tutorData = tutorSnap.docs[0].data();
                    const config = getUserTutorConfig(tutorData, assignmentIdVal);
                    if (config && config.githubOrg && config.githubOrg === repoOwner) {
                        isAllowedOrg = true;
                    }
                }
            }

            if (!isAllowedOrg) {
                logger.warn(`[ingestGithubAutograde] Rejecting webhook from unauthorized organization: ${repoOwner}`);
                return res.status(403).json({ success: false, error: "Unauthorized repository organization" });
            }
        }

        const learningStateUpdate = await syncAutoGradeInterventions(db, {
            assignmentId: assignmentIdVal,
            studentUid,
            ownerTutorEmail,
            score,
            now,
            assignmentLearningState: assignmentData.learningState || ""
        });

        const updatePayload = buildGithubAutogradePayload({
            score,
            maxScore,
            scoreRaw,
            maxScoreRaw,
            payload,
            now,
            learningStateUpdate
        });

        await addAssignmentHistoryEntry(assignmentRef, updatePayload, {
            timestamp: now,
            action: "AUTO_GRADE",
            content: `GitHub auto-grade: ${score}${Number.isFinite(maxScore) ? `/${maxScore}` : ""}`
        }, "set");

        try {
            await backfillAutogradeGithubVariables({
                repositoryFullName: updatePayload.autoGrade.repository || repositoryFullName || "",
                assignmentData: assignmentDoc.data() || {},
                userId,
                unitIdFromPayload,
                assignmentId
            }, GITHUB_ORG_ADMIN_TOKEN);
        } catch (varErr) {
            logger.warn("[ingestGithubAutograde] Variable backfill error:", varErr);
        }

        try {
            await sendAutogradeNotifications({
                assignmentData: assignmentDoc.data() || {},
                resolvedDocId,
                score,
                maxScore,
                updatePayload
            });
        } catch (notifyErr) {
            logger.error("[ingestGithubAutograde] Notification send failed:", notifyErr);
        }

        return res.status(200).json({ success: true, assignmentId: resolvedDocId });
    } catch (error) {
        logger.error("ingestGithubAutograde Error:", error);
        try {
            await sendAutogradeFailureAlertEmail(
                process.env.ADMIN_EMAIL || process.env.MAIL_USER,
                `Internal server error: ${error.message || "unknown"}`,
                (req.body && typeof req.body === "object") ? req.body : {}
            );
        } catch (notifyErr) {
            logger.error("[ingestGithubAutograde] Failed to send alert for internal error:", notifyErr);
        }
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
});

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download file: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve();
            });
        }).on("error", (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

exports.autoGradeSingleAssignment = onCall({ secrets: [GITHUB_API_TOKEN] }, async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);
    const db = admin.firestore();
    const assignmentId = data.assignmentId;
    assertRequiredValue(assignmentId, "assignmentId");
    await assertAdminOrAssignedTutor(db, auth.uid);
    const sandboxDir = "/tmp/autograde_sandbox";
    const hostingUrl = "https://e-learning-942f7.web.app";
    const token = GITHUB_API_TOKEN.value();

    const docSnap = await db.collection("assignments").doc(assignmentId).get();
    if (!docSnap.exists) {
        throw new HttpsError("not-found", "Assignment not found.");
    }

    const data_ = docSnap.data();
    const repoUrl = data_.repositoryUrl;
    const repoName = data_.repositoryName;
    const unitId = data_.unitId;
    const currentScore = data_.grade !== undefined && data_.grade !== null ? data_.grade : (data_.autoGrade?.score || 0);

    if (currentScore >= 100) {
        return { success: true, score: currentScore, message: "Already graded (score >= 100)." };
    }

    if (!repoUrl || !repoName || !unitId) {
        throw new HttpsError("failed-precondition", "Assignment is missing repositoryUrl, repositoryName, or unitId.");
    }

    const graderName = unitId.replace(/\.html$/, "");
    const graderUrl = `${hostingUrl}/graders/${graderName}.sh`;
    const localGraderPath = path.join("/tmp", `${graderName}_autograde.sh`);

    try {
        await downloadFile(graderUrl, localGraderPath);
        fs.chmodSync(localGraderPath, "755");

        let cloneUrl = repoUrl;
        if (token && repoUrl.startsWith("https://github.com/")) {
            cloneUrl = repoUrl.replace("https://github.com/", `https://${token}@github.com/`);
        }

        if (fs.existsSync(sandboxDir)) {
            fs.rmSync(sandboxDir, { recursive: true, force: true });
        }
        fs.mkdirSync(sandboxDir, { recursive: true });

        const localRepoPath = path.join(sandboxDir, repoName);
        execSync(`git clone ${cloneUrl} ${localRepoPath} --depth 1`, { stdio: "ignore", timeout: 60000 });
        const scoreOutput = execSync(`bash ${localGraderPath}`, { cwd: localRepoPath, encoding: "utf8", timeout: 60000 }).trim();
        const score = parseInt(scoreOutput, 10);
        if (Number.isNaN(score)) {
            throw new Error(`Invalid score output: "${scoreOutput}"`);
        }

        const now = admin.firestore.Timestamp.now();
        const historyEntry = { timestamp: now, content: `Auto-grade: ${score}/100`, action: "AUTO_GRADE" };
        const isPass = score >= 70;
        const finalStatus = isPass ? "graded" : (data_.currentStatus || "submitted");
        const learningState = isPass ? "resolved" : (data_.learningState || "blocked");

        await db.collection("assignments").doc(assignmentId).update({
            grade: score,
            tutorFeedback: `自動評鑑分數為 ${score} 分。`,
            teacherFeedback: `自動評鑑分數為 ${score} 分。`,
            status: finalStatus,
            currentStatus: finalStatus,
            learningState: learningState,
            updatedAt: now,
            submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
        });

        return { success: true, score };
    } catch (err) {
        logger.error(`[autoGradeSingleAssignment] Error grading ${assignmentId}:`, err.message);
        throw new HttpsError("internal", `Auto-grade failed: ${err.message}`);
    } finally {
        if (fs.existsSync(localGraderPath)) {
            fs.unlinkSync(localGraderPath);
        }
        if (fs.existsSync(sandboxDir)) {
            fs.rmSync(sandboxDir, { recursive: true, force: true });
        }
    }
});
