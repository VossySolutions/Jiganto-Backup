import { useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { DASHBOARD_PATH } from "@shared/app-routes";
import { getQueryFn, queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { LandingPage } from "@/pages/LandingPage";
import { Dashboard } from "@/pages/Dashboard";
import { ModulePage } from "@/pages/ModulePage";
import { ChatPage } from "@/pages/ChatPage";
import CRMPage from "@/pages/CRMPage";
import BusinessManagementPage from "@/pages/BusinessManagementPage";
import DocumentManagementPage from "@/pages/DocumentManagementPage";
import TaskManagementPage from "@/pages/TaskManagementPage";
import ProjectsManagementPage from "@/pages/ProjectsManagementPage";
import SettingsPage from "@/pages/SettingsPage";
import ResourceManagementPage from "@/pages/ResourceManagementPage";
import BPMPage from "@/pages/BPMPage";
import TestManagementPage from "@/pages/TestManagementPage";
import WorkspacesPage from "@/pages/WorkspacesPage";
import PortfolioManagementPage from "@/pages/PortfolioManagementPage";
import SignOffPage from "@/pages/SignOffPage";
import SigningPortalPage from "@/pages/SigningPortalPage";
import SurveysPage from "@/pages/SurveysPage";
import SurveyPortalPage from "@/pages/SurveyPortalPage";
import ClientsPage from "@/pages/ClientsPage";
import CustomerManagementPage from "@/pages/CustomerManagementPage";
import { useAuth } from "@/hooks/use-auth";
import { SidebarStateProvider } from "@/hooks/use-sidebar-state";
import { DashboardSelectorProvider } from "@/hooks/use-dashboard-selector";
import { DashboardGlobalShortcuts } from "@/hooks/use-dashboard-global-shortcuts";
import { CommandPaletteProvider } from "@/hooks/use-command-palette";
import { ThemeProvider } from "@/hooks/use-theme";
import { ClientContextProvider } from "@/hooks/use-client-context";
import { CommandPalette } from "@/components/CommandPalette";
import { WhatsNewAutoPopup } from "@/components/WhatsNew";
import { AIAssistantButton } from "@/components/AIAssistant";
import { Loader2 } from "lucide-react";
import { AccessPendingPage } from "@/pages/AccessPendingPage";
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage";
import { SupabaseAuthSync } from "@/components/SupabaseAuthSync";
import { OrgBrandingSync } from "@/hooks/use-org-branding";
import { getPendingInviteToken, inviteAcceptPath } from "@/lib/pending-invite";
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
    <>
      <WhatsNewAutoPopup />
      <AIAssistantButton />
      <Switch>
        <Route path={DASHBOARD_PATH} component={Dashboard} />
        <Route path="/ws/:slug" component={Dashboard} />
        <Route path="/">
          <Redirect to={DASHBOARD_PATH} />
        </Route>
        <Route path="/modules/chat/:channelId?" component={ChatPage} />
        <Route path="/modules/crm" component={CRMPage} />
        <Route path="/modules/business-mgmt" component={BusinessManagementPage} />
        <Route path="/modules/workspaces" component={WorkspacesPage} />
        <Route path="/modules/documents" component={DocumentManagementPage} />
        <Route path="/documents" component={DocumentManagementPage} />
        <Route path="/modules/tasks" component={TaskManagementPage} />
        <Route path="/modules/portfolio" component={PortfolioManagementPage} />
        <Route path="/modules/projects/:projectId" component={ProjectsManagementPage} />
        <Route path="/modules/projects" component={ProjectsManagementPage} />
        <Route path="/modules/resource-mgmt" component={ResourceManagementPage} />
        <Route path="/modules/bpm" component={BPMPage} />
        <Route path="/modules/test-mgmt" component={TestManagementPage} />
        <Route path="/modules/clients" component={ClientsPage} />
        <Route path="/modules/customer-mgmt" component={CustomerManagementPage} />
        <Route path="/modules/e-sign" component={SignOffPage} />
        <Route path="/modules/surveys" component={SurveysPage} />
        <Route path="/settings/system" component={SettingsPage} />
        <Route path="/settings/workspace" component={SettingsPage} />
        <Route path="/settings/personal" component={SettingsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/modules/:key" component={ModulePage} />
        <Route component={NotFound} />
      </Switch>
    </>
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
