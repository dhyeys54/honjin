// RPC contract between the frontend widgets and the Node backend (spec 00 §Components).
import type { AgentList } from './agents';
import type { PrerequisiteStatus } from './prerequisites';
import type { Runaway, Summary } from './resource-usage';

export const CORRAL_PROJECTS_PATH = '/services/corral-projects';
export const CORRAL_HERDR_PATH = '/services/corral-herdr';
export const CORRAL_RESOURCES_PATH = '/services/corral-resources';
export const CORRAL_AGENTS_PATH = '/services/corral-agents';
export const CORRAL_SETUP_PATH = '/services/corral-setup';

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
    /** One line per scan root that doesn't exist or can't be read (spec 03). */
    warnings: string[];
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
    /** Forgets the project → herdr workspace link; the workspace stays open in herdr. */
    forgetProject(projectPath: string): Promise<void>;
    /** The herdr binary to launch in the terminal (undefined if not found) and the effective session ('' = default). */
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

export const CorralResourceService = Symbol('CorralResourceService');
export interface ResourceSample extends Summary { totalMemBytes: number; runaways: Runaway[] }
export interface ResourceBreakdownRow extends Summary { label: string }
export interface CorralResourceService {
    /** Totals for Corral plus the herdr session's process tree (spec 10). */
    sample(): Promise<ResourceSample>;
    /** The same totals split into Corral, the herdr server and each workspace; heaviest first. */
    breakdown(): Promise<ResourceBreakdownRow[]>;
}

export const CorralAgentService = Symbol('CorralAgentService');
export interface CorralAgentService {
    /** Every agent in Corral's herdr session; `running: false` when herdr isn't installed or its server is down. */
    list(): Promise<AgentList>;
    /** Focuses the agent's pane in herdr (marks it seen). Rejects with `agent_not_found` when the pane is gone. */
    focus(paneId: string): Promise<void>;
}

export const CorralSetupService = Symbol('CorralSetupService');
export interface CorralSetupService {
    /** Spec 13 S4: every prerequisite in catalog order, found or with its install command. */
    check(): Promise<PrerequisiteStatus[]>;
}
