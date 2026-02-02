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
    <div id="media-overlay" class="fixed inset-0 bg-black z-50 hidden flex flex-col overflow-hidden">
        <!-- Doc Container -->
        <div id="doc-wrapper" class="hidden flex-grow w-full relative overflow-auto bg-gray-200 flex justify-center">
            <iframe id="doc-frame" class="border-0 bg-white shadow-2xl origin-top"
                style="width: 850px; height: 100%; transition: transform 0.2s ease;" src="">
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
            class="close-video-btn absolute top-5 right-5 text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md transition z-50">
            ✕ Close
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

        requestFullscreenSafe(document.documentElement);
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

    // Stop Playback
    document.getElementById('video-frame').src = "";
    document.getElementById('doc-frame').src = "";

    currentMode = null;
    exitFullscreenSafe();

    if (sessionStartTime) {
        const endTime = new Date();
        const duration = (endTime - sessionStartTime) / 1000;
        console.log(`[Tracking] Session duration: ${duration}s`);
        sessionStartTime = null;
    }
}

// --- Zoom Logic ---

function autoFitZoom() {
    if (currentMode !== 'doc') return;
    const wrapper = document.getElementById('doc-wrapper');
    if (!wrapper) return;

    const availableWidth = wrapper.clientWidth;
    // Fit width logic
    let scale = (availableWidth - 20) / BASE_DOC_WIDTH;

    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        const mobileTargetWidth = BASE_DOC_WIDTH * 0.75;
        scale = availableWidth / mobileTargetWidth;
    }

    if (scale < 0.1) scale = 0.1;
    applyZoom(scale);
}

function applyZoom(scale) {
    currentScale = scale;
    const iframe = document.getElementById('doc-frame');
    if (!iframe) return;

    iframe.style.transform = `scale(${scale})`;
    iframe.style.height = `${100 / scale}%`;
    iframe.style.marginBottom = `${-(1 - scale) * 100}%`;
}


// --- Helper Functions ---

function requestFullscreenSafe(elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => console.log(err));
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
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
