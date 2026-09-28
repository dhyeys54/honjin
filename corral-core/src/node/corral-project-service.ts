import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { CorralProjectService, ProjectScanRequest, ProjectScanResult } from '../common/protocol';
import { scanProjects } from './project-scanner';

export function expandHome(p: string, home: string): string {
    return p === '~' ? home : p.startsWith('~/') ? join(home, p.slice(2)) : p;
}

const exists = (p: string) => fs.access(p).then(() => true, () => false);

export class CorralProjectServiceImpl implements CorralProjectService {
    constructor(
        protected readonly configDir: string | (() => Promise<string>),
        protected readonly warn: (msg: string) => void = m => console.warn(m),
        protected readonly home: string = homedir()
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

    /** Creates the managed workspace file if absent; the frontend syncs its roots (T1.14). */
    async ensureWorkspaceFile(): Promise<void> {
        const dir = typeof this.configDir === 'string' ? this.configDir : await this.configDir();
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
