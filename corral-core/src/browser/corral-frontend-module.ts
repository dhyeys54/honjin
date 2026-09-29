import '../../src/browser/style/herdr.css';

import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { FrontendApplicationContribution, KeybindingContribution, WidgetFactory, bindViewContribution } from '@theia/core/lib/browser';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { ProjectListService } from './projects/project-list-service';
import { ProjectsActionsContribution } from './projects/projects-actions-contribution';
import { WorkspaceRootsSync } from './workspace-roots-sync';
import { CORRAL_HERDR_PATH, CORRAL_PROJECTS_PATH, CorralHerdrService, CorralProjectService } from '../common/protocol';
import { CorralCoreContribution } from './corral-core-contribution';
import { HerdrTerminalContribution } from './herdr/herdr-terminal-contribution';
import { FirstRunContribution } from './first-run-contribution';
import { EditorPlacementGuard } from './editor-placement-guard';
import { NewTabContribution } from './herdr/new-tab-contribution';
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

    bind(ProjectListService).toSelf().inSingletonScope();
    bind(WorkspaceRootsSync).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(WorkspaceRootsSync);
    bind(CorralProjectService).toDynamicValue(ctx =>
        ServiceConnectionProvider.createProxy<CorralProjectService>(ctx.container, CORRAL_PROJECTS_PATH)
    ).inSingletonScope();
    bind(FirstRunContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(FirstRunContribution);
    bind(CommandContribution).toService(FirstRunContribution);
    bind(EditorPlacementGuard).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(EditorPlacementGuard);
    bind(NewTabContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NewTabContribution);
    bind(KeybindingContribution).toService(NewTabContribution);
    bind(ProjectsActionsContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(ProjectsActionsContribution);
    bind(MenuContribution).toService(ProjectsActionsContribution);
    bind(TabBarToolbarContribution).toService(ProjectsActionsContribution);
    bindViewContribution(bind, ProjectsContribution);
    bind(FrontendApplicationContribution).toService(ProjectsContribution);
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: PROJECTS_VIEW_ID,
        createWidget: () => createProjectsWidget(ctx.container)
    })).inSingletonScope();
});
