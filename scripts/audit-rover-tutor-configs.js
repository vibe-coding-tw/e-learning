#!/usr/bin/env node
/**
 * audit-rover-tutor-configs.js
 *
 * 稽核 rover.k.chen@gmail.com 的 tutorConfigs 是否涵蓋所有 104 個課程單元。
 * 報告每個單元：是否有 authorized: true、是否有 githubClassroomUrl。
 *
 * 使用方式：
 *   cd functions
 *   node ../scripts/audit-rover-tutor-configs.js
 */

'use strict';

const admin = require('firebase-admin');
const path = require('path');

// 初始化 Firebase Admin（使用 Application Default Credentials）
if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'e-learning-942f7' });
}
const db = admin.firestore();

const DEFAULT_TUTOR_EMAIL = 'rover.k.chen@gmail.com';

async function main() {
    console.log(`\n🔍  稽核 ${DEFAULT_TUTOR_EMAIL} 的 tutorConfigs...\n`);

    // 1. 取得 rover 的 Firestore 使用者文件
    const userSnap = await db.collection('users')
        .where('email', '==', DEFAULT_TUTOR_EMAIL)
        .limit(1)
        .get();

    if (userSnap.empty) {
        console.error(`❌  找不到 ${DEFAULT_TUTOR_EMAIL} 的使用者文件！`);
        process.exit(1);
    }

    const roverData = userSnap.docs[0].data();
    const tutorConfigs = roverData.tutorConfigs || {};

    console.log(`✅  找到 rover 帳號，tutorConfigs 共 ${Object.keys(tutorConfigs).length} 個項目\n`);

    // 2. 取得所有課程單元清單（metadata_lessons）
    const lessonsSnap = await db.collection('metadata_lessons').get();
    const allUnits = [];

    lessonsSnap.forEach(doc => {
        const course = doc.data();
        const courseUnits = Array.isArray(course.courseUnits) ? course.courseUnits : [];
        const classroomUrls = course.githubClassroomUrls || {};
        for (const unitId of courseUnits) {
            if (unitId) {
                allUnits.push({
                    unitId,
                    courseId: doc.id,
                    courseTitle: course.title || doc.id,
                    // metadata_lessons 是否有 classroom URL
                    metaUrl: classroomUrls[unitId] || classroomUrls[unitId.replace('.html', '')] || null
                });
            }
        }
    });

    console.log(`📚  metadata_lessons 中共找到 ${allUnits.length} 個課程單元\n`);

    // 3. 交叉比對
    let okCount = 0;
    let noAuthCount = 0;
    let noUrlCount = 0;
    const missing = [];

    for (const { unitId, courseId, courseTitle, metaUrl } of allUnits) {
        const cfg = tutorConfigs[unitId] || tutorConfigs[unitId.replace('.html', '')] || null;
        const authorized = cfg?.authorized === true;
        const hasUrl = !!(cfg?.githubClassroomUrl || cfg?.assignmentUrl);
        const hasMetaUrl = !!metaUrl;

        if (authorized && (hasUrl || hasMetaUrl)) {
            okCount++;
        } else {
            missing.push({ unitId, courseId, courseTitle, authorized, hasUrl, hasMetaUrl });
            if (!authorized) noAuthCount++;
            if (authorized && !hasUrl && !hasMetaUrl) noUrlCount++;
        }
    }

    // 4. 輸出報告
    console.log('=' .repeat(80));
    console.log(`📊  稽核結果：`);
    console.log(`    ✅  完整設定（有授權 + 有 URL）：${okCount}`);
    console.log(`    ❌  問題項目：${missing.length}`);
    console.log(`       - 未授權 (authorized !== true)：${noAuthCount}`);
    console.log(`       - 有授權但完全無 URL：${noUrlCount}`);
    console.log('=' .repeat(80));

    if (missing.length > 0) {
        console.log('\n❌  問題單元清單：\n');
        console.log('unitId'.padEnd(55) + 'authorized'.padEnd(12) + 'hasOwnUrl'.padEnd(12) + 'hasMetaUrl'.padEnd(12) + 'courseId');
        console.log('-'.repeat(120));
        for (const { unitId, courseId, authorized, hasUrl, hasMetaUrl } of missing) {
            const ok = (authorized && (hasUrl || hasMetaUrl)) ? '✅' : '❌';
            console.log(
                `${ok} ${unitId}`.padEnd(57) +
                String(authorized).padEnd(12) +
                String(hasUrl).padEnd(12) +
                String(hasMetaUrl).padEnd(12) +
                courseId
            );
        }
    } else {
        console.log('\n🎉  所有單元均已正確設定！');
    }

    console.log();
    process.exit(0);
}

main().catch(err => {
    console.error('腳本執行失敗：', err);
    process.exit(1);
});
