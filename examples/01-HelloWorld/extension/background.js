

browser.webRequest.onCompleted.addListener(function (requestDetails) {

    if (requestDetails.tabId) {
        browser.tabs.get(requestDetails.tabId).then(function (tab) {

            return browser.windows.get(tab.windowId).then(function (window) {

                return browser.windows.remove(window.id);
            });
        }).catch(console.error);
    }

} ,{
    urls: ["<all_urls>"]
});
