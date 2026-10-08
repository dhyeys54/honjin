export interface FirstRunState {
    firstRunCompleted: boolean;
    scanRoots: string[];
    extraProjects: string[];
}

export function shouldRunFirstRun(state: FirstRunState): boolean {
    return !state.firstRunCompleted && state.scanRoots.length === 0 && state.extraProjects.length === 0;
}

/** `/Users/a/p` → `~/p`; only a real path-boundary prefix counts. */
export function abbreviateHome(path: string, home: string): string {
    if (path === home) {
        return '~';
    }
    return path.startsWith(home + '/') ? '~' + path.slice(home.length) : path;
}

/** Spec 13 S7: the + hint follows a wait for setup or a first run, and only once an agent can actually start. */
export function showPlusHint(s: { waited: boolean; firstRun: boolean; ready: boolean }): boolean {
    return s.ready && (s.waited || s.firstRun);
}
