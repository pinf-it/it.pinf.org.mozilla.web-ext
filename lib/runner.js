

const PATH = require("path");
const RUNBASH = require("runbash");
const HTTP = require("http");
const CONNECT = require("connect");
const CODEBLOCK = require("codeblock");
const GET_PORT = require("get-port");

const CONFIG = JSON.parse(process.argv[2]);
const VERBOSE = process.env.VERBOSE || false;


function makeCommand (PORT) {

    var command = [
        PATH.join(__dirname, "../node_modules/.bin/web-ext"),
        "run",
        "--start-url", "http://127.0.0.1:" + PORT + CONFIG.homepage
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

    var router = CONNECT();
    var server = HTTP.createServer(router);
    var browserProcess = null;

    Object.keys(CONFIG.routes || {}).map(function (route) {
        var app = CODEBLOCK.run(CONFIG.routes[route], {
            API: {
                stop: stopServer
            }
        }, {
            sandbox: {
                process: process,
                console: console
            }
        });
        if (VERBOSE) console.log("[it.pinf.org.mozilla.web-ext] Register app at route:", route, app);
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
