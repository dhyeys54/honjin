import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { existsSync } from 'fs';
import { cpus, homedir, totalmem } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
    CORRAL_AGENTS_PATH, CORRAL_HERDR_PATH, CORRAL_PROJECTS_PATH, CORRAL_RESOURCES_PATH, CorralAgentService, CorralHerdrService, CorralProjectService, CorralResourceService, HerdrError
} from '../common/protocol';
import { CorralHerdrServiceImpl } from './corral-herdr-service';
import { CorralProjectServiceImpl } from './corral-project-service';
import { CorralAgentServiceImpl } from './corral-agent-service';
import { CorralResourceServiceImpl } from './corral-resource-service';
import { defaultExecFile, HerdrCli } from './herdr-cli';
import { HerdrBinaryResolver } from './herdr-binary';
import { readSettings } from './read-settings';
import { CorralPreferenceKeys } from '../common/preferences-schema';
import { WorkspaceMapStore } from './workspace-map-store';
import { FileSearchService } from '@theia/file-search/lib/common/file-search-service';
import { RootNameFileSearchService } from './root-name-file-search-service';

// The packaged app carries the built-in extensions in Resources/plugins (electron-app/electron-builder.yml).
// Theia only looks there when told, and the .app has no start script to pass --plugins.
const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
const packagedPlugins = join(resourcesPath ?? '', 'plugins');
if (!process.env.THEIA_DEFAULT_PLUGINS && resourcesPath && existsSync(packagedPlugins)) {
    process.env.THEIA_DEFAULT_PLUGINS = `local-dir:${packagedPlugins}`;
}

/** How to find herdr: the binary and session are re-read from settings per call, so a preference change applies without a restart. */
function createHerdrAccess(env: EnvVariablesServer) {
    const resolver = new HerdrBinaryResolver({
        pathEnv: process.env.PATH ?? '',
        candidates: [join(homedir(), '.local/bin/herdr'), '/opt/homebrew/bin/herdr', '/usr/local/bin/herdr'],
        shell: process.env.SHELL || '/bin/zsh',
        execFileFn: defaultExecFile
    });
    const resolveBinary = async () => {
        const configDir = fileURLToPath(await env.getConfigDirUri());
        const settings = await readSettings(configDir);
        const binary = await resolver.resolve(String(settings[CorralPreferenceKeys.herdrPath] || 'herdr'));
        const session = process.env.CORRAL_HERDR_SESSION || String(settings[CorralPreferenceKeys.herdrSession] || '');
        return { binary, session };
    };
    const getClient = async () => {
        const { binary, session } = await resolveBinary();
        if (!binary) {
            throw new HerdrError('not_found', 'herdr binary not found');
        }
        return { cli: new HerdrCli({ binary, session: session || undefined }), session };
    };
    return { resolveBinary, getClient };
}

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(FileSearchService).to(RootNameFileSearchService).inSingletonScope();

    let herdrAccess: ReturnType<typeof createHerdrAccess> | undefined;
    const access = (env: EnvVariablesServer) => herdrAccess ??= createHerdrAccess(env);

    bind(CorralHerdrService).toDynamicValue(ctx => {
        const env = ctx.container.get<EnvVariablesServer>(EnvVariablesServer);
        const { resolveBinary, getClient } = access(env);
        const store = new WorkspaceMapStore(async () => join(fileURLToPath(await env.getConfigDirUri()), 'herdr-workspaces.json'));
        return new CorralHerdrServiceImpl(getClient, store, resolveBinary);
    }).inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(CORRAL_HERDR_PATH, () => ctx.container.get<CorralHerdrService>(CorralHerdrService))
    ).inSingletonScope();

    bind(CorralProjectService).toDynamicValue(ctx => {
        const env = ctx.container.get<EnvVariablesServer>(EnvVariablesServer);
        return new CorralProjectServiceImpl(async () => fileURLToPath(await env.getConfigDirUri()));
    }).inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(CORRAL_PROJECTS_PATH, () => ctx.container.get<CorralProjectService>(CorralProjectService))
    ).inSingletonScope();

    bind(CorralResourceService).toDynamicValue(ctx => {
        const { getClient } = access(ctx.container.get<EnvVariablesServer>(EnvVariablesServer));
        // Electron forks the backend from its main process, so the Corral tree is rooted at the parent (spec 10 R1).
        const corralRoot = process.env.THEIA_ELECTRON_VERSION ? process.ppid : process.pid;
        return new CorralResourceServiceImpl(async () => (await getClient()).cli, defaultExecFile, corralRoot, cpus().length, totalmem());
    }).inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(CORRAL_RESOURCES_PATH, () => ctx.container.get<CorralResourceService>(CorralResourceService))
    ).inSingletonScope();

    bind(CorralAgentService).toDynamicValue(ctx => {
        const { getClient } = access(ctx.container.get<EnvVariablesServer>(EnvVariablesServer));
        return new CorralAgentServiceImpl(async () => (await getClient()).cli);
    }).inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(CORRAL_AGENTS_PATH, () => ctx.container.get<CorralAgentService>(CorralAgentService))
    ).inSingletonScope();
});
