console.log("Dashboard Script v10 Loaded");
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
const adminPanel = document.getElementById('admin-panel');
const adminEmailInput = document.getElementById('admin-email');
const adminRoleSelect = document.getElementById('admin-role');
const adminSetBtn = document.getElementById('btn-set-role');
const adminMsg = document.getElementById('admin-msg');

let myRole = null;
let charts = {};
let dashboardData = null;
let lessonsMap = {};
let allLessons = [];

const MASTER_UNIT_MAPPING = {
    "00-master-wifi-motor.html": ["00-unit-wifi-setup.html", "00-unit-motor-ramping.html"],
    "01-master-getting-started.html": ["01-unit-developer-identity.html", "01-unit-vscode-setup.html", "01-unit-vscode-online.html"],
    "02-master-web-app.html": ["02-unit-html5-basics.html", "02-unit-flexbox-layout.html", "02-unit-ui-ux-standards.html"],
    "03-master-web-ble.html": ["03-unit-ble-security.html", "03-unit-ble-async.html", "03-unit-typed-arrays.html"],
    "04-master-remote-control.html": ["04-unit-control-panel.html", "04-unit-data-json.html", "04-unit-flow-logic.html"],
    "05-master-touch-events.html": ["05-unit-touch-basics.html", "05-unit-long-press.html", "05-unit-prevent-default.html"],
    "06-master-joystick-lab.html": ["06-unit-touch-vs-mouse.html", "06-unit-canvas-joystick.html", "06-unit-joystick-math.html"],
    "basic-01-master-environment.html": ["basic-01-unit-esp32-architecture.html", "basic-01-unit-platformio-setup.html", "basic-01-unit-drivers-ports.html"],
    "basic-02-master-ota-architecture.html": ["basic-02-unit-partition-table.html", "basic-02-unit-ota-principles.html", "basic-02-unit-ota-security.html"],
    "basic-03-master-io-mapping.html": ["basic-03-unit-pinout.html", "basic-03-unit-pullup-debounce.html", "basic-03-unit-adc-resolution.html"],
    "basic-04-master-pwm-control.html": ["basic-04-unit-pwm-basics.html", "basic-04-unit-h-bridge.html", "basic-04-unit-ledc-syntax.html"],
    "basic-05-master-ble-gatt.html": ["basic-05-unit-gatt-structure.html", "basic-05-unit-advertising-connection.html", "basic-05-unit-ble-properties.html"],
    "basic-06-master-http-web.html": ["basic-06-unit-fetch-api.html", "basic-06-unit-http-request.html", "basic-06-unit-cors-security.html"],
    "basic-07-master-wifi-modes.html": ["basic-07-unit-wifi-ap-sta.html", "basic-07-unit-http-lifecycle.html", "basic-07-unit-async-webserver.html"],
    "basic-08-master-joystick-math.html": ["basic-08-unit-joystick-mapping.html", "basic-08-unit-unicycle-model.html", "basic-08-unit-response-curves.html"],
    "basic-09-master-multitasking.html": ["basic-09-unit-millis.html", "basic-09-unit-hardware-timer.html", "basic-09-unit-sampling-rate.html"],
    "basic-10-master-fsm.html": ["basic-10-unit-fsm.html", "basic-10-unit-ui-design.html", "basic-10-unit-state-consistency.html"],
    "adv-01-master-s3-cam.html": ["adv-01-unit-s3-interfaces.html", "adv-01-unit-mjpeg-stream.html", "adv-01-unit-jpeg-quality.html"],
    "adv-02-master-video.html": ["adv-02-unit-video-streaming.html", "adv-02-unit-canvas-image.html", "adv-02-unit-bandwidth-fps.html"],
    "adv-03-master-ble-advanced.html": ["adv-03-unit-ble-notify.html", "adv-03-unit-json-serialization.html", "adv-03-unit-ble-mtu.html"],
    "adv-04-master-sensors.html": ["adv-04-unit-i2c-spi.html", "adv-04-unit-json-rest.html", "adv-04-unit-filter-algorithms.html"],
    "adv-05-master-cv.html": ["adv-05-unit-feature-extraction.html", "adv-05-unit-centroid-error.html", "adv-05-unit-closed-loop.html"],
    "adv-06-master-cv-advanced.html": ["adv-06-unit-threshold-filter.html", "adv-06-unit-centroid-algorithm.html", "adv-06-unit-hsv-math.html", "adv-06-unit-look-ahead.html"],
    "adv-07-master-ui-framework.html": ["adv-07-unit-ui-framework.html", "adv-07-unit-chart-canvas.html", "adv-07-unit-json-parsing.html", "adv-07-unit-event-polling.html"],
    "adv-08-master-image-processing.html": ["adv-08-unit-color-spaces.html", "adv-08-unit-error-calculation.html", "adv-08-unit-p-control.html", "adv-08-unit-mobilenet-ssd.html"],
    "adv-09-master-ai-recognition.html": ["adv-09-unit-cnn-audio.html", "adv-09-unit-teachable-machine.html", "adv-09-unit-webspeech-api.html", "adv-09-unit-flow-control.html"],
    "adv-10-master-diff-drive.html": ["adv-10-unit-icc-geometry.html", "adv-10-unit-api-design.html", "adv-10-unit-pwm-limits.html"],
    "adv-11-master-photoelectric.html": ["adv-11-unit-sensor-principles.html", "adv-11-unit-hardware-interrupts.html", "adv-11-unit-speed-algorithms.html"],
    "adv-12-master-pid.html": ["adv-12-unit-pid-control.html", "adv-12-unit-pid-math.html", "adv-12-unit-code-logic.html"],
    "adv-13-master-robustness.html": ["adv-13-unit-robustness.html", "adv-13-unit-system-perf.html", "adv-13-unit-technical-narrative.html"],
    "adv-14-master-debugging-art.html": ["adv-14-unit-debugging-art.html", "adv-14-unit-kpi-definition.html", "adv-14-unit-refactoring.html"],
    "adv-15-master-architecture.html": ["adv-15-unit-data-flow.html", "adv-15-unit-ble-async.html", "adv-15-unit-pid-simulation.html", "adv-15-unit-image-dma.html"]
};

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
        userDisplay.textContent = `您好, ${user.displayName || '使用者'}`;
        await loadLessons();
        loadDashboard();
    } else {
        window.location.href = 'index.html';
    }
});

async function loadLessons() {
    try {
        const res = await fetch('lessons.json');
        const lessons = await res.json();
        allLessons = lessons;
        lessons.forEach(l => {
            lessonsMap[l.courseId] = l.title;
        });
    } catch (e) {
        console.error("Failed to load lessons:", e);
    }
}

// --- Main Data Fetching ---
async function loadDashboard() {
    try {
        const getDashboardData = httpsCallable(functions, 'getDashboardData');
        const response = await getDashboardData();
        const data = response.data;

        // [FIX] Aggregate data (map filename IDs to real Course IDs)
        aggregateData(data);

        dashboardData = data;

        myRole = data.role;
        console.log("Role:", myRole);

        // [MODIFIED] Access Control: Global Admin/Teacher OR Course-Specific Teacher
        const isAuthorizedTeacher = data.courseConfigs && Object.keys(data.courseConfigs).length > 0;

        if (myRole === 'admin' || myRole === 'teacher' || isAuthorizedTeacher) {
            // Admin/Teacher View (Management)
            renderAdminDashboard(data);
            setupAdminFeatures();
            setupGradingFunctions();
            setupSettingsFeature();
        } else if (myRole === 'student') {
            // Student View (Personal Stats)
            renderStudentDashboard(data);
        } else {
            showAccessDenied();
        }

    } catch (error) {
        console.error("Dashboard Load Error:", error);
        showAccessDenied();
    }
}

function showAccessDenied() {
    loadingState.classList.add('hidden');
    accessDenied.classList.remove('hidden');

    const user = auth.currentUser;
    if (user && userUidDisplay) {
        userUidDisplay.innerText = user.uid;
    } else if (userUidDisplay) {
        setTimeout(() => {
            if (auth.currentUser) userUidDisplay.innerText = auth.currentUser.uid;
        }, 500);
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

// --- Rendering ---
function renderStudentDashboard(data) {
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
        displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
        // Filter progress to only this course
        const filteredProgress = {};
        if (displayCourseProgress[filterCourseId]) {
            filteredProgress[filterCourseId] = displayCourseProgress[filterCourseId];
        }
        displayCourseProgress = filteredProgress;

        // Update "Total Hours" to reflect THIS course only? 
        // User asked "Please list the course related info". 
        // Use the filtered progress total time if available, otherwise 0.
        if (displayCourseProgress[filterCourseId]) {
            myData.totalTime = displayCourseProgress[filterCourseId].total; // Override for display
        } else {
            myData.totalTime = 0;
        }
    }

    // Update Stats Cards (Reusing existing IDs if possible, or we will hide/show sections in HTML)
    // We will dynamically inject the HTML for Student View to avoid conflict with Admin View structure

    const container = document.getElementById('view-overview');

    const courseTitle = filterCourseId ? (lessonsMap[filterCourseId] || filterCourseId) : "我的學習概況";

    container.innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-gray-800">${escapeHtml(courseTitle)}</h2>
            ${filterCourseId && mode !== 'iframe' ? '<a href="dashboard.html" class="text-sm text-blue-600 hover:underline">← 查看所有課程</a>' : ''}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="card border-l-4 border-blue-500">
                <p class="text-gray-500 text-sm font-medium">學習時數</p>
                <h3 class="text-3xl font-bold text-gray-800 mt-1">${(myData.totalTime / 3600).toFixed(1)} <span class="text-sm font-normal text-gray-400">hours</span></h3>
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
        chartData = [{
            videoTime: p.video,
            docTime: p.doc,
            pageTime: p.page || 0 // assuming page exists or calc remainder
        }];
    }

    renderChart(chartData);
}

function renderAdminDashboard(data) {
    loadingState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');

    // Unhide Manage Link and Admin Tab (Admin Only)
    const adminTabBtn = document.getElementById('tab-btn-admin');
    if (adminTabBtn) {
        if (myRole === 'admin') {
            adminTabBtn.classList.remove('hidden');
        } else {
            adminTabBtn.classList.add('hidden');
        }
    }

    // Settings Tab (Admin OR Teacher with authorized courses)
    const settingsTabBtn = document.getElementById('tab-btn-settings');
    if (settingsTabBtn) {
        // [MODIFIED] If filtered, check if authorized for THIS course. If not filtered, check if authorized for ANY.
        let isAuthorized = false;
        if (myRole === 'admin') {
            isAuthorized = true;
        } else if (filterCourseId) {
            isAuthorized = !!(data.courseConfigs && data.courseConfigs[filterCourseId]);
        } else {
            isAuthorized = !!(data.courseConfigs && Object.keys(data.courseConfigs).length > 0);
        }

        if (isAuthorized) {
            settingsTabBtn.classList.remove('hidden');
        } else {
            settingsTabBtn.classList.add('hidden');
        }
    }

    // Stats
    stats.students.textContent = data.summary.totalStudents;
    stats.hours.textContent = data.summary.totalHours.toFixed(1);

    // Parse courseId for Admin View to filter stats
    const urlParams = new URLSearchParams(window.location.search);
    let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));

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
                displayTotal = p.total || 0;
                displayVideo = p.video || 0;
                displayDoc = p.doc || 0;
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
                <tr class="${bgClass} text-xs border-b border-gray-100 cursor-pointer hover:bg-gray-100" onclick="toggleCourseRows('${courseUnitsId}', event)">
                    <td class="pl-8 py-2 border-l-4 ${isMatch ? 'border-blue-400 font-bold' : 'border-gray-200'} text-gray-800 flex items-center gap-2">
                        <span id="icon-${courseUnitsId}" class="text-[8px] transform transition-transform">▶</span>
                        <span>${escapeHtml(courseTitle)}</span>
                    </td>
                    <td class="text-right py-2 font-bold">${(progress.total / 60).toFixed(0)}m</td>
                    <td class="text-right py-2 text-blue-600">${(progress.video / 60).toFixed(0)}m</td>
                    <td class="text-right py-2 text-purple-600">${(progress.doc / 60).toFixed(0)}m</td>
                    <td class="py-2"></td>
                </tr>
            `;

            // Wrap units in a toggleable container 
            // We'll use a specific class for the unit rows
            const unitRowsClass = `course-unit-${courseUnitsId}`;

            // Render Unit Rows (if any)
            if (progress.units) {
                const sortedUnits = Object.entries(progress.units).sort();
                const unitRows = sortedUnits.map(([unitKey, unitStats]) => {
                    // Format Unit Name
                    let unitName = unitKey.replace('.html', '');
                    // Try to strip prefixes like "00-unit-", "basic-01-unit-"
                    const nameMatch = unitName.match(/(?:unit-|master-)(.+)/i);
                    if (nameMatch) unitName = nameMatch[1];
                    unitName = unitName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); // Title Case

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
                        <td class="text-right py-1">${(unitStats.doc / 60).toFixed(0)}m</td>
                        <td class="py-1"></td>
                    </tr>
                    ${logRowsHtml}
                    `;
                }).join('');
                html += unitRows;
            }

            return html;
        }).join('');

        return `
        <tr class="hover:bg-gray-50 transition border-b border-gray-100 cursor-pointer" onclick="toggleRow('${s.uid}')">
            <td class="py-3 px-2 font-medium text-gray-800 flex items-center gap-2">
                <span id="icon-${s.uid}" class="text-gray-400 w-4 inline-block transform transition-transform">▶</span>
                ${escapeHtml(s.email)}
            </td>
            <td class="py-3 px-2 text-right font-mono text-blue-600">${(displayTotal / 3600).toFixed(1)}h</td>
            <td class="py-3 px-2 text-right text-gray-500 text-xs text-nowrap">
                <span title="Video">${(displayVideo / 60).toFixed(0)}m</span>
            </td>
            <td class="py-3 px-2 text-right text-gray-500 text-xs text-nowrap">
                <span title="Doc">${(displayDoc / 60).toFixed(0)}m</span>
            </td>
            <td class="py-3 px-2 text-right text-xs text-gray-400 hidden sm:table-cell">
            <td class="py-3 px-2 text-right text-xs text-gray-400 hidden sm:table-cell">
                ${s.lastActive && !isNaN(new Date(s.lastActive)) ? new Date(s.lastActive).toLocaleString() : '-'}
            </td>
        </tr>
        <tbody id="detail-${s.uid}" class="hidden border-b border-gray-200">
            ${courseRows.length ? courseRows : '<tr><td colspan="5" class="py-2 text-center text-xs text-gray-400">No specific course activity</td></tr>'}
        </tbody>
        `;
    }).join('');

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



    // [Fix] Filter chart data if courseId is present
    let chartData = data.students;
    if (filterCourseId) {
        chartData = data.students.map(s => {
            const courses = s.courseProgress || {};
            const p = courses[filterCourseId] || { total: 0, video: 0, doc: 0, page: 0 };
            return {
                ...s,
                totalTime: p.total || 0,
                videoTime: p.video || 0,
                docTime: p.doc || 0,
                pageTime: p.page || 0
            };
        });
    }

    // [Fix] Filter assignments based on courseId
    let displayAssignments = data.assignments;
    if (filterCourseId) {
        displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
    }

    renderChart(chartData);
    renderAssignments(displayAssignments);
}

function renderAssignments(assignments) {
    if (!assignments || assignments.length === 0) {
        if (assignmentTableBody) assignmentTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">尚無作業繳交紀錄</td></tr>`;
        return;
    }

    if (assignmentTableBody) {
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
            <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                <td class="py-3 px-2 text-gray-800">
                    <div class="font-medium">${escapeHtml(a.studentEmail || a.userEmail)}</div>
                </td>
                <td class="py-3 px-2 text-sm text-gray-600">
                    <div class="font-bold text-xs text-gray-700">${escapeHtml(title)}</div>
                    <div class="text-xs text-gray-500 capitalize">${escapeHtml(displayUnit)}</div>
                </td>
                <td class="py-3 px-2 text-xs text-gray-500">${submittedDate}</td>
                <td class="py-3 px-2">${badge}</td>
                <td class="py-3 px-2 font-bold text-gray-700">${a.grade !== null && a.grade !== undefined ? a.grade : '-'}</td>
                <td class="py-3 px-2 text-right">
                    <button onclick="openGradingModal('${a.id}')" 
                        class="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-xs font-bold transition">
                        評分
                    </button>
                </td>
            </tr>
        `}).join('');
    }
}

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
        renderSettingsTab();
    }
    if (tabName === 'admin') {
        renderAdminConsole();
    }
};

// --- Admin Features ---
function setupAdminFeatures() {
    // Admin features are now initialized during renderAdminConsole
}

function renderAdminConsole() {
    if (myRole !== 'admin') return;

    const urlParams = new URLSearchParams(window.location.search);
    const filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));

    const adminPanel = document.getElementById('admin-panel');
    if (!adminPanel) return;

    // Default structure (Heading only, role assignment removed)
    let html = `
        <h3 class="text-lg font-bold text-orange-800 mb-4 flex items-center gap-2">🛠️ 管理員控制台</h3>
        <p id="admin-msg" class="text-sm mt-2 text-gray-600 h-5"></p>
    `;

    // ADDED: Course-Specific Teacher List
    if (filterCourseId) {
        const courseTitle = lessonsMap[filterCourseId] || filterCourseId;
        const config = dashboardData?.courseConfigs?.[filterCourseId] || {};
        const teachers = config.authorizedTeachers || [];

        html += `
            <div class="mt-8 pt-8 border-t border-orange-200">
                <h4 class="text-md font-bold text-orange-900 mb-4 flex items-center gap-2">
                    <span>🎓</span> ${escapeHtml(courseTitle)} 的合格老師清單
                </h4>
                
                <div class="bg-white rounded-lg border border-orange-100 overflow-hidden mb-4 shadow-sm">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-orange-50 text-orange-800 font-bold">
                            <tr>
                                <th class="px-4 py-2">老師 Email</th>
                                <th class="px-4 py-2 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-orange-50">
                            ${teachers.length === 0 ? `<tr><td colspan="2" class="px-4 py-4 text-center text-gray-400 italic">目前尚無授權老師</td></tr>` :
                teachers.map(email => `
                                <tr>
                                    <td class="px-4 py-3 font-mono text-gray-700">${escapeHtml(email)}</td>
                                    <td class="px-4 py-3 text-right">
                                        <button onclick="handleTeacherAuth('${filterCourseId}', '${email}', 'remove')" 
                                            class="text-red-500 hover:underline text-xs">移除權限</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="flex gap-2 items-center">
                    <input type="email" id="new-teacher-email" placeholder="新增合格老師 Email" 
                        class="flex-grow px-4 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 transition">
                    <button onclick="handleTeacherAuth('${filterCourseId}', document.getElementById('new-teacher-email').value, 'add')"
                        class="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition font-bold text-sm shadow-md">
                        新增授權
                    </button>
                </div>
            </div>
        `;
    }

    adminPanel.innerHTML = html;
}


window.handleTeacherAuth = async function (courseId, teacherEmail, action) {
    if (!teacherEmail) return alert("請輸入 Email");
    const msg = document.getElementById('admin-msg');

    try {
        if (msg) msg.textContent = action === 'add' ? "正在新增授權..." : "正在移除授權...";
        const authFunc = httpsCallable(functions, 'authorizeTeacherForCourse');
        await authFunc({ courseId, teacherEmail, action });

        // alert("設定成功！");
        // Reload dashboard data
        loadDashboard();
    } catch (e) {
        console.error(e);
        alert("設定失敗：" + e.message);
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
                <div class="mb-2 pb-2 border-b border-gray-200 last:border-0">
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

// --- Data Aggregation Logic ---
function aggregateData(data) {
    if (!data.students) return;

    data.students.forEach(student => {
        const rawProgress = student.courseProgress || {};
        const aggregated = {};

        // console.log("Processing student:", student.email);

        Object.entries(rawProgress).forEach(([key, stats]) => {
            const realId = findCourseId(key);
            // console.log(`Mapping ${key} -> ${realId}`);

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

        // Also fix totalTime recalculation? 
        // totalTime is usually a sum of all progress, but if we had duplicate keys (filename vs real id), 
        // we might want to recalc. For now, trust the server's totalTime or recalc if needed.
    });

    // Fix assignments courseId if needed
    if (data.assignments) {
        data.assignments.forEach(a => {
            const realId = findCourseId(a.courseId);
            if (realId && realId !== a.courseId) {
                // console.log(`Mapping Assignment ${a.id} courseId ${a.courseId} -> ${realId}`);
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
    const saveBtn = document.getElementById('btn-save-settings');
    if (saveBtn) {
        saveBtn.onclick = saveAllSettings;
    }
}

async function renderSettingsTab() {
    const container = document.getElementById('settings-container');
    if (!container) return;

    try {
        // Use pre-loaded data instead of extra call
        courseConfigs = dashboardData?.courseConfigs || {};

        // 2. Render Course List (Only those the user is authorized for)
        let authorizedLessons = allLessons.filter(l =>
            myRole === 'admin' || courseConfigs[l.courseId]
        );

        // [NEW] If filtered to a specific course, only show that course in settings
        const urlParams = new URLSearchParams(window.location.search);
        const filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));
        if (filterCourseId) {
            authorizedLessons = authorizedLessons.filter(l => l.courseId === filterCourseId);
        }

        if (authorizedLessons.length === 0) {
            container.innerHTML = `<div class="text-center py-20 text-gray-400">目前尚無獲准管理的課程。</div>`;
            return;
        }

        container.innerHTML = authorizedLessons.map(course => {
            const configs = courseConfigs[course.courseId]?.githubClassroomUrls || {};

            // List units already in configs
            const unitFiles = new Set(Object.keys(configs));
            // Also suggest the main master page if not listed
            if (course.classroomUrl) {
                const masterFile = course.classroomUrl.split('/').pop();
                unitFiles.add(masterFile);
            }

            return `
                <div class="p-6 bg-white border border-gray-100 rounded-xl shadow-sm space-y-4">
                    <div class="flex flex-col md:flex-row md:justify-between md:items-center border-b pb-3 gap-2">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">${course.icon || '📚'}</span>
                            <div>
                                <h4 class="font-bold text-gray-800">${escapeHtml(course.title)}</h4>
                                <p class="text-[10px] text-gray-400 font-mono">${course.courseId}</p>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4" id="units-list-${course.courseId}">
                        ${(() => {
                    const masterFile = course.classroomUrl ? course.classroomUrl.split('/').pop() : null;
                    const units = (masterFile && MASTER_UNIT_MAPPING[masterFile]) ? [masterFile, ...MASTER_UNIT_MAPPING[masterFile]] : (masterFile ? [masterFile] : []);

                    // Get any extra units from configs that might not be in mapping
                    const configUnits = Object.keys(configs);
                    const allUnits = Array.from(new Set([...units, ...configUnits]));

                    return allUnits.map(fileName => renderUnitRow(course.courseId, fileName, configs[fileName])).join('');
                })()}
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Failed to render settings:", e);
        container.innerHTML = `<div class="text-red-500 p-4">載入失敗: ${e.message}</div>`;
    }
}

function renderUnitRow(courseId, fileName, teacherMap = {}) {
    // teacherMap: { "default": "...", "teacher_a": "..." }
    const entries = Object.entries(teacherMap);
    if (entries.length === 0) entries.push(['default', '']);

    return `
        <div class="unit-config-card bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-blue-100 transition shadow-sm relative group" 
            data-course-id="${courseId}" data-file-name="${fileName}">
            
            <div class="mb-3">
                <span class="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Unit File</span>
                <p class="text-sm font-mono text-gray-700 truncate" title="${fileName}">${fileName}</p>
            </div>

            <div class="space-y-3 teacher-links-container">
                ${entries.map(([teacher, url], idx) => `
                    <div class="space-y-1 teacher-link-row">
                        <div class="flex justify-between items-center">
                            <label class="text-[9px] font-bold text-gray-400 uppercase">${teacher === 'default' ? '預設連結 (自己)' : '教師 ID: ' + teacher}</label>
                            <input type="hidden" class="teacher-id-input" value="${escapeHtml(teacher)}">
                            ${teacher !== 'default' ? `<button onclick="this.parentElement.parentElement.remove()" class="text-[9px] text-red-400 hover:underline">刪除</button>` : ''}
                        </div>
                        <input type="url" placeholder="貼上 GitHub Classroom 邀請連結 (https://classroom.github.com/a/...)" 
                            value="${escapeHtml(url)}" 
                            class="teacher-url-input w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                    </div>
                `).join('')}
            </div>
            
            <button onclick="addTeacherRow(this)" class="mt-3 text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 opacity-60 hover:opacity-100 transition">
                <span>➕</span> 設定其他教師連結 (進階)
            </button>
        </div>
    `;
}

window.addTeacherRow = function (btn) {
    const teacherId = prompt("請輸入教師 ID (例如: teacher_vibe):");
    if (!teacherId) return;

    const container = btn.previousElementSibling;
    const div = document.createElement('div');
    div.className = 'space-y-1 teacher-link-row';
    div.innerHTML = `
        <div class="flex justify-between items-center">
            <label class="text-[9px] font-bold text-gray-400 uppercase">教師 ID: ${escapeHtml(teacherId)}</label>
            <input type="hidden" class="teacher-id-input" value="${escapeHtml(teacherId)}">
            <button onclick="this.parentElement.parentElement.remove()" class="text-[9px] text-red-400 hover:underline">刪除</button>
        </div>
        <input type="url" placeholder="貼上 GitHub Classroom 邀請連結" 
            value="" 
            class="teacher-url-input w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition">
    `;
    container.appendChild(div);
};


async function saveAllSettings() {
    const btn = document.getElementById('btn-save-settings');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "儲存中...";

    const configsByCourse = {};

    // Collect data from DOM
    document.querySelectorAll('.unit-config-card').forEach(card => {
        const cid = card.dataset.courseId;
        const fname = card.dataset.fileName;

        if (!configsByCourse[cid]) configsByCourse[cid] = {};

        const teacherMap = {};
        card.querySelectorAll('.teacher-link-row').forEach(row => {
            const tid = row.querySelector('.teacher-id-input').value.trim();
            const url = row.querySelector('.teacher-url-input').value.trim();
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
        btn.disabled = false;
        btn.textContent = originalText;
    }
}
