import { app } from "./firebase-init.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { connectFirebaseEmulators } from "./firebase-local.js?v=4";

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-east1");
connectFirebaseEmulators({ auth, db, functions });

window.vibeApp = app;
window.getFunctions = getFunctions;
window.httpsCallable = httpsCallable;

const checkAuthFunction = httpsCallable(functions, "checkPaymentAuthorization");
const getLessonsFunc = httpsCallable(functions, "getLessonsMetadata");
let currentLessons = [];
let currentPathKey = "common";
let currentLessonsRequestId = 0;
const LESSON_LOAD_RETRY_ATTEMPTS = 3;
const LESSON_LOAD_RETRY_BASE_DELAY_MS = 250;
const LESSON_AUTO_REFRESH_COOLDOWN_MS = 8000;
const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const learningPathState = window.__vibeLearningPathState || {
  loading: false,
  lastSuccessAt: 0,
  lastFailureAt: 0,
  lastRefreshAttemptAt: 0
};
window.__vibeLearningPathState = learningPathState;
let learningPathRefreshTimer = null;
let learningPathSignalsBound = false;

async function runWithBackoff(task, {
  attempts = LESSON_LOAD_RETRY_ATTEMPTS,
  baseDelayMs = LESSON_LOAD_RETRY_BASE_DELAY_MS,
  factor = 2,
  label = "request"
} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        const delay = baseDelayMs * Math.pow(factor, attempt);
        console.warn(`[learning-path] ${label} failed (${attempt + 1}/${attempts}), retrying in ${delay}ms`, error);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

function getLocalPreferredDistributorId() {
  return localStorage.getItem('vibe_user_preferred_distributor') || '';
}

function persistLocalPreferredDistributorId(distributorId = '') {
  const normalized = String(distributorId || '').trim();
  if (!normalized) return;
  localStorage.setItem('vibe_user_preferred_distributor', normalized);
}

function resolveRegionDefaultDistributorId(userData = {}) {
  const preferredRegion = String(userData.preferredRegion || userData.region || '').trim().toUpperCase();
  if (preferredRegion === 'TW') return 'default-twd';
  if (preferredRegion === 'US') return 'default-usd';
  return 'default-usd';
}

function getScopedTutorModeForUid(uid = "") {
  const cleanUid = String(uid || "").trim();
  if (!cleanUid) return false;
  try {
    const scopedKey = `adminTutorMode:${cleanUid}`;
    return localStorage.getItem(scopedKey) === "true";
  } catch (_) {
    return false;
  }
}

async function resolveLessonsDistributorId() {
  const localPreferredDistributorId = getLocalPreferredDistributorId();
  const currentUser = auth.currentUser;
  if (!currentUser) return localPreferredDistributorId;

  try {
    const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
    const userData = userSnap.exists() ? (userSnap.data() || {}) : {};
    const preferredDistributorId = String(
      userData.preferredDistributorId
      || userData.distributorId
      || userData.commercial?.distributorId
      || ''
    ).trim();
    if (preferredDistributorId) return preferredDistributorId;
    return resolveRegionDefaultDistributorId(userData);
  } catch (error) {
    console.warn('[learning-path] Failed to resolve preferred distributor from Firestore:', error);
  }

  return resolveRegionDefaultDistributorId();
}

window.__getLessonsMetadata = async function () {
  return runWithBackoff(async () => {
    const distributorId = await resolveLessonsDistributorId();
    const res = await getLessonsFunc({ distributorId });
    return res?.data || {};
  }, {
    label: "getLessonsMetadata",
    attempts: LESSON_LOAD_RETRY_ATTEMPTS,
    baseDelayMs: LESSON_LOAD_RETRY_BASE_DELAY_MS
  });
};
const AUTH_URL = "/auth.html?v=" + Date.now();
const CART_URL = "cart.html";
const LP = window.learningPathCore || {};
function getPricingApi() {
  return window.vibePricing || {
  resolveLessonPrice(lesson = {}, locale = "zh-TW") {
      const amount = Number(lesson?.dealerPrice ?? 0);
      return { amount: Number.isFinite(amount) ? amount : 0, currency: String(lesson?.dealerCurrency || lesson?.currency || "").toUpperCase() };
    },
    formatPrice(priceEntry = {}, locale = "zh-TW") {
      const amount = Number(priceEntry?.amount ?? priceEntry ?? 0);
      const currency = String(priceEntry?.currency || "").toUpperCase();
      if (!amount) return String(locale || "").startsWith("en") ? "Free" : "免費";
      if (!currency) {
        try {
          return new Intl.NumberFormat(String(locale || "").startsWith("en") ? "en-US" : "zh-TW").format(amount);
        } catch (_) {
          return amount.toLocaleString();
        }
      }
      if (currency === "TWD") {
        return `TWD ${Math.round(amount).toLocaleString()}`;
      }
      return `${currency} ${amount.toLocaleString()}`;
    }
  };
}
let categoryLabelsMap = {};

function stripQueryAndHash(value = "") {
  return String(value || "").split("?")[0].split("#")[0];
}

function basenameFromUrl(value = "") {
  const clean = stripQueryAndHash(value);
  if (!clean) return "";
  return clean.split("/").pop() || "";
}

function buildLessonAuthRequest(card = {}) {
  const authDocId = String(card.dataset.authDocId || "").trim();
  const authPageId = String(card.dataset.authPageId || "").trim();
  const classroomUrl = String(card.dataset.classroomUrl || "").trim();
  const authFileName = String(card.dataset.authFileName || "").trim() || basenameFromUrl(classroomUrl).replace(/\.html$/i, "");
  return {
    pageId: authDocId || authPageId || authFileName,
    fileName: authFileName,
    docId: authDocId || authPageId || authFileName
  };
}

function addToCart(docId, productName, productPrice, isPhysical, currency = "") {
  const cart = JSON.parse(localStorage.getItem("vibeCodingCart") || "{}");
  if (cart[docId]) return false;
  cart[docId] = {
    name: productName,
    price: Number(productPrice || 0),
    currency: currency || "",
    price_currency: currency || "",
    quantity: 1,
    isPhysical: !!isPhysical
  };
  localStorage.setItem("vibeCodingCart", JSON.stringify(cart));
  return true;
}

function updateCardAction(card, status) {
  const btn = card.querySelector(".action-btn");
  if (!btn) return;
  const lessonId = card.dataset.lessonId;
  const authPageId = card.dataset.authPageId || card.dataset.authFileName || "";
  const courseName = card.dataset.courseName;
  const coursePrice = Number(card.dataset.coursePrice || 0);
  const courseCurrency = card.dataset.courseCurrency || "";
  const isPhysical = card.dataset.isPhysical === "true";
  const hasPriceData = card.dataset.hasPriceData === "true";
  const classroomUrl = card.dataset.classroomUrl;
  const hasVideoButton = !!card.querySelector(".video-btn");
  const widthClass = hasVideoButton ? "flex-1 w-full" : "w-full";
  btn.onclick = null;
  btn.disabled = false;
  btn.removeAttribute("data-i18n");
  btn.removeAttribute("data-i18n-html");
  const syncBtnI18n = () => {
    if (typeof window.applyI18n === 'function') window.applyI18n();
  };

  const uiLocale = LP.detectUiLocale?.() || "en";

  if (!hasPriceData) {
    btn.dataset.i18n = 'lp_not_for_sale';
    btn.textContent = '';
    btn.className = `action-btn ${widthClass} py-2 px-3 rounded-md bg-gray-400 text-white font-medium cursor-not-allowed`;
    btn.disabled = true;
    syncBtnI18n();
    return;
  }

  if (isPhysical && coursePrice > 0) {
    btn.dataset.i18n = 'lp_addToCartPhysical';
    btn.textContent = '';
    btn.className = `action-btn ${widthClass} py-2 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition`;
    btn.onclick = () => {
      if (addToCart(lessonId, courseName, coursePrice, isPhysical, courseCurrency)) window.location.href = CART_URL;
      else alert(window.t('lp_alreadyInCart').replace("{name}", courseName));
    };
    syncBtnI18n();
    return;
  }
  if (status === "AUTHORIZED") {
    btn.dataset.i18n = 'lp_enterCourseBtn';
    btn.textContent = '';
    btn.className = `action-btn ${widthClass} py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition`;
    btn.onclick = () => {
      if (!classroomUrl) return alert(window.t('lp_coursesConfigMissing'));
      const langParam = uiLocale ? `&lang=${encodeURIComponent(uiLocale)}` : "";
      const currencyParam = courseCurrency ? `&currency=${encodeURIComponent(courseCurrency)}` : "";
      window.location.href = `${AUTH_URL}&url=${encodeURIComponent(classroomUrl)}&id=${encodeURIComponent(authPageId)}&docId=${encodeURIComponent(authPageId)}&price=${coursePrice}${currencyParam}${langParam}`;
    };
    syncBtnI18n();
    return;
  }
  if (status === "NOT_LOGGED_IN") {
    if (coursePrice > 0) {
      btn.dataset.i18n = 'lp_addToCartBtn';
      btn.textContent = '';
      btn.className = `action-btn ${widthClass} py-2 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition`;
      btn.onclick = () => {
        if (addToCart(lessonId, courseName, coursePrice, isPhysical, courseCurrency)) window.location.href = CART_URL;
        else alert(window.t('lp_alreadyInCart').replace("{name}", courseName));
      };
      syncBtnI18n();
      return;
    }

    btn.dataset.i18n = 'lp_loginFreeBtn';
    btn.textContent = '';
    btn.className = `action-btn ${widthClass} py-2 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition`;
    btn.onclick = () => {
      if (typeof window.vibeStartGoogleLogin === 'function') window.vibeStartGoogleLogin();
      else signInWithPopup(auth, new GoogleAuthProvider());
    };
    syncBtnI18n();
    return;
  }
  if (status === "UNAUTHORIZED" || status === "ERROR") {
    btn.dataset.i18n = 'lp_addToCartBtn';
    btn.textContent = '';
    btn.className = `action-btn ${widthClass} py-2 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition`;
    btn.onclick = () => {
      if (addToCart(lessonId, courseName, coursePrice, isPhysical, courseCurrency)) window.location.href = CART_URL;
      else alert(window.t('lp_alreadyInCart').replace("{name}", courseName));
    };
    syncBtnI18n();
    return;
  }
  btn.dataset.i18n = 'lp_loadingText';
  btn.textContent = '';
  btn.className = `action-btn ${widthClass} py-2 px-3 rounded-md bg-gray-400 text-white font-medium cursor-not-allowed`;
  btn.disabled = true;
  syncBtnI18n();
}

async function checkLessonAuthorization(card, user) {
  updateCardAction(card, "LOADING");
  const hasPriceData = card.dataset.hasPriceData === "true";
  const coursePrice = Number(card.dataset.coursePrice || 0);
  const courseCurrency = card.dataset.courseCurrency || "";
  const isFreeCourse = hasPriceData && Number(card.dataset.coursePrice || 0) === 0;
  if (isFreeCourse && user) return updateCardAction(card, "AUTHORIZED");
  const tutorModeActive = getScopedTutorModeForUid(user?.uid || auth.currentUser?.uid || "");
  try {
    const attempt = buildLessonAuthRequest(card);
    const lastResult = await checkAuthFunction({
      docId: attempt.docId,
      pageId: attempt.pageId,
      fileName: attempt.fileName,
      price: coursePrice,
      currency: courseCurrency,
      tutorMode: tutorModeActive
    });
    if (lastResult?.data?.authorized) {
      updateCardAction(card, "AUTHORIZED");
      return;
    }
    updateCardAction(card, "UNAUTHORIZED");
  } catch (_) {
    updateCardAction(card, "UNAUTHORIZED");
  }
}

function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function openVideo(url = "") {
  if (!url) return;
  if (typeof window.enterMediaMode === "function") {
    window.enterMediaMode("video", url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function renderLessons(lessons, pathKey) {
  const uiLocale = LP.detectUiLocale?.() || "en";
  const isEn = String(uiLocale || "").toLowerCase().startsWith("en");
  const pageTitleText = LP.categoryLabel?.(pathKey, categoryLabelsMap, uiLocale) || "";

  const container = document.getElementById("lesson-container");
  const title = document.getElementById("page-title");
  if (title) {
    title.textContent = pageTitleText;
    title.setAttribute("data-path-title", LP.categoryLabel?.(pathKey, categoryLabelsMap, uiLocale) || "");
  }
  document.title = pageTitleText;
  const sections = LP.buildLearningPathSections?.(lessons, pathKey, uiLocale) || {
    rows: [],
    productRows: [],
    specsRows: [],
    isCommonPath: LP.normalizeCanonicalLearningPathKey?.(pathKey) === "common"
  };
  const { rows = [], productRows = [], hardwareRows = [], specsRows = [], isCommonPath = false } = sections;
  const productEntries = productRows.length ? productRows : hardwareRows;
  if (!rows.length && !productEntries.length && !specsRows.length && !isCommonPath) {
    container.innerHTML = `<p class="text-center text-gray-500 w-full col-span-3 py-12">${window.t('lp_emptyCategory')}</p>`;
    return;
  }
  const courseHtml = rows.map((lesson) => {
    const canonicalDocId = String(lesson.docId || lesson.id || lesson.courseId || "").trim();
    const rawUnitFile = Array.isArray(lesson.courseUnits) && lesson.courseUnits.length > 0
      ? String(lesson.courseUnits[0] || "").split("/").pop().split("?")[0]
      : "";
    const unitFile = LP.resolveUnitFile?.(lesson) || "";
    const entryUrl = rawUnitFile ? `/courses/${rawUnitFile}` : (unitFile ? `/courses/${unitFile}` : "");
    const displayTitle = LP.resolveLessonCardTitle?.(lesson, uiLocale) || String(lesson.title || lesson.titleEn || "").trim();
    const displayKey = LP.categoryLabel?.(pathKey, categoryLabelsMap, uiLocale) || "";
    const localizedCoreContent = toList(window.__vibeResolveLocalizedFieldValue
      ? window.__vibeResolveLocalizedFieldValue(lesson, "coreContent", uiLocale, isEn ? (lesson.coreContentEn || []) : (lesson.coreContent || []))
      : (isEn ? (lesson.coreContentEn || []) : (lesson.coreContent || []))).slice(0, 4);
    const contentList = LP.translateBulletList?.(localizedCoreContent, uiLocale) || localizedCoreContent;
    const summary = LP.resolveLessonCardSummary?.(lesson, uiLocale) || window.t('lp_summary_pending');
    const duration = String(lesson.duration || lesson.estimatedDuration || "");
    const displayLessonLabel = LP.resolveLessonLabel?.(lesson, uiLocale) || String(lesson.lessonLabel || lesson.tagText || "").trim();
    const icon = String(lesson.cardIcon || lesson.icon || "📘");
    const imageUrl = LP.pickImage?.(lesson) || "";
    const videoUrl = LP.pickVideo?.(lesson) || "";
    const priceEntry = getPricingApi().resolveLessonPrice(lesson);
    const price = Number(priceEntry.amount || 0);
    const priceCurrency = String(priceEntry.currency || "");
    const hasPriceData = priceEntry.hasPriceData === true || lesson.dealerPriceBookId != null;
    const disablePreview = lesson.previewDisabled === true;
    const videoButton = (videoUrl && !disablePreview)
      ? `<button class="video-btn flex-1 w-full py-2 px-3 rounded-md border border-red-500 text-red-600 font-medium hover:bg-red-50 transition-colors" data-i18n="lp_previewBtn"></button>`
      : "";
    const actionButtonClass = videoUrl ? "flex-1 w-full" : "w-full";
    const listHtml = contentList.length
      ? `<ul class="list-disc pl-5 space-y-1">${contentList.map((x) => `<li>${x}</li>`).join("")}</ul>`
      : `<p class="text-sm text-slate-500">${summary}</p>`;
    const imageHtml = imageUrl
      ? `<div class="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 mb-3"><img src="${imageUrl}" alt="${displayTitle || "course"}" class="w-full h-40 object-cover"></div>`
      : "";
    return `
      <div class="lesson-card bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition"
           data-lesson-id="${canonicalDocId}"
           data-course-id="${canonicalDocId}"
           data-auth-doc-id="${canonicalDocId}"
           data-auth-page-id="${canonicalDocId}"
           data-auth-file-name="${rawUnitFile || unitFile || ""}"
           data-course-name="${lesson.title || ""}"
           data-course-price="${price}"
           data-course-currency="${priceCurrency}"
           data-has-price-data="${hasPriceData}"
           data-is-physical="${LP.isPhysicalMetadataLesson?.(lesson) ? "true" : "false"}"
           data-classroom-url="${entryUrl}">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0 text-xs text-slate-500 truncate">${displayKey}</div>
          ${duration ? `<span class="flex-shrink-0 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">${duration}</span>` : ""}
        </div>
        <h2 class="text-xl font-bold text-slate-800 mb-2">${displayTitle || lesson.id || lesson.docId || window.t('lp_untitled_course')}</h2>
        <div class="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1 inline-block mb-3" data-i18n="lp_course_unit_badge"></div>
        ${imageHtml}
        <div class="text-sm text-slate-700 mb-3"><span class="mr-2">${icon}</span>${summary || window.t('lp_content_loaded_from_system')}</div>
        <div class="text-sm text-slate-700 mb-4">
          <strong class="text-slate-900 block mb-1" data-i18n="lp_coreContentLabel"></strong>
          ${listHtml}
        </div>
        ${hasPriceData ? `
        <div class="mt-4 pt-3 border-t border-slate-100 text-center">
          <span class="text-2xl font-bold text-blue-600">${price === 0 ? '' : (LP.formatPrice?.(priceEntry, uiLocale) || String(priceEntry?.amount ?? priceEntry ?? 0))}</span>
        </div>
        <div class="mt-3 flex flex-col sm:flex-row gap-2">
          ${videoButton}
          <button class="action-btn ${actionButtonClass} py-2 px-3 rounded-md bg-gray-300 text-gray-500 font-medium cursor-not-allowed" disabled data-i18n="lp_loadingText"></button>
        </div>
        ` : ""}
      </div>
    `;
  }).join("");

  const productHtml = productEntries.map((lesson) => {
    const canonicalDocId = String(lesson.docId || lesson.id || lesson.courseId || "").trim();
    const unitFile = LP.resolveUnitFile?.(lesson) || "";
    const entryUrl = unitFile ? `/courses/${unitFile}` : "";
    const priceEntry = getPricingApi().resolveLessonPrice(lesson);
    const price = Number(priceEntry.amount || 0);
    const priceCurrency = String(priceEntry.currency || "");
    const hasPriceData = priceEntry.hasPriceData === true || lesson.dealerPriceBookId != null;
    const displayKey = LP.categoryLabel?.(pathKey, categoryLabelsMap, uiLocale) || "";
    const imageUrl = LP.pickImage?.(lesson) || "";
    const displayTitle = String(window.__vibeResolveLocalizedFieldValue
      ? window.__vibeResolveLocalizedFieldValue(
          lesson,
          "title",
          uiLocale,
          isEn ? (lesson.titleEn || LP.inferEnglishTitle?.(lesson) || lesson.title || "") : (lesson.title || lesson.titleEn || "")
        )
      : (isEn ? (lesson.titleEn || LP.inferEnglishTitle?.(lesson) || lesson.title || "") : (lesson.title || lesson.titleEn || "")) || "").trim();
    const summary = String(window.__vibeResolveLocalizedFieldValue
      ? window.__vibeResolveLocalizedFieldValue(
          lesson,
          "summary",
          uiLocale,
          isEn ? (lesson.summaryEn || lesson.descriptionEn || lesson.summary || lesson.description || lesson.tagText || "") : (lesson.summary || lesson.description || lesson.tagText || lesson.summaryEn || lesson.descriptionEn || "")
        )
      : (isEn ? (lesson.summaryEn || lesson.descriptionEn || lesson.summary || lesson.description || lesson.tagText || "") : (lesson.summary || lesson.description || lesson.tagText || lesson.summaryEn || lesson.descriptionEn || "")) || window.t('lp_product_badge'));
    const localizedCoreContent = toList(window.__vibeResolveLocalizedFieldValue
      ? window.__vibeResolveLocalizedFieldValue(
          lesson,
          "coreContent",
          uiLocale,
          isEn ? (lesson.coreContentEn || lesson.coreContent || []) : (lesson.coreContent || lesson.coreContentEn || [])
        )
      : (isEn ? (lesson.coreContentEn || lesson.coreContent || []) : (lesson.coreContent || lesson.coreContentEn || []))).slice(0, 4);
    const contentList = LP.translateBulletList?.(localizedCoreContent, uiLocale) || localizedCoreContent;
    const listHtml = contentList.length
      ? `<ul class="list-disc pl-5 space-y-1">${contentList.map((x) => `<li>${x}</li>`).join("")}</ul>`
      : `<p class="text-sm text-slate-500">${summary}</p>`;
    const productId = String(lesson.id || lesson.docId || "").toLowerCase();
    const objectPos = productId === "car-intro" ? "50% 50%" : (productId === "car-advanced" ? "50% 28%" : ((productId === "esp32-s3" || productId === "product-esp32-s3") ? "50% 15%" : "50% 50%"));
    const objectScale = productId === "car-advanced" ? "scale(1.08)" : (productId === "car-intro" ? "scale(1.02)" : "scale(1)");
    const imageHtml = imageUrl
      ? `<div class="rounded-xl overflow-hidden border border-slate-200 bg-white mb-3 h-56"><img src="${imageUrl}" alt="${displayTitle}" class="w-full h-full object-cover" style="object-position:${objectPos}; transform:${objectScale};"></div>`
      : "";
    return `
      <div class="lesson-card bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition"
           data-lesson-id="${canonicalDocId}"
           data-course-id="${canonicalDocId}"
           data-auth-doc-id="${canonicalDocId}"
           data-auth-page-id="${canonicalDocId}"
           data-auth-file-name="${unitFile || ""}"
           data-course-name="${displayTitle}"
           data-course-price="${price}"
           data-course-currency="${priceCurrency}"
           data-has-price-data="${hasPriceData}"
        data-is-physical="${LP.isPhysicalMetadataLesson?.(lesson) ? "true" : "false"}"
        data-classroom-url="${entryUrl}">
        <div class="min-w-0 text-xs text-slate-500 mb-2 truncate">${displayKey}</div>
        <h3 class="text-xl font-bold text-slate-800 mb-2">${displayTitle}</h3>
        <div class="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1 inline-block mb-3">${window.t('lp_product_badge')}</div>
        ${imageHtml}
        <div class="text-sm text-slate-700 mb-3">${summary}</div>
        <div class="text-sm text-slate-700 mb-4">
          <strong class="text-slate-900 block mb-1">${window.t('lp_coreContentLabel')}</strong>
          ${listHtml}
        </div>
        ${hasPriceData ? `
        <div class="mt-4 pt-3 border-t border-slate-100 text-center">
          <span class="text-2xl font-bold text-blue-600">${price === 0 ? window.t('lp_freeLabel') : (LP.formatPrice?.(priceEntry, uiLocale) || String(priceEntry?.amount ?? priceEntry ?? 0))}</span>
        </div>
        <div class="mt-3">
          <button class="action-btn w-full py-2 px-3 rounded-md bg-gray-300 text-gray-500 font-medium cursor-not-allowed" disabled>${window.t('lp_loadingText')}</button>
        </div>
        ` : ""}
      </div>
    `;
  }).join("");

  const specsHtml = specsRows.map((spec) => {
    const displayTitle = String(window.__vibeResolveLocalizedFieldValue
      ? window.__vibeResolveLocalizedFieldValue(
          spec,
          "title",
          uiLocale,
          isEn ? (spec.titleEn || LP.inferEnglishTitle?.(spec) || spec.title || "") : (spec.title || spec.titleEn || "")
        )
      : (isEn ? (spec.titleEn || LP.inferEnglishTitle?.(spec) || spec.title || "") : (spec.title || spec.titleEn || "")) || "").trim();
    const specImg = LP.pickImage?.(spec) || "";
    const specSummary = String(window.__vibeResolveLocalizedFieldValue
      ? window.__vibeResolveLocalizedFieldValue(
          spec,
          "summary",
          uiLocale,
          isEn ? (spec.summaryEn || spec.descriptionEn || window.t('lp_spec_summary_fallback')) : (spec.summary || spec.description || "")
        )
      : (isEn ? (spec.summaryEn || spec.descriptionEn || window.t('lp_spec_summary_fallback')) : (spec.summary || spec.description || "")));
    const localizedSpecContent = toList(window.__vibeResolveLocalizedFieldValue
      ? window.__vibeResolveLocalizedFieldValue(
          spec,
          "coreContent",
          uiLocale,
          isEn ? (spec.coreContentEn || spec.coreContent || []) : (spec.coreContent || spec.coreContentEn || [])
        )
      : (isEn ? (spec.coreContentEn || spec.coreContent || []) : (spec.coreContent || spec.coreContentEn || [])));
    const specContentList = LP.translateBulletList?.(localizedSpecContent, uiLocale) || localizedSpecContent;
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
  const isCommon = isCommonPath;
  if (isCommon) {
    if (productHtml) pageHtml += LP.renderSection(window.t('lp_productHeader'), productHtml);
    if (courseHtml) pageHtml += LP.renderSection("", courseHtml);
    if (specsHtml) pageHtml += LP.renderSection(window.t('lp_specsHeader'), specsHtml);
  } else {
    if (courseHtml) pageHtml += LP.renderSection("", courseHtml);
    if (productHtml) pageHtml += LP.renderSection(window.t('lp_productHeader'), productHtml);
    if (specsHtml) pageHtml += LP.renderSection(window.t('lp_specsHeader'), specsHtml);
  }
  container.innerHTML = pageHtml;
  if (typeof window.applyI18n === 'function') window.applyI18n();

  container.querySelectorAll(".video-btn").forEach((btn, i) => {
    const videoUrl = LP.pickVideo?.(rows[i] || {});
    btn.addEventListener("click", () => openVideo(videoUrl));
  });
}

async function loadLessonsForCurrentDistributor() {
  const requestId = ++currentLessonsRequestId;
  const uiLocale = LP.detectUiLocale?.() || "en";
  learningPathState.loading = true;
  try {
    const result = await runWithBackoff(async () => {
      const distributorId = await resolveLessonsDistributorId();
      if (!auth.currentUser && distributorId) {
        persistLocalPreferredDistributorId(distributorId);
      }
      return getLessonsFunc({ distributorId });
    }, {
      label: "getLessonsMetadata",
      attempts: LESSON_LOAD_RETRY_ATTEMPTS,
      baseDelayMs: LESSON_LOAD_RETRY_BASE_DELAY_MS
    });
    if (requestId !== currentLessonsRequestId) return null;
    currentLessons = Array.isArray(result?.data?.lessons) ? result.data.lessons : [];
    categoryLabelsMap = LP.normalizeCategoryLabelsMap?.(result?.data?.categoryLabels || {}, uiLocale) || {};
    window.__vibeLearningPathCategoryLabels = categoryLabelsMap;
    learningPathState.lastSuccessAt = Date.now();
    learningPathState.lastFailureAt = 0;
    renderLessons(currentLessons, currentPathKey);
    return currentLessons;
  } catch (error) {
    learningPathState.lastFailureAt = Date.now();
    throw error;
  } finally {
    learningPathState.loading = false;
  }
}

function refreshLessonsIfEmpty(reason = "signal") {
  if (learningPathState.loading || currentLessons.length > 0) return;
  const now = Date.now();
  if (now - learningPathState.lastRefreshAttemptAt < LESSON_AUTO_REFRESH_COOLDOWN_MS) {
    return;
  }
  learningPathState.lastRefreshAttemptAt = now;
  clearTimeout(learningPathRefreshTimer);
  learningPathRefreshTimer = setTimeout(() => {
    learningPathRefreshTimer = null;
    if (currentLessons.length > 0 || learningPathState.loading) return;
    console.info("[learning-path] refreshing empty lesson list after", reason);
    loadLessonsForCurrentDistributor().catch((error) => {
      console.warn('[learning-path] Failed to refresh lessons after', reason + ':', error);
    });
  }, 150);
}

function bindLessonAutoRefreshSignals() {
  if (learningPathSignalsBound) return;
  learningPathSignalsBound = true;

  window.addEventListener("focus", () => refreshLessonsIfEmpty("focus"));
  window.addEventListener("online", () => refreshLessonsIfEmpty("online"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshLessonsIfEmpty("visibilitychange");
    }
  });
}

async function init() {
  const uiLocale = LP.detectUiLocale?.() || "en";
  window.__vibeLocale = uiLocale;
  document.documentElement.lang = uiLocale.startsWith("en") ? "en" : "zh-Hant";
  currentPathKey = LP.normalizeCanonicalLearningPathKey?.(new URLSearchParams(location.search).get("path") || "common") || "common";
  document.title = LP.categoryLabel?.(currentPathKey, categoryLabelsMap) || "";
  bindLessonAutoRefreshSignals();
  window.updateAuthUI = async function () {
    const cards = document.querySelectorAll(".lesson-card");
    const user = auth.currentUser;
    cards.forEach((card) => {
      if (user) checkLessonAuthorization(card, user);
      else updateCardAction(card, "NOT_LOGGED_IN");
    });
  };
  onAuthStateChanged(auth, async (user) => {
    window.__vibeCurrentAuthUser = user || auth.currentUser || null;
    try {
      await loadLessonsForCurrentDistributor();
    } catch (error) {
      console.warn('[learning-path] Failed to load lessons:', error);
      refreshLessonsIfEmpty("auth-state");
    }
    await window.updateAuthUI();
  });
}
init().catch((error) => {
  console.warn('[learning-path] init failed:', error);
});
window.addEventListener('storage', (event) => {
  if (event.key === 'vibe_user_preferred_distributor') {
    loadLessonsForCurrentDistributor().catch((error) => {
      console.warn('[learning-path] Failed to refresh lessons after distributor change:', error);
    });
    return;
  }
  if (event.key && (event.key === 'adminTutorMode' || event.key.startsWith('adminTutorMode:'))) {
    window.updateAuthUI?.();
  }
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    loadLessonsForCurrentDistributor().catch((error) => {
      console.warn('[learning-path] Failed to refresh lessons after bfcache restore:', error);
    });
  }
});
window.handleLogout = async () => { await signOut(auth); };
