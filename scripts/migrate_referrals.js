const admin = require('firebase-admin');

// IMPORTANT: Requires service account or local firebase logic
// Since I'm running on the USER system, I'll assume they have firebase-admin installed 
// in the functions directory or I'll use the one in functions/node_modules

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'e-learning-942f7'
    });
}

const db = admin.firestore();

function normalizeGitHubUrl(url = '') {
    if (!url) return '';
    try {
        let clean = url.trim().toLowerCase();
        clean = clean.replace(/\/+$/, '');
        return clean;
    } catch (e) {
        return url.trim().toLowerCase();
    }
}

async function migrate() {
    console.log("Starting Migration: Building referral_links index...");
    const usersSnap = await db.collection('users').get();
    const batch = db.batch();
    let count = 0;

    for (const doc of usersSnap.docs) {
        const uData = doc.data();
        const tConfigs = uData.tutorConfigs || {};
        const email = uData.email;
        const name = uData.name || email;

        for (const [unitId, config] of Object.entries(tConfigs)) {
            // Handle nested config logic as per verifyPromoCode line 3126
            const effectiveConfig = (config && !config.authorized && config.html) ? config.html : config;
            if (!effectiveConfig || !effectiveConfig.authorized) continue;

            const rawUrl = effectiveConfig.githubClassroomUrl || effectiveConfig.assignmentUrl || "";
            const normalizedUrl = normalizeGitHubUrl(rawUrl);

            if (normalizedUrl) {
                // Key: Base64 encoded URL or just escaping slashes
                // Firestore doc IDs can contain slashes but it's better to avoid them
                // verifyPromoCode used normalizeGitHubUrl as a string match
                // We'll use encoded URL as the key to handle any special chars
                const linkId = Buffer.from(normalizedUrl).toString('base64');
                
                const linkRef = db.collection('referral_links').doc(linkId);
                batch.set(linkRef, {
                    url: normalizedUrl,
                    tutorEmail: email,
                    tutorName: name,
                    unitId: unitId,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                count++;
                
                if (count % 400 === 0) {
                    await batch.commit();
                    console.log(`Committed ${count} links...`);
                }
            }
        }
    }

    await batch.commit();
    console.log(`Migration Complete: Indexed ${count} links.`);
}

migrate().catch(console.error);
