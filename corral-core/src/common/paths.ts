/** Drops trailing slashes (the backend has already expanded `~`); a bare `/` stays. */
export const trimSlash = (path: string): string => path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;

/** True when `path` is strictly below `folder`, on a path boundary (`/w/ab` is not inside `/w/a`). */
export function isInside(path: string, folder: string): boolean {
    const dir = trimSlash(folder);
    return path !== dir && path.startsWith(dir === '/' ? '/' : dir + '/');
}
