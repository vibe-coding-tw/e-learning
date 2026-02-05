/**
 * course-shared.js
 * Shared logic for Vibe Coding Course Units
 * Handles: Media Overlay (Video/Doc), Fullscreen, Mobile Zoom, and Animations
 */

// Initializer
function init() {
    console.log("[CourseShared] Initializing...");
    injectMediaOverlay();
    initAnimations();
    initFirebaseFeatures(); // [NEW] Start Firebase (Tracking + Assignments)
}

// Robust Initialization Logic
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM already ready
    init();
}

// Fallback: Ensure animations run even if DOMContentLoaded missed
window.addEventListener('load', () => {
    console.log("[CourseShared] Window Load fallback check");
    initAnimations();
});

// Global State
let currentMode = null;
let sessionStartTime = null;
let currentScale = 1.0;
const BASE_DOC_WIDTH = 850;

/**
 * Injects the standard Media Overlay HTML into the body
 */
function injectMediaOverlay() {
    if (document.getElementById('media-overlay')) return; // Already exists

    const overlayHTML = `
    <div id="media-overlay" class="fixed inset-0 bg-black hidden flex flex-col overflow-hidden" style="z-index: 1000000 !important;">
        <!-- Doc Container -->
        <div id="doc-wrapper" class="hidden flex-grow w-full relative overflow-auto bg-white flex justify-start">
            <iframe id="doc-frame" class="border-0 bg-white origin-top-left"
                style="width: 100%; min-height: 100%; transition: transform 0.2s ease;" src="">
            </iframe>
        </div>

        <!-- Video Container -->
        <div id="video-wrapper" class="hidden flex-grow w-full bg-black flex justify-center items-center">
            <iframe id="video-frame" class="w-full h-full" src="" title="Course Video" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen>
            </iframe>
        </div>

        <!-- Close Button (Fixed) -->
        <button onclick="closeModal()"
            style="z-index: 1000001 !important;"
            class="close-video-btn fixed top-4 right-4 text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-full shadow-lg transition cursor-pointer pointer-events-auto flex items-center gap-2">
            <span>✕</span> 關閉 (Close)
        </button>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', overlayHTML);
}

// Explicitly export to window to avoid scope issues
window.enterMediaMode = enterMediaMode;
window.closeModal = closeModal;

/**
 * Opens the Media Overlay
 */
function enterMediaMode(mode, url) {
    try {
        console.log(`[Media] Entering mode: ${mode}`);
        currentMode = mode;
        const overlay = document.getElementById('media-overlay');

        // Safety check: if overlay doesn't exist, try injecting it again
        if (!overlay) {
            console.warn("[Media] Overlay not found, re-injecting...");
            injectMediaOverlay();
            if (!document.getElementById('media-overlay')) {
                alert("Component Error: Media Overlay missing.");
                return;
            }
        }

        const O = document.getElementById('media-overlay');
        const docWrapper = document.getElementById('doc-wrapper');
        const videoWrapper = document.getElementById('video-wrapper');
        const docFrame = document.getElementById('doc-frame');
        const videoFrame = document.getElementById('video-frame');

        // Reset UI
        docWrapper.classList.add('hidden');
        videoWrapper.classList.add('hidden');
        O.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Determine Source
        let targetSrc = "";
        if (url) {
            targetSrc = url;
        } else {
            // Priority: window.RESOURCES -> local RESOURCES
            if (typeof window.RESOURCES !== 'undefined') {
                targetSrc = window.RESOURCES[mode];
                if (!targetSrc && mode === 'video') targetSrc = window.RESOURCES['youtube'];
            } else if (typeof RESOURCES !== 'undefined') {
                targetSrc = RESOURCES[mode];
                if (!targetSrc && mode === 'video') targetSrc = RESOURCES['youtube'];
            }
        }

        console.log(`[Media] Target Source: ${targetSrc}`);

        if (mode === 'doc') {
            docWrapper.classList.remove('hidden');
            if (targetSrc) docFrame.src = targetSrc;
            setTimeout(autoFitZoom, 100);
        } else if (mode === 'video') {
            videoWrapper.classList.remove('hidden');
            if (targetSrc) videoFrame.src = targetSrc;
        }

        // Hide Navbar and Tabs to prevent z-index issues (especially in iframes)
        const docs = [document];
        try { if (window.parent && window.parent.document) docs.push(window.parent.document); } catch (e) { }

        docs.forEach(doc => {
            const nav = doc.getElementById('main-nav');
            if (nav) nav.style.display = 'none';

            // Also hide the tab bar if it exists (Master Page pattern)
            const tabs = doc.getElementById('course-tabs-container');
            if (tabs) {
                const tabWrapper = tabs.closest('.relative.z-40') || tabs.parentElement.parentElement;
                if (tabWrapper) tabWrapper.style.display = 'none';
            }
        });

        requestFullscreenSafe();
        sessionStartTime = new Date();
    } catch (err) {
        console.error("[Media] Error in enterMediaMode:", err);
    }
}

/**
 * Closes the Media Overlay
 */
function closeModal() {
    const overlay = document.getElementById('media-overlay');
    if (!overlay) return;

    overlay.classList.add('hidden');
    document.body.style.overflow = '';

    // Restore Navbar and Tabs
    const docs = [document];
    try { if (window.parent && window.parent.document) docs.push(window.parent.document); } catch (e) { }

    docs.forEach(doc => {
        const nav = doc.getElementById('main-nav');
        if (nav) nav.style.display = '';

        const tabs = doc.getElementById('course-tabs-container');
        if (tabs) {
            const tabWrapper = tabs.closest('.relative.z-40') || tabs.parentElement.parentElement;
            if (tabWrapper) tabWrapper.style.display = '';
        }
    });

    // Stop Playback
    document.getElementById('video-frame').src = "";
    document.getElementById('doc-frame').src = "";

    currentMode = null;
    exitFullscreenSafe();

    if (sessionStartTime) {
        const endTime = new Date();
        const duration = (endTime - sessionStartTime) / 1000;
        console.log(`[Tracking] Session duration: ${duration}s`);

        // Dispatch event for Firebase to pick up
        const modeUpper = currentMode ? currentMode.toUpperCase() : 'UNKNOWN';
        window.dispatchEvent(new CustomEvent('vibe-log-activity', {
            detail: {
                action: modeUpper, // 'VIDEO' or 'DOC'
                duration: Math.round(duration),
                metadata: { src: document.getElementById(currentMode + '-frame').src }
            }
        }));

        sessionStartTime = null;
    }
}

// --- Zoom Logic ---

function autoFitZoom() {
    if (currentMode !== 'doc') return;
    const wrapper = document.getElementById('doc-wrapper');
    const iframe = document.getElementById('doc-frame');
    if (!wrapper || !iframe) return;

    const availableWidth = wrapper.clientWidth;
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
        // [MODIFIED] True Full Width for Mobile
        // No fixed width, no grey margins. Use 100% of available space.
        iframe.style.width = '100.2%'; // Slight overshoot to hide potential doc-internal margins
        iframe.style.maxWidth = 'none';

        // If it's Pageless, it will reflow to the phone's width.
        // If it's Page Layout, we scale it to fit the screen.
        let scale = availableWidth / 850; // Use the standard A4 width as base for Page Layout

        // If the user uses Pageless, we should actually be at 1.0 zoom for best quality
        // But since we can't detect Pageless mode easily via iframe src, 
        // we'll assume the user wants readable text and stick to a minimum scale.
        const minReadableScale = (availableWidth / 550); // Target a virtual width of 550px for readability
        if (scale < minReadableScale) scale = minReadableScale;

        applyZoom(scale);
    } else {
        // Desktop: Fixed 850px width centered
        iframe.style.width = '850px';
        let scale = (availableWidth - 20) / BASE_DOC_WIDTH;
        if (scale > 1.2) scale = 1.2;
        applyZoom(scale);
    }
}

function applyZoom(scale) {
    currentScale = scale;
    const iframe = document.getElementById('doc-frame');
    if (!iframe) return;

    const isMobile = window.innerWidth < 768;

    iframe.style.transform = `scale(${scale})`;

    if (isMobile) {
        // [COMPENSATE WIDTH] 
        // If we scale down by 0.5, we need the width to be 200% (100/0.5) 
        // so that the final visual width is 100%.
        iframe.style.width = `${100 / scale}%`;
        iframe.style.height = `${100 / scale}%`;
        iframe.style.marginBottom = `${-(1 - scale) * 100 / scale}%`;
    } else {
        // Desktop handles centering differently
        iframe.style.width = '850px';
        iframe.style.height = `${100 / scale}%`;
        iframe.style.marginBottom = `${-(1 - scale) * 100}%`;

        // Ensure desktop is centered if width < 100%
        const wrapper = document.getElementById('doc-wrapper');
        if (wrapper) wrapper.style.justifyContent = 'center';
    }
}


// --- Helper Functions ---

function requestFullscreenSafe() {
    // Try to fullscreen the top document if same-origin, otherwise use local
    let target = document.documentElement;
    try {
        if (window.top && window.top.document) {
            target = window.top.document.documentElement;
        }
    } catch (e) { }

    if (target.requestFullscreen) {
        target.requestFullscreen().catch(err => console.log(err));
    } else if (target.webkitRequestFullscreen) { /* Safari */
        target.webkitRequestFullscreen();
    }
}

function exitFullscreenSafe() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.log(err));
        } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
        }
    }
}

// --- Event Listeners ---

window.addEventListener('resize', () => {
    if (currentMode === 'doc' && !document.getElementById('media-overlay').classList.contains('hidden')) {
        autoFitZoom();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") closeModal();
});

function onFullscreenChange() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const overlay = document.getElementById('media-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            closeModal();
        }
    }
}

document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

// --- Animation Logic ---

function initAnimations() {
    if (window._animationsInitialized) return;

    console.log("[Animations] Starting initialization...");

    const observerOptions = { threshold: 0.1 };

    // Safely create observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.fade-in, .fade-in-up, .fade-in-left, .fade-in-right');

    animatedElements.forEach((el) => {
        if (!el.classList.contains('visible')) {
            observer.observe(el);
        }
    });

    window._animationsInitialized = true;
    console.log(`[Animations] Observing ${animatedElements.length} elements`);

    // FAILSAFE: Force visibility after 1.5 seconds if simpler browsers or errors occur
    setTimeout(() => {
        animatedElements.forEach(el => {
            if (!el.classList.contains('visible')) {
                console.warn("[Animations] Failsafe triggering for", el);
                el.classList.add('visible');
            }
        });
    }, 1500);
}

// --- Firebase Features (Tracking & Assignments) ---

function initFirebaseFeatures() {
    console.log("[Firebase] Injecting Firebase SDK...");

    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
        import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
        import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
        import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
        import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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
        const logActivityFn = httpsCallable(functions, 'logActivity');
        const submitAssignmentFn = httpsCallable(functions, 'submitAssignment');

        // --- Tracking Logic ---
        
        // Helper to log
        const log = async (action, duration = 0, metadata = {}) => {
            const user = auth.currentUser;
            if (!user) {
                console.log("[Tracking] Skipped: No user logged in.");
                return;
            }
            
            // Get Page ID from URL
            const pathParts = window.location.pathname.split('/');
            const courseId = pathParts[pathParts.length - 1] || 'unknown-page';

            try {
                await logActivityFn({
                    courseId: courseId,
                    action: action,
                    duration: duration,
                    metadata: metadata
                });
            } catch (e) {
                console.error("[Tracking] Upload failed:", e);
            }
        };

        // 1. Listen for Custom Events (VIDEO, DOC)
        window.addEventListener('vibe-log-activity', (e) => {
            const { action, duration, metadata } = e.detail;
            log(action, duration, metadata);
        });

        // 2. Page View Tracking
        let pageStartTime = Date.now();
        const endPageSession = () => {
             const duration = (Date.now() - pageStartTime) / 1000;
             if (duration > 5) { // Only log if > 5 seconds
                 log('PAGE_VIEW', Math.round(duration), { title: document.title });
             }
             pageStartTime = Date.now();
        };

        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                endPageSession();
            }
        });
        window.addEventListener('pagehide', endPageSession);

        // --- Assignment Logic ---

        window.firebaseSubmitAssignment = async (data) => {
             const user = auth.currentUser;
             if (!user) {
                 alert("請先登入 (Please Login First)");
                 return { success: false, error: "Not Logged In" };
             }
             
             try {
                 const result = await submitAssignmentFn(data);
                 return result.data;
             } catch (error) {
                 console.error("Submission Error:", error);
                 alert("提交失敗: " + error.message);
                 throw error;
             }
        };

        console.log("[Firebase] Initialized.");
    `;

    document.body.appendChild(script);
    injectSubmissionModal();
}

/**
 * Injects the Submission Modal HTML
 */
function injectSubmissionModal() {
    const modalHTML = `
    <div id="submission-modal" class="fixed inset-0 bg-black/50 hidden flex items-center justify-center z-[60]">
        <div class="bg-white rounded-xl p-8 w-full max-w-lg shadow-2xl transform transition-all scale-100">
            <h3 class="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">📝 繳交作業 (Submit Assignment)</h3>
            
            <input type="hidden" id="sub-assignment-id">
            <input type="hidden" id="sub-assignment-title">
            
            <div class="mb-5">
                <label class="block text-sm font-bold text-gray-700 mb-2">作業名稱</label>
                <div id="sub-display-title" class="text-gray-900 font-medium bg-gray-100 p-3 rounded"></div>
            </div>

            <div class="mb-5">
                <label class="block text-sm font-bold text-gray-700 mb-2">作業連結 (GitHub / Demo URL) <span class="text-red-500">*</span></label>
                <input type="url" id="sub-url" placeholder="https://github.com/username/project"
                    class="w-full border-2 border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition">
            </div>

            <div class="mb-6">
                <label class="block text-sm font-bold text-gray-700 mb-2">備註 / 留言 (Optional)</label>
                <textarea id="sub-note" placeholder="遇到的困難、心得..."
                    class="w-full border-2 border-gray-300 p-3 rounded-lg h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"></textarea>
            </div>

            <div class="flex justify-end gap-3">
                <button onclick="closeSubmissionModal()"
                    class="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-bold transition">取消</button>
                <button id="btn-confirm-submit" onclick="submitAssignmentAction()"
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold shadow-lg flex items-center gap-2">
                    <span>🚀</span> 送出作業
                </button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Global functions for Modal
window.openSubmissionModal = function (assignmentId, title) {
    document.getElementById('sub-assignment-id').value = assignmentId;
    document.getElementById('sub-assignment-title').value = title;
    document.getElementById('sub-display-title').textContent = title;
    document.getElementById('sub-url').value = '';
    document.getElementById('sub-note').value = '';

    document.getElementById('submission-modal').classList.remove('hidden');
};

window.closeSubmissionModal = function () {
    document.getElementById('submission-modal').classList.add('hidden');
};

window.submitAssignmentAction = async function () {
    const btn = document.getElementById('btn-confirm-submit');
    const originalText = btn.innerHTML;

    const assignmentId = document.getElementById('sub-assignment-id').value;
    const title = document.getElementById('sub-assignment-title').value;
    const url = document.getElementById('sub-url').value;
    const note = document.getElementById('sub-note').value;

    if (!url) {
        alert("請輸入作業連結！");
        return;
    }

    // Get Course ID / Unit ID from URL
    // Assumption: URL is like /courses/02-unit-ui-ux-standards.html
    const pathParts = window.location.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1]; // 02-unit-ui-ux-standards.html
    const courseId = fileName.split('-')[0] + "-master"; // Rough guess, or just use FileName
    const unitId = fileName;

    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> 提交中...`;

    try {
        if (typeof window.firebaseSubmitAssignment !== 'function') {
            throw new Error("Firebase SDK not initialized yet.");
        }

        const result = await window.firebaseSubmitAssignment({
            courseId: courseId,
            unitId: unitId,
            assignmentId: assignmentId,
            title: title,
            url: url,
            note: note
        });

        if (result.success) {
            alert("作業繳交成功！老師將會收到通知。");
            closeSubmissionModal();
        } else {
            alert("繳交失敗: " + (result.message || "Unknown error"));
        }
    } catch (e) {
        console.error(e);
        // Error alert handled in firebaseSubmitAssignment or here
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

