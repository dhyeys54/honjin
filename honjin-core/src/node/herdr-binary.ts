import { isAbsolute } from 'path';
import { ExecFileFn } from './herdr-cli';
import { findBinary, isExecutable } from './binary-resolver';

export interface HerdrBinaryResolverOptions {
    /** The `PATH` string to search; the real one is minimal when launched from Finder. */
    pathEnv: string;
    candidates: string[];
    /** The login shell for the last-resort lookup; omitted, there is none. */
    shell?: string;
    execFileFn: ExecFileFn;
}

/** Resolves the herdr binary (spec 04 §Resolving the binary), caching each hit per configured value; a miss, or a hit that has since gone, is looked up again. */
export class HerdrBinaryResolver {
    protected readonly cache = new Map<string, string>();

    constructor(protected readonly opts: HerdrBinaryResolverOptions) { }

    async resolve(configured: string): Promise<string | undefined> {
        const hit = this.cache.get(configured);
        if (hit !== undefined && isExecutable(hit)) {
            return hit;
        }
        const found = await this.lookup(configured);
        if (found !== undefined) {
            this.cache.set(configured, found);
        }
        return found;
    }

    protected async lookup(configured: string): Promise<string | undefined> {
        if (isAbsolute(configured)) {
            return isExecutable(configured) ? configured : findBinary('herdr', this.opts, undefined);
        }
        return findBinary('herdr', this.opts, configured);
    }
}
