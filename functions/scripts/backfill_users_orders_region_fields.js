#!/usr/bin/env node
/**
 * Backfill region-related fields for users and orders.
 *
 * Usage:
 *   node functions/scripts/backfill_users_orders_region_fields.js --dry-run
 *   node functions/scripts/backfill_users_orders_region_fields.js --apply
 *   node functions/scripts/backfill_users_orders_region_fields.js --apply --users-only
 *   node functions/scripts/backfill_users_orders_region_fields.js --apply --orders-only
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    usersOnly: false,
    ordersOnly: false,
    usersLimit: 0,
    ordersLimit: 0,
    defaults: {
      userLocale: "zh-TW",
      userRegion: "TW",
      orderRegion: "TW",
      orderChannelType: "direct",
      orderPolicyId: "",
      orderPricingVersion: "v1",
    },
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      args.apply = false;
      continue;
    }
    if (token === "--users-only") {
      args.usersOnly = true;
      continue;
    }
    if (token === "--orders-only") {
      args.ordersOnly = true;
      continue;
    }
    if (token.startsWith("--users-limit=")) {
      args.usersLimit = Number(token.split("=")[1] || "0") || 0;
      continue;
    }
    if (token.startsWith("--orders-limit=")) {
      args.ordersLimit = Number(token.split("=")[1] || "0") || 0;
      continue;
    }
  }

  if (args.usersOnly) args.ordersOnly = false;
  if (args.ordersOnly) args.usersOnly = false;
  return args;
}

function isMissing(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

async function processUsers(args) {
  let query = db.collection("users");
  if (args.usersLimit > 0) query = query.limit(args.usersLimit);
  const snap = await query.get();

  let touched = 0;
  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    touched += 1;
    const data = doc.data() || {};
    const patch = {};

    if (isMissing(data.locale)) patch.locale = args.defaults.userLocale;
    if (isMissing(data.region)) patch.region = args.defaults.userRegion;

    const changedKeys = Object.keys(patch);
    if (changedKeys.length === 0) {
      skipped += 1;
      continue;
    }

    if (args.apply) {
      patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await doc.ref.set(patch, { merge: true });
      console.log(`[users] UPDATED docId=${doc.id} keys=${changedKeys.join(",")}`);
    } else {
      console.log(`[users] DRY-RUN docId=${doc.id} keys=${changedKeys.join(",")} patch=${JSON.stringify(patch)}`);
    }
    updated += 1;
  }

  return { touched, updated, skipped };
}

async function processOrders(args) {
  let query = db.collection("orders");
  if (args.ordersLimit > 0) query = query.limit(args.ordersLimit);
  const snap = await query.get();

  let touched = 0;
  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    touched += 1;
    const data = doc.data() || {};
    const patch = {};

    if (isMissing(data.region)) patch.region = args.defaults.orderRegion;
    if (isMissing(data.channelType)) patch.channelType = args.defaults.orderChannelType;
    if (isMissing(data.policyId)) patch.policyId = args.defaults.orderPolicyId;
    if (isMissing(data.pricingVersion)) patch.pricingVersion = args.defaults.orderPricingVersion;

    const changedKeys = Object.keys(patch);
    if (changedKeys.length === 0) {
      skipped += 1;
      continue;
    }

    if (args.apply) {
      patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await doc.ref.set(patch, { merge: true });
      console.log(`[orders] UPDATED docId=${doc.id} keys=${changedKeys.join(",")}`);
    } else {
      console.log(`[orders] DRY-RUN docId=${doc.id} keys=${changedKeys.join(",")} patch=${JSON.stringify(patch)}`);
    }
    updated += 1;
  }

  return { touched, updated, skipped };
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "APPLY" : "DRY-RUN";
  console.log(`[backfill_users_orders_region_fields] mode=${mode}`);

  const runUsers = !args.ordersOnly;
  const runOrders = !args.usersOnly;

  const usersResult = runUsers ? await processUsers(args) : null;
  const ordersResult = runOrders ? await processOrders(args) : null;

  console.log("\n[SUMMARY]");
  if (usersResult) {
    console.log(
      `users: touched=${usersResult.touched} updated=${usersResult.updated} skipped=${usersResult.skipped}`
    );
  }
  if (ordersResult) {
    console.log(
      `orders: touched=${ordersResult.touched} updated=${ordersResult.updated} skipped=${ordersResult.skipped}`
    );
  }
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});

