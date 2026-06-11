function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeCourseFile(value = "") {
    const normalized = normalizeText(value)
        .split("?")[0]
        .split("#")[0]
        .replace(/\\/g, "/")
        .split("/")
        .pop() || "";
    return normalized.replace(/\.html$/i, "");
}

function normalizeLookupValue(value = "") {
    return normalizeCourseFile(value).toLowerCase();
}

function cleanUnitId(unitId) {
    if (!unitId) return "";
    return normalizeText(unitId)
        .toLowerCase()
        .replace(/\.html$/, "")
        .replace(/^(?:tw-(?:common|car-(?:starter|basic|advanced))-|start-|basic-|adv-|advanced-|prepare-)?(?:\d{2}-)?(?:unit-|lesson-|master-)?/i, "");
}

function normalizeTutorAdminUnitId(unitId = "") {
    const raw = normalizeText(unitId);
    if (!raw) return "";
    if (/^(?:tw|en)-/i.test(raw)) return raw.replace(/^(?:tw|en)-/i, "");
    return raw;
}

function withAssignmentUrlAliases(lesson = {}) {
    const currentUrlMap = lesson && typeof lesson.assignmentUrlMap === "object" && lesson.assignmentUrlMap !== null
        ? lesson.assignmentUrlMap
        : null;

    const assignmentUrlMap = currentUrlMap || null;

    return {
        ...lesson,
        ...(assignmentUrlMap ? { assignmentUrlMap } : {})
    };
}

function resolveCanonicalUnitId(unitId, lessons = []) {
    if (!unitId) return unitId;
    let mappedUnitId = unitId;
    const cleanId = cleanUnitId(mappedUnitId);

    let resolved = mappedUnitId;
    for (const lesson of lessons) {
        const courseUnits = Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [];
        if (courseUnits.includes(mappedUnitId)) {
            resolved = mappedUnitId;
            break;
        }

        const matchedUnit = courseUnits.find((courseUnit) => {
            return cleanUnitId(courseUnit) === cleanId;
        });

        if (matchedUnit) {
            resolved = matchedUnit;
            break;
        }
    }

    let canonical = resolved;
    if (/^(?:tw|en)-/i.test(canonical)) {
        canonical = canonical.replace(/^(?:tw|en)-/i, "");
    }
    if (/^start-\d{2}-unit-/i.test(canonical)) {
        canonical = canonical.replace(/^start-\d{2}-unit-/i, "car-starter-");
    } else if (/^start-/i.test(canonical)) {
        canonical = canonical.replace(/^start-/i, "car-starter-");
    }

    return canonical;
}

function canonicalizeLessonForDashboard(lesson = {}, lessons = []) {
    if (!lesson || typeof lesson !== "object") return lesson;
    const courseUnits = Array.isArray(lesson.courseUnits)
        ? lesson.courseUnits.map((unitId) => resolveCanonicalUnitId(unitId, lessons) || unitId)
        : lesson.courseUnits;

    return {
        ...lesson,
        ...(Array.isArray(courseUnits) ? { courseUnits } : {}),
        ...(lesson.entryUnitId ? {
            entryUnitId: resolveCanonicalUnitId(lesson.entryUnitId, lessons) || lesson.entryUnitId
        } : {})
    };
}

function normalizeForFirestore(unitId) {
    if (!unitId) return unitId;
    return unitId.replace(/\.html$/i, "");
}

function normalizeCanonicalCourseKey(value = "") {
    return normalizeCourseFile(value)
        .replace(/\.html$/i, "")
        .replace(/^(?:tw|en)-/i, "");
}

function getCanonicalLessonIdentity(lesson = {}) {
    if (!lesson || typeof lesson !== "object") return "";
    const metadataType = String(lesson.metadataType || "").toLowerCase();
    if (lesson.isPhysical === true || metadataType === "product" || metadataType === "legacy_product") {
        return String(
            lesson.productId ||
            lesson.id ||
            lesson.courseKey ||
            lesson.courseId ||
            ""
        ).trim();
    }
    return String(
        lesson.id ||
        lesson.docId ||
        normalizeCanonicalCourseKey(lesson.courseKey) ||
        normalizeCanonicalCourseKey(lesson.contentRef) ||
        normalizeCanonicalCourseKey(lesson.courseId) ||
        normalizeCanonicalCourseKey(lesson.entryUnitId) ||
        lesson.productId ||
        ""
    ).trim();
}

function findParentCourseIdByUnit(unitId, lessons = []) {
    if (!unitId) return null;

    const lesson = findCourseByUnitId(unitId, lessons);
    return lesson ? (getCanonicalLessonIdentity(lesson) || null) : null;
}

function findCourseByPageOrUnit(pageId, fileName, lessons = []) {
    const normalizedPageId = normalizeCourseFile(pageId);
    const normalizedFileName = normalizeCourseFile(fileName);
    const normalizedPageIdNoHtml = normalizedPageId.replace(/\.html$/i, "");
    const normalizedFileNameNoHtml = normalizedFileName.replace(/\.html$/i, "");

    return lessons.find((l) => {
        const lessonId = String(l.id || l.docId || "");
        const lessonCourseId = String(l.courseId || "");
        const lessonCourseIdNoHtml = lessonCourseId.replace(/\.html$/i, "");
        const units = Array.isArray(l.courseUnits) ? l.courseUnits : [];
        const unitMatch = units.some((unit) => {
            const normalizedUnit = normalizeCourseFile(String(unit || ""));
            return normalizeLookupValue(normalizedUnit) === normalizeLookupValue(normalizedFileName) ||
                normalizeLookupValue(normalizedUnit) === normalizeLookupValue(normalizedFileNameNoHtml) ||
                normalizeLookupValue(normalizedUnit) === normalizeLookupValue(normalizedPageId) ||
                normalizeLookupValue(normalizedUnit) === normalizeLookupValue(normalizedPageIdNoHtml);
        });

        const legacyLessonUrl = l.classroomUrl;
        const assignmentUnitMatch = !!(legacyLessonUrl && (
            normalizeLookupValue(legacyLessonUrl) === normalizeLookupValue(normalizedFileName) ||
            normalizeLookupValue(legacyLessonUrl) === normalizeLookupValue(normalizedFileNameNoHtml) ||
            normalizeLookupValue(legacyLessonUrl) === normalizeLookupValue(normalizedPageId) ||
            normalizeLookupValue(legacyLessonUrl) === normalizeLookupValue(normalizedPageIdNoHtml)
        ));

        return normalizeLookupValue(lessonId) === normalizeLookupValue(pageId) ||
            normalizeLookupValue(lessonCourseId) === normalizeLookupValue(pageId) ||
            normalizeLookupValue(lessonId) === normalizeLookupValue(normalizedPageId) ||
            normalizeLookupValue(lessonCourseId) === normalizeLookupValue(normalizedPageId) ||
            normalizeLookupValue(lessonId.replace(/\.html$/i, "")) === normalizeLookupValue(normalizedPageIdNoHtml) ||
            normalizeLookupValue(lessonCourseIdNoHtml) === normalizeLookupValue(normalizedPageIdNoHtml) ||
            unitMatch ||
            assignmentUnitMatch;
    }) || null;
}

function findCourseByUnitId(unitId, lessons = []) {
    if (!unitId) return null;
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
    return lessons.find((lesson) => {
        const units = Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [];
        return units.some((candidateUnitId) =>
            normalizeLookupValue(candidateUnitId) === normalizeLookupValue(canonicalUnitId)
        );
    }) || null;
}

function getLessonLookupKeys(lesson = {}) {
    const keys = new Set();
    const add = (value) => {
        if (!value) return;
        const raw = normalizeText(value);
        if (!raw) return;
        keys.add(raw);
        keys.add(raw.replace(/\.html$/i, ""));
        keys.add(normalizeLookupValue(raw));
    };

    add(lesson.id);
    add(lesson.docId);
    add(lesson.courseId);
    add(lesson.courseKey);
    add(normalizeCanonicalCourseKey(lesson.courseKey));
    add(normalizeCanonicalCourseKey(lesson.contentRef));
    add(lesson.entryUnitId);
    add(lesson.classroomUrl);
    add(lesson.productId);
    add(lesson.sku);

    if (Array.isArray(lesson.productIds)) lesson.productIds.forEach(add);
    if (Array.isArray(lesson.legacyProductIds)) lesson.legacyProductIds.forEach(add);
    if (Array.isArray(lesson.aliases)) lesson.aliases.forEach(add);
    if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);

    return keys;
}

function findLessonByCourseRef(courseRef = "", lessons = []) {
    if (!courseRef) return null;
    const candidates = new Set([
        normalizeText(courseRef || ""),
        normalizeText(courseRef || "").replace(/\.html$/i, ""),
        normalizeLookupValue(courseRef),
        cleanUnitId(courseRef)
    ].filter(Boolean));

    return lessons.find((lesson) => {
        const keys = getLessonLookupKeys(lesson);
        for (const candidate of candidates) {
            if (keys.has(candidate)) return true;
        }
        return false;
    }) || null;
}

function resolveLessonForOrderItem(itemKey = "", lessons = []) {
    if (!itemKey) return null;
    const cleanKey = String(itemKey).replace(/\.html$/i, "");
    return lessons.find((lesson) =>
        lesson.id === cleanKey ||
        lesson.docId === cleanKey ||
        lesson.productId === cleanKey ||
        lesson.courseId === cleanKey
    ) || findCourseByPageOrUnit(itemKey, itemKey, lessons);
}

module.exports = {
    canonicalizeLessonForDashboard,
    cleanUnitId,
    findCourseByPageOrUnit,
    findCourseByUnitId,
    findLessonByCourseRef,
    getCanonicalLessonIdentity,
    getLessonLookupKeys,
    normalizeCanonicalCourseKey,
    normalizeCourseFile,
    normalizeForFirestore,
    normalizeLookupValue,
    normalizeTutorAdminUnitId,
    resolveCanonicalUnitId,
    resolveLessonForOrderItem,
    withAssignmentUrlAliases
};
