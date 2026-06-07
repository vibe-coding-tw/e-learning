(function () {
    function normalizeRouteLooseKey(value = "") {
        return String(value || "").split('/').pop().split('?')[0].split('#')[0].replace(/\.html$/i, '').toLowerCase();
    }

    function normalizeDashboardLooseKey(value = "") {
        return normalizeRouteLooseKey(value);
    }

    function normalizeLegacyCourseKey(value = "") {
        let v = normalizeRouteLooseKey(value);
        if (!v) return '';

        v = v.replace(/^(?:tw|en)-/i, '');
        v = v.replace(/^prepare-/i, 'common-');
        v = v.replace(/^(start)-\d{2}-unit-/i, 'car-starter-');
        v = v.replace(/^(basic)-\d{2}-unit-/i, 'car-basic-');
        v = v.replace(/^(adv|advanced)-\d{2}-unit-/i, 'car-advanced-');
        v = v.replace(/^\d{2}-(?:unit|lesson|master)-/i, 'common-');
        v = v.replace(/-master-/i, '-unit-');
        return v;
    }

    function addLookupKey(keys, value) {
        if (!value) return;
        const raw = String(value).trim();
        if (!raw) return;
        keys.add(raw);
        keys.add(raw.replace(/\.html$/i, ''));
        keys.add(normalizeDashboardLooseKey(raw));
        keys.add(normalizeLegacyCourseKey(raw));
    }

    function getLessonLookupKeys(lesson = {}) {
        const keys = new Set();
        addLookupKey(keys, lesson.id);
        addLookupKey(keys, lesson.courseId);
        addLookupKey(keys, lesson.courseKey);
        addLookupKey(keys, lesson.entryUnitId);
        addLookupKey(keys, lesson.classroomUrl);
        addLookupKey(keys, lesson.productId);
        addLookupKey(keys, lesson.sku);
        if (Array.isArray(lesson.productIds)) lesson.productIds.forEach((value) => addLookupKey(keys, value));
        if (Array.isArray(lesson.legacyProductIds)) lesson.legacyProductIds.forEach((value) => addLookupKey(keys, value));
        if (Array.isArray(lesson.aliases)) lesson.aliases.forEach((value) => addLookupKey(keys, value));
        if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach((value) => addLookupKey(keys, value));
        return keys;
    }

    function getCanonicalLessonIdentity(lesson = {}) {
        if (!lesson || typeof lesson !== 'object') return '';
        const metadataType = String(lesson.metadataType || '').toLowerCase();
        if (lesson.isPhysical === true || metadataType === 'product' || metadataType === 'legacy_product') {
            return String(
                lesson.productId ||
                lesson.courseKey ||
                lesson.courseId ||
                lesson.id ||
                ''
            ).trim();
        }
        return String(
            lesson.courseKey ||
            lesson.courseId ||
            lesson.productId ||
            lesson.id ||
            ''
        ).trim();
    }

    function resolveLessonByAnyKey(key = '', lessons = []) {
        if (!key) return null;
        const cleanKey = normalizeDashboardLooseKey(key);
        const legacyKey = normalizeLegacyCourseKey(key);
        return (Array.isArray(lessons) ? lessons : []).find((lesson) => {
            const keys = getLessonLookupKeys(lesson);
            return keys.has(cleanKey) || keys.has(key) || keys.has(legacyKey);
        }) || null;
    }

    function getEquivalentUnitIds(unitId) {
        if (!unitId) return [];
        const raw = String(unitId).trim();
        const lower = raw.toLowerCase();
        const stripped = lower.replace(/\.html$/i, "");
        const strippedHtml = stripped ? `${stripped}.html` : '';
        const normalized = normalizeLegacyCourseKey(raw);
        const normalizedHtml = normalized ? `${normalized}.html` : '';
        const languageStripped = lower.replace(/^(?:tw|en)-/i, '');
        const languageStrippedHtml = languageStripped ? `${languageStripped.replace(/\.html$/i, '')}.html` : '';

        const candidates = [
            raw,
            lower,
            stripped,
            strippedHtml,
            languageStripped,
            languageStrippedHtml,
            normalized,
            normalizedHtml
        ];

        return Array.from(new Set(candidates.filter(Boolean)));
    }

    function resolveCanonicalUnitId(unitId, lessons = [], unitToDocId = {}) {
        const candidates = getEquivalentUnitIds(unitId);
        if (candidates.length === 0) return '';

        const activeLessons = (Array.isArray(lessons) && lessons.length > 0)
            ? lessons
            : (window.dashboardData?.lessons || []);

        const activeUnitToDocId = (unitToDocId && Object.keys(unitToDocId).length > 0)
            ? unitToDocId
            : (window.dashboardData?.unitToDocId || {});

        for (const candidate of candidates) {
            if (activeUnitToDocId?.[candidate]) return candidate;
            if (activeLessons.some((lesson) => Array.isArray(lesson.courseUnits) && lesson.courseUnits.includes(candidate))) return candidate;
            const matched = activeLessons.find((lesson) => getLessonLookupKeys(lesson).has(candidate));
            if (matched) return getCanonicalLessonIdentity(matched) || candidate;
        }

        for (const lesson of activeLessons) {
            if (!Array.isArray(lesson.courseUnits)) continue;
            const matched = lesson.courseUnits.find((courseUnit) => {
                const a = normalizeLegacyCourseKey(courseUnit);
                const b = normalizeLegacyCourseKey(unitId);
                return normalizeDashboardLooseKey(courseUnit) === normalizeDashboardLooseKey(unitId) || a === b;
            });
            if (matched) return matched;
        }

        return candidates.find((id) => id.endsWith('.html')) || candidates[0];
    }

    function findParentCourseIdByUnit(unitId, lessons = []) {
        const candidates = getEquivalentUnitIds(unitId);
        const activeLessons = (Array.isArray(lessons) && lessons.length > 0)
            ? lessons
            : (window.dashboardData?.lessons || []);
        const lesson = activeLessons.find((l) =>
            Array.isArray(l.courseUnits) && l.courseUnits.some((courseUnit) => candidates.includes(courseUnit))
        ) || resolveLessonByAnyKey(unitId, activeLessons);
        return getCanonicalLessonIdentity(lesson) || null;
    }

    function getPreferredUnitId(unitId, courseUnits = [], extraKeys = []) {
        const candidates = getEquivalentUnitIds(unitId);
        return candidates.find(id => courseUnits.includes(id)) ||
            candidates.find(id => extraKeys.includes(id)) ||
            candidates.find(id => id.endsWith('.html')) ||
            courseUnits.find(Boolean) ||
            unitId;
    }

    function normalizeTutorAdminUnitId(unitId) {
        const raw = String(unitId || '').trim();
        if (!raw) return raw;
        const normalized = normalizeLegacyCourseKey(raw);
        return normalized || raw;
    }

    function normalizeTutorIdentifier(value) {
        if (!value || typeof value !== 'string') return '';
        return value.replace(/_DOT_/g, '.').trim();
    }

    window.dashboardLookupUtils = {
        normalizeRouteLooseKey,
        normalizeDashboardLooseKey,
        getLessonLookupKeys,
        getCanonicalLessonIdentity,
        resolveLessonByAnyKey,
        getEquivalentUnitIds,
        resolveCanonicalUnitId,
        findParentCourseIdByUnit,
        getPreferredUnitId,
        normalizeTutorAdminUnitId,
        normalizeTutorIdentifier
    };
})();
