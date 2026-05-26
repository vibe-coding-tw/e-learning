#!/usr/bin/env node
/**
 * Seed default revenue share policies.
 * Usage:
 *   node functions/scripts/seed_revenue_share_policies.js --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const shouldApply = process.argv.includes("--apply");

const policies = [
  {
    id: "default-v1",
    policyName: "Default Sharing Policy",
    tutorRate: 0.2,
    tutorUplineRate: 0.2,
    agentRate: 0.2,
    agentUplineRate: 0,
    courseDevRate: 0.2,
    enabled: true
  },
  {
    id: "tw-direct-v1",
    policyName: "TW Direct Sales Policy",
    tutorRate: 0.2,
    tutorUplineRate: 0.2,
    agentRate: 0,
    agentUplineRate: 0,
    courseDevRate: 0.2,
    enabled: true
  },
  {
    id: "tw-agent-v1",
    policyName: "TW Channel Partner Policy",
    tutorRate: 0.2,
    tutorUplineRate: 0.2,
    agentRate: 0.2,
    agentUplineRate: 0.1,
    courseDevRate: 0.2,
    enabled: true
  }
];

async function main() {
  const col = db.collection("revenue_share_policies");
  console.log(`[seed] mode=${shouldApply ? "APPLY" : "DRY_RUN"} count=${policies.length}`);

  for (const policy of policies) {
    const ref = col.doc(policy.id);
    const payload = {
      ...policy,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (!shouldApply) {
      console.log(`[dry-run] ${policy.id}`, policy);
      continue;
    }
    await ref.set(payload, { merge: true });
    console.log(`[apply] upserted ${policy.id}`);
  }
}

main()
  .then(() => {
    console.log("[seed] done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
