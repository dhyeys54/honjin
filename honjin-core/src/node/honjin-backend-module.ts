import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { existsSync } from 'fs';
import { cpus, homedir, totalmem } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
    HONJIN_AGENTS_PATH, HONJIN_HERDR_PATH, HONJIN_PROJECTS_PATH, HONJIN_RESOURCES_PATH, HONJIN_SETUP_PATH,
    HonjinAgentService, HonjinHerdrService, HonjinProjectService, HonjinResourceService, HonjinSetupService, HerdrError
} from '../common/protocol';
import { HonjinHerdrServiceImpl } from './honjin-herdr-service';
import { HonjinProjectServiceImpl } from './honjin-project-service';
import { HonjinAgentServiceImpl } from './honjin-agent-service';
import { HonjinResourceServiceImpl } from './honjin-resource-service';
import { defaultExecFile, HerdrCli } from './herdr-cli';
import { HerdrBinaryResolver } from './herdr-binary';
import { FALLBACK_DIRS } from './binary-resolver';
import { HonjinSetupServiceImpl } from './honjin-setup-service';
import { readSettings } from './read-settings';
import { HonjinPreferenceKeys } from '../common/preferences-schema';
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
    // The E2E sets HONJIN_TEST_PATH to choose exactly which tools exist (spec 13 S2), herdr included.
    const testPath = process.env.HONJIN_TEST_PATH;
    const resolver = new HerdrBinaryResolver(testPath === undefined ? {
        pathEnv: process.env.PATH ?? '',
        candidates: FALLBACK_DIRS.map(d => join(d, 'herdr')),
        shell: process.env.SHELL || '/bin/zsh',
        execFileFn: defaultExecFile
    } : { pathEnv: testPath, candidates: [], execFileFn: defaultExecFile });
    const resolveBinary = async () => {
        const configDir = fileURLToPath(await env.getConfigDirUri());
        const settings = await readSettings(configDir);
        const binary = await resolver.resolve(String(settings[HonjinPreferenceKeys.herdrPath] || 'herdr'));
        const session = process.env.HONJIN_HERDR_SESSION || String(settings[HonjinPreferenceKeys.herdrSession] || '');
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

    bind(HonjinHerdrService).toDynamicValue(ctx => {
        const env = ctx.container.get<EnvVariablesServer>(EnvVariablesServer);
        const { resolveBinary, getClient } = access(env);
        const store = new WorkspaceMapStore(async () => join(fileURLToPath(await env.getConfigDirUri()), 'herdr-workspaces.json'));
        return new HonjinHerdrServiceImpl(getClient, store, resolveBinary);
    }).inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(HONJIN_HERDR_PATH, () => ctx.container.get<HonjinHerdrService>(HonjinHerdrService))
    ).inSingletonScope();

    bind(HonjinProjectService).toDynamicValue(ctx => {
        const env = ctx.container.get<EnvVariablesServer>(EnvVariablesServer);
        return new HonjinProjectServiceImpl(async () => fileURLToPath(await env.getConfigDirUri()));
    }).inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(HONJIN_PROJECTS_PATH, () => ctx.container.get<HonjinProjectService>(HonjinProjectService))
    ).inSingletonScope();

    bind(HonjinResourceService).toDynamicValue(ctx => {
        const { getClient } = access(ctx.container.get<EnvVariablesServer>(EnvVariablesServer));
        // Electron forks the backend from its main process, so the Honjin tree is rooted at the parent (spec 10 R1).
        const honjinRoot = process.env.THEIA_ELECTRON_VERSION ? process.ppid : process.pid;
        return new HonjinResourceServiceImpl(async () => (await getClient()).cli, defaultExecFile, honjinRoot, cpus().length, totalmem());
    }).inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(HONJIN_RESOURCES_PATH, () => ctx.container.get<HonjinResourceService>(HonjinResourceService))
    ).inSingletonScope();

    bind(HonjinAgentService).toDynamicValue(ctx => {
        const { getClient } = access(ctx.container.get<EnvVariablesServer>(EnvVariablesServer));
        return new HonjinAgentServiceImpl(async () => (await getClient()).cli);
    }).inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(HONJIN_AGENTS_PATH, () => ctx.container.get<HonjinAgentService>(HonjinAgentService))
    ).inSingletonScope();

    bind(HonjinSetupService).toDynamicValue(ctx => {
        const { resolveBinary } = access(ctx.container.get<EnvVariablesServer>(EnvVariablesServer));
        // The E2E sets HONJIN_TEST_PATH to choose exactly which tools exist, so nothing beyond it may be searched.
        const testPath = process.env.HONJIN_TEST_PATH;
        return new HonjinSetupServiceImpl({
            pathEnv: testPath ?? process.env.PATH ?? '',
            execFileFn: defaultExecFile,
            fallbacks: testPath === undefined ? { dirs: FALLBACK_DIRS, home: homedir(), shell: process.env.SHELL || '/bin/zsh' } : undefined
        }, async () => (await resolveBinary()).binary);
    }).inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(HONJIN_SETUP_PATH, () => ctx.container.get<HonjinSetupService>(HonjinSetupService))
    ).inSingletonScope();
});
