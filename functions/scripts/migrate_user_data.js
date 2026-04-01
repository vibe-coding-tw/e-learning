const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json'); // Assumes service account exists for local run

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrate() {
    console.log("🚀 Starting User-Centric Migration...");

    // 1. Migrate tutor_applications -> users/{uid}/tutorApplications
    console.log("📦 Migrating tutor_applications...");
    const appsSnapshot = await db.collection('tutor_applications').get();
    const userAppsMap = {};

    appsSnapshot.forEach(doc => {
        const data = doc.data();
        const uid = data.userId;
        if (!uid) return;

        if (!userAppsMap[uid]) userAppsMap[uid] = [];
        userAppsMap[uid].push({
            applicationId: doc.id,
            ...data,
            appliedAt: data.appliedAt?.toDate ? data.appliedAt.toDate().toISOString() : data.appliedAt,
            resolvedAt: data.resolvedAt?.toDate ? data.resolvedAt.toDate().toISOString() : data.resolvedAt,
        });
    });

    for (const [uid, apps] of Object.entries(userAppsMap)) {
        console.log(`   Updating applications for user ${uid}...`);
        const hasPending = apps.some(a => a.status === 'pending');
        await db.collection('users').doc(uid).set({
            tutorApplications: apps,
            hasPendingApplication: hasPending,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    // 2. Migrate course_configs -> users/{uid}/tutorConfigs
    console.log("📦 Migrating course_configs (Authorization & URLs)...");
    const configsSnapshot = await db.collection('course_configs').get();
    
    // First, we need a map of Email -> UID for lookup
    console.log("🔍 Building Email -> UID index...");
    const usersSnap = await db.collection('users').get();
    const emailToUid = {};
    usersSnap.forEach(doc => {
        const d = doc.data();
        if (d.email) emailToUid[d.email.toLowerCase()] = doc.id;
    });

    const userConfigsToUpdate = {}; // { uid: { tutorConfigs: { unitId: { ... } } } }

    configsSnapshot.forEach(doc => {
        const data = doc.data();
        const docId = doc.id;

        // A. Unit-level Authorization (authorizedTutors / tutorDetails)
        if (data.authorizedTutors) {
            data.authorizedTutors.forEach(email => {
                const uid = emailToUid[email.toLowerCase()];
                if (!uid) return;

                if (!userConfigsToUpdate[uid]) userConfigsToUpdate[uid] = { tutorConfigs: {} };
                const tutorDetail = (data.tutorDetails && data.tutorDetails[email]) || {};
                
                userConfigsToUpdate[uid].tutorConfigs[docId] = {
                    authorized: true,
                    email: email,
                    name: tutorDetail.name || email.split('@')[0],
                    qualifiedAt: tutorDetail.qualifiedAt || new Date().toISOString(),
                    ...userConfigsToUpdate[uid].tutorConfigs[docId]
                };
            });
        }

        // B. Master-level URLs (githubClassroomUrls)
        if (data.githubClassroomUrls) {
            for (const [unitId, tutorsMap] of Object.entries(data.githubClassroomUrls)) {
                for (const [email, url] of Object.entries(tutorsMap)) {
                    const uid = emailToUid[email.toLowerCase()];
                    if (!uid) continue;

                    if (!userConfigsToUpdate[uid]) userConfigsToUpdate[uid] = { tutorConfigs: {} };
                    userConfigsToUpdate[uid].tutorConfigs[unitId] = {
                        ...(userConfigsToUpdate[uid].tutorConfigs[unitId] || {}),
                        githubClassroomUrl: url,
                        authorized: true // If they have a URL, they are probably authorized
                    };
                }
            }
        }
    });

    for (const [uid, update] of Object.entries(userConfigsToUpdate)) {
        console.log(`   Updating tutorConfigs for user ${uid}...`);
        await db.collection('users').doc(uid).set(update, { merge: true });
    }

    console.log("✅ Migration Completed successfully!");
}

migrate().catch(err => {
    console.error("❌ Migration failed:", err);
});
