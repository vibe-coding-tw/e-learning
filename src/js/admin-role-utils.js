(function () {
    const ADMIN_ROLE_EMAILS = new Set([
        "rover.k.chen@gmail.com",
    ]);

    function normalizeEmail(value = "") {
        return String(value || "").trim().toLowerCase();
    }

    function isAdminEmail(value = "") {
        return ADMIN_ROLE_EMAILS.has(normalizeEmail(value));
    }

    function resolveRoleFromEmail(email = "", fallbackRole = "") {
        if (isAdminEmail(email)) return "admin";
        return String(fallbackRole || "").trim().toLowerCase();
    }

    window.vibeRoleUtils = {
        ADMIN_ROLE_EMAILS,
        isAdminEmail,
        normalizeEmail,
        resolveRoleFromEmail,
    };
})();
