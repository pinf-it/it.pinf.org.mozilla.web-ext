

browser.webRequest.onCompleted.addListener(function logURL(requestDetails) {

    console.log("LOADED PAGE EVENT IN TEST EXTENSION: " + requestDetails.url);

} ,{
    urls: ["<all_urls>"]
});
