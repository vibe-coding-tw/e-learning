const admin = require("firebase-admin");
const crypto = require("crypto");
const { recordLedgerEvent } = require("./ledger-engine");

const AUTO_BALANCE_SHEET_SNAPSHOT_ID = "auto-current";

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
    if (typeof value === "string") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return admin.firestore.Timestamp.fromDate(parsed);
    }
    return admin.firestore.FieldValue.serverTimestamp();
}

function toDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (value?.toDate) return value.toDate();
    if (typeof value === "number") return new Date(value);
    if (typeof value === "string") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
}

function toSortableMillis(value) {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    }
    return 0;
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

function deriveSharePrice({ preMoneyValuation, postMoneyValuation, shareBasis, sharePrice } = {}) {
    const basis = Math.max(1, Number(shareBasis || 0));
    const explicitPrice = Number(sharePrice);
    if (Number.isFinite(explicitPrice) && explicitPrice > 0) return round2Amount(explicitPrice);
    const post = Number(postMoneyValuation);
    if (Number.isFinite(post) && post > 0) return round2Amount(post / basis);
    const pre = Number(preMoneyValuation);
    if (Number.isFinite(pre) && pre > 0) return round2Amount(pre / basis);
    return 0;
}

function buildValuationSnapshotRecord({
    valuationId,
    roundName,
    valuationType,
    currency,
    preMoneyValuation,
    postMoneyValuation,
    shareBasis,
    sharePrice,
    effectiveFrom,
    effectiveTo,
    notes,
    locked,
    createdAt
} = {}) {
    const resolvedSharePrice = deriveSharePrice({
        preMoneyValuation,
        postMoneyValuation,
        shareBasis,
        sharePrice
    });
    const basis = Math.max(1, Number(shareBasis || 0));
    return {
        valuationId,
        roundName: normalizeText(roundName || valuationId),
        valuationType: normalizeText(valuationType || "pre-money"),
        currency: normalizeText(currency || "TWD") || "TWD",
        preMoneyValuation: round2Amount(preMoneyValuation || 0),
        postMoneyValuation: round2Amount(postMoneyValuation || 0),
        shareBasis: basis,
        sharePrice: round2Amount(resolvedSharePrice || 0),
        effectiveFrom: effectiveFrom ? toTimestamp(effectiveFrom) : admin.firestore.FieldValue.serverTimestamp(),
        effectiveTo: effectiveTo ? toTimestamp(effectiveTo) : null,
        notes: normalizeText(notes || ""),
        locked: locked !== false,
        createdAt: createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

function buildEquityIssuanceId({
    valuationId = "",
    investorId = "",
    sourceType = "",
    sourceId = "",
    considerationAmount = 0,
    issuedShares = 0
} = {}) {
    const seed = [
        normalizeText(valuationId).toLowerCase(),
        normalizeText(investorId).toLowerCase(),
        normalizeText(sourceType).toLowerCase(),
        normalizeText(sourceId).toLowerCase(),
        round2Amount(considerationAmount).toFixed(2),
        round2Amount(issuedShares).toFixed(4)
    ].join("|");
    return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 40);
}

function buildEquityIssuanceRecord({
    issuanceId,
    valuationId,
    investorId,
    investorName,
    investorEmail,
    participantType,
    sourceType,
    sourceId,
    sourceLabel,
    considerationType,
    considerationAmount,
    valuationSnapshot,
    sharePrice,
    issuedShares,
    shareBasis,
    ownershipPct,
    vestingMonths,
    cliffMonths,
    startDate,
    status,
    note,
    createdAt
} = {}) {
    return {
        issuanceId,
        valuationId,
        investorId,
        investorName: normalizeText(investorName),
        investorEmail: normalizeText(investorEmail).toLowerCase(),
        participantType: normalizeText(participantType || "investor"),
        sourceType: normalizeText(sourceType || "manual"),
        sourceId: normalizeText(sourceId || ""),
        sourceLabel: normalizeText(sourceLabel || ""),
        considerationType: normalizeText(considerationType || "cash"),
        considerationAmount: round2Amount(considerationAmount || 0),
        valuationSnapshot: valuationSnapshot || null,
        sharePrice: round2Amount(sharePrice || 0),
        issuedShares: round2Amount(issuedShares || 0),
        shareBasis: round2Amount(shareBasis || 0),
        ownershipPct: round2Amount(ownershipPct || 0),
        vestingMonths: Math.max(0, Number(vestingMonths || 0)),
        cliffMonths: Math.max(0, Number(cliffMonths || 0)),
        startDate: startDate ? toTimestamp(startDate) : admin.firestore.FieldValue.serverTimestamp(),
        status: normalizeText(status || "active"),
        note: normalizeText(note || ""),
        createdAt: createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

function buildEquityPositionRecord({
    investorId,
    investorName,
    investorEmail,
    participantType,
    totalIssuedShares,
    shareBasis,
    ownershipPct,
    valuationId,
    sharePrice,
    latestIssuanceId,
    vestingMonths,
    cliffMonths,
    updatedAt
} = {}) {
    return {
        investorId,
        investorName: normalizeText(investorName),
        investorEmail: normalizeText(investorEmail).toLowerCase(),
        participantType: normalizeText(participantType || "investor"),
        totalIssuedShares: round2Amount(totalIssuedShares || 0),
        shareBasis: round2Amount(shareBasis || 0),
        ownershipPct: round2Amount(ownershipPct || 0),
        valuationId: normalizeText(valuationId || ""),
        sharePrice: round2Amount(sharePrice || 0),
        latestIssuanceId: normalizeText(latestIssuanceId || ""),
        vestingMonths: Math.max(0, Number(vestingMonths || 0)),
        cliffMonths: Math.max(0, Number(cliffMonths || 0)),
        updatedAt: updatedAt || admin.firestore.FieldValue.serverTimestamp()
    };
}

function sumBalanceSheetAssets(row = {}) {
    return round2Amount(
        Number(row.cash || 0) +
        Number(row.accountsReceivable || 0) +
        Number(row.otherAssets || 0) +
        Number(row.fixedAssets || 0) +
        Number(row.intangibleAssets || 0) +
        Number(row.prepaidExpenses || 0)
    );
}

function sumBalanceSheetLiabilities(row = {}) {
    return round2Amount(
        Number(row.accountsPayable || 0) +
        Number(row.shortTermDebt || 0) +
        Number(row.longTermDebt || 0) +
        Number(row.otherLiabilities || 0)
    );
}

function buildBalanceSheetSnapshotRecord({
    snapshotId,
    snapshotDate,
    currency,
    cash,
    accountsReceivable,
    otherAssets,
    fixedAssets,
    intangibleAssets,
    prepaidExpenses,
    accountsPayable,
    shortTermDebt,
    longTermDebt,
    otherLiabilities,
    totalAssets,
    totalLiabilities,
    issuedShares,
    notes,
    locked,
    createdAt
} = {}) {
    const computedAssets = round2Amount(Number(totalAssets) > 0 ? totalAssets : sumBalanceSheetAssets({
        cash,
        accountsReceivable,
        otherAssets,
        fixedAssets,
        intangibleAssets,
        prepaidExpenses
    }));
    const computedLiabilities = round2Amount(Number(totalLiabilities) > 0 ? totalLiabilities : sumBalanceSheetLiabilities({
        accountsPayable,
        shortTermDebt,
        longTermDebt,
        otherLiabilities
    }));
    const netAssetValue = round2Amount(computedAssets - computedLiabilities);
    const shareCount = Math.max(0, Number(issuedShares || 0));
    const navPerIssuedShare = shareCount > 0 ? round2Amount(netAssetValue / shareCount) : 0;
    return {
        snapshotId,
        snapshotDate: snapshotDate ? toTimestamp(snapshotDate) : admin.firestore.FieldValue.serverTimestamp(),
        currency: normalizeText(currency || "TWD") || "TWD",
        cash: round2Amount(cash || 0),
        accountsReceivable: round2Amount(accountsReceivable || 0),
        otherAssets: round2Amount(otherAssets || 0),
        fixedAssets: round2Amount(fixedAssets || 0),
        intangibleAssets: round2Amount(intangibleAssets || 0),
        prepaidExpenses: round2Amount(prepaidExpenses || 0),
        accountsPayable: round2Amount(accountsPayable || 0),
        shortTermDebt: round2Amount(shortTermDebt || 0),
        longTermDebt: round2Amount(longTermDebt || 0),
        otherLiabilities: round2Amount(otherLiabilities || 0),
        totalAssets: computedAssets,
        totalLiabilities: computedLiabilities,
        netAssetValue,
        issuedShares: shareCount,
        navPerIssuedShare,
        notes: normalizeText(notes || ""),
        locked: locked !== false,
        createdAt: createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

async function loadValuationSnapshots({ db, snapshotCache } = {}) {
    const cacheKey = "valuation-snapshots";
    if (snapshotCache?.has(cacheKey)) return snapshotCache.get(cacheKey);
    const snap = await db.collection("valuation_snapshots").get();
    const snapshots = snap.docs
        .map((doc) => ({ valuationId: doc.id, ...(doc.data() || {}) }))
        .map((row) => ({
            valuationId: normalizeText(row.valuationId),
            roundName: normalizeText(row.roundName || row.valuationId),
            valuationType: normalizeText(row.valuationType || "pre-money"),
            currency: normalizeText(row.currency || "TWD") || "TWD",
            preMoneyValuation: round2Amount(row.preMoneyValuation || 0),
            postMoneyValuation: round2Amount(row.postMoneyValuation || 0),
            shareBasis: Math.max(1, Number(row.shareBasis || 0)),
            sharePrice: round2Amount(row.sharePrice || deriveSharePrice({
                preMoneyValuation: row.preMoneyValuation,
                postMoneyValuation: row.postMoneyValuation,
                shareBasis: row.shareBasis
            })),
            effectiveFrom: row.effectiveFrom || null,
            effectiveTo: row.effectiveTo || null,
            notes: normalizeText(row.notes || ""),
            locked: row.locked !== false,
            updatedAt: row.updatedAt || null
        }))
        .sort((a, b) => toSortableMillis(b.updatedAt || b.effectiveFrom) - toSortableMillis(a.updatedAt || a.effectiveFrom) || a.roundName.localeCompare(b.roundName));
    if (snapshotCache) snapshotCache.set(cacheKey, snapshots);
    return snapshots;
}

async function loadBalanceSheetSnapshots({ db, snapshotCache } = {}) {
    const cacheKey = "balance-sheet-snapshots";
    if (snapshotCache?.has(cacheKey)) return snapshotCache.get(cacheKey);
    const snap = await db.collection("balance_sheet_snapshots").get();
    const snapshots = snap.docs
        .map((doc) => ({ snapshotId: doc.id, ...(doc.data() || {}) }))
        .map((row) => {
            const totalAssets = round2Amount(row.totalAssets || sumBalanceSheetAssets(row));
            const totalLiabilities = round2Amount(row.totalLiabilities || sumBalanceSheetLiabilities(row));
            const netAssetValue = round2Amount(
                row.netAssetValue || (totalAssets - totalLiabilities)
            );
            const issuedShares = Math.max(0, Number(row.issuedShares || 0));
            return {
                snapshotId: normalizeText(row.snapshotId),
                snapshotDate: row.snapshotDate || row.effectiveFrom || row.createdAt || null,
                currency: normalizeText(row.currency || "TWD") || "TWD",
                cash: round2Amount(row.cash || 0),
                accountsReceivable: round2Amount(row.accountsReceivable || 0),
                otherAssets: round2Amount(row.otherAssets || 0),
                fixedAssets: round2Amount(row.fixedAssets || 0),
                intangibleAssets: round2Amount(row.intangibleAssets || 0),
                prepaidExpenses: round2Amount(row.prepaidExpenses || 0),
                accountsPayable: round2Amount(row.accountsPayable || 0),
                shortTermDebt: round2Amount(row.shortTermDebt || 0),
                longTermDebt: round2Amount(row.longTermDebt || 0),
                otherLiabilities: round2Amount(row.otherLiabilities || 0),
                totalAssets,
                totalLiabilities,
                netAssetValue,
                issuedShares,
                navPerIssuedShare: round2Amount(row.navPerIssuedShare || (issuedShares > 0 ? (netAssetValue / issuedShares) : 0)),
                notes: normalizeText(row.notes || ""),
                locked: row.locked !== false,
                autoManaged: row.autoManaged === true || normalizeText(row.snapshotId) === AUTO_BALANCE_SHEET_SNAPSHOT_ID,
                lastEventId: normalizeText(row.lastEventId || ""),
                lastEventType: normalizeText(row.lastEventType || ""),
                lastEventSourceType: normalizeText(row.lastEventSourceType || ""),
                lastEventSourceId: normalizeText(row.lastEventSourceId || ""),
                lastEventSourceLabel: normalizeText(row.lastEventSourceLabel || ""),
                lastEventNote: normalizeText(row.lastEventNote || ""),
                lastEventAt: row.lastEventAt || null,
                updatedAt: row.updatedAt || null
            };
        })
        .sort((a, b) => toSortableMillis(b.updatedAt || b.snapshotDate) - toSortableMillis(a.updatedAt || a.snapshotDate) || b.netAssetValue - a.netAssetValue);
    if (snapshotCache) snapshotCache.set(cacheKey, snapshots);
    return snapshots;
}

async function loadActiveBalanceSheetSnapshot({ db, snapshotCache, snapshotId = "" } = {}) {
    const snapshots = await loadBalanceSheetSnapshots({ db, snapshotCache });
    if (snapshotId) {
        const matched = snapshots.find((s) => s.snapshotId === normalizeText(snapshotId));
        if (matched) return matched;
    }
    return snapshots.find((s) => s.autoManaged === true)
        || snapshots.find((s) => s.locked !== false)
        || snapshots[0]
        || null;
}

async function applyInvestorEventToBalanceSheetSnapshot({
    db,
    eventType,
    grossAmount,
    occurredAtDate,
    eventId,
    sourceType,
    sourceId,
    sourceLabel,
    note,
    createdByUid = "",
    snapshotCache,
    issuedShares = 0
} = {}) {
    const delta = round2Amount((normalizeText(eventType).toLowerCase() === "expense" ? -1 : 1) * Math.abs(Number(grossAmount || 0)));
    if (!Number.isFinite(delta) || delta === 0) return null;

    const snapshots = await loadBalanceSheetSnapshots({ db, snapshotCache });
    const activeSnapshot = await loadActiveBalanceSheetSnapshot({ db, snapshotCache });
    const sourceSnapshot = activeSnapshot || snapshots.find((s) => s.autoManaged === true) || null;

    const resolvedIssuedShares = Math.max(0, Number(sourceSnapshot?.issuedShares || 0)) || Math.max(0, Number(issuedShares || 0));
    const baseCash = round2Amount(Number(sourceSnapshot?.cash || 0));
    const baseReceivable = round2Amount(Number(sourceSnapshot?.accountsReceivable || 0));
    const baseOtherAssets = round2Amount(Number(sourceSnapshot?.otherAssets || 0));
    const baseFixedAssets = round2Amount(Number(sourceSnapshot?.fixedAssets || 0));
    const baseIntangibleAssets = round2Amount(Number(sourceSnapshot?.intangibleAssets || 0));
    const basePrepaidExpenses = round2Amount(Number(sourceSnapshot?.prepaidExpenses || 0));
    const basePayables = round2Amount(Number(sourceSnapshot?.accountsPayable || 0));
    const baseShortDebt = round2Amount(Number(sourceSnapshot?.shortTermDebt || 0));
    const baseLongDebt = round2Amount(Number(sourceSnapshot?.longTermDebt || 0));
    const baseOtherLiabilities = round2Amount(Number(sourceSnapshot?.otherLiabilities || 0));

    const updatedCash = round2Amount(baseCash + delta);
    const updatedAssets = round2Amount(
        updatedCash +
        baseReceivable +
        baseOtherAssets +
        baseFixedAssets +
        baseIntangibleAssets +
        basePrepaidExpenses
    );
    const totalLiabilities = round2Amount(basePayables + baseShortDebt + baseLongDebt + baseOtherLiabilities);
    const netAssetValue = round2Amount(updatedAssets - totalLiabilities);
    const navPerIssuedShare = resolvedIssuedShares > 0 ? round2Amount(netAssetValue / resolvedIssuedShares) : 0;

    const snapshotDoc = buildBalanceSheetSnapshotRecord({
        snapshotId: sourceSnapshot?.autoManaged === true ? sourceSnapshot.snapshotId : AUTO_BALANCE_SHEET_SNAPSHOT_ID,
        snapshotDate: occurredAtDate || new Date(),
        currency: sourceSnapshot?.currency || "TWD",
        cash: updatedCash,
        accountsReceivable: baseReceivable,
        otherAssets: baseOtherAssets,
        fixedAssets: baseFixedAssets,
        intangibleAssets: baseIntangibleAssets,
        prepaidExpenses: basePrepaidExpenses,
        accountsPayable: basePayables,
        shortTermDebt: baseShortDebt,
        longTermDebt: baseLongDebt,
        otherLiabilities: baseOtherLiabilities,
        totalAssets: updatedAssets,
        totalLiabilities,
        issuedShares: resolvedIssuedShares,
        notes: sourceSnapshot?.notes || "Auto-updated from investor finance events.",
        locked: false,
        autoManaged: true,
        lastEventId: normalizeText(eventId),
        lastEventType: normalizeText(eventType).toLowerCase(),
        lastEventSourceType: normalizeText(sourceType),
        lastEventSourceId: normalizeText(sourceId),
        lastEventSourceLabel: normalizeText(sourceLabel),
        lastEventNote: normalizeText(note),
        lastEventAt: occurredAtDate ? toTimestamp(occurredAtDate) : admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: sourceSnapshot?.createdAt || admin.firestore.FieldValue.serverTimestamp()
    });

    const autoSnapshotRef = db.collection("balance_sheet_snapshots").doc(snapshotDoc.snapshotId || AUTO_BALANCE_SHEET_SNAPSHOT_ID);
    await autoSnapshotRef.set({
        ...snapshotDoc,
        autoManaged: true,
        locked: false,
        updatedByUid: normalizeText(createdByUid),
        createdByUid: normalizeText(sourceSnapshot?.createdByUid || createdByUid)
    }, { merge: true });

    if (snapshotCache) snapshotCache.delete("balance-sheet-snapshots");

    return snapshotDoc;
}

async function upsertBalanceSheetSnapshot({
    db,
    payload = {},
    createdByUid = "",
    snapshotCache
} = {}) {
    const snapshotId = normalizeText(payload.snapshotId || payload.id || "");
    if (!snapshotId) throw new Error("snapshotId is required");
    const docRef = db.collection("balance_sheet_snapshots").doc(snapshotId);
    const snapshotDoc = buildBalanceSheetSnapshotRecord({
        snapshotId,
        snapshotDate: payload.snapshotDate || payload.effectiveAt || new Date(),
        currency: payload.currency || "TWD",
        cash: payload.cash,
        accountsReceivable: payload.accountsReceivable,
        otherAssets: payload.otherAssets,
        fixedAssets: payload.fixedAssets,
        intangibleAssets: payload.intangibleAssets,
        prepaidExpenses: payload.prepaidExpenses,
        accountsPayable: payload.accountsPayable,
        shortTermDebt: payload.shortTermDebt,
        longTermDebt: payload.longTermDebt,
        otherLiabilities: payload.otherLiabilities,
        totalAssets: payload.totalAssets,
        totalLiabilities: payload.totalLiabilities,
        issuedShares: payload.issuedShares,
        notes: payload.notes || "",
        locked: payload.locked !== false
    });
    await docRef.set({
        ...snapshotDoc,
        autoManaged: payload.autoManaged === true || snapshotId === AUTO_BALANCE_SHEET_SNAPSHOT_ID,
        lastEventId: normalizeText(payload.lastEventId || ""),
        lastEventType: normalizeText(payload.lastEventType || ""),
        lastEventSourceType: normalizeText(payload.lastEventSourceType || ""),
        lastEventSourceId: normalizeText(payload.lastEventSourceId || ""),
        lastEventSourceLabel: normalizeText(payload.lastEventSourceLabel || ""),
        lastEventNote: normalizeText(payload.lastEventNote || ""),
        lastEventAt: payload.lastEventAt ? toTimestamp(payload.lastEventAt) : null,
        createdByUid: normalizeText(createdByUid),
        updatedByUid: normalizeText(createdByUid)
    }, { merge: true });
    if (snapshotCache) snapshotCache.delete("balance-sheet-snapshots");
    return snapshotDoc;
}

async function loadActiveValuationSnapshot({ db, snapshotCache, valuationId = "" } = {}) {
    const snapshots = await loadValuationSnapshots({ db, snapshotCache });
    if (valuationId) {
        const matched = snapshots.find((s) => s.valuationId === normalizeText(valuationId));
        if (matched) return matched;
    }
    return snapshots.find((s) => s.locked !== false) || snapshots[0] || null;
}

async function upsertValuationSnapshot({
    db,
    payload = {},
    createdByUid = "",
    snapshotCache
} = {}) {
    const valuationId = normalizeText(payload.valuationId || payload.id || "");
    if (!valuationId) throw new Error("valuationId is required");
    const shareBasis = Math.max(1, Number(payload.shareBasis || payload.totalShares || 0));
    if (!Number.isFinite(shareBasis) || shareBasis <= 0) throw new Error("shareBasis must be greater than 0");
    const docRef = db.collection("valuation_snapshots").doc(valuationId);
    const snapshotDoc = buildValuationSnapshotRecord({
        valuationId,
        roundName: payload.roundName || payload.name || valuationId,
        valuationType: payload.valuationType || "pre-money",
        currency: payload.currency || "TWD",
        preMoneyValuation: payload.preMoneyValuation,
        postMoneyValuation: payload.postMoneyValuation,
        shareBasis,
        sharePrice: payload.sharePrice,
        effectiveFrom: payload.effectiveFrom || payload.effectiveAt || new Date(),
        effectiveTo: payload.effectiveTo || null,
        notes: payload.notes || "",
        locked: payload.locked !== false
    });
    await docRef.set({
        ...snapshotDoc,
        createdByUid: normalizeText(createdByUid),
        updatedByUid: normalizeText(createdByUid)
    }, { merge: true });
    if (snapshotCache) snapshotCache.delete("valuation-snapshots");
    return snapshotDoc;
}

async function issueInvestorEquity({
    db,
    payload = {},
    createdByUid = "",
    profileCache,
    snapshotCache
} = {}) {
    const investorId = normalizeText(payload.investorId || payload.investor || "");
    if (!investorId) throw new Error("investorId is required");

    const requestedValuationId = normalizeText(payload.valuationId || payload.snapshotId || "");
    const valuation = requestedValuationId
        ? (await loadValuationSnapshots({ db, snapshotCache })).find((snapshot) => snapshot.valuationId === requestedValuationId)
        : await loadActiveValuationSnapshot({ db, snapshotCache });
    if (!valuation) throw new Error("No valuation snapshot available");
    if (requestedValuationId && valuation.valuationId !== requestedValuationId) {
        throw new Error(`Valuation snapshot not found: ${requestedValuationId}`);
    }
    const sharePrice = round2Amount(payload.sharePrice || valuation.sharePrice || 0);
    if (sharePrice <= 0) throw new Error("sharePrice must be greater than 0");

    const considerationAmount = Math.abs(Number(payload.considerationAmount || payload.amount || 0));
    if (considerationAmount <= 0) throw new Error("considerationAmount must be greater than 0");

    const investorDoc = await db.collection("investor_profiles").doc(investorId).get();
    const investorData = investorDoc.exists ? (investorDoc.data() || {}) : {};
    const investorName = normalizeText(payload.investorName || investorData.investorName || investorId);
    const investorEmail = normalizeText(payload.investorEmail || investorData.investorEmail || "").toLowerCase();
    const participantType = normalizeText(payload.participantType || investorData.participantType || "investor");
    const sourceType = normalizeText(payload.sourceType || "manual");
    const sourceId = normalizeText(payload.sourceId || "");
    const sourceLabel = normalizeText(payload.sourceLabel || payload.note || sourceType || "manual");
    const considerationType = normalizeText(payload.considerationType || "cash");
    const note = normalizeText(payload.note || "");
    const vestingMonths = Math.max(0, Number(payload.vestingMonths || investorData.vestingMonths || 0));
    const cliffMonths = Math.max(0, Number(payload.cliffMonths || investorData.cliffMonths || 0));
    const startDate = payload.startDate || payload.effectiveAt || new Date();
    const issuedShares = round2Amount(considerationAmount / sharePrice);
    const shareBasis = Math.max(1, Number(valuation.shareBasis || 0));
    const ownershipPct = shareBasis > 0 ? round2Amount((issuedShares / shareBasis) * 100) : 0;
    const issuanceId = normalizeText(payload.issuanceId || buildEquityIssuanceId({
        valuationId: valuation.valuationId,
        investorId,
        sourceType,
        sourceId,
        considerationAmount,
        issuedShares
    }));
    const issuanceRef = db.collection("equity_issuances").doc(issuanceId);
    const existing = await issuanceRef.get();
    if (existing.exists) {
        return { issuanceId, created: false, issuance: existing.data() || null };
    }

    const issuanceDoc = buildEquityIssuanceRecord({
        issuanceId,
        valuationId: valuation.valuationId,
        investorId,
        investorName,
        investorEmail,
        participantType,
        sourceType,
        sourceId,
        sourceLabel,
        considerationType,
        considerationAmount,
        valuationSnapshot: valuation,
        sharePrice,
        issuedShares,
        shareBasis,
        ownershipPct,
        vestingMonths,
        cliffMonths,
        startDate,
        status: payload.status || "active",
        note
    });
    await issuanceRef.set({
        ...issuanceDoc,
        createdByUid: normalizeText(createdByUid)
    }, { merge: true });

    const positionRef = db.collection("investor_equity_positions").doc(investorId);
    const existingPositionSnap = await positionRef.get();
    const existingPosition = existingPositionSnap.exists ? (existingPositionSnap.data() || {}) : {};
    const previousTotalIssuedShares = round2Amount(existingPosition.totalIssuedShares || 0);
    const newTotalIssuedShares = round2Amount(previousTotalIssuedShares + issuedShares);
    const positionDoc = buildEquityPositionRecord({
        investorId,
        investorName,
        investorEmail,
        participantType,
        totalIssuedShares: newTotalIssuedShares,
        shareBasis,
        ownershipPct: shareBasis > 0 ? round2Amount((newTotalIssuedShares / shareBasis) * 100) : 0,
        valuationId: valuation.valuationId,
        sharePrice,
        latestIssuanceId: issuanceId,
        vestingMonths,
        cliffMonths
    });
    await positionRef.set({
        ...positionDoc,
        createdByUid: normalizeText(createdByUid)
    }, { merge: true });

    const updatedShareUnits = round2Amount(Number(investorData.shareUnits || 0) + issuedShares);
    await db.collection("investor_profiles").doc(investorId).set({
        investorId,
        investorName,
        investorEmail,
        participantType,
        shareUnits: updatedShareUnits,
        valuationId: valuation.valuationId,
        valuationName: valuation.roundName,
        valuationSharePrice: sharePrice,
        equityShares: updatedShareUnits,
        ownershipPct: positionDoc.ownershipPct,
        vestingMonths,
        cliffMonths,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (profileCache) profileCache.delete("investor-profiles");
    return { issuanceId, created: true, issuance: issuanceDoc, position: positionDoc, valuation };
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
            participantType: normalizeText(p.participantType || "investor"),
            shareUnits: round2Amount(p.shareUnits || p.share || 0),
            equityShares: round2Amount(p.equityShares || p.shareUnits || p.share || 0),
            ownershipPct: round2Amount(p.ownershipPct || 0),
            valuationId: normalizeText(p.valuationId || ""),
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
    const totalIssuedShares = round2Amount(profiles.reduce((sum, p) => sum + Number(p.equityShares || p.shareUnits || 0), 0));

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

    await applyInvestorEventToBalanceSheetSnapshot({
        db,
        eventType,
        grossAmount,
        occurredAtDate,
        eventId,
        sourceType,
        sourceId,
        sourceLabel,
        note,
        createdByUid,
        snapshotCache,
        issuedShares: totalIssuedShares
    });

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

        try {
            if (dividendPayable > 0) {
                await recordLedgerEvent({
                    db,
                    payload: {
                        eventType: "dividend.declared",
                        sourceType: "investor_annual_settlement",
                        sourceId: settlementId,
                        sourceLabel: `Investor annual settlement ${settlementId}`,
                        entityType: "investor",
                        entityId: investorId,
                        amount: dividendPayable,
                        currency: "TWD",
                        occurredAtDate: new Date(),
                        metadata: {
                            investorId,
                            investorEmail: profile.investorEmail || "",
                            settlementId,
                            year: targetYear
                        }
                    },
                    createdByUid,
                    autoGenerateReports: false
                });
            }
            if (dividendPaid > 0) {
                await recordLedgerEvent({
                    db,
                    payload: {
                        eventType: "dividend.paid",
                        sourceType: "investor_annual_settlement",
                        sourceId: `${settlementId}|paid`,
                        sourceLabel: `Investor dividend payment ${settlementId}`,
                        entityType: "investor",
                        entityId: investorId,
                        amount: dividendPaid,
                        currency: "TWD",
                        occurredAtDate: new Date(),
                        metadata: {
                            investorId,
                            investorEmail: profile.investorEmail || "",
                            settlementId,
                            year: targetYear
                        }
                    },
                    createdByUid,
                    autoGenerateReports: false
                });
            }
        } catch (ledgerErr) {
            console.warn(`[settleAnnualInvestorDividends] Ledger event sync skipped for ${settlementId}:`, ledgerErr.message || ledgerErr);
        }

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
    buildBalanceSheetSnapshotRecord,
    applyInvestorEventToBalanceSheetSnapshot,
    buildEquityIssuanceId,
    buildEquityIssuanceRecord,
    buildEquityPositionRecord,
    buildInvestorFinanceEventRecord,
    buildValuationSnapshotRecord,
    buildInvestorSettlementRecord,
    deriveSharePrice,
    issueInvestorEquity,
    loadBalanceSheetSnapshots,
    loadActiveBalanceSheetSnapshot,
    loadActiveValuationSnapshot,
    loadInvestorConfig,
    loadInvestorProfiles,
    loadValuationSnapshots,
    recordInvestorFinanceEvent,
    round2Amount,
    upsertBalanceSheetSnapshot,
    upsertValuationSnapshot,
    settleAnnualInvestorDividends
};
