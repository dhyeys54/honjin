import { AgentInfo } from '../common/agents';
import { HerdrError } from '../common/protocol';
import { AgentClient, CorralAgentServiceImpl } from './corral-agent-service';

const agents: AgentInfo[] = [{ paneId: 'w1:p1', workspaceId: 'w1', kind: 'claude', status: 'blocked', cwd: '/x', title: '' }];

function setup(over: Partial<AgentClient> = {}, getCli?: () => Promise<AgentClient>) {
    const client: AgentClient = { listAgents: jest.fn(async () => agents), focusAgent: jest.fn(async () => undefined), ...over };
    return { client, service: new CorralAgentServiceImpl(getCli ?? (async () => client)) };
}

describe('CorralAgentServiceImpl', () => {
    it('A1: list() returns running with exactly what herdr listed', async () => {
        expect(await setup().service.list()).toEqual({ running: true, agents });
    });

    it('A1: server_not_running means not running, with no agents', async () => {
        const { service } = setup({ listAgents: async () => { throw new HerdrError('server_not_running'); } });
        expect(await service.list()).toEqual({ running: false, agents: [] });
    });

    it('A1: herdr not found (getCli rejects) means not running too', async () => {
        const { service } = setup({}, async () => { throw new HerdrError('not_found'); });
        expect(await service.list()).toEqual({ running: false, agents: [] });
    });

    it('A1: other errors reject unchanged', async () => {
        for (const error of [new HerdrError('timeout'), new HerdrError('cli_error'), new Error('boom')]) {
            const { service } = setup({ listAgents: async () => { throw error; } });
            await expect(service.list()).rejects.toBe(error);
        }
    });

    it('A8: focus passes the pane id through and lets agent_not_found propagate', async () => {
        const { service, client } = setup();
        await service.focus('w1:p1');
        expect(client.focusAgent).toHaveBeenCalledTimes(1);
        expect(client.focusAgent).toHaveBeenCalledWith('w1:p1');
        const failing = setup({ focusAgent: async () => { throw new HerdrError('agent_not_found'); } });
        await expect(failing.service.focus('w9:p9')).rejects.toMatchObject({ code: 'agent_not_found' });
    });

    it('A8: focus does not swallow a missing herdr', async () => {
        const { service } = setup({}, async () => { throw new HerdrError('not_found'); });
        await expect(service.focus('w1:p1')).rejects.toMatchObject({ code: 'not_found' });
    });
});
