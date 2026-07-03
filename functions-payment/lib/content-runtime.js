"use strict";
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const fs = require("fs");
const path = require("path");

const { buildI18nFilenameCandidates, normalizeLegacyId, unitIdsMatch } = require("vibe-functions-core/id-utils");
const logger = require("firebase-functions/logger");
const { getContentRuntimeConfig } = require("vibe-functions-core/runtime-state");
const { loadLessons, normalizeText } = require("vibe-functions-core/access-utils-core");
const dashboardUtils = require("vibe-functions-core/dashboard-utils-core");
const { normalizeCurrency, normalizeLocale } = require("../lib/pricing-utils");
const {
    normalizePriceBookDoc,
    resolveLessonPriceFromBooks
} = require("vibe-functions-core/distributor-pricing");

const CONTENT_REPO_TOKEN = defineSecret("CONTENT_REPO_TOKEN");
const COURSE_RUNTIME_VERSION = "20260701-fix-undefined-buttons";
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

function resolveLessonForOrderItemRuntime(itemKey = "", lessons = []) {
    if (!itemKey) return null;
    const candidates = new Set([
        itemKey,
        String(itemKey).replace(/\.html$/i, ""),
        normalizeText(itemKey).replace(/\.html$/i, ""),
        normalizeLegacyId(itemKey),
        cleanUnitId(itemKey),
        normalizeCourseVariantKey(itemKey)
    ]);

    return lessons.find((lesson) => {
        const keys = getLessonLookupKeys(lesson);
        for (const candidate of candidates) {
            if (candidate && keys.has(candidate)) return true;
        }
        return false;
    }) || findCourseByPageOrUnit(itemKey, itemKey, lessons);
}

function resolvePreferredLocales(runtimeConfig = null, req = null) {
    const queryLocale = normalizeLocale(req?.query?.lang || req?.query?.locale || "");
    const header = String(req?.headers?.["accept-language"] || "");
    const headerPrimary = normalizeLocale(header.split(",")[0] || "");

    const chain = [];
    if (queryLocale) chain.push(queryLocale);
    if (headerPrimary && !chain.includes(headerPrimary)) chain.push(headerPrimary);

    const configuredLocale = normalizeLocale(runtimeConfig?.defaultLocale || "");
    if (!chain.length && configuredLocale) {
        chain.push(configuredLocale);
    }

    return chain.length ? chain : ["en"];
}

async function fetchExternalCourseContentHelper(candidateFileName, runtimeConfig, locales) {
    const candidate = normalizeCourseFile(candidateFileName);
    const exactPath = normalizeText(candidateFileName).replace(/^\/+/, "");
    const exactPathCandidates = [];
    if (exactPath.includes("/")) exactPathCandidates.push(exactPath);

    for (const locale of locales) {
        const localeCandidates = buildI18nFilenameCandidates(candidate, locale);
        for (const localeCandidate of localeCandidates) {
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

    if (process.env.FUNCTIONS_EMULATOR === "true" || !!process.env.FIREBASE_EMULATOR_HUB) {
        for (const contentPath of tried) {
            const localPath = path.join("/Users/roverchen/Documents/Apps/content-repo", contentPath);
            if (fs.existsSync(localPath)) {
                try {
                    const content = fs.readFileSync(localPath, "utf8");
                    logger.info(`[content-runtime] [Emulator] Serve local content from: ${localPath}`);
                    return {
                        content,
                        source: "local-emulator",
                        locale: contentPath.split("/")[1] || "",
                        file: contentPath
                    };
                } catch (err) {
                    logger.warn(`[content-runtime] [Emulator] Read local file failed: ${localPath}`, err);
                }
            }
        }
    }

    if (!runtimeConfig?.enabled) return null;
    const contentRepoToken = CONTENT_REPO_TOKEN.value();
    if (!contentRepoToken) {
        logger.warn("[content-runtime] CONTENT_REPO_TOKEN missing.");
        return null;
    }

    const repoOwner = runtimeConfig.repoOwner;
    const repoName = runtimeConfig.repoName;
    const ref = runtimeConfig.contentVersion || "main";

    for (const contentPath of tried) {
        const apiUrl = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${contentPath}?ref=${encodeURIComponent(ref)}`;
        try {
            const resp = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${contentRepoToken}`,
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "vibe-coding-runtime"
                }
            });
            if (!resp.ok) continue;
            const payload = await resp.json();
            const encoded = String(payload?.content || "").replace(/\n/g, "");
            if (!encoded) continue;
            const content = Buffer.from(encoded, "base64").toString("utf8");
            return { content, source: "external", locale: contentPath.split("/")[1] || "", file: contentPath };
        } catch (err) {
            logger.warn(`[content-runtime] external fetch failed for ${contentPath}:`, err.message || err);
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
        const hit = await fetchExternalCourseContentHelper(candidate, runtimeConfig, locales);
        tried.push({ contentPath: candidate });
        if (hit && hit.content) {
            return {
                ok: true,
                html: hit.content,
                contentType: "text/html; charset=utf-8",
                sourcePath: candidate,
                sourceUrl: "",
                cacheHit: false
            };
        }
    }

    return { ok: false, tried };
}

function injectCourseRuntimeShell(html = "") {
    let content = String(html || "");
    if (!content) return content;

    const i18nHelperUrl = `/js/i18n-helper.js?v=${COURSE_RUNTIME_VERSION}`;
    const courseSharedUrl = `/js/course-shared.js?v=${COURSE_RUNTIME_VERSION}`;
    const navComponentUrl = `/js/nav-component.js?v=${COURSE_RUNTIME_VERSION}`;
    content = content
        .replace(/\/js\/i18n-helper(?:\.[a-z0-9]+)?\.js(?:\?[^"'<>]*)?/gi, i18nHelperUrl)
        .replace(/\/js\/course-shared(?:\.[a-z0-9]+)?\.js(?:\?[^"'<>]*)?/gi, courseSharedUrl)
        .replace(/\/js\/nav-component(?:\.[a-z0-9]+)?\.js(?:\?[^"'<>]*)?/gi, navComponentUrl);

    const runtimeScripts = [];
    const hasStableI18nHelperScript = content.includes(i18nHelperUrl);
    const hasStableCourseSharedScript = content.includes(courseSharedUrl);
    const hasStableNavComponentScript = content.includes(navComponentUrl);

    if (!hasStableI18nHelperScript) {
        runtimeScripts.push(`<script src="${i18nHelperUrl}"></script>`);
    }
    if (!hasStableCourseSharedScript) {
        runtimeScripts.push(`<script src="${courseSharedUrl}"></script>`);
    }
    if (!hasStableNavComponentScript) {
        runtimeScripts.push(`<script type="module" src="${navComponentUrl}"></script>`);
    }

    const runtimeScriptBlock = runtimeScripts.length
        ? `\n${runtimeScripts.join("\n")}\n`
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
    resolveLessonForOrderItem: resolveLessonForOrderItemRuntime,
    cleanUnitId,
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
