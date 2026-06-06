#!/usr/bin/env node
/**
 * Seed canonical region-to-distributor routing rules.
 *
 * Usage:
 *   node functions/scripts/seed_region_distributor_rules.js --dry-run
 *   node functions/scripts/seed_region_distributor_rules.js --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

const REGION_RULES = [
  {
    region: "TW",
    defaultDistributorId: "default-twd",
    backupDistributorIds: [],
    rankingMode: "default_only",
    manualOverrideEnabled: true,
    active: true,
  },
  {
    region: "US",
    defaultDistributorId: "default-usd",
    backupDistributorIds: [],
    rankingMode: "default_only",
    manualOverrideEnabled: true,
    active: true,
  },
];

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    dryRun: argv.includes("--dry-run") || !argv.includes("--apply"),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`[seed_region_distributor_rules] mode=${args.apply ? "APPLY" : "DRY_RUN"} rules=${REGION_RULES.length}`);

  let created = 0;
  let updated = 0;

  for (const rule of REGION_RULES) {
    const ref = db.collection("region_distributor_rules").doc(rule.region);
    const snap = await ref.get();
    const exists = snap.exists;
    const data = snap.exists ? (snap.data() || {}) : {};
    const payload = {
      region: rule.region,
      defaultDistributorId: rule.defaultDistributorId,
      backupDistributorIds: rule.backupDistributorIds,
      rankingMode: rule.rankingMode,
      manualOverrideEnabled: rule.manualOverrideEnabled,
      active: rule.active,
      createdAt: exists && data.createdAt ? data.createdAt : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!args.apply) {
      console.log(`[dry-run] ${rule.region}`, payload);
      if (exists) updated += 1;
      else created += 1;
      continue;
    }

    await ref.set(payload, { merge: true });
    if (exists) updated += 1;
    else created += 1;
    console.log(`[apply] ${rule.region} ${exists ? "updated" : "created"}`);
  }

  console.log(`[summary] created=${created} updated=${updated}`);
}

main()
  .then(() => {
    console.log("[seed_region_distributor_rules] done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[seed_region_distributor_rules] failed:", err);
    process.exit(1);
  });
