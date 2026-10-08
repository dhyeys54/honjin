import { AgentList } from '../common/agents';
import { HonjinAgentService, HerdrError } from '../common/protocol';
import { HerdrCli } from './herdr-cli';

export type AgentClient = Pick<HerdrCli, 'listAgents' | 'focusAgent'>;

/** Reads and focuses the agents of Honjin's herdr session (spec 12 A1, A8). */
export class HonjinAgentServiceImpl implements HonjinAgentService {
    constructor(protected readonly getCli: () => Promise<AgentClient>) { }

    async list(): Promise<AgentList> {
        try {
            return { running: true, agents: await (await this.getCli()).listAgents() };
        } catch (e) {
            if (e instanceof HerdrError && (e.code === 'server_not_running' || e.code === 'not_found')) {
                return { running: false, agents: [] };
            }
            throw e;
        }
    }

    async focus(paneId: string): Promise<void> {
        await (await this.getCli()).focusAgent(paneId);
    }
}
