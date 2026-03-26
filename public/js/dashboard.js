console.log("Dashboard Script v11_3_136 (Cache-Busted) Loaded");
// alert("Dashboard Script v5 Loaded"); // Uncomment if needed for hard debugging

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";

const firebaseConfig = {
    apiKey: "AIzaSyCO6Y6Pa7b7zbieJIErysaNF6-UqbT8KJw",
    authDomain: "e-learning-942f7.firebaseapp.com",
    projectId: "e-learning-942f7",
    storageBucket: "e-learning-942f7.firebasestorage.app",
    messagingSenderId: "878397058574",
    appId: "1:878397058574:web:28aaa07a291ee3baab165f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, 'asia-east1');

// DOM Elements
const loadingState = document.getElementById('loading-state');
const dashboardContent = document.getElementById('dashboard-content');
const accessDenied = document.getElementById('access-denied');
const userDisplay = document.getElementById('user-display');
const userUidDisplay = document.getElementById('user-uid-display');
const stats = {
    students: document.getElementById('stat-students'),
    hours: document.getElementById('stat-hours'),
};

const assignmentTableBody = document.getElementById('assignment-table-body');

// Admin UI
//const adminPanel = document.getElementById('admin-panel');


let myRole = null;
let charts = {};
let dashboardData = null;
let lessonsMap = {};
let allLessons = [];

// [NEW] Admin Super Mode state
let adminSuperMode = localStorage.getItem('adminSuperMode') === 'true';

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
            allLessons = await vibeFetchLessons();
        } else {
            // Fallback for standalone dev
            const res = await fetch('lessons.json');
            allLessons = await res.json();
        }
        
        console.log(`[Dashboard] Loaded ${allLessons.length} lessons from metadata source.`);
        allLessons.forEach(l => {
            lessonsMap[l.courseId] = l.title;
        });
    } catch (e) {
        console.error("Failed to load lessons:", e);
    }
}


// Initialize on Load
// loadDashboard(); // This is called in onAuthStateChanged

// --- Main Data Fetching ---
async function loadDashboard() {
    try {
        const getDashboardData = httpsCallable(functions, 'getDashboardData');
        const response = await getDashboardData();
        const data = response.data;

        // [FIX] Aggregate data (map filename IDs to real Course IDs)
        aggregateData(data);

        dashboardData = data;

        // [FIX] Ensure allLessons is populated. If loadLessons() failed, use the lessons
        // embedded in the dashboard response (if backend provides them) or re-fetch now.
        if (!allLessons || allLessons.length === 0) {
            if (data.lessons && data.lessons.length > 0) {
                allLessons = data.lessons;
                allLessons.forEach(l => { lessonsMap[l.courseId] = l.title; });
                console.log(`[Dashboard] Populated allLessons from data.lessons: ${allLessons.length}`);
            } else if (typeof vibeFetchLessons === 'function') {
                allLessons = await vibeFetchLessons();
                allLessons.forEach(l => { lessonsMap[l.courseId] = l.title; });
                console.log(`[Dashboard] Re-fetched allLessons: ${allLessons.length}`);
            }
        }

        myRole = data.role;
        console.log("Role:", myRole);

        // [MODIFIED] Access Control: Global Admin/Teacher OR Course-Specific Teacher
        const isAuthorizedTeacher = data.courseConfigs && Object.keys(data.courseConfigs).length > 0;

        const urlParams = new URLSearchParams(window.location.search);
        const filterUnitId = urlParams.get('unitId');

        if (myRole === 'admin' || myRole === 'teacher' || isAuthorizedTeacher || adminSuperMode) {
            // Admin/Teacher View (Management)
            setupAdminFeatures();
            setupGradingFunctions();
            setupSettingsFeature();
            renderAdminDashboard(data, filterUnitId);

            // [MODIFIED] Automatically refresh the UI and handle tab switching for filtered units
            const activeTab = document.querySelector('.tab-btn.text-blue-600');
            if (activeTab) {
                const tabId = activeTab.id.replace('tab-btn-', '');

                // If filtered to a unit and on Overview, switch to Assignments or Settings
                if (filterUnitId && tabId === 'overview') {
                    // Default to assignments if filtered to a unit
                    switchTab('assignments');
                } else {
                    if (tabId === 'admin') renderAdminConsole();
                    if (tabId === 'settings') renderSettingsTab(filterUnitId);
                    if (tabId === 'assignments') {
                        // Handled by renderAdminDashboard or switchTab
                    }
                }
            }
        } else if (myRole === 'student') {
            // Student View (Personal Stats)
            renderStudentDashboard(data, filterUnitId);
        } else {
            showAccessDenied();
        }

    } catch (error) {
        console.error("Dashboard Load Error:", error);
        showAccessDenied(error.message);
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
        if (deniedTitle) deniedTitle.innerText = "👋 您好！閣下尚未登入";
        if (deniedMsg) deniedMsg.innerText = "本頁面為個人學習儀表板，請登入以查看您的數據。";
        if (guestView) guestView.classList.remove('hidden');
        if (adminSetupNote) adminSetupNote.classList.add('hidden');
    } else {
        // Show Access Denied (Logged in but no permission)
        if (deniedTitle) deniedTitle.innerText = "⛔ 權限不足";
        if (deniedMsg) deniedMsg.innerText = "只有老師或管理員可以訪問此管理頁面。";
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

// Helper: Resolve URL param (e.g. "basic-01") to Course UUID
function resolveCourseIdFromUrlParam(paramId) {
    if (!paramId) return null;
    if (!allLessons || allLessons.length === 0) return paramId;

    // 1. Direct match (UUID)
    const direct = allLessons.find(l => l.courseId === paramId);
    if (direct) return paramId;

    // 2. Fuzzy match (Classroom URL contains param)
    const fuzzy = allLessons.find(l => l.classroomUrl && l.classroomUrl.includes(paramId));
    if (fuzzy) {
        console.log(`Resolved URL value '${paramId}' to Course ID '${fuzzy.courseId}'`);
        return fuzzy.courseId;
    }

    return paramId;
}

function normalizeUnitId(unitId) {
    if (!unitId || typeof unitId !== 'string') return '';
    return unitId.split('#')[0].split('?')[0].trim();
}

// --- Rendering ---
function renderStudentDashboard(data, filterUnitId = null) {
    loadingState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');

    // 1. Personal Stats (Find my own data from students array or separate object)
    // For students, getDashboardData returns 'students' array containing ONLY the requesting student
    const myData = data.students[0] || { totalTime: 0, videoTime: 0, docTime: 0, isActive: true };

    // Parse params
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    // Parse courseId from URL and resolve to UUID
    let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));

    let displayAssignments = data.assignments;
    let displayCourseProgress = myData.courseProgress || {};

    // Filter if courseId is present
    if (filterCourseId) {
        // [NEW] Filter assignments by unit if present
        if (filterUnitId) {
            displayAssignments = displayAssignments.filter(a => a.unitId === filterUnitId);
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

    let courseTitle = filterCourseId ? (lessonsMap[filterCourseId] || filterCourseId) : "我的學習概況";
    if (filterUnitId) courseTitle += ` - ${formatUnitName(filterUnitId)}`;

    container.innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-gray-800">${escapeHtml(courseTitle)}</h2>
            ${filterCourseId && mode !== 'iframe' ? '<a href="dashboard.html" class="text-sm text-blue-600 hover:underline">← 查看所有課程</a>' : ''}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="card border-l-4 border-blue-500">
                <p class="text-gray-500 text-sm font-medium">${filterUnitId ? '本單元學習時數' : '學習時數'}</p>
                <h3 class="text-3xl font-bold text-gray-800 mt-1">${((myData.totalTime || 0) / 3600).toFixed(1)} <span class="text-sm font-normal text-gray-400">hours</span></h3>
            </div>
            <div class="card border-l-4 border-purple-500">
                <p class="text-gray-500 text-sm font-medium">作業繳交</p>
                <h3 class="text-3xl font-bold text-gray-800 mt-1">${displayAssignments.length} <span class="text-sm font-normal text-gray-400">submitted</span></h3>
            </div>
             <div class="card border-l-4 border-green-500">
                <p class="text-gray-500 text-sm font-medium">帳號狀態</p>
                <h3 class="text-3xl font-bold text-green-600 mt-1">Active</h3>
            </div>
        </div>

        <!-- My Assignments -->
        <div class="card">
            <h3 class="text-lg font-bold text-gray-800 mb-4">我的作業 (My Assignments)</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-sm text-gray-500 border-b">
                            <th class="py-3 px-2">作業名稱</th>
                            <th class="py-3 px-2">提交時間</th>
                            <th class="py-3 px-2">狀態</th>
                            <th class="py-3 px-2 text-right">分數</th>
                            <th class="py-3 px-2 text-right">評語</th>
                        </tr>
                    </thead>
                    <tbody class="text-sm text-gray-700 divide-y">
                        ${displayAssignments.length > 0 ? displayAssignments.map(a => `
                            <tr class="hover:bg-gray-50">
                                <td class="py-3 px-2 font-medium">${escapeHtml(a.assignmentTitle)}</td>
                                <td class="py-3 px-2 text-gray-500 text-xs">${a.submittedAt ? new Date(a.submittedAt.seconds * 1000).toLocaleString() : '-'}</td>
                                <td class="py-3 px-2">
                                    <span class="px-2 py-1 rounded text-xs font-bold ${a.grade ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                                        ${a.grade ? '已評分' : '待批改'}
                                    </span>
                                </td>
                                <td class="py-3 px-2 text-right font-bold text-blue-600">${a.grade !== null ? a.grade : '-'}</td>
                                <td class="py-3 px-2 text-right text-gray-500 max-w-xs truncate" title="${escapeHtml(a.teacherFeedback)}">
                                    ${a.teacherFeedback ? escapeHtml(a.teacherFeedback) : '-'}
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" class="py-4 text-center text-gray-500">此課程尚無繳交作業</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Detailed Activity Chart -->
        <div class="card mt-8">
             <div class="flex flex-col md:flex-row gap-8 items-center">
                <div class="w-full md:w-1/3">
                    <h3 class="text-lg font-bold text-gray-800 mb-2">學習分佈</h3>
                    <canvas id="chart-activity"></canvas>
                </div>
                <div class="w-full md:w-2/3">
                     <h3 class="text-lg font-bold text-gray-800 mb-4">課程進度詳情</h3>
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
                        `).join('') : '<p class="text-gray-500">尚無學習紀錄</p>'}
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
}

function renderAdminDashboard(data, filterUnitId = null) {
    filterUnitId = normalizeUnitId(filterUnitId);
    loadingState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');

    // Tab Buttons
    const adminTabBtn = document.getElementById('tab-btn-admin');
    const settingsTabBtn = document.getElementById('tab-btn-settings');
    const earningsTabBtn = document.getElementById('tab-btn-earnings');

    // 1. Admin Tab (Always Admin-only, toggle on SuperMode if preferred, or just leave as is)
    if (adminTabBtn) {
        if (myRole === 'admin') {
            adminTabBtn.classList.toggle('hidden', !adminSuperMode); // Admins only see this in SuperMode
        } else {
            adminTabBtn.classList.add('hidden');
        }
    }

    // 2. Settings & Earnings Tabs (Role-based & Authorization-based)
    const urlParams = new URLSearchParams(window.location.search);
    let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));

    let isAuthorizedForManagement = false;
    
    if (myRole === 'admin') {
        // Admin: Only see these if SuperMode is ON
        isAuthorizedForManagement = adminSuperMode;
    } else if (myRole === 'teacher') {
        // Teacher: Show if authorized for the current view
        if (filterUnitId) {
            isAuthorizedForManagement = !!(data.courseConfigs && data.courseConfigs[filterUnitId]);
        } else if (filterCourseId) {
            isAuthorizedForManagement = !!(data.courseConfigs && data.courseConfigs[filterCourseId]);
        } else {
            // Global view: show if any authorized courses exist
            isAuthorizedForManagement = !!(data.courseConfigs && Object.keys(data.courseConfigs).length > 0);
        }
    }

    if (settingsTabBtn) {
        settingsTabBtn.classList.toggle('hidden', !isAuthorizedForManagement);
    }
    if (earningsTabBtn) {
        earningsTabBtn.classList.toggle('hidden', !isAuthorizedForManagement);
    }

    // Stats (Base on filtered students if unit is selected)
    let summaryStudents = data.summary?.totalStudents || 0;
    let summaryHours = data.summary?.totalHours || 0;

    if (filterUnitId) {
        // [USER_REQUEST] Overview stats should reflect currently filtered list
        const unitStudents = (data?.students || []).filter(s => {
            const orders = s.orders || [];
            const parentCourse = (allLessons || []).find(l => l.courseUnits && l.courseUnits.includes(filterUnitId));
            return parentCourse && orders.includes(parentCourse.courseId);
        });
        summaryStudents = unitStudents.length;
        summaryHours = unitStudents.reduce((acc, curr) => {
            const up = curr.courseProgress?.[filterUnitId] || {}; // This is not quite right because filterUnitId is unit name? 
            // In dashboard.js, unitFile is used for progress mapping. 
            // Let's find unitFile for filterUnitId.
            return acc + (curr.totalTime || 0); // Placeholder until I verify the time mapping
        }, 0) / 3600;

        // Let's refine the time calculation to be more accurate for the filtered view
        if (unitStudents.length > 0) {
            summaryHours = unitStudents.reduce((acc, curr) => {
                const progress = curr.courseProgress || {};
                // If we filter to a course, sum up all units in that course for this student
                // If we filter to a unit, just that unit.
                let studentFilteredTime = 0;
                if (filterUnitId) {
                    // Try to find the progress for this specific unit
                    // Note: curr.courseProgress keys are usually courseIds, but unit-level data is nested
                    // I need to check the data structure again. 
                }
                return acc + (curr.totalTime || 0); // Default to total if unit-specific sum is complex
            }, 0) / 3600;
        }
    }

    if (stats.students) stats.students.textContent = summaryStudents;
    if (stats.hours) stats.hours.textContent = summaryHours.toFixed(1);


    // [NEW] Hide Overview Tab if filtered to a specific unit
    const overviewTabBtn = document.getElementById('tab-btn-overview');
    if (overviewTabBtn) {
        if (filterUnitId) { // [USER_REQUEST] Use unitId here
            overviewTabBtn.classList.add('hidden');
            // Logic moved to loadDashboard for better flow
        } else {
            overviewTabBtn.classList.remove('hidden');
        }
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

    // Table with Expansion
    const tbody = document.getElementById('student-table-body');
    tbody.innerHTML = data.students.map(s => {
        const courses = s.courseProgress || {};

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

        const courseRows = Object.entries(courses).map(([cid, progress]) => {
            const courseTitle = lessonsMap[cid] || cid;
            // Highlight the filtered course if needed?
            const isMatch = filterCourseId && cid === filterCourseId;

            // [Feature] Hide other courses if a filter is active
            if (filterCourseId && !isMatch) return '';

            const bgClass = isMatch ? "bg-blue-50" : "bg-gray-50";

            const courseUnitsId = `units-${s.uid}-${cid.replace(/\./g, '-')}`;

            // Render Main Course Row
            let html = `
                <tr class="${bgClass} text-[10px] md:text-xs border-b border-gray-100 cursor-pointer hover:bg-gray-100" onclick="toggleCourseRows('${courseUnitsId}', event)">
                    <td class="pl-4 md:pl-8 py-1.5 md:py-2 border-l-4 ${isMatch ? 'border-blue-400 font-bold' : 'border-gray-200'} text-gray-800 flex items-center gap-1 md:gap-2">
                        <span id="icon-${courseUnitsId}" class="text-[8px] transform transition-transform">▶</span>
                        <span>${escapeHtml(courseTitle)}</span>
                    </td>
                    <td class="text-right py-1.5 md:py-2 font-bold">${(progress.total / 60).toFixed(0)}m</td>
                    <td class="text-right py-1.5 md:py-2 text-blue-600">${(progress.video / 60).toFixed(0)}m</td>
                    <td class="text-right py-1.5 md:py-2 text-purple-600">${(progress.doc / 60).toFixed(0)}m</td>
                    <td class="py-1.5 md:py-2"></td>
                </tr>
            `;

            // Wrap units in a toggleable container 
            // We'll use a specific class for the unit rows
            const unitRowsClass = `course-unit-${courseUnitsId}`;

            // Render Unit Rows (if any)
            if (progress.units) {
                const sortedUnits = Object.entries(progress.units)
                    .filter(([unitKey]) => (!filterUnitId || unitKey === filterUnitId) && !unitKey.includes('-master-'))
                    .sort();
                const unitRows = sortedUnits.map(([unitKey, unitStats]) => {
                    // Format Unit Name
                    const unitName = formatUnitName(unitKey);

                    const unitLogsId = `logs-${s.uid}-${cid}-${unitKey.replace(/\./g, '-')}`;

                    const logRowsHtml = (unitStats.logs || []).sort((a, b) => {
                        // Sort logs descending by timestamp
                        const tA = a.timestamp && a.timestamp._seconds ? a.timestamp._seconds : 0;
                        const tB = b.timestamp && b.timestamp._seconds ? b.timestamp._seconds : 0;
                        return tB - tA;
                    }).map(log => {
                        let timeStr = '-';
                        if (log.timestamp) {
                            if (log.timestamp._seconds) timeStr = new Date(log.timestamp._seconds * 1000).toLocaleString();
                            else timeStr = new Date(log.timestamp).toLocaleString();
                        }
                        return `
                        <tr class="${bgClass} text-[9px] text-gray-400 italic unit-log-${unitLogsId}" style="display: none !important;">
                            <td class="pl-16 py-0.5 border-l-2 border-dashed border-gray-200">
                                ${timeStr} - ${log.action}
                            </td>
                            <td class="text-right py-0.5">${(log.duration / 60).toFixed(1)}m</td>
                            <td colspan="3"></td>
                        </tr>`;
                    }).join('');

                    return `
                    <tr class="${bgClass} ${unitRowsClass} text-[10px] text-gray-500 hover:bg-gray-100 cursor-pointer" style="display: none !important;" onclick="toggleUnitLogs('${unitLogsId}', event)">
                        <td class="pl-12 py-1 flex items-center gap-1 font-semibold">
                            <span class="text-gray-300">↳</span> 
                            <span id="icon-${unitLogsId}" class="text-[8px] transform transition-transform">▶</span>
                            <span>${escapeHtml(unitName)}</span>
                        </td>
                        <td class="text-right py-1">${(unitStats.total / 60).toFixed(0)}m</td>
                        <td class="text-right py-1">${(unitStats.video / 60).toFixed(0)}m</td>
                        <td class="text-right py-1 md:py-1">${(unitStats.doc / 60).toFixed(0)}m</td>
                        <td class="py-1 md:py-1"></td>
                    </tr>
                    ${logRowsHtml}
                    `;
                }).join('');
                html += unitRows;
            }

            return html;
        }).join('');

        return `
        <tr class="hover:bg-gray-50 transition border-b border-gray-100 cursor-pointer text-xs md:text-sm" onclick="toggleRow('${s.uid}')">
            <td class="py-2 px-1 sm:py-3 sm:px-2 font-medium text-gray-800 flex items-center gap-1 md:gap-2">
                <span id="icon-${s.uid}" class="text-gray-400 w-3 md:w-4 inline-block transform transition-transform">▶</span>
                <span class="truncate max-w-[120px] md:max-w-none">${escapeHtml(s.email)}</span>
            </td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-right font-mono text-blue-600">${(displayTotal / 3600).toFixed(1)}h</td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-right text-gray-500 text-[10px] md:text-xs text-nowrap">
                <span title="Video">${(displayVideo / 60).toFixed(0)}m</span>
            </td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-right text-gray-500 text-[10px] md:text-xs text-nowrap">
                <span title="Doc">${(displayDoc / 60).toFixed(0)}m</span>
            </td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-right text-[10px] md:text-xs text-gray-400 hidden sm:table-cell">
                ${s.lastActive && !isNaN(new Date(s.lastActive)) ? new Date(s.lastActive).toLocaleString() : '-'}
            </td>
        </tr>
        <tbody id="detail-${s.uid}" class="hidden border-b border-gray-200">
            ${courseRows.length ? courseRows : '<tr><td colspan="5" class="py-2 text-center text-xs text-gray-400">No specific course activity</td></tr>'}
        </tbody>
        `;
    }).join('');

    // [NEW] Use filterUnitId for chart and assignment filtering if courseId is present
    let chartData = data.students;
    let displayAssignments = data.assignments;

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

        if (filterUnitId) {
            displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId && a.unitId === filterUnitId);
        } else {
            displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
        }
    }

    const guideContent = resolveAssignmentGuide(data, filterCourseId, filterUnitId);

    renderChart(chartData);
    renderAssignments(displayAssignments, guideContent);
}

// Helper: Resolve assignment guide for a unit
function resolveAssignmentGuide(data, filterCourseId, filterUnitId) {
    if (!filterCourseId || !filterUnitId) return "";
    filterUnitId = normalizeUnitId(filterUnitId);

    try {
        const rawInstructor = (data.courseConfigs && data.courseConfigs[filterCourseId]) ? data.courseConfigs[filterCourseId].instructorGuide : null;
        const rawAssignment = (data.courseConfigs && data.courseConfigs[filterCourseId]) ? data.courseConfigs[filterCourseId].assignmentGuide : null;

        const guideData = robustExtractGuideSegments(rawInstructor, rawAssignment);

        // Flexible resolution: try raw, then with .html, then without .html, then unit number
        const cleanUnitId = filterUnitId.replace('.html', '');
        let assignmentGuide = guideData.assignmentGuides[filterUnitId] ||
            guideData.assignmentGuides[cleanUnitId] ||
            guideData.assignmentGuides[cleanUnitId + '.html'] || "";

        console.log(`[Debug] Guide resolution for ${filterUnitId}: ${assignmentGuide ? 'Found by FileName/CleanID' : 'Not Found by ID'}`);

        if (!assignmentGuide.trim()) {
            const lesson = allLessons.find(l => l.courseId === filterCourseId);
            const units = lesson?.courseUnits || [];

            // Search using clean names
            const unitIdx = units.findIndex(u => u.replace('.html', '') === cleanUnitId);
            if (unitIdx !== -1) {
                const unitNum = unitIdx + 1;
                assignmentGuide = (guideData.assignmentGuides[unitNum] || "").trim();
                console.log(`[Debug] Fallback guide for index ${unitNum}: ${assignmentGuide ? 'Found' : 'Not Found'}`);
            }
        }
        return assignmentGuide;
    } catch (err) {
        console.error("[Debug] Error resolving assignment guide:", err);
        return "";
    }
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

window.toggleRow = function (uid) {
    const detail = document.getElementById(`detail-${uid}`);
    const icon = document.getElementById(`icon-${uid}`);
    if (detail.classList.contains('hidden')) {
        detail.classList.remove('hidden');
        icon.textContent = '▼';
    } else {
        detail.classList.add('hidden');
        icon.textContent = '▶';
    }
};

window.handleAssignmentClick = function (courseId, unitId) {
    const cfg = (dashboardData && dashboardData.courseConfigs) ? dashboardData.courseConfigs[courseId] : null;
    const inviteLink = cfg && cfg.githubClassroomUrls ? cfg.githubClassroomUrls[unitId] : null;

    if (inviteLink) {
        let finalUrl = inviteLink;
        if (typeof inviteLink === 'object') {
            finalUrl = inviteLink.default || Object.values(inviteLink)[0];
        }
        window.open(finalUrl, '_blank');
    } else {
        alert("此單元尚未設定 GitHub Classroom 邀請連結，請管理員/老師至「課程設定」中設定。");
    }
};

function renderAssignments(assignments, guideContent = "") {
    if (assignmentTableBody) {
        if (!assignments || assignments.length === 0) {
            assignmentTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">尚無作業繳交紀錄</td></tr>`;
        } else {
            assignmentTableBody.innerHTML = assignments.map(a => {
                // Safe date handling
                let submittedDate = 'N/A';
                const ts = a.updatedAt || a.submittedAt;
                if (ts) {
                    if (ts._seconds) submittedDate = new Date(ts._seconds * 1000).toLocaleString();
                    else if (ts.seconds) submittedDate = new Date(ts.seconds * 1000).toLocaleString();
                    else submittedDate = new Date(ts).toLocaleString();
                }

                const title = lessonsMap[a.courseId] || a.courseId;
                const currentStatus = a.currentStatus || a.status || 'new'; // Fallback to 'status' field

                const statusColors = {
                    'submitted': 'bg-yellow-100 text-yellow-800',
                    'graded': 'bg-green-100 text-green-800',
                    'new': 'bg-gray-100 text-gray-800'
                };
                const statusLabel = {
                    'submitted': '待評分',
                    'graded': '已評分',
                    'new': '新作業'
                };
                const badge = `<span class="${statusColors[currentStatus] || 'bg-gray-100'} px-2 py-0.5 rounded text-xs font-bold">${statusLabel[currentStatus] || currentStatus}</span>`;

                // Clean up Unit ID for display
                let displayUnit = a.unitId || '';
                displayUnit = displayUnit.replace('.html', '').replace(/-/g, ' ');
                const unitMatch = displayUnit.match(/unit\s+(.+)/i);
                if (unitMatch) displayUnit = unitMatch[1]; // Try to extract meaningful part

                return `
                <tr class="lg:hover:bg-blue-50/50 transition border-b border-gray-100 cursor-pointer group text-xs md:text-sm" onclick="handleAssignmentClick('${a.courseId}', '${a.unitId}')">
                    <td class="py-2 px-1 sm:py-3 sm:px-2 text-gray-800">
                        <div class="font-medium group-hover:text-blue-600 transition-colors truncate max-w-[100px] md:max-w-none">${escapeHtml(a.studentEmail || a.userEmail)}</div>
                    </td>
                    <td class="py-2 px-1 sm:py-3 sm:px-2 text-[10px] md:text-sm text-gray-600">
                        <div class="font-bold text-[10px] md:text-xs text-gray-700 truncate max-w-[80px] md:max-w-none">${escapeHtml(title)}</div>
                        <div class="text-[10px] text-gray-500 capitalize">${escapeHtml(displayUnit)}</div>
                    </td>
                    <td class="py-2 px-1 sm:py-3 sm:px-2 text-[10px] text-gray-500">${submittedDate}</td>
                    <td class="py-2 px-1 sm:py-3 sm:px-2">${badge}</td>
                    <td class="py-2 px-1 sm:py-3 sm:px-2 font-bold text-gray-700">${a.grade !== null && a.grade !== undefined ? a.grade : '-'}</td>
                    <td class="py-2 px-1 sm:py-3 sm:px-2 text-right">
                        <button onclick="event.stopPropagation(); openGradingModal('${a.id}')" 
                            class="bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-700 px-2 py-0.5 sm:px-3 sm:py-1 rounded text-[10px] sm:text-xs font-bold transition">
                            評分
                        </button>
                    </td>
                </tr>
            `}).join('');
        }
    }

    // [NEW] Append Assignment Guide below the table
    if (guideContent) {
        const guideHtml = `
            <div class="mt-8 p-4 md:p-6 bg-blue-50 border border-blue-100 rounded-xl shadow-inner overflow-x-auto">
                <div class="instructor-guide-content text-sm md:text-base text-blue-900/90 leading-relaxed prose prose-blue max-w-none">
                    ${guideContent}
                </div>
            </div>
        `;
        // Find existing or append
        const container = document.getElementById('view-assignments');
        if (container) {
            // Remove old guide if any to avoid duplicates
            const oldGuide = container.querySelector('.bg-blue-50');
            if (oldGuide) oldGuide.remove();

            const wrapper = document.createElement('div');
            wrapper.innerHTML = guideHtml;
            container.appendChild(wrapper.firstElementChild);
        }
    } else {
        // Clear guide if none
        const container = document.getElementById('view-assignments');
        if (container) {
            const oldGuide = container.querySelector('.bg-blue-50');
            if (oldGuide) oldGuide.remove();
        }
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
    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    // Show target content
    document.getElementById(`view-${tabName}`).classList.remove('hidden');

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

    // [NEW] Trigger specific tab data loading
    if (tabName === 'settings') {
        const urlParams = new URLSearchParams(window.location.search);
        const filterUnitId = normalizeUnitId(urlParams.get('unitId'));
        console.log("[Dashboard] Rendering Settings for unitId:", filterUnitId);
        renderSettingsTab(filterUnitId);
    }
    if (tabName === 'assignments') {
        const urlParams = new URLSearchParams(window.location.search);
        const filterUnitId = normalizeUnitId(urlParams.get('unitId'));
        let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));

        let displayAssignments = dashboardData.assignments;
        if (filterCourseId) {
            if (filterUnitId) {
                displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId && a.unitId === filterUnitId);
            } else {
                displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
            }
        }

        // [NEW] Extract and pass assignment guide
        let assignmentGuide = "";
        if (filterCourseId && filterUnitId) {
            try {
                const rawInstructor = (dashboardData.courseConfigs && dashboardData.courseConfigs[filterCourseId]) ? dashboardData.courseConfigs[filterCourseId].instructorGuide : null;
                const rawAssignment = (dashboardData.courseConfigs && dashboardData.courseConfigs[filterCourseId]) ? dashboardData.courseConfigs[filterCourseId].assignmentGuide : null;

                const guideData = robustExtractGuideSegments(rawInstructor, rawAssignment);

                // Flexible resolution: try raw, then with .html, then without .html, then unit number
                const cleanUnitId = filterUnitId.replace('.html', '');
                assignmentGuide = (guideData.assignmentGuides[filterUnitId] ||
                    guideData.assignmentGuides[cleanUnitId] ||
                    guideData.assignmentGuides[cleanUnitId + '.html'] || "").trim();

                if (!assignmentGuide) {
                    const lesson = allLessons.find(l => l.courseId === filterCourseId);
                    const units = lesson?.courseUnits || [];

                    // Search using clean names
                    const unitIdx = units.findIndex(u => u.replace('.html', '') === cleanUnitId);
                    if (unitIdx !== -1) {
                        assignmentGuide = (guideData.assignmentGuides[unitIdx + 1] || "").trim();
                    }
                }
                console.log(`[Debug] Guide resolution (switchTab) for ${filterUnitId}: ${assignmentGuide ? 'Found' : 'Not Found'}`);
            } catch (guideErr) {
                console.error("[Debug] Error resolving assignment guide in switchTab:", guideErr);
            }
        }
        renderAssignments(displayAssignments, assignmentGuide);
    }
    if (tabName === 'admin') {
        renderAdminConsole();
    }
    if (tabName === 'earnings') {
        renderEarningsTab(dashboardData);
    }
};

// --- Admin Features ---
function setupAdminFeatures() {
    // Admin features are now initialized during renderAdminConsole
}

function renderAdminConsole() {
    if (myRole !== 'admin') return;

    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = urlParams.get('unitId');

    const adminPanel = document.getElementById('admin-panel');
    if (!adminPanel) return;

    let html = `
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <h3 class="text-2xl font-black text-orange-900 flex items-center gap-3">
                <span class="p-2.5 bg-orange-100 rounded-xl">🛠️</span> 
                課程管理控制台 (Course Management)
            </h3>
            
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-gray-100 shadow-sm">
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">超級模式 / Super Mode</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" value="" class="sr-only peer" ${adminSuperMode ? 'checked' : ''} onchange="toggleAdminSuperMode(this.checked)">
                        <div class="w-10 h-5 bg-gray-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                </div>
            </div>

            <p id="admin-msg" class="text-sm font-bold text-orange-600 animate-pulse"></p>
        </div>
    `;

    try {
        let lessonRows = allLessons.map(lesson => {
            try {
                const config = dashboardData?.courseConfigs?.[lesson.courseId] || {};
                let units = lesson.courseUnits || [];
                const unitConfigs = config.githubClassroomUrls || {};
                let allFiles = Array.from(new Set([...units, ...Object.keys(unitConfigs)]))
                    .filter(f => f && !f.includes('-master-'));

                if (filterUnitId) {
                    allFiles = allFiles.filter(f => f === filterUnitId);
                }

                if (allFiles.length === 0) return '';

                return allFiles.map(unitFile => {
                    const unitDocConfig = dashboardData?.courseConfigs?.[unitFile] || {};
                    const unitTeachersArr = Array.isArray(unitDocConfig.authorizedTeachers) ? unitDocConfig.authorizedTeachers : [];
                    const legacyTeachers = (unitConfigs[unitFile] && typeof unitConfigs[unitFile] === 'object') ? Object.keys(unitConfigs[unitFile]) : [];
                    const unitTeachers = Array.from(new Set([...unitTeachersArr, ...legacyTeachers])).filter(t => t && t !== 'default');
                    const unitName = formatUnitName(unitFile) || unitFile;

                    const isSelected = filterUnitId && unitFile === filterUnitId;
                    const containerClass = isSelected ? "bg-blue-50/60 border-l-4 border-blue-500 shadow-sm z-10" : "hover:bg-orange-50/20 transition-colors";
                    const inputId = `input-auth-${lesson.courseId}-${unitFile}`.replace(/[^a-z0-9]/gi, '-');

                    return `
                        <div class="flex flex-col ${containerClass} p-6 gap-6 relative">
                            <!-- Section 1: Unit Info -->
                            <div>
                                <div class="text-[11px] text-orange-400 font-black uppercase mb-1.5 tracking-widest">課程單元 / Unit</div>
                                <div class="text-xs text-gray-400 font-mono mb-1 leading-relaxed">${escapeHtml(lesson.title)}</div>
                                <div class="text-lg font-black text-gray-800 flex items-center gap-2">${escapeHtml(unitName)}</div>
                                <div class="text-xs text-gray-400 font-mono mt-1.5 opacity-80">${escapeHtml(unitFile)}</div>
                            </div>

                            <!-- Section 2: Teacher Management -->
                            <div>
                                <div class="text-[11px] text-orange-400 font-black uppercase mb-3.5 tracking-widest">合格教師 / Teachers</div>
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
                                            ${unitTeachers.length > 0
                            ? unitTeachers.map(email => {
                                const details = unitDocConfig.teacherDetails?.[email.replace(/\./g, '_DOT_')] || {};
                                const name = details.name || email.split('@')[0];
                                const time = details.qualifiedAt ? new Date(details.qualifiedAt).toLocaleString('zh-TW', { hour12: false }) : '歷史數據';

                                return `
                                            <tr class="hover:bg-orange-50/20 transition-colors group/row">
                                                <td class="py-2.5 px-4 font-bold text-gray-800">${escapeHtml(name)}</td>
                                                <td class="py-2.5 px-4 font-mono text-gray-500">${escapeHtml(email)}</td>
                                                <td class="py-2.5 px-4 text-gray-400">${escapeHtml(time)}</td>
                                                <td class="py-2.5 px-4 text-right">
                                                    <button onclick="handleUnitTeacherAuth('${lesson.courseId}', '${unitFile}', '${email}', 'remove')" 
                                                        class="text-gray-300 hover:text-red-600 transition-colors p-1 opacity-0 group-hover/row:opacity-100">
                                                        移除 ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                            }).join('')
                            : '<tr><td colspan="4" class="py-8 text-center text-gray-300 italic">目前無核心授權教師</td></tr>'
                        }
                                        </tbody>
                                    </table>
                                </div>

                                <div class="flex flex-col sm:flex-row gap-3 max-w-2xl">
                                    <input type="email" id="${inputId}" placeholder="教師 Email (e.g. user@gmail.com)" 
                                        class="flex-grow px-4 py-2.5 text-xs border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-200 bg-white shadow-sm transition-all font-mono">
                                    <button onclick="handleUnitTeacherAuth('${lesson.courseId}', '${unitFile}', document.getElementById('${inputId}').value, 'add')"
                                        class="px-8 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-black hover:bg-orange-600 transition-all shadow-md active:scale-95 whitespace-nowrap">
                                        新增合格教師 👤
                                    </button>
                                </div>
                            </div>

                             <!-- Section 3: Student Management -->
                             <div>
                                 <div class="text-[11px] text-orange-400 font-black uppercase mb-3.5 tracking-widest">已付款學生 / Students</div>
                                 <div class="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                                     <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-white/50">
                                         <div class="text-[10px] text-gray-500 font-bold">此清單僅顯示該單元所屬課程之成功付款學生</div>
                                         <button onclick="exportToCSV()" class="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded-lg font-black hover:bg-blue-700 transition shadow-sm">
                                             📊 導出清單 (CSV)
                                         </button>
                                     </div>
                                     <table class="w-full text-left border-collapse text-[11px]">
                                        <thead>
                                            <tr class="bg-gray-100/50 text-gray-500 border-b border-gray-100 uppercase tracking-tighter font-black">
                                                <th class="py-2.5 px-4">姓名 / Name</th>
                                                <th class="py-2.5 px-4">學生 Email</th>
                                                <th class="py-2.5 px-4">目前指派教師</th>
                                                <th class="py-2.5 px-4 text-right">變更指派</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-gray-100 bg-white">
                                            ${(() => {
                            const unitStudents = (dashboardData?.students || []).filter(s => {
                                const orders = s.orders || [];
                                // Find parent course for this unit
                                const parentCourse = (allLessons || []).find(l => l.courseUnits && l.courseUnits.includes(unitFile));
                                return parentCourse && orders.includes(parentCourse.courseId);
                            });

                            if (unitStudents.length === 0) return '<tr><td colspan="3" class="py-4 text-center text-gray-400 italic">無授權學生</td></tr>';

                            return unitStudents.map(s => {
                                const unitAssignedTeacher = (s.unitAssignments && s.unitAssignments[unitFile]) ? s.unitAssignments[unitFile] : null;

                                return `
                                            <tr class="hover:bg-orange-50/10 transition-colors">
                                                <td class="py-2 px-4 font-bold text-gray-800">${escapeHtml(s.name || '—')}</td>
                                                <td class="py-2 px-4 font-mono text-gray-500">${escapeHtml(s.email)}</td>
                                                <td class="py-2 px-4">
                                                    <span class="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md font-bold">
                                                        ${unitAssignedTeacher ? escapeHtml(unitAssignedTeacher) : '尚未指派'}
                                                    </span>
                                                </td>
                                                <td class="py-2 px-4 text-right">
                                                    <select onchange="handleAssignTeacher('${s.uid}', '${unitFile}', this.value)" 
                                                        class="bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-orange-200 text-[10px] font-bold text-gray-600">
                                                        <option value="">-- 指派教師 --</option>
                                                        ${unitTeachers.map(t => `<option value="${t}" ${unitAssignedTeacher === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
                                                        <option value="none">移除指派</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        `;
                            }).join('');
                        })()}
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
        console.error("Admin Console Crash:", totalErr);
        html += `<div class="p-8 text-center bg-red-50 text-red-600 rounded-2xl border border-red-100">
            <h4 class="font-black mb-2">管理控制台發生錯誤</h4>
            <p class="text-xs opacity-75">${totalErr.message}</p>
        </div>`;
    }

    adminPanel.innerHTML = html;
}

window.handleUnitTeacherAuth = async function (courseId, unitFile, teacherEmail, action) {
    if (!teacherEmail) return alert("請輸入 Email");
    const msg = document.getElementById('admin-msg');

    try {
        if (msg) msg.textContent = action === 'add' ? "正在新增單元授權..." : "正在移除單元授權...";

        // [MODIFIED] Use the unit filename as the courseId for the auth function
        // This targets course_configs/{unitFileName}
        const authFunc = httpsCallable(functions, 'authorizeTeacherForCourse');
        await authFunc({ courseId: unitFile, teacherEmail, action });

        loadDashboard(); // Refresh UI
    } catch (e) {
        console.error("Unit Auth Error:", e);
        alert("授權失敗: " + e.message);
    } finally {
        if (msg) msg.textContent = "";
    }
};

window.toggleAdminSuperMode = function (enabled) {
    adminSuperMode = enabled;
    localStorage.setItem('adminSuperMode', enabled);
    renderAdminConsole();
};

window.handleAssignTeacher = async function (studentUid, unitId, teacherEmail) {
    if (!studentUid || !unitId) {
        alert(`Missing data: studentUid=${studentUid}, unitId=${unitId}`);
        return;
    }
    const msg = document.getElementById('admin-msg');
    const finalTeacher = (teacherEmail === 'none' || !teacherEmail) ? "" : teacherEmail;

    // alert(`Sending: studentUid=${studentUid}, unitId=${unitId}, teacherEmail=${finalTeacher}`);

    try {
        if (msg) msg.textContent = "正在更新教師指派...";

        const assignFunc = httpsCallable(functions, 'assignStudentToTeacher');
        await assignFunc({ studentUid, unitId, teacherEmail: finalTeacher });

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
function setupGradingFunctions() {
    const modal = document.getElementById('grading-modal');
    if (!modal) return; // Guard if modal not found

    const idInput = document.getElementById('grade-assignment-id');
    const scoreInput = document.getElementById('grade-score');
    const feedbackInput = document.getElementById('grade-feedback');
    const submitBtn = document.getElementById('btn-submit-grade');
    const historyContainer = document.getElementById('assignment-history');

    window.openGradingModal = function (id) {
        const assignment = dashboardData.assignments.find(a => a.id === id);
        if (!assignment) return;

        idInput.value = id;
        scoreInput.value = assignment.grade || '';
        feedbackInput.value = assignment.teacherFeedback || '';

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
                    ${h.grader ? `<div class="text-xs text-orange-600 mt-1">Graded by Teacher</div>` : ''}
                </div>
        `;
        }).join('');

        historyContainer.innerHTML = historyMap || '<p class="text-gray-400 text-center">No history</p>';

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.classList.add('modal-open');

        // Fallback programmatic hide
        const nav = document.getElementById('main-nav') || document.querySelector('nav');
        if (nav) nav.style.setProperty('display', 'none', 'important');
    }

    window.closeGradingModal = function () {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.classList.remove('modal-open');

        // Restore navbar
        const nav = document.getElementById('main-nav') || document.querySelector('nav');
        if (nav) nav.style.display = '';
    }

    window.submitGrade = async function () {
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
    }
}

// Utils
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatUnitName(fileName) {
    if (!fileName) return "Unknown";
    let name = fileName.replace('.html', '');

    // Explicit handle for master files - Keep them for display in settings
    if (name.includes('-master-')) {
        // Fallback title for masters
    }

    // Try to strip prefixes like "00-unit-", "basic-01-unit-"
    const nameMatch = name.match(/(?:unit-|master-)(.+)/i);
    if (nameMatch) name = nameMatch[1];
    return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); // Title Case
}

// --- Data Aggregation Logic ---
function aggregateData(data) {
    if (!data.students) return;

    data.students.forEach(student => {
        const rawProgress = student.courseProgress || {};
        const aggregated = {};

        // console.log("Processing student:", student.email);

        Object.entries(rawProgress).forEach(([key, stats]) => {
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

        student.courseProgress = aggregated;
    });

    // Fix assignments courseId if needed
    if (data.assignments) {
        data.assignments.forEach(a => {
            const realId = findCourseId(a.courseId);
            if (realId && realId !== a.courseId) {
                // console.log(`Mapping Assignment ${ a.id } courseId ${ a.courseId } -> ${ realId } `);
                a.courseId = realId;
            }
        });
    }
}

function findCourseId(key) {
    // 1. Exact match in loaded lessons
    const exact = allLessons.find(l => l.courseId === key);
    if (exact) return key;

    // 2. Exact match in lessonsMap (keys are courseIds)
    if (lessonsMap[key]) return key;

    // 3. Prefix match / Filename match
    // key might be "02-unit-html5-basics.html" or "basic-01-unit..."
    // lesson.classroomUrl might be ".../02-master-web-app.html"

    // Sanitize key: remove .html
    const cleanKey = key.replace('.html', '');

    for (const l of allLessons) {
        if (!l.classroomUrl) continue;

        // Extract filename from lesson URL and clean it
        const lessonFile = l.classroomUrl.split('/').pop().replace('.html', '');

        // Matches if:
        // A. Key starts with lessonFile prefix (very specific)
        // B. Key and LessonFile share a common "course code" prefix (e.g. "02-", "basic-01-")

        // Try code prefix matching
        // Patterns: "XX-", "basic-XX-"
        // Extract prefix from Lesson File:
        // "00-master..." -> "00-"
        // "basic-01-master..." -> "basic-01-"

        const masterMatch = lessonFile.match(/^([a-zA-Z0-9]+-\d+-|[0-9]+-)/);
        const prefix = masterMatch ? masterMatch[0] : null;

        if (prefix && cleanKey.startsWith(prefix)) {
            return l.courseId;
        }
    }

    return key; // Fallback to original if no match found
}

// --- Course Settings Feature ---

let courseConfigs = {};

function setupSettingsFeature() {
    // Buttons are now rendered individually in each row
}

/**
 * Checks if a user is explicitly authorized as a teacher for a specific unit.
 * Logic matches renderAdminConsole: unit-level authorizedTeachers OR legacy classroom URL keys.
 */
function isUserAuthorizedForUnit(fileName, courseId, email) {
    if (!email) return false;

    // [NEW] Super Mode or Admin account override for teaching guides/settings
    if (myRole === 'admin' || adminSuperMode) return true;

    const courseConfig = dashboardData?.courseConfigs?.[courseId] || {};
    const unitConfigs = courseConfig.githubClassroomUrls || {};

    // 1. Check unit-specific document for authorizedTeachers array
    const unitDocConfig = dashboardData?.courseConfigs?.[fileName] || {};
    const unitTeachersArr = Array.isArray(unitDocConfig.authorizedTeachers) ? unitDocConfig.authorizedTeachers : [];

    // 2. Legacy/Fallback: Teachers specifically authorized for THIS unit in course-level doc
    const legacyTeachers = (unitConfigs[fileName] && typeof unitConfigs[fileName] === 'object') ? Object.keys(unitConfigs[fileName]) : [];

    const allAuthorized = new Set([...unitTeachersArr, ...legacyTeachers]);
    return allAuthorized.has(email);
}

async function renderSettingsTab(filterUnitId = null) {
    filterUnitId = normalizeUnitId(filterUnitId);
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
        if (!dashboardData && (myRole === 'admin' || myRole === 'teacher')) {
            console.warn("[Settings] dashboardData missing, possibly still loading...");
            return; // Exit and wait for loadDashboard to call us again
        }

        const courseConfigs = dashboardData?.courseConfigs || {};
        const lessonsToProcess = Array.isArray(allLessons) ? allLessons : [];
        console.log("[Settings] Processing", lessonsToProcess.length, "lessons.");

        // 1. Render Course List
        let authorizedLessons = lessonsToProcess.filter(course => {
            if (myRole === 'admin' || adminSuperMode) return true;

            const courseConfig = courseConfigs[course.courseId] || {};
            const unitConfigs = courseConfig.githubClassroomUrls || {};
            const units = Array.isArray(course.courseUnits) ? course.courseUnits : [];

            const allFiles = Array.from(new Set([...units, ...Object.keys(unitConfigs)]))
                .filter(f => f && !f.includes('-master-'));

            return allFiles.some(f => isUserAuthorizedForUnit(f, course.courseId, userEmail));
        });

        console.log("[Settings] Authorized lessons count:", authorizedLessons.length);

        // [NEW] If filtered to a specific course
        const urlParams = new URLSearchParams(window.location.search);
        const filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));
        if (filterCourseId) {
            authorizedLessons = authorizedLessons.filter(l => l.courseId === filterCourseId);
        }

        if (authorizedLessons.length === 0) {
            console.warn("[Settings] No authorized lessons found for user.");
            const msg = `<div class="text-center py-20 text-gray-400">目前尚無獲准管理的課程（需為單元合格教師）。</div>`;
            assignmentContainer.innerHTML = msg;
            guideContainer.innerHTML = msg;
            return;
        }

        let totalAssignmentHTML = "";
        let totalGuideHTML = "";

        authorizedLessons.forEach(course => {
            console.log("[Settings] Rendering Course:", course.courseId);
            const configs = courseConfigs[course.courseId]?.githubClassroomUrls || {};
            const units = Array.isArray(course.courseUnits) ? [...course.courseUnits] : [];
            
            // [NEW] Ensure master page is also available for settings
            const masterFile = (course.classroomUrl || "").split('/').pop().split('?')[0];
            if (masterFile && !units.includes(masterFile)) {
                units.unshift(masterFile);
            }

            const rawInstructor = courseConfigs[course.courseId]?.instructorGuide;
            const rawAssignment = courseConfigs[course.courseId]?.assignmentGuide;
            const guideData = robustExtractGuideSegments(rawInstructor, rawAssignment);

            const filteredUnits = units.filter(f => {
                const isMaster = f.includes('-master-');
                if (isMaster && filterUnitId !== f && filterUnitId !== null) return false;
                if (filterUnitId && !filterUnitId.includes('-master-')) {
                    return f.replace('.html', '') === normalizeUnitId(filterUnitId).replace('.html', '');
                }
                return true;
            });

            console.log("[Settings] Filtered units mapping:", filteredUnits);

            const assignmentRows = filteredUnits.map(fileName => {
                const isAuthorized = isUserAuthorizedForUnit(fileName, course.courseId, userEmail);
                return renderAssignmentConfigRow(course.courseId, fileName, configs[fileName], course.title, isAuthorized);
            }).filter(h => !!h).join('');

            const guideRows = filteredUnits.map(fileName => {
                const realUnitsOnly = units.filter(u => !u.includes('-master-'));
                const unitIdx = realUnitsOnly.indexOf(fileName);
                const unitNum = unitIdx !== -1 ? unitIdx + 1 : null;
                const instructorSegment = guideData.segments[fileName] || (unitNum ? guideData.segments[unitNum] : "") || "";

                if (!instructorSegment) return "";
                const isAuthorized = isUserAuthorizedForUnit(fileName, course.courseId, userEmail);
                return renderGuideRow(course.courseId, fileName, instructorSegment, course.title, isAuthorized);
            }).filter(h => !!h).join('');

            if (assignmentRows) {
                totalAssignmentHTML += `
                    <div class="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm font-mono text-sm mb-6 w-full">
                        <div class="divide-y divide-gray-100">${assignmentRows}</div>
                    </div>`;
            }

            if (guideRows) {
                totalGuideHTML += `<div class="w-full space-y-6">${guideRows}</div>`;
            }
        });

        console.log("[Settings] Final check items. Any HTML?", !!totalAssignmentHTML);

        assignmentContainer.innerHTML = totalAssignmentHTML || `<div class="text-center py-20 text-gray-400">尚無作業連結設定需求。</div>`;
        guideContainer.innerHTML = totalGuideHTML || `<div class="text-center py-20 text-gray-400">尚無相關教學指引。</div>`;

    } catch (e) {
        console.error("[Settings] Critical Render Failure:", e);
        assignmentContainer.innerHTML = `<div class="text-red-500 p-8 rounded-2xl bg-red-50 border border-red-100">
            <h4 class="font-black text-sm mb-2">載入設定時發生錯誤 (Render Failure)</h4>
            <p class="text-[10px] opacity-75">${e.message}</p>
        </div>`;
    }
}

function renderAssignmentConfigRow(courseId, fileName, teacherMap = {}, courseTitle = "", isAuthorized) {
    const userEmail = auth.currentUser?.email;
    let entries = Object.entries(teacherMap || {}).filter(([teacher]) => teacher === userEmail);
    if (entries.length === 0 && userEmail) entries.push([userEmail, '']);

    const unitName = formatUnitName(fileName);

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
                <div class="flex-grow max-w-2xl">
                    ${isAuthorized ? `
                        <div class="text-[10px] text-blue-400 font-black uppercase mb-2 tracking-widest">作業連結 / Link</div>
                        ${entries.map(([teacher, url]) => `
                            <div class="flex gap-2 assignment-link-row">
                                <input type="hidden" class="assignment-id-input" value="${escapeHtml(teacher)}">
                                <input type="url" placeholder="GitHub Classroom 連結" value="${escapeHtml(url)}" 
                                    class="assignment-url-input flex-grow px-4 py-2 text-xs border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-50/50 bg-gray-50/30 transition-all font-mono">
                                <button onclick="saveAllSettings(this)"
                                    class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-md active:scale-95 btn-save-individual">
                                    儲存 🔗
                                </button>
                            </div>
                        `).join('')}
                    ` : '<div class="text-xs text-gray-300 italic">🔒 無權限管理此單元連結</div>'}
                </div>
            </div>
        </div>
    `;
}

function renderGuideRow(courseId, fileName, instructorSegment, courseTitle, isAuthorized) {
    return `
        <div class="unit-guide-row bg-white rounded-3xl border border-gray-100 p-10 shadow-sm transition-all hover:shadow-md">
            ${isAuthorized ? `
                <div class="instructor-guide-content text-gray-800 leading-relaxed">
                    ${instructorSegment}
                </div>
            ` : `
                <div class="text-[10px] text-blue-500 font-bold uppercase mb-2 tracking-widest flex items-center gap-2">
                    <span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    ${escapeHtml(courseTitle)} / ${escapeHtml(fileName)}
                </div>
                <div class="text-sm text-gray-400 italic">🔒 僅限該單元之「合格教師」閱讀完整教學指引。</div>
            `}
        </div>
    `;
}

// Helper to split instructor guide into parts
function robustExtractGuideSegments(instructorInput, assignmentInput = null) {
    console.log("[Debug] robustExtractGuideSegments init.",
        "Instructor type:", typeof instructorInput,
        "Assignment type:", typeof assignmentInput);

    const result = { header: '', segments: {}, footer: '', assignmentGuides: {} };

    // 1. Process Instructor Guides (Main segments)
    if (instructorInput && typeof instructorInput === 'object' && !Array.isArray(instructorInput)) {
        Object.entries(instructorInput).forEach(([fileName, content]) => {
            if (typeof content !== 'string') return;
            if (fileName.includes('-master-')) {
                result.footer += (result.footer ? "<hr>" : "") + content;
            } else {
                // [MODIFIED] No more legacy extraction. Use raw content.
                result.segments[fileName] = content;
            }
        });
    } else if (typeof instructorInput === 'string') {
        // [MODIFIED] Simplified fallback: treat as footer/header total if raw string
        result.footer = instructorInput;
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



window.saveAllSettings = async function (clickedBtn = null) {
    const btns = clickedBtn ? [clickedBtn] : document.querySelectorAll('.btn-save-individual');

    const originalTexts = new Map();
    btns.forEach(btn => {
        originalTexts.set(btn, btn.textContent);
        btn.disabled = true;
        btn.textContent = "儲存中...";
    });

    const configsByCourse = {};

    // Collect data from DOM
    document.querySelectorAll('.unit-config-card').forEach(card => {
        const cid = card.dataset.courseId;
        const fname = card.dataset.fileName;

        if (!configsByCourse[cid]) configsByCourse[cid] = {};

        const teacherMap = {};
        card.querySelectorAll('.assignment-link-row').forEach(row => {
            const tid = row.querySelector('.assignment-id-input').value.trim();
            const url = row.querySelector('.assignment-url-input').value.trim();
            if (tid && url) {
                teacherMap[tid] = url;
            }
        });

        if (Object.keys(teacherMap).length > 0) {
            configsByCourse[cid][fname] = teacherMap;
        }
    });

    try {
        const saveCourseConfigs = httpsCallable(functions, 'saveCourseConfigs');
        const promises = Object.entries(configsByCourse).map(([cid, unitMap]) => {
            return saveCourseConfigs({
                courseId: cid,
                configs: { githubClassroomUrls: unitMap }
            });
        });

        await Promise.all(promises);
        alert("設定儲存成功！");
    } catch (e) {
        console.error("Save failed:", e);
        alert("儲存失敗: " + e.message);
    } finally {
        btns.forEach(btn => {
            btn.disabled = false;
            btn.textContent = originalTexts.get(btn) || "儲存變更";
        });
    }
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
function renderEarningsTab(data) {
    const totalEarningsEl = document.getElementById('stat-total-earnings');
    const promoCodeEl = document.getElementById('display-promo-code');
    const tableBody = document.getElementById('earnings-table-body');

    if (!totalEarningsEl || !promoCodeEl || !tableBody) return;

    // 1. Display Promo Code
    if (!data.myPromoCode) {
        promoCodeEl.innerHTML = `
            <span class="text-gray-400 text-lg block mb-2">尚無代碼</span>
            <button onclick="handleGeneratePromoCode()" id="btn-generate-promo" class="text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg shadow-sm transition">
                🚀 立即生成推薦代碼
            </button>
        `;
    } else {
        promoCodeEl.innerText = data.myPromoCode;
    }

    // 2. Display Earnings Ledger
    const earnings = data.earnings || [];
    let total = 0;

    if (earnings.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-gray-400">尚無分潤紀錄</td></tr>';
    } else {
        tableBody.innerHTML = earnings.map(d => {
            total += d.shareAmount;
            return `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="py-3 px-2 font-medium">${d.month}</td>
                    <td class="py-3 px-2 text-gray-500 font-mono text-[10px]">${d.studentUid || '-'}</td>
                    <td class="py-3 px-2 text-right">NT$ ${d.orderAmount.toLocaleString()}</td>
                    <td class="py-3 px-2 text-right font-bold text-emerald-600">NT$ ${d.shareAmount.toLocaleString()}</td>
                    <td class="py-3 px-2 text-right text-gray-400 text-xs">${d.level === 0 ? '直接' : '第二層'}</td>
                </tr>
            `;
        }).join('');
    }

    totalEarningsEl.innerText = total.toLocaleString();
}

// --- Promo Code Generation ---
async function handleGeneratePromoCode() {
    const btn = document.getElementById('btn-generate-promo');
    const displayEl = document.getElementById('display-promo-code');
    if (!btn || !confirm('確定要生成您的專屬推薦代碼嗎？生成後即可分享給學生以追蹤分潤。')) return;

    try {
        btn.disabled = true;
        btn.innerText = '正在生成...';
        
        const generatePromoCode = httpsCallable(functions, 'generatePromoCode');
        const result = await generatePromoCode();
        
        if (result.data.success) {
            displayEl.innerHTML = `<span class="text-emerald-600 animate-pulse">${result.data.promoCode}</span>`;
            alert(`生成成功！您的推薦代碼是：${result.data.promoCode}\n頁面即將重新載入以更新數據。`);
            // Refresh dashboard data to update everything
            window.location.reload();
        } else {
            alert('生成失敗：' + (result.data.message || '未知錯誤'));
            btn.disabled = false;
            btn.innerText = '🚀 立即生成推薦代碼';
        }
    } catch (err) {
        console.error("[Promo] Generation error:", err);
        alert('生成代碼時發生錯誤：' + err.message);
        btn.disabled = false;
        btn.innerText = '🚀 立即生成推薦代碼';
    }
}
