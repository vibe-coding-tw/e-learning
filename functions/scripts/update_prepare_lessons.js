#!/usr/bin/env node
/**
 * Update prepare lessons in production Firestore to be 9 independent cards.
 *
 * Usage:
 *   node functions/scripts/update_prepare_lessons.js --apply
 *   node functions/scripts/update_prepare_lessons.js --dry-run
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function normalizeCanonicalCourseKey(value = '') {
  return String(value || '')
    .replace(/\.html$/i, '')
    .replace(/^(?:tw|en)-/i, '');
}

const prepareCourses = [
  {
    id: 'tw-common-developer-identity',
    courseId: 'tw-common-developer-identity.html',
    courseKey: 'common-developer-identity',
    title: '開發者身分 (Developer Identity)',
    lessonLabel: '準備課程 01', icon: '🆔', tagText: '免費', duration: '30 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['tw-common-developer-identity.html'],
    entryUnitId: 'tw-common-developer-identity.html',
    coreContent: ['GitHub 帳號建立', '個人 Profile 設定', 'SSH Key 設定'],
    orderWeight: 1, isPhysical: false,
  },
  {
    id: 'tw-common-vscode-online',
    courseId: 'tw-common-vscode-online.html',
    courseKey: 'common-vscode-online',
    title: 'VS Code Online',
    lessonLabel: '準備課程 02', icon: '🌐', tagText: '免費', duration: '20 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['tw-common-vscode-online.html'],
    entryUnitId: 'tw-common-vscode-online.html',
    coreContent: ['GitHub Codespaces 啟用', '線上編輯器操作', '即開即用開發環境'],
    orderWeight: 2, isPhysical: false,
  },
  {
    id: 'tw-common-vscode-setup',
    courseId: 'tw-common-vscode-setup.html',
    courseKey: 'common-vscode-setup',
    title: '開發環境 (VS Code Setup)',
    lessonLabel: '準備課程 03', icon: '💻', tagText: '免費', duration: '40 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['tw-common-vscode-setup.html'],
    entryUnitId: 'tw-common-vscode-setup.html',
    coreContent: ['VS Code 安裝與設定', '常用擴充套件', 'Terminal 基本操作'],
    orderWeight: 3, isPhysical: false,
  },
  {
    id: 'tw-common-agent-mode',
    courseId: 'tw-common-agent-mode.html',
    courseKey: 'common-agent-mode',
    title: 'AI Agent 模式實務',
    lessonLabel: '準備課程 04', icon: '🤖', tagText: '免費', duration: '35 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['tw-common-agent-mode.html'],
    entryUnitId: 'tw-common-agent-mode.html',
    coreContent: ['Cursor Agent Mode', 'AI 輔助程式開發', '提示工程基礎'],
    orderWeight: 4, isPhysical: false,
  },
  {
    id: 'tw-common-vibe-coding',
    courseId: 'tw-common-vibe-coding.html',
    courseKey: 'common-vibe-coding',
    title: 'Vibe Coding 實戰',
    lessonLabel: '準備課程 05', icon: '🎵', tagText: '免費', duration: '45 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['tw-common-vibe-coding.html'],
    entryUnitId: 'tw-common-vibe-coding.html',
    coreContent: ['Vibe Coding 方法論', '快速原型開發', 'AI 驅動開發流程'],
    orderWeight: 5, isPhysical: false,
  },
  {
    id: 'tw-common-web-agents',
    courseId: 'tw-common-web-agents.html',
    courseKey: 'common-web-agents',
    title: '網頁版 AI 代理人實務',
    lessonLabel: '準備課程 06', icon: '🌍', tagText: '免費', duration: '30 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['tw-common-web-agents.html'],
    entryUnitId: 'tw-common-web-agents.html',
    coreContent: ['ChatGPT / Claude 實務', '網頁版 AI 工具比較', '提示工程進階技巧'],
    orderWeight: 6, isPhysical: false,
  },
  {
    id: 'tw-common-github-classroom',
    courseId: 'tw-common-github-classroom.html',
    courseKey: 'common-github-classroom',
    title: 'GitHub Classroom & Vibe Coding 實務',
    lessonLabel: '準備課程 07', icon: '📚', tagText: '免費', duration: '25 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['tw-common-github-classroom.html'],
    entryUnitId: 'tw-common-github-classroom.html',
    coreContent: ['GitHub Classroom 加入流程', '作業繳交方式', '自動評分系統'],
    orderWeight: 7, isPhysical: false,
  },
  {
    id: 'tw-common-wifi-setup',
    courseId: 'tw-common-wifi-setup.html',
    courseKey: 'common-wifi-setup',
    title: 'WiFi 組態設定',
    lessonLabel: '準備課程 08', icon: '📡', tagText: '免費', duration: '25 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['tw-common-wifi-setup.html'],
    entryUnitId: 'tw-common-wifi-setup.html',
    coreContent: ['ESP32 WiFi 連線設定', 'WiFi 診斷與重連', '網路狀態回傳'],
    orderWeight: 8, isPhysical: false,
  },
  {
    id: 'tw-common-motor-ramping',
    courseId: 'tw-common-motor-ramping.html',
    courseKey: 'common-motor-ramping',
    title: '馬達 Ramping 控制',
    lessonLabel: '準備課程 09', icon: '⚙️', tagText: '免費', duration: '25 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['tw-common-motor-ramping.html'],
    entryUnitId: 'tw-common-motor-ramping.html',
    coreContent: ['馬達平滑啟停', 'PWM 訊號調校', '防止電壓突波'],
    orderWeight: 9, isPhysical: false,
  },
];

const prepareSpecs = [
  {
    id: 'spec-recommend-lite',
    courseId: '',
    courseKey: 'spec-recommend-lite',
    title: '電腦規格建議（基本）',
    summary: '可完成課前準備與入門課程。',
    imageUrl: 'https://www.apple.com/v/macbook-air/x/images/overview/hero/hero_static__c9sislzzicq6_large.png',
    coreContent: [
      'Windows 10/11 或 macOS 13+',
      'RAM 8GB',
      '可用儲存空間 20GB+',
      '穩定 Wi‑Fi 與 Chrome/Edge'
    ],
    metadataType: 'spec',
    hiddenFromCatalog: true,
    price: 0,
    category: 'prepare',
    orderWeight: 501,
    isPhysical: false,
  },
  {
    id: 'spec-recommend-pro',
    courseId: '',
    courseKey: 'spec-recommend-pro',
    title: '電腦規格建議（進階）',
    summary: '建議用於基礎/進階課程與較長時間開發。',
    imageUrl: 'https://www.fetnet.net/content/dam/fetnet/user_resource/cbu/images/life-circle/tech/2023/01/mac/mac-8.jpg',
    coreContent: [
      'Windows 11 或 macOS 14+',
      'RAM 16GB+',
      '可用儲存空間 50GB+',
      '建議搭配雙螢幕與外接鍵盤滑鼠'
    ],
    metadataType: 'spec',
    hiddenFromCatalog: true,
    price: 0,
    category: 'prepare',
    orderWeight: 502,
    isPhysical: false,
  },
];

function buildContentRef(entryUnitId) {
  const file = String(entryUnitId || '').replace(/\.html$/i, '');
  if (!file) return '';
  return `courses/zh-TW/${file}.html`;
}

function withEntryMetadata(course) {
  const firstUnit = Array.isArray(course.courseUnits) && course.courseUnits.length > 0 ? course.courseUnits[0] : '';
  const resolvedEntryUnitId = course.entryUnitId || firstUnit;
  const canonicalCourseId = resolvedEntryUnitId;
  return {
    ...course,
    courseId: canonicalCourseId,
    courseKey: normalizeCanonicalCourseKey(course.courseKey || course.contentRef || course.courseId),
    track: 'common',
    level: 'common',
    entryUnitId: resolvedEntryUnitId,
    contentRef: buildContentRef(resolvedEntryUnitId),
    classroomUrl: `/courses/${resolvedEntryUnitId}`,
  };
}

async function run() {
  const isApply = process.argv.includes("--apply");
  console.log(`🚀 Update Prepare Lessons (Firestore Production) - Mode: ${isApply ? "APPLY" : "DRY RUN"}`);

  const processed = prepareCourses.map(withEntryMetadata);

  if (isApply) {
    // 1. Write the 9 cards
    for (const docData of processed) {
      const { id, ...payload } = docData;
      await db.collection("metadata_lessons").doc(id).set(payload);
      console.log(`  ✅ Written card: ${id}`);
    }

    // 2. Delete the old composite card 'tw-common-wifi-motor'
    await db.collection("metadata_lessons").doc("tw-common-wifi-motor").delete();
    console.log(`  🗑️ Deleted legacy card 'tw-common-wifi-motor'`);

    // 3. Write the specs
    for (const spec of prepareSpecs) {
      const { id, ...payload } = spec;
      await db.collection("metadata_lessons").doc(id).set(payload);
      console.log(`  ✅ Written spec: ${id}`);
    }
  } else {
    for (const docData of processed) {
      console.log(`  [DRY RUN] Will write card: ${docData.id}`);
    }
    console.log(`  [DRY RUN] Will delete legacy card 'tw-common-wifi-motor'`);
    for (const spec of prepareSpecs) {
      console.log(`  [DRY RUN] Will write spec: ${spec.id}`);
    }
  }

  console.log("\nDone!");
}

run().catch(console.error);
