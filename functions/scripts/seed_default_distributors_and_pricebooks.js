#!/usr/bin/env node
/**
 * Seed two default distributors and build price books for all current products.
 *
 * Usage:
 *   node functions/scripts/seed_default_distributors_and_pricebooks.js --dry-run
 *   node functions/scripts/seed_default_distributors_and_pricebooks.js --apply
 *   node functions/scripts/seed_default_distributors_and_pricebooks.js --apply --overwrite
 */

const admin = require("firebase-admin");
const { resolveLessonPrice } = require("../lib/pricing-utils");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

const DEFAULT_DISTRIBUTORS = [
  {
    id: "default-twd",
    name: "預設台幣經銷商",
    defaultCurrency: "TWD",
    regions: ["tw"],
    locale: "zh-TW",
  },
  {
    id: "default-usd",
    name: "預設美金經銷商",
    defaultCurrency: "USD",
    regions: ["en"],
    locale: "en",
  },
];

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    dryRun: argv.includes("--dry-run") || !argv.includes("--apply"),
    overwrite: argv.includes("--overwrite"),
  };
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeMoney(value = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function buildDocId(lesson = {}) {
  return normalizeText(
    lesson.id ||
    lesson.courseId ||
    lesson.courseKey ||
    lesson.entryUnitId ||
    lesson.sku ||
    ""
  );
}

function getHardcodedDefaultPrice(docId, currency = "TWD") {
  const isUsd = currency === "USD";
  const pid = String(docId || '').toLowerCase();
  
  if (pid.startsWith('car-starter-') || pid.startsWith('start-')) {
    return isUsd ? 40 : 1200;
  }
  if (pid.startsWith('car-basic-') || pid.startsWith('basic-')) {
    return isUsd ? 50 : 1500;
  }
  if (pid.startsWith('car-advanced-') || pid.startsWith('adv-') || pid.startsWith('advanced-')) {
    return isUsd ? 60 : 1800;
  }
  if (pid === 'esp32-c3') {
    return isUsd ? 60 : 1600;
  }
  if (pid === 'esp32-s3') {
    return isUsd ? 130 : 3600;
  }
  return 0;
}

function buildSeedableProducts(lessons = [], currency = "TWD") {
  const normalizedCurrency = String(currency || "TWD").toUpperCase() === "USD" ? "USD" : "TWD";

  return (Array.isArray(lessons) ? lessons : [])
    .map((lesson) => {
      const docId = buildDocId(lesson);
      const salePrice = getHardcodedDefaultPrice(docId, normalizedCurrency);
      return {
        docId,
        title: lesson.title || lesson.name || docId || "未命名商品",
        isPhysical: lesson.isPhysical === true,
        currency: normalizedCurrency,
        salePrice: salePrice,
        pricingVersion: "v1",
      };
    })
    .filter((item) => item.docId && Number.isFinite(item.salePrice) && item.salePrice >= 0);
}

function buildDistributorPayload(definition) {
  return {
    name: definition.name,
    status: "ACTIVE",
    regions: definition.regions,
    defaultCurrency: definition.defaultCurrency,
    pricePolicyMode: "GUIDED",
    settlementMethod: "monthly_snapshot",
    locale: definition.locale,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function buildPriceBookId(distributorId, docId) {
  return normalizeText(`${distributorId}_${docId}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gi, "-");
}

async function loadLessons() {
  const snap = await db.collection("metadata_lessons").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function main() {
  const args = parseArgs(process.argv);
  const lessons = await loadLessons();
  console.log(`[seed_default_distributors_and_pricebooks] mode=${args.apply ? "APPLY" : "DRY_RUN"} overwrite=${args.overwrite ? "yes" : "no"} lessons=${lessons.length}`);

  const seedableByCurrency = {
    TWD: buildSeedableProducts(lessons, "TWD"),
    USD: buildSeedableProducts(lessons, "USD"),
  };

  let distributorCreated = 0;
  let distributorUpdated = 0;
  let priceBookCreated = 0;
  let priceBookUpdated = 0;
  let priceBookSkipped = 0;

  for (const distributor of DEFAULT_DISTRIBUTORS) {
    const distributorRef = db.collection("distributors").doc(distributor.id);
    const distributorSnap = await distributorRef.get();
    const distributorExists = distributorSnap.exists;
    const distributorData = distributorExists ? (distributorSnap.data() || {}) : {};
    const distributorPayload = {
      ...buildDistributorPayload(distributor),
      createdAt: distributorExists && distributorData.createdAt
        ? distributorData.createdAt
        : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!args.apply) {
      console.log(`[dry-run][distributor] ${distributor.id}`, {
        name: distributorPayload.name,
        defaultCurrency: distributorPayload.defaultCurrency,
        regions: distributorPayload.regions,
        pricePolicyMode: distributorPayload.pricePolicyMode,
      });
    } else {
      await distributorRef.set(distributorPayload, { merge: true });
      if (distributorExists) distributorUpdated += 1;
      else distributorCreated += 1;
      console.log(`[apply][distributor] ${distributor.id} ${distributorExists ? "updated" : "created"}`);
    }

    const products = seedableByCurrency[distributor.defaultCurrency] || [];
    console.log(`[seed] distributor=${distributor.id} products=${products.length}`);

    for (const item of products) {
      const priceBookId = buildPriceBookId(distributor.id, item.docId);
      const priceBookRef = db.collection("dealer_price_books").doc(priceBookId);
      const priceBookSnap = await priceBookRef.get();
      const priceBookExists = priceBookSnap.exists;
      const priceBookData = priceBookExists ? (priceBookSnap.data() || {}) : {};

      if (priceBookExists && !args.overwrite) {
        priceBookSkipped += 1;
        continue;
      }

      const priceBookPayload = {
        distributorId: distributor.id,
        docId: item.docId,
        sourceDocId: item.docId,
        currency: item.currency || distributor.defaultCurrency,
        salePrice: item.salePrice,
        effectiveFrom: priceBookData.effectiveFrom || admin.firestore.FieldValue.serverTimestamp(),
        ...(priceBookData.effectiveTo != null && !args.overwrite ? { effectiveTo: priceBookData.effectiveTo } : {}),
        ...(priceBookData.promoPrice != null && !args.overwrite ? { promoPrice: priceBookData.promoPrice } : {}),
        ...(priceBookData.promoEffectiveFrom != null && !args.overwrite ? { promoEffectiveFrom: priceBookData.promoEffectiveFrom } : {}),
        ...(priceBookData.promoEffectiveTo != null && !args.overwrite ? { promoEffectiveTo: priceBookData.promoEffectiveTo } : {}),
        isActive: priceBookData.isActive !== false,
        version: normalizeText(priceBookData.version || item.pricingVersion || "v1") || "v1",
        sourceDocId: item.docId,
        sourceLessonTitle: item.title,
        sourceIsPhysical: item.isPhysical === true,
        updatedBy: "seed_default_distributors_and_pricebooks",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: priceBookExists && priceBookData.createdAt
          ? priceBookData.createdAt
          : admin.firestore.FieldValue.serverTimestamp(),
      };

      if (!args.apply) {
        console.log(`[dry-run][pricebook] ${priceBookId}`, {
          distributorId: priceBookPayload.distributorId,
          docId: priceBookPayload.docId,
          currency: priceBookPayload.currency,
          salePrice: priceBookPayload.salePrice,
          version: priceBookPayload.version,
        });
        if (priceBookExists) priceBookUpdated += 1;
        else priceBookCreated += 1;
        continue;
      }

      await priceBookRef.set(priceBookPayload, { merge: true });
      if (priceBookExists) priceBookUpdated += 1;
      else priceBookCreated += 1;
    }
  }

  console.log(
    `[summary] distributors_created=${distributorCreated} distributors_updated=${distributorUpdated} ` +
    `pricebooks_created=${priceBookCreated} pricebooks_updated=${priceBookUpdated} pricebooks_skipped=${priceBookSkipped}`
  );
}

main()
  .then(() => {
    console.log("[seed_default_distributors_and_pricebooks] done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[seed_default_distributors_and_pricebooks] failed:", err);
    process.exit(1);
  });
