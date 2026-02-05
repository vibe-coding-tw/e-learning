
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
// Make sure GOOGLE_APPLICATION_CREDENTIALS is set or you are logged in via gcloud
if (process.env.NODE_ENV !== 'production' || !process.env.ECPAY_MERCHANT_ID) {
    require('dotenv').config();
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (Object.keys(serviceAccount).length > 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
    admin.initializeApp();
}

async function simulate() {
    console.log("Starting simulation...");

    try {
        // 1. Simulate a payment that happened 1 year minus 7 days ago
        // To trigger the alert: expiryDate = now + 7 days
        // So PaymentDate = now + 7 days - 1 year
        const now = new Date();
        const futureExpiry = new Date(now);
        futureExpiry.setDate(now.getDate() + 7);
        futureExpiry.setMinutes(futureExpiry.getMinutes() + 5); // Add buffer

        console.log(`Setting up test order with expiry: ${futureExpiry.toISOString()}`);

        const testOrderId = `TEST_EXPIRY_${Date.now()}`;

        await admin.firestore().collection("orders").doc(testOrderId).set({
            uid: "TEST_USER_UID", // Replace with valid UID if needed for email
            status: "SUCCESS",
            amount: 100,
            items: {
                "test-course": { name: "Test Course for Expiry" }
            },
            expiryDate: admin.firestore.Timestamp.fromDate(futureExpiry),
            expiryWarningSent: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Created order ${testOrderId}. Now verifying logic...`);

        // 2. Run the query logic manually (since we can't easily invoke the scheduled function locally without shell)
        const today = admin.firestore.Timestamp.now().toDate();
        const startWindow = new Date(today);
        startWindow.setDate(today.getDate() + 7);
        const endWindow = new Date(startWindow);
        endWindow.setDate(startWindow.getDate() + 1);

        // Adjust start window slightly to ensure our just-created order falls in it
        // Because "now" moves, let's widen the search for the test

        const expiringOrders = await admin.firestore().collection("orders")
            .where("expiryDate", ">=", admin.firestore.Timestamp.fromDate(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000))) // > 6 days
            .where("expiryDate", "<", admin.firestore.Timestamp.fromDate(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000))) // < 8 days
            .where("status", "==", "SUCCESS")
            .get();

        console.log(`Found ${expiringOrders.size} expiring orders.`);
        expiringOrders.forEach(doc => {
            console.log(`- Order: ${doc.id}, Expiry: ${doc.data().expiryDate.toDate().toISOString()}`);
        });

        console.log("Simulation complete. Don't forget to delete the test order.");
        // Cleanup?
        // await admin.firestore().collection("orders").doc(testOrderId).delete();

    } catch (e) {
        console.error(e);
    }
}

simulate();
