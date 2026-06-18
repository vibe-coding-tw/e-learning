const admin = require("firebase-admin");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");

const { buildI18nFilenameCandidates, normalizeLegacyId, unitIdsMatch } = require("vibe-functions-core/id-utils");
const { getContentRuntimeConfig } = require("vibe-functions-core/runtime-state");
const { loadLessons, normalizeText } = require("vibe-functions-core/access-utils-core");
const dashboardUtils = require("vibe-functions-core/dashboard-utils-core");
const { normalizeCurrency, normalizeLocale } = require("../lib/pricing-utils");
const {
    normalizePriceBookDoc,
    resolveLessonPriceFromBooks
} = require("vibe-functions-core/distributor-pricing");

const CONTENT_REPO_TOKEN = defineSecret("CONTENT_REPO_TOKEN");
const CONTENT_CACHE_COLLECTION = "content_cache";
const CONTENT_FILE_CACHE = new Map();
const COURSE_RUNTIME_VERSION = "20260608-course-title-and-cta-fix";
const {
    cleanUnitId,
    findCourseByPageOrUnit,
    findLessonByCourseRef,
    findParentCourseIdByUnit,
    getCanonicalLessonIdentity,
    getLessonLookupKeys,
    normalizeCourseFile,
    normalizeCourseVariantKey,
    resolveLessonForOrderItem
} = dashboardUtils;

async function readCachedContent(dbRef, cacheKey) {
    if (!cacheKey) return null;

    const now = Date.now();
    const memoryHit = CONTENT_FILE_CACHE.get(cacheKey);
    if (memoryHit && Number(memoryHit.expiresAt || 0) > now && memoryHit.html) {
        return memoryHit;
    }

    const snap = await dbRef.collection(CONTENT_CACHE_COLLECTION).doc(cacheKey).get();
    if (!snap.exists) return null;

    const data = snap.data() || {};
    const expiresAt = Number(data.expiresAt || 0);
    const cached = {
        html: String(data.html || ""),
        contentType: String(data.contentType || "text/html; charset=utf-8"),
        sourcePath: String(data.sourcePath || ""),
        sourceUrl: String(data.sourceUrl || ""),
        expiresAt,
        updatedAt: Number(data.updatedAt || 0)
    };

    if (cached.html) {
        CONTENT_FILE_CACHE.set(cacheKey, cached);
    }

    if (expiresAt > now && cached.html) {
        return cached;
    }

    return cached.html ? cached : null;
}

function buildContentCacheKey({ repoOwner, repoName, ref, locale, contentPath } = {}) {
    return crypto.createHash("md5").update([
        normalizeText(repoOwner),
        normalizeText(repoName),
        normalizeText(ref),
        normalizeText(locale),
        normalizeText(contentPath)
    ].join("|")).digest("hex");
}

function resolvePreferredLocales(runtimeConfig = null, req = null) {
    const queryLocale = normalizeLocale(req?.query?.lang || req?.query?.locale || "");
    const header = String(req?.headers?.["accept-language"] || "");
    const headerPrimary = normalizeLocale(header.split(",")[0] || "");
    
    const chain = [];
    if (queryLocale) chain.push(queryLocale);
    if (headerPrimary && !chain.includes(headerPrimary)) chain.push(headerPrimary);

    const primaryLang = chain[0] || "";
    const isPrimaryZh = primaryLang.toLowerCase().startsWith("zh");

    // Order backup locales based on the primary requested language
    const fallbacks = isPrimaryZh ? ["zh-TW", "en"] : ["en", "zh-TW"];
    
    const defaultLocale = normalizeLocale(runtimeConfig?.defaultLocale || "");
    if (defaultLocale && !fallbacks.includes(defaultLocale)) {
        fallbacks.unshift(defaultLocale);
    }

    for (const locale of fallbacks) {
        if (!chain.includes(locale)) {
            chain.push(locale);
        }
    }

    return chain;
}

async function fetchExternalCourseContentHelper(candidateFileName, runtimeConfig, locales, dbRef) {
    if (!runtimeConfig?.enabled) return null;
    const contentRepoToken = CONTENT_REPO_TOKEN.value();
    if (!contentRepoToken) {
        console.warn("[content-runtime] CONTENT_REPO_TOKEN missing, skip external fetch.");
        return null;
    }

    const repoOwner = runtimeConfig.repoOwner;
    const repoName = runtimeConfig.repoName;
    const ref = runtimeConfig.contentVersion || "main";
    const candidate = normalizeCourseFile(candidateFileName);
    const exactPath = normalizeText(candidateFileName).replace(/^\/+/, "");
    const exactPathCandidates = [];
    if (exactPath.includes("/")) exactPathCandidates.push(exactPath);

    for (const locale of locales) {
        const localeCandidates = buildI18nFilenameCandidates(candidate, locale);
        for (const localeCandidate of localeCandidates) {
            // Check if the candidate is one of the user guide files (students.html / tutors.html)
            const isGuide = localeCandidate === "tutors.html" || localeCandidate === "students.html";
            const targetLocale = locale === "en" ? "en" : "zh-TW";
            const pathPrefix = isGuide ? `public/${targetLocale}` : `courses/${locale}`;
            exactPathCandidates.push(`${pathPrefix}/${localeCandidate}`);
        }
    }

    const tried = Array.from(new Set([
        ...exactPathCandidates,
        ...locales.flatMap((locale) => buildI18nFilenameCandidates(candidate, locale).map((localeCandidate) => {
            const isGuide = localeCandidate === "tutors.html" || localeCandidate === "students.html";
            const targetLocale = locale === "en" ? "en" : "zh-TW";
            const pathPrefix = isGuide ? `public/${targetLocale}` : `courses/${locale}`;
            return `${pathPrefix}/${localeCandidate}`;
        }))
    ]));

    for (const contentPath of tried) {
        const cacheKey = buildContentCacheKey({
            repoOwner,
            repoName,
            ref,
            locale: contentPath.split("/")[1] || "",
            contentPath
        });

        const cached = await readCachedContent(dbRef, cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return { content: cached.html, source: "external-cache", locale: cached.locale || "", file: cached.sourcePath || contentPath };
        }

        const apiUrl = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${contentPath}?ref=${encodeURIComponent(ref)}`;
        try {
            const startedAt = Date.now();
            const resp = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${contentRepoToken}`,
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "vibe-coding-runtime"
                }
            });
            if (!resp.ok) {
                if (resp.status !== 404) {
                    console.warn(`[content-runtime] external fetch non-404: ${resp.status} ${contentPath}`);
                }
                continue;
            }
            const payload = await resp.json();
            const encoded = String(payload?.content || "").replace(/\n/g, "");
            if (!encoded) continue;
            const content = Buffer.from(encoded, "base64").toString("utf8");
            const expiresAt = Date.now() + (Math.max(30, Number(runtimeConfig.cacheTtlSec || 300)) * 1000);
            const cachePayload = {
                html: content,
                contentType: "text/html; charset=utf-8",
                sourcePath: contentPath,
                sourceUrl: apiUrl,
                expiresAt,
                updatedAt: Date.now()
            };
            CONTENT_FILE_CACHE.set(cacheKey, cachePayload);
            dbRef.collection(CONTENT_CACHE_COLLECTION).doc(cacheKey).set(cachePayload, { merge: true }).catch(err => {
                console.warn(`[content-runtime] Firestore cache write error:`, err.message || err);
            });
            console.log(`[content-runtime] source=external file=${contentPath} ms=${Date.now() - startedAt}`);
            return { content, source: "external", locale: contentPath.split("/")[1] || "", file: contentPath };
        } catch (err) {
            console.warn(`[content-runtime] external fetch failed for ${contentPath}:`, err.message || err);
        }
    }

    return null;
}

async function getLessons(dbRef, options = {}) {
    const currencyHint = normalizeCurrency(options.currencyHint || "", "");
    const lessons = await loadLessons(dbRef);
    const priceBooksSnap = await dbRef.collection("dealer_price_books").get();
    const booksByDocId = new Map();
    const normalizePriceKey = (value = "") => normalizeText(value).replace(/\.html$/i, "");

    priceBooksSnap.forEach((doc) => {
        const data = normalizePriceBookDoc(doc.data() || {}, { docId: doc.id });
        if (data.isActive === false) return;
        const docKey = normalizePriceKey(data.docId || doc.id || "");
        if (!docKey) return;
        if (!booksByDocId.has(docKey)) booksByDocId.set(docKey, []);
        booksByDocId.get(docKey).push({ id: doc.id, ...data });
    });

    return lessons.map((lesson) => {
        const canonicalId = normalizePriceKey(lesson.id || lesson.docId || lesson.courseId || lesson.courseKey);
        const priceBooks = booksByDocId.get(canonicalId) || booksByDocId.get(normalizePriceKey(lesson.docId || "")) || [];
        const priceEntry = resolveLessonPriceFromBooks(priceBooks, currencyHint || lesson.dealerCurrency || lesson.currency || "");
        return {
            ...lesson,
            courseId: lesson.courseId || canonicalId,
            courseKey: lesson.courseKey || canonicalId,
            dealerPrice: priceEntry.hasPriceData === true ? Number(priceEntry.amount) : null,
            dealerCurrency: normalizeCurrency(
                priceEntry.currency || lesson.dealerCurrency || lesson.currency || "",
                ""
            ),
            dealerPriceBookId: priceEntry.priceBookId || lesson.dealerPriceBookId || "",
            dealerPriceBookLessonId: priceEntry.priceBook?.docId || lesson.dealerPriceBookLessonId || "",
        };
    });
}

function buildAuthorizedFileCandidates(course = {}, locales = []) {
    const candidates = new Set();
    const addCandidate = (value = "") => {
        const normalized = normalizeCourseFile(value);
        if (normalized) candidates.add(normalizeCourseVariantKey(normalized));
    };

    const localeList = Array.from(new Set([...(locales || []), "zh-TW", "en"]));
    const addLegacyAndI18n = (value = "") => {
        const normalized = normalizeCourseFile(value);
        if (!normalized) return;
        addCandidate(normalized);
        for (const locale of localeList) {
            for (const alt of buildI18nFilenameCandidates(normalized, locale)) {
                addCandidate(alt);
            }
        }
    };

    addLegacyAndI18n(course.entryUnitId || "");
    addLegacyAndI18n(course.classroomUrl || "");
    addLegacyAndI18n(course.contentRef || "");
    (Array.isArray(course.courseUnits) ? course.courseUnits : []).forEach(unitId => addLegacyAndI18n(unitId));

    return candidates;
}

async function resolveCourseHtml({ dbRef, requestPath, tokenData, req }) {
    const runtimeConfig = await getContentRuntimeConfig(dbRef);
    const localeHint = normalizeLocale(req?.query?.lang || req?.query?.locale || runtimeConfig?.defaultLocale || "");
    const currencyHint = localeHint === "en" ? "USD" : "TWD";
    const lessons = await getLessons(dbRef, { currencyHint });
    const fileName = normalizeCourseFile(requestPath);
    const locales = resolvePreferredLocales(runtimeConfig, req);
    const course = findCourseByPageOrUnit(tokenData?.pageId || "", tokenData?.fileName || fileName, lessons)
        || findLessonByCourseRef(tokenData?.pageId || "", lessons)
        || findLessonByCourseRef(tokenData?.fileName || "", lessons)
        || findLessonByCourseRef(fileName, lessons);

    const requestedCourseId = normalizeCourseVariantKey(tokenData?.pageId || "");
    const requestedFileId = normalizeCourseVariantKey(tokenData?.fileName || fileName);
    const courseId = normalizeCourseVariantKey(course?.courseId || course?.courseKey || course?.contentRef || course?.entryUnitId || "");
    const courseLevelRequest = !!course && (
        (requestedCourseId && requestedCourseId === courseId) ||
        (requestedFileId && requestedFileId === courseId)
    );
    const primaryServeName = courseLevelRequest
        ? normalizeCourseFile(course?.contentRef || course?.entryUnitId || (Array.isArray(course?.courseUnits) ? course.courseUnits[0] : "") || fileName)
        : fileName;

    const candidateNames = new Set();
    const addCandidate = (value = "") => {
        const normalized = normalizeCourseFile(value);
        if (normalized) candidateNames.add(normalized);
    };

    addCandidate(primaryServeName);
    addCandidate(fileName);
    addCandidate(tokenData?.pageId || "");
    addCandidate(tokenData?.fileName || "");
    addCandidate(course?.contentRef || "");
    addCandidate(course?.entryUnitId || "");
    if (Array.isArray(course?.courseUnits)) {
        course.courseUnits.forEach(addCandidate);
    }

    const authorizedCandidates = buildAuthorizedFileCandidates(course || {}, locales);
    for (const candidate of authorizedCandidates) {
        addCandidate(candidate);
    }

    const tried = [];
    for (const candidate of candidateNames) {
        const hit = await fetchExternalCourseContentHelper(candidate, runtimeConfig, locales, dbRef);
        tried.push({ contentPath: candidate });
        if (hit && hit.content) {
            return {
                ok: true,
                html: hit.content,
                contentType: "text/html; charset=utf-8",
                sourcePath: candidate,
                sourceUrl: "",
                cacheHit: hit.source === "external-cache"
            };
        }
    }

    return { ok: false, tried };
}

function injectCourseRuntimeShell(html = "") {
    let content = String(html || "");
    if (!content) return content;

    const courseSharedUrl = `/js/course-shared.js?v=${COURSE_RUNTIME_VERSION}`;
    const navComponentUrl = `/js/nav-component.js?v=${COURSE_RUNTIME_VERSION}`;
    content = content
        .replace(/\/js\/course-shared(?:\.[a-z0-9]+)?\.js(?:\?[^"'<>]*)?/gi, courseSharedUrl)
        .replace(/\/js\/nav-component(?:\.[a-z0-9]+)?\.js(?:\?[^"'<>]*)?/gi, navComponentUrl);

    const runtimeScripts = [];
    const hasStableCourseSharedScript = content.includes(courseSharedUrl);
    const hasStableNavComponentScript = content.includes(navComponentUrl);

    if (!hasStableCourseSharedScript) {
        runtimeScripts.push(`<script src="${courseSharedUrl}"></script>`);
    }
    if (!hasStableNavComponentScript) {
        runtimeScripts.push(`<script type="module" src="${navComponentUrl}"></script>`);
    }

    const runtimeScriptBlock = runtimeScripts.length
        ? `\n<!-- [Runtime Script Fallback] -->\n${runtimeScripts.join("\n")}\n`
        : "";

    const bootstrapper = `
<!-- [Firebase Course Runtime Bootstrap] -->
<script type="module">
    import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
    import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
    import { firebaseConfig } from "/js/firebase-local.js?v=3";

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    window.vibeApp = app;
    window.getFunctions = getFunctions;
    window.httpsCallable = httpsCallable;
    window.resizeIframe = (obj) => {
        if (obj && obj.contentWindow) {
            obj.style.height = obj.contentWindow.document.documentElement.scrollHeight + "px";
        }
    };
    console.log("[Firebase] Course runtime bootstrap initialized");
</script>
`;

    const injection = `${runtimeScriptBlock}${bootstrapper}`;
    if (/<\/body>/i.test(content)) {
        return content.replace(/<\/body>/i, `${injection}</body>`);
    }
    return content + injection;
}

module.exports = {
    getLessonLookupKeys,
    getCanonicalLessonIdentity,
    findLessonByCourseRef,
    resolveLessonForOrderItem,
    cleanUnitId,
    readCachedContent,
    normalizeCourseFile,
    normalizeCourseVariantKey,
    resolvePreferredLocales,
    fetchExternalCourseContentHelper,
    findCourseByPageOrUnit,
    buildAuthorizedFileCandidates,
    resolveCourseHtml,
    injectCourseRuntimeShell,
    findParentCourseIdByUnit,
    getLessons
};
