import os

def fix_all_html_scripts():
    for root, dirs, files in os.walk('.'):
        if '.git' in dirs: dirs.remove('.git')
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r') as f:
                    content = f.read()
                
                # Revert to standard script for nav-component.js
                new_content = content.replace('script type="module" src="js/nav-component.js"', 'script src="js/nav-component.js"')
                
                if new_content != content:
                    print(f"Fixed {filepath}")
                    with open(filepath, 'w') as f:
                        f.write(new_content)

def rewrite_nav_js():
    js_content = """
/**
 * Unified Navigation (v2026.04.05.ULTRA_STABLE)
 * Non-module fallback for guaranteed UI rendering.
 */

window.renderNav = function (rootPath, options) {
    console.log('[VibeNav] renderNav() UI Init Executing...');
    rootPath = rootPath || '.';
    options = options || {};
    var showAuth = options.showAuth || false;

    var resolve = function(path) {
        if (path.startsWith('http')) return path;
        return (rootPath + '/' + path).replace(/\\/\\/+/g, '/').replace(':/', '://');
    };

    var navHTML = '<nav class=\"bg-white/90 backdrop-blur-md shadow-md sticky top-0 z-[99999]\" id=\"main-nav\">' +
        '<div class=\"px-6\">' +
            '<div class=\"flex justify-between items-center py-4\">' +
                '<a href=\"' + resolve('index.html') + '\" class=\"text-2xl font-extrabold text-blue-900 tracking-tight flex items-center gap-2\">' +
                    '<span>🚀</span> Vibe Coding' +
                '</a>' +
                '<div class=\"flex items-center gap-6\">' +
                    '<div class=\"hidden md:flex items-center space-x-6 font-medium text-gray-600\">' +
                        '<div class=\"relative dropdown group\">' +
                            '<button class=\"flex items-center hover:text-cyan-600 transition cursor-pointer py-2\">課程連結 <svg class=\"w-4 h-4 ml-1\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M19 9l-7 7-7-7\"></path></svg></button>' +
                            '<div class=\"dropdown-menu absolute hidden group-hover:block bg-white shadow-xl rounded-lg py-2 w-48 mt-0 border border-gray-100 left-0\">' +
                                '<a href=\"' + resolve('prepare.html') + '\" class=\"block px-4 py-2 hover:bg-cyan-50\">課前準備</a>' +
                                '<a href=\"' + resolve('started.html') + '\" class=\"block px-4 py-2 hover:bg-cyan-50\">入門課程</a>' +
                                '<a href=\"' + resolve('basic.html') + '\" class=\"block px-4 py-2 hover:bg-cyan-50\">基礎實作</a>' +
                                '<a href=\"' + resolve('advanced.html') + '\" class=\"block px-4 py-2 hover:bg-cyan-50\">進階應用</a>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class=\"flex items-center gap-4\">' +
                        (showAuth ? '<div id=\"auth-status\" class=\"text-sm flex items-center\"><button id=\"login-btn-legacy\" class=\"bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-full transition shadow-md\">登入</button></div>' : '') +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
    '</nav>';

    var placeholder = document.getElementById('nav-placeholder');
    if (placeholder) {
        placeholder.outerHTML = navHTML;
        console.log('[VibeNav] UI Successfully Rendered');
    }
};

// AUTO EXECUTION SCAN
(function() {
    console.log('[VibeNav] Booting...');
    var ph = document.getElementById('nav-placeholder');
    if (ph) {
        var root = ph.getAttribute('data-root') || '.';
        var authFlag = ph.getAttribute('data-show-auth') === 'true';
        window.renderNav(root, { showAuth: authFlag });
    }
})();
"""
    with open('public/js/nav-component.js', 'w') as f:
        f.write(js_content)

if __name__ == \"__main__\":
    fix_all_html_scripts()
    rewrite_nav_js()
