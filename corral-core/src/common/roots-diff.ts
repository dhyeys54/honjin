const normalise = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') || '/' : p);

/** What to add to and remove from the workspace so it holds exactly `desired`; never a reset. */
export function diffRoots(current: string[], desired: string[]): { add: string[]; remove: string[] } {
    const have = new Set(current.map(normalise));
    const want = new Set(desired.map(normalise));
    return {
        add: [...want].filter(p => !have.has(p)),
        remove: [...have].filter(p => !want.has(p))
    };
}
