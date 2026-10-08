/** Drops trailing slashes (the backend has already expanded `~`); a bare `/` stays. */
export const trimSlash = (path: string): string => path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;

/** True when `path` is strictly below `folder`, on a path boundary (`/w/ab` is not inside `/w/a`). */
export function isInside(path: string, folder: string): boolean {
    const dir = trimSlash(folder);
    return path !== dir && path.startsWith(dir === '/' ? '/' : dir + '/');
}

/** The last path segment (`/a/b/` and `/a/b` both give `b`). */
export const basename = (path: string): string => trimSlash(path).split('/').pop() ?? '';

/** The longest project equal to `folderPath` or a path-boundary prefix of it. */
export function owningProject(folderPath: string, projects: string[]): string | undefined {
    let best: string | undefined;
    for (const project of projects) {
        const owns = folderPath === project || isInside(folderPath, project);
        if (owns && (best === undefined || project.length > best.length)) {
            best = project;
        }
    }
    return best;
}
