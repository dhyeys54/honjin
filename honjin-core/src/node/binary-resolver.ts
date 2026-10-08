import { accessSync, constants, statSync } from 'fs';
import { homedir } from 'os';
import { delimiter, isAbsolute, join } from 'path';
import { ExecFileFn } from './herdr-cli';

export interface FindBinaryOptions {
    /** The `PATH` string to search; the real one is minimal when launched from Finder. */
    pathEnv: string;
    candidates: string[];
    /** The login shell for the last-resort lookup; omitted, there is none. */
    shell?: string;
    execFileFn: ExecFileFn;
}

/** Where installers put binaries that a Finder-launched app's `PATH` misses (spec 04). */
export const FALLBACK_DIRS = [join(homedir(), '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin'];

export function isExecutable(path: string): boolean {
    try {
        accessSync(path, constants.X_OK);
        return statSync(path).isFile();
    } catch {
        return false;
    }
}

/**
 * Spec 04 §Resolving the binary, for any binary (spec 13 S2): `PATH`, then the candidates, then the login shell.
 * `pathName` is what to look for on `PATH` (`undefined` skips it); `name` is what the shell is asked for.
 */
export async function findBinary(name: string, opts: FindBinaryOptions, pathName: string | undefined = name): Promise<string | undefined> {
    if (pathName !== undefined) {
        for (const dir of opts.pathEnv.split(delimiter).filter(Boolean)) {
            const candidate = join(dir, pathName);
            if (isExecutable(candidate)) {
                return candidate;
            }
        }
    }
    const hit = opts.candidates.find(isExecutable);
    if (hit) {
        return hit;
    }
    // The allowed shell use (D44): a fixed script whose only variable is a catalog constant, re-checked here.
    if (!opts.shell || !/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
        return undefined;
    }
    try {
        const { stdout, exitCode } = await opts.execFileFn(opts.shell, ['-lc', `command -v ${name}`], { timeoutMs: 3000 });
        const found = stdout.trim().split('\n').pop() ?? '';
        return exitCode === 0 && isAbsolute(found) && isExecutable(found) ? found : undefined;
    } catch {
        return undefined;
    }
}
