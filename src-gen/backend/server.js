// @ts-check
require('reflect-metadata');
const { performance } = require('perf_hooks');
const startupLog = (milestone) => console.debug(`Backend server: ${milestone} [${(performance.now() / 1000).toFixed(3)} s since backend process start]`);
startupLog('loading modules...');

// Erase the ELECTRON_RUN_AS_NODE variable from the environment, else Electron apps started using Theia will pick it up.
if ('ELECTRON_RUN_AS_NODE' in process.env) {
    delete process.env.ELECTRON_RUN_AS_NODE;
}

const path = require('path');
process.env.THEIA_APP_PROJECT_PATH = path.resolve(__dirname, '..', '..')
const express = require('@theia/core/shared/express');
const { Container } = require('@theia/core/shared/inversify');
const { BackendApplication, BackendApplicationServer, CliManager } = require('@theia/core/lib/node');
const { backendApplicationModule } = require('@theia/core/lib/node/backend-application-module');
const { messagingBackendModule } = require('@theia/core/lib/node/messaging/messaging-backend-module');
const { loggerBackendModule } = require('@theia/core/lib/node/logger-backend-module');

const container = new Container();
container.load(backendApplicationModule);
container.load(messagingBackendModule);
container.load(loggerBackendModule);
startupLog('container created');

function defaultServeStatic(app) {
    app.use(express.static(path.resolve(__dirname, '../../lib/frontend')))
}

function load(raw) {
    return Promise.resolve(raw).then(
        module => container.load(module.default)
    );
}

async function start(port, host, argv = process.argv) {
    if (!container.isBound(BackendApplicationServer)) {
        container.bind(BackendApplicationServer).toConstantValue({ configure: defaultServeStatic });
    }
    let result = undefined;
    await container.get(CliManager).initializeCli(argv.slice(2),
        () => {
            startupLog('resolving application');
            const application = container.get(BackendApplication);
            startupLog('application resolved');
            return application.configured;
        },
        async () => {
            result = container.get(BackendApplication).start(port, host);
        });
    if (result) {
        return result;
    } else {
        return Promise.reject(0);
    }
}

module.exports = async (port, host, argv) => {
    try {

        startupLog('modules loaded');
        return await start(port, host, argv);
    } catch (error) {
        if (typeof error !== 'number') {
            console.error('Failed to start the backend application:');
            console.error(error);
            process.exitCode = 1;
        }
        throw error;
    }
}
