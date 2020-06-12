
exports['gi0.PINF.it/build/v0'] = async function (LIB, CLASSES) {

    const RUNNER = require('../../lib/runner');

    class BuildStep extends CLASSES.BuildStep {

        async onEveryBuild (result, build, target, instance, home, workspace) {

            if (
                build.method === 'run' ||
                build.method === 'build'
            ) {

                let config = null;

                if (typeof build.config === 'string') {

                    const runConfigPath = LIB.PATH.join(target.path, 'run.config.json');

                    if (!(await LIB.FS.exists(runConfigPath))) {
                        LIB.console.error(`Could not find run config at '${runConfigPath}' for extension '${target.path}'!`);
                        process.exit(1);
                    }

                    config = await LIB.FS.readJSON(runConfigPath);
                    config.basedir = config.basedir || LIB.PATH.dirname(runConfigPath);

                } else {
                    config = build.config;
                    config.basedir = config.basedir || build.path;
                }

                config.buildOnly = (build.method === 'build');

                await RUNNER.run(config, {
                    LIB: LIB
                });

                return true;
            }
        }
    }

    return BuildStep;
}
