const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function fix() {
    console.log("Starting DB scan...");
    const snap = await db.collection('users').get();
    let fixed = 0;
    for (const doc of snap.docs) {
        const data = doc.data();
        if (data.tutorConfigs) {
            let needsUpdate = false;
            let newConfigs = { ...data.tutorConfigs };
            
            for (const [key, value] of Object.entries(data.tutorConfigs)) {
                // If the key does not end with .html but it has an 'html' object inside
                if (value && typeof value === 'object' && value.html && value.html.authorized) {
                    console.log(`Found broken config in user ${doc.id} for unit ${key}.html`);
                    newConfigs[`${key}.html`] = value.html;
                    delete newConfigs[key];
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                console.log(`Fixing user ${doc.id}...`);
                await doc.ref.update({ tutorConfigs: newConfigs });
                fixed++;
            }
        }
    }
    console.log(`Finished scanning. Fixed ${fixed} users.`);
}

fix().catch(console.error).finally(() => process.exit(0));
