// @ts-check
require('reflect-metadata');
const { Container } = require('@theia/core/shared/inversify');

module.exports = Promise.resolve().then(() => {
    const { frontendApplicationModule } = require('@theia/core/lib/browser/frontend-application-module');
    const container = new Container();
    container.load(frontendApplicationModule);

});
