import { agentChoices } from './agent-choice';

const commands = { claude: 'claude --verbose', codex: 'codex', gemini: 'gemini', opencode: 'opencode' };

describe('agentChoices (spec 13 S8)', () => {
    it('lists installed agents in catalog order, then Shell', () => {
        expect(agentChoices(['opencode', 'claude'], commands)).toEqual([
            { id: 'claude', label: 'Claude Code', command: 'claude --verbose' },
            { id: 'opencode', label: 'opencode', command: 'opencode' },
            { id: 'shell', label: 'Shell', command: '' }
        ]);
    });

    it('puts the last choice first', () => {
        expect(agentChoices(['claude', 'codex'], commands, 'codex').map(c => c.id)).toEqual(['codex', 'claude', 'shell']);
        expect(agentChoices(['claude', 'codex'], commands, 'shell').map(c => c.id)).toEqual(['shell', 'claude', 'codex']);
    });

    it('ignores a last choice that is not offered', () => {
        expect(agentChoices(['claude'], commands, 'gemini').map(c => c.id)).toEqual(['claude', 'shell']);
    });

    it('falls back to the binary name when the map has no command', () => {
        expect(agentChoices(['codex'], {})[0].command).toBe('codex');
    });
});
