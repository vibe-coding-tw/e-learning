const admin = require("firebase-admin");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");

const { buildI18nFilenameCandidates, normalizeLegacyId, unitIdsMatch } = require("../lib/id-utils");
const { getContentRuntimeConfig } = require("../lib/runtime-state");
const { normalizeCurrency } = require("../lib/pricing-utils");

const CONTENT_REPO_TOKEN = defineSecret("CONTENT_REPO_TOKEN");
const CONTENT_CACHE_COLLECTION = "content_cache";
const CONTENT_FILE_CACHE = new Map();
const COURSE_RUNTIME_VERSION = "20260608-course-title-and-cta-fix";

function normalizeText(value = "") {
    return String(value ?? "").trim();
}

function normalizeLocale(value = "") {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    if (/^zh[-_]tw$/i.test(raw)) return "zh-TW";
    if (/^zh/i.test(raw)) return "zh-TW";
    if (/^en/i.test(raw)) return "en";
    return "";
}

function toCourseKey(value = "") {
    return normalizeLegacyId(String(value || "").split("/").pop().split("?")[0]);
}

function getLessonLookupKeys(lesson = {}) {
    const keys = new Set();
    const add = (value) => {
        const clean = toCourseKey(value);
        const variant = normalizeCourseVariantKey(value);
        if (clean) {
            keys.add(clean);
            keys.add(clean.replace(/\.html$/i, ""));
        }
        if (variant) {
            keys.add(variant);
            keys.add(variant.replace(/\.html$/i, ""));
        }
    };

    add(lesson.id);
    add(lesson.docId);
    add(lesson.courseId);
    add(lesson.courseKey);
    add(lesson.entryUnitId);
    add(lesson.classroomUrl);
    if (Array.isArray(lesson.aliases)) lesson.aliases.forEach(add);
    if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);
    return Array.from(keys);
}

function getCanonicalLessonIdentity(lesson = {}) {
    return normalizeText(lesson.id || lesson.docId || lesson.courseId || lesson.courseKey || lesson.entryUnitId || "");
}

function findLessonByCourseRef(courseRef = "", lessons = []) {
    const target = normalizeCourseVariantKey(courseRef) || toCourseKey(courseRef);
    if (!target) return null;
    const targetBare = target.replace(/\.html$/i, "");
    const arr = Array.isArray(lessons) ? lessons : [];

    let matched = arr.find((lesson) => {
        if (lesson.hiddenFromCatalog === true) return false;
        const keys = getLessonLookupKeys(lesson);
        return keys.includes(target) || keys.includes(targetBare);
    });

    if (!matched) {
        matched = arr.find((lesson) => {
            const keys = getLessonLookupKeys(lesson);
            return keys.includes(target) || keys.includes(targetBare);
        });
    }
    return matched || null;
}

function resolveLessonForOrderItem(itemKey = "", lessons = []) {
    return findLessonByCourseRef(itemKey, lessons);
}

function cleanUnitId(value = "") {
    return normalizeLegacyId(value).replace(/^(?:tw|en)-/, "");
}

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

async function writeCachedContent(dbRef, cacheKey, payload = {}, ttlSec = 300) {
    if (!cacheKey || !payload.html) return;
    const now = Date.now();
    const expiresAt = now + Math.max(30, Number(ttlSec || 300)) * 1000;
    const cached = {
        html: String(payload.html || ""),
        contentType: String(payload.contentType || "text/html; charset=utf-8"),
        sourcePath: String(payload.sourcePath || ""),
        sourceUrl: String(payload.sourceUrl || ""),
        expiresAt,
        updatedAt: now
    };

    CONTENT_FILE_CACHE.set(cacheKey, cached);
    await dbRef.collection(CONTENT_CACHE_COLLECTION).doc(cacheKey).set(cached, { merge: true });
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

function normalizeCourseFile(value = "") {
    if (!value) return value;
    return String(value).split("/").pop().split("?")[0];
}

function normalizeCourseVariantKey(value = "") {
    const filePart = normalizeCourseFile(value);
    if (!filePart) return "";
    const bare = String(filePart)
        .replace(/\.html$/i, "")
        .replace(/^(?:tw|en)-/i, "")
        .toLowerCase();

    if (/^start-\d{2}-unit-/i.test(bare)) return bare.replace(/^start-\d{2}-unit-/i, "car-starter-");
    if (/^basic-\d{2}-unit-/i.test(bare)) return bare.replace(/^basic-\d{2}-unit-/i, "car-basic-");
    if (/^(?:adv|advanced)-\d{2}-unit-/i.test(bare)) return bare.replace(/^(?:adv|advanced)-\d{2}-unit-/i, "car-advanced-");
    if (/^\d{2}-unit-/i.test(bare)) return bare.replace(/^\d{2}-unit-/i, "common-");
    if (/^prepare-\d+-(.+)$/i.test(bare)) return bare.replace(/^prepare-\d+-/, "common-");
    return bare;
}

function mapLegacyMasterToCanonical(value = "") {
    const file = normalizeCourseFile(value);
    if (!file) return file;
    if (/^01-master-/i.test(file)) return file.replace(/^01-master-/i, "01-unit-");
    if (/^02-master-/i.test(file)) return file.replace(/^02-master-/i, "02-unit-");
    if (/^03-master-/i.test(file)) return file.replace(/^03-master-/i, "03-unit-");
    if (/^start-\d{2}-master-/i.test(file)) return file.replace(/^start-\d{2}-master-/i, "start-");
    if (/^basic-\d{2}-master-/i.test(file)) return file.replace(/^basic-\d{2}-master-/i, "basic-");
    if (/^(?:adv|advanced)-\d{2}-master-/i.test(file)) return file.replace(/^(?:adv|advanced)-\d{2}-master-/i, "adv-");
    return file;
}

function isLegacyMasterPage(value = "") {
    return /(?:^|-)master-.*\.html$/i.test(String(value || ""));
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
            exactPathCandidates.push(`courses/${locale}/${localeCandidate}`);
        }
    }

    const tried = Array.from(new Set([
        ...exactPathCandidates,
        ...locales.flatMap((locale) => buildI18nFilenameCandidates(candidate, locale).map((localeCandidate) => `courses/${locale}/${localeCandidate}`))
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

function findCourseByPageOrUnit(pageId, fileName, lessons = []) {
    const normalizedPageId = normalizeCourseFile(pageId);
    const normalizedFileName = normalizeCourseFile(fileName);
    const normalizedPageIdNoHtml = normalizedPageId.replace(/\.html$/i, "");
    const normalizedFileNameNoHtml = normalizedFileName.replace(/\.html$/i, "");
    const arr = Array.isArray(lessons) ? lessons : [];

    const matchesLesson = (l) => {
        const lessonId = String(l.id || l.docId || "");
        const lessonCourseId = String(l.courseId || "");
        const lessonCourseIdNoHtml = lessonCourseId.replace(/\.html$/i, "");
        const units = Array.isArray(l.courseUnits) ? l.courseUnits : [];
        const unitMatch = units.some(unit => {
            const normalizedUnit = normalizeCourseFile(String(unit || ""));
            return unitIdsMatch(normalizedUnit, normalizedFileName) ||
                unitIdsMatch(normalizedUnit, normalizedFileNameNoHtml) ||
                unitIdsMatch(normalizedUnit, normalizedPageId) ||
                unitIdsMatch(normalizedUnit, normalizedPageIdNoHtml);
        });

        const legacyLessonUrl = l.classroomUrl;
        const assignmentUnitMatch = !!(legacyLessonUrl && (
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedFileName) ||
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedFileNameNoHtml) ||
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedPageId) ||
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedPageIdNoHtml)
        ));

        return unitIdsMatch(lessonCourseId, pageId) ||
            unitIdsMatch(lessonId, pageId) ||
            unitIdsMatch(lessonCourseId, normalizedPageId) ||
            unitIdsMatch(lessonId, normalizedPageId) ||
            unitIdsMatch(lessonCourseIdNoHtml, normalizedPageIdNoHtml) ||
            unitIdsMatch(lessonId.replace(/\.html$/i, ""), normalizedPageIdNoHtml) ||
            unitMatch ||
            assignmentUnitMatch;
    };

    // Prioritize non-hidden lessons
    let matched = arr.find(l => {
        if (l.hiddenFromCatalog === true) return false;
        return matchesLesson(l);
    });

    if (!matched) {
        matched = arr.find(l => matchesLesson(l));
    }
    return matched || null;
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
    const lessons = await getLessons(dbRef);
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
        .replace(/\/js\/course-shared\.js(?:\?[^"'<>]*)?/gi, courseSharedUrl)
        .replace(/\/js\/nav-component\.js(?:\?[^"'<>]*)?/gi, navComponentUrl);

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

function findParentCourseIdByUnit(unitId = "", lessons = []) {
    const target = cleanUnitId(unitId);
    if (!target) return null;
    const lesson = (Array.isArray(lessons) ? lessons : []).find((entry) => {
        if (!Array.isArray(entry.courseUnits)) return false;
        return entry.courseUnits.some((candidate) => cleanUnitId(candidate) === target);
    });
    return lesson ? getCanonicalLessonIdentity(lesson) : null;
}

async function getLessons(dbRef) {
    const snap = await dbRef.collection("metadata_lessons").orderBy("orderWeight", "asc").get();
    const lessons = [];

    snap.forEach((doc) => {
        const data = doc.data() || {};
        const canonicalId = normalizeText(doc.id || data.id || data.docId || data.courseId || data.courseKey);
        const price = data.dealerPrice != null && data.dealerPrice !== ""
            ? Number(data.dealerPrice)
            : (data.price != null && data.price !== "" ? Number(data.price) : null);

        lessons.push({
            ...data,
            id: doc.id,
            docId: doc.id,
            courseId: data.courseId || canonicalId,
            courseKey: data.courseKey || canonicalId,
            dealerPrice: Number.isFinite(price) ? price : null,
            dealerCurrency: normalizeCurrency(data.dealerCurrency || data.currency || "", ""),
        });
    });

    return lessons;
}

module.exports = {
    toCourseKey,
    getLessonLookupKeys,
    getCanonicalLessonIdentity,
    findLessonByCourseRef,
    resolveLessonForOrderItem,
    cleanUnitId,
    readCachedContent,
    writeCachedContent,
    buildContentCacheKey,
    normalizeCourseFile,
    normalizeCourseVariantKey,
    mapLegacyMasterToCanonical,
    isLegacyMasterPage,
    resolvePreferredLocales,
    fetchExternalCourseContentHelper,
    findCourseByPageOrUnit,
    buildAuthorizedFileCandidates,
    resolveCourseHtml,
    injectCourseRuntimeShell,
    findParentCourseIdByUnit,
    getLessons
};
