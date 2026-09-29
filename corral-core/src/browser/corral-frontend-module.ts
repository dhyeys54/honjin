import '../../src/browser/style/herdr.css';

import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core/lib/common';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { CORRAL_HERDR_PATH, CorralHerdrService } from '../common/protocol';
import { CorralCoreContribution } from './corral-core-contribution';
import { HerdrTerminalContribution } from './herdr/herdr-terminal-contribution';
import { bindCorralPreferences } from './corral-preferences';

export default new ContainerModule(bind => {
    bind(CorralCoreContribution).toSelf();
    bindCorralPreferences(bind);

    bind(CorralHerdrService).toDynamicValue(ctx =>
        ServiceConnectionProvider.createProxy<CorralHerdrService>(ctx.container, CORRAL_HERDR_PATH)
    ).inSingletonScope();
    bind(HerdrTerminalContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(HerdrTerminalContribution);
    bind(CommandContribution).toService(HerdrTerminalContribution);
});
