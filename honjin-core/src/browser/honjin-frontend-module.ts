import '../../src/browser/style/herdr.css';
import '../../src/browser/style/changes.css';
import '../../src/browser/style/agents.css';
import '../../src/browser/style/setup.css';

import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { FrontendApplicationContribution, KeybindingContribution, WidgetFactory, bindViewContribution } from '@theia/core/lib/browser';
import { TabBarDecorator } from '@theia/core/lib/browser/shell/tab-bar-decorator';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { FolderPicker } from './folder-picker';
import { ProjectListService } from './projects/project-list-service';
import { ChangesService } from './changes/changes-service';
import { CHANGES_VIEW_ID, createChangesWidget } from './changes/changes-widget';
import { ChangesContribution } from './changes/changes-contribution';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { AgentTimelineContribution } from './agents/agent-timeline-contribution';
import { AGENT_TIMELINE_ID, AgentTimelineWidget } from './agents/agent-timeline-widget';
import { AgentsContribution } from './agents/agents-contribution';
import { AgentsService } from './agents/agents-service';
import { AGENTS_VIEW_ID, createAgentsWidget } from './agents/agents-widget';
import { ProjectsViewContainerFactory } from './projects/projects-view-container';
import { ProjectsActionsContribution } from './projects/projects-actions-contribution';
import { WorkspaceRootsSync } from './workspace-roots-sync';
import {
    HONJIN_AGENTS_PATH, HONJIN_HERDR_PATH, HONJIN_PROJECTS_PATH, HONJIN_RESOURCES_PATH, HONJIN_SETUP_PATH,
    HonjinAgentService, HonjinHerdrService, HonjinProjectService, HonjinResourceService, HonjinSetupService
} from '../common/protocol';
import { ResourceStatusContribution } from './resource-monitor/resource-status-contribution';
import { HerdrTerminalContribution } from './herdr/herdr-terminal-contribution';
import { FirstRunContribution } from './first-run-contribution';
import { SetupService } from './setup/setup-service';
import { SETUP_ID, SetupWidget } from './setup/setup-widget';
import { SetupContribution } from './setup/setup-contribution';
import { BetaContribution } from './beta-contribution';
import { EditorPlacementGuard } from './editor-placement-guard';
import { HonjinWindowTitle, HonjinWindowTitleRefresh } from './window-title-contribution';
import { WindowTitleContribution } from '@theia/core/lib/browser/window/window-title-service';
import { NewTabContribution } from './herdr/new-tab-contribution';
import { ProjectsContribution } from './projects/projects-contribution';
import { createProjectsWidget } from './projects/projects-container';
import { PROJECTS_VIEW_ID } from './projects/projects-widget';
import { HonjinThemeContribution } from './theme/honjin-theme-contribution';
import { FaviconContribution } from './favicon-contribution';
import { bindHonjinPreferences } from './honjin-preferences';
import { ScmContribution } from '@theia/scm/lib/browser/scm-contribution';
import { HonjinScmContribution } from './scm/honjin-scm-contribution';
import { ApplicationShellOptions } from '@theia/core/lib/browser/shell/application-shell';
import { SidePanelHandler } from '@theia/core/lib/browser/shell/side-panel-handler';
import { HonjinSidePanelHandler, honjinShellOptions } from './shell/honjin-side-panel-handler';
import { QuickCommandService } from '@theia/core/lib/browser/quick-input';
import { PaletteOriginQuickCommandService } from './palette-origin-quick-command-service';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(HonjinThemeContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(HonjinThemeContribution);
    bind(FaviconContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(FaviconContribution);
    bindHonjinPreferences(bind);

    bind(HonjinHerdrService).toDynamicValue(ctx =>
        ServiceConnectionProvider.createProxy<HonjinHerdrService>(ctx.container, HONJIN_HERDR_PATH)
    ).inSingletonScope();
    bind(HerdrTerminalContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(HerdrTerminalContribution);
    bind(CommandContribution).toService(HerdrTerminalContribution);

    bind(HonjinResourceService).toDynamicValue(ctx =>
        ServiceConnectionProvider.createProxy<HonjinResourceService>(ctx.container, HONJIN_RESOURCES_PATH)
    ).inSingletonScope();
    bind(ResourceStatusContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(ResourceStatusContribution);

    bind(FolderPicker).toSelf().inSingletonScope();
    bind(ProjectListService).toSelf().inSingletonScope();
    bind(ChangesService).toSelf().inSingletonScope();
    bind(WorkspaceRootsSync).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(WorkspaceRootsSync);
    bind(HonjinProjectService).toDynamicValue(ctx =>
        ServiceConnectionProvider.createProxy<HonjinProjectService>(ctx.container, HONJIN_PROJECTS_PATH)
    ).inSingletonScope();
    bind(FirstRunContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(FirstRunContribution);
    bind(CommandContribution).toService(FirstRunContribution);
    bind(EditorPlacementGuard).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(EditorPlacementGuard);
    bind(HonjinWindowTitle).toSelf().inSingletonScope();
    bind(WindowTitleContribution).toService(HonjinWindowTitle);
    bind(HonjinWindowTitleRefresh).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(HonjinWindowTitleRefresh);
    bind(NewTabContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NewTabContribution);
    bind(KeybindingContribution).toService(NewTabContribution);
    bind(ProjectsActionsContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(ProjectsActionsContribution);
    bind(MenuContribution).toService(ProjectsActionsContribution);
    bind(TabBarToolbarContribution).toService(ProjectsActionsContribution);
    rebind(ApplicationShellOptions).toConstantValue(honjinShellOptions);
    rebind(SidePanelHandler).to(HonjinSidePanelHandler);
    rebind(QuickCommandService).to(PaletteOriginQuickCommandService).inSingletonScope();
    bind(HonjinScmContribution).toSelf().inSingletonScope();
    rebind(ScmContribution).toService(HonjinScmContribution);
    bind(ChangesContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(ChangesContribution);
    bind(MenuContribution).toService(ChangesContribution);
    bind(ColorContribution).toService(ChangesContribution);
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: CHANGES_VIEW_ID,
        createWidget: () => createChangesWidget(ctx.container)
    })).inSingletonScope();
    bind(HonjinAgentService).toDynamicValue(ctx =>
        ServiceConnectionProvider.createProxy<HonjinAgentService>(ctx.container, HONJIN_AGENTS_PATH)
    ).inSingletonScope();
    bind(HonjinSetupService).toDynamicValue(ctx =>
        ServiceConnectionProvider.createProxy<HonjinSetupService>(ctx.container, HONJIN_SETUP_PATH)
    ).inSingletonScope();
    bind(AgentsService).toSelf().inSingletonScope();
    bind(AgentsContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(AgentsContribution);
    bind(MenuContribution).toService(AgentsContribution);
    bind(ColorContribution).toService(AgentsContribution);
    bind(TabBarDecorator).toService(AgentsContribution);
    bind(FrontendApplicationContribution).toService(AgentsContribution);
    bind(FrontendApplicationContribution).toService(AgentsService);
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: AGENTS_VIEW_ID,
        createWidget: () => createAgentsWidget(ctx.container)
    })).inSingletonScope();
    bind(AgentTimelineWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: AGENT_TIMELINE_ID,
        createWidget: () => ctx.container.get(AgentTimelineWidget)
    })).inSingletonScope();
    bindViewContribution(bind, AgentTimelineContribution);
    bind(SetupService).toSelf().inSingletonScope();
    bind(SetupWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: SETUP_ID,
        createWidget: () => ctx.container.get(SetupWidget)
    })).inSingletonScope();
    bindViewContribution(bind, SetupContribution);
    bind(FrontendApplicationContribution).toService(SetupContribution);
    bind(BetaContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(BetaContribution);
    bind(CommandContribution).toService(BetaContribution);
    bind(MenuContribution).toService(BetaContribution);
    bind(ProjectsViewContainerFactory).toSelf().inSingletonScope();
    bind(WidgetFactory).toService(ProjectsViewContainerFactory);
    bindViewContribution(bind, ProjectsContribution);
    bind(FrontendApplicationContribution).toService(ProjectsContribution);
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: PROJECTS_VIEW_ID,
        createWidget: () => createProjectsWidget(ctx.container)
    })).inSingletonScope();
});
