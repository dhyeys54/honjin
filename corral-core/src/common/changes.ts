import { owningProject } from './startup-command';
import { trimSlash } from './paths';
import { pickChanges } from './scm-change';

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

/** C1–C7: the listed changes of the visible projects, in root order, with the live flags. */
export function groupChanges(roots: string[], changes: ChangeInput[], writes: ReadonlyMap<string, number>, now: number): ChangeGroup[] {
    // C4: pickChange owns the "working tree beats index" order, so a file in two groups is one row.
    const byGroup = new Map<string, { id: string, resources: (ChangeInput & { sourceUri: string })[] }>();
    for (const change of changes) {
        const group = byGroup.get(change.group) ?? { id: change.group, resources: [] };
        group.resources.push({ ...change, sourceUri: change.path });
        byGroup.set(change.group, group);
    }
    const winners = pickChanges([...byGroup.values()]).values();

    const perProject = new Map<string, ChangeFile[]>();
    for (const winner of winners) {
        const project = owningProject(winner.path, roots);
        if (project === undefined) {
            continue;
        }
        const letter = winner.letter ?? 'M';
        const written = writes.get(winner.path);
        const files = perProject.get(project) ?? [];
        files.push({
            path: winner.path,
            rel: winner.path.slice(trimSlash(project).length).replace(/^\//, ''),
            letter,
            kind: changeKind(letter, winner.strikeThrough),
            live: written !== undefined && now - written < LIVE_MS
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
    for (const group of groups) {
        for (const file of group.files.filter(f => f.live)) {
            let dir = file.path;
            while (dir.length > group.project.length) {
                dir = dir.slice(0, dir.lastIndexOf('/'));
                if (dir.length >= group.project.length) {
                    folders.add(dir);
                }
            }
            folders.add(group.project);
        }
    }
    return folders;
}

/** When the next live mark runs out, so the view can re-render then (C8). */
export function nextExpiry(writes: ReadonlyMap<string, number>, now: number): number | undefined {
    let next: number | undefined;
    for (const written of writes.values()) {
        const at = written + LIVE_MS;
        if (at > now && (next === undefined || at < next)) {
            next = at;
        }
    }
    return next;
}

/** True when a recompute changed nothing a view shows, so it need not re-render. */
export const sameGroups = (a: ChangeGroup[], b: ChangeGroup[]) => JSON.stringify(a) === JSON.stringify(b);
