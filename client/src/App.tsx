import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from "react";
import { Switch, Route, Redirect, useRoute } from "wouter";
import { DASHBOARD_PATH } from "@shared/app-routes";
import { getQueryFn, queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LandingPage } from "@/pages/LandingPage";
import { DashboardRoute, RootRedirect } from "@/components/resources/ContractorPortalRedirect";
import { ShellPageLoader } from "@/components/AppShell";
import { SavingAsTemplateBanner } from "@/components/templates/SavingAsTemplateBanner";
import { useAuth } from "@/hooks/use-auth";
import { SidebarStateProvider } from "@/hooks/use-sidebar-state";
import { DashboardSelectorProvider } from "@/hooks/use-dashboard-selector";
import { DashboardGlobalShortcuts } from "@/hooks/use-dashboard-global-shortcuts";
import { CommandPaletteProvider } from "@/hooks/use-command-palette";
import { ThemeProvider } from "@/hooks/use-theme";
import { ClientContextProvider } from "@/hooks/use-client-context";
import { CommandPalette } from "@/components/CommandPalette";
import { GlobalSearchDialog } from "@/components/GlobalSearchDialog";
import { WhatsNewAutoPopup } from "@/components/WhatsNew";
import { AIAssistantButton } from "@/components/AIAssistant";
import { AIInsightsPanelProvider } from "@/hooks/use-ai-insights-panel";
import { ModuleAIInsightsHost } from "@/components/ai/ModuleAIInsightsHost";
import { Loader2 } from "lucide-react";
import { AccessPendingPage } from "@/pages/AccessPendingPage";
import { SupabaseAuthSync } from "@/components/SupabaseAuthSync";
import { OrgBrandingSync } from "@/hooks/use-org-branding";
import { getPendingInviteToken, inviteAcceptPath } from "@/lib/pending-invite";

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
    </div>
  );
}

function LazyRoute({
  component: Component,
  fallback = <ShellPageLoader />,
  ...props
}: {
  component: ComponentType<any>;
  fallback?: ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <Component {...props} />
    </Suspense>
  );
}

function lazyPage<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | Record<string, T>>,
  exportName?: string,
) {
  return lazy(async () => {
    const mod = await factory();
    if ("default" in mod && mod.default) {
      return { default: mod.default as T };
    }
    const named = exportName ? (mod as Record<string, T>)[exportName] : Object.values(mod)[0];
    return { default: named as T };
  });
}

const NotFound = lazyPage(() => import("@/pages/not-found"));
const AcceptInvitationPage = lazyPage(() => import("@/pages/AcceptInvitationPage"));
const SigningPortalPage = lazyPage(() => import("@/pages/SigningPortalPage"));
const SurveyPortalPage = lazyPage(() => import("@/pages/SurveyPortalPage"));
const PollPortalPage = lazyPage(() => import("@/pages/PollPortalPage"));
const HelpDeskPortalPage = lazyPage(() => import("@/pages/HelpDeskPortalPage"));
const HelpDeskCsatPage = lazyPage(() => import("@/pages/HelpDeskCsatPage"));
const ChatPage = lazyPage(() => import("@/pages/ChatPage"), "ChatPage");
const CRMPage = lazyPage(() => import("@/pages/CRMPage"));
const BusinessManagementPage = lazyPage(() => import("@/pages/BusinessManagementPage"));
const DocumentManagementPage = lazyPage(() => import("@/pages/DocumentManagementPage"));
const TaskManagementPage = lazyPage(() => import("@/pages/TaskManagementPage"));
const ProjectsManagementPage = lazyPage(() => import("@/pages/ProjectsManagementPage"));
const SettingsPage = lazyPage(() => import("@/pages/SettingsPage"));
const ResourceManagementPage = lazyPage(() => import("@/pages/ResourceManagementPage"));
const ResourcePlanningPage = lazyPage(() => import("@/pages/ResourcePlanningPage"));
const BPMPage = lazyPage(() => import("@/pages/BPMPage"));
const TestManagementPage = lazyPage(() => import("@/pages/TestManagementPage"));
const WorkspacesPage = lazyPage(() => import("@/pages/WorkspacesPage"));
const ServiceDeskPage = lazyPage(() => import("@/pages/ServiceDeskPage"));
const HelpDeskPage = lazyPage(() => import("@/pages/HelpDeskPage"));
const PortfolioManagementPage = lazyPage(() => import("@/pages/PortfolioManagementPage"));
const SignOffPage = lazyPage(() => import("@/pages/SignOffPage"));
const SurveysPage = lazyPage(() => import("@/pages/SurveysPage"));
const WhiteboardPage = lazyPage(() => import("@/pages/WhiteboardPage"), "WhiteboardPage");
const WhiteboardCanvasPage = lazyPage(() => import("@/pages/WhiteboardCanvasPage"));
const TemplatesPage = lazyPage(() => import("@/pages/TemplatesPage"));
const ClientsPage = lazyPage(() => import("@/pages/ClientsPage"));
const ClientDetailPage = lazyPage(() => import("@/pages/ClientDetailPage"));
const CustomerManagementPage = lazyPage(() => import("@/pages/CustomerManagementPage"));
const FinanceManagementPage = lazyPage(() => import("@/pages/FinanceManagementPage"));
const ModulePage = lazyPage(() => import("@/pages/ModulePage"), "ModulePage");

function LegacyClientsDetailRedirect() {
  const [, params] = useRoute("/modules/clients/:id");
  return <Redirect to={params?.id ? `/clients/${params.id}` : "/clients"} />;
}

function PendingInviteRedirect() {
  useEffect(() => {
    const pending = getPendingInviteToken();
    if (pending) window.location.replace(inviteAcceptPath(pending));
  }, []);
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
    </div>
  );
}

function Router() {
  const { user, isLoading, sessionReady } = useAuth();
  const { data: access, isLoading: isAccessLoading } = useQuery<{
    granted: boolean;
    bootstrapAvailable?: boolean;
  } | null>({
    queryKey: ["/api/auth/access"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: sessionReady && !!user,
    retry: false,
  });

  const suspense = (Component: ComponentType<any>) => (props: any) => (
    <LazyRoute component={Component} {...props} />
  );

  const publicSuspense = (Component: ComponentType<any>) => (props: any) => (
    <LazyRoute component={Component} fallback={<PageLoader />} {...props} />
  );

  // Public portals — no auth required
  if (window.location.pathname.startsWith("/sign/")) {
    return (
      <Switch>
        <Route path="/sign/:token">{publicSuspense(SigningPortalPage)}</Route>
        <Route>{publicSuspense(NotFound)}</Route>
      </Switch>
    );
  }
  if (window.location.pathname.startsWith("/survey/")) {
    return (
      <Switch>
        <Route path="/survey/:token">{publicSuspense(SurveyPortalPage)}</Route>
        <Route>{publicSuspense(NotFound)}</Route>
      </Switch>
    );
  }
  if (window.location.pathname.startsWith("/poll/")) {
    return (
      <Switch>
        <Route path="/poll/:token">{publicSuspense(PollPortalPage)}</Route>
        <Route>{publicSuspense(NotFound)}</Route>
      </Switch>
    );
  }
  if (window.location.pathname.startsWith("/portal/")) {
    return (
      <Switch>
        <Route path="/portal/:token">{publicSuspense(HelpDeskPortalPage)}</Route>
        <Route>{publicSuspense(NotFound)}</Route>
      </Switch>
    );
  }
  if (window.location.pathname.startsWith("/help-desk/csat/")) {
    return (
      <Switch>
        <Route path="/help-desk/csat/:token">{publicSuspense(HelpDeskCsatPage)}</Route>
        <Route>{publicSuspense(NotFound)}</Route>
      </Switch>
    );
  }
  if (window.location.pathname.startsWith("/invite/")) {
    return (
      <Switch>
        <Route path="/invite/:token">{publicSuspense(AcceptInvitationPage)}</Route>
        <Route>{publicSuspense(NotFound)}</Route>
      </Switch>
    );
  }

  if (isLoading || (sessionReady && !!user && (isAccessLoading || access === undefined))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  if (!access?.granted && getPendingInviteToken()) {
    return <PendingInviteRedirect />;
  }

  if (!access?.granted) {
    return <AccessPendingPage />;
  }

  return (
    <AIInsightsPanelProvider>
      <SavingAsTemplateBanner />
      <WhatsNewAutoPopup />
      <AIAssistantButton />
      <ModuleAIInsightsHost />
      <Switch>
          <Route path={DASHBOARD_PATH}>{suspense(DashboardRoute)}</Route>
          <Route path="/ws/:slug">{suspense(DashboardRoute)}</Route>
          <Route path="/">
            <RootRedirect />
          </Route>
          <Route path="/modules/chat/:channelId?">{suspense(ChatPage)}</Route>
          <Route path="/modules/crm">{suspense(CRMPage)}</Route>
          <Route path="/crm">
            <Redirect to="/modules/crm" />
          </Route>
          <Route path="/modules/business-mgmt">{suspense(BusinessManagementPage)}</Route>
          <Route path="/modules/workspaces">{suspense(WorkspacesPage)}</Route>
          <Route path="/modules/service-desk">{suspense(ServiceDeskPage)}</Route>
          <Route path="/modules/help-desk">{suspense(HelpDeskPage)}</Route>
          <Route path="/help-desk">
            <Redirect to="/modules/help-desk" />
          </Route>
          <Route path="/service-desk">
            <Redirect to="/modules/service-desk" />
          </Route>
          <Route path="/modules/documents">{suspense(DocumentManagementPage)}</Route>
          <Route path="/documents">{suspense(DocumentManagementPage)}</Route>
          <Route path="/modules/tasks">{suspense(TaskManagementPage)}</Route>
          <Route path="/tasks">
            <Redirect to="/modules/tasks" />
          </Route>
          <Route path="/modules/portfolio">{suspense(PortfolioManagementPage)}</Route>
          <Route path="/portfolio">
            <Redirect to="/modules/portfolio" />
          </Route>
          <Route path="/modules/projects/:projectId">{suspense(ProjectsManagementPage)}</Route>
          <Route path="/modules/projects">{suspense(ProjectsManagementPage)}</Route>
          <Route path="/modules/resource-planning">{suspense(ResourcePlanningPage)}</Route>
          <Route path="/modules/resource-mgmt">{suspense(ResourceManagementPage)}</Route>
          <Route path="/modules/bpm">{suspense(BPMPage)}</Route>
          <Route path="/bpm">
            <Redirect to="/modules/bpm" />
          </Route>
          <Route path="/modules/test-mgmt">{suspense(TestManagementPage)}</Route>
          <Route path="/modules/clients/:id" component={LegacyClientsDetailRedirect} />
          <Route path="/modules/clients">
            <Redirect to="/clients" />
          </Route>
          <Route path="/clients/:id">{suspense(ClientDetailPage)}</Route>
          <Route path="/clients">{suspense(ClientsPage)}</Route>
          <Route path="/modules/customer-mgmt">{suspense(CustomerManagementPage)}</Route>
          <Route path="/modules/finance-mgmt">{suspense(FinanceManagementPage)}</Route>
          <Route path="/finance">
            <Redirect to="/modules/finance-mgmt" />
          </Route>
          <Route path="/modules/e-sign">{suspense(SignOffPage)}</Route>
          <Route path="/esign">{suspense(SignOffPage)}</Route>
          <Route path="/modules/surveys">{suspense(SurveysPage)}</Route>
          <Route path="/surveys">{() => <Redirect to="/modules/surveys" />}</Route>
          <Route path="/settings/system">{suspense(SettingsPage)}</Route>
          <Route path="/settings/workspace">{suspense(SettingsPage)}</Route>
          <Route path="/settings/personal">{suspense(SettingsPage)}</Route>
          <Route path="/settings">{suspense(SettingsPage)}</Route>
          <Route path="/modules/templates">{suspense(TemplatesPage)}</Route>
          <Route path="/modules/whiteboarding/:id">{suspense(WhiteboardCanvasPage)}</Route>
          <Route path="/modules/whiteboarding">{suspense(WhiteboardPage)}</Route>
          <Route path="/whiteboard/:id">
            {(params) => <Redirect to={`/modules/whiteboarding/${params.id}`} />}
          </Route>
          <Route path="/whiteboard">
            <Redirect to="/modules/whiteboarding" />
          </Route>
          <Route path="/modules/:key">{suspense(ModulePage)}</Route>
          <Route>{suspense(NotFound)}</Route>
      </Switch>
    </AIInsightsPanelProvider>
  );
}

function App() {
  useEffect(() => {
    localStorage.removeItem("jiganto-demo-mode");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthSync>
      <OrgBrandingSync />
      <ThemeProvider>
          <ClientContextProvider>
            <TooltipProvider>
              <SidebarStateProvider>
                <DashboardSelectorProvider>
                  <DashboardGlobalShortcuts />
                  <CommandPaletteProvider>
                    <Toaster />
                    <CommandPalette />
                    <GlobalSearchDialog />
                    <Router />
                  </CommandPaletteProvider>
                </DashboardSelectorProvider>
              </SidebarStateProvider>
            </TooltipProvider>
          </ClientContextProvider>
      </ThemeProvider>
      </SupabaseAuthSync>
    </QueryClientProvider>
  );
}

export default App;
