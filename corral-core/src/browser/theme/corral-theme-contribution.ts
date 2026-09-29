import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { MonacoThemingService } from '@theia/monaco/lib/browser/monaco-theming-service';
import * as corralDark from './corral-dark-color-theme.json';

export const CORRAL_DARK_THEME_ID = 'corral-dark';

@injectable()
export class CorralThemeContribution implements FrontendApplicationContribution {

    @inject(MonacoThemingService) protected readonly theming: MonacoThemingService;

    // initialize() runs before the default theme is applied, so the theme exists when Theia looks it up.
    initialize(): void {
        this.theming.registerParsedTheme({ id: CORRAL_DARK_THEME_ID, label: 'Corral Dark', uiTheme: 'vs-dark', json: corralDark });
    }
}
