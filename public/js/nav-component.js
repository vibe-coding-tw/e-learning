/**
 * Unified Navigation & Dashboard Component (v2026.04.05.SAFE_RENDER)
 * Extremely safe rendering engine that prioritizes UI before SDK initialization.
 */

// --- 1. IMMEDIATE UI RENDERING ENGINE ---
// Defined GLOBALLY to ensures zero-delay execution
window.renderNav = function (rootPath = '.', options = {}) {
    console.log("%c[VibeNav] Rendering UI Engine Start...", "color: green; font-weight: bold;");
    const showAuth = options.showAuth || false;
    const brandSuffix = options.brandSuffix || '';
    const isFluid = options.isFluid !== undefined ? options.isFluid : true;

    const resolve = (path) => {
        if (path.startsWith('http')) return path;
        return `${rootPath}/${path}`.replace(/\/+/g, '/').replace(':/', '://');
    };

    const navHTML = `
    <nav class="bg-white/90 backdrop-blur-md shadow-md sticky top-0 z-[99999]" id="main-nav">
        <div class="${isFluid ? 'px-6' : 'container mx-auto px-4'}">
            <div class="flex justify-between items-center py-4">
                <a href="${resolve('index.html')}" class="text-2xl font-extrabold text-blue-900 tracking-tight flex items-center gap-2">
                    <span>🚀</span> Vibe Coding ${brandSuffix ? `<span class="text-sm font-normal text-gray-500 ml-2">${brandSuffix}</span>` : ''}
                </a>
                <div class="flex items-center gap-6">
                    <div class="hidden md:flex items-center space-x-6 font-medium text-gray-600">
                        <div class="relative dropdown group">
                            <button class="flex items-center hover:text-cyan-600 transition cursor-pointer py-2">
                                課程連結 <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <div class="dropdown-menu absolute hidden group-hover:block bg-white shadow-xl rounded-lg py-2 w-48 mt-0 border border-gray-100 left-0">
                                <a href="${resolve('prepare.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">課前準備</a>
                                <a href="${resolve('started.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">入門課程</a>
                                <a href="${resolve('basic.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">基礎實作</a>
                                <a href="${resolve('advanced.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">進階應用</a>
                            </div>
                        </div>
                        <div class="relative dropdown group">
                            <button class="flex items-center hover:text-cyan-600 transition cursor-pointer py-2">
                                組態設定 <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <div class="dropdown-menu absolute hidden group-hover:block bg-white shadow-xl rounded-lg py-2 w-48 mt-0 border border-gray-100 left-0">
                                <a href="${resolve('examples/wifi-config.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">WiFi 設定</a>
                                <a href="${resolve('examples/motor-config.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">馬達設定</a>
                            </div>
                        </div>
                        <div class="relative dropdown group">
                            <button class="flex items-center text-cyan-600 font-bold transition cursor-pointer py-2">
                                關於我們 <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <div class="dropdown-menu absolute hidden group-hover:block bg-white shadow-xl rounded-lg py-2 w-48 mt-0 border border-gray-100 left-0">
                                <a href="${resolve('faq.html')}" class="block px-4 py-2 bg-cyan-50 text-cyan-700">課程使用說明</a>
                                <a href="${resolve('about.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">關於付費與購買</a>
                                <a href="${resolve('collaboration.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">合作事宜</a>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        ${showAuth ? `
                        <div class="flex items-center space-x-4">
                            <a href="${resolve('cart.html')}" class="text-gray-600 hover:text-cyan-600 transition duration-150 relative">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.2 4h12.4M15 13H7" />
                                </svg>
                            </a>
                            <div id="auth-status" class="text-sm flex items-center">
                                <span id="user-display" class="text-gray-600 hidden md:inline mr-2">訪客</span>
                                <button id="login-btn-legacy" class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-full transition shadow-md">登入</button>
                            </div>
                        </div>` : ''}
                        <div class="md:hidden">
                            <button id="mobile-menu-btn" class="text-gray-600 focus:outline-none p-2 border rounded hover:bg-gray-100">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div id="mobile-menu" class="hidden md:hidden pb-4 border-t border-gray-100 absolute w-full left-0 bg-white shadow-lg px-4">
                <div class="flex flex-col space-y-3 pt-4 font-medium text-gray-600">
                    <a href="${resolve('prepare.html')}" class="block py-1">課前準備</a>
                    <a href="${resolve('started.html')}" class="block py-1">入門課程</a>
                    <a href="${resolve('basic.html')}" class="block py-1">基礎實作</a>
                    <a href="${resolve('advanced.html')}" class="block py-1">進階應用</a>
                </div>
            </div>
        </div>
    </nav>
    <style>
        @media (hover: hover) { .dropdown:hover .dropdown-menu { display: block; } }
    </style>
    `;

    const placeholder = document.getElementById('nav-placeholder');
    if (placeholder) {
        placeholder.outerHTML = navHTML;
        console.log("%c[VibeNav] UI Rendered Successfully via outerHTML", "color: green;");
    } else {
        const existingNav = document.getElementById('main-nav') || document.querySelector('nav');
        if (!existingNav) {
            document.body.insertAdjacentHTML('afterbegin', navHTML);
            console.log("%c[VibeNav] UI Rendered Successfully via body prepend", "color: green;");
        }
    }

    // Restore login button functional logic after base render (Legacy mode until Firebase catches up)
    const loginBtn = document.getElementById('login-btn-legacy');
    if (loginBtn) {
        loginBtn.onclick = () => window.location.href = resolve('auth.html');
    }
};

// --- 2. ASYNC SDK LOAD & DASHBOARD LOGIC ---
// Use dynamic import or defer SDK to not block UI
(async function initSafe() {
    console.log("%c[VibeNav] Safe Bootloader Initiated...", "color: blue;");
    
    // Immediate UI Render
    const placeholder = document.getElementById('nav-placeholder');
    if (placeholder) {
        const root = placeholder.getAttribute('data-root') || '.';
        const authFlag = placeholder.getAttribute('data-show-auth') === 'true';
        window.renderNav(root, { showAuth: authFlag });
    }

    // Async Load Firebase
    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js");
        const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");
        
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

        onAuthStateChanged(auth, (user) => {
            const userDisplay = document.getElementById('user-display');
            const loginBtn = document.getElementById('login-btn-legacy');
            if (userDisplay && loginBtn) {
                if (user) {
                    userDisplay.innerText = user.email.split('@')[0];
                    userDisplay.classList.remove('hidden');
                    loginBtn.innerText = '登出';
                    loginBtn.onclick = () => auth.signOut();
                }
            }
        });

        // Dashboard Injector
        const path = window.location.pathname;
        if (path.includes('/courses/') || path.includes('master-') || path.includes('unit-')) {
            const pathInfo = decodeURIComponent(path);
            const filename = pathInfo.split('/').pop();
            let courseId = filename.match(/^([a-zA-Z0-9]+-\d+|\d+)-/)?.[1] || '';
            if (!courseId) {
                if (filename.includes('01-')) courseId = '01';
                else if (filename.includes('02-')) courseId = '02';
                else if (filename.includes('03-')) courseId = '03';
            }
            if (!document.getElementById('dashboard-fab')) {
                const fab = document.createElement('button');
                fab.id = 'dashboard-fab';
                fab.className = 'fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50';
                fab.innerHTML = `<span class="text-3xl">📊</span>`;
                fab.onclick = () => window.location.href = `/dashboard.html?courseId=${courseId}`;
                document.body.appendChild(fab);
            }
        }
    } catch (e) {
        console.error("[VibeNav] SDK failed to load, UI should still be active.", e);
    }
})();
