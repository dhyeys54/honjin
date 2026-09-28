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
}

/** Stable error codes crossing the RPC boundary; herdr's own codes pass through as strings. */
export type HerdrErrorCode = 'server_not_running' | 'binary_not_found' | 'timeout' | 'bad_output' | 'cli_error' | (string & {});

export class HerdrError extends Error {
    constructor(readonly code: HerdrErrorCode, message?: string) {
        super(message ?? code);
        this.name = 'HerdrError';
    }
}
