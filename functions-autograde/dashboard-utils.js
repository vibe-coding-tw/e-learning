const core = require("vibe-functions-core/dashboard-utils-core");

function getLessonLookupKeys(lesson = {}) {
    return core.getLessonLookupKeys(lesson, { includeDocId: false });
}

function resolveLessonForOrderItem(itemKey = '', lessons = []) {
    if (!itemKey) return null;
    const candidates = new Set([
        itemKey,
        String(itemKey).replace(/\.html$/i, ''),
        core.normalizeLookupValue(itemKey),
        core.cleanUnitId(itemKey)
    ]);

    return lessons.find((lesson) => {
        const keys = getLessonLookupKeys(lesson);
        for (const candidate of candidates) {
            if (keys.has(candidate)) return true;
        }
        return false;
    }) || core.findCourseByPageOrUnit(itemKey, itemKey, lessons);
}

module.exports = {
    ...core,
    getLessonLookupKeys,
    resolveLessonForOrderItem
};
