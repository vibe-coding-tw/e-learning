/**
 * Seed scouting lesson & price books into local Firestore emulator.
 *
 * Usage: node scripts/seed-scouting-lesson.js
 */
const http = require('http');

const PROJECT_ID = 'e-learning-942f7';
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 18080;

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
        Authorization: 'Bearer owner',
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

const lessonId = 'common-scouting-gai';
const nowIso = new Date().toISOString();

// Document fields for metadata_lessons/common-scouting-gai
const lessonFields = {
  id: { stringValue: lessonId },
  docId: { stringValue: lessonId },
  title: { stringValue: '生成式 AI 童軍應用' },
  titleEn: { stringValue: 'Generative AI for Scouting' },
  level: { stringValue: 'starter' },
  category: { stringValue: 'common' },
  lessonIndex: { integerValue: '4' },
  lessonLabel: { stringValue: '第 4 課' },
  orderWeight: { integerValue: '90' },
  metadataType: { stringValue: 'course' },
  hiddenFromCatalog: { booleanValue: false },
  assignmentUrls: {
    mapValue: {
      fields: {
        'common-scouting-gai': { stringValue: 'https://github.com/vibe-coding-classroom/common-scouting-gai' }
      }
    }
  },
  courseUnits: {
    arrayValue: {
      values: [
        { stringValue: 'common-scouting-gai.html' }
      ]
    }
  },
  i18n: {
    mapValue: {
      fields: {
        'zh-TW': {
          mapValue: {
            fields: {
              title: { stringValue: '生成式 AI 童軍應用' },
              summary: { stringValue: '將生成式 AI 應用於童軍活動設計、宣傳生圖、問卷分析與無程式碼開發。' },
              coreContent: {
                arrayValue: {
                  values: [
                    { stringValue: 'GAI 工具導覽與分類' },
                    { stringValue: '舊照片修復與早安圖生成' },
                    { stringValue: '蘇格拉底有效提問法' },
                    { stringValue: '無程式碼手機 App 提醒器開發' }
                  ]
                }
              }
            }
          }
        },
        en: {
          mapValue: {
            fields: {
              title: { stringValue: 'Generative AI for Scouting' },
              summary: { stringValue: 'Apply Generative AI in scouting event planning, promotional graphics, analysis, and no-code apps.' },
              coreContent: {
                arrayValue: {
                  values: [
                    { stringValue: 'GAI Tools Overview and Categories' },
                    { stringValue: 'Photo Enhancement and Morning Greetings Generation' },
                    { stringValue: 'Socratic Prompting Techniques' },
                    { stringValue: 'No-Code Mobile Reminder App Generation' }
                  ]
                }
              }
            }
          }
        }
      }
    }
  },
  updatedBy: { stringValue: 'seed-scouting-lesson' },
  createdAt: { timestampValue: nowIso },
  updatedAt: { timestampValue: nowIso }
};

// Price books fields for TWD
const priceBookTwdFields = {
  distributorId: { stringValue: 'default-twd' },
  docId: { stringValue: lessonId },
  lessonId: { stringValue: lessonId },
  sourceDocId: { stringValue: lessonId },
  sourceLessonId: { stringValue: lessonId },
  sourceLessonTitle: { stringValue: '生成式 AI 童軍應用' },
  sourceIsPhysical: { booleanValue: false },
  currency: { stringValue: 'TWD' },
  salePrice: { integerValue: '0' },
  isActive: { booleanValue: true },
  version: { stringValue: 'v1' },
  updatedBy: { stringValue: 'seed-scouting-lesson' },
  createdAt: { timestampValue: nowIso },
  updatedAt: { timestampValue: nowIso },
  effectiveFrom: { timestampValue: nowIso }
};

// Price books fields for USD
const priceBookUsdFields = {
  distributorId: { stringValue: 'default-usd' },
  docId: { stringValue: lessonId },
  lessonId: { stringValue: lessonId },
  sourceDocId: { stringValue: lessonId },
  sourceLessonId: { stringValue: lessonId },
  sourceLessonTitle: { stringValue: '生成式 AI 童軍應用' },
  sourceIsPhysical: { booleanValue: false },
  currency: { stringValue: 'USD' },
  salePrice: { integerValue: '0' },
  isActive: { booleanValue: true },
  version: { stringValue: 'v1' },
  updatedBy: { stringValue: 'seed-scouting-lesson' },
  createdAt: { timestampValue: nowIso },
  updatedAt: { timestampValue: nowIso },
  effectiveFrom: { timestampValue: nowIso }
};

async function run() {
  console.log('Seeding scouting lesson into emulator...');
  try {
    // 1. Seed lesson metadata
    await writeToEmulator('metadata_lessons', lessonId, lessonFields);
    console.log(`✅ Seeding metadata_lessons/${lessonId} complete!`);

    // 2. Seed TWD price book
    const twdPriceBookId = `default-twd_${lessonId}`;
    await writeToEmulator('dealer_price_books', twdPriceBookId, priceBookTwdFields);
    console.log(`✅ Seeding dealer_price_books/${twdPriceBookId} complete!`);

    // 3. Seed USD price book
    const usdPriceBookId = `default-usd_${lessonId}`;
    await writeToEmulator('dealer_price_books', usdPriceBookId, priceBookUsdFields);
    console.log(`✅ Seeding dealer_price_books/${usdPriceBookId} complete!`);

    console.log('🎉 Seeding successfully completed!');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

run();
