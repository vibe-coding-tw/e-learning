/**
 * Seed distributors & metadata_settings from production Firestore to local emulator.
 *
 * Usage: node scripts/seed-distributors.js
 *
 * Prerequisites:
 *   - gcloud auth application-default login (or ADC already set up)
 *   - Local Firestore emulator running on 127.0.0.1:18080
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const http = require('http');

const PROJECT_ID = 'e-learning-942f7';
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 18080;

const COLLECTIONS = ['distributors', 'region_distributor_rules', 'metadata_settings'];

async function run() {
  // --- Production reader ---
  const prodApp = initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  }, 'seed-prod');
  const prodDb = getFirestore(prodApp);

  // --- Emulator writer ---
  function emulatorUrl(collection, docId) {
    return `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}${docId ? `/${docId}` : ''}`;
  }

  function writeToEmulator(collection, docId, data) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ fields: data });
      const req = http.request({
        hostname: EMULATOR_HOST,
        port: EMULATOR_PORT,
        method: 'PATCH',
        path: emulatorUrl(collection, docId),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: 'Bearer owner', // emulator accepts any token
        },
      }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(raw);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  for (const col of COLLECTIONS) {
    console.log(`\n--- Reading "${col}" from production ---`);
    const snap = await prodDb.collection(col).get();
    if (snap.empty) {
      console.log(`  -> Collection "${col}" is empty, skipping.`);
      continue;
    }
    console.log(`  -> ${snap.size} documents found.`);

    for (const doc of snap.docs) {
      const data = doc.data();
      // Convert Firestore Timestamps to ISO strings for emulator REST API
      const fields = {};
      for (const [key, value] of Object.entries(data)) {
        fields[key] = firestoreValueToEmulator(value);
      }
      try {
        await writeToEmulator(col, doc.id, fields);
        console.log(`  ✅ Wrote ${col}/${doc.id}`);
      } catch (err) {
        console.error(`  ❌ Failed to write ${col}/${doc.id}:`, err.message);
      }
    }
  }

  console.log('\n✅ Done. Restart your emulator with --import to persist.');
  await prodApp.delete();
}

/**
 * Convert a JS value to the Firestore REST API FieldValue format.
 */
function firestoreValueToEmulator(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value?.toDate === 'function') {
    // Firestore Timestamp
    return { timestampValue: value.toDate().toISOString() };
  }
  if (typeof value?.toMillis === 'function') {
    return { timestampValue: new Date(value.toMillis()).toISOString() };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(v => firestoreValueToEmulator(v)) } };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = firestoreValueToEmulator(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
