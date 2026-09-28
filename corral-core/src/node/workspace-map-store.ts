import { promises as fs } from 'fs';
import { dirname } from 'path';

type MapFile = Record<string, { workspaceId: string; session: string }>;

export class WorkspaceMapStore {
    constructor(protected readonly fileOrGetter: string | (() => Promise<string>), protected readonly warn: (msg: string) => void = m => console.warn(m)) { }

    protected get file(): Promise<string> {
        return Promise.resolve(typeof this.fileOrGetter === 'string' ? this.fileOrGetter : this.fileOrGetter());
    }

    async get(projectPath: string, session: string): Promise<string | undefined> {
        const entry = (await this.read())[projectPath];
        return entry && entry.session === session ? entry.workspaceId : undefined;
    }

    async set(projectPath: string, session: string, workspaceId: string): Promise<void> {
        const map = await this.read();
        map[projectPath] = { workspaceId, session };
        const file = await this.file;
        await fs.mkdir(dirname(file), { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(map, undefined, 2));
        await fs.rename(tmp, file);
    }

    protected async read(): Promise<MapFile> {
        const file = await this.file;
        let text: string;
        try {
            text = await fs.readFile(file, 'utf8');
        } catch {
            return {};
        }
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        } catch { /* fall through */ }
        this.warn(`Corral: ignoring corrupt workspace map ${file}`);
        return {};
    }
}
