import { AGENTS, AgentId } from './prerequisites';

export interface AgentChoice { id: AgentId | 'shell'; label: string; command: string }

/** Spec 13 S8: installed agents in catalog order, then Shell; the last choice moves to the top. */
export function agentChoices(installed: AgentId[], commands: Partial<Record<AgentId, string>>, last?: string): AgentChoice[] {
    const choices: AgentChoice[] = [
        ...AGENTS.filter(a => installed.includes(a.id)).map(a => ({ id: a.id, label: a.name, command: commands[a.id] ?? a.binary })),
        { id: 'shell', label: 'Shell', command: '' }
    ];
    const i = choices.findIndex(c => c.id === last);
    return i > 0 ? [choices[i], ...choices.slice(0, i), ...choices.slice(i + 1)] : choices;
}
