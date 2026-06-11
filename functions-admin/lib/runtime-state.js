const CONTENT_RUNTIME_CACHE = {
    config: null,
    expiresAt: 0
};

async function getContentRuntimeConfig(db) {
    if (Date.now() < CONTENT_RUNTIME_CACHE.expiresAt && CONTENT_RUNTIME_CACHE.config) {
        return CONTENT_RUNTIME_CACHE.config;
    }
    const defaults = {
        enabled: true,
        repoOwner: "vibe-coding-tw",
        repoName: "content-repo",
        contentVersion: "main",
        defaultLocale: "en",
        defaultRegion: "US",
        defaultDistributorId: "default-usd",
        fallbackEnabled: true,
        cacheTtlSec: 300
    };
    try {
        const snap = await db.collection("metadata_settings").doc("content_runtime").get();
        if (snap.exists) {
            const data = snap.data() || {};
            CONTENT_RUNTIME_CACHE.config = {
                enabled: data.enabled === true,
                repoOwner: String(data.repoOwner || defaults.repoOwner).trim(),
                repoName: String(data.repoName || defaults.repoName).trim(),
                contentVersion: String(data.contentVersion || defaults.contentVersion).trim() || "main",
                defaultLocale: String(data.defaultLocale || defaults.defaultLocale).trim() || "en",
                defaultRegion: String(data.defaultRegion || defaults.defaultRegion).trim() || "US",
                defaultDistributorId: String(data.defaultDistributorId || defaults.defaultDistributorId).trim() || "default-usd",
                fallbackEnabled: data.fallbackEnabled !== false,
                cacheTtlSec: Math.max(30, Number(data.cacheTtlSec || defaults.cacheTtlSec))
            };
        } else {
            CONTENT_RUNTIME_CACHE.config = defaults;
        }
    } catch (err) {
        console.warn("[content-runtime] failed to load config, fallback to defaults:", err.message || err);
        CONTENT_RUNTIME_CACHE.config = defaults;
    }
    CONTENT_RUNTIME_CACHE.expiresAt = Date.now() + 60 * 1000;
    return CONTENT_RUNTIME_CACHE.config;
}

module.exports = {
    getContentRuntimeConfig
};
