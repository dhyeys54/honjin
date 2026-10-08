import { join } from 'path';
import { CorralSetupService } from '../common/protocol';
import { PREREQUISITES, Prerequisite, PrerequisiteStatus } from '../common/prerequisites';
import { ExecFileFn } from './herdr-cli';
import { FindBinaryOptions, findBinary } from './binary-resolver';

export interface SetupEnv {
    pathEnv: string;
    execFileFn: ExecFileFn;
    /** Where to look beyond `PATH`. The E2E leaves this out so only its fake `PATH` counts. */
    fallbacks?: { dirs: string[]; home: string; shell?: string };
}

/** Spec 13 S2, S4. Nothing is cached: a re-check right after an install must see the new binary. */
export class CorralSetupServiceImpl implements CorralSetupService {

    constructor(
        protected readonly env: SetupEnv,
        /** herdr is found the way the rest of Corral finds it, so `corral.herdr.path` counts. */
        protected readonly resolveHerdr: () => Promise<string | undefined>
    ) { }

    protected find(binary: string, extra: string[] = []): Promise<string | undefined> {
        const { pathEnv, execFileFn, fallbacks } = this.env;
        const opts: FindBinaryOptions = fallbacks
            ? {
                pathEnv, execFileFn, shell: fallbacks.shell,
                candidates: [...fallbacks.dirs.map(d => join(d, binary)), ...extra.map(p => p.replace(/^~(?=\/)/, fallbacks.home))]
            }
            : { pathEnv, execFileFn, candidates: [] };
        return findBinary(binary, opts);
    }

    /** First non-empty line of `--version`, or '' when the binary won't say. */
    protected async version(path: string): Promise<string> {
        try {
            const { stdout } = await this.env.execFileFn(path, ['--version'], { timeoutMs: 5000 });
            return stdout.split('\n').map(l => l.trim()).find(Boolean) ?? '';
        } catch {
            return '';
        }
    }

    protected async locate(p: Prerequisite): Promise<string | undefined> {
        if (p.id === 'herdr') {
            return this.resolveHerdr();
        }
        const path = await this.find(p.binary, p.extraCandidates);
        // macOS ships /usr/bin/git as a stub that opens an install dialog when run without the command line tools.
        if (path === '/usr/bin/git') {
            const { exitCode } = await this.env.execFileFn('/usr/bin/xcode-select', ['-p'], { timeoutMs: 5000 }).catch(() => ({ exitCode: 1 }));
            return exitCode === 0 ? path : undefined;
        }
        return path;
    }

    async check(): Promise<PrerequisiteStatus[]> {
        const [brew, npm] = await Promise.all([this.find('brew'), this.find('npm')]);
        return Promise.all(PREREQUISITES.map(async (p): Promise<PrerequisiteStatus> => {
            const path = await this.locate(p);
            if (path) {
                return { id: p.id, found: true, path, version: await this.version(path) };
            }
            const install = p.install({ brew: !!brew, npm: !!npm });
            return { id: p.id, found: false, version: '', ...(install === undefined ? {} : { install }) };
        }));
    }
}
