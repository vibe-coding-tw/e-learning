const crypto = require("crypto");
const { normalizeLegacyId } = require('./id-utils');

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeEmail(value = "") {
    return normalizeText(value).toLowerCase();
}

function fallbackNameFromEmail(email, defaultName = "使用者") {
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes("@")) return defaultName;
    return normalized.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveNameFromUserData(userData = {}, email = "", authDisplayName = "") {
    return normalizeText(userData.name || userData.displayName || authDisplayName || fallbackNameFromEmail(email) || email || "使用者");
}

function generatePromotionCode(length = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < Math.max(4, Number(length) || 6); i++) {
        const idx = crypto.randomInt(0, chars.length);
        code += chars[idx];
    }
    return code;
}

function assertTutorApplicationState(appData = {}, { source = null, status = null } = {}) {
    if (source && appData.source !== source) {
        throw new Error('This action is only valid for the expected application type.');
    }
    if (status && appData.status !== status) {
        throw new Error('This application is not in the expected state.');
    }
}

async function queryTutorApplications(db, {
    userId = null,
    unitId = null,
    statuses = null,
    source = null,
    limit = 1
} = {}) {
    let query = db.collection('tutor_applications');
    if (userId) query = query.where('userId', '==', userId);
    if (unitId) query = query.where('unitId', '==', normalizeLegacyId(unitId));
    if (source) query = query.where('source', '==', source);
    if (Array.isArray(statuses) && statuses.length > 0) {
        query = statuses.length === 1 ? query.where('status', '==', statuses[0]) : query.where('status', 'in', statuses);
    }
    if (limit) query = query.limit(limit);
    return query.get();
}

function buildTutorApplicationLegacyEntry(applicationId, appData = {}, {
    status = appData.status || 'pending',
    adminMessage = appData.adminMessage || '',
    resolvedAt = appData.resolvedAt || null
} = {}) {
    return {
        applicationId,
        userId: appData.userId || '',
        userEmail: appData.userEmail || '',
        unitId: appData.unitId || '',
        status,
        adminMessage,
        source: appData.source || 'unknown',
        appliedAt: appData.appliedAt || new Date().toISOString(),
        resolvedAt
    };
}

function buildTutorApplicationRecord({
    userId = '',
    userEmail = '',
    unitId = '',
    status = 'pending',
    source = 'unknown',
    appliedAt = new Date().toISOString(),
    ...extra
} = {}) {
    return {
        userId,
        userEmail,
        unitId,
        status,
        source,
        appliedAt,
        ...extra
    };
}

function upsertTutorApplicationLegacyEntry(userApplications = [], applicationId, appData = {}, overrides = {}) {
    const nextEntry = buildTutorApplicationLegacyEntry(applicationId, appData, overrides);
    const nextApplications = Array.isArray(userApplications) ? [...userApplications] : [];
    const legacyIndex = nextApplications.findIndex(app => app.applicationId === applicationId);
    if (legacyIndex >= 0) {
        nextApplications[legacyIndex] = {
            ...nextApplications[legacyIndex],
            ...nextEntry
        };
    } else {
        nextApplications.push(nextEntry);
    }
    return nextApplications;
}

function getEffectiveTutorConfig(unitId, tutorConfigs = {}) {
    if (!unitId) return null;

    if (tutorConfigs[unitId] && tutorConfigs[unitId].authorized) return tutorConfigs[unitId];

    const normalized = unitId.replace(/\.html$/, '');
    const config = tutorConfigs[normalized];

    if (config && !config.authorized && config.html) {
        return config.html;
    }

    return config || null;
}

function getUserTutorConfig(userData = {}, unitId) {
    return getEffectiveTutorConfig(unitId, userData.tutorConfigs || {});
}

function getPreferredAssignmentUrl(config = {}) {
    return normalizeText(config.assignmentUrl || config.legacyAssignmentUrl || config.githubClassroomUrl || "");
}

function resolveAssignmentUrlMaps(configs = {}) {
    const candidates = [
        configs.assignmentUrlMap,
        configs.assignmentUrls,
        configs.githubClassroomUrls
    ];

    for (const candidate of candidates) {
        if (candidate && typeof candidate === 'object' && Object.keys(candidate).length > 0) {
            return candidate;
        }
    }

    return null;
}

function buildTutorConfigEntry({
    email = "",
    name = "",
    authorized = true,
    qualifiedAt = null,
    updatedAt = new Date().toISOString(),
    assignmentUrl = "",
    legacyAssignmentUrl = "",
    githubOrg = "",
    githubToken = "",
    templateRepo = ""
} = {}) {
    return {
        email: normalizeEmail(email),
        name: normalizeText(name),
        authorized: authorized === true,
        qualifiedAt,
        updatedAt,
        assignmentUrl,
        legacyAssignmentUrl,
        githubOrg,
        githubToken,
        templateRepo
    };
}

async function upsertTutorConfigForUser(db, tutorUid, unitId, tutorConfig, {
    syncReferralUrl = null,
    syncReferralLinkFn = null
} = {}) {
    const userRef = db.collection('users').doc(tutorUid);
    await userRef.set({
        [unitId]: tutorConfig
    }, { merge: true });

    if (!syncReferralUrl || typeof syncReferralLinkFn !== 'function') return;

    const tutorDoc = await userRef.get();
    const tutorData = tutorDoc.exists ? (tutorDoc.data() || {}) : {};
    const tutorName = tutorData.name || tutorData.displayName || tutorConfig.email || '';
    await syncReferralLinkFn(db, syncReferralUrl, tutorConfig.email || '', tutorName, unitId);
}

function indexAuthorizedTutorConfigForDashboard({
    uData,
    email,
    unitId,
    config,
    lessons,
    synthesizedConfigs,
    unitTutorConfigs,
    unitToDocId,
    authorizedCourseIds,
    findCourseByUnitIdFn = null,
    findCourseByPageOrUnitFn = null
}) {
    const docId = unitId;
    if (!docId) return;
    let normalizedUnitId = docId;
    let normalizedConfig = config;

    if (normalizedConfig && !normalizedConfig.authorized && normalizedConfig.html && normalizedConfig.html.authorized) {
        normalizedConfig = normalizedConfig.html;
        if (!normalizedUnitId.endsWith('.html')) normalizedUnitId += '.html';
    }

    if (!normalizedConfig || !normalizedConfig.authorized) return;

    const courseRecord = (typeof findCourseByUnitIdFn === 'function' && findCourseByUnitIdFn(normalizedUnitId, lessons))
        || (typeof findCourseByPageOrUnitFn === 'function' && findCourseByPageOrUnitFn(normalizedUnitId, normalizedUnitId, lessons));
    const cid = courseRecord ? courseRecord.courseId : normalizedUnitId;
    const tutorSummary = {
        email,
        name: resolveNameFromUserData(uData, email, ""),
        qualifiedAt: normalizedConfig.updatedAt || normalizedConfig.qualifiedAt,
        assignmentUrl: getPreferredAssignmentUrl(normalizedConfig),
        legacyAssignmentUrl: normalizedConfig.githubClassroomUrl || "",
        githubOrg: normalizedConfig.githubOrg || "",
        templateRepo: normalizedConfig.templateRepo || "",
        githubToken: normalizedConfig.githubToken || ""
    };

    if (!synthesizedConfigs[cid]) {
        synthesizedConfigs[cid] = {
            authorizedTutors: [],
            tutorDetails: {},
            assignmentUrlMap: {},
            assignmentUrls: {}
        };
    }
    if (!synthesizedConfigs[cid].assignmentUrlMap[normalizedUnitId]) {
        synthesizedConfigs[cid].assignmentUrlMap[normalizedUnitId] = {};
    }
    if (!synthesizedConfigs[cid].assignmentUrls[normalizedUnitId]) {
        synthesizedConfigs[cid].assignmentUrls[normalizedUnitId] = {};
    }
    if (!synthesizedConfigs[cid].authorizedTutors.includes(email)) {
        synthesizedConfigs[cid].authorizedTutors.push(email);
    }
    synthesizedConfigs[cid].tutorDetails[email] = tutorSummary;
    const assignmentUrl = getPreferredAssignmentUrl(normalizedConfig);
    if (assignmentUrl) {
        synthesizedConfigs[cid].assignmentUrlMap[normalizedUnitId][email] = assignmentUrl;
        synthesizedConfigs[cid].assignmentUrls[normalizedUnitId][email] = assignmentUrl;
    }

    if (normalizedUnitId.endsWith('.html')) {
        if (!unitTutorConfigs[normalizedUnitId]) {
            unitTutorConfigs[normalizedUnitId] = {
                courseId: cid,
                authorizedTutors: [],
                tutorDetails: {},
                assignmentUrlMap: {},
                assignmentUrls: {}
            };
        }
        if (!unitTutorConfigs[normalizedUnitId].authorizedTutors.includes(email)) {
            unitTutorConfigs[normalizedUnitId].authorizedTutors.push(email);
        }
        unitTutorConfigs[normalizedUnitId].tutorDetails[email] = tutorSummary;
        if (assignmentUrl) {
            unitTutorConfigs[normalizedUnitId].assignmentUrlMap[normalizedUnitId] = unitTutorConfigs[normalizedUnitId].assignmentUrlMap[normalizedUnitId] || {};
            unitTutorConfigs[normalizedUnitId].assignmentUrls[normalizedUnitId] = unitTutorConfigs[normalizedUnitId].assignmentUrls[normalizedUnitId] || {};
            unitTutorConfigs[normalizedUnitId].assignmentUrlMap[normalizedUnitId][email] = assignmentUrl;
            unitTutorConfigs[normalizedUnitId].assignmentUrls[normalizedUnitId][email] = assignmentUrl;
        }
    }

    unitToDocId[cid] = normalizedUnitId;
    if (normalizedConfig.authorized && !authorizedCourseIds.includes(cid)) {
        authorizedCourseIds.push(cid);
    }
}

module.exports = {
    assertTutorApplicationState,
    buildTutorApplicationLegacyEntry,
    buildTutorApplicationRecord,
    buildTutorConfigEntry,
    fallbackNameFromEmail,
    generatePromotionCode,
    getEffectiveTutorConfig,
    getUserTutorConfig,
    getPreferredAssignmentUrl,
    indexAuthorizedTutorConfigForDashboard,
    normalizeEmail,
    normalizeText,
    queryTutorApplications,
    resolveNameFromUserData,
    resolveAssignmentUrlMaps,
    upsertTutorApplicationLegacyEntry,
    upsertTutorConfigForUser
};
