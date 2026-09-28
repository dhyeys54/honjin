import { promises as fs } from 'fs';
import { join } from 'path';

/** Immediate subdirectories of each root (spec 03 §Discovery), realpath'd and de-duplicated. */
export async function scanProjects(roots: string[], warn: (msg: string) => void): Promise<string[]> {
    const found = new Set<string>();
    for (const root of roots) {
        let entries: string[];
        try {
            entries = await fs.readdir(root);
        } catch (e) {
            warn(`Corral: cannot read scan root ${root}: ${(e as Error).message}`);
            continue;
        }
        for (const name of entries.sort()) {
            if (name.startsWith('.') || name === 'node_modules') {
                continue;
            }
            try {
                const real = await fs.realpath(join(root, name));
                if ((await fs.stat(real)).isDirectory()) {
                    found.add(real);
                }
            } catch { /* broken symlink or vanished entry: not a project */ }
        }
    }
    return [...found].sort();
}
