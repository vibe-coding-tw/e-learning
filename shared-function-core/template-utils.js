function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeTemplateRepoName(id) {
    const v = normalizeText(id || "");
    if (/^(common|car-(starter|basic|advanced))-/i.test(v)) return v;
    if (/^tw-(common|car-(starter|basic|advanced))-/i.test(v)) return v.replace(/^tw-/i, "");
    if (/^start-\d{2}-unit-/i.test(v)) return v.replace(/^start-\d{2}-unit-/i, "car-starter-");
    if (/^basic-\d{2}-unit-/i.test(v)) return v.replace(/^basic-\d{2}-unit-/i, "car-basic-");
    if (/^(adv|advanced)-\d{2}-unit-/i.test(v)) return v.replace(/^(adv|advanced)-\d{2}-unit-/i, "car-advanced-");
    if (/^\d{2}-unit-/i.test(v)) return v.replace(/^\d{2}-unit-/i, "common-");
    return v;
}

function legacyTemplateRepoNameFromCanonical(id) {
    const v = normalizeTemplateRepoName(id);
    if (!v) return "";
    if (/^common-/i.test(v)) return `tw-${v}`;
    if (/^car-(starter|basic|advanced)-/i.test(v)) return `tw-${v}`;
    return v;
}

function templateRepoCandidates(id) {
    const canonical = normalizeTemplateRepoName(id);
    const legacy = legacyTemplateRepoNameFromCanonical(canonical);
    return [...new Set([canonical, legacy].filter(Boolean))];
}

module.exports = {
    legacyTemplateRepoNameFromCanonical,
    normalizeTemplateRepoName,
    templateRepoCandidates
};
