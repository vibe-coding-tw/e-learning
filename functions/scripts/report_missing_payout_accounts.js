#!/usr/bin/env node
/**
 * Report recipients with pending share payouts due to missing payout account.
 *
 * Usage:
 *   node functions/scripts/report_missing_payout_accounts.js
 *   node functions/scripts/report_missing_payout_accounts.js --top=50
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function parseArgs(argv) {
  const out = { top: 100 };
  for (const token of argv.slice(2)) {
    if (token.startsWith("--top=")) {
      const n = Number(token.split("=")[1]);
      if (Number.isFinite(n) && n > 0) out.top = Math.floor(n);
    }
  }
  return out;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function main() {
  const args = parseArgs(process.argv);
  const creditsSnap = await db.collection("revenue_share_credits")
    .where("status", "==", "pending_account")
    .get();

  const byRecipient = new Map();
  for (const doc of creditsSnap.docs) {
    const c = doc.data() || {};
    const email = String(c.recipientEmail || "").trim().toLowerCase();
    if (!email) continue;
    const rec = byRecipient.get(email) || {
      recipientEmail: email,
      credits: 0,
      pendingAmount: 0,
      nextPayoutPeriodMin: "",
      roles: new Set()
    };
    rec.credits += 1;
    rec.pendingAmount = round2(rec.pendingAmount + Number(c.remainingCredit || 0));
    const npp = String(c.nextPayoutPeriod || "");
    if (npp && (!rec.nextPayoutPeriodMin || npp < rec.nextPayoutPeriodMin)) {
      rec.nextPayoutPeriodMin = npp;
    }
    if (c.role) rec.roles.add(String(c.role));
    byRecipient.set(email, rec);
  }

  const rows = [...byRecipient.values()]
    .map((r) => ({
      recipientEmail: r.recipientEmail,
      credits: r.credits,
      pendingAmount: round2(r.pendingAmount),
      nextPayoutPeriodMin: r.nextPayoutPeriodMin || null,
      roles: [...r.roles].sort()
    }))
    .sort((a, b) => b.pendingAmount - a.pendingAmount)
    .slice(0, args.top);

  const totalPending = rows.reduce((acc, r) => acc + Number(r.pendingAmount || 0), 0);
  const report = {
    generatedAt: new Date().toISOString(),
    recipients: rows.length,
    totalPendingAmount: round2(totalPending),
    rows
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("[report_missing_payout_accounts] failed:", err);
  process.exit(1);
});
