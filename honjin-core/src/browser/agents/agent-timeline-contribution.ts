import { injectable } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { AGENT_TIMELINE_ID, AgentTimelineWidget } from './agent-timeline-widget';

/** Spec 12 A15: opens the timeline in the bottom panel. Not opened by default, and no header button (A7). */
@injectable()
export class AgentTimelineContribution extends AbstractViewContribution<AgentTimelineWidget> {

    constructor() {
        super({
            widgetId: AGENT_TIMELINE_ID,
            widgetName: 'Agent Timeline',
            defaultWidgetOptions: { area: 'bottom' },
            toggleCommandId: 'honjin.agents.timeline.toggle'
        });
    }
}
