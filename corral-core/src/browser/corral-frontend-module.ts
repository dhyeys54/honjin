import '../../src/browser/style/herdr.css';

import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core/lib/common';
import { FrontendApplicationContribution, WidgetFactory, bindViewContribution } from '@theia/core/lib/browser';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { CORRAL_HERDR_PATH, CORRAL_PROJECTS_PATH, CorralHerdrService, CorralProjectService } from '../common/protocol';
import { CorralCoreContribution } from './corral-core-contribution';
import { HerdrTerminalContribution } from './herdr/herdr-terminal-contribution';
import { ProjectsContribution } from './projects/projects-contribution';
import { createProjectsWidget } from './projects/projects-container';
import { PROJECTS_VIEW_ID } from './projects/projects-widget';
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

    bind(CorralProjectService).toDynamicValue(ctx =>
        ServiceConnectionProvider.createProxy<CorralProjectService>(ctx.container, CORRAL_PROJECTS_PATH)
    ).inSingletonScope();
    bindViewContribution(bind, ProjectsContribution);
    bind(FrontendApplicationContribution).toService(ProjectsContribution);
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: PROJECTS_VIEW_ID,
        createWidget: () => createProjectsWidget(ctx.container)
    })).inSingletonScope();
});
