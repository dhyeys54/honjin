/** Group ids of the built-in git extension. A file can be both staged and modified; the working tree is newest. */
const INDEX_GROUP = 'index';

/** The SCM change to open for a file (spec 02, "Changes"), or undefined when the file has no change. */
export function pickChange<R extends { sourceUri: string }>(
    groups: { id: string, resources: R[] }[], uri: string
): R | undefined {
    const ordered = [...groups.filter(g => g.id !== INDEX_GROUP), ...groups.filter(g => g.id === INDEX_GROUP)];
    for (const g of ordered) {
        const hit = g.resources.find(r => r.sourceUri === uri);
        if (hit) {
            return hit;
        }
    }
    return undefined;
}
