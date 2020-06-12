
const LIB = require("bash.origin.lib").forPackage(__dirname).js;

const Promise = LIB.BLUEBIRD;
const PATH = LIB.path;
let FS = LIB.FS_EXTRA;
const RUNBASH = LIB.RUNBASH;
const HTTP = LIB.http;
const HTTPS = LIB.https;
const EXPRESS = LIB.EXPRESS;
const MORGAN = LIB.MORGAN;
const BODY_PARSER = LIB.BODY_PARSER;
const CODEBLOCK = LIB.CODEBLOCK;
const GET_PORT = LIB.GET_PORT;
const BO = LIB.BASH_ORIGIN;


exports.run = async function (CONFIG, options) {
    options = options || {};

    if (options.LIB) {
        FS = options.LIB.FS;
        LIB.FS = FS;
        LIB.FS_EXTRA = FS;
    }

    CONFIG.basedir = CONFIG.basedir || process.cwd();

    const VERBOSE = CONFIG.verbose;
    const BUILD_ONLY = CONFIG.buildOnly;

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

        // Do not work to enable extension debugging.
        // The preferences seem to be set but do not do anything.
        // TODO: Auto-enable extension debugging.
        // command.push("--pref devtools.chrome.enabled=true");
        // command.push("--pref devtools.aboutdebugging.new-enabled=true");

        // TODO: Set preference to auto-open devtools.

        return command.join(" ");
    }

    return GET_PORT().then(async function (PORT) {

// TODO: Only log on debug
//        if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] Run firefox with config:", JSON.stringify(CONFIG, null, 4));

        PORT = CONFIG.port || PORT;

        // TODO: Use 'bash.origin.express'

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


        router.use(function (req, res, next) {

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            next(null);
        });


        function stopServer () {

            if (options.LIB && options.LIB.console) options.LIB.console.log("Stop server");

            return new Promise(function (resolve, reject) {
                if (
                    !server ||
                    !browserProcess
                ) {
                    return resolve(null);
                }
                browserProcess.killDeep().then(function () {
                    browserProcess = null;
                    server.close(function () {
                        resolve(null);
                    });
                    server.unref();
                    server = null;
                    process.exit(0);
                });
            });
        }

        

        return Promise.try(function () {

            if (!CONFIG.files) {
                return null;
            }

            // TODO: Relocate into helper
            Object.keys(CONFIG.files).forEach(function (targetSubpath) {
                if (!Array.isArray(targetSubpath)) {
                    targetSubpath = [
                        targetSubpath
                    ];
                }
                targetSubpath.forEach(function (targetSubpath) {

                    var filePath = CONFIG.files[targetSubpath];

                    // TODO: Do this via a shared lib

                    if (/^\//.test(filePath)) {
                        // all good
                    } else
                    if (/^\./.test(filePath)) {
                        filePath = PATH.join(CONFIG.basedir, filePath);
                    } else {


                        var resolvedPath = null;
                        var searchPath = filePath;
                        if (/\//.test(searchPath)) {
                            searchPath = searchPath.split("/")[0] + "/package.json";                        
                        }

                        if (CONFIG.baseDir) {
                            try {
                                resolvedPath = LIB.RESOLVE.sync(searchPath, {
                                    basedir: CONFIG.baseDir
                                });
                            } catch (err) {
                            }
                        }
                        if (!resolvedPath) {
                            resolvedPath = LIB.RESOLVE.sync(searchPath, {
                                basedir: __dirname
                            });
                        }

                        if (searchPath !== filePath) {
                            filePath = PATH.join(
                                resolvedPath,
                                "..",
                                filePath.replace(/^[^\/]+\/?/, '')
                            );
                        } else {
                            filePath = resolvedPath;
                        }
                    }

    /*
    // TODO: Optionally allow wrapping.
    // TODO: Implement this via an INF plugin.
                    if (/\.html?$/.test(targetSubpath)) {
                        var code = FS.readFileSync(filePath, "utf8");
                        code = prepareAnchorCode(code);
                        code = BOILERPLATE.wrapHTML(code, {
                            css: css,
                            scripts: config.scripts,
                            uriDepth: uriDepth + (targetSubpath.split("/").length - 1)
                        });
                        FS.outputFileSync(targetSubpath, code, "utf8");
                    } else {
    */
    //console.error("CONFIGCONFIG::", CONFIG, CONFIG.extension);

                        var targetPath = PATH.resolve(CONFIG.basedir, PATH.join(CONFIG.extension, "scripts", targetSubpath.replace(/(^\/|\/\*$)/g, "")));
                        
                        if (VERBOSE) console.log("Copy:", filePath, targetPath);

                        FS.copySync(filePath, targetPath);
    //                }
                });
            });

            return null;

        }).then(async function () {

            if (!CONFIG.routes) {
                return null;
            }

// console.error("[runner] options.invocation", options.invocation)            
// console.error("[runner] CONFIG", CONFIG)            
//            router.stopServer = stopServer;
            await LIB.BASH_ORIGIN_EXPRESS.hookRoutes(router, CONFIG.routes, {
                verbose: (options.LIB && options.LIB.verbose) || false,
                basedir: CONFIG.basedir,
                mountPrefix: '/' + LIB.PATH.relative(CONFIG.basedir, CONFIG.extension),
                variables: {
                    PORT: PORT
                },
                API: {
                    SERVER: {
                        stop: async function (callback) {
                            try {
                                await stopServer();
                                if (callback) callback(null);
                            } catch (err) {
                                if (callback) callback(err);
                            }
                        }
                    }
                }
            });


//             return Promise.mapSeries(Object.keys(CONFIG.routes), async function (route) {
//                 var app = null;
//                 if (
//                     typeof CONFIG.routes[route] === "object" &&
//                     !CONFIG.routes[route][".@"]
//                 ) {
//                     if (BO.isInvokable(CONFIG.routes[route])) {

//                         if (VERBOSE) console.log(`[it.pinf.org.mozilla.web-ext] App for route '${route}':`, CONFIG.routes[route]);

//                         if (VERBOSE) console.log(`[it.pinf.org.mozilla.web-ext] 'CONFIG.basedir':`, CONFIG.basedir);
//                         process.chdir(CONFIG.basedir);

// console.error("CONFIG.routes[route]", route, CONFIG.routes[route]);



// throw new Error("TODO: Fixme");

//                         app = BO.invokeApi(
//                             CONFIG.routes[route],
//                             [
//                                 "#io.pinf/middleware~s2",
//                                 "#io.pinf/middleware~s1"
//                             ],
//                             {
//                                 SERVER: {
//                                     stop: stopServer
//                                 }
//                             },
//                             {
//                                 config: {
//                                     variables: {
//                                         PORT: PORT
//                                     }
//                                 }
//                             }
//                         );

//                         if (typeof app.prime === 'function') {
//                             await app.prime();
//                         }

//                     } else {
//                         console.error("CONFIG.routes", CONFIG.routes);
//                         throw new Error("[it.pinf.org.mozilla.web-ext] Unknown route format!");
//                     }
//                 } else
//                 if (typeof CONFIG.routes[route] === "string") {

//                     const path = PATH.resolve(CONFIG.basedir, CONFIG.routes[route]);

//                     if (VERBOSE) console.log(`[it.pinf.org.mozilla.web-ext] Static app path:`, path);

//                     if (FS.statSync(path).isDirectory()) {
//                         app = EXPRESS.static(path);
//                     } else {
//                         throw new Error("NYI");
//                         //app = EXPRESS.static(CONFIG.routes[route]);
//                     }

//                 } else {

//                     app = CODEBLOCK.run(CONFIG.routes[route], {
//                         API: {
//                             PORT: PORT,
//                             SERVER: {
//                                 stop: stopServer
//                             }
//                         }
//                     }, {
//                         sandbox: {
//                             process: process,
//                             console: console,
//                             require: require,
//                             setTimeout: setTimeout,
//                             clearTimeout: clearTimeout
//                         }
//                     });
//                     if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] Register app at route:", route, app);
//                 }

//                 return Promise.resolve(app).then(function (app) {

//                     if (typeof app !== "function") {
//                         console.error("route", route);
//                         console.error("app", app);
//                         throw new Error("[it.pinf.org.mozilla.web-ext] App for route is not a function!");
//                     }

//                     var routeStr = route;
//                     if (/^\^/.test(route)) {
//                         if (VERBOSE) {
//                             console.log("[it.pinf.org.mozilla.web-ext] Converting string regexp route to RegExp:", route);
//                         }
//                         route = new RegExp(route);
//                     }

//                     console.log("Adding route:", route);

//                     var routeWrapper = function (reqOriginal, res, next) {

//                         var req = {};
//                         Object.keys(reqOriginal).forEach(function (name) {
//                             req[name] = reqOriginal[name];
//                         });

//                         req.url = "/" + reqOriginal.url.replace(new RegExp(routeStr + '(.*)$'), "$1").replace(/^\//, "");
//                         req.mountAt = reqOriginal.url.substring(0, reqOriginal.url.length - req.url.length + 1);
            
//                         if (VERBOSE) {
//                             console.log("[it.pinf.org.mozilla.web-ext] Routing request", req.url, "with method", req.method ,"due to route", route);
//                         }

//                         return app(req, res, next);
//                     };
//                     router.get(route, routeWrapper);
//                     router.post(route, routeWrapper);

//                     return null;
//                 });
//             });
        }).then(function () {
            
            router.get("/favicon.ico", function (req, res, next) {
                res.writeHead(204);
                res.end("");
            });

            router.use(function (req, res, next) {

                console.log("[it.pinf.org.mozilla.web-ext] Warning: No route found for request", req.url, "with method", req.method);

                return next();
            });
        }).then(async function () {
            if (!CONFIG.postbuild) {
                return null;
            }

            const postbuild = CODEBLOCK.run(CONFIG.postbuild, {
                LIB: LIB
            }, {
                sandbox: {
                    process: process,
                    console: console,
                    require: require,
                    setTimeout: setTimeout,
                    clearTimeout: clearTimeout
                }
            });

            try {
                process.chdir(PATH.resolve(CONFIG.basedir, CONFIG.extension));

                await postbuild();
            } catch (err) {
                throw err;
            }
            process.chdir(CONFIG.basedir);

        }).then(async function () {

            if (BUILD_ONLY) {
                if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] SKIP startup of server due to BUILD_ONLY");
                return null;
            }

            server.listen(PORT, "127.0.0.1");

            if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] (pid: " + process.pid + ") Server running at: http://127.0.0.1:" + PORT + "/");

            return null;    
        }).then(async function () {

            if (BUILD_ONLY) {
                if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] SKIP running of browser due to BUILD_ONLY");
                return null;
            }
            
            const command = makeCommand(PORT);
            
            if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] Start command:", command);

            return RUNBASH(command, {
                cwd: PATH.resolve(CONFIG.basedir, CONFIG.extension),
                wait: false
            }).then(async function (info) {

                browserProcess = info;


                if (
                    CONFIG.expect &&
                    CONFIG.expect.conditions
                ) {
        
                    // Init expectations    
                    await Promise.map(CONFIG.expect.conditions, async function (condition) {
        
                        // if (!BO.isInvokable(condition)) {
                        //     console.error("condition", condition);
                        //     throw new Error("[it.pinf.org.mozilla.web-ext] Unknown condition format!");
                        // }
        
                        const implId = Object.keys(condition)[0];

                        if (/^([^\s]+)\s*#\s*([^\s]+)\s*#\s*([^\s]+)$/.test(implId)) {

                            const keys = Object.keys(condition);
                            const modelTargetPointer = keys[0].match(/^([^\s]+)\s*#\s*([^\s]+)\s*#\s*([^\s]+)$/);
                            const toolPointer = Object.keys(condition[keys[0]])[0];
                            const toolConfig = condition[keys[0]][toolPointer];
            
                            await LIB['@pinf-it/core']({
                                cwd: options.basedir
                            }).runToolForModel(
                                modelTargetPointer[1],
                                `/${LIB.PATH.join(modelTargetPointer[2] || '/')}`.replace(/\/\//g, '/'),
                                `/${LIB.PATH.join(modelTargetPointer[3] || '/')}`.replace(/\/\//g, '/'),
                                toolPointer.replace(/^@/, ''),
                                toolConfig,
                                [],
                                {
                                    // TODO: Namespace this API.
                                    SERVER: {
                                        middleware: {
                                            static: EXPRESS.static
                                        },
                                        stop: router.stopServer
                                    }
                                }
                            );
                            
                        } else {

                            await LIB['@pinf-it/core']({
                                cwd: CONFIG.basedir
                            }).runTool(implId.replace(/^@/, ''), condition[implId]);    
                        }

    //    console.error("ALL DONE!");                
                        // return BO.invokeApi(
                        //     condition,
                        //     "#io.pinf/expect~s1"
                        // );
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
        
                        return null;
                    }).catch(function (err) {
                        console.error(err);
                        process.exit(1);
                    });
                }


                return null;
            }).catch(function (err) {
        
                console.error("[it.pinf.org.mozilla.web-ext] ERROR:", err);        
        
                throw err;
            });
        });

    });
}


if (require.main === module) {
    try {

        var config = null;
        try {
            config = JSON.parse(process.argv[2]);
        } catch (err) {
            console.log("ERROR parsing argv[2]:", process.argv[2]);
            throw err;
        }
        const CONFIG = config;
        if (typeof CONFIG.verbose === 'undefined') {
            CONFIG.verbose = process.env.VERBOSE || false;
        }

        // TODO: Make this more flexible.
        CONFIG.buildOnly = (process.argv[3] === "--build-only");

        exports.run(CONFIG).catch(function (err) {
            console.error(err.stack || err);
            process.exit(1);
        });

    } catch (err) {
        console.error(err.stack || err);
        process.exit(1);
    }
}
