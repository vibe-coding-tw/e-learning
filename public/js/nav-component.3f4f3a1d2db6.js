import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
import { firebaseConfig, connectFirebaseEmulators, isLocalDev } from "./firebase-local.js?v=3";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-east1");
connectFirebaseEmulators({ auth, db, functions });

const NAV_STATE_VERSION = "2026.05.13.FINAL_V9";
const GOOGLE_LOGIN_IN_PROGRESS_KEY = "vc_google_login_in_progress";

async function consumeGoogleRedirectResult() {
    try {
        await getRedirectResult(auth);
    } catch (error) {
        console.error("[NavComp] Google redirect login failed:", error);
        sessionStorage.removeItem(GOOGLE_LOGIN_IN_PROGRESS_KEY);
        alert(window.t ? window.t("alert_login_failed", "Google 登入失敗，請再試一次。") : "Google 登入失敗，請再試一次。");
    }
}

async function startGoogleLogin() {
    const provider = new GoogleAuthProvider();
    try {
        // Try popup login first in all environments. This is much more reliable
        // on custom domains under modern browser privacy restrictions (blocking third-party cookies).
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.warn("[NavComp] Google popup login failed or blocked, trying redirect...", error);
        try {
            sessionStorage.setItem(GOOGLE_LOGIN_IN_PROGRESS_KEY, "1");
            await signInWithRedirect(auth, provider);
        } catch (redirectError) {
            console.error("[NavComp] Google redirect login failed:", redirectError);
            sessionStorage.removeItem(GOOGLE_LOGIN_IN_PROGRESS_KEY);
            alert(window.t ? window.t("alert_login_failed_blocked", "Google 登入失敗，請稍後再試。\n若瀏覽器阻擋彈窗或重新導向，請直接按右上角登入按鈕再試一次。") : "Google 登入失敗，請稍後再試。\n若瀏覽器阻擋彈窗或重新導向，請直接按右上角登入按鈕再試一次。");
        }
    }
}
const LEARNING_PATH_CACHE_KEY = "vibe_learning_path_menu_cache_v9";
const LEARNING_PATH_CACHE_TTL_MS = 1000 * 60 * 30;

const DEFAULT_LEARNING_PATHS = [
    { key: "common", href: "learning-path.html?path=common", icon: "fa-book-open" },
    { key: "car-starter", href: "learning-path.html?path=car-starter", icon: "fa-rocket" },
    { key: "car-basic", href: "learning-path.html?path=car-basic", icon: "fa-code" },
    { key: "car-advanced", href: "learning-path.html?path=car-advanced", icon: "fa-microchip" }
];

const REPO_UTILS = window.repoSlugUtils || {};
const normalizeCanonicalLearningPathKey = REPO_UTILS.normalizeCanonicalLearningPathKey || function (value = "") {
    const v = String(value || "").trim().toLowerCase().split('/').pop().split('?')[0].split('#')[0].replace(/\.html$/i, '');
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
const legacyLearningPathKeyFromCanonical = REPO_UTILS.legacyLearningPathKeyFromCanonical || function (value = "", locale = "zh-TW") {
    const canonical = normalizeCanonicalLearningPathKey(value);
    if (!canonical) return "";
    const prefix = String(locale || "").toLowerCase().startsWith("en") ? "en" : "tw";
    return `${prefix}-${canonical}`;
};
const pathKeyCandidatesFromValue = REPO_UTILS.learningPathKeyCandidatesFromValue || function (value = "", locale = "") {
    const canonical = normalizeCanonicalLearningPathKey(value);
    return [...new Set([String(value || "").trim(), canonical, legacyLearningPathKeyFromCanonical(canonical, "zh-TW"), legacyLearningPathKeyFromCanonical(canonical, "en"), locale ? legacyLearningPathKeyFromCanonical(value, locale) : ""].filter(Boolean))];
};

const normalizeRuntimeLocaleCode = window.__vibeNormalizeLocaleCode || function (value = "") {
    return String(value || "").trim().replace(/_/g, "-");
};

function getRuntimeContentConfig() {
    const runtime = window.__vibeContentRuntimeConfig && typeof window.__vibeContentRuntimeConfig === "object"
        ? window.__vibeContentRuntimeConfig
        : {};
    const defaults = {
        defaultLocale: "en",
        supportedLocales: ["zh-TW", "en"],
        localeLabels: { "zh-TW": "繁體中文", "en": "English" },
        localeFallbackMap: { "zh-TW": "zh-TW", "en": "en" }
    };
    return {
        ...defaults,
        ...runtime,
        supportedLocales: Array.isArray(runtime.supportedLocales) && runtime.supportedLocales.length
            ? runtime.supportedLocales.map((locale) => normalizeRuntimeLocaleCode(locale)).filter(Boolean)
            : defaults.supportedLocales,
        localeLabels: {
            ...defaults.localeLabels,
            ...(runtime.localeLabels && typeof runtime.localeLabels === "object" ? runtime.localeLabels : {})
        },
        localeFallbackMap: {
            ...defaults.localeFallbackMap,
            ...(runtime.localeFallbackMap && typeof runtime.localeFallbackMap === "object" ? runtime.localeFallbackMap : {})
        }
    };
}

function getLocaleOptions() {
    const runtime = getRuntimeContentConfig();
    const active = new Set(runtime.supportedLocales.length ? runtime.supportedLocales : ["zh-TW", "en"]);
    if (runtime.defaultLocale) active.add(normalizeRuntimeLocaleCode(runtime.defaultLocale));
    return Array.from(active).map((locale) => {
        const normalized = normalizeRuntimeLocaleCode(locale);
        const label = runtime.localeLabels[normalized]
            || (normalized.startsWith("zh") ? "繁體中文" : normalized.startsWith("en") ? "English" : normalized);
        return { locale: normalized, label };
    }).filter((item) => item.locale);
}

function isZhLikeLocale(locale = "") {
    const clean = normalizeRuntimeLocaleCode(locale).toLowerCase();
    return clean.startsWith("zh") || clean === "tw" || clean.startsWith("tw-");
}

function isPhysicalMetadataLesson(lesson = {}) {
    const metadataType = String(lesson?.metadataType || "").toLowerCase();
    return metadataType === "product" || metadataType === "legacy_product";
}

async function ensureContentRuntimeConfig() {
    if (window.__vibeContentRuntimeConfig && typeof window.__vibeContentRuntimeConfig === "object" && Array.isArray(window.__vibeContentRuntimeConfig.supportedLocales)) {
        return window.__vibeContentRuntimeConfig;
    }
    if (window.__vibeContentRuntimeConfigPromise) return window.__vibeContentRuntimeConfigPromise;
    const load = async () => {
        try {
            const callable = httpsCallable(functions, "getContentRuntimeConfig");
            const response = await callable({});
            const config = response?.data || response || {};
            window.__vibeContentRuntimeConfig = config && typeof config === "object" ? config : {};
            return window.__vibeContentRuntimeConfig;
        } catch (error) {
            console.warn("[NavComp] Failed to load content runtime config:", error);
            window.__vibeContentRuntimeConfig = window.__vibeContentRuntimeConfig || {};
            return window.__vibeContentRuntimeConfig;
        }
    };
    window.__vibeContentRuntimeConfigPromise = load();
    return window.__vibeContentRuntimeConfigPromise;
}

function canonicalLearningPathHref(pathKey = "") {
    const canonical = normalizeCanonicalLearningPathKey(pathKey);
    if (!canonical) return "learning-path.html?path=common";
    return `learning-path.html?path=${encodeURIComponent(canonical)}`;
}

function resolveMenuLabel(value = "", fallback = "", uiLocale = "zh-TW") {
    const text = extractCategoryLabelText(value, uiLocale) || extractCategoryLabelText(value, "zh-TW") || extractCategoryLabelText(value, "en");
    return String(text || fallback || "").trim();
}

function resolveLearningPathLabel(pathKey = "", uiLocale = "zh-TW", categoryLabelsMap = {}) {
    const canonical = normalizeCanonicalLearningPathKey(pathKey);
    const normalizedMap = normalizeCategoryLabelsMap(categoryLabelsMap, uiLocale);
    const labelEntry = normalizedMap[canonical || pathKey];
    if (labelEntry) {
        return resolveMenuLabel(labelEntry, getCategoryLabel(canonical || pathKey, uiLocale), uiLocale);
    }
    return getCategoryLabel(canonical || pathKey, uiLocale);
}

window.__vibeResolveLearningPathLabel = resolveLearningPathLabel;

function getDefaultLearningPaths(uiLocale = "zh-TW", categoryLabels = {}) {
    return [
        { key: "common", href: canonicalLearningPathHref("common"), icon: "fa-book-open", label: resolveLearningPathLabel("common", uiLocale, categoryLabels) },
        { key: "car-starter", href: canonicalLearningPathHref("car-starter"), icon: "fa-rocket", label: resolveLearningPathLabel("car-starter", uiLocale, categoryLabels) },
        { key: "car-basic", href: canonicalLearningPathHref("car-basic"), icon: "fa-code", label: resolveLearningPathLabel("car-basic", uiLocale, categoryLabels) },
        { key: "car-advanced", href: canonicalLearningPathHref("car-advanced"), icon: "fa-microchip", label: resolveLearningPathLabel("car-advanced", uiLocale, categoryLabels) }
    ];
}

function getLearningPathCacheKey(uiLocale = "zh-TW", version = "") {
    return `${LEARNING_PATH_CACHE_KEY}_${uiLocale}_${String(version || "default").trim() || "default"}`;
}

async function loadLearningPathSettings(uiLocale = "zh-TW") {
    try {
        const snap = await getDoc(doc(db, "metadata_settings", "learning_paths"));
        const data = snap.exists() ? (snap.data() || {}) : {};
        const categoryLabels = normalizeCategoryLabelsMap(data.categoryLabels || {}, uiLocale);
        const version = data.schemaVersion || data.updatedAt?.toMillis?.() || data.updatedAt?.seconds || "";
        return { categoryLabels, version };
    } catch (error) {
        console.warn("[NavComp] Failed to load metadata_settings/learning_paths:", error);
        return { categoryLabels: {}, version: "" };
    }
}

const LOCALIZED_SITE_PAGES = {
    students: {
        zh: { href: "/tw/students.html", label: "學員指南" },
        en: { href: "/en/students.html", label: "Student Guide" },
    },
    tutors: {
        zh: { href: "/tw/tutors.html", label: "導師合作" },
        en: { href: "/en/tutors.html", label: "Tutor Collaboration" },
    },
};

function localeBucket(locale = "") {
    return isZhLocale(locale) ? "zh" : "en";
}

function resolveLocalizedSitePageMeta(pageKey = "", locale = "zh-TW") {
    const page = LOCALIZED_SITE_PAGES[pageKey];
    if (!page) return null;
    const bucket = localeBucket(locale);
    return page[bucket] || page.en || page.zh || null;
}

function hydrateLocalizedSitePages(rootNode, locale = "zh-TW") {
    const scope = rootNode && typeof rootNode.querySelectorAll === "function" ? rootNode : document;
    const elements = scope.querySelectorAll("[data-localized-page]");
    if (!elements.length) return;

    elements.forEach((el) => {
        const pageKey = el.getAttribute("data-localized-page");
        const meta = resolveLocalizedSitePageMeta(pageKey, locale);
        if (!meta) return;

        if (el.tagName === "A") {
            el.setAttribute("href", meta.href);
        }

        const labelNode = el.querySelector("[data-localized-label]");
        if (labelNode) {
            labelNode.textContent = meta.label;
        } else if (el.dataset.localizedLabel !== undefined || pageKey) {
            const textOnly = Array.from(el.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
            if (textOnly.length) {
                textOnly[textOnly.length - 1].textContent = meta.label;
            }
        }
    });
}

window.__vibeResolveLocalizedSitePageMeta = resolveLocalizedSitePageMeta;
window.__vibeHydrateLocalizedSitePages = hydrateLocalizedSitePages;

function detectUiLocale() {
    if (typeof window.detectUiLocale === 'function') return window.detectUiLocale();

    try {
        const pathname = window.location.pathname;
        if (pathname.includes('/en/')) return 'en';
        if (pathname.includes('/tw/') || pathname.includes('/zh-TW/')) return 'zh-TW';
        const filename = pathname.split('/').pop() || '';
        if (filename.startsWith('en-')) return 'en';
        if (filename.startsWith('tw-')) return 'zh-TW';
    } catch (_) {}

    try {
        const params = new URLSearchParams(window.location.search);
        const path = params.get('path');
        if (path) {
            const cleanPath = String(path).trim().toLowerCase();
            if (cleanPath.startsWith('en-')) return 'en';
            if (cleanPath.startsWith('tw-')) return 'zh-TW';
        }
    } catch (_) {}

    try {
        const params = new URLSearchParams(window.location.search);
        const queryLang = params.get('lang') || params.get('locale');
        if (queryLang) {
            const clean = String(queryLang).trim().toLowerCase();
            if (clean.startsWith('zh')) return 'zh-TW';
            if (clean.startsWith('en')) return 'en';
        }
    } catch (_) {}

    try {
        const stored = localStorage.getItem('vibe_user_locale');
        if (stored) {
            const clean = String(stored).trim().toLowerCase();
            if (clean.startsWith('zh')) return 'zh-TW';
            if (clean.startsWith('en')) return 'en';
        }
    } catch (_) {}

    const htmlLang = String(document.documentElement?.lang || "").toLowerCase();
    if (htmlLang.startsWith("zh")) return "zh-TW";
    if (htmlLang.startsWith("en")) return "en";

    const navLang = String(navigator.language || "").toLowerCase();
    const raw = navLang;
    if (raw.startsWith("zh")) return "zh-TW";
    return "en";
}

window.__vibeSwitchLocale = async function (locale) {
    const normalizedLocale = normalizeRuntimeLocaleCode(locale) || "en";
    try {
        localStorage.setItem('vibe_user_locale', normalizedLocale);
        if (auth.currentUser) {
            try {
                await setDoc(doc(db, 'users', auth.currentUser.uid), { locale: normalizedLocale }, { merge: true });
                console.info('[NavComp] Local user profile synchronized to Firestore');
            } catch (e) {
                console.warn('[NavComp] Failed to sync locale to Firestore:', e);
            }
        }
    } catch (_) {}

    try {
        const url = new URL(window.location.href);
        if (url.pathname.endsWith('learning-path.html')) {
            const pathParam = url.searchParams.get('path');
            if (pathParam) {
                const canonicalPath = normalizeCanonicalLearningPathKey(pathParam) || pathParam;
                if (canonicalPath !== pathParam) {
                    url.searchParams.set('path', canonicalPath);
                }
            }
        }

        url.searchParams.set('lang', normalizedLocale);
        url.searchParams.set('locale', normalizedLocale);

        const currentFile = (url.pathname.split('/').pop() || '').toLowerCase();
        const currentIsEnSection = url.pathname.includes('/en/');
        const currentIsTwSection = url.pathname.includes('/tw/');
        const currentIsLegacyRoot = !currentIsEnSection && !currentIsTwSection;
        const localeIsEn = normalizedLocale.toLowerCase().startsWith('en');
        const localeIsZh = normalizedLocale.toLowerCase().startsWith('zh');

        const supportsLocalizedSupportPages = new Set(['students.html', 'tutors.html']);
        if (supportsLocalizedSupportPages.has(currentFile)) {
            if (localeIsEn && !currentIsEnSection) {
                url.pathname = `/en/${currentFile}`;
                window.location.href = url.toString();
                return;
            }
            if (localeIsZh && !currentIsTwSection) {
                url.pathname = `/tw/${currentFile}`;
                window.location.href = url.toString();
                return;
            }
            if (currentIsLegacyRoot && (localeIsEn || localeIsZh)) {
                url.pathname = localeIsEn ? `/en/${currentFile}` : `/tw/${currentFile}`;
                window.location.href = url.toString();
                return;
            }
        }
    } catch (err) {
        console.warn('[NavComp] Switch locale path rewrite failed:', err);
    }

    window.location.reload();
};

function isZhLocale(locale) {
    return isZhLikeLocale(locale);
}

function resolveCategoryFromFilename(filename = "") {
    const file = String(filename || "").toLowerCase();
    if (!file) return null;
    if (file.startsWith("prepare-") || file.startsWith("common-") || file.startsWith("tw-common-") || file.startsWith("en-common-")) return "common";
    if (file.startsWith("start-") || file.startsWith("car-starter-") || file.startsWith("tw-car-starter-") || file.startsWith("en-car-starter-")) return "car-starter";
    if (file.startsWith("basic-") || file.startsWith("car-basic-") || file.startsWith("tw-car-basic-") || file.startsWith("en-car-basic-")) return "car-basic";
    if (file.startsWith("adv-") || file.startsWith("advanced-") || file.startsWith("car-advanced-") || file.startsWith("tw-car-advanced-") || file.startsWith("en-car-advanced-")) return "car-advanced";
    return null;
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
    if (!v) return "common";
    return v;
}

function normalizeCategoryKey(raw = "") {
    const v = String(raw || "").trim().toLowerCase();
    if (!v) return "";
    if (v === "common") return "common";
    if (/^(?:tw|en)-common$/i.test(v)) return "common";
    if (/^(?:tw|en)-car-(starter|basic|advanced)$/i.test(v)) return v.replace(/^(?:tw|en)-/i, "");
    if (/^car-(starter|basic|advanced)$/i.test(v)) return v;
    return "";
}

function resolveCategoryFromLesson(lesson = {}) {
    const category = normalizeCategoryKey(lesson.category || lesson.track || "");
    if (category) return category;
    const level = normalizeLevel(lesson.level || "");
    const track = normalizeTrack(lesson.track || "");
    if (level === "common" || track === "common" || track === "prepare") return "common";
    if (track === "car" && level && level !== "common") return `car-${level}`;
    if (/^(starter|basic|advanced)$/i.test(track)) return `car-${track}`;
    return level && level !== "common" ? `car-${level}` : "common";
}

function getCategoryHref(categoryKey = "") {
    const canonical = normalizeCanonicalLearningPathKey(categoryKey);
    return canonicalLearningPathHref(canonical || categoryKey || "common");
}

function extractCategoryLabelText(value = "", locale = "zh-TW") {
    const normalizedLocale = String(locale || "").toLowerCase().startsWith("en") ? "en" : "zh-TW";
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

function normalizeCategoryLabelEntry(value = "", locale = "zh-TW") {
    if (typeof value === "string") {
        const text = value.trim();
        return {
            "zh-TW": text,
            en: text,
        };
    }
    if (!value || typeof value !== "object") return {};

    const zh = extractCategoryLabelText(value, "zh-TW");
    const en = extractCategoryLabelText(value, "en");
    const fallback = extractCategoryLabelText(value, locale);

    return {
        "zh-TW": zh || en || fallback,
        en: en || zh || fallback,
    };
}

function normalizeCategoryLabelsMap(rawMap = {}) {
    const out = {};
    if (!rawMap || typeof rawMap !== "object") return out;
    Object.entries(rawMap).forEach(([key, value]) => {
        const canonical = normalizeCanonicalLearningPathKey(key);
        if (!canonical) return;
        out[canonical] = normalizeCategoryLabelEntry(value);
    });
    return out;
}

function categoryLabelFromParts(categoryKey = "", uiLocale = "zh-TW") {
    const _ = uiLocale;
    const key = String(categoryKey || "").trim();
    return key
        .split("-")
        .filter(Boolean)
        .map((part, index) => {
            if (index === 0 && part.length <= 3) return part.toUpperCase();
            return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join(" ");
}

function pickLessonCategoryLabel(lesson = {}, uiLocale = "zh-TW") {
    const candidates = [];
    const zh = isZhLocale(uiLocale);
    const i18n = lesson?.i18n || {};
    const nav = i18n?.nav || {};
    const lp = lesson?.learningPath || {};

    if (zh) {
        candidates.push(
            lesson?.learningPathLabelZh,
            lesson?.categoryLabelZh,
            lesson?.navLabelZh,
            lp?.labelZh,
            nav?.labelZh
        );
    } else {
        candidates.push(
            lesson?.learningPathLabelEn,
            lesson?.categoryLabelEn,
            lesson?.navLabelEn,
            lp?.labelEn,
            nav?.labelEn
        );
    }

    const hit = candidates.find((v) => typeof v === "string" && v.trim());
    return hit ? hit.trim() : "";
}

function sortCategoryKeys(keys = [], uiLocale = "zh-TW") {
    const levelRank = { common: 0, "car-starter": 1, "car-basic": 2, "car-advanced": 3 };
    return [...keys].sort((a, b) => {
        const canonicalA = normalizeCanonicalLearningPathKey(a);
        const canonicalB = normalizeCanonicalLearningPathKey(b);
        const ra = (canonicalA in levelRank) ? levelRank[canonicalA] : 99;
        const rb = (canonicalB in levelRank) ? levelRank[canonicalB] : 99;
        if (ra !== rb) return ra - rb;
        return canonicalA.localeCompare(canonicalB);
    });
}

function isCatalogCourseLesson(lesson = {}) {
    const metadataType = String(lesson?.metadataType || "").toLowerCase();
    const isHidden = lesson?.hiddenFromCatalog === true;
    const isPhysical = isPhysicalMetadataLesson(lesson);
    const price = Number(lesson?.price);

    if (isHidden) return false;
    if (isPhysical) return false;
    if (metadataType !== "course") return false;

    const hasCourseUnits = Array.isArray(lesson?.courseUnits) && lesson.courseUnits.length > 0;
    const hasEntry = typeof lesson?.entryUnitId === "string" && lesson.entryUnitId.trim().length > 0;
    const hasCourseId = typeof lesson?.courseId === "string" && lesson.courseId.trim().toLowerCase().endsWith(".html");
    const looksCourseLike = hasCourseUnits || hasEntry || hasCourseId;
    const validPrice = Number.isFinite(price) && price >= 0;
    return looksCourseLike && validPrice;
}

const CATEGORY_TRANSLATIONS = {
    "zh-TW": {
        "tw-common": "課前準備",
        "tw-car-starter": "入門課程",
        "tw-car-basic": "基礎課程",
        "tw-car-advanced": "進階課程",
        "en-common": "課前準備",
        "en-car-starter": "入門課程",
        "en-car-basic": "基礎課程",
        "en-car-advanced": "進階課程"
    },
    "en": {
        "tw-common": "Preparation",
        "tw-car-starter": "Starter Course",
        "tw-car-basic": "Basic Course",
        "tw-car-advanced": "Advanced Course",
        "en-common": "Preparation",
        "en-car-starter": "Starter Course",
        "en-car-basic": "Basic Course",
        "en-car-advanced": "Advanced Course"
    }
};

function getCategoryLabel(key, uiLocale) {
    const locale = isZhLocale(uiLocale) ? "zh-TW" : "en";
    const dict = CATEGORY_TRANSLATIONS[locale];
    const canonical = normalizeCanonicalLearningPathKey(key);
    const legacy = legacyLearningPathKeyFromCanonical(canonical || key, uiLocale);
    if (dict && dict[legacy]) return dict[legacy];
    if (dict && dict[canonical]) return dict[canonical];
    if (dict && dict[key]) return dict[key];
    return categoryLabelFromParts(canonical || key, uiLocale);
}

function getLearningPathsFromCache(uiLocale, version = "") {
    try {
        const key = getLearningPathCacheKey(uiLocale, version);
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.paths)) return null;
        if ((Date.now() - Number(data.updatedAt || 0)) > LEARNING_PATH_CACHE_TTL_MS) return null;
        return data.paths;
    } catch (_) {
        return null;
    }
}

function setLearningPathsCache(paths = [], uiLocale, version = "") {
    try {
        const key = getLearningPathCacheKey(uiLocale, version);
        localStorage.setItem(key, JSON.stringify({
            updatedAt: Date.now(),
            paths
        }));
    } catch (_) {}
}

function renderLearningPathMenus(rootPath = ".", items = DEFAULT_LEARNING_PATHS, locale = "zh-TW") {
    const resolve = (path) => {
        if (path.startsWith("http")) return path;
        return `${rootPath}/${path}`.replace("./http", "http").replace("//", "/");
    };
    const desktop = document.getElementById("learning-path-desktop-menu");
    const mobile = document.getElementById("learning-path-mobile-menu");
    if (!desktop || !mobile) return;

    desktop.innerHTML = items.map((item) => `
        <a href="${resolve(item.href)}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
            <i class="fa-solid ${item.icon || "fa-book-open"} text-xs opacity-40"></i> ${resolveMenuLabel(item.label, getCategoryLabel(item.key, locale), locale)}
        </a>
    `).join("");

    mobile.innerHTML = items.map((item) => `
        <a href="${resolve(item.href)}" class="flex items-center gap-2 py-3 px-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-700 transition-all text-sm">
            <i class="fa-solid ${item.icon || "fa-book-open"} text-xs opacity-50"></i> ${resolveMenuLabel(item.label, getCategoryLabel(item.key, locale), locale)}
        </a>
    `).join("");
}

async function loadLearningPathsDynamic(uiLocale = "zh-TW") {
    const settings = await loadLearningPathSettings(uiLocale);
    const cached = getLearningPathsFromCache(uiLocale, settings.version);
    if (cached?.length) return cached;
    try {
        const getLessons = httpsCallable(functions, "getLessonsMetadata");
        const res = await getLessons({});
        const allLessons = Array.isArray(res?.data?.lessons) ? res.data.lessons : [];
        const lessons = allLessons.filter(isCatalogCourseLesson);
        const categoryLabels = settings.categoryLabels && Object.keys(settings.categoryLabels).length
            ? settings.categoryLabels
            : normalizeCategoryLabelsMap(res?.data?.categoryLabels || {});
        const keys = new Set();
        lessons.forEach((lesson) => {
            let key = resolveCategoryFromLesson(lesson);
            if (!key) {
                const filename = String(
                    lesson?.contentRef ||
                    lesson?.entryUnitId ||
                    lesson?.courseId ||
                    lesson?.classroomUrl ||
                    ""
                ).split("/").pop().split("?")[0];
                key = resolveCategoryFromFilename(filename);
            }
            if (key) {
                keys.add(key);
            }
        });
        const dynamic = sortCategoryKeys(Array.from(keys), uiLocale).map((key) => ({
            key,
            href: getCategoryHref(key),
            label: resolveLearningPathLabel(key, uiLocale, categoryLabels),
            icon: key.includes("advanced") ? "fa-microchip" :
                key.includes("basic") ? "fa-code" :
                key.includes("starter") ? "fa-rocket" : "fa-book-open"
        }));
        const finalPaths = dynamic.length ? dynamic : getDefaultLearningPaths(uiLocale, categoryLabels);
        window.__vibeLearningPathDebug = {
            locale: uiLocale,
            lessonsCount: lessons.length,
            sourceLessonsCount: allLessons.length,
            categories: finalPaths.map((x) => x.key),
            generatedAt: new Date().toISOString(),
            source: dynamic.length ? "metadata_settings/learning_paths + metadata_lessons" : "fallback-default"
        };
        console.info("[NavComp] learning paths generated:", window.__vibeLearningPathDebug);
        setLearningPathsCache(finalPaths, uiLocale, settings.version);
        return finalPaths;
    } catch (e) {
        console.warn("[NavComp] loadLearningPathsDynamic failed:", e);
        const fallbackPaths = getDefaultLearningPaths(uiLocale, {});
        window.__vibeLearningPathDebug = {
            locale: uiLocale,
            lessonsCount: 0,
            categories: fallbackPaths.map((x) => x.key),
            generatedAt: new Date().toISOString(),
            source: "fallback-default-error"
        };
        console.info("[NavComp] learning paths generated (fallback):", window.__vibeLearningPathDebug);
        return fallbackPaths;
    }
}

// --- 1. Navigation Rendering Engine ---

window.toggleMobileMenu = function () {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('mobile-menu-btn');
    if (menu) {
        const isHidden = menu.classList.contains('hidden');
        if (isHidden) {
            menu.classList.remove('hidden');
            if (btn) btn.innerHTML = '<svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
        } else {
            menu.classList.add('hidden');
            if (btn) btn.innerHTML = '<svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>';
        }
    }
};

const handleMenuClick = (e) => {
    const btn = e.target.closest('#mobile-menu-btn');
    if (btn) {
        e.preventDefault();
        e.stopPropagation();
        window.toggleMobileMenu();
        return;
    }

    const link = e.target.closest('#mobile-menu a');
    if (link) {
        window.toggleMobileMenu();
        return;
    }

    const menu = document.getElementById('mobile-menu');
    const isMenuOpen = menu && !menu.classList.contains('hidden');
    if (isMenuOpen && !e.target.closest('#main-nav')) {
        window.toggleMobileMenu();
    }
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const menu = document.getElementById('mobile-menu');
        if (menu && !menu.classList.contains('hidden')) {
            window.toggleMobileMenu();
        }
    }
});

document.addEventListener('click', handleMenuClick, true);

window.renderNav = function (rootPath = '.', options = {}) {
    const showAuth = options.showAuth || false;
    const brandSuffix = options.brandSuffix || '';
    const isFluid = options.isFluid !== undefined ? options.isFluid : true;

    const uiLocale = detectUiLocale();
    window.__vibeLocale = uiLocale;
    const runtimeConfig = getRuntimeContentConfig();
    const localeOptions = getLocaleOptions();
    const activeLocale = normalizeRuntimeLocaleCode(uiLocale);
    const currentLocaleOption = localeOptions.find((item) => {
        return item.locale === activeLocale
            || activeLocale.startsWith(item.locale.toLowerCase())
            || item.locale.toLowerCase().startsWith(activeLocale.split('-')[0] || "");
    }) || localeOptions[0] || { locale: "en", label: "English" };
    const isZh = isZhLocale(activeLocale);
    const defaultPaths = getDefaultLearningPaths(uiLocale);

    const resolve = (path) => {
        if (path.startsWith('http')) return path;
        if (path === 'students.html' || path === 'tutors.html') {
            const meta = resolveLocalizedSitePageMeta(path.replace('.html', ''), uiLocale);
            return meta ? meta.href : `/${isZh ? 'tw' : 'en'}/${path}`;
        }
        const targetPath = path;
        return `${rootPath}/${targetPath}`.replace('./http', 'http').replace('//', '/');
    };

    let style = document.getElementById('nav-comp-styles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'nav-comp-styles';
        style.innerHTML = `
            .dropdown:hover .dropdown-menu,
            .dropdown:focus-within .dropdown-menu { 
                display: block !important; 
                opacity: 1 !important;
                visibility: visible !important;
            }
            #mobile-menu { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); transform-origin: top; }
            #mobile-menu-btn { cursor: pointer; touch-action: manipulation; }
            #mobile-menu.hidden { display: none !important; opacity: 0; transform: scaleY(0.95); }
            #mobile-menu:not(.hidden) { display: block !important; opacity: 1; transform: scaleY(1); }
            .dropdown button:focus { outline: 2px solid #06b6d4; border-radius: 0.5rem; }
        `;
        document.head.appendChild(style);
    }

    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fa = document.createElement('link');
        fa.rel = 'stylesheet';
        fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
        document.head.appendChild(fa);
    }

    const navHTML = `
    <nav class="bg-white/90 backdrop-blur-md shadow-md w-full sticky top-0 z-[99999]" id="main-nav">
        <div class="${isFluid ? 'w-full px-6' : 'container mx-auto px-4'}">
            <div class="flex justify-between items-center py-4">
                <a href="${resolve('index.html')}" class="text-2xl font-extrabold text-blue-900 tracking-tight flex items-center gap-2 min-w-0">
                    <span>🚀</span> Vibe Coding ${brandSuffix ? `<span class="text-sm font-normal text-gray-500 ml-2">${brandSuffix}</span>` : ''}
                </a>
                <div class="flex items-center gap-6">
                    <div class="hidden md:flex items-center space-x-6 font-medium text-gray-600">
                        <div class="relative dropdown group">
                            <button aria-expanded="false" aria-haspopup="true" class="flex items-center hover:text-cyan-600 transition-all cursor-pointer py-2 gap-1">
                                ${isZh ? '學習路徑' : 'Learning Path'} <svg class="w-4 h-4 opacity-50 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <div id="learning-path-desktop-menu" class="dropdown-menu absolute hidden bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl py-3 w-56 mt-0 border border-slate-100 left-0 animate-in fade-in slide-in-from-top-2 duration-200">
                            </div>
                        </div>
                        <div class="relative dropdown group">
                            <button aria-expanded="false" aria-haspopup="true" class="flex items-center text-cyan-600 font-bold transition-all cursor-pointer py-2 gap-1">
                                ${isZh ? '支援與合作' : 'Support & Collab'} <svg class="w-4 h-4 opacity-50 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <div class="dropdown-menu absolute hidden bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl py-3 w-64 mt-0 border border-slate-100 left-0 animate-in fade-in slide-in-from-top-2 duration-200">
                                <a href="${resolve('students.html')}" data-localized-page="students" class="flex items-center gap-3 px-4 py-2.5 hover:bg-cyan-50 hover:text-cyan-700 transition-colors">
                                    <i class="fa-solid fa-graduation-cap text-xs opacity-40"></i> ${isZh ? '學員指南' : 'Student Guide'}
                                </a>
                                <a href="${resolve('tutors.html')}" data-localized-page="tutors" class="flex items-center gap-3 px-4 py-2.5 hover:bg-cyan-50 hover:text-cyan-700 transition-colors">
                                    <i class="fa-solid fa-handshake text-xs opacity-40"></i> ${isZh ? '導師合作' : 'Tutor Collaboration'}
                                </a>
                                <div class="my-2 border-t border-slate-50"></div>
                                <a href="${resolve('examples/index.html')}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 hover:text-slate-700 transition-colors">
                                    <i class="fa-solid fa-display text-xs opacity-40"></i> ${isZh ? '範例展示參考' : 'Examples'}
                                </a>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <!-- Language Selector Dropdown -->
                        <div class="hidden md:flex relative dropdown group items-center">
                            <button id="lang-btn" aria-expanded="false" aria-haspopup="true" class="flex items-center hover:text-cyan-600 transition-all cursor-pointer py-2 gap-1.5 text-gray-600 font-medium select-none">
                                <i class="fa-solid fa-globe opacity-70 text-sm"></i>
                                <span class="text-sm">${currentLocaleOption.label || currentLocaleOption.locale}</span>
                                <svg class="w-3 h-3 opacity-50 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                            <div class="dropdown-menu absolute hidden bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl py-2 w-40 mt-0 border border-slate-100 right-0 top-full animate-in fade-in slide-in-from-top-2 duration-200" style="z-index: 1000000;">
                                ${localeOptions.map((option) => `
                                    <button onclick="window.__vibeSwitchLocale('${option.locale}')" class="w-full text-left flex items-center px-4 py-2.5 hover:bg-cyan-50 hover:text-cyan-700 transition-colors text-sm font-medium ${activeLocale === option.locale ? 'text-cyan-600 bg-cyan-50/40 font-bold' : 'text-gray-700'}">
                                        ${option.label || option.locale}
                                    </button>
                                `).join("")}
                            </div>
                        </div>

                        ${showAuth ? `
                        <div class="flex items-center space-x-4">
                            <a href="${resolve('cart.html')}" class="text-gray-600 hover:text-cyan-600 transition duration-150 relative" title="${isZh ? '前往購物車' : 'Go to Cart'}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.2 4h12.4M15 13H7" />
                                </svg>
                            </a>
                            <div id="auth-status" class="text-sm hidden md:flex items-center">
                                <span id="user-display" class="text-gray-600 hidden md:inline mr-2">${isZh ? '訪客' : 'Guest'}</span>
                                <button id="login-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-full transition shadow-md">${isZh ? '登入' : 'Login'}</button>
                            </div>
                        </div>` : ''}
                        <div class="md:hidden">
                            <button id="mobile-menu-btn" type="button" class="text-gray-600 focus:outline-none p-2 border rounded hover:bg-gray-100 transition-colors">
                                <svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div id="mobile-menu" class="hidden md:hidden pb-8 border-t border-slate-100 absolute inset-x-0 box-border bg-white/95 backdrop-blur-lg shadow-2xl z-[9998] px-6 max-h-[85vh] overflow-y-auto">
            <div class="flex flex-col space-y-6 pt-6 font-medium text-slate-600">
                ${showAuth ? `
                <div id="mobile-auth-section" class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <div>
                            <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">${isZh ? '目前狀態' : 'Status'}</p>
                            <span id="mobile-user-display" class="text-sm font-bold text-slate-700">${isZh ? '訪客' : 'Guest'}</span>
                        </div>
                    </div>
                    <button id="mobile-login-btn" class="px-5 py-2 bg-indigo-600 text-white text-sm rounded-xl font-bold shadow-sm active:scale-95 transition-transform">${isZh ? '登入' : 'Login'}</button>
                </div>` : ''}

                <!-- Mobile Language Selector -->
                        <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                    <i class="fa-solid fa-globe"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Language / 語言</p>
                            <span class="text-sm font-bold text-slate-700">${currentLocaleOption.label || currentLocaleOption.locale}</span>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                ${localeOptions.map((option) => `
                                    <button onclick="window.__vibeSwitchLocale('${option.locale}')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeLocale === option.locale ? 'bg-cyan-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600'}">${option.label || option.locale}</button>
                                `).join("")}
                            </div>
                        </div>

                <div class="space-y-3">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">${isZh ? '學習路徑' : 'Learning Path'}</span>
                    <div id="learning-path-mobile-menu" class="grid grid-cols-2 gap-3">
                    </div>
                </div>
                <div class="space-y-3 pb-4">
                    <span class="text-[11px] font-bold text-cyan-500 uppercase tracking-[0.2em] px-1">${isZh ? '支援與合作' : 'Support & Collab'}</span>
                    <div class="flex flex-col gap-2">
                        <a href="${resolve('students.html')}" data-localized-page="students" class="flex items-center justify-between py-3.5 px-5 bg-cyan-50/50 border border-cyan-100 rounded-2xl hover:bg-cyan-100 hover:text-cyan-700 transition-all">
                            <div class="flex items-center gap-3">
                                <i class="fa-solid fa-graduation-cap text-cyan-600"></i>
                                <span class="text-sm font-bold text-cyan-900" data-localized-label="students">${isZh ? '學員指南' : 'Student Guide'}</span>
                            </div>
                        </a>
                        <a href="${resolve('tutors.html')}" data-localized-page="tutors" class="flex items-center justify-between py-3.5 px-5 bg-indigo-50/30 border border-indigo-100/50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-700 transition-all">
                            <div class="flex items-center gap-3">
                                <i class="fa-solid fa-handshake text-indigo-600"></i>
                                <span class="text-sm font-bold text-indigo-900" data-localized-label="tutors">${isZh ? '導師合作' : 'Tutor Collaboration'}</span>
                            </div>
                        </a>
                        <a href="${resolve('examples/index.html')}" class="flex items-center justify-between py-3.5 px-5 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 hover:text-slate-700 transition-all">
                            <div class="flex items-center gap-3">
                                <i class="fa-solid fa-display text-slate-600"></i>
                                <span class="text-sm font-bold text-slate-900">${isZh ? '範例程式展示' : 'Examples'}</span>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </nav>
    `;

    const placeholder = document.getElementById('nav-placeholder');
    if (placeholder) {
        placeholder.style.position = 'relative';
        placeholder.style.zIndex = '999999';
        placeholder.innerHTML = navHTML;
        void hydrateLocalizedSitePages(placeholder, uiLocale);
    } else {
        const existingNav = document.getElementById('main-nav') || document.querySelector('nav');
        if (existingNav) { 
            existingNav.outerHTML = navHTML; 
        }
        else { document.body.insertAdjacentHTML('afterbegin', navHTML); }
    }

    void hydrateLocalizedSitePages(document, uiLocale);

    setTimeout(() => {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('nav a');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('javascript') || href === '#') return;
            const isMatch = (href === '/' && (currentPath === '/' || currentPath.endsWith('index.html'))) || (href !== '/' && currentPath.includes(href));
            if (isMatch) {
                link.classList.add('text-cyan-600', 'font-bold');
                link.classList.remove('text-gray-600');
            }
        });
    }, 0);

    renderLearningPathMenus(rootPath, defaultPaths, uiLocale);
    loadLearningPathsDynamic(uiLocale).then((paths) => {
        renderLearningPathMenus(rootPath, paths, uiLocale);
    });
};

// --- 2. Dashboard Modal logic ---

function injectDashboardModal() {
    if (document.getElementById('dashboard-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'dashboard-modal';
    modal.className = 'fixed inset-0 bg-black/60 hidden flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300';
    modal.style.zIndex = '10000000';
    modal.innerHTML = `
        <div class="bg-white w-full h-full max-w-7xl rounded-2xl shadow-2xl relative overflow-hidden flex flex-col transform scale-100 transition-transform">
            <div class="flex justify-between items-center p-4 border-b bg-gray-50/80 backdrop-blur">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">📊</span>
                    <h3 class="text-lg font-bold text-gray-800">${window.t ? window.t('dash_header_title', '儀表板 (Dashboard)') : '儀表板 (Dashboard)'}</h3>
                </div>
                <button onclick="closeDashboardModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="flex-grow relative bg-gray-100">
                <div id="dashboard-loading" class="absolute inset-0 flex items-center justify-center z-10 bg-white/50">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                </div>
                <iframe id="dashboard-frame" class="w-full h-full border-0" src="" onload="document.getElementById('dashboard-loading').classList.add('hidden')"></iframe>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.openDashboardModal = function (courseParam) {
    injectDashboardModal();
    const modal = document.getElementById('dashboard-modal');
    const frame = document.getElementById('dashboard-frame');
    const loader = document.getElementById('dashboard-loading');
    let separator = courseParam.includes('?') ? '&' : '?';

    let finalUnitId = '';
    const iframe = document.getElementById('content-frame');
    if (iframe && iframe.src) {
        try {
            const absoluteSrc = new URL(iframe.src, window.location.href).href;
            finalUnitId = absoluteSrc.split('/').pop().split('?')[0].split('#')[0];
        } catch (e) { finalUnitId = iframe.src.split('/').pop().split('?')[0].split('#')[0]; }
    }
    if (!finalUnitId) { finalUnitId = window.location.pathname.split('/').pop().split('#')[0]; }

    const unitParam = finalUnitId ? `&unitId=${finalUnitId}` : '';
    let url = `/dashboard.html${courseParam}${separator}mode=iframe${unitParam}`;

    frame.src = url;
    loader.classList.remove('hidden');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');

    if (modal.requestFullscreen) modal.requestFullscreen();
    else if (modal.webkitRequestFullscreen) modal.webkitRequestFullscreen();

    const nav = document.getElementById('main-nav') || document.querySelector('nav');
    if (nav) nav.style.setProperty('display', 'none', 'important');
};

window.closeDashboardModal = function () {
    const modal = document.getElementById('dashboard-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
        const nav = document.getElementById('main-nav') || document.querySelector('nav');
        if (nav) nav.style.display = '';
        setTimeout(() => { document.getElementById('dashboard-frame').src = ''; }, 300);
    }
    document.body.style.overflow = '';
};

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const modal = document.getElementById('dashboard-modal');
        if (modal && !modal.classList.contains('hidden')) { closeDashboardModal(); }
    }
});

function injectDashboardFAB() {
    const existing = document.getElementById('dashboard-fab');
    if (existing) existing.remove();
    injectDashboardModal();

    const path = decodeURIComponent(window.location.pathname);
    const filename = path.split('/').pop();

    const excluded = new Set([
        '',
        'index.html',
        'prepare.html',
        'start.html',
        'basic.html',
        'advanced.html',
        'students.html',
        'tutors.html',
        'dashboard.html',
        'cart.html',
        'payment-return.html',
        'learning-path.html'
    ]);
    const pathIsCourseRoute = path.startsWith('/courses/');
    const looksLikeUnitPage = filename.includes('-unit-') || filename.includes('-master-') || /^prepare-\d+/.test(filename);
    const isHtml = filename.endsWith('.html');
    const shouldShowFab = (pathIsCourseRoute || isHtml || looksLikeUnitPage) && !excluded.has(filename);
    if (!shouldShowFab) return;

    const normalizedUnitId = filename || '';
    const courseParam = normalizedUnitId ? `?unitId=${encodeURIComponent(normalizedUnitId)}` : '';

    const fab = document.createElement('button');
    fab.id = 'dashboard-fab';
    fab.className = 'fixed bottom-8 right-8 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group z-50';
    fab.style.zIndex = '9999';
    fab.innerHTML = `
        <span class="text-3xl group-hover:rotate-12 transition-transform">📊</span>
        <span class="absolute right-full mr-4 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
            查看儀表板
        </span>
    `;
    fab.onclick = function () { openDashboardModal(courseParam); };
    document.body.appendChild(fab);
}

function normalizeCourseTopNavBrandLink() {
    try {
        const path = window.location.pathname || '';
        if (!path.startsWith('/courses/')) return;
        const file = (path.split('/').pop() || '').toLowerCase();
        const topNav = document.querySelector('.ms-topnav');
        const brand = topNav ? topNav.querySelector('.brand') : null;
        if (!brand) return;

        const href = (brand.getAttribute('href') || '').trim();
        if (href && href !== '#' && href !== './#') return;

        let target = '/';
        if (file.startsWith('start-') || file.startsWith('tw-car-starter-') || file.startsWith('en-car-starter-') || file.startsWith('car-starter-')) target = canonicalLearningPathHref('car-starter');
        else if (file.startsWith('basic-') || file.startsWith('tw-car-basic-') || file.startsWith('en-car-basic-') || file.startsWith('car-basic-')) target = canonicalLearningPathHref('car-basic');
        else if (file.startsWith('adv-') || file.startsWith('tw-car-advanced-') || file.startsWith('en-car-advanced-') || file.startsWith('car-advanced-')) target = canonicalLearningPathHref('car-advanced');
        else if (file.startsWith('prepare-') || file.startsWith('tw-common-') || file.startsWith('en-common-') || file.startsWith('common-')) target = canonicalLearningPathHref('common');
        brand.setAttribute('href', target);
        brand.setAttribute('target', '_top');
    } catch (e) {
        console.warn('[NavComp] normalizeCourseTopNavBrandLink failed:', e);
    }
}

// --- 3. Initializer Bootloader ---

async function initNavComponent() {
    const path = window.location.pathname || '';
    const isCoursePage = path.startsWith('/courses/');

    await ensureContentRuntimeConfig();

    if (isCoursePage) {
        // Do not inject global nav inside course pages.
        document.querySelectorAll('#main-nav').forEach((el) => el.remove());
        const placeholder = document.getElementById('nav-placeholder');
        if (placeholder) placeholder.remove();
        normalizeCourseTopNavBrandLink();
        injectDashboardFAB();
        return;
    }

    const placeholder = document.getElementById('nav-placeholder');
    const root = placeholder ? (placeholder.getAttribute('data-root') || '.') : '/';
    const showAuth = placeholder ? (placeholder.getAttribute('data-show-auth') === 'true') : false;

    if (placeholder) {
        placeholder.classList.remove('sticky', 'top-0', 'z-[99999]');
    }
    window.renderNav(root, { showAuth });

    try {
        if (document.body) { injectDashboardFAB(); }
        else { document.addEventListener('DOMContentLoaded', injectDashboardFAB); }
    } catch (e) { console.error("[NavComp] FAB failed:", e); }

    onAuthStateChanged(auth, async (user) => {
        const desktopUser = document.getElementById('user-display');
        const desktopLogin = document.getElementById('login-btn');
        const mobileUser = document.getElementById('mobile-user-display');
        const mobileLogin = document.getElementById('mobile-login-btn');
        const isZh = isZhLocale(detectUiLocale());
        let resolvedDisplayName = isZh ? '使用者' : 'User';

        const updateUI = (userDisplay, loginBtn) => {
            if (!userDisplay || !loginBtn) return;
            if (user) {
                userDisplay.innerText = resolvedDisplayName;
                userDisplay.style.display = ''; // Clear inline display to allow CSS rules
                userDisplay.classList.remove('hidden');
                loginBtn.innerText = isZh ? '登出' : 'Logout';
                loginBtn.onclick = () => auth.signOut();
            } else {
                userDisplay.innerText = isZh ? '訪客' : 'Guest';
                if (userDisplay.id === 'user-display') {
                    userDisplay.style.display = 'none'; // Force hide on desktop
                } else {
                    userDisplay.style.display = '';
                    userDisplay.classList.remove('hidden');
                }
                loginBtn.innerText = isZh ? '登入' : 'Login';
                loginBtn.onclick = () => startGoogleLogin();
            }
        };

        if (user) {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.exists() ? (userDoc.data() || {}) : {};
                resolvedDisplayName = userData.name ||
                    userData.displayName ||
                    user.displayName ||
                    (user.email ? user.email.split('@')[0] : (isZh ? '使用者' : 'User'));
            } catch (e) {
                console.warn('[NavComp] Failed to resolve user display name from Firestore:', e);
                resolvedDisplayName = user.displayName || (user.email ? user.email.split('@')[0] : (isZh ? '使用者' : 'User'));
            }
        }

        updateUI(desktopUser, desktopLogin);
        updateUI(mobileUser, mobileLogin);
    });
}

consumeGoogleRedirectResult();
window.vibeStartGoogleLogin = startGoogleLogin;

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initNavComponent); }
else { initNavComponent(); }
