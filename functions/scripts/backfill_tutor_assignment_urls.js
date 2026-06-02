#!/usr/bin/env node
/**
 * Backfill users.tutorConfigs[unitId].assignmentUrl from legacy githubClassroomUrl.
 *
 * Usage:
 *   node functions/scripts/backfill_tutor_assignment_urls.js --dry-run
 *   node functions/scripts/backfill_tutor_assignment_urls.js --apply
 *   node functions/scripts/backfill_tutor_assignment_urls.js --apply --user-email=someone@example.com
 *   node functions/scripts/backfill_tutor_assignment_urls.js --apply --user-id=firestoreUid --unit-id=start-01-unit-html5-basics.html
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
    userEmail: "",
    userId: "",
    unitId: "",
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
    if (token.startsWith("--user-email=")) {
      args.userEmail = token.split("=")[1] || "";
      continue;
    }
    if (token.startsWith("--user-id=")) {
      args.userId = token.split("=")[1] || "";
      continue;
    }
    if (token.startsWith("--unit-id=")) {
      args.unitId = token.split("=")[1] || "";
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

function hasText(value) {
  return String(value || "").trim() !== "";
}

function normalizeTutorConfigEntry(entry) {
  if (!isPlainObject(entry)) {
    return { value: entry, changed: false };
  }

  let changed = false;
  const next = { ...entry };
  const legacyUrl = String(next.githubClassroomUrl || "").trim();
  const assignmentUrl = String(next.assignmentUrl || "").trim();

  if (!assignmentUrl && legacyUrl) {
    next.assignmentUrl = legacyUrl;
    changed = true;
  }

  if (isPlainObject(next.html)) {
    const nested = normalizeTutorConfigEntry(next.html);
    if (nested.changed) {
      next.html = nested.value;
      changed = true;
    }
  }

  return { value: next, changed };
}

async function loadUserDocs(args) {
  if (args.userId) {
    const doc = await db.collection("users").doc(args.userId).get();
    return doc.exists ? [doc] : [];
  }

  if (args.userEmail) {
    const snap = await db
      .collection("users")
      .where("email", "==", String(args.userEmail).trim().toLowerCase())
      .limit(1)
      .get();
    return snap.docs;
  }

  let query = db.collection("users").orderBy(admin.firestore.FieldPath.documentId());
  if (args.limit > 0) query = query.limit(args.limit);
  const snap = await query.get();
  return snap.docs;
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "apply" : "dry-run";
  const docs = await loadUserDocs(args);

  const report = {
    mode,
    inspectedUsers: docs.length,
    updatedUsers: 0,
    updatedUnits: 0,
    skippedUsers: 0,
    missingLegacyUrl: 0,
    unchangedUsers: 0,
  };

  console.log(`[backfill_tutor_assignment_urls] mode=${mode} users=${docs.length}`);

  for (const doc of docs) {
    const data = doc.data() || {};
    const tutorConfigs = isPlainObject(data.tutorConfigs) ? data.tutorConfigs : {};
    const nextTutorConfigs = { ...tutorConfigs };
    const changedUnits = [];

    for (const [unitId, config] of Object.entries(tutorConfigs)) {
      if (hasText(args.unitId)) {
        const requestedUnitId = String(args.unitId).trim();
        const normalizedUnitId = String(unitId || "").trim();
        if (normalizedUnitId !== requestedUnitId && normalizedUnitId.replace(/\.html$/i, "") !== requestedUnitId.replace(/\.html$/i, "")) {
          continue;
        }
      }

      const { value, changed } = normalizeTutorConfigEntry(config);
      if (!changed) {
        const legacyUrl = isPlainObject(config) ? String(config.githubClassroomUrl || "").trim() : "";
        if (hasText(legacyUrl)) report.unchangedUsers += 0;
        continue;
      }

      nextTutorConfigs[unitId] = value;
      changedUnits.push(unitId);
      report.updatedUnits += 1;
    }

    if (changedUnits.length === 0) {
      report.skippedUsers += 1;
      continue;
    }

    report.updatedUsers += 1;
    const patch = {
      tutorConfigs: nextTutorConfigs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      tutorConfigsAssignmentUrlBackfillAt: admin.firestore.FieldValue.serverTimestamp(),
      tutorConfigsAssignmentUrlBackfillSource: "functions/scripts/backfill_tutor_assignment_urls.js",
    };

    if (args.apply) {
      await doc.ref.set(patch, { merge: true });
      console.log(`[users] UPDATED docId=${doc.id} units=${changedUnits.join(",")}`);
    } else {
      console.log(`[users] DRY-RUN docId=${doc.id} units=${changedUnits.join(",")}`);
    }
  }

  console.log(`[summary] inspectedUsers=${report.inspectedUsers} updatedUsers=${report.updatedUsers} updatedUnits=${report.updatedUnits} skippedUsers=${report.skippedUsers}`);
}

main().catch((err) => {
  console.error("[backfill_tutor_assignment_urls] failed:", err);
  process.exit(1);
});
