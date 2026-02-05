
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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Fetch User Role
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const role = userData.role;

                if (role === 'admin' || role === 'teacher') {
                    injectDashboardTab();
                }
            }
        } catch (e) {
            console.error("Failed to fetch user role:", e);
        }
    }
});

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
                    <h3 class="text-lg font-bold text-gray-800">課程儀表板 (Course Dashboard)</h3>
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
    let url = `/dashboard.html${courseParam}${separator}mode=iframe`;

    // Only reload if src changed or empty (to avoid reload on simple show/hide if we wanted to cache, but for now fresh is safer)
    frame.src = url;
    loader.classList.remove('hidden');

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock scroll
    document.body.classList.add('modal-open');

    // Hide Navbar to prevent z-index issues
    const nav = document.getElementById('main-nav') || document.querySelector('nav');
    if (nav) nav.style.setProperty('display', 'none', 'important');
}

window.closeDashboardModal = function () {
    const modal = document.getElementById('dashboard-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');

        // Restore Navbar
        const nav = document.getElementById('main-nav') || document.querySelector('nav');
        if (nav) nav.style.display = '';

        setTimeout(() => {
            document.getElementById('dashboard-frame').src = '';
        }, 300);
    }
    document.body.style.overflow = '';
}

function injectDashboardTab() {
    const tabsContainer = document.getElementById('course-tabs-container');
    if (tabsContainer) {
        // [Fix] Remove existing link/button to ensure we replace any stale/cached version
        const existing = document.getElementById('tab-dashboard-link');
        if (existing) existing.remove();

        // Injects the modal HTML once
        injectDashboardModal();

        // Create Link
        const link = document.createElement('button'); // Changed to button for semantics
        link.id = 'tab-dashboard-link';

        // [Fix] Decode URI
        const path = decodeURIComponent(window.location.pathname);
        let courseParam = '';

        // Extract filename
        const filename = path.split('/').pop();
        if (filename) {
            // Robust extraction: take everything before '-unit' or '-master'
            // This handles 'basic-01-unit...', '00-master...', '05-unit...'

            let idPrefix = null;
            if (filename.includes('-unit')) {
                idPrefix = filename.split('-unit')[0];
            } else if (filename.includes('-master')) {
                idPrefix = filename.split('-master')[0];
            } else {
                // Try Regex for patterns like "00-..." or "basic-01-..." if standard separators missing
                const match = filename.match(/^([a-zA-Z0-9]+-\d+|\d+)-/);
                if (match) idPrefix = match[1];
            }

            if (idPrefix) {
                console.log("[MasterNav] Detected Course Context:", idPrefix);
                courseParam = `?courseId=${idPrefix}`;
            }
        }

        // Use onclick to open modal
        link.onclick = function () {
            console.log("[MasterNav] Opening Modal with param:", courseParam);
            openDashboardModal(courseParam);
        };
        // Removed href since it's a button now, or keep styling consistent

        // Try to mimic sibling styles
        const lastTab = tabsContainer.querySelector('button');
        if (lastTab) {
            link.className = lastTab.className;
            // Adapt styling for button if previous was anchor (though usually tabs are buttons here?)
            // Assuming tabs are <a> or <button>. If <a> tags are used for tabs, we might need to mimic <a> class string.

            // Remove active/inactive specific tweaks if copying from an active tab
            link.classList.remove('active', 'tab-active', 'border-blue-600', 'text-blue-700', 'border-b-2');
            link.classList.add('text-gray-500', 'hover:text-blue-600', 'border-transparent', 'border-b-2', 'hover:border-blue-300');

            if (!link.classList.contains('flex')) link.classList.add('flex', 'items-center', 'gap-2');
        } else {
            // Fallback styles
            link.className = 'whitespace-nowrap py-3 px-4 font-bold text-gray-500 hover:text-blue-600 flex items-center gap-2 border-b-2 border-transparent hover:border-blue-300 transition-colors bg-transparent cursor-pointer';
        }

        link.classList.add('pl-6');
        link.innerHTML = '<span class="text-xl">📊</span> 課程儀表板';

        tabsContainer.appendChild(link);
    }
}
