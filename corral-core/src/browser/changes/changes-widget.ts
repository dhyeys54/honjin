import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
// The shared React typings use `export =`, which this tsconfig (no esModuleInterop) only allows via require-style import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import React = require('@theia/core/shared/react');
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { ChangesService } from './changes-service';

export const CHANGES_VIEW_ID = 'corral-changes';

/** Spec 09. Only the empty state (C11) so far; the tree of changed files comes with the next task. */
@injectable()
export class ChangesWidget extends ReactWidget {

    @inject(ChangesService) protected readonly changes: ChangesService;

    @postConstruct()
    protected init(): void {
        this.id = CHANGES_VIEW_ID;
        this.title.label = 'Changes';
        this.title.caption = 'Changes';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-git-compare';
        this.addClass('corral-changes');
        this.node.dataset.testid = 'corral-changes';
        this.toDispose.push(this.changes.onDidChange(() => this.update()));
        this.update();
    }

    protected render(): React.ReactNode {
        if (this.changes.groups().length === 0) {
            return React.createElement('div', { className: 'corral-changes-empty', 'data-testid': 'corral-changes-empty' },
                'No uncommitted changes');
        }
        return undefined;
    }
}
