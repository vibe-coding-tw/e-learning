(function () {
    function stripPathFragment(value = "") {
        return String(value || "").split('/').pop().split('?')[0].split('#')[0].trim();
    }

    function normalizeCanonicalLearningPathKey(value = "") {
        const v = stripPathFragment(value).replace(/\.html$/i, '').toLowerCase();
        if (!v) return '';
        if (v === 'common' || v === 'car-starter' || v === 'car-basic' || v === 'car-advanced') return v;
        if (/^(?:tw|en)-common$/i.test(v)) return 'common';
        if (/^(?:tw|en)-car-(starter|basic|advanced)$/i.test(v)) return v.replace(/^(?:tw|en)-/i, '');
        if (/^(?:tw|en)-drone-(starter|basic|advanced)$/i.test(v)) return v.replace(/^(?:tw|en)-/i, '');
        if (/^drone-(starter|basic|advanced)$/i.test(v)) return v;
        if (/^start-\d{2}-unit-/i.test(v)) return 'car-starter';
        if (/^basic-\d{2}-unit-/i.test(v)) return 'car-basic';
        if (/^(?:adv|advanced)-\d{2}-unit-/i.test(v)) return 'car-advanced';
        if (/^\d{2}-unit-/i.test(v)) return 'common';
        if (/^prepare-\d+/i.test(v)) return 'common';
        return v;
    }

    function legacyLearningPathKeyFromCanonical(value = '', locale = 'zh-TW') {
        const canonical = normalizeCanonicalLearningPathKey(value);
        if (!canonical) return '';
        const prefix = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'tw';
        if (canonical === 'common') return `${prefix}-common`;
        return `${prefix}-${canonical}`;
    }

    function learningPathKeyCandidatesFromValue(value = '', locale = '') {
        const canonical = normalizeCanonicalLearningPathKey(value);
        const candidates = [String(value || '').trim(), canonical];
        if (canonical) {
            candidates.push(legacyLearningPathKeyFromCanonical(canonical, 'zh-TW'));
            candidates.push(legacyLearningPathKeyFromCanonical(canonical, 'en'));
        } else if (locale) {
            candidates.push(legacyLearningPathKeyFromCanonical(value, locale));
        }
        return [...new Set(candidates.filter(Boolean))];
    }

    function normalizeCanonicalRepoSlug(value = '') {
        const v = stripPathFragment(value).replace(/\.html$/i, '');
        if (!v) return '';
        if (/^(common|car-(starter|basic|advanced))-/i.test(v)) return v;
        if (/^tw-(common|car-(starter|basic|advanced))-/i.test(v)) return v.replace(/^tw-/i, '');
        if (/^en-(common|car-(starter|basic|advanced))-/i.test(v)) return v.replace(/^en-/i, '');
        if (/^start-\d{2}-unit-/i.test(v)) return v.replace(/^start-\d{2}-unit-/i, 'car-starter-');
        if (/^basic-\d{2}-unit-/i.test(v)) return v.replace(/^basic-\d{2}-unit-/i, 'car-basic-');
        if (/^(adv|advanced)-\d{2}-unit-/i.test(v)) return v.replace(/^(adv|advanced)-\d{2}-unit-/i, 'car-advanced-');
        if (/^\d{2}-unit-/i.test(v)) return v.replace(/^\d{2}-unit-/i, 'common-');
        if (/^prepare-\d+-(.+)$/i.test(v)) return v.replace(/^prepare-\d+-/i, 'common-');
        return v;
    }

    function legacyRepoSlugFromCanonical(value = '') {
        const canonical = normalizeCanonicalRepoSlug(value);
        if (!canonical) return '';
        if (/^common-/i.test(canonical)) return `tw-${canonical}`;
        if (/^car-(starter|basic|advanced)-/i.test(canonical)) return `tw-${canonical}`;
        return canonical;
    }

    function repoSlugCandidatesFromValue(value = '') {
        const canonical = normalizeCanonicalRepoSlug(value);
        const legacy = legacyRepoSlugFromCanonical(canonical);
        return [...new Set([canonical, legacy].filter(Boolean))];
    }

    window.repoSlugUtils = {
        stripPathFragment,
        normalizeCanonicalLearningPathKey,
        legacyLearningPathKeyFromCanonical,
        learningPathKeyCandidatesFromValue,
        normalizeCanonicalRepoSlug,
        legacyRepoSlugFromCanonical,
        repoSlugCandidatesFromValue
    };
})();
