

browser.webNavigation.onCompleted.addListener(function (requestDetails) {

    if (
        requestDetails.tabId &&
        requestDetails.tabId !== -1
    ) {
        browser.tabs.get(requestDetails.tabId).then(function (tab) {

            return browser.windows.get(tab.windowId).then(function (window) {

                return browser.windows.remove(window.id);
            });
        }).catch(console.error);
    }

}, {
    url: [
        {
            schemes: [
                "http"
            ]
        }
    ]
});
