#!/usr/bin/env node
/**
 * Backfill course pricing for metadata_lessons.
 *
 * Supported course families:
 * - started  -> TWD 1200 / USD 40
 * - basic    -> TWD 1500 / USD 50
 * - advanced -> TWD 1800 / USD 60
 *
 * Usage:
 *   node functions/scripts/backfill_course_pricing.js --dry-run
 *   node functions/scripts/backfill_course_pricing.js --apply
 *   node functions/scripts/backfill_course_pricing.js --apply --limit=20
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    limit: 0,
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
      continue;
    }
    if (token === "--dry-run") {
      args.apply = false;
      args.dryRun = true;
      continue;
    }
    if (token.startsWith("--limit=")) {
      args.limit = Number(token.split("=")[1] || "0") || 0;
    }
  }

  return args;
}

function normalizeLegacyPrice(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function deriveUsdFromTwd(twdAmount) {
  const numeric = normalizeLegacyPrice(twdAmount);
  if (numeric <= 0) return 0;
  return Math.max(1, Math.round(numeric / 30));
}

function pricingByCategory(category, twAmount) {
  const amount = normalizeLegacyPrice(twAmount);
  const usdByCategory = {
    started: 40,
    basic: 50,
    advanced: 60,
  };
  const usdAmount = usdByCategory[category] ?? deriveUsdFromTwd(amount);
  return {
    pricing: {
      tw: { amount, currency: "TWD" },
      en: { amount: usdAmount, currency: "USD" },
    },
    prices: {
      tw: amount,
      en: usdAmount,
    },
    priceByLocale: {
      "zh-TW": { amount, currency: "TWD" },
      en: { amount: usdAmount, currency: "USD" },
    },
    priceByRegion: {
      tw: { amount, currency: "TWD" },
      en: { amount: usdAmount, currency: "USD" },
    },
    priceMap: {
      tw: { amount, currency: "TWD" },
      en: { amount: usdAmount, currency: "USD" },
    },
    price_twd: amount,
    price_usd: usdAmount,
    currency: "TWD",
  };
}

function shouldBackfill(docData = {}) {
  const category = String(docData.category || "").trim().toLowerCase();
  return category === "started" || category === "basic" || category === "advanced";
}

function buildPatch(docData = {}) {
  const category = String(docData.category || "").trim().toLowerCase();
  return {
    price: normalizeLegacyPrice(docData.price),
    ...pricingByCategory(category, docData.price),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    pricingVersion: docData.pricingVersion || "v1",
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "apply" : "dry-run";

  const snap = await db.collection("metadata_lessons").get();
  const docs = args.limit > 0 ? snap.docs.slice(0, args.limit) : snap.docs;

  console.log(`[backfill_course_pricing] mode=${mode} docs=${docs.length}`);

  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const data = doc.data() || {};
    if (!shouldBackfill(data)) {
      skipped += 1;
      continue;
    }

    const patch = buildPatch(data);
    const current = {
      price: data.price,
      pricing: data.pricing,
      prices: data.prices,
      priceByLocale: data.priceByLocale,
      priceByRegion: data.priceByRegion,
      priceMap: data.priceMap,
      price_twd: data.price_twd,
      price_usd: data.price_usd,
      currency: data.currency,
    };

    const next = {
      price: patch.price,
      pricing: patch.pricing,
      prices: patch.prices,
      priceByLocale: patch.priceByLocale,
      priceByRegion: patch.priceByRegion,
      priceMap: patch.priceMap,
      price_twd: patch.price_twd,
      price_usd: patch.price_usd,
      currency: patch.currency,
    };

    const changed = JSON.stringify(current) !== JSON.stringify(next);
    if (!changed) {
      skipped += 1;
      continue;
    }

    console.log(
      `[metadata_lessons] ${mode.toUpperCase()} docId=${doc.id} ` +
      `category=${data.category || ""} price_twd=${patch.price_twd} price_usd=${patch.price_usd}`
    );

    if (args.apply) {
      await doc.ref.set(patch, { merge: true });
      updated += 1;
    } else {
      updated += 1;
    }
  }

  console.log(`[summary] updated=${updated} skipped=${skipped} mode=${mode}`);
}

main().catch((err) => {
  console.error("[backfill_course_pricing] failed:", err);
  process.exit(1);
});
