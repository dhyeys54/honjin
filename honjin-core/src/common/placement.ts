// Where editors go so they never share a tab bar with the herdr terminal (spec 02 §Editor placement guard).

export interface PlacementState {
    /** Open editor widget ids, most recent last. */
    editorIds: string[];
    herdrId?: string;
}

export interface Placement {
    mode: 'tab-after' | 'split-left';
    refId: string;
}

export function placementFor(state: PlacementState): Placement | undefined {
    const last = state.editorIds[state.editorIds.length - 1];
    if (last !== undefined) {
        return { mode: 'tab-after', refId: last };
    }
    return state.herdrId === undefined ? undefined : { mode: 'split-left', refId: state.herdrId };
}

export function needsMove(args: { widgetId: string; herdrId?: string; inHerdrGroup: boolean }): boolean {
    return args.inHerdrGroup && args.widgetId !== args.herdrId;
}

/** Open editor ids in most-recent-last order, given creation order and the one the user is working in. */
export function mostRecentLast(ids: string[], currentId: string | undefined): string[] {
    return currentId !== undefined && ids.includes(currentId) ? [...ids.filter(id => id !== currentId), currentId] : ids;
}
