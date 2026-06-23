function normalizeRoutingRegionCode(value = "") {
    const raw = String(value || "").trim().toUpperCase();
    if (!raw) return "";
    if (raw === "ZH-TW" || raw === "TW" || raw === "TWD") return "TW";
    if (raw === "EN" || raw === "EN-US" || raw === "US" || raw === "USD") return "US";
    return raw;
}

function distributorMatchesRegion(distributor = {}, regionCode = "") {
    const normalizedRegionCode = normalizeRoutingRegionCode(regionCode);
    if (!normalizedRegionCode) return true;
    const regions = Array.isArray(distributor.regions) ? distributor.regions : [];
    return regions.some((region) => normalizeRoutingRegionCode(region) === normalizedRegionCode);
}

function collectDistributorRegions(distributors = []) {
    const regions = new Set();
    (Array.isArray(distributors) ? distributors : []).forEach((distributor) => {
        const items = Array.isArray(distributor.regions) ? distributor.regions : [];
        items.forEach((region) => {
            const normalized = normalizeRoutingRegionCode(region);
            if (normalized) regions.add(normalized);
        });
    });
    return Array.from(regions).sort((a, b) => String(a).localeCompare(String(b)));
}

function chooseRecommendedDistributor(distributors = [], {
    regionCode = "",
    preferredDistributorId = "",
    ruleDefaultDistributorId = "",
    ruleBackupDistributorIds = []
} = {}) {
    const active = (Array.isArray(distributors) ? distributors : [])
        .filter((item) => item && item.id && item.status === "ACTIVE");
    const regionMatched = active.filter((item) => distributorMatchesRegion(item, regionCode));
    const pickById = (distributorId = "") => {
        const normalizedId = String(distributorId || "").trim();
        if (!normalizedId) return null;
        return regionMatched.find((item) => item.id === normalizedId)
            || active.find((item) => item.id === normalizedId)
            || null;
    };

    const preferred = pickById(preferredDistributorId);
    if (preferred) {
        return { distributor: preferred, reason: "preferred-distributor" };
    }

    const defaultDistributor = pickById(ruleDefaultDistributorId);
    if (defaultDistributor) {
        return { distributor: defaultDistributor, reason: "region-default" };
    }

    for (const candidateId of Array.isArray(ruleBackupDistributorIds) ? ruleBackupDistributorIds : []) {
        const candidate = pickById(candidateId);
        if (candidate) {
            return { distributor: candidate, reason: "region-backup" };
        }
    }

    if (regionMatched.length === 1) {
        return { distributor: regionMatched[0], reason: "single-region-match" };
    }

    const fallback = regionMatched[0] || active[0] || null;
    return fallback
        ? { distributor: fallback, reason: regionMatched.length > 1 ? "first-region-match" : "first-active-distributor" }
        : { distributor: null, reason: "no-active-distributor" };
}

module.exports = {
    collectDistributorRegions,
    chooseRecommendedDistributor,
    distributorMatchesRegion,
    normalizeRoutingRegionCode
};
