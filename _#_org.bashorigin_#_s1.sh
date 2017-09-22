#!/usr/bin/env bash.origin.script

depend {
    "git": "@com.github/bash-origin/bash.origin.gitscm#s1"
}


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

function EXPORTS_sign {

    # @see https://developer.mozilla.org/en-US/Add-ons/WebExtensions/web-ext_command_reference#web-ext_sign

    if [ -z "$MOZILLA_ADDONS_API_KEY_ISSUER" ]; then
        echo "ERROR: 'MOZILLA_ADDONS_API_KEY_ISSUER' not set!"
        exit 1
    fi
    if [ -z "$MOZILLA_ADDONS_API_KEY_SECRET" ]; then
        echo "ERROR: 'MOZILLA_ADDONS_API_KEY_SECRET' not set!"
        exit 1
    fi

    if ! CALL_git is_clean; then
        BO_exit_error "Cannot sign. Your git working directory has uncommitted changes! (pwd: $(pwd))"
    fi

    # Update manifest

    BO_run_recent_node --eval '
        const FS = require("fs");
        const LODASH = require("lodash");
        var manifestOverrides = JSON.parse(process.argv[1]).manifest;
        if (!manifestOverrides) {
            process.exit(0);
        }
        var manifest = JSON.parse(FS.readFileSync("manifest.json", "utf8"));
        LODASH.merge(manifest, manifestOverrides);

        // Append git ref to pre version so we can create a unique release
        if (/pre$/.test(manifest.version)) {
            manifest.version += "_" + (new Date().getTime()/1000|0);
        }

        FS.writeFileSync("manifest.json", JSON.stringify(manifest, null, 4), "utf8");
    ' "$1" "$(CALL_git get_head_rev)"

    # Check extension

    echo -e "\nValidating extension:\n"

    "$__DIRNAME__/node_modules/.bin/web-ext" lint

    # Sign extension

    echo -e "\nSigning extension:\n"

    rm -Rf "web-ext-artifacts" || true
    "$__DIRNAME__/node_modules/.bin/web-ext" sign \
        --api-key "$MOZILLA_ADDONS_API_KEY_ISSUER" \
        --api-secret "$MOZILLA_ADDONS_API_KEY_SECRET"

    # Copy generated XPI file to final target

    if [ ! -e "web-ext-artifacts" ]; then
        echo "ERROR: No 'web-ext-artifacts' directory holding signed extension found!"
        exit 1
    fi
    dist=$(BO_run_recent_node --eval '
        console.log(JSON.parse(process.argv[1]).dist);
    ' "$1")
    if [ -z "$dist" ]; then
        echo "ERROR: 'dist' not set!"
        exit 1
    fi
    files=( web-ext-artifacts/*.xpi )
    if [ ! -e "$(dirname "$dist")" ]; then
        mkdir -p "$(dirname "$dist")"
    fi
    cp -f "${files[0]}" "$dist"
    rm -Rf "web-ext-artifacts" || true
}

function EXPORTS_basepath {
    echo "$__DIRNAME__"
}
