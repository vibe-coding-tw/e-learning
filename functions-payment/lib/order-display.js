function hasPhysicalOrderItem(items = {}) {
    return Object.values(items || {}).some((item) => item && item.isPhysical === true);
}

function buildOrderItemsDescription(items = {}) {
    return Object.values(items || {})
        .map((item) => item?.name || item?.title || "教材")
        .join(", ");
}

module.exports = {
    hasPhysicalOrderItem,
    buildOrderItemsDescription
};
