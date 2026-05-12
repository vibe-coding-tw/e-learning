/**
 * Footer Component for Vibe Coding
 * Synchronizes footer across all pages
 */

document.addEventListener('DOMContentLoaded', () => {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;

    const root = footerPlaceholder.getAttribute('data-root') || '.';
    
    // Helper to resolve paths relative to data-root
    const resolve = (path) => {
        if (path.startsWith('http') || path.startsWith('mailto:')) return path;
        // If the current page is in a subdirectory and path doesn't start with /
        // we use the data-root to resolve it.
        return `${root}/${path}`;
    };

    footerPlaceholder.innerHTML = `
    <footer class="bg-slate-900 py-12 border-t border-white/10 text-white mt-auto">
        <div class="container mx-auto px-6">
            <div class="flex flex-col md:flex-row justify-between items-center gap-8 mb-10">
                <div class="text-2xl font-black tracking-tighter text-white">🚀 Vibe Coding</div>
                <div class="flex flex-wrap justify-center gap-x-8 gap-y-4 text-slate-400 font-bold text-sm uppercase tracking-wide">
                    <a href="${resolve('index.html')}" class="hover:text-white transition-colors">首頁</a>
                    <a href="${resolve('prepare.html')}" class="hover:text-white transition-colors">學習路徑</a>
                    <a href="${resolve('students.html')}" class="hover:text-white transition-colors">課程指南</a>
                    <a href="${resolve('tutors.html')}" class="hover:text-white transition-colors">導師合作</a>
                </div>
            </div>
            
            <div class="pt-10 border-t border-white/5">
                <div class="flex flex-col items-center text-center">
                    <p class="text-slate-500 text-sm mb-6">&copy; 2026 Vibe Coding. All rights reserved.</p>
                    
                    <div class="grid grid-cols-1 md:flex md:flex-row justify-center items-center gap-y-2 md:gap-x-6 text-xs text-slate-500 font-medium">
                        <div class="flex items-center gap-2">
                            <span class="opacity-50">營業人</span>
                            <span class="text-slate-400">腳丫健康科技有限公司</span>
                        </div>
                        <span class="hidden md:inline opacity-20">|</span>
                        <div class="flex items-center gap-2">
                            <span class="opacity-50">統編</span>
                            <span class="text-slate-400">80187668</span>
                        </div>
                        <span class="hidden md:inline opacity-20">|</span>
                        <div class="flex items-center gap-2">
                            <span class="opacity-50">合作洽談</span>
                            <a href="mailto:info@vibe-coding.tw" class="text-indigo-400 hover:text-indigo-300 transition-colors font-bold">info@vibe-coding.tw</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </footer>
    `;
});
