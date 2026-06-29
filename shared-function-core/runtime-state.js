"use strict";
const logger = require("firebase-functions/logger");

async function getContentRuntimeConfig(db) {
    try {
        const snap = await db.collection("metadata_settings").doc("content_runtime").get();
        if (!snap.exists) return null;
        const data = snap.data() || {};
        return {
            enabled: data.enabled === true,
            repoOwner: String(data.repoOwner || "").trim(),
            repoName: String(data.repoName || "").trim(),
            contentVersion: String(data.contentVersion || "").trim(),
            defaultLocale: String(data.defaultLocale || "").trim(),
            defaultRegion: String(data.defaultRegion || "").trim(),
            defaultDistributorId: String(data.defaultDistributorId || "").trim(),
            supportedLocales: Array.isArray(data.supportedLocales) ? data.supportedLocales : [],
            localeLabels: data.localeLabels && typeof data.localeLabels === "object" && !Array.isArray(data.localeLabels) ? data.localeLabels : {}
        };
    } catch (err) {
        logger.warn("[content-runtime] failed to load config:", err.message || err);
        return null;
    }
}

module.exports = {
    getContentRuntimeConfig
};
