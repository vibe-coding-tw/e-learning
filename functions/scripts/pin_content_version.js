const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function main() {
  const version = "bb7bc06b7ce74ceb194e7b0f80d4663796fb9f11";
  console.log("Updating contentVersion to:", version);
  await db.collection("metadata_settings").doc("content_runtime").set({
    contentVersion: version,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: "antigravity-agent"
  }, { merge: true });
  console.log("Successfully updated contentVersion in Firestore!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
