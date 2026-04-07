const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: "e-learning-942f7"
    });
}

const db = admin.firestore();

async function migrateUrls() {
    console.log("🚀 Starting migration: submissionUrl -> assignmentUrl...");
    
    try {
        const assignmentsRef = db.collection('assignments');
        const snapshot = await assignmentsRef.get();
        
        if (snapshot.empty) {
            console.log("No assignments found.");
            process.exit(0);
        }

        console.log(`Found ${snapshot.size} assignments. Processing...`);
        
        const batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.submissionUrl !== undefined) {
                const update = {
                    assignmentUrl: data.submissionUrl,
                    submissionUrl: admin.firestore.FieldValue.delete()
                };
                batch.update(doc.ref, update);
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`✅ Successfully migrated ${count} assignments.`);
        } else {
            console.log("No assignments required migration.");
        }
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

migrateUrls();
