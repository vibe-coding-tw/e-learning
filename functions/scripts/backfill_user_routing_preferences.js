#!/usr/bin/env node
/**
 * Backfill user routing preferences from existing region rules.
 *
 * Usage:
 *   node functions/scripts/backfill_user_routing_preferences.js --dry-run
 *   node functions/scripts/backfill_user_routing_preferences.js --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    dryRun: argv.includes("--dry-run") || !argv.includes("--apply"),
  };
}

function normalizeRegionCode(value = "") {
  return String(value || "").trim().toUpperCase();
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

async function loadRegionRules() {
  const snap = await db.collection("region_distributor_rules").get();
  const rules = new Map();
  snap.forEach((doc) => {
    const data = doc.data() || {};
    const region = normalizeRegionCode(data.region || doc.id);
    if (!region) return;
    rules.set(region, {
      region,
      defaultDistributorId: normalizeText(data.defaultDistributorId || ""),
      backupDistributorIds: Array.isArray(data.backupDistributorIds) ? data.backupDistributorIds.map(normalizeText).filter(Boolean) : [],
      active: data.active !== false,
    });
  });
  return rules;
}

async function loadActiveDistributors() {
  const snap = await db.collection("distributors").get();
  const distributors = new Map();
  snap.forEach((doc) => {
    const data = doc.data() || {};
    if (data.status !== "ACTIVE") return;
    distributors.set(doc.id, { id: doc.id, ...data });
  });
  return distributors;
}

function pickDistributorForRegion(region, rules, distributors) {
  const normalizedRegion = normalizeRegionCode(region);
  const rule = rules.get(normalizedRegion) || null;
  if (rule && rule.active) {
    if (rule.defaultDistributorId && distributors.has(rule.defaultDistributorId)) {
      return rule.defaultDistributorId;
    }
    for (const candidateId of rule.backupDistributorIds || []) {
      if (candidateId && distributors.has(candidateId)) return candidateId;
    }
  }

  for (const distributor of distributors.values()) {
    const regions = Array.isArray(distributor.regions) ? distributor.regions : [];
    if (regions.map(normalizeRegionCode).includes(normalizedRegion)) {
      return distributor.id;
    }
  }

  if (normalizedRegion === "TW" && distributors.has("default-twd")) return "default-twd";
  if (normalizedRegion === "US" && distributors.has("default-usd")) return "default-usd";
  return "";
}

async function main() {
  const args = parseArgs(process.argv);
  const [rules, distributors, usersSnap] = await Promise.all([
    loadRegionRules(),
    loadActiveDistributors(),
    db.collection("users").get(),
  ]);

  console.log(`[backfill_user_routing_preferences] mode=${args.apply ? "APPLY" : "DRY_RUN"} users=${usersSnap.size}`);

  let updated = 0;
  let skipped = 0;
  let unresolved = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data() || {};
    const region = normalizeRegionCode(data.region || data.preferredRegion || "");
    const preferredRegion = normalizeRegionCode(data.preferredRegion || region);
    const preferredDistributorId = normalizeText(data.preferredDistributorId || "");
    if (preferredRegion && preferredDistributorId) {
      skipped += 1;
      continue;
    }

    const resolvedDistributorId = preferredDistributorId || pickDistributorForRegion(region, rules, distributors);
    if (!preferredRegion && !region) {
      unresolved += 1;
      console.warn(`[unresolved] ${doc.id} has no region; skipping`);
      continue;
    }
    if (!resolvedDistributorId) {
      unresolved += 1;
      console.warn(`[unresolved] ${doc.id} region=${region} could not resolve distributor`);
      continue;
    }

    const patch = {
      preferredRegion: preferredRegion || region,
      preferredDistributorId: resolvedDistributorId,
      bindingSource: data.bindingSource || "regionDefault",
      bindingConfidence: typeof data.bindingConfidence === "number" ? data.bindingConfidence : 0.5,
      bindingUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      region: region || preferredRegion,
    };

    if (!args.apply) {
      console.log(`[dry-run] ${doc.id}`, patch);
      updated += 1;
      continue;
    }

    await db.collection("users").doc(doc.id).set(patch, { merge: true });
    updated += 1;
  }

  console.log(`[summary] updated=${updated} skipped=${skipped} unresolved=${unresolved}`);
}

main()
  .then(() => {
    console.log("[backfill_user_routing_preferences] done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[backfill_user_routing_preferences] failed:", err);
    process.exit(1);
  });
