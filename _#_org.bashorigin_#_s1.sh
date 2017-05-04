#!/usr/bin/env bash.origin.script

if [ ! -e "$__DIRNAME__/node_modules" ]; then
    pushd "$__DIRNAME__" > /dev/null
        BO_run_npm install
    popd > /dev/null
fi

function EXPORTS_run {

    BO_log "$VERBOSE" "[it.pinf.org.mozilla.web-ext] run: $@"

    BO_run_recent_node "$__DIRNAME__/lib/runner.js" "$@"
}

function EXPORTS_basepath {
    echo "$__DIRNAME__"
}
