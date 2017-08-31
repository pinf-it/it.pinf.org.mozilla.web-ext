

const PATH = require("path");
const FS = require("fs");
const RUNBASH = require("runbash");
const HTTP = require("http");
const HTTPS = require("https");
const EXPRESS = require("express");
const BODY_PARSER = require( "body-parser");
const CODEBLOCK = require("codeblock");
const GET_PORT = require("get-port");
const BO = require("bash.origin");

var config = null;
try {
    config = JSON.parse(process.argv[2]);
} catch (err) {
    console.log("ERROR parsing argv[2]:", process.argv[2]);
    throw err;
}
const CONFIG = config;
const VERBOSE = process.env.VERBOSE || false;


function makeCommand (PORT) {

    var url = CONFIG.homepage;
    if (/^\//.test(url)) {
        url = "http" + (CONFIG.tls ? "s":"" ) + "://127.0.0.1:" + PORT + url;
    }

    var command = [
        PATH.join(__dirname, "../node_modules/.bin/web-ext"),
        "run",
        "--start-url", url
    ];

    if (CONFIG.browserConsole) {
        command.push("--browser-console");
    }
    if (CONFIG.firefoxVersion) {
        command.push("--firefox=" + CONFIG.firefoxVersion);
    }
    if (CONFIG.verbose) {
        command.push("--verbose");
    }

    return command.join(" ");
}


GET_PORT().then(function (PORT) {

    if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] Run firefox with config:", CONFIG);

    PORT = CONFIG.port || PORT;

    var router = EXPRESS();

    var server = null;
    if (CONFIG.tls) {
        server = HTTPS.createServer({
            key: CONFIG.tls.key || FS.readFileSync(PATH.join(__dirname, '.key.pem')),
            cert: CONFIG.tls.cert || FS.readFileSync(PATH.join(__dirname, '.cert.pem')),
            requestCert: false,
            rejectUnauthorized: false
        }, router);
    } else {
        server = HTTP.createServer(router);
    }

    var browserProcess = null;

    router.use(BODY_PARSER.json());
    router.use(BODY_PARSER.urlencoded({
        extended: false
    }));

    if (CONFIG.routes) {
        Object.keys(CONFIG.routes).map(function (route) {
            var app = null;
            if (
                typeof CONFIG.routes[route] === "object" &&
                !CONFIG.routes[route][".@"]
            ) {
                var keys = Object.keys(CONFIG.routes[route]);
                if (
                    keys.length === 1 &&
                    /^@.+\./.test(keys[0])
                ) {
                    var implId = keys[0].replace(/^@/, "");
                    var implConfig = CONFIG.routes[route][keys[0]];
                    implConfig.variables = {
                        PORT: PORT
                    };

                    var implAPIs = BO.depend(implId, implConfig);

                    if (typeof implAPIs["#io.pinf/middleware~s1"] !== "function") {
                        console.error("implAPIs", implAPIs);
                        throw new Error("implementation for '" + implId + "' does not declare API '#io.pinf/middleware~s1'!");
                    }

                    app = BO.depend(implId, implConfig)["#io.pinf/middleware~s1"]({
                        // TODO: Merge 'CONFIG.variables'
                        variables: {
                            PORT: PORT
                        },
                        SERVER: {
                            stop: stopServer
                        }
                    });
                } else {
                    console.error("CONFIG.routes", CONFIG.routes);
                    throw new Error("[it.pinf.org.mozilla.web-ext] Unknown route format!");
                }
            } else {

                app = CODEBLOCK.run(CONFIG.routes[route], {
                    API: {
                        PORT: PORT,
                        stop: stopServer
                    }
                }, {
                    sandbox: {
                        process: process,
                        console: console,
                        require: require
                    }
                });
                if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] Register app at route:", route, app);
            }
            if (typeof app !== "function") {
                throw new Error("[it.pinf.org.mozilla.web-ext] App for route is not a function:", app, route);
            }

            if (/^\^/.test(route)) {
                route = new RegExp(route);
            }

            console.log("Adding route:", route);
            router.use(route, app);
        });

        server.listen(PORT, "127.0.0.1");
        function stopServer () {
            if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] Stop server");
            return new Promise(function (resolve, reject) {
                if (
                    !server ||
                    !browserProcess
                ) {
                    return resolve(null);
                }
                browserProcess.killDeep();
                browserProcess = null;
                server.close(function () {
                    resolve(null);
                });
                server.unref();
                server = null;
                process.exit(0);
            });
        }

        if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] (pid: " + process.pid + ") Server running at: http://127.0.0.1:" + PORT + "/");
    }

    const command = makeCommand(PORT);

    return RUNBASH(command, {
        cwd: CONFIG.extension,
        wait: false
    }).then(function (info) {

        browserProcess = info;
    });

}).catch(function (err) {
    console.error(err.stack);
    process.exit(1);
});
