import { trimSlash } from './paths';

/** What to add to and remove from the workspace so it holds exactly `desired`; never a reset. */
export function diffRoots(current: string[], desired: string[]): { add: string[]; remove: string[] } {
    const have = new Set(current.map(trimSlash));
    const want = new Set(desired.map(trimSlash));
    return {
        add: [...want].filter(p => !have.has(p)),
        remove: [...have].filter(p => !want.has(p))
    };
}
