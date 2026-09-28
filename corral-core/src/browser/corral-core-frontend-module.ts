/**
 * Generated using theia-extension-generator
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { CorralCoreContribution } from './corral-core-contribution';


export default new ContainerModule(bind => {

    // Replace this line with the desired binding, e.g. "bind(CommandContribution).to(CorralCoreContribution)
    bind(CorralCoreContribution).toSelf();
});
