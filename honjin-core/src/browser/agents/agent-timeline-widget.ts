import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
// The shared React typings use `export =`, which this tsconfig (no esModuleInterop) only allows via require-style import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import React = require('@theia/core/shared/react');
import { ReactWidget } from '@theia/core/lib/browser';
import { TIMELINE_WINDOW_MS, formatAge, segmentGeometry } from '../../common/agents';
import { AgentsService } from './agents-service';

export const AGENT_TIMELINE_ID = 'honjin-agent-timeline';
const WINDOW_MINUTES = TIMELINE_WINDOW_MS / 60_000;
const AXIS: [number, string][] = [0, 1, 2].map(i => [i * 100 / 3, `-${WINDOW_MINUTES * (3 - i) / 3}m`] as [number, string]).concat([[100, 'now']]);

/** Spec 12 A15: one lane per agent over the last 15 minutes, coloured by status. */
@injectable()
export class AgentTimelineWidget extends ReactWidget {

    @inject(AgentsService) protected readonly agents: AgentsService;

    constructor() {
        super();
        this.id = AGENT_TIMELINE_ID;
        this.title.label = 'Agent Timeline';
        this.title.caption = 'Agent Timeline';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-graph-line';
        this.addClass('honjin-timeline');
        this.node.dataset.testid = 'honjin-agent-timeline';
    }

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.agents.onDidChange(() => this.update()));
        this.update();
    }

    protected render(): React.ReactNode {
        const lanes = this.agents.timeline();
        if (lanes.length === 0) {
            return React.createElement('div', { className: 'honjin-timeline-empty' }, 'No agent activity yet');
        }
        const now = Date.now();
        return React.createElement('div', { className: 'honjin-timeline-body' },
            ...lanes.map(({ lane, location, listed }) => React.createElement('div', {
                key: lane.paneId, 'data-testid': 'honjin-timeline-lane',
                className: listed ? 'honjin-timeline-lane honjin-timeline-lane-focusable' : 'honjin-timeline-lane',
                onClick: listed ? () => void this.agents.focus(lane.paneId) : undefined
            },
                React.createElement('div', {
                    className: 'honjin-timeline-label',
                    title: `${listed ? `Focus ${lane.kind} in herdr` : 'No longer running'}\n${lane.cwd}`
                }, `${lane.kind} · ${location}`),
                React.createElement('div', { className: 'honjin-timeline-track' },
                    ...lane.segments.map((seg, i) => {
                        const { left, width } = segmentGeometry(seg, now, TIMELINE_WINDOW_MS);
                        return React.createElement('div', {
                            key: i, className: `honjin-timeline-seg honjin-agent-${seg.status}`,
                            style: { left: `${left}%`, width: `${width}%` },
                            title: `${seg.status} ${formatAge((seg.end ?? now) - seg.start)}`
                        });
                    })))),
            React.createElement('div', { key: 'axis', className: 'honjin-timeline-axis' },
                React.createElement('div', { className: 'honjin-timeline-label' }),
                React.createElement('div', { className: 'honjin-timeline-track' },
                    ...AXIS.map(([left, text]) => React.createElement('span', { key: text, style: { left: `${left}%` } }, text)))));
    }
}
