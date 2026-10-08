import { injectable } from '@theia/core/shared/inversify';
import { Command } from '@theia/core/lib/common';
import { QuickCommandService } from '@theia/core/lib/browser/quick-input';

/**
 * Theia rebuilds the command list on every keystroke, matching each `when` clause against the focused element. By
 * then focus is in the palette, so clauses scoped to the editor (`editorLangId`, which gates Markdown: Open Preview)
 * stop matching as soon as the user types. Match against the element the palette was opened from instead.
 */
@injectable()
export class PaletteOriginQuickCommandService extends QuickCommandService {

    protected origin?: HTMLElement;

    override reset(): void {
        const active = document.activeElement;
        if (active instanceof HTMLElement && !active.closest('.quick-input-widget')) {
            this.origin = active;
        }
        super.reset();
    }

    protected override getValidCommands(raw: Command[]): Command[] {
        return raw.filter(command => {
            const contexts = this.contexts.get(command.id);
            return command.label && (!contexts || contexts.some(when => this.contextKeyService.match(when, this.origin)));
        });
    }
}
