// Backward-compatible shim for cached pages.
// Canonical script path is now /js/course-shared.js
(function redirectLegacyCourseShared() {
    if (window.__courseSharedLegacyShimLoaded) return;
    window.__courseSharedLegacyShimLoaded = true;

    if (document.querySelector('script[data-course-shared-canonical="true"]')) return;

    const script = document.createElement('script');
    script.src = '/js/course-shared.js';
    script.setAttribute('data-course-shared-canonical', 'true');
    document.head.appendChild(script);
})();
