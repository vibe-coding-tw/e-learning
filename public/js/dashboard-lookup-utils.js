(function () {
    function normalizeRouteLooseKey(value = "") {
        return String(value || "").split('/').pop().split('?')[0].replace(/\.html$/i, '').toLowerCase();
    }

    function normalizeDashboardLooseKey(value = "") {
        return normalizeRouteLooseKey(value);
    }

    function getLessonLookupKeys(lesson = {}) {
        const keys = new Set();
        const add = (value) => {
            if (!value) return;
            const raw = String(value).trim();
            if (!raw) return;
            keys.add(raw);
            keys.add(raw.replace(/\.html$/i, ''));
            keys.add(normalizeDashboardLooseKey(raw));
        };

        add(lesson.id);
        add(lesson.courseId);
        add(lesson.courseKey);
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

    function getCanonicalLessonIdentity(lesson = {}) {
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
        return (Array.isArray(lessons) ? lessons : []).find((lesson) => {
            const keys = getLessonLookupKeys(lesson);
            return keys.has(cleanKey) || keys.has(key);
        }) || null;
    }

    function getEquivalentUnitIds(unitId) {
        if (!unitId) return [];
        const normalized = String(unitId).toLowerCase().trim();
        const base = normalized.replace('.html', '').replace(/^(?:tw|en-)?(?:common|car-(?:starter|basic|advanced))-|^(?:start-|basic-|adv-|advanced-|prepare-)?(?:\d{2}-)?(?:unit-|lesson-|master-)?/i, '');

        return [
            normalized,
            base,
            `${base}.html`,
            `01-unit-${base}.html`,
            `start-${base}`,
            `start-${base}.html`
        ];
    }

    function resolveCanonicalUnitId(unitId, lessons = [], unitToDocId = {}) {
        const candidates = getEquivalentUnitIds(unitId);
        if (candidates.length === 0) return '';

        for (const candidate of candidates) {
            if (unitToDocId?.[candidate]) return candidate;
            if ((Array.isArray(lessons) ? lessons : []).some(l => Array.isArray(l.courseUnits) && l.courseUnits.includes(candidate))) return candidate;
        }

        for (const l of (Array.isArray(lessons) ? lessons : [])) {
            if (l.courseUnits) {
                const matched = l.courseUnits.find(u => {
                    const clean = (id) => String(id).trim().toLowerCase().replace('.html', '').replace(/^(?:tw|en-)?(?:common|car-(?:starter|basic|advanced))-|^(?:start-|basic-|adv-|advanced-|prepare-)?(?:\d{2}-)?(?:unit-|lesson-|master-)?/i, '');
                    return clean(u) === clean(String(unitId || ''));
                });
                if (matched) return matched;
            }
        }

        return candidates.find(id => id.endsWith('.html')) || candidates[0];
    }

    function findParentCourseIdByUnit(unitId, lessons = []) {
        const candidates = getEquivalentUnitIds(unitId);
        const lesson = (Array.isArray(lessons) ? lessons : []).find(l =>
            Array.isArray(l.courseUnits) && l.courseUnits.some(courseUnit => candidates.includes(courseUnit))
        );
        return getCanonicalLessonIdentity(lesson) || null;
    }

    function getPreferredUnitId(unitId, courseUnits = [], extraKeys = []) {
        const candidates = getEquivalentUnitIds(unitId);
        return courseUnits.find(unit => candidates.includes(unit)) ||
            extraKeys.find(key => candidates.includes(key)) ||
            candidates.find(id => id.endsWith('.html')) ||
            unitId;
    }

    function normalizeTutorAdminUnitId(unitId) {
        const raw = String(unitId || '').trim();
        if (!raw) return raw;
        if (raw === '02-unit-classroom-workflow.html') return '03-unit-github-classroom.html';
        if (raw.startsWith('04-')) return raw.replace(/^04-/, '02-');
        return raw;
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
