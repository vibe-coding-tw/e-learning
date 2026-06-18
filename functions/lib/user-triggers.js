const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions/v1");
const { sendWelcomeEmail } = require("vibe-functions-core/email-service");

function createOnUserCreatedHandler() {
    if (!admin.apps.length) {
        admin.initializeApp();
    }

    return async (user) => {
        const email = user.email;
        const displayName = user.displayName;
        const uid = user.uid;
        const db = admin.firestore();

        try {
            const userRef = db.collection("users").doc(uid);
            const doc = await userRef.get();
            if (!doc.exists) {
                await userRef.set({
                    email: email || "",
                    name: displayName || "",
                    role: "user",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log(`[onUserCreated] Initialized Firestore record for user ${uid} (${email})`);
            }
        } catch (e) {
            console.error(`[onUserCreated] Failed to initialize Firestore record for ${uid}:`, e);
        }

        if (email) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            const expiryDateStr = expiryDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric"
            });

            await sendWelcomeEmail(email, displayName, expiryDateStr);
        }
    };
}

module.exports = {
    createOnUserCreatedHandler,
    createOnUserCreatedTrigger: () => functionsV1.region("asia-east1").auth.user().onCreate(createOnUserCreatedHandler())
};
