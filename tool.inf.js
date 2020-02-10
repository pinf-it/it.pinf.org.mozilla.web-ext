
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace, LIB) {

    return async function (instance) {

        if (/\/runner\/v0$/.test(instance.kindId)) {

            const RUNNER = require('./lib/runner');

            return async function (invocation) {

                if (invocation.method === 'run') {

                    let config = null;

                    if (invocation.config.extensionPath) {

                        const extensionPath = invocation.config.extensionPath.toString();
                        const runConfigPath = LIB.PATH.join(invocation.pwd, extensionPath, '.~', 'it.pinf.org.mozilla.web-ext', 'run.config.json');

                        if (!(await LIB.FS.exists(runConfigPath))) {
                            LIB.console.error(`Could not find run config at '${runConfigPath}' for extension '${extensionPath}'!`);
                            process.exit(1);
                        }

                        config = await LIB.FS.readJSON(runConfigPath);
                        config.basedir = LIB.PATH.dirname(runConfigPath);

                    } else {
                        config = invocation.config.config;
                    }

                    await RUNNER.run(config);

                    return true;
                }
            };            
        }
    };
}
