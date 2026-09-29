/** The `corral.hiddenProjects` list after hiding or unhiding one path; never duplicates, keeps the rest as is. */
export function withHidden(list: string[], path: string, hide: boolean): string[] {
    const rest = list.filter(p => p !== path);
    return hide ? [...rest, path] : rest;
}
