import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
// The shared React typings use `export =`, which this tsconfig (no esModuleInterop) only allows via require-style import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import React = require('@theia/core/shared/react');
import { ReactWidget } from '@theia/core/lib/browser';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { PREREQUISITES, Prerequisite, PrerequisiteStatus, SetupState } from '../../common/prerequisites';
import { SetupService } from './setup-service';

export const SETUP_ID = 'corral-setup';

const STATE_TEXT: Record<SetupState, string> = {
    'ready': 'Ready. Click + on any folder to start an agent.',
    'needs-herdr': 'Install herdr to continue.',
    'needs-agent': 'Install at least one agent.'
};
const ROLE_TEXT: Record<Prerequisite['role'], string> = { required: 'Required', agent: 'Agent', optional: 'Optional' };

/** Spec 13 S5: what Corral needs, what was found, and an Install button for the rest. */
@injectable()
export class SetupWidget extends ReactWidget {

    @inject(SetupService) protected readonly setup: SetupService;
    @inject(WindowService) protected readonly windows: WindowService;

    constructor() {
        super();
        this.id = SETUP_ID;
        this.title.label = 'Set Up Corral';
        this.title.caption = 'Set Up Corral';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-tools';
        this.addClass('corral-setup');
        this.node.dataset.testid = 'corral-setup';
    }

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.setup.onDidChange(() => this.update()));
        if (!this.setup.statuses) {
            void this.setup.check();
        }
        this.update();
    }

    protected render(): React.ReactNode {
        const { statuses, state } = this.setup;
        const h = React.createElement;
        return h('div', { className: 'corral-setup-body' },
            h('h2', undefined, 'Set Up Corral'),
            h('p', { className: 'corral-setup-intro' },
                'Corral runs coding agents inside herdr. It needs herdr and at least one agent. '
                + 'Install opens a terminal that runs the vendor\'s own installer, so you can watch what it does.'),
            h('div', { className: 'corral-setup-state', 'data-testid': 'corral-setup-state' }, state ? STATE_TEXT[state] : 'Checking…'),
            h('div', { className: 'corral-setup-rows' },
                ...PREREQUISITES.map(p => this.renderRow(p, statuses?.find(s => s.id === p.id)))),
            h('div', { className: 'corral-setup-actions' },
                h('button', { className: 'theia-button secondary', onClick: () => void this.setup.check() }, 'Re-check'),
                state && state !== 'ready'
                    ? h('button', { className: 'corral-setup-link', onClick: () => this.setup.skip() }, 'Continue anyway')
                    : undefined));
    }

    protected renderRow(p: Prerequisite, status: PrerequisiteStatus | undefined): React.ReactNode {
        const h = React.createElement;
        const found = status?.found;
        return h('div', { key: p.id, className: 'corral-setup-row', 'data-testid': 'corral-setup-row', 'data-id': p.id },
            h('span', { className: `codicon ${found ? 'codicon-pass-filled corral-setup-found' : 'codicon-circle-large-outline'}` }),
            h('span', { className: 'corral-setup-name' }, p.name),
            h('span', { className: 'corral-setup-detail' }, !status ? '' : found ? status.version || 'found' : ROLE_TEXT[p.role]),
            !status || found ? undefined : status.install
                ? h('button', { className: 'theia-button', onClick: () => void this.setup.install(p.name, status.install!) }, 'Install')
                : h('button', { className: 'corral-setup-link', onClick: () => this.windows.openNewWindow(p.docsUrl, { external: true }) }, 'Docs'));
    }
}
