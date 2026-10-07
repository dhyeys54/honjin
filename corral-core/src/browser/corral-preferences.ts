import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
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

/** Writes a Corral setting to the user's settings.json; the key and value are checked against the schema. */
export const setCorralPreference = <K extends keyof CorralConfiguration>(service: PreferenceService, key: K, value: CorralConfiguration[K]): Promise<void> =>
    service.set(key, value, PreferenceScope.User);
