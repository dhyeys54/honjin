// RPC contract between the frontend widgets and the Node backend (spec 00 §Components).
import type { AgentList } from './agents';
import type { PrerequisiteStatus } from './prerequisites';
import type { Runaway, Summary } from './resource-usage';

export const HONJIN_PROJECTS_PATH = '/services/honjin-projects';
export const HONJIN_HERDR_PATH = '/services/honjin-herdr';
export const HONJIN_RESOURCES_PATH = '/services/honjin-resources';
export const HONJIN_AGENTS_PATH = '/services/honjin-agents';
export const HONJIN_SETUP_PATH = '/services/honjin-setup';

export const HonjinProjectService = Symbol('HonjinProjectService');
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
export interface HonjinProjectService {
    list(request: ProjectScanRequest): Promise<ProjectScanResult>;
    /** Absolute path of the managed `honjin.code-workspace`; created if missing. */
    workspaceFile(): Promise<string>;
    /** Shows the path in the OS file manager (Finder). */
    reveal(path: string): Promise<void>;
}

export const HonjinHerdrService = Symbol('HonjinHerdrService');
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
export interface HonjinHerdrService {
    status(): Promise<HerdrStatus>;
    openTab(request: OpenTabRequest): Promise<OpenTabResult>;
    /** Forgets the project → herdr workspace link; the workspace stays open in herdr. */
    forgetProject(projectPath: string): Promise<void>;
    /** The herdr binary to launch in the terminal (undefined if not found) and the effective session ('' = default). */
    resolveBinary(): Promise<{ binary: string | undefined; session: string }>;
}

/** Error codes Honjin itself produces; herdr's own codes (e.g. `workspace_not_found`) pass through as strings. */
export type HerdrErrorCode = 'server_not_running' | 'not_found' | 'timeout' | 'cli_error' | (string & {});

export class HerdrError extends Error {
    constructor(readonly code: HerdrErrorCode, message?: string, readonly exitCode: number = -1, readonly stderr: string = '') {
        super(message ?? code);
        this.name = 'HerdrError';
    }
}

export const HonjinResourceService = Symbol('HonjinResourceService');
export interface ResourceSample extends Summary { totalMemBytes: number; runaways: Runaway[] }
export interface ResourceBreakdownRow extends Summary { label: string }
export interface HonjinResourceService {
    /** Totals for Honjin plus the herdr session's process tree (spec 10). */
    sample(): Promise<ResourceSample>;
    /** The same totals split into Honjin, the herdr server and each workspace; heaviest first. */
    breakdown(): Promise<ResourceBreakdownRow[]>;
}

export const HonjinAgentService = Symbol('HonjinAgentService');
export interface HonjinAgentService {
    /** Every agent in Honjin's herdr session; `running: false` when herdr isn't installed or its server is down. */
    list(): Promise<AgentList>;
    /** Focuses the agent's pane in herdr (marks it seen). Rejects with `agent_not_found` when the pane is gone. */
    focus(paneId: string): Promise<void>;
}

export const HonjinSetupService = Symbol('HonjinSetupService');
export interface HonjinSetupService {
    /** Spec 13 S4: every prerequisite in catalog order, found or with its install command. */
    check(): Promise<PrerequisiteStatus[]>;
    /** Spec 13 S12: GitHub's latest release, or `undefined` on any failure. */
    latestRelease(): Promise<LatestRelease | undefined>;
    platform(): Promise<Platform>;
}
export interface LatestRelease { tag: string; url: string }
export interface Platform { macos: string; arch: string }
