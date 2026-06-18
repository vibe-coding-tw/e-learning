const { toMillis } = require("vibe-functions-core/order-utils");

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
