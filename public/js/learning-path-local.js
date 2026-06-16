function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function renderLessons(lessons, pathKey, categoryLabelsMap = {}) {
  const uiLocale = LP.detectUiLocale?.() || "en";
  const container = document.getElementById("lesson-container");
  const title = document.getElementById("page-title");
  const pageTitleText = LP.categoryLabel?.(pathKey, categoryLabelsMap, uiLocale) || String(pathKey || "");
  const t = uiLocale.startsWith("en")
    ? {
        productHeader: "Products",
        coreContentLabel: "Core Content:",
        freeLabel: "Free",
        emptyCategory: "No courses available in this category yet.",
      }
    : {
        productHeader: "產品",
        coreContentLabel: "核心內容：",
        freeLabel: "免費",
        emptyCategory: "目前此分類尚無課程。",
      };

  if (title) {
    title.textContent = pageTitleText;
    title.setAttribute("data-path-title", LP.categoryLabel?.(pathKey, categoryLabelsMap, uiLocale) || String(pathKey || ""));
  }
  document.title = pageTitleText;
  const sections = LP.buildLearningPathSections?.(lessons, pathKey, uiLocale) || {
    rows: [],
    productRows: [],
    specsRows: [],
    isCommonPath: LP.normalizeCanonicalLearningPathKey?.(pathKey) === "common",
  };
  const { rows = [], productRows = [], hardwareRows = [], specsRows = [], isCommonPath = false } = sections;
  const productEntries = productRows.length ? productRows : hardwareRows;

  if (!rows.length && !productEntries.length && !specsRows.length && !isCommonPath) {
    container.innerHTML = `<p class="text-center text-gray-500 w-full col-span-3 py-12">${t.emptyCategory}</p>`;
    return;
  }

  const courseHtml = rows.map((lesson) => {
    const entryUrl = LP.resolveEntryUrl?.(lesson) || (lesson.classroomUrl || "");
    const unitFile = LP.resolveUnitFile?.(lesson) || "";
    const displayKey = LP.categoryLabel?.(pathKey, categoryLabelsMap, uiLocale) || String(pathKey || "");
    const isEn = String(uiLocale || "").toLowerCase().startsWith("en");
    const displayTitle = LP.resolveLessonCardTitle?.(lesson, uiLocale) || String(lesson.title || lesson.titleEn || "");
    const localizedCoreContent = toList(window.__vibeResolveLocalizedFieldValue
      ? window.__vibeResolveLocalizedFieldValue(lesson, "coreContent", uiLocale, isEn ? (lesson.coreContentEn || []) : lesson.coreContent || [])
      : (isEn ? (lesson.coreContentEn || []) : lesson.coreContent || [])).slice(0, 4);
    const contentList = LP.translateBulletList?.(localizedCoreContent, uiLocale) || localizedCoreContent;
    const summary = LP.resolveLessonCardSummary?.(lesson, uiLocale) || (isEn ? "English translation pending." : "課程內容由本機資料載入。");
    const duration = String(lesson.duration || lesson.estimatedDuration || "");
    const lessonLabel = LP.resolveLessonLabel?.(lesson, uiLocale) || String(lesson.lessonLabel || lesson.tagText || "");
    const displayLessonLabel = lessonLabel || (isEn ? "Course Unit" : "課程單元");
    const icon = String(lesson.cardIcon || lesson.icon || "📘");
    const imageUrl = LP.pickImage?.(lesson) || "";
    const priceEntry = window.vibePricing?.resolveLessonPrice ? window.vibePricing.resolveLessonPrice(lesson) : { amount: Number(lesson.dealerPrice ?? 0), currency: String(lesson.dealerCurrency || lesson.currency || "").toUpperCase() };
    const price = Number(priceEntry.amount || 0);
    const priceCurrency = String(priceEntry.currency || "");
    const hasPriceData = priceEntry.hasPriceData === true || lesson.dealerPriceBookId != null;
    const imageHtml = imageUrl
      ? `<div class="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 mb-3"><img src="${imageUrl}" alt="${displayTitle || "course"}" class="w-full h-40 object-cover"></div>`
      : "";
    const listHtml = contentList.length
      ? `<ul class="list-disc pl-5 space-y-1">${contentList.map((x) => `<li>${x}</li>`).join("")}</ul>`
      : `<p class="text-sm text-slate-500">${summary}</p>`;
    return `
      <div class="lesson-card bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition"
           data-lesson-id="${lesson.id || lesson.docId || ""}"
           data-course-id="${lesson.id || lesson.docId || ""}"
           data-auth-page-id="${Array.isArray(lesson.courseUnits) && lesson.courseUnits.length > 0 ? String(lesson.courseUnits[0] || "").split("/").pop().split("?")[0] : ""}"
           data-auth-file-name="${unitFile || ""}"
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
        <h2 class="text-xl font-bold text-slate-800 mb-2">${displayTitle || lesson.id || lesson.docId || "Untitled Course"}</h2>
        <div class="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1 inline-block mb-3">${displayLessonLabel}</div>
        ${imageHtml}
        <div class="text-sm text-slate-700 mb-3"><span class="mr-2">${icon}</span>${summary}</div>
        <div class="text-sm text-slate-700 mb-4">
          <strong class="text-slate-900 block mb-1">${t.coreContentLabel}</strong>
          ${listHtml}
        </div>
        ${hasPriceData ? `
        <div class="mt-4 pt-3 border-t border-slate-100 text-center">
          <span class="text-2xl font-bold text-blue-600">${price === 0 ? t.freeLabel : (LP.formatPrice?.(priceEntry, uiLocale) || String(priceEntry?.amount ?? priceEntry ?? 0))}</span>
        </div>
        ${entryUrl ? `<div class="mt-3"><a href="${entryUrl}" class="block w-full py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-center transition">查看內容</a></div>` : ""}
        ` : ""}
      </div>
    `;
  }).join("");

  const productHtml = productEntries.map((lesson) => {
    const entryUrl = LP.resolveEntryUrl?.(lesson) || (lesson.classroomUrl || "");
    const unitFile = LP.resolveUnitFile?.(lesson) || "";
    const priceEntry = window.vibePricing?.resolveLessonPrice ? window.vibePricing.resolveLessonPrice(lesson) : { amount: Number(lesson.dealerPrice ?? 0), currency: String(lesson.dealerCurrency || lesson.currency || "").toUpperCase() };
    const price = Number(priceEntry.amount || 0);
    const priceCurrency = String(priceEntry.currency || "");
    const hasPriceData = priceEntry.hasPriceData === true || lesson.dealerPriceBookId != null;
    const displayKey = LP.categoryLabel?.(pathKey, categoryLabelsMap, uiLocale) || String(pathKey || "");
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
      : (isEn ? (lesson.summaryEn || lesson.descriptionEn || lesson.summary || lesson.description || lesson.tagText || "") : (lesson.summary || lesson.description || lesson.tagText || lesson.summaryEn || lesson.descriptionEn || "")) || "產品");
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
           data-lesson-id="${lesson.id || lesson.docId || ""}"
           data-course-id="${lesson.id || lesson.docId || ""}"
           data-auth-page-id="${Array.isArray(lesson.courseUnits) && lesson.courseUnits.length > 0 ? String(lesson.courseUnits[0] || "").split("/").pop().split("?")[0] : ""}"
           data-auth-file-name="${unitFile || ""}"
           data-course-name="${displayTitle}"
           data-course-price="${price}"
           data-course-currency="${priceCurrency}"
           data-has-price-data="${hasPriceData}"
           data-is-physical="${LP.isPhysicalMetadataLesson?.(lesson) ? "true" : "false"}"
           data-classroom-url="${entryUrl}">
        <div class="min-w-0 text-xs text-slate-500 mb-2 truncate">${displayKey}</div>
        <h3 class="text-xl font-bold text-slate-800 mb-2">${displayTitle}</h3>
        ${imageHtml}
        <div class="text-sm text-slate-700 mb-4">${listHtml}</div>
        ${hasPriceData ? `
        <div class="mt-4 pt-3 border-t border-slate-100 text-center">
          <span class="text-2xl font-bold text-blue-600">${price === 0 ? t.freeLabel : (LP.formatPrice?.(priceEntry, uiLocale) || String(priceEntry?.amount ?? priceEntry ?? 0))}</span>
        </div>
        ${entryUrl ? `<div class="mt-3"><a href="${entryUrl}" class="block w-full py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-center transition">查看內容</a></div>` : ""}
        ` : ""}
      </div>
    `;
  }).join("");

  const specsHtml = specsRows.map((spec) => {
    const isEn = String(uiLocale || "").toLowerCase().startsWith("en");
    const displayTitle = isEn
      ? String(spec.titleEn || (LP.inferEnglishTitle?.(spec) || "") || spec.title || "").trim()
      : String((window.__vibeResolveLocalizedFieldValue
        ? window.__vibeResolveLocalizedFieldValue(spec, "title", uiLocale, spec.title || "")
        : spec.title) || "");
    const specImg = LP.pickImage?.(spec) || "";
    const specSummary = isEn
      ? String(spec.summaryEn || spec.descriptionEn || "Computer Spec Recommendations")
      : String((window.__vibeResolveLocalizedFieldValue
        ? window.__vibeResolveLocalizedFieldValue(spec, "summary", uiLocale, spec.summary || spec.description || "")
        : (spec.summary || spec.description || "")));
    const localizedSpecContent = toList(window.__vibeResolveLocalizedFieldValue
      ? window.__vibeResolveLocalizedFieldValue(spec, "coreContent", uiLocale, isEn ? (spec.coreContentEn || spec.coreContent) : spec.coreContent || [])
      : (isEn ? (spec.coreContentEn || spec.coreContent) : spec.coreContent || []));
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
  const isCommon = LP.normalizeCanonicalLearningPathKey?.(pathKey) === "common";
  if (isCommon) {
    if (productHtml) pageHtml += LP.renderSection(t.productHeader, productHtml);
    if (courseHtml) pageHtml += LP.renderSection("", courseHtml);
    if (specsHtml) pageHtml += LP.renderSection(window.t('lp_specsHeader', '電腦規格推薦'), specsHtml);
  } else {
    if (courseHtml) pageHtml += LP.renderSection("", courseHtml);
    if (productHtml) pageHtml += LP.renderSection(t.productHeader, productHtml);
    if (specsHtml) pageHtml += LP.renderSection(window.t('lp_specsHeader', '電腦規格推薦'), specsHtml);
  }
  container.innerHTML = pageHtml || `<p class="text-center text-gray-500 py-12">${t.emptyCategory}</p>`;
}

async function loadLessonsFromFirestore() {
  const fetchLessons = window.__getLessonsMetadata;
  if (typeof fetchLessons !== "function") {
    throw new Error("Lessons metadata loader is not ready");
  }

  const payload = await fetchLessons();
  if (Array.isArray(payload?.lessons)) return payload;
  if (Array.isArray(payload)) return { lessons: payload, categoryLabels: {} };
  return { lessons: [], categoryLabels: {} };
}

async function initLocalLearningPath() {
  if (window.__learningPathLocalInitialized) return;
  window.__learningPathLocalInitialized = true;

  try {
    const uiLocale = LP.detectUiLocale?.() || "en";
    const params = new URLSearchParams(location.search);
    const pathKey = LP.normalizeCanonicalLearningPathKey?.(params.get("path") || "common") || "common";
    document.documentElement.lang = uiLocale.startsWith("en") ? "en" : "zh-Hant";
    document.title = LP.categoryLabel?.(pathKey, {}) || String(pathKey || "");
    const payload = await loadLessonsFromFirestore();
    const lessons = Array.isArray(payload?.lessons) ? payload.lessons : [];
    const categoryLabelsMap = payload?.categoryLabels || {};
    renderLessons(lessons, pathKey, categoryLabelsMap);
  } catch (error) {
    console.error("[learning-path-local] failed to render lessons from Firestore", error);
  }
}

initLocalLearningPath();
setTimeout(initLocalLearningPath, 1200);
setTimeout(initLocalLearningPath, 3000);
