import '../../src/browser/style/herdr.css';

import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { FrontendApplicationContribution, KeybindingContribution, WidgetFactory, bindViewContribution } from '@theia/core/lib/browser';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { FolderPicker } from './folder-picker';
import { ProjectListService } from './projects/project-list-service';
import { ChangesService } from './changes/changes-service';
import { ProjectsActionsContribution } from './projects/projects-actions-contribution';
import { WorkspaceRootsSync } from './workspace-roots-sync';
import { CORRAL_HERDR_PATH, CORRAL_PROJECTS_PATH, CorralHerdrService, CorralProjectService } from '../common/protocol';
import { CorralCoreContribution } from './corral-core-contribution';
import { HerdrTerminalContribution } from './herdr/herdr-terminal-contribution';
import { FirstRunContribution } from './first-run-contribution';
import { EditorPlacementGuard } from './editor-placement-guard';
import { CorralWindowTitle, CorralWindowTitleRefresh } from './window-title-contribution';
import { WindowTitleContribution } from '@theia/core/lib/browser/window/window-title-service';
import { NewTabContribution } from './herdr/new-tab-contribution';
import { ProjectsContribution } from './projects/projects-contribution';
import { createProjectsWidget } from './projects/projects-container';
import { PROJECTS_VIEW_ID } from './projects/projects-widget';
import { CorralThemeContribution } from './theme/corral-theme-contribution';
import { FaviconContribution } from './favicon-contribution';
import { bindCorralPreferences } from './corral-preferences';
import { ScmContribution } from '@theia/scm/lib/browser/scm-contribution';
import { CorralScmContribution } from './scm/corral-scm-contribution';
import { ApplicationShellOptions } from '@theia/core/lib/browser/shell/application-shell';
import { SidePanelHandler } from '@theia/core/lib/browser/shell/side-panel-handler';
import { CorralSidePanelHandler, corralShellOptions } from './shell/corral-side-panel-handler';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(CorralThemeContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(CorralThemeContribution);
    bind(FaviconContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(FaviconContribution);
    bind(CorralCoreContribution).toSelf();
    bindCorralPreferences(bind);

    bind(CorralHerdrService).toDynamicValue(ctx =>
        ServiceConnectionProvider.createProxy<CorralHerdrService>(ctx.container, CORRAL_HERDR_PATH)
    ).inSingletonScope();
    bind(HerdrTerminalContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(HerdrTerminalContribution);
    bind(CommandContribution).toService(HerdrTerminalContribution);

    bind(FolderPicker).toSelf().inSingletonScope();
    bind(ProjectListService).toSelf().inSingletonScope();
    bind(ChangesService).toSelf().inSingletonScope();
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
    bind(CorralWindowTitle).toSelf().inSingletonScope();
    bind(WindowTitleContribution).toService(CorralWindowTitle);
    bind(CorralWindowTitleRefresh).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(CorralWindowTitleRefresh);
    bind(NewTabContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NewTabContribution);
    bind(KeybindingContribution).toService(NewTabContribution);
    bind(ProjectsActionsContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(ProjectsActionsContribution);
    bind(MenuContribution).toService(ProjectsActionsContribution);
    bind(TabBarToolbarContribution).toService(ProjectsActionsContribution);
    rebind(ApplicationShellOptions).toConstantValue(corralShellOptions);
    rebind(SidePanelHandler).to(CorralSidePanelHandler);
    bind(CorralScmContribution).toSelf().inSingletonScope();
    rebind(ScmContribution).toService(CorralScmContribution);
    bindViewContribution(bind, ProjectsContribution);
    bind(FrontendApplicationContribution).toService(ProjectsContribution);
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: PROJECTS_VIEW_ID,
        createWidget: () => createProjectsWidget(ctx.container)
    })).inSingletonScope();
});
