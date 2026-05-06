const admin = require('firebase-admin');
const { sendPaymentSuccessEmail } = require('../emailService');
const dotenv = require('dotenv');
const path = require('path');

// [V14.17] Script to resend payment success emails for historical hardware orders.
// This uses the updated template that mentions shipping timelines.

// Load environment variables for Nodemailer credentials
dotenv.config({ path: path.join(__dirname, '../.env') });

// Initialize Firebase Admin (Assumes ADC or GOOGLE_APPLICATION_CREDENTIALS)
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function getLessons() {
    const lessonsSnap = await db.collection('metadata_lessons').get();
    return lessonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function run() {
    console.log("🚀 Starting Hardware Email Resend Script...");
    
    console.log("📦 Fetching lesson metadata to identify physical products...");
    const lessons = await getLessons();
    const physicalUnitIds = new Set(lessons.filter(l => l.isPhysical === true).map(l => l.id));
    console.log(`Found ${physicalUnitIds.size} physical products in catalog.`);

    console.log("🔍 Scanning successful orders...");
    const ordersSnapshot = await db.collection('orders').where('status', '==', 'SUCCESS').get();
    console.log(`Total successful orders found: ${ordersSnapshot.size}`);
    
    let resentCount = 0;

    for (const doc of ordersSnapshot.docs) {
        const orderData = doc.data();
        const items = orderData.items || {};
        const hasPhysical = Object.keys(items).some(id => physicalUnitIds.has(id));

        if (hasPhysical) {
            const orderId = doc.id;
            let userEmail = "";
            try {
                if (orderData.uid && orderData.uid !== 'GUEST') {
                    const userRecord = await admin.auth().getUser(orderData.uid);
                    userEmail = userRecord.email;
                } else {
                    console.log(`Skipping order ${orderId} (Guest or no UID)`);
                    continue;
                }
            } catch (e) {
                console.error(`❌ Could not find user for order ${orderId}: ${e.message}`);
                continue;
            }

            if (userEmail) {
                const itemDesc = Object.values(items).map(i => `${i.name} x${i.quantity || 1}`).join(', ');
                console.log(`📧 Resending email to ${userEmail} for order ${orderId} (${itemDesc})...`);
                
                try {
                    await sendPaymentSuccessEmail(userEmail, orderId, orderData.amount, itemDesc, true);
                    resentCount++;
                } catch (sendErr) {
                    console.error(`❌ Failed to send email to ${userEmail}:`, sendErr.message);
                }
            }
        }
    }

    console.log(`\n✅ Finished. Successfully resent ${resentCount} hardware notification emails.`);
}

run().catch(err => {
    console.error("💥 Critical Script Error:", err);
    process.exit(1);
}).finally(() => {
    // Give some time for logs to flush
    setTimeout(() => process.exit(0), 1000);
});
