#!/usr/bin/env node
const admin = require("firebase-admin");
const PROJECT_ID = "e-learning-942f7";
if (!admin.apps.length) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:29099";
  admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();
const NOW = admin.firestore.FieldValue.serverTimestamp();

// ── Car Starter: 5 lessons × 3 units ──
const STARTER_LESSONS = [
  {
    key: "car-starter-web-app",
    idx: 1,
    label: "第 1 課",
    labelEn: "Lesson 1",
    zhTitle: "Web App 基礎結構",
    enTitle: "Web App Fundamentals",
    summary: "從 HTML5 語意標籤、Flexbox 排版到 UI/UX 設計原則，建立 Web App 開發的核心觀念。",
    summaryEn: "Build core Web App development concepts from HTML5 semantic markup, Flexbox layout to UI/UX design principles.",
    coreContent: ["HTML5 語意標籤與文件結構", "Flexbox 排版與響應式設計", "UI/UX 設計原則與實作"],
    coreContentEn: ["HTML5 semantic markup and document structure", "Flexbox layout and responsive design", "UI/UX design principles and practice"],
    units: ["car-starter-html5-basics.html", "car-starter-flexbox-layout.html", "car-starter-ui-ux-standards.html"],
    unitTitles: ["HTML5 基礎結構", "Flexbox 排版實戰", "UI/UX 設計標準"],
    unitTitlesEn: ["HTML5 Basics", "Flexbox Layout", "UI/UX Standards"]
  },
  {
    key: "car-starter-web-ble",
    idx: 2,
    label: "第 2 課",
    labelEn: "Lesson 2",
    zhTitle: "Web BLE 整合",
    enTitle: "Web BLE Integration",
    summary: "學習 Web Bluetooth API 的安全機制、非同步程式設計與 Typed Arrays 資料處理。",
    summaryEn: "Learn Web Bluetooth API security, async programming, and Typed Arrays data processing.",
    coreContent: ["Web BLE 安全機制與配對流程", "非同步程式設計與 Promise 鏈", "Typed Arrays 與二進位資料處理"],
    coreContentEn: ["Web BLE security and pairing flow", "Async programming and Promise chains", "Typed Arrays and binary data handling"],
    units: ["car-starter-ble-security.html", "car-starter-ble-async.html", "car-starter-typed-arrays.html"],
    unitTitles: ["BLE 安全機制", "BLE 非同步程式設計", "Typed Arrays 資料處理"],
    unitTitlesEn: ["BLE Security", "BLE Async Programming", "Typed Arrays"]
  },
  {
    key: "car-starter-remote-control",
    idx: 3,
    label: "第 3 課",
    labelEn: "Lesson 3",
    zhTitle: "遙控介面設計",
    enTitle: "Remote Control Interface",
    summary: "透過控制面板、JSON 資料格式與流程邏輯，建構完整的遙控操作介面。",
    summaryEn: "Build a complete remote control interface through control panel design, JSON data format, and flow logic.",
    coreContent: ["控制面板 UI 設計與佈局", "JSON 資料格式與序列化", "流程邏輯與狀態管理"],
    coreContentEn: ["Control panel UI design and layout", "JSON data format and serialization", "Flow logic and state management"],
    units: ["car-starter-control-panel.html", "car-starter-data-json.html", "car-starter-flow-logic.html"],
    unitTitles: ["控制面板設計", "JSON 資料格式", "流程邏輯實作"],
    unitTitlesEn: ["Control Panel", "Data JSON", "Flow Logic"]
  },
  {
    key: "car-starter-touch-events",
    idx: 4,
    label: "第 4 課",
    labelEn: "Lesson 4",
    zhTitle: "觸控事件處理",
    enTitle: "Touch Event Handling",
    summary: "深入觸控事件機制，包含長按手勢、預設行為阻擋與多點觸控處理。",
    summaryEn: "Deep dive into touch event handling including long-press gestures, default behavior prevention, and multi-touch.",
    coreContent: ["觸控事件基礎與 Touch API", "長按手勢辨識與實作", "preventDefault 與觸控最佳化"],
    coreContentEn: ["Touch event basics and Touch API", "Long-press gesture recognition", "preventDefault and touch optimization"],
    units: ["car-starter-touch-basics.html", "car-starter-long-press.html", "car-starter-prevent-default.html"],
    unitTitles: ["觸控事件基礎", "長按手勢辨識", "preventDefault 最佳化"],
    unitTitlesEn: ["Touch Basics", "Long Press", "Prevent Default"]
  },
  {
    key: "car-starter-joystick-lab",
    idx: 5,
    label: "第 5 課",
    labelEn: "Lesson 5",
    zhTitle: "搖桿實驗室",
    enTitle: "Joystick Lab",
    summary: "整合觸控與滑鼠事件，使用 Canvas 繪製搖桿並處理搖桿數學模型。",
    summaryEn: "Integrate touch and mouse events, draw joysticks with Canvas, and implement joystick math models.",
    coreContent: ["觸控 vs 滑鼠事件統一處理", "Canvas 搖桿繪製與互動", "搖桿數學模型與座標轉換"],
    coreContentEn: ["Touch vs mouse event unification", "Canvas joystick rendering and interaction", "Joystick math model and coordinate transformation"],
    units: ["car-starter-touch-vs-mouse.html", "car-starter-canvas-joystick.html", "car-starter-joystick-math.html"],
    unitTitles: ["觸控 vs 滑鼠事件", "Canvas 搖桿繪製", "搖桿數學模型"],
    unitTitlesEn: ["Touch vs Mouse", "Canvas Joystick", "Joystick Math"]
  }
];

// ── Car Basic: 10 lessons × 3 units ──
const BASIC_LESSON_UNITS = [
  ["car-basic-drivers-ports.html", "car-basic-platformio-setup.html", "car-basic-esp32-architecture.html"],
  ["car-basic-ota-principles.html", "car-basic-ota-security.html", "car-basic-partition-table.html"],
  ["car-basic-pinout.html", "car-basic-pullup-debounce.html", "car-basic-ledc-syntax.html"],
  ["car-basic-pwm-basics.html", "car-basic-h-bridge.html", "car-basic-unicycle-model.html"],
  ["car-basic-ble-properties.html", "car-basic-gatt-structure.html", "car-basic-advertising-connection.html"],
  ["car-basic-http-lifecycle.html", "car-basic-http-request.html", "car-basic-fetch-api.html"],
  ["car-basic-wifi-ap-sta.html", "car-basic-async-webserver.html", "car-basic-cors-security.html"],
  ["car-basic-joystick-mapping.html", "car-basic-response-curves.html", "car-basic-sampling-rate.html"],
  ["car-basic-millis.html", "car-basic-hardware-timer.html", "car-basic-state-consistency.html"],
  ["car-basic-fsm.html", "car-basic-ui-design.html", "car-basic-adc-resolution.html"]
];

const BASIC_EN_TITLES = [
  "Development Environment Setup",
  "OTA Update Architecture",
  "IO Pin Mapping",
  "PWM Motor Control",
  "BLE GATT Protocol",
  "HTTP and Web Communication",
  "WiFi Modes and Web Server",
  "Joystick Math Model",
  "Multitasking",
  "Finite State Machines"
];

const BASIC_ZH_TITLES = [
  "開發環境建置",
  "OTA 更新架構",
  "IO 腳位對映",
  "PWM 馬達控制",
  "BLE GATT 協定",
  "HTTP 與 Web 通訊",
  "WiFi 模式與網頁伺服器",
  "搖桿數學模型",
  "多工處理",
  "有限狀態機"
];

// ── Car Advanced: units grouped into 15 lessons ──
const ADV_UNIT_FILES = [
  "car-advanced-s3-interfaces.html", "car-advanced-image-dma.html", "car-advanced-color-spaces.html", "car-advanced-jpeg-quality.html",
  "car-advanced-mjpeg-stream.html", "car-advanced-video-streaming.html", "car-advanced-bandwidth-fps.html", "car-advanced-canvas-image.html",
  "car-advanced-ble-mtu.html", "car-advanced-ble-notify.html", "car-advanced-ble-async.html",
  "car-advanced-sensor-principles.html", "car-advanced-i2c-spi.html", "car-advanced-hardware-interrupts.html", "car-advanced-system-perf.html",
  "car-advanced-mobilenet-ssd.html", "car-advanced-teachable-machine.html", "car-advanced-feature-extraction.html", "car-advanced-cnn-audio.html",
  "car-advanced-threshold-filter.html", "car-advanced-filter-algorithms.html", "car-advanced-centroid-algorithm.html", "car-advanced-centroid-error.html",
  "car-advanced-ui-framework.html", "car-advanced-chart-canvas.html", "car-advanced-webspeech-api.html",
  "car-advanced-icc-geometry.html", "car-advanced-hsv-math.html", "car-advanced-speed-algorithms.html",
  "car-advanced-json-parsing.html", "car-advanced-json-rest.html", "car-advanced-json-serialization.html",
  "car-advanced-p-control.html", "car-advanced-pid-math.html", "car-advanced-pid-simulation.html", "car-advanced-pid-control.html",
  "car-advanced-closed-loop.html", "car-advanced-error-calculation.html", "car-advanced-look-ahead.html",
  "car-advanced-pwm-limits.html", "car-advanced-robustness.html", "car-advanced-kpi-definition.html",
  "car-advanced-debugging-art.html", "car-advanced-code-logic.html", "car-advanced-refactoring.html",
  "car-advanced-technical-narrative.html", "car-advanced-data-flow.html", "car-advanced-api-design.html",
  "car-advanced-flow-control.html", "car-advanced-event-polling.html"
];

const ADV_EN_TITLES = [
  "ESP32-S3 Camera", "Image Streaming", "Advanced BLE Communication",
  "Sensor Integration", "Computer Vision Basics", "Advanced Computer Vision",
  "UI Framework Design", "Image Processing Practice", "AI Recognition Applications",
  "Differential Drive Control", "Photoelectric Sensors", "PID Control",
  "System Robustness", "The Art of Debugging", "System Architecture Design"
];

const ADV_ZH_TITLES = [
  "ESP32-S3 相機", "影像串流", "進階 BLE 通訊",
  "感測器整合", "電腦視覺基礎", "進階電腦視覺",
  "UI 框架設計", "影像處理實作", "AI 辨識應用",
  "差速驅動控制", "光電感測器", "PID 控制",
  "系統穩健性", "除錯的藝術", "系統架構設計"
];

function groupUnits(files, counts) {
  const groups = [];
  let i = 0;
  for (const count of counts) {
    groups.push(files.slice(i, i + count));
    i += count;
  }
  return groups;
}

const ADV_LESSON_UNITS = groupUnits(ADV_UNIT_FILES, [4, 4, 3, 4, 4, 3, 3, 4, 3, 3, 4, 3, 3, 3, 3]);

function buildLessonDoc(id, data) {
  const { idx, category, level, track, label, labelEn, zhTitle, enTitle, summary, summaryEn, coreContent, coreContentEn, units, unitTitles, unitTitlesEn } = data;
  return {
    id, docId: id,
    metadataType: "lesson",
    category, level, track,
    orderWeight: idx,
    lessonIndex: idx,
    lessonLabel: label,
    lessonLabelEn: labelEn,
    title: zhTitle,
    titleEn: enTitle,
    courseUnits: units,
    course_unit_titles: unitTitles,
    courseUnitTitles: unitTitles,
    i18n: {
      "zh-TW": { title: zhTitle, summary, coreContent: coreContent || [] },
      en: { title: enTitle, summary: summaryEn, coreContent: coreContentEn || [] }
    },
    hiddenFromCatalog: true,
    createdAt: NOW, updatedAt: NOW, updatedBy: "seed_all_courses"
  };
}

function buildSimpleLessonDoc(id, idx, category, level, track, zhTitle, enTitle, units, unitTitles, unitTitlesEn) {
  return {
    id, docId: id,
    metadataType: "lesson",
    category, level, track,
    orderWeight: idx,
    lessonIndex: idx,
    lessonLabel: `第 ${idx} 課`,
    lessonLabelEn: `Lesson ${idx}`,
    title: zhTitle,
    titleEn: enTitle,
    courseUnits: units,
    course_unit_titles: unitTitles,
    courseUnitTitles: unitTitles,
    i18n: {
      "zh-TW": { title: zhTitle, summary: "", coreContent: [] },
      en: { title: enTitle, summary: "", coreContent: [] }
    },
    hiddenFromCatalog: true,
    createdAt: NOW, updatedAt: NOW, updatedBy: "seed_all_courses"
  };
}

function buildCourseDoc(id, category, level, track, zhTitle, enTitle, allUnits) {
  return {
    id, docId: id,
    metadataType: "course",
    category, level, track,
    orderWeight: 1,
    title: zhTitle,
    titleEn: enTitle,
    courseUnits: allUnits,
    i18n: {
      "zh-TW": { title: zhTitle, summary: "" },
      en: { title: enTitle, summary: "" }
    },
    hiddenFromCatalog: false,
    isDeprecated: false,
    createdAt: NOW, updatedAt: NOW, updatedBy: "seed_all_courses"
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!apply) {
    console.log("[dry-run] Pass --apply to actually write");
    return;
  }

  let totalWrites = 0;
  const run = async (label, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${label}`);
    } catch (e) {
      console.error(`  ✗ ${label}: ${e.message}`);
    }
  };

  // Car Starter
  const starterAllUnits = STARTER_LESSONS.flatMap(l => l.units);
  await run("Car Starter course doc", async () => {
    await db.collection("metadata_lessons").doc("car-starter.html").set(buildCourseDoc("car-starter.html", "car-starter", "starter", "car", "無人車入門課程", "Car Starter Course", starterAllUnits), { merge: true });
    totalWrites++;
  });
  for (const lesson of STARTER_LESSONS) {
    const id = `car-starter-${lesson.key}`;
    await run(`Car Starter lesson ${lesson.idx}`, async () => {
      await db.collection("metadata_lessons").doc(id).set(buildLessonDoc(id, { ...lesson, category: "car-starter", level: "starter", track: "car" }), { merge: true });
      totalWrites++;
    });
  }

  // Car Basic
  const basicAllUnits = BASIC_LESSON_UNITS.flat();
  await run("Car Basic course doc", async () => {
    await db.collection("metadata_lessons").doc("car-basic.html").set(buildCourseDoc("car-basic.html", "car-basic", "basic", "car", "無人車基礎課程", "Car Basic Course", basicAllUnits), { merge: true });
    totalWrites++;
  });
  for (let i = 0; i < BASIC_LESSON_UNITS.length; i++) {
    const idx = i + 1;
    const id = `basic-${String(idx).padStart(2, "0")}-master-environment`;
    await run(`Car Basic lesson ${idx}`, async () => {
      await db.collection("metadata_lessons").doc(id).set(buildSimpleLessonDoc(id, idx, "car-basic", "basic", "car", BASIC_ZH_TITLES[i], BASIC_EN_TITLES[i], BASIC_LESSON_UNITS[i], [], []), { merge: true });
      totalWrites++;
    });
  }

  // Car Advanced
  const advAllUnits = ADV_LESSON_UNITS.flat();
  await run("Car Advanced course doc", async () => {
    await db.collection("metadata_lessons").doc("car-advanced.html").set(buildCourseDoc("car-advanced.html", "car-advanced", "advanced", "car", "無人車進階課程", "Car Advanced Course", advAllUnits), { merge: true });
    totalWrites++;
  });
  for (let i = 0; i < ADV_LESSON_UNITS.length; i++) {
    const idx = i + 1;
    const id = `adv-${String(idx).padStart(2, "0")}-master-${ADV_EN_TITLES[i].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}`;
    await run(`Car Advanced lesson ${idx}`, async () => {
      await db.collection("metadata_lessons").doc(id).set(buildSimpleLessonDoc(id, idx, "car-advanced", "advanced", "car", ADV_ZH_TITLES[i], ADV_EN_TITLES[i], ADV_LESSON_UNITS[i], [], []), { merge: true });
      totalWrites++;
    });
  }

  console.log(`\n✅ Done! ${totalWrites} documents written to metadata_lessons`);
}

main().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
