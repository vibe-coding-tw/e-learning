/**
 * course-shared.js?v=2026.04.05.FINAL_V8_STABLE
 * Shared logic for Vibe Coding Course Units
 * Handles: Media Overlay (Video/Doc), Fullscreen, Mobile Zoom, and Animations
 */

// Guard: Only execute once per window context
if (window.__courseSharedLoaded) {
    console.log("[CourseShared] Already loaded, skipping.");
} else {
window.__courseSharedLoaded = true;

// Initializer
function init() {
    console.log("[CourseShared] Initializing...");
    // Cleanup legacy style that may hide dashboard FAB from previous builds.
    const staleFabHide = document.getElementById('hide-dashboard-fab-style');
    if (staleFabHide) staleFabHide.remove();
    ensureUnitTabsTheme();
    normalizeCourseTopNav();
    normalizeCourseBreadcrumbs();
    ensureDynamicUnitTabsFromFirestore();
    hideGlobalNavOnCoursePage();
    applyHideTabsPreference();
    toggleUnitTabsVisibility();
    upgradeLegacyStartUnitToMsLayout();
    applyStartUnitModernTheme();
    injectMediaOverlay();
    injectDashboardModal();
    initAnimations();
    enhanceAssignmentEntryButtons();
    initFirebaseFeatures(); // [NEW] Start Firebase (Tracking + Assignments)
    initGithubReadme(); // [V8.2] Fetch and render GitHub README if applicable
    ensureDashboardFabFallback();
    ensureMobileResponsiveLayout();
    normalizeStartButtonText();
    cleanUpCourseTitles();
    normalizeTerminology();
    interceptGoToUnit();
}

function ensureUnitTabsTheme() {
    try {
        if (document.getElementById('unit-tabs-theme')) return;
        const style = document.createElement('style');
        style.id = 'unit-tabs-theme';
        style.textContent = `
            .unit-tabs-wrapper {
                display: block !important;
                background: #f8fafc !important;
                border-bottom: 1px solid #e2e8f0 !important;
                padding: 12px 16px !important;
                overflow-x: auto !important;
                white-space: nowrap !important;
                -webkit-overflow-scrolling: touch;
            }
            .unit-tabs-container {
                display: block !important;
                min-width: max-content !important;
            }
            .unit-tabs-flex {
                display: inline-flex !important;
                gap: 4px !important;
                align-items: center !important;
            }
            .unit-tab-btn {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                border: none !important;
                cursor: pointer !important;
                transition: all .16s ease-in-out !important;
                font-size: 13px !important;
                font-weight: 700 !important;
                line-height: 1.2 !important;
                margin: 0 !important;
                padding: 8px 22px 8px 22px !important;
                clip-path: polygon(0% 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 0% 100%, 10px 50%) !important;
                border-radius: 0 !important;
                height: 36px !important;
                white-space: nowrap !important;
                outline: none !important;
            }
            .unit-tab-btn.first-tab {
                padding-left: 14px !important;
                clip-path: polygon(0% 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 0% 100%) !important;
            }
            
            /* Pending / Uncompleted state */
            .unit-tab-btn.pending {
                background-color: #e2e8f0 !important;
                color: #475569 !important;
            }
            .unit-tab-btn.pending:hover {
                background-color: #cbd5e1 !important;
                color: #1e293b !important;
            }
            
            /* Active state */
            .unit-tab-btn.active {
                background: linear-gradient(135deg, #0078d4, #005a9e) !important;
                color: #ffffff !important;
                font-weight: 700 !important;
            }
            .unit-tab-btn.active:hover {
                background: linear-gradient(135deg, #0086ed, #0066b3) !important;
            }
            
            /* Completed state */
            .unit-tab-btn.completed {
                background-color: #d1fae5 !important;
                color: #065f46 !important;
            }
            .unit-tab-btn.completed:hover {
                background-color: #a7f3d0 !important;
                color: #047857 !important;
            }
            
            /* Badge styles */
            .unit-tab-btn .step-badge {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 18px !important;
                height: 18px !important;
                border-radius: 50% !important;
                font-size: 10px !important;
                font-weight: 800 !important;
                margin-right: 6px !important;
                flex-shrink: 0 !important;
                transition: all 0.16s ease-in-out !important;
            }
            .unit-tab-btn.pending .step-badge {
                background-color: #cbd5e1 !important;
                color: #475569 !important;
            }
            .unit-tab-btn.active .step-badge {
                background-color: #ffffff !important;
                color: #005a9e !important;
            }
            .unit-tab-btn.completed .step-badge {
                background-color: #059669 !important;
                color: #ffffff !important;
            }
            
            .ms-achievement h3 {
                color: #ffffff !important;
            }
            .ms-sidebar-header .module-label {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    } catch (e) {
        console.warn('[CourseShared] ensureUnitTabsTheme failed:', e);
    }
}

function normalizeUnitFilenameForRoute(file = '') {
    const v = String(file || '').split('/').pop().split('?')[0].trim();
    if (!v) return '';
    if (/^tw-(common|car-(starter|basic|advanced))-/i.test(v)) return v;
    if (/^start-\d{2}-unit-/i.test(v)) return v.replace(/^start-\d{2}-unit-/i, 'tw-car-starter-');
    if (/^basic-\d{2}-unit-/i.test(v)) return v.replace(/^basic-\d{2}-unit-/i, 'tw-car-basic-');
    if (/^(adv|advanced)-\d{2}-unit-/i.test(v)) return v.replace(/^(adv|advanced)-\d{2}-unit-/i, 'tw-car-advanced-');
    if (/^\d{2}-unit-/i.test(v)) return v.replace(/^\d{2}-unit-/i, 'tw-common-');
    return v;
}

function formatUnitTabTitle(unitFile = '', fallbackIndex = 0) {
    const raw = String(unitFile || '').replace('.html', '');
    const stem = raw
        .replace(/^tw-(common|car-(starter|basic|advanced))-/i, '')
        .replace(/^start-\d{2}-unit-/i, '')
        .replace(/^basic-\d{2}-unit-/i, '')
        .replace(/^(adv|advanced)-\d{2}-unit-/i, '')
        .replace(/^\d{2}-unit-/i, '');
    const title = stem
        .split('-')
        .filter(Boolean)
        .map(part => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    return `${fallbackIndex + 1} ${title || `Unit ${fallbackIndex + 1}`}`;
}

function buildUnitAuthUrl(unitFile = '') {
    const target = `/courses/${unitFile}`;
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang') || urlParams.get('locale') || '';
    const appendLang = lang ? `&lang=${encodeURIComponent(lang)}` : '';
    return `/auth.html?url=${encodeURIComponent(target)}&id=${encodeURIComponent(unitFile)}&price=0${appendLang}`;
}

async function ensureDynamicUnitTabsFromFirestore() {
    try {
        const fileName = (window.location.pathname.split('/').pop() || '').toLowerCase();
        const excluded = new Set(['', 'index.html', 'prepare.html', 'start.html', 'basic.html', 'advanced.html', 'learning-path.html', 'dashboard.html', 'students.html', 'tutors.html', 'cart.html', 'payment-return.html']);
        if (!fileName.endsWith('.html') || excluded.has(fileName)) return;

        if (!globalLessonsData || !Array.isArray(globalLessonsData) || globalLessonsData.length === 0) {
            globalLessonsData = await vibeFetchLessons();
        }
        if (!Array.isArray(globalLessonsData) || globalLessonsData.length === 0) return;

        const normalizeLooseKey = (value = '') => String(value || '').split('/').pop().split('?')[0].replace('.html', '').toLowerCase();
        const targetKey = normalizeLooseKey(normalizeUnitFilenameForRoute(fileName));
        const matchedCourse = globalLessonsData.find((course) => {
            const units = Array.isArray(course?.courseUnits) ? course.courseUnits : [];
            return units
                .map(normalizeUnitFilenameForRoute)
                .map(normalizeLooseKey)
                .includes(targetKey);
        });
        if (!matchedCourse) return;

        const units = (Array.isArray(matchedCourse.courseUnits) ? matchedCourse.courseUnits : [])
            .map(normalizeUnitFilenameForRoute)
            .filter(Boolean);
        if (units.length < 2) return;

        const existingTabs = document.getElementById('course-tabs-container');
        if (existingTabs && existingTabs.querySelector('.unit-tab-btn')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'unit-tabs-wrapper relative z-40';
        wrapper.style.display = 'block';
        wrapper.style.backgroundColor = '#f8fafc';
        wrapper.style.borderBottom = '1px solid #e2e8f0';
        wrapper.style.padding = '16px 20px';
        wrapper.style.overflowX = 'auto';
        wrapper.style.whiteSpace = 'nowrap';

        wrapper.innerHTML = `
            <div id="course-tabs-container" class="unit-tabs-container" style="display: block; min-width: max-content; position: relative;">
                <div class="unit-tabs-flex" style="display: inline-flex; gap: 12px; align-items: center; position: relative; z-index: 1;"></div>
            </div>
        `;
        const flex = wrapper.querySelector('.unit-tabs-flex');
        const activeIndex = units.findIndex(unitFile => normalizeLooseKey(unitFile) === targetKey);

        units.forEach((unitFile, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const isActive = idx === activeIndex;
            const isCompleted = idx < activeIndex;

            const classList = ['unit-tab-btn'];
            if (idx === 0) classList.push('first-tab');
            if (isActive) {
                classList.push('active');
            } else if (isCompleted) {
                classList.push('completed');
            } else {
                classList.push('pending');
            }
            btn.className = classList.join(' ');

            let badgeText = `${idx + 1}`;
            if (isCompleted) {
                badgeText = '✓';
            }

            let titleText = '';
            if (matchedCourse && Array.isArray(matchedCourse.courseUnitTitles) && matchedCourse.courseUnitTitles[idx]) {
                titleText = matchedCourse.courseUnitTitles[idx];
            } else {
                titleText = formatUnitTabTitle(unitFile, idx).replace(/^\d+\s*/, '');
            }
            titleText = sanitizeTitle(titleText);

            btn.innerHTML = `
                <span class="step-badge">${badgeText}</span>
                <span>${titleText}</span>
            `;

            btn.addEventListener('click', () => {
                window.location.href = buildUnitAuthUrl(unitFile);
            });
            
            flex.appendChild(btn);
        });

        const anchor = document.querySelector('.ms-topnav') || document.getElementById('main-nav') || document.querySelector('nav');
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);
        } else {
            document.body.insertBefore(wrapper, document.body.firstChild);
        }
    } catch (e) {
        console.warn('[CourseShared] ensureDynamicUnitTabsFromFirestore failed:', e);
    }
}

function normalizeCourseTopNav() {
    try {
        const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if (!file.endsWith('.html')) return;

        const topNav = document.querySelector('.ms-topnav');
        if (!topNav) return;

        // Normalize course bucket label to keep all units visually consistent.
        let navLabel = topNav.querySelector('.nav-label');
        if (navLabel) {
            if (navLabel.tagName !== 'A') {
                const link = document.createElement('a');
                link.className = navLabel.className;
                link.textContent = navLabel.textContent;
                navLabel.parentNode.replaceChild(link, navLabel);
                navLabel = link;
            }
            const isStarter = file.startsWith('start-') || /^(?:tw|en)-car-starter-/i.test(file);
            const isBasic = file.startsWith('basic-') || /^(?:tw|en)-car-basic-/i.test(file);
            const isAdvanced = file.startsWith('adv-') || /^(?:tw|en)-car-advanced-/i.test(file);
            const isPrepare = file.startsWith('prepare-') || /^(?:tw|en)-common-/i.test(file);

            const urlParams = new URLSearchParams(window.location.search);
            const queryLang = urlParams.get('lang') || urlParams.get('locale') || '';
            const isEn = queryLang.trim().toLowerCase().startsWith('en') || file.startsWith('en-');
            const pathPrefix = isEn ? 'en-' : 'tw-';
            const langQuery = isEn ? '&lang=en' : '';
            const homeLangQuery = isEn ? '?lang=en' : '';

            const translate = (key, defaultText) => {
                if (typeof window.t === 'function') {
                    const res = window.t(key);
                    if (res && res !== key) return res;
                }
                // 當未載入 i18n 翻譯器且處於英文模式時，回傳英文預設標題
                if (isEn) {
                    const enDict = {
                        'starter_title': 'Starter Unit',
                        'basic_title': 'Basic Unit',
                        'advanced_title': 'Advanced Unit',
                        'prepare_title': 'Preparation Unit'
                    };
                    return enDict[key] || defaultText;
                }
                return defaultText;
            };

            if (isStarter) {
                navLabel.textContent = translate('starter_title', '入門課程');
                navLabel.setAttribute('href', `/learning-path.html?path=${pathPrefix}car-starter${langQuery}`);
                navLabel.setAttribute('target', '_top');
            }
            else if (isBasic) {
                navLabel.textContent = translate('basic_title', '基礎課程');
                navLabel.setAttribute('href', `/learning-path.html?path=${pathPrefix}car-basic${langQuery}`);
                navLabel.setAttribute('target', '_top');
            }
            else if (isAdvanced) {
                navLabel.textContent = translate('advanced_title', '進階課程');
                navLabel.setAttribute('href', `/learning-path.html?path=${pathPrefix}car-advanced${langQuery}`);
                navLabel.setAttribute('target', '_top');
            }
            else if (isPrepare) {
                navLabel.textContent = translate('prepare_title', '準備課程');
                navLabel.setAttribute('href', `/learning-path.html?path=${pathPrefix}common${langQuery}`);
                navLabel.setAttribute('target', '_top');
            }
        }

        // Fix broken brand href for unit pages (especially start pages).
        const brandLink = topNav.querySelector('.brand');
        if (!brandLink) return;

        const isEnMode = (new URLSearchParams(window.location.search).get('lang') || '').toLowerCase().startsWith('en') || file.startsWith('en-');

        // Normalize brand text/icon style using the current production baseline.
        brandLink.innerHTML = '<i class="fas fa-rocket"></i> Vibe Coding';
        brandLink.setAttribute('href', isEnMode ? '/index.html?lang=en' : '/index.html');
        brandLink.setAttribute('target', '_top');

        // 入門課程 top-nav 整合：注入第三段課程名稱 (nav-course-name)
        const isStarter = file.startsWith('start-') || /^(?:tw|en)-car-starter-/i.test(file);
        if (isStarter) {
            let navCourseNameSpan = document.getElementById('nav-course-name');
            if (!navCourseNameSpan) {
                const divider = document.createElement('div');
                divider.className = 'divider';
                
                navCourseNameSpan = document.createElement('span');
                navCourseNameSpan.id = 'nav-course-name';
                navCourseNameSpan.style.cssText = 'color:rgba(255,255,255,.85);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
                
                topNav.appendChild(divider);
                topNav.appendChild(navCourseNameSpan);
            }
            
            const moduleTitleEl = document.querySelector('.ms-sidebar-header .module-title') || document.querySelector('.module-title');
            if (moduleTitleEl) {
                const moduleTitle = moduleTitleEl.textContent.trim();
                let courseNum = '';
                
                const startMatch = file.match(/^start-(\d{2})-unit-/i);
                if (startMatch) {
                    courseNum = startMatch[1];
                } else {
                    const lookup = {
                        'html5-basics': '01', 'flexbox-layout': '01', 'ui-ux-standards': '01',
                        'ble-security': '02', 'ble-async': '02', 'typed-arrays': '02',
                        'control-panel': '03', 'data-json': '03', 'flow-logic': '03',
                        'touch-basics': '04', 'long-press': '04', 'prevent-default': '04',
                        'touch-vs-mouse': '05', 'canvas-joystick': '05', 'joystick-math': '05'
                    };
                    const suffixMatch = file.match(/^(?:tw|en)-car-starter-(.+)\.html$/i);
                    if (suffixMatch && lookup[suffixMatch[1]]) {
                        courseNum = lookup[suffixMatch[1]];
                    }
                }
                
                if (courseNum) {
                    const prefix = isEnMode ? `Starter ${courseNum}: ` : `入門 ${courseNum}：`;
                    navCourseNameSpan.textContent = prefix + moduleTitle;
                } else {
                    navCourseNameSpan.textContent = moduleTitle;
                }
            }
        }
    } catch (e) {
        console.warn('[CourseShared] normalizeCourseTopNav failed:', e);
    }
}

/**
 * 規格化入門課程的麵包屑 (ms-breadcrumb)
 * 使其與基礎/進階課程一致（包含 bc-module-link 與 bc-current）
 */
function normalizeCourseBreadcrumbs() {
    try {
        const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if (!file.endsWith('.html')) return;

        const isStarter = file.startsWith('start-') || /^(?:tw|en)-car-starter-/i.test(file);
        if (!isStarter) return;

        const breadcrumb = document.querySelector('.ms-breadcrumb');
        if (!breadcrumb) return;

        let bcModuleLink = document.getElementById('bc-module-link');
        if (!bcModuleLink) {
            breadcrumb.innerHTML = '<a onclick="goToUnit(0)" style="cursor:pointer" id="bc-module-link"></a> › <span id="bc-current">課程總覽</span>';
            bcModuleLink = document.getElementById('bc-module-link');
        }

        const moduleTitleEl = document.querySelector('.ms-sidebar-header .module-title') || document.querySelector('.module-title');
        if (moduleTitleEl && bcModuleLink) {
            bcModuleLink.textContent = moduleTitleEl.textContent.trim();
        }
    } catch (e) {
        console.warn('[CourseShared] normalizeCourseBreadcrumbs failed:', e);
    }
}

function hideGlobalNavOnCoursePage() {
    try {
        const path = window.location.pathname || '';
        const file = (path.split('/').pop() || '').toLowerCase();
        const isCourseRoute = path.startsWith('/courses/');
        const isPrepareUnit = /^(?:prepare-\d+|tw-common)-.*\.html$/.test(file);
        if (!isCourseRoute && !isPrepareUnit) return;
        if (document.getElementById('course-hide-main-nav-style')) return;

        const style = document.createElement('style');
        style.id = 'course-hide-main-nav-style';
        style.textContent = `
            #main-nav { display: none !important; }
            #nav-placeholder { display: none !important; }
        `;
        document.head.appendChild(style);
    } catch (e) {
        console.warn('[CourseShared] hideGlobalNavOnCoursePage failed:', e);
    }
}

function ensureDashboardFabFallback() {
    try {
        const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
        const excluded = new Set([
            '',
            'index.html',
            'prepare.html',
            'start.html',
            'basic.html',
            'advanced.html',
            'learning-path.html',
            'students.html',
            'tutors.html',
            'dashboard.html',
            'cart.html',
            'payment-return.html'
        ]);
        if (!file.endsWith('.html') || excluded.has(file)) return;

        const inject = () => {
            if (document.getElementById('dashboard-fab')) return;
            const fab = document.createElement('button');
            fab.id = 'dashboard-fab';
            fab.className = 'fixed bottom-8 right-8 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 z-50';
            fab.style.zIndex = '9999';
            fab.innerHTML = '<span class="text-3xl">📊</span>';
            fab.onclick = () => {
                if (typeof window.openDashboardModal === 'function') {
                    window.openDashboardModal();
                } else {
                    const u = `/dashboard.html?unitId=${encodeURIComponent(file)}`;
                    window.location.href = u;
                }
            };
            document.body.appendChild(fab);
        };

        setTimeout(inject, 50);
        setTimeout(inject, 500);
        document.addEventListener('DOMContentLoaded', inject);
    } catch (e) {
        console.warn('[CourseShared] ensureDashboardFabFallback failed:', e);
    }
}

function upgradeLegacyStartUnitToMsLayout() {
    try {
        const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if (!/^start-\d{2}-unit-.*\.html$/.test(file)) return;
        if (document.querySelector('.ms-layout')) return;

        const legacyMain = document.querySelector('main');
        const legacySections = legacyMain ? Array.from(legacyMain.querySelectorAll('.module-section')) : [];
        if (!legacyMain || legacySections.length === 0) return;

        const pageTitle = (document.querySelector('header h1')?.textContent || document.title || '課程單元').trim();
        const pageSubtitle = (document.querySelector('header p')?.textContent || '').trim();

        const topNav = document.createElement('nav');
        topNav.className = 'ms-topnav';
        topNav.innerHTML = `
            <a href="/learning-path.html?path=tw-car-starter" target="_top" class="brand"><i class="fas fa-graduation-cap"></i> Vibe Coding Learn</a>
            <div class="divider"></div>
            <a href="/learning-path.html?path=tw-car-starter" target="_top" class="nav-label nav-label-link">入門課程</a>
        `;

        const layout = document.createElement('div');
        layout.className = 'ms-layout';

        const sidebar = document.createElement('aside');
        sidebar.className = 'ms-sidebar';
        sidebar.innerHTML = `
            <div class="ms-sidebar-header">
                <div class="module-label">單元</div>
                <div class="module-title"></div>
                <div class="meta"><i class="far fa-clock"></i> 約 45 分鐘 · ${legacySections.length + 1} 頁</div>
            </div>
            <nav class="ms-unit-list" id="sidebar-nav"></nav>
            <div class="sidebar-progress">
                <div class="progress-bar-bg"><div class="progress-bar-fill" id="progress-fill" style="width:0%"></div></div>
                <div class="progress-text" id="progress-text">0 / ${legacySections.length} 已完成</div>
            </div>
        `;
        sidebar.querySelector('.module-title').textContent = pageTitle;

        const content = document.createElement('main');
        content.className = 'ms-content';
        content.innerHTML = `
            <div class="ms-breadcrumb">
                <a href="#">Vibe Coding</a><span>›</span>
                <a href="#">入門課程</a><span>›</span>
                <span id="bc-current">課程總覽</span>
            </div>
        `;

        const pageIndex = document.createElement('div');
        pageIndex.className = 'ms-unit-page visible';
        pageIndex.id = 'page-index';
        pageIndex.innerHTML = `
            <div class="unit-content">
                <h1>${pageTitle}</h1>
                ${pageSubtitle ? `<p>${pageSubtitle}</p>` : ''}
                <h2>本單元內容</h2>
                <div class="unit-card-list" id="index-unit-list"></div>
                <div style="margin-top:32px;">
                    <button class="ms-btn" onclick="goToUnit(1)">開始單元 &nbsp;›</button>
                </div>
            </div>
        `;
        content.appendChild(pageIndex);

        const unitTitles = [];
        legacySections.forEach((section, idx) => {
            const pageNo = idx + 1;
            const title = (section.querySelector('.section-header-left h2')?.textContent || section.querySelector('h2')?.textContent || `單元 ${pageNo}`).trim();
            unitTitles.push(title);
            const page = document.createElement('div');
            page.className = 'ms-unit-page';
            page.id = `page-${pageNo}`;

            const contentWrap = document.createElement('div');
            contentWrap.className = 'unit-content';
            contentWrap.innerHTML = `<h1>${title}</h1>`;

            const sectionBody = section.querySelector('.p-8, .p-6, .p-10') || section;
            const cloned = sectionBody.cloneNode(true);
            // Remove header blocks from legacy card to avoid duplicate big titles.
            cloned.querySelectorAll('.section-header-left').forEach(el => el.remove());
            contentWrap.appendChild(cloned);

            const nav = document.createElement('div');
            nav.className = 'unit-nav';
            const prevTarget = pageNo === 1 ? 0 : pageNo - 1;
            const nextTarget = pageNo === legacySections.length ? 0 : pageNo + 1;
            nav.innerHTML = `
                <button class="nav-btn-prev" onclick="goToUnit(${prevTarget})">‹ &nbsp;${pageNo === 1 ? '總覽' : '上一頁'}</button>
                <span class="unit-page-indicator">${pageNo} / ${legacySections.length}</span>
                <button class="nav-btn-next" onclick="markDone(${pageNo}); goToUnit(${nextTarget})">${pageNo === legacySections.length ? '返回總覽' : '下一頁'} &nbsp;›</button>
            `;

            page.appendChild(contentWrap);
            page.appendChild(nav);
            content.appendChild(page);
        });

        layout.appendChild(sidebar);
        layout.appendChild(content);

        // Replace body content with the upgraded layout.
        document.body.innerHTML = '';
        document.body.appendChild(topNav);
        document.body.appendChild(layout);

        const sideNav = document.getElementById('sidebar-nav');
        const indexList = document.getElementById('index-unit-list');
        unitTitles.forEach((title, i) => {
            const unitNo = i + 1;
            const sideItem = document.createElement('div');
            sideItem.className = 'ms-unit-item';
            sideItem.dataset.unit = String(unitNo);
            sideItem.innerHTML = `
                <div class="unit-icon">${unitNo}</div>
                <div class="unit-meta">
                    <div class="unit-name">${title}</div>
                </div>
            `;
            sideItem.addEventListener('click', () => window.goToUnit(unitNo));
            sideNav.appendChild(sideItem);

            const indexItem = document.createElement('div');
            indexItem.className = 'unit-card';
            indexItem.innerHTML = `
                <div class="unit-card-num">${unitNo}</div>
                <div class="unit-card-info"><div class="unit-card-name">${title}</div></div>
                <div class="unit-card-arrow">›</div>
            `;
            indexItem.addEventListener('click', () => window.goToUnit(unitNo));
            indexList.appendChild(indexItem);
        });

        window.__startUnitDone = new Set();
        window.markDone = function (unitNo) {
            if (!unitNo || unitNo < 1) return;
            window.__startUnitDone.add(unitNo);
            refreshStartUnitUiState();
        };
        window.goToUnit = function (unitNo) {
            const allPages = Array.from(document.querySelectorAll('.ms-unit-page'));
            allPages.forEach(p => p.classList.remove('visible'));
            const target = unitNo === 0 ? document.getElementById('page-index') : document.getElementById(`page-${unitNo}`);
            if (target) target.classList.add('visible');

            document.querySelectorAll('.ms-unit-item').forEach(it => {
                const n = Number(it.dataset.unit);
                it.classList.toggle('active', n === unitNo);
                const icon = it.querySelector('.unit-icon');
                if (!icon) return;
                icon.classList.toggle('active-icon', n === unitNo);
                icon.classList.toggle('done', window.__startUnitDone.has(n));
                icon.innerHTML = window.__startUnitDone.has(n) ? '<i class="fas fa-check"></i>' : String(n);
            });

            const bc = document.getElementById('bc-current');
            if (bc) bc.textContent = unitNo === 0 ? '課程總覽' : (unitTitles[unitNo - 1] || '單元');
            refreshStartUnitUiState();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        function refreshStartUnitUiState() {
            const doneCount = window.__startUnitDone.size;
            const total = unitTitles.length;
            const fill = document.getElementById('progress-fill');
            const txt = document.getElementById('progress-text');
            if (fill) fill.style.width = `${Math.round((doneCount / Math.max(total, 1)) * 100)}%`;
            if (txt) txt.textContent = `${doneCount} / ${total} 已完成`;
        }

        window.goToUnit(0);
        ensureMobileResponsiveLayout();
    } catch (e) {
        console.warn('[CourseShared] upgradeLegacyStartUnitToMsLayout failed:', e);
    }
}

function applyStartUnitModernTheme() {
    try {
        const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if (!/^start-\d{2}-unit-.*\.html$/.test(file)) return;
        if (document.getElementById('start-unit-modern-theme')) return;

        const style = document.createElement('style');
        style.id = 'start-unit-modern-theme';
        style.textContent = `
            :root {
                --ms-blue: #0078d4;
                --ms-blue-dark: #005a9e;
                --ms-blue-light: #deecf9;
                --ms-gray-10: #f3f2f1;
                --ms-gray-20: #e1dfdd;
                --ms-gray-90: #201f1e;
                --ms-green: #107c10;
                --ms-red: #d13438;
            }
            * { box-sizing: border-box !important; }
            body {
                font-family: 'Inter','Segoe UI',sans-serif !important;
                background: #fff !important;
                color: #201f1e !important;
                margin: 0 !important;
                font-size: 15px !important;
                line-height: 1.6 !important;
            }
            .ms-topnav {
                background: var(--ms-blue) !important;
                height: 48px !important;
                display: flex !important;
                align-items: center !important;
                padding: 0 20px !important;
                gap: 16px !important;
                position: sticky !important;
                top: 0 !important;
                z-index: 100 !important;
                box-shadow: 0 1px 4px rgba(0,0,0,.2) !important;
            }
            .ms-topnav .brand {
                color: #fff !important;
                font-weight: 600 !important;
                font-size: 15px !important;
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
                text-decoration: none !important;
            }
            .ms-topnav .divider { width: 1px !important; height: 20px !important; background: rgba(255,255,255,.3) !important; }
            .ms-topnav .nav-label { color: rgba(255,255,255,.9) !important; font-size: 14px !important; }
            .ms-topnav .nav-label-link { text-decoration: none !important; }
            .ms-topnav .nav-label-link:hover { text-decoration: underline !important; color: #fff !important; }
            .ms-layout { display: flex !important; min-height: calc(100vh - 48px) !important; }
            .ms-sidebar {
                background: #faf9f8 !important;
                width: 280px !important;
                flex-shrink: 0 !important;
                border-right: 1px solid #e1dfdd !important;
                display: flex !important;
                flex-direction: column !important;
                position: sticky !important;
                top: 48px !important;
                height: calc(100vh - 48px) !important;
                overflow-y: auto !important;
            }
            .ms-sidebar-header {
                padding: 16px 16px 12px !important;
                border-bottom: 1px solid #e1dfdd !important;
            }
            .ms-sidebar-header .module-label {
                font-size: 11px !important;
                text-transform: uppercase !important;
                letter-spacing: .08em !important;
                color: #605e5c !important;
                font-weight: 600 !important;
                margin-bottom: 4px !important;
            }
            .ms-sidebar-header .module-title {
                font-size: 13px !important;
                font-weight: 600 !important;
                color: #201f1e !important;
                line-height: 1.4 !important;
            }
            .ms-sidebar-header .meta { font-size: 12px !important; color: #605e5c !important; margin-top: 6px !important; }
            .ms-unit-list { padding: 8px 0 !important; }
            .ms-unit-item {
                display: flex !important;
                align-items: flex-start !important;
                gap: 10px !important;
                padding: 8px 16px !important;
                cursor: pointer !important;
                border-left: 3px solid transparent !important;
                transition: background .12s, border-color .12s !important;
                color: #201f1e !important;
            }
            .ms-unit-item:hover { background: #edebe9 !important; }
            .unit-icon {
                width: 20px !important;
                height: 20px !important;
                border-radius: 50% !important;
                border: 2px solid #c8c6c4 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex-shrink: 0 !important;
                margin-top: 1px !important;
                font-size: 10px !important;
                background: #fff !important;
            }
            .ms-unit-item.active {
                border-left-color: var(--ms-blue) !important;
                background: #deecf9 !important;
            }
            .ms-unit-item.active .unit-name {
                color: var(--ms-blue) !important;
                font-weight: 600 !important;
            }
            .unit-icon.done {
                background: var(--ms-green) !important;
                border-color: var(--ms-green) !important;
                color: #fff !important;
            }
            .unit-icon.active-icon {
                border-color: var(--ms-blue) !important;
                background: var(--ms-blue) !important;
                color: #fff !important;
            }
            .unit-meta { flex: 1 !important; min-width: 0 !important; }
            .unit-name { font-size: 13px !important; line-height: 1.4 !important; }
            .unit-time { font-size: 11px !important; color: #605e5c !important; margin-top: 2px !important; }
            .sidebar-progress { padding: 12px 16px !important; border-top: 1px solid #e1dfdd !important; margin-top: auto !important; }
            .progress-bar-bg { background: #e1dfdd !important; border-radius: 4px !important; height: 6px !important; }
            .progress-bar-fill { background: var(--ms-green) !important; border-radius: 4px !important; height: 6px !important; transition: width .4s !important; }
            .progress-text { font-size: 12px !important; color: #605e5c !important; margin-top: 6px !important; }
            .ms-content { flex: 1 !important; min-width: 0 !important; }
            .ms-breadcrumb {
                padding: 10px 40px !important;
                font-size: 12px !important;
                border-bottom: 1px solid #e1dfdd !important;
                background: #fff !important;
                color: #605e5c !important;
            }
            .ms-breadcrumb a {
                color: var(--ms-blue) !important;
                text-decoration: none !important;
            }
            .ms-breadcrumb a:hover { text-decoration: underline !important; }
            .ms-breadcrumb span { margin: 0 6px !important; }
            .ms-unit-page { display: none !important; }
            .ms-unit-page.visible { display: block !important; }
            .unit-content {
                max-width: 820px !important;
                margin: 0 auto !important;
                padding: 32px 40px 60px !important;
            }
            .unit-content h1 {
                font-size: 28px !important;
                font-weight: 700 !important;
                margin: 0 0 20px !important;
                line-height: 1.3 !important;
                color: #201f1e !important;
            }
            .unit-content h2 {
                font-size: 20px !important;
                font-weight: 600 !important;
                margin: 36px 0 12px !important;
                color: #201f1e !important;
                padding-top: 8px !important;
            }
            .unit-content h3 {
                font-size: 16px !important;
                font-weight: 600 !important;
                margin: 24px 0 8px !important;
                color: #201f1e !important;
            }
            .unit-content code {
                background: #f3f2f1 !important;
                border: 1px solid #e1dfdd !important;
                border-radius: 3px !important;
                padding: 1px 6px !important;
                font-family: 'Consolas','Courier New',monospace !important;
                font-size: 13px !important;
                color: #a31515 !important;
            }
            .ms-note, .ms-tip, .ms-warning, .ms-important {
                display: flex !important;
                gap: 12px !important;
                padding: 12px 16px !important;
                margin: 20px 0 !important;
                border-left: 4px solid !important;
                font-size: 14px !important;
            }
            .ms-note { background:#deecf9 !important; border-left:4px solid var(--ms-blue) !important; border-radius:4px !important; }
            .ms-tip { background:#dff6dd !important; border-left:4px solid var(--ms-green) !important; border-radius:4px !important; }
            .ms-warning { background:#fff4ce !important; border-left:4px solid #ffaa44 !important; border-radius:4px !important; }
            .ms-important { background:#fde7e9 !important; border-left:4px solid var(--ms-red) !important; border-radius:4px !important; }
            .note-body strong { display: block !important; margin-bottom: 4px !important; font-size: 13px !important; text-transform: uppercase !important; letter-spacing: .04em !important; }
            .ms-scenario {
                background:#f3f2f1 !important;
                border-left:4px solid #c8c6c4 !important;
                border-radius:4px !important;
                padding: 20px 24px !important;
                margin: 20px 0 !important;
                font-style: italic !important;
                color: #323130 !important;
            }
            .ms-table th {
                background:#f3f2f1 !important;
                border:1px solid #e1dfdd !important;
                color:#323130 !important;
            }
            .ms-table td { border:1px solid #e1dfdd !important; }
            .ms-table tr:nth-child(even) td { background:#faf9f8 !important; }
            .ms-code {
                background:#1e1e1e !important;
                border-radius:6px !important;
                color:#d4d4d4 !important;
            }
            .unit-nav {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                padding: 24px 40px !important;
                border-top: 1px solid #e1dfdd !important;
                max-width: 820px !important;
                margin: 0 auto !important;
            }
            .ms-btn, .nav-btn-next {
                background: var(--ms-blue) !important;
                border-color: var(--ms-blue) !important;
                color:#fff !important;
                border-radius: 2px !important;
            }
            .ms-btn:hover, .nav-btn-next:hover {
                background: var(--ms-blue-dark) !important;
                border-color: var(--ms-blue-dark) !important;
            }
            .ms-btn-ghost, .nav-btn-prev {
                background: #fff !important;
                color: var(--ms-blue) !important;
                border: 1px solid var(--ms-blue) !important;
                border-radius: 2px !important;
            }
            .ms-btn-ghost:hover, .nav-btn-prev:hover {
                background: var(--ms-blue-light) !important;
            }
            @media (max-width: 768px) {
                .ms-sidebar { display: none !important; }
                .unit-content {
                    padding: 20px 16px 40px !important;
                }
                .unit-nav { padding: 16px !important; }
                .ms-breadcrumb { padding: 8px 16px !important; }
            }
        `;
        document.head.appendChild(style);
    } catch (e) {
        console.warn('[CourseShared] applyStartUnitModernTheme failed:', e);
    }
}

function applyHideTabsPreference() {
    try {
        const params = new URLSearchParams(window.location.search);
        const hideTabs = (params.get('hideTabs') || '').toLowerCase();
        if (!(hideTabs === '1' || hideTabs === 'true')) return;

        const tabs = document.getElementById('course-tabs-container');
        if (!tabs) return;

        tabs.style.setProperty('display', 'none', 'important');
        const tabWrapper = tabs.closest('.relative.z-40') || tabs.parentElement?.parentElement;
        if (tabWrapper) {
            tabWrapper.style.setProperty('display', 'none', 'important');
        }
    } catch (e) {
        console.warn('[CourseShared] applyHideTabsPreference failed:', e);
    }
}


async function toggleUnitTabsVisibility() {
    try {
        const tabs = document.getElementById('course-tabs-container');
        if (!tabs) return;

        const tabWrapper = tabs.closest('.relative.z-40') || tabs.parentElement?.parentElement;
        const fileName = (window.location.pathname.split('/').pop() || '').toLowerCase();
        const normalizeLooseKey = (value = "") => String(value || "").split('/').pop().split('?')[0].replace('.html', '').toLowerCase();
        const targetKey = normalizeLooseKey(normalizeUnitFilenameForRoute(fileName));

        if (!globalLessonsData || !Array.isArray(globalLessonsData) || globalLessonsData.length === 0) {
            globalLessonsData = await vibeFetchLessons();
        }

        let shouldHide = false;
        if (Array.isArray(globalLessonsData) && globalLessonsData.length > 0) {
            const matchedCourse = globalLessonsData.find((course) => {
                const units = Array.isArray(course?.courseUnits) ? course.courseUnits : [];
                const unitKeys = units
                    .map(normalizeUnitFilenameForRoute)
                    .map(normalizeLooseKey);
                return unitKeys.includes(targetKey);
            });

            if (matchedCourse) {
                const unitCount = (Array.isArray(matchedCourse.courseUnits) ? matchedCourse.courseUnits : []).length;
                shouldHide = unitCount <= 1;
            } else {
                // No Firestore mapping found: keep tabs visible to avoid accidental hide.
                shouldHide = false;
            }
        }

        if (shouldHide) {
            tabs.style.setProperty('display', 'none', 'important');
            if (tabWrapper) tabWrapper.style.setProperty('display', 'none', 'important');
        } else {
            tabs.style.removeProperty('display');
            if (tabWrapper) tabWrapper.style.removeProperty('display');
        }
    } catch (e) {
        console.warn('[CourseShared] toggleUnitTabsVisibility failed:', e);
    }
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
    enhanceAssignmentEntryButtons();
    toggleUnitTabsVisibility();
    normalizeTerminology();
    interceptGoToUnit();
});

// Global State (Using var for redeclaration safety in Master/Unit contexts)
var currentMode = typeof currentMode !== 'undefined' ? currentMode : null;
var sessionStartTime = typeof sessionStartTime !== 'undefined' ? sessionStartTime : null;
var currentScale = typeof currentScale !== 'undefined' ? currentScale : 1.0;
var BASE_DOC_WIDTH = typeof BASE_DOC_WIDTH !== 'undefined' ? BASE_DOC_WIDTH : 850;
var boundDocs = typeof boundDocs !== 'undefined' ? boundDocs : new Set(); // To prevent duplicate event listeners
var globalLessonsData = typeof globalLessonsData !== 'undefined' ? globalLessonsData : null; // [NEW] Cache for Firestore-based lessons
var globalCourseConfigs = typeof globalCourseConfigs !== 'undefined' ? globalCourseConfigs : null; // [NEW] Cache for Firestore configs

/**
 * Global utility for resizing iframes (used in Master course pages)
 * Moved to course-shared.js for synchronous availability.
 */
window.resizeIframe = function (obj) {
    if (obj && obj.contentWindow) {
        try {
            const height = obj.contentWindow.document.documentElement.scrollHeight;
            obj.style.height = height + 'px';
        } catch (e) {
            console.warn("[CourseShared] Cannot resize cross-origin iframe or missing contentWindow:", e);
        }
    }
};

/**
 * [NEW] Helper to wait for Firebase SDK injection
 */
async function waitForVibeFirebase(timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (typeof window.getFunctions !== 'undefined' && typeof window.httpsCallable !== 'undefined') {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
}

/**
 * [NEW] Centralized Lesson Fetching (Firestore via Cloud Function)
 * Replaces fetch('./lessons.json')
 */
async function vibeFetchLessons() {
    if (window.globalLessonsData && window.globalLessonsData.length > 0) {
        return window.globalLessonsData;
    }

    // Wait for SDK if it's currently being injected
    const isReady = await waitForVibeFirebase();
    if (!isReady) {
        console.warn("[CourseShared] Firebase SDK timed out. Firestore data unavailable.");
        return [];
    }

    try {
        const functions = window.getFunctions(window.vibeApp, 'asia-east1');
        const getLessonsFunc = window.httpsCallable(functions, 'getLessonsMetadata');
        
        console.log("[CourseShared] Fetching lessons metadata from Firestore...");
        const result = await getLessonsFunc();
        
        if (result.data && result.data.lessons) {
            window.globalLessonsData = result.data.lessons;
            return window.globalLessonsData;
        }
        return [];
    } catch (err) {
        console.error("[CourseShared] vibeFetchLessons failed:", err);
        return [];
    }
}
window.vibeFetchLessons = vibeFetchLessons;

function injectDashboardModal() {
    if (document.getElementById('dashboard-modal-overlay')) return;
    const modalHTML = `
    <div id="dashboard-modal-overlay" class="fixed inset-0 bg-black/70 hidden flex-col overflow-hidden" style="z-index: 1000002 !important;">
        <div class="flex items-center justify-between px-4 md:px-6 py-3 bg-white/95 border-b border-slate-200">
            <div class="text-sm md:text-base font-bold text-slate-700">課程儀表板 (Dashboard)</div>
            <button id="dashboard-modal-close-btn" class="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs md:text-sm font-bold hover:bg-slate-700">
                關閉 (Esc)
            </button>
        </div>
        <iframe id="dashboard-modal-frame" class="w-full flex-1 bg-white border-0" title="Dashboard"></iframe>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const closeBtn = document.getElementById('dashboard-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => window.closeDashboardModal && window.closeDashboardModal());
}

window.openDashboardModal = function(extraQuery = '') {
    try {
        const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if (!file.endsWith('.html')) return;

        const overlay = document.getElementById('dashboard-modal-overlay');
        const frame = document.getElementById('dashboard-modal-frame');
        if (!overlay || !frame) return;

        const params = new URLSearchParams();
        params.set('unitId', file);
        params.set('tab', 'assignments');
        params.set('mode', 'iframe');
        params.set('hideTabs', '1');

        const extraRaw = String(extraQuery || '').trim();
        if (extraRaw) {
            const extraQs = new URLSearchParams(extraRaw.startsWith('?') ? extraRaw.slice(1) : extraRaw);
            extraQs.forEach((v, k) => {
                if (k && v !== '') params.set(k, v);
            });
        }

        frame.src = `/dashboard.html?${params.toString()}`;
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        document.body.style.overflow = 'hidden';
    } catch (e) {
        console.warn('[CourseShared] openDashboardModal failed:', e);
    }
};

window.closeDashboardModal = function() {
    const overlay = document.getElementById('dashboard-modal-overlay');
    const frame = document.getElementById('dashboard-modal-frame');
    if (!overlay || overlay.classList.contains('hidden')) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    if (frame) frame.src = 'about:blank';
    document.body.style.overflow = '';
};

/**
 * Injects the standard Media Overlay HTML into the body
 */
function injectMediaOverlay() {
    if (document.getElementById('media-overlay')) return; // Already exists

    const overlayHTML = `
    <div id="media-overlay" class="fixed inset-0 bg-black hidden flex flex-col overflow-hidden" style="z-index: 1000000 !important;">
        <!-- Doc Container (Responsive Padding) -->
        <div id="doc-wrapper" class="hidden flex-grow w-full relative overflow-auto bg-gray-100 flex justify-center p-0">
            <iframe id="doc-frame" class="border-0 bg-white shadow-2xl origin-top"
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
            class="close-video-btn fixed top-3 right-3 md:top-6 md:right-6 text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 md:px-5 md:py-2.5 rounded-full shadow-xl transition cursor-pointer pointer-events-auto flex items-center gap-2 text-xs md:text-sm font-bold">
            <span>✕</span> 關閉 (Close)
        </button>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', overlayHTML);
}

// Explicitly export to window to avoid scope issues
window.enterMediaMode = enterMediaMode;
window.closeModal = closeModal;

// [COMPATIBILITY] Restore window.courseShared for older/advanced unit files
window.courseShared = {
    enterMediaMode,
    closeModal,
    autoFitZoom
};

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

            // [FIXED v11.3.12] Robust Google Doc Native Reflow & Optimization
            let finalSrc = targetSrc;
            if (targetSrc.includes('docs.google.com/document/d/')) {
                const isPublished = targetSrc.includes('/pub');
                const isStandard = !isPublished;

                if (isStandard) {
                    console.log("[Media] Standard Doc detected, forcing /mobilebasic for native reflow...");
                    // Transform /edit, /view, etc. to /mobilebasic
                    finalSrc = finalSrc.replace(/\/document\/d\/([^/]+)\/.*$/, '/document/d/$1/mobilebasic');
                    if (!finalSrc.includes('/mobilebasic')) {
                        finalSrc = finalSrc.replace(/\/document\/d\/([^/]+)$/, '/document/d/$1/mobilebasic');
                    }
                } else {
                    console.log("[Media] Published Doc detected, keeping /pub with UI optimization...");
                    // Just append rm=mobile for a cleaner (but not reflowed) view
                    if (!finalSrc.includes('rm=mobile')) {
                        finalSrc += (finalSrc.includes('?') ? '&' : '?') + "rm=mobile";
                    }
                }
            }

            if (finalSrc) docFrame.src = finalSrc;
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
            if (nav) nav.style.setProperty('display', 'none', 'important');

            // Aggressive FAB Hiding via CSS Injection [NEW]
            let styleHide = doc.getElementById('vibe-media-hide-fab');
            if (!styleHide) {
                styleHide = doc.createElement('style');
                styleHide.id = 'vibe-media-hide-fab';
                styleHide.textContent = '#dashboard-fab, .dashboard-fab { display: none !important; opacity: 0 !important; pointer-events: none !important; }';
                doc.head.appendChild(styleHide);
            }

            // Also hide the tab bar if it exists (Master Page pattern)
            const tabs = doc.getElementById('course-tabs-container');
            if (tabs) {
                const tabWrapper = tabs.closest('.relative.z-40') || tabs.parentElement.parentElement;
                if (tabWrapper) tabWrapper.style.display = 'none';
            }
        });

        // [FIX] Always re-bind events when entering media mode
        bindOverlayEvents();

        requestFullscreenSafe();
        sessionStartTime = new Date();

        // [FIX] Give focus to the close button so Esc works immediately
        const closeBtn = document.querySelector('.close-video-btn');
        if (closeBtn) {
            setTimeout(() => closeBtn.focus(), 100);
        }
    } catch (err) {
        console.error("[Media] Error in enterMediaMode:", err);
    }
}

// Flag to prevent recursive closing
var isClosingModal = typeof isClosingModal !== 'undefined' ? isClosingModal : false;

/**
 * Closes the Media Overlay
 */
function closeModal() {
    if (isClosingModal) return;
    const overlay = document.getElementById('media-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;

    isClosingModal = true;
    console.log("[Media] Closing modal...");
    overlay.classList.add('hidden');
    document.body.style.overflow = '';

    // Restore Navbar and Tabs
    const docs = [document];
    try { if (window.parent && window.parent.document) docs.push(window.parent.document); } catch (e) { }

    docs.forEach(doc => {
        const nav = doc.getElementById('main-nav');
        if (nav) nav.style.display = '';

        // Restore FAB Visibility [NEW]
        const styleHide = doc.getElementById('vibe-media-hide-fab');
        if (styleHide) styleHide.remove();

        const tabs = doc.getElementById('course-tabs-container');
        if (tabs) {
            const tabWrapper = tabs.closest('.relative.z-40') || tabs.parentElement.parentElement;
            if (tabWrapper) tabWrapper.style.display = '';
        }
    });

    // Stop Playback
    document.getElementById('video-frame').src = "";
    document.getElementById('doc-frame').src = "";

    if (sessionStartTime) {
        const endTime = new Date();
        const duration = (endTime - sessionStartTime) / 1000;
        console.log(`[Tracking] Session duration: ${duration}s`);

        // Dispatch event for Firebase
        const modeUpper = currentMode ? currentMode.toUpperCase() : 'UNKNOWN';
        const frameSrc = document.getElementById(currentMode + '-frame') ? document.getElementById(currentMode + '-frame').src : "";

        window.dispatchEvent(new CustomEvent('vibe-log-activity', {
            detail: {
                action: modeUpper,
                duration: Math.round(duration),
                metadata: { src: frameSrc }
            }
        }));

        sessionStartTime = null;
    }

    currentMode = null;
    exitFullscreenSafe();

    // Explicitly unbind from top window on close as a safety measure
    cleanupOverlayEvents();

    // Reset flag after transitions
    setTimeout(() => { isClosingModal = false; }, 300);
}

// --- Zoom Logic ---

// --- Event Listeners ---

var handleEscKey = function(e) {
    if (e.key === "Escape") {
        const dashboardOverlay = document.getElementById('dashboard-modal-overlay');
        if (dashboardOverlay && !dashboardOverlay.classList.contains('hidden')) {
            window.closeDashboardModal && window.closeDashboardModal();
            return;
        }
        const overlay = document.getElementById('media-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            console.log("[Media] Esc pressed, closing modal");
            closeModal();
        }
    }
};

/**
 * [FIXED] Robust event binding to handle iframe transitions and cross-origin safety
 */
function bindOverlayEvents() {
    // 1. Local Window & Document
    window.removeEventListener('keydown', handleEscKey, true);
    window.addEventListener('keydown', handleEscKey, true);
    document.removeEventListener('keydown', handleEscKey, true);
    document.addEventListener('keydown', handleEscKey, true);

    // 2. Top Window (Persists across tab switches in Master Page context)
    // We store the handler reference on win itself to properly remove it later
    const bindTo = (win) => {
        try {
            if (!win) return;
            // Remove previous version regardless of which unit page added it
            if (win._vibeEscHandler) {
                win.removeEventListener('keydown', win._vibeEscHandler, true);
            }
            // Bind new one
            win._vibeEscHandler = handleEscKey;
            win.addEventListener('keydown', win._vibeEscHandler, true);
        } catch (e) { /* Cross-origin blocked */ }
    };

    if (window.top && window.top !== window) {
        bindTo(window.top);
    }

    // 3. Fullscreen Events
    const docs = [document];
    try { if (window.top && window.top.document) docs.push(window.top.document); } catch (e) { }

    docs.forEach(doc => {
        try {
            doc.removeEventListener('fullscreenchange', onFullscreenChange);
            doc.removeEventListener('webkitfullscreenchange', onFullscreenChange);
            doc.addEventListener('fullscreenchange', onFullscreenChange);
            doc.addEventListener('webkitfullscreenchange', onFullscreenChange);
        } catch (e) { }
    });
}

function cleanupOverlayEvents() {
    window.removeEventListener('keydown', handleEscKey, true);
    document.removeEventListener('keydown', handleEscKey, true);

    if (window.top && window.top._vibeEscHandler) {
        try {
            window.top.removeEventListener('keydown', window.top._vibeEscHandler, true);
            window.top._vibeEscHandler = null;
        } catch (e) { }
    }

    const docs = [document];
    try { if (window.top && window.top.document) docs.push(window.top.document); } catch (e) { }

    docs.forEach(doc => {
        try {
            doc.removeEventListener('fullscreenchange', onFullscreenChange);
            doc.removeEventListener('webkitfullscreenchange', onFullscreenChange);
        } catch (e) { }
    });
}

// Ensure cleanup on tab switch/close
window.addEventListener('pagehide', cleanupOverlayEvents);
window.addEventListener('unload', cleanupOverlayEvents);

bindOverlayEvents();

function onFullscreenChange() {
    // Multi-phase check to handle browser state lag
    const check = () => {
        const getFsElement = () => {
            try {
                return document.fullscreenElement || document.webkitFullscreenElement ||
                    (window.top && window.top.document && (window.top.document.fullscreenElement || window.top.document.webkitFullscreenElement));
            } catch (e) { return document.fullscreenElement || document.webkitFullscreenElement; }
        };

        const isFs = !!getFsElement();
        if (!isFs && !isClosingModal) {
            const overlay = document.getElementById('media-overlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                console.log("[Media] Verified exit, closing modal");
                closeModal();
            }
        }
    };

    // Trigger checks at multiple intervals
    check();
    setTimeout(check, 100);
    setTimeout(check, 300);
}

// Update autoFitZoom to be more aggressive with width
function autoFitZoom() {
    if (currentMode !== 'doc') return;
    const wrapper = document.getElementById('doc-wrapper');
    const iframe = document.getElementById('doc-frame');
    if (!wrapper || !iframe) return;

    const availableWidth = wrapper.clientWidth;
    const isMobile = window.innerWidth < 768;

    // [FIXED v11.3.12] Only disable manual scaling IF using /mobilebasic
    // Standard docs with /mobilebasic support native reflow, making manual scaling counter-productive.
    // Published docs (/pub) do NOT reflow and MUST still use manual scaling.
    // Native Reflow Doc Logic
    if (iframe.src.includes('docs.google.com') && iframe.src.includes('mobilebasic')) {
        if (isMobile) {
            console.log("[Media] Native Reflow Doc detected (Mobile), disabling manual scaling.");
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.transform = 'none';
            iframe.style.marginBottom = '0';
            return;
        } else {
            console.log("[Media] Native Reflow Doc detected (Desktop), applying expansion zoom...");
            // Force it to proceed to the scaling logic below with a customized base width
        }
    }

    // Standard Scaling Logic (for Desktop or non-Google-Doc mobile)
    // Use full width for both desktop and mobile
    iframe.style.width = '100%';
    iframe.style.maxWidth = 'none';

    // Standard Google Doc content width is ~820px
    const baseWidth = 820;
    let scale = availableWidth / baseWidth;

    if (isMobile) {
        // [FIXED v11.3.11] More aggressive scaling for small screens
        // Target a standard mobile viewport width (e.g. 430px) to ensure no gaps
        const mobileBase = 430;
        scale = availableWidth / mobileBase;

        // Safety cap for mobile zoom
        if (scale < 0.8) scale = 0.8;
    } else {
        // Desktop: Allow full expansion ("Page Width")
        // For mobilebasic on desktop, use a smaller base width to force larger zoom
        const activeBaseWidth = (iframe.src.includes('mobilebasic')) ? 680 : 820;
        scale = availableWidth / activeBaseWidth;

        if (scale < 0.5) scale = 0.5;
        // No upper limit to ensure it fills the screen width
    }

    applyZoom(scale);
}

function applyZoom(scale) {
    currentScale = scale;
    const iframe = document.getElementById('doc-frame');
    if (!iframe) return;

    iframe.style.transform = `scale(${scale})`;

    // Width compensation
    // We set the real width to 100/scale, so when scaled by 'scale', it looks like 100% width
    iframe.style.width = `${100 / scale}%`;
    iframe.style.height = `${100 / scale}%`;

    // Vertical spacing compensation (origin-top creates whitespace at bottom)
    iframe.style.marginBottom = `${-(1 - scale) * 100 / scale}%`;

    // Horizontal centering is handled by flex 'justify-center' on the wrapper
    // and 'origin-top' (which defaults to center horizontal) on the iframe.
    iframe.style.marginLeft = '0';
    iframe.style.marginRight = '0';
}


// --- Helper Functions ---

function requestFullscreenSafe() {
    let target = document.documentElement;
    try {
        if (window.top && window.top.document) {
            target = window.top.document.documentElement;
        }
    } catch (e) { }

    if (target.requestFullscreen) {
        target.requestFullscreen().catch(err => console.log(err));
    } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
    }
}

function exitFullscreenSafe() {
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement ||
        (window.top && window.top.document && (window.top.document.fullscreenElement || window.top.document.webkitFullscreenElement));

    if (fsElement) {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => { });
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }

        // Also try top window if possible
        try {
            if (window.top && window.top.document && window.top.document.exitFullscreen) {
                window.top.document.exitFullscreen().catch(() => { });
            }
        } catch (e) { }
    }
}

window.addEventListener('resize', () => {
    if (currentMode === 'doc' && !document.getElementById('media-overlay').classList.contains('hidden')) {
        autoFitZoom();
    }
});

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

async function initFirebaseFeatures() {
    console.log("[Firebase] Injecting Firebase SDK...");
    const ENABLE_UNIFIED_SUPPORT_HUB = false;

    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
    const { firebaseConfig, connectFirebaseEmulators } = await import("./firebase-local.js");

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const functions = getFunctions(app, 'asia-east1');
        connectFirebaseEmulators({ auth, db, functions });
        
        // [MOD] Expose globally for other parts of course-shared.js
        window.vibeApp = app;
        window.getFunctions = getFunctions;
        window.httpsCallable = httpsCallable;

        const logActivityFn = httpsCallable(functions, 'logActivity');
        const submitAssignmentFn = httpsCallable(functions, 'submitAssignment');

        // --- Tracking Logic ---
        
        // Helper to log
        const log = async (action, duration = 0, metadata = {}) => {
            // [MODIFIED] User verification
            const user = auth.currentUser;
            if (!user) {
                // console.log("[Tracking] Skipped: No user logged in.");
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

        // --- Assignment Logic ---

        window.firebaseSubmitAssignment = async (data) => {
             const user = auth.currentUser;
             if (!user) {
                 alert("請先登入 (Please Login First)");
                 return { success: false, error: "Not Logged In" };
             }
             
             try {
                 const result = await httpsCallable(functions, 'submitAssignment')(data);
                 return result.data;
             } catch (error) {
                 console.error("Submission Error:", error);
                 alert("提交失敗: " + error.message);
                 throw error;
             }
        };

        // [NEW] Helper to get dynamic tutor configs
        window.firebaseGetTutorConfigs = async (courseId) => {
            try {
                const getTutorConfigs = httpsCallable(functions, 'getTutorConfigs');
                const result = await getTutorConfigs({ courseId });
                return result.data;
            } catch (e) {
                console.error("Failed to fetch tutor configs:", e);
                return null;
            }
        };
        // Backward-compatible browser alias for older page code.
        window.firebaseGetCourseConfigs = window.firebaseGetTutorConfigs;

        window.firebaseResolveAssignmentAccess = async (payload) => {
            try {
                // [V13.0.21] Automatically inject tutorMode from browser session
                const isTutorMode = localStorage.getItem('adminTutorMode') === 'true';
                const resolveAssignmentAccess = httpsCallable(functions, 'resolveAssignmentAccess');
                const result = await resolveAssignmentAccess({
                    ...payload,
                    tutorMode: isTutorMode
                });
                return result.data;
            } catch (e) {
                console.error("Failed to resolve assignment access:", e);
                throw e;
            }
        };

        window.firebasePrecheckGithubClassroomAccess = async (classroomUrl) => {
            try {
                const precheck = httpsCallable(functions, 'precheckGithubClassroomAccess');
                const result = await precheck({ classroomUrl });
                return result.data || null;
            } catch (e) {
                console.error("Failed to precheck GitHub Classroom access:", e);
                return null;
            }
        };

        // --- Student Interaction Hub MVP ---

        function escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        const findCourseIdByUnit = async (fileName) => {
            let globalLessonsData = window.globalLessonsData;
            if (!globalLessonsData || globalLessonsData.length === 0) {
                try {
                    const getLessonsFunc = httpsCallable(functions, 'getLessonsMetadata');
                    const result = await getLessonsFunc();
                    if (result.data && result.data.lessons) {
                        globalLessonsData = result.data.lessons;
                        window.globalLessonsData = globalLessonsData;
                    }
                } catch (e) {
                    console.error("Failed to load global lessons data:", e);
                }
            }
            if (globalLessonsData) {
                for (const course of globalLessonsData) {
                    if (course.githubClassroomUrls && course.githubClassroomUrls[fileName]) {
                        return course.courseId;
                    }
                }
            }
            // Fallback prefix check
            if (fileName.startsWith('adv-') || fileName.startsWith('tw-car-advanced-')) return 'advanced';
            if (fileName.startsWith('basic-') || fileName.startsWith('tw-car-basic-')) return 'basic';
            if (fileName.startsWith('start-') || fileName.startsWith('tw-car-starter-')) return 'started';
            if (fileName.match(/^[0-9]/) || fileName.startsWith('prepare-') || fileName.startsWith('tw-common-')) return 'prepare';
            return 'basic';
        };

        window.submitStudentBlockerAction = async function() {
            const btn = document.getElementById('btn-submit-blocker');
            const type = document.getElementById('blocker-type').value;
            const shared = document.getElementById('hub-shared-note');
            const legacy = document.getElementById('blocker-note');
            const note = (shared?.value || legacy?.value || '').trim();
            if (!note) {
                alert("請先填寫卡點/嘗試說明，再提交卡點。");
                return;
            }
            btn.disabled = true;
            btn.innerText = "提交中...";

            const pathParts = window.location.pathname.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const unitId = fileName.replace('.html', '');

            try {
                const submitBlocker = httpsCallable(functions, 'submitStudentBlocker');
                await submitBlocker({
                    assignmentId: unitId,
                    blockerType: type,
                    blockerNote: note
                });
                alert("👍 卡點已回報，導師將會收到通知！");
                location.reload();
            } catch (e) {
                console.error(e);
                alert("提交失敗：" + e.message);
                btn.disabled = false;
                btn.innerText = "🚀 提交卡點";
            }
        };

        window.resolveStudentBlockerAction = async function() {
            if (!confirm("確定卡點已解決嗎？這會將狀態切回「進行中」。")) return;
            const btn = document.getElementById('btn-resolve-blocker');
            btn.disabled = true;
            btn.innerText = "處理中...";

            const pathParts = window.location.pathname.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const unitId = fileName.replace('.html', '');

            try {
                const resolveBlocker = httpsCallable(functions, 'resolveStudentBlocker');
                await resolveBlocker({
                    assignmentId: unitId
                });
                alert("✅ 卡點已解決，祝您寫作業順利！");
                location.reload();
            } catch (e) {
                console.error(e);
                alert("操作失敗：" + e.message);
                btn.disabled = false;
                btn.innerText = "✅ 卡點已自行解決";
            }
        };

        window.submitAttemptSummaryAction = async function() {
            const btn = document.getElementById('btn-submit-attempt');
            const shared = document.getElementById('hub-shared-note');
            const legacy = document.getElementById('attempt-summary');
            const summary = (shared?.value || legacy?.value || '').trim();
            if (!summary) {
                alert("請先填寫卡點/嘗試說明，再提交紀錄。");
                return;
            }
            btn.disabled = true;
            btn.innerText = "提交中...";

            const pathParts = window.location.pathname.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const unitId = fileName.replace('.html', '');

            try {
                const submitAttempt = httpsCallable(functions, 'submitAttemptSummary');
                await submitAttempt({
                    assignmentId: unitId,
                    attemptSummary: summary
                });
                alert("📝 嘗試紀錄提交成功！");
                location.reload();
            } catch (e) {
                console.error(e);
                alert("提交失敗：" + e.message);
                btn.disabled = false;
                btn.innerText = "提交嘗試紀錄";
            }
        };

        window.toggleBlockerForm = function() {
            const form = document.getElementById('blocker-form-wrap');
            if (form) {
                form.classList.toggle('hidden');
            }
        };

        async function renderStudentInteractionHub(user) {
            if (!ENABLE_UNIFIED_SUPPORT_HUB) {
                const trigger = document.getElementById('unified-support-trigger');
                if (trigger) trigger.remove();
                const modal = document.getElementById('unified-support-panel');
                if (modal) modal.remove();
                const hideFabStyle = document.getElementById('hide-dashboard-fab-style');
                if (hideFabStyle) hideFabStyle.remove();
                return;
            }
            const pathParts = window.location.pathname.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const unitId = fileName.replace('.html', '');
            
            // Only render on unit HTML pages (skip generic index pages)
            if (fileName === 'basic.html' || fileName === 'advanced.html' || fileName === 'prepare.html' || fileName === 'start.html' || fileName === 'index.html' || fileName === 'payment-return.html') {
                return;
            }

            const courseId = await findCourseIdByUnit(fileName);

            // Fetch assignment status
            let accessResult = null;
            try {
                const resolveAccess = httpsCallable(functions, 'resolveAssignmentAccess');
                const result = await resolveAccess({ courseId, unitId: fileName, assignmentId: unitId });
                accessResult = result.data;
            } catch (e) {
                console.error("[StudentHub] Failed to fetch assignment details:", e);
                return;
            }

            if (!accessResult || !accessResult.authorized) return;

            const details = accessResult.assignmentDetails || {
                learningState: 'in_progress',
                latestBlocker: null,
                hintLevelUsed: null,
                nextAction: null,
                attemptSummary: null,
                grade: null,
                tutorFeedback: null
            };

            const learningState = details.learningState;

            // Define openDashboardModalFromHub helper
            window.openDashboardModalFromHub = function() {
                if (typeof window.openDashboardModal === 'function') {
                    const param = courseId ? `?courseId=${courseId}` : '';
                    window.openDashboardModal(param);
                    if (typeof window.toggleUnifiedSupportPanel === 'function') {
                        window.toggleUnifiedSupportPanel();
                    }
                } else {
                    alert("載入儀表板中，請稍後重試。");
                }
            };
            
            // Check where to render (Floating Button + Slide-up Panel)
            let hubTrigger = document.getElementById('unified-support-trigger');
            if (!hubTrigger) {
                hubTrigger = document.createElement('div');
                hubTrigger.id = 'unified-support-trigger';
                hubTrigger.className = 'fixed bottom-6 right-6 z-50';
                document.body.appendChild(hubTrigger);
            }

            let hubModal = document.getElementById('unified-support-panel');
            if (!hubModal) {
                hubModal = document.createElement('div');
                hubModal.id = 'unified-support-panel';
                hubModal.className = 'fixed bottom-20 sm:bottom-24 right-4 sm:right-6 left-4 sm:left-auto w-auto sm:w-[420px] max-h-[65vh] sm:max-h-[75vh] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-y-auto z-50 transition-all duration-300 transform scale-95 opacity-0 origin-bottom-right hidden';
                hubModal.innerHTML = `
                    <!-- Close Button -->
                    <button onclick="toggleUnifiedSupportPanel()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-lg font-bold p-1.5 hover:bg-slate-100 rounded-full transition w-8 h-8 flex items-center justify-center">✕</button>
                    
                    <div id="unified-support-body" class="p-6"></div>
                `;
                document.body.appendChild(hubModal);
            }

            // Define toggle function
            if (!window.toggleUnifiedSupportPanel) {
                window.toggleUnifiedSupportPanel = function() {
                    const panel = document.getElementById('unified-support-panel');
                    if (!panel) return;
                    
                    if (panel.classList.contains('hidden')) {
                        panel.classList.remove('hidden');
                        setTimeout(() => {
                            panel.classList.remove('scale-95', 'opacity-0');
                            panel.classList.add('scale-100', 'opacity-100');
                        }, 20);
                    } else {
                        panel.classList.remove('scale-100', 'opacity-100');
                        panel.classList.add('scale-95', 'opacity-0');
                        setTimeout(() => {
                            panel.classList.add('hidden');
                        }, 200);
                    }
                };
            }

            // Render floating trigger button based on status
            let btnBg = 'from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700';
            let icon = '🤝';
            let pulseClass = '';
            let badgeHtml = '';
            
            if (learningState === 'blocked') {
                btnBg = 'from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700';
                icon = '🚨';
                pulseClass = 'animate-pulse';
            } else if (learningState === 'coaching') {
                btnBg = 'from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600';
                icon = '🧑‍🏫';
                pulseClass = 'animate-bounce';
                badgeHtml = '<span class="absolute -top-1 -right-1 flex h-4 w-4"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] text-white items-center justify-center font-bold">!</span></span>';
            } else if (learningState === 'resolved') {
                btnBg = 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700';
                icon = '🎉';
            }
            
            hubTrigger.innerHTML = `
                <button onclick="toggleUnifiedSupportPanel()" class="relative flex items-center gap-2.5 px-6 py-4 bg-gradient-to-r ${btnBg} text-white font-bold rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 active:scale-95 ${pulseClass}">
                    <span class="text-xl">${icon}</span>
                    <span class="text-sm tracking-wide font-bold whitespace-nowrap">師生互動與卡點支援</span>
                    <span class="text-lg">📊</span>
                    ${badgeHtml}
                </button>
            `;

            const hubContainer = document.getElementById('unified-support-body');

            // Render current progress bar
            let steps = [
                { id: 'in_progress', label: '進行中', color: 'blue' },
                { id: 'blocked', label: '遭遇卡點', color: 'red' },
                { id: 'coaching', label: '導師引導中', color: 'amber' },
                { id: 'resolved', label: '已解決 / 評分', color: 'green' }
            ];

            let activeIndex = steps.findIndex(s => s.id === learningState);
            if (activeIndex === -1) activeIndex = 0;

            const progressHtml = steps.map((s, idx) => {
                const isActive = idx === activeIndex;
                const isPassed = idx < activeIndex;
                
                let circleColor = 'border-slate-300 text-slate-400 bg-white';
                if (isActive) {
                    if (s.id === 'blocked') circleColor = 'border-red-500 text-red-600 bg-red-50 ring-4 ring-red-100 animate-pulse';
                    else if (s.id === 'coaching') circleColor = 'border-amber-500 text-amber-600 bg-amber-50 ring-4 ring-amber-100 animate-pulse';
                    else if (s.id === 'resolved') circleColor = 'border-green-500 text-green-600 bg-green-50 ring-4 ring-green-100';
                    else circleColor = 'border-blue-500 text-blue-600 bg-blue-50 ring-4 ring-blue-100';
                } else if (isPassed) {
                    circleColor = 'border-slate-500 bg-slate-600 text-white';
                }

                return `
                    <div class="flex flex-col items-center flex-1 relative">
                        <div class="w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm z-10 transition-all ${circleColor}">
                            ${isPassed ? '✓' : (idx + 1)}
                        </div>
                        <span class="text-xs font-semibold mt-2 ${isActive ? 'text-slate-800 font-bold scale-105' : 'text-slate-505'}">${s.label}</span>
                    </div>
                `;
            }).join(`
                <div class="flex-1 h-0.5 bg-slate-200 mt-5"></div>
            `);

            // Blocker Form / Status UI
            let blockerSectionHtml = '';
            if (learningState === 'blocked') {
                const blocker = details.latestBlocker || {};
                const blockerTypeMap = { concept: '觀念卡點', debug: '程式 Bug 卡點', environment: '環境卡點' };
                blockerSectionHtml = `
                    <div class="bg-red-50 border border-red-200 rounded-2xl p-6 mt-8">
                        <div class="flex items-center gap-3 mb-3 text-red-700 font-bold">
                            <span class="text-2xl">🚨</span>
                            <span>已標記為卡點狀態，老師正在關注中</span>
                        </div>
                        <div class="text-sm text-slate-700 mb-4 bg-white p-4 rounded-xl border border-red-100">
                            <strong>卡點類型：</strong> ${blockerTypeMap[blocker.type] || '一般卡點'}<br>
                            <strong>卡點描述：</strong> ${escapeHtml(blocker.note || '無詳細描述')}
                        </div>
                        <button id="btn-resolve-blocker" onclick="resolveStudentBlockerAction()"
                            class="py-2.5 px-6 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2">
                            <span>✅</span> 卡點已自行解決（回到進行中）
                        </button>
                    </div>
                `;
            } else if (learningState === 'coaching') {
                // Showing Tutor Coaching notes
                const hintLabels = ['無提示', 'L1 方向提示', 'L2 半步驟引導', 'L3 完整拆解'];
                const hintBadgeColors = [
                    'bg-slate-100 text-slate-600',
                    'bg-blue-100 text-blue-800 border border-blue-200',
                    'bg-amber-100 text-amber-800 border border-amber-200',
                    'bg-red-100 text-red-800 border border-red-200'
                ];
                const hintLevel = details.hintLevelUsed !== null ? details.hintLevelUsed : 1;
                const nextAction = details.nextAction || '請遵循導師的指導步驟繼續嘗試';
                const advice = details.tutorFeedback || '導師尚未留下詳細指導內容';

                blockerSectionHtml = `
                    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6 mt-8">
                        <div class="flex items-center justify-between mb-4 border-b border-amber-200 pb-3">
                            <div class="flex items-center gap-3 text-amber-800 font-bold">
                                <span class="text-2xl">🧑‍🏫</span>
                                <span>導師指導回饋</span>
                            </div>
                            <span class="px-3 py-1 rounded-full text-xs font-bold ${hintBadgeColors[hintLevel]}">
                                ${hintLabels[hintLevel]}
                            </span>
                        </div>

                        <div class="mb-4 bg-amber-500/10 p-4 rounded-xl border border-amber-200">
                            <span class="text-xs text-amber-800 font-bold uppercase tracking-wider block mb-1">🎯 導師指派下一步目標</span>
                            <div class="text-lg font-black text-slate-800 leading-relaxed">${escapeHtml(nextAction)}</div>
                        </div>

                        <div class="text-sm text-slate-700 bg-white p-5 rounded-xl border border-amber-100 whitespace-pre-wrap leading-relaxed">
                            <strong class="text-slate-800 block mb-2">💡 導師回饋指引：</strong>
                            ${escapeHtml(advice)}
                        </div>

                        <div class="flex gap-4 mt-6">
                            <button id="btn-resolve-blocker" onclick="resolveStudentBlockerAction()"
                                class="py-2.5 px-6 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2">
                                <span>✅</span> 已完成導師指引（重設卡點）
                            </button>
                        </div>
                    </div>
                `;
            } else if (learningState === 'resolved') {
                blockerSectionHtml = `
                    <div class="bg-green-50 border border-green-200 rounded-2xl p-6 mt-8 flex items-center gap-4">
                        <span class="text-3xl">🎉</span>
                        <div>
                            <h4 class="font-bold text-green-800 mb-1">恭喜！此單元作業已成功解決或通過評分</h4>
                            <p class="text-xs text-green-700">自動評分或導師檢查已達標。您可以繼續挑戰下一單元！</p>
                        </div>
                    </div>
                `;
            } else {
                // 'in_progress' or default
                blockerSectionHtml = `
                    <div class="mt-8 flex justify-center">
                        <button onclick="toggleBlockerForm()"
                            class="py-3 px-8 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2 transform hover:-translate-y-0.5">
                            <span>⚠️</span> 我卡住了 (回報卡點)
                        </button>
                    </div>

                    <div id="blocker-form-wrap" class="hidden bg-slate-50 border border-slate-200 rounded-2xl p-6 mt-6 transition-all duration-300">
                        <h4 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span>🛠️</span> 填寫卡點回報單
                        </h4>
                        
                        <div class="mb-4">
                            <label class="block text-xs font-bold text-slate-600 mb-2">卡點類型</label>
                            <select id="blocker-type" class="w-full border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-medium text-sm">
                                <option value="concept">觀念不懂 (Concept Block)</option>
                                <option value="debug">程式有 Bug / 寫不出來 (Coding/Debugging Block)</option>
                                <option value="environment">環境問題 / 無法編譯 (Environment/Toolchain Block)</option>
                            </select>
                        </div>
                        <p class="text-xs text-slate-500 mb-5">卡點內容請填在下方「學生互動紀錄」輸入框，這裡只需要選擇卡點類型。</p>

                        <div class="flex justify-end gap-3">
                            <button onclick="toggleBlockerForm()" class="px-5 py-2 text-slate-500 hover:bg-slate-200 rounded-xl font-bold text-sm transition">取消</button>
                            <button id="btn-submit-blocker" onclick="submitStudentBlockerAction()"
                                class="px-6 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition font-bold shadow-md text-sm flex items-center gap-2">
                                <span>🚀</span> 提交卡點
                            </button>
                        </div>
                    </div>
                `;
            }

            // Attempt Logger (visible for in_progress / blocked / coaching states)
            let attemptSectionHtml = '';
            if (learningState !== 'resolved') {
                const currentAttempt = details.attemptSummary || '';
                attemptSectionHtml = `
                    <div class="border-t border-slate-200 mt-8 pt-8">
                        <h4 class="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span>📝</span> 學生互動紀錄（卡點 / 嘗試）
                        </h4>
                        <p class="text-xs text-slate-500 mb-4">同一個輸入框即可填寫近況。可先按「提交嘗試紀錄」，若需要導師介入再按「提交卡點」。</p>
                        
                        <div class="flex flex-col gap-3">
                            <textarea id="hub-shared-note" placeholder="例：我修改了 main.cpp 中的 wifi 連線 SSID，重新編譯後 Serial Port 輸出重啟循環錯誤，現在正嘗試加上 delay..."
                                class="w-full border border-slate-300 p-4 rounded-xl h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">${escapeHtml(currentAttempt)}</textarea>
                            
                            <div class="flex justify-end">
                                <button id="btn-submit-attempt" onclick="submitAttemptSummaryAction()"
                                    class="py-2.5 px-6 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-md hover:shadow-lg active:scale-95 text-sm flex items-center gap-2">
                                    <span>📝</span> 提交嘗試紀錄
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Inject combined HTML
            hubContainer.innerHTML = `
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">🤝</span>
                        <div>
                            <h3 class="text-xl font-extrabold text-slate-800 font-[Outfit]">師生互動與卡點支援中心</h3>
                            <p class="text-xs text-slate-500">此單元的即時輔導狀態與下一步行動指引</p>
                        </div>
                    </div>
                    <button onclick="window.openDashboardModalFromHub()" class="flex items-center justify-center w-10 h-10 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-lg transition shadow-sm active:scale-95 self-start sm:self-auto" title="完整學習儀表板">
                        <span>📊</span>
                    </button>
                </div>

                <div class="flex justify-between items-center mt-6 mb-6">
                    ${progressHtml}
                </div>

                ${blockerSectionHtml}

                ${attemptSectionHtml}
            `;
        }

        auth.onAuthStateChanged((user) => {
            if (user) {
                renderStudentInteractionHub(user);
            } else {
                const trigger = document.getElementById('unified-support-trigger');
                if (trigger) trigger.remove();
                const modal = document.getElementById('unified-support-panel');
                if (modal) modal.remove();
            }
        });

        console.log("[Firebase] Initialized.");
    injectAssignmentLinkModal();
    enhanceAssignmentEntryButtons();
}

/**
 * Replace legacy "click whole assignment card" behavior with explicit CTA button.
 * Source pages still contain inline onclick handlers, so we transform them at runtime.
 */
function enhanceAssignmentEntryButtons() {
    const cards = document.querySelectorAll('[onclick*="openSubmissionModal("]');
    console.log(`[CourseShared] Found ${cards.length} assignment cards for CTA enhancement.`);
    const groupMap = new Map();

    cards.forEach((card) => {
        if (!(card instanceof HTMLElement)) return;
        if (card.dataset.assignmentEntryEnhanced === '1') return;

        const onclickValue = card.getAttribute('onclick') || '';
        const match =
            onclickValue.match(/openSubmissionModal\('([^']+)'\s*,\s*'([^']+)'\)/) ||
            onclickValue.match(/openSubmissionModal\("([^"]+)"\s*,\s*"([^"]+)"\)/);
        if (!match) return;

        const assignmentId = match[1];
        const assignmentTitle = match[2];

        // Disable whole-card click trigger.
        card.removeAttribute('onclick');
        card.classList.remove('cursor-pointer');
        card.classList.add('cursor-default');

        // Hide legacy full-card hover overlays that can block CTA visibility/click.
        card.querySelectorAll('.absolute.inset-0').forEach((overlay) => {
            if (overlay instanceof HTMLElement) {
                overlay.classList.add('hidden');
            }
        });

        const groupEl = card.parentElement;
        if (groupEl) {
            if (!groupMap.has(groupEl)) groupMap.set(groupEl, []);
            groupMap.get(groupEl).push({ card, assignmentId, assignmentTitle });
        }
        card.dataset.assignmentEntryEnhanced = '1';
    });

    groupMap.forEach((items, groupEl) => {
        if (!(groupEl instanceof HTMLElement)) return;
        if (!items || items.length === 0) return;

        // 取得該群組中最後一張卡片，用以精確定位按鈕
        const lastCard = items[items.length - 1].card;

        // 判斷是否需要直接將按鈕插入最後一張卡片之後
        // 若父容器為主內容區域 (.unit-content 或 .ms-unit-page)，則按鈕不應放在容器外，而應作為 direct sibling 緊隨最後一張卡片
        const isParentUnitContent = groupEl.classList.contains('unit-content') || groupEl.classList.contains('ms-unit-page');
        const insertTarget = isParentUnitContent ? lastCard : groupEl;

        // 避免重複生成按鈕
        if (insertTarget.nextElementSibling && insertTarget.nextElementSibling.classList.contains('assignment-group-entry-wrap')) return;

        const wrap = document.createElement('div');
        wrap.className = 'assignment-group-entry-wrap mt-6 flex flex-col sm:flex-row gap-4 w-full';

        // 單一按鈕：原生 API 作業系統
        const btnNative = document.createElement('button');
        btnNative.type = 'button';
        btnNative.className = 'flex-1 group assignment-group-native-btn py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-base shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/35 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2';
        btnNative.innerHTML = `
            <i class="fab fa-github text-lg transition-transform group-hover:scale-110"></i>
            <span>前往 GitHub 寫作業</span>
            <i class="fas fa-arrow-right text-sm transition-transform duration-300 group-hover:translate-x-1"></i>
        `;
        btnNative.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const primary = items[0];
            if (!primary) return;
            openSubmissionModal(primary.assignmentId, primary.assignmentTitle, { skipTutorPrompt: false });
        });

        wrap.appendChild(btnNative);
        insertTarget.insertAdjacentElement('afterend', wrap);
    });
}

function openTutorBindingModal(courseId, unitId, assignmentId, title, promotionCode) {
    document.getElementById('link-course-id').value = courseId || '';
    document.getElementById('link-unit-id').value = unitId || '';
    document.getElementById('link-assignment-id').value = assignmentId || '';
    document.getElementById('link-assignment-title').value = title || assignmentId || '';
    // 預填目前已設定的 promotion code（若有）
    document.getElementById('link-promotion-code').value = promotionCode || '';
    document.getElementById('assignment-link-modal').classList.remove('hidden');
}

/**
 * Injects the Assignment Link Modal (for self-binding)
 */
function injectAssignmentLinkModal() {
    if (document.getElementById('assignment-link-modal')) return;
    const modalHTML = `
    <div id="assignment-link-modal" class="fixed inset-0 bg-black/50 hidden flex items-center justify-center z-[70]">
        <div class="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all scale-100 border border-blue-100">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    🎓
                </div>
                <h3 class="text-2xl font-bold text-gray-800">確認 / 更換授課老師</h3>
                <p class="text-sm text-gray-500 mt-2">請確認您目前的授課老師，或輸入新的 Promotion code 更換。<br><span class="text-blue-500 font-medium">留空將使用預設導師邀請連結。</span></p>
            </div>
            
            <input type="hidden" id="link-course-id">
            <input type="hidden" id="link-unit-id">
            <input type="hidden" id="link-assignment-id">
            <input type="hidden" id="link-assignment-title">
            <input type="hidden" id="link-force-mode">

            <div class="mb-6">
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">老師 Promotion code</label>
                <input type="text" id="link-promotion-code" placeholder="輸入 Promotion code 或 Tutor email（留空使用預設導師）"
                    class="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition font-mono text-sm">
                <p class="text-[10px] text-gray-400 mt-2">※ 可填 Promotion code 或 Tutor email；留空將使用預設導師（rover.k.chen@gmail.com）。</p>
            </div>

            <div class="flex flex-col gap-3">
                <button id="btn-bind-tutor" onclick="submitBindTutorAction()"
                    class="group w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                    <span>確認並前往作業</span>
                    <i class="fas fa-arrow-right text-sm transition-transform duration-300 group-hover:translate-x-1"></i>
                </button>
                <button onclick="closeAssignmentLinkModal()"
                    class="w-full py-3 text-gray-400 hover:text-gray-600 transition font-medium text-sm">取消</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.closeAssignmentLinkModal = function () {
    document.getElementById('assignment-link-modal').classList.add('hidden');
};

window.submitBindTutorAction = async function () {
    const btn = document.getElementById('btn-bind-tutor');
    const codeInput = document.getElementById('link-promotion-code');
    const promotionCode = String(codeInput.value || '').trim().toUpperCase();
    const courseId = document.getElementById('link-course-id').value;
    const unitId = document.getElementById('link-unit-id').value;
    const assignmentId = document.getElementById('link-assignment-id').value;
    const title = document.getElementById('link-assignment-title').value;

    btn.disabled = true;
    btn.innerHTML = '正在驗證代碼...';

    try {
        const bindTutorByPromotionCode = httpsCallable(getFunctions(undefined, 'asia-east1'), 'bindTutorByPromotionCode');
        const result = await bindTutorByPromotionCode({ unitId, courseId, promotionCode });

        if (result.data && result.data.success) {
            closeAssignmentLinkModal();
            // 綁定導師成功後，直接進入原生 API 作業倉庫流程
            openSubmissionModal(assignmentId, title, { skipTutorPrompt: true });
        } else {
            alert("❌ 綁定失敗：" + (result.data.message || "未知錯誤"));
        }
    } catch (e) {
        console.error("Binding error:", e);
        alert("❌ 錯誤：" + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <span>確認並前往作業</span>
            <i class="fas fa-arrow-right text-sm transition-transform duration-300 group-hover:translate-x-1"></i>
        `;
    }
};

// Global functions for Modal
window.openSubmissionModal = async function (assignmentId, title, options = {}) {
    const pathParts = window.location.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const courseId = await findCourseIdByUnit(fileName);
    let assignmentAccess = null;

    try {
        if (typeof window.firebaseResolveAssignmentAccess === 'function') {
            assignmentAccess = await window.firebaseResolveAssignmentAccess({ courseId, unitId: fileName, assignmentId });

            const accessMode = String(assignmentAccess?.accessMode || '');
            const isAuthorized = assignmentAccess?.authorized === true ||
                ['paid_student', 'free_course', 'trial_course', 'admin_simulated', 'fully_qualified_tutor', 'qualified_tutor'].includes(accessMode);
            const skipTutorPrompt = !!options?.skipTutorPrompt;

            // [V20] 已授權的使用者，點擊「前往 Classroom 寫作業」時先顯示導師確認對話框
            // 除非 skipTutorPrompt === true（綁定成功後自動觸發的重試流程）
            if (isAuthorized && !skipTutorPrompt) {
                document.getElementById('link-course-id').value = courseId;
                document.getElementById('link-unit-id').value = fileName;
                document.getElementById('link-assignment-id').value = assignmentId;
                document.getElementById('link-assignment-title').value = title;
                // 預填目前已設定的 promotion code，讓使用者確認或修改
                document.getElementById('link-promotion-code').value = assignmentAccess?.assignedPromotionCode || '';

                // 原生 API 系統：固定設為 native-api 模式
                const forceModeInput = document.getElementById('link-force-mode');
                if (forceModeInput) {
                    forceModeInput.value = 'native-api';
                }

                document.getElementById('assignment-link-modal').classList.remove('hidden');
                return;
            }

            // 未通過導師確認流程，直接執行原生 API 流程
            if (!isAuthorized) {
                alert("尚未取得此單元之付款或導師指派授權。");
                return;
            }

            // 若已建立作業倉庫，直接開啟
            if (assignmentAccess?.repositoryUrl) {
                console.log(`[CourseShared] Direct navigation to native repo: ${assignmentAccess.repositoryUrl}`);
                window.open(assignmentAccess.repositoryUrl, '_blank');
                return;
            }

            // 觸發原生 API 倉庫建立流程
            await triggerNativeAssignmentCreation(courseId, fileName, assignmentId, title, assignmentAccess?.githubUsername);
            return;
        }
    } catch (e) {
        console.error('[CourseShared] openSubmissionModal error:', e);
        alert("暫時無法確認您的作業入口，請稍後再試。");
        return;
    }
};

/**
 * Helper to pick the right URL based on tutor map
 */
function resolveClassroomUrl(urlConfig) {
    if (typeof urlConfig === 'string') return urlConfig;
    if (typeof urlConfig === 'object') {
        // Fallback to default or first key
        return urlConfig.default || Object.values(urlConfig)[0];
    }
    return null;
}

function normalizeGitHubClassroomInviteUrl(raw = '') {
    try {
        const url = new URL(String(raw).trim());
        if (url.hostname !== 'classroom.github.com') return String(raw).trim();
        return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
    } catch (_) {
        return String(raw).trim();
    }
}

function isValidGitHubClassroomInviteUrl(url = '') {
    return /^https:\/\/classroom\.github\.com\/a\/[A-Za-z0-9_-]+\/?$/.test(String(url).trim());
}

function isLikelyGitHubClassroomLink(url = '') {
    const s = String(url || '').toLowerCase();
    return s.includes('classroom.github.com') || s.includes('github.com/classroom');
}

function isAdminTutorModeActive() {
    try {
        return localStorage.getItem('adminTutorMode') === 'true';
    } catch (_) {
        return false;
    }
}

function buildSubmitFailureMessage(rawMessage = '', submitUrl = '') {
    const message = String(rawMessage || '').trim();
    const isClassroomSubmission = isLikelyGitHubClassroomLink(submitUrl);
    const maybeOrgInviteIssue =
        /付款授權|payment|repository access issue|no longer have access|no access|invitation|組織邀請|organization/i.test(message);
    if (isClassroomSubmission && maybeOrgInviteIssue) {
        return `繳交失敗：${message || '尚未完成授權'}\n\n請先完成以下步驟後再提交：\n1. 檢查您的電子信箱或點擊 GitHub 右上角鈴鐺通知\n2. 接受待處理的作業 Repository 邀請 (Collaborator Invitation)\n3. 回到本頁重新提交`;
    }
    return `繳交失敗: ${message || 'Unknown error'}`;
}

window.closeSubmissionModal = function () { return; };

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
    const pathParts = window.location.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1]; // 02-unit-ui-ux-standards.html
    const courseId = await findCourseIdByUnit(fileName);
    const unitId = fileName;

    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> 提交中...`;

    try {
        if (typeof window.firebaseSubmitAssignment !== 'function') {
            throw new Error("Firebase SDK not initialized yet.");
        }

        if (isLikelyGitHubClassroomLink(url) && typeof window.firebasePrecheckGithubClassroomAccess === 'function') {
            const precheck = await window.firebasePrecheckGithubClassroomAccess(url);
            const badStates = new Set(['pending', 'invited', 'not_member', 'missing_github_identity']);
            if (precheck && precheck.precheckEnabled && badStates.has(String(precheck.state || ''))) {
                const suffix = precheck.state === 'invited'
                    ? '\n（系統已自動補發邀請）'
                    : precheck.state === 'missing_github_identity'
                        ? '\n（目前帳號尚未綁定 GitHub 登入）'
                        : '';
                alert(
                    `請先接受作業 Repository 的協作者邀請再提交。\n` +
                    `1. 檢查您的電子信箱或點擊 GitHub 右上角鈴鐺通知\n` +
                    `2. 接受待處理的作業邀請\n` +
                    `3. 回到本頁重新提交` +
                    suffix
                );
                return;
            }
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
            alert(buildSubmitFailureMessage(result.message, url));
        }
    } catch (e) {
        console.error(e);
        if (e && e.message) {
            alert(buildSubmitFailureMessage(e.message, url));
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

/**
 * Robustly find parent courseId for a given unit fileName
 */
/**
 * [V8.2] Initialize GitHub README rendering within the unit page.
 * Finds #assignment-guide and injects README above it.
 */
async function initGithubReadme() {
    const target = document.getElementById('assignment-guide');
    if (!target) return;

    // [V14.8.6] Reinforcement: Explicitly hide the guide in main unit body as requested
    target.style.display = 'none';

    // 1. Identify Unit ID
    let unitId = "";
    const meta = document.querySelector('meta[name="markdown-url"]');
    if (meta) {
        unitId = meta.getAttribute('data-unit-id') || "";
    }
    if (!unitId) {
        // Fallback: Use filename
        const path = window.location.pathname;
        unitId = path.substring(path.lastIndexOf('/') + 1).replace('.html', '');
    }

    if (!unitId) return;

    // 2. Load marked.js dynamically if not present
    if (typeof window.marked === 'undefined') {
        console.log("[CourseShared] Loading marked.js dynamically...");
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
        document.head.appendChild(script);
        await new Promise((resolve) => {
            script.onload = resolve;
        });
    }

    // 3. Fetch README
    const GITHUB_ORG = 'vibe-coding-classroom';
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_ORG}/${unitId}/main/README.md`;

    try {
        console.log("[CourseShared] Fetching README from Github Raw...");
        const resp = await fetch(rawUrl);
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        const text = await resp.text();
        const html = window.marked.parse(text);

        // 4. Inject - [V14.8.4] Only if specifically requested or in non-hide-mode
        // User requested to HIDE README.md and assignment-guide in the main unit body.
        // We will keep the fetch logic but skip the injection here.
        /*
        const mdContainer = document.createElement('div');
        mdContainer.className = 'markdown-embed p-6 mt-12 mb-12 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden';
        mdContainer.innerHTML = html;
        target.parentNode.insertBefore(mdContainer, target);
        */
        
        console.log("[CourseShared] README loaded but hidden in main body as requested.");
    } catch (e) {
        console.warn("[CourseShared] Failed to load GitHub README:", e);
    }
}

async function findCourseIdByUnit(fileName) {
    console.log(`[CourseShared] Resolving CourseId for: ${fileName}`);
    try {
        if (!globalLessonsData || globalLessonsData.length === 0) {
            console.log("[CourseShared] globalLessonsData empty, fetching...");
            globalLessonsData = await vibeFetchLessons();
        }

        const normalizeLooseKey = (value = "") => String(value || "").split('/').pop().split('?')[0].replace('.html', '').toLowerCase();
        const targetKey = normalizeLooseKey(fileName);
        
        if (globalLessonsData && Array.isArray(globalLessonsData)) {
            const course = globalLessonsData.find(c => {
                const candidateKeys = new Set([
                    normalizeLooseKey(c.courseId),
                    normalizeLooseKey(c.courseKey),
                    normalizeLooseKey(c.entryUnitId),
                    normalizeLooseKey(c.classroomUrl),
                    normalizeLooseKey(c.contentRef)
                ].filter(Boolean));

                (Array.isArray(c.courseUnits) ? c.courseUnits : []).forEach(unitId => candidateKeys.add(normalizeLooseKey(unitId)));
                return candidateKeys.has(targetKey);
            });
            if (course) {
                console.log(`[CourseShared] Resolved ${fileName} -> ${course.courseId}`);
                return course.courseId;
            } else {
                console.warn(`[CourseShared] No matching course found for unit ${fileName} in Firestore metadata.`);
            }
        } else {
            console.error("[CourseShared] globalLessonsData is not an array:", globalLessonsData);
        }
    } catch (e) {
        console.error("[CourseShared] Error in findCourseIdByUnit:", e);
    }

    console.warn(`[CourseShared] Fallback resolution failed for ${fileName}; returning original key.`);
    return fileName;
}

function ensureMobileResponsiveLayout() {
    try {
        const layout = document.querySelector('.ms-layout');
        if (!layout) return;

        if (!document.getElementById('ms-mobile-responsive-theme')) {
            const style = document.createElement('style');
            style.id = 'ms-mobile-responsive-theme';
            style.textContent = `
                /* Hide sidebar toggle on desktop by default */
                .ms-sidebar-toggle {
                    display: none !important;
                }
                
                @media (max-width: 768px) {
                    /* Layout container setup */
                    .ms-layout {
                        position: relative !important;
                        overflow-x: hidden !important;
                    }
                    
                    /* Sidebar as fixed overlay drawer */
                    body .ms-sidebar {
                        position: fixed !important;
                        top: 48px !important;
                        left: 0 !important;
                        height: calc(100vh - 48px) !important;
                        width: 280px !important;
                        z-index: 1000 !important;
                        transform: translateX(-100%) !important;
                        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                        box-shadow: 4px 0 12px rgba(0,0,0,0.15) !important;
                        background: #faf9f8 !important;
                        display: flex !important;
                    }
                    
                    body .ms-sidebar.open {
                        transform: translateX(0) !important;
                    }
                    
                    /* Content adjustments */
                    .ms-content {
                        width: 100% !important;
                        max-width: 100vw !important;
                        flex: 1 !important;
                    }
                    
                    .unit-content {
                        padding: 20px 16px 40px !important;
                    }
                    
                    .ms-breadcrumb {
                        padding: 10px 16px !important;
                    }
                    
                    .unit-nav {
                        padding: 20px 16px !important;
                    }
                    
                    /* Topnav adjustments */
                    .ms-topnav {
                        padding: 0 12px !important;
                        gap: 12px !important;
                    }
                    
                    /* Hamburger menu toggle button */
                    .ms-sidebar-toggle {
                        display: inline-flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        width: 32px !important;
                        height: 32px !important;
                        color: #ffffff !important;
                        background: transparent !important;
                        border: none !important;
                        font-size: 18px !important;
                        cursor: pointer !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        outline: none !important;
                        order: -1 !important;
                    }
                    
                    .ms-sidebar-toggle:hover {
                        background: rgba(255, 255, 255, 0.1) !important;
                        border-radius: 4px !important;
                    }
                    
                    /* Hide nav label on tiny mobile screens if it overflows */
                    .ms-topnav .nav-label {
                        font-size: 13px !important;
                        white-space: nowrap !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                        max-width: 140px !important;
                    }
                    
                    .ms-topnav .divider {
                        margin: 0 2px !important;
                    }
                    
                    /* Backdrop styling */
                    .ms-sidebar-backdrop {
                        position: fixed !important;
                        top: 48px !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        background: rgba(0, 0, 0, 0.4) !important;
                        z-index: 998 !important;
                        opacity: 0 !important;
                        visibility: hidden !important;
                        transition: opacity 0.3s ease, visibility 0.3s ease !important;
                    }
                    
                    .ms-sidebar-backdrop.active {
                        opacity: 1 !important;
                        visibility: visible !important;
                    }
                    
                    /* Prevent scrolling on body when sidebar is open */
                    body.sidebar-open {
                        overflow: hidden !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // 2. Insert Hamburger Button in Topnav (Only if sidebar is actually present in layout)
        const sidebar = document.querySelector('.ms-sidebar');
        const hasSidebar = !!sidebar;
        
        if (!hasSidebar) {
            const currentTopNav = document.querySelector('.ms-topnav');
            if (currentTopNav) {
                const toggleBtn = currentTopNav.querySelector('.ms-sidebar-toggle');
                if (toggleBtn) toggleBtn.remove();
            }
            return;
        }

        const topNav = document.querySelector('.ms-topnav');
        if (topNav && sidebar) {
            let toggleBtn = topNav.querySelector('.ms-sidebar-toggle');
            if (!toggleBtn) {
                toggleBtn = document.createElement('button');
                toggleBtn.type = 'button';
                toggleBtn.className = 'ms-sidebar-toggle';
                toggleBtn.setAttribute('aria-label', 'Toggle Sidebar');
                toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
                
                topNav.insertBefore(toggleBtn, topNav.firstChild);
            }

            // 3. Create Backdrop Overlay
            let backdrop = document.querySelector('.ms-sidebar-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.className = 'ms-sidebar-backdrop';
                layout.appendChild(backdrop);
            }

            const openSidebar = () => {
                sidebar.classList.add('open');
                backdrop.classList.add('active');
                document.body.classList.add('sidebar-open');
            };

            const closeSidebar = () => {
                sidebar.classList.remove('open');
                backdrop.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            };

            // Re-bind listeners by cloning elements
            const newToggleBtn = toggleBtn.cloneNode(true);
            toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
            
            newToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (sidebar.classList.contains('open')) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            });

            const newBackdrop = backdrop.cloneNode(true);
            backdrop.parentNode.replaceChild(newBackdrop, backdrop);
            
            newBackdrop.addEventListener('click', () => {
                closeSidebar();
            });

            // Close sidebar when clicking menu items on mobile
            sidebar.querySelectorAll('.ms-unit-item, .unit-card').forEach(item => {
                item.addEventListener('click', () => {
                    if (window.innerWidth <= 768) {
                        closeSidebar();
                    }
                });
            });
        }
    } catch (e) {
        console.warn('[CourseShared] ensureMobileResponsiveLayout failed:', e);
    }
}

function sanitizeTitle(str) {
    if (typeof str !== 'string') return str;
    try {
        return str.replace(/\p{Extended_Pictographic}/gu, '')
                  .replace(/[\uFE00-\uFE0F]/g, '')
                  .trim()
                  .replace(/^\s*\b\d+\.\s+/, '')
                  .trim();
    } catch (e) {
        return str.replace(/^\s*\b\d+\.\s+/, '').trim();
    }
}

function cleanUpCourseTitles() {
    try {
        if (typeof UNITS !== 'undefined' && Array.isArray(UNITS)) {
            UNITS.forEach(u => {
                if (u.label) u.label = sanitizeTitle(u.label);
            });
        }
        
        if (typeof document !== 'undefined' && document.title) {
            document.title = sanitizeTitle(document.title);
        }
        
        const selectors = '.unit-name, .unit-card-name, .ms-sidebar-header .module-title, #bc-current, #bc-module-link, .ms-unit-page h1, .unit-content strong';
        document.querySelectorAll(selectors).forEach(el => {
            if (el && el.childNodes.length > 0) {
                for (const node of el.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        node.textContent = sanitizeTitle(node.textContent);
                    }
                }
            }
        });
    } catch (e) {
        console.warn('[CourseShared] cleanUpCourseTitles failed:', e);
    }
}

function normalizeStartButtonText() {
    try {
        const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
        const urlParams = new URLSearchParams(window.location.search);
        const queryLang = urlParams.get('lang') || urlParams.get('locale') || '';
        const isEn = queryLang.trim().toLowerCase().startsWith('en') || file.startsWith('en-');

        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            const onclickAttr = btn.getAttribute('onclick') || '';
            if (onclickAttr.includes('goToUnit(1)')) {
                if (isEn) {
                    btn.innerHTML = 'Start Unit &nbsp;›';
                } else {
                    btn.innerHTML = '開始單元 &nbsp;›';
                }
            }
        });
    } catch (e) {
        console.warn('[CourseShared] normalizeStartButtonText failed:', e);
    }
}

// ==========================================
// [NEW] Native API Assignment Creation Flow Helpers
// ==========================================
let currentCreationContext = null;

function injectGithubUsernameModal() {
    if (document.getElementById('github-username-modal')) return;
    const modalHTML = `
    <div id="github-username-modal" class="fixed inset-0 bg-black/60 hidden flex items-center justify-center z-[70] backdrop-blur-sm">
        <div class="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl transform transition-all scale-100 border border-blue-50">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    <i class="fab fa-github"></i>
                </div>
                <h3 class="text-2xl font-black text-gray-800">連結 GitHub 帳號</h3>
                <p class="text-sm text-gray-500 mt-2 leading-relaxed">
                    系統將自動為您建立該單元的私有作業 Repository 並加您為協作者，請輸入您的 GitHub 帳號（Username）以進行綁定。
                </p>
            </div>
            
            <div class="mb-6">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">您的 GitHub 帳號名稱</label>
                <input type="text" id="github-username-input" placeholder="例如：octocat"
                    class="w-full border-2 border-slate-100 bg-slate-50/50 p-4 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition font-mono text-sm text-center font-bold">
                <p class="text-[10px] text-red-500 mt-2 text-center font-bold hidden" id="github-username-error">※ 帳號名稱格式不正確，請輸入正確的 GitHub 帳號名稱。</p>
            </div>

            <div class="flex flex-col gap-3">
                <button id="btn-submit-github-username"
                    class="group w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl transition font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 focus:outline-none">
                    <span>建立專屬作業庫</span>
                    <i class="fas fa-magic text-sm transition-transform duration-300 group-hover:rotate-12"></i>
                </button>
                <button onclick="closeGithubUsernameModal()"
                    class="w-full py-2 text-gray-400 hover:text-gray-600 transition font-medium text-sm">取消</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Bind click handler
    document.getElementById('btn-submit-github-username').addEventListener('click', async () => {
        const usernameInput = document.getElementById('github-username-input');
        const username = String(usernameInput.value || '').trim();
        const errEl = document.getElementById('github-username-error');
        
        // Simple github username validation: alphanumeric or single hyphens, no consecutive hyphens, 1-39 chars
        const isValid = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(username);
        
        if (!username || !isValid) {
            errEl.classList.remove('hidden');
            return;
        }
        
        errEl.classList.add('hidden');
        closeGithubUsernameModal();
        await executeNativeCreation(username);
    });
}

function injectNativeCreationStatusModal() {
    if (document.getElementById('native-creation-status-modal')) return;
    const modalHTML = `
    <div id="native-creation-status-modal" class="fixed inset-0 bg-black/60 hidden flex items-center justify-center z-[80] backdrop-blur-sm">
        <div class="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl transform transition-all scale-100 border border-blue-50 text-center">
            
            <!-- Loading State -->
            <div id="native-creation-loading-state" class="py-6">
                <div class="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <!-- Spinners -->
                    <div class="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                    <div class="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <i class="fab fa-github text-3xl text-indigo-600 animate-pulse"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-800">正在建立專屬作業</h3>
                <p class="text-sm text-gray-500 mt-2 px-4 leading-relaxed">
                    正在調用 GitHub API 為您複製樣板、設定協作者與初始化 PR 機制，此過程大約需要 3-8 秒，請勿關閉視窗...
                </p>
            </div>

            <!-- Success State -->
            <div id="native-creation-success-state" class="py-6 hidden">
                <div class="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                    <i class="fas fa-check-circle text-emerald-500"></i>
                </div>
                <h3 class="text-2xl font-black text-gray-805">🎉 作業庫建立成功！</h3>
                <p class="text-sm text-slate-500 mt-2 px-4 leading-relaxed">
                    您的個人私有作業 Repository 已成功開通！我們已為您預先開啟了 Feedback Pull Request，可用於未來的代碼審查與討論。
                </p>
                <div class="mt-8 flex flex-col gap-3">
                    <a id="native-repo-link-btn" href="#" target="_blank"
                        class="group w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl transition font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2">
                        <i class="fab fa-github text-lg"></i>
                        <span>前往 GitHub 寫作業</span>
                    </a>
                    <a id="native-pr-link-btn" href="#" target="_blank"
                        class="w-full py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl transition font-bold flex items-center justify-center gap-2">
                        <i class="fas fa-comments text-slate-500"></i>
                        <span>打開 Feedback PR 討論區</span>
                    </a>
                    <button onclick="closeNativeCreationStatusModal()"
                        class="w-full py-2 text-slate-400 hover:text-slate-600 transition font-medium text-sm mt-2">關閉</button>
                </div>
            </div>

            <!-- Failure State -->
            <div id="native-creation-failure-state" class="py-6 hidden">
                <div class="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                    <i class="fas fa-exclamation-triangle text-red-500"></i>
                </div>
                <h3 class="text-xl font-bold text-red-600">作業開通失敗</h3>
                <p id="native-creation-error-msg" class="text-sm text-gray-500 mt-2 px-4 leading-relaxed break-all">
                    建立時發生錯誤，請確認您的 GitHub 帳號是否存在，或聯繫老師/管理員協助。
                </p>
                <div class="mt-8">
                    <button onclick="retryNativeAssignmentCreation()"
                        class="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl transition font-bold shadow-lg shadow-red-500/20 active:translate-y-0 flex items-center justify-center gap-2">
                        <span>重新嘗試建立</span>
                    </button>
                    <button onclick="closeNativeCreationStatusModal()"
                        class="w-full py-2 text-gray-400 hover:text-gray-655 transition font-medium text-sm mt-4">取消</button>
                </div>
            </div>

        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.triggerNativeAssignmentCreation = async function (courseId, fileName, assignmentId, title, existingUsername) {
    injectGithubUsernameModal();
    injectNativeCreationStatusModal();

    currentCreationContext = { courseId, fileName, assignmentId, title };

    if (existingUsername) {
        await executeNativeCreation(existingUsername);
    } else {
        document.getElementById('github-username-input').value = '';
        document.getElementById('github-username-error').classList.add('hidden');
        document.getElementById('github-username-modal').classList.remove('hidden');
    }
};

window.closeGithubUsernameModal = function () {
    document.getElementById('github-username-modal').classList.add('hidden');
};

window.closeNativeCreationStatusModal = function () {
    document.getElementById('native-creation-status-modal').classList.add('hidden');
};

window.executeNativeCreation = async function(githubUsername) {
    const loadingState = document.getElementById('native-creation-loading-state');
    const successState = document.getElementById('native-creation-success-state');
    const failureState = document.getElementById('native-creation-failure-state');
    const statusModal = document.getElementById('native-creation-status-modal');

    // Reset status modal views
    loadingState.classList.remove('hidden');
    successState.classList.add('hidden');
    failureState.classList.add('hidden');
    statusModal.classList.remove('hidden');

    const { courseId, fileName, assignmentId, title } = currentCreationContext || {};

    try {
        const createStudentRepository = httpsCallable(getFunctions(undefined, 'asia-east1'), 'createStudentRepository');
        const result = await createStudentRepository({
            unitId: fileName,
            courseId,
            githubUsername,
            assignmentTitle: title,
            tutorMode: isAdminTutorModeActive()
        });

        if (result.data && result.data.repositoryUrl) {
            loadingState.classList.add('hidden');
            successState.classList.remove('hidden');

            document.getElementById('native-repo-link-btn').href = result.data.repositoryUrl;
            document.getElementById('native-pr-link-btn').href = result.data.feedbackPullRequestUrl || '#';
            
            if (!result.data.feedbackPullRequestUrl) {
                document.getElementById('native-pr-link-btn').classList.add('hidden');
            } else {
                document.getElementById('native-pr-link-btn').classList.remove('hidden');
            }

            if (typeof window.firebaseSubmitAssignment === 'function' && !isAdminTutorModeActive()) {
                window.firebaseSubmitAssignment({
                    courseId,
                    unitId: fileName,
                    assignmentId,
                    title,
                    url: result.data.repositoryUrl,
                    status: 'started',
                    assignmentType: 'native-api'
                }).catch(e => console.error("[CourseShared] Auto-tracking failed:", e));
            }

            setTimeout(() => {
                window.open(result.data.repositoryUrl, '_blank');
            }, 1500);
        } else {
            throw new Error("無法取得作業 Repository 連結。");
        }
    } catch (err) {
        console.error("Repository creation failed:", err);
        loadingState.classList.add('hidden');
        failureState.classList.remove('hidden');
        document.getElementById('native-creation-error-msg').innerText = err.message || "建立作業時發生未知錯誤。";
    }
};

window.retryNativeAssignmentCreation = async function() {
    document.getElementById('native-creation-status-modal').classList.add('hidden');
    document.getElementById('github-username-modal').classList.remove('hidden');
};
// 3. Define a walker to recursively find and normalize text nodes in standard UI containers
function normalizeTerminology() {
    try {
        const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
        const urlParams = new URLSearchParams(window.location.search);
        const queryLang = urlParams.get('lang') || urlParams.get('locale') || '';
        const isEn = queryLang.trim().toLowerCase().startsWith('en') || file.startsWith('en-');
        
        console.log(`[CourseShared] Normalizing terminology (isEn=${isEn})`);

        // 1. Modify the global UNITS array if it exists to prevent goToUnit from restoring un-normalized values
        if (typeof UNITS !== 'undefined' && Array.isArray(UNITS)) {
            UNITS.forEach(u => {
                if (u.label) {
                    if (isEn) {
                        u.label = u.label
                            .replace(/\bCourse\s+Overview\b/gi, 'Unit Overview')
                            .replace(/\bCourse\b/gi, 'Unit')
                            .replace(/\bModule\b/gi, 'Unit');
                    } else {
                        u.label = u.label.replace(/模組/g, '單元');
                    }
                }
            });
        }

        // 2. Modify unitTitles array (used in start-xx pages) if it exists
        if (typeof unitTitles !== 'undefined' && Array.isArray(unitTitles)) {
            for (let i = 0; i < unitTitles.length; i++) {
                if (typeof unitTitles[i] === 'string') {
                    if (isEn) {
                        unitTitles[i] = unitTitles[i]
                            .replace(/\bCourse\s+Overview\b/gi, 'Unit Overview')
                            .replace(/\bCourse\b/gi, 'Unit')
                            .replace(/\bModule\b/gi, 'Unit');
                    } else {
                        unitTitles[i] = unitTitles[i].replace(/模組/g, '單元');
                    }
                }
            }
        }

        // 3. Define a walker to recursively find and normalize text nodes in standard UI containers
        let mapTerms = [];
        if (isEn) {
            mapTerms = [
                ['Previous\\s+Unit', 'Previous Page'],
                ['Next\\s+Unit', 'Next Page'],
                ['Start\\s+Module', 'Start Unit'],
                ['Start\\s+Course', 'Start Unit'],
                ['Complete\\s+Module', 'Complete Unit'],
                ['Module\\s+Completed', 'Unit Completed'],
                ['Course\\s+Overview', 'Unit Overview'],
                ['Starter\\s+Course', 'Starter Unit'],
                ['Basic\\s+Course', 'Basic Unit'],
                ['Advanced\\s+Course', 'Advanced Unit'],
                ['This\\s+Module\\s+Unit', "This Unit's Pages"],
                ['This\\s+Module\'s\\s+Units', "This Unit's Pages"],
                ['This\\s+Module’s\\s+Units', "This Unit's Pages"],
            ];
        } else {
            mapTerms = [
                ['上一個單元', '上一頁'],
                ['下一個單元', '下一頁'],
                ['本模組單元', '本單元頁面'],
                ['開始模組', '開始單元'],
                ['完成模組', '完成單元'],
                ['模組完成', '單元完成'],
                ['本模組', '本單元'],
                ['模組', '單元']
            ];
        }

        const containers = document.querySelectorAll(
            '.ms-topnav, .ms-sidebar, .ms-breadcrumb, #page-index, .unit-nav, .nav-btn-prev, .nav-btn-next, .ms-btn, button, .unit-page-indicator, .unit-completed-badge, .unit-card, .ms-unit-item, .ms-content, .ms-layout'
        );

        containers.forEach(container => {
            const walk = document.createTreeWalker(
                container,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode(node) {
                        let parent = node.parentElement;
                        while (parent) {
                            const tag = parent.tagName.toLowerCase();
                            if (['script', 'style', 'code', 'pre'].includes(tag)) {
                                return NodeFilter.FILTER_REJECT;
                            }
                            parent = parent.parentElement;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );

            let node;
            while (node = walk.nextNode()) {
                let text = node.textContent;
                let changed = false;
                for (const [target, replacement] of mapTerms) {
                    const regex = isEn ? new RegExp(`\\b${target}\\b`, 'gi') : new RegExp(target, 'g');
                    if (regex.test(text)) {
                        text = text.replace(regex, replacement);
                        changed = true;
                    }
                }
                if (changed) {
                    node.textContent = text;
                }
            }
        });

        // 4. Update elements with inline onclick alerts (e.g. Complete Module alerts)
        document.querySelectorAll('[onclick]').forEach(el => {
            let clickStr = el.getAttribute('onclick') || '';
            if (clickStr.includes('alert(')) {
                if (isEn) {
                    if (clickStr.toLowerCase().includes('module') || clickStr.toLowerCase().includes('course')) {
                        clickStr = clickStr
                            .replace(/\bmodule\b/gi, 'unit')
                            .replace(/\bcourse\b/gi, 'unit');
                        el.setAttribute('onclick', clickStr);
                    }
                } else {
                    if (clickStr.includes('模組')) {
                        clickStr = clickStr.replace(/模組/g, '單元');
                        el.setAttribute('onclick', clickStr);
                    }
                }
            }
        });

        // 5. Update meta details (e.g. unit counts "7 units" -> "7 pages", "7 個單元" -> "7 頁")
        const meta = document.querySelector('.ms-sidebar .meta');
        if (meta) {
            if (isEn) {
                meta.innerHTML = meta.innerHTML.replace(/(\d+)\s+units?\b/gi, '$1 pages');
            } else {
                meta.innerHTML = meta.innerHTML.replace(/(\d+)\s*個單元/g, '$1 頁');
            }
        }

        // 6. Update document title fallback
        if (isEn) {
            if (document.title.includes('Course') || document.title.includes('Module')) {
                document.title = document.title
                    .replace(/\bCourse\b/g, 'Unit')
                    .replace(/\bModule\b/g, 'Unit');
            }
        } else {
            if (document.title.includes('模組')) {
                document.title = document.title.replace(/模組/g, '單元');
            }
        }

    } catch (e) {
        console.warn('[CourseShared] normalizeTerminology failed:', e);
    }
}

function interceptGoToUnit() {
    try {
        if (typeof window.goToUnit === 'function' && !window.goToUnit.__isIntercepted) {
            const orig = window.goToUnit;
            window.goToUnit = function(id) {
                orig(id);
                setTimeout(normalizeTerminology, 50); // Small delay to let DOM changes apply
            };
            window.goToUnit.__isIntercepted = true;
            console.log("[CourseShared] Successfully intercepted window.goToUnit");
        }
    } catch (e) {
        console.warn('[CourseShared] interceptGoToUnit failed:', e);
    }
}
} // end window.__courseSharedLoaded guard
