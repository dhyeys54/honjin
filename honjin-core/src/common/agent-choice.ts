import { AGENTS, AgentId } from './prerequisites';

export interface AgentChoice { id: AgentId | 'shell'; label: string; command: string }

/** POSIX single quotes, only when needed; herdr types the command into the pane's shell. */
const shellWord = (s: string) => /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * Spec 13 S8: installed agents in catalog order, then Shell; the last choice moves to the top. A command that starts
 * with the agent's own binary name runs the binary Setup found (`paths`), whose folder the pane's `PATH` may lack.
 */
export function agentChoices(
    installed: AgentId[], commands: Partial<Record<AgentId, string>>, last?: string, paths: Partial<Record<AgentId, string>> = {}
): AgentChoice[] {
    const command = (id: AgentId, binary: string) => {
        const configured = commands[id] ?? binary;
        const path = paths[id];
        const [first, ...rest] = configured.split(' ');
        return path && first === binary ? [shellWord(path), ...rest].join(' ') : configured;
    };
    const choices: AgentChoice[] = [
        ...AGENTS.filter(a => installed.includes(a.id)).map(a => ({ id: a.id, label: a.name, command: command(a.id, a.binary) })),
        { id: 'shell', label: 'Shell', command: '' }
    ];
    const i = choices.findIndex(c => c.id === last);
    return i > 0 ? [choices[i], ...choices.slice(0, i), ...choices.slice(i + 1)] : choices;
}
