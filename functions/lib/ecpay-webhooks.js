function createMapReplyHandler() {
    return (req, res) => {
        if (req.method !== "POST") {
            return res.redirect("https://vibe-coding.tw/cart.html");
        }

        try {
            const { CVSStoreID, CVSStoreName, CVSAddress } = req.body;
            console.log("Map Reply Received:", CVSStoreID, CVSStoreName);

            const baseUrl = "https://vibe-coding.tw/cart.html";
            const params = new URLSearchParams({
                storeId: CVSStoreID || "",
                storeName: CVSStoreName || "",
                address: CVSAddress || "",
                action: "storeSelected"
            });

            return res.redirect(`${baseUrl}?${params.toString()}`);
        } catch (error) {
            console.error("Map Reply Error:", error);
            return res.status(500).send("Error processing map reply");
        }
    };
}

module.exports = {
    createMapReplyHandler
};
