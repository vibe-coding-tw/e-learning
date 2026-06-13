/**
 * Footer Component for Vibe Coding
 * Synchronizes footer across all pages
 */

document.addEventListener('DOMContentLoaded', () => {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;

    const root = footerPlaceholder.getAttribute('data-root') || '.';
    const normalizeCanonicalLearningPathKey = (value = '') => {
        const v = String(value || '').trim().toLowerCase().split('/').pop().split('?')[0].split('#')[0].replace(/\.html$/i, '');
        if (!v) return '';
        if (v === 'common' || v === 'car-starter' || v === 'car-basic' || v === 'car-advanced') return v;
        if (/^(?:tw|en)-common$/i.test(v)) return 'common';
        if (/^(?:tw|en)-car-(starter|basic|advanced)$/i.test(v)) return v.replace(/^(?:tw|en)-/i, '');
        if (/^start-\d{2}-unit-/i.test(v)) return 'car-starter';
        if (/^basic-\d{2}-unit-/i.test(v)) return 'car-basic';
        if (/^(?:adv|advanced)-\d{2}-unit-/i.test(v)) return 'car-advanced';
        if (/^\d{2}-unit-/i.test(v)) return 'common';
        if (/^prepare-\d+/i.test(v)) return 'common';
        return v;
    };
    const learningPathHref = (key = '') => `learning-path.html?path=${encodeURIComponent(normalizeCanonicalLearningPathKey(key) || 'common')}`;
    
    // Detect locale (matches nav-component.js behavior)
    let isZh = true;
    if (typeof window.detectUiLocale === 'function') {
        isZh = window.detectUiLocale().startsWith('zh');
    } else {
        const detectLocalFallback = () => {
            try {
                const pathname = window.location.pathname;
                if (pathname.includes('/en/')) return false;
                if (pathname.includes('/tw/') || pathname.includes('/zh-TW/')) return true;
                const filename = pathname.split('/').pop() || '';
                if (filename.startsWith('en-')) return false;
                if (filename.startsWith('tw-')) return true;
            } catch (_) {}
            try {
                const stored = localStorage.getItem('vibe_user_locale');
                if (stored) {
                    return stored.trim().toLowerCase().startsWith('zh');
                }
            } catch (_) {}
            const navLang = String(navigator.language || "").toLowerCase();
            return navLang.startsWith('zh');
        };
        isZh = detectLocalFallback();
    }

    const LOCALIZED_SITE_PAGES = {
        students: {
            zh: { href: '/tw/students.html', label: window.t ? window.t('nav_students_label', '學員指南') : '學員指南' },
            en: { href: '/en/students.html', label: 'Student Guide' },
        },
        tutors: {
            zh: { href: '/tw/tutors.html', label: window.t ? window.t('nav_tutors_label', '導師合作') : '導師合作' },
            en: { href: '/en/tutors.html', label: 'Tutor Collaboration' },
        },
    };
    const localeBucket = (locale = '') => (String(locale || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
    const resolveLocalizedSitePageMeta = (pageKey = '', locale = 'zh-TW') => {
        const page = LOCALIZED_SITE_PAGES[pageKey];
        if (!page) return null;
        const bucket = localeBucket(locale);
        return page[bucket] || page.en || page.zh || null;
    };
    const hydrateLocalizedSitePages = (rootNode, locale = 'zh-TW') => {
        const scope = rootNode && typeof rootNode.querySelectorAll === 'function' ? rootNode : document;
        const elements = scope.querySelectorAll('[data-localized-page]');
        if (!elements.length) return;
        elements.forEach((el) => {
            const pageKey = el.getAttribute('data-localized-page');
            const meta = resolveLocalizedSitePageMeta(pageKey, locale);
            if (!meta) return;
            if (el.tagName === 'A') el.setAttribute('href', meta.href);
            const labelNode = el.querySelector('[data-localized-label]');
            if (labelNode) labelNode.textContent = meta.label;
        });
    };

    // Helper to resolve paths relative to data-root
    const resolve = (path) => {
        if (path.startsWith('http') || path.startsWith('mailto:')) return path;
        if (path === 'students.html' || path === 'tutors.html') {
            const meta = resolveLocalizedSitePageMeta(path.replace('.html', ''), isZh ? 'zh-TW' : 'en');
            return meta ? meta.href : `/${isZh ? 'tw' : 'en'}/${path}`;
        }
        const targetPath = path;
        return `${root}/${targetPath}`.replace('//', '/');
    };

    footerPlaceholder.innerHTML = `
    <footer class="bg-slate-900 py-12 border-t border-white/10 text-white mt-auto">
        <div class="container mx-auto px-6">
            <div class="flex flex-col md:flex-row justify-between items-center gap-8 mb-10">
                <div class="text-2xl font-black tracking-tighter text-white">🚀 Vibe Coding</div>
                <div class="flex flex-wrap justify-center gap-x-8 gap-y-4 text-slate-400 font-bold text-sm uppercase tracking-wide">
                    <a href="${resolve('index.html')}" class="hover:text-white transition-colors">${window.t ? window.t('footer_home', isZh ? '首頁' : 'Home') : (isZh ? '首頁' : 'Home')}</a>
                    <a href="${resolve(learningPathHref('common'))}" class="hover:text-white transition-colors">${window.t ? window.t('footer_learning_path', isZh ? '學習路徑' : 'Learning Path') : (isZh ? '學習路徑' : 'Learning Path')}</a>
                    <a href="${resolve('students.html')}" data-localized-page="students" class="hover:text-white transition-colors"><span data-localized-label="students">${window.t ? window.t('footer_student_guide', isZh ? '學員指南' : 'Student Guide') : (isZh ? '學員指南' : 'Student Guide')}</span></a>
                    <a href="${resolve('tutors.html')}" data-localized-page="tutors" class="hover:text-white transition-colors"><span data-localized-label="tutors">${window.t ? window.t('footer_tutor_guide', isZh ? '導師合作' : 'Tutor Collaboration') : (isZh ? '導師合作' : 'Tutor Collaboration')}</span></a>
                </div>
            </div>
            
            <div class="pt-10 border-t border-white/5">
                <div class="flex flex-col items-center text-center">
                    <p class="text-slate-500 text-sm mb-6">&copy; 2026 Vibe Coding. All rights reserved.</p>
                    
                    <div class="grid grid-cols-1 md:flex md:flex-row justify-center items-center gap-y-2 md:gap-x-6 text-xs text-slate-500 font-medium">
                        <div class="flex items-center gap-2">
                            <span class="opacity-50">${window.t ? window.t('footer_business_entity', isZh ? '營業人' : 'Business Entity') : (isZh ? '營業人' : 'Business Entity')}</span>
                            <span class="text-slate-400">${window.t ? window.t('footer_company_name', isZh ? '腳丫健康科技有限公司' : 'Joy Foot Health Technology Co., Ltd.') : (isZh ? '腳丫健康科技有限公司' : 'Joy Foot Health Technology Co., Ltd.')}</span>
                        </div>
                        <span class="hidden md:inline opacity-20">|</span>
                        <div class="flex items-center gap-2">
                            <span class="opacity-50">${window.t ? window.t('footer_tax_id', isZh ? '統編' : 'Tax ID') : (isZh ? '統編' : 'Tax ID')}</span>
                            <span class="text-slate-400">80187668</span>
                        </div>
                        <span class="hidden md:inline opacity-20">|</span>
                        <div class="flex items-center gap-2">
                            <span class="opacity-50">${window.t ? window.t('footer_contact_us', isZh ? '聯絡我們' : 'Contact Us') : (isZh ? '聯絡我們' : 'Contact Us')}</span>
                            <a href="mailto:info@vibe-coding.tw" class="text-indigo-400 hover:text-indigo-300 transition-colors font-bold">info@vibe-coding.tw</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </footer>
    `;

    void hydrateLocalizedSitePages(footerPlaceholder, isZh ? 'zh-TW' : 'en');
});
