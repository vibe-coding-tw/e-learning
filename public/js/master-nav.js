
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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
const db = getFirestore(app);

// [REFACTORED v11.3.11] Enhanced Initializer for Incognito/Guest Visibility
function initMasterNav() {
    console.log("[MasterNav] Initializing v11.3.11...");

    // 1. Immediate FAB Injection (No auth required)
    try {
        if (document.body) {
            injectDashboardFAB();
            console.log("[MasterNav] FAB Injected.");
        } else {
            console.warn("[MasterNav] Body not ready, deferring FAB.");
            document.addEventListener('DOMContentLoaded', injectDashboardFAB);
        }
    } catch (e) {
        console.error("[MasterNav] FAB Injection failed:", e);
    }

    // 2. Auth Listener (For background roles)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("[MasterNav] Auth detected:", user.email);
        } else {
            console.log("[MasterNav] Guest session detected.");
        }
    });
}

// Start immediately if possible, or wait for body
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMasterNav);
} else {
    initMasterNav();
}

// [NEW] Modal Injection
function injectDashboardModal() {
    if (document.getElementById('dashboard-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'dashboard-modal';
    modal.className = 'fixed inset-0 bg-black/60 hidden flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300';
    modal.style.zIndex = '10000000'; // High Z-index to stay above nav if not hidden
    modal.innerHTML = `
        <div class="bg-white w-full h-full max-w-7xl rounded-2xl shadow-2xl relative overflow-hidden flex flex-col transform scale-100 transition-transform">
            <div class="flex justify-between items-center p-4 border-b bg-gray-50/80 backdrop-blur">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">📊</span>
                    <h3 class="text-lg font-bold text-gray-800">課程儀表板 (Dashboard)</h3>
                </div>
                <button onclick="closeDashboardModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="flex-grow relative bg-gray-100">
                <div id="dashboard-loading" class="absolute inset-0 flex items-center justify-center z-10 bg-white/50">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                </div>
                <iframe id="dashboard-frame" class="w-full h-full border-0" src="" onload="document.getElementById('dashboard-loading').classList.add('hidden')"></iframe>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Global functions for Modal
window.openDashboardModal = function (courseParam) {
    injectDashboardModal(); // Ensure it exists
    const modal = document.getElementById('dashboard-modal');
    const frame = document.getElementById('dashboard-frame');
    const loader = document.getElementById('dashboard-loading');

    // Construct URL with mode=iframe
    // courseParam includes '?courseId=...' or is empty
    let separator = courseParam.includes('?') ? '&' : '?';

    // [NEW] Resolve unitId: Check iframe first (Master Page pattern), then fallback to filename
    let finalUnitId = '';
    const iframe = document.getElementById('content-frame');
    if (iframe && iframe.src) {
        try {
            // Use absolute URL resolution to ensure correct parsing
            const absoluteSrc = new URL(iframe.src, window.location.href).href;
            finalUnitId = absoluteSrc.split('/').pop().split('?')[0];
            console.log("[MasterNav] Detected unit from iframe:", finalUnitId);
        } catch (e) {
            console.error("[MasterNav] Iframe URL parsing failed:", e);
            finalUnitId = iframe.src.split('/').pop().split('?')[0];
        }
    }

    if (!finalUnitId) {
        finalUnitId = window.location.pathname.split('/').pop();
        console.log("[MasterNav] Fallback to pathname unitId:", finalUnitId);
    }

    const unitParam = finalUnitId ? `&unitId=${finalUnitId}` : '';
    console.log("[MasterNav] Final Unit Param:", unitParam);

    // [NEW] Update Title to be Unit-Centric if unit is detected
    const modalTitle = modal.querySelector('h3');
    if (modalTitle) {
        modalTitle.innerText = "儀表板 (Dashboard)";
    }

    let url = `/dashboard.html${courseParam}${separator}mode=iframe${unitParam}`;

    // Only reload if src changed or empty (to avoid reload on simple show/hide if we wanted to cache, but for now fresh is safer)
    frame.src = url;
    loader.classList.remove('hidden');

    // Style refinements for "Fullscreen" Feel
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock scroll
    document.body.classList.add('modal-open');

    modal.classList.add('bg-gray-100'); // Ensure background is solid enough
    const innerContainer = modal.querySelector('.max-w-7xl'); // Corrected to 7xl based on modal HTML
    if (innerContainer) {
        innerContainer.classList.remove('max-w-7xl', 'my-8'); // Corrected to 7xl
        innerContainer.classList.add('w-full', 'h-full', 'max-w-none', 'm-0', 'rounded-none');
    }

    // Ensure iframe is also full height
    if (frame) {
        frame.classList.add('h-screen');
        frame.style.height = '100vh';
    }

    // [NEW] Request Fullscreen on the modal div
    if (modal.requestFullscreen) {
        modal.requestFullscreen();
    } else if (modal.webkitRequestFullscreen) {
        modal.webkitRequestFullscreen();
    }

    // Hide Navbar to prevent z-index issues
    const nav = document.getElementById('main-nav') || document.querySelector('nav');
    if (nav) nav.style.setProperty('display', 'none', 'important');
}

window.closeDashboardModal = function () {
    const modal = document.getElementById('dashboard-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');

        // [NEW] Exit Fullscreen if active
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }

        // Restore Navbar
        const nav = document.getElementById('main-nav') || document.querySelector('nav');
        if (nav) nav.style.display = '';

        setTimeout(() => {
            document.getElementById('dashboard-frame').src = '';
        }, 300);
    }
    document.body.style.overflow = '';
}

// [NEW] Sync Modal state with Native Fullscreen Exit (e.g. Esc key or browser button)
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const modal = document.getElementById('dashboard-modal');
        if (modal && !modal.classList.contains('hidden')) {
            closeDashboardModal();
        }
    }
});
document.addEventListener('webkitfullscreenchange', () => {
    if (!document.webkitFullscreenElement) {
        const modal = document.getElementById('dashboard-modal');
        if (modal && !modal.classList.contains('hidden')) {
            closeDashboardModal();
        }
    }
});

// [NEW] Listen for ESC on the whole window to close dashboard
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('dashboard-modal');
        if (modal && !modal.classList.contains('hidden')) {
            closeDashboardModal();
        }
    }
});

function injectDashboardFAB() {
    // [Fix] Remove existing link/button to ensure we replace any stale/cached version
    const existing = document.getElementById('dashboard-fab');
    if (existing) existing.remove();

    // Injects the modal HTML once
    injectDashboardModal();

    // [Fix] Decode URI
    const path = decodeURIComponent(window.location.pathname);
    let courseParam = '';

    // Extract filename
    const filename = path.split('/').pop();
    if (filename) {
        let idPrefix = null;
        if (filename.includes('-unit')) {
            idPrefix = filename.split('-unit')[0];
        } else if (filename.includes('-master')) {
            idPrefix = filename.split('-master')[0];
        } else {
            const match = filename.match(/^([a-zA-Z0-9]+-\d+|\d+)-/);
            if (match) idPrefix = match[1];
        }

        if (idPrefix) {
            console.log("[MasterNav] Detected Course Context:", idPrefix);
            courseParam = `?courseId=${idPrefix}`;
        }
    }

    // Create Floating Action Button (FAB)
    const fab = document.createElement('button');
    fab.id = 'dashboard-fab';
    fab.className = 'fixed bottom-8 right-8 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group z-50';
    fab.style.zIndex = '9999';
    fab.innerHTML = `
        <span class="text-3xl group-hover:rotate-12 transition-transform">📊</span>
        <span class="absolute right-full mr-4 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
            查看儀表板
        </span>
    `;

    fab.onclick = function () {
        console.log("[MasterNav] Opening Modal with param:", courseParam);
        openDashboardModal(courseParam);
    };

    document.body.appendChild(fab);
}
