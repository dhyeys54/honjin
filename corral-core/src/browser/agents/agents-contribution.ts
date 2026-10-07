import { injectable } from '@theia/core/shared/inversify';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { ColorRegistry } from '@theia/core/lib/browser/color-registry';
import { colors } from '../../common/design-tokens';

const definitions: [string, string, string][] = [
    ['blocked', colors.danger, 'The dot of an agent that is waiting for you to answer.'],
    ['done', colors.accent, 'The dot of an agent that finished while you were not looking.'],
    ['working', colors.info, 'The dot of an agent that is working.'],
    ['unknown', colors['fg-faint'], 'The dot of an agent whose state herdr does not report.']
];

/** Spec 12 A10: the status colours (menus and badges join this class in T7.6 and T7.7). */
@injectable()
export class AgentsContribution implements ColorContribution {

    registerColors(registry: ColorRegistry): void {
        registry.register(...definitions.map(([status, hex, description]) => ({
            id: `corral.agents.${status}`, defaults: { dark: hex, light: hex, hcDark: hex, hcLight: hex }, description
        })));
    }
}
