#!/usr/bin/env node
/**
 * Backfill metadata_lessons assignment URL aliases from legacy githubClassroomUrls.
 *
 * Usage:
 *   node functions/scripts/backfill_metadata_lessons_assignment_urls.js --dry-run
 *   node functions/scripts/backfill_metadata_lessons_assignment_urls.js --apply
 *   node functions/scripts/backfill_metadata_lessons_assignment_urls.js --apply --doc-id=metadataDocId
 *   node functions/scripts/backfill_metadata_lessons_assignment_urls.js --apply --course-id=tw-car-starter-web-app
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
    docId: "",
    courseId: "",
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
    if (token.startsWith("--doc-id=")) {
      args.docId = token.split("=")[1] || "";
      continue;
    }
    if (token.startsWith("--course-id=")) {
      args.courseId = token.split("=")[1] || "";
      continue;
    }
    if (token.startsWith("--limit=")) {
      args.limit = Number(token.split("=")[1] || "0") || 0;
      continue;
    }
  }

  return args;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function countKeys(value) {
  return isPlainObject(value) ? Object.keys(value).length : 0;
}

function buildAliasPayload(data = {}) {
  const legacyMap = isPlainObject(data.githubClassroomUrls) ? data.githubClassroomUrls : null;
  const currentMap = isPlainObject(data.assignmentUrlMap) ? data.assignmentUrlMap : null;
  const currentUrls = isPlainObject(data.assignmentUrls) ? data.assignmentUrls : null;

  const nextMap = currentMap || legacyMap || null;
  const nextUrls = currentUrls || currentMap || legacyMap || null;

  const patch = {};
  const changes = [];

  if (!currentMap && nextMap) {
    patch.assignmentUrlMap = nextMap;
    changes.push("assignmentUrlMap");
  }

  if (!currentUrls && nextUrls) {
    patch.assignmentUrls = nextUrls;
    changes.push("assignmentUrls");
  }

  return { patch, changes, hasLegacyMap: !!legacyMap, nextMap, nextUrls };
}

async function loadDocs(args) {
  if (args.docId) {
    const doc = await db.collection("metadata_lessons").doc(args.docId).get();
    return doc.exists ? [doc] : [];
  }

  const snap = await db.collection("metadata_lessons").get();
  let docs = snap.docs;
  if (args.courseId) {
    const courseId = String(args.courseId).trim();
    docs = docs.filter((doc) => String((doc.data() || {}).courseId || "").trim() === courseId);
  }
  if (args.limit > 0) {
    docs = docs.slice(0, args.limit);
  }
  return docs;
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "apply" : "dry-run";
  const docs = await loadDocs(args);

  const report = {
    inspectedDocs: docs.length,
    updatedDocs: 0,
    untouchedDocs: 0,
    legacyDocs: 0,
    totalLegacyMaps: 0,
    totalMapEntries: 0,
  };

  console.log(`[backfill_metadata_lessons_assignment_urls] mode=${mode} docs=${docs.length}`);

  for (const doc of docs) {
    const data = doc.data() || {};
    const { patch, changes, hasLegacyMap, nextMap, nextUrls } = buildAliasPayload(data);
    const legacyCount = countKeys(data.githubClassroomUrls);
    const currentMapCount = countKeys(data.assignmentUrlMap);
    const currentUrlsCount = countKeys(data.assignmentUrls);

    if (hasLegacyMap) {
      report.legacyDocs += 1;
      report.totalLegacyMaps += legacyCount;
    }
    report.totalMapEntries += Math.max(currentMapCount, currentUrlsCount, legacyCount);

    if (changes.length === 0) {
      report.untouchedDocs += 1;
      continue;
    }

    report.updatedDocs += 1;
    const summary = [
      changes.join(","),
      `legacyKeys=${legacyCount}`,
      `assignmentUrlMapKeys=${countKeys(nextMap)}`,
      `assignmentUrlsKeys=${countKeys(nextUrls)}`
    ].join(" ");

    if (args.apply) {
      await doc.ref.set({
        ...patch,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        assignmentUrlBackfillAt: admin.firestore.FieldValue.serverTimestamp(),
        assignmentUrlBackfillSource: "functions/scripts/backfill_metadata_lessons_assignment_urls.js",
      }, { merge: true });
      console.log(`[metadata_lessons] UPDATED docId=${doc.id} ${summary}`);
    } else {
      console.log(`[metadata_lessons] DRY-RUN docId=${doc.id} ${summary}`);
    }
  }

  console.log(
    `[summary] inspectedDocs=${report.inspectedDocs} updatedDocs=${report.updatedDocs} ` +
    `untouchedDocs=${report.untouchedDocs} legacyDocs=${report.legacyDocs} totalLegacyMaps=${report.totalLegacyMaps} ` +
    `totalMapEntries=${report.totalMapEntries}`
  );
}

main().catch((err) => {
  console.error("[backfill_metadata_lessons_assignment_urls] failed:", err);
  process.exit(1);
});
