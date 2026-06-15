#!/usr/bin/env node
/**
 * 修正 PX4 X500 V2 在 production Firestore 中的 imageUrl 欄位。
 * 同時補充缺少的中英文描述欄位。
 *
 * Usage:
 *   node functions/scripts/fix_px4_image_url.js --dry-run
 *   node functions/scripts/fix_px4_image_url.js --apply
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/** PX4 X500 V2 完整資料補充 */
const PX4_PATCH = {
  imageUrl: 'assets/px4_x500_v2.png',
  summary: '整合 Pixhawk 6C 飛控、Holybro X500 V2 機架與 M9N GPS 的完整 PX4 無人機開發套件。',
  summaryEn: 'A complete PX4 drone development kit integrating Pixhawk 6C flight controller, Holybro X500 V2 frame, and M9N GPS.',
  lessonLabel: '硬體卡 04',
  lessonLabelEn: 'Hardware Card 04',
  titleEn: 'PX4 Development Kit - X500 V2',
  coreContent: [
    '搭載 Pixhawk 6C 飛控 (STM32H753 480MHz) + IMU 三冗餘設計',
    'Holybro X500 V2 碳纖維機架，軸距 500mm，可負載 1kg+',
    '整合 Holybro M9N GPS + 電羅盤，支援 RTK 精準定位擴充',
    '相容 ROS 2、MAVSDK 與 QGroundControl 全開源生態系',
  ],
  coreContentEn: [
    'Pixhawk 6C flight controller (STM32H753 480MHz) with triple-redundant IMU',
    'Holybro X500 V2 carbon fiber frame, 500mm wheelbase, 1kg+ payload capacity',
    'Integrated Holybro M9N GPS + compass, expandable to RTK precision positioning',
    'Compatible with ROS 2, MAVSDK, and QGroundControl open-source ecosystem',
  ],
  orderWeight: 506,
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`🔧 Fix PX4 imageUrl - Mode: ${isApply ? 'APPLY' : 'DRY RUN'}`);

  // 搜尋所有包含 PX4 或 x500 的 metadata_lessons 文件
  const snapshot = await db.collection('metadata_lessons').get();
  const px4Docs = snapshot.docs.filter((doc) => {
    const id = doc.id.toLowerCase();
    const data = doc.data();
    const title = String(data.title || '').toLowerCase();
    return (
      id.includes('px4') ||
      id.includes('x500') ||
      title.includes('px4') ||
      title.includes('x500')
    );
  });

  if (px4Docs.length === 0) {
    console.log('⚠️  找不到任何 PX4 相關的 metadata_lessons 文件。');
    console.log('   請確認 Firestore 中的文件 ID 是否正確。');
    return;
  }

  for (const doc of px4Docs) {
    const current = doc.data();
    console.log(`\n📋 Found: ${doc.id}`);
    console.log(`   title: ${current.title}`);
    console.log(`   current imageUrl: ${current.imageUrl || '(empty)'}`);
    console.log(`   will set imageUrl: ${PX4_PATCH.imageUrl}`);

    if (isApply) {
      await doc.ref.set(PX4_PATCH, { merge: true });
      console.log('   ✅ Updated!');
    } else {
      console.log('   [DRY RUN] Would apply patch:', JSON.stringify(PX4_PATCH, null, 2));
    }
  }

  console.log('\n✅ Done!');
}

main().catch((err) => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
