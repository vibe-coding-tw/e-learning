const admin = require("firebase-admin");
const { sendAutogradeResultToStudent, sendAutogradeResultToTutor } = require("../emailService");
const { upsertGithubActionsVariable } = require("./github-utils");

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeEmail(value = "") {
    return normalizeText(value).toLowerCase();
}

function cleanUnitId(unitId) {
    return normalizeText(unitId).replace(/\.html$/i, "");
}

function buildAssignmentSubmissionRecord({
    docId,
    userId,
    userEmail,
    userName,
    courseId,
    unitId,
    assignmentId,
    title,
    url,
    note,
    finalStatus,
    assignmentType,
    assignedTutorEmail,
    existingLearningState = 'in_progress'
} = {}) {
    return {
        id: docId,
        userId,
        userEmail,
        userName,
        courseId: courseId || "unknown_course",
        unitId: unitId || "unknown_unit",
        assignmentId,
        assignmentTitle: title || assignmentId,
        assignmentUrl: url || "",
        studentNote: note || "",
        status: finalStatus,
        currentStatus: finalStatus,
        assignmentType: assignmentType || "manual",
        assignedTutorEmail,
        learningState: existingLearningState || 'in_progress'
    };
}

function buildNativeRepositoryAssignmentRecord({
    uid,
    email,
    courseId,
    unitId,
    assignmentTitle,
    assignmentId,
    repositoryUrl,
    repositoryName,
    feedbackPullRequestUrl,
    assignedTutorEmail,
    now,
    createdVia = 'native-api'
} = {}) {
    return {
        userId: uid,
        userEmail: email || '',
        courseId,
        unitId,
        assignmentTitle: assignmentTitle || unitId,
        assignmentId,
        repositoryUrl,
        repositoryName,
        feedbackPullRequestUrl,
        createdVia,
        currentStatus: 'started',
        assignedTutorEmail: assignedTutorEmail || '',
        updatedAt: now
    };
}

function buildGithubAutogradePayload({
    score,
    maxScore,
    scoreRaw,
    maxScoreRaw,
    payload = {},
    now,
    learningStateUpdate = null
} = {}) {
    const autoGrade = {
        score,
        maxScore: Number.isFinite(maxScore) ? maxScore : null,
        status: payload.status || payload.conclusion || "completed",
        source: "github_actions",
        runUrl: payload.runUrl || payload.html_url || payload.workflow_run?.html_url || null,
        repository: payload.repository?.full_name || payload.repo || null,
        workflow: payload.workflow || payload.workflow_run?.name || null,
        commitSha: payload.commitSha || payload.head_sha || payload.workflow_run?.head_sha || null,
        actor: payload.actor || payload.sender?.login || null,
        summary: payload.summary || payload.feedback || null,
        updatedAt: now
    };

    const updatePayload = {
        autoGrade,
        autoGradeRaw: {
            score: scoreRaw,
            maxScore: maxScoreRaw,
            status: payload.status || payload.conclusion || null,
            runUrl: payload.runUrl || payload.html_url || payload.workflow_run?.html_url || null
        },
        autoGradeSource: "github_actions",
        autoGradeUpdatedAt: now,
        updatedAt: now
    };

    if (learningStateUpdate) {
        updatePayload.learningState = learningStateUpdate;
    }

    return updatePayload;
}

function toComparableTimeMs(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value === "number") return value;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function rankAutogradeAssignmentStatus(status = "") {
    const s = String(status || "").toLowerCase();
    if (s === "graded") return 0;
    if (s === "submitted") return 1;
    if (s === "started") return 9;
    return 5;
}

function compareAutogradeAssignmentCandidates(a, b) {
    const sr = rankAutogradeAssignmentStatus(a.data.currentStatus) - rankAutogradeAssignmentStatus(b.data.currentStatus);
    if (sr !== 0) return sr;
    return toComparableTimeMs(b.data.updatedAt) - toComparableTimeMs(a.data.updatedAt);
}

function inferAutogradeUnitIdFromRepo(repoFullName = "") {
    const repoName = String(repoFullName || "").split("/").pop() || "";
    const m = repoName.match(/((?:\d{2}|start-\d{2}|basic-\d{2}|adv-\d{2})-unit-[a-z0-9-]+)/i);
    if (!m || !m[1]) return null;
    return `${m[1].toLowerCase()}.html`;
}

async function resolveAutogradeAssignmentDocId(db, {
    assignmentDocId = null,
    userId = null,
    assignmentId = null,
    unitIdFromPayload = null,
    repositoryFullName = ""
} = {}) {
    let resolvedDocId = assignmentDocId || (userId && unitIdFromPayload ? `${userId}_${(unitIdFromPayload || "").replace(/\.html$/, "")}` : null);
    const effectiveUnitId = (unitIdFromPayload || assignmentId || "").replace(/\.html$/, "");

    if (resolvedDocId || !effectiveUnitId) {
        return { resolvedDocId, inferredUnitId: null, candidateCount: 0 };
    }

    const inferredUnitId = unitIdFromPayload || inferAutogradeUnitIdFromRepo(repositoryFullName);
    if (!inferredUnitId) {
        return { resolvedDocId: null, inferredUnitId: null, candidateCount: 0 };
    }

    const unitCandidates = Array.from(new Set([
        cleanUnitId(inferredUnitId || ""),
        normalizeText(inferredUnitId || "").replace(/\.html$/, ''),
    ].filter(Boolean)));

    const candidateDocs = [];
    for (const unitCandidate of unitCandidates) {
        const snap = await db.collection("assignments").where("unitId", "==", unitCandidate).limit(200).get();
        snap.forEach((doc) => candidateDocs.push(doc));
    }

    const dedup = new Map();
    for (const doc of candidateDocs) dedup.set(doc.id, doc);
    let candidates = Array.from(dedup.values()).map((doc) => ({ id: doc.id, data: doc.data() || {} }));

    if (repositoryFullName) {
        const strictMatched = candidates.filter((row) => String(row.data.assignmentUrl || "").includes(repositoryFullName));
        if (strictMatched.length > 0) candidates = strictMatched;
    }

    if (userId) {
        candidates = candidates.filter((row) => String(row.data.userId || row.data.uid || "") === String(userId));
    }

    if (assignmentId) {
        const exactMatched = candidates.filter((row) => String(row.data.assignmentId || "") === String(assignmentId));
        if (exactMatched.length > 0) candidates = exactMatched;
    }

    candidates.sort(compareAutogradeAssignmentCandidates);

    if (candidates.length === 1) {
        resolvedDocId = candidates[0].id;
    }

    return {
        resolvedDocId,
        inferredUnitId,
        candidateCount: candidates.length,
        candidateIds: candidates.slice(0, 20).map((c) => c.id)
    };
}

async function backfillAutogradeGithubVariables({
    repositoryFullName = "",
    assignmentData = {},
    userId = "",
    unitIdFromPayload = "",
    assignmentId = ""
} = {}, githubOrgAdminToken) {
    const repoFullName = String(repositoryFullName || "");
    const parts = repoFullName.split("/");
    if (parts.length !== 2) return;

    const [owner, repo] = parts;
    const backfillUserId = assignmentData.userId || userId;
    const backfillUnitId = (assignmentData.unitId || unitIdFromPayload || assignmentId || "").replace(/\.html$/, "");
    const backfillUnitKey = normalizeTemplateRepoName(backfillUnitId);

    if (!backfillUserId || !backfillUnitId) return;

    const upsertUserRes = await upsertGithubActionsVariable(githubOrgAdminToken, {
        owner,
        repo,
        name: "VC_USER_ID",
        value: String(backfillUserId)
    });
    const upsertUnitRes = await upsertGithubActionsVariable(githubOrgAdminToken, {
        owner,
        repo,
        name: "VC_UNIT_ID",
        value: String(backfillUnitId)
    });
    const upsertUnitKeyRes = backfillUnitKey ? await upsertGithubActionsVariable(githubOrgAdminToken, {
        owner,
        repo,
        name: "VC_UNIT_KEY",
        value: String(backfillUnitKey)
    }) : { ok: true };

    if (!upsertUserRes.ok || !upsertUnitRes.ok || !upsertUnitKeyRes.ok) {
        console.warn("[ingestGithubAutograde] Failed to backfill variables:", {
            repositoryFullName: repoFullName,
            backfillUserId,
            backfillUnitId,
            backfillUnitKey,
            upsertUserRes,
            upsertUnitRes,
            upsertUnitKeyRes
        });
    }
}

async function sendAutogradeNotifications({
    assignmentData = {},
    resolvedDocId = "",
    score,
    maxScore,
    updatePayload = {}
} = {}) {
    const dashboardUrl = assignmentData.unitId
        ? `https://vibe-coding.tw/dashboard.html?unitId=${encodeURIComponent(assignmentData.unitId)}&tab=assignments`
        : 'https://vibe-coding.tw/dashboard.html?tab=assignments';
    const assignmentTitle = assignmentData.assignmentTitle || assignmentData.assignmentId || resolvedDocId;
    const studentEmail = assignmentData.userEmail || assignmentData.studentEmail || '';
    const studentName = assignmentData.userName || assignmentData.studentName || '';
    const tutorEmail = assignmentData.assignedTutorEmail || '';
    const resolvedUnitId = assignmentData.unitId || (resolvedDocId && resolvedDocId.includes('_') ? resolvedDocId.split('_').pop() : '');
    const runUrl = updatePayload.autoGrade?.runUrl || '';

    await sendAutogradeResultToStudent(
        studentEmail,
        studentName,
        assignmentTitle,
        score,
        Number.isFinite(maxScore) ? maxScore : null,
        dashboardUrl,
        runUrl,
        resolvedUnitId
    );

    await sendAutogradeResultToTutor(
        tutorEmail,
        studentName || studentEmail || '學生',
        assignmentTitle,
        score,
        Number.isFinite(maxScore) ? maxScore : null,
        dashboardUrl,
        runUrl,
        resolvedUnitId
    );
}

function queryActiveAssignmentInterventions(db, assignmentId, studentUid) {
    return db.collection('assignment_interventions')
        .where('assignmentId', '==', assignmentId)
        .where('studentUid', '==', studentUid)
        .where('status', 'in', ['open', 'in_progress']);
}

async function updateActiveAssignmentInterventions(db, {
    assignmentId,
    studentUid,
    status,
    updatedAt,
    ownerTutorEmail = null,
    resolvedAt = null
} = {}) {
    const interventionsSnap = await queryActiveAssignmentInterventions(db, assignmentId, studentUid).get();

    if (interventionsSnap.empty) {
        return 0;
    }

    const batch = db.batch();
    interventionsSnap.forEach(interventionDoc => {
        const payload = {
            status,
            updatedAt
        };
        if (ownerTutorEmail !== null) payload.ownerTutorEmail = ownerTutorEmail;
        if (resolvedAt !== null) payload.resolvedAt = resolvedAt;
        batch.update(interventionDoc.ref, payload);
    });
    await batch.commit();
    return interventionsSnap.size;
}

async function syncAutoGradeInterventions(db, {
    assignmentId,
    studentUid,
    ownerTutorEmail,
    score,
    now,
    assignmentLearningState = ''
} = {}) {
    const activeInterventionsQuery = queryActiveAssignmentInterventions(db, assignmentId, studentUid);

    if (score < 70) {
        const interventionsSnap = await activeInterventionsQuery.limit(1).get();
        if (interventionsSnap.empty) {
            const newInterventionRef = db.collection('assignment_interventions').doc();
            await newInterventionRef.set({
                assignmentId,
                studentUid,
                triggerScore: score,
                threshold: 70,
                status: 'open',
                ownerTutorEmail,
                createdAt: now,
                updatedAt: now
            });
        }
        return 'blocked';
    }

    await updateActiveAssignmentInterventions(db, {
        assignmentId,
        studentUid,
        status: 'resolved',
        updatedAt: now,
        resolvedAt: now,
        ownerTutorEmail: null
    });

    return assignmentLearningState === 'blocked' ? 'resolved' : null;
}

async function addAssignmentHistoryEntry(docRef, patch = {}, historyEntry, method = 'update') {
    const payload = {
        ...patch,
        updatedAt: patch.updatedAt || admin.firestore.Timestamp.now(),
        submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
    };

    if (method === 'set') {
        return docRef.set(payload, { merge: true });
    }

    return docRef.update(payload);
}

function isAssignmentAuthorized({ targetUid, uid, requesterRole, requesterHasTutorAccess, assignmentTutor, requesterEmail, mappedCid, authorizedCourseIds, unitId }) {
    return (targetUid === uid) ||
        (requesterRole === 'admin') ||
        (requesterHasTutorAccess && (
            assignmentTutor === requesterEmail ||
            authorizedCourseIds.includes(mappedCid) ||
            (unitId && authorizedCourseIds.some(() => false))
        ));
}

function normalizeTemplateRepoName(id) {
    const v = normalizeText(id || '');
    if (/^(common|car-(starter|basic|advanced))-/i.test(v)) return v;
    if (/^tw-(common|car-(starter|basic|advanced))-/i.test(v)) return v.replace(/^tw-/i, '');
    if (/^start-\d{2}-unit-/i.test(v)) return v.replace(/^start-\d{2}-unit-/i, 'car-starter-');
    if (/^basic-\d{2}-unit-/i.test(v)) return v.replace(/^basic-\d{2}-unit-/i, 'car-basic-');
    if (/^(adv|advanced)-\d{2}-unit-/i.test(v)) return v.replace(/^(adv|advanced)-\d{2}-unit-/i, 'car-advanced-');
    if (/^\d{2}-unit-/i.test(v)) return v.replace(/^\d{2}-unit-/i, 'common-');
    return v;
}

module.exports = {
    addAssignmentHistoryEntry,
    backfillAutogradeGithubVariables,
    buildAssignmentSubmissionRecord,
    buildGithubAutogradePayload,
    buildNativeRepositoryAssignmentRecord,
    compareAutogradeAssignmentCandidates,
    isAssignmentAuthorized,
    queryActiveAssignmentInterventions,
    resolveAutogradeAssignmentDocId,
    sendAutogradeNotifications,
    syncAutoGradeInterventions,
    updateActiveAssignmentInterventions
};
