import { accessSync, constants, statSync } from 'fs';
import { delimiter, isAbsolute, join } from 'path';
import { ExecFileFn } from './herdr-cli';

export interface HerdrBinaryResolverOptions {
    /** The `PATH` string to search; the real one is minimal when launched from Finder. */
    pathEnv: string;
    candidates: string[];
    shell: string;
    execFileFn: ExecFileFn;
}

function isExecutable(path: string): boolean {
    try {
        accessSync(path, constants.X_OK);
        return statSync(path).isFile();
    } catch {
        return false;
    }
}

/** Resolves the herdr binary (spec 04 §Resolving the binary), caching per configured value. */
export class HerdrBinaryResolver {
    protected readonly cache = new Map<string, string | undefined>();

    constructor(protected readonly opts: HerdrBinaryResolverOptions) { }

    async resolve(configured: string): Promise<string | undefined> {
        if (!this.cache.has(configured)) {
            this.cache.set(configured, await this.lookup(configured));
        }
        return this.cache.get(configured);
    }

    protected async lookup(configured: string): Promise<string | undefined> {
        if (isAbsolute(configured) && isExecutable(configured)) {
            return configured;
        }
        if (!isAbsolute(configured)) {
            for (const dir of this.opts.pathEnv.split(delimiter).filter(Boolean)) {
                const candidate = join(dir, configured);
                if (isExecutable(candidate)) {
                    return candidate;
                }
            }
        }
        const local = this.opts.candidates.find(isExecutable);
        if (local) {
            return local;
        }
        // The one allowed shell use: a fixed script, no user input (AGENTS.md §Hard rules).
        try {
            const { stdout, exitCode } = await this.opts.execFileFn(this.opts.shell, ['-lc', 'command -v herdr'], { timeoutMs: 3000 });
            const found = stdout.trim().split('\n').pop() ?? '';
            return exitCode === 0 && isAbsolute(found) && isExecutable(found) ? found : undefined;
        } catch {
            return undefined;
        }
    }
}
