const admin = require("firebase-admin");
const crypto = require("crypto");

function normalizeText(value = "") {
    return String(value || "").trim();
}

function round2Amount(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function toTimestamp(value) {
    if (!value) return admin.firestore.FieldValue.serverTimestamp();
    if (value instanceof Date) return admin.firestore.Timestamp.fromDate(value);
    if (value?.toDate) return admin.firestore.Timestamp.fromDate(value.toDate());
    if (typeof value === "number") return admin.firestore.Timestamp.fromMillis(value);
    return admin.firestore.FieldValue.serverTimestamp();
}

function toDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (value?.toDate) return value.toDate();
    if (typeof value === "number") return new Date(value);
    return new Date();
}

function buildInvestorEventId({
    eventType = "",
    sourceType = "",
    sourceId = "",
    occurredAtDate,
    note = "",
    amount = 0
} = {}) {
    const fallbackDate = toDate(occurredAtDate).toISOString().slice(0, 10);
    const seed = [
        normalizeText(eventType).toLowerCase(),
        normalizeText(sourceType).toLowerCase(),
        normalizeText(sourceId).toLowerCase() || fallbackDate,
        round2Amount(amount).toFixed(2),
        normalizeText(note).toLowerCase()
    ].join("|");
    return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 40);
}

function buildInvestorCreditId({
    eventId = "",
    investorId = ""
} = {}) {
    return crypto.createHash("sha256").update(`${normalizeText(eventId)}|${normalizeText(investorId)}`).digest("hex").slice(0, 40);
}

function buildInvestorFinanceEventRecord({
    eventId,
    eventType,
    sourceType,
    sourceId,
    sourceLabel,
    grossAmount,
    signedAmount,
    note,
    totalShareUnits,
    investorCount,
    occurredAtDate,
    createdAt
} = {}) {
    const occurredDate = toDate(occurredAtDate);
    return {
        eventId,
        eventType: normalizeText(eventType).toLowerCase(),
        sourceType: normalizeText(sourceType).toLowerCase(),
        sourceId: normalizeText(sourceId),
        sourceLabel: normalizeText(sourceLabel),
        grossAmount: round2Amount(grossAmount || 0),
        signedAmount: round2Amount(signedAmount || 0),
        note: normalizeText(note),
        totalShareUnits: round2Amount(totalShareUnits || 0),
        investorCount: Math.max(0, Number(investorCount || 0)),
        eventYear: occurredDate.getFullYear(),
        eventMonth: String(occurredDate.getMonth() + 1).padStart(2, "0"),
        occurredAt: toTimestamp(occurredAtDate),
        createdAt: createdAt || admin.firestore.FieldValue.serverTimestamp()
    };
}

function buildInvestorCreditRecord({
    creditId,
    eventId,
    investorId,
    investorName,
    investorEmail,
    shareUnits,
    totalShareUnits,
    shareRatio,
    eventType,
    sourceType,
    sourceId,
    sourceLabel,
    grossAmount,
    allocatedAmount,
    note,
    year,
    occurredAtDate,
    createdAt
} = {}) {
    const occurredDate = toDate(occurredAtDate);
    return {
        creditId,
        eventId,
        investorId,
        investorName: normalizeText(investorName),
        investorEmail: normalizeText(investorEmail).toLowerCase(),
        shareUnits: round2Amount(shareUnits || 0),
        totalShareUnits: round2Amount(totalShareUnits || 0),
        shareRatio: round2Amount(shareRatio || 0),
        eventType: normalizeText(eventType).toLowerCase(),
        sourceType: normalizeText(sourceType).toLowerCase(),
        sourceId: normalizeText(sourceId),
        sourceLabel: normalizeText(sourceLabel),
        grossAmount: round2Amount(grossAmount || 0),
        allocatedAmount: round2Amount(allocatedAmount || 0),
        note: normalizeText(note),
        year: Number(year || occurredDate.getFullYear()),
        month: String(occurredDate.getMonth() + 1).padStart(2, "0"),
        occurredAt: toTimestamp(occurredAtDate),
        createdAt: createdAt || admin.firestore.FieldValue.serverTimestamp()
    };
}

function buildInvestorSettlementRecord({
    settlementId,
    investorId,
    investorName,
    investorEmail,
    year,
    openingBalance,
    incomeTotal,
    expenseTotal,
    netAmount,
    dividendPayable,
    dividendPaid,
    endingBalance,
    payoutAccountPresent,
    payoutStatus,
    creditCount,
    createdAt
} = {}) {
    return {
        settlementId,
        investorId,
        investorName: normalizeText(investorName),
        investorEmail: normalizeText(investorEmail).toLowerCase(),
        year: Number(year || new Date().getFullYear()),
        openingBalance: round2Amount(openingBalance || 0),
        incomeTotal: round2Amount(incomeTotal || 0),
        expenseTotal: round2Amount(expenseTotal || 0),
        netAmount: round2Amount(netAmount || 0),
        dividendPayable: round2Amount(dividendPayable || 0),
        dividendPaid: round2Amount(dividendPaid || 0),
        endingBalance: round2Amount(endingBalance || 0),
        payoutAccountPresent: Boolean(payoutAccountPresent),
        payoutStatus: normalizeText(payoutStatus || "pending"),
        creditCount: Math.max(0, Number(creditCount || 0)),
        createdAt: createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

async function loadInvestorConfig({ db, configCache } = {}) {
    const cacheKey = "investor-config";
    if (configCache?.has(cacheKey)) return configCache.get(cacheKey);
    const snap = await db.collection("metadata_settings").doc("investor_config").get();
    const raw = snap.exists ? (snap.data() || {}) : {};
    const config = {
        settlementMonth: Number(raw.settlementMonth || 12),
        settlementDay: Number(raw.settlementDay || 31),
        defaultPayoutAccount: normalizeText(raw.defaultPayoutAccount || ""),
        settlementCutoffMonth: Number(raw.settlementCutoffMonth || 12)
    };
    if (configCache) configCache.set(cacheKey, config);
    return config;
}

async function loadInvestorProfiles({ db, profileCache } = {}) {
    const cacheKey = "investor-profiles";
    if (profileCache?.has(cacheKey)) return profileCache.get(cacheKey);
    const snap = await db.collection("investor_profiles").get();
    const profiles = snap.docs
        .map((doc) => ({ investorId: doc.id, ...(doc.data() || {}) }))
        .filter((p) => p && p.enabled !== false && Number(p.shareUnits || 0) > 0)
        .map((p) => ({
            investorId: normalizeText(p.investorId),
            investorName: normalizeText(p.investorName || p.name || p.investorId),
            investorEmail: normalizeText(p.investorEmail || p.email || "").toLowerCase(),
            shareUnits: round2Amount(p.shareUnits || p.share || 0),
            payoutAccount: normalizeText(p.payoutAccount || p.paymentAccount || ""),
            notes: normalizeText(p.notes || ""),
            enabled: p.enabled !== false
        }))
        .sort((a, b) => Number(b.shareUnits || 0) - Number(a.shareUnits || 0) || a.investorName.localeCompare(b.investorName));
    if (profileCache) profileCache.set(cacheKey, profiles);
    return profiles;
}

function allocateByShareUnits(amount, profiles = []) {
    const totalShareUnits = round2Amount(profiles.reduce((sum, p) => sum + Number(p.shareUnits || 0), 0));
    if (totalShareUnits <= 0 || !Number.isFinite(Number(amount)) || Number(amount) === 0) return [];
    const signedAmount = round2Amount(amount);
    let allocated = 0;
    return profiles.map((profile, index) => {
        const shareRatio = Number(profile.shareUnits || 0) / totalShareUnits;
        let allocatedAmount = round2Amount(signedAmount * shareRatio);
        if (index === profiles.length - 1) {
            allocatedAmount = round2Amount(signedAmount - allocated);
        } else {
            allocated += allocatedAmount;
        }
        return {
            investorId: profile.investorId,
            investorName: profile.investorName,
            investorEmail: profile.investorEmail,
            shareUnits: round2Amount(profile.shareUnits || 0),
            totalShareUnits,
            shareRatio,
            allocatedAmount
        };
    }).filter((row) => Math.abs(row.allocatedAmount) >= 0.01);
}

async function loadInvestorBalance({ db, investorId } = {}) {
    const balanceDoc = await db.collection("investor_balances").doc(normalizeText(investorId)).get();
    return balanceDoc.exists ? (balanceDoc.data() || {}) : null;
}

async function upsertInvestorBalance({
    db,
    investorId,
    patch = {}
} = {}) {
    const ref = db.collection("investor_balances").doc(normalizeText(investorId));
    await ref.set({
        investorId: normalizeText(investorId),
        ...patch,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

async function recordInvestorFinanceEvent({
    db,
    profileCache,
    payload = {},
    createdByUid = ""
} = {}) {
    const eventType = normalizeText(payload.eventType || "income").toLowerCase();
    if (!["income", "expense"].includes(eventType)) {
        throw new Error("eventType must be income or expense");
    }

    const grossAmount = Math.abs(Number(payload.amount || 0));
    if (grossAmount <= 0) {
        throw new Error("amount must be greater than 0");
    }

    const sourceType = normalizeText(payload.sourceType || "manual");
    const sourceId = normalizeText(payload.sourceId || "");
    const sourceLabel = normalizeText(payload.sourceLabel || payload.note || sourceType || "manual");
    const note = normalizeText(payload.note || "");
    const occurredAtDate = toDate(payload.occurredAtDate || payload.occurredAt || new Date());
    const signedAmount = eventType === "expense" ? -grossAmount : grossAmount;
    const eventId = normalizeText(payload.eventId) || buildInvestorEventId({
        eventType,
        sourceType,
        sourceId,
        occurredAtDate,
        note,
        amount: grossAmount
    });
    const eventRef = db.collection("investor_finance_events").doc(eventId);
    const existing = await eventRef.get();
    if (existing.exists) {
        return { eventId, created: false, event: existing.data() || null, credits: [] };
    }

    const profiles = Array.isArray(payload.profiles)
        ? payload.profiles
        : await loadInvestorProfiles({ db, profileCache });
    const activeProfiles = profiles.filter((p) => p && Number(p.shareUnits || 0) > 0);
    const allocations = allocateByShareUnits(signedAmount, activeProfiles);
    const totalShareUnits = round2Amount(activeProfiles.reduce((sum, p) => sum + Number(p.shareUnits || 0), 0));

    const eventDoc = buildInvestorFinanceEventRecord({
        eventId,
        eventType,
        sourceType,
        sourceId,
        sourceLabel,
        grossAmount,
        signedAmount,
        note,
        totalShareUnits,
        investorCount: activeProfiles.length,
        occurredAtDate
    });
    await eventRef.set({
        ...eventDoc,
        createdByUid: normalizeText(createdByUid),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const credits = [];
    for (const allocation of allocations) {
        const creditId = buildInvestorCreditId({ eventId, investorId: allocation.investorId });
        const creditRef = db.collection("investor_credits").doc(creditId);
        const creditDoc = buildInvestorCreditRecord({
            creditId,
            eventId,
            investorId: allocation.investorId,
            investorName: allocation.investorName,
            investorEmail: allocation.investorEmail,
            shareUnits: allocation.shareUnits,
            totalShareUnits,
            shareRatio: allocation.shareRatio,
            eventType,
            sourceType,
            sourceId,
            sourceLabel,
            grossAmount,
            allocatedAmount: allocation.allocatedAmount,
            note,
            year: occurredAtDate.getFullYear(),
            occurredAtDate
        });
        await creditRef.set(creditDoc, { merge: true });
        credits.push(creditDoc);

        const balanceDoc = await loadInvestorBalance({ db, investorId: allocation.investorId });
        const currentBalance = round2Amount(Number(balanceDoc?.currentBalance || 0) + allocation.allocatedAmount);
        await upsertInvestorBalance({
            db,
            investorId: allocation.investorId,
            patch: {
                investorName: allocation.investorName,
                investorEmail: allocation.investorEmail,
                shareUnits: allocation.shareUnits,
                totalShareUnits,
                currentBalance,
                lastCreditEventId: eventId,
                lastCreditAt: admin.firestore.FieldValue.serverTimestamp()
            }
        });
    }

    return { eventId, created: true, event: eventDoc, credits };
}

async function settleAnnualInvestorDividends({
    db,
    year,
    profileCache,
    configCache,
    createdByUid = ""
} = {}) {
    const targetYear = Number(year || new Date().getFullYear() - 1);
    const config = await loadInvestorConfig({ db, configCache });
    const profiles = await loadInvestorProfiles({ db, profileCache });
    const creditsSnap = await db.collection("investor_credits").where("year", "==", targetYear).get();
    const creditsByInvestor = new Map();
    for (const doc of creditsSnap.docs) {
        const row = doc.data() || {};
        const investorId = normalizeText(row.investorId || doc.id);
        if (!investorId) continue;
        const bucket = creditsByInvestor.get(investorId) || { income: 0, expense: 0, net: 0, count: 0 };
        const allocatedAmount = round2Amount(row.allocatedAmount || 0);
        if (allocatedAmount >= 0) bucket.income += allocatedAmount;
        else bucket.expense += Math.abs(allocatedAmount);
        bucket.net += allocatedAmount;
        bucket.count += 1;
        creditsByInvestor.set(investorId, bucket);
    }

    const settlements = [];
    for (const profile of profiles) {
        const investorId = profile.investorId;
        const creditBucket = creditsByInvestor.get(investorId) || { income: 0, expense: 0, net: 0, count: 0 };
        const balanceDoc = await loadInvestorBalance({ db, investorId });
        const currentBalance = round2Amount(Number(balanceDoc?.currentBalance || 0));
        const yearNet = round2Amount(creditBucket.net || 0);
        const openingBalance = round2Amount(currentBalance - yearNet);
        const totalAvailable = currentBalance;
        const payoutAccountPresent = Boolean(profile.payoutAccount || config.defaultPayoutAccount);
        const dividendPayable = totalAvailable > 0 ? totalAvailable : 0;
        const dividendPaid = payoutAccountPresent ? dividendPayable : 0;
        const endingBalance = round2Amount(totalAvailable - dividendPaid);
        const payoutStatus = payoutAccountPresent
            ? (dividendPaid > 0 ? "paid" : "no_dividend")
            : (dividendPayable > 0 ? "missing_payout_account" : "no_dividend");
        const settlementId = `${targetYear}-${investorId}`;
        const settlementRef = db.collection("investor_annual_settlements").doc(settlementId);
        const settlementDoc = buildInvestorSettlementRecord({
            settlementId,
            investorId,
            investorName: profile.investorName,
            investorEmail: profile.investorEmail,
            year: targetYear,
            openingBalance,
            incomeTotal: creditBucket.income,
            expenseTotal: creditBucket.expense,
            netAmount: yearNet,
            dividendPayable,
            dividendPaid,
            endingBalance,
            payoutAccountPresent,
            payoutStatus,
            creditCount: creditBucket.count
        });
        await settlementRef.set({
            ...settlementDoc,
            createdByUid: normalizeText(createdByUid)
        }, { merge: true });

        await upsertInvestorBalance({
            db,
            investorId,
            patch: {
                investorName: profile.investorName,
                investorEmail: profile.investorEmail,
                shareUnits: profile.shareUnits,
                currentBalance: endingBalance,
                lastSettlementYear: targetYear,
                lastSettlementAt: admin.firestore.FieldValue.serverTimestamp(),
                settlementMonth: Number(config.settlementMonth || 12),
                settlementDay: Number(config.settlementDay || 31)
            }
        });

        settlements.push(settlementDoc);
    }

    return {
        targetYear,
        settlementMonth: Number(config.settlementMonth || 12),
        settlementDay: Number(config.settlementDay || 31),
        settlementCount: settlements.length,
        settlements
    };
}

module.exports = {
    allocateByShareUnits,
    buildInvestorCreditId,
    buildInvestorCreditRecord,
    buildInvestorEventId,
    buildInvestorFinanceEventRecord,
    buildInvestorSettlementRecord,
    loadInvestorConfig,
    loadInvestorProfiles,
    recordInvestorFinanceEvent,
    round2Amount,
    settleAnnualInvestorDividends
};
