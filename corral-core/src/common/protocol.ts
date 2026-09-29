// RPC contract between the frontend widgets and the Node backend (spec 00 §Components).

export const CORRAL_PROJECTS_PATH = '/services/corral-projects';
export const CORRAL_HERDR_PATH = '/services/corral-herdr';

export const CorralProjectService = Symbol('CorralProjectService');
export interface ProjectScanRequest {
    scanRoots: string[];
    extra: string[];
    hidden: string[];
}
export interface ProjectScanResult {
    /** Absolute project dirs found under the scan roots. */
    scanned: string[];
    /** Entries of extra ∪ hidden that no longer exist. */
    missing: string[];
}
export interface CorralProjectService {
    list(request: ProjectScanRequest): Promise<ProjectScanResult>;
    /** Absolute path of the managed `corral.code-workspace`; created if missing. */
    workspaceFile(): Promise<string>;
    /** Shows the path in the OS file manager (Finder). */
    reveal(path: string): Promise<void>;
}

export const CorralHerdrService = Symbol('CorralHerdrService');
export interface OpenTabRequest {
    projectPath: string;
    folderPath: string;
    /** May be empty: then the tab is a plain shell. */
    command: string;
}
export interface OpenTabResult {
    workspaceId: string;
    tabId: string;
    paneId: string;
    createdWorkspace: boolean;
}
export interface HerdrStatus {
    running: boolean;
}
export interface CorralHerdrService {
    status(): Promise<HerdrStatus>;
    openTab(request: OpenTabRequest): Promise<OpenTabResult>;
    /** The herdr binary to launch in the terminal (undefined if not found) and the effective session ('' = default). */
    /** Forgets the project → herdr workspace link; the workspace stays open in herdr. */
    forgetProject(projectPath: string): Promise<void>;
    resolveBinary(): Promise<{ binary: string | undefined; session: string }>;
}

/** Error codes Corral itself produces; herdr's own codes (e.g. `workspace_not_found`) pass through as strings. */
export type HerdrErrorCode = 'server_not_running' | 'not_found' | 'timeout' | 'cli_error' | (string & {});

export class HerdrError extends Error {
    constructor(readonly code: HerdrErrorCode, message?: string, readonly exitCode: number = -1, readonly stderr: string = '') {
        super(message ?? code);
        this.name = 'HerdrError';
    }
}
