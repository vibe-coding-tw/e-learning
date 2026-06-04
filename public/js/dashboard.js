console.log("Dashboard Script v2026.05.15.V23.INVITE_BINDING_TOOL Loaded");
// alert("Dashboard Script v6 Loaded"); // Uncomment if needed for hard debugging

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
import { getFirestore, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { firebaseConfig, connectFirebaseEmulators } from "./firebase-local.js?v=3";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'asia-east1');
connectFirebaseEmulators({ auth, db, functions });
const vibeFetchLessons = httpsCallable(functions, 'getLessonsMetadata');
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

function normalizeAssignmentInviteUrl(raw = '') {
    return normalizeAssignmentLinkUrl(raw);
}

function isValidAssignmentInviteUrl(url = '') {
    return isValidAssignmentLinkUrl(url);
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
    value = value.replace(/^(導師指南|Tutor Guide)\s*[-：:|｜]\s*[a-z0-9-]+\s*/i, '$1：');
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
    canViewUnitSettings: false,
    canViewEarnings: false
};

async function loadMarkdownFromRepoWithFallback(org, candidateSlugs) {
    const candidates = [...new Set((Array.isArray(candidateSlugs) ? candidateSlugs : [candidateSlugs]).filter(Boolean))];
    for (const repo of candidates) {
        const readmeUrl = `https://raw.githubusercontent.com/${org}/${repo}/main/README.md`;
        try {
            const markdown = await loadMarkdown(readmeUrl);
            if (markdown && !markdown.includes('無法讀取')) {
                return { markdown, repo, readmeUrl };
            }
        } catch (err) {
            console.warn('[Dashboard] README fetch failed for repo:', repo, err);
        }
    }
    return { markdown: '', repo: '', readmeUrl: '' };
}

// [NEW] Admin Super Mode state
// [NEW] Admin Tutor Mode state (formerly Super Mode)
let adminTutorMode = localStorage.getItem('adminTutorMode') === 'true'; 
window.vibeShowInterventionDashboard = window.vibeShowInterventionDashboard ?? false;
try {
    const initialParams = new URLSearchParams(window.location.search);
    const forceTutorMode = initialParams.get('tutorMode');
    if (forceTutorMode === '1' || forceTutorMode === 'true') {
        adminTutorMode = true;
        localStorage.setItem('adminTutorMode', 'true');
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
        if (userDisplay) userDisplay.textContent = `您好, ${user.displayName || '使用者'}`;
        await loadLessons();
        loadDashboard();
    } else {
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
        const getDashboardData = httpsCallable(functions, 'getDashboardData');
        const response = await getDashboardData({ 
            unitId: filterUnitId, 
            courseId: filterCourseId,
            tutorMode: adminTutorMode // [V13.0.8] Pass simulation flag to backend
        });
        const data = response.data;

        // [FIX] Aggregate data (map filename IDs to real Course IDs)
        aggregateData(data);
        dashboardData = data;

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

        myRole = data.role;
        const isAdmin = myRole === 'admin';
        const hasPaidAnything = (data.students?.[0]?.orders?.length > 0 || data.students?.[0]?.accountStatus === 'paid');
        
        // Final Rule enforcement: Global dashboard (no unitId) is admin-only.
        if (!hasUnitContext && !isAdmin) {
            console.warn("[Security] Non-Admin global access denied.");
            showAccessDenied("ADMIN_ONLY_NO_UNIT");
            return;
        }

        const isQualifiedTutor = hasQualifiedTutorAccessForUnit(filterUnitId, filterCourseId, myEmail);

        const isPaidStudent = hasUnitContext
            ? await hasPaidStudentAccessForUnit(filterCourseId, filterUnitId)
            : hasPaidAnything;
            
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
            setupGradingFunctions();
            setupSettingsFeature();
            renderAdminDashboard(data, filterUnitId);

            if (preferredTab) {
                switchTab(preferredTab);
            } else {
                const activeTab = document.querySelector('.tab-btn.text-blue-600');
                if (activeTab) {
                    const tabId = activeTab.id.replace('tab-btn-', '');
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
        // Find by assigned tutor email
        q = query(assignmentsCol, where("assignedTutorEmail", "==", myEmail));
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
            const activeTab = activeTabBtn ? activeTabBtn.id.replace('tab-btn-', '') : 'overview';
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
        canViewUnitSettings,
        canViewEarnings: isGlobalAdmin
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

function canCurrentUserViewEarningsTab() {
    return !!currentDashboardPermissions.canViewEarnings;
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
    const allowedTabs = new Set(['overview', 'assignments', 'settings', 'earnings', 'tutors', 'shipments']);
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

async function fetchGuideSectionFromUnitPage(filterUnitId, sectionId) {
    if (!filterUnitId || !sectionId) return "";
    const extractSection = (html, targetSectionId) => {
        const m = html.match(new RegExp(`<section\\b[^>]*id=["']${targetSectionId}["'][^>]*>([\\s\\S]*?)<\\/section>`, 'i'));
        return m && m[1] ? m[1].trim() : '';
    };
    try {
        const parentCourseId = findParentCourseIdByUnit(filterUnitId);
        const courseId = parentCourseId || filterUnitId;
        
        let pageName = filterUnitId;
        if (!pageName.endsWith('.html')) {
            pageName += '.html';
        }
        
        const isTutor = (sectionId === 'tutor-guide');
        const checkAuthFunction = httpsCallable(functions, 'checkPaymentAuthorization');
        const response = await checkAuthFunction({
            pageId: courseId,
            fileName: pageName,
            tutorMode: isTutor
        });
        
        const token = response?.data?.token || response?.data?.result?.token;
        if (!token) {
            console.warn(`[GuideRefresh] No serve token returned for ${pageName}. Response:`, response);
            return "";
        }
        
        const unitUrl = `${window.location.origin}/courses/${pageName}?token=${encodeURIComponent(token)}`;
        const resp = await fetch(unitUrl, { cache: 'no-store' });
        if (!resp.ok) {
            console.warn(`[GuideRefresh] serve fetch failed: ${resp.status} ${resp.statusText} for URL: ${unitUrl}`);
            return "";
        }
        const html = await resp.text();
        return extractSection(html, sectionId);
    } catch (e) {
        console.warn(`[GuideRefresh] direct unit html fetch failed for #${sectionId}:`, e);
        return "";
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
    if (!courseId || !unitId || !auth.currentUser) return false;

    try {
        const checkAuthFunction = httpsCallable(functions, 'checkPaymentAuthorization');
        const response = await checkAuthFunction({
            pageId: courseId,
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
    const earningsTabBtn = document.getElementById('tab-btn-earnings');
    const adminTabBtn = document.getElementById('tab-btn-tutors');

    if (overviewTabBtn) overviewTabBtn.classList.add('hidden');
    if (assignmentsTabBtn) assignmentsTabBtn.classList.toggle('hidden', !canCurrentUserViewAssignmentsTab());
    if (settingsTabBtn) settingsTabBtn.classList.add('hidden');
    if (earningsTabBtn) earningsTabBtn.classList.add('hidden');
    if (adminTabBtn) adminTabBtn.classList.add('hidden');
}

function filterAssignmentsForCurrentView(assignments = []) {
    const isOwnAssignment = (assignment) =>
        (assignment.userId || assignment.uid) === myUid ||
        normalizeEmail(assignment.studentEmail || assignment.userEmail) === normalizeEmail(myEmail);

    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));

    const isStudentAssignedToMe = (assignment) => {
        const studentUid = assignment.userId || assignment.uid;
        if (!studentUid) return false;
        
        const students = window.dashboardData?.students || [];
        const student = students.find(s => s.uid === studentUid || s.id === studentUid);
        if (!student) return false;
        
        if (filterUnitId) {
            const assignedTutors = student.unitAssignments || {};
            const isMatch = Object.entries(assignedTutors).some(([uid, tutorEmail]) => {
                return unitIdsMatch(uid, filterUnitId) && normalizeEmail(tutorEmail) === normalizeEmail(myEmail);
            });
            if (isMatch) return true;
        } else {
            const hasAnyAssignmentToMe = Object.values(student.unitAssignments || {}).some(tutorEmail => {
                return normalizeEmail(tutorEmail) === normalizeEmail(myEmail);
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
                                    <div class="font-bold text-gray-800 mb-0.5">${escapeHtml(a.assignmentTitle || a.title || "未指定任務")}</div>
                                    <div class="text-[10px] text-gray-400 capitalize">${escapeHtml(window.formatUnitIdForUI(a.unitId))}</div>
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
    const earningsTabBtn = document.getElementById('tab-btn-earnings');

    if (assignmentsTabBtn) {
        const canViewAssignments = canCurrentUserViewAssignmentsTab();
        assignmentsTabBtn.classList.toggle('hidden', !canViewAssignments);
        assignmentsTabBtn.textContent = '作業 (Assignments)';
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
    const showEarningsTab = canCurrentUserViewEarningsTab();

    if (settingsTabBtn) {
        settingsTabBtn.classList.toggle('hidden', !showSettingsTab);
        settingsTabBtn.textContent = window.t('dash_tab_settings', '系統設定');
    }

    if (earningsTabBtn) {
        earningsTabBtn.classList.toggle('hidden', !showEarningsTab);
        if (!showEarningsTab) {
            earningsTabBtn.style.display = 'none';
        } else {
            earningsTabBtn.style.display = '';
        }
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

        // 2. Definition of "Prepare" units (準備課程) - dynamically derived
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
                if (lessonObj.lessonLabel && lessonObj.title) {
                    courseTitle = `${lessonObj.lessonLabel}：${lessonObj.title}`;
                } else {
                    courseTitle = lessonObj.title || canonicalCid;
                }
            }
            const cleanTitle = courseTitle.replace('course-', '').replace('unit-', '');
            
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
                if (isLikelyAssignmentLink(finalUrl) && !isValidAssignmentInviteUrl(normalizeAssignmentInviteUrl(finalUrl))) {
                    alert("此單元設定的作業連結格式不正確，請到課程設定修正。");
                    return;
                }
                window.open(finalUrl, '_blank');
                return;
            }
        }

        alert("此單元尚未設定作業連結，請管理員/老師至「課程設定」中設定。");
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
                alert("此單元尚未完成老師指派，作業入口會在老師指派完成後開放。");
                return;
            }

            const assignmentUrl = access.classroomUrl;
            if (assignmentUrl) {
                if (isLikelyAssignmentLink(assignmentUrl) && !isValidAssignmentInviteUrl(normalizeAssignmentInviteUrl(assignmentUrl))) {
                    alert("此單元設定的作業連結格式不正確，請通知管理員/老師修正。");
                    return;
                }
                window.open(assignmentUrl, '_blank');
                return;
            }

            alert("此單元尚未設定作業連結，請管理員/老師至「課程設定」中設定。");
        } catch (error) {
            console.error('[Dashboard] Failed to resolve assignment link:', error);
            alert("暫時無法取得作業入口，請稍後再試。");
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
        const emptyMsg = `<tr><td colspan="${showActionCol ? 6 : 5}" class="text-center py-8 text-gray-400">尚無作業繳交紀錄</td></tr>`;
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
            rowOnClick = `window.openGradingModal('${a.id}')`;
        } else {
            // clickAction === 'url'
            rowOnClick = a.assignmentUrl ? `window.open('${a.assignmentUrl}', '_blank')` : "notify('此作業無連結', 'warning')";
        }
        
        return `
        <tr class="lg:hover:bg-blue-50/50 transition border-b border-gray-100 cursor-pointer group text-xs md:text-sm" 
            onclick="${rowOnClick}">
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-gray-800">
                <div class="font-medium group-hover:text-blue-600 transition-colors truncate max-w-[150px] md:max-w-none">${escapeHtml(a.studentEmail || a.userEmail)}</div>
            </td>
            <td class="py-2 px-1 sm:py-3 sm:px-2">
                <div class="text-[10px] text-gray-400 capitalize mb-0.5">
                    ${escapeHtml(window.formatUnitIdForUI(a.unitId))}
                </div>
                <div class="font-bold text-gray-800 text-xs md:text-sm">
                    ${escapeHtml(a.title || a.assignmentTitle || unitsTitleMap[resolveCanonicalUnitId(a.unitId)] || "未指定任務")}
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
            ? '正在讀取導師指南 (tutor-guide)...'
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

    placeholder.classList.remove('hidden');
    placeholder.innerHTML = `<div class="flex items-center gap-3 text-slate-400 italic"><span class="animate-pulse">⏳</span> 正在讀取作業指南 (assignment-guide)...</div>`;
    const extracted = await fetchGuideSectionFromUnitPage(filterUnitId, 'assignment-guide');
    if (extracted) {
        placeholder.innerHTML = extracted;
        normalizeGuideHeadingStyles(placeholder);
    } else {
        placeholder.innerHTML = `<div class="text-red-500 text-sm">⚠️ 無法載入 assignment-guide</div>`;
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

// --- Tab Logic ---
window.switchTab = function (tabName) {
    if (!tabName) return;
    
    // [V14.12] PERMISSION LEAK FIX: Explicitly block admin-only tabs for non-admins
    if ((tabName === 'tutors' || tabName === 'admin' || tabName === 'shipments' || tabName === 'logistics' || tabName === 'settings' || tabName === 'earnings') && myRole !== 'admin') {
        console.warn(`[Security] Unauthorized tab access: ${tabName} blocked for ${myRole}.`);
        // Fallback: Redirect to assignments for tutors or overview for admins.
        tabName = getPreferredDashboardTab(getCurrentDashboardContext().filterUnitId);
        if (tabName === 'tutors' || tabName === 'admin' || tabName === 'shipments' || tabName === 'logistics' || tabName === 'settings' || tabName === 'earnings') {
            tabName = 'assignments'; // Extreme safety fallback
        }
    }
    if (tabName === 'admin') tabName = 'tutors'; // backward compatibility
    if (tabName === 'logistics') tabName = 'shipments'; // backward compatibility

    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));
    const isUnitContext = !!filterUnitId;

    // Unit context hard rule: only assignments are visible tabs.
    if (isUnitContext && (tabName === 'overview' || tabName === 'tutors' || tabName === 'admin' || tabName === 'shipments' || tabName === 'logistics' || tabName === 'earnings' || tabName === 'settings')) {
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
    if (tabName === 'earnings') {
        if (!canCurrentUserViewEarningsTab()) {
            tabName = getPreferredDashboardTab(filterUnitId);
            if (tabName === 'earnings' && !canCurrentUserViewEarningsTab()) {
                return;
            }
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
    if (tabName === 'earnings') {
        renderEarningsTab(dashboardData);
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
        
        if (filterUnitId && !isTutor) {
            renderAssignmentsGuideMain(filterUnitId);
        } else {
            const placeholder = document.getElementById('github-readme-placeholder-main');
            if (placeholder) placeholder.classList.add('hidden');
        }

        // Update Title for Student vs Tutor
        const headerEl = document.querySelector('#assignments-header h3');
        if (headerEl) {
            headerEl.textContent = isStudent ? '我的作業 (My Assignments)' : '作業批改 (Assignments)';
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
    
    const container = document.getElementById('shipments-table-body');
    if (!container) return;

    const orders = dashboardData.hardwareOrders || [];
    
    if (orders.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="py-10 text-center text-gray-400 italic">尚無硬體產品訂單紀錄</td></tr>';
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
    localStorage.setItem('adminTutorMode', enabled);
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

function resolveUnitGuideExternalUrl(guideType = 'assignment') {
    const { filterUnitId } = getCurrentDashboardContext();
    const unitId = (filterUnitId || "").trim();
    if (!unitId) return "";
    const hash = guideType === 'tutor' ? 'tutor-guide' : 'assignment-guide';
    const origin = (window.location && window.location.origin) ? window.location.origin : 'https://vibe-coding.tw';
    return `${origin}/${unitId}#${hash}`;
}

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

// --- Grading Logic ---
window.setupGradingFunctions = window.setupGradingFunctions || function() {
    // Manual grading removed; keep a safe no-op for legacy calls.
    return;
    const modal = document.getElementById('grading-modal');
    if (!modal) return; // Guard if modal not found

    const idInput = document.getElementById('grade-assignment-id');
    const scoreInput = document.getElementById('grade-score');
    const feedbackInput = document.getElementById('grade-feedback');
    const submitBtn = document.getElementById('btn-submit-grade');
    const historyContainer = document.getElementById('assignment-history');
    const recommendationBox = document.getElementById('tutor-recommendation-box');
    const recommendationDesc = document.getElementById('tutor-recommendation-desc');
    const recommendationStatus = document.getElementById('tutor-recommendation-status');
    const recommendationBtn = document.getElementById('btn-submit-recommendation');

    function setTutorRecommendationState({
        visible,
        message = '',
        messageClass = 'text-orange-700',
        buttonLabel = '推薦此學生',
        buttonDisabled = false
    }) {
        if (!recommendationBox || !recommendationStatus || !recommendationBtn) return;

        recommendationBox.classList.toggle('hidden', !visible);
        recommendationStatus.className = `mt-3 text-xs font-bold ${messageClass}`;
        recommendationStatus.textContent = message;
        recommendationBtn.textContent = buttonLabel;
        recommendationBtn.disabled = buttonDisabled;
        recommendationBtn.classList.toggle('opacity-50', buttonDisabled);
        recommendationBtn.classList.toggle('cursor-not-allowed', buttonDisabled);
    }

    function refreshTutorRecommendationUI(assignment) {
        if (!recommendationBox || !recommendationDesc) return;

        if (!assignment) {
            setTutorRecommendationState({ visible: false });
            return;
        }

        const canonicalUnitId = resolveCanonicalUnitId(assignment.unitId);
        const unitConfig = getUnitTutorConfig(canonicalUnitId);
        const authorizedTutors = Array.isArray(unitConfig.authorizedTutors) ? unitConfig.authorizedTutors : [];
        const pendingApps = dashboardData?.pendingApplications || [];
        const studentEmail = assignment.studentEmail || assignment.userEmail || '';
        const hasPendingRecommendation = pendingApps.some(app =>
            app.status === 'pending' &&
            unitIdsMatch(app.unitId, canonicalUnitId) &&
            (app.userEmail === studentEmail || app.userId === assignment.userId)
        );

        recommendationDesc.textContent = `若 ${studentEmail || '該學生'} 在此單元表現成熟，可由授課老師直接送出推薦，交由管理員審核。`;

        if (authorizedTutors.includes(studentEmail)) {
            setTutorRecommendationState({
                visible: true,
                message: '此學生已是本單元合格導師。',
                messageClass: 'text-green-700',
                buttonLabel: '已具資格',
                buttonDisabled: true
            });
            return;
        }

        if (hasPendingRecommendation) {
            setTutorRecommendationState({
                visible: true,
                message: '此學生已有待審推薦，等待管理員審核中。',
                messageClass: 'text-orange-700',
                buttonLabel: '審核中',
                buttonDisabled: true
            });
            return;
        }

        setTutorRecommendationState({
            visible: true,
            message: '推薦送出後，合格教師分頁會出現待審申請卡片。',
            messageClass: 'text-orange-700',
            buttonLabel: '推薦此學生',
            buttonDisabled: false
        });
    }

    window.openGradingModal = function (id) {
        console.log(`[Grading] Opening modal for ID: ${id}`);
        const modal = document.getElementById('grading-modal');
        const idInput = document.getElementById('grade-assignment-id');
        const scoreInput = document.getElementById('grade-score');
        const feedbackInput = document.getElementById('grade-feedback');
        const titleEl = document.getElementById('grading-assignment-title');
        const historyContainer = document.getElementById('assignment-history');

        if (!modal || !idInput || !scoreInput || !feedbackInput) {
            console.error("[Grading] One or more grading modal elements are missing!");
            alert("系統錯誤：找不到評分視窗元素，請重新整理頁面。");
            return;
        }

        if (!dashboardData || !dashboardData.assignments) {
            console.error("[Grading] dashboardData.assignments is missing!");
            return;
        }
        const assignment = dashboardData.assignments.find(a => a.id === id);
        if (!assignment) {
            console.error(`[Grading] Assignment NOT FOUND for ID: ${id}. Candidates:`, dashboardData.assignments.map(a => a.id));
            alert("找不到該作業資料，請重新整理頁面。");
            return;
        }
        currentGradingAssignment = assignment;

        if (titleEl) titleEl.innerText = assignment.assignmentTitle || assignment.title || "評分作業";

        idInput.value = id;
        scoreInput.value = assignment.grade || '';
        feedbackInput.value = assignment.tutorFeedback || '';

        // Render History
        const historyMap = (assignment.submissionHistory || []).map(h => {
            let safeTime = 'Unknown';
            if (h.timestamp && h.timestamp._seconds) {
                safeTime = new Date(h.timestamp._seconds * 1000).toLocaleString();
            } else if (h.timestamp) {
                safeTime = new Date(h.timestamp).toLocaleString();
            }

            return `
        <div class="mb-2 pb-2 border-b border-gray-200 last:border-0" >
                    <div class="flex justify-between text-xs text-gray-500">
                        <span>${safeTime}</span>
                        <span class="font-bold text-blue-600">${h.action || 'SUBMIT'}</span>
                    </div>
                    <div class="mt-1 text-gray-800 break-all whitespace-pre-wrap">${escapeHtml(h.content || h.url)}</div>
                    ${h.note ? `<div class="text-xs text-gray-400 italic">Note: ${escapeHtml(h.note)}</div>` : ''}
                    ${h.grader ? `<div class="text-xs text-orange-600 mt-1">Graded by Tutor</div>` : ''}
                </div>
        `;
        }).join('');

        historyContainer.innerHTML = historyMap || '<p class="text-gray-400 text-center">No history</p>';

        // Populate Blocker info
        const blockerBox = document.getElementById('student-blocker-info-box');
        const blockerBadge = document.getElementById('student-blocker-type-badge');
        const blockerText = document.getElementById('student-blocker-note-text');
        if (blockerBox && blockerBadge && blockerText) {
            const hasBlocker = assignment.learningState === 'blocked' || assignment.learningState === 'coaching';
            if (hasBlocker && assignment.latestBlocker) {
                const typeMap = { concept: '觀念不懂', debug: '程式 Bug', environment: '環境問題' };
                blockerBadge.innerText = typeMap[assignment.latestBlocker.type] || '一般卡點';
                blockerText.innerText = assignment.latestBlocker.note || '無說明';
                blockerBox.classList.remove('hidden');
                
                // Pre-fill blocker type helper dropdown
                const coachBlockerType = document.getElementById('coach-blocker-type');
                if (coachBlockerType && assignment.latestBlocker.type) {
                    coachBlockerType.value = assignment.latestBlocker.type;
                }
            } else {
                blockerBox.classList.add('hidden');
            }
        }

        // Populate Attempt info
        const attemptBox = document.getElementById('student-attempt-info-box');
        const attemptText = document.getElementById('student-attempt-text');
        if (attemptBox && attemptText) {
            if (assignment.attemptSummary) {
                attemptText.innerText = assignment.attemptSummary;
                attemptBox.classList.remove('hidden');
            } else {
                attemptBox.classList.add('hidden');
            }
        }

        // Populate Coaching Form Inputs
        const coachHintLevel = document.getElementById('coach-hint-level');
        const coachNextAction = document.getElementById('coach-next-action');
        const coachAdviceNote = document.getElementById('coach-advice-note');
        if (coachHintLevel) coachHintLevel.value = assignment.hintLevelUsed !== undefined && assignment.hintLevelUsed !== null ? assignment.hintLevelUsed : '1';
        if (coachNextAction) coachNextAction.value = assignment.nextAction || '';
        if (coachAdviceNote) coachAdviceNote.value = assignment.tutorFeedback || '';

        refreshTutorRecommendationUI(assignment);

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.classList.add('modal-open');

        // Fallback programmatic hide
        const nav = document.getElementById('main-nav') || document.querySelector('nav');
        if (nav) nav.style.setProperty('display', 'none', 'important');
    }

    window.closeGradingModal = function () {
        currentGradingAssignment = null;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.classList.remove('modal-open');

        // Restore navbar
        const nav = document.getElementById('main-nav') || document.querySelector('nav');
        if (nav) nav.style.display = '';
    }

    window.submitGrade = async function () {
        const idInput = document.getElementById('grade-assignment-id');
        const scoreInput = document.getElementById('grade-score');
        const feedbackInput = document.getElementById('grade-feedback');
        const submitBtn = document.getElementById('btn-submit-grade');

        if (!idInput || !scoreInput || !feedbackInput || !submitBtn) {
            alert('系統錯誤：找不到評分表單元素');
            return;
        }

        const id = idInput.value;
        const score = scoreInput.value;
        const feedback = feedbackInput.value;

        if (!score) {
            alert('請輸入分數');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '送出中...';

        try {
            const gradeAssignment = httpsCallable(functions, 'gradeAssignment');
            await gradeAssignment({ assignmentId: id, grade: score, feedback: feedback });
            alert('評分成功！');
            closeGradingModal();
            loadDashboard(); // Refresh list
        } catch (e) {
            console.error(e);
            alert('評分失敗：' + e.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '送出評分';
        }
    };

    window.submitTutorCoachingLogAction = async function () {
        const idInput = document.getElementById('grade-assignment-id');
        const hintLevel = document.getElementById('coach-hint-level').value;
        const blockerType = document.getElementById('coach-blocker-type').value;
        const nextAction = document.getElementById('coach-next-action').value;
        const advice = document.getElementById('coach-advice-note').value;
        const submitBtn = document.getElementById('btn-submit-coaching');

        if (!idInput || !submitBtn) {
            alert('系統錯誤：找不到評分表單元素');
            return;
        }

        const id = idInput.value;
        if (!advice) {
            alert('請輸入指導回饋指引！');
            return;
        }
        if (!nextAction) {
            alert('請指派下一步目標！');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '送出中...';

        try {
            const submitCoachingLog = httpsCallable(functions, 'submitTutorCoachingLog');
            await submitCoachingLog({
                assignmentId: id,
                blockerType: blockerType,
                hintLevel: parseInt(hintLevel),
                tutorFeedback: advice,
                nextAction: nextAction
            });
            alert('指導紀錄提交成功！');
            closeGradingModal();
            loadDashboard(); // Refresh list
        } catch (e) {
            console.error(e);
            alert('提交指導紀錄失敗：' + e.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '送出指導紀錄 (切換為引導中)';
        }
    };

    window.submitTutorRecommendation = async function () {
        if (!currentGradingAssignment || !recommendationBtn) return;

        recommendationBtn.disabled = true;
        recommendationBtn.textContent = '送出推薦中...';
        if (recommendationStatus) {
            recommendationStatus.className = 'mt-3 text-xs font-bold text-orange-700';
            recommendationStatus.textContent = '正在送出推薦...';
        }

        try {
            const recommendTutorForUnit = httpsCallable(functions, 'recommendTutorForUnit');
            const result = await recommendTutorForUnit({ assignmentId: currentGradingAssignment.id });

            setTutorRecommendationState({
                visible: true,
                message: '已送出推薦通知，待學生先填寫作業連結後才會送審給管理員。',
                messageClass: 'text-green-700',
                buttonLabel: '已送出推薦',
                buttonDisabled: true
            });

            dashboardData.pendingApplications = dashboardData.pendingApplications || [];
            dashboardData.pendingApplications.unshift({
                id: result?.data?.applicationId || `pending-${currentGradingAssignment.id}`,
                userId: currentGradingAssignment.userId,
                userEmail: currentGradingAssignment.studentEmail || currentGradingAssignment.userEmail,
                unitId: resolveCanonicalUnitId(currentGradingAssignment.unitId),
                status: 'awaiting_candidate_link'
            });
        } catch (e) {
            console.error('Tutor recommendation failed:', e);
            const msg = e?.message || '';

            if (msg.includes('already a qualified tutor')) {
                setTutorRecommendationState({
                    visible: true,
                    message: '此學生已是本單元合格導師。',
                    messageClass: 'text-green-700',
                    buttonLabel: '已具資格',
                    buttonDisabled: true
                });
            } else if (msg.includes('waiting for assignment link')) {
                setTutorRecommendationState({
                    visible: true,
                    message: '此學生已收到推薦，等待他先提交作業連結。',
                    messageClass: 'text-orange-700',
                    buttonLabel: '等待學生提交連結',
                    buttonDisabled: true
                });
            } else if (msg.includes('pending application')) {
                setTutorRecommendationState({
                    visible: true,
                    message: '此學生已有待審推薦，等待管理員審核中。',
                    messageClass: 'text-orange-700',
                    buttonLabel: '審核中',
                    buttonDisabled: true
                });
            } else {
                setTutorRecommendationState({
                    visible: true,
                    message: `推薦失敗：${msg}`,
                    messageClass: 'text-red-600',
                    buttonLabel: '重新推薦',
                    buttonDisabled: false
                });
            }
        }
    };
}

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
    let name = fileName.replace('.html', '');

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
    if (lesson.price != null || lesson.price_twd != null || lesson.price_usd != null) return true;
    if (lesson.pricing || lesson.prices || lesson.priceByLocale || lesson.priceByRegion || lesson.priceMap) return true;
    return false;
}

function getLessonBusinessPrice(lesson = {}, locale = 'zh-TW') {
    if (window.vibePricing?.resolveLessonPrice) {
        return window.vibePricing.resolveLessonPrice(lesson, locale);
    }
    const normalizedLocale = String(locale || '').startsWith('en') ? 'en' : 'zh-TW';
    const amount = normalizedLocale === 'en'
        ? Number(lesson.price_usd ?? lesson.price ?? 0)
        : Number(lesson.price_twd ?? lesson.price ?? 0);
    return {
        amount: Number.isFinite(amount) ? amount : 0,
        currency: normalizedLocale === 'en' ? 'USD' : 'TWD'
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
        if (filter === 'courses') return lesson.isPhysical !== true;
        if (filter === 'physical') return lesson.isPhysical === true;
        return true;
    });

    const pricedCount = pricedLessons.length;
    const activePolicies = Array.isArray(window.__loadedRevenuePolicies)
        ? window.__loadedRevenuePolicies.filter(p => p && p.enabled !== false).length
        : 0;

    const rows = filteredLessons.map((lesson) => {
        const courseId = String(lesson.courseId || lesson.id || '').trim();
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
        const priceSource = lesson.pricingVersion || lesson.pricingSource || (lesson.price_usd != null && lesson.price_twd != null ? 'multi-region' : 'legacy');
        const updatedAt = lesson.pricingUpdatedAt?.seconds
            ? new Date(lesson.pricingUpdatedAt.seconds * 1000).toLocaleString()
            : (lesson.pricingUpdatedAt ? new Date(lesson.pricingUpdatedAt).toLocaleString() : '—');

        const isMultiRegion = priceSource === 'multi-region';
        const isPhysical = lesson.isPhysical === true;
        
        // Multi-region or legacy badge
        const badgeClass = isMultiRegion 
            ? 'bg-blue-50 text-blue-700 border border-blue-100' 
            : 'bg-amber-50 text-amber-700 border border-amber-100';
        const badgeLabel = isMultiRegion ? '🌐 多語系定價' : '📝 舊版單一定價';

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
                    <p class="text-xs text-slate-500 mt-1">資料直接寫入 Firestore 的 <code class="px-1 py-0.5 rounded bg-slate-100 text-slate-700">metadata_lessons</code>，英文頁顯示 USD、中文頁顯示 TWD。</p>
                </div>
                <div class="text-xs text-slate-400 font-medium">可維護欄位：<code class="px-1 py-0.5 rounded bg-slate-100 text-slate-700">pricing</code> / <code class="px-1 py-0.5 rounded bg-slate-100 text-slate-700">priceByLocale</code></div>
            </div>
            
            <div class="px-6 py-4 border-b border-slate-100 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-slate-50/30">
                <div class="flex flex-wrap items-center gap-3 flex-grow max-w-2xl">
                    <div class="relative flex-grow max-w-xs">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            🔍
                        </span>
                        <input type="text" id="pricing-search-input" oninput="window.filterPricingTable()" placeholder="搜尋名稱或 ID..." class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
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

function buildInvestorProfileRow(profile = {}) {
    const id = String(profile.investorId || profile.id || '').trim();
    const safeId = id.replace(/[^a-z0-9_-]/gi, '-');
    const balance = Number(profile.currentBalance || 0);
    const balanceClass = balance > 0 ? 'text-emerald-700' : (balance < 0 ? 'text-rose-700' : 'text-slate-500');
    const balanceLabel = balance > 0 ? '累積應發' : (balance < 0 ? '累積虧損' : '零餘額');
    const shareUnits = Number(profile.shareUnits || 0);
    const equityShares = Number(profile.equityShares || profile.shareUnits || 0);
    const ownershipPct = Number(profile.ownershipPct || 0);
    return `
        <tr class="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80 transition">
            <td class="py-4 px-6 align-top">
                <div class="font-black text-slate-900">${escapeHtml(profile.investorName || id || '未命名投資人')}</div>
                <div class="text-[11px] text-slate-400 font-mono mt-1 break-all">${escapeHtml(id)}</div>
            </td>
            <td class="py-4 px-6 align-top">
                <input id="investor-name-${safeId}" type="text" value="${escapeHtml(profile.investorName || '')}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <input id="investor-email-${safeId}" type="email" value="${escapeHtml(profile.investorEmail || '')}" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="investor@example.com">
                <label class="mt-2 block text-[11px] font-bold text-slate-500">身份</label>
                <select id="investor-participant-${safeId}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    <option value="founder" ${profile.participantType === 'founder' ? 'selected' : ''}>原始股東 / Founder</option>
                    <option value="investor" ${profile.participantType === 'investor' || !profile.participantType ? 'selected' : ''}>外部投資者</option>
                    <option value="employee" ${profile.participantType === 'employee' ? 'selected' : ''}>員工折抵</option>
                    <option value="consultant" ${profile.participantType === 'consultant' ? 'selected' : ''}>顧問折抵</option>
                    <option value="advisor" ${profile.participantType === 'advisor' ? 'selected' : ''}>顧問 / Advisor</option>
                </select>
            </td>
            <td class="py-4 px-6 align-top">
                <div class="grid grid-cols-1 gap-2">
                    <label class="text-[11px] font-bold text-slate-500">份額單位</label>
                    <input id="investor-share-${safeId}" type="number" min="0" step="1" value="${shareUnits}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    <div class="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-500">
                        <div>已發股數：<span class="font-mono font-bold text-slate-700">${equityShares.toLocaleString()}</span></div>
                        <div class="mt-1">持股比例：<span class="font-mono font-bold text-slate-700">${ownershipPct.toFixed(2)}%</span></div>
                        <div class="mt-1">估值 ID：<span class="font-mono font-bold text-slate-700">${escapeHtml(profile.valuationId || '—')}</span></div>
                    </div>
                    <label class="text-[11px] font-bold text-slate-500 mt-2">股利帳號</label>
                    <input id="investor-payout-${safeId}" type="text" value="${escapeHtml(profile.payoutAccount || '')}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="銀行帳號 / Wallet / 轉帳資訊">
                </div>
            </td>
            <td class="py-4 px-6 align-top">
                <div class="text-sm font-black ${balanceClass}">NT$ ${balance.toLocaleString()}</div>
                <div class="mt-1 text-[11px] text-slate-400">${escapeHtml(balanceLabel)}</div>
                <div class="mt-3 text-[11px] text-slate-500">最近結算年：${profile.lastSettlementYear || '—'}</div>
            </td>
            <td class="py-4 px-6 align-top">
                <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                    <input id="investor-enabled-${safeId}" type="checkbox" ${profile.enabled !== false ? 'checked' : ''} class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                    啟用
                </label>
                <textarea id="investor-notes-${safeId}" rows="2" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="備註">${escapeHtml(profile.notes || '')}</textarea>
            </td>
            <td class="py-4 px-6 align-top text-right">
                <button id="btn-save-investor-${safeId}" onclick="window.saveInvestorProfile('${escapeHtml(id)}')" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 active:scale-95">儲存</button>
            </td>
        </tr>
    `;
}

function buildValuationSnapshotCard(snapshot = {}) {
    const valuationId = String(snapshot.valuationId || '').trim();
    const sharePrice = Number(snapshot.sharePrice || 0);
    const basis = Number(snapshot.shareBasis || 0);
    return `
        <div class="rounded-xl border border-slate-200 bg-white p-4">
            <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div class="font-black text-slate-900">${escapeHtml(snapshot.roundName || valuationId || '未命名估值')}</div>
                    <div class="text-[11px] text-slate-400 font-mono">${escapeHtml(valuationId || '—')}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs font-bold ${snapshot.locked !== false ? 'text-emerald-600' : 'text-amber-600'}">${snapshot.locked !== false ? '鎖定中' : '可編輯'}</div>
                    <div class="text-[11px] text-slate-400">${escapeHtml(snapshot.valuationType || 'pre-money')}</div>
                </div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div class="rounded-lg bg-slate-50 px-3 py-2">股本基準：<span class="font-mono font-bold text-slate-700">${basis.toLocaleString()}</span></div>
                <div class="rounded-lg bg-slate-50 px-3 py-2">單價：<span class="font-mono font-bold text-slate-700">${sharePrice.toLocaleString()}</span></div>
                <div class="rounded-lg bg-slate-50 px-3 py-2">前估值：<span class="font-mono font-bold text-slate-700">${Number(snapshot.preMoneyValuation || 0).toLocaleString()}</span></div>
                <div class="rounded-lg bg-slate-50 px-3 py-2">後估值：<span class="font-mono font-bold text-slate-700">${Number(snapshot.postMoneyValuation || 0).toLocaleString()}</span></div>
            </div>
            <div class="mt-3 text-[11px] text-slate-500">
                有效期間：${escapeHtml(formatInvestorLedgerDate(snapshot.effectiveFrom))}
                ~
                ${escapeHtml(formatInvestorLedgerDate(snapshot.effectiveTo))}
            </div>
            ${snapshot.notes ? `<div class="mt-2 text-[11px] text-slate-500 leading-5">${escapeHtml(snapshot.notes)}</div>` : ''}
        </div>
    `;
}

function buildBalanceSheetSnapshotCard(snapshot = {}) {
    const snapshotId = String(snapshot.snapshotId || '').trim();
    const nav = Number(snapshot.netAssetValue || 0);
    const navPerShare = Number(snapshot.navPerIssuedShare || 0);
    const issuedShares = Number(snapshot.issuedShares || 0);
    const totalAssets = Number(snapshot.totalAssets || 0);
    const totalLiabilities = Number(snapshot.totalLiabilities || 0);
    const isAutoManaged = snapshot.autoManaged === true || snapshotId === 'auto-current';
    return `
        <div class="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
            <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div class="font-black text-slate-900">${escapeHtml(snapshotId || '未命名財務快照')}</div>
                    <div class="text-[11px] text-slate-400 font-mono">${escapeHtml(formatInvestorLedgerDate(snapshot.snapshotDate) || '—')}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs font-bold ${isAutoManaged ? 'text-blue-600' : (snapshot.locked !== false ? 'text-violet-600' : 'text-amber-600')}">${isAutoManaged ? '系統自動追蹤' : (snapshot.locked !== false ? '鎖定中' : '可編輯')}</div>
                    <div class="text-[11px] text-slate-400 font-mono">${escapeHtml(snapshot.currency || 'TWD')}</div>
                </div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">總資產：<span class="font-mono font-bold text-slate-700">${totalAssets.toLocaleString()}</span></div>
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">總負債：<span class="font-mono font-bold text-slate-700">${totalLiabilities.toLocaleString()}</span></div>
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">NAV：<span class="font-mono font-bold text-slate-700">${nav.toLocaleString()}</span></div>
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">每股淨值：<span class="font-mono font-bold text-slate-700">${navPerShare.toLocaleString()}</span></div>
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">已發股數：<span class="font-mono font-bold text-slate-700">${issuedShares.toLocaleString()}</span></div>
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">現金：<span class="font-mono font-bold text-slate-700">${Number(snapshot.cash || 0).toLocaleString()}</span></div>
            </div>
            <div class="mt-3 text-[11px] text-slate-500 leading-5">
                資產負債快照會和估值快照並排保存，作為帳面淨值與每股淨值的依據。若是系統自動追蹤的 current snapshot，收入 / 支出事件會直接推動現金與 NAV。
            </div>
            ${snapshot.notes ? `<div class="mt-2 text-[11px] text-slate-500 leading-5">${escapeHtml(snapshot.notes)}</div>` : ''}
        </div>
    `;
}

function buildEquityIssuanceRow(issuance = {}) {
    return `
        <tr class="border-b border-slate-100 last:border-b-0">
            <td class="py-3 px-4 align-top">
                <div class="font-bold text-slate-900">${escapeHtml(issuance.investorName || issuance.investorId || '—')}</div>
                <div class="text-[11px] text-slate-400 font-mono mt-1">${escapeHtml(issuance.investorId || '')}</div>
            </td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${escapeHtml(issuance.participantType || 'investor')}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600 font-mono">${escapeHtml(issuance.valuationId || '—')}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(issuance.considerationAmount || 0).toLocaleString()}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(issuance.issuedShares || 0).toLocaleString()}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(issuance.ownershipPct || 0).toFixed(2)}%</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${escapeHtml(issuance.sourceType || 'manual')}</td>
        </tr>
    `;
}

function buildInvestorEquityPositionRow(position = {}) {
    return `
        <tr class="border-b border-slate-100 last:border-b-0">
            <td class="py-3 px-4 align-top">
                <div class="font-bold text-slate-900">${escapeHtml(position.investorName || position.investorId || '—')}</div>
                <div class="text-[11px] text-slate-400 font-mono mt-1">${escapeHtml(position.investorId || '')}</div>
            </td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${escapeHtml(position.participantType || 'investor')}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(position.totalIssuedShares || 0).toLocaleString()}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(position.ownershipPct || 0).toFixed(2)}%</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600 font-mono">${escapeHtml(position.valuationId || '—')}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(position.sharePrice || 0).toLocaleString()}</td>
        </tr>
    `;
}

function parseInvestorLedgerDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'object') {
        if (typeof value.seconds === 'number') {
            const nanos = Number(value.nanoseconds || value._nanoseconds || 0);
            return new Date((value.seconds * 1000) + Math.floor(nanos / 1e6));
        }
        if (typeof value._seconds === 'number') {
            const nanos = Number(value._nanoseconds || 0);
            return new Date((value._seconds * 1000) + Math.floor(nanos / 1e6));
        }
    }
    return null;
}

function formatInvestorLedgerDate(value, fallback = '—') {
    const parsed = parseInvestorLedgerDate(value);
    if (!parsed || Number.isNaN(parsed.getTime())) {
        if (typeof value === 'string' && value) return value;
        return fallback;
    }
    return parsed.toISOString().slice(0, 10);
}

window.buildInvestorPlanHtml = window.buildInvestorPlanHtml || function() {
    const profiles = Array.isArray(window.__loadedInvestorProfiles) ? window.__loadedInvestorProfiles : [];
    const snapshots = Array.isArray(window.__loadedValuationSnapshots) ? window.__loadedValuationSnapshots : [];
    const activeSnapshot = window.__loadedActiveValuationSnapshot || snapshots.find((item) => item && item.locked !== false) || snapshots[0] || null;
    const balanceSheetSnapshots = Array.isArray(window.__loadedBalanceSheetSnapshots) ? window.__loadedBalanceSheetSnapshots : [];
    const activeBalanceSheetSnapshot = window.__loadedActiveBalanceSheetSnapshot || balanceSheetSnapshots.find((item) => item && item.locked !== false) || balanceSheetSnapshots[0] || null;
    const recentIssuances = Array.isArray(window.__loadedRecentIssuances) ? window.__loadedRecentIssuances : [];
    const equityPositions = Array.isArray(window.__loadedInvestorEquityPositions) ? window.__loadedInvestorEquityPositions : [];
    const totalShareUnits = profiles.reduce((sum, p) => sum + Number(p.shareUnits || 0), 0);
    const totalBalance = profiles.reduce((sum, p) => sum + Number(p.currentBalance || 0), 0);
    const totalIssuedShares = equityPositions.reduce((sum, p) => sum + Number(p.totalIssuedShares || 0), 0) || profiles.reduce((sum, p) => sum + Number(p.equityShares || p.shareUnits || 0), 0);
    const activeSnapshotOptions = snapshots.filter(Boolean).map((snapshot) => {
        const selected = activeSnapshot && snapshot.valuationId === activeSnapshot.valuationId ? 'selected' : '';
        return `<option value="${escapeHtml(snapshot.valuationId)}" ${selected}>${escapeHtml(snapshot.roundName || snapshot.valuationId)}</option>`;
    }).join('');
    const activeBalanceSnapshotOptions = balanceSheetSnapshots.filter(Boolean).map((snapshot) => {
        const selected = activeBalanceSheetSnapshot && snapshot.snapshotId === activeBalanceSheetSnapshot.snapshotId ? 'selected' : '';
        return `<option value="${escapeHtml(snapshot.snapshotId)}" ${selected}>${escapeHtml(snapshot.snapshotId || '未命名快照')}</option>`;
    }).join('');
    const latestNav = Number(activeBalanceSheetSnapshot?.netAssetValue || 0);
    const latestNavPerShare = Number(activeBalanceSheetSnapshot?.navPerIssuedShare || 0);
    return `
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h4 class="text-sm font-black text-slate-900">投資人權益與年度股利</h4>
                    <p class="text-xs text-slate-500 mt-1">每筆收入 / 支出都會依份額轉成 credit，年結時再發放股利並保留最後餘額。</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button onclick="window.loadInvestorProfiles()" class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">重新整理</button>
                    <button onclick="window.settleInvestorYear()" class="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700">執行年結</button>
                </div>
            </div>

            <div class="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/60">
                <div class="rounded-xl bg-white border border-slate-200 p-4">
                    <div class="text-[11px] uppercase tracking-widest font-bold text-slate-400">投資人數</div>
                    <div class="mt-1 text-2xl font-black text-slate-900" id="business-stat-investor-count">${profiles.length}</div>
                </div>
                <div class="rounded-xl bg-white border border-slate-200 p-4">
                    <div class="text-[11px] uppercase tracking-widest font-bold text-blue-500">份額總和</div>
                    <div class="mt-1 text-2xl font-black text-blue-600" id="business-stat-investor-units">${totalShareUnits.toLocaleString()}</div>
                </div>
                <div class="rounded-xl bg-white border border-slate-200 p-4">
                    <div class="text-[11px] uppercase tracking-widest font-bold text-emerald-500">目前總餘額</div>
                    <div class="mt-1 text-2xl font-black text-emerald-600" id="business-stat-investor-balance">NT$ ${totalBalance.toLocaleString()}</div>
                </div>
                <div class="rounded-xl bg-white border border-slate-200 p-4">
                    <div class="text-[11px] uppercase tracking-widest font-bold text-violet-500">帳面淨值</div>
                    <div class="mt-1 text-2xl font-black text-violet-600">${activeBalanceSheetSnapshot ? `NT$ ${latestNav.toLocaleString()}` : '—'}</div>
                    <div class="mt-1 text-[11px] text-slate-400 font-mono">${activeBalanceSheetSnapshot ? `每股 NT$ ${latestNavPerShare.toLocaleString()} / ${totalIssuedShares.toLocaleString()} 股` : '尚未建立資產負債快照'}</div>
                </div>
            </div>

            <div class="p-6 space-y-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <h5 class="text-sm font-black text-slate-900">財務快照 / Balance Sheet</h5>
                                <p class="text-[11px] text-slate-500 mt-1">資產負債快照會計算 NAV，作為估值與每股淨值的參考，但不會覆蓋發股估值。</p>
                            </div>
                            <div class="text-right">
                                <div class="text-[11px] font-bold text-violet-600">當前快照</div>
                                <div class="text-xs font-mono text-slate-600">${escapeHtml(activeBalanceSheetSnapshot?.snapshotId || '未設定')}</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">快照 ID</div>
                                <input id="balance-snapshot-id" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="bs-2026-q2">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">快照日期</div>
                                <input id="balance-snapshot-date" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">幣別</div>
                                <input id="balance-currency" type="text" value="TWD" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">已發股數</div>
                                <input id="balance-issued-shares" type="number" min="0" step="1" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="${totalIssuedShares || 10000000}">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">現金</div>
                                <input id="balance-cash" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="500000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">應收帳款</div>
                                <input id="balance-receivable" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="120000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">其他資產</div>
                                <input id="balance-other-assets" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">固定資產</div>
                                <input id="balance-fixed-assets" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">無形資產</div>
                                <input id="balance-intangible-assets" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">預付費用</div>
                                <input id="balance-prepaid-expenses" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">應付帳款</div>
                                <input id="balance-payable" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="80000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">短期借款</div>
                                <input id="balance-short-debt" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">長期借款</div>
                                <input id="balance-long-debt" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">其他負債</div>
                                <input id="balance-other-liabilities" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label class="md:col-span-2">
                                <div class="text-[11px] font-bold text-slate-500 mb-1">說明</div>
                                <textarea id="balance-notes" rows="2" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="例如：月底財務快照 / 董事會審閱用"></textarea>
                            </label>
                        </div>
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                                <input id="balance-locked" type="checkbox" checked class="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500">
                                鎖定此快照
                            </label>
                            <div class="flex gap-2">
                                <button onclick="window.saveBalanceSheetSnapshot()" class="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-700 active:scale-95">儲存財務快照</button>
                                <button onclick="window.syncInvestorManagementDefaults()" class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">套用快照預設</button>
                                <button onclick="window.fillBalanceSheetSampleData()" class="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 active:scale-95">載入範例</button>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-violet-100 bg-white p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <h5 class="text-sm font-black text-slate-900">快照摘要</h5>
                                <p class="text-[11px] text-slate-500 mt-1">按時間保存的資產負債快照，可直接拿來比較 NAV 與每股淨值。</p>
                            </div>
                            <div class="text-right">
                                <div class="text-[11px] font-bold text-violet-600">NAV</div>
                                <div class="text-xs font-mono text-slate-600">${activeBalanceSheetSnapshot ? `NT$ ${latestNav.toLocaleString()}` : '—'}</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                            <div class="rounded-lg bg-slate-50 px-3 py-2">總資產：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.totalAssets || 0).toLocaleString() : '—'}</span></div>
                            <div class="rounded-lg bg-slate-50 px-3 py-2">總負債：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.totalLiabilities || 0).toLocaleString() : '—'}</span></div>
                            <div class="rounded-lg bg-slate-50 px-3 py-2">已發股數：<span class="font-mono font-bold text-slate-700">${totalIssuedShares.toLocaleString()}</span></div>
                            <div class="rounded-lg bg-slate-50 px-3 py-2">每股淨值：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? latestNavPerShare.toLocaleString() : '—'}</span></div>
                        </div>
                        <div class="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                            <div class="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-2">資產 / Assets</div>
                            <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                                <div>現金：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.cash || 0).toLocaleString() : '—'}</span></div>
                                <div>應收：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.accountsReceivable || 0).toLocaleString() : '—'}</span></div>
                                <div>其他資產：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.otherAssets || 0).toLocaleString() : '—'}</span></div>
                                <div>固定資產：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.fixedAssets || 0).toLocaleString() : '—'}</span></div>
                            </div>
                        </div>
                        <div class="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                            <div class="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-2">負債 / Liabilities</div>
                            <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                                <div>應付：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.accountsPayable || 0).toLocaleString() : '—'}</span></div>
                                <div>短借：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.shortTermDebt || 0).toLocaleString() : '—'}</span></div>
                                <div>長借：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.longTermDebt || 0).toLocaleString() : '—'}</span></div>
                                <div>其他負債：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.otherLiabilities || 0).toLocaleString() : '—'}</span></div>
                            </div>
                        </div>
                        <div class="rounded-xl border border-slate-200 bg-white p-4">
                            <div class="text-sm font-black text-slate-900 mb-2">資產負債快照清單</div>
                            <select id="balance-sheet-snapshot-select" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" onchange="window.loadBalanceSheetSnapshotToForm(this.value)">
                                <option value="">選擇一筆快照</option>
                                ${activeBalanceSnapshotOptions}
                            </select>
                            <div class="mt-3 max-h-64 overflow-auto space-y-2">
                                ${balanceSheetSnapshots.length ? balanceSheetSnapshots.map(buildBalanceSheetSnapshotCard).join('') : '<div class="text-sm text-slate-400">尚未有資產負債快照</div>'}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <h5 class="text-sm font-black text-slate-900">估值快照</h5>
                                <p class="text-[11px] text-slate-500 mt-1">發股時只讀取這裡鎖定的估值，不會被之後的估值覆蓋。</p>
                            </div>
                            <div class="text-right">
                                <div class="text-[11px] font-bold text-blue-600">當前快照</div>
                                <div class="text-xs font-mono text-slate-600">${escapeHtml(activeSnapshot?.valuationId || '未設定')}</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">估值 ID</div>
                                <input id="valuation-snapshot-id" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="seed-2026-q2">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">輪次名稱</div>
                                <input id="valuation-round-name" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Pre-Seed Round">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">估值類型</div>
                                <select id="valuation-type" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                    <option value="pre-money">Pre-money</option>
                                    <option value="post-money">Post-money</option>
                                </select>
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">幣別</div>
                                <input id="valuation-currency" type="text" value="TWD" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">前估值</div>
                                <input id="valuation-pre-money" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="10000000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">後估值</div>
                                <input id="valuation-post-money" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="12000000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">股本基準</div>
                                <input id="valuation-share-basis" type="number" min="1" step="1" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="1000000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">每股價格</div>
                                <input id="valuation-share-price" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="12.5">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">生效日</div>
                                <input id="valuation-effective-from" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">失效日</div>
                                <input id="valuation-effective-to" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            </label>
                            <label class="md:col-span-2">
                                <div class="text-[11px] font-bold text-slate-500 mb-1">說明</div>
                                <textarea id="valuation-notes" rows="2" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="例如：以董事會核准的 pre-money 估值作為本輪發股基準。"></textarea>
                            </label>
                        </div>
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                                <input id="valuation-locked" type="checkbox" checked class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                                鎖定此估值
                            </label>
                            <div class="flex gap-2">
                                <button onclick="window.saveValuationSnapshot()" class="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 active:scale-95">儲存估值</button>
                                <button onclick="window.syncInvestorManagementDefaults()" class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">套用當前估值</button>
                                <button onclick="window.fillInvestorLedgerSampleData()" class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100 active:scale-95">載入範例</button>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            ${activeSnapshot ? buildValuationSnapshotCard(activeSnapshot) : '<div class="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">尚未建立估值快照。請先建立一筆估值，之後發股才會鎖定使用。</div>'}
                            <div class="rounded-xl border border-slate-200 bg-white p-4">
                                <div class="text-sm font-black text-slate-900 mb-2">估值清單</div>
                                <select id="valuation-snapshot-select" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" onchange="window.loadValuationSnapshotToForm(this.value)">
                                    <option value="">選擇一筆估值</option>
                                    ${activeSnapshotOptions}
                                </select>
                                <div class="mt-3 max-h-64 overflow-auto space-y-2">
                                    ${snapshots.length ? snapshots.map(buildValuationSnapshotCard).join('') : '<div class="text-sm text-slate-400">尚未有估值資料</div>'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <h5 class="text-sm font-black text-slate-900">股權發行</h5>
                                <p class="text-[11px] text-slate-500 mt-1">外部投資者、員工折抵與顧問折抵，都在這裡依估值換算成持股。</p>
                            </div>
                            <div class="text-right">
                                <div class="text-[11px] font-bold text-emerald-600">預設估值</div>
                                <div class="text-xs font-mono text-slate-600">${escapeHtml(activeSnapshot?.valuationId || '未設定')}</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">投資人 ID</div>
                                <input id="issue-investor-id" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="investor-001">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">投資人名稱</div>
                                <input id="issue-investor-name" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="王小明">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">Email</div>
                                <input id="issue-investor-email" type="email" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="investor@example.com">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">身份</div>
                                <select id="issue-participant-type" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                                    <option value="investor">外部投資者</option>
                                    <option value="employee">員工折抵</option>
                                    <option value="consultant">顧問折抵</option>
                                    <option value="advisor">顧問 / Advisor</option>
                                </select>
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">使用估值</div>
                                <select id="issue-valuation-id" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                                    <option value="">自動使用當前估值</option>
                                    ${activeSnapshotOptions}
                                </select>
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">對價類型</div>
                                <select id="issue-consideration-type" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                                    <option value="cash">現金</option>
                                    <option value="service">服務折抵</option>
                                    <option value="offset">債務/成本折抵</option>
                                </select>
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">對價金額</div>
                                <input id="issue-consideration-amount" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="100000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">來源類型</div>
                                <input id="issue-source-type" type="text" value="manual" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="manual / payroll / contract">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">來源 ID</div>
                                <input id="issue-source-id" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="PO-2026-001 / payroll-05">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">來源標籤</div>
                                <input id="issue-source-label" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="本輪募資 / 顧問服務折抵">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">Vesting（月）</div>
                                <input id="issue-vesting-months" type="number" min="0" step="1" value="0" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">Cliff（月）</div>
                                <input id="issue-cliff-months" type="number" min="0" step="1" value="0" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">起算日</div>
                                <input id="issue-start-date" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                            </label>
                            <label class="md:col-span-2">
                                <div class="text-[11px] font-bold text-slate-500 mb-1">說明</div>
                                <textarea id="issue-note" rows="2" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="例如：顧問服務折抵換股，按本輪估值計算。"></textarea>
                            </label>
                        </div>
                        <div class="flex items-center justify-between gap-3">
                            <div class="text-[11px] text-slate-500 leading-5">
                                這裡會直接依估值快照計算 considerationAmount / sharePrice，並同步更新持股位置。
                            </div>
                            <div class="flex gap-2">
                                <button onclick="window.fillInvestorLedgerSampleData()" class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100 active:scale-95">範例</button>
                                <button onclick="window.issueInvestorEquityFromForm()" class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95">發行股權</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div class="text-sm font-black text-slate-900">新增原始股東 / 投資人</div>
                            <div class="text-[11px] text-slate-500 mt-1">先把公司最初的股東、創辦人、員工折抵或外部投資者建檔，再用上方表格維護股數與收款帳號。</div>
                        </div>
                        <div class="text-[11px] text-slate-400">這裡建立的是 investor_profiles 的初始資料</div>
                    </div>
                    <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">代號 / ID</div>
                            <input id="new-investor-id" type="text" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="founder-001 / investor-001">
                        </label>
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">名稱</div>
                            <input id="new-investor-name" type="text" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="王小明">
                        </label>
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">Email</div>
                            <input id="new-investor-email" type="email" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="founder@example.com">
                        </label>
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">身份</div>
                            <select id="new-investor-participant" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                <option value="founder">原始股東 / Founder</option>
                                <option value="investor">外部投資者</option>
                                <option value="employee">員工折抵</option>
                                <option value="consultant">顧問折抵</option>
                                <option value="advisor">顧問 / Advisor</option>
                            </select>
                        </label>
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">初始股數</div>
                            <input id="new-investor-share" type="number" min="0" step="1" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="1000000">
                        </label>
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">股利帳號</div>
                            <input id="new-investor-payout" type="text" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="銀行帳號 / Wallet / 轉帳資訊">
                        </label>
                        <label class="md:col-span-2">
                            <div class="text-[11px] font-bold text-slate-500 mb-1">備註</div>
                            <textarea id="new-investor-notes" rows="2" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="例如：創辦人初始持股 / 員工認股 / 顧問折抵"></textarea>
                        </label>
                    </div>
                    <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div class="text-[11px] text-slate-500">如果是原始股東，建議把身份設成 founder，並直接輸入初始股數。</div>
                        <button onclick="window.createInvestorProfileFromForm()" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 active:scale-95">新增股東 / 投資人</button>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-5 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label class="md:col-span-1">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">事件類型</div>
                        <select id="investor-event-type" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            <option value="income">收入</option>
                            <option value="expense">支出</option>
                        </select>
                    </label>
                    <label class="md:col-span-1">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">金額</div>
                        <input id="investor-event-amount" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="10000">
                    </label>
                    <label class="md:col-span-1">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">來源類型</div>
                        <input id="investor-event-source-type" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="manual" placeholder="order / manual / expense">
                    </label>
                    <label class="md:col-span-1">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">來源 ID</div>
                        <input id="investor-event-source-id" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="order-123 / exp-2026-001">
                    </label>
                    <label class="md:col-span-1">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">發生日期</div>
                        <input id="investor-event-date" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    </label>
                    <label class="md:col-span-4">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">備註</div>
                        <input id="investor-event-note" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="例如：月租費 / 行銷費 / 新訂單收入">
                    </label>
                    <div class="md:col-span-1 flex items-end">
                        <button onclick="window.submitInvestorFinanceEvent()" class="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-95">新增事件</button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <div class="text-sm font-black text-slate-900">最近發股紀錄</div>
                                <div class="text-[11px] text-slate-500 mt-1">所有換股事件都會保留，不會被之後估值回寫。</div>
                            </div>
                            <div class="text-[11px] font-bold text-slate-400">${recentIssuances.length} 筆</div>
                        </div>
                        <div class="overflow-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th class="py-2 px-4">投資人</th>
                                        <th class="py-2 px-4">身份</th>
                                        <th class="py-2 px-4">估值</th>
                                        <th class="py-2 px-4">對價</th>
                                        <th class="py-2 px-4">股數</th>
                                        <th class="py-2 px-4">比例</th>
                                        <th class="py-2 px-4">來源</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${recentIssuances.length ? recentIssuances.map(buildEquityIssuanceRow).join('') : '<tr><td colspan="7" class="py-8 text-center text-slate-400">尚無發股紀錄</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <div class="text-sm font-black text-slate-900">持股位置</div>
                                <div class="text-[11px] text-slate-500 mt-1">依最新累計股數與估值基準顯示。</div>
                            </div>
                            <div class="text-[11px] font-bold text-slate-400">${equityPositions.length} 筆</div>
                        </div>
                        <div class="overflow-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th class="py-2 px-4">投資人</th>
                                        <th class="py-2 px-4">身份</th>
                                        <th class="py-2 px-4">股數</th>
                                        <th class="py-2 px-4">比例</th>
                                        <th class="py-2 px-4">估值</th>
                                        <th class="py-2 px-4">單價</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${equityPositions.length ? equityPositions.map(buildInvestorEquityPositionRow).join('') : '<tr><td colspan="6" class="py-8 text-center text-slate-400">尚無持股位置</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="overflow-x-auto rounded-2xl border border-slate-200">
                    <table class="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr class="bg-slate-50 text-slate-500 border-b border-slate-100">
                                <th class="py-3 px-6">投資人</th>
                                <th class="py-3 px-6">基本資料</th>
                                <th class="py-3 px-6">份額 / 帳號</th>
                                <th class="py-3 px-6">餘額</th>
                                <th class="py-3 px-6">備註</th>
                                <th class="py-3 px-6 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody id="business-investor-table-body" class="divide-y divide-slate-100">
                            ${profiles.length ? profiles.map(buildInvestorProfileRow).join('') : '<tr><td colspan="6" class="py-10 text-center text-slate-400">尚未設定投資人</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
};

window.loadInvestorProfiles = async function () {
    const container = document.getElementById('business-investor-container');
    if (!container) return;
    container.innerHTML = '<div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">載入投資人資料中...</div>';
    try {
        const fn = httpsCallable(functions, 'getInvestorProfiles');
        const res = await fn({});
        const profiles = Array.isArray(res?.data?.profiles) ? res.data.profiles : [];
        window.__loadedInvestorProfiles = profiles;
        const config = res?.data?.config || {};
        const valuationSnapshots = Array.isArray(res?.data?.valuationSnapshots) ? res.data.valuationSnapshots : [];
        const activeValuationSnapshot = res?.data?.activeValuationSnapshot || null;
        const balanceSheetSnapshots = Array.isArray(res?.data?.balanceSheetSnapshots) ? res.data.balanceSheetSnapshots : [];
        const activeBalanceSheetSnapshot = res?.data?.activeBalanceSheetSnapshot || null;
        const recentIssuances = Array.isArray(res?.data?.recentIssuances) ? res.data.recentIssuances : [];
        const equityPositions = Array.isArray(res?.data?.equityPositions) ? res.data.equityPositions : [];
        window.__loadedValuationSnapshots = valuationSnapshots;
        window.__loadedActiveValuationSnapshot = activeValuationSnapshot;
        window.__loadedBalanceSheetSnapshots = balanceSheetSnapshots;
        window.__loadedActiveBalanceSheetSnapshot = activeBalanceSheetSnapshot;
        window.__loadedRecentIssuances = recentIssuances;
        window.__loadedInvestorEquityPositions = equityPositions;
        window.__loadedInvestorConfig = config;
        container.classList.remove('hidden');
        container.innerHTML = window.buildInvestorPlanHtml ? window.buildInvestorPlanHtml() : '';
        window.syncInvestorManagementDefaults?.();

        const dateInput = document.getElementById('investor-event-date');
        if (dateInput && !dateInput.value) {
            const now = new Date();
            dateInput.value = now.toISOString().slice(0, 10);
        }
    } catch (e) {
        container.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">載入投資人資料失敗：${escapeHtml(e.message || 'unknown')}</div>`;
    }
};

window.loadBalanceSheetSnapshotToForm = function (snapshotId) {
    const snapshots = Array.isArray(window.__loadedBalanceSheetSnapshots) ? window.__loadedBalanceSheetSnapshots : [];
    const snapshot = snapshots.find((item) => item && item.snapshotId === snapshotId);
    if (!snapshot) return;

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
    };

    setValue('balance-snapshot-id', snapshot.snapshotId || '');
    setValue('balance-snapshot-date', formatInvestorLedgerDate(snapshot.snapshotDate, '') || '');
    setValue('balance-currency', snapshot.currency || 'TWD');
    setValue('balance-issued-shares', Number(snapshot.issuedShares || 0));
    setValue('balance-cash', Number(snapshot.cash || 0));
    setValue('balance-receivable', Number(snapshot.accountsReceivable || 0));
    setValue('balance-other-assets', Number(snapshot.otherAssets || 0));
    setValue('balance-fixed-assets', Number(snapshot.fixedAssets || 0));
    setValue('balance-intangible-assets', Number(snapshot.intangibleAssets || 0));
    setValue('balance-prepaid-expenses', Number(snapshot.prepaidExpenses || 0));
    setValue('balance-payable', Number(snapshot.accountsPayable || 0));
    setValue('balance-short-debt', Number(snapshot.shortTermDebt || 0));
    setValue('balance-long-debt', Number(snapshot.longTermDebt || 0));
    setValue('balance-other-liabilities', Number(snapshot.otherLiabilities || 0));
    setValue('balance-notes', snapshot.notes || '');
    const locked = document.getElementById('balance-locked');
    if (locked) locked.checked = snapshot.locked !== false;
};

window.saveBalanceSheetSnapshot = async function () {
    const payload = {
        snapshotId: document.getElementById('balance-snapshot-id')?.value || '',
        snapshotDate: document.getElementById('balance-snapshot-date')?.value || '',
        currency: document.getElementById('balance-currency')?.value || 'TWD',
        issuedShares: Number(document.getElementById('balance-issued-shares')?.value || 0),
        cash: Number(document.getElementById('balance-cash')?.value || 0),
        accountsReceivable: Number(document.getElementById('balance-receivable')?.value || 0),
        otherAssets: Number(document.getElementById('balance-other-assets')?.value || 0),
        fixedAssets: Number(document.getElementById('balance-fixed-assets')?.value || 0),
        intangibleAssets: Number(document.getElementById('balance-intangible-assets')?.value || 0),
        prepaidExpenses: Number(document.getElementById('balance-prepaid-expenses')?.value || 0),
        accountsPayable: Number(document.getElementById('balance-payable')?.value || 0),
        shortTermDebt: Number(document.getElementById('balance-short-debt')?.value || 0),
        longTermDebt: Number(document.getElementById('balance-long-debt')?.value || 0),
        otherLiabilities: Number(document.getElementById('balance-other-liabilities')?.value || 0),
        notes: document.getElementById('balance-notes')?.value || '',
        locked: !!document.getElementById('balance-locked')?.checked
    };

    if (!payload.snapshotId) {
        alert('請輸入財務快照 ID');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'upsertBalanceSheetSnapshot');
        await fn(payload);
        notify('財務快照已儲存', 'success');
        await loadInvestorProfiles();
    } catch (e) {
        alert(`儲存財務快照失敗：${e.message}`);
    }
};

window.loadValuationSnapshotToForm = function (valuationId) {
    const snapshots = Array.isArray(window.__loadedValuationSnapshots) ? window.__loadedValuationSnapshots : [];
    const snapshot = snapshots.find((item) => item && item.valuationId === valuationId);
    if (!snapshot) return;

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
    };

    setValue('valuation-snapshot-id', snapshot.valuationId || '');
    setValue('valuation-round-name', snapshot.roundName || '');
    setValue('valuation-type', snapshot.valuationType || 'pre-money');
    setValue('valuation-currency', snapshot.currency || 'TWD');
    setValue('valuation-pre-money', Number(snapshot.preMoneyValuation || 0));
    setValue('valuation-post-money', Number(snapshot.postMoneyValuation || 0));
    setValue('valuation-share-basis', Number(snapshot.shareBasis || 0));
    setValue('valuation-share-price', Number(snapshot.sharePrice || 0));
    setValue('valuation-notes', snapshot.notes || '');
    const locked = document.getElementById('valuation-locked');
    if (locked) locked.checked = snapshot.locked !== false;
    const activeFrom = formatInvestorLedgerDate(snapshot.effectiveFrom, '');
    const activeTo = formatInvestorLedgerDate(snapshot.effectiveTo, '');
    setValue('valuation-effective-from', activeFrom || '');
    setValue('valuation-effective-to', activeTo || '');
    const issueValuation = document.getElementById('issue-valuation-id');
    if (issueValuation) {
        issueValuation.value = snapshot.valuationId || '';
    }
};

window.syncInvestorManagementDefaults = function () {
    const active = window.__loadedActiveValuationSnapshot || null;
    const snapshots = Array.isArray(window.__loadedValuationSnapshots) ? window.__loadedValuationSnapshots : [];
    const snapshot = active || snapshots[0] || null;
    if (snapshot) {
        window.loadValuationSnapshotToForm(snapshot.valuationId);
    }

    const issueValuation = document.getElementById('issue-valuation-id');
    if (issueValuation && !issueValuation.value) {
        issueValuation.value = snapshot?.valuationId || '';
    }
    const issueDate = document.getElementById('issue-start-date');
    if (issueDate && !issueDate.value) {
        issueDate.value = new Date().toISOString().slice(0, 10);
    }

    const balanceSnapshot = window.__loadedActiveBalanceSheetSnapshot || (Array.isArray(window.__loadedBalanceSheetSnapshots) ? window.__loadedBalanceSheetSnapshots[0] : null) || null;
    if (balanceSnapshot) {
        window.loadBalanceSheetSnapshotToForm(balanceSnapshot.snapshotId);
    }
    const balanceDate = document.getElementById('balance-snapshot-date');
    if (balanceDate && !balanceDate.value) {
        balanceDate.value = new Date().toISOString().slice(0, 10);
    }
    const balanceIssuedShares = document.getElementById('balance-issued-shares');
    if (balanceIssuedShares && !balanceIssuedShares.value) {
        const totalIssuedShares = (Array.isArray(window.__loadedInvestorEquityPositions) ? window.__loadedInvestorEquityPositions : [])
            .reduce((sum, p) => sum + Number(p.totalIssuedShares || 0), 0)
            || (Array.isArray(window.__loadedInvestorProfiles) ? window.__loadedInvestorProfiles.reduce((sum, p) => sum + Number(p.equityShares || p.shareUnits || 0), 0) : 0);
        if (totalIssuedShares > 0) balanceIssuedShares.value = String(totalIssuedShares);
    }
};

window.createInvestorProfileFromForm = async function () {
    const payload = {
        investorId: document.getElementById('new-investor-id')?.value || '',
        investorName: document.getElementById('new-investor-name')?.value || '',
        investorEmail: document.getElementById('new-investor-email')?.value || '',
        participantType: document.getElementById('new-investor-participant')?.value || 'founder',
        shareUnits: Number(document.getElementById('new-investor-share')?.value || 0),
        payoutAccount: document.getElementById('new-investor-payout')?.value || '',
        notes: document.getElementById('new-investor-notes')?.value || '',
        enabled: true
    };

    if (!payload.investorId) {
        alert('請輸入代號 / ID');
        return;
    }

    if (!Number.isFinite(payload.shareUnits) || payload.shareUnits < 0) {
        alert('請輸入有效的初始股數');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'upsertInvestorProfile');
        await fn(payload);
        notify('原始股東 / 投資人已建立', 'success');
        await loadInvestorProfiles();
    } catch (e) {
        alert(`新增失敗：${e.message}`);
    }
};

window.fillInvestorLedgerSampleData = function () {
    const today = new Date().toISOString().slice(0, 10);
    const fields = {
        'balance-snapshot-id': 'bs-2026-q2',
        'balance-snapshot-date': today,
        'balance-currency': 'TWD',
        'balance-issued-shares': '10000000',
        'balance-cash': '500000',
        'balance-receivable': '120000',
        'balance-other-assets': '0',
        'balance-fixed-assets': '0',
        'balance-intangible-assets': '0',
        'balance-prepaid-expenses': '0',
        'balance-payable': '80000',
        'balance-short-debt': '0',
        'balance-long-debt': '0',
        'balance-other-liabilities': '0',
        'balance-notes': '示範：月底資產負債快照，供 NAV / 每股淨值測試。',
        'valuation-snapshot-id': 'pre-seed-2026-q2',
        'valuation-round-name': 'Pre-Seed 2026 Q2',
        'valuation-type': 'pre-money',
        'valuation-currency': 'TWD',
        'valuation-pre-money': '12000000',
        'valuation-post-money': '15000000',
        'valuation-share-basis': '1000000',
        'valuation-share-price': '12',
        'valuation-effective-from': today,
        'valuation-notes': '董事會核准的預設示範估值，供外部投資與服務折抵換股測試。',
        'issue-investor-id': 'investor-demo-001',
        'issue-investor-name': 'Demo Investor',
        'issue-investor-email': 'demo@example.com',
        'issue-participant-type': 'consultant',
        'issue-valuation-id': 'pre-seed-2026-q2',
        'issue-consideration-type': 'service',
        'issue-consideration-amount': '60000',
        'issue-source-type': 'contract',
        'issue-source-id': 'contract-2026-001',
        'issue-source-label': '顧問服務折抵',
        'issue-vesting-months': '12',
        'issue-cliff-months': '3',
        'issue-start-date': today,
        'issue-note': '示範：顧問服務折抵換股，按鎖定估值計算。'
    };

    Object.entries(fields).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });

    const locked = document.getElementById('valuation-locked');
    if (locked) locked.checked = true;
    notify('已載入範例資料', 'success');
};

window.fillBalanceSheetSampleData = function () {
    const today = new Date().toISOString().slice(0, 10);
    const fields = {
        'balance-snapshot-id': 'bs-2026-q2',
        'balance-snapshot-date': today,
        'balance-currency': 'TWD',
        'balance-issued-shares': '10000000',
        'balance-cash': '500000',
        'balance-receivable': '120000',
        'balance-other-assets': '0',
        'balance-fixed-assets': '0',
        'balance-intangible-assets': '0',
        'balance-prepaid-expenses': '0',
        'balance-payable': '80000',
        'balance-short-debt': '0',
        'balance-long-debt': '0',
        'balance-other-liabilities': '0',
        'balance-notes': '示範：月底資產負債快照，供 NAV / 每股淨值測試。'
    };

    Object.entries(fields).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });

    const locked = document.getElementById('balance-locked');
    if (locked) locked.checked = true;
    notify('已載入財務快照範例', 'success');
};

window.saveValuationSnapshot = async function () {
    const payload = {
        valuationId: document.getElementById('valuation-snapshot-id')?.value || '',
        roundName: document.getElementById('valuation-round-name')?.value || '',
        valuationType: document.getElementById('valuation-type')?.value || 'pre-money',
        currency: document.getElementById('valuation-currency')?.value || 'TWD',
        preMoneyValuation: Number(document.getElementById('valuation-pre-money')?.value || 0),
        postMoneyValuation: Number(document.getElementById('valuation-post-money')?.value || 0),
        shareBasis: Number(document.getElementById('valuation-share-basis')?.value || 0),
        sharePrice: Number(document.getElementById('valuation-share-price')?.value || 0),
        effectiveFrom: document.getElementById('valuation-effective-from')?.value || '',
        effectiveTo: document.getElementById('valuation-effective-to')?.value || '',
        notes: document.getElementById('valuation-notes')?.value || '',
        locked: !!document.getElementById('valuation-locked')?.checked
    };

    if (!payload.valuationId) {
        alert('請輸入估值 ID');
        return;
    }
    if (!Number.isFinite(payload.shareBasis) || payload.shareBasis <= 0) {
        alert('請輸入有效的股本基準');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'upsertValuationSnapshot');
        await fn(payload);
        notify('估值快照已儲存', 'success');
        await loadInvestorProfiles();
    } catch (e) {
        alert(`儲存估值失敗：${e.message}`);
    }
};

window.issueInvestorEquityFromForm = async function () {
    const payload = {
        investorId: document.getElementById('issue-investor-id')?.value || '',
        investorName: document.getElementById('issue-investor-name')?.value || '',
        investorEmail: document.getElementById('issue-investor-email')?.value || '',
        participantType: document.getElementById('issue-participant-type')?.value || 'investor',
        valuationId: document.getElementById('issue-valuation-id')?.value || '',
        considerationType: document.getElementById('issue-consideration-type')?.value || 'cash',
        considerationAmount: Number(document.getElementById('issue-consideration-amount')?.value || 0),
        sourceType: document.getElementById('issue-source-type')?.value || 'manual',
        sourceId: document.getElementById('issue-source-id')?.value || '',
        sourceLabel: document.getElementById('issue-source-label')?.value || '',
        vestingMonths: Number(document.getElementById('issue-vesting-months')?.value || 0),
        cliffMonths: Number(document.getElementById('issue-cliff-months')?.value || 0),
        startDate: document.getElementById('issue-start-date')?.value || '',
        note: document.getElementById('issue-note')?.value || ''
    };

    if (!payload.investorId) {
        alert('請輸入投資人 ID');
        return;
    }
    if (!Number.isFinite(payload.considerationAmount) || payload.considerationAmount <= 0) {
        alert('請輸入有效對價金額');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'issueInvestorEquity');
        await fn(payload);
        notify('股權已發行', 'success');
        await loadInvestorProfiles();
    } catch (e) {
        alert(`發行股權失敗：${e.message}`);
    }
};

window.saveInvestorProfile = async function (investorId) {
    const safeId = String(investorId || '').trim().replace(/[^a-z0-9_-]/gi, '-');
    const g = (suffix) => document.getElementById(`investor-${suffix}-${safeId}`);
    const payload = {
        investorId,
        investorName: g('name')?.value || investorId,
        investorEmail: g('email')?.value || '',
        participantType: g('participant')?.value || 'investor',
        shareUnits: Number(g('share')?.value || 0),
        payoutAccount: g('payout')?.value || '',
        notes: g('notes')?.value || '',
        enabled: !!g('enabled')?.checked
    };

    const btn = document.getElementById(`btn-save-investor-${safeId}`);
    const originalText = btn ? btn.textContent : '儲存';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '儲存中...';
    }

    try {
        const fn = httpsCallable(functions, 'upsertInvestorProfile');
        await fn(payload);
        notify(`已儲存投資人：${investorId}`, 'success');
        await loadInvestorProfiles();
    } catch (e) {
        alert(`儲存投資人失敗：${e.message}`);
        if (btn) btn.textContent = originalText;
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.submitInvestorFinanceEvent = async function () {
    const eventType = document.getElementById('investor-event-type')?.value || 'income';
    const amount = Number(document.getElementById('investor-event-amount')?.value || 0);
    const sourceType = document.getElementById('investor-event-source-type')?.value || 'manual';
    const sourceId = document.getElementById('investor-event-source-id')?.value || '';
    const note = document.getElementById('investor-event-note')?.value || '';
    const dateValue = document.getElementById('investor-event-date')?.value || '';
    if (!Number.isFinite(amount) || amount <= 0) {
        alert('請輸入有效金額');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'recordInvestorFinanceEvent');
        await fn({
            eventType,
            amount,
            sourceType,
            sourceId,
            note,
            occurredAtDate: dateValue ? new Date(`${dateValue}T00:00:00`) : new Date()
        });
        notify('投資人事件已新增', 'success');
        await loadInvestorProfiles();
    } catch (e) {
        alert(`新增事件失敗：${e.message}`);
    }
};

window.settleInvestorYear = async function () {
    const yearValue = prompt('請輸入要結算的年度（預設前一年）', String((new Date()).getFullYear() - 1));
    if (yearValue === null) return;
    const year = Number(yearValue || 0);
    if (!Number.isFinite(year) || year < 2000) {
        alert('請輸入有效年份');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'settleAnnualInvestorDividends');
        const res = await fn({ year });
        notify(`年度結算完成：${res.data?.settlementCount || 0} 位投資人`, 'success');
        await loadInvestorProfiles();
    } catch (e) {
        alert(`年度結算失敗：${e.message}`);
    }
};

async function renderBusinessTab() {
    if (myRole !== 'admin' || !dashboardData) return;
    renderBusinessPricingOverview();

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

    const investorContainer = document.getElementById('business-investor-container');
    if (investorContainer) {
        investorContainer.classList.remove('hidden');
    }
    if (typeof window.loadInvestorProfiles === 'function') {
        window.loadInvestorProfiles();
    }

    // [NEW] System Administration & Settings rendering
    const systemSettingsContainer = document.getElementById('system-settings-container');
    if (systemSettingsContainer) {
        systemSettingsContainer.classList.remove('hidden');
        
        // Show current contentVersion
        const versionDisplay = document.getElementById('current-content-version-display');
        const versionInput = document.getElementById('sys-content-version-input');
        if (versionDisplay) {
            versionDisplay.textContent = `當前鎖定版本 (Current Locked Hash): ${dashboardData.contentVersion || '未設定 (None)'}`;
        }
        if (versionInput && !versionInput.value && dashboardData.contentVersion) {
            versionInput.value = dashboardData.contentVersion;
        }
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
        const updateSystemConfigFn = firebase.functions().httpsCallable('updateSystemConfig');
        const res = await updateSystemConfigFn({ contentVersion });
        if (res.data && res.data.success) {
            alert("成功儲存並鎖定版本！快取已同步清空。");
            // Reload dashboard data to get the updated contentVersion
            await loadDashboard();
        } else {
            alert("儲存失敗，請檢查權限或輸入值是否正確！");
        }
    } catch (err) {
        console.error("updateSystemContentVersion error:", err);
        alert(`錯誤: ${err.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

window.purgeSystemContentCache = async function() {
    if (!confirm("確定要清除整個系統的外部網頁快取嗎？這會讓下一次學生連線時重新至 Git 下載最新檔案。")) {
        return;
    }

    const btn = document.getElementById('btn-purge-content-cache');
    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = "正在清除快取...";
    }

    try {
        const purgeContentCacheFn = firebase.functions().httpsCallable('purgeContentCache');
        const res = await purgeContentCacheFn();
        if (res.data && res.data.success) {
            alert("成功清除所有網頁快取！");
        } else {
            alert("清除快取失敗。");
        }
    } catch (err) {
        console.error("purgeSystemContentCache error:", err);
        alert(`錯誤: ${err.message}`);
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
        return lesson ? (Number(lesson.price) === 0) : false;
    };
    const isFreeUnit = getIsFreeUnit(fileName);
    
    if (isFreeUnit && !isPaidStudent) {
        const regTime = dashboardData?.createdAt?.seconds ? new Date(dashboardData.createdAt.seconds * 1000) : new Date(dashboardData?.createdAt || 0);
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
        alert(`連結格式錯誤\n單元：${invalidEntry.unit}\nTutor：${invalidEntry.tutor}\n請使用有效的作業連結`);
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
            result.assignmentGuides[fileName.replace('.html', '')] = content;

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
        // 1. Close Modal if open
        const modal = document.getElementById('grading-modal');
        if (modal && !modal.classList.contains('hidden')) {
            window.closeGradingModal();
            return;
        }

        // 2. Clear filters if present
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('courseId') || urlParams.get('unitId')) {
            console.log("[Esc] Redirecting to main dashboard...");
            window.location.href = 'dashboard.html';
        }
    }
});
// --- Earnings ---
window.renderEarningsTab = window.renderEarningsTab || function(data) {
    const totalEarningsEl = document.getElementById('stat-total-earnings');
    const promoCodeEl = document.getElementById('display-promo-code');
    const tableBody = document.getElementById('earnings-table-body');
    if (!totalEarningsEl || !promoCodeEl || !tableBody) return;

    // 1. Display Referral Link (Unit-Specific)
    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));
    const inviteKit = buildReferralInviteKit(filterUnitId, data.myReferralLink);

    if (!filterUnitId) {
        promoCodeEl.innerHTML = `
            <span class="text-gray-400 text-sm block mb-1">請先從上方切換單元</span>
            <span class="text-[10px] text-gray-300">每一單元皆有專屬作業連結</span>
        `;
    } else if (!data.myReferralLink) {
        promoCodeEl.innerHTML = `
            <div class="space-y-3">
                <div>
                    <div class="text-[10px] uppercase tracking-wider text-gray-400">Promotion Code</div>
                    <div class="font-mono text-indigo-700 text-sm">${escapeHtml(data.myPromotionCode || '尚未生成')}</div>
                </div>
                <div>
                    <div class="text-[10px] uppercase tracking-wider text-gray-400">作業連結</div>
                    <div class="text-orange-500 text-sm font-bold">尚未配置作業連結</div>
                    <div class="text-[10px] text-gray-400">請聯繫管理員獲取該單元授權</div>
                </div>
            </div>
        `;
    } else {
        promoCodeEl.innerHTML = `
            <div class="space-y-3">
                <div>
                    <div class="text-[10px] uppercase tracking-wider text-gray-400">Promotion Code</div>
                    <div class="font-mono text-indigo-700 text-sm break-all">${escapeHtml(data.myPromotionCode || '尚未生成')}</div>
                </div>
                <div>
                    <div class="text-[10px] uppercase tracking-wider text-gray-400">作業連結</div>
                    <a href="${escapeHtml(data.myReferralLink)}" target="_blank" rel="noopener noreferrer" class="font-mono text-blue-600 text-xs break-all hover:underline">${escapeHtml(data.myReferralLink)}</a>
                </div>
            </div>
        `;
    }

    // 2. Display Earnings Ledger
    const earnings = data.earnings || [];
    let total = 0;

    if (earnings.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-gray-400">尚無分潤紀錄</td></tr>';
    } else {
        tableBody.innerHTML = earnings.map(d => {
            total += d.shareAmount;
            const levelLabel = Number(d.level) <= 1 ? '直接' : `第 ${Number(d.level)} 層`;
            return `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="py-3 px-2 font-medium">${d.month || d.period || '-'}</td>
                    <td class="py-3 px-2 text-gray-500 font-mono text-[10px]">${d.studentUid || '-'}</td>
                    <td class="py-3 px-2 text-right">NT$ ${d.orderAmount.toLocaleString()}</td>
                    <td class="py-3 px-2 text-right font-bold text-emerald-600">NT$ ${d.shareAmount.toLocaleString()}</td>
                    <td class="py-3 px-2 text-right text-gray-400 text-xs">${levelLabel}</td>
                </tr>
            `;
        }).join('');
    }

    totalEarningsEl.innerText = total.toLocaleString();

    // 3. Render Revenue Simulator (Read-Only) for Admins
    const simContainer = document.getElementById('earnings-revenue-simulator');
    if (simContainer) {
        if (myRole === 'admin') {
            simContainer.innerHTML = window.buildRevenueSimulatorHtml ? window.buildRevenueSimulatorHtml() : '';
            simContainer.classList.remove('hidden');
            if (typeof window.runRevenueSimulation === 'function') {
                window.runRevenueSimulation();
            }
        } else {
            simContainer.innerHTML = '';
            simContainer.classList.add('hidden');
        }
    }
}

window.renderReferralInviteKitSection = window.renderReferralInviteKitSection || function(data) {
    const inviteKitEl = document.getElementById('promo-invite-kit-assignments');
    if (!inviteKitEl) return;

    const { filterUnitId } = getCurrentDashboardContext();
    const isTutor = !!currentDashboardPermissions.isQualifiedTutor || (myRole === 'admin' && adminTutorMode);
    const isUnitContext = !!filterUnitId;

    if (!isTutor) {
        inviteKitEl.innerHTML = '';
        inviteKitEl.classList.add('hidden');
        return;
    }

    const inviteKit = buildReferralInviteKit(filterUnitId, data.myReferralLink);
    inviteKitEl.classList.remove('hidden');

    if (!isUnitContext) {
        inviteKitEl.innerHTML = `
            <div class="space-y-1 font-sans">
                <p class="text-gray-500 text-sm font-bold">專屬作業資訊 (Promo Code / 邀請連結)</p>
                <p class="text-gray-400 text-sm mt-2 font-medium">請先從上方切換單元</p>
                <p class="text-[10px] text-gray-300 mt-1 font-normal">每一單元皆有專屬作業連結</p>
            </div>
        `;
        return;
    }

    if (!inviteKit.ready) {
        inviteKitEl.innerHTML = `
            <div class="space-y-1 font-sans">
                <p class="text-gray-500 text-sm font-bold">專屬作業資訊 (Promo Code / 邀請連結)</p>
                <p class="text-orange-500 text-sm font-bold mt-2">${escapeHtml(inviteKit.message)}</p>
            </div>
        `;
        return;
    }

    inviteKitEl.innerHTML = `
        <div class="space-y-6">
            <div class="border-b border-slate-100 pb-4">
                <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-500">招生工具 / Registration Tools</p>
                <h3 class="text-2xl font-black text-gray-900 mt-2">招生工具包</h3>
                <p class="text-sm text-gray-500 mt-2 leading-relaxed">學生掃描 QR Code 或點擊專屬連結後，系統會自動將課程加入購物車並連結您的教學作業權限。</p>
            </div>

            <div class="flex flex-col lg:flex-row gap-8 items-start">
                <div class="lg:w-[320px] w-full flex flex-col gap-6 flex-shrink-0">
                    <div class="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-col items-center">
                        <img src="${escapeHtml(inviteKit.qrUrl)}" alt="Referral QR code" class="w-48 h-48 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <p class="text-[10px] text-gray-400 mt-4 text-center break-all font-mono max-w-full">${escapeHtml(inviteKit.inviteUrl)}</p>
                    </div>

                    <div class="flex flex-col gap-4">
                        <div class="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                            <p class="text-[10px] text-blue-600 font-bold uppercase mb-2 tracking-widest">分銷連結 / Referral Link</p>
                            <button type="button" class="promo-copy-link w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 transition shadow-md active:scale-95">複製專屬連結</button>
                        </div>
                        <div class="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                            <p class="text-[10px] text-emerald-600 font-bold uppercase mb-2 tracking-widest">快速分享 / Quick Share</p>
                            <a href="${escapeHtml(inviteKit.mailtoUrl)}" class="w-full inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition shadow-md active:scale-95">按此發送郵件</a>
                        </div>
                    </div>

                    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 italic">
                        💡 建議：您可以將 QR Code 下載後印在課程講義上，或直接將專屬連結貼到班級群組中。
                    </div>
                </div>

                <div class="flex-grow w-full">
                    <div class="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
                        <div class="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                            <p class="text-xs font-black uppercase tracking-[0.24em] text-indigo-500">標準文案 / Registration Notice</p>
                            <h4 class="text-xl font-black text-slate-900 mt-2">寄給學生的報名通知書</h4>
                            <p class="text-sm text-slate-500 mt-1 font-medium">複製下方文案並貼給學生，能提供最完整的報名指引。</p>
                        </div>
                        <div class="p-8 flex-grow">
                            <pre class="promo-invite-letter whitespace-pre-wrap break-words text-sm leading-8 text-slate-700 font-sans bg-slate-50 rounded-2xl p-6 border border-slate-100 h-full">${escapeHtml(inviteKit.letterText)}</pre>
                        </div>
                        <div class="px-8 pb-8 flex flex-col sm:flex-row gap-4 mt-auto">
                            <button type="button" class="promo-copy-letter flex-1 inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800 transition shadow-lg active:scale-95">複製完整通知書內容</button>
                            <button type="button" class="promo-copy-qr inline-flex items-center justify-center rounded-xl border border-slate-300 px-6 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95">複製 QR 連結</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const copyLinkBtn = inviteKitEl.querySelector('.promo-copy-link');
    const copyLetterBtn = inviteKitEl.querySelector('.promo-copy-letter');
    const copyQrBtn = inviteKitEl.querySelector('.promo-copy-qr');

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => copyTextToClipboard(inviteKit.inviteUrl, '已複製專屬報名連結'));
    }
    if (copyLetterBtn) {
        copyLetterBtn.addEventListener('click', () => copyTextToClipboard(inviteKit.letterText, '已複製通知書內容'));
    }
    if (copyQrBtn) {
        copyQrBtn.addEventListener('click', () => copyTextToClipboard(inviteKit.qrUrl, '已複製 QR Code 圖片連結'));
    }
};

window.buildReferralInviteKit = window.buildReferralInviteKit || function(unitId, referralLink) {
    if (!unitId) {
        return { ready: false, message: '請先切換到特定課程單元，才能生成專屬招生邀請工具。' };
    }

    if (!referralLink) {
        return { ready: false, message: '此單元尚未配置作業連結，請先確認導師授權或聯繫管理員。' };
    }

    const canonicalUnitId = resolveCanonicalUnitId(unitId);
    const parentCourseId = findParentCourseIdByUnit(canonicalUnitId) || canonicalUnitId;
    const lesson = (allLessons || []).find(item => item.courseId === parentCourseId) ||
        (allLessons || []).find(item => Array.isArray(item.courseUnits) && item.courseUnits.includes(canonicalUnitId)) ||
        null;

    const courseId = getCanonicalLessonIdentity(lesson) || parentCourseId;
    const courseName = lesson?.title || lesson?.courseName || formatUnitName(parentCourseId);
    const unitName = formatUnitName(canonicalUnitId);
    const coursePrice = parseInt(lesson?.price ?? 0, 10) || 0;
    const isPhysical = lesson?.isPhysical === true;
    const tutorName = auth.currentUser?.displayName || myEmail || '授課老師';

    const inviteParams = new URLSearchParams({
        action: 'addInviteItem',
        courseId,
        unitId: canonicalUnitId,
        referralLink,
        courseName,
        coursePrice: String(coursePrice),
        isPhysical: String(isPhysical)
    });
    const inviteUrl = `${PUBLIC_SITE_URL}/cart.html?${inviteParams.toString()}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(inviteUrl)}`;

    const letterText =
`親愛的同學您好：

歡迎加入 Vibe Coding 的「${courseName}」課程學習。
本次邀請學習單元為：${unitName}

請直接點擊下方專屬報名連結，系統會自動：
1. 在 Shopping Cart 加入此課程項目
2. 綁定我的教學作業邀請權限
3. 引導您完成登入與結帳

專屬報名連結：
${inviteUrl}

若您使用手機，也可以直接掃描我提供的 QR Code。

完成付款後，系統會立即開通課程，並自動建立您與授課老師的輔導關係，之後作業批改與作業連結也會依此關係運作。

如有任何問題，歡迎直接回覆我。

${tutorName}
Vibe Coding`;

    const mailtoSubject = `Vibe Coding 課程報名通知｜${courseName}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(mailtoSubject)}&body=${encodeURIComponent(letterText)}`;

    return {
        ready: true,
        inviteUrl,
        qrUrl,
        letterText,
        mailtoUrl
    };
}

window.buildPromoInviteKit = window.buildPromoInviteKit || window.buildReferralInviteKit;

async function copyTextToClipboard(text, successMessage = '已複製') {
    try {
        await navigator.clipboard.writeText(text);
        alert(successMessage);
    } catch (error) {
        console.error('Clipboard copy failed:', error);
        alert('複製失敗，請手動複製內容。');
    }
}

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

/**
 * [NEW] [V8.1] Fetches and parses Markdown content from a URL
 * Uses marked.js (included in dashboard.html)
 */
async function loadMarkdown(url) {
    try {
        console.log("[Markdown] Fetching from GitHub Raw:", url);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        const text = await resp.text();
        
        if (typeof marked !== 'undefined') {
            // Using marked.parse() for safer rendering
            return marked.parse(text);
        } else {
            console.warn("[Markdown] marked.js not loaded, returning raw text.");
            return `<pre class="whitespace-pre-wrap">${text}</pre>`;
        }
    } catch (e) {
        console.error("[Markdown] Error loading or parsing:", e);
        return `<div class="p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
            <h4 class="font-bold mb-1">無法讀取 GitHub README</h4>
            <p class="opacity-75">${e.message}</p>
        </div>`;
    }
}

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
        html += `<p class="text-xs text-slate-400 italic bg-white border border-slate-100 p-4 rounded-xl">目前沒有自動監控警示紀錄</p>`;
    } else {
        html += interventions.map(item => {
            const timeStr = item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : 'N/A';
            return `
                <div class="bg-red-55 border border-red-100 rounded-xl p-4 flex flex-col justify-between hover:shadow transition">
                    <div>
                        <div class="flex justify-between items-start gap-2 mb-1.5">
                            <span class="text-xs font-black text-slate-800 truncate">${escapeHtml(item.studentEmail)}</span>
                            <span class="text-[9px] text-slate-400 font-medium whitespace-nowrap">${timeStr}</span>
                        </div>
                        <div class="text-[10px] text-slate-500 capitalize mb-2">
                            單元：${escapeHtml(window.formatUnitIdForUI(item.unitId))}
                        </div>
                        <div class="text-xs text-red-700 bg-white/70 p-2.5 rounded-lg border border-red-50/50 mb-3">
                            <strong>原因：</strong> ${escapeHtml(item.triggerReason || '評分低於門檻')}
                        </div>
                    </div>
                    <div class="flex justify-end">
                        <button onclick="window.openGradingModal('${item.studentUid}_${item.assignmentId.replace('.html','')}')"
                            class="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow transition active:scale-95">
                            🧑‍💻 開始引導
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
                <span>學生主動回報卡點 (Student Blockers)</span>
            </h4>
    `;

    if (blockedAssignments.length === 0) {
        html += `<p class="text-xs text-slate-400 italic bg-white border border-slate-100 p-4 rounded-xl">目前沒有學生回報卡點</p>`;
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
                            單元：${escapeHtml(window.formatUnitIdForUI(a.unitId))}
                        </div>
                        <div class="mb-2"><span class="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 border border-amber-300 text-amber-800">${typeLabel}</span></div>
                        <div class="text-xs text-slate-700 bg-white/70 p-2.5 rounded-lg border border-amber-50/50 mb-3 whitespace-pre-wrap truncate max-h-[80px]">
                            ${escapeHtml(a.latestBlocker?.note || '無詳細說明')}
                        </div>
                    </div>
                    <div class="flex justify-end">
                        <button onclick="window.openGradingModal('${a.id}')"
                            class="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs shadow transition active:scale-95">
                            💡 給予指導
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
