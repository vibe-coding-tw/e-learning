console.log("Dashboard Script v2026.05.15.V23.INVITE_BINDING_TOOL Loaded");
// alert("Dashboard Script v6 Loaded"); // Uncomment if needed for hard debugging

import { app } from "./firebase-init.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
import { getFirestore, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { connectFirebaseEmulators } from "./firebase-local.js?v=3";

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'asia-east1');
connectFirebaseEmulators({ auth, db, functions });
const vibeFetchLessons = httpsCallable(functions, 'getLessonsMetadata');
const getSystemConfig = httpsCallable(functions, 'getSystemConfig');
const updateSystemConfigCallable = httpsCallable(functions, 'updateSystemConfig');
const PUBLIC_SITE_URL = 'https://vibe-coding.tw';
const {
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
} = window.dashboardLookupUtils || {};
const isAdminEmail = window.vibeRoleUtils?.isAdminEmail || function (value = "") {
    return String(value || "").trim().toLowerCase() === "rover.k.chen@gmail.com";
};
const isPhysicalMetadataLesson = window.dashboardLookupUtils?.isPhysicalMetadataLesson || function (lesson = {}) {
    const metadataType = String(lesson?.metadataType || "").toLowerCase();
    return metadataType === "product" || metadataType === "legacy_product";
};
const { normalizeCanonicalRepoSlug, legacyRepoSlugFromCanonical } = window.repoSlugUtils || {};

window.normalizeDashboardLooseKey = window.normalizeDashboardLooseKey || normalizeDashboardLooseKey;
window.getLessonLookupKeys = window.getLessonLookupKeys || getLessonLookupKeys;
window.getCanonicalLessonIdentity = window.getCanonicalLessonIdentity || getCanonicalLessonIdentity;
window.resolveLessonByAnyKey = window.resolveLessonByAnyKey || resolveLessonByAnyKey;
window.getEquivalentUnitIds = window.getEquivalentUnitIds || getEquivalentUnitIds;
window.resolveCanonicalUnitId = window.resolveCanonicalUnitId || resolveCanonicalUnitId;
window.findParentCourseIdByUnit = window.findParentCourseIdByUnit || findParentCourseIdByUnit;
window.getPreferredUnitId = window.getPreferredUnitId || getPreferredUnitId;
window.normalizeTutorAdminUnitId = window.normalizeTutorAdminUnitId || normalizeTutorAdminUnitId;
window.normalizeTutorIdentifier = window.normalizeTutorIdentifier || normalizeTutorIdentifier;

if (typeof window.notify !== 'function') {
    window.notify = function (message, variant = 'info') {
        const text = String(message || '').trim();
        const toneMap = {
            success: { bg: 'bg-emerald-600', border: 'border-emerald-700', label: '成功' },
            warning: { bg: 'bg-amber-500', border: 'border-amber-600', label: '提醒' },
            error: { bg: 'bg-rose-600', border: 'border-rose-700', label: '錯誤' },
            info: { bg: 'bg-slate-900', border: 'border-slate-800', label: '資訊' }
        };
        const tone = toneMap[String(variant || 'info').toLowerCase()] || toneMap.info;

        if (!text) return;

        let host = document.getElementById('vibe-toast-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'vibe-toast-host';
            host.className = 'fixed top-4 right-4 z-[10000001] flex flex-col gap-2 pointer-events-none';
            document.body.appendChild(host);
        }

        const el = document.createElement('div');
        el.className = `pointer-events-auto max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold text-white shadow-xl ${tone.bg} ${tone.border}`;
        el.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="mt-0.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">${tone.label}</div>
                <div class="min-w-0 flex-1 leading-6">${escapeHtml(text)}</div>
            </div>
        `;
        host.appendChild(el);

        window.setTimeout(() => {
            el.classList.add('opacity-0', 'translate-y-1');
            el.style.transition = 'opacity 180ms ease, transform 180ms ease';
            el.style.opacity = '0';
            el.style.transform = 'translateY(4px)';
            window.setTimeout(() => el.remove(), 220);
        }, 2800);
    };
}

window.vibeShowToast = window.vibeShowToast || window.notify;
window.showToast = window.showToast || window.notify;

/**
 * Standard Email Normalizer
 */
function normalizeEmail(email) {
    if (!email) return "";
    return String(email).trim().toLowerCase();
}

function normalizeAssignmentLinkUrl(raw = '') {
    return String(raw || '').trim();
}

function isValidAssignmentLinkUrl(url = '') {
    const value = String(url || '').trim();
    if (!value) return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function isLikelyAssignmentLink(url = '') {
    const s = String(url || '').toLowerCase();
    return s.includes('classroom.github.com') || s.includes('github.com/classroom');
}

function getAssignmentUrlMapForUnit(urlMaps, unitId) {
    if (!urlMaps || typeof urlMaps !== 'object' || Array.isArray(urlMaps)) return null;

    const candidateIds = [
        unitId,
        ...(typeof getEquivalentUnitIds === 'function' ? getEquivalentUnitIds(unitId || '') : [])
    ].filter(Boolean);

    for (const candidateId of candidateIds) {
        const candidateMap = urlMaps[candidateId];
        if (!candidateMap) continue;
        if (typeof candidateMap === 'string') return { default: candidateMap };
        if (typeof candidateMap === 'object' && !Array.isArray(candidateMap)) return candidateMap;
    }

    if (typeof urlMaps.default === 'string') return { default: urlMaps.default };
    if (typeof urlMaps.default === 'object' && !Array.isArray(urlMaps.default)) return urlMaps.default;
    if (Object.values(urlMaps).some(value => typeof value === 'string')) return urlMaps;
    return null;
}

function getAssignmentUrlForTutor(urlMaps, unitId, email) {
    const unitMap = getAssignmentUrlMapForUnit(urlMaps, unitId);
    if (!unitMap) return '';
    return unitMap[email] || unitMap.default || Object.values(unitMap).find(value => typeof value === 'string' && value.trim()) || '';
}

function normalizeGuideTitleText(text = '') {
    let value = String(text || '').trim();
    if (!value) return value;

    // Remove unit slug prefix like "03-unit-github-classroom：" / "adv-12-unit-pid-math:"
    value = value.replace(/^(?:[a-z]+-\d{2}-)?unit-[a-z0-9-]+\s*[：:]\s*/i, '');
    // Remove simple unit slug prefix like "03-unit-github-classroom："
    value = value.replace(/^[a-z0-9]+-unit-[a-z0-9-]+\s*[：:]\s*/i, '');
    // Normalize tutor-guide title patterns and remove slug tail
    value = value.replace(/^(導師合作|Tutor Collaboration)\s*[-：:|｜]\s*[a-z0-9-]+\s*/i, '$1：');
    // Remove trailing slug in parentheses
    value = value.replace(/\s*\(([a-z0-9]+-unit-[a-z0-9-]+)\)\s*$/i, '');

    return value.trim();
}

function normalizeGuideHeadingStyles(rootEl) {
    if (!rootEl) return;
    const headings = rootEl.querySelectorAll('h1, h2, h3');
    headings.forEach((heading, index) => {
        const normalizedText = normalizeGuideTitleText(heading.textContent);
        if (normalizedText && normalizedText !== heading.textContent.trim()) {
            heading.textContent = normalizedText;
        }

        if (heading.tagName.toLowerCase() === 'h1') {
            heading.classList.add('text-2xl', 'md:text-3xl', 'font-black', 'leading-tight', 'tracking-tight');
            if (index === 0) heading.classList.add('mb-4');
        } else if (heading.tagName.toLowerCase() === 'h2') {
            heading.classList.add('text-xl', 'md:text-2xl', 'font-extrabold', 'leading-snug');
        } else {
            heading.classList.add('text-lg', 'md:text-xl', 'font-bold', 'leading-snug');
        }
    });
}

function normalizeMultilineList(value = "") {
    return String(value || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseJsonLoose(value = "{}", fallback = {}) {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch (err) {
        throw new Error(`JSON 解析失敗：${err.message}`);
    }
}

function toPrettyJson(value = {}) {
    try {
        return JSON.stringify(value ?? {}, null, 2);
    } catch (_) {
        return "{}";
    }
}

function setDashboardLog(message = "", { replace = false } = {}) {
    const host = document.getElementById('dashboard-log');
    if (!host) return;
    if (!Array.isArray(window.__dashboardLogLines) || replace) {
        window.__dashboardLogLines = [];
    }
    const text = String(message || '').trim();
    if (text) {
        const stamp = new Date().toLocaleTimeString('zh-TW', { hour12: false });
        window.__dashboardLogLines.push(`[${stamp}] ${text}`);
    }
    window.__dashboardLogLines = window.__dashboardLogLines.slice(-20);
    host.textContent = window.__dashboardLogLines.length
        ? window.__dashboardLogLines.join('\n')
        : '等待載入系統訊息。';
}

function applyDashboardSystemConfigToUI(config = {}) {
    const defaultLocaleEl = document.getElementById('sys-default-locale-select');
    const defaultRegionEl = document.getElementById('sys-default-region-input');
    const defaultDistributorEl = document.getElementById('sys-default-distributor-input');
    const contentVersionEl = document.getElementById('sys-content-version-input');
    const supportedLocalesEl = document.getElementById('sys-supported-locales-input');
    const localeLabelsEl = document.getElementById('sys-locale-labels-input');
    const versionDisplay = document.getElementById('current-content-version-display');
    const localeStatus = document.getElementById('dashboard-locale-status');
    const defaultLocale = String(config.defaultLocale || 'en').trim() || 'en';

    if (defaultLocaleEl) defaultLocaleEl.value = defaultLocale;
    if (defaultRegionEl) defaultRegionEl.value = String(config.defaultRegion || 'US').trim() || 'US';
    if (defaultDistributorEl) defaultDistributorEl.value = String(config.defaultDistributorId || 'default-usd').trim() || 'default-usd';
    if (contentVersionEl && !contentVersionEl.value && config.contentVersion) {
        contentVersionEl.value = String(config.contentVersion || '');
    }
    if (supportedLocalesEl) supportedLocalesEl.value = Array.isArray(config.supportedLocales) ? config.supportedLocales.join('\n') : '';
    if (localeLabelsEl) localeLabelsEl.value = toPrettyJson(config.localeLabels || {});
    if (versionDisplay) {
        versionDisplay.textContent = `當前鎖定版本 (Current Locked Hash): ${config.contentVersion || '未設定 (None)'}`;
    }
    if (localeStatus) {
        localeStatus.textContent = `已載入 · ${defaultLocale}`;
    }
}

async function loadDashboardSystemConfig() {
    try {
        const response = await getSystemConfig({});
        const data = response?.data || {};
        dashboardData = dashboardData || {};
        dashboardData.systemConfig = {
            contentVersion: data.contentVersion || dashboardData.contentVersion || '',
            defaultLocale: data.defaultLocale || 'en',
            defaultRegion: data.defaultRegion || 'US',
            defaultDistributorId: data.defaultDistributorId || 'default-usd',
            supportedLocales: Array.isArray(data.supportedLocales) ? data.supportedLocales : [],
            localeLabels: data.localeLabels && typeof data.localeLabels === 'object' && !Array.isArray(data.localeLabels) ? data.localeLabels : {}
        };
        applyDashboardSystemConfigToUI(dashboardData.systemConfig);
        setDashboardLog('已載入站台 locale 設定。', { replace: true });
    } catch (err) {
        console.error('[dashboard] loadDashboardSystemConfig failed:', err);
        setDashboardLog(`站台 locale 設定載入失敗：${err?.message || err}`, { replace: true });
    }
}

window.updateSystemDefaults = async function() {
    const payload = {
        defaultLocale: document.getElementById('sys-default-locale-select')?.value || 'en',
        defaultRegion: document.getElementById('sys-default-region-input')?.value || 'US',
        defaultDistributorId: document.getElementById('sys-default-distributor-input')?.value || 'default-usd'
    };

    const btn = document.getElementById('btn-save-system-defaults');
    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '儲存中...';
    }

    try {
        const res = await updateSystemConfigCallable(payload);
        if (res?.data?.success) {
            setDashboardLog('已儲存系統預設值。');
            await loadDashboardSystemConfig();
            notify('系統預設值已更新', 'success');
        } else {
            throw new Error('更新失敗');
        }
    } catch (err) {
        console.error('updateSystemDefaults error:', err);
        notify(`儲存系統預設值失敗：${err.message}`, 'error');
        setDashboardLog(`系統預設值儲存失敗：${err?.message || err}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

window.saveDashboardLocaleSettings = async function() {
    const payload = {
        supportedLocales: normalizeMultilineList(document.getElementById('sys-supported-locales-input')?.value || ''),
        localeLabels: parseJsonLoose(document.getElementById('sys-locale-labels-input')?.value || '{}', {})
    };

    const btn = document.getElementById('btn-save-locale-settings');
    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '儲存中...';
    }

    try {
        const res = await updateSystemConfigCallable(payload);
        if (res?.data?.success) {
            setDashboardLog('已儲存站台 locale 設定。');
            await loadDashboardSystemConfig();
            notify('站台 locale 設定已更新', 'success');
        } else {
            throw new Error('更新失敗');
        }
    } catch (err) {
        console.error('saveDashboardLocaleSettings error:', err);
        notify(`儲存 locale 設定失敗：${err.message}`, 'error');
        setDashboardLog(`locale 設定儲存失敗：${err?.message || err}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

// DOM Elements
const loadingState = document.getElementById('loading-state');
const dashboardContent = document.getElementById('dashboard-content');
const accessDenied = document.getElementById('access-denied');

window.toggleRow = function(uid) {
    console.log("[Dashboard] Toggling row for UID:", uid);
    // Use data attribute instead of class to be safer with special characters
    const detailsRows = document.querySelectorAll(`tr[data-parent-uid="${uid}"]`);
    const icon = document.getElementById(`icon-${uid}`);
    
    if (detailsRows.length === 0) {
        console.warn("[Dashboard] No details rows found for UID:", uid);
        return;
    }

    detailsRows.forEach(row => {
        row.classList.toggle('hidden');
    });
    
    if (icon) {
        const isCollapsed = detailsRows[0].classList.contains('hidden');
        icon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)';
    }
};

const userDisplay = document.getElementById('user-display');
const userUidDisplay = document.getElementById('user-uid-display');
const stats = {
    students: document.getElementById('stat-students'),
    hours: document.getElementById('stat-hours'),
};

// Removed singular assignmentTableBody in favor of plural class-based updates.

// Admin UI
//const adminPanel = document.getElementById('admin-panel');


let myRole = null;
let myUid = null;
let myEmail = null;
let charts = {};
let dashboardData = null;
let lessonsMap = {};
let unitsTitleMap = {};
let allLessons = [];
let currentGradingAssignment = null;
let currentDashboardPermissions = {
    isAdmin: false,
    isQualifiedTutor: false,
    isPaidStudent: false,
    canViewAssignments: false,
    canViewSettings: false,
    canViewUnitSettings: false
};

// [NEW] Admin Super Mode state
// [NEW] Admin Tutor Mode state (formerly Super Mode)
const ADMIN_TUTOR_MODE_STORAGE_KEY = 'adminTutorMode';

function getAdminTutorModeStorageKey(uid = '') {
    const cleanUid = String(uid || '').trim();
    return cleanUid ? `${ADMIN_TUTOR_MODE_STORAGE_KEY}:${cleanUid}` : ADMIN_TUTOR_MODE_STORAGE_KEY;
}

function readAdminTutorModeForUid(uid = '') {
    const cleanUid = String(uid || '').trim();
    if (!cleanUid) return false;
    try {
        const scopedKey = getAdminTutorModeStorageKey(cleanUid);
        const scopedValue = localStorage.getItem(scopedKey);
        if (scopedValue !== null) return scopedValue === 'true';

        const legacyValue = localStorage.getItem(ADMIN_TUTOR_MODE_STORAGE_KEY);
        if (legacyValue !== null) {
            localStorage.setItem(scopedKey, legacyValue);
            localStorage.removeItem(ADMIN_TUTOR_MODE_STORAGE_KEY);
            return legacyValue === 'true';
        }
    } catch (_) {}
    return false;
}

function writeAdminTutorModeForUid(uid = '', enabled = false) {
    const cleanUid = String(uid || '').trim();
    if (!cleanUid) return false;
    try {
        localStorage.setItem(getAdminTutorModeStorageKey(cleanUid), enabled ? 'true' : 'false');
        localStorage.removeItem(ADMIN_TUTOR_MODE_STORAGE_KEY);
    } catch (_) {}
    return enabled === true;
}

let adminTutorMode = false;
let forceTutorModeByQuery = false;
window.vibeShowInterventionDashboard = window.vibeShowInterventionDashboard ?? false;
try {
    const initialParams = new URLSearchParams(window.location.search);
    const forceTutorMode = initialParams.get('tutorMode');
    if (forceTutorMode === '1' || forceTutorMode === 'true') {
        adminTutorMode = true;
        forceTutorModeByQuery = true;
    }
} catch (_) {}


// [REMOVED] MASTER_UNIT_MAPPING is now standardized in lessons.json


// [Global UI Init] Check for Iframe Mode immediately
(function initIframeMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    if (mode === 'iframe') {
        // Force hide navbar
        const nav = document.querySelector('nav');
        if (nav) nav.style.display = 'none';

        // Hide standard header elements if any
        document.body.classList.add('bg-white');

        // Add specific style to ensure nav is hidden even if script runs early
        const style = document.createElement('style');
        // Force hide nav, reset container padding/width
        style.textContent = `
            nav { display: none !important; } 
            .container { padding-top: 0 !important; max-width: 100% !important; }
            #dashboard-content { padding: 1rem !important; }
            body { background: white !important; }
        `;
        document.head.appendChild(style);

        // Also adjust dashboardContent if it exists already, usually it does
        if (dashboardContent) {
            dashboardContent.classList.remove('pt-24', 'pb-12', 'space-y-6');
            dashboardContent.classList.add('p-2', 'space-y-4');
        }
    }
})();

// --- Auth State ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUid = user.uid;
        myEmail = user.email;
        adminTutorMode = forceTutorModeByQuery ? true : readAdminTutorModeForUid(user.uid);
        if (forceTutorModeByQuery) {
            writeAdminTutorModeForUid(user.uid, true);
        }
        if (userDisplay) userDisplay.textContent = `您好, ${user.displayName || '使用者'}`;
        await loadLessons();
        loadDashboard();
    } else {
        adminTutorMode = false;
        // [MODIFIED] No more redirect, show guest view for Incognito/Unauthenticated
        console.log("[Auth] No user detected, showing guest prompt.");
        showAccessDenied("GUEST");
    }
});

async function loadLessons() {
    try {
        // [MOD] Use centralized Firestore-backed fetch from course-shared.js
        if (typeof vibeFetchLessons === 'function') {
            const result = await vibeFetchLessons();
            // [FIX v11.3.143] Properly unpack result.data.lessons for Callable result
            allLessons = (result && result.data && result.data.lessons) ? result.data.lessons : (Array.isArray(result) ? result : []);
        } else {
            console.error("[Dashboard] vibeFetchLessons not found. Firestore data unavailable.");
            allLessons = [];
        }
        
        console.log(`[Dashboard] Loaded ${allLessons.length} lessons from metadata source.`);
        syncLessonsAndUnitsMap(allLessons);
    } catch (e) {
        console.error("Failed to load lessons:", e);
    }
}

function syncLessonsAndUnitsMap(lessons) {
    if (!lessons) return;
    lessons.forEach(l => {
        lessonsMap[l.courseId] = l.title;
        if (l.courseUnits && l.courseUnitTitles) {
            l.courseUnits.forEach((u, i) => {
                const uid = resolveCanonicalUnitId(u);
                unitsTitleMap[uid] = l.courseUnitTitles[i];
            });
        }
    });
}


// Initialize on Load
// loadDashboard(); // This is called in onAuthStateChanged

// --- Main Data Fetching ---
async function loadDashboard() {
    try {
        updateFooterVisibilityForUnitContext();
        const { filterUnitId, filterCourseId } = getCurrentDashboardContext();
        const hasUnitContext = !!filterUnitId;
        
        // [V12.1.2] SECURITY RULE: Global dashboard (no orientation) is ADMIN ONLY.
        const dashboardPayload = {
            unitId: filterUnitId,
            courseId: filterCourseId,
            tutorMode: adminTutorMode // [V13.0.8] Pass simulation flag to backend
        };

        const getDashboardData = httpsCallable(functions, 'getDashboardData');
        const response = await getDashboardData(dashboardPayload);
        const data = response.data;

        // [FIX] Aggregate data (map filename IDs to real Course IDs)
        aggregateData(data);
        dashboardData = data;
        syncDistributorPriceBookContext();

        // [FIX] Ensure allLessons is populated. 
        if (!allLessons || allLessons.length === 0) {
            if (data.lessons && data.lessons.length > 0) {
                allLessons = data.lessons;
                syncLessonsAndUnitsMap(allLessons);
            } else if (typeof vibeFetchLessons === 'function') {
                const result = await vibeFetchLessons();
                allLessons = (result && result.data && result.data.lessons) ? result.data.lessons : (Array.isArray(result) ? result : []);
                syncLessonsAndUnitsMap(allLessons);
            }
        }

        const currentUser = auth.currentUser;
        myRole = isAdminEmail(currentUser?.email) ? "admin" : (data.role || "");
        const isAdmin = myRole === 'admin';
        const hasPaidAnything = (data.students?.[0]?.orders?.length > 0 || data.students?.[0]?.accountStatus === 'paid');
        
        // Final Rule enforcement: Global dashboard (no unitId) is admin-only.
        if (!hasUnitContext && !isAdmin) {
            console.warn("[Security] Non-Admin global access denied.");
            showAccessDenied("ADMIN_ONLY_NO_UNIT");
            return;
        }

        const isQualifiedTutor = hasQualifiedTutorAccessForUnit(filterUnitId, filterCourseId, myEmail);

        let isPaidStudent = hasUnitContext
            ? await hasPaidStudentAccessForUnit(filterCourseId, filterUnitId)
            : hasPaidAnything;

        const activeLesson = resolveLessonByAnyKey(filterCourseId) || resolveLessonByAnyKey(filterUnitId) || null;
        const activeLessonPrice = activeLesson
            ? Math.max(
                Number(getLessonBusinessPrice(activeLesson, "zh-TW").amount || 0),
                Number(getLessonBusinessPrice(activeLesson, "en").amount || 0)
            )
            : null;
        const isStarterLesson = !!(activeLesson && (
            String(activeLesson.courseId || activeLesson.courseKey || activeLesson.id || "").toLowerCase().startsWith("car-starter-") ||
            String(activeLesson.category || "").toLowerCase() === "start" ||
            String(activeLesson.category || "").toLowerCase() === "started" ||
            String(activeLesson.level || "").toLowerCase() === "starter" ||
            String(activeLesson.level || "").toLowerCase() === "start" ||
            String(activeLesson.level || "").toLowerCase() === "started"
        ));
        const isFreeCourseContext = !!(hasUnitContext && activeLesson && isStarterLesson && Number(activeLessonPrice) === 0);

        if (!isAdmin && !isQualifiedTutor && !isPaidStudent && isFreeCourseContext) {
            console.log(`[Dashboard] Free course context detected for ${filterCourseId || filterUnitId}; allowing student dashboard access.`);
            isPaidStudent = true;
        }
            
        updateCurrentDashboardPermissions({ isAdmin, isQualifiedTutor, isPaidStudent });
        setupRealTimeAssignmentsListener({ isAdmin, isQualifiedTutor, filterUnitId, filterCourseId });
        const requestedTab = getRequestedTabFromUrl();

        // Determine the default tab to switch to on initial load
        let preferredTab = requestedTab;
        if (!preferredTab && filterUnitId) {
            preferredTab = getPreferredDashboardTab(filterUnitId);
        }

        if (isAdmin || isQualifiedTutor) {
            // Admin/Tutor View (Management)
            setupAdminFeatures();
            setupSettingsFeature();
            renderAdminDashboard(data, filterUnitId);

            if (preferredTab) {
                switchTab(preferredTab);
            } else {
                const activeTab = document.querySelector('.tab-btn.text-blue-600');
                if (activeTab) {
                    const tabId = String(activeTab.id || '').replace('tab-btn-', '');
                    if (tabId === 'tutors') renderAdminConsole();
                    if (tabId === 'settings') renderSettingsTab(filterUnitId);
                }
            }
            
            // [NEW] Ensure Admin Tutor Mode toggle is injected on initial load
            if (typeof vibeInjectAdminTutorModeToggle === 'function') {
                vibeInjectAdminTutorModeToggle();
            }
        } else if (isPaidStudent) {
            // Paid student unit view
            renderStudentDashboard(data, filterUnitId);
            if (preferredTab) {
                switchTab(preferredTab);
            }
        } else {
            showAccessDenied();
        }

        await window.maybeHandleTutorRecommendationInviteAction();
    } catch (error) {
        console.error("Dashboard Load Error:", error);
        showAccessDenied(error.message);
    }
}

function setupRealTimeAssignmentsListener({ isAdmin, isQualifiedTutor, filterUnitId, filterCourseId }) {
    if (window.assignmentsListenerUnsubscribe) {
        window.assignmentsListenerUnsubscribe();
        window.assignmentsListenerUnsubscribe = null;
    }

    if (!auth.currentUser) return;

    let q;
    const assignmentsCol = collection(db, "assignments");
    
    if (isAdmin) {
        if (filterUnitId) {
            q = query(assignmentsCol, where("unitId", "==", filterUnitId));
        } else {
            q = query(assignmentsCol);
        }
    } else if (isQualifiedTutor) {
        // Tutor view: fetch all assignments and filter client-side so legacy rows without assignedTutorEmail
        // or rows with slightly different assignment metadata still remain visible.
        q = query(assignmentsCol);
    } else {
        // Student: query by userId
        q = query(assignmentsCol, where("userId", "==", auth.currentUser.uid));
    }

    try {
        console.log("[Dashboard] Initializing real-time assignments listener...");
        window.assignmentsListenerUnsubscribe = onSnapshot(q, (snapshot) => {
            console.log("[Dashboard] Real-time assignments update received, count:", snapshot.size);
            const updatedAssignments = [];
            snapshot.forEach(doc => {
                const aData = doc.data();
                updatedAssignments.push({ id: doc.id, ...aData });
            });

            // Update local dashboardData assignments cache
            if (dashboardData) {
                dashboardData.assignments = updatedAssignments;
            }

            // Re-render if the user is currently viewing the assignments tab
            const activeTabBtn = document.querySelector('.tab-btn.text-blue-600');
            const activeTab = activeTabBtn ? String(activeTabBtn.id || '').replace('tab-btn-', '') : 'overview';
            if (activeTab === 'assignments') {
                console.log("[Dashboard] Re-rendering assignments list in real-time...");
                let displayAssignments = filterAssignmentsForCurrentView(updatedAssignments);
                if (filterUnitId) {
                    displayAssignments = displayAssignments.filter(a => unitIdsMatch(a.unitId, filterUnitId));
                } else if (filterCourseId) {
                    displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
                }
                renderAssignments(displayAssignments, "", { showGuide: false });
            }
        }, (err) => {
            console.warn("[Dashboard] Real-time assignments listener failed:", err);
        });
    } catch (error) {
        console.error("[Dashboard] Error setting up real-time assignments listener:", error);
    }
}

function showAccessDenied(errorType = "") {
    loadingState.classList.add('hidden');
    accessDenied.classList.remove('hidden');

    const guestView = document.getElementById('guest-view');
    const adminSetupNote = document.getElementById('admin-setup-note');
    const deniedTitle = document.getElementById('denied-title');
    const deniedMsg = document.getElementById('denied-msg');

    if (errorType === "GUEST") {
        // Show Login Prompt
        if (deniedTitle) deniedTitle.innerText = window.t('dash_hello_guest', "👋 您好！閣下尚未登入");
        if (deniedMsg) deniedMsg.innerText = window.t('dash_guest_msg', "本頁面為個人學習儀表板，請登入以查看您的數據。");
        if (guestView) guestView.classList.remove('hidden');
        if (adminSetupNote) adminSetupNote.classList.add('hidden');
    } else if (errorType === "ADMIN_ONLY_NO_UNIT") {
        if (deniedTitle) deniedTitle.innerText = window.t('dash_denied_title_admin_only', "⛔ 僅限管理員");
        if (deniedMsg) deniedMsg.innerText = window.t('dash_denied_msg_admin_only', "未指定課程單元時，只有管理員可以存取 Dashboard。");
        if (guestView) guestView.classList.add('hidden');
        if (adminSetupNote) adminSetupNote.classList.add('hidden');
    } else {
        // Show Access Denied (Logged in but no permission)
        if (deniedTitle) deniedTitle.innerText = window.t('dash_denied_title', "⛔ 權限不足");
        if (deniedMsg) deniedMsg.innerText = window.t('dash_denied_msg', "只有管理員、該單元合格導師，或該單元已付款學生可以存取此頁面。");
        if (guestView) guestView.classList.add('hidden');
        if (adminSetupNote) adminSetupNote.classList.remove('hidden');

        const user = auth.currentUser;
        if (user && userUidDisplay) {
            userUidDisplay.innerText = user.uid;
        }

        if (errorType && errorType !== "GUEST") {
            // [DEBUG] Show error to user to help pinpoint if it's a code crash
            const errorDisplay = document.createElement('div');
            errorDisplay.className = 'mt-4 p-2 bg-red-50 text-red-600 text-xs font-mono rounded border border-red-100';
            errorDisplay.innerText = `Error Details: ${errorType}`;
            accessDenied.appendChild(errorDisplay);
        }
    }
}

function updateCurrentDashboardPermissions({ isAdmin = false, isQualifiedTutor = false, isPaidStudent = false } = {}) {
    const { filterUnitId } = getCurrentDashboardContext();
    const isUnitContext = !!filterUnitId;
    const isGlobalAdmin = !isUnitContext && isAdmin;
    const canViewGlobalSettings = isGlobalAdmin;
    const canViewUnitSettings = isUnitContext && (
        isAdmin ? !!adminTutorMode : !!isQualifiedTutor
    );
    const canViewAssignments = isGlobalAdmin || isUnitContext;
    
    currentDashboardPermissions = {
        isAdmin,
        isQualifiedTutor,
        isPaidStudent,
        canViewAssignments,
        canViewSettings: canViewGlobalSettings,
        canViewUnitSettings
    };
}

function canCurrentUserViewAssignmentsTab() {
    return !!currentDashboardPermissions.canViewAssignments;
}

function canCurrentUserViewSettingsTab() {
    return !!currentDashboardPermissions.canViewSettings;
}

function canCurrentUserViewUnitSettingsTab() {
    return !!currentDashboardPermissions.canViewUnitSettings;
}

function getPreferredDashboardTab(filterUnitId = null) {
    // [V12.1.1] Rule: If no unit context, always prefer Overview for global perspective
    if (!filterUnitId) return 'overview';

    return 'assignments'; // student/default unit context tab
}

function updateFooterVisibilityForUnitContext() {
    const { filterUnitId } = getCurrentDashboardContext();
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;
    footerPlaceholder.classList.toggle('hidden', !!filterUnitId);
}

// Helper: Resolve URL param (e.g. "basic-01") to Course UUID
function resolveCourseIdFromUrlParam(paramId) {
    if (!paramId) return null;
    if (!allLessons || allLessons.length === 0) return paramId;

    // 1. Direct match (UUID)
    const direct = allLessons.find(l => l.courseId === paramId);
    if (direct) return paramId;

    // 2. Fuzzy match (作業連結 contains param)
    const legacyAssignmentMatch = allLessons.find(l => l.classroomUrl && l.classroomUrl.includes(paramId)); // legacy assignment link fallback
    if (legacyAssignmentMatch) {
        console.log(`Resolved URL value '${paramId}' to Course ID '${legacyAssignmentMatch.courseId}'`);
        return legacyAssignmentMatch.courseId;
    }

    return paramId;
}

window.unitIdsMatch = window.unitIdsMatch || function(id1, id2) {
    if (!id1 || !id2) return false;
    // Universal prefix stripper
    const clean = (id) => String(id).trim().toLowerCase().replace('.html', '').replace(/^(?:tw-(?:common|car-(?:starter|basic|advanced))-|start-|basic-|adv-|advanced-|prepare-)?(?:\d{2}-)?(?:unit-|lesson-|master-)?/i, '');
    return clean(id1) === clean(id2);
};

function isRenderableUnitFile(fileName) {
    return typeof fileName === 'string' && fileName.endsWith('.html');
}

function shouldHideTutorAdminUnit(unitId) {
    const normalized = normalizeTutorAdminUnitId(unitId);
    return normalized === '02-unit-vibe-coding-intro.html' ||
        normalized === '02-unit-teacher-matrix.html';
}

function getCurrentDashboardContext() {
    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));
    let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));
    if (!filterCourseId && filterUnitId) {
        filterCourseId = findParentCourseIdByUnit(filterUnitId);
    }

    return { filterUnitId, filterCourseId };
}

function getRequestedTabFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const rawTab = (urlParams.get('tab') || '').trim();
    const requestedTab = rawTab === 'logistics'
        ? 'shipments'
        : (rawTab === 'admin' ? 'tutors' : rawTab); // backward compatibility
    const allowedTabs = new Set(['overview', 'assignments', 'settings', 'tutors', 'shipments']);
    return allowedTabs.has(requestedTab) ? requestedTab : '';
}

function getUnitTutorConfig(fileName) {
    const candidateIds = getEquivalentUnitIds(fileName);
    const unitConfigs = dashboardData?.unitTutorConfigs || {};
    for (const candidateId of candidateIds) {
        if (unitConfigs[candidateId]) return unitConfigs[candidateId];
    }
    return {
        courseId: findParentCourseIdByUnit(fileName),
        authorizedTutors: [],
        tutorDetails: {},
        assignmentUrlMap: {},
        assignmentUrls: {}
    };
}

function getCourseGuideConfig(courseId) {
    return dashboardData?.courseGuideIndex?.[courseId] || {};
}

function resolveGuideContentFileName(unitId) {
    const raw = String(unitId || '').trim();
    if (!raw) return '';
    const fileName = raw.split('/').pop().split('?')[0].split('#')[0].replace(/\.html$/i, '');
    if (!fileName) return '';

    let resolved = fileName.replace(/^(?:tw|en)-/i, '');
    if (/^start-\d{2}-unit-/i.test(resolved)) {
        resolved = resolved.replace(/^start-\d{2}-unit-/i, 'car-starter-');
    } else if (/^basic-\d{2}-unit-/i.test(resolved)) {
        resolved = resolved.replace(/^basic-\d{2}-unit-/i, 'car-basic-');
    } else if (/^(?:adv|advanced)-\d{2}-unit-/i.test(resolved)) {
        resolved = resolved.replace(/^(?:adv|advanced)-\d{2}-unit-/i, 'car-advanced-');
    } else if (/^\d{2}-(?:unit|lesson|master)-/i.test(resolved)) {
        resolved = resolved.replace(/^\d{2}-(?:unit|lesson|master)-/i, 'common-');
    } else if (/^prepare-\d+-(.+)$/i.test(resolved)) {
        resolved = resolved.replace(/^prepare-\d+-/, 'common-');
    }

    return `${resolved}.html`;
}

function getCachedGuideSectionFromDashboard(filterUnitId, sectionId) {
    if (!filterUnitId || !sectionId) return "";
    const lessons = dashboardData?.lessons || [];
    const unitCandidates = new Set([
        ...getEquivalentUnitIds(filterUnitId),
        resolveGuideContentFileName(filterUnitId)
    ].filter(Boolean));
    const courseCandidates = [
        findParentCourseIdByUnit(filterUnitId, lessons),
        findParentCourseIdByUnit(resolveCanonicalUnitId(filterUnitId, lessons), lessons),
        resolveCanonicalUnitId(filterUnitId, lessons),
        filterUnitId
    ].filter(Boolean);

    for (const courseId of courseCandidates) {
        const guideConfig = getCourseGuideConfig(courseId);
        const guideBucket = sectionId === 'tutor-guide'
            ? (guideConfig.tutorGuide || {})
            : (guideConfig.assignmentGuide || {});
        if (!guideBucket || typeof guideBucket !== 'object') continue;
        for (const unitKey of unitCandidates) {
            if (typeof guideBucket[unitKey] === 'string' && guideBucket[unitKey].trim()) {
                return guideBucket[unitKey].trim();
            }
        }
    }

    return "";
}

function isNonCourseGuideContext(filterUnitId) {
    if (!filterUnitId) return false;
    const lesson = resolveLessonByAnyKey(filterUnitId) || findParentCourseIdByUnit(filterUnitId) && resolveLessonByAnyKey(findParentCourseIdByUnit(filterUnitId));
    if (!lesson) return false;
    const metadataType = String(lesson.metadataType || '').toLowerCase();
    return isPhysicalMetadataLesson(lesson) || (metadataType === 'product' && lesson.hiddenFromCatalog === true);
}

async function fetchGuideSectionFromUnitPage(filterUnitId, sectionId) {
    if (!filterUnitId || !sectionId) return "";
    const extractSection = (html, targetSectionId) => {
        const m = html.match(new RegExp(`<section\\b[^>]*id=["']${targetSectionId}["'][^>]*>([\\s\\S]*?)<\\/section>`, 'i'));
        return m && m[1] ? m[1].trim() : '';
    };
    try {
        const cachedSection = getCachedGuideSectionFromDashboard(filterUnitId, sectionId);
        if (cachedSection) return cachedSection;

        const lessons = dashboardData?.lessons || [];
        const unitToDocId = dashboardData?.unitToDocId || {};
        const canonicalUnitId = resolveCanonicalUnitId(filterUnitId, lessons, unitToDocId) || filterUnitId;
        const pageName = resolveGuideContentFileName(canonicalUnitId || filterUnitId);
        const parentCourseId = findParentCourseIdByUnit(filterUnitId, lessons) || findParentCourseIdByUnit(canonicalUnitId, lessons);
        const courseId = parentCourseId || canonicalUnitId || filterUnitId;
        
        const isTutor = (sectionId === 'tutor-guide');
        const checkAuthFunction = httpsCallable(functions, 'checkPaymentAuthorization');
        const response = await checkAuthFunction({
            pageId: courseId,
            fileName: pageName,
            tutorMode: isTutor || (myRole === 'admin' && adminTutorMode) || !!currentDashboardPermissions?.isQualifiedTutor
        });
        
        const token = response?.data?.token || response?.data?.result?.token;
        if (!token) {
            console.warn(`[GuideRefresh] No serve token returned for ${pageName}. Response:`, response);
            return getCachedGuideSectionFromDashboard(filterUnitId, sectionId);
        }
        
        const unitUrl = `${window.location.origin}/courses/${pageName}?token=${encodeURIComponent(token)}`;
        const resp = await fetch(unitUrl, { cache: 'no-store' });
        if (!resp.ok) {
            console.warn(`[GuideRefresh] serve fetch failed: ${resp.status} ${resp.statusText} for URL: ${unitUrl}`);
            return getCachedGuideSectionFromDashboard(filterUnitId, sectionId);
        }
        const html = await resp.text();
        const extracted = extractSection(html, sectionId);
        return extracted || getCachedGuideSectionFromDashboard(filterUnitId, sectionId);
    } catch (e) {
        console.warn(`[GuideRefresh] direct unit html fetch failed for #${sectionId}:`, e);
        return getCachedGuideSectionFromDashboard(filterUnitId, sectionId);
    }
}

function hasQualifiedTutorAccessForUnit(fileName, courseId, email) {
    if (!email || !fileName || !courseId) return false;

    const candidateIds = getEquivalentUnitIds(fileName);
    const normalizedEmail = normalizeTutorIdentifier(email);

    if (normalizedEmail === normalizeTutorIdentifier(myEmail)) {
        const myTutorConfigs = dashboardData?.myTutorConfigs || {};
        if (candidateIds.some(id => myTutorConfigs[id]?.authorized === true)) {
            return true;
        }
    }

    const unitConfig = getUnitTutorConfig(fileName);
    const authorizedTutors = Array.isArray(unitConfig.authorizedTutors) ? unitConfig.authorizedTutors : [];
    return authorizedTutors.map(normalizeTutorIdentifier).includes(normalizedEmail);
}

async function hasPaidStudentAccessForUnit(courseId, unitId) {
    if (!unitId || !auth.currentUser) return false;

    try {
        const resolvedCourseId = courseId
            || findParentCourseIdByUnit(unitId, allLessons)
            || (resolveLessonByAnyKey(unitId) ? getCanonicalLessonIdentity(resolveLessonByAnyKey(unitId)) : null);
        if (!resolvedCourseId) return false;
        const checkAuthFunction = httpsCallable(functions, 'checkPaymentAuthorization');
        const response = await checkAuthFunction({
            pageId: resolvedCourseId,
            fileName: unitId,
            tutorMode: false
        });
        return !!(response?.data?.authorized || response?.data?.result?.authorized);
    } catch (error) {
        console.error('[Dashboard] Failed to verify paid student access:', error);
        return false;
    }
}

function configureStudentTabsForUnitAccess() {
    const overviewTabBtn = document.getElementById('tab-btn-overview');
    const assignmentsTabBtn = document.getElementById('tab-btn-assignments');
    const settingsTabBtn = document.getElementById('tab-btn-settings');
    const adminTabBtn = document.getElementById('tab-btn-tutors');

    if (overviewTabBtn) overviewTabBtn.classList.add('hidden');
    if (assignmentsTabBtn) assignmentsTabBtn.classList.toggle('hidden', !canCurrentUserViewAssignmentsTab());
    if (settingsTabBtn) settingsTabBtn.classList.add('hidden');
    if (adminTabBtn) adminTabBtn.classList.add('hidden');
}

function filterAssignmentsForCurrentView(assignments = []) {
    const extractTutorEmail = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return normalizeEmail(value);
        if (typeof value === 'object') {
            return normalizeEmail(
                value.email ||
                value.tutorEmail ||
                value.referredTutorEmail ||
                value.referralTutor ||
                value.tutor ||
                value.value ||
                ''
            );
        }
        return normalizeEmail(String(value));
    };

    const isOwnAssignment = (assignment) =>
        (assignment.userId || assignment.uid) === myUid ||
        normalizeEmail(assignment.studentEmail || assignment.userEmail) === normalizeEmail(myEmail);

    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));

    const isStudentAssignedToMe = (assignment) => {
        const studentUid = assignment.userId || assignment.uid;
        if (!studentUid) return false;
        
        const students = dashboardData?.students || [];
        const student = students.find(s => s.uid === studentUid || s.id === studentUid);
        if (!student) return false;
        
        if (filterUnitId) {
            const assignedTutors = student.unitAssignments || {};
            const isMatch = Object.entries(assignedTutors).some(([uid, tutorEmail]) => {
                return unitIdsMatch(uid, filterUnitId) && extractTutorEmail(tutorEmail) === normalizeEmail(myEmail);
            });
            if (isMatch) return true;
        } else {
            const hasAnyAssignmentToMe = Object.values(student.unitAssignments || {}).some(tutorEmail => {
                return extractTutorEmail(tutorEmail) === normalizeEmail(myEmail);
            });
            if (hasAnyAssignmentToMe) return true;
        }
        
        if (assignment.assignedTutorEmail && normalizeEmail(assignment.assignedTutorEmail) === normalizeEmail(myEmail)) {
            return true;
        }
        
        return false;
    };

    // 2. Unit Context: STRICT Role simulation for Admins/Tutors
    if (filterUnitId) {
        if (currentDashboardPermissions.isAdmin) {
            if (adminTutorMode) {
                // Admin in TUTOR mode: Only see assigned students, hide own.
                console.log("[Debug] Admin Simulation: TUTOR MODE");
                return assignments.filter(a => {
                    return isStudentAssignedToMe(a) && !isOwnAssignment(a);
                });
            } else {
                // Admin in STUDENT mode: Only see own.
                console.log("[Debug] Admin Simulation: STUDENT MODE");
                return assignments.filter(isOwnAssignment);
            }
        }
        
        if (currentDashboardPermissions.isQualifiedTutor) {
             // Regular Tutor: Only see assigned students, hide own.
             return assignments.filter(a => {
                 return isStudentAssignedToMe(a) && !isOwnAssignment(a);
             });
        }
    }

    // 3. Global Feed or Fallback:
    if (currentDashboardPermissions.isAdmin) {
        // Super Admin Global Feed: See everything.
        return assignments;
    }

    if (currentDashboardPermissions.isQualifiedTutor) {
        // Global Tutor Feed: See assigned students.
        return assignments.filter(a => {
            return isStudentAssignedToMe(a) && !isOwnAssignment(a);
        });
    }

    // 3. Student (Paid or Role): Only see their own.
    if (myRole === 'user' || !myRole || currentDashboardPermissions.isPaidStudent) {
        return assignments.filter(isOwnAssignment);
    }

    return [];
}

// --- Rendering ---
function renderStudentDashboard(data, filterUnitId = null) {
    filterUnitId = resolveCanonicalUnitId(filterUnitId);
    loadingState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    configureStudentTabsForUnitAccess();

    // 1. Personal Stats (Find my own data from students array or separate object)
    // For students, getDashboardData returns 'students' array containing ONLY the requesting student
    const myData = data.students[0] || { totalTime: 0, videoTime: 0, docTime: 0, isActive: true };

    // Parse params
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    // Parse courseId from URL and resolve to UUID
    let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));

    let displayAssignments = filterAssignmentsForCurrentView(data.assignments);
    let displayCourseProgress = myData.courseProgress || {};

    // Filter if courseId is present
    if (filterCourseId) {
        // [V14.9] DECOUPLED: If we have a unit context, prioritize unitId matching.
        // We no longer strip courseId matches if the unitId is correct.
        if (filterUnitId) {
            displayAssignments = displayAssignments.filter(a => unitIdsMatch(a.unitId, filterUnitId));
        } else {
            displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
        }

        // Filter progress to only this course
        const filteredProgress = {};
        if (displayCourseProgress[filterCourseId]) {
            filteredProgress[filterCourseId] = displayCourseProgress[filterCourseId];
        }
        displayCourseProgress = filteredProgress;

        // [NEW] If filterUnitId is present, calculate time for THAT UNIT specifically
        if (filterUnitId && displayCourseProgress[filterCourseId] && displayCourseProgress[filterCourseId].units && displayCourseProgress[filterCourseId].units[filterUnitId]) {
            myData.totalTime = displayCourseProgress[filterCourseId].units[filterUnitId].total;
        } else if (displayCourseProgress[filterCourseId]) {
            myData.totalTime = displayCourseProgress[filterCourseId].total; // Override for display
        } else {
            myData.totalTime = 0;
        }
    }

    // Update Stats Cards (Reusing existing IDs if possible, or we will hide/show sections in HTML)
    // We will dynamically inject the HTML for Student View to avoid conflict with Admin View structure

    const container = document.getElementById('view-overview');

    let courseTitle = filterCourseId ? (lessonsMap[filterCourseId] || filterCourseId) : window.t('dash_my_learning_profile', "我的學習概況");
    if (filterUnitId) courseTitle += ` - ${formatUnitName(filterUnitId)}`;

    // Check for physical products and fulfillment status
    const physicalItems = (myData.orderRecords || []).flatMap(o => 
        Object.keys(o.items || {}).filter(id => allLessons.find(l => l.id === id)?.isPhysical === true)
    );
    const hasPhysical = physicalItems.length > 0;
    const isShipped = (myData.orderRecords || []).some(o => o.fulfillmentStatus === 'SHIPPED');
    const shipmentRecords = (myData.orderRecords || []).filter(o => {
        const itemIds = Object.keys(o.items || {});
        return itemIds.some(id => {
            const lesson = allLessons.find(l => l.id === id);
            if (lesson?.isPhysical === true) return true;
            return (o.items?.[id]?.isPhysical === true);
        });
    });

    container.innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-gray-800">${escapeHtml(courseTitle)}</h2>
            ${filterCourseId && mode !== 'iframe' ? `<a href="dashboard.html" class="text-sm text-blue-600 hover:underline">${window.t('dash_view_all_courses', '← 查看所有課程')}</a>` : ''}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="card border-l-4 border-blue-500">
                <p class="text-gray-500 text-sm font-medium">${filterUnitId ? window.t('dash_unit_learning_hours', '本單元學習時數') : window.t('dash_learning_hours', '學習時數')}</p>
                <h3 class="text-3xl font-bold text-gray-800 mt-1">${((myData.totalTime || 0) / 3600).toFixed(1)} <span class="text-sm font-normal text-gray-400">${window.t('dash_hours_unit', 'hours')}</span></h3>
            </div>
            <div class="card border-l-4 border-purple-500">
                <p class="text-gray-500 text-sm font-medium">${window.t('dash_assignments_submitted', '作業繳交')}</p>
                <h3 class="text-3xl font-bold text-gray-800 mt-1">${displayAssignments.length} <span class="text-sm font-normal text-gray-400">${window.t('dash_submitted_unit', 'submitted')}</span></h3>
            </div>
             <div class="card border-l-4 border-green-500">
                <p class="text-gray-500 text-sm font-medium">${window.t('dash_account_status', '帳號狀態')}</p>
                <h3 class="text-3xl font-bold text-green-600 mt-1">${window.t('dash_account_active', 'Active')}</h3>
            </div>
            ${hasPhysical ? `
            <div class="card border-l-4 border-orange-500">
                <p class="text-gray-500 text-sm font-medium">${window.t('dash_kit_shipment', '實體教材履約')}</p>
                <h3 class="text-3xl font-bold ${isShipped ? 'text-green-600' : 'text-orange-600'} mt-1">${isShipped ? window.t('dash_shipped', '已履約完成') : window.t('dash_preparing', '準備中')}</h3>
            </div>
            ` : ''}
        </div>

        ${shipmentRecords.length > 0 ? `
        <div class="card mb-8">
            <h3 class="text-lg font-bold text-gray-800 mb-4">${window.t('dash_my_shipments', '我的履約狀態 (My Fulfillment)')}</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-sm text-gray-500 border-b">
                            <th class="py-3 px-2">${window.t('dash_shipment_order', '訂單')}</th>
                            <th class="py-3 px-2">${window.t('dash_th_shipping_info', '收件資訊')}</th>
                            <th class="py-3 px-2">${window.t('dash_shipment_address', '履約地址')}</th>
                            <th class="py-3 px-2 text-center">${window.t('dash_status', '狀態')}</th>
                        </tr>
                    </thead>
                    <tbody class="text-sm text-gray-700 divide-y">
                        ${shipmentRecords.map(o => {
                            const notProvided = window.t('not_provided', '未提供');
                            const receiverName = o.shippingContact?.name || o.logistics?.receiverName || o.logistics?.ReceiverName || notProvided;
                            const receiverPhone = o.shippingContact?.phone || o.logistics?.receiverPhone || o.logistics?.ReceiverCellPhone || o.logistics?.ReceiverPhone || notProvided;
                            const shippingAddress = o.shippingAddress || o.logistics?.storeAddress || o.logistics?.CVSAddress || o.logistics?.ReceiverAddress || notProvided;
                            const isDone = o.fulfillmentStatus === 'SHIPPED';
                            const paidAtText = o.paidAt?.seconds
                                ? new Date(o.paidAt.seconds * 1000).toLocaleString()
                                : (o.paymentDate || '-');
                            return `
                                <tr class="hover:bg-gray-50">
                                    <td class="py-3 px-2">
                                        <div class="font-mono text-xs font-bold text-gray-800">${escapeHtml(o.id || '-')}</div>
                                        <div class="text-[10px] text-gray-400 mt-0.5">${escapeHtml(paidAtText)}</div>
                                    </td>
                                    <td class="py-3 px-2">
                                        <div class="text-xs text-slate-700 font-semibold">${window.t('dash_shipment_receiver', '收件人')}: ${escapeHtml(receiverName)}</div>
                                        <div class="text-xs text-slate-600">${window.t('dash_shipment_phone', '電話')}: ${escapeHtml(receiverPhone)}</div>
                                    </td>
                                    <td class="py-3 px-2 text-xs text-slate-700 break-all">${escapeHtml(shippingAddress)}</td>
                                    <td class="py-3 px-2 text-center">
                                        <span class="px-2 py-1 rounded text-xs font-bold ${isDone ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
                                            ${isDone ? window.t('dash_shipped', '已履約完成') : window.t('dash_to_ship', '待履約')}
                                        </span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}

        <!-- My Assignments -->
        <div class="card">
            <h3 class="text-lg font-bold text-gray-800 mb-4">${window.t('dash_my_assignments', '我的作業 (My Assignments)')}</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-sm text-gray-500 border-b">
                            <th class="py-3 px-2">${window.t('dash_assignment_name', '作業名稱')}</th>
                            <th class="py-3 px-2">${window.t('dash_submitted_time', '提交時間')}</th>
                            <th class="py-3 px-2">${window.t('dash_status', '狀態')}</th>
                            <th class="py-3 px-2 text-right">${window.t('dash_score', '分數')}</th>
                            <th class="py-3 px-2 text-right">${window.t('dash_feedback', '評語')}</th>
                        </tr>
                    </thead>
                    <tbody class="text-sm text-gray-700 divide-y">
                        ${displayAssignments.length > 0 ? displayAssignments.map(a => `
                            <tr class="hover:bg-gray-50">
                                <td class="py-3 px-2">
                                    <!-- 顯示課程單元名稱（去除前綴）為主標題，特定作業任務為副標題 -->
                                    <div class="font-bold text-gray-800 mb-0.5">${escapeHtml(window.formatUnitName(a.unitId))}</div>
                                    <div class="text-[10px] text-gray-400">${escapeHtml(a.assignmentTitle || a.title || "未指定任務")}</div>
                                </td>
                                <td class="py-3 px-2 text-gray-500 text-xs">${a.submittedAt ? new Date(a.submittedAt.seconds * 1000).toLocaleString() : '-'}</td>
                                <td class="py-3 px-2">
                                    <span class="px-2 py-1 rounded text-xs font-bold ${isAssignmentGraded(a) ? 'bg-green-100 text-green-700' : ((a.currentStatus || a.status) === 'started' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700')}">
                                        ${isAssignmentGraded(a) ? window.t('dash_graded', '已評分') : resolveAssignmentStatusLabel(a.currentStatus || a.status || 'submitted')}
                                    </span>
                                </td>
                                <td class="py-3 px-2 text-right font-bold text-blue-600">${resolveAssignmentGradeDisplay(a)}</td>
                                <td class="py-3 px-2 text-right text-gray-500 max-w-xs truncate" title="${escapeHtml(a.tutorFeedback)}">
                                    ${a.tutorFeedback ? escapeHtml(a.tutorFeedback) : '-'}
                                </td>
                            </tr>
                        `).join('') : `<tr><td colspan="5" class="py-4 text-center text-gray-500">${window.t('dash_no_assignments_submitted', '此課程尚無繳交作業')}</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- [V15.11] Student README Placeholder -->
        <div id="github-readme-placeholder-student" class="markdown-embed p-6 mt-8 rounded-3xl border border-slate-200 bg-gray-50 shadow-sm overflow-hidden hidden">
            <div class="flex items-center gap-3 text-slate-400 italic font-medium">
                <span class="animate-pulse">⏳</span> 正在抓取 GitHub 任務說明 (README.md)...
            </div>
        </div>

        <!-- Detailed Activity Chart -->
        <div class="card mt-8">
             <div class="flex flex-col md:flex-row gap-8 items-center">
                <div class="w-full md:w-1/3">
                    <h3 class="text-lg font-bold text-gray-800 mb-2" data-i18n="dash_learning_distribution">學習分佈</h3>
                    <canvas id="chart-activity"></canvas>
                </div>
                <div class="w-full md:w-2/3">
                     <h3 class="text-lg font-bold text-gray-800 mb-4" data-i18n="dash_course_progress_details">課程進度詳情</h3>
                     <div class="space-y-3">
                        ${Object.entries(displayCourseProgress).length > 0 ? Object.entries(displayCourseProgress).map(([cid, p]) => `
                            <div>
                                <div class="flex justify-between text-sm mb-1">
                                    <span class="font-medium text-gray-700">${escapeHtml(lessonsMap[cid] || cid)}</span>
                                    <span class="text-gray-500">${(p.total / 60).toFixed(0)} mins</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-blue-600 h-2 rounded-full" style="width: ${Math.min(100, (p.total / 3600) * 100)}%"></div> 
                                </div>
                            </div>
                        `).join('') : `<p class="text-gray-500">${window.t('dash_no_learning_records', '尚無學習紀錄')}</p>`}
                     </div>
                </div>
            </div>
        </div>
    `;

    // Render Chart (Need to adjust chart data if filtering? 
    // Usually chart data comes from myData.videoTime etc. which are totals. 
    // If we want course specific chart, we need granular data which we might not have easily in 'myData' root properties.
    // 'myData.courseProgress' has breakdown. Let's try to sum up from courseProgress if filtered.

    let chartData = [myData]; // Default

    if (filterCourseId && displayCourseProgress[filterCourseId]) {
        // Construct a temp object mimicking student structure but with only this course's times
        const p = displayCourseProgress[filterCourseId];

        // [NEW] Deep Filter to unit level if present
        if (filterUnitId && p.units && p.units[filterUnitId]) {
            const up = p.units[filterUnitId];
            chartData = [{
                videoTime: up.video,
                docTime: up.doc,
                pageTime: up.page || 0
            }];
        } else {
            chartData = [{
                videoTime: p.video,
                docTime: p.doc,
                pageTime: p.page || 0 // assuming page exists or calc remainder
            }];
        }
    }

    renderChart(chartData);

    // [V15.11] Student README Trigger
    if (filterUnitId) {
        vibeRefreshReadmeContent(filterUnitId, ['student']);
    }
}

function renderAdminDashboard(data, filterUnitId = null) {
    const requestedTab = getRequestedTabFromUrl();
    filterUnitId = resolveCanonicalUnitId(filterUnitId);
    loadingState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');

    // [NEW] Render Tutor / Admin Intervention & Blocker alerts
    renderTutorAlerts(data);

    // Tab Buttons
    const assignmentsTabBtn = document.getElementById('tab-btn-assignments');
    const adminTabBtn = document.getElementById('tab-btn-tutors');
    const settingsTabBtn = document.getElementById('tab-btn-settings');
    const shipmentsTabBtn = document.getElementById('tab-btn-shipments');

    if (assignmentsTabBtn) {
        const canViewAssignments = canCurrentUserViewAssignmentsTab();
        assignmentsTabBtn.classList.toggle('hidden', !canViewAssignments);
        assignmentsTabBtn.textContent = window.t('dash_tab_assignments', 'Assignments');
    }


    // Unit context: keep only Assignments / Settings tabs.
    const isUnitContext = !!filterUnitId;

    // 1. Admin Tab
    if (adminTabBtn) {
        if (!isUnitContext && myRole === 'admin') {
            adminTabBtn.classList.remove('hidden');
        } else {
            // [V14.13] REINFORCED: Explicitly hide for anyone else
            adminTabBtn.classList.add('hidden');
            adminTabBtn.style.display = 'none'; // Double layer protection
        }
    }

    // 1.5 Fulfillment Management Tab (Admin Only, global dashboard)
    if (shipmentsTabBtn) {
        if (!isUnitContext && myRole === 'admin') {
            shipmentsTabBtn.classList.remove('hidden');
        } else {
            shipmentsTabBtn.classList.add('hidden');
            shipmentsTabBtn.style.display = 'none';
        }
    }

    // 2. Settings & Earnings Tabs (Role-based & Authorization-based)
    const urlParams = new URLSearchParams(window.location.search);
    let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));
    const currentUserEmail = auth.currentUser?.email || '';
    if (!filterCourseId && filterUnitId) {
        filterCourseId = findParentCourseIdByUnit(filterUnitId);
    }

    // Tutor Mode ON = teacher view for qualified tutors and admins.
    // Tutor Mode OFF = student-like view within the current unit context.
    // Settings & Assignments switch according to AGENT.md.
    // Settings & Earnings are only accessible within a specific UNIT context
    const showSettingsTab = canCurrentUserViewSettingsTab();
    if (settingsTabBtn) {
        settingsTabBtn.classList.toggle('hidden', !showSettingsTab);
        settingsTabBtn.textContent = window.t('dash_tab_settings', '系統設定');
    }

    // Stats (Base on filtered students if unit is selected)
    const allInList = data.students || [];
    let summaryStudents = allInList.length;
    let summaryHours = allInList.reduce((acc, s) => acc + (s.totalTime || 0), 0) / 3600;

    // Show total registered vs paid (Unified with the table list)
    const totalRegistered = allInList.length;
    const totalPaid = allInList.filter(s => (s.orderRecords || []).length > 0).length;
    
    if (stats.students) stats.students.textContent = totalRegistered;
    const statPaidEl = document.getElementById('stat-paid');
    if (statPaidEl) statPaidEl.textContent = totalPaid;
    if (stats.hours) stats.hours.textContent = summaryHours.toFixed(1);


    // [V12.1.5] SECURITY & UX RULE: Overview is only for GLOBAL view (no unitId).
    const overviewTabBtn = document.getElementById('tab-btn-overview');
    const overviewTabContent = document.getElementById('view-overview');
    const shouldShowOverview = !isUnitContext && myRole === 'admin';

    if (overviewTabBtn) overviewTabBtn.classList.toggle('hidden', !shouldShowOverview);
    if (overviewTabContent) overviewTabContent.classList.toggle('hidden', !shouldShowOverview);

    // Default redirect if current view is hidden (e.g. Tutors in Global View)
    if (requestedTab === 'overview' && !shouldShowOverview) {
        console.log("[Dashboard] Redirecting from restricted Overview to Assignments.");
        switchTab('assignments');
        return;
    }

    // [NEW] Unit Context Header
    if (filterUnitId || filterCourseId) {
        const header = document.querySelector('#dashboard-content > div.flex.justify-between.items-center.mb-8');
        if (header) {
            let contextLabel = filterCourseId ? (lessonsMap[filterCourseId] || filterCourseId) : "";
            if (filterUnitId) contextLabel = (contextLabel ? contextLabel + " / " : "") + formatUnitName(filterUnitId);

            const existingLabel = document.getElementById('unit-context-label');
            if (existingLabel) {
                existingLabel.textContent = contextLabel;
            } else {
                const badge = document.createElement('div');
                badge.id = 'unit-context-label';
                badge.className = 'bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold ml-4';
                badge.textContent = contextLabel;
                header.querySelector('h2').appendChild(badge);
            }
        }
    }

    // Table with Expansion (Sorted by Registration Date: Newest First)
    const sortedStudents = (data.students || []).sort((a, b) => {
        const getTs = (c) => {
            if (!c) return 0;
            if (c._seconds) return c._seconds * 1000; // Firestore Timestamp
            if (typeof c === 'number') return c;      // Raw ms timestamp
            return new Date(c).getTime() || 0;        // ISO string or other
        };
        const timeA = getTs(a.createdAt);
        const timeB = getTs(b.createdAt);
        return timeB - timeA; // Descending: Newest first
    });

    const tbody = document.getElementById('student-table-body');
    tbody.innerHTML = sortedStudents.map(s => {
        const coursesRaw = s.courseProgress || {};
        const courses = Object.entries(coursesRaw).reduce((acc, [key, value]) => {
            const canonicalKey = key;
            const prev = acc[canonicalKey] || { total: 0, video: 0, doc: 0, page: 0, units: {} };
            acc[canonicalKey] = {
                ...prev,
                ...(value || {}),
                total: (prev.total || 0) + (value?.total || 0),
                video: (prev.video || 0) + (value?.video || 0),
                doc: (prev.doc || 0) + (value?.doc || 0),
                page: (prev.page || 0) + (value?.page || 0),
                units: { ...(prev.units || {}), ...(value?.units || {}) }
            };
            return acc;
        }, {});

        // [Fix] Filter stats based on courseId
        let displayTotal = s.totalTime;
        let displayVideo = s.videoTime;
        let displayDoc = s.docTime;

        if (filterCourseId) {
            if (courses[filterCourseId]) {
                const p = courses[filterCourseId];

                // [NEW] Filter deep to unit level if enabled
                if (filterUnitId && p.units && p.units[filterUnitId]) {
                    const up = p.units[filterUnitId];
                    displayTotal = up.total || 0;
                    displayVideo = up.video || 0;
                    displayDoc = up.doc || 0;
                } else {
                    displayTotal = p.total || 0;
                    displayVideo = p.video || 0;
                    displayDoc = p.doc || 0;
                }
            } else {
                // Course selected but student has no record for it
                displayTotal = 0;
                displayVideo = 0;
                displayDoc = 0;
            }
        }

        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const regTime = s.createdAt
            ? (s.createdAt._seconds ? new Date(s.createdAt._seconds * 1000) : new Date(s.createdAt))
            : null;
        const isTrialActive = regTime && (now - regTime.getTime() < THIRTY_DAYS_MS);
        const trialExpiryStr = regTime ? new Date(regTime.getTime() + THIRTY_DAYS_MS).toLocaleDateString('zh-TW') : '';

        // Pre-map order items for quick lookup
        const orderItemMap = {};
        (s.orderRecords || []).forEach(rec => {
            const exp = rec.expiryDate
                ? (rec.expiryDate._seconds ? new Date(rec.expiryDate._seconds * 1000) : new Date(rec.expiryDate))
                : null;
            const expStr = exp && !isNaN(exp) ? exp.toLocaleDateString('zh-TW') : '';
            Object.keys(rec.items || {}).forEach(cid => {
                orderItemMap[cid] = expStr;
                const canonicalCid = findCourseId(cid);
                if (canonicalCid) orderItemMap[canonicalCid] = expStr;
            });
        });

        // Generate Course Detail Rows
        // 1. Definition of "Starter Course" (入門課程) - canonical courseIds dynamically derived
        const starterCourseIds = (allLessons || [])
            .filter(l => (l.category === 'started' || l.category === 'starter' || l.level === 'starter') && l.isPhysical !== true)
            .map(l => l.courseId);

        // 2. Definition of "Prepare" units - dynamically derived
        const prepareCids = (allLessons || [])
            .filter(l => (l.category === 'prepare' || l.category === 'common' || l.level === 'common') && l.isPhysical !== true)
            .map(l => l.courseId);

        // Combine into "Always Show" list
        const showAlways = new Set([...starterCourseIds, ...prepareCids]);
        const allCourseIds = new Set(Object.keys(courses).map(cid => findCourseId(cid)));
        showAlways.forEach(cid => allCourseIds.add(cid));

        const courseRows = Array.from(allCourseIds).map(cid => {
            const canonicalCid = findCourseId(cid);
            
            // Merge progress from any known aliases that resolve to this canonical course
            const progress = { total: 0, video: 0, doc: 0 };
            const originalKeys = Object.keys(courses).filter(k => findCourseId(k) === canonicalCid);
            if (!originalKeys.includes(canonicalCid)) originalKeys.push(canonicalCid);
            originalKeys.forEach((k) => {
                const prog = courses[k];
                if (prog) {
                    progress.total = Math.max(progress.total, prog.total || 0);
                    progress.video = Math.max(progress.video, prog.video || 0);
                    progress.doc = Math.max(progress.doc, prog.doc || 0);
                }
            });

            const lessonObj = resolveLessonByAnyKey(canonicalCid);
            let courseTitle = canonicalCid;
            if (lessonObj) {
                const lessonLabel = lessonObj.lessonLabel
                    || lessonObj.i18n?.["zh-TW"]?.lessonLabel
                    || lessonObj.i18n?.en?.lessonLabel
                    || "";
                if (lessonLabel && lessonObj.title) {
                    courseTitle = `${lessonLabel}：${lessonObj.title}`;
                } else {
                    courseTitle = lessonObj.title || canonicalCid;
                }
            }
            const cleanTitle = String(courseTitle || '').replace('course-', '').replace('unit-', '');
            
            let statusLabel = '';
            const isStarter = starterCourseIds.includes(canonicalCid);
            const isPrepare = prepareCids.includes(canonicalCid);
            
            // Check paidUntil from orderItemMap (checking both canonical and legacy keys)
            let paidUntil = null;
            originalKeys.forEach(k => {
                if (orderItemMap[k]) paidUntil = orderItemMap[k];
            });

            if (paidUntil) {
                statusLabel = `<span class="text-emerald-600 font-semibold ml-2">繳費至：${paidUntil}</span>`;
            } else if (isStarter) {
                if (isTrialActive) {
                    statusLabel = `<span class="text-blue-600 font-semibold ml-2">免費試用(至${trialExpiryStr})</span>`;
                } else {
                    statusLabel = `<span class="text-gray-400 ml-2 italic">試用已過期</span>`;
                }
            } else if (isPrepare) {
                statusLabel = `<span class="text-emerald-500 ml-2">免費課程</span>`;
            } else {
                statusLabel = `<span class="text-gray-400 ml-2">尚未開通</span>`;
            }

            const isMatch = filterCourseId && canonicalCid === filterCourseId;
            const bgClass = isMatch ? "bg-blue-50" : "bg-gray-50/30";

            return `
                <tr class="${bgClass} text-[10px] md:text-xs border-b border-gray-50 hidden" data-parent-uid="${s.uid}">
                    <td class="pl-8 md:pl-12 py-2 text-gray-700">
                        <div class="flex items-center gap-4 whitespace-nowrap">
                            <div class="font-bold cursor-help" title="${escapeHtml(courseTitle)}">${escapeHtml(cleanTitle)}</div>
                            <div class="text-[9px] md:text-[10px]">${statusLabel}</div>
                        </div>
                    </td>
                    <td class="py-2 text-right pr-2" colspan="2">
                         <div class="flex items-center justify-end gap-4 text-[9px] text-gray-400 font-normal">
                            <span title="影片觀看時數">🎬 ${Math.round((progress.video || 0) / 60)}m</span>
                            <span title="文件閱讀時數">📄 ${Math.round((progress.doc || 0) / 60)}m</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // 1. Build identity row (fallback to uid if name/email missing)
        const displayName = s.name || s.email || `UID_${s.uid.slice(0,6)}`;
        const displaySub = s.name ? s.email : '';
        
        // 2. Formatting Registration Date for the Header
        const regHeaderStr = regTime && !isNaN(regTime) ? regTime.toLocaleDateString('zh-TW', { year:'numeric', month:'numeric', day:'numeric' }) : '–';

        return `
        <tr class="hover:bg-gray-50 transition border-b border-gray-100 cursor-pointer text-xs md:text-sm student-header-row" onclick="toggleRow('${s.uid}')">
            <td class="py-3 px-2 font-medium text-gray-800" colspan="2">
                <div class="flex items-center gap-2">
                    <span id="icon-${s.uid}" class="text-gray-400 w-4 inline-block transform transition-transform shrink-0">▶</span>
                    <div class="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                        <div class="text-blue-600 font-bold text-lg">${escapeHtml(displayName)}</div>
                        <div class="text-[11px] text-gray-500">註冊日期: ${regHeaderStr}</div>
                        <div class="text-[10px] text-gray-400 font-normal">${escapeHtml(displaySub)}</div>
                    </div>
                </div>
            </td>
            <td class="py-3 px-2 text-right">
                <div class="flex flex-col items-end">
                    <div class="font-mono text-blue-600 font-bold text-base">${(displayTotal / 3600).toFixed(1)}h</div>
                    <div class="flex gap-4 text-[9px] text-gray-400 font-normal">
                        <span title="影片觀看時數">🎬 ${Math.round((s.videoTime || 0) / 60)}m</span>
                        <span title="文件閱讀時數">📄 ${Math.round((s.docTime || 0) / 60)}m</span>
                    </div>
                </div>
            </td>
        </tr>
        ${courseRows}
        `;
    }).join('');

    // [V14.8] Use filterUnitId for chart and assignment filtering
    let chartData = data.students;
    let displayAssignments = filterAssignmentsForCurrentView(data.assignments);

    // Assignment Filtering Priority: unitId > courseId
    if (filterUnitId) {
        displayAssignments = displayAssignments.filter(a => unitIdsMatch(a.unitId, filterUnitId));
    } else if (filterCourseId) {
        displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
    }

    // Chart Data Filtering
    if (filterCourseId) {
        chartData = data.students.map(s => {
            const courses = s.courseProgress || {};
            const p = courses[filterCourseId] || { total: 0, video: 0, doc: 0, page: 0 };

            let finalStats = p;
            if (filterUnitId && p.units && p.units[filterUnitId]) {
                finalStats = p.units[filterUnitId];
            }

            return {
                ...s,
                totalTime: finalStats.total || finalStats.totalTime || 0,
                videoTime: finalStats.video || finalStats.videoTime || 0,
                docTime: finalStats.doc || finalStats.docTime || 0,
                pageTime: finalStats.page || finalStats.pageTime || 0
            };
        });
    }

    renderChart(chartData);
    renderPaymentsChart(data.students);
    // [V8.1] GitHub README loading moved to renderAssignments for better container management

    // [V15.11] Ensure README is refreshed for Admin Overview as well
    vibeRefreshReadmeContent(filterUnitId, ['admin-overview']);

    // [V8.1] GitHub README loading moved to renderAssignments for better container management
    renderAssignments(displayAssignments, "", { showGuide: false });

}
// --- Global Toggle Functions ---
window.toggleCourseRows = function (id, event) {
    if (event) event.stopPropagation();
    const rows = document.querySelectorAll(`.course-unit-${id}`);
    const icon = document.getElementById(`icon-${id}`);

    let isNowVisible = false;
    rows.forEach(row => {
        if (row.style.getPropertyValue('display') === 'none' || row.style.display === 'none') {
            row.style.setProperty('display', 'table-row', 'important');
            isNowVisible = true;
        } else {
            row.style.setProperty('display', 'none', 'important');
            // Also hide any active logs under these units
            const unitLogsIdMatch = row.onclick.toString().match(/toggleUnitLogs\('(.+?)'/);
            if (unitLogsIdMatch) {
                const unitLogsId = unitLogsIdMatch[1];
                const logs = document.querySelectorAll(`.unit-log-${unitLogsId}`);
                logs.forEach(l => l.style.setProperty('display', 'none', 'important'));
                const subIcon = document.getElementById(`icon-${unitLogsId}`);
                if (subIcon) subIcon.classList.remove('rotate-90');
            }
            isNowVisible = false;
        }
    });

    if (icon) {
        if (isNowVisible) icon.classList.add('rotate-90');
        else icon.classList.remove('rotate-90');
    }
};

window.toggleUnitLogs = function (id, event) {
    if (event) event.stopPropagation();
    const rows = document.querySelectorAll(`.unit-log-${id}`);
    const icon = document.getElementById(`icon-${id}`);

    let isNowVisible = false;
    rows.forEach(row => {
        if (row.style.getPropertyValue('display') === 'none' || row.style.display === 'none') {
            row.style.setProperty('display', 'table-row', 'important');
            isNowVisible = true;
        } else {
            row.style.setProperty('display', 'none', 'important');
            isNowVisible = false;
        }
    });

    if (icon) {
        if (isNowVisible) {
            icon.classList.add('rotate-90');
        } else {
            icon.classList.remove('rotate-90');
        }
    }
};


window.handleAssignmentClick = function (courseId, unitId, assignmentUrl = null) {
    if (assignmentUrl) {
        window.open(assignmentUrl, '_blank');
        return;
    }
    // [MOD v12.0.7] Dynamic Permission Check (Context-Aware)
    // 1. Admin with Tutor Mode ON: Direct authorization (Master Key)
    // 2. Qualified Tutor for THIS unit (Status): Direct authorization (Status-based)
    const isAuthorizedTutor = hasQualifiedTutorAccessForUnit(unitId, courseId, myEmail);
    const useMasterBypass = (myRole === 'admin' && adminTutorMode);

    if (useMasterBypass || isAuthorizedTutor) {
        const unitTutorConfig = getUnitTutorConfig(unitId);
        const assignmentUrlMap = unitTutorConfig.assignmentUrlMap || unitTutorConfig.assignmentUrls || null;

        if (assignmentUrlMap) {
            const finalUrl = getAssignmentUrlForTutor(assignmentUrlMap, unitId, myEmail);
            if (finalUrl) {
                if (isLikelyAssignmentLink(finalUrl) && !isValidAssignmentLinkUrl(finalUrl)) {
                    alert(window.t("alert_invalid_unit_url", "此單元設定的作業連結格式不正確，請到課程設定修正。"));
                    return;
                }
                window.open(finalUrl, '_blank');
                return;
            }
        }

        alert(window.t("alert_missing_unit_url", "此單元尚未設定作業連結，請管理員/老師至「課程設定」中設定。"));
        return;
    }

    (async () => {
        try {
            const resolveAssignmentAccess = httpsCallable(functions, 'resolveAssignmentAccess');
            const result = await resolveAssignmentAccess({ 
                courseId, 
                unitId,
                tutorMode: adminTutorMode 
            });
            const access = result.data || {};

            if (!access.authorized) {
                // [REMOVED] Silent fail or separate UI handling for unauthorized access
                console.warn("[Dashboard] Assignment access unauthorized.");
                return;
            }

            if (access.requiresTutorAssignment && !access.assignedTutorEmail) {
                alert(window.t("alert_assignment_not_assigned", "此單元尚未完成老師指派，作業入口會在老師指派完成後開放。"));
                return;
            }

            const assignmentUrl = access.classroomUrl;
            if (assignmentUrl) {
                if (isLikelyAssignmentLink(assignmentUrl) && !isValidAssignmentLinkUrl(assignmentUrl)) {
                    alert(window.t("alert_invalid_tutor_url", "此單元設定的作業連結格式不正確，請通知管理員/老師修正。"));
                    return;
                }
                window.open(assignmentUrl, '_blank');
                return;
            }

            alert(window.t("alert_missing_unit_url", "此單元尚未設定作業連結，請管理員/老師至「課程設定」中設定。"));
        } catch (error) {
            console.error('[Dashboard] Failed to resolve assignment link:', error);
            alert(window.t("alert_fetch_portal_failed", "暫時無法取得作業入口，請稍後再試。"));
        }
    })();
};

/**
 * [V14.3] Standardized Render Assignments with Placeholder Support
 */
window.renderAssignments = window.renderAssignments || function(assignments = [], guideContent = "", options = {}) {
    const { showGuide = true } = options;
    const { filterUnitId, filterCourseId } = getCurrentDashboardContext();
    const isAdmin = myRole === 'admin';
    // [MODIFIED] Ensure students can never manage assignments (even if they have unit access authorization)
    const isStudent = !currentDashboardPermissions.isAdmin && !currentDashboardPermissions.isQualifiedTutor;
    const canManageAssignments = !isStudent && (isUserAuthorizedForUnit(filterUnitId, filterCourseId, myEmail) || (isAdmin && !filterUnitId));

    // [Cleanup] Remove old guides
    const possibleContainers = [
        document.getElementById('view-assignments'),
        document.getElementById('assignments-container')
    ];
    possibleContainers.forEach(container => {
        if (!container) return;
        const oldGuides = container.querySelectorAll('.integrated-tutor-guide, .bg-blue-50');
        oldGuides.forEach(g => g.remove());
    });

    // [V14.4] GitHub README Placeholder Management

    if (showGuide && guideContent) {
        const guideDiv = document.createElement('div');
        guideDiv.className = 'integrated-tutor-guide mt-8 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden';
        guideDiv.innerHTML = `
            <div class="px-6 py-6 text-sm leading-7 text-slate-700 prose prose-base max-w-none prose-headings:text-slate-900 prose-headings:text-2xl prose-headings:font-black prose-strong:text-slate-900 prose-li:my-1">
                ${guideContent}
            </div>
        `;
        normalizeGuideHeadingStyles(guideDiv);
        possibleContainers.forEach(container => {
            if (container) {
                // Ensure no duplicates
                const existing = container.querySelector('.integrated-tutor-guide');
                if (existing) existing.remove();
                container.appendChild(guideDiv.cloneNode(true));
            }
        });
    }

    const isGlobal = !filterUnitId;
    const thMain = document.getElementById('th-assignment-action-main');
    const thIntegrated = document.getElementById('th-assignment-action-integrated');

    // Manual grading removed: hide action column in all assignment tables.
    if (thMain) thMain.classList.add('hidden');
    if (thIntegrated) thIntegrated.classList.add('hidden');

    if (isAdmin && isGlobal) {
        // [V12.1.3] Global Feed: Sort all assignments by newest first
        const sortedAll = [...assignments].sort((a, b) => {
            const getTs = (item) => {
                const ts = item.updatedAt || item.submittedAt;
                if (!ts) return 0;
                return ts.seconds || ts._seconds || new Date(ts).getTime() / 1000 || 0;
            };
            return getTs(b) - getTs(a);
        });
        // Target specifically the Global/Main Assignments Table
        renderAssignmentsTable(sortedAll, canManageAssignments, 'global', '#view-assignments .assignment-table-body');
    } else {
        // Target specifically the Main Assignments Tab (Unit View)
        renderAssignmentsTable(assignments, canManageAssignments, 'unit-main', '#view-assignments .assignment-table-body');
        // Target specifically the Integrated Assignments Table (Settings Tab)
        renderAssignmentsTable(assignments, canManageAssignments, 'unit-integrated', '#assignments-container .assignment-table-body');
    }
    // [V13.6] Note: Cleanup of old guides moved to the TOP of the function to prevent flickering
}

/**
 * Shared Table Renderer for Assignments
 */
function resolveAssignmentGradeDisplay(assignment) {
    if (assignment.grade !== null && assignment.grade !== undefined) {
        return String(assignment.grade);
    }
    const score = assignment.autoGrade?.score;
    if (score === null || score === undefined) return '-';
    const maxScore = assignment.autoGrade?.maxScore;
    return (maxScore !== null && maxScore !== undefined) ? `${score}/${maxScore}` : String(score);
}

function isAssignmentGraded(assignment) {
    if (assignment.grade !== null && assignment.grade !== undefined) return true;
    return assignment.autoGrade?.score !== null && assignment.autoGrade?.score !== undefined;
}

function resolveAssignmentStatusLabel(status) {
    if (status === 'started' || status === 'in_progress') return window.t('status_in_progress', '進行中');
    if (status === 'submitted') return window.t('status_submitted', '待評分');
    if (status === 'graded') return window.t('status_graded', '已評分');
    if (status === 'blocked') return window.t('status_blocked', '🔴 遭遇卡點');
    if (status === 'coaching') return window.t('status_coaching', '🟡 導師引導中');
    if (status === 'resolved') return window.t('status_resolved', '🟢 已解決');
    return status || 'new';
}

window.renderAssignmentsTable = window.renderAssignmentsTable || function(assignments, canManageAssignments, context = 'unit-main', targetSelector = '.assignment-table-body') {
    const tableBodies = document.querySelectorAll(targetSelector);
    if (tableBodies.length === 0) return;
    
    // logic constants
    const showActionCol = false;
    const clickAction = canManageAssignments ? 'modal' : 'url';

    if (!assignments || assignments.length === 0) {
        const emptyMsg = `<tr><td colspan="${showActionCol ? 6 : 5}" class="text-center py-8 text-gray-400">${window.t('dash_no_assignments_submitted', 'No assignments submitted for this unit.')}</td></tr>`;
        tableBodies.forEach(tbody => tbody.innerHTML = emptyMsg);
        return;
    }

    const content = assignments.map(a => {
        let submittedDate = 'N/A';
        const ts = a.updatedAt || a.submittedAt;
        if (ts) {
            if (ts._seconds) submittedDate = new Date(ts._seconds * 1000).toLocaleString();
            else if (ts.seconds) submittedDate = new Date(ts.seconds * 1000).toLocaleString();
            else submittedDate = new Date(ts).toLocaleString();
        }

        const currentStatus = a.learningState || a.currentStatus || a.status || 'new';
        const normalizedStatus = isAssignmentGraded(a) ? 'graded' : currentStatus;
        let badgeColor = 'bg-gray-100 text-gray-800';
        if (normalizedStatus === 'submitted') badgeColor = 'bg-yellow-100 text-yellow-800 border border-yellow-200';
        else if (normalizedStatus === 'graded' || normalizedStatus === 'resolved') badgeColor = 'bg-green-100 text-green-800 border border-green-200';
        else if (normalizedStatus === 'started' || normalizedStatus === 'in_progress') badgeColor = 'bg-blue-100 text-blue-800 border border-blue-200';
        else if (normalizedStatus === 'blocked') badgeColor = 'bg-red-100 text-red-800 border border-red-200 animate-pulse';
        else if (normalizedStatus === 'coaching') badgeColor = 'bg-amber-100 text-amber-800 border border-amber-200';
        const badge = `<span class="${badgeColor} px-2 py-0.5 rounded text-[10px] font-bold">${resolveAssignmentStatusLabel(normalizedStatus)}</span>`;

        // Determine Row Onclick logic
        let rowOnClick = '';
        if (clickAction === 'modal') {
            rowOnClick = `window.autoGradeAssignment('${a.id}')`;
        } else {
            // clickAction === 'url'
            rowOnClick = a.assignmentUrl ? `window.open('${a.assignmentUrl}', '_blank')` : `notify('${window.t('dash_assignment_no_link', 'This assignment has no link.')}', 'warning')`;
        }
        
        return `
        <tr class="lg:hover:bg-blue-50/50 transition border-b border-gray-100 cursor-pointer group text-xs md:text-sm" 
            data-assignment-id="${escapeHtml(a.id)}"
            onclick="${rowOnClick}">
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-gray-800">
                <div class="font-medium group-hover:text-blue-600 transition-colors truncate max-w-[150px] md:max-w-none">${escapeHtml(a.studentName || a.studentEmail || a.userEmail)}</div>
                <div class="text-[10px] text-gray-400 truncate max-w-[150px] md:max-w-none">${escapeHtml(a.studentEmail || a.userEmail || '')}</div>
            </td>
            <td class="py-2 px-1 sm:py-3 sm:px-2">
                <div class="font-bold text-gray-800 text-xs md:text-sm mb-0.5">
                    ${escapeHtml(window.formatUnitName(a.unitId))}
                </div>
                <div class="text-[10px] text-gray-400 font-mono">
                    ${escapeHtml(a.unitId || '')}
                </div>
            </td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-[10px] text-gray-400 text-center">${submittedDate}</td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-center">${badge}</td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 font-bold text-gray-700 text-center">${resolveAssignmentGradeDisplay(a)}</td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-right hidden"></td>
        </tr>`;
    }).join('');

    tableBodies.forEach(tbody => tbody.innerHTML = content);
}


/**
 * [V15.11] Shared README Refresher
 * Fetches README from GitHub and injects into all available placeholders.
 */
async function vibeRefreshReadmeContent(filterUnitId, targetKinds = ['settings', 'student', 'admin-overview']) {
    refreshDashboardExternalGuideLinks();
    const placeholderMap = {
        'settings': document.getElementById('github-readme-placeholder-settings'),
        'student': document.getElementById('github-readme-placeholder-student'),
        'admin-overview': document.getElementById('github-readme-placeholder-admin-overview')
    };
    const selected = targetKinds.map(kind => ({ kind, el: placeholderMap[kind] })).filter(item => item.el);

    if (selected.length === 0) return;

    if (!filterUnitId) {
        selected.forEach(item => item.el.classList.add('hidden'));
        return;
    }

        selected.forEach(({ kind, el }) => {
            el.classList.remove('hidden');
            const loadingText = kind === 'settings'
            ? '正在讀取導師合作 (tutor-guide)...'
            : '正在讀取課程頁內容...';
            el.innerHTML = `
                <div class="flex items-center gap-3 text-slate-400 italic">
                    <span class="animate-pulse">⏳</span> ${loadingText}
            </div>
        `;
    });

    try {
        for (const { kind, el: placeholder } of selected) {
            const isSettingsTab = kind === 'settings';
            let markdownHtml = null;

            if (isSettingsTab) {
                const directTutorGuide = await fetchGuideSectionFromUnitPage(filterUnitId, 'tutor-guide');
                if (directTutorGuide) {
                    markdownHtml = directTutorGuide;
                    console.log(`[V17.3] SettingsTab using direct tutor-guide section for unit: ${filterUnitId}`);
                }
            }

            // Final Injection
            if (markdownHtml && !markdownHtml.includes('無法讀取')) {
                placeholder.innerHTML = markdownHtml;
                normalizeGuideHeadingStyles(placeholder);
                placeholder.classList.remove('hidden');
                console.log(`[V17.0.5] Content successfully injected into: ${placeholder.id}`);
            } else {
                console.warn(`[V17.0.5] No content found for placeholder: ${placeholder.id}`);
                placeholder.innerHTML = `
                    <div class="flex items-center gap-3 text-red-500 bg-red-50 p-4 rounded-xl border border-red-100">
                        <span>⚠️</span>
                        <div>
                            <div class="font-bold">無法載入外部說明檔案</div>
                            <div class="text-xs opacity-75">GitHub 儲存庫中找不到可用說明。</div>
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error("[V17.0.5] External Content Loading Error:", error);
    }
}

async function renderAssignmentsGuideMain(filterUnitId) {
    const placeholder = document.getElementById('github-readme-placeholder-main');
    if (!placeholder) return;
    if (!filterUnitId) {
        placeholder.classList.add('hidden');
        return;
    }
    if (isNonCourseGuideContext(filterUnitId)) {
        placeholder.classList.add('hidden');
        placeholder.innerHTML = '';
        return;
    }

    placeholder.classList.remove('hidden');
    placeholder.innerHTML = `<div class="flex items-center gap-3 text-slate-400 italic"><span class="animate-pulse">⏳</span> 正在讀取作業指南 (assignment-guide)...</div>`;
    const extracted = await fetchGuideSectionFromUnitPage(filterUnitId, 'assignment-guide');
    if (extracted) {
        placeholder.innerHTML = extracted;
        normalizeGuideHeadingStyles(placeholder);
    } else {
        placeholder.innerHTML = `<div class="text-amber-600 text-sm">⚠️ 該單元目前沒有 assignment-guide，已顯示可用內容。</div>`;
    }
}

async function renderTutorGuideMain(filterUnitId) {
    const placeholder = document.getElementById('github-readme-placeholder-main');
    if (!placeholder) return;
    if (!filterUnitId) {
        placeholder.classList.add('hidden');
        return;
    }
    if (isNonCourseGuideContext(filterUnitId)) {
        placeholder.classList.add('hidden');
        placeholder.innerHTML = '';
        return;
    }

    placeholder.classList.remove('hidden');
    placeholder.innerHTML = `<div class="flex items-center gap-3 text-slate-400 italic"><span class="animate-pulse">⏳</span> 正在讀取導師合作 (tutor-guide)...</div>`;
    const extracted = await fetchGuideSectionFromUnitPage(filterUnitId, 'tutor-guide');
    if (extracted) {
        placeholder.innerHTML = extracted;
        normalizeGuideHeadingStyles(placeholder);
    } else {
        placeholder.innerHTML = `<div class="text-amber-600 text-sm">⚠️ 該單元目前沒有導師合作內容，已顯示可用內容。</div>`;
    }
}

window.renderAssignments = renderAssignments;

function renderChart(students) {
    const ctx = document.getElementById('chart-activity').getContext('2d');
    let totalVideo = 0;
    let totalDoc = 0;
    let totalPage = 0;

    students.forEach(s => {
        totalVideo += s.videoTime;
        totalDoc += s.docTime;
        totalPage += s.pageTime;
    });

    if (charts.activity) charts.activity.destroy();

    charts.activity = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Video Viewing', 'Document Reading', 'Page Browsing'],
            datasets: [{
                data: [totalVideo, totalDoc, totalPage],
                backgroundColor: ['#3b82f6', '#a855f7', '#9ca3af'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

/**
 * Renders the Payment Status doughnut chart on the overview tab
 * @param {Array} students List of students with orderRecords
 */
function renderPaymentsChart(students) {
    const canvas = document.getElementById('chart-payments');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const totalPaid = students.filter(s => (s.orderRecords || []).length > 0).length;
    const totalTrial = students.length - totalPaid;

    if (charts.payments) charts.payments.destroy();

    charts.payments = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['已付費 (Paid)', '試用/免費 (Trial/Free)'],
            datasets: [{
                data: [totalPaid, totalTrial],
                backgroundColor: ['#10b981', '#ef4444'], // Emerald Green and Red
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function renderReferralInviteKitSection(data) {
    const container = document.getElementById('promo-invite-kit-assignments');
    if (!container) return;
    container.classList.add('hidden');
}

// --- Tab Logic ---
window.switchTab = function (tabName) {
    if (!tabName) return;
    
    // [V14.12] PERMISSION LEAK FIX: Explicitly block admin-only tabs for non-admins
    if ((tabName === 'tutors' || tabName === 'admin' || tabName === 'shipments' || tabName === 'logistics' || tabName === 'settings') && myRole !== 'admin') {
        console.warn(`[Security] Unauthorized tab access: ${tabName} blocked for ${myRole}.`);
        // Fallback: Redirect to assignments for tutors or overview for admins.
        tabName = getPreferredDashboardTab(getCurrentDashboardContext().filterUnitId);
        if (tabName === 'tutors' || tabName === 'admin' || tabName === 'shipments' || tabName === 'logistics' || tabName === 'settings') {
            tabName = 'assignments'; // Extreme safety fallback
        }
    }
    if (tabName === 'admin') tabName = 'tutors'; // backward compatibility
    if (tabName === 'logistics') tabName = 'shipments'; // backward compatibility

    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));
    const isUnitContext = !!filterUnitId;

    // Unit context hard rule: only assignments are visible tabs.
    if (isUnitContext && (tabName === 'overview' || tabName === 'tutors' || tabName === 'admin' || tabName === 'shipments' || tabName === 'logistics' || tabName === 'settings')) {
        tabName = getPreferredDashboardTab(filterUnitId);
    }

    // Role-based restrictions for other tabs
    if (tabName === 'assignments' && !canCurrentUserViewAssignmentsTab()) {
        tabName = getPreferredDashboardTab(filterUnitId);
        if (tabName === 'assignments' && !canCurrentUserViewAssignmentsTab()) {
            return;
        }
    }
    if (tabName === 'settings' && !canCurrentUserViewSettingsTab()) {
        tabName = getPreferredDashboardTab(filterUnitId);
        if (tabName === 'settings' && !canCurrentUserViewSettingsTab()) {
            return;
        }
    }
    // [MODIFIED] Determine if current user is a student view context
    const isStudent = !currentDashboardPermissions.isAdmin && !currentDashboardPermissions.isQualifiedTutor;
    let paneName = tabName;

    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    // Show target content
    const targetPane = document.getElementById(`view-${paneName}`);
    if (targetPane) {
        targetPane.classList.remove('hidden');
    } else {
        console.error(`[Dashboard] Tab pane not found: view-${paneName}`);
        return;
    }

    // Fulfillment Management Tab Specific Rendering
    if (tabName === 'shipments') {
        renderLogisticsTab();
    }
    if (tabName === 'settings') {
        renderBusinessTab();
    }
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.add('text-gray-500', 'hover:text-gray-700', 'border-transparent');
        btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
    });

    // Activate target button
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-500', 'hover:text-gray-700', 'border-transparent');
        activeBtn.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
    }

    if (tabName === 'assignments') {
        const urlParams = new URLSearchParams(window.location.search);
        const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));
        let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));

        const isTutor = !!currentDashboardPermissions.isQualifiedTutor || (myRole === 'admin' && adminTutorMode);
        const isStudent = !currentDashboardPermissions.isAdmin && !currentDashboardPermissions.isQualifiedTutor;
        
        if (filterUnitId) {
            if (isTutor) {
                renderTutorGuideMain(filterUnitId);
            } else {
                renderAssignmentsGuideMain(filterUnitId);
            }
        } else {
            const placeholder = document.getElementById('github-readme-placeholder-main');
            if (placeholder) placeholder.classList.add('hidden');
        }

        // Update Title for Student vs Tutor
        const headerEl = document.querySelector('#assignments-header h3');
        if (headerEl) {
            headerEl.textContent = isStudent
                ? window.t('dash_my_assignments', 'My Assignments')
                : window.t('dash_assignments_title', 'Assignments');
        }

        if (!isStudent) {
            console.log("[DebugTab] tab assignments: filterUnitId=", filterUnitId, "total raw counts:", dashboardData.assignments.length);
            let displayAssignments = filterAssignmentsForCurrentView(dashboardData.assignments);
            console.log("[DebugTab] tab assignments: count after permissions filter:", displayAssignments.length);

            const unitSettingsContainer = document.getElementById('unit-settings-container');
            const unitSettingsVisible = !!filterUnitId && canCurrentUserViewUnitSettingsTab();
            if (unitSettingsContainer) {
                unitSettingsContainer.classList.toggle('hidden', !unitSettingsVisible);
            }
            if (unitSettingsVisible) {
                renderSettingsTab(filterUnitId).then(() => {
                    const settingsHeader = document.getElementById('settings-header-integrated');
                    const settingsCard = document.getElementById('assignment-setting-card');
                    if (settingsHeader) settingsHeader.classList.add('hidden');
                    if (settingsCard) settingsCard.classList.add('hidden');
                });
            }

            if (filterUnitId) {
                // Same here: prioritize unitId and relax courseId requirement for unit-specific view
                displayAssignments = displayAssignments.filter(a => {
                    const match = unitIdsMatch(a.unitId, filterUnitId);
                    if (normalizeEmail(a.studentEmail).includes('rover.k.chen')) {
                         console.log(`[DebugAssignmentTab] Checking Rover's doc ${a.id}: unitId=${a.unitId}, match=${match}`);
                    }
                    return match;
                });
            } else if (filterCourseId) {
                displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
            }
            console.log("[DebugTab] tab assignments: Final count to render:", displayAssignments.length);

            renderAssignments(displayAssignments, "", { showGuide: false });
            renderReferralInviteKitSection(dashboardData);
        } else {
            // [MODIFIED] For students, render their own assignments and refresh the README instruction placeholder
            let displayAssignments = filterAssignmentsForCurrentView(dashboardData.assignments);
            if (filterUnitId) {
                displayAssignments = displayAssignments.filter(a => unitIdsMatch(a.unitId, filterUnitId));
            }
            renderAssignments(displayAssignments, "", { showGuide: false });
            renderReferralInviteKitSection(dashboardData);
        }
    }
    if (tabName === 'tutors') {
        renderAdminConsole();
    }
    
    // [NEW] Inject Admin Tutor Mode Toggle if applicable
    if (typeof vibeInjectAdminTutorModeToggle === 'function') {
        vibeInjectAdminTutorModeToggle();
    }
};

// --- Admin Features ---
window.setupAdminFeatures = window.setupAdminFeatures || function() {
    // Admin features are now initialized during renderAdminConsole
}

window.buildRevenueSimulatorHtml = window.buildRevenueSimulatorHtml || function() {
    return `
        <div class="mb-10 bg-blue-50 border border-blue-100 rounded-2xl overflow-hidden shadow-sm">
            <div class="px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                <h4 class="text-sm font-black text-blue-900 flex items-center gap-2">
                    📊 分潤模擬器（唯讀）
                </h4>
                <span class="text-[11px] text-blue-500 font-semibold">不寫入資料庫</span>
            </div>
            <div class="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <label class="text-xs font-bold text-gray-600">訂單金額
                    <input id="sim-amount" type="number" min="0" step="1" value="1200" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">有效期(月)
                    <input id="sim-months" type="number" min="1" step="1" value="12" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">Tutor Rate
                    <input id="sim-tutor-rate" type="number" min="0" max="1" step="0.01" value="0.2" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">Tutor Upline Rate
                    <input id="sim-tutor-upline-rate" type="number" min="0" max="1" step="0.01" value="0.2" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">Agent Rate
                    <input id="sim-agent-rate" type="number" min="0" max="1" step="0.01" value="0.2" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">Agent Upline Rate
                    <input id="sim-agent-upline-rate" type="number" min="0" max="1" step="0.01" value="0.1" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">CourseDev Rate
                    <input id="sim-course-rate" type="number" min="0" max="1" step="0.01" value="0.2" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">CourseDev Upline Rate
                    <input id="sim-course-upline-rate" type="number" min="0" max="1" step="0.01" value="0.1" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
            </div>
            <div class="px-6 pb-6">
                <button onclick="window.runRevenueSimulation()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
                    重新模擬
                </button>
            </div>
            <div id="revenue-sim-result" class="px-6 pb-6"></div>
        </div>
    `;
};

function policyRateInput(id, key, value, title, description) {
    const valPercent = Math.round((Number.isFinite(Number(value)) ? Number(value) : 0) * 100);
    return `
        <label class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <div class="text-sm font-black text-slate-900">${escapeHtml(title)}</div>
                    <div class="mt-1 text-[11px] leading-5 text-slate-500">${escapeHtml(description)}</div>
                </div>
                <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(key.replace('policy-', ''))}</span>
            </div>
            <div class="flex items-center gap-2">
                <input id="${key}-${id}" type="number" min="0" max="100" step="1" value="${valPercent}" oninput="window.markPolicyModified('${escapeHtml(id)}')" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100">
                <span class="text-xs font-black text-slate-400">%</span>
            </div>
        </label>
    `;
}

window.buildRevenuePolicyHtml = window.buildRevenuePolicyHtml || function() {
    return `
        <div class="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div id="revenue-policy-body" class="p-6">
                <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    載入中...
                </div>
            </div>
        </div>
    `;
};

window.buildRevenueToolsHtml = function() {
    return '';
};

/**
 * [V17.0] Render Logistics Management Tab (Admin Only)
 */
window.renderLogisticsTab = function() {
    if (myRole !== 'admin' || !dashboardData) return;
    normalizeDistributorPriceBookPlacement();
    syncDistributorPriceBookContext();
    
    const container = document.getElementById('shipments-table-body');
    if (!container) return;

    const orders = dashboardData.hardwareOrders || [];
    
    if (orders.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="py-10 text-center text-gray-400 italic">尚無硬體產品訂單紀錄</td></tr>';
        renderDistributorPriceBooksTable();
        return;
    }

    container.innerHTML = orders.map(o => {
        const isShipped = o.fulfillmentStatus === 'SHIPPED';
        const logisticsInfo = o.logistics || {};

        const receiverName = o.shippingContact?.name || logisticsInfo.receiverName || logisticsInfo.ReceiverName || '未提供';
        const receiverPhone = o.shippingContact?.phone || logisticsInfo.receiverPhone || logisticsInfo.ReceiverCellPhone || logisticsInfo.ReceiverPhone || '未提供';

        let logisticsDesc = '無物流資訊';
        if (logisticsInfo.CVSStoreName || logisticsInfo.storeName) {
            const storeName = logisticsInfo.CVSStoreName || logisticsInfo.storeName || '未提供門市';
            const storeId = logisticsInfo.CVSStoreID || logisticsInfo.storeId || '';
            logisticsDesc = `超商: ${storeName}${storeId ? ` (${storeId})` : ''}`;
        }

        const shippingAddress = o.shippingAddress
            || logisticsInfo.storeAddress
            || logisticsInfo.CVSAddress
            || logisticsInfo.ReceiverAddress
            || '未提供';

        const buyerName = o.name || '未提供';
        const buyerEmail = o.email || '未提供';

        return `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                <td class="py-4 px-2">
                    <div class="font-mono text-xs font-bold text-gray-800">${o.id}</div>
                    <div class="text-[10px] text-gray-400 mt-0.5">${o.paidAt ? new Date(o.paidAt).toLocaleString() : '未知時間'}</div>
                </td>
                <td class="py-4 px-2">
                    <div class="font-bold text-gray-800">${escapeHtml(buyerName)}</div>
                    <div class="text-xs text-blue-600">${escapeHtml(buyerEmail)}</div>
                </td>
                <td class="py-4 px-2">
                    <ul class="text-xs space-y-0.5">
                        ${o.items.map(item => `<li class="list-disc ml-4 font-medium text-slate-700">${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </td>
                <td class="py-4 px-2">
                    <div class="text-xs text-slate-700 font-semibold">收件人: ${escapeHtml(receiverName)}</div>
                    <div class="text-xs text-slate-600">電話: ${escapeHtml(receiverPhone)}</div>
                </td>
                <td class="py-4 px-2">
                    <div class="text-xs text-gray-700 font-medium">${escapeHtml(logisticsDesc)}</div>
                    <div class="text-xs text-gray-600 mt-0.5 break-all">地址: ${escapeHtml(shippingAddress)}</div>
                    <div class="text-[10px] text-emerald-600 mt-1 font-bold">金額: TWD $${o.amount}</div>
                </td>
                <td class="py-4 px-2 text-center">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold ${isShipped ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
                        ${isShipped ? '已履約完成' : '待履約'}
                    </span>
                </td>
                <td class="py-4 px-2 text-right">
                    ${!isShipped ? `
                        <button onclick="markAsShipped('${o.id}')" 
                            class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition shadow-sm">
                            標記為履約完成
                        </button>
                    ` : `
                        <span class="text-gray-400 text-xs italic">已完成</span>
                    `}
                </td>
            </tr>
        `;
    }).join('');
    renderDistributorPriceBooksTable();
    if (String(dashboardData?.myDistributorId || '').trim() && !String(window.__selectedDistributorPricebookDistributorId || '').trim()) {
        window.loadDistributorPriceBooks();
    }

};

window.markAsShipped = async function(orderId) {
    if (!confirm(`確定要將訂單 ${orderId} 標記為「履約完成」嗎？\n這將會同步更新學員的查看狀態。`)) return;

    try {
        const markShippedFunc = httpsCallable(functions, 'markOrderShipped');
        const result = await markShippedFunc({ orderId });
        
        if (result.data?.success) {
            notify('訂單狀態已更新！', 'success');
            // Refresh local data state
            const order = (dashboardData.hardwareOrders || []).find(o => o.id === orderId);
            if (order) order.fulfillmentStatus = 'SHIPPED';
            renderLogisticsTab();
        } else {
            throw new Error(result.data?.error || '更新失敗');
        }
    } catch (err) {
        console.error("Failed to mark order as shipped:", err);
        alert(`更新失敗: ${err.message}`);
    }
};

window.renderAdminConsole = window.renderAdminConsole || function() {
    if (myRole !== 'admin') return;

    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));
    let filterCourseId = filterUnitId ? findParentCourseIdByUnit(filterUnitId) : resolveCourseIdFromUrlParam(urlParams.get('courseId'));
    if (filterCourseId) {
        filterCourseId = findCourseId(filterCourseId);
    }

    const adminPanel = document.getElementById('admin-panel');
    if (!adminPanel) return;

    // [NEW] Render Pending Applications
    const pendingApps = (dashboardData.pendingApplications || [])
        .map(app => ({ ...app, unitId: normalizeTutorAdminUnitId(app.unitId) }))
        .filter(app => !shouldHideTutorAdminUnit(app.unitId));
    let pendingHtml = '';
    if (pendingApps.length > 0) {
        pendingHtml = `
            <div class="mb-10 bg-orange-50 border border-orange-100 rounded-2xl overflow-hidden shadow-sm">
                <div class="px-6 py-4 border-b border-orange-100 flex items-center justify-between">
                    <h4 class="text-sm font-black text-orange-900 flex items-center gap-2">
                        <span class="animate-pulse">🔔</span> 待處理導師申請 (${pendingApps.length})
                    </h4>
                </div>
                <div class="p-6 space-y-4">
                    ${pendingApps.map(app => `
                        <div class="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-xl border border-orange-100 gap-4 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center gap-4">
                                <div class="p-2 bg-orange-100 rounded-lg text-lg">🎓</div>
                                <div>
                                    <div class="text-sm font-black text-gray-800">${escapeHtml(app.userEmail)}</div>
                                    <div class="text-[10px] font-mono text-gray-400 mt-0.5">${escapeHtml(app.unitId)}</div>
                                    ${app.source === 'tutor_recommendation' ? `<div class="text-[10px] text-orange-500 mt-0.5">由老師推薦：${escapeHtml(app.recommendedByEmail || 'unknown')}</div>` : ''}
                                    <div class="text-[10px] text-gray-400 mt-0.5">${new Date(app.appliedAt?._seconds * 1000).toLocaleString()}</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-3 w-full sm:w-auto">
                                <button onclick="handleDecideApplication('${app.id}', 'rejected')"
                                    class="flex-grow sm:flex-none px-6 py-2 border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-700 hover:border-red-100 transition-all">
                                    拒絕 Reject
                                </button>
                                <button onclick="handleDecideApplication('${app.id}', 'approved')"
                                    class="flex-grow sm:flex-none px-8 py-2 bg-blue-500 text-white rounded-lg text-xs font-black hover:bg-orange-600 shadow-sm transition-all active:scale-95">
                                    批准 Approve ✅
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Admin Coaching Metrics calculations
    const rawInts = dashboardData?.interventions || [];
    const totalInts = rawInts.length;
    const resolvedInts = rawInts.filter(i => i.status === 'resolved').length;
    const openInts = rawInts.filter(i => i.status === 'open' || i.status === 'in_progress').length;
    const completionRate = totalInts > 0 ? ((resolvedInts / totalInts) * 100).toFixed(0) : 100;

    const blockerCounts = { concept: 0, debug: 0, environment: 0, other: 0 };
    (dashboardData?.assignments || []).forEach(a => {
        if (a.learningState === 'blocked' && a.latestBlocker?.type) {
            const t = a.latestBlocker.type;
            if (blockerCounts[t] !== undefined) {
                blockerCounts[t]++;
            } else {
                blockerCounts.other++;
            }
        }
    });

    const metricsHtml = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <!-- Intervention Completion Rate -->
            <div class="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                <div>
                    <h5 class="text-xs font-extrabold text-indigo-900/60 uppercase tracking-wider mb-2">自動介入處置率</h5>
                    <div class="flex items-baseline gap-2">
                        <span class="text-3xl font-black text-indigo-950">${completionRate}%</span>
                        <span class="text-xs text-indigo-700/70 font-semibold">(${resolvedInts}/${totalInts} 已解決)</span>
                    </div>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-xl">🎯</div>
            </div>

            <!-- Active Interventions -->
            <div class="bg-rose-50 border border-rose-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                <div>
                    <h5 class="text-xs font-extrabold text-rose-900/60 uppercase tracking-wider mb-2">待處理自動監控</h5>
                    <div class="flex items-baseline gap-2">
                        <span class="text-3xl font-black text-rose-950">${openInts}</span>
                        <span class="text-xs text-rose-700/70 font-semibold">個未關閉警示</span>
                    </div>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-xl">🚨</div>
            </div>

            <!-- Blocker Distribution -->
            <div class="bg-amber-50 border border-amber-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                <div class="flex items-center justify-between mb-2">
                    <h5 class="text-xs font-extrabold text-amber-900/60 uppercase tracking-wider">即時學生卡點分布</h5>
                    <div class="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-sm">💡</div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center text-xs">
                    <div class="bg-white/80 rounded-xl p-2 border border-amber-100/50">
                        <div class="text-[10px] text-amber-800 font-bold">觀念不懂</div>
                        <div class="text-base font-black text-amber-950 mt-0.5">${blockerCounts.concept}</div>
                    </div>
                    <div class="bg-white/80 rounded-xl p-2 border border-amber-100/50">
                        <div class="text-[10px] text-amber-800 font-bold">程式 Bug</div>
                        <div class="text-base font-black text-amber-950 mt-0.5">${blockerCounts.debug}</div>
                    </div>
                    <div class="bg-white/80 rounded-xl p-2 border border-amber-100/50">
                        <div class="text-[10px] text-amber-800 font-bold">環境問題</div>
                        <div class="text-base font-black text-amber-950 mt-0.5">${blockerCounts.environment}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    let html = `
        ${pendingHtml}
        <div id="admin-console-header" class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <h3 class="text-2xl font-black text-orange-900 flex items-center gap-3">
                <span class="p-2.5 bg-orange-100 rounded-xl">🛠️</span> 
                合格教師設定 (Tutor Settings)
            </h3>

            <p id="admin-msg" class="text-sm font-bold text-orange-600 animate-pulse"></p>
        </div>
        ${metricsHtml}
    `;

    try {
        const renderedUnits = new Set(); // [NEW] Track rendered units to prevent duplicates
        let lessonRows = allLessons.map(lesson => {
            try {
                if (filterCourseId && lesson.courseId !== filterCourseId) return '';

                let units = lesson.courseUnits || [];
                const rawFiles = Array.from(new Set([...units, ...Object.keys(dashboardData?.unitTutorConfigs || {})]))
                    .filter(isRenderableUnitFile);
                const canonicalUnitMap = new Map();

                rawFiles.forEach(fileName => {
                    const preferredId = normalizeTutorAdminUnitId(getPreferredUnitId(fileName, units, Object.keys(dashboardData?.unitTutorConfigs || {})));
                    if (!isRenderableUnitFile(preferredId)) return;
                    if (shouldHideTutorAdminUnit(preferredId)) return;
                    if (!canonicalUnitMap.has(preferredId)) {
                        canonicalUnitMap.set(preferredId, preferredId);
                    }
                });

                let allFiles = Array.from(canonicalUnitMap.values());

                if (filterUnitId) {
                    const preferredUnit = normalizeTutorAdminUnitId(getPreferredUnitId(filterUnitId, units, Object.keys(dashboardData?.unitTutorConfigs || {})));
                    allFiles = preferredUnit ? [preferredUnit] : [];
                }

                if (allFiles.length === 0) return '';

                return allFiles.map(unitFile => {
                    const normalizedFile = normalizeTutorAdminUnitId(getPreferredUnitId(unitFile, units, Object.keys(dashboardData?.unitTutorConfigs || {})));
                    if (!isRenderableUnitFile(normalizedFile)) return '';
                    if (shouldHideTutorAdminUnit(normalizedFile)) return '';
                    if (renderedUnits.has(normalizedFile)) return ''; 
                    renderedUnits.add(normalizedFile);

                    const unitDocConfig = getUnitTutorConfig(normalizedFile);
                    const unitAssignmentMap = getAssignmentUrlMapForUnit(
                        unitDocConfig.assignmentUrlMap || unitDocConfig.assignmentUrls || {},
                        normalizedFile
                    ) || {};
                    const unitTutorsArr = Array.isArray(unitDocConfig.authorizedTutors) ? unitDocConfig.authorizedTutors : [];
                    const unitTutorEmails = new Set();
                    const pushTutorEmail = (value) => {
                        const email = normalizeEmail(normalizeTutorIdentifier(value));
                        if (email && email.includes('@') && email !== 'default') {
                            unitTutorEmails.add(email);
                        }
                    };
                    unitTutorsArr.forEach(pushTutorEmail);
                    Object.keys(unitDocConfig.tutorDetails || {}).forEach(pushTutorEmail);
                    Object.values(unitDocConfig.tutorDetails || {}).forEach(entry => pushTutorEmail(entry?.email));
                    Object.keys(unitAssignmentMap || {}).forEach(pushTutorEmail);
                    const unitTutors = Array.from(unitTutorEmails);
                    const unitName = formatUnitName(normalizedFile) || formatUnitName(unitFile) || unitFile;
                    const displayTitle = unitsTitleMap[resolveCanonicalUnitId(normalizedFile)] || unitName;

                    const isSelected = filterUnitId && unitIdsMatch(normalizedFile, filterUnitId);
                    const containerClass = isSelected ? "bg-blue-50/60 border-l-4 border-blue-500 shadow-sm z-10" : "hover:bg-orange-50/20 transition-colors";
                    const inputId = `input-auth-${lesson.courseId}-${normalizedFile}`.replace(/[^a-z0-9]/gi, '-');

                    return `
                        <div class="flex flex-col ${containerClass} p-6 gap-6 relative">
                            <!-- Section 1: Unit Info -->
                            <div>
                                <div class="text-[11px] text-orange-400 font-black uppercase mb-1.5 tracking-widest">課程 / COURSE</div>
                                <div class="text-lg font-black text-gray-800">${escapeHtml(displayTitle)}</div>
                                <div class="text-xs text-gray-400 font-mono mt-1 leading-relaxed">${escapeHtml(normalizedFile.replace(/\.html$/i, ''))}</div>
                            </div>

                            <!-- Section 2: Tutor Management -->
                            <div>
                                <div class="text-[11px] text-orange-400 font-black uppercase mb-3.5 tracking-widest">合格導師 / Tutors</div>
                                <div class="bg-white rounded-xl border border-orange-100 overflow-hidden mb-5">
                                    <table class="w-full text-left border-collapse text-[11px]">
                                        <thead>
                                            <tr class="bg-orange-50/50 text-orange-700 border-b border-orange-100 uppercase tracking-tighter font-black">
                                                <th class="py-2.5 px-4">姓名 / Name</th>
                                                <th class="py-2.5 px-4">Email</th>
                                                <th class="py-2.5 px-4">合格時間 / Qualified At</th>
                                                <th class="py-2.5 px-4 text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-orange-50">
                                            ${unitTutors.length > 0
                                ? unitTutors.map(email => {
                    const details = unitDocConfig.tutorDetails?.[email] || {};
                    const displayEmail = details.email || email;
                    if (!displayEmail || !displayEmail.includes('@')) return '';
                    const name = details.name || displayEmail.split('@')[0];
                                    const time = details.qualifiedAt
                                        ? new Date(details.qualifiedAt).toLocaleString('zh-TW', { hour12: false })
                                        : '—';

                                    return `
                                            <tr class="hover:bg-orange-50/20 transition-colors group/row">
                                                <td class="py-2.5 px-4 font-bold text-gray-800">${escapeHtml(name)}</td>
                                                <td class="py-2.5 px-4 font-mono text-gray-500">${escapeHtml(displayEmail)}</td>
                                                <td class="py-2.5 px-4 text-gray-400">${escapeHtml(time)}</td>
                                                <td class="py-2.5 px-4 text-right">
                                                    <button onclick="handleUnitTutorAuth('${lesson.courseId}', '${normalizedFile}', '${displayEmail}', 'remove', '${lesson.courseId}')" 
                                                        class="text-red-500 hover:text-red-700 transition-colors p-1 font-bold">
                                                        移除 ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                }).filter(Boolean).join('')
                                : '<tr><td colspan="4" class="py-8 text-center text-gray-300 italic">目前無核心授權導師</td></tr>'
                            }
                                        </tbody>
                                    </table>
                                </div>

                            </div>
                        </div>
                    `;
                }).join('');
            } catch (lessonErr) {
                console.error("Error rendering lesson:", lesson.courseId, lessonErr);
                return `<div class="p-4 text-red-500">Error rendering lesson ${lesson.courseId}: ${lessonErr.message}</div>`;
            }
        }).join('');

        html += `
            <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm font-mono text-sm w-full">
                <div class="divide-y divide-gray-100">
                    ${lessonRows}
                </div>
            </div>
        `;
    } catch (totalErr) {
        console.error("Tutor Management Crash:", totalErr);
        html += `<div class="p-8 text-center bg-red-50 text-red-600 rounded-2xl border border-red-100">
            <h4 class="font-black mb-2">導師管理頁發生錯誤</h4>
            <p class="text-xs opacity-75">${totalErr.message}</p>
        </div>`;
    }

    adminPanel.innerHTML = html;
    stripAdminConsoleAttachmentSections(adminPanel);
}

window.runRevenueSimulation = function () {
    const val = (id, fallback = 0) => {
        const el = document.getElementById(id);
        const n = Number(el?.value);
        return Number.isFinite(n) ? n : fallback;
    };
    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const buildLevels = (amount, rate, uplineRate, maxLevels = 6) => {
        const out = [];
        let share = amount * rate;
        let level = 1;
        while (level <= maxLevels && share >= 0.01) {
            out.push(round2(share));
            share = share * uplineRate;
            level += 1;
        }
        return out;
    };

    const amount = Math.max(0, val('sim-amount', 0));
    const months = Math.max(1, Math.floor(val('sim-months', 12)));
    const tutorLevels = buildLevels(amount, val('sim-tutor-rate', 0.2), val('sim-tutor-upline-rate', 0.2));
    const agentLevels = buildLevels(amount, val('sim-agent-rate', 0.2), val('sim-agent-upline-rate', 0.1));
    const courseLevels = buildLevels(amount, val('sim-course-rate', 0.2), val('sim-course-upline-rate', 0.1));

    const sum = (arr) => round2(arr.reduce((a, b) => a + b, 0));
    const tutorTotal = sum(tutorLevels);
    const agentTotal = sum(agentLevels);
    const courseTotal = sum(courseLevels);
    const totalCredit = round2(tutorTotal + agentTotal + courseTotal);
    const monthlyPay = round2(totalCredit / months);

    const resultEl = document.getElementById('revenue-sim-result');
    if (!resultEl) return;
    const fmt = (arr) => arr.length ? arr.map((v, i) => `L${i + 1}: ${v}`).join(' / ') : '0';
    resultEl.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div class="bg-white rounded-xl border p-3"><div class="text-xs text-gray-500">總 Credit</div><div class="text-xl font-black text-gray-800">TWD ${totalCredit}</div></div>
            <div class="bg-white rounded-xl border p-3"><div class="text-xs text-gray-500">月攤提</div><div class="text-xl font-black text-blue-700">TWD ${monthlyPay}</div></div>
            <div class="bg-white rounded-xl border p-3"><div class="text-xs text-gray-500">有效期</div><div class="text-xl font-black text-gray-800">${months} 月</div></div>
            <div class="bg-white rounded-xl border p-3"><div class="text-xs text-gray-500">訂單金額</div><div class="text-xl font-black text-gray-800">TWD ${round2(amount)}</div></div>
        </div>
        <div class="bg-white rounded-xl border p-4 text-sm text-gray-700 space-y-2">
            <div><span class="font-bold text-indigo-700">Tutor:</span> ${fmt(tutorLevels)}（合計 ${tutorTotal}）</div>
            <div><span class="font-bold text-emerald-700">Agent:</span> ${fmt(agentLevels)}（合計 ${agentTotal}）</div>
            <div><span class="font-bold text-amber-700">CourseDev:</span> ${fmt(courseLevels)}（合計 ${courseTotal}）</div>
        </div>
    `;
};

window.loadRevenuePolicies = async function () {
    const body = document.getElementById('revenue-policy-body');
    if (!body) return;
    body.innerHTML = '<div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">載入中...</div>';
    try {
        const fn = httpsCallable(functions, 'getRevenueSharePolicies');
        const res = await fn({});
        const policies = Array.isArray(res?.data?.policies) ? res.data.policies : [];
        window.__loadedRevenuePolicies = policies;
        const policyCountEl = document.getElementById('business-stat-policy-count');
        if (policyCountEl) {
            policyCountEl.textContent = String(policies.some(p => p && p.enabled !== false) ? 1 : 0);
        }
        if (!policies.length) {
            body.innerHTML = '<div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">找不到固定分潤設定，請直接儲存以建立預設值。</div>';
            return;
        }

        const policy = policies.find((p) => p && p.enabled !== false) || policies[0];
        const id = 'fixed-policy';
        const tutorRate = Number(policy.tutorRate ?? 0.2);
        const tutorUplineRate = Number(policy.tutorUplineRate ?? 0.2);
        const agentRate = Number(policy.agentRate ?? 0.2);
        const agentUplineRate = Number(policy.agentUplineRate ?? 0);
        const courseDevRate = Number(policy.courseDevRate ?? 0.2);
        const courseDevUplineRate = Number(policy.courseDevUplineRate ?? 0.1);

        const policySummary = (label, directRate, uplineRate, accent, note) => `
            <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div class="flex-grow">
                    <div class="text-sm font-black text-slate-900">${escapeHtml(label)}</div>
                    <div class="mt-1 text-[12px] leading-5 text-slate-500">${escapeHtml(note)}</div>
                </div>
                <div class="flex-shrink-0 flex items-center justify-between sm:justify-end gap-3 rounded-2xl bg-slate-50 px-4 py-2.5 sm:py-2">
                    <div class="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">分潤比例</div>
                    <div class="rounded-full px-3 py-1.5 text-[11px] font-black ${accent.bg} ${accent.fg} whitespace-nowrap">
                        直推 ${Math.round(directRate * 100)}% / 上線 ${Math.round(uplineRate * 100)}%
                    </div>
                </div>
            </div>
        `;

        body.innerHTML = `
            <div class="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                <div class="space-y-6">
                    <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
                        <div class="font-black">使用說明</div>
                        <ul class="mt-2 space-y-1.5 text-[13px] leading-6">
                            <li>• 這組設定會套用到所有訂單與月結，不再區分直銷、代理等多套策略。</li>
                            <li>• 「直推」是第一層分潤；「上線」是往上一層遞迴分潤比例。</li>
                            <li>• 若某個角色不需要分潤，直接把該欄位設為 <code>0</code> 即可。</li>
                        </ul>
                    </div>

                    <div class="grid gap-4 md:grid-cols-2">
                        ${policyRateInput(id, 'policy-tutorRate', tutorRate, '導師直推分潤', '訂單成交時，第一層導師可拿到的比例。')}
                        ${policyRateInput(id, 'policy-tutorUplineRate', tutorUplineRate, '導師上線分潤', '導師的上線會依這個比例繼續遞迴分潤。')}
                        ${policyRateInput(id, 'policy-agentRate', agentRate, '管道直推分潤', '若訂單有對應的推廣或代理角色，第一層的比例。')}
                        ${policyRateInput(id, 'policy-agentUplineRate', agentUplineRate, '管道上線分潤', '代理角色的上線遞迴比例。設為 0 即停止往上分。')}
                        ${policyRateInput(id, 'policy-courseDevRate', courseDevRate, '開發直推分潤', '課程開發者的第一層分潤比例。')}
                        ${policyRateInput(id, 'policy-courseDevUplineRate', courseDevUplineRate, '開發上線分潤', '開發者上線的遞迴比例。通常設定得比直推更低。')}
                    </div>

                </div>

                <div class="space-y-4">
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                        <div class="text-sm font-black text-slate-900">快速檢查</div>
                        <div class="mt-4 space-y-3 text-sm text-slate-600">
                            <div class="flex items-start gap-3">
                                <span class="mt-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">1</span>
                                <span>若只想保留單一固定分潤，所有欄位都在這裡調整即可。</span>
                            </div>
                            <div class="flex items-start gap-3">
                                <span class="mt-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">2</span>
                                <span>把某個欄位設成 <code>0</code>，就等於關閉該角色的分潤。</span>
                            </div>
                            <div class="flex items-start gap-3">
                                <span class="mt-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">3</span>
                                <span>目前系統不再使用其他策略名稱，舊資料也會自動回落到固定設定。</span>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div class="text-sm font-black text-slate-900">設定提醒</div>
                        <div class="mt-1 text-xs leading-6 text-slate-500">這裡是三個角色的固定分潤摘要，先看用途，再看比例。</div>
                        <div class="mt-4 flex flex-col gap-3">
                            ${policySummary('導師', tutorRate, tutorUplineRate, { bg: 'bg-blue-50', fg: 'text-blue-700' }, '最常使用的主分潤，建議先確認這一組。')}
                            ${policySummary('管道 / Agent', agentRate, agentUplineRate, { bg: 'bg-emerald-50', fg: 'text-emerald-700' }, '如果沒有代理通路，兩個欄位都可以保持 0。')}
                            ${policySummary('課程開發', courseDevRate, courseDevUplineRate, { bg: 'bg-amber-50', fg: 'text-amber-700' }, '適合用來分配內容提供者或課程作者。')}
                        </div>
                    </div>

                    <button id="btn-save-policy-${id}" onclick="window.saveRevenuePolicy('${escapeHtml(id)}')" class="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-95">
                        儲存固定設定
                    </button>
                </div>
            </div>
        `;
    } catch (e) {
        body.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">載入失敗：${escapeHtml(e.message || 'unknown')}</div>`;
    }
};

window.markPolicyModified = function(id) {
    const btn = document.getElementById(`btn-save-policy-${id}`);
    if (btn) {
        btn.classList.remove('bg-slate-900', 'hover:bg-slate-700');
        btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
        btn.textContent = '儲存變更';
    }
};

window.saveRevenuePolicy = async function (policyId) {
    const g = (id) => document.getElementById(`${id}-${policyId}`);
    const payload = {
        policyId: 'default-v1',
        policyName: 'Default Sharing Policy',
        tutorRate: Number(g('policy-tutorRate')?.value || 0) / 100,
        tutorUplineRate: Number(g('policy-tutorUplineRate')?.value || 0) / 100,
        agentRate: Number(g('policy-agentRate')?.value || 0) / 100,
        agentUplineRate: Number(g('policy-agentUplineRate')?.value || 0) / 100,
        courseDevRate: Number(g('policy-courseDevRate')?.value || 0) / 100,
        courseDevUplineRate: Number(g('policy-courseDevUplineRate')?.value || 0) / 100,
        enabled: true
    };
    
    const btn = document.getElementById(`btn-save-policy-${policyId}`);
    const originalText = btn ? btn.textContent : '儲存';
    if (btn) {
        btn.disabled = true;
        btn.textContent = "儲存中...";
    }
    
    try {
        const fn = httpsCallable(functions, 'upsertRevenueSharePolicy');
        await fn(payload);
        notify('已成功儲存固定分潤設定', 'success');
        
        if (btn) {
            btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
            btn.classList.add('bg-slate-900', 'hover:bg-slate-700');
            btn.textContent = '儲存';
        }
        
        await loadDashboard();
        renderBusinessTab();
    } catch (e) {
        console.error('[Business] Failed to save policy:', e);
        alert(`更新失敗：${e.message}`);
        if (btn) {
            btn.textContent = originalText;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
        }
    }
};

function stripAdminConsoleAttachmentSections(rootEl) {
    if (!rootEl) return;
    const candidates = Array.from(rootEl.querySelectorAll('div, section, article'));
    candidates.forEach(node => {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text.includes('附件資料 / Attachments')) return;

        const removableCard =
            node.closest('.mb-4.p-4.bg-orange-50') ||
            node.closest('.unit-guide-row') ||
            node;

        if (removableCard && rootEl.contains(removableCard)) {
            removableCard.remove();
        }
    });
}

window.handleUnitTutorAuth = async function (courseId, unitFile, tutorEmail, action, parentCourseId = null) {
    if (!tutorEmail) return alert("請輸入 Email");
    const msg = document.getElementById('admin-msg');

    try {
        if (msg) msg.textContent = action === 'add' ? "正在新增單元授權..." : "正在移除單元授權...";

        // [MODIFIED] Use both unitFile (as specific courseId) and parentCourseId (for legacy cleanup)
        const authFunc = httpsCallable(functions, 'authorizeTutorForCourse');
        await authFunc({ 
            courseId: unitFile, 
            tutorEmail, 
            action,
            parentCourseId: parentCourseId || courseId // Use courseId as fallback if specifically passed
        });

        loadDashboard(); // Refresh UI
    } catch (e) {
        console.error("Unit Auth Error:", e);
        alert("授權失敗: " + e.message);
    } finally {
        if (msg) msg.textContent = "";
    }
};

window.toggleAdminTutorMode = function (enabled) {
    adminTutorMode = enabled === true;
    writeAdminTutorModeForUid(myUid, adminTutorMode);
    // [V13.0.21] Force reload to ensure ALL functions and UI respect the new simulation state
    window.location.reload();
};

/**
 * [NEW] Inject Admin Tutor Mode Toggle into Assignments & Settings Tabs
 */
window.vibeInjectAdminTutorModeToggle = function() {
    console.log("[TutorMode] Injection attempt. Role:", myRole);
    if (myRole !== 'admin') return;
    
    const toggleHtml = `
        <div class="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-gray-100 shadow-sm scale-90 sm:scale-100 origin-right">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">導師模式 / Tutor Mode</span>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" value="" class="sr-only peer" ${adminTutorMode ? 'checked' : ''} onchange="toggleAdminTutorMode(this.checked)">
                <div class="w-10 h-5 bg-gray-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
        </div>
    `;

    const targetIds = ['assignments-header', 'assignments-header-integrated', 'admin-console-header'];
    
    targetIds.forEach(id => {
        const header = document.getElementById(id);
        if (header) {
            console.log(`[TutorMode] Injecting into ${id}`);
            let container = header.querySelector('.admin-tutor-mode-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'admin-tutor-mode-container';
                header.appendChild(container);
            }
            container.innerHTML = toggleHtml;
        } else {
            // console.log(`[TutorMode] Header ${id} not found in DOM.`);
        }
    });
};

function upsertHeaderExternalLink(headerEl, guideType) {
    // 依據需求，此處已移除 dashboard 中的「外部檔案」按鈕
    return;
}

function refreshDashboardExternalGuideLinks() {
    upsertHeaderExternalLink(document.getElementById('assignments-header'), 'assignment');
    upsertHeaderExternalLink(document.getElementById('assignments-header-integrated'), 'assignment');
}

window.handleAssignTutor = async function (studentUid, unitId, tutorEmail) {
    if (!studentUid || !unitId) {
        alert(`Missing data: studentUid=${studentUid}, unitId=${unitId}`);
        return;
    }
    const msg = document.getElementById('admin-msg');
    const finalTutor = (tutorEmail === 'none' || !tutorEmail) ? "" : tutorEmail;

    // alert(`Sending: studentUid=${studentUid}, unitId=${unitId}, tutorEmail=${finalTutor}`);

    try {
        if (msg) msg.textContent = "正在更新導師指派...";

        const assignFunc = httpsCallable(functions, 'assignStudentToTutor');
        await assignFunc({ studentUid, unitId, tutorEmail: finalTutor });

        // Refresh the whole dashboard to get fresh data from server
        await loadDashboard();
    } catch (e) {
        console.error("Assignment Error:", e);
        alert("指派失敗: " + e.message);
    } finally {
        if (msg) msg.textContent = "";
    }
};

window.autoGradeAssignment = async function (assignmentId) {
    const row = document.querySelector(`[data-assignment-id="${assignmentId}"]`);
    if (row) {
        row.style.opacity = '0.5';
        row.style.pointerEvents = 'none';
    }
    try {
        const fn = httpsCallable(functions, 'autoGradeSingleAssignment');
        const result = await fn({ assignmentId });
        if (result?.data?.score !== undefined) {
            notify(`自動批改完成：${result.data.score} 分`, result.data.score >= 70 ? 'success' : 'warning');
        }
        renderAssignments(dashboardData?.assignments || [], "", { showGuide: false });
    } catch (e) {
        console.error(e);
        notify(`自動批改失敗：${e.message}`, 'error');
    } finally {
        if (row) {
            row.style.opacity = '';
            row.style.pointerEvents = '';
        }
    }
};

window.maybeHandleTutorRecommendationInviteAction = window.maybeHandleTutorRecommendationInviteAction || async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const applicationId = urlParams.get('applicationId');
    if (!['submitTutorInvite', 'submitTutorAssignmentLink'].includes(action) || !applicationId) return;
    if (!auth.currentUser) return;

    const myApps = dashboardData?.myApplications || {};
    const appEntry = Object.values(myApps).find(app => app?.applicationId === applicationId);
    if (!appEntry) return;
    if (appEntry.status !== 'awaiting_candidate_link') return;

    const assignmentUrlRaw = window.prompt('請貼上此單元的作業連結：', '');
    if (!assignmentUrlRaw || !assignmentUrlRaw.trim()) return;
    const assignmentUrl = normalizeAssignmentLinkUrl(assignmentUrlRaw);
    if (!isValidAssignmentLinkUrl(assignmentUrl)) {
        alert('連結格式錯誤。請使用有效的作業連結（http/https）。');
        return;
    }

    try {
        const submitLink = httpsCallable(functions, 'submitTutorRecommendationInviteLink');
        await submitLink({
            applicationId,
            assignmentLink: assignmentUrl
        });

        notify('已送出作業連結，管理員已收到審核通知。', 'success');
        urlParams.delete('action');
        urlParams.delete('applicationId');
        const cleanedQuery = urlParams.toString();
        const cleanedUrl = `${window.location.pathname}${cleanedQuery ? `?${cleanedQuery}` : ''}`;
        window.history.replaceState({}, '', cleanedUrl);
        await loadDashboard();
    } catch (error) {
        console.error('[TutorInvite] Submit failed:', error);
        alert(`送出失敗：${error.message || '請稍後再試'}`);
    }
};

// Utils
window.escapeHtml = window.escapeHtml || function(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.formatUnitName = window.formatUnitName || function(fileName) {
    if (!fileName) return "Unknown";
    let name = String(fileName).replace('.html', '');

    // Normalize common course/unit prefixes into readable labels.
    name = name
        .replace(/^(?:tw-(?:common|car-(?:starter|basic|advanced))-|start-|basic-|adv-|advanced-|prepare-)?(?:\d{2}-)?/i, '')
        .replace(/^unit-/i, '')
        .replace(/^master-/i, '');

    // Fallback: if unit/master/prepare still appears in middle, trim the left part.
    const nameMatch = name.match(/(?:unit-|master-|prepare-|tw-common-|tw-car-(?:starter|basic|advanced)-|common-|car-(?:starter|basic|advanced)-)(.+)/i);
    if (nameMatch && nameMatch[1]) name = nameMatch[1];
    const titleCased = name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return titleCased
        .replace(/\bGithub\b/g, 'GitHub')
        .replace(/\bPwm\b/g, 'PWM')
        .replace(/\bWifi\b/g, 'WiFi')
        .replace(/\bUi\b/g, 'UI')
        .replace(/\bUx\b/g, 'UX')
        .replace(/\bApi\b/g, 'API')
        .replace(/\bBle\b/g, 'BLE')
        .replace(/\bId\b/g, 'ID')
        .replace(/\bHtml\b/g, 'HTML')
        .replace(/\bCss\b/g, 'CSS')
        .replace(/\bJs\b/g, 'JS');
}

window.formatUnitIdForUI = window.formatUnitIdForUI || function(unitId) {
    if (!unitId) return 'N/A';
    return String(unitId)
        .replace(/\.html$/i, '')
        .replace(/-unit-/i, '-')
        .replace(/-lesson-/i, '-')
        .replace(/-/g, ' ');
}

// --- Data Aggregation Logic ---
window.aggregateData = window.aggregateData || function(data) {
    if (!data.students) return;

    const MENU_PAGES = new Set([
        'index.html', 'advanced.html', 'basic.html', 
        'start.html', 'prepare.html', 'auth.html', 'dashboard.html', 
        'cart.html', 'students.html', 'payment-return.html', 'tutors.html',
        'index', 'advanced', 'basic', 'started', 'prepare', 'auth', 'dashboard', 'cart', 'students'
    ]);

    data.students.forEach(student => {
        const rawProgress = student.courseProgress || {};
        const aggregated = {};

        Object.entries(rawProgress).forEach(([key, stats]) => {
            const lowKey = key.toLowerCase();
            // Skip Menu Pages OR 00-* intro pages
            if (MENU_PAGES.has(lowKey) || lowKey.startsWith('00-')) return;

            const realId = findCourseId(key);
            // console.log(`Mapping ${ key } -> ${ realId } `);

            if (!aggregated[realId]) {
                aggregated[realId] = { total: 0, video: 0, doc: 0, page: 0, units: {}, logs: [] };
            }
            aggregated[realId].total += stats.total || 0;
            aggregated[realId].video += stats.video || 0;
            aggregated[realId].doc += stats.doc || 0;
            aggregated[realId].page += stats.page || 0;

            // Store granular unit data
            aggregated[realId].units[key] = stats;

            // Merge Logs
            if (stats.logs && Array.isArray(stats.logs)) {
                if (!aggregated[realId].logs) aggregated[realId].logs = [];
                aggregated[realId].logs = aggregated[realId].logs.concat(stats.logs);
            }
        });

        // Recalculate totals based on filtered courses
        student.totalTime = Object.values(aggregated).reduce((acc, c) => acc + (c.total || 0), 0);
        student.videoTime = Object.values(aggregated).reduce((acc, c) => acc + (c.video || 0), 0);
        student.docTime = Object.values(aggregated).reduce((acc, c) => acc + (c.doc || 0), 0);

        student.courseProgress = aggregated;
    });

    // Fix assignments courseId & ensure ID stability
    if (data.assignments) {
        data.assignments.forEach(a => {
            // [REPAIR] Ensure id is always present (backend returns id, but we be defensive)
            if (!a.id && a.docId) a.id = a.docId;
            
            const realId = findCourseId(a.courseId);
            if (realId && realId !== a.courseId) {
                a.courseId = realId;
            }
        });
    }
}

window.findCourseId = window.findCourseId || function(key) {
    if (!key) return key;
    const cleanKey = normalizeDashboardLooseKey(key);

    // 1. Exact match in loaded lessons
    const exact = allLessons.find(l => l.courseId === key);
    if (exact) return key;

    // 2. Exact match in lessonsMap (keys are courseIds)
    if (lessonsMap[key]) return key;

    // 3. Match against courseId/courseKey/entryUnitId/courseUnits/legacy assignment link
    for (const l of allLessons) {
        const candidateKeys = getLessonLookupKeys(l);
        if (candidateKeys.has(cleanKey)) {
            return l.courseId;
        }
    }

    return key; // Fallback to original if no match found
}

// --- Course Settings Feature ---

window.setupSettingsFeature = window.setupSettingsFeature || function() {
    // Buttons are now rendered individually in each row
}

window.setupBusinessFeature = window.setupBusinessFeature || function() {
    // Business settings are rendered on-demand when the tab is opened.
}

function isBusinessPricedLesson(lesson = {}) {
    if (!lesson || typeof lesson !== 'object') return false;
    return lesson.dealerPrice != null || lesson.dealerCurrency != null || lesson.dealerPriceBookId != null || lesson.dealerPriceBookLessonId != null;
}

function getLessonBusinessPrice(lesson = {}, locale = 'zh-TW') {
    if (window.vibePricing?.resolveLessonPrice) {
        return window.vibePricing.resolveLessonPrice(lesson, locale);
    }
    const normalizedLocale = String(locale || '').startsWith('en') ? 'en' : 'zh-TW';
    const amount = Number(lesson.dealerPrice ?? 0);
    return {
        amount: Number.isFinite(amount) ? amount : 0,
        currency: String(lesson.dealerCurrency || (normalizedLocale === 'en' ? 'USD' : 'TWD')).toUpperCase()
    };
}

function getLessonBusinessPricingState(lesson = {}) {
    const tw = getLessonBusinessPrice(lesson, 'zh-TW');
    const en = getLessonBusinessPrice(lesson, 'en');
    const twAmount = Number.isFinite(Number(tw.amount)) ? Number(tw.amount) : 0;
    const enAmount = Number.isFinite(Number(en.amount)) ? Number(en.amount) : 0;

    return {
        tw: { amount: twAmount, currency: tw.currency || 'TWD' },
        en: { amount: enAmount, currency: en.currency || 'USD' }
    };
}

function businessPriceInput(value, currency, id, prefix, safeId) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return `
        <div class="w-full">
            <label class="block text-[11px] font-bold text-slate-500 mb-1">
                ${escapeHtml(currency)}
            </label>
            <div class="relative rounded-lg shadow-sm">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span class="text-slate-400 text-xs font-semibold">${escapeHtml(prefix)}</span>
                </div>
                <input id="${id}" type="number" min="0" step="1" value="${amount}" oninput="window.markPriceModified('${escapeHtml(safeId)}')" class="block w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition">
            </div>
        </div>
    `;
}

window.markPriceModified = function(safeId) {
    const btn = document.getElementById(`btn-save-price-${safeId}`);
    if (btn) {
        btn.classList.remove('bg-slate-900', 'hover:bg-slate-700');
        btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
        btn.textContent = '儲存變更';
    }
};

window.filterPricingTable = function() {
    const q = document.getElementById('pricing-search-input')?.value?.toLowerCase() || '';
    const rows = document.querySelectorAll('#business-pricing-table-body tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if (text.includes(q)) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
};

window.__pricingFilter = window.__pricingFilter || 'all';

window.setPricingFilter = function(filter) {
    const hasUnsaved = !!document.querySelector('button[id^="btn-save-price-"].bg-emerald-600');
    if (hasUnsaved && !confirm("您有尚未儲存的價格變更，切換篩選將會遺失變更，是否繼續？")) {
        return;
    }
    window.__pricingFilter = filter;
    renderBusinessPricingOverview();
};

function buildBusinessPricingOverviewHtml() {
    const lessons = Array.isArray(allLessons) ? allLessons : [];
    const pricedLessons = lessons.filter(isBusinessPricedLesson);
    const lessonCount = lessons.length;
    
    const filter = window.__pricingFilter || 'all';
    
    // Apply filter
    const filteredLessons = pricedLessons.filter(lesson => {
        if (filter === 'courses') return !isPhysicalMetadataLesson(lesson);
        if (filter === 'physical') return isPhysicalMetadataLesson(lesson);
        return true;
    });

    const pricedCount = pricedLessons.length;
    const activePolicies = Array.isArray(window.__loadedRevenuePolicies)
        ? window.__loadedRevenuePolicies.filter(p => p && p.enabled !== false).length
        : 0;

    const rows = filteredLessons.map((lesson) => {
        const courseId = String(lesson.id || lesson.docId || lesson.courseId || '').trim();
        const safeId = courseId.replace(/[^a-z0-9_-]/gi, '-');
        const title = lesson.title || lesson.courseTitle || lesson.courseName || courseId || '未命名課程';
        const displayId = String(
            lesson.courseKey ||
            lesson.entryUnitId ||
            courseId.replace(/\.html$/i, '') ||
            lesson.id ||
            courseId
        ).trim();
        const pricingState = getLessonBusinessPricingState(lesson);
        const updatedAt = lesson.pricingUpdatedAt?.seconds
            ? new Date(lesson.pricingUpdatedAt.seconds * 1000).toLocaleString()
            : (lesson.pricingUpdatedAt ? new Date(lesson.pricingUpdatedAt).toLocaleString() : '—');

        const isPhysical = isPhysicalMetadataLesson(lesson);
        
        const badgeClass = 'bg-blue-50 text-blue-700 border border-blue-100';
        const badgeLabel = '🌐 經銷價格表';

        // Type badge (Course vs Hardware)
        const typeBadgeClass = isPhysical 
            ? 'bg-purple-50 text-purple-700 border border-purple-100'
            : 'bg-sky-50 text-sky-700 border border-sky-100';
        const typeBadgeLabel = isPhysical ? '📦 實體商品 (Hardware)' : '📘 線上課程 (Course)';

        // USD Warning Badge
        const hasUsdWarning = pricingState.en.amount === 0 && pricingState.tw.amount > 0;
        const usdWarningBadge = hasUsdWarning 
            ? `<div class="mt-2 text-[10px] inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                ⚠️ 缺美金定價
               </div>` 
            : '';

        return `
            <tr class="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80 transition">
                <td class="py-4 px-6 align-top">
                    <div class="font-bold text-slate-900">${escapeHtml(title)}</div>
                    <div class="text-[11px] text-slate-400 font-mono mt-1 break-all">${escapeHtml(displayId)}</div>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                        <span class="text-[10px] inline-flex items-center px-2 py-0.5 rounded font-semibold ${typeBadgeClass}">
                            ${typeBadgeLabel}
                        </span>
                        <span class="text-[10px] inline-flex items-center px-2 py-0.5 rounded font-semibold ${badgeClass}">
                            ${badgeLabel}
                        </span>
                    </div>
                    ${usdWarningBadge}
                </td>
                <td class="py-4 px-6 align-top">
                    ${businessPriceInput(pricingState.tw.amount, 'TWD / tw', `business-price-tw-${safeId}`, 'NT$', safeId)}
                </td>
                <td class="py-4 px-6 align-top">
                    ${businessPriceInput(pricingState.en.amount, 'USD / en', `business-price-en-${safeId}`, '$', safeId)}
                </td>
                <td class="py-4 px-6 align-top text-sm text-slate-600">
                    <div class="font-semibold text-slate-800">${escapeHtml(window.vibePricing?.formatPrice ? window.vibePricing.formatPrice(pricingState.tw, 'zh-TW') : `TWD ${pricingState.tw.amount}`)}</div>
                    <div class="mt-1">${escapeHtml(window.vibePricing?.formatPrice ? window.vibePricing.formatPrice(pricingState.en, 'en') : `USD ${pricingState.en.amount}`)}</div>
                    <div class="mt-2 text-[11px] text-slate-400">更新：${escapeHtml(updatedAt)}</div>
                </td>
                <td class="py-4 px-6 text-right align-top">
                    <button id="btn-save-price-${safeId}" onclick="window.saveLessonPricing('${escapeHtml(courseId)}')" class="px-3.5 py-2 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition duration-150 active:scale-95 whitespace-nowrap">儲存</button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h4 class="text-sm font-black text-slate-900">課程與商品定價維護</h4>
                    <p class="text-xs text-slate-500 mt-1">資料直接寫入 Firestore 的 <code class="px-1 py-0.5 rounded bg-slate-100 text-slate-700">dealer_price_books</code>，依 default-usd 與 default-twd 儲存定價。</p>
                </div>
                <div class="text-xs text-slate-400 font-medium">儲存來源：<code class="px-1 py-0.5 rounded bg-slate-100 text-slate-700">dealer_price_books</code> (default-usd / default-twd)</div>
            </div>
            
            <div class="px-6 py-4 border-b border-slate-100 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-slate-50/30">
                <div class="flex flex-wrap items-center gap-3 flex-grow max-w-2xl">
                    <div class="relative flex-grow max-w-xs">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            🔍
                        </span>
                        <input type="text" id="pricing-search-input" oninput="window.filterPricingTable()" placeholder="搜尋名稱 or ID..." class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    </div>
                    
                    <!-- Filter Button Group -->
                    <div class="flex items-center gap-1 border border-slate-200 rounded-xl p-1 bg-white shadow-sm">
                        <button onclick="window.setPricingFilter('all')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'all' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:text-slate-850'}">全部商品</button>
                        <button onclick="window.setPricingFilter('courses')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'courses' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:text-slate-850'}">📘 線上課程</button>
                        <button onclick="window.setPricingFilter('physical')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'physical' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:text-slate-850'}">📦 實體硬體</button>
                    </div>
                </div>
                <div class="text-xs text-slate-400 font-medium">請在欄位修改後點擊對應列的「儲存變更」</div>
            </div>

            <div class="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/60">
                <div class="rounded-xl bg-white border border-slate-200 p-4">
                    <div class="text-[11px] uppercase tracking-widest font-bold text-slate-400">當前篩選品項</div>
                    <div class="mt-1 text-2xl font-black text-slate-900">${filteredLessons.length}</div>
                </div>
                <div class="rounded-xl bg-white border border-slate-200 p-4">
                    <div class="text-[11px] uppercase tracking-widest font-bold text-emerald-500">總有價格品項</div>
                    <div class="mt-1 text-2xl font-black text-emerald-600">${pricedCount}</div>
                </div>
                <div class="rounded-xl bg-white border border-slate-200 p-4">
                    <div class="text-[11px] uppercase tracking-widest font-bold text-blue-500">啟用中的分潤策略</div>
                    <div class="mt-1 text-2xl font-black text-blue-600">${activePolicies}</div>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100 bg-slate-50">
                            <th class="py-3 px-6">課程 / Course</th>
                            <th class="py-3 px-6 w-[22%]">TWD / tw</th>
                            <th class="py-3 px-6 w-[22%]">USD / en</th>
                            <th class="py-3 px-6 w-[20%]">即時顯示</th>
                            <th class="py-3 px-6 text-right w-[12%]">操作</th>
                        </tr>
                    </thead>
                    <tbody id="business-pricing-table-body" class="divide-y divide-slate-100 text-sm">
                        ${rows || '<tr><td colspan="5" class="py-10 text-center text-slate-400 italic">尚無符合篩選條件的價格資料</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderBusinessPricingOverview() {
    const container = document.getElementById('business-pricing-overview');
    if (!container) return;
    const lessons = Array.isArray(allLessons) ? allLessons : [];
    const pricedLessons = lessons.filter(isBusinessPricedLesson);
    if (!pricedLessons.length) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = buildBusinessPricingOverviewHtml();

    const lessonCountEl = document.getElementById('business-stat-lesson-count');
    const pricedCountEl = document.getElementById('business-stat-priced-count');
    if (lessonCountEl) lessonCountEl.textContent = String(lessons.length);
    if (pricedCountEl) pricedCountEl.textContent = String(pricedLessons.length);
}

window.saveLessonPricing = async function(courseId) {
    const safeId = String(courseId || '').trim().replace(/[^a-z0-9_-]/gi, '-');
    const readValue = (suffix) => {
        const el = document.getElementById(`business-price-${suffix}-${safeId}`);
        const n = Number(el?.value);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    const payload = {
        courseId: String(courseId || '').trim(),
        pricing: {
            tw: { amount: readValue('tw'), currency: 'TWD' },
            en: { amount: readValue('en'), currency: 'USD' }
        }
    };

    try {
        const fn = httpsCallable(functions, 'upsertLessonPricing');
        await fn(payload);
        notify('價格已更新！', 'success');
        await loadLessons();
        renderBusinessTab();
    } catch (e) {
        console.error('[Business] Failed to save lesson pricing:', e);
        alert(`更新價格失敗：${e.message}`);
    }
};

window.__loadedDistributorPriceBooks = window.__loadedDistributorPriceBooks || [];
window.__selectedDistributorPricebookDistributorId = window.__selectedDistributorPricebookDistributorId || '';
window.__distributorPriceBookUiNormalized = window.__distributorPriceBookUiNormalized || false;

function normalizeDistributorPriceBookPlacement() {
    if (window.__distributorPriceBookUiNormalized) return;
    const settingsContainer = document.querySelector('#view-settings #distributor-pricebook-container');
    const shipmentsContainer = document.querySelector('#view-shipments #distributor-pricebook-container');
    if (settingsContainer && shipmentsContainer && settingsContainer !== shipmentsContainer) {
        settingsContainer.remove();
    }
    window.__distributorPriceBookUiNormalized = true;
}

function syncDistributorPriceBookContext() {
    const distributorId = String(dashboardData?.myDistributorId || '').trim();
    if (!distributorId) return;
    const input = document.getElementById('distributor-pricebook-distributor-id');
    if (input && !String(input.value || '').trim()) {
        input.value = distributorId;
    }
}

function formatDistributorPriceBookDateTime(value) {
    if (!value) return '—';
    try {
        if (typeof value.toDate === 'function') {
            return value.toDate().toLocaleString();
        }
        if (typeof value.seconds === 'number') {
            return new Date(value.seconds * 1000).toLocaleString();
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
    } catch (_) {
        return String(value || '—');
    }
}

function getDistributorPriceBookFormValue(id) {
    return document.getElementById(id)?.value?.trim?.() || '';
}

function setDistributorPriceBookFormValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') {
        el.checked = !!value;
    } else {
        el.value = value ?? '';
    }
}

function buildDistributorPriceBookRow(book = {}) {
    const id = String(book.id || book.priceBookId || '').trim();
    const safeId = id.replace(/[^a-z0-9_-]/gi, '-');
    const activeBadge = book.isActive !== false
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';
    const priceText = `${Number(book.salePrice || 0).toLocaleString()} ${escapeHtml(book.currency || 'TWD')}`;
    const promoText = book.promoPrice != null && book.promoPrice !== ''
        ? `${Number(book.promoPrice || 0).toLocaleString()}`
        : '—';

    return `
        <tr class="hover:bg-slate-50/80 transition">
            <td class="py-4 px-4 align-top">
                <div class="font-mono text-xs font-bold text-slate-900 break-all">${escapeHtml(id || '—')}</div>
                <div class="mt-1 text-[11px] text-slate-400">更新：${escapeHtml(formatDistributorPriceBookDateTime(book.updatedAt))}</div>
            </td>
            <td class="py-4 px-4 align-top">
                <div class="font-bold text-slate-900">${escapeHtml(book.docId || '—')}</div>
                <div class="mt-1 text-[11px] text-slate-400">經銷商：${escapeHtml(book.distributorId || '—')}</div>
            </td>
            <td class="py-4 px-4 align-top">
                <div class="font-semibold text-slate-900">${escapeHtml(priceText)}</div>
                <div class="mt-1 text-[11px] text-slate-500">活動價：${escapeHtml(promoText)}</div>
            </td>
            <td class="py-4 px-4 align-top">
                <div class="text-sm font-bold text-slate-900">${escapeHtml(book.version || 'v1')}</div>
                <span class="mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${activeBadge}">
                    ${book.isActive !== false ? '啟用中' : '停用'}
                </span>
            </td>
            <td class="py-4 px-4 align-top text-sm text-slate-600">
                <div>起：${escapeHtml(formatDistributorPriceBookDateTime(book.effectiveFrom))}</div>
                <div class="mt-1">迄：${escapeHtml(formatDistributorPriceBookDateTime(book.effectiveTo))}</div>
            </td>
            <td class="py-4 px-4 align-top text-right">
                <button data-pricebook-id="${escapeHtml(id)}" onclick="window.populateDistributorPriceBookFormById(this.dataset.pricebookId)" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
                    編輯
                </button>
            </td>
        </tr>
    `;
}

function renderDistributorPriceBooksTable() {
    const tbody = document.getElementById('distributor-pricebook-table-body');
    const summary = document.getElementById('distributor-pricebook-summary');
    const countEl = document.getElementById('distributor-pricebook-count');
    const activeCountEl = document.getElementById('distributor-pricebook-active-count');
    if (!tbody) return;

    const items = Array.isArray(window.__loadedDistributorPriceBooks) ? window.__loadedDistributorPriceBooks : [];
    const activeCount = items.filter((item) => item && item.isActive !== false).length;
    if (countEl) countEl.textContent = String(items.length);
    if (activeCountEl) activeCountEl.textContent = String(activeCount);
    if (summary) {
        const distributorId = window.__selectedDistributorPricebookDistributorId || '';
        summary.textContent = distributorId
            ? `目前載入經銷商：${distributorId}，共 ${items.length} 筆價格表。`
            : '輸入經銷商 ID 後即可載入與維護價格表。';
    }

    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-10 text-center text-slate-400 italic">尚未載入或尚無價格表資料</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(buildDistributorPriceBookRow).join('');
}

window.clearDistributorPriceBookForm = function() {
    setDistributorPriceBookFormValue('distributor-pricebook-id', '');
    setDistributorPriceBookFormValue('distributor-pricebook-doc-id', '');
    setDistributorPriceBookFormValue('distributor-pricebook-currency', 'TWD');
    setDistributorPriceBookFormValue('distributor-pricebook-sale-price', '');
    setDistributorPriceBookFormValue('distributor-pricebook-promo-price', '');
    setDistributorPriceBookFormValue('distributor-pricebook-version', 'v1');
    setDistributorPriceBookFormValue('distributor-pricebook-effective-from', '');
    setDistributorPriceBookFormValue('distributor-pricebook-effective-to', '');
    setDistributorPriceBookFormValue('distributor-pricebook-active', true);
    const state = document.getElementById('distributor-pricebook-form-state');
    if (state) state.textContent = '表單已清空，可新增新的價格表。';
};

window.populateDistributorPriceBookForm = function(book = {}) {
    if (!book || typeof book !== 'object') return;
    setDistributorPriceBookFormValue('distributor-pricebook-id', book.id || '');
    setDistributorPriceBookFormValue('distributor-pricebook-distributor-id', book.distributorId || window.__selectedDistributorPricebookDistributorId || '');
    setDistributorPriceBookFormValue('distributor-pricebook-doc-id', book.docId || '');
    setDistributorPriceBookFormValue('distributor-pricebook-currency', book.currency || 'TWD');
    setDistributorPriceBookFormValue('distributor-pricebook-sale-price', book.salePrice != null ? book.salePrice : '');
    setDistributorPriceBookFormValue('distributor-pricebook-promo-price', book.promoPrice != null ? book.promoPrice : '');
    setDistributorPriceBookFormValue('distributor-pricebook-version', book.version || 'v1');
    setDistributorPriceBookFormValue('distributor-pricebook-effective-from', book.effectiveFrom ? new Date(book.effectiveFrom.seconds ? book.effectiveFrom.seconds * 1000 : book.effectiveFrom).toISOString().slice(0, 16) : '');
    setDistributorPriceBookFormValue('distributor-pricebook-effective-to', book.effectiveTo ? new Date(book.effectiveTo.seconds ? book.effectiveTo.seconds * 1000 : book.effectiveTo).toISOString().slice(0, 16) : '');
    setDistributorPriceBookFormValue('distributor-pricebook-active', book.isActive !== false);
    const state = document.getElementById('distributor-pricebook-form-state');
    if (state) {
        state.textContent = `編輯中：${book.id || book.docId || '未命名價格表'}`;
    }
};

window.populateDistributorPriceBookFormById = function(priceBookId) {
    const id = String(priceBookId || '').trim();
    if (!id) return;
    const cached = Array.isArray(window.__loadedDistributorPriceBooks)
        ? window.__loadedDistributorPriceBooks.find((book) => String(book.id || book.priceBookId || '').trim() === id)
        : null;
    if (cached) {
        window.populateDistributorPriceBookForm(cached);
    }
};

window.loadDistributorPriceBooks = async function() {
    const distributorId = getDistributorPriceBookFormValue('distributor-pricebook-distributor-id') || String(dashboardData?.myDistributorId || '').trim();
    const summary = document.getElementById('distributor-pricebook-summary');
    if (!distributorId) {
        window.__selectedDistributorPricebookDistributorId = '';
        window.__loadedDistributorPriceBooks = [];
        renderDistributorPriceBooksTable();
        if (summary) summary.textContent = '請先輸入經銷商 ID。';
        return;
    }

    if (summary) summary.textContent = `載入經銷商 ${distributorId} 的價格表中...`;
    try {
        const fn = httpsCallable(functions, 'getDistributorPriceBooks');
        const res = await fn({ distributorId });
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        window.__selectedDistributorPricebookDistributorId = distributorId;
        window.__loadedDistributorPriceBooks = items;
        renderDistributorPriceBooksTable();
        const state = document.getElementById('distributor-pricebook-form-state');
        if (state) state.textContent = `已載入 ${items.length} 筆價格表，請選擇編輯或新增。`;
    } catch (e) {
        console.error('[DistributorPricing] load failed:', e);
        window.__loadedDistributorPriceBooks = [];
        renderDistributorPriceBooksTable();
        if (summary) summary.textContent = `載入失敗：${e.message || 'unknown'}`;
        alert(`載入經銷商價格表失敗：${e.message}`);
    }
};

window.saveDistributorPriceBookFromForm = async function() {
    const distributorId = getDistributorPriceBookFormValue('distributor-pricebook-distributor-id') || String(dashboardData?.myDistributorId || '').trim();
    const priceBookId = getDistributorPriceBookFormValue('distributor-pricebook-id');
    const docId = getDistributorPriceBookFormValue('distributor-pricebook-doc-id');
    const currency = getDistributorPriceBookFormValue('distributor-pricebook-currency') || 'TWD';
    const salePrice = Number(getDistributorPriceBookFormValue('distributor-pricebook-sale-price'));
    const promoPriceRaw = getDistributorPriceBookFormValue('distributor-pricebook-promo-price');
    const promoPrice = promoPriceRaw === '' ? null : Number(promoPriceRaw);
    const version = getDistributorPriceBookFormValue('distributor-pricebook-version') || 'v1';
    const effectiveFrom = getDistributorPriceBookFormValue('distributor-pricebook-effective-from');
    const effectiveTo = getDistributorPriceBookFormValue('distributor-pricebook-effective-to');
    const isActive = !!document.getElementById('distributor-pricebook-active')?.checked;

    if (!distributorId || !docId) {
        alert('請先輸入經銷商 ID 與 Document ID。');
        return;
    }
    if (!Number.isFinite(salePrice) || salePrice < 0) {
        alert('售價必須是非負數字。');
        return;
    }
    if (promoPrice != null && (!Number.isFinite(promoPrice) || promoPrice < 0 || promoPrice > salePrice)) {
        alert('活動價必須是非負數字，且不可大於售價。');
        return;
    }

    const btn = document.querySelector('#distributor-pricebook-container button[onclick="window.saveDistributorPriceBookFromForm()"]');
    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '儲存中...';
    }

    try {
        const fn = httpsCallable(functions, 'upsertDistributorPriceBook');
        const payload = {
            distributorId,
            priceBookId,
            docId,
            currency,
            salePrice,
            ...(promoPrice != null ? { promoPrice } : {}),
            version,
            isActive,
            ...(effectiveFrom ? { effectiveFrom: new Date(effectiveFrom).toISOString() } : {}),
            ...(effectiveTo ? { effectiveTo: new Date(effectiveTo).toISOString() } : {})
        };
        const res = await fn(payload);
        if (!res?.data?.success) {
            throw new Error(res?.data?.message || '儲存失敗');
        }
        notify(`已儲存經銷商價格表：${docId}`, 'success');
        window.__selectedDistributorPricebookDistributorId = distributorId;
        await window.loadDistributorPriceBooks();
        window.populateDistributorPriceBookForm({
            id: res.data.priceBookId || priceBookId || '',
            distributorId,
            docId,
            currency,
            salePrice,
            promoPrice,
            version,
            effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : '',
            effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : '',
            isActive
        });
    } catch (e) {
        console.error('[DistributorPricing] save failed:', e);
        alert(`儲存經銷商價格表失敗：${e.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};


async function renderBusinessTab() {
    if (myRole !== 'admin' || !dashboardData) return;
    normalizeDistributorPriceBookPlacement();

    // Render Policy Admin at the top
    const revenuePolicyContainer = document.getElementById('business-revenue-policies');
    if (revenuePolicyContainer) {
        revenuePolicyContainer.innerHTML = window.buildRevenuePolicyHtml ? window.buildRevenuePolicyHtml() : '';
    }
    const adminRevenuePolicyContainer = document.getElementById('admin-revenue-policy-container');
    if (adminRevenuePolicyContainer) {
        adminRevenuePolicyContainer.classList.remove('hidden');
    }

    if (typeof window.loadRevenuePolicies === 'function') {
        window.loadRevenuePolicies();
    }

    // [NEW] System Administration & Settings rendering
    const systemSettingsContainer = document.getElementById('system-settings-container');
    if (systemSettingsContainer) {
        systemSettingsContainer.classList.remove('hidden');
        applyDashboardSystemConfigToUI({
            contentVersion: dashboardData?.contentVersion || dashboardData?.systemConfig?.contentVersion || '',
            defaultLocale: dashboardData?.systemConfig?.defaultLocale || 'en',
            defaultRegion: dashboardData?.systemConfig?.defaultRegion || 'US',
            defaultDistributorId: dashboardData?.systemConfig?.defaultDistributorId || 'default-usd',
            supportedLocales: dashboardData?.systemConfig?.supportedLocales || [],
            localeLabels: dashboardData?.systemConfig?.localeLabels || {}
        });
        loadDashboardSystemConfig();
    }

    // Show relationships settings block for admins
    const bizRelationshipsContainer = document.getElementById('business-relationships-container');
    if (bizRelationshipsContainer) {
        bizRelationshipsContainer.classList.remove('hidden');
    }
}

window.updateSystemContentVersion = async function() {
    const versionInput = document.getElementById('sys-content-version-input');
    if (!versionInput) return;
    const contentVersion = versionInput.value.trim();
    if (!contentVersion) {
        alert("請輸入有效的 Git Commit Hash！");
        return;
    }
    if (contentVersion.length < 7) {
        alert("Git Hash 長度不可小於 7 碼！");
        return;
    }

    const btn = document.getElementById('btn-save-content-version');
    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = "儲存中 (Saving)...";
    }

    try {
        const res = await updateSystemConfigCallable({ contentVersion });
        if (res.data && res.data.success) {
            alert("成功儲存並鎖定版本！快取已同步清空。");
            setDashboardLog(`已更新內容版本：${contentVersion}`);
            // Reload dashboard data to get the updated contentVersion
            await loadDashboard();
        } else {
            alert("儲存失敗，請檢查權限或輸入值是否正確！");
        }
    } catch (err) {
        console.error("updateSystemContentVersion error:", err);
        alert(`錯誤: ${err.message}`);
        setDashboardLog(`更新內容版本失敗：${err?.message || err}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};


window.searchUserRelationships = async function() {
    const searchInput = document.getElementById('sys-user-search-input');
    if (!searchInput) return;
    const searchKey = searchInput.value.trim();
    if (!searchKey) {
        alert("請輸入學員的 Google Email 或 UID！");
        return;
    }

    const btn = document.getElementById('btn-search-user-rel');
    const formBlock = document.getElementById('sys-user-rel-form');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "搜尋中...";
    }
    if (formBlock) {
        formBlock.classList.add('hidden');
    }

    try {
        const getUserRelationshipsFn = firebase.functions().httpsCallable('getUserRelationships');
        const res = await getUserRelationshipsFn({ searchKey });
        const data = res.data;

        if (data && data.uid) {
            document.getElementById('sys-rel-target-uid').value = data.uid;
            document.getElementById('sys-rel-user-name').textContent = data.name || "未提供姓名";
            document.getElementById('sys-rel-user-uid').textContent = `UID: ${data.uid}`;
            document.getElementById('sys-rel-user-role').textContent = String(data.role).toUpperCase();

            document.getElementById('sys-rel-agent-email').value = data.agentEmail || "";
            document.getElementById('sys-rel-tutor-email').value = data.tutorEmail || "";
            document.getElementById('sys-rel-coursedev-email').value = data.courseDevEmail || "";

            if (formBlock) {
                formBlock.classList.remove('hidden');
            }
        } else {
            alert("找不到對應的使用者，請確認輸入是否正確。");
        }
    } catch (err) {
        console.error("searchUserRelationships error:", err);
        alert(`搜尋失敗: ${err.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "查詢使用者";
        }
    }
};

window.saveUserRelationships = async function() {
    const targetUid = document.getElementById('sys-rel-target-uid').value;
    if (!targetUid) return;

    const agentEmail = document.getElementById('sys-rel-agent-email').value.trim();
    const tutorEmail = document.getElementById('sys-rel-tutor-email').value.trim();
    const courseDevEmail = document.getElementById('sys-rel-coursedev-email').value.trim();

    const btn = document.getElementById('btn-save-user-rel');
    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = "儲存中...";
    }

    try {
        const updateUserRelationshipsFn = firebase.functions().httpsCallable('updateUserRelationships');
        const res = await updateUserRelationshipsFn({
            targetUid,
            agentEmail,
            tutorEmail,
            courseDevEmail
        });

        if (res.data && res.data.success) {
            alert("成功儲存使用者關係設定！");
        } else {
            alert("儲存關係設定失敗。");
        }
    } catch (err) {
        console.error("saveUserRelationships error:", err);
        alert(`錯誤: ${err.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

/**
 * Checks if a user is explicitly authorized as a tutor for a specific unit.
 * Logic matches renderAdminConsole: unit-level authorizedTutors OR legacy classroom URL keys.
 */
window.isUserAuthorizedForUnit = window.isUserAuthorizedForUnit || function(fileName, courseId, email) {
    if (!email) return false;
    const { isAdmin, isPaidStudent } = currentDashboardPermissions;

    // RULE 1: Admin in Tutor Mode follows the teacher-view path for this unit.
    if (isAdmin && adminTutorMode) return true;

    // [V12.5.0] INTRO MONTH RULE: 1 month free for intro units upon registration
    const getIsFreeUnit = (fname) => {
        if (!fname) return false;
        const canonicalUnitId = resolveCanonicalUnitId(fname);
        const lesson = (allLessons || []).find(l => 
            (l.courseId === canonicalUnitId) || 
            (Array.isArray(l.courseUnits) && l.courseUnits.includes(canonicalUnitId))
        );
        if (!lesson) return false;
        const lessonId = String(lesson.courseId || lesson.courseKey || lesson.id || "").toLowerCase();
        const category = String(lesson.category || "").toLowerCase();
        const level = String(lesson.level || "").toLowerCase();
        return !!(
            lessonId.startsWith("car-starter-") ||
            category === "car-starter" ||
            category === "start" ||
            category === "started" ||
            level === "starter" ||
            level === "start" ||
            level === "started"
        );
    };
    const isFreeUnit = getIsFreeUnit(fileName);
    
    if (isFreeUnit && !isPaidStudent) {
        const registrationCandidates = [
            dashboardData?.joinedAt,
            dashboardData?.createdAt
        ];
        let regMs = 0;
        for (const value of registrationCandidates) {
            const ts = value?.toMillis
                ? value.toMillis()
                : (value?.seconds ? value.seconds * 1000 : (value ? new Date(value).getTime() : 0));
            if (Number.isFinite(ts) && ts > regMs) {
                regMs = ts;
            }
        }
        const regTime = new Date(regMs || 0);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        // If registration was less than a month ago, grant access to intro units.
        if (regTime > oneMonthAgo) return true;
        else return false; // Trial expired!
    }

    // RULE 2: If Simulation Mode or Standard User:
    const isQual = hasQualifiedTutorAccessForUnit(fileName, courseId, email);

    // RULE 3: For Paid Units, must be Qualified OR Paid (non-expired).
    return isQual || isPaidStudent;
}

async function renderSettingsTab(filterUnitId = null) {
    filterUnitId = resolveCanonicalUnitId(filterUnitId);
    console.log("[Settings] renderSettingsTab invoked with filter:", filterUnitId);
    
    const assignmentContainer = document.getElementById('assignment-setting');
    const guideContainer = document.getElementById('guide-container');
    if (!assignmentContainer || !guideContainer) {
        console.error("[Settings] Critical: Containers NOT found in DOM.");
        return;
    }

    try {
        const userEmail = auth.currentUser?.email;
        console.log("[Settings] Current User:", userEmail);
        
        if (!userEmail) {
            const msg = `<div class="text-center py-20 text-gray-400">請先登入以查看設定。</div>`;
            assignmentContainer.innerHTML = msg;
            guideContainer.innerHTML = msg;
            return;
        }

        // [MODIFIED] Wait for data if it's somehow missing but being called
        if (!dashboardData && (myRole === 'admin')) {
            console.warn("[Settings] dashboardData missing, possibly still loading...");
            return; // Exit and wait for loadDashboard to call us again
        }

        const lessonsToProcess = Array.isArray(allLessons) ? allLessons : [];
        console.log("[Settings] Processing", lessonsToProcess.length, "lessons.");

        // 1. Render Course List
        let authorizedLessons = lessonsToProcess.filter(course => {
            if (myRole === 'admin' && adminTutorMode) return true;

            const units = Array.isArray(course.courseUnits) ? course.courseUnits : [];
            const allFiles = Array.from(new Set(units)).filter(Boolean);

            return allFiles.some(f => isUserAuthorizedForUnit(f, course.courseId, userEmail));
        });

        authorizedLessons = Array.from(
            new Map(
                authorizedLessons
                    .filter(course => course && course.courseId)
                    .map(course => [course.courseId, course])
            ).values()
        );

        console.log("[Settings] Authorized lessons count:", authorizedLessons.length);

        // [NEW] If filtered to a specific course
        const urlParams = new URLSearchParams(window.location.search);
        let filterCourseId = filterUnitId ? findParentCourseIdByUnit(filterUnitId) : resolveCourseIdFromUrlParam(urlParams.get('courseId'));
        if (filterCourseId) {
            filterCourseId = findCourseId(filterCourseId);
            authorizedLessons = authorizedLessons.filter(l => l.courseId === filterCourseId);
        }

        if (authorizedLessons.length === 0) {
            console.warn("[Settings] No authorized lessons found for user.");
            const msg = `<div class="text-center py-20 text-gray-400">目前尚無獲准管理的課程（需為單元合格導師）。</div>`;
            assignmentContainer.innerHTML = msg;
            guideContainer.innerHTML = msg;
            return;
        }

        // [NEW v13.7] Collect and Deduplicate all units across all authorized courses
        const unitToDataMap = new Map();

        authorizedLessons.forEach(course => {
            const units = Array.from(new Set([
                ...(Array.isArray(course.courseUnits) ? course.courseUnits : []),
                course.entryUnitId || ''
            ].filter(Boolean)));

            const guideConfig = getCourseGuideConfig(course.courseId);
            const guideData = robustExtractGuideSegments(guideConfig.tutorGuide, guideConfig.assignmentGuide);
            const attachSegments = guideConfig.attachmentGuide || {};

            const filteredUnits = units.filter(f => {
                if (filterUnitId) {
                    return unitIdsMatch(f, filterUnitId);
                }
                return true;
            });

            const finalUnits = filterUnitId
                ? (() => {
                    const preferredUnit = getPreferredUnitId(filterUnitId, units, Object.keys(dashboardData?.unitTutorConfigs || {}));
                    return preferredUnit ? [preferredUnit] : [];
                })()
                : filteredUnits;

            finalUnits.forEach(fileName => {
                const preferredFileName = getPreferredUnitId(fileName, units, Object.keys(dashboardData?.unitTutorConfigs || {}));
                if (!isRenderableUnitFile(preferredFileName)) return;
                
                if (!unitToDataMap.has(preferredFileName)) {
                    const realUnitsOnly = units;
                    const unitIdx = realUnitsOnly.indexOf(preferredFileName);
                    const unitNum = unitIdx !== -1 ? unitIdx + 1 : null;
                    const tutorSegment = guideData.segments[preferredFileName] || (unitNum ? guideData.segments[unitNum] : "") || "";
                    const attachmentSegment = attachSegments[preferredFileName] || (unitNum ? attachSegments[unitNum] : "") || "";

                    unitToDataMap.set(preferredFileName, {
                        courseId: course.courseId,
                        courseTitle: course.title,
                        tutorSegment: tutorSegment,
                        attachmentSegment: attachmentSegment,
                        unitsForPreference: units
                    });
                }
            });
        });

        console.log("[Settings] Deduplicated unique units count:", unitToDataMap.size);

        let totalAssignmentHTML = "";
        let totalGuideHTML = "";

        const allUniqueUnits = Array.from(unitToDataMap.keys());
        
        const assignmentRows = allUniqueUnits.map(fileName => {
            const uData = unitToDataMap.get(fileName);
            const isAuthorized = isUserAuthorizedForUnit(fileName, uData.courseId, userEmail);
            return renderAssignmentConfigRow(uData.courseId, fileName, getUnitTutorConfig(fileName).tutorDetails, uData.courseTitle, isAuthorized);
        }).filter(h => !!h).join('');

        const guideRows = allUniqueUnits.map(fileName => {
            const uData = unitToDataMap.get(fileName);
            if (!uData.tutorSegment && !uData.attachmentSegment) return "";
            
            const isAuthorized = isUserAuthorizedForUnit(fileName, uData.courseId, userEmail);
            let combinedSegment = "";
            if (uData.attachmentSegment) {
                combinedSegment += `
                    <div class="mb-4 p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                         <div class="text-[10px] text-orange-500 font-bold uppercase mb-2 tracking-widest flex items-center gap-2">
                            <span class="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                            附件資料 / Attachments
                         </div>
                         <div class="text-sm text-orange-900 leading-relaxed font-medium">
                            ${uData.attachmentSegment}
                         </div>
                    </div>
                `;
            }
            combinedSegment += uData.tutorSegment;
            return renderGuideRow(uData.courseId, fileName, combinedSegment, uData.courseTitle, isAuthorized);
        }).filter(h => !!h).join('');

        if (assignmentRows) {
            totalAssignmentHTML = `
                <div class="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm font-mono text-sm mb-6 w-full">
                    <div class="divide-y divide-gray-100">${assignmentRows}</div>
                </div>`;
        }
        if (guideRows) {
            totalGuideHTML = `<div class="w-full space-y-6">${guideRows}</div>`;
        }

        assignmentContainer.innerHTML = totalAssignmentHTML || "";
        guideContainer.innerHTML = totalGuideHTML || "";
        if (guideContainer) guideContainer.classList.remove('hidden');
        await vibeRefreshReadmeContent(filterUnitId, ['settings']);

    } catch (e) {
        console.error("[Settings] Critical Render Failure:", e);
        assignmentContainer.innerHTML = `<div class="text-red-500 p-8 rounded-2xl bg-red-50 border border-red-100">
            <h4 class="font-black text-sm mb-2">載入設定時發生錯誤 (Render Failure)</h4>
            <p class="text-[10px] opacity-75">${e.message}</p>
        </div>`;
    }
}

window.renderAssignmentConfigRow = window.renderAssignmentConfigRow || function(courseId, fileName, tutorDetails = {}, courseTitle = "", isAuthorized) {
    const userEmail = auth.currentUser?.email;
    const isAdmin = myRole === 'admin' && adminTutorMode;
    
    // [V14.8.5] Even if admin, only show self in unit-settings view to maintain isolation/clutter-free UI
    let details = tutorDetails[userEmail] || {};
    
    // Fallback: If current user doesn't have a specific link yet, show an empty row for them
    if (!details.email && userEmail) {
        details = { email: userEmail };
    }

    const unitName = formatUnitName(fileName);
    const isNative = !!(details.githubOrg || details.templateRepo);

    return `
        <div class="p-6 unit-config-card" data-course-id="${courseId}" data-file-name="${fileName}">
            <div class="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div class="flex-grow">
                    <div class="text-[10px] text-blue-500 font-bold uppercase mb-1 tracking-widest flex items-center gap-2">
                       <span class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                       單元資訊 / Unit ${fileName}
                    </div>
                    <div class="text-xl font-black text-gray-800 tracking-tight leading-loose">${escapeHtml(unitName)}</div>
                </div>
                <div class="flex-grow max-w-2xl w-full">
                    ${isAuthorized ? `
                        <div class="flex flex-col gap-3 assignment-link-row">
                            <input type="hidden" class="assignment-id-input" value="${escapeHtml(details.email)}">
                            
                            <div class="flex items-center gap-3 mb-1">
                                <div class="text-[10px] text-blue-400 font-black uppercase tracking-widest">作業派發方式</div>
                                <select onchange="toggleAssignmentMethod(this)" class="assignment-method-select px-3 py-1 text-xs border border-gray-200 rounded-xl outline-none bg-gray-50/50 transition-all font-sans font-bold text-gray-700">
                                    <option value="assignment" ${!isNative ? 'selected' : ''}>作業連結</option>
                                    <option value="native" ${isNative ? 'selected' : ''}>自建原生 API</option>
                                </select>
                            </div>

                            <!-- Legacy/Generic URL Container -->
                            <div class="method-assignment-container flex gap-2 ${isNative ? 'hidden' : ''}">
                                <input type="url" placeholder="作業連結 (e.g. https://github.com/...)" value="${escapeHtml(details.assignmentUrl || details.legacyAssignmentUrl || '')}"
                                    class="assignment-url-input flex-grow px-4 py-2 text-xs border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-50/50 bg-gray-50/30 transition-all font-mono">
                                <button onclick="saveAllSettings(this)"
                                    class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-md active:scale-95 btn-save-individual">
                                    儲存 🔗
                                </button>
                            </div>

                            <!-- Native API Container -->
                            <div class="method-native-container flex flex-col gap-2.5 ${!isNative ? 'hidden' : ''}">
                                <div class="flex gap-2">
                                    <div class="flex-grow flex flex-col gap-1 w-1/2">
                                        <span class="text-[9px] text-gray-400 font-bold">GitHub 組織名稱 (GitHub Org)</span>
                                        <input type="text" placeholder="組織名稱 (e.g. vibe-coding-classroom)" value="${escapeHtml(details.githubOrg || 'vibe-coding-classroom')}" 
                                            class="assignment-org-input w-full px-3 py-2 text-xs border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-50/50 bg-gray-50/30 transition-all font-mono font-bold text-gray-700">
                                    </div>
                                    <div class="flex-grow flex flex-col gap-1 w-1/2">
                                        <span class="text-[9px] text-gray-400 font-bold">樣板倉庫名稱 (Template Repo)</span>
                                        <input type="text" placeholder="樣板名稱 (e.g. common-vscode-setup)" value="${escapeHtml(details.templateRepo || normalizeCanonicalRepoSlug(fileName))}"
                                            class="assignment-template-input w-full px-3 py-2 text-xs border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-50/50 bg-gray-50/30 transition-all font-mono font-bold text-gray-700">
                                    </div>
                                </div>
                                <div class="flex gap-2 items-end">
                                    <div class="flex-grow flex flex-col gap-1">
                                        <span class="text-[9px] text-gray-400 font-bold">GitHub Token / PAT (選填，留空使用系統 Token)</span>
                                        <input type="password" placeholder="請輸入 Token (安全儲存且已遮蔽)" value="${details.githubToken ? '••••••••••••••••' : ''}" data-raw-token="${escapeHtml(details.githubToken || '')}"
                                            class="assignment-token-input w-full px-3 py-2 text-xs border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-50/50 bg-gray-50/30 transition-all font-mono">
                                    </div>
                                    <button onclick="saveAllSettings(this)"
                                        class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-md active:scale-95 btn-save-individual h-[34px]">
                                        儲存 🔗
                                    </button>
                                </div>
                                ${(details.assignmentUrl || details.legacyAssignmentUrl) ? `
                                <div class="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-2 mt-1">
                                    <span>🔗 <b>原有作業連結：</b><a href="${escapeHtml(details.assignmentUrl || details.legacyAssignmentUrl)}" target="_blank" class="text-blue-600 hover:underline font-mono">${escapeHtml(details.assignmentUrl || details.legacyAssignmentUrl)}</a></span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : '<div class="text-xs text-gray-300 italic">🔒 無權限管理此單元連結</div>'}
                </div>
            </div>
        </div>
    `;
}

window.renderGuideRow = window.renderGuideRow || function(courseId, fileName, tutorSegment, courseTitle, isAuthorized) {
    return `
        <div class="unit-guide-row bg-white rounded-3xl border border-gray-100 p-10 shadow-sm transition-all hover:shadow-md">
            ${isAuthorized ? `
                <div class="tutor-guide-content text-gray-800 leading-relaxed">
                    ${tutorSegment}
                </div>
            ` : `
                <div class="text-[10px] text-blue-500 font-bold uppercase mb-2 tracking-widest flex items-center gap-2">
                    <span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    ${escapeHtml(courseTitle)} / ${escapeHtml(fileName)}
                </div>
                <div class="text-sm text-gray-400 italic">🔒 僅限該單元之「合格導師」閱讀完整教學指引。</div>
            `}
        </div>
    `;
}

window.toggleAssignmentMethod = function(select) {
    const card = select.closest('.unit-config-card');
    if (!card) return;
    const method = select.value;
    const assignmentContainer = card.querySelector('.method-assignment-container');
    const nativeContainer = card.querySelector('.method-native-container');
    if (method === 'native') {
        assignmentContainer.classList.add('hidden');
        nativeContainer.classList.remove('hidden');
    } else {
        assignmentContainer.classList.remove('hidden');
        nativeContainer.classList.add('hidden');
    }
};

window.saveAllSettings = async function (clickedBtn = null) {
    const btns = clickedBtn ? [clickedBtn] : document.querySelectorAll('.btn-save-individual');

    const originalTexts = new Map();
    btns.forEach(btn => {
        originalTexts.set(btn, btn.textContent);
        btn.disabled = true;
        btn.textContent = "儲存中...";
    });

    const configsByCourse = {};
    const tutorConfigsByCourse = {};

    let invalidEntry = null;

    // Collect data from DOM
    document.querySelectorAll('.unit-config-card').forEach(card => {
        const cid = card.dataset.courseId;
        const fname = card.dataset.fileName;

        if (!configsByCourse[cid]) configsByCourse[cid] = {};
        if (!tutorConfigsByCourse[cid]) tutorConfigsByCourse[cid] = {};

        const selectMethod = card.querySelector('.assignment-method-select');
        const method = selectMethod ? selectMethod.value : 'assignment';

        card.querySelectorAll('.assignment-link-row').forEach(row => {
            const tid = row.querySelector('.assignment-id-input').value.trim();
            if (!tid) return;

            if (method === 'assignment') {
                const rawUrl = row.querySelector('.assignment-url-input')?.value?.trim() || '';
                const url = normalizeAssignmentLinkUrl(rawUrl);
                    if (url) {
                        if (!isValidAssignmentLinkUrl(url)) {
                            invalidEntry = { unit: fname, tutor: tid, url };
                            return;
                        }
                        configsByCourse[cid][fname] = { [tid]: url };
                        tutorConfigsByCourse[cid][fname] = {
                            email: tid,
                            assignmentUrl: url,
                            legacyAssignmentUrl: url,
                            githubOrg: '',
                            templateRepo: '',
                            githubToken: ''
                        };
                    } else {
                        configsByCourse[cid][fname] = { [tid]: '' };
                        tutorConfigsByCourse[cid][fname] = {
                            email: tid,
                            assignmentUrl: '',
                            legacyAssignmentUrl: '',
                            githubOrg: '',
                            templateRepo: '',
                            githubToken: ''
                        };
                }
            } else {
                // native
                const org = row.querySelector('.assignment-org-input')?.value?.trim() || '';
                const template = row.querySelector('.assignment-template-input')?.value?.trim() || '';
                let tokenVal = row.querySelector('.assignment-token-input')?.value?.trim() || '';
                const rawToken = row.querySelector('.assignment-token-input')?.dataset.rawToken || '';
                
                if (tokenVal === '••••••••••••••••') {
                    tokenVal = rawToken;
                }

                tutorConfigsByCourse[cid][fname] = {
                    email: tid,
                    assignmentUrl: '',
                    legacyAssignmentUrl: '',
                    githubOrg: org,
                    templateRepo: template,
                    githubToken: tokenVal
                };
                
                configsByCourse[cid][fname] = { [tid]: '' };
            }
        });
    });

    if (invalidEntry) {
        alert(`${window.t('alert_url_format_error', 'Link format error. Please use a valid assignment link (http/https).')}\n${window.t('dash_unit_label', 'Unit')}：${invalidEntry.unit}\nTutor：${invalidEntry.tutor}`);
        btns.forEach(btn => {
            btn.disabled = false;
            btn.textContent = originalTexts.get(btn) || "儲存變更";
        });
        return;
    }

    try {
        const saveTutorConfigs = httpsCallable(functions, 'saveTutorConfigs');
        
        // Merge configs and tutorConfigs into promises
        const allCourseIds = new Set([...Object.keys(configsByCourse), ...Object.keys(tutorConfigsByCourse)]);
        const promises = [];
        
        for (const cid of allCourseIds) {
            promises.push(saveTutorConfigs({
                courseId: cid,
                configs: {
                    assignmentUrlMap: configsByCourse[cid] || {},
                    assignmentUrls: configsByCourse[cid] || {},
                    tutorConfigs: tutorConfigsByCourse[cid] || {}
                }
            }));
        }

        await Promise.all(promises);
        alert("設定儲存成功！");
        
        // Reload dashboard to reflect fresh changes
        if (typeof window.loadDashboard === 'function') {
            await window.loadDashboard();
        }
    } catch (e) {
        console.error("Save failed:", e);
        alert("儲存失敗: " + e.message);
    } finally {
        btns.forEach(btn => {
            btn.disabled = false;
            btn.textContent = originalTexts.get(btn) || "儲存變更";
        });
    }
};

// Helper to split instructor guide into parts
window.robustExtractGuideSegments = window.robustExtractGuideSegments || function(tutorInput, assignmentInput = null) {
    console.log("[Debug] robustExtractGuideSegments init.",
        "Instructor type:", typeof tutorInput,
        "Assignment type:", typeof assignmentInput);

    const result = { header: '', segments: {}, footer: '', assignmentGuides: {} };

    // 1. Process Instructor Guides (Main segments)
    if (tutorInput && typeof tutorInput === 'object' && !Array.isArray(tutorInput)) {
        Object.entries(tutorInput).forEach(([fileName, content]) => {
            if (typeof content !== 'string') return;
            // [MODIFIED] No more legacy extraction. Use raw content.
            result.segments[fileName] = content;
        });
    } else if (typeof tutorInput === 'string') {
        // [MODIFIED] Simplified fallback: treat as footer/header total if raw string
        result.footer = tutorInput;
    }

    // 2. Process Dedicated Assignment Guides
    if (assignmentInput && typeof assignmentInput === 'object' && !Array.isArray(assignmentInput)) {
        Object.entries(assignmentInput).forEach(([fileName, content]) => {
            if (typeof content !== 'string') return;
            result.assignmentGuides[fileName] = content;
            result.assignmentGuides[String(fileName || '').replace('.html', '')] = content;

            // Optional: Map numeric keys if the fileName follows a numeric pattern
            const numMatch = fileName.match(/^(?:basic-|adv-)?(\d+)-unit-/);
            if (numMatch) {
                const num = parseInt(numMatch[1]);
                result.assignmentGuides[num] = content;
            }
        });
    }

    // 3. Process Segment ID maps (Optional mapping for index fallbacks)
    Object.entries(result.segments).forEach(([fileName, content]) => {
        const numMatch = fileName.match(/^(?:basic-|adv-)?(\d+)-unit-/);
        if (numMatch) {
            const num = parseInt(numMatch[1]);
            result.segments[num] = content;
        }
    });

    return result;
}




// --- Global Function Exports : Esc Key handling ---
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // 1. Clear filters if present
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('courseId') || urlParams.get('unitId')) {
            console.log("[Esc] Redirecting to main dashboard...");
            window.location.href = 'dashboard.html';
        }
    }
});
window.handleDecideApplication = async function (applicationId, status) {
    // [MODIFIED] No more confirm dialog as per user request
    let adminMessage = "";
    if (status === 'rejected') {
        adminMessage = prompt("請輸入拒絕原因 (User 將會收到此訊息):") || "條件尚不完全相符，歡迎精進後再次嘗試。";
    }

    const msg = document.getElementById('admin-msg');
    if (msg) msg.textContent = "正在同步授權權限...";

    // Locally hide the item for instant feedback
    const appCards = document.querySelectorAll('#admin-panel .bg-white.p-4.rounded-xl');
    appCards.forEach(card => {
        if (card.outerHTML.includes(applicationId)) {
            card.style.opacity = '0.5';
            card.style.pointerEvents = 'none';
        }
    });

    try {
        const decideFunc = httpsCallable(functions, 'decideTutorApplication');
        const result = await decideFunc({ applicationId, status, adminMessage });
        
        if (result.data.success) {
            loadDashboard(); // Full refresh to update all lists
        }
    } catch (e) {
        console.error("Decision failed:", e);
        alert("處理失敗: " + e.message);
    } finally {
        if (msg) msg.textContent = "";
    }

};

// [CLEANUP] Deprecated legacy status renderers removed.

function renderTutorAlerts(data) {
    const container = document.getElementById('tutor-alerts-container');
    if (!container) return;

    if (!window.vibeShowInterventionDashboard) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    const interventions = (data.interventions || []).filter(i => i.status === 'open' || i.status === 'in_progress');
    const assignments = data.assignments || [];
    
    // Find all assignments with learningState === 'blocked'
    const blockedAssignments = assignments.filter(a => a.learningState === 'blocked');

    if (interventions.length === 0 && blockedAssignments.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    let html = `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 class="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                <span>🔔</span> 師生互動與即時卡點支援看板 (Intervention Dashboard)
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    `;

    // Render Intervention Alerts (Left Column)
    html += `
        <div class="space-y-3">
            <h4 class="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                <span>系統自動監控警示 (Auto-Interventions)</span>
            </h4>
    `;

    if (interventions.length === 0) {
        html += `<p class="text-xs text-slate-400 italic bg-white border border-slate-100 p-4 rounded-xl">${window.t('dash_no_auto_monitoring', 'No auto-monitoring alerts')}</p>`;
    } else {
        html += interventions.map(item => {
            const timeStr = item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : 'N/A';
            const assignmentId = String(item.assignmentId || '').trim().replace(/\.html$/i, '');
            return `
                <div class="bg-red-55 border border-red-100 rounded-xl p-4 flex flex-col justify-between hover:shadow transition">
                    <div>
                        <div class="flex justify-between items-start gap-2 mb-1.5">
                            <span class="text-xs font-black text-slate-800 truncate">${escapeHtml(item.studentEmail)}</span>
                            <span class="text-[9px] text-slate-400 font-medium whitespace-nowrap">${timeStr}</span>
                        </div>
                        <div class="text-[10px] text-slate-500 capitalize mb-2">
                            ${window.t('dash_unit_label', 'Unit')}：${escapeHtml(window.formatUnitIdForUI(item.unitId))}
                        </div>
                        <div class="text-xs text-red-700 bg-white/70 p-2.5 rounded-lg border border-red-50/50 mb-3">
                            <strong>${window.t('dash_block_reason_label', 'Reason')}：</strong> ${escapeHtml(item.triggerReason || window.t('dash_block_reason_default', 'Below threshold'))}
                        </div>
                    </div>
                    <div class="flex justify-end">
                        <button ${assignmentId ? `onclick='window.autoGradeAssignment("${escapeHtml(assignmentId)}")'` : 'disabled aria-disabled="true" title="Missing student or assignment id"'} 
                            class="px-4 py-1.5 ${assignmentId ? 'bg-red-600 hover:bg-red-700 active:scale-95' : 'bg-slate-300 cursor-not-allowed'} text-white rounded-lg font-bold text-xs shadow transition">
                            🧑‍💻 ${assignmentId ? '開始引導' : '資料缺失'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    html += `</div>`; // End of Left Column

    // Render Student Blockers (Right Column)
    html += `
        <div class="space-y-3">
            <h4 class="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                <span>${window.t('dash_student_blockers_title', 'Student Blockers')}</span>
            </h4>
    `;

    if (blockedAssignments.length === 0) {
        html += `<p class="text-xs text-slate-400 italic bg-white border border-slate-100 p-4 rounded-xl">${window.t('dash_no_student_blockers', 'No student blocker reports yet')}</p>`;
    } else {
        html += blockedAssignments.map(a => {
            const timeStr = a.updatedAt ? new Date(a.updatedAt.seconds ? a.updatedAt.seconds * 1000 : a.updatedAt).toLocaleString() : 'N/A';
            const blockerTypeMap = { concept: '觀念不懂', debug: '程式 Bug', environment: '環境問題' };
            const typeLabel = blockerTypeMap[a.latestBlocker?.type] || '一般卡點';
            return `
                <div class="bg-amber-55 border border-amber-100 rounded-xl p-4 flex flex-col justify-between hover:shadow transition">
                    <div>
                        <div class="flex justify-between items-start gap-2 mb-1.5">
                            <span class="text-xs font-black text-slate-800 truncate">${escapeHtml(a.studentEmail || a.userEmail)}</span>
                            <span class="text-[9px] text-slate-400 font-medium whitespace-nowrap">${timeStr}</span>
                        </div>
                        <div class="text-[10px] text-slate-500 capitalize mb-1">
                            ${window.t('dash_unit_label', 'Unit')}：${escapeHtml(window.formatUnitIdForUI(a.unitId))}
                        </div>
                        <div class="mb-2"><span class="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 border border-amber-300 text-amber-800">${typeLabel}</span></div>
                        <div class="text-xs text-slate-700 bg-white/70 p-2.5 rounded-lg border border-amber-50/50 mb-3 whitespace-pre-wrap truncate max-h-[80px]">
                            ${escapeHtml(a.latestBlocker?.note || '無詳細說明')}
                        </div>
                    </div>
                    <div class="flex justify-end">
                        <button onclick="window.autoGradeAssignment('${a.id}')"
                            class="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs shadow transition active:scale-95">
                            💡 自動批改
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    html += `</div>`; // End of Right Column

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
}
