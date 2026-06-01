function buildI18nFilenameCandidates(candidateFileName, locale = "") {
    const fileName = String(candidateFileName || "").trim();
    if (!fileName) return [];

    const normalizedLocale = String(locale || "").toLowerCase();
    const regionPrefix = normalizedLocale.startsWith("zh") ? "tw" : normalizedLocale.startsWith("en") ? "en" : "";
    const deduped = new Set([fileName]);

    if (!regionPrefix || !fileName.endsWith(".html")) {
        return Array.from(deduped);
    }

    const addCandidate = (value) => {
        if (value) deduped.add(value);
    };

    const stripHtml = fileName.replace(/\.html$/i, "");
    const makeRenamed = (prefix, stem) => `${prefix}-${stem}.html`;

    let match = stripHtml.match(/^start-\d+-unit-(.+)$/i);
    if (match) addCandidate(makeRenamed(`${regionPrefix}-car-starter`, match[1]));

    match = stripHtml.match(/^basic-\d+-unit-(.+)$/i);
    if (match) addCandidate(makeRenamed(`${regionPrefix}-car-basic`, match[1]));

    match = stripHtml.match(/^(?:adv|advanced)-\d+-unit-(.+)$/i);
    if (match) addCandidate(makeRenamed(`${regionPrefix}-car-advanced`, match[1]));

    match = stripHtml.match(/^\d+-unit-(.+)$/i);
    if (match) addCandidate(makeRenamed(`${regionPrefix}-common`, match[1]));

    match = stripHtml.match(/^prepare-\d+-(.+)$/i);
    if (match) addCandidate(makeRenamed(`${regionPrefix}-common`, match[1]));

    match = stripHtml.match(/^(?:tw|en)-common-(.+)$/i);
    if (match) addCandidate(makeRenamed(`${regionPrefix}-common`, match[1]));

    match = stripHtml.match(/^(?:tw|en)-car-starter-(.+)$/i);
    if (match) addCandidate(makeRenamed(`${regionPrefix}-car-starter`, match[1]));

    match = stripHtml.match(/^(?:tw|en)-car-basic-(.+)$/i);
    if (match) addCandidate(makeRenamed(`${regionPrefix}-car-basic`, match[1]));

    match = stripHtml.match(/^(?:tw|en)-car-advanced-(.+)$/i);
    if (match) addCandidate(makeRenamed(`${regionPrefix}-car-advanced`, match[1]));

    return Array.from(deduped);
}

function unitIdsMatch(idA, idB) {
    if (!idA || !idB) return false;
    const cleanA = idA.toString().replace('.html', '').toLowerCase();
    const cleanB = idB.toString().replace('.html', '').toLowerCase();
    return cleanA === cleanB;
}

function normalizeLegacyId(value) {
    return String(value || '')
        .replace(/\.html$/i, '')
        .toLowerCase();
}

module.exports = {
    buildI18nFilenameCandidates,
    normalizeLegacyId,
    unitIdsMatch
};
