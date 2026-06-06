const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function main() {
  const version = "84c09027304431a6edd082e21363842a2056029e";
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
