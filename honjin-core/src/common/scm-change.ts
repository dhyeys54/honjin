/** Group ids of the built-in git extension. A file can be both staged and modified; the working tree is newest. */
const INDEX_GROUP = 'index';

type Groups<R> = { id: string, resources: R[] }[];

const newestFirst = <R>(groups: Groups<R>) => [...groups.filter(g => g.id !== INDEX_GROUP), ...groups.filter(g => g.id === INDEX_GROUP)];

/** The SCM change to open for each changed file (spec 02, "Changes"), keyed by `sourceUri`. */
export function pickChanges<R extends { sourceUri: string }>(groups: Groups<R>): Map<string, R> {
    const picked = new Map<string, R>();
    for (const g of newestFirst(groups)) {
        for (const r of g.resources) {
            if (!picked.has(r.sourceUri)) {
                picked.set(r.sourceUri, r);
            }
        }
    }
    return picked;
}
