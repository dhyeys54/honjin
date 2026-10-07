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

    set(projectPath: string, session: string, workspaceId: string): Promise<void> {
        return this.update(map => {
            map[projectPath] = { workspaceId, session };
            return true;
        });
    }

    /** Forgets the link only; the herdr workspace itself is left alone. */
    delete(projectPath: string): Promise<void> {
        return this.update(map => projectPath in map && delete map[projectPath]);
    }

    /** Read-modify-write, one at a time: two projects opening together must not lose each other's entry. */
    protected queue: Promise<unknown> = Promise.resolve();

    protected update(change: (map: MapFile) => boolean): Promise<void> {
        const run = this.queue.then(async () => {
            const map = await this.read();
            if (change(map)) {
                await this.write(map);
            }
        });
        this.queue = run.catch(() => undefined);
        return run;
    }

    protected async write(map: MapFile): Promise<void> {
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
        } catch (e) {
            // Only "no file yet" is empty. Any other failure must surface, or the next write would replace the whole map.
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
                return {};
            }
            throw e;
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
