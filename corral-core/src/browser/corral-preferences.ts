import { PreferenceContribution } from '@theia/core/lib/common/preferences/preference-schema';
import { PreferenceProxy } from '@theia/core/lib/common/preferences/preference-proxy';
import { PreferenceProxyFactory } from '@theia/core/lib/common/preferences/injectable-preference-proxy';
import { interfaces } from '@theia/core/shared/inversify';
import { CorralConfiguration, corralPreferenceSchema } from '../common/preferences-schema';

export const CorralPreferences = Symbol('CorralPreferences');
export type CorralPreferences = PreferenceProxy<CorralConfiguration>;

export function bindCorralPreferences(bind: interfaces.Bind): void {
    bind(PreferenceContribution).toConstantValue({ schema: corralPreferenceSchema });
    bind(CorralPreferences).toDynamicValue(ctx =>
        ctx.container.get<PreferenceProxyFactory>(PreferenceProxyFactory)<CorralConfiguration>(corralPreferenceSchema)
    ).inSingletonScope();
}
