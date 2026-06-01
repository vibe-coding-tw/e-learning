const CONTENT_RUNTIME_CACHE = {
    config: null,
    expiresAt: 0
};

const LEGACY_MASTER_MAPPING_CACHE = {
    mapping: {},
    expiresAt: 0
};

async function getLegacyMasterMapping(db) {
    if (Date.now() < LEGACY_MASTER_MAPPING_CACHE.expiresAt && Object.keys(LEGACY_MASTER_MAPPING_CACHE.mapping).length > 0) {
        return LEGACY_MASTER_MAPPING_CACHE.mapping;
    }
    try {
        const snap = await db.collection("metadata_settings").doc("legacy_master_mapping").get();
        if (snap.exists) {
            const data = snap.data() || {};
            const mapping = data.mappings || {};
            LEGACY_MASTER_MAPPING_CACHE.mapping = mapping;
            LEGACY_MASTER_MAPPING_CACHE.expiresAt = Date.now() + 3600 * 1000;
            console.log(`[legacy-master-mapping] Loaded ${Object.keys(mapping).length} mappings from Firestore`);
            return mapping;
        }
        console.warn("[legacy-master-mapping] Document not found in Firestore, using empty mapping");
        LEGACY_MASTER_MAPPING_CACHE.mapping = {};
        LEGACY_MASTER_MAPPING_CACHE.expiresAt = Date.now() + 300 * 1000;
        return {};
    } catch (err) {
        console.warn("[legacy-master-mapping] Failed to load from Firestore:", err.message || err);
        return LEGACY_MASTER_MAPPING_CACHE.mapping || {};
    }
}

function peekLegacyMasterMapping() {
    return LEGACY_MASTER_MAPPING_CACHE.mapping || {};
}

async function getContentRuntimeConfig(db) {
    if (Date.now() < CONTENT_RUNTIME_CACHE.expiresAt && CONTENT_RUNTIME_CACHE.config) {
        return CONTENT_RUNTIME_CACHE.config;
    }
    const defaults = {
        enabled: true,
        repoOwner: "vibe-coding-tw",
        repoName: "content-repo",
        contentVersion: "main",
        defaultLocale: "zh-TW",
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
                defaultLocale: String(data.defaultLocale || defaults.defaultLocale).trim() || "zh-TW",
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
    getContentRuntimeConfig,
    getLegacyMasterMapping,
    peekLegacyMasterMapping
};
