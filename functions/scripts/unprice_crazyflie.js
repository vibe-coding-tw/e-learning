#!/usr/bin/env node
/**
 * Unprice Crazyflie 2.1+ in production Firestore dealer_price_books.
 *
 * Usage:
 *   node functions/scripts/unprice_crazyflie.js --dry-run
 *   node functions/scripts/unprice_crazyflie.js --apply
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const TARGET_IDS = [
  'default-twd_crazyflie-2-1-plus',
  'default-usd_crazyflie-2-1-plus'
];

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`🔧 Unprice Crazyflie - Mode: ${isApply ? 'APPLY' : 'DRY RUN'}`);

  for (const docId of TARGET_IDS) {
    const docRef = db.collection('dealer_price_books').doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.log(`⚠️ Document ${docId} does not exist in dealer_price_books.`);
      continue;
    }

    const data = docSnap.data();
    console.log(`\n📋 Found: ${docId}`);
    console.log(`   currency: ${data.currency}`);
    console.log(`   salePrice: ${data.salePrice}`);
    console.log(`   isActive: ${data.isActive}`);

    if (isApply) {
      await docRef.delete();
      console.log(`   ✅ Deleted document: ${docId}`);
    } else {
      console.log(`   [DRY RUN] Would delete document: ${docId}`);
    }
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
