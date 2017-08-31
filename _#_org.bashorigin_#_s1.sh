#!/usr/bin/env bash.origin.script

if [ ! -e "$__DIRNAME__/node_modules" ]; then
    pushd "$__DIRNAME__" > /dev/null
        BO_run_npm install
    popd > /dev/null
fi


if [ ! -e "$__DIRNAME__/lib/.key.pem" ]; then
    pushd "$__DIRNAME__/lib" > /dev/null
        openssl genrsa -out .key.pem 2048
        openssl req -new -key .key.pem -out .csr.pem
        openssl x509 -req -days 9999 -in .csr.pem -signkey .key.pem -out .cert.pem
        rm .csr.pem
    popd > /dev/null
fi


function EXPORTS_run {

    BO_log "$VERBOSE" "[it.pinf.org.mozilla.web-ext] run: $@"

    BO_run_recent_node "$__DIRNAME__/lib/runner.js" "$@"
}

function EXPORTS_basepath {
    echo "$__DIRNAME__"
}
