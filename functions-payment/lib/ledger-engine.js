const admin = require("firebase-admin");
const crypto = require("crypto");

function normalizeText(value = "") {
    return String(value ?? "").trim();
}

function normalizeLower(value = "") {
    return normalizeText(value).toLowerCase();
}

function round2Amount(value = 0) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function toDate(value = new Date()) {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value?.toDate === "function") return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function ymFromDate(dateValue = new Date()) {
    const date = toDate(dateValue);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function previousYm(period = "") {
    const match = /^(\d{4})-(\d{2})$/.exec(String(period || ""));
    if (!match) return "";
    const d = new Date(Number(match[1]), Number(match[2]) - 2, 1);
    return ymFromDate(d);
}

function normalizeAccountCode(value = "") {
    return normalizeLower(value).replace(/\s+/g, "_");
}

function inferAccountType(accountCode = "") {
    const normalized = normalizeAccountCode(accountCode);
    if (normalized.startsWith("asset:")) return "asset";
    if (normalized.startsWith("liability:")) return "liability";
    if (normalized.startsWith("equity:")) return "equity";
    if (normalized.startsWith("revenue:")) return "revenue";
    if (normalized.startsWith("expense:")) return "expense";
    return "expense";
}

function buildLedgerEventId({
    eventType = "",
    sourceType = "",
    sourceId = "",
    entityId = "",
    occurredAtDate = new Date(),
    amount = 0,
    currency = "TWD"
} = {}) {
    return crypto.createHash("sha256")
        .update([
            normalizeLower(eventType),
            normalizeLower(sourceType),
            normalizeText(sourceId),
            normalizeText(entityId),
            ymFromDate(occurredAtDate),
            round2Amount(amount).toFixed(2),
            normalizeUpper(currency)
        ].join("|"))
        .digest("hex")
        .slice(0, 40);
}

function normalizeUpper(value = "") {
    return normalizeText(value).toUpperCase();
}

function buildLedgerPostingId({
    eventId = "",
    accountCode = "",
    side = "",
    currency = "TWD",
    amount = 0
} = {}) {
    return crypto.createHash("sha256")
        .update([
            normalizeText(eventId),
            normalizeAccountCode(accountCode),
            normalizeLower(side),
            round2Amount(amount).toFixed(2),
            normalizeUpper(currency)
        ].join("|"))
        .digest("hex")
        .slice(0, 40);
}

function buildLedgerEventRecord({
    eventId,
    eventType,
    sourceType,
    sourceId,
    sourceLabel,
    entityType,
    entityId,
    currency = "TWD",
    grossAmount = 0,
    note = "",
    occurredAtDate = new Date(),
    metadata = {}
} = {}) {
    const occurredAt = toDate(occurredAtDate);
    return {
        eventId: normalizeText(eventId),
        eventType: normalizeLower(eventType),
        sourceType: normalizeLower(sourceType),
        sourceId: normalizeText(sourceId),
        sourceLabel: normalizeText(sourceLabel),
        entityType: normalizeLower(entityType),
        entityId: normalizeText(entityId),
        currency: normalizeUpper(currency) || "TWD",
        grossAmount: round2Amount(grossAmount),
        eventYear: occurredAt.getFullYear(),
        eventMonth: String(occurredAt.getMonth() + 1).padStart(2, "0"),
        occurredAt: admin.firestore.Timestamp.fromDate(occurredAt),
        note: normalizeText(note),
        metadata: metadata && typeof metadata === "object" ? metadata : {},
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

function buildLedgerPostingRecord({
    postingId,
    eventId,
    accountCode,
    accountType,
    side,
    amount,
    currency = "TWD",
    unitId = "",
    counterpartyId = "",
    period = ""
} = {}) {
    const normalizedAmount = round2Amount(amount);
    return {
        postingId: normalizeText(postingId),
        eventId: normalizeText(eventId),
        accountCode: normalizeAccountCode(accountCode),
        accountType: normalizeLower(accountType) || inferAccountType(accountCode),
        side: normalizeLower(side),
        amount: normalizedAmount,
        debit: side === "debit" ? normalizedAmount : 0,
        credit: side === "credit" ? normalizedAmount : 0,
        currency: normalizeUpper(currency) || "TWD",
        unitId: normalizeText(unitId),
        counterpartyId: normalizeText(counterpartyId),
        period,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

function defaultPostingPlanForEvent(event) {
    const eventType = normalizeLower(event?.eventType);
    const amount = round2Amount(event?.grossAmount || event?.amount || 0);
    const metadata = event?.metadata && typeof event.metadata === "object" ? event.metadata : {};
    const currency = normalizeUpper(event?.currency || "TWD");
    const unitId = normalizeText(metadata.unitId || event?.unitId || "");
    const counterpartyId = normalizeText(metadata.counterpartyId || event?.entityId || "");

    if (["order.paid", "income", "sale.paid"].includes(eventType)) {
        const taxAmount = round2Amount(metadata.taxAmount || 0);
        const netAmount = round2Amount(metadata.netAmount || (taxAmount > 0 ? amount - taxAmount : amount));
        const revenueAccount = normalizeAccountCode(metadata.revenueAccount || "revenue:sales");
        const cashAccount = normalizeAccountCode(metadata.cashAccount || "asset:cash");
        const postings = [
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: cashAccount, side: "debit", amount }),
                eventId: event.eventId,
                accountCode: cashAccount,
                side: "debit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }),
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: revenueAccount, side: "credit", amount: netAmount }),
                eventId: event.eventId,
                accountCode: revenueAccount,
                side: "credit",
                amount: netAmount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            })
        ];
        if (taxAmount > 0) {
            postings.push(buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: "liability:output_vat", side: "credit", amount: taxAmount }),
                eventId: event.eventId,
                accountCode: "liability:output_vat",
                side: "credit",
                amount: taxAmount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }));
        }
        const commissionExpense = round2Amount(metadata.commissionAmount || 0);
        if (commissionExpense > 0) {
            postings.push(buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: "expense:commission", side: "debit", amount: commissionExpense }),
                eventId: event.eventId,
                accountCode: "expense:commission",
                side: "debit",
                amount: commissionExpense,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }));
            postings.push(buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: "liability:commission_payable", side: "credit", amount: commissionExpense }),
                eventId: event.eventId,
                accountCode: "liability:commission_payable",
                side: "credit",
                amount: commissionExpense,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }));
        }
        const totalCredits = round2Amount(netAmount + taxAmount + commissionExpense);
        if (Math.abs(totalCredits - amount) >= 0.01) {
            throw new Error(`Unbalanced order.paid event: expected ${amount}, got ${totalCredits}`);
        }
        return postings;
    }

    if (["order.refunded", "refund.issued", "sale.refunded"].includes(eventType)) {
        const refundAccount = normalizeAccountCode(metadata.refundAccount || "expense:sales_returns");
        const cashAccount = normalizeAccountCode(metadata.cashAccount || "asset:cash");
        const taxAmount = round2Amount(metadata.taxAmount || 0);
        const netAmount = round2Amount(metadata.netAmount || (taxAmount > 0 ? amount - taxAmount : amount));
        const postings = [
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: refundAccount, side: "debit", amount: netAmount }),
                eventId: event.eventId,
                accountCode: refundAccount,
                side: "debit",
                amount: netAmount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }),
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: cashAccount, side: "credit", amount }),
                eventId: event.eventId,
                accountCode: cashAccount,
                side: "credit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            })
        ];
        if (taxAmount > 0) {
            postings.push(buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: "liability:output_vat", side: "debit", amount: taxAmount }),
                eventId: event.eventId,
                accountCode: "liability:output_vat",
                side: "debit",
                amount: taxAmount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }));
        }
        const totalDebits = round2Amount(netAmount + taxAmount);
        if (Math.abs(totalDebits - amount) >= 0.01) {
            throw new Error(`Unbalanced order.refunded event: expected ${amount}, got ${totalDebits}`);
        }
        return postings;
    }

    if (["expense.paid", "expense.created"].includes(eventType)) {
        const expenseAccount = normalizeAccountCode(metadata.expenseAccount || "expense:general");
        const cashAccount = normalizeAccountCode(metadata.cashAccount || "asset:cash");
        return [
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: expenseAccount, side: "debit", amount }),
                eventId: event.eventId,
                accountCode: expenseAccount,
                side: "debit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }),
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: cashAccount, side: "credit", amount }),
                eventId: event.eventId,
                accountCode: cashAccount,
                side: "credit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            })
        ];
    }

    if (["commission.accrued", "commission.earned"].includes(eventType)) {
        return [
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: "expense:commission", side: "debit", amount }),
                eventId: event.eventId,
                accountCode: "expense:commission",
                side: "debit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }),
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: "liability:commission_payable", side: "credit", amount }),
                eventId: event.eventId,
                accountCode: "liability:commission_payable",
                side: "credit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            })
        ];
    }

    if (["commission.paid", "commission.settled"].includes(eventType)) {
        const cashAccount = normalizeAccountCode(metadata.cashAccount || "asset:cash");
        return [
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: "liability:commission_payable", side: "debit", amount }),
                eventId: event.eventId,
                accountCode: "liability:commission_payable",
                side: "debit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }),
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: cashAccount, side: "credit", amount }),
                eventId: event.eventId,
                accountCode: cashAccount,
                side: "credit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            })
        ];
    }

    if (["dividend.declared"].includes(eventType)) {
        return [
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: "equity:retained_earnings", side: "debit", amount }),
                eventId: event.eventId,
                accountCode: "equity:retained_earnings",
                side: "debit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }),
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: "liability:dividend_payable", side: "credit", amount }),
                eventId: event.eventId,
                accountCode: "liability:dividend_payable",
                side: "credit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            })
        ];
    }

    if (["dividend.paid"].includes(eventType)) {
        const cashAccount = normalizeAccountCode(metadata.cashAccount || "asset:cash");
        return [
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: "liability:dividend_payable", side: "debit", amount }),
                eventId: event.eventId,
                accountCode: "liability:dividend_payable",
                side: "debit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }),
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: cashAccount, side: "credit", amount }),
                eventId: event.eventId,
                accountCode: cashAccount,
                side: "credit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            })
        ];
    }

    if (["equity.issued", "cap_table.issued"].includes(eventType)) {
        const cashAccount = normalizeAccountCode(metadata.cashAccount || "asset:cash");
        const equityAccount = normalizeAccountCode(metadata.equityAccount || "equity:share_capital");
        return [
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: cashAccount, side: "debit", amount }),
                eventId: event.eventId,
                accountCode: cashAccount,
                side: "debit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }),
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: equityAccount, side: "credit", amount }),
                eventId: event.eventId,
                accountCode: equityAccount,
                side: "credit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            })
        ];
    }

    if (eventType === "manual.adjustment") {
        const debitAccount = normalizeAccountCode(metadata.debitAccount || "");
        const creditAccount = normalizeAccountCode(metadata.creditAccount || "");
        if (!debitAccount || !creditAccount) {
            throw new Error("manual.adjustment requires metadata.debitAccount and metadata.creditAccount");
        }
        return [
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: debitAccount, side: "debit", amount }),
                eventId: event.eventId,
                accountCode: debitAccount,
                side: "debit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            }),
            buildLedgerPostingRecord({
                postingId: buildLedgerPostingId({ eventId: event.eventId, accountCode: creditAccount, side: "credit", amount }),
                eventId: event.eventId,
                accountCode: creditAccount,
                side: "credit",
                amount,
                currency,
                unitId,
                counterpartyId,
                period: event.period
            })
        ];
    }

    throw new Error(`Unsupported ledger event type: ${eventType}`);
}

function aggregatePostingsForSnapshot(postings = []) {
    const byAccount = new Map();
    for (const posting of postings) {
        const accountCode = normalizeAccountCode(posting.accountCode);
        const bucket = byAccount.get(accountCode) || {
            accountCode,
            accountType: normalizeLower(posting.accountType) || inferAccountType(accountCode),
            debitTotal: 0,
            creditTotal: 0,
            amountDelta: 0
        };
        const amount = round2Amount(posting.amount || posting.debit || posting.credit || 0);
        const accountType = normalizeLower(posting.accountType) || inferAccountType(accountCode);
        const signedDelta = (accountType === "asset" || accountType === "expense")
            ? ((posting.side === "debit") ? amount : -amount)
            : ((posting.side === "credit") ? amount : -amount);
        bucket.debitTotal = round2Amount(bucket.debitTotal + Number(posting.debit || 0));
        bucket.creditTotal = round2Amount(bucket.creditTotal + Number(posting.credit || 0));
        bucket.amountDelta = round2Amount(bucket.amountDelta + signedDelta);
        byAccount.set(accountCode, bucket);
    }
    return [...byAccount.values()];
}

async function loadSnapshotClosingBalance({ tx, db, period, accountCode } = {}) {
    const snapshotId = `${period}|${normalizeAccountCode(accountCode)}`;
    const snapshotRef = db.collection("ledger_snapshots").doc(snapshotId);
    const currentSnap = await tx.get(snapshotRef);
    if (currentSnap.exists) {
        return {
            snapshotRef,
            snapshotId,
            snapshot: currentSnap.data() || {}
        };
    }

    const prevPeriod = previousYm(period);
    if (!prevPeriod) {
        return {
            snapshotRef,
            snapshotId,
            snapshot: {
                snapshotId,
                period,
                accountCode: normalizeAccountCode(accountCode),
                openingBalance: 0,
                closingBalance: 0,
                debitTotal: 0,
                creditTotal: 0
            }
        };
    }
    const prevId = `${prevPeriod}|${normalizeAccountCode(accountCode)}`;
    const prevSnap = await tx.get(db.collection("ledger_snapshots").doc(prevId));
    const prevData = prevSnap.exists ? (prevSnap.data() || {}) : {};
    const openingBalance = round2Amount(prevData.closingBalance || 0);
    return {
        snapshotRef,
        snapshotId,
        snapshot: {
            snapshotId,
            period,
            accountCode: normalizeAccountCode(accountCode),
            accountType: normalizeLower(prevData.accountType) || inferAccountType(accountCode),
            openingBalance,
            closingBalance: openingBalance,
            debitTotal: 0,
            creditTotal: 0
        }
    };
}

async function recordLedgerEvent({
    db,
    payload = {},
    createdByUid = "",
    autoGenerateReports = true
} = {}) {
    const eventType = normalizeLower(payload.eventType);
    const sourceType = normalizeLower(payload.sourceType || "manual");
    const sourceId = normalizeText(payload.sourceId || "");
    const sourceLabel = normalizeText(payload.sourceLabel || sourceType || "manual");
    const entityType = normalizeLower(payload.entityType || sourceType || "manual");
    const entityId = normalizeText(payload.entityId || sourceId || "");
    const currency = normalizeUpper(payload.currency || "TWD") || "TWD";
    const grossAmount = round2Amount(payload.amount || payload.grossAmount || 0);
    if (!eventType) throw new Error("eventType is required");
    if (grossAmount <= 0) throw new Error("amount must be greater than 0");

    const occurredAtDate = toDate(payload.occurredAtDate || payload.occurredAt || new Date());
    const eventId = normalizeText(payload.eventId) || buildLedgerEventId({
        eventType,
        sourceType,
        sourceId,
        entityId,
        occurredAtDate,
        amount: grossAmount,
        currency
    });
    const period = payload.period || ymFromDate(occurredAtDate);
    const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
    const eventRef = db.collection("ledger_events").doc(eventId);

    const transactionResult = await db.runTransaction(async (tx) => {
        const existingEvent = await tx.get(eventRef);
        if (existingEvent.exists) {
            return {
                eventId,
                created: false,
                event: existingEvent.data() || null,
                postings: []
            };
        }

        const eventDoc = buildLedgerEventRecord({
            eventId,
            eventType,
            sourceType,
            sourceId,
            sourceLabel,
            entityType,
            entityId,
            currency,
            grossAmount,
            note: payload.note || "",
            occurredAtDate,
            metadata: {
                ...metadata,
                unitId: normalizeText(metadata.unitId || payload.unitId || ""),
                period,
                createdByUid: normalizeText(createdByUid)
            }
        });

        const rawPostings = Array.isArray(payload.postings) && payload.postings.length > 0
            ? payload.postings
            : defaultPostingPlanForEvent({
                eventId,
                eventType,
                sourceType,
                sourceId,
                sourceLabel,
                entityType,
                entityId,
                currency,
                grossAmount,
                metadata,
                period
            });

        const postings = rawPostings.map((posting) => {
            const amount = round2Amount(posting.amount || posting.debit || posting.credit || 0);
            if (amount <= 0) {
                throw new Error("ledger posting amount must be greater than 0");
            }
            const side = normalizeLower(posting.side || (Number(posting.debit || 0) > 0 ? "debit" : "credit"));
            return buildLedgerPostingRecord({
                postingId: posting.postingId || buildLedgerPostingId({
                    eventId,
                    accountCode: posting.accountCode,
                    side,
                    amount,
                    currency
                }),
                eventId,
                accountCode: posting.accountCode,
                accountType: posting.accountType,
                side,
                amount,
                currency,
                unitId: posting.unitId || metadata.unitId || payload.unitId || "",
                counterpartyId: posting.counterpartyId || entityId,
                period
            });
        });

        const totalDebit = round2Amount(postings.reduce((sum, p) => sum + Number(p.debit || 0), 0));
        const totalCredit = round2Amount(postings.reduce((sum, p) => sum + Number(p.credit || 0), 0));
        if (Math.abs(totalDebit - totalCredit) >= 0.01) {
            throw new Error(`ledger event ${eventId} is not balanced: debit=${totalDebit}, credit=${totalCredit}`);
        }

        const postingAggregate = aggregatePostingsForSnapshot(postings);
        const snapshotPlans = [];
        for (const bucket of postingAggregate) {
            const snapshotPlan = await loadSnapshotClosingBalance({
                tx,
                db,
                period,
                accountCode: bucket.accountCode
            });
            snapshotPlans.push({ bucket, ...snapshotPlan });
        }

        tx.set(eventRef, {
            ...eventDoc,
            createdByUid: normalizeText(createdByUid)
        }, { merge: true });

        for (const posting of postings) {
            const postingRef = db.collection("ledger_postings").doc(posting.postingId);
            tx.set(postingRef, {
                ...posting,
                createdByUid: normalizeText(createdByUid)
            }, { merge: true });
        }

        for (const { bucket, snapshotRef, snapshot } of snapshotPlans) {
            const accountType = bucket.accountType || snapshot.accountType || inferAccountType(bucket.accountCode);
            const openingBalance = round2Amount(snapshot.openingBalance || 0);
            const priorDebit = round2Amount(snapshot.debitTotal || 0);
            const priorCredit = round2Amount(snapshot.creditTotal || 0);
            const priorClosing = round2Amount(snapshot.closingBalance || openingBalance);
            const nextDebit = round2Amount(priorDebit + bucket.debitTotal);
            const nextCredit = round2Amount(priorCredit + bucket.creditTotal);
            const nextClosing = round2Amount(priorClosing + bucket.amountDelta);
            tx.set(snapshotRef, {
                snapshotId: `${period}|${bucket.accountCode}`,
                period,
                accountCode: bucket.accountCode,
                accountType,
                openingBalance,
                debitTotal: nextDebit,
                creditTotal: nextCredit,
                closingBalance: nextClosing,
                currency,
                locked: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: snapshot.createdAt || admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        return {
            eventId,
            created: true,
            event: eventDoc,
            postings
        };
    });

    if (autoGenerateReports) {
        const reportTypes = Array.isArray(payload.reportTypes) && payload.reportTypes.length > 0
            ? payload.reportTypes
            : ["trial_balance", "profit_and_loss"];
        const generatedReports = [];
        for (const reportType of reportTypes) {
            try {
                const report = await generateLedgerReport({
                    db,
                    period,
                    reportType,
                    createdByUid
                });
                generatedReports.push(report);
            } catch (reportErr) {
                console.warn(`[ledger-engine] generate report failed (${reportType}, ${period}):`, reportErr.message || reportErr);
            }
        }
        return {
            ...transactionResult,
            period,
            reports: generatedReports
        };
    }

    return {
        ...transactionResult,
        period
    };
}

async function generateLedgerReport({
    db,
    period,
    reportType = "trial_balance",
    createdByUid = ""
} = {}) {
    const normalizedPeriod = normalizeText(period);
    if (!normalizedPeriod) throw new Error("period is required");
    const normalizedReportType = normalizeLower(reportType);
    const snapQuery = await db.collection("ledger_snapshots")
        .where("period", "==", normalizedPeriod)
        .get();
    const accountCodes = new Set();
    const rows = [];
    for (const doc of snapQuery.docs) {
        const row = doc.data() || {};
        if (normalizedReportType === "balance_sheet") {
            if (!["asset", "liability", "equity"].includes(normalizeLower(row.accountType))) continue;
        }
        if (normalizedReportType === "profit_and_loss" || normalizedReportType === "p_and_l") {
            if (!["revenue", "expense"].includes(normalizeLower(row.accountType))) continue;
        }
        accountCodes.add(normalizeAccountCode(row.accountCode || doc.id));
        rows.push({
            snapshotId: doc.id,
            period: row.period || normalizedPeriod,
            accountCode: normalizeAccountCode(row.accountCode || doc.id),
            accountType: normalizeLower(row.accountType) || inferAccountType(row.accountCode || doc.id),
            openingBalance: round2Amount(row.openingBalance || 0),
            debitTotal: round2Amount(row.debitTotal || 0),
            creditTotal: round2Amount(row.creditTotal || 0),
            closingBalance: round2Amount(row.closingBalance || 0),
            currency: normalizeUpper(row.currency || "TWD") || "TWD"
        });
    }

    rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    const totals = rows.reduce((acc, row) => {
        acc.openingBalance = round2Amount(acc.openingBalance + row.openingBalance);
        acc.debitTotal = round2Amount(acc.debitTotal + row.debitTotal);
        acc.creditTotal = round2Amount(acc.creditTotal + row.creditTotal);
        acc.closingBalance = round2Amount(acc.closingBalance + row.closingBalance);
        return acc;
    }, { openingBalance: 0, debitTotal: 0, creditTotal: 0, closingBalance: 0 });

    const reportIdSeed = `${normalizedReportType}|${normalizedPeriod}`;
    const reportId = crypto.createHash("sha256").update(reportIdSeed).digest("hex").slice(0, 40);
    const reportRef = db.collection("ledger_reports").doc(reportId);
    const reportPayload = {
        reportId,
        reportType: normalizedReportType,
        period: normalizedPeriod,
        currency: "TWD",
        snapshotCount: rows.length,
        accountCodes: [...accountCodes],
        rows,
        totals,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedByUid: normalizeText(createdByUid)
    };
    await reportRef.set(reportPayload, { merge: true });
    return reportPayload;
}

module.exports = {
    aggregatePostingsForSnapshot,
    buildLedgerEventId,
    buildLedgerEventRecord,
    buildLedgerPostingId,
    buildLedgerPostingRecord,
    defaultPostingPlanForEvent,
    generateLedgerReport,
    inferAccountType,
    normalizeAccountCode,
    normalizeLower,
    normalizeText,
    recordLedgerEvent,
    round2Amount,
    toDate,
    ymFromDate
};
