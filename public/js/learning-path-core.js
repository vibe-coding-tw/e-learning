(function () {
    const REPO_UTILS = window.repoSlugUtils || {};
    const normalizeCanonicalLearningPathKey = REPO_UTILS.normalizeCanonicalLearningPathKey || function (value = "") {
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
    };

    function legacyPathKeyFromCanonical(value = "", uiLocale = "zh-TW") {
        const canonical = normalizeCanonicalLearningPathKey(value);
        if (!canonical) return "";
        const prefix = String(uiLocale || "").toLowerCase().startsWith("en") ? "en" : "tw";
        return `${prefix}-${canonical}`;
    }

    function pathKeyCandidates(value = "", uiLocale = "zh-TW") {
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

    function detectUiLocale() {
        try {
            const explicitLocale = String(window.__vibeLocale || "").trim();
            if (explicitLocale) {
                const clean = normalizeLocaleCode(explicitLocale);
                if (clean) return clean;
            }
        } catch (_) {}

        try {
            const params = new URLSearchParams(window.location.search);
            const path = params.get("path");
            if (path) {
                const cleanPath = String(path).trim().toLowerCase();
                if (cleanPath.startsWith("en-")) return "en";
                if (cleanPath.startsWith("tw-")) return "zh-TW";
            }
        } catch (_) {}

        try {
            const params = new URLSearchParams(window.location.search);
            const queryLang = params.get("lang") || params.get("locale");
            if (queryLang) {
                const clean = normalizeLocaleCode(queryLang);
                if (clean) return clean;
            }
        } catch (_) {}

        try {
            const stored = localStorage.getItem("vibe_user_locale");
            if (stored) {
                const clean = normalizeLocaleCode(stored);
                if (clean) return clean;
            }
        } catch (_) {}

        const htmlLang = String(document.documentElement?.lang || "").toLowerCase();
        const navLang = String(navigator.language || "").toLowerCase();
        const raw = htmlLang || navLang;
        if (raw.startsWith("zh")) return "zh-TW";
        if (raw) return normalizeLocaleCode(raw);
        return "en";
    }

    function normalizeCategoryKey(raw = "") {
        const v = String(raw || "").trim().toLowerCase();
        if (!v) return "";
        if (v === "common") return "common";
        if (/^(?:tw|en)-common$/i.test(v)) return "common";
        if (/^(?:tw|en)-car-(starter|basic|advanced)$/i.test(v)) return v.replace(/^(?:tw|en)-/i, "");
        if (/^(?:tw|en)-drone-(starter|basic|advanced)$/i.test(v)) return v.replace(/^(?:tw|en)-/i, "");
        if (/^car-(starter|basic|advanced)$/i.test(v)) return v;
        if (/^drone-(starter|basic|advanced)$/i.test(v)) return v;
        if (v === "started" || v === "start" || v === "starter") return "car-starter";
        if (v === "basic") return "car-basic";
        if (v === "advanced" || v === "adv") return "car-advanced";
        return "";
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

    function isPhysicalMetadataLesson(lesson = {}) {
        const metadataType = String(lesson?.metadataType || "").toLowerCase();
        return metadataType === "product";
    }

    function normalizeTrack(raw = "") {
        const v = String(raw || "").trim().toLowerCase();
        return v || "common";
    }

    function normalizeLevel(raw = "") {
        const v = String(raw || "").trim().toLowerCase();
        if (!v) return "common";
        if (v === "started" || v === "start") return "starter";
        if (v === "prepare") return "common";
        return v;
    }

    function categoryFromLesson(lesson = {}) {
        return normalizeCategoryKey(lesson.category || "");
    }

    function titleizeCategoryKey(path = "") {
        return String(path || "")
            .split("-")
            .filter(Boolean)
            .map((part) => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
    }

    function extractCategoryLabelText(value = "", uiLocale = "zh-TW") {
        const normalizedLocale = String(uiLocale || "").toLowerCase().startsWith("en") ? "en" : "zh-TW";
        const visited = new Set();
        const queue = [value];
        const preferredKeys = normalizedLocale === "en"
            ? ["en", "en-US", "en-GB", "labelEn", "enLabel", "titleEn", "nameEn", "textEn", "valueEn", "zh-TW", "zhTW", "zh", "tw", "label", "title", "name", "text", "value"]
            : ["zh-TW", "zhTW", "zh", "tw", "labelZh", "twLabel", "titleZh", "nameZh", "textZh", "valueZh", "en", "en-US", "en-GB", "label", "title", "name", "text", "value"];

        while (queue.length) {
            const current = queue.shift();
            if (current == null) continue;
            if (typeof current === "string" || typeof current === "number" || typeof current === "boolean") {
                const text = String(current).trim();
                if (text) return text;
                continue;
            }
            if (Array.isArray(current)) {
                current.forEach((item) => queue.push(item));
                continue;
            }
            if (typeof current !== "object") continue;
            if (visited.has(current)) continue;
            visited.add(current);

            for (const key of preferredKeys) {
                if (Object.prototype.hasOwnProperty.call(current, key)) {
                    queue.push(current[key]);
                }
            }
            for (const nested of Object.values(current)) {
                queue.push(nested);
            }
        }

        return "";
    }

    function normalizeCategoryLabelEntry(entry = {}) {
        if (typeof entry === "string") {
            const text = entry.trim();
            return text ? { "zh-TW": text, en: text } : {};
        }
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return {};
        const zh = String(entry["zh-TW"] || entry.zhTW || entry.zh || entry.tw || "").trim();
        const en = String(entry.en || entry["en-US"] || entry["en-GB"] || entry.enLabel || entry.labelEn || "").trim();
        return {
            "zh-TW": zh,
            en: en,
        };
    }

    function normalizeCategoryLabelsMap(sourceMap = {}) {
        const normalized = {};
        if (!sourceMap || typeof sourceMap !== "object" || Array.isArray(sourceMap)) return normalized;

        const assign = (key, value) => {
            const canonical = normalizeCanonicalLearningPathKey(key);
            if (!canonical) return;
            const label = normalizeCategoryLabelEntry(value);
            if (label) normalized[canonical] = label;
        };

        for (const [key, value] of Object.entries(sourceMap)) {
            assign(key, value);
        }

        return normalized;
    }

    function deriveCategoryLabels(lessons = [], existingMap = {}, uiLocale = "zh-TW") {
        const derived = normalizeCategoryLabelsMap(existingMap);
        (Array.isArray(lessons) ? lessons : []).forEach((lesson) => {
            const key = categoryFromLesson(lesson);
            if (!key || derived[key]) return;
            const label = pickCategoryLabelFromLesson(lesson, uiLocale);
            if (label) derived[key] = label;
        });
        return derived;
    }

    function categoryLabel(path = "", categoryLabelsMap = {}, uiLocale = detectUiLocale()) {
        const canonical = normalizeCanonicalLearningPathKey(path);
        const isEn = String(uiLocale || "").toLowerCase().startsWith("en");
        const normalizedMap = normalizeCategoryLabelsMap(categoryLabelsMap);
        const localizedLabel = normalizedMap[canonical || path];
        if (localizedLabel) {
            if (typeof localizedLabel === "string") return localizedLabel;
            return localizedLabel[isEn ? "en" : "zh-TW"] || "";
        }
        return "";
    }

    function formatPrice(priceEntry = {}, locale = "zh-TW") {
        const priceApi = window.vibePricing;
        if (priceApi && typeof priceApi.formatPrice === "function") {
            return priceApi.formatPrice(priceEntry, locale);
        }
        const amount = Number(priceEntry?.amount ?? priceEntry ?? 0);
        const currency = String(priceEntry?.currency || "").toUpperCase();
        if (!amount) return window.t('cart_price_free');
        if (!currency) {
            try {
                return new Intl.NumberFormat(String(locale || "").startsWith("en") ? "en-US" : "zh-TW").format(amount);
            } catch (_) {
                return amount.toLocaleString();
            }
        }
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

    function translateLessonLabel(label = "", uiLocale = "zh-TW") {
        const raw = String(label || "").trim();
        if (!raw) return "";
        if (!uiLocale.startsWith("en")) return raw;
        return raw
            .replace(/^課前準備/, "Preparation")
            .replace(/^入門/, "Starter")
            .replace(/^基礎/, "Basic")
            .replace(/^進階/, "Advanced")
            .replace(/^課程/, "Course")
            .replace(/\s+/g, " ")
            .trim();
    }

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

    function resolveLessonLabel(lesson = {}, uiLocale = "zh-TW") {
        const isEn = String(uiLocale || "").toLowerCase().startsWith("en");
        return String((isEn ? lesson.lessonLabelEn : lesson.lessonLabel) || lesson.lessonLabel || lesson.lessonLabelEn || "").trim();
    }

    function resolveLessonCardTitle(lesson = {}, uiLocale = "zh-TW") {
        const isEn = String(uiLocale || "").toLowerCase().startsWith("en");
        return String((isEn ? lesson.titleEn : lesson.title) || lesson.title || lesson.titleEn || "").trim();
    }

    function resolveLessonCardSummary(lesson = {}, uiLocale = "zh-TW") {
        const isEn = String(uiLocale || "").toLowerCase().startsWith("en");
        return String((isEn ? (lesson.summaryEn || lesson.descriptionEn) : (lesson.summary || lesson.description)) || lesson.summary || lesson.description || lesson.summaryEn || lesson.descriptionEn || "").trim();
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
        const rawTitle = String(lesson.title || "").trim();
        const englishInParens = rawTitle.match(/\(([^)]+)\)\s*$/);
        if (englishInParens && englishInParens[1]) return englishInParens[1].trim();
        return titleCaseFromSlug(key);
    }

    function normalizeLegacyUnitFilename(file = "") {
        const shared = window.dashboardLookupUtils?.normalizeLegacyCourseKey;
        if (shared) return shared(file);
        const v = String(file || "").trim();
        if (!v) return "";
        const bare = v.replace(/\.html$/i, '').replace(/^(?:tw|en)-/i, '').toLowerCase();
        if (/^start-\d{2}-unit-/i.test(bare)) return bare.replace(/^start-\d{2}-unit-/i, 'car-starter-');
        if (/^basic-\d{2}-unit-/i.test(bare)) return bare.replace(/^basic-\d{2}-unit-/i, 'car-basic-');
        if (/^(?:adv|advanced)-\d{2}-unit-/i.test(bare)) return bare.replace(/^(?:adv|advanced)-\d{2}-unit-/i, 'car-advanced-');
        if (/^\d{2}-(?:unit|lesson|master)-/i.test(bare)) return bare.replace(/^\d{2}-(?:unit|lesson|master)-/i, 'common-');
        if (/^prepare-\d+-(.+)$/i.test(bare)) return bare.replace(/^prepare-\d+-/, 'common-');
        if (/^prepare-/i.test(bare)) return bare.replace(/^prepare-/i, 'common-');
        return bare.replace(/-master-/i, '-unit-');
    }

    function resolveUnitFile(lesson = {}) {
        const pickFile = (value = "") => String(value || "").split("/").pop().split("?")[0];
        if (Array.isArray(lesson.courseUnits) && lesson.courseUnits.length > 0) {
            const file = pickFile(lesson.courseUnits[0]);
            if (file) return normalizeLegacyUnitFilename(file);
        }
        return "";
    }

    function resolveEntryUrl(lesson = {}, fallbackUrl = "") {
        if (Array.isArray(lesson.courseUnits) && lesson.courseUnits.length > 0) {
            const firstUnit = normalizeLegacyUnitFilename(String(lesson.courseUnits[0]));
            if (firstUnit) return `/courses/${firstUnit}`;
        }
        return fallbackUrl || "";
    }

    function pickImage(lesson = {}) {
        return lesson.cardImageUrl || lesson.imageUrl || lesson.thumbnailUrl || lesson.bannerUrl || "";
    }

    function pickVideo(lesson = {}) {
        if (lesson.videoId) return `https://www.youtube.com/embed/${lesson.videoId}?autoplay=1&enablejsapi=1`;
        if (lesson.videoUrl) return lesson.videoUrl;
        return "";
    }

    function lessonRenderKey(lesson = {}) {
        return normalizeCanonicalLearningPathKey(
            lesson.courseKey ||
            lesson.docId ||
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
            lesson.summary,
            lesson.lessonLabel,
            ...(Array.isArray(lesson.coreContent) ? lesson.coreContent : []),
        ];
        return values.map((value) => String(value || "")).join(" ").trim();
    }

    function lessonVariantScore(lesson = {}, uiLocale = "zh-TW") {
        let score = 0;

        if (Number.isFinite(Number(lesson.orderWeight))) {
            score -= Number(lesson.orderWeight) / 1000;
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
            .map((bucket) => bucket.slice().sort((a, b) => Number(a.orderWeight || 0) - Number(b.orderWeight || 0))[0])
            .filter(Boolean);
    }

    function isCatalogCourseLesson(lesson = {}) {
        const metadataType = String(lesson?.metadataType || "").toLowerCase();
        if (lesson?.hiddenFromCatalog === true) return false;
        return metadataType === "course" && (Array.isArray(lesson?.courseUnits) || String(lesson?.courseId || "").endsWith(".html"));
    }

    function buildLearningPathSections(lessons = [], pathKey = "", uiLocale = "zh-TW") {
        const normalizedPathKey = normalizeCanonicalLearningPathKey(pathKey);
        const isCommonPath = normalizedPathKey === "common";
        const matchingPathKeys = pathKeyCandidates(pathKey, uiLocale);
        const catalogLessons = Array.isArray(lessons) ? lessons : [];
        const productRows = dedupeLessonsForRender(
            catalogLessons.filter((lesson) => String(lesson?.metadataType || "").toLowerCase() === "product"),
            uiLocale
        )
            .filter((lesson) => matchingPathKeys.includes(categoryFromLesson(lesson)))
            .sort((a, b) => Number(a.orderWeight || 0) - Number(b.orderWeight || 0));

        const rows = dedupeLessonsForRender(
            catalogLessons
                .filter(isCatalogCourseLesson)
                .filter((lesson) => matchingPathKeys.includes(categoryFromLesson(lesson))),
            uiLocale
        ).sort((a, b) => Number(a.orderWeight || 0) - Number(b.orderWeight || 0));

        return {
            rows,
            productRows,
            hardwareRows: productRows,
            specsRows: [],
            isCommonPath,
            matchingPathKeys
        };
    }

    window.learningPathCore = {
        normalizeCanonicalLearningPathKey,
        legacyPathKeyFromCanonical,
        pathKeyCandidates,
        normalizeLocaleCode,
        detectUiLocale,
        normalizeCategoryKey,
        normalizeTrack,
        normalizeLevel,
        isPhysicalMetadataLesson,
        categoryFromLesson,
        translateLessonLabel,
        translateBulletItem,
        translateBulletList,
        resolveLessonLabel,
        resolveLessonCardTitle,
        resolveLessonCardSummary,
        normalizeCategoryLabelsMap,
        deriveCategoryLabels,
        categoryLabel,
        formatPrice,
        renderSection,
        normalizeCanonicalCourseKey,
        inferEnglishTitle,
        normalizeLegacyUnitFilename,
        resolveUnitFile,
        resolveEntryUrl,
        pickImage,
        pickVideo,
        lessonRenderKey,
        lessonVariantScore,
        dedupeLessonsForRender,
        isCatalogCourseLesson,
        buildLearningPathSections
    };
})();
