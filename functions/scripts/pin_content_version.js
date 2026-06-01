const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function main() {
  const version = "b2b45c9c135fa14a82f03214afd2d741967f05da";
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
