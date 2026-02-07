/**
 * Navigation Component
 * Renders the navigation bar dynamically.
 * 
 * @param {string} rootPath - The relative path to the root directory (e.g., '.', '..').
 * @param {object} options - Configuration options.
 * @param {boolean} options.showAuth - Whether to show the Login/Cart section (default: false).
 */

// Global Toggle Function
window.toggleMobileMenu = function () {
    const menu = document.getElementById('mobile-menu');
    // alert('Debug: Toggle Menu Clicked'); // Uncomment for production debugging if needed
    console.log('[Nav] Toggle Mobile Menu', menu);

    if (menu) {
        menu.classList.toggle('hidden');
        // Force a style update
        menu.style.display = menu.classList.contains('hidden') ? 'none' : 'block';
    } else {
        alert('Error: Menu element not found');
    }
};

// Document-level Event Delegation (Run once on load)
const handleMenuClick = (e) => {
    // Check if the click target is the button or its children
    const btn = e.target.closest('#mobile-menu-btn');
    if (btn) {
        e.preventDefault();
        e.stopPropagation(); // Stop bubbling
        // alert('Debug: Button Clicked');
        window.toggleMobileMenu();
    }
};

document.addEventListener('click', handleMenuClick, true); // Capture phase
// Add touch support just in case
document.addEventListener('touchend', function (e) {
    const btn = e.target.closest('#mobile-menu-btn');
    if (btn) {
        e.preventDefault();
        window.toggleMobileMenu();
    }
}, { passive: false });

window.renderNav = function (rootPath = '.', options = {}) {
    const showAuth = options.showAuth || false;
    const brandSuffix = options.brandSuffix || '';
    const isFluid = options.isFluid !== undefined ? options.isFluid : true;

    // Helper to resolve paths
    const resolve = (path) => {
        if (path.startsWith('http')) return path;
        return `${rootPath}/${path}`.replace('./http', 'http').replace('//', '/');
    };

    // Inject critical styles dynamically to ensure consistency
    const style = document.createElement('style');
    style.innerHTML = `
        /* Robust Dropdown Behavior */
        @media (hover: hover) {
            .dropdown:hover .dropdown-menu { display: block; }
        }
        
        /* Mobile Menu Transitions */
        #mobile-menu {
            transition: all 0.3s ease-in-out;
        }
        
        /* Ensure button is clickable */
        #mobile-menu-btn {
            cursor: pointer;
            touch-action: manipulation;
        }
    `;
    document.head.appendChild(style);

    const navHTML = `
    <nav class="bg-white/90 backdrop-blur-md shadow-md sticky top-0 z-[99999]" id="main-nav">
        <div class="${isFluid ? 'w-full px-6' : 'container mx-auto px-4'}">
            <div class="flex justify-between items-center py-4">
                <a href="${resolve('index.html')}"
                    class="text-2xl font-extrabold text-blue-900 tracking-tight flex items-center gap-2">
                    <span>🚀</span> Vibe Coding ${brandSuffix ? `<span class="text-sm font-normal text-gray-500 ml-2">${brandSuffix}</span>` : ''}
                </a>

                <!-- Right side: Links + Auth/Mobile Button -->
                <div class="flex items-center gap-6">
                    <div class="hidden md:flex items-center space-x-6 font-medium text-gray-600">
                        <div class="relative dropdown group">
                            <button class="flex items-center hover:text-cyan-600 transition cursor-pointer py-2">
                                課程連結 <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                            <div
                                class="dropdown-menu absolute hidden group-hover:block bg-white shadow-xl rounded-lg py-2 w-48 mt-0 border border-gray-100 left-0">
                                <a href="${resolve('prepare.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">課前準備</a>
                                <a href="${resolve('started.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">入門課程</a>
                                <a href="${resolve('basic.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">基礎實作</a>
                                <a href="${resolve('advanced.html')}"
                                    class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">進階應用</a>
                            </div>
                        </div>

                        <div class="relative dropdown group">
                            <button class="flex items-center hover:text-cyan-600 transition cursor-pointer py-2">
                                組態設定 <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                            <div
                                class="dropdown-menu absolute hidden group-hover:block bg-white shadow-xl rounded-lg py-2 w-48 mt-0 border border-gray-100 left-0">
                                <a href="${resolve('examples/wifi-config.html')}" class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">WiFi 設定</a>
                                <a href="${resolve('examples/motor-config.html')}"
                                    class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">馬達設定</a>
                            </div>
                        </div>

                        <div class="relative dropdown group">
                            <button class="flex items-center text-cyan-600 font-bold transition cursor-pointer py-2">
                                關於我們 <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                            <div
                                class="dropdown-menu absolute hidden group-hover:block bg-white shadow-xl rounded-lg py-2 w-48 mt-0 border border-gray-100 left-0">
                                <a href="${resolve('faq.html')}" class="block px-4 py-2 bg-cyan-50 text-cyan-700">課程使用說明</a>
                                <a href="${resolve('about.html')}"
                                    class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">關於付費與購買</a>
                                <a href="${resolve('collaboration.html')}"
                                    class="block px-4 py-2 hover:bg-cyan-50 hover:text-cyan-700">合作事宜</a>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-4">
                        ${showAuth ? `
                        <div class="flex items-center space-x-4">
                            <a href="${resolve('cart.html')}" class="text-gray-600 hover:text-cyan-600 transition duration-150 relative"
                                title="前往購物車">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"
                                    stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round"
                                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.2 4h12.4M15 13H7" />
                                </svg>
                            </a>

                            <div id="auth-status" class="text-sm flex items-center">
                                <span id="user-display" class="text-gray-600 hidden md:inline mr-2">訪客</span>
                                <button id="login-btn"
                                    class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-full transition shadow-md">登入</button>
                            </div>
                        </div>
                        ` : ''}

                        <!-- Mobile Menu Button (Always visible on mobile) -->
                        <div class="md:hidden z-[99999]" style="position: relative;">
                            <button id="mobile-menu-btn" type="button"
                                style="pointer-events: auto; cursor: pointer; position: relative; z-index: 99999;"
                                class="text-gray-600 focus:outline-none p-2 border rounded hover:bg-gray-100">
                                <svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M4 6h16M4 12h16M4 18h16"></path>
                                </svg>
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
        placeholder.outerHTML = navHTML;
    } else {
        // Fallback: Try to replace existing nav if placeholder not found?
        // Or user might have called it without placeholder.
        const existingNav = document.getElementById('main-nav') || document.querySelector('nav');
        if (existingNav) {
            existingNav.outerHTML = navHTML;
        } else {
            document.body.insertAdjacentHTML('afterbegin', navHTML);
        }
    }

    // Attach Event Listeners
    setTimeout(() => {
        // Init active link highlight
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('nav a');

        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('javascript') || href === '#') return;

            const isMatch = (href === '/' && (currentPath === '/' || currentPath.endsWith('index.html'))) ||
                (href !== '/' && currentPath.includes(href));

            if (isMatch) {
                link.classList.add('text-cyan-600', 'font-bold');
                link.classList.remove('text-gray-600');
                const parentDropdown = link.closest('.dropdown');
                if (parentDropdown) {
                    const triggerBtn = parentDropdown.querySelector('button');
                    if (triggerBtn) {
                        triggerBtn.classList.add('text-cyan-600', 'font-bold');
                        triggerBtn.classList.remove('text-gray-600');
                    }
                }
            }
        });
    }, 0);
};

