#!/usr/bin/env bash.origin.script

depend {
    "webext": {
        "it.pinf.org.mozilla.web-ext # runner/v0": {
        }
    }
}

echo "TEST_MATCH_IGNORE>>>"

CALL_webext run {
    "homepage": "/index.html",
    "extension": "$__DIRNAME__/extension",
    "browserConsole": true,
    "firefoxVersion": "firefox",
    "verbose": true,
    "routes": {
        "^/": {
            "gi0.PINF.it/build/v0 # /.dist # /": {
                "@it.pinf.org.mochajs # router/v1": {
                    "exit": true,
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
}

echo "<<<TEST_MATCH_IGNORE"

echo "OK"
