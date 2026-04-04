
/** [VIBE_CORE_INIT] Site-wide Dashboard FAB (Premium UI) **/
window.injectEmergencyDashboardFAB = function() {
    if (document.getElementById("dashboard-fab")) return;
    if (window.top !== window) return;
    const fab = document.createElement("button");
    fab.id = "dashboard-fab";
    fab.className = "fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-[#1D3557] to-[#457B9D] text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group z-[10000]";
    fab.style.zIndex = "10000";
    fab.innerHTML = \`
        <span class="text-3xl group-hover:rotate-12 transition-transform">📊</span>
        <span class="absolute right-full mr-4 px-3 py-1 bg-gray-800/90 backdrop-blur-sm text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
            查看儀表板
        </span>
    \`;
    fab.onclick = () => {
        const url = "https://vibe-coding-dashboard.web.app/?courseId=" + (window.location.pathname.split("/").pop() || "index.html").split("-")[0] + "-master";
        window.open(url, "_blank");
    };
    document.body.appendChild(fab);
};
if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", window.injectEmergencyDashboardFAB); } else { window.injectEmergencyDashboardFAB(); }
