const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Admin SDK
// Note: In production, use service account. Locally, use applicationDefault or projectId.
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'e-learning-942f7'
    });
}

const db = admin.firestore();

async function migrate() {
    console.log("🚀 Starting Teacher Authorization Migration...");

    const lessonsPath = path.join(__dirname, 'reconstructed_lessons.json');
    if (!fs.existsSync(lessonsPath)) {
        console.error("❌ Could not find reconstructed_lessons.json");
        return;
    }

    const lessons = JSON.parse(fs.readFileSync(lessonsPath, 'utf8'));
    let totalMigrated = 0;

    for (const master of lessons) {
        const masterId = master.courseId;
        console.log(`\nChecking Master Course: ${masterId} (${master.title})`);

        const masterDoc = await db.collection('course_configs').doc(masterId).get();
        if (!masterDoc.exists) {
            console.log(`  - No config found for master ${masterId}`);
            continue;
        }

        const data = masterDoc.data();
        const githubUrls = data.githubClassroomUrls || {};
        
        for (const unitFile in githubUrls) {
            const teachersMap = githubUrls[unitFile];
            if (typeof teachersMap !== 'object' || teachersMap === null) continue;

            const emails = Object.keys(teachersMap).filter(e => e.includes('@'));
            if (emails.length === 0) continue;

            console.log(`  📦 Unit: ${unitFile} - Found ${emails.length} potential teachers`);

            const unitRef = db.collection('course_configs').doc(unitFile);
            
            for (const email of emails) {
                const sanitizedEmail = email.replace(/\./g, '_DOT_');
                console.log(`    Processing ${email}...`);

                // 1. Update Unit-level Document
                await unitRef.set({
                    authorizedTeachers: admin.firestore.FieldValue.arrayUnion(email),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                // 2. Fetch User metadata if possible
                let teacherName = email.split('@')[0];
                try {
                    const userRecord = await admin.auth().getUserByEmail(email);
                    const userDoc = await db.collection('users').doc(userRecord.uid).get();
                    if (userDoc.exists && userDoc.data().name) {
                        teacherName = userDoc.data().name;
                    } else if (userRecord.displayName) {
                        teacherName = userRecord.displayName;
                    }

                    // Promote to teacher role if needed
                    const currentRole = userDoc.exists ? userDoc.data().role : 'student';
                    if (currentRole !== 'admin' && currentRole !== 'teacher') {
                        await db.collection('users').doc(userRecord.uid).set({
                            role: 'teacher',
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        console.log(`      ✅ Promoted to teacher role in 'users/${userRecord.uid}'`);
                    }
                } catch (err) {
                    // console.log(`      ℹ️ Metadata fetch skipped: ${err.message}`);
                }

                // 3. Add to teacherDetails
                await unitRef.set({
                    teacherDetails: {
                        [sanitizedEmail]: {
                            email: email,
                            name: teacherName,
                            qualifiedAt: new Date().toISOString()
                        }
                    }
                }, { merge: true });

                totalMigrated++;
            }
        }
    }

    console.log(`\n✅ Migration Complete. Total authorizations updated: ${totalMigrated}`);
}

migrate().catch(err => {
    console.error("💥 Migration Failed:", err);
    process.exit(1);
});
