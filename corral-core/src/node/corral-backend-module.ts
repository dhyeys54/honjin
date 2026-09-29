import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { CORRAL_HERDR_PATH, CORRAL_PROJECTS_PATH, CorralHerdrService, CorralProjectService, HerdrError } from '../common/protocol';
import { CorralHerdrServiceImpl } from './corral-herdr-service';
import { CorralProjectServiceImpl } from './corral-project-service';
import { defaultExecFile, HerdrCli } from './herdr-cli';
import { HerdrBinaryResolver } from './herdr-binary';
import { WorkspaceMapStore } from './workspace-map-store';

async function readSettings(configDir: string): Promise<Record<string, unknown>> {
    try {
        return JSON.parse(await fs.readFile(join(configDir, 'settings.json'), 'utf8'));
    } catch {
        return {};
    }
}

export default new ContainerModule(bind => {
    bind(CorralHerdrService).toDynamicValue(ctx => {
        const env = ctx.container.get<EnvVariablesServer>(EnvVariablesServer);
        const resolver = new HerdrBinaryResolver({
            pathEnv: process.env.PATH ?? '',
            candidates: ['/opt/homebrew/bin/herdr', '/usr/local/bin/herdr', join(homedir(), '.local/bin/herdr')],
            shell: process.env.SHELL || '/bin/zsh',
            execFileFn: defaultExecFile
        });
        // Re-read settings per call so a preference change applies without a restart.
        const resolveBinary = async () => {
            const configDir = fileURLToPath(await env.getConfigDirUri());
            const settings = await readSettings(configDir);
            const binary = await resolver.resolve(String(settings['corral.herdr.path'] || 'herdr'));
            const session = process.env.CORRAL_HERDR_SESSION || String(settings['corral.herdr.session'] || '');
            return { binary, session };
        };
        const getClient = async () => {
            const { binary, session } = await resolveBinary();
            if (!binary) {
                throw new HerdrError('not_found', 'herdr binary not found');
            }
            return { cli: new HerdrCli({ binary, session: session || undefined }), session };
        };
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
});
