import { useEffect } from "react";
import { Switch, Route, Redirect, useRoute } from "wouter";
import { DASHBOARD_PATH } from "@shared/app-routes";
import { getQueryFn, queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { LandingPage } from "@/pages/LandingPage";
import { DashboardRoute, RootRedirect } from "@/components/resources/ContractorPortalRedirect";
import { ModulePage } from "@/pages/ModulePage";
import { ChatPage } from "@/pages/ChatPage";
import CRMPage from "@/pages/CRMPage";
import BusinessManagementPage from "@/pages/BusinessManagementPage";
import DocumentManagementPage from "@/pages/DocumentManagementPage";
import TaskManagementPage from "@/pages/TaskManagementPage";
import ProjectsManagementPage from "@/pages/ProjectsManagementPage";
import SettingsPage from "@/pages/SettingsPage";
import ResourceManagementPage from "@/pages/ResourceManagementPage";
import ResourcePlanningPage from "@/pages/ResourcePlanningPage";
import BPMPage from "@/pages/BPMPage";
import TestManagementPage from "@/pages/TestManagementPage";
import WorkspacesPage from "@/pages/WorkspacesPage";
import ServiceDeskPage from "@/pages/ServiceDeskPage";
import HelpDeskPage from "@/pages/HelpDeskPage";
import HelpDeskPortalPage from "@/pages/HelpDeskPortalPage";
import HelpDeskCsatPage from "@/pages/HelpDeskCsatPage";
import PortfolioManagementPage from "@/pages/PortfolioManagementPage";
import SignOffPage from "@/pages/SignOffPage";
import SigningPortalPage from "@/pages/SigningPortalPage";
import SurveysPage from "@/pages/SurveysPage";
import SurveyPortalPage from "@/pages/SurveyPortalPage";
import ClientsPage from "@/pages/ClientsPage";
import ClientDetailPage from "@/pages/ClientDetailPage";
import CustomerManagementPage from "@/pages/CustomerManagementPage";
import FinanceManagementPage from "@/pages/FinanceManagementPage";
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
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage";
import { SupabaseAuthSync } from "@/components/SupabaseAuthSync";
import { OrgBrandingSync } from "@/hooks/use-org-branding";
import { getPendingInviteToken, inviteAcceptPath } from "@/lib/pending-invite";

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
    staleTime: 60_000,
    retry: false,
  });

  // Public portals — no auth required
  if (window.location.pathname.startsWith("/sign/")) {
    return (
      <Switch>
        <Route path="/sign/:token" component={SigningPortalPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }
  if (window.location.pathname.startsWith("/survey/")) {
    return (
      <Switch>
        <Route path="/survey/:token" component={SurveyPortalPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }
  if (window.location.pathname.startsWith("/portal/")) {
    return (
      <Switch>
        <Route path="/portal/:token" component={HelpDeskPortalPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }
  if (window.location.pathname.startsWith("/help-desk/csat/")) {
    return (
      <Switch>
        <Route path="/help-desk/csat/:token" component={HelpDeskCsatPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }
  if (window.location.pathname.startsWith("/invite/")) {
    return (
      <Switch>
        <Route path="/invite/:token" component={AcceptInvitationPage} />
        <Route component={NotFound} />
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
      <WhatsNewAutoPopup />
      <AIAssistantButton />
      <ModuleAIInsightsHost />
      <Switch>
        <Route path={DASHBOARD_PATH} component={DashboardRoute} />
        <Route path="/ws/:slug" component={DashboardRoute} />
        <Route path="/">
          <RootRedirect />
        </Route>
        <Route path="/modules/chat/:channelId?" component={ChatPage} />
        <Route path="/modules/crm" component={CRMPage} />
        <Route path="/crm">
          <Redirect to="/modules/crm" />
        </Route>
        <Route path="/modules/business-mgmt" component={BusinessManagementPage} />
        <Route path="/modules/workspaces" component={WorkspacesPage} />
        <Route path="/modules/service-desk" component={ServiceDeskPage} />
        <Route path="/modules/help-desk" component={HelpDeskPage} />
        <Route path="/help-desk">
          <Redirect to="/modules/help-desk" />
        </Route>
        <Route path="/service-desk">
          <Redirect to="/modules/service-desk" />
        </Route>
        <Route path="/modules/documents" component={DocumentManagementPage} />
        <Route path="/documents" component={DocumentManagementPage} />
        <Route path="/modules/tasks" component={TaskManagementPage} />
        <Route path="/tasks">
          <Redirect to="/modules/tasks" />
        </Route>
        <Route path="/modules/portfolio" component={PortfolioManagementPage} />
        <Route path="/portfolio">
          <Redirect to="/modules/portfolio" />
        </Route>
        <Route path="/modules/projects/:projectId" component={ProjectsManagementPage} />
        <Route path="/modules/projects" component={ProjectsManagementPage} />
        <Route path="/modules/resource-planning" component={ResourcePlanningPage} />
        <Route path="/modules/resource-mgmt" component={ResourceManagementPage} />
        <Route path="/modules/bpm" component={BPMPage} />
        <Route path="/bpm">
          <Redirect to="/modules/bpm" />
        </Route>
        <Route path="/modules/test-mgmt" component={TestManagementPage} />
        <Route path="/modules/clients/:id" component={LegacyClientsDetailRedirect} />
        <Route path="/modules/clients">
          <Redirect to="/clients" />
        </Route>
        <Route path="/clients/:id" component={ClientDetailPage} />
        <Route path="/clients" component={ClientsPage} />
        <Route path="/modules/customer-mgmt" component={CustomerManagementPage} />
        <Route path="/modules/finance-mgmt" component={FinanceManagementPage} />
        <Route path="/finance">
          <Redirect to="/modules/finance-mgmt" />
        </Route>
        <Route path="/modules/e-sign" component={SignOffPage} />
        <Route path="/modules/surveys" component={SurveysPage} />
        <Route path="/settings/system" component={SettingsPage} />
        <Route path="/settings/workspace" component={SettingsPage} />
        <Route path="/settings/personal" component={SettingsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/modules/:key" component={ModulePage} />
        <Route component={NotFound} />
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
