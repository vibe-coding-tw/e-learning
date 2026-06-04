(function () {
    const LEGACY_UNIT_TO_CANONICAL_UNIT = {
        "01-unit-vscode-online.html": "common-vscode-online.html",
        "01-unit-vscode-setup.html": "common-vscode-setup.html",
        "02-unit-agent-mode.html": "common-agent-mode.html",
        "02-unit-vibe-coding.html": "common-vibe-coding.html",
        "02-unit-web-agents.html": "common-web-agents.html",
        "03-unit-github-classroom.html": "common-github-classroom.html",
        "03-unit-motor-ramping.html": "common-motor-ramping.html",
        "03-unit-wifi-setup.html": "common-wifi-setup.html",
        "start-01-unit-html5-basics.html": "start-01-unit-flexbox-layout.html"
    };
    const LEGACY_MASTER_TO_CANONICAL = {
        "01-master-getting-started.html": "common-developer-identity.html",
        "02-master-ai-agents.html": "common-agent-mode.html",
        "03-master-wifi-motor.html": "common-github-classroom.html",
        "adv-01-master-s3-cam.html": "adv-01-unit-jpeg-quality.html",
        "adv-02-master-video.html": "adv-02-unit-bandwidth-fps.html",
        "adv-03-master-ble-advanced.html": "adv-03-unit-ble-mtu.html",
        "adv-04-master-sensors.html": "adv-04-unit-filter-algorithms.html",
        "adv-05-master-cv.html": "adv-05-unit-centroid-error.html",
        "adv-06-master-cv-advanced.html": "adv-06-unit-centroid-algorithm.html",
        "adv-07-master-ui-framework.html": "adv-07-unit-chart-canvas.html",
        "adv-08-master-image-processing.html": "adv-08-unit-color-spaces.html",
        "adv-09-master-ai-recognition.html": "adv-09-unit-cnn-audio.html",
        "adv-10-master-diff-drive.html": "adv-10-unit-api-design.html",
        "adv-11-master-photoelectric.html": "adv-11-unit-hardware-interrupts.html",
        "adv-12-master-pid.html": "adv-12-unit-code-logic.html",
        "adv-13-master-robustness.html": "adv-13-unit-robustness.html",
        "adv-14-master-debugging-art.html": "adv-14-unit-debugging-art.html",
        "adv-15-master-architecture.html": "adv-15-unit-ble-async.html",
        "basic-01-master-environment.html": "basic-01-unit-drivers-ports.html",
        "basic-02-master-ota-architecture.html": "basic-02-unit-ota-principles.html",
        "basic-03-master-io-mapping.html": "basic-03-unit-adc-resolution.html",
        "basic-04-master-pwm-control.html": "basic-04-unit-h-bridge.html",
        "basic-05-master-ble-gatt.html": "basic-05-unit-advertising-connection.html",
        "basic-06-master-http-web.html": "basic-06-unit-cors-security.html",
        "basic-07-master-wifi-modes.html": "basic-07-unit-async-webserver.html",
        "basic-08-master-joystick-math.html": "basic-08-unit-joystick-mapping.html",
        "basic-09-master-multitasking.html": "basic-09-unit-hardware-timer.html",
        "basic-10-master-fsm.html": "basic-10-unit-fsm.html",
        "start-01-master-web-app.html": "start-01-unit-flexbox-layout.html",
        "start-02-master-web-ble.html": "start-02-unit-ble-async.html",
        "start-03-master-remote-control.html": "start-03-unit-control-panel.html",
        "start-04-master-touch-events.html": "start-04-unit-long-press.html",
        "start-05-master-joystick-lab.html": "start-05-unit-canvas-joystick.html"
    };
    const CANONICAL_UNIT_TO_LEGACY_UNITS = Object.entries(LEGACY_UNIT_TO_CANONICAL_UNIT).reduce((acc, [legacy, canonical]) => {
        if (!acc[canonical]) acc[canonical] = [];
        acc[canonical].push(legacy);
        return acc;
    }, {});

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
        const raw = String(unitId).trim();
        const normalized = raw.toLowerCase();
        const stripped = normalized.replace(/\.html$/i, "");
        const rawWithHtml = stripped + ".html";
        const canonical = LEGACY_UNIT_TO_CANONICAL_UNIT[rawWithHtml] || 
            LEGACY_UNIT_TO_CANONICAL_UNIT[raw] || 
            LEGACY_MASTER_TO_CANONICAL[rawWithHtml] || 
            LEGACY_MASTER_TO_CANONICAL[raw] || 
            raw;
        const canonicalNoExt = String(canonical).replace(/\.html$/i, "");
        const legacyAliases = CANONICAL_UNIT_TO_LEGACY_UNITS[`${canonicalNoExt}.html`] || CANONICAL_UNIT_TO_LEGACY_UNITS[canonical] || [];
        const candidates = [
            canonical,
            canonicalNoExt,
            `${canonicalNoExt}.html`,
            ...legacyAliases,
            raw,
            stripped
        ];

        if (/^(?:tw|en)-/i.test(raw)) {
            const languageStripped = raw.replace(/^(?:tw|en)-/i, "");
            candidates.push(languageStripped, languageStripped.replace(/\.html$/i, ""), `${languageStripped.replace(/\.html$/i, "")}.html`);
        }

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
            if (activeLessons.some(l => Array.isArray(l.courseUnits) && l.courseUnits.includes(candidate))) return candidate;
        }

        for (const l of activeLessons) {
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
        const activeLessons = (Array.isArray(lessons) && lessons.length > 0)
            ? lessons
            : (window.dashboardData?.lessons || []);
        const lesson = activeLessons.find(l =>
            Array.isArray(l.courseUnits) && l.courseUnits.some(courseUnit => candidates.includes(courseUnit))
        );
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
        const rawWithHtml = raw.endsWith('.html') ? raw : `${raw}.html`;
        if (LEGACY_UNIT_TO_CANONICAL_UNIT[raw]) return LEGACY_UNIT_TO_CANONICAL_UNIT[raw];
        if (LEGACY_UNIT_TO_CANONICAL_UNIT[rawWithHtml]) return LEGACY_UNIT_TO_CANONICAL_UNIT[rawWithHtml];
        if (LEGACY_MASTER_TO_CANONICAL[raw]) return LEGACY_MASTER_TO_CANONICAL[raw];
        if (LEGACY_MASTER_TO_CANONICAL[rawWithHtml]) return LEGACY_MASTER_TO_CANONICAL[rawWithHtml];
        
        let result = raw;
        if (/^(?:tw|en)-/i.test(result)) result = result.replace(/^(?:tw|en)-/i, '');
        if (result === '02-unit-classroom-workflow.html') return 'common-github-classroom.html';
        if (result.startsWith('04-')) return result.replace(/^04-/, '02-');
        return result;
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
