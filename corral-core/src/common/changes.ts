import { owningProject } from './startup-command';
import { pickChange } from './scm-change';

/** How long a written file counts as "being changed now" (spec 09 C7). */
export const LIVE_MS = 30_000;

export type ChangeKind = 'modified' | 'added' | 'deleted' | 'conflict';
export interface ChangeInput { path: string; group: string; letter?: string; strikeThrough?: boolean }
export interface ChangeFile { path: string; rel: string; letter: string; kind: ChangeKind; live: boolean }
export interface ChangeGroup { project: string; name: string; files: ChangeFile[]; live: boolean }

export function changeKind(letter: string, strikeThrough?: boolean): ChangeKind {
    if (strikeThrough || letter === 'D') {
        return 'deleted';
    }
    if (letter === 'A' || letter === 'U') {
        return 'added';
    }
    return letter === '!' ? 'conflict' : 'modified';
}

const trimSlash = (p: string) => p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;

/** C1–C7: the listed changes of the visible projects, in root order, with the live flags. */
export function groupChanges(roots: string[], changes: ChangeInput[], writes: ReadonlyMap<string, number>,
    now: number, liveMs = LIVE_MS): ChangeGroup[] {
    // C4: pickChange owns the "working tree beats index" order, so a file in two groups is one row.
    const byGroup = new Map<string, { id: string, resources: (ChangeInput & { sourceUri: string })[] }>();
    for (const c of changes) {
        const g = byGroup.get(c.group) ?? { id: c.group, resources: [] };
        g.resources.push({ ...c, sourceUri: c.path });
        byGroup.set(c.group, g);
    }
    const groups = [...byGroup.values()];
    const winners = [...new Set(changes.map(c => c.path))].map(p => pickChange(groups, p)!);

    const perProject = new Map<string, ChangeFile[]>();
    for (const w of winners) {
        const project = owningProject(w.path, roots);
        if (project === undefined) {
            continue;
        }
        const letter = w.letter ?? 'M';
        const written = writes.get(w.path);
        const files = perProject.get(project) ?? [];
        files.push({
            path: w.path,
            rel: w.path.slice(trimSlash(project).length).replace(/^\//, ''),
            letter,
            kind: changeKind(letter, w.strikeThrough),
            live: written !== undefined && now - written < liveMs
        });
        perProject.set(project, files);
    }
    return roots.filter(r => perProject.has(r)).map(project => {
        const files = perProject.get(project)!.sort((a, b) => a.rel.localeCompare(b.rel));
        return { project, name: trimSlash(project).split('/').pop() || project, files, live: files.some(f => f.live) };
    });
}

/** Every folder that contains a live file, up to and including its project. */
export function liveFolders(groups: ChangeGroup[]): Set<string> {
    const folders = new Set<string>();
    for (const g of groups) {
        for (const f of g.files.filter(f => f.live)) {
            let dir = f.path;
            while (dir.length > g.project.length) {
                dir = dir.slice(0, dir.lastIndexOf('/'));
                if (dir.length >= g.project.length) {
                    folders.add(dir);
                }
            }
            folders.add(g.project);
        }
    }
    return folders;
}

/** When the next live mark runs out, so the view can re-render then (C8). */
export function nextExpiry(writes: ReadonlyMap<string, number>, now: number, liveMs = LIVE_MS): number | undefined {
    let next: number | undefined;
    for (const w of writes.values()) {
        const at = w + liveMs;
        if (at > now && (next === undefined || at < next)) {
            next = at;
        }
    }
    return next;
}
