#!/usr/bin/env bash.origin.script

depend {
    "webext": {
        "@../..#s1": {
        }
    }
}

CALL_webext run {
    "homepage": "/",
    "extension": "$__DIRNAME__/extension"
}

echo "OK"
