
const Promise = require("bluebird");
const PATH = require("path");
const FS = require("fs");
const RUNBASH = require("runbash");
const HTTP = require("http");
const HTTPS = require("https");
const EXPRESS = require("express");
const MORGAN = require("morgan");
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
    } else
    if (/^https?:/.test(url)) {
        // no need to change anything
    } else
    if (/^:\d+\//.test(url)) {
        url = "http" + (CONFIG.tls ? "s":"" ) + "://127.0.0.1" + url;
    } else
    if (/^\/\//.test(url)) {
        url = "http" + (CONFIG.tls ? "s":"" ) + ":" + url;
    } else {
        throw new Error("Unsupported URL format (url: " + url + ")!");
    }

    if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] Homepage URL:", url);
    
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

    if (process.env.BO_TEST_FLAG_DEV) {
        router.use(MORGAN(':remote-addr - ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
    }
    router.use(BODY_PARSER.json());
    router.use(BODY_PARSER.urlencoded({
        extended: false
    }));

    if (
        CONFIG.expect &&
        CONFIG.expect.conditions
    ) {

        // Init expectations

        Promise.map(CONFIG.expect.conditions, function (condition) {

            if (!BO.isInvokable(condition)) {
                console.error("condition", condition);
                throw new Error("[it.pinf.org.mozilla.web-ext] Unknown condition format!");
            }

            return BO.invokeApi(
                condition,
                "#io.pinf/expect~s1"
            );
        }).then(function () {
            
            // All conditions satisfied

            if (CONFIG.expect.exit !== true) {
                // No need to exit
                return;
            }

            if (process.env.BO_TEST_FLAG_DEV) {
                console.log("NOTE: Leaving browser open due to '--dev'.");
                return null;
            }
                
            stopServer(function (err) {
                if (err) {
                    console.error(err);
                    process.exit(1);
                }
                process.exit(0);
            });
        }).catch(function (err) {
            console.error(err);
            process.exit(1);
        });
    }

    if (CONFIG.routes) {
        Object.keys(CONFIG.routes).map(function (route) {
            var app = null;
            if (
                typeof CONFIG.routes[route] === "object" &&
                !CONFIG.routes[route][".@"]
            ) {
                if (BO.isInvokable(CONFIG.routes[route])) {

                    app = BO.invokeApi(
                        CONFIG.routes[route],
                        "#io.pinf/middleware~s1",
                        {
                            SERVER: {
                                stop: stopServer
                            }
                        },
                        {
                            config: {
                                variables: {
                                    PORT: PORT
                                }
                            }
                        }
                    );

                } else {
                    console.error("CONFIG.routes", CONFIG.routes);
                    throw new Error("[it.pinf.org.mozilla.web-ext] Unknown route format!");
                }
            } else {

                app = CODEBLOCK.run(CONFIG.routes[route], {
                    API: {
                        PORT: PORT,
                        SERVER: {
                            stop: stopServer
                        }
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
                if (VERBOSE) {
                    console.log("[it.pinf.org.mozilla.web-ext] Converting string regexp route to RegExp:", route);
                }
                route = new RegExp(route);
            }

            console.log("Adding route:", route);

            var routeWrapper = function (reqOriginal, res, next) {

                var req = Object.create(reqOriginal);
                req.url = "/" + req.url.replace(route, "").replace(/^\//, "");

                if (VERBOSE) {
                    console.log("[it.pinf.org.mozilla.web-ext] Routing request", req.url, "with method", req.method ,"due to route", route);
                }

                return app(req, res, next);
            };
            router.get(route, routeWrapper);
            router.post(route, routeWrapper);
        });

        router.get("/favicon.ico", function (req, res, next) {
            res.writeHead(204);
            res.end("");
        });

        router.use(function (req, res, next) {

            console.log("[it.pinf.org.mozilla.web-ext] Warning: No route found for request", req.url, "with method", req.method);

            return next();
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

    if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] Start command:", command);
    
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
