const admin = require('firebase-admin');

// Initialize with ADC (should work if logged in via firebase login)
try {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
} catch (e) {
    // Fallback for local dev/emulator
    admin.initializeApp();
}

const db = admin.firestore();

async function migrateRoles() {
    console.log("Starting Migration: role 'student' -> 'user'");
    const usersSnap = await db.collection('users').where('role', '==', 'student').get();
    
    if (usersSnap.empty) {
        console.log("No users with 'student' role found.");
        return;
    }

    console.log(`Found ${usersSnap.size} users to update.`);
    const chunks = [];
    const docs = usersSnap.docs;
    
    // Batch updates (max 500 per batch)
    for (let i = 0; i < docs.length; i += 500) {
        chunks.push(docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach(doc => {
            batch.update(doc.ref, { role: 'user', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        await batch.commit();
        console.log(`Updated a batch of ${chunk.length} users.`);
    }

    console.log("Migration complete.");
}

migrateRoles().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
