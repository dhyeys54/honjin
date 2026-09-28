import { ContainerModule } from '@theia/core/shared/inversify';
import { CorralCoreContribution } from './corral-core-contribution';
import { bindCorralPreferences } from './corral-preferences';

export default new ContainerModule(bind => {
    bind(CorralCoreContribution).toSelf();
    bindCorralPreferences(bind);
});
