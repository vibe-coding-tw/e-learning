const readline = require("node:readline/promises");

function normalizeText(value = "") {
  return String(value || "").trim();
}

function resolveFirestoreProjectId(admin) {
  const appProjectId = (() => {
    try {
      return admin?.app?.()?.options?.projectId || "";
    } catch (_) {
      return "";
    }
  })();

  return normalizeText(
    process.env.FIREBASE_EMULATOR_PROJECT ||
    process.env.FIRESTORE_TARGET_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    appProjectId
  );
}

function isFirestoreEmulatorActive() {
  return normalizeText(process.env.FIRESTORE_EMULATOR_HOST) !== "";
}

function getProductionFirestoreProjectId() {
  return normalizeText(process.env.FIRESTORE_PRODUCTION_PROJECT_ID || "e-learning-942f7");
}

async function promptForProductionWriteConfirmation({ scriptName, projectId, productionProjectId }) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `[${scriptName}] Refusing to write to Firestore project "${projectId || productionProjectId}". ` +
      `Set FIRESTORE_EMULATOR_HOST for local/emulator writes, or confirm explicitly with ` +
      `ALLOW_PRODUCTION_FIRESTORE_WRITE=YES and CONFIRM_PRODUCTION_FIRESTORE_WRITE=${productionProjectId}.`
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      `[${scriptName}] Type ${productionProjectId} to confirm production Firestore write: `
    );
    if (normalizeText(answer) !== productionProjectId) {
      throw new Error("production Firestore write not confirmed");
    }
    return true;
  } finally {
    rl.close();
  }
}

async function ensureFirestoreWriteAllowed({
  scriptName,
  apply,
  admin,
  projectId,
  productionProjectId = getProductionFirestoreProjectId(),
}) {
  if (!apply) return { allowed: true, reason: "dry-run" };
  if (isFirestoreEmulatorActive()) return { allowed: true, reason: "emulator" };

  const targetProjectId = normalizeText(projectId || resolveFirestoreProjectId(admin));
  const protectedProjectId = normalizeText(productionProjectId);
  const shouldProtect =
    !protectedProjectId ||
    !targetProjectId ||
    targetProjectId === protectedProjectId;

  if (!shouldProtect) {
    return { allowed: true, reason: "non-production", projectId: targetProjectId };
  }

  const explicitConfirmation =
    normalizeText(process.env.ALLOW_PRODUCTION_FIRESTORE_WRITE).toUpperCase() === "YES" &&
    normalizeText(process.env.CONFIRM_PRODUCTION_FIRESTORE_WRITE) === protectedProjectId;

  if (explicitConfirmation) {
    return { allowed: true, reason: "confirmed-env", projectId: targetProjectId || protectedProjectId };
  }

  await promptForProductionWriteConfirmation({
    scriptName,
    projectId: targetProjectId || protectedProjectId,
    productionProjectId: protectedProjectId,
  });

  return { allowed: true, reason: "confirmed-interactive", projectId: targetProjectId || protectedProjectId };
}

module.exports = {
  ensureFirestoreWriteAllowed,
  getProductionFirestoreProjectId,
  isFirestoreEmulatorActive,
  resolveFirestoreProjectId,
};
