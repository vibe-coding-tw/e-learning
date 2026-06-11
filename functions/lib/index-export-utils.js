const registerProxyExports = (target, entries, factory) => {
    for (const [exportName, handlerName] of entries) {
        target[exportName] = factory(handlerName);
    }
};

module.exports = {
    registerProxyExports
};
