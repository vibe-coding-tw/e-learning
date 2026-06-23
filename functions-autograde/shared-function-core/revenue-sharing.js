let admin = global.__vibeFirebaseAdmin || null;

if (!admin) {
    try {
        admin = require("firebase-admin");
    } catch (_) {
        admin = null;
    }
}

if (admin && !global.__vibeFirebaseAdmin) {
    if (!admin.apps.length) {
        admin.initializeApp({
            projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "e-learning-942f7"
        });
    }
    global.__vibeFirebaseAdmin = admin;
}

function getAdmin() {
    if (global.__vibeFirebaseAdmin && global.__vibeFirebaseAdmin.firestore) {
        return global.__vibeFirebaseAdmin;
    }
    if (admin && admin.firestore) {
        return admin;
    }
    if (!global.__vibeFirebaseAdmin || !global.__vibeFirebaseAdmin.firestore) {
        throw new Error("firebase-admin is not initialized for shared-function-core/revenue-sharing");
    }
    return global.__vibeFirebaseAdmin;
}

function normalizeText(value = "") {
    return String(value || "").trim();
}

function round2Amount(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function buildRevenueShareCreditRecord({
    creditId,
    orderId,
    orderItemId,
    studentUid,
    role,
    recipientEmail,
    level,
    referralLink,
    policyId,
    policySnapshot,
    orderAmount,
    totalCredit,
    validityMonths,
    monthlyInstallment,
    creditStartPeriod,
    now
} = {}) {
    const normalizedRole = String(role || "user").toLowerCase();
    const remainingCredit = round2Amount(totalCredit || 0);
    const normalizedMonthlyInstallment = round2Amount(monthlyInstallment || remainingCredit);
    return {
        creditId,
        orderId,
        orderItemId,
        studentUid,
        role: normalizedRole === "admin" ? "admin" : "user",
        recipientRole: normalizedRole,
        recipientEmail,
        level,
        referralLink,
        policyId,
        policySnapshot,
        orderAmount,
        totalCredit: round2Amount(totalCredit || 0),
        paidCredit: 0,
        remainingCredit,
        validityMonths: Math.max(1, Number(validityMonths || 1)),
        monthlyInstallment: normalizedMonthlyInstallment > 0 ? normalizedMonthlyInstallment : remainingCredit,
        startPeriod: creditStartPeriod,
        nextPayoutPeriod: creditStartPeriod,
        status: "active",
        createdAt: now,
        updatedAt: now
    };
}

function buildRevenueSharePayoutRow({
    idempotencyKey,
    credit,
    recipientEmail,
    paidAmount,
    plannedPay,
    blockedAmount,
    payoutAccountPresent,
    targetPeriod
} = {}) {
    const normalizedRole = String(credit.role || credit.recipientRole || "user").toLowerCase();
    return {
        idempotencyKey,
        role: normalizedRole === "admin" ? "admin" : "user",
        recipientRole: normalizedRole,
        tutorEmail: recipientEmail,
        recipientEmail,
        studentUid: credit.studentUid || "",
        orderId: credit.orderId || "",
        orderItemId: credit.orderItemId || "",
        orderAmount: round2Amount(credit.orderAmount || 0),
        shareAmount: paidAmount,
        plannedShareAmount: round2Amount(plannedPay),
        blockedShareAmount: round2Amount(blockedAmount),
        level: Number(credit.level || 1),
        referralLink: credit.referralLink || null,
        policyId: credit.policyId || "",
        policySnapshot: credit.policySnapshot || null,
        creditId: credit.creditId || "",
        payoutStatus: payoutAccountPresent ? "scheduled" : "missing_payout_account",
        payoutAccountPresent: Boolean(payoutAccountPresent),
        calculatedAt: getAdmin().firestore.FieldValue.serverTimestamp(),
        period: targetPeriod
    };
}

function buildRevenueShareBalanceRecord({
    recipientEmail,
    totalCredit = 0,
    totalPaid = 0,
    remainingBalance = 0,
    activeCredits = 0,
    pendingAccountCredits = 0
} = {}) {
    return {
        recipientEmail,
        totalCredit: round2Amount(totalCredit),
        totalPaid: round2Amount(totalPaid),
        remainingBalance: round2Amount(remainingBalance),
        activeCredits,
        pendingAccountCredits
    };
}

function buildRevenueSharePolicySnapshot(policy = {}) {
    return {
        policyId: policy.policyId || "",
        policyName: policy.policyName || "",
        tutorRate: Number(policy.tutorRate || 0),
        tutorUplineRate: Number(policy.tutorUplineRate || 0),
        agentRate: Number(policy.agentRate || 0),
        agentUplineRate: Number(policy.agentUplineRate || 0),
        courseDevRate: Number(policy.courseDevRate || 0),
        courseDevUplineRate: Number(policy.courseDevUplineRate || 0)
    };
}

async function collectRevenueShareChainTargets({
    targets = [],
    role,
    initialEmail = "",
    initialShare = 0,
    initialNextEmail = "",
    uplineRate = 0,
    stopEmail = "",
    getNextEmail,
    minShare = 0.01
} = {}) {
    let currentEmail = normalizeText(initialEmail).toLowerCase();
    let currentShare = Number(initialShare || 0);
    let currentNextEmail = normalizeText(initialNextEmail).toLowerCase().toLowerCase();
    let level = 1;

    while (currentEmail && currentShare >= minShare) {
        targets.push({
            role,
            recipientEmail: currentEmail,
            shareAmount: round2Amount(currentShare),
            level
        });
        if (stopEmail && currentEmail === normalizeText(stopEmail).toLowerCase()) break;
        const nextEmail = currentNextEmail || (typeof getNextEmail === "function" ? await getNextEmail(currentEmail) : "");
        if (!nextEmail || normalizeText(nextEmail).toLowerCase() === currentEmail) break;
        currentEmail = normalizeText(nextEmail).toLowerCase();
        currentShare = currentShare * Number(uplineRate || 0);
        currentNextEmail = typeof getNextEmail === "function"
            ? normalizeText(await getNextEmail(currentEmail)).toLowerCase()
            : "";
        level++;
    }

    return targets;
}

const DEFAULT_REVENUE_SHARE_POLICY = Object.freeze({
    policyId: "default-v1",
    policyName: "Default Sharing Policy",
    tutorRate: 0.2,
    tutorUplineRate: 0.2,
    agentRate: 0.2,
    agentUplineRate: 0,
    courseDevRate: 0.2,
    courseDevUplineRate: 0.1,
    enabled: true
});

async function resolveRevenueShareRoleEmails({ itemValue, order, initialTutor, getUserByEmail }) {
    const itemAgent = normalizeText(
        itemValue?.agentEmail ||
        itemValue?.referredAgentEmail ||
        itemValue?.referralAgent ||
        ""
    ).toLowerCase();
    const orderAgent = normalizeText(order?.agentEmail || "").toLowerCase();
    const tutorData = await getUserByEmail(initialTutor);
    const tutorAgent = normalizeText(tutorData?.agentEmail || "").toLowerCase().toLowerCase();
    const resolvedAgent = itemAgent || orderAgent || tutorAgent || "";

    const courseDev = normalizeText(
        itemValue?.courseDevEmail ||
        itemValue?.ownerTutorEmail ||
        order?.courseDevEmail ||
        ""
    ).toLowerCase();
    const courseDevData = courseDev ? await getUserByEmail(courseDev) : null;
    const courseDevUpline = normalizeText(
        courseDevData?.courseDevEmail ||
        courseDevData?.tutorEmail ||
        ""
    ).toLowerCase();

    return {
        agentEmail: resolvedAgent,
        courseDevEmail: courseDev,
        courseDevUplineEmail: courseDevUpline
    };
}

async function loadRevenueSharePolicy({ db, policyCache, policyId = "" } = {}) {
    const requestedId = normalizeText(policyId) || DEFAULT_REVENUE_SHARE_POLICY.policyId;
    const normalized = DEFAULT_REVENUE_SHARE_POLICY.policyId;
    if (requestedId !== normalized) {
        console.warn(`[sharing] policy ${requestedId} is deprecated; using ${normalized}.`);
    }
    if (policyCache.has(normalized)) return policyCache.get(normalized);

    let policy = DEFAULT_REVENUE_SHARE_POLICY;
    try {
        const snap = await db.collection("revenue_share_policies").doc(normalized).get();
        if (snap.exists) {
            const raw = snap.data() || {};
            policy = {
                policyId: normalized,
                policyName: raw.policyName || raw.name || normalized,
                tutorRate: Number(raw.tutorRate ?? DEFAULT_REVENUE_SHARE_POLICY.tutorRate),
                tutorUplineRate: Number(raw.tutorUplineRate ?? DEFAULT_REVENUE_SHARE_POLICY.tutorUplineRate),
                agentRate: Number(raw.agentRate ?? DEFAULT_REVENUE_SHARE_POLICY.agentRate),
                agentUplineRate: Number(raw.agentUplineRate ?? DEFAULT_REVENUE_SHARE_POLICY.agentUplineRate),
                courseDevRate: Number(raw.courseDevRate ?? DEFAULT_REVENUE_SHARE_POLICY.courseDevRate),
                courseDevUplineRate: Number(raw.courseDevUplineRate ?? DEFAULT_REVENUE_SHARE_POLICY.courseDevUplineRate),
                enabled: raw.enabled !== false
            };
            if (!policy.enabled) {
                console.warn(`[sharing] policy disabled (${normalized}), fallback to default.`);
                policy = DEFAULT_REVENUE_SHARE_POLICY;
            }
        } else {
            console.warn(`[sharing] policy not found (${normalized}), fallback to default.`);
            policy = DEFAULT_REVENUE_SHARE_POLICY;
        }
    } catch (e) {
        console.warn(`[sharing] load policy failed (${normalized}), fallback to default:`, e.message || e);
        policy = DEFAULT_REVENUE_SHARE_POLICY;
    }

    policyCache.set(normalized, policy);
    return policy;
}

module.exports = {
    DEFAULT_REVENUE_SHARE_POLICY,
    buildRevenueShareBalanceRecord,
    buildRevenueShareCreditRecord,
    buildRevenueSharePolicySnapshot,
    buildRevenueSharePayoutRow,
    collectRevenueShareChainTargets,
    loadRevenueSharePolicy,
    resolveRevenueShareRoleEmails,
    round2Amount
};
