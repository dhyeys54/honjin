export type AgentId = 'claude' | 'codex' | 'gemini' | 'opencode';
export type PrerequisiteId = 'herdr' | AgentId | 'git';

export interface Prerequisite {
    id: PrerequisiteId;
    name: string;
    binary: string;
    role: 'required' | 'agent' | 'optional';
    docsUrl: string;
    /** `undefined`: no Install button, the view links `docsUrl` instead. */
    install(found: { brew: boolean; npm: boolean }): string | undefined;
    /** Where an installer puts the binary when that is off the usual paths; `~` is expanded by the backend. */
    extraCandidates: string[];
}

export interface PrerequisiteStatus { id: PrerequisiteId; found: boolean; path?: string; version: string; install?: string }

/** Where installers put binaries that a Finder-launched app's `PATH` misses (spec 04); `~` is the home folder. */
export const FALLBACK_DIRS = ['~/.local/bin', '/opt/homebrew/bin', '/usr/local/bin'];

const fixed = (command: string) => () => command;

/** Spec 13 S1. Install commands are copied from each vendor's docs (checked 2026-10-08, D44); never user input. */
export const PREREQUISITES: readonly Prerequisite[] = [
    {
        id: 'herdr', name: 'herdr', binary: 'herdr', role: 'required', docsUrl: 'https://herdr.dev/docs/install',
        install: fixed('curl -fsSL https://herdr.dev/install.sh | sh'), extraCandidates: []
    },
    {
        id: 'claude', name: 'Claude Code', binary: 'claude', role: 'agent', docsUrl: 'https://code.claude.com/docs/en/setup',
        install: fixed('curl -fsSL https://claude.ai/install.sh | bash'), extraCandidates: []
    },
    {
        id: 'codex', name: 'Codex', binary: 'codex', role: 'agent', docsUrl: 'https://github.com/openai/codex',
        install: fixed('curl -fsSL https://chatgpt.com/codex/install.sh | sh'), extraCandidates: []
    },
    {
        id: 'gemini', name: 'Gemini CLI', binary: 'gemini', role: 'agent', docsUrl: 'https://github.com/google-gemini/gemini-cli',
        install: ({ brew, npm }) => brew ? 'brew install gemini-cli' : npm ? 'npm install -g @google/gemini-cli' : undefined,
        extraCandidates: []
    },
    {
        id: 'opencode', name: 'opencode', binary: 'opencode', role: 'agent', docsUrl: 'https://github.com/sst/opencode',
        install: fixed('curl -fsSL https://opencode.ai/install | bash'), extraCandidates: ['~/.opencode/bin/opencode', '~/bin/opencode']
    },
    {
        id: 'git', name: 'git', binary: 'git', role: 'optional', docsUrl: 'https://developer.apple.com/xcode/resources/',
        install: fixed('xcode-select --install'), extraCandidates: []
    }
];

export const AGENTS = PREREQUISITES.filter((p): p is Prerequisite & { id: AgentId } => p.role === 'agent');

export type SetupState = 'ready' | 'needs-herdr' | 'needs-agent';

/** S3: git never blocks. */
export function setupState(found: Partial<Record<PrerequisiteId, boolean>>): SetupState {
    if (!found.herdr) {
        return 'needs-herdr';
    }
    return AGENTS.some(a => found[a.id]) ? 'ready' : 'needs-agent';
}
