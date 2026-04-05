/**
 * Unified Navigation & Dashboard Component (v2026.04.05.AUTO)
 * Combines Top Navbar Rendering and Floating Dashboard FAB logic.
 * Supports Auto-Scan rendering via #nav-placeholder data attributes.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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

// --- 1. Global Navigation Logic ---

window.toggleMobileMenu = function () {
    const menu = document.getElementById('mobile-menu');
    if (menu) {
        menu.classList.toggle('hidden');
        menu.style.display = menu.classList.contains('hidden') ? 'none' : 'block';
    }
};

// Global event for mobile menu
document.addEventListener('click', (e) => {
    const btn = e.target.closest('#mobile-menu-btn');
    if (btn) {
        e.preventDefault();
        e.stopPropagation();
        window.toggleMobileMenu();
    }
}, true);

window.renderNav = function (rootPath = '.', options = {}) {
    const showAuth = options.showAuth || false;
    const brandSuffix = options.brandSuffix || '';
    const isFluid = options.isFluid !== undefined ? options.isFluid : true;

    const resolve = (path) => {
        if (path.startsWith('http')) return path;
        return `${rootPath}/${path}`.replace('./http', 'http').replace(/\/\//g, '/');
    };

    const style = document.createElement('style');
    style.innerHTML = `
        @media (hover: hover) { .dropdown:hover .dropdown-menu { display: block; } }
        #mobile-menu { transition: all 0.3s ease-in-out; }
        #mobile-menu-btn { cursor: pointer; touch-action: manipulation; }
    `;
    document.head.appendChild(style);

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
                            <a href="${resolve('cart.html')}" class="text-gray-600 hover:text-cyan-600 transition duration-150 relative" title="前往購物車">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.2 4h12.4M15 13H7" />
                                </svg>
                            </a>
                            <div id="auth-status" class="text-sm flex items-center">
                                <span id="user-display" class="text-gray-600 hidden md:inline mr-2">訪客</span>
                                <button id="login-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-full transition shadow-md">登入</button>
                            </div>
                        </div>` : ''}
                        <div class="md:hidden z-[99999]" style="position: relative;">
                            <button id="mobile-menu-btn" type="button" style="pointer-events: auto; cursor: pointer; position: relative; z-index: 99999;" class="text-gray-600 focus:outline-none p-2 border rounded hover:bg-gray-100">
                                <svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div id="mobile-menu" class="hidden md:hidden pb-4 border-t border-gray-100 mt-2 absolute w-full left-0 bg-white shadow-lg z-[99998] px-4" style="display: none;">
                <div class="flex flex-col space-y-3 pt-4 font-medium text-gray-600">
                    <div class="pl-2 border-l-2 border-gray-200 ml-2">
                        <p class="text-xs text-gray-400 mb-1 uppercase">課程連結</p>
                        <a href="${resolve('prepare.html')}" class="block py-1 hover:text-cyan-600">課前準備</a>
                        <a href="${resolve('started.html')}" class="block py-1 hover:text-cyan-600">入門課程</a>
                        <a href="${resolve('basic.html')}" class="block py-1 hover:text-cyan-600">基礎實作</a>
                        <a href="${resolve('advanced.html')}" class="block py-1 hover:text-cyan-600">進階應用</a>
                    </div>
                    <div class="pl-2 border-l-2 border-gray-200 ml-2">
                        <p class="text-xs text-gray-400 mb-1 uppercase">組態設定</p>
                        <a href="${resolve('examples/wifi-config.html')}" class="block py-1 hover:text-cyan-600">WiFi 設定</a>
                        <a href="${resolve('examples/motor-config.html')}" class="block py-1 hover:text-cyan-600">馬達設定</a>
                    </div>
                    <div class="pl-2 border-l-2 border-gray-200 ml-2">
                        <p class="text-xs text-gray-400 mb-1 uppercase">關於我們</p>
                        <a href="${resolve('faq.html')}" class="block py-1 hover:text-cyan-600">課程使用說明</a>
                        <a href="${resolve('about.html')}" class="block py-1 hover:text-cyan-600">關於付費與購買</a>
                        <a href="${resolve('collaboration.html')}" class="block py-1 hover:text-cyan-600">合作事宜</a>
                    </div>
                </div>
            </div>
        </div>
    </nav>
    `;

    const placeholder = document.getElementById('nav-placeholder');
    if (placeholder) {
        placeholder.innerHTML = navHTML; // IMPORTANT: Changed from outerHTML to innerHTML to keep placeholder if needed, or just replace content
        // Actually outerHTML is better to completely swap, but we need the data attributes before swapping
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = navHTML;
        placeholder.parentNode.replaceChild(tempDiv.firstElementChild, placeholder);
    } else {
        const existingNav = document.getElementById('main-nav') || document.querySelector('nav');
        if (existingNav) existingNav.outerHTML = navHTML;
        else document.body.insertAdjacentHTML('afterbegin', navHTML);
    }

    // Sync Auth Status
    onAuthStateChanged(auth, (user) => {
        const userDisplay = document.getElementById('user-display');
        const loginBtn = document.getElementById('login-btn');
        if (userDisplay && loginBtn) {
            if (user) {
                userDisplay.innerText = user.email.split('@')[0];
                userDisplay.classList.remove('hidden');
                loginBtn.innerText = '登出';
                loginBtn.onclick = () => auth.signOut();
            } else {
                userDisplay.innerText = '訪客';
                loginBtn.innerText = '登入';
                loginBtn.onclick = () => window.location.href = resolve('auth.html');
            }
        }
    });

    // Active Highlight
    setTimeout(() => {
        const currentPath = window.location.pathname;
        document.querySelectorAll('nav a').forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href === '#' || href.startsWith('javascript')) return;
            const isMatch = (href === '/' && (currentPath === '/' || currentPath.endsWith('index.html'))) ||
                          (href !== '/' && currentPath.includes(href));
            if (isMatch) {
                link.classList.add('text-cyan-600', 'font-bold');
                const dropdown = link.closest('.dropdown');
                if (dropdown) dropdown.querySelector('button')?.classList.add('text-cyan-600', 'font-bold');
            }
        });
    }, 0);
};

// --- 2. Dashboard FAB Logic ---

window.closeDashboardModal = function () {
    const modal = document.getElementById('dashboard-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
        setTimeout(() => { document.getElementById('dashboard-frame').src = ''; }, 300);
    }
};

window.openDashboardModal = function (courseParam) {
    if (!document.getElementById('dashboard-modal')) {
        const modal = document.createElement('div');
        modal.id = 'dashboard-modal';
        modal.className = 'fixed inset-0 bg-black/60 hidden flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300';
        modal.style.zIndex = '10000000';
        modal.innerHTML = `
            <div class="bg-white w-full h-full max-w-7xl rounded-2xl shadow-2xl relative overflow-hidden flex flex-col transform scale-100 transition-transform">
                <div class="flex justify-between items-center p-4 border-b bg-gray-50/80 backdrop-blur">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">📊</span>
                        <h3 class="text-lg font-bold text-gray-800">儀表板 (Dashboard)</h3>
                    </div>
                    <button id="close-dashboard-btn" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition">
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
        document.getElementById('close-dashboard-btn').onclick = window.closeDashboardModal;
    }

    const modal = document.getElementById('dashboard-modal');
    const frame = document.getElementById('dashboard-frame');
    const loader = document.getElementById('dashboard-loading');

    let finalUnitId = '';
    const iframe = document.getElementById('content-frame');
    if (iframe && iframe.src) {
        try { finalUnitId = new URL(iframe.src, window.location.href).pathname.split('/').pop(); } 
        catch (e) { finalUnitId = iframe.src.split('/').pop().split('?')[0]; }
    }
    if (!finalUnitId) finalUnitId = window.location.pathname.split('/').pop();

    const separator = courseParam.includes('?') ? '&' : '?';
    const unitParam = finalUnitId ? `&unitId=${finalUnitId}` : '';
    frame.src = `/dashboard.html${courseParam}${separator}mode=iframe${unitParam}`;
    loader.classList.remove('hidden');

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (modal.requestFullscreen) modal.requestFullscreen();
    else if (modal.webkitRequestFullscreen) modal.webkitRequestFullscreen();
};

function injectDashboardFAB() {
    if (document.getElementById('dashboard-fab')) return;
    
    const path = decodeURIComponent(window.location.pathname);
    const filename = path.split('/').pop();
    let courseId = '';
    const match = filename.match(/^([a-zA-Z0-9]+-\d+|\d+)-/) || filename.match(/^([a-zA-Z0-9]+)-(master|unit)/);
    if (match) courseId = match[1];
    if (!courseId) {
        if (filename.includes('01-')) courseId = '01';
        else if (filename.includes('02-')) courseId = '02';
        else if (filename.includes('03-')) courseId = '03';
        else if (filename.includes('04-')) courseId = '04';
    }

    const fab = document.createElement('button');
    fab.id = 'dashboard-fab';
    fab.className = 'fixed bottom-8 right-8 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group z-50';
    fab.style.zIndex = '9999';
    fab.innerHTML = `
        <span class="text-3xl group-hover:rotate-12 transition-transform">📊</span>
        <span class="absolute right-full mr-4 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">查看儀表板</span>
    `;
    fab.onclick = () => window.openDashboardModal(`?courseId=${courseId}`);
    document.body.appendChild(fab);
}

// --- 3. AUTO-SCAN INITIALIZATION ---

function init() {
    console.log("[VibeNav] Running Auto-Init...");
    
    // 1. Scan for Navbar Placeholder
    const placeholder = document.getElementById('nav-placeholder');
    if (placeholder) {
        const root = placeholder.getAttribute('data-root') || '.';
        const authFlag = placeholder.getAttribute('data-show-auth') === 'true';
        console.log(`[VibeNav] Auto-rendering Nav: root=${root}, auth=${authFlag}`);
        window.renderNav(root, { showAuth: authFlag });
    }

    // 2. Scan for Course Context
    const path = window.location.pathname;
    if (path.includes('/courses/') || path.includes('master-') || path.includes('unit-')) {
        console.log("[VibeNav] Course context detected, injecting FAB...");
        injectDashboardFAB();
    }
}

// Ensure init runs after DOM is ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
