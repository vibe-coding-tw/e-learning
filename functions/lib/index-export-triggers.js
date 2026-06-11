const registerTriggersExports = (target, createOnUserCreatedTrigger, createMapReplyHandler) => {
    target.onUserCreated = createOnUserCreatedTrigger();
    target.mapReply = createMapReplyHandler();
};

module.exports = {
    registerTriggersExports
};
