#!/usr/bin/env node
/**
 * Simulate monthly sharing without writing profit_ledger.
 *
 * Usage:
 *   node functions/scripts/simulate_monthly_sharing.js
 *   node functions/scripts/simulate_monthly_sharing.js --period=2026-05
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const crypto = require("crypto");

function parseArgs(argv) {
  const out = { period: "" };
  for (const token of argv.slice(2)) {
    if (token.startsWith("--period=")) out.period = token.split("=")[1] || "";
  }
  return out;
}

function getWindow(period = "") {
  if (period) {
    const m = /^(\d{4})-(\d{2})$/.exec(period);
    if (!m) throw new Error(`invalid --period: ${period}`);
    const y = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const start = new Date(y, mm, 1, 0, 0, 0);
    const end = new Date(y, mm + 1, 0, 23, 59, 59);
    return { start, end, period };
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const p = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  return { start, end, period: p };
}

async function main() {
  const args = parseArgs(process.argv);
  const window = getWindow(args.period);

  const fallbackPolicy = {
    policyId: "default-v1",
    policyName: "Default Sharing Policy",
    tutorRate: 0.2,
    tutorUplineRate: 0.2,
    agentRate: 0.2,
    agentUplineRate: 0,
    courseDevRate: 0.2,
    courseDevUplineRate: 0.1,
    enabled: true
  };

  const policyCache = new Map();
  const userByEmailCache = new Map();

  async function getUserByEmail(email = "") {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return null;
    if (userByEmailCache.has(normalized)) return userByEmailCache.get(normalized);
    const snap = await db.collection("users").where("email", "==", normalized).limit(1).get();
    const row = snap.empty ? null : (snap.docs[0].data() || null);
    userByEmailCache.set(normalized, row);
    return row;
  }

  async function loadPolicyById(policyId = "") {
    const requested = String(policyId || "").trim() || fallbackPolicy.policyId;
    const normalized = fallbackPolicy.policyId;
    if (requested !== normalized) {
      console.warn(`[simulate] policy ${requested} is deprecated; using ${normalized}.`);
    }
    if (policyCache.has(normalized)) return policyCache.get(normalized);
    let policy = fallbackPolicy;
    const snap = await db.collection("revenue_share_policies").doc(normalized).get();
    if (snap.exists) {
      const raw = snap.data() || {};
      policy = {
        policyId: normalized,
        policyName: raw.policyName || raw.name || normalized,
        tutorRate: Number(raw.tutorRate ?? fallbackPolicy.tutorRate),
        tutorUplineRate: Number(raw.tutorUplineRate ?? fallbackPolicy.tutorUplineRate),
        agentRate: Number(raw.agentRate ?? fallbackPolicy.agentRate),
        agentUplineRate: Number(raw.agentUplineRate ?? fallbackPolicy.agentUplineRate),
        courseDevRate: Number(raw.courseDevRate ?? fallbackPolicy.courseDevRate),
        courseDevUplineRate: Number(raw.courseDevUplineRate ?? fallbackPolicy.courseDevUplineRate),
        enabled: raw.enabled !== false
      };
    }
    if (!policy.enabled) policy = fallbackPolicy;
    policyCache.set(normalized, policy);
    return policy;
  }

  const orders = await db.collection("orders")
    .where("paidAt", ">=", admin.firestore.Timestamp.fromDate(window.start))
    .where("paidAt", "<=", admin.firestore.Timestamp.fromDate(window.end))
    .get();

  const byRole = { tutor: 0, agent: 0, courseDev: 0 };
  const countByRole = { tutor: 0, agent: 0, courseDev: 0 };
  const byRecipient = new Map();
  let lineCount = 0;
  const rows = [];

  async function addLine({ role, recipientEmail, orderId, orderItemId, orderAmount, shareAmount, level, policy }) {
    const recipient = String(recipientEmail || "").trim().toLowerCase();
    if (!recipient || shareAmount < 0.01) return;
    const idempotencySeed = `${window.period}|${orderId}|${orderItemId}|${role}|${level}|${recipient}`;
    const idempotencyKey = crypto.createHash("sha256").update(idempotencySeed).digest("hex").slice(0, 40);
    const rounded = Math.round(shareAmount * 100) / 100;
    lineCount += 1;
    byRole[role] += rounded;
    countByRole[role] += 1;
    byRecipient.set(recipient, (byRecipient.get(recipient) || 0) + rounded);
    rows.push({
      idempotencyKey,
      role,
      recipientEmail: recipient,
      orderId,
      orderItemId,
      orderAmount,
      shareAmount: rounded,
      level,
      policyId: policy.policyId
    });
  }

  for (const doc of orders.docs) {
    const order = doc.data() || {};
    if (order.status !== "SUCCESS") continue;
    const orderId = doc.id;
    const items = order.items || {};
    for (const [itemKey, itemValue] of Object.entries(items)) {
      const quantity = parseInt(itemValue?.quantity || 1, 10) || 1;
      const itemPrice = parseFloat(itemValue?.price || 0) || 0;
      const lineAmount = itemPrice * quantity;
      if (lineAmount <= 0) continue;

      const policy = await loadPolicyById(String(order.policyId || "").trim() || fallbackPolicy.policyId);
      const initialTutor = String(
        itemValue?.referredTutorEmail ||
        itemValue?.referralTutor ||
        "info@vibe-coding.tw"
      ).trim().toLowerCase();

      let currentTutorEmail = initialTutor;
      let currentTutorShare = lineAmount * Number(policy.tutorRate || fallbackPolicy.tutorRate);
      let tutorLevel = 1;
      while (currentTutorEmail && currentTutorShare >= 0.01) {
        await addLine({
          role: "user",
          recipientRole: "tutor",
          recipientEmail: currentTutorEmail,
          orderId,
          orderItemId: itemKey,
          orderAmount: lineAmount,
          shareAmount: currentTutorShare,
          level: tutorLevel,
          policy
        });
        if (currentTutorEmail === "info@vibe-coding.tw") break;
        const tutorData = await getUserByEmail(currentTutorEmail);
        currentTutorEmail = String(tutorData?.tutorEmail || "info@vibe-coding.tw").trim().toLowerCase();
        currentTutorShare = currentTutorShare * Number(policy.tutorUplineRate || fallbackPolicy.tutorUplineRate);
        tutorLevel += 1;
      }

      const tutorData = await getUserByEmail(initialTutor);
      const agentEmail = String(
        itemValue?.agentEmail ||
        itemValue?.referredAgentEmail ||
        itemValue?.referralAgent ||
        order?.agentEmail ||
        tutorData?.agentEmail ||
        ""
      ).trim().toLowerCase();
      if (agentEmail && Number(policy.agentRate || 0) > 0) {
        let currentAgentEmail = agentEmail;
        let currentAgentShare = lineAmount * Number(policy.agentRate || 0);
        let agentLevel = 1;
        while (currentAgentEmail && currentAgentShare >= 0.01) {
          await addLine({
            role: "agent",
            recipientEmail: currentAgentEmail,
            orderId,
            orderItemId: itemKey,
            orderAmount: lineAmount,
            shareAmount: currentAgentShare,
            level: agentLevel,
            policy
          });
          const agentData = await getUserByEmail(currentAgentEmail);
          const nextAgent = String(agentData?.agentEmail || "").trim().toLowerCase();
          if (!nextAgent || nextAgent === currentAgentEmail) break;
          currentAgentEmail = nextAgent;
          currentAgentShare = currentAgentShare * Number(policy.agentUplineRate || 0);
          agentLevel += 1;
        }
      }

      const courseDevEmail = String(
        itemValue?.courseDevEmail ||
        itemValue?.ownerTutorEmail ||
        order?.courseDevEmail ||
        ""
      ).trim().toLowerCase();
      if (courseDevEmail && Number(policy.courseDevRate || 0) > 0) {
        await addLine({
          role: "courseDev",
          recipientEmail: courseDevEmail,
          orderId,
          orderItemId: itemKey,
          orderAmount: lineAmount,
          shareAmount: lineAmount * Number(policy.courseDevRate || 0),
          level: 1,
          policy
        });
      }
    }
  }

  const topRecipients = [...byRecipient.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([email, amount]) => ({ email, amount: Math.round(amount * 100) / 100 }));

  const totalShare = Object.values(byRole).reduce((a, b) => a + b, 0);
  const report = {
    mode: "dry-run",
    period: window.period,
    window: {
      start: window.start.toISOString(),
      end: window.end.toISOString()
    },
    orders: orders.size,
    shareLines: lineCount,
    byRole: Object.fromEntries(Object.entries(byRole).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    countByRole,
    totalShare: Math.round(totalShare * 100) / 100,
    topRecipients,
    sample: rows.slice(0, 15)
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("[simulate_monthly_sharing] failed:", err);
  process.exit(1);
});
