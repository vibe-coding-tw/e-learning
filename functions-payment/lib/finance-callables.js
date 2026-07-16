"use strict";
const admin = require("firebase-admin");
const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

const {
    assertAuthenticated,
    assertRequiredValue,
    isAdminEmail,
    normalizeEmail,
    normalizeText
} = require("vibe-functions-core/access-utils-core");
const {
    DEFAULT_REVENUE_SHARE_POLICY,
    buildRevenueShareBalanceRecord,
    buildRevenueShareCreditRecord,
    buildRevenueSharePolicySnapshot,
    buildRevenueSharePayoutRow,
    collectRevenueShareChainTargets,
    loadRevenueSharePolicy,
    resolveRevenueShareRoleEmails
} = require("vibe-functions-core/revenue-sharing");
const {
    issueInvestorEquity,
    loadActiveBalanceSheetSnapshot,
    loadActiveValuationSnapshot,
    loadBalanceSheetSnapshots,
    loadInvestorConfig,
    loadInvestorProfiles,
    loadValuationSnapshots,
    recordInvestorFinanceEvent,
    round2Amount,
    settleAnnualInvestorDividends,
    upsertBalanceSheetSnapshot,
    upsertValuationSnapshot
} = require("vibe-functions-core/investor-ledger");
const {
    exportLedgerReport,
    generateLedgerReport,
    recordLedgerEvent
} = require("vibe-functions-core/ledger-engine");
const {
    getPayoutAccountFromUser
} = require("vibe-functions-core/distributor-utils-core");

const db = admin.firestore();

function resolveAdminRole(userData = {}, fallbackEmail = "") {
    if (typeof isAdminEmail === "function" && isAdminEmail(userData.email || fallbackEmail)) return "admin";
    return userData.role === "admin" ? "admin" : "user";
}

async function findUserDocByEmail(dbRef, email = "") {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    const userSnap = await dbRef.collection("users")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();
    return userSnap.empty ? null : userSnap.docs[0];
}

const getRevenueSharePolicies = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can read revenue policies.");

    const policyCache = new Map();
    const policy = await loadRevenueSharePolicy({ db: dbRef, policyCache });
    return {
        policies: [{
            id: policy.policyId || DEFAULT_REVENUE_SHARE_POLICY.policyId,
            policyId: policy.policyId || DEFAULT_REVENUE_SHARE_POLICY.policyId,
            ...buildRevenueSharePolicySnapshot(policy),
            enabled: policy.enabled !== false
        }]
    };
});

const upsertRevenueSharePolicy = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can write revenue policies.");

    const payload = request.data || {};
    const policyId = normalizeText(payload.policyId || "");
    assertRequiredValue(policyId, "policyId is required");
    if (policyId !== DEFAULT_REVENUE_SHARE_POLICY.policyId) {
        throw new HttpsError("failed-precondition", "Only the default revenue sharing policy is supported.");
    }

    const asRate = (value, fallback = 0) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        if (n < 0) return 0;
        if (n > 1) return 1;
        return n;
    };

    await dbRef.collection("revenue_share_policies").doc(policyId).set({
        policyId,
        policyName: normalizeText(payload.policyName || payload.name || policyId) || policyId,
        tutorRate: asRate(payload.tutorRate, DEFAULT_REVENUE_SHARE_POLICY.tutorRate),
        tutorUplineRate: asRate(payload.tutorUplineRate, DEFAULT_REVENUE_SHARE_POLICY.tutorUplineRate),
        agentRate: asRate(payload.agentRate, DEFAULT_REVENUE_SHARE_POLICY.agentRate),
        agentUplineRate: asRate(payload.agentUplineRate, DEFAULT_REVENUE_SHARE_POLICY.agentUplineRate),
        courseDevRate: asRate(payload.courseDevRate, DEFAULT_REVENUE_SHARE_POLICY.courseDevRate),
        courseDevUplineRate: asRate(payload.courseDevUplineRate, DEFAULT_REVENUE_SHARE_POLICY.courseDevUplineRate),
        enabled: payload.enabled !== false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, policyId };
});

const getInvestorProfiles = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can read investor profiles.");

    const profileCache = new Map();
    const configCache = new Map();
    const snapshotCache = new Map();
    const [profiles, config] = await Promise.all([
        loadInvestorProfiles({ db: dbRef, profileCache }),
        loadInvestorConfig({ db: dbRef, configCache })
    ]);
    const [valuationSnapshots, activeValuationSnapshot, balanceSheetSnapshots, activeBalanceSheetSnapshot] = await Promise.all([
        loadValuationSnapshots({ db: dbRef, snapshotCache }),
        loadActiveValuationSnapshot({ db: dbRef, snapshotCache }),
        loadBalanceSheetSnapshots({ db: dbRef, snapshotCache }),
        loadActiveBalanceSheetSnapshot({ db: dbRef, snapshotCache })
    ]);

    const balancesSnap = await dbRef.collection("investor_balances").get();
    const balancesByInvestor = new Map(
        balancesSnap.docs.map((doc) => [String((doc.data() || {}).investorId || doc.id), { id: doc.id, ...(doc.data() || {}) }])
    );
    const positionsSnap = await dbRef.collection("investor_equity_positions").get();
    const positionsByInvestor = new Map(
        positionsSnap.docs.map((doc) => [String((doc.data() || {}).investorId || doc.id), { id: doc.id, ...(doc.data() || {}) }])
    );
    const issuancesSnap = await dbRef.collection("equity_issuances").orderBy("createdAt", "desc").limit(25).get();
    const recentIssuances = issuancesSnap.docs.map((doc) => ({ issuanceId: doc.id, ...(doc.data() || {}) }));

    return {
        config,
        valuationSnapshots,
        activeValuationSnapshot,
        balanceSheetSnapshots,
        activeBalanceSheetSnapshot,
        profiles: profiles.map((profile) => {
            const balance = balancesByInvestor.get(profile.investorId) || {};
            const position = positionsByInvestor.get(profile.investorId) || {};
            return {
                ...profile,
                currentBalance: Number(balance.currentBalance || 0),
                lastSettlementYear: balance.lastSettlementYear || null,
                lastCreditEventId: balance.lastCreditEventId || null,
                equityShares: Number(position.totalIssuedShares || profile.equityShares || profile.shareUnits || 0),
                ownershipPct: Number(position.ownershipPct || profile.ownershipPct || 0),
                valuationId: position.valuationId || profile.valuationId || "",
                participantType: position.participantType || profile.participantType || "investor",
                latestIssuanceId: position.latestIssuanceId || null
            };
        }),
        equityPositions: Array.from(positionsByInvestor.values()),
        recentIssuances
    };
});

const upsertInvestorProfile = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can write investor profiles.");

    const payload = request.data || {};
    const investorId = normalizeText(payload.investorId || payload.id || "");
    assertRequiredValue(investorId, "investorId is required");

    const shareUnits = Number(payload.shareUnits || payload.share || 0);
    if (!Number.isFinite(shareUnits) || shareUnits < 0) {
        throw new HttpsError("invalid-argument", "shareUnits must be a non-negative number.");
    }

    await dbRef.collection("investor_profiles").doc(investorId).set({
        investorId,
        investorName: normalizeText(payload.investorName || payload.name || investorId) || investorId,
        investorEmail: normalizeText(payload.investorEmail || payload.email || "").toLowerCase(),
        participantType: normalizeText(payload.participantType || "investor"),
        shareUnits: Math.max(0, shareUnits),
        payoutAccount: normalizeText(payload.payoutAccount || payload.paymentAccount || ""),
        notes: normalizeText(payload.notes || ""),
        enabled: payload.enabled !== false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await dbRef.collection("investor_balances").doc(investorId).set({
        investorId,
        investorName: normalizeText(payload.investorName || payload.name || investorId) || investorId,
        investorEmail: normalizeText(payload.investorEmail || payload.email || "").toLowerCase(),
        participantType: normalizeText(payload.participantType || "investor"),
        shareUnits: Math.max(0, shareUnits),
        currentBalance: Number.isFinite(Number(payload.currentBalance)) ? Number(payload.currentBalance) : 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, investorId };
});

const upsertValuationSnapshotCallable = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can write valuation snapshots.");

    const payload = request.data || {};
    const snapshotCache = new Map();
    const result = await upsertValuationSnapshot({
        db: dbRef,
        payload,
        createdByUid: uid,
        snapshotCache
    });

    return { success: true, valuationId: result.valuationId, snapshot: result };
});

const upsertBalanceSheetSnapshotCallable = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can write balance sheet snapshots.");

    const payload = request.data || {};
    const snapshotCache = new Map();
    const result = await upsertBalanceSheetSnapshot({
        db: dbRef,
        payload,
        createdByUid: uid,
        snapshotCache
    });

    return { success: true, snapshotId: result.snapshotId, snapshot: result };
});

const issueInvestorEquityCallable = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can issue investor equity.");

    const payload = request.data || {};
    const profileCache = new Map();
    const snapshotCache = new Map();
    const result = await issueInvestorEquity({
        db: dbRef,
        payload,
        createdByUid: uid,
        profileCache,
        snapshotCache
    });

    return { success: true, ...result };
});

const recordInvestorFinanceEventCallable = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can record investor events.");

    const payload = request.data || {};
    const profileCache = new Map();
    const result = await recordInvestorFinanceEvent({
        db: dbRef,
        profileCache,
        payload,
        createdByUid: uid
    });

    return { success: true, ...result };
});

const settleAnnualInvestorDividendsCallable = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can settle investor dividends.");

    const payload = request.data || {};
    const targetYear = Number(payload.year || new Date().getFullYear() - 1);
    if (!Number.isFinite(targetYear)) {
        throw new HttpsError("invalid-argument", "year must be a number.");
    }

    const profileCache = new Map();
    const configCache = new Map();
    const result = await settleAnnualInvestorDividends({
        db: dbRef,
        year: targetYear,
        profileCache,
        configCache,
        createdByUid: uid
    });

    return { success: true, ...result };
});

const recordLedgerEventCallable = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can record ledger events.");

    const payload = request.data || {};
    const result = await recordLedgerEvent({
        db: dbRef,
        payload,
        createdByUid: uid,
        autoGenerateReports: payload.autoGenerateReports !== false
    });

    return { success: true, ...result };
});

const generateLedgerReportCallable = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can generate ledger reports.");

    const payload = request.data || {};
    const period = String(payload.period || "").trim();
    const reportType = String(payload.reportType || "trial_balance").trim();
    if (!period) {
        throw new HttpsError("invalid-argument", "period is required.");
    }

    const report = await generateLedgerReport({
        db: dbRef,
        period,
        reportType,
        createdByUid: uid
    });

    return { success: true, report };
});

const exportLedgerReportCallable = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can export ledger reports.");

    const payload = request.data || {};
    const period = String(payload.period || "").trim();
    const reportType = String(payload.reportType || "trial_balance").trim();
    const format = String(payload.format || "csv").trim();
    if (!period) {
        throw new HttpsError("invalid-argument", "period is required.");
    }

    const result = await exportLedgerReport({
        db: dbRef,
        period,
        reportType,
        format,
        createdByUid: uid
    });

    return { success: true, ...result };
});

const recordOrderRefundEventCallable = onCall(async (request) => {
    const dbRef = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, "請先登入");
    const userDoc = await dbRef.collection("users").doc(uid).get();
    assertAdminRole(resolveAdminRole(userDoc.data() || {}, request.auth?.token?.email || ""), "Only admins can record order refunds.");

    const payload = request.data || {};
    const orderId = String(payload.orderId || "").trim();
    if (!orderId) {
        throw new HttpsError("invalid-argument", "orderId is required.");
    }

    const orderRef = dbRef.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
        throw new HttpsError("not-found", `Order ${orderId} not found.`);
    }

    const order = orderSnap.data() || {};
    const refundAmount = Number(payload.amount || order.amount || order.totalAmount || 0);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        throw new HttpsError("invalid-argument", "refund amount must be greater than 0.");
    }

    const rawRefundAtDate = payload.refundAtDate ? new Date(payload.refundAtDate) : new Date();
    const refundAtDate = Number.isNaN(rawRefundAtDate.getTime()) ? new Date() : rawRefundAtDate;
    const orderCurrency = String(order.currency || payload.currency || "TWD").toUpperCase();
    const taxAmount = Number(payload.taxAmount ?? order.taxAmount ?? 0) || 0;
    const netAmount = taxAmount > 0 ? Math.max(0, refundAmount - taxAmount) : refundAmount;

    const result = await recordLedgerEvent({
        db: dbRef,
        payload: {
            eventType: "order.refunded",
            sourceType: "order",
            sourceId: payload.refundId || `${orderId}|refund|${refundAtDate.toISOString().slice(0, 10)}`,
            sourceLabel: `Order refund ${orderId}`,
            entityType: "order",
            entityId: orderId,
            amount: refundAmount,
            currency: orderCurrency,
            occurredAtDate: refundAtDate,
            metadata: {
                orderId,
                studentUid: order.uid || "",
                refundReason: String(payload.reason || order.refundReason || ""),
                refundAccount: String(payload.refundAccount || "expense:sales_returns"),
                taxAmount,
                netAmount,
                cashAccount: "asset:cash",
                note: String(payload.note || `Refund recorded for order ${orderId}`)
            }
        },
        createdByUid: uid,
        autoGenerateReports: true
    });

    const updateData = {
        status: "REFUNDED",
        refundAmount: refundAmount,
        refundReason: String(payload.reason || order.refundReason || ""),
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        refundedByUid: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await orderRef.set(updateData, { merge: true });

    return { success: true, ...result };
});

/* Dead code (2026-07-15 確認)：此函式目前無任何 trigger 或排程呼叫。
 * 需要財務/結算流程負責人確認後，才能接上 REST/callable 入口或恢復排程。
 * 詳見 AGENT.md §分潤計算 及 docs/distributor/distributor-tutor-api-contract.md */
async function calculateMonthlySharing() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    logger.info(`Starting profit sharing calculation for: ${lastMonth.toISOString()} to ${endOfLastMonth.toISOString()}`);

    const policyCache = new Map();
    const userByEmailCache = new Map();
    const balanceAgg = new Map();
    const ymFromDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const parseYm = (ym) => {
        const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ""));
        if (!m) return null;
        return { y: Number(m[1]), m: Number(m[2]) };
    };
    const addMonthsYm = (ym, delta) => {
        const parsed = parseYm(ym);
        if (!parsed) return ym;
        const d = new Date(parsed.y, parsed.m - 1 + Number(delta || 0), 1);
        return ymFromDate(d);
    };
    const ymLTE = (a, b) => String(a || "") <= String(b || "");
    const countValidityMonths = (paidAtTs, expiryTs, fallbackMonths = 12) => {
        try {
            if (!paidAtTs?.toDate || !expiryTs?.toDate) return Math.max(1, Number(fallbackMonths || 12));
            const p = paidAtTs.toDate();
            const e = expiryTs.toDate();
            let months = (e.getFullYear() - p.getFullYear()) * 12 + (e.getMonth() - p.getMonth());
            if (e.getDate() >= p.getDate()) months += 1;
            return Math.max(1, months);
        } catch {
            return Math.max(1, Number(fallbackMonths || 12));
        }
    };
    const getUserByEmail = async (email = "") => {
        const normalized = normalizeEmail(email);
        if (!normalized) return null;
        if (userByEmailCache.has(normalized)) return userByEmailCache.get(normalized);
        const userDoc = await findUserDocByEmail(db, normalized);
        const userData = userDoc ? (userDoc.data() || null) : null;
        userByEmailCache.set(normalized, userData);
        return userData;
    };

    try {
        const revenueConfigDoc = await db.collection("metadata_settings").doc("revenue_share_config").get();
        const revenueConfig = revenueConfigDoc.exists ? (revenueConfigDoc.data() || {}) : {};
        const defaultValidityMonths = Math.max(1, Number(revenueConfig.defaultValidityMonths || 12));
        const fallbackPayoutEmail = normalizeEmail(revenueConfig.defaultPayoutEmail || "info@vibe-coding.tw") || "info@vibe-coding.tw";
        const targetPeriod = ymFromDate(lastMonth);

        const ordersSnapshot = await db.collection("orders")
            .where("status", "==", "SUCCESS")
            .where("paidAt", ">=", admin.firestore.Timestamp.fromDate(lastMonth))
            .where("paidAt", "<=", admin.firestore.Timestamp.fromDate(endOfLastMonth))
            .get();

        const auditTrail = [];
        const creditTrail = [];
        const collectShareTargets = async ({ order, itemValue, lineAmount, policy }) => {
            const targets = [];
            const initialTutor = (itemValue?.referredTutorEmail && itemValue.referredTutorEmail.trim())
                ? normalizeEmail(itemValue.referredTutorEmail)
                : ((itemValue?.referralTutor && itemValue.referralTutor.trim()) ? normalizeEmail(itemValue.referralTutor) : fallbackPayoutEmail);

            await collectRevenueShareChainTargets({
                targets,
                role: "user",
                initialEmail: initialTutor,
                initialShare: lineAmount * Number(policy.tutorRate || DEFAULT_REVENUE_SHARE_POLICY.tutorRate),
                uplineRate: policy.tutorUplineRate || DEFAULT_REVENUE_SHARE_POLICY.tutorUplineRate,
                stopEmail: fallbackPayoutEmail,
                getNextEmail: async (currentEmail) => {
                    const tutorData = await getUserByEmail(currentEmail);
                    return normalizeEmail(tutorData?.tutorEmail || fallbackPayoutEmail);
                }
            });

            const { agentEmail, courseDevEmail, courseDevUplineEmail } = await resolveRevenueShareRoleEmails({
                itemValue,
                order,
                initialTutor,
                getUserByEmail
            });
            if (agentEmail && Number(policy.agentRate || 0) > 0) {
                await collectRevenueShareChainTargets({
                    targets,
                    role: "agent",
                    initialEmail: agentEmail,
                    initialShare: lineAmount * Number(policy.agentRate || 0),
                    uplineRate: policy.agentUplineRate || 0,
                    getNextEmail: async (currentEmail) => {
                        const agentData = await getUserByEmail(currentEmail);
                        return normalizeEmail(agentData?.agentEmail || "");
                    }
                });
            }

            if (courseDevEmail && Number(policy.courseDevRate || 0) > 0) {
                await collectRevenueShareChainTargets({
                    targets,
                    role: "courseDev",
                    initialEmail: courseDevEmail,
                    initialShare: lineAmount * Number(policy.courseDevRate || 0),
                    initialNextEmail: courseDevUplineEmail,
                    uplineRate: policy.courseDevUplineRate || 0,
                    getNextEmail: async (currentEmail) => {
                        const cdData = await getUserByEmail(currentEmail);
                        return normalizeEmail(cdData?.courseDevEmail || cdData?.tutorEmail || "");
                    }
                });
            }
            return targets;
        };

        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            const orderId = orderDoc.id;
            const studentUid = order.uid;
            const items = order.items || {};

            for (const [itemKey, itemValue] of Object.entries(items)) {
                const quantity = parseInt(itemValue?.quantity || 1, 10) || 1;
                const itemPrice = parseFloat(itemValue?.price || 0) || 0;
                const lineAmount = itemPrice * quantity;
                const itemReferralLink = itemValue?.referralLink || itemValue?.promoCode || null;
                const effectivePolicyId = normalizeText(order.policyId || "") || DEFAULT_REVENUE_SHARE_POLICY.policyId;
                const policy = await loadRevenueSharePolicy({ db, policyCache, policyId: effectivePolicyId });

                if (lineAmount <= 0) continue;

                const policySnapshot = buildRevenueSharePolicySnapshot(policy);
                const shareTargets = await collectShareTargets({
                    order,
                    itemValue,
                    lineAmount,
                    policy
                });
                const validityMonths = Math.max(
                    1,
                    Number(itemValue?.validityMonths || order?.validityMonths || countValidityMonths(order?.paidAt, order?.expiryDate, defaultValidityMonths))
                );
                const creditStartPeriod = order?.paidAt?.toDate ? ymFromDate(order.paidAt.toDate()) : targetPeriod;

                for (const target of shareTargets) {
                    const recipientEmail = normalizeEmail(target.recipientEmail || "") || fallbackPayoutEmail;
                    const totalCredit = round2Amount(target.shareAmount);
                    if (totalCredit < 0.01) continue;
                    const creditSeed = `${orderId}|${itemKey}|${target.role}|${target.level}|${recipientEmail}`;
                    const creditId = crypto.createHash("sha256").update(creditSeed).digest("hex").slice(0, 40);
                    const creditRef = db.collection("revenue_share_credits").doc(creditId);
                    const existingCredit = await creditRef.get();
                    if (!existingCredit.exists) {
                        const monthlyInstallment = round2Amount(totalCredit / validityMonths);
                        const creditDoc = buildRevenueShareCreditRecord({
                            creditId,
                            orderId,
                            orderItemId: itemKey,
                            studentUid,
                            role: target.role,
                            recipientEmail,
                            level: target.level,
                            referralLink: itemReferralLink,
                            policyId: policy.policyId,
                            policySnapshot,
                            orderAmount: lineAmount,
                            totalCredit,
                            validityMonths,
                            monthlyInstallment,
                            creditStartPeriod,
                            now: admin.firestore.FieldValue.serverTimestamp()
                        });
                        await creditRef.set(creditDoc, { merge: true });
                        creditTrail.push(creditDoc);
                    }
                }
            }
        }

        const creditsSnapshot = await db.collection("revenue_share_credits")
            .where("status", "in", ["active", "pending_account"])
            .get();

        for (const creditDoc of creditsSnapshot.docs) {
            const credit = creditDoc.data() || {};
            const recipientEmail = normalizeEmail(credit.recipientEmail || "");
            if (!recipientEmail) continue;
            const nextPayoutPeriod = String(credit.nextPayoutPeriod || credit.startPeriod || "");
            const remainingCredit = round2Amount(credit.remainingCredit || 0);
            if (!nextPayoutPeriod || remainingCredit < 0.01) continue;
            if (!ymLTE(nextPayoutPeriod, targetPeriod)) continue;

            const recipientUser = await getUserByEmail(recipientEmail);
            const payoutAccount = getPayoutAccountFromUser(recipientUser);
            const monthlyInstallment = round2Amount(credit.monthlyInstallment || 0);
            const plannedPay = Math.min(remainingCredit, monthlyInstallment > 0 ? monthlyInstallment : remainingCredit);
            const paidAmount = payoutAccount ? round2Amount(plannedPay) : 0;
            const blockedAmount = payoutAccount ? 0 : round2Amount(plannedPay);

            const idempotencySeed = `${targetPeriod}|${creditDoc.id}|payout`;
            const idempotencyKey = crypto.createHash("sha256").update(idempotencySeed).digest("hex").slice(0, 40);
            const payoutRef = db.collection("profit_ledger").doc(idempotencyKey);
            const payoutRow = buildRevenueSharePayoutRow({
                idempotencyKey,
                credit: { ...credit, creditId: creditDoc.id },
                recipientEmail,
                paidAmount,
                plannedPay,
                blockedAmount,
                payoutAccountPresent: Boolean(payoutAccount),
                targetPeriod
            });
            await payoutRef.set(payoutRow, { merge: true });
            auditTrail.push(payoutRow);

            if (paidAmount > 0) {
                try {
                    await recordLedgerEvent({
                        db,
                        payload: {
                            eventType: "commission.paid",
                            sourceType: "revenue_share_payout",
                            sourceId: idempotencyKey,
                            sourceLabel: `Revenue share payout ${idempotencyKey}`,
                            entityType: "recipient",
                            entityId: recipientEmail,
                            amount: paidAmount,
                            currency: "TWD",
                            occurredAtDate: new Date(),
                            metadata: {
                                creditId: creditDoc.id,
                                period: targetPeriod,
                                recipientEmail,
                                payoutAccountPresent: Boolean(payoutAccount),
                                role: credit.role || "",
                                orderId: credit.orderId || "",
                                orderItemId: credit.orderItemId || ""
                            }
                        },
                        createdByUid: "system",
                        autoGenerateReports: false
                    });
                } catch (ledgerErr) {
                    logger.warn(`[calculateMonthlySharing] commission payment skipped for ${idempotencyKey}:`, ledgerErr.message || ledgerErr);
                }
            }

            const newPaid = round2Amount((credit.paidCredit || 0) + paidAmount);
            const newRemaining = round2Amount((credit.remainingCredit || 0) - paidAmount);
            const isCompleted = newRemaining < 0.01;
            const nextPeriod = payoutAccount && !isCompleted ? addMonthsYm(nextPayoutPeriod, 1) : nextPayoutPeriod;
            await creditDoc.ref.set({
                paidCredit: newPaid,
                remainingCredit: Math.max(0, newRemaining),
                nextPayoutPeriod: nextPeriod,
                status: isCompleted ? "completed" : (payoutAccount ? "active" : "pending_account"),
                lastSettledPeriod: targetPeriod,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        const allCredits = await db.collection("revenue_share_credits").get();
        for (const cDoc of allCredits.docs) {
            const c = cDoc.data() || {};
            const email = normalizeEmail(c.recipientEmail || "");
            if (!email) continue;
            const acc = balanceAgg.get(email) || buildRevenueShareBalanceRecord({ recipientEmail: email });
            acc.totalCredit = round2Amount(acc.totalCredit + Number(c.totalCredit || 0));
            acc.totalPaid = round2Amount(acc.totalPaid + Number(c.paidCredit || 0));
            acc.remainingBalance = round2Amount(acc.remainingBalance + Number(c.remainingCredit || 0));
            if (String(c.status || "") === "active") acc.activeCredits += 1;
            if (String(c.status || "") === "pending_account") acc.pendingAccountCredits += 1;
            balanceAgg.set(email, acc);
        }
        for (const [email, rec] of balanceAgg.entries()) {
            const user = await getUserByEmail(email);
            const payoutAccount = getPayoutAccountFromUser(user);
            const balanceId = crypto.createHash("sha256").update(email).digest("hex").slice(0, 40);
            await db.collection("revenue_share_balances").doc(balanceId).set({
                ...rec,
                payoutAccountPresent: Boolean(payoutAccount),
                lastCalculatedPeriod: targetPeriod,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        try {
            await Promise.all([
                generateLedgerReport({ db, period: targetPeriod, reportType: "trial_balance", createdByUid: "system" }),
                generateLedgerReport({ db, period: targetPeriod, reportType: "profit_and_loss", createdByUid: "system" }),
                generateLedgerReport({ db, period: targetPeriod, reportType: "balance_sheet", createdByUid: "system" })
            ]);
            logger.info(`[calculateMonthlySharing] ✅ Ledger reports generated for period=${targetPeriod}`);
        } catch (reportErr) {
            logger.warn(`[calculateMonthlySharing] Ledger report generation skipped for period=${targetPeriod}:`, reportErr.message || reportErr);
        }

        logger.info(`Profit sharing completed. createdCredits=${creditTrail.length}, ledgerRows=${auditTrail.length}, balances=${balanceAgg.size}`);
    } catch (error) {
        logger.error("Error in calculateMonthlySharing:", error);
    }
}

async function calculateAnnualInvestorDividends() {
    const currentYear = new Date().getFullYear();
    const targetYear = currentYear - 1;
    try {
        const result = await settleAnnualInvestorDividends({
            db,
            year: targetYear,
            profileCache: new Map(),
            configCache: new Map(),
            createdByUid: "system"
        });
        logger.info(`[calculateAnnualInvestorDividends] Completed for year=${targetYear} settlements=${result.settlementCount}`);
    } catch (error) {
        logger.error("Error in calculateAnnualInvestorDividends:", error);
    }
}

function assertAdminRole(requesterRole, message = "僅限管理員執行此操作") {
    if (requesterRole !== "admin") {
        throw new HttpsError("permission-denied", message);
    }
}

module.exports = {
    getRevenueSharePolicies,
    upsertRevenueSharePolicy,
    getInvestorProfiles,
    upsertInvestorProfile,
    upsertValuationSnapshot: upsertValuationSnapshotCallable,
    upsertBalanceSheetSnapshot: upsertBalanceSheetSnapshotCallable,
    issueInvestorEquity: issueInvestorEquityCallable,
    recordInvestorFinanceEvent: recordInvestorFinanceEventCallable,
    settleAnnualInvestorDividends: settleAnnualInvestorDividendsCallable,
    recordLedgerEvent: recordLedgerEventCallable,
    generateLedgerReport: generateLedgerReportCallable,
    exportLedgerReport: exportLedgerReportCallable,
    recordOrderRefundEvent: recordOrderRefundEventCallable,
    calculateMonthlySharing,
    calculateAnnualInvestorDividends
};
