#!/usr/bin/env bash.origin.script

depend {
    "webext": {
        "@com.github/pinf-it/it.pinf.org.mozilla.web-ext#s1": {
        }
    }
}

CALL_webext run {
    "homepage": "/",
    "extension": "$__DIRNAME__/extension",
    "browserConsole": true,
    "firefoxVersion": "firefoxdeveloperedition",
    "verbose": true,
    "routes": {
        "/": function /* CodeBlock */ (API) {
            return function (req, res, next) {
                res.writeHead(200, {
                    "Content-Type": "text/html"
                });
                res.end('<html>OK</html>');
                API.stop();
            };
        }
    }    
}

echo "OK"
