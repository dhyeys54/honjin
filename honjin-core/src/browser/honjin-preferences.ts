import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { PreferenceContribution } from '@theia/core/lib/common/preferences/preference-schema';
import { PreferenceProxy } from '@theia/core/lib/common/preferences/preference-proxy';
import { PreferenceProxyFactory } from '@theia/core/lib/common/preferences/injectable-preference-proxy';
import { interfaces } from '@theia/core/shared/inversify';
import { HonjinConfiguration, honjinPreferenceSchema } from '../common/preferences-schema';

export const HonjinPreferences = Symbol('HonjinPreferences');
export type HonjinPreferences = PreferenceProxy<HonjinConfiguration>;

export function bindHonjinPreferences(bind: interfaces.Bind): void {
    bind(PreferenceContribution).toConstantValue({ schema: honjinPreferenceSchema });
    bind(HonjinPreferences).toDynamicValue(ctx =>
        ctx.container.get<PreferenceProxyFactory>(PreferenceProxyFactory)<HonjinConfiguration>(honjinPreferenceSchema)
    ).inSingletonScope();
}

/** Writes a Honjin setting to the user's settings.json; the key and value are checked against the schema. */
export const setHonjinPreference = <K extends keyof HonjinConfiguration>(service: PreferenceService, key: K, value: HonjinConfiguration[K]): Promise<void> =>
    service.set(key, value, PreferenceScope.User);
