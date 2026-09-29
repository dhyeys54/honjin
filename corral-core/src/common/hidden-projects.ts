/** The `corral.hiddenProjects` list after hiding or unhiding one path; never duplicates, keeps the rest as is. */
export function withHidden(list: string[], path: string, hide: boolean): string[] {
    const rest = list.filter(p => p !== path);
    return hide ? [...rest, path] : rest;
}

/** A path-list preference after dropping one path (extra projects: "Remove from list"). */
export const withoutPath = (list: string[], path: string): string[] => withHidden(list, path, false);
