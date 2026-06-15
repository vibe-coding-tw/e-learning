/**
 * 本地模擬器種子資料腳本
 * 用途：將課程元資料寫入本地 Firestore 模擬器
 * 執行：cd functions && node scripts/seed-emulator.js
 */

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const admin = require('firebase-admin');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({ projectId: 'e-learning-942f7' });
const db = getFirestore(app);

function buildContentRef(entryUnitId) {
  const file = String(entryUnitId || '').replace(/\.html$/i, '');
  if (!file) return '';
  if (/^start-\d{2}-unit-/.test(file)) return `courses/zh-TW/${file.replace(/^start-\d{2}-unit-/, 'tw-car-starter-')}.html`;
  if (/^basic-\d{2}-unit-/.test(file)) return `courses/zh-TW/${file.replace(/^basic-\d{2}-unit-/, 'tw-car-basic-')}.html`;
  if (/^(adv|advanced)-\d{2}-unit-/.test(file)) return `courses/zh-TW/${file.replace(/^(adv|advanced)-\d{2}-unit-/, 'tw-car-advanced-')}.html`;
  if (/^\d{2}-unit-/.test(file)) return `courses/zh-TW/${file.replace(/^\d{2}-unit-/, 'tw-common-')}.html`;
  return `courses/zh-TW/${file}.html`;
}

function normalizeCanonicalCourseKey(value = '') {
  return String(value || '')
    .replace(/\.html$/i, '')
    .replace(/^(?:tw|en)-/i, '');
}

function normalizeCanonicalCourseDocId(course = {}) {
  const metadataType = String(course.metadataType || '').toLowerCase();
  if (metadataType === 'spec' || metadataType === 'product') {
    return String(course.courseId || course.id || '').trim();
  }

  const normalizedCourseKey = normalizeCanonicalCourseKey(
    course.courseKey || course.contentRef || course.courseId || course.id || ''
  );
  if (normalizedCourseKey) {
    return `${normalizedCourseKey}.html`;
  }

  return String(course.courseId || course.id || '').trim();
}

function normalizeCanonicalUnitId(value = '') {
  const file = String(value || '').trim().replace(/\.html$/i, '');
  if (!file) return '';
  if (/^start-\d{2}-unit-/.test(file)) return `${file.replace(/^start-\d{2}-unit-/, 'car-starter-')}.html`;
  if (/^basic-\d{2}-unit-/.test(file)) return `${file.replace(/^basic-\d{2}-unit-/, 'car-basic-')}.html`;
  if (/^(?:adv|advanced)-\d{2}-unit-/.test(file)) return `${file.replace(/^(?:adv|advanced)-\d{2}-unit-/, 'car-advanced-')}.html`;
  return `${file}.html`;
}

function resolveCanonicalCourseId(course) {
  return normalizeCanonicalCourseDocId(course);
}

function normalizeLegacyPrice(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function deriveUsdFromTwd(twdAmount) {
  const numeric = normalizeLegacyPrice(twdAmount);
  if (numeric <= 0) return 0;
  return Math.max(1, Math.round(numeric / 30));
}

function pricingByCategory(category, twAmount) {
  const amount = normalizeLegacyPrice(twAmount);
  const usdByCategory = {
    started: 40,
    basic: 50,
    advanced: 60,
  };
  const usdAmount = usdByCategory[category] ?? deriveUsdFromTwd(amount);
  return {
    pricing: {
      tw: { amount, currency: 'TWD' },
      en: { amount: usdAmount, currency: 'USD' },
    },
    prices: {
      tw: amount,
      en: usdAmount,
    },
    priceByLocale: {
      'zh-TW': { amount, currency: 'TWD' },
      en: { amount: usdAmount, currency: 'USD' },
    },
    priceByRegion: {
      tw: { amount, currency: 'TWD' },
      en: { amount: usdAmount, currency: 'USD' },
    },
    priceMap: {
      tw: { amount, currency: 'TWD' },
      en: { amount: usdAmount, currency: 'USD' },
    },
    price_twd: amount,
    price_usd: usdAmount,
    currency: 'TWD',
  };
}

function attachLocalizedPricing(course) {
  return {
    ...course,
    ...pricingByCategory(course.category, course.price),
  };
}

function withEntryMetadata(course) {
  if (course.metadataType === 'spec') {
    return {
      ...course,
      courseId: course.courseId || '',
      level: course.level || 'common',
      entryUnitId: '',
      contentRef: '',
      classroomUrl: '',
    };
  }
  const firstUnit = Array.isArray(course.courseUnits) && course.courseUnits.length > 0 ? course.courseUnits[0] : '';
  const resolvedEntryUnitId = normalizeCanonicalUnitId(course.entryUnitId || firstUnit);
  const normalizedCourseUnits = Array.isArray(course.courseUnits)
    ? course.courseUnits.map(normalizeCanonicalUnitId)
    : [];
  const normalizedCourseKey = normalizeCanonicalCourseKey(course.courseKey || course.contentRef || course.courseId || course.id || '');
  const canonicalCourseId = resolveCanonicalCourseId({
    ...course,
    entryUnitId: resolvedEntryUnitId,
  });
  return {
    ...course,
    id: canonicalCourseId || course.id || '',
    courseId: canonicalCourseId,
    level: course.level || (
      normalizedCourseKey.startsWith('car-starter-') ? 'starter' :
      normalizedCourseKey.startsWith('car-basic-') ? 'basic' :
      normalizedCourseKey.startsWith('car-advanced-') ? 'advanced' :
      'common'
    ),
    entryUnitId: resolvedEntryUnitId,
    courseUnits: normalizedCourseUnits.length > 0 ? normalizedCourseUnits : (course.courseUnits || []),
    contentRef: course.contentRef || buildContentRef(resolvedEntryUnitId),
    classroomUrl: resolvedEntryUnitId ? `/courses/${resolvedEntryUnitId}` : '',
  };
}

// metadata_lessons 種子資料
// courseId 需與各頁面的 data-course-id 一致
// 渲染所需欄位：courseId, title, price, category, courseUnits, orderWeight,
//   isPhysical, lessonLabel, icon, tagText, duration, coreContent, classroomUrl, videoId
const courses = [
  // ─── prepare ───
  {
    id: 'common-developer-identity',
    courseId: 'common-developer-identity.html',
    courseKey: 'common-developer-identity',
    title: '開發者身分 (Developer Identity)',
    lessonLabel: '準備課程 01', icon: '🆔', tagText: '免費', duration: '30 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['common-developer-identity.html'],
    entryUnitId: 'common-developer-identity.html',
    coreContent: ['GitHub 帳號建立', '個人 Profile 設定', 'SSH Key 設定'],
    orderWeight: 1, isPhysical: false,
  },
  {
    id: 'common-vscode-online',
    courseId: 'common-vscode-online.html',
    courseKey: 'common-vscode-online',
    title: 'VS Code Online',
    lessonLabel: '準備課程 02', icon: '🌐', tagText: '免費', duration: '20 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['common-vscode-online.html'],
    entryUnitId: 'common-vscode-online.html',
    coreContent: ['GitHub Codespaces 啟用', '線上編輯器操作', '即開即用開發環境'],
    orderWeight: 2, isPhysical: false,
  },
  {
    id: 'common-vscode-setup',
    courseId: 'common-vscode-setup.html',
    courseKey: 'common-vscode-setup',
    title: '開發環境 (VS Code Setup)',
    lessonLabel: '準備課程 03', icon: '💻', tagText: '免費', duration: '40 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['common-vscode-setup.html'],
    entryUnitId: 'common-vscode-setup.html',
    coreContent: ['VS Code 安裝與設定', '常用擴充套件', 'Terminal 基本操作'],
    orderWeight: 3, isPhysical: false,
  },
  {
    id: 'common-agent-mode',
    courseId: 'common-agent-mode.html',
    courseKey: 'common-agent-mode',
    title: 'AI Agent 模式實務',
    lessonLabel: '準備課程 04', icon: '🤖', tagText: '免費', duration: '35 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['common-agent-mode.html'],
    entryUnitId: 'common-agent-mode.html',
    coreContent: ['Cursor Agent Mode', 'AI 輔助程式開發', '提示工程基礎'],
    orderWeight: 4, isPhysical: false,
  },
  {
    id: 'common-vibe-coding',
    courseId: 'common-vibe-coding.html',
    courseKey: 'common-vibe-coding',
    title: 'Vibe Coding 實戰',
    lessonLabel: '準備課程 05', icon: '🎵', tagText: '免費', duration: '45 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['common-vibe-coding.html'],
    entryUnitId: 'common-vibe-coding.html',
    coreContent: ['Vibe Coding 方法論', '快速原型開發', 'AI 驅動開發流程'],
    orderWeight: 5, isPhysical: false,
  },
  {
    id: 'common-web-agents',
    courseId: 'common-web-agents.html',
    courseKey: 'common-web-agents',
    title: '網頁版 AI 代理人實務',
    lessonLabel: '準備課程 06', icon: '🌍', tagText: '免費', duration: '30 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['common-web-agents.html'],
    entryUnitId: 'common-web-agents.html',
    coreContent: ['ChatGPT / Claude 實務', '網頁版 AI 工具比較', '提示工程進階技巧'],
    orderWeight: 6, isPhysical: false,
  },
  {
    id: 'common-github-classroom',
    courseId: 'common-github-classroom.html',
    courseKey: 'common-github-classroom',
    title: 'GitHub Classroom & Vibe Coding 實務',
    lessonLabel: '準備課程 07', icon: '📚', tagText: '免費', duration: '25 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['common-github-classroom.html'],
    entryUnitId: 'common-github-classroom.html',
    coreContent: ['GitHub Classroom 加入流程', '作業繳交方式', '自動評分系統'],
    orderWeight: 7, isPhysical: false,
  },
  {
    id: 'common-wifi-setup',
    courseId: 'common-wifi-setup.html',
    courseKey: 'common-wifi-setup',
    title: 'WiFi 組態設定',
    lessonLabel: '準備課程 08', icon: '📡', tagText: '免費', duration: '25 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['common-wifi-setup.html'],
    entryUnitId: 'common-wifi-setup.html',
    coreContent: ['ESP32 WiFi 連線設定', 'WiFi 診斷與重連', '網路狀態回傳'],
    orderWeight: 8, isPhysical: false,
  },
  {
    id: 'common-motor-ramping',
    courseId: 'common-motor-ramping.html',
    courseKey: 'common-motor-ramping',
    title: '馬達 Ramping 控制',
    lessonLabel: '準備課程 09', icon: '⚙️', tagText: '免費', duration: '25 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['common-motor-ramping.html'],
    entryUnitId: 'common-motor-ramping.html',
    coreContent: ['馬達平滑啟停', 'PWM 訊號調校', '防止電壓突波'],
    orderWeight: 9, isPhysical: false,
  },

  // ─── started (入門課程：Web App 遙控器設計與 Web BLE 整合) ───
  {
    id: 'car-starter-web-app.html',
    courseId: 'car-starter-web-app.html',
    title: 'Web App 基礎開發',
    lessonLabel: '入門 01', icon: '📱', tagText: '入門', duration: '2 小時',
    price: 1200, category: 'started',
    courseUnits: ['start-01-unit-html5-basics.html', 'start-01-unit-flexbox-layout.html', 'start-01-unit-ui-ux-standards.html'],
    coreContent: ['HTML5 基礎結構', 'Flexbox 版面佈局', 'UI/UX 設計標準'],
    courseKey: 'car-starter-web-app',
    entryUnitId: 'start-01-unit-flexbox-layout.html',
    orderWeight: 10, isPhysical: false,
  },
  {
    id: 'car-starter-web-ble.html',
    courseId: 'car-starter-web-ble.html',
    title: 'Web BLE 藍牙整合',
    lessonLabel: '入門 02', icon: '📶', tagText: '入門', duration: '2.5 小時',
    price: 1200, category: 'started',
    courseUnits: ['start-02-unit-ble-async.html', 'start-02-unit-ble-security.html', 'start-02-unit-typed-arrays.html'],
    coreContent: ['BLE 非同步連線', 'BLE 安全機制', 'TypedArray 資料處理'],
    courseKey: 'car-starter-web-ble',
    entryUnitId: 'start-02-unit-ble-async.html',
    orderWeight: 11, isPhysical: false,
  },
  {
    id: 'car-starter-remote-control.html',
    courseId: 'car-starter-remote-control.html',
    title: '遙控器介面實作',
    lessonLabel: '入門 03', icon: '🎮', tagText: '入門', duration: '2 小時',
    price: 1200, category: 'started',
    courseUnits: ['start-03-unit-control-panel.html', 'start-03-unit-data-json.html', 'start-03-unit-flow-logic.html'],
    coreContent: ['控制面板設計', 'JSON 資料交換', '流程邏輯設計'],
    courseKey: 'car-starter-remote-control',
    entryUnitId: 'start-03-unit-control-panel.html',
    orderWeight: 12, isPhysical: false,
  },
  {
    id: 'car-starter-touch-events.html',
    courseId: 'car-starter-touch-events.html',
    title: '觸控事件處理',
    lessonLabel: '入門 04', icon: '👆', tagText: '入門', duration: '2 小時',
    price: 1200, category: 'started',
    courseUnits: ['start-04-unit-touch-basics.html', 'start-04-unit-prevent-default.html', 'start-04-unit-long-press.html'],
    coreContent: ['觸控基礎事件', 'preventDefault 應用', '長按事件實作'],
    courseKey: 'car-starter-touch-events',
    entryUnitId: 'start-04-unit-long-press.html',
    orderWeight: 13, isPhysical: false,
  },
  {
    id: 'car-starter-joystick-lab.html',
    courseId: 'car-starter-joystick-lab.html',
    title: '搖桿實驗室',
    lessonLabel: '入門 05', icon: '🕹️', tagText: '入門', duration: '2.5 小時',
    price: 1200, category: 'started',
    courseUnits: ['start-05-unit-canvas-joystick.html', 'start-05-unit-joystick-math.html', 'start-05-unit-touch-vs-mouse.html'],
    coreContent: ['Canvas 搖桿繪製', '搖桿數學運算', '觸控與滑鼠相容'],
    courseKey: 'car-starter-joystick-lab',
    entryUnitId: 'start-05-unit-canvas-joystick.html',
    orderWeight: 14, isPhysical: false,
  },

  // ─── basic (基礎課程：馬達控制、通訊與 OTA) ───
  {
    id: 'basic-01-environment',
    courseId: 'basic-01-master-environment.html',
    title: '開發環境建置',
    lessonLabel: '基礎 01', icon: '🔧', tagText: '基礎', duration: '2 小時',
    price: 1500, category: 'basic',
    courseUnits: ['basic-01-unit-drivers-ports.html', 'basic-01-unit-esp32-architecture.html', 'basic-01-unit-platformio-setup.html'],
    coreContent: ['驅動與連接埠', 'ESP32 架構概覽', 'PlatformIO 設定'],
    classroomUrl: '/courses/basic-01-master-environment.html',
    orderWeight: 20, isPhysical: false,
  },
  {
    id: 'basic-02-ota-architecture',
    courseId: 'basic-02-master-ota-architecture.html',
    title: 'OTA 更新架構',
    lessonLabel: '基礎 02', icon: '🔄', tagText: '基礎', duration: '2 小時',
    price: 1500, category: 'basic',
    courseUnits: ['basic-02-unit-ota-principles.html', 'basic-02-unit-ota-security.html', 'basic-02-unit-partition-table.html'],
    coreContent: ['OTA 更新原理', 'OTA 安全機制', '分區表設計'],
    classroomUrl: '/courses/basic-02-master-ota-architecture.html',
    orderWeight: 21, isPhysical: false,
  },
  {
    id: 'basic-03-io-mapping',
    courseId: 'basic-03-master-io-mapping.html',
    title: 'IO 腳位對應',
    lessonLabel: '基礎 03', icon: '📌', tagText: '基礎', duration: '1.5 小時',
    price: 1500, category: 'basic',
    courseUnits: ['basic-03-unit-pinout.html', 'basic-03-unit-adc-resolution.html', 'basic-03-unit-pullup-debounce.html'],
    coreContent: ['腳位配置圖', 'ADC 解析度', '上拉電阻與防彈跳'],
    classroomUrl: '/courses/basic-03-master-io-mapping.html',
    orderWeight: 22, isPhysical: false,
  },
  {
    id: 'basic-04-pwm-control',
    courseId: 'basic-04-master-pwm-control.html',
    title: 'PWM 馬達控制',
    lessonLabel: '基礎 04', icon: '⚙️', tagText: '基礎', duration: '2 小時',
    price: 1500, category: 'basic',
    courseUnits: ['basic-04-unit-pwm-basics.html', 'basic-04-unit-ledc-syntax.html', 'basic-04-unit-h-bridge.html'],
    coreContent: ['PWM 基礎原理', 'LEDC 語法', 'H 橋電路驅動'],
    classroomUrl: '/courses/basic-04-master-pwm-control.html',
    orderWeight: 23, isPhysical: false,
  },
  {
    id: 'basic-05-ble-gatt',
    courseId: 'basic-05-master-ble-gatt.html',
    title: 'BLE GATT 協定',
    lessonLabel: '基礎 05', icon: '📡', tagText: '基礎', duration: '2.5 小時',
    price: 1500, category: 'basic',
    courseUnits: ['basic-05-unit-advertising-connection.html', 'basic-05-unit-ble-properties.html', 'basic-05-unit-gatt-structure.html'],
    coreContent: ['廣播與連線', 'BLE 特性值', 'GATT 資料結構'],
    classroomUrl: '/courses/basic-05-master-ble-gatt.html',
    orderWeight: 24, isPhysical: false,
  },
  {
    id: 'basic-06-http-web',
    courseId: 'basic-06-master-http-web.html',
    title: 'HTTP 與 Web 通訊',
    lessonLabel: '基礎 06', icon: '🌐', tagText: '基礎', duration: '2 小時',
    price: 1500, category: 'basic',
    courseUnits: ['basic-06-unit-http-request.html', 'basic-06-unit-fetch-api.html', 'basic-06-unit-cors-security.html'],
    coreContent: ['HTTP 請求', 'Fetch API', 'CORS 安全機制'],
    classroomUrl: '/courses/basic-06-master-http-web.html',
    orderWeight: 25, isPhysical: false,
  },
  {
    id: 'basic-07-wifi-modes',
    courseId: 'basic-07-master-wifi-modes.html',
    title: 'WiFi 模式與 WebServer',
    lessonLabel: '基礎 07', icon: '📶', tagText: '基礎', duration: '2 小時',
    price: 1500, category: 'basic',
    courseUnits: ['basic-07-unit-wifi-ap-sta.html', 'basic-07-unit-http-lifecycle.html', 'basic-07-unit-async-webserver.html'],
    coreContent: ['WiFi AP/STA 模式', 'HTTP 生命週期', '非同步 WebServer'],
    classroomUrl: '/courses/basic-07-master-wifi-modes.html',
    orderWeight: 26, isPhysical: false,
  },
  {
    id: 'basic-08-joystick-math',
    courseId: 'basic-08-master-joystick-math.html',
    title: '搖桿數學模型',
    lessonLabel: '基礎 08', icon: '🕹️', tagText: '基礎', duration: '2.5 小時',
    price: 1500, category: 'basic',
    courseUnits: ['basic-08-unit-joystick-mapping.html', 'basic-08-unit-response-curves.html', 'basic-08-unit-unicycle-model.html'],
    coreContent: ['搖桿映射', '響應曲線', '單輪車模型'],
    classroomUrl: '/courses/basic-08-master-joystick-math.html',
    orderWeight: 27, isPhysical: false,
  },
  {
    id: 'basic-09-multitasking',
    courseId: 'basic-09-master-multitasking.html',
    title: '多工處理',
    lessonLabel: '基礎 09', icon: '⏱️', tagText: '基礎', duration: '2 小時',
    price: 1500, category: 'basic',
    courseUnits: ['basic-09-unit-millis.html', 'basic-09-unit-hardware-timer.html', 'basic-09-unit-sampling-rate.html'],
    coreContent: ['millis() 計時', '硬體計時器', '取樣率設計'],
    classroomUrl: '/courses/basic-09-master-multitasking.html',
    orderWeight: 28, isPhysical: false,
  },
  {
    id: 'basic-10-fsm',
    courseId: 'basic-10-master-fsm.html',
    title: '有限狀態機',
    lessonLabel: '基礎 10', icon: '🔀', tagText: '基礎', duration: '2 小時',
    price: 1500, category: 'basic',
    courseUnits: ['basic-10-unit-fsm.html', 'basic-10-unit-state-consistency.html', 'basic-10-unit-ui-design.html'],
    coreContent: ['FSM 設計模式', '狀態一致性', 'UI 狀態設計'],
    classroomUrl: '/courses/basic-10-master-fsm.html',
    orderWeight: 29, isPhysical: false,
  },

  // ─── advanced (進階課程：影像處理、辨識與 AI) ───
  {
    id: 'adv-01-s3-cam',
    courseId: 'adv-01-master-s3-cam.html',
    title: 'ESP32-S3 攝影機',
    lessonLabel: '進階 01', icon: '📷', tagText: '進階', duration: '3 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-01-unit-s3-interfaces.html', 'adv-01-unit-mjpeg-stream.html', 'adv-01-unit-jpeg-quality.html'],
    coreContent: ['S3 介面配置', 'MJPEG 串流', 'JPEG 品質調校'],
    classroomUrl: '/courses/adv-01-master-s3-cam.html',
    orderWeight: 30, isPhysical: false,
  },
  {
    id: 'adv-02-video',
    courseId: 'adv-02-master-video.html',
    title: '影像串流技術',
    lessonLabel: '進階 02', icon: '🎬', tagText: '進階', duration: '3 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-02-unit-video-streaming.html', 'adv-02-unit-canvas-image.html', 'adv-02-unit-bandwidth-fps.html'],
    coreContent: ['影像串流實作', 'Canvas 影像處理', '頻寬與 FPS 優化'],
    classroomUrl: '/courses/adv-02-master-video.html',
    orderWeight: 31, isPhysical: false,
  },
  {
    id: 'adv-03-ble-advanced',
    courseId: 'adv-03-master-ble-advanced.html',
    title: 'BLE 進階通訊',
    lessonLabel: '進階 03', icon: '📡', tagText: '進階', duration: '2.5 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-03-unit-ble-notify.html', 'adv-03-unit-ble-mtu.html', 'adv-03-unit-json-serialization.html'],
    coreContent: ['BLE Notify 機制', 'MTU 協商', 'JSON 序列化'],
    classroomUrl: '/courses/adv-03-master-ble-advanced.html',
    orderWeight: 32, isPhysical: false,
  },
  {
    id: 'adv-04-sensors',
    courseId: 'adv-04-master-sensors.html',
    title: '感測器整合',
    lessonLabel: '進階 04', icon: '🔬', tagText: '進階', duration: '2.5 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-04-unit-i2c-spi.html', 'adv-04-unit-json-rest.html', 'adv-04-unit-filter-algorithms.html'],
    coreContent: ['I2C/SPI 通訊', 'JSON REST API', '濾波演算法'],
    classroomUrl: '/courses/adv-04-master-sensors.html',
    orderWeight: 33, isPhysical: false,
  },
  {
    id: 'adv-05-cv',
    courseId: 'adv-05-master-cv.html',
    title: '電腦視覺基礎',
    lessonLabel: '進階 05', icon: '👁️', tagText: '進階', duration: '3 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-05-unit-centroid-error.html', 'adv-05-unit-closed-loop.html', 'adv-05-unit-feature-extraction.html'],
    coreContent: ['重心誤差計算', '閉迴路控制', '特徵提取'],
    classroomUrl: '/courses/adv-05-master-cv.html',
    orderWeight: 34, isPhysical: false,
  },
  {
    id: 'adv-06-cv-advanced',
    courseId: 'adv-06-master-cv-advanced.html',
    title: '電腦視覺進階',
    lessonLabel: '進階 06', icon: '🔍', tagText: '進階', duration: '3 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-06-unit-hsv-math.html', 'adv-06-unit-threshold-filter.html', 'adv-06-unit-centroid-algorithm.html', 'adv-06-unit-look-ahead.html'],
    coreContent: ['HSV 色彩數學', '閾值濾波', '重心演算法', '前瞻追蹤'],
    classroomUrl: '/courses/adv-06-master-cv-advanced.html',
    orderWeight: 35, isPhysical: false,
  },
  {
    id: 'adv-07-ui-framework',
    courseId: 'adv-07-master-ui-framework.html',
    title: 'UI 框架設計',
    lessonLabel: '進階 07', icon: '🖥️', tagText: '進階', duration: '2.5 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-07-unit-ui-framework.html', 'adv-07-unit-chart-canvas.html', 'adv-07-unit-json-parsing.html', 'adv-07-unit-event-polling.html'],
    coreContent: ['UI 框架架構', 'Chart Canvas 圖表', 'JSON 解析', '事件輪詢'],
    classroomUrl: '/courses/adv-07-master-ui-framework.html',
    orderWeight: 36, isPhysical: false,
  },
  {
    id: 'adv-08-image-processing',
    courseId: 'adv-08-master-image-processing.html',
    title: '影像處理實務',
    lessonLabel: '進階 08', icon: '🖼️', tagText: '進階', duration: '3 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-08-unit-color-spaces.html', 'adv-08-unit-mobilenet-ssd.html', 'adv-08-unit-p-control.html', 'adv-08-unit-error-calculation.html'],
    coreContent: ['色彩空間', 'MobileNet-SSD 模型', 'P 控制', '誤差計算'],
    classroomUrl: '/courses/adv-08-master-image-processing.html',
    orderWeight: 37, isPhysical: false,
  },
  {
    id: 'adv-09-ai-recognition',
    courseId: 'adv-09-master-ai-recognition.html',
    title: 'AI 辨識應用',
    lessonLabel: '進階 09', icon: '🧠', tagText: '進階', duration: '3 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-09-unit-teachable-machine.html', 'adv-09-unit-cnn-audio.html', 'adv-09-unit-webspeech-api.html', 'adv-09-unit-flow-control.html'],
    coreContent: ['Teachable Machine', 'CNN 音訊辨識', 'Web Speech API', '流程控制'],
    classroomUrl: '/courses/adv-09-master-ai-recognition.html',
    orderWeight: 38, isPhysical: false,
  },
  {
    id: 'adv-10-diff-drive',
    courseId: 'adv-10-master-diff-drive.html',
    title: '差速驅動控制',
    lessonLabel: '進階 10', icon: '🚗', tagText: '進階', duration: '3 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-10-unit-icc-geometry.html', 'adv-10-unit-pwm-limits.html', 'adv-10-unit-api-design.html'],
    coreContent: ['ICC 幾何模型', 'PWM 限制', 'API 設計'],
    classroomUrl: '/courses/adv-10-master-diff-drive.html',
    orderWeight: 39, isPhysical: false,
  },
  {
    id: 'adv-11-photoelectric',
    courseId: 'adv-11-master-photoelectric.html',
    title: '光電感測器',
    lessonLabel: '進階 11', icon: '💡', tagText: '進階', duration: '2.5 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-11-unit-sensor-principles.html', 'adv-11-unit-hardware-interrupts.html', 'adv-11-unit-speed-algorithms.html'],
    coreContent: ['感測器原理', '硬體中斷', '測速演算法'],
    classroomUrl: '/courses/adv-11-master-photoelectric.html',
    orderWeight: 40, isPhysical: false,
  },
  {
    id: 'adv-12-pid',
    courseId: 'adv-12-master-pid.html',
    title: 'PID 控制',
    lessonLabel: '進階 12', icon: '📊', tagText: '進階', duration: '3.5 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-12-unit-pid-math.html', 'adv-12-unit-pid-control.html', 'adv-12-unit-code-logic.html'],
    coreContent: ['PID 數學推導', 'PID 控制實作', '程式邏輯設計'],
    classroomUrl: '/courses/adv-12-master-pid.html',
    orderWeight: 41, isPhysical: false,
  },
  {
    id: 'adv-13-robustness',
    courseId: 'adv-13-master-robustness.html',
    title: '系統穩健性',
    lessonLabel: '進階 13', icon: '🛡️', tagText: '進階', duration: '2.5 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-13-unit-robustness.html', 'adv-13-unit-system-perf.html', 'adv-13-unit-technical-narrative.html'],
    coreContent: ['穩健性設計', '系統效能分析', '技術敘事'],
    classroomUrl: '/courses/adv-13-master-robustness.html',
    orderWeight: 42, isPhysical: false,
  },
  {
    id: 'adv-14-debugging-art',
    courseId: 'adv-14-master-debugging-art.html',
    title: '除錯的藝術',
    lessonLabel: '進階 14', icon: '🐛', tagText: '進階', duration: '2.5 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-14-unit-debugging-art.html', 'adv-14-unit-kpi-definition.html', 'adv-14-unit-refactoring.html'],
    coreContent: ['除錯技巧', 'KPI 定義', '重構方法論'],
    classroomUrl: '/courses/adv-14-master-debugging-art.html',
    orderWeight: 43, isPhysical: false,
  },
  {
    id: 'adv-15-architecture',
    courseId: 'adv-15-master-architecture.html',
    title: '系統架構設計',
    lessonLabel: '進階 15', icon: '🏗️', tagText: '進階', duration: '3 小時',
    price: 1800, category: 'advanced',
    courseUnits: ['adv-15-unit-data-flow.html', 'adv-15-unit-ble-async.html', 'adv-15-unit-image-dma.html', 'adv-15-unit-pid-simulation.html'],
    coreContent: ['資料流設計', 'BLE 非同步架構', '影像 DMA', 'PID 模擬'],
    classroomUrl: '/courses/adv-15-master-architecture.html',
    orderWeight: 44, isPhysical: false,
  },
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
    learningPaths: ['tw-common', 'en-common'],
    orderWeight: 507,
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
    learningPaths: ['tw-common', 'en-common'],
    orderWeight: 508,
    isPhysical: false,
  },
  {
    id: 'esp32-c3',
    courseId: 'esp32-c3',
    docId: 'esp32-c3',
    courseKey: 'product-esp32-c3',
    title: '程式載體車子平台 (入門款)',
    titleEn: 'Programmable Car Platform (Starter)',
    summary: '適合課前準備與無人車入門實作的智慧雙輪差速智慧無人車平台。',
    summaryEn: 'Suitable for preparation and starter car exercises, featuring a palm-sized lightweight differential drive smart robot car platform.',
    lessonLabel: '硬體卡 01',
    lessonLabelEn: 'Hardware Card 01',
    icon: '🚗',
    tagText: '硬體',
    duration: '硬體',
    price: 0,
    category: 'prepare',
    learningPaths: ['tw-common', 'en-common'],
    imageUrl: 'https://down-tw.img.susercontent.com/file/tw-11134208-81ztp-me1d6y243mdjc3',
    coreContent: [
      '重量約 280 克，掌上型輕量化雙輪差速智慧無人車平台',
      '搭載 ESP32-C3 RISC-V 主控板，支援 Wi-Fi/BLE 無線連線',
      '整合 DRV8833 雙通道馬達驅動晶片，具備精細的 PWM 調速控制',
      '支援 Vibe Coding OTA 即時控制協議 C++/Python 程式語法'
    ],
    coreContentEn: [
      'Approx. 280g, palm-sized lightweight differential drive smart robot car platform',
      'Equipped with ESP32-C3 RISC-V MCU, supporting Wi-Fi/BLE',
      'Integrated DRV8833 dual-channel motor driver for precise PWM speed control',
      'Supports Vibe Coding OTA real-time control protocol, C++, and Python'
    ],
    orderWeight: 503,
    isPhysical: true,
    metadataType: 'product',
    hiddenFromCatalog: false,
    isDeprecated: false,
  },
  {
    id: 'esp32-s3',
    courseId: 'esp32-s3',
    docId: 'esp32-s3',
    courseKey: 'product-esp32-s3',
    title: '程式載體車子平台 (進階款)',
    titleEn: 'Programmable Car Platform (Advanced)',
    summary: '配備避震獨立懸吊、高精度光電編碼器與攝影機的進階無人車平台。',
    summaryEn: 'Equipped with independent suspension, high-precision photoelectric encoders, and camera for advanced robotics projects.',
    lessonLabel: '硬體卡 02',
    lessonLabelEn: 'Hardware Card 02',
    icon: '🏎️',
    tagText: '硬體',
    duration: '硬體',
    price: 0,
    category: 'prepare',
    learningPaths: ['tw-common', 'en-common'],
    imageUrl: 'https://www.kidstoylover.com/cdn/shop/files/1_adc99452-bd07-49f0-95a1-a5d7990ed0f5.jpg?v=1715839568&width=1445',
    coreContent: [
      '重量約 450 克，雙橫臂式獨立避震懸吊系統與高強度金屬車體',
      '搭載 ESP32-S3-WROOM-1 (240MHz 雙核 + AI 向量指令) 及 OV2640 攝影機',
      '配備雙路高精度光電正交編碼器與六軸 MPU6050 姿態感測器',
      '支援低延遲 MJPEG Wi-Fi 影像串流與網頁端電腦視覺/邊緣 AI 辨識'
    ],
    coreContentEn: [
      'Approx. 450g, double-wishbone independent suspension and high-strength metal chassis',
      'Powered by ESP32-S3-WROOM-1 (240MHz dual-core + AI vector instructions) and OV2640 camera',
      'Equipped with dual high-precision photoelectric encoders and 6-axis MPU6050 IMU',
      'Supports low-latency MJPEG Wi-Fi video streaming and web-based Computer Vision / Edge AI'
    ],
    orderWeight: 504,
    isPhysical: true,
    metadataType: 'product',
    hiddenFromCatalog: false,
    isDeprecated: false,
  },
  {
    id: 'crazyflie',
    courseId: 'crazyflie',
    docId: 'crazyflie',
    courseKey: 'product-crazyflie',
    title: 'Crazyflie 2.1+ 微型無人機開發平台',
    titleEn: 'Crazyflie 2.1+ Micro Drone Development Platform',
    summary: '僅重 29 克的開源微型四軸無人機，具備極高的機動性與強大的 Deck 擴充生態系。',
    summaryEn: 'Open-source micro quadcopter weighing only 29g, featuring high maneuverability and a powerful Deck expansion ecosystem.',
    lessonLabel: '硬體卡 03',
    lessonLabelEn: 'Hardware Card 03',
    icon: '🛸',
    tagText: '硬體',
    duration: '硬體',
    price: 0,
    category: 'prepare',
    learningPaths: ['tw-common', 'en-common'],
    imageUrl: 'assets/crazyflie.png',
    coreContent: [
      '重量僅 29 克，手掌大小的高機動性四軸無人機',
      'STM32F405 (168MHz M4) + nRF51822 協同處理器架構',
      '內建 BMI088 六軸 IMU 慣性感測器與 BMP388 氣壓計',
      '強大 Deck 擴充生態系，支援定位/避障/AI 模組免焊接即插即用'
    ],
    coreContentEn: [
      'Weighs only 29g, palm-sized highly maneuverable quadcopter',
      'STM32F405 (168MHz M4) + nRF51822 coprocessor architecture',
      'Built-in BMI088 6-axis IMU inertial sensor and BMP388 barometer',
      'Powerful Deck expansion ecosystem, supporting plug-and-play positioning/obstacle avoidance/AI decks without soldering'
    ],
    orderWeight: 505,
    isPhysical: true,
    metadataType: 'product',
    hiddenFromCatalog: false,
    isDeprecated: false,
  },
  {
    id: 'px4-x500-v2',
    courseId: 'px4-x500-v2',
    docId: 'px4-x500-v2',
    courseKey: 'product-px4-x500-v2',
    title: 'PX4 Development Kit - X500 V2',
    titleEn: 'PX4 Development Kit - X500 V2',
    summary: '整合 Pixhawk 6C 飛控、Holybro X500 V2 機架與 M9N GPS 的完整 PX4 無人機開發套件。',
    summaryEn: 'A complete PX4 drone development kit integrating Pixhawk 6C flight controller, Holybro X500 V2 frame, and M9N GPS.',
    lessonLabel: '硬體卡 04',
    lessonLabelEn: 'Hardware Card 04',
    icon: '🚁',
    tagText: '硬體',
    duration: '硬體',
    price: 0,
    category: 'prepare',
    learningPaths: ['tw-common', 'en-common'],
    imageUrl: 'assets/px4_x500_v2.png',
    coreContent: [
      '搭載 Pixhawk 6C 飛控 (STM32H753 480MHz) + IMU 三冗餘設計',
      'Holybro X500 V2 碳纖維機架，軸距 500mm，可負載 1kg+',
      '整合 Holybro M9N GPS + 電羅盤，支援 RTK 精準定位擴充',
      '相容 ROS 2、MAVSDK 與 QGroundControl 全開源生態系'
    ],
    coreContentEn: [
      'Pixhawk 6C flight controller (STM32H753 480MHz) with triple-redundant IMU',
      'Holybro X500 V2 carbon fiber frame, 500mm wheelbase, 1kg+ payload capacity',
      'Integrated Holybro M9N GPS + compass, expandable to RTK precision positioning',
      'Compatible with ROS 2, MAVSDK, and QGroundControl open-source ecosystem'
    ],
    orderWeight: 506,
    isPhysical: true,
    metadataType: 'product',
    hiddenFromCatalog: false,
    isDeprecated: false,
  },
];

const TEST_USER_UID = 'ZONzbNOyljRgSA11qKgnT4nJFRnv';
const TEST_USER_EMAIL = 'chen.yuiliang@gmail.com';

async function seed() {
  console.log('🌱 開始寫入種子資料到本地 Firestore 模擬器...\n');

  const normalizedCourses = courses.map((course) => attachLocalizedPricing(withEntryMetadata(course)));

  for (const data of normalizedCourses) {
    const { id, ...payload } = data;
    // Strip legacy pricing fields from metadata_lessons documents
    delete payload.price;
    delete payload.pricing;
    delete payload.prices;
    delete payload.priceByLocale;
    delete payload.priceByRegion;
    delete payload.priceMap;
    delete payload.price_twd;
    delete payload.price_usd;
    delete payload.currency;
    await db.collection('metadata_lessons').doc(id).set(payload);
    console.log(`  ✅ ${id} (courseId: ${payload.courseId})`);
  }

  // Seed default distributors
  const DEFAULT_DISTRIBUTORS = [
    {
      id: "default-twd",
      name: "預設台幣經銷商",
      defaultCurrency: "TWD",
      regions: ["tw"],
      locale: "zh-TW",
    },
    {
      id: "default-usd",
      name: "預設美金經銷商",
      defaultCurrency: "USD",
      regions: ["en"],
      locale: "en",
    },
  ];

  for (const dist of DEFAULT_DISTRIBUTORS) {
    await db.collection("distributors").doc(dist.id).set({
      name: dist.name,
      status: "ACTIVE",
      regions: dist.regions,
      defaultCurrency: dist.defaultCurrency,
      pricePolicyMode: "GUIDED",
      settlementMethod: "monthly_snapshot",
      locale: dist.locale,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`  🏢 Distributor Seeded: ${dist.id}`);
  }

  for (const c of normalizedCourses) {
    const docId = c.courseId || c.docId || c.id;
    if (!docId) continue;
    if (docId === 'crazyflie' || docId === 'crazyflie-2-1-plus') {
      continue;
    }

    let twPrice = 0;
    let usdPrice = 0;
    const cat = String(c.category || '').toLowerCase();
    if (cat === 'started') {
      twPrice = 1200;
      usdPrice = 40;
    } else if (cat === 'basic') {
      twPrice = 1500;
      usdPrice = 50;
    } else if (cat === 'advanced') {
      twPrice = 1800;
      usdPrice = 60;
    } else if (docId === 'esp32-c3') {
      twPrice = 2070;
      usdPrice = 69;
    } else if (docId === 'esp32-s3') {
      twPrice = 4170;
      usdPrice = 139;
    } else if (docId === 'px4-x500-v2') {
      twPrice = 23700;
      usdPrice = 789;
    }

    const buildPriceBookId = (distributorId, prodId) => {
      return `${distributorId}_${prodId}`
        .toLowerCase()
        .replace(/[^a-z0-9_-]/gi, '-');
    };

    const twBookId = buildPriceBookId('default-twd', docId);
    const usdBookId = buildPriceBookId('default-usd', docId);

    await Promise.all([
      db.collection('dealer_price_books').doc(twBookId).set({
        distributorId: 'default-twd',
        docId,
        sourceDocId: docId,
        currency: 'TWD',
        salePrice: twPrice,
        isActive: true,
        version: 'v1',
        updatedBy: 'seed-emulator',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
      db.collection('dealer_price_books').doc(usdBookId).set({
        distributorId: 'default-usd',
        docId,
        sourceDocId: docId,
        currency: 'USD',
        salePrice: usdPrice,
        isActive: true,
        version: 'v1',
        updatedBy: 'seed-emulator',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    ]);
  }
  console.log(`  🪙 Seeded default TWD & USD price books for all items.`);

  // Seed user document with defaults
  await db.collection('users').doc(TEST_USER_UID).set({
    email: TEST_USER_EMAIL,
    role: 'user',
    locale: 'zh-TW',
    region: 'TW',
    createdAt: admin.firestore.Timestamp.now(),
  }, { merge: true });
  console.log(`\n  👤 使用者 ${TEST_USER_EMAIL} (uid: ${TEST_USER_UID})`);

  // Seed the single canonical revenue share policy
  const policyId = "default-v1";
  const policy = {
    policyName: "Default Sharing Policy",
    tutorRate: 0.2,
    tutorUplineRate: 0.2,
    agentRate: 0.2,
    agentUplineRate: 0,
    courseDevRate: 0.2,
    courseDevUplineRate: 0.1,
    enabled: true
  };

  await db.collection('revenue_share_policies').doc(policyId).set({
    ...policy,
    policyId,
    updatedAt: admin.firestore.Timestamp.now(),
    createdAt: admin.firestore.Timestamp.now()
  });
  console.log(`  📋 Policy Seeded: ${policyId}`);

  // Keep older local datasets from accumulating extra policies when the seed reruns.
  const legacyPolicyIds = ["tw-direct-v1", "tw-agent-v1"];
  for (const legacyPolicyId of legacyPolicyIds) {
    await db.collection('revenue_share_policies').doc(legacyPolicyId).delete().catch(() => {});
  }

  // Seed orders for basic + advanced courses (using normalized courses for canonical keys)
  const paidCourses = normalizedCourses.filter(c => c.category === 'basic' || c.category === 'advanced');
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const items = {};
  for (const c of paidCourses) {
    items[c.courseId] = {
      title: c.title,
      price: c.price,
      currency: 'TWD',
      price_currency: 'TWD',
      price_twd: c.price,
      price_usd: deriveUsdFromTwd(c.price),
    };
  }

  await db.collection('orders').doc('seed-order-all-paid').set({
    uid: TEST_USER_UID,
    email: TEST_USER_EMAIL,
    status: 'SUCCESS',
    items,
    region: 'TW',
    channelType: 'direct',
    policyId: '',
    pricingVersion: 'v1',
    expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
    createdAt: admin.firestore.Timestamp.now(),
    paidAt: admin.firestore.Timestamp.now(),
  });
  console.log(`  🧾 訂單 seed-order-all-paid (${paidCourses.length} 門課程，到期 ${expiryDate.toLocaleDateString('zh-TW')})`);

  console.log(`\n✨ 完成！共寫入 ${courses.length} 筆課程資料`);
  console.log('📌 可在 http://127.0.0.1:4000/firestore 查看資料');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ 種子資料寫入失敗：', err);
  process.exit(1);
});
