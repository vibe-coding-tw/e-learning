#!/usr/bin/env node
/**
 * Update spec cards and delete their price books in production Firestore.
 *
 * Usage:
 *   node functions/scripts/update_specs_in_prod.js --dry-run
 *   node functions/scripts/update_specs_in_prod.js --apply
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const SPEC_UPDATES = [
  {
    id: 'spec-recommend-lite',
    patch: {
      orderWeight: 507,
      metadataType: 'spec',
      updatedBy: 'system-spec-order-update',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  },
  {
    id: 'spec-recommend-pro',
    patch: {
      orderWeight: 508,
      metadataType: 'spec',
      updatedBy: 'system-spec-order-update',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  }
];

const PRICE_BOOKS_TO_DELETE = [
  'default-twd_spec-recommend-lite',
  'default-twd_spec-recommend-pro',
  'default-usd_spec-recommend-lite',
  'default-usd_spec-recommend-pro'
];

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`🔧 Update Specs and delete price books - Mode: ${isApply ? 'APPLY' : 'DRY RUN'}`);

  // 1. Update specs orderWeight and metadataType
  for (const item of SPEC_UPDATES) {
    const docRef = db.collection('metadata_lessons').doc(item.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.log(`⚠️ Spec card ${item.id} not found in metadata_lessons.`);
      continue;
    }

    console.log(`\n📋 Spec: ${item.id}`);
    console.log(`   current orderWeight: ${docSnap.data().orderWeight}`);
    console.log(`   current metadataType: ${docSnap.data().metadataType}`);
    console.log(`   will set patch:`, JSON.stringify(item.patch, null, 2));

    if (isApply) {
      await docRef.set(item.patch, { merge: true });
      console.log(`   ✅ Updated spec: ${item.id}`);
    }
  }

  // 2. Delete price books
  for (const docId of PRICE_BOOKS_TO_DELETE) {
    const docRef = db.collection('dealer_price_books').doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.log(`⚠️ Price book ${docId} does not exist.`);
      continue;
    }

    console.log(`\n📋 Price Book: ${docId} found, will delete.`);
    if (isApply) {
      await docRef.delete();
      console.log(`   ✅ Deleted price book: ${docId}`);
    }
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
