const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
async function main() {
  const doc = await db.collection("metadata_settings").doc("content_runtime").get();
  console.log("Current version in Firestore:", doc.data()?.contentVersion);
  process.exit(0);
}
main().catch(console.error);
