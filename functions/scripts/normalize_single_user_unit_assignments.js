#!/usr/bin/env node
/**
 * Remove legacy dotted unitAssignmentMeta fields for one user.
 *
 * Usage:
 *   node functions/scripts/normalize_single_user_unit_assignments.js --uid=USER_UID --dry-run
 *   node functions/scripts/normalize_single_user_unit_assignments.js --uid=USER_UID --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "e-learning-942f7"
  });
}

const db = admin.firestore();

function parseArgs(argv) {
  const out = {
    uid: "",
    apply: false
  };
  for (const token of argv.slice(2)) {
    if (token === "--apply") out.apply = true;
    if (token === "--dry-run") out.apply = false;
    if (token.startsWith("--uid=")) out.uid = token.slice("--uid=".length).trim();
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.uid) {
    throw new Error("Missing --uid=USER_UID");
  }

  const ref = db.collection("users").doc(args.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`User doc not found: ${args.uid}`);
  }

  const data = snap.data() || {};
  const legacyRootFields = Object.keys(data).filter((key) => key.startsWith("unitAssignmentMeta."));

  if (legacyRootFields.length === 0) {
    console.log(JSON.stringify({ uid: args.uid, changed: false }, null, 2));
    return;
  }

  if (!args.apply) {
    console.log(JSON.stringify({
      uid: args.uid,
      changed: true,
      apply: false,
      legacyRootFields
    }, null, 2));
    return;
  }

  const updateArgs = [];
  for (const field of legacyRootFields) {
    updateArgs.push(new admin.firestore.FieldPath(field), admin.firestore.FieldValue.delete());
  }
  updateArgs.push("updatedAt", admin.firestore.FieldValue.serverTimestamp());

  await ref.update(...updateArgs);

  console.log(JSON.stringify({
    uid: args.uid,
    changed: true,
    applied: true,
    deleted: legacyRootFields
  }, null, 2));
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});
