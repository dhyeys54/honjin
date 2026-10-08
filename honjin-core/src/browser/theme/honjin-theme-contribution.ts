import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { MonacoThemingService } from '@theia/monaco/lib/browser/monaco-theming-service';
import * as honjinDark from './honjin-dark-color-theme.json';

export const HONJIN_DARK_THEME_ID = 'honjin-dark';

@injectable()
export class HonjinThemeContribution implements FrontendApplicationContribution {

    @inject(MonacoThemingService) protected readonly theming: MonacoThemingService;

    // initialize() runs before the default theme is applied, so the theme exists when Theia looks it up.
    initialize(): void {
        this.theming.registerParsedTheme({ id: HONJIN_DARK_THEME_ID, label: 'Honjin Dark', uiTheme: 'vs-dark', json: honjinDark });
    }
}
