const LOCAL_DATA_URL = "./data/metadata_lessons.local.json";

const {
  normalizeCanonicalLearningPathKey: normalizeCanonicalLearningPathKeyFromUtils,
  legacyLearningPathKeyFromCanonical,
  learningPathKeyCandidatesFromValue
} = window.repoSlugUtils || {};

function detectUiLocale() {
  try {
    const params = new URLSearchParams(window.location.search);
    const path = params.get("path");
    if (path) {
      const cleanPath = String(path).trim().toLowerCase();
      if (cleanPath.startsWith("en-")) return "en";
      if (cleanPath.startsWith("tw-")) return "zh-TW";
    }
  } catch (_) {}

  const htmlLang = String(document.documentElement?.lang || "").toLowerCase();
  const navLang = String(navigator.language || "").toLowerCase();
  const raw = htmlLang || navLang;
  if (raw.startsWith("zh")) return "zh-TW";
  return "en";
}

function normalizeCanonicalLearningPathKey(value = "") {
  const fromUtils = typeof normalizeCanonicalLearningPathKeyFromUtils === "function"
    ? normalizeCanonicalLearningPathKeyFromUtils(value)
    : "";
  if (fromUtils) return fromUtils;
  const v = String(value || "").trim().toLowerCase().split("?")[0].split("#")[0].replace(/\.html$/i, "");
  if (!v) return "";
  if (v === "common" || v === "car-starter" || v === "car-basic" || v === "car-advanced") return v;
  if (/^(?:tw|en)-common$/i.test(v)) return "common";
  if (/^(?:tw|en)-car-(starter|basic|advanced)$/i.test(v)) return v.replace(/^(?:tw|en)-/i, "");
  if (/^start-\d{2}-unit-/i.test(v)) return "car-starter";
  if (/^basic-\d{2}-unit-/i.test(v)) return "car-basic";
  if (/^(?:adv|advanced)-\d{2}-unit-/i.test(v)) return "car-advanced";
  if (/^\d{2}-unit-/i.test(v)) return "common";
  if (/^prepare-\d+/i.test(v)) return "common";
  return v;
}

function legacyPathKeyFromCanonical(value = "", uiLocale = "zh-TW") {
  const canonical = normalizeCanonicalLearningPathKey(value);
  if (!canonical) return "";
  if (typeof legacyLearningPathKeyFromCanonical === "function") {
    return legacyLearningPathKeyFromCanonical(canonical, uiLocale);
  }
  const prefix = String(uiLocale || "").toLowerCase().startsWith("en") ? "en" : "tw";
  return `${prefix}-${canonical}`;
}

function pathKeyCandidates(value = "", uiLocale = "zh-TW") {
  if (typeof learningPathKeyCandidatesFromValue === "function") {
    return learningPathKeyCandidatesFromValue(value, uiLocale);
  }
  const canonical = normalizeCanonicalLearningPathKey(value);
  return [...new Set([
    String(value || "").trim(),
    canonical,
    legacyPathKeyFromCanonical(canonical, "zh-TW"),
    legacyPathKeyFromCanonical(canonical, "en")
  ].filter(Boolean))];
}

function normalizeLocaleCode(raw = "") {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "tw";
  if (v.startsWith("zh")) return "tw";
  return v.split(/[-_]/)[0] || "en";
}

function normalizeLevel(raw = "") {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "common";
  if (v === "started" || v === "start") return "starter";
  if (v === "prepare") return "common";
  return v;
}

function normalizeTrack(raw = "") {
  const v = String(raw || "").trim().toLowerCase();
  return v || "common";
}

function translateLessonLabel(label = "", uiLocale = "zh-TW") {
  const raw = String(label || "").trim();
  if (!raw) return "";
  if (!uiLocale.startsWith("en")) return raw;
  return raw
    .replace(/^準備課程/, "Preparation")
    .replace(/^入門/, "Starter")
    .replace(/^基礎/, "Basic")
    .replace(/^進階/, "Advanced")
    .replace(/^課程/, "Course")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseFromSlug(slug = "") {
  return String(slug || "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      const special = {
        ai: "AI",
        api: "API",
        ble: "BLE",
        css: "CSS",
        cv: "CV",
        fsm: "FSM",
        html: "HTML",
        http: "HTTP",
        io: "IO",
        iot: "IoT",
        js: "JS",
        json: "JSON",
        jsx: "JSX",
        pid: "PID",
        pwm: "PWM",
        s3: "S3",
        ui: "UI",
        ux: "UX",
        url: "URL",
        usb: "USB",
        wifi: "WiFi",
        ota: "OTA",
      };
      if (special[lower]) return special[lower];
      if (lower === "web") return "Web";
      if (lower === "dev") return "Dev";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ")
    .replace(/\bOf\b/g, "of")
    .replace(/\bAnd\b/g, "and")
    .replace(/\bTo\b/g, "to")
    .trim();
}

const EN_TITLE_OVERRIDES = {
  "common-developer-identity": "Developer Identity",
  "common-vscode-online": "VS Code Online",
  "common-vscode-setup": "Development Environment (VS Code Setup)",
  "common-agent-mode": "AI Agent Workflow",
  "common-vibe-coding": "Vibe Coding Practice",
  "common-web-agents": "Web-Based AI Agent Practice",
  "common-github-classroom": "GitHub Classroom & Vibe Coding Practice",
  "common-wifi-setup": "WiFi Configuration",
  "common-motor-ramping": "Motor Ramping Control",
  "car-starter-web-app": "Web App Fundamentals",
  "car-starter-web-ble": "Web BLE Integration",
  "car-starter-remote-control": "Remote Control Interface",
  "car-starter-touch-events": "Touch Event Handling",
  "car-starter-joystick-lab": "Joystick Lab",
  "basic-01-master-environment": "Development Environment Setup",
  "basic-02-master-ota-architecture": "OTA Update Architecture",
  "basic-03-master-io-mapping": "IO Pin Mapping",
  "basic-04-master-pwm-control": "PWM Motor Control",
  "basic-05-master-ble-gatt": "BLE GATT Protocol",
  "basic-06-master-http-web": "HTTP and Web Communication",
  "basic-07-master-wifi-modes": "WiFi Modes and Web Server",
  "basic-08-master-joystick-math": "Joystick Math Model",
  "basic-09-master-multitasking": "Multitasking",
  "basic-10-master-fsm": "Finite State Machines",
  "adv-01-master-s3-cam": "ESP32-S3 Camera",
  "adv-02-master-video": "Image Streaming",
  "adv-03-master-ble-advanced": "Advanced BLE Communication",
  "adv-04-master-sensors": "Sensor Integration",
  "adv-05-master-cv": "Computer Vision Basics",
  "adv-06-master-cv-advanced": "Advanced Computer Vision",
  "adv-07-master-ui-framework": "UI Framework Design",
  "adv-08-master-image-processing": "Image Processing Practice",
  "adv-09-master-ai-recognition": "AI Recognition Applications",
  "adv-10-master-diff-drive": "Differential Drive Control",
  "adv-11-master-photoelectric": "Photoelectric Sensors",
  "adv-12-master-pid": "PID Control",
  "adv-13-master-robustness": "System Robustness",
  "adv-14-master-debugging-art": "The Art of Debugging",
  "adv-15-master-architecture": "System Architecture Design",
  "spec-recommend-lite": "Computer Spec Recommendation (Basic)",
  "spec-recommend-pro": "Computer Spec Recommendation (Advanced)"
};

const EN_BULLET_TRANSLATIONS = {
  "GitHub 帳號建立": "Set up a GitHub account",
  "個人 Profile 設定": "Configure your personal profile",
  "SSH Key 設定": "Configure SSH keys",
  "GitHub Codespaces 啟用": "Enable GitHub Codespaces",
  "線上編輯器操作": "Use the online editor",
  "即開即用開發環境": "Use an instant-ready dev environment",
  "VS Code 安裝與設定": "Install and configure VS Code",
  "常用擴充套件": "Install common extensions",
  "Terminal 基本操作": "Learn basic Terminal operations",
  "Cursor Agent Mode": "Use Cursor Agent Mode",
  "AI 輔助程式開發": "AI-assisted programming",
  "提示工程基礎": "Prompt engineering basics",
  "Vibe Coding 方法論": "Vibe Coding methodology",
  "快速原型開發": "Rapid prototyping",
  "AI 驅動開發流程": "AI-driven development workflow",
  "ChatGPT / Claude 實務": "Practical use of ChatGPT / Claude",
  "網頁版 AI 工具比較": "Compare web-based AI tools",
  "提示工程進階技巧": "Advanced prompt engineering techniques",
  "GitHub Classroom 加入流程": "Join flow for GitHub Classroom",
  "作業繳交方式": "How to submit assignments",
  "自動評分系統": "Automated grading system",
  "ESP32 WiFi 連線設定": "ESP32 WiFi connection setup",
  "WiFi 診斷與重連": "WiFi diagnostics and reconnection",
  "網路狀態回傳": "Return network status",
  "馬達平滑啟停": "Smooth motor start and stop",
  "PWM 訊號調校": "Tune PWM signals",
  "防止電壓突波": "Prevent voltage spikes",
  "HTML5 基礎結構": "HTML5 basic structure",
  "Flexbox 版面佈局": "Flexbox layout",
  "UI/UX 設計標準": "UI/UX design standards",
  "BLE 非同步連線": "Asynchronous BLE connection",
  "BLE 安全機制": "BLE security mechanisms",
  "TypedArray 資料處理": "TypedArray data handling",
  "控制面板設計": "Control panel design",
  "JSON 資料交換": "JSON data exchange",
  "流程邏輯設計": "Workflow logic design",
  "觸控基礎事件": "Basic touch events",
  "preventDefault 應用": "Use preventDefault",
  "長按事件實作": "Implement long-press events",
  "Canvas 搖桿繪製": "Draw a joystick on Canvas",
  "搖桿數學運算": "Joystick math calculations",
  "觸控與滑鼠相容": "Touch and mouse compatibility",
  "驅動與連接埠": "Drivers and ports",
  "ESP32 架構概覽": "ESP32 architecture overview",
  "PlatformIO 設定": "PlatformIO setup",
  "OTA 更新原理": "OTA update principles",
  "OTA 安全機制": "OTA security mechanisms",
  "分區表設計": "Partition table design",
  "腳位配置圖": "Pin mapping diagram",
  "ADC 解析度": "ADC resolution",
  "上拉電阻與防彈跳": "Pull-up resistors and debouncing",
  "PWM 基礎原理": "PWM fundamentals",
  "LEDC 語法": "LEDC syntax",
  "H 橋電路驅動": "H-bridge driver circuit",
  "廣播與連線": "Advertising and connection",
  "BLE 特性值": "BLE characteristic values",
  "GATT 資料結構": "GATT data structure",
  "HTTP 請求": "HTTP requests",
  "Fetch API": "Fetch API",
  "CORS 安全機制": "CORS security",
  "WiFi AP/STA 模式": "WiFi AP/STA modes",
  "HTTP 生命週期": "HTTP lifecycle",
  "非同步 WebServer": "Asynchronous WebServer",
  "搖桿映射": "Joystick mapping",
  "響應曲線": "Response curves",
  "單輪車模型": "Unicycle model",
  "millis() 計時": "millis() timing",
  "硬體計時器": "Hardware timers",
  "取樣率設計": "Sampling rate design",
  "FSM 設計模式": "FSM design pattern",
  "狀態一致性": "State consistency",
  "UI 狀態設計": "UI state design",
  "S3 介面配置": "S3 interface layout",
  "MJPEG 串流": "MJPEG streaming",
  "JPEG 品質調校": "JPEG quality tuning",
  "影像串流實作": "Implement image streaming",
  "Canvas 影像處理": "Canvas image processing",
  "頻寬與 FPS 優化": "Bandwidth and FPS optimization",
  "MTU 協商": "MTU negotiation",
  "JSON 序列化": "JSON serialization",
  "I2C/SPI 通訊": "I2C/SPI communication",
  "JSON REST API": "JSON REST APIs",
  "濾波演算法": "Filtering algorithms",
  "重心誤差計算": "Centroid error calculation",
  "閉迴路控制": "Closed-loop control",
  "特徵提取": "Feature extraction",
  "HSV 色彩數學": "HSV color math",
  "閾值濾波": "Threshold filtering",
  "重心演算法": "Centroid algorithm",
  "前瞻追蹤": "Look-ahead tracking",
  "UI 框架架構": "UI framework architecture",
  "Chart Canvas 圖表": "Chart Canvas charts",
  "事件輪詢": "Event polling",
  "色彩空間": "Color spaces",
  "MobileNet-SSD 模型": "MobileNet-SSD model",
  "P 控制": "P control",
  "誤差計算": "Error calculation",
  "Teachable Machine": "Teachable Machine",
  "CNN 音訊辨識": "CNN audio recognition",
  "Web Speech API": "Web Speech API",
  "流程控制": "Flow control",
  "ICC 幾何模型": "ICC geometric model",
  "PWM 限制": "PWM limits",
  "API 設計": "API design",
  "感測器原理": "Sensor principles",
  "硬體中斷": "Hardware interrupts",
  "測速演算法": "Speed measurement algorithms",
  "穩健性設計": "Robustness design",
  "系統效能分析": "System performance analysis",
  "技術敘事": "Technical narrative",
  "除錯技巧": "Debugging techniques",
  "KPI 定義": "KPI definition",
  "重構方法論": "Refactoring methodology",
  "資料流設計": "Data flow design",
  "BLE 非同步架構": "Asynchronous BLE architecture",
  "影像 DMA": "Image DMA",
  "PID 模擬": "PID simulation",
  "Windows 10/11 或 macOS 13+": "Windows 10/11 or macOS 13+",
  "RAM 8GB": "8GB RAM",
  "可用儲存空間 20GB+": "20GB+ free storage",
  "穩定 Wi‑Fi 與 Chrome/Edge": "Stable Wi‑Fi and Chrome/Edge",
  "Windows 11 或 macOS 14+": "Windows 11 or macOS 14+",
  "RAM 16GB+": "16GB+ RAM",
  "可用儲存空間 50GB+": "50GB+ free storage",
  "建議搭配雙螢幕與外接鍵盤滑鼠": "Recommended: dual monitors plus external keyboard and mouse",
  "硬體設備推薦": "Recommended hardware kit",
  "無人車組件入門包": "Starter car kit components",
  "無人車組件進階包": "Advanced car kit components",
  "ESP32-C3 開發板": "ESP32-C3 dev board",
  "ESP32-S3 開發板": "ESP32-S3 dev board",
  "馬達與驅動板": "Motor and driver board"
};

function translateBulletItem(value = "", uiLocale = "zh-TW") {
  const raw = String(value || "").trim();
  if (!uiLocale.startsWith("en")) return raw;
  return EN_BULLET_TRANSLATIONS[raw] || raw;
}

function translateBulletList(items = [], uiLocale = "zh-TW") {
  return (Array.isArray(items) ? items : []).map((item) => translateBulletItem(item, uiLocale));
}

function inferEnglishTitle(lesson = {}) {
  const key = normalizeCanonicalCourseKey(
    lesson.courseKey ||
    lesson.courseId ||
    lesson.entryUnitId ||
    lesson.contentRef ||
    lesson.id ||
    ""
  );
  if (!key) return "";
  if (EN_TITLE_OVERRIDES[key]) return EN_TITLE_OVERRIDES[key];
  const rawTitle = String(lesson.title || "").trim();
  const englishInParens = rawTitle.match(/\(([^)]+)\)\s*$/);
  if (englishInParens && englishInParens[1]) return englishInParens[1].trim();
  return titleCaseFromSlug(key);
}

function normalizeCanonicalCourseKey(value = "") {
  const raw = String(value || "").trim().replace(/\.html$/i, "").replace(/^(?:tw|en)-/i, "").toLowerCase();
  if (!raw) return "";
  if (/^start-\d{2}-unit-/i.test(raw)) return raw.replace(/^start-\d{2}-unit-/i, "car-starter-");
  if (/^basic-\d{2}-unit-/i.test(raw)) return raw.replace(/^basic-\d{2}-unit-/i, "car-basic-");
  if (/^(?:adv|advanced)-\d{2}-unit-/i.test(raw)) return raw.replace(/^(?:adv|advanced)-\d{2}-unit-/i, "car-advanced-");
  if (/^\d{2}-unit-/i.test(raw)) return raw.replace(/^\d{2}-unit-/i, "common-");
  if (/^prepare-\d+-(.+)$/i.test(raw)) return raw.replace(/^prepare-\d+-/i, "common-");
  return raw;
}

function categoryFromLesson(lesson = {}) {
  const level = normalizeLevel(lesson.level || lesson.category || "");
  const track = normalizeTrack(lesson.track || "");
  if (level === "common") return "common";
  if (track && track !== "common") return `${track}-${level}`;
  return `car-${level}`;
}

function titleizeCategoryKey(path = "") {
  return String(path || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickCategoryLabelFromLesson(lesson = {}, uiLocale = "zh-TW") {
  const isZh = uiLocale.startsWith("zh");
  const candidates = [];
  if (isZh) {
    candidates.push(
      lesson.learningPathLabelZhTw,
      lesson.learningPathLabelZh,
      lesson.categoryLabelZhTw,
      lesson.categoryLabelZh,
      lesson.navLabelZhTw,
      lesson.navLabelZh
    );
  } else {
    candidates.push(
      lesson.learningPathLabelEn,
      lesson.categoryLabelEn,
      lesson.navLabelEn
    );
  }
  candidates.push(lesson.learningPathLabel, lesson.categoryLabel, lesson.navLabel);
  const hit = candidates.find((v) => typeof v === "string" && v.trim());
  return hit ? hit.trim() : "";
}

function deriveCategoryLabels(lessons = [], existingMap = {}, uiLocale = "zh-TW") {
  const derived = { ...(existingMap || {}) };
  (Array.isArray(lessons) ? lessons : []).forEach((lesson) => {
    const key = categoryFromLesson(lesson);
    if (!key || derived[key]) return;
    const label = pickCategoryLabelFromLesson(lesson, uiLocale);
    if (label) derived[key] = label;
  });
  return derived;
}

function categoryLabel(path = "", categoryLabelsMap = {}) {
  const uiLocale = detectUiLocale();
  const canonical = normalizeCanonicalLearningPathKey(path);
  const dict = uiLocale.startsWith("en")
    ? { common: "Preparation", "car-starter": "Starter Course", "car-basic": "Basic Course", "car-advanced": "Advanced Course" }
    : { common: "課前準備", "car-starter": "入門課程", "car-basic": "基礎課程", "car-advanced": "進階課程" };
  const localizedLegacy = legacyPathKeyFromCanonical(canonical || path, uiLocale);
  if (dict && dict[localizedLegacy]) return dict[localizedLegacy];
  if (dict && dict[canonical]) return dict[canonical];
  if (dict && dict[path]) return dict[path];
  return categoryLabelsMap[canonical || path] || titleizeCategoryKey(canonical || path);
}

function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalizeLegacyUnitFilename(file = "") {
  const v = String(file || "").trim();
  if (!v) return "";
  if (/^(?:tw|en)-(common|car-(starter|basic|advanced))-/i.test(v)) return v.replace(/^(?:tw|en)-/i, "");
  if (/^start-\d{2}-unit-/i.test(v)) return v.replace(/^start-\d{2}-unit-/i, "car-starter-");
  if (/^basic-\d{2}-unit-/i.test(v)) return v.replace(/^basic-\d{2}-unit-/i, "car-basic-");
  if (/^(?:adv|advanced)-\d{2}-unit-/i.test(v)) return v.replace(/^(?:adv|advanced)-\d{2}-unit-/i, "car-advanced-");
  if (/^\d{2}-unit-/i.test(v)) return v.replace(/^\d{2}-unit-/i, "common-");
  if (/^prepare-\d+-(.+)$/i.test(v)) return v.replace(/^prepare-\d+-/i, "common-");
  return v;
}

function resolveUnitFile(lesson = {}) {
  const pickFile = (value = "") => String(value || "").split("/").pop().split("?")[0];
  if (Array.isArray(lesson.courseUnits) && lesson.courseUnits.length > 0) {
    const file = pickFile(lesson.courseUnits[0]);
    if (file) return normalizeLegacyUnitFilename(file);
  }
  if (lesson.entryUnitId) {
    const file = pickFile(lesson.entryUnitId);
    if (file) return normalizeLegacyUnitFilename(file);
  }
  if (lesson.contentRef) {
    const file = pickFile(lesson.contentRef);
    if (file) return normalizeLegacyUnitFilename(file);
  }
  if (lesson.classroomUrl && /\.html(?:$|\?)/i.test(lesson.classroomUrl)) {
    const file = pickFile(lesson.classroomUrl);
    if (file) return normalizeLegacyUnitFilename(file);
  }
  return "";
}

function resolveEntryUrl(lesson = {}, fallbackUrl = "") {
  if (Array.isArray(lesson.courseUnits) && lesson.courseUnits.length > 0) {
    const firstUnit = normalizeLegacyUnitFilename(String(lesson.courseUnits[0]));
    if (firstUnit) return `/courses/${firstUnit}`;
  }
  const entryUnit = lesson.entryUnitId
    ? normalizeLegacyUnitFilename(String(lesson.entryUnitId))
    : "";
  if (entryUnit) return `/courses/${entryUnit}`;
  const unitFile = resolveUnitFile(lesson);
  if (unitFile) return `/courses/${unitFile}`;
  return lesson.classroomUrl || fallbackUrl || "";
}

function pickImage(lesson = {}) {
  return lesson.cardImageUrl || lesson.imageUrl || lesson.thumbnailUrl || lesson.bannerUrl || "";
}

function pickVideo(lesson = {}) {
  if (lesson.videoId) return `https://www.youtube.com/embed/${lesson.videoId}?autoplay=1&enablejsapi=1`;
  if (lesson.videoUrl) return lesson.videoUrl;
  return "";
}

function isCatalogCourseLesson(lesson = {}) {
  const metadataType = String(lesson?.metadataType || "").toLowerCase();
  if (lesson?.hiddenFromCatalog === true) return false;
  if (lesson?.isPhysical === true) return false;
  if (metadataType === "product" || metadataType === "legacy_product") return false;
  if (metadataType === "course") return true;
  return Array.isArray(lesson?.courseUnits) || String(lesson?.courseId || "").endsWith(".html");
}

function lessonRenderKey(lesson = {}) {
  return normalizeCanonicalCourseKey(
    lesson.courseKey ||
    lesson.productId ||
    lesson.courseId ||
    lesson.entryUnitId ||
    lesson.contentRef ||
    lesson.id ||
    ""
  );
}

function lessonTextBlob(lesson = {}) {
  const values = [
    lesson.title,
    lesson.titleEn,
    lesson.summary,
    lesson.summaryEn,
    lesson.description,
    lesson.descriptionEn,
    lesson.lessonLabel,
    lesson.lessonLabelEn,
    lesson.tagText,
    ...(Array.isArray(lesson.coreContent) ? lesson.coreContent : []),
    ...(Array.isArray(lesson.coreContentEn) ? lesson.coreContentEn : [])
  ];
  return values.map((value) => String(value || "")).join(" ").trim();
}

function lessonVariantScore(lesson = {}, uiLocale = "zh-TW") {
  const blob = lessonTextBlob(lesson);
  const rawLocale = String(lesson.locale || "").trim().toLowerCase();
  const explicitLocale = rawLocale ? normalizeLocaleCode(rawLocale) : "";
  const isZh = uiLocale.startsWith("zh");
  const hasHan = /[\u3400-\u4DBF\u4E00-\u9FFF]/.test(blob);
  const hasLatin = /[A-Za-z]/.test(blob);
  let score = 0;

  if (Number.isFinite(Number(lesson.orderWeight))) {
    score -= Number(lesson.orderWeight) / 1000;
  }
  if (isZh) {
    if (explicitLocale === "tw") score += 100;
    else if (explicitLocale === "en") score -= 50;
    if (hasHan) score += 20;
    if (hasLatin && !hasHan) score -= 5;
  } else {
    if (explicitLocale === "en") score += 100;
    else if (explicitLocale === "tw") score -= 50;
    if (hasLatin && !hasHan) score += 20;
    if (hasHan) score -= 5;
    if (lesson.titleEn) score += 1000;
    if (lesson.coreContentEn && lesson.coreContentEn.length > 0) score += 500;
    if (lesson.lessonLabelEn) score += 500;
  }
  return score;
}

function dedupeLessonsForRender(items = [], uiLocale = "zh-TW") {
  const groups = new Map();
  (Array.isArray(items) ? items : []).forEach((lesson) => {
    const key = lessonRenderKey(lesson);
    if (!key) return;
    const bucket = groups.get(key) || [];
    bucket.push(lesson);
    groups.set(key, bucket);
  });
  return [...groups.values()]
    .map((bucket) => bucket.slice().sort((a, b) => lessonVariantScore(b, uiLocale) - lessonVariantScore(a, uiLocale))[0])
    .filter(Boolean);
}

function formatPrice(priceEntry = {}, locale = "zh-TW") {
  const priceApi = window.vibePricing;
  if (priceApi && typeof priceApi.formatPrice === "function") {
    return priceApi.formatPrice(priceEntry, locale);
  }
  const amount = Number(priceEntry?.amount ?? priceEntry ?? 0);
  const currency = priceEntry?.currency || (String(locale || "").startsWith("en") ? "USD" : "TWD");
  if (!amount) return String(locale || "").startsWith("en") ? "Free" : "免費";
  return `${currency} ${amount.toLocaleString()}`;
}

function renderSection(title, html) {
  const titleHtml = title ? `<h2 class="text-2xl font-bold text-slate-800 mb-4">${title}</h2>` : "";
  return `
    <section class="mb-10">
      ${titleHtml}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-2">${html}</div>
    </section>
  `;
}

function renderLessons(lessons, pathKey, categoryLabelsMap = {}) {
  const uiLocale = detectUiLocale();
  const container = document.getElementById("lesson-container");
  const title = document.getElementById("page-title");
  const t = uiLocale.startsWith("en")
    ? {
        hardwareHeader: "Hardware Kits",
        specsHeader: "Computer Spec Recommendations",
        coreContentLabel: "Core Content:",
        freeLabel: "Free",
        emptyCategory: "No courses available in this category yet.",
      }
    : {
        hardwareHeader: "硬體設備",
        specsHeader: "電腦規格推薦",
        coreContentLabel: "核心內容：",
        freeLabel: "免費",
        emptyCategory: "目前此分類尚無課程。",
      };

  title.textContent = categoryLabel(pathKey, categoryLabelsMap);
  const catalogCourses = lessons.filter(isCatalogCourseLesson);
  const matchingPathKeys = pathKeyCandidates(pathKey, uiLocale);
  const isCommonPath = normalizeCanonicalLearningPathKey(pathKey) === "common";

  const rows = dedupeLessonsForRender(
    catalogCourses
      .filter((x) => matchingPathKeys.includes(categoryFromLesson(x)))
      .filter((x) => x.hiddenFromCatalog !== true),
    uiLocale
  ).sort((a, b) => Number(a.orderWeight || 0) - Number(b.orderWeight || 0));

  const hardwareRows = dedupeLessonsForRender(
    lessons.filter(
      (x) => x?.isPhysical === true &&
             x?.hiddenFromCatalog !== true &&
             Array.isArray(x?.learningPaths) &&
             matchingPathKeys.some((key) => x.learningPaths.includes(key))
    ),
    uiLocale
  ).sort((a, b) => Number(a.orderWeight || 0) - Number(b.orderWeight || 0));

  const specsRows = dedupeLessonsForRender(
    lessons.filter((x) => {
      if (x?.metadataType !== "spec") return false;
      const paths = Array.isArray(x?.learningPaths) ? x.learningPaths.map(String).filter(Boolean) : [];
      if (paths.some((key) => matchingPathKeys.includes(key))) return true;
      return !paths.length && String(x?.category || "").toLowerCase() === "prepare" && matchingPathKeys.some((key) => /^(tw|en)-common$/.test(key));
    }),
    uiLocale
  ).sort((a, b) => Number(a.orderWeight || 0) - Number(b.orderWeight || 0));

  if (!rows.length && !hardwareRows.length && !specsRows.length && !isCommonPath) {
    container.innerHTML = `<p class="text-center text-gray-500 w-full col-span-3 py-12">${t.emptyCategory}</p>`;
    return;
  }

  const courseHtml = rows.map((lesson) => {
    const entryUrl = resolveEntryUrl(lesson);
    const unitFile = resolveUnitFile(lesson);
    const isEn = uiLocale === "en";
    const displayTitle = String((isEn ? (lesson.titleEn || inferEnglishTitle(lesson) || lesson.title) : lesson.title) || lesson.courseId || "");
    const displayKey = String(lesson.courseKey || lesson.courseId || "");
    const contentList = translateBulletList(toList(isEn ? (lesson.coreContentEn || lesson.coreContent) : lesson.coreContent).slice(0, 4), uiLocale);
    const summary = String((isEn ? (lesson.summaryEn || lesson.summary || lesson.descriptionEn || lesson.description)
      : (lesson.summary || lesson.description)) || (isEn ? "Course content loaded locally." : "課程內容由本機資料載入。"));
    const duration = String(lesson.duration || lesson.estimatedDuration || "");
    const lessonLabel = String((isEn ? (lesson.lessonLabelEn || translateLessonLabel(lesson.lessonLabel || lesson.tagText, uiLocale) || lesson.tagText) : (lesson.lessonLabel || lesson.tagText)) || "").trim();
    const displayLessonLabel = lessonLabel || (isEn ? "Course Unit" : "課程單元");
    const icon = String(lesson.cardIcon || lesson.icon || "📘");
    const imageUrl = pickImage(lesson);
    const priceEntry = window.vibePricing?.resolveLessonPrice ? window.vibePricing.resolveLessonPrice(lesson, uiLocale) : { amount: Number(lesson.price || 0), currency: uiLocale === "en" ? "USD" : "TWD" };
    const price = Number(priceEntry.amount || 0);
    const priceCurrency = String(priceEntry.currency || "");
    const imageHtml = imageUrl
      ? `<div class="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 mb-3"><img src="${imageUrl}" alt="${displayTitle || "course"}" class="w-full h-40 object-cover"></div>`
      : "";
    const listHtml = contentList.length
      ? `<ul class="list-disc pl-5 space-y-1">${contentList.map((x) => `<li>${x}</li>`).join("")}</ul>`
      : `<p class="text-sm text-slate-500">${summary}</p>`;
    return `
      <div class="lesson-card bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition"
           data-course-id="${lesson.courseId || ""}"
           data-auth-page-id="${unitFile || lesson.courseId || ""}"
           data-course-name="${lesson.title || ""}"
           data-course-price="${price}"
           data-course-currency="${priceCurrency}"
           data-is-physical="${lesson.isPhysical === true}"
           data-classroom-url="${entryUrl}">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0 text-xs text-slate-500 truncate">${displayKey}</div>
          ${duration ? `<span class="flex-shrink-0 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">${duration}</span>` : ""}
        </div>
        <h2 class="text-xl font-bold text-slate-800 mb-2">${displayTitle || lesson.courseId || "Untitled Course"}</h2>
        <div class="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1 inline-block mb-3">${displayLessonLabel}</div>
        ${imageHtml}
        <div class="text-sm text-slate-700 mb-3"><span class="mr-2">${icon}</span>${summary}</div>
        <div class="text-sm text-slate-700 mb-4">
          <strong class="text-slate-900 block mb-1">${t.coreContentLabel}</strong>
          ${listHtml}
        </div>
        <div class="mt-4 pt-3 border-t border-slate-100 text-center">
          <span class="text-2xl font-bold text-blue-600">${price === 0 ? t.freeLabel : formatPrice(priceEntry, uiLocale)}</span>
        </div>
        ${entryUrl ? `<div class="mt-3"><a href="${entryUrl}" class="block w-full py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-center transition">查看內容</a></div>` : ""}
      </div>
    `;
  }).join("");

  const hardwareHtml = hardwareRows.map((lesson) => {
    const entryUrl = resolveEntryUrl(lesson);
    const unitFile = resolveUnitFile(lesson);
    const priceEntry = window.vibePricing?.resolveLessonPrice ? window.vibePricing.resolveLessonPrice(lesson, uiLocale) : { amount: Number(lesson.price || 0), currency: uiLocale === "en" ? "USD" : "TWD" };
    const price = Number(priceEntry.amount || 0);
    const priceCurrency = String(priceEntry.currency || "");
    const isEn = uiLocale === "en";
    const displayKey = String(lesson.courseKey || lesson.courseId || "");
    const hardwareId = String(lesson.courseId || "").toLowerCase();
    const imageUrl = pickImage(lesson);
    const summary = String(isEn ? (lesson.summaryEn || lesson.summary || lesson.descriptionEn || lesson.description)
      : (lesson.summary || lesson.description) || (uiLocale === "zh-TW" ? "硬體設備推薦" : "Hardware recommendations"));
    const displayTitle = String((isEn ? (lesson.titleEn || inferEnglishTitle(lesson) || lesson.title) : lesson.title) || (uiLocale === "zh-TW" ? "硬體設備" : "Hardware Kit"));
    const contentList = translateBulletList(toList(isEn ? (lesson.coreContentEn || lesson.coreContent) : lesson.coreContent).slice(0, 4), uiLocale);
    const listHtml = contentList.length
      ? `<ul class="list-disc pl-5 space-y-1">${contentList.map((x) => `<li>${x}</li>`).join("")}</ul>`
      : `<p class="text-sm text-slate-500">${summary}</p>`;
    const objectPos = hardwareId === "car-intro" ? "50% 50%" : (hardwareId === "car-advanced" ? "50% 28%" : "50% 50%");
    const objectScale = hardwareId === "car-advanced" ? "scale(1.08)" : (hardwareId === "car-intro" ? "scale(1.02)" : "scale(1)");
    const imageHtml = imageUrl
      ? `<div class="rounded-xl overflow-hidden border border-slate-200 bg-white mb-3 h-56"><img src="${imageUrl}" alt="${displayTitle}" class="w-full h-full object-cover" style="object-position:${objectPos}; transform:${objectScale};"></div>`
      : "";
    return `
      <div class="lesson-card bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition"
           data-course-id="${lesson.courseId || ""}"
           data-auth-page-id="${unitFile || lesson.courseId || ""}"
           data-course-name="${displayTitle}"
           data-course-price="${price}"
           data-course-currency="${priceCurrency}"
           data-is-physical="true"
           data-classroom-url="${entryUrl}">
        <div class="min-w-0 text-xs text-slate-500 mb-2 truncate">${displayKey}</div>
        <h3 class="text-xl font-bold text-slate-800 mb-2">${displayTitle}</h3>
        ${imageHtml}
        <div class="text-sm text-slate-700 mb-4">${listHtml}</div>
        <div class="mt-4 pt-3 border-t border-slate-100 text-center">
          <span class="text-2xl font-bold text-blue-600">${price === 0 ? t.freeLabel : formatPrice(priceEntry, uiLocale)}</span>
        </div>
        ${entryUrl ? `<div class="mt-3"><a href="${entryUrl}" class="block w-full py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-center transition">查看內容</a></div>` : ""}
      </div>
    `;
  }).join("");

  const specsHtml = specsRows.map((spec) => {
    const isEn = uiLocale === "en";
    const displayTitle = String(isEn ? (spec.titleEn || inferEnglishTitle(spec) || spec.title) : spec.title || "");
    const specImg = pickImage(spec);
    const specSummary = String(isEn ? (spec.summaryEn || spec.summary || spec.descriptionEn || spec.description) : (spec.summary || spec.description || ""));
    const specContentList = translateBulletList(toList(isEn ? (spec.coreContentEn || spec.coreContent) : spec.coreContent), uiLocale);
    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        ${specImg ? `<div class="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 mb-3"><img src="${specImg}" alt="${displayTitle}" class="w-full h-40 object-cover"></div>` : ""}
        <h3 class="text-xl font-bold text-slate-800 mb-2">${displayTitle}</h3>
        <p class="text-sm text-slate-600 mb-3">${specSummary}</p>
        <ul class="list-disc pl-5 space-y-1 text-sm text-slate-700">${specContentList.map((x) => `<li>${x}</li>`).join("")}</ul>
      </div>
    `;
  }).join("");

  let pageHtml = "";
  if (courseHtml) pageHtml += renderSection("", courseHtml);
  if (hardwareHtml) pageHtml += renderSection(t.hardwareHeader, hardwareHtml);
  if (specsHtml) pageHtml += renderSection(t.specsHeader, specsHtml);
  container.innerHTML = pageHtml || `<p class="text-center text-gray-500 py-12">${t.emptyCategory}</p>`;
}

async function loadLocalLessons() {
  const res = await fetch(LOCAL_DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load local lessons: ${res.status}`);
  return res.json();
}

async function initLocalLearningPath() {
  if (window.__learningPathLocalInitialized) return;
  window.__learningPathLocalInitialized = true;

  try {
    const uiLocale = detectUiLocale();
    const titleText = uiLocale.startsWith("en") ? "Learning Path" : "學習路徑";
    document.title = titleText;

    const params = new URLSearchParams(location.search);
    const pathKey = normalizeCanonicalLearningPathKey(params.get("path") || "common") || "common";
    const lessons = await loadLocalLessons();
    const categoryLabelsMap = deriveCategoryLabels(lessons, {}, uiLocale);
    renderLessons(lessons, pathKey, categoryLabelsMap);
  } catch (error) {
    console.error("[learning-path-local] failed to render local lessons", error);
  }
}

initLocalLearningPath();
setTimeout(initLocalLearningPath, 1200);
setTimeout(initLocalLearningPath, 3000);
