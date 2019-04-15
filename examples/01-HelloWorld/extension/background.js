
browser.webNavigation.onCompleted.addListener(function (requestDetails) {

    if (requestDetails.tabId) {
        browser.tabs.get(requestDetails.tabId).then(function (tab) {

            return browser.windows.get(tab.windowId).then(function (window) {

                console.log(`Loaded tab '${tab.id}' with window id '${window.id}'.`);
                console.log(`Redirecting to: /done`);

                if (/\/$/.test(tab.url)) {

                    browser.tabs.executeScript({
                        code: `window.location.pathname = '/done';`
                    });    
                }
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

browser.tabs.reload();
