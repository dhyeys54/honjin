import { PREREQUISITES, setupState } from './prerequisites';

const byId = (id: string) => PREREQUISITES.find(p => p.id === id)!;
const none = { brew: false, npm: false };

describe('PREREQUISITES (spec 13 S1)', () => {
    it('lists the catalog in order', () => {
        expect(PREREQUISITES.map(p => p.id)).toEqual(['herdr', 'claude', 'codex', 'gemini', 'opencode', 'git']);
        expect(PREREQUISITES.map(p => p.role)).toEqual(['required', 'agent', 'agent', 'agent', 'agent', 'optional']);
    });

    it('uses the vendor install commands', () => {
        expect(byId('herdr').install(none)).toBe('curl -fsSL https://herdr.dev/install.sh | sh');
        expect(byId('claude').install(none)).toBe('curl -fsSL https://claude.ai/install.sh | bash');
        expect(byId('codex').install(none)).toBe('curl -fsSL https://chatgpt.com/codex/install.sh | sh');
        expect(byId('opencode').install(none)).toBe('curl -fsSL https://opencode.ai/install | bash');
        expect(byId('git').install(none)).toBe('xcode-select --install');
    });

    it('installs gemini with brew, else npm, else not at all', () => {
        expect(byId('gemini').install({ brew: true, npm: true })).toBe('brew install gemini-cli');
        expect(byId('gemini').install({ brew: false, npm: true })).toBe('npm install -g @google/gemini-cli');
        expect(byId('gemini').install(none)).toBeUndefined();
    });

    it('gives opencode its installer locations as extra candidates', () => {
        expect(byId('opencode').extraCandidates).toEqual(['~/.opencode/bin/opencode', '~/bin/opencode']);
        expect(byId('herdr').extraCandidates).toEqual([]);
    });
});

describe('setupState (S3)', () => {
    it('needs herdr first', () => {
        expect(setupState({ herdr: false, claude: true })).toBe('needs-herdr');
    });
    it('needs an agent when herdr is there', () => {
        expect(setupState({ herdr: true, git: true })).toBe('needs-agent');
    });
    it('is ready with herdr and any agent, even without git', () => {
        expect(setupState({ herdr: true, opencode: true, git: false })).toBe('ready');
    });
});
