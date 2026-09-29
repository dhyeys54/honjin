// @ts-check
const { performance } = require('perf_hooks');
const startupLog = (milestone) => console.debug(`Backend main: ${milestone} [${(performance.now() / 1000).toFixed(3)} s since backend process start]`);
startupLog('entry point loaded');
const { BackendApplicationConfigProvider } = require('@theia/core/lib/node/backend-application-config-provider');
const main = require('@theia/core/lib/node/main');

BackendApplicationConfigProvider.set({
    "singleInstance": true,
    "frontendConnectionTimeout": 0,
    "configurationFolder": ".theia",
    "configureProxyFromPreferences": false
});

globalThis.extensionInfo = [];

const serverModule = require('./server');
const serverAddress = main.start(serverModule());

serverAddress.then((addressInfo) => {
    if (process && process.send && addressInfo) {
        process.send(addressInfo);
    }
});

globalThis.serverAddress = serverAddress;
