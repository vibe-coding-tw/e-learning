#!/usr/bin/env node
/**
 * Update the ESP32-C3 specs in production Firestore metadata_lessons.
 *
 * Usage:
 *   node functions/scripts/update_esp32_c3_spec.js --dry-run
 *   node functions/scripts/update_esp32_c3_spec.js --apply
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const NEW_ZH_CORE = [
  '搭載 ESP32-C3 RISC-V 主控板，支援 Wi-Fi/BLE 無線連線',
  '整合 DRV8833 雙通道馬達驅動晶片，具備精細的 PWM 調速控制',
  '防滑橡膠越野輪胎搭配雙後輪 DC 減速電機，動力輸出穩定',
  '支援 Vibe Coding OTA 即時控制協議 C++/Python 程式語法'
];

const NEW_EN_CORE = [
  'Equipped with ESP32-C3 RISC-V MCU, supporting Wi-Fi/BLE',
  'Integrated DRV8833 dual-channel motor driver for precise PWM speed control',
  'Anti-slip rubber off-road tires with dual rear-wheel DC geared motors',
  'Supports Vibe Coding OTA real-time control protocol, C++, and Python'
];

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`🔧 Update ESP32-C3 Specs - Mode: ${isApply ? 'APPLY' : 'DRY RUN'}`);

  const docRef = db.collection('metadata_lessons').doc('esp32-c3');
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    console.error('❌ Document esp32-c3 not found in metadata_lessons collection.');
    process.exit(1);
  }

  const currentData = docSnap.data();

  const patch = {
    coreContent: NEW_ZH_CORE,
    coreContentEn: NEW_EN_CORE,
    i18n: {
      ...currentData.i18n,
      'zh-TW': {
        ...(currentData.i18n && currentData.i18n['zh-TW']),
        coreContent: NEW_ZH_CORE
      },
      'en': {
        ...(currentData.i18n && currentData.i18n['en']),
        coreContent: NEW_EN_CORE
      }
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'system-spec-update'
  };

  console.log('\n📋 Current coreContent (zh-TW):');
  console.log(currentData.coreContent);
  console.log('\n📋 Current coreContentEn (en):');
  console.log(currentData.coreContentEn);

  console.log('\n✨ New coreContent (zh-TW):');
  console.log(NEW_ZH_CORE);
  console.log('\n✨ New coreContentEn (en):');
  console.log(NEW_EN_CORE);

  if (isApply) {
    await docRef.set(patch, { merge: true });
    console.log('\n✅ esp32-c3 successfully updated in production Firestore!');
  } else {
    console.log('\n[DRY RUN] Would merge patch:', JSON.stringify(patch, null, 2));
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
