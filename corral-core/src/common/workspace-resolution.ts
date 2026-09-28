export type WorkspaceResolution = { kind: 'reuse'; workspaceId: string } | { kind: 'create' };

/** Reuse only a workspace Corral mapped itself and that still exists; never adopt by label. */
export function resolveWorkspace(mappedId: string | undefined, exists: boolean): WorkspaceResolution {
    return mappedId !== undefined && exists ? { kind: 'reuse', workspaceId: mappedId } : { kind: 'create' };
}
