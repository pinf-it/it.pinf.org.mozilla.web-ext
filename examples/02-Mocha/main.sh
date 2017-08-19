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
        "/": {
            "@it.pinf.org.mochajs#s1": {
                "tests": {
                    "01-HelloWorld": function /* CodeBlock */ () {

                        describe('Array', function () {
                            describe('#indexOf()', function () {

                                it('should return -1 when the value is not present', function () {
                                    chai.assert.equal(-1, [1,2,3].indexOf(4));
                                });
                            });
                        });
                    }
                }
            }
        }
    }    
}

echo "OK"