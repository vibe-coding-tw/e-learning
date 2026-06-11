function toMillis(value = null) {
    if (!value) return 0;
    try {
        if (typeof value.toMillis === "function") return value.toMillis();
        if (typeof value.toDate === "function") return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    } catch (_) {
        return 0;
    }
}

function previousYmPeriod(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

module.exports = {
    toMillis,
    previousYmPeriod
};
