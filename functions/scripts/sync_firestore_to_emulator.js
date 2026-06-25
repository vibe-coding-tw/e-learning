#!/usr/bin/env node
/**
 * Sync selected Firestore collections from a source project into the local emulator.
 *
 * Usage:
 *   node functions/scripts/sync_firestore_to_emulator.js --dry-run --source-project=e-learning-942f7 --collections=metadata_lessons,users,orders
 *   node functions/scripts/sync_firestore_to_emulator.js --apply --source-project=e-learning-942f7 --collections=metadata_lessons,users,orders --replace
 *
 * Notes:
 * - The source Firestore is read from the live project using application-default credentials.
 * - The target Firestore is the emulator, controlled by FIRESTORE_EMULATOR_HOST.
 * - By default the script only syncs the explicitly listed collections.
 */

const { Firestore } = require("@google-cloud/firestore");

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    replace: false,
    recursive: true,
    sourceProject: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
    targetProject: process.env.FIREBASE_EMULATOR_PROJECT || process.env.FIRESTORE_TARGET_PROJECT || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080",
    collections: [
      "metadata_lessons",
      "metadata_settings",
      "users",
      "orders",
      "distributors",
      "dealer_price_books",
      "revenue_share_policies",
      "tutor_applications",
      "activity_logs",
      "profit_ledger"
    ]
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else if (token === "--dry-run") {
      args.apply = false;
      args.dryRun = true;
    } else if (token === "--replace") {
      args.replace = true;
    } else if (token === "--no-recursive") {
      args.recursive = false;
    } else if (token.startsWith("--source-project=")) {
      args.sourceProject = token.split("=")[1] || args.sourceProject;
    } else if (token.startsWith("--target-project=")) {
      args.targetProject = token.split("=")[1] || args.targetProject;
    } else if (token.startsWith("--emulator-host=")) {
      args.emulatorHost = token.split("=")[1] || args.emulatorHost;
    } else if (token.startsWith("--collections=")) {
      const raw = token.split("=")[1] || "";
      const list = raw.split(",").map((item) => item.trim()).filter(Boolean);
      if (list.length > 0) {
        args.collections = list;
      }
    }
  }

  return args;
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function isDocumentReference(value) {
  return !!value && typeof value === "object" && value.constructor && value.constructor.name === "DocumentReference" && typeof value.path === "string";
}

function transformValue(value, targetDb) {
  if (Array.isArray(value)) {
    return value.map((item) => transformValue(item, targetDb));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (isDocumentReference(value)) {
    return targetDb.doc(value.path);
  }
  if (value.constructor && value.constructor.name === "Timestamp") {
    return value;
  }
  if (value.constructor && value.constructor.name === "GeoPoint") {
    return value;
  }
  if (value.constructor && value.constructor.name === "Buffer") {
    return value;
  }
  const out = {};
  for (const [key, nested] of Object.entries(value)) {
    out[key] = transformValue(nested, targetDb);
  }
  return out;
}

async function listTopLevelCollections(db, requested) {
  if (requested.length !== 1 || requested[0].toLowerCase() !== "all") {
    return requested.map((name) => normalizeText(name)).filter(Boolean);
  }
  const refs = await db.listCollections();
  return refs.map((ref) => ref.id).sort();
}

async function deleteDocumentRecursive(docRef, targetDb, stats) {
  const subCollections = await docRef.listCollections();
  for (const subCol of subCollections) {
    const docs = await subCol.get();
    for (const subDoc of docs.docs) {
      await deleteDocumentRecursive(subDoc.ref, targetDb, stats);
    }
  }
  await docRef.delete();
  stats.deleted += 1;
}

async function clearCollection(targetDb, collectionName, stats) {
  const snap = await targetDb.collection(collectionName).get();
  for (const doc of snap.docs) {
    await deleteDocumentRecursive(doc.ref, targetDb, stats);
  }
}

async function syncDocument(sourceDoc, targetDoc, targetDb, options, stats) {
  const data = sourceDoc.data() || {};
  const transformed = transformValue(data, targetDb);
  if (options.apply) {
    await targetDoc.set(transformed, { merge: true });
    stats.written += 1;
  }

  if (!options.recursive) return;

  const subCollections = await sourceDoc.ref.listCollections();
  for (const subCol of subCollections) {
    const subSnap = await subCol.get();
    for (const subDoc of subSnap.docs) {
      const targetSubDoc = targetDoc.collection(subCol.id).doc(subDoc.id);
      await syncDocument(subDoc, targetSubDoc, targetDb, options, stats);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const emulatorHost = String(args.emulatorHost || "").trim();
  const [emulatorServicePath, emulatorPortRaw] = emulatorHost.split(":");
  const emulatorPort = Number(emulatorPortRaw || 8080);

  const previousEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  const sourceDb = new Firestore({ projectId: args.sourceProject });
  if (previousEmulatorHost) {
    process.env.FIRESTORE_EMULATOR_HOST = previousEmulatorHost;
  }

  const requestedCollections = await listTopLevelCollections(sourceDb, args.collections);
  const targetDb = new Firestore({
    projectId: args.targetProject,
    servicePath: emulatorServicePath || "127.0.0.1",
    port: emulatorPort,
    ssl: false
  });

  console.log(`[sync-firestore] mode=${args.apply ? "APPLY" : "DRY_RUN"} source=${args.sourceProject} target=${args.targetProject} emulator=${args.emulatorHost}`);
  console.log(`[sync-firestore] collections=${requestedCollections.join(", ")}`);
  if (args.replace) {
    console.log("[sync-firestore] replace=true (target collections will be cleared first)");
  }

  const stats = {
    collections: 0,
    documents: 0,
    written: 0,
    deleted: 0
  };

  for (const collectionName of requestedCollections) {
    const srcCol = sourceDb.collection(collectionName);
    const srcSnap = await srcCol.get();
    stats.collections += 1;
    stats.documents += srcSnap.size;

    console.log(`\n[collection] ${collectionName} docs=${srcSnap.size}`);

    if (args.apply && args.replace) {
      await clearCollection(targetDb, collectionName, stats);
      console.log(`  cleared existing docs`);
    }

    for (const doc of srcSnap.docs) {
      const targetDoc = targetDb.collection(collectionName).doc(doc.id);
      console.log(`  ${args.apply ? "sync" : "dry-run"} ${doc.id}`);
      await syncDocument(doc, targetDoc, targetDb, args, stats);
    }
  }

  console.log(`\n[sync-firestore] done collections=${stats.collections} sourceDocs=${stats.documents} written=${stats.written} deleted=${stats.deleted}`);
}

main().catch((err) => {
  console.error("[sync-firestore] failed:", err);
  process.exit(1);
});
