#!/usr/bin/env bash.origin.script

depend {
    "git": "bash.origin.gitscm # helpers/v0"
}


local NODE_VERSION="${BO_VERSION_NVM_NODE}"

#if [ ! -e "$__DIRNAME__/node_modules" ]; then
#    pushd "$__DIRNAME__" > /dev/null
#        BO_VERSION_NVM_NODE="$NODE_VERSION" BO_run_npm install
#    popd > /dev/null
#fi

# Key for HTTPS server
if [ ! -e "$__DIRNAME__/../../lib/.key.pem" ]; then
    pushd "$__DIRNAME__/../../lib" > /dev/null
        openssl genrsa -out .key.pem 2048
        openssl req -new -key .key.pem -out .csr.pem
        openssl x509 -req -days 9999 -in .csr.pem -signkey .key.pem -out .cert.pem
        rm .csr.pem
    popd > /dev/null
fi


function EXPORTS_run {

    BO_log "$VERBOSE" "[it.pinf.org.mozilla.web-ext] run: $@"

    # TODO: Port to PINF-it interface.

    # BO_VERSION_NVM_NODE="$NODE_VERSION" BO_run_node "$__DIRNAME__/../../lib/runner.js" "$@"
    node "$__DIRNAME__/../../lib/runner.js" "$@"
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

    # TODO: Relocate to pinf-to and use here
    node --eval '
        const LIB = require("bash.origin.lib").forPackage("'$__DIRNAME__'/../..").js;
        
        const FS = LIB.fs;
        var manifestOverrides = JSON.parse(process.argv[1]).manifest;
        if (!manifestOverrides) {
            process.exit(0);
        }
        var manifest = JSON.parse(FS.readFileSync("manifest.json", "utf8"));
        LIB.LODASH.merge(manifest, manifestOverrides);
        FS.writeFileSync("manifest.json", JSON.stringify(manifest, null, 4), "utf8");
    ' "$1"

    # Check extension

    echo -e "\nValidating extension:\n"

    # BO_VERSION_NVM_NODE="$NODE_VERSION" BO_run_node "$__DIRNAME__/../../node_modules/.bin/web-ext" lint
    node "$__DIRNAME__/../../node_modules/.bin/web-ext" lint

    # Sign extension

    echo -e "\nSigning extension:\n"

    # TODO: Make configurable via function argument
    if [ -z "$MOZILLA_ADDONS_CHANNEL" ]; then
        MOZILLA_ADDONS_CHANNEL="unlisted"
    fi

    rm -Rf "web-ext-artifacts" || true
    #    --verbose \
    # BO_VERSION_NVM_NODE="$NODE_VERSION" BO_run_node "$__DIRNAME__/../../node_modules/.bin/web-ext" sign \
    node "$__DIRNAME__/../../node_modules/.bin/web-ext" sign \
        --api-key "$MOZILLA_ADDONS_API_KEY_ISSUER" \
        --api-secret "$MOZILLA_ADDONS_API_KEY_SECRET" \
        --channel "$MOZILLA_ADDONS_CHANNEL" \
        --timeout "900000"

    # Copy generated XPI file to final target

    if [ ! -e "web-ext-artifacts" ]; then
        echo "ERROR: No 'web-ext-artifacts' directory holding signed extension found!"
        exit 1
    fi
    dist=$(node --eval '
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
    echo "$__DIRNAME__/../.."
}
