import { promises as fs } from 'fs';
import { homedir } from 'os';
import { execFile } from 'child_process';
import { join } from 'path';
import { promisify } from 'util';
import { CorralProjectService, ProjectScanRequest, ProjectScanResult } from '../common/protocol';
import { scanProjects } from './project-scanner';

export function expandHome(p: string, home: string): string {
    return p === '~' ? home : p.startsWith('~/') ? join(home, p.slice(2)) : p;
}

/** macOS Finder; argv only, so paths with spaces, quotes or `$` are safe. */
const revealInFinder = (path: string) => promisify(execFile)('open', ['-R', path]).then(() => undefined);

const exists = (p: string) => fs.access(p).then(() => true, () => false);

export class CorralProjectServiceImpl implements CorralProjectService {
    constructor(
        protected readonly configDir: string | (() => Promise<string>),
        protected readonly warn: (msg: string) => void = m => console.warn(m),
        protected readonly home: string = homedir(),
        protected readonly opener: (path: string) => Promise<void> = revealInFinder
    ) { }

    protected ensured?: Promise<void>;

    async list(req: ProjectScanRequest): Promise<ProjectScanResult> {
        // The frontend lists on startup, so this creates the workspace file before anything opens it.
        await (this.ensured ??= this.ensureWorkspaceFile());
        const scanned = await scanProjects(req.scanRoots.map(r => expandHome(r, this.home)), this.warn);
        const missing: string[] = [];
        for (const entry of [...req.extra, ...req.hidden]) {
            if (!missing.includes(entry) && !(await exists(expandHome(entry, this.home)))) {
                missing.push(entry);
            }
        }
        return { scanned, missing };
    }

    reveal(path: string): Promise<void> {
        return this.opener(path);
    }

    async workspaceFile(): Promise<string> {
        await (this.ensured ??= this.ensureWorkspaceFile());
        return join(await this.dir(), 'corral.code-workspace');
    }

    protected dir(): Promise<string> {
        return typeof this.configDir === 'string' ? Promise.resolve(this.configDir) : this.configDir();
    }

    /** Creates the managed workspace file if absent; the frontend syncs its roots. */
    async ensureWorkspaceFile(): Promise<void> {
        const dir = await this.dir();
        await fs.mkdir(dir, { recursive: true });
        try {
            await fs.writeFile(join(dir, 'corral.code-workspace'), JSON.stringify({ folders: [], settings: {} }), { flag: 'wx' });
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw e;
            }
        }
    }
}
