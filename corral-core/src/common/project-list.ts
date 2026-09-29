export interface ProjectListInput {
    /** Absolute dirs found under scan roots (backend). */
    scanned: string[];
    /** corral.extraProjects */
    extra: string[];
    /** corral.hiddenProjects */
    hidden: string[];
    /** View toggle state. */
    showHidden: boolean;
    /** Paths that no longer exist (backend). */
    missing: string[];
}

export interface ProjectEntry {
    path: string;
    name: string;
    hidden: boolean;
    missing: boolean;
    manual: boolean;
}

/** Drops trailing slashes (the backend has already expanded `~`); a bare `/` stays. */
function normalise(path: string): string {
    return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}

function lastSegment(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
}

function parentName(path: string): string {
    return lastSegment(path.slice(0, Math.max(path.lastIndexOf('/'), 0)));
}

export function buildProjectList(input: ProjectListInput): ProjectEntry[] {
    const extra = new Set(input.extra.map(normalise));
    const hidden = new Set(input.hidden.map(normalise));
    const missing = new Set(input.missing.map(normalise));
    const all = new Set([...input.scanned.map(normalise), ...extra]);
    // Missing entries come from extra ∪ hidden, so they may not be in `all` yet (rule 4).
    missing.forEach(p => all.add(p));

    const baseNames = new Map<string, number>();
    all.forEach(p => baseNames.set(lastSegment(p), (baseNames.get(lastSegment(p)) ?? 0) + 1));

    const entries: ProjectEntry[] = [];
    all.forEach(path => {
        const isMissing = missing.has(path);
        const isHidden = hidden.has(path);
        if (isHidden && !input.showHidden && !isMissing) {
            return;
        }
        const base = lastSegment(path);
        entries.push({
            path,
            name: baseNames.get(base)! > 1 ? `${base} — ${parentName(path)}` : base,
            hidden: isHidden,
            missing: isMissing,
            manual: extra.has(path)
        });
    });
    return entries.sort((a, b) => {
        const byName = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        return byName || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    });
}

function isInside(path: string, folder: string): boolean {
    return path.startsWith(folder === '/' ? '/' : folder + '/') && path !== folder;
}

/**
 * Projects that become Theia workspace roots. A folder that holds other projects (a scan root added by mistake) is
 * left out: as a root it would pull every project under it, hidden ones included, into the watcher, git and search.
 */
export function visibleRoots(list: ProjectEntry[]): string[] {
    return list
        .filter(e => !e.hidden && !e.missing && !list.some(o => isInside(o.path, e.path)))
        .map(e => e.path);
}

/** Why a folder can't be added as a project, or undefined when it can. */
export function addProblem(folder: string, list: ProjectEntry[]): string | undefined {
    const path = normalise(folder);
    const name = lastSegment(path) || path;
    if (list.some(e => e.path === path)) {
        return `${name} is already in the list.`;
    }
    const inner = list.filter(e => isInside(e.path, path));
    if (inner.length) {
        const shown = inner.slice(0, 3).map(e => lastSegment(e.path)).join(', ') + (inner.length > 3 ? ', …' : '');
        return `${name} holds ${inner.length} listed projects (${shown}). Add a single project folder instead.`;
    }
    const outer = list.find(e => isInside(path, e.path));
    return outer ? `${name} is inside the project ${lastSegment(outer.path)}.` : undefined;
}
