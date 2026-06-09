import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { PmoDashboard } from "@/components/PmoDashboard";
import { useClientContext } from "@/hooks/use-client-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Settings2, Star, Check, Presentation, X, Plus, Sparkles, Search } from "lucide-react";
import { ModuleDiscovery, useModuleDiscoveryShortcuts } from "@/components/ModuleDiscovery";

import {

  useDashboardSelector,

  parseCustomDashboardId,

  type DashboardType,

} from "@/hooks/use-dashboard-selector";

import { QuickActionsDropdown } from "@/components/QuickActionsDropdown";

import { NotificationBell } from "@/components/NotificationBell";

import { HelpMenu } from "@/components/HelpMenu";

import { cn } from "@/lib/utils";

import {

  DropdownMenu,

  DropdownMenuContent,

  DropdownMenuItem,

  DropdownMenuLabel,

  DropdownMenuSeparator,

  DropdownMenuTrigger,

} from "@/components/ui/dropdown-menu";

import {

  ProjectsModulePanel,

  TasksModulePanel,

  CrmModulePanel,

  HelpDeskModulePanel,

  FinanceModulePanel,

  BusinessModulePanel,

} from "@/components/dashboard/ModuleDashboardPanels";

import { DashboardContextSelector } from "@/components/dashboard/DashboardContextSelector";

import { ExecutiveOverviewDashboard } from "@/components/dashboard/ExecutiveOverviewDashboard";
import { DashboardConfigDialog } from "@/components/dashboard/DashboardConfigDialog";

import { DashboardBriefingStrip } from "@/components/dashboard/DashboardBriefingStrip";

import { BespokeDashboardView } from "@/components/dashboard/BespokeDashboardView";

import { AiDashboardDialog, CreateBespokeDashboardDialog } from "@/components/dashboard/CreateDashboardDialogs";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";



function GenericModuleDashboard({ title }: { title: string }) {

  return (

    <Card className="rounded-2xl border-border/50">

      <CardHeader>

        <CardTitle>{title}</CardTitle>

        <CardDescription>Module dashboard template — connect live widgets in a future release.</CardDescription>

      </CardHeader>

      <CardContent className="text-sm text-muted-foreground">

        Use Projects, Tasks, CRM, Help Desk, Finance, or Business dashboards for fully wired analytics today.

      </CardContent>

    </Card>

  );

}



export function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { isMasterView, canViewPmoMaster, activeClient } = useClientContext();

  const {

    currentDashboard,

    setCurrentDashboard,

    enabledDashboards,

    dashboards,

    toggleDashboard,

    defaultDashboard,

    setDefaultDashboard,

    hiddenModuleKeys,

    toggleModuleVisibility,

    refreshCustomDashboards,

  } = useDashboardSelector();



  const [showConfigDialog, setShowConfigDialog] = useState(false);

  const [presentationMode, setPresentationMode] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [showAiDialog, setShowAiDialog] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState("");
  const CONTEXT_KEY = "jiganto-dashboard-context";
  const [contextClientId, setContextClientId] = useState<number | null>(() => {
    try {
      const raw = sessionStorage.getItem(CONTEXT_KEY);
      if (raw) return JSON.parse(raw).clientId ?? activeClient?.id ?? null;
    } catch {}
    return activeClient?.id ?? null;
  });
  const [contextProjectId, setContextProjectId] = useState<number | null>(() => {
    try {
      const raw = sessionStorage.getItem(CONTEXT_KEY);
      if (raw) return JSON.parse(raw).projectId ?? null;
    } catch {}
    return null;
  });

  const moduleShortcuts = useModuleDiscoveryShortcuts(hiddenModuleKeys);

  useEffect(() => {
    sessionStorage.setItem(
      CONTEXT_KEY,
      JSON.stringify({ clientId: contextClientId, projectId: contextProjectId }),
    );
  }, [contextClientId, contextProjectId]);

  useEffect(() => {
    setContextClientId(activeClient?.id ?? null);
  }, [activeClient?.id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape" && presentationMode) {
        setPresentationMode(false);
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        if (currentDashboard === "modules" || currentDashboard === "main") {
          const mod = moduleShortcuts[idx];
          if (mod) {
            setLocation(mod.href);
            return;
          }
        }
        const target = enabledDashboards[idx];
        if (target) setCurrentDashboard(target.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    currentDashboard,
    presentationMode,
    setCurrentDashboard,
    enabledDashboards,
    moduleShortcuts,
    setLocation,
  ]);



  const currentDashboardInfo = dashboards.find((d) => d.id === currentDashboard);



  const groupedDashboards = useMemo(() => {
    const system = dashboards.filter((d) => d.group === "system");
    const module = enabledDashboards.filter((d) => d.group === "module");
    const custom = enabledDashboards.filter((d) => d.group === "custom");
    return { system, module, custom };
  }, [dashboards, enabledDashboards]);

  const filteredDashboards = useMemo(() => {
    const q = dashboardSearch.trim().toLowerCase();
    const match = (d: (typeof enabledDashboards)[number]) =>
      !q || d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q);
    const systemWithoutModules = groupedDashboards.system.filter((d) => d.id !== "modules");
    return {
      system: systemWithoutModules.filter(match),
      module: groupedDashboards.module.filter(match),
      custom: groupedDashboards.custom.filter(match),
    };
  }, [groupedDashboards, dashboardSearch]);

  const allModulesDashboard =
    dashboards.find((d) => d.id === "modules") ?? {
      id: "modules" as const,
      name: "All Modules",
      description: "Explore all platform modules",
      enabled: true,
      group: "system" as const,
    };



  const customId = parseCustomDashboardId(currentDashboard);



  const handleDashboardCreated = async (id: DashboardType) => {
    await refreshCustomDashboards();
    setCurrentDashboard(id);
  };



  const showBriefing =
    currentDashboard === "modules" ||
    currentDashboard === "main" ||
    currentDashboard === "projects" ||
    currentDashboard === "tasks" ||
    currentDashboard === "crm" ||
    currentDashboard === "helpdesk" ||
    currentDashboard === "finance" ||
    currentDashboard === "business";



  const renderDashboardContent = () => {

    if (isMasterView && canViewPmoMaster && currentDashboard === "main") {

      return <PmoDashboard />;

    }



    const ctx = { clientId: contextClientId, projectId: contextProjectId };



    if (customId != null) {

      return (
        <BespokeDashboardView
          dashboardId={customId}
          {...ctx}
          onOpenSettings={() => setShowConfigDialog(true)}
        />
      );

    }



    switch (currentDashboard) {

      case "modules":

        return (

          <ModuleDiscovery

            clientId={ctx.clientId}

            projectId={ctx.projectId}

            hiddenModuleKeys={hiddenModuleKeys}

          />

        );

      case "projects":

        return <ProjectsModulePanel {...ctx} />;

      case "tasks":

        return <TasksModulePanel {...ctx} />;

      case "crm":

        return <CrmModulePanel {...ctx} />;

      case "helpdesk":

        return <HelpDeskModulePanel {...ctx} />;

      case "finance":

        return <FinanceModulePanel {...ctx} />;

      case "business":

        return <BusinessModulePanel {...ctx} />;

      case "main":
        return (
          <ExecutiveOverviewDashboard
            clientId={ctx.clientId}
            projectId={ctx.projectId}
          />
        );

      case "portfolio":

        return <GenericModuleDashboard title="Portfolio Dashboard" />;

      default:

        return <GenericModuleDashboard title={currentDashboardInfo?.name ?? "Dashboard"} />;

    }

  };



  const shell = (

    <div

      className={cn(

        "max-w-7xl mx-auto p-4 md:p-8 space-y-6",

        presentationMode && "max-w-[1600px]",

      )}

      data-testid="dashboard-page"

    >

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div className="space-y-2">

          <div className="flex flex-wrap items-center gap-3">

            <DropdownMenu>

              <DropdownMenuTrigger asChild>

                <Button

                  variant="ghost"

                  className="gap-2 text-2xl md:text-3xl font-bold font-display tracking-tight text-foreground p-0 h-auto hover:bg-transparent"

                  data-testid="dashboard-selector"

                >

                  {currentDashboardInfo?.name || "Dashboard"}

                  <ChevronDown className="h-5 w-5 text-muted-foreground" />

                </Button>

              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-72 max-h-[70vh] overflow-y-auto">

                <DropdownMenuLabel>Switch dashboard</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setCurrentDashboard("modules")}
                  className="flex items-center justify-between cursor-pointer font-medium"
                >
                  <div>
                    <p className="font-medium">{allModulesDashboard.name}</p>
                    <p className="text-xs text-muted-foreground">{allModulesDashboard.description}</p>
                  </div>
                  {currentDashboard === "modules" && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 pb-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                      placeholder="Search dashboards…"
                      className="h-8 pl-8 text-xs"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <DropdownMenuSeparator />
                {filteredDashboards.system.length > 0 && (

                  <>

                    <DropdownMenuLabel className="text-xs text-muted-foreground">System views</DropdownMenuLabel>

                    {filteredDashboards.system.map((dashboard, idx) => (

                      <DropdownMenuItem

                        key={dashboard.id}

                        onClick={() => setCurrentDashboard(dashboard.id)}

                        className="flex items-center justify-between cursor-pointer"

                      >

                        <div>

                          <p className="font-medium">{dashboard.name}</p>

                          <p className="text-xs text-muted-foreground">{dashboard.description}</p>

                        </div>

                        <div className="flex items-center gap-1">

                          {idx < 9 && (

                            <span className="text-[10px] text-muted-foreground border rounded px-1">{idx + 1}</span>

                          )}

                          {defaultDashboard === dashboard.id && (

                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />

                          )}

                          {currentDashboard === dashboard.id && <Check className="h-4 w-4 text-primary" />}

                        </div>

                      </DropdownMenuItem>

                    ))}

                  </>

                )}

                {filteredDashboards.module.length > 0 && (

                  <>

                    <DropdownMenuSeparator />

                    <DropdownMenuLabel className="text-xs text-muted-foreground">Module dashboards</DropdownMenuLabel>

                    {filteredDashboards.module.map((dashboard) => (

                      <DropdownMenuItem

                        key={dashboard.id}

                        onClick={() => setCurrentDashboard(dashboard.id)}

                        className="flex items-center justify-between cursor-pointer"

                      >

                        <div>

                          <p className="font-medium">{dashboard.name}</p>

                          <p className="text-xs text-muted-foreground">{dashboard.description}</p>

                        </div>

                        <div className="flex items-center gap-1">

                          {defaultDashboard === dashboard.id && (

                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />

                          )}

                          {currentDashboard === dashboard.id && <Check className="h-4 w-4 text-primary" />}

                        </div>

                      </DropdownMenuItem>

                    ))}

                  </>

                )}

                {filteredDashboards.custom.length > 0 && (

                  <>

                    <DropdownMenuSeparator />

                    <DropdownMenuLabel className="text-xs text-muted-foreground">My dashboards</DropdownMenuLabel>

                    {filteredDashboards.custom.map((dashboard) => (

                      <DropdownMenuItem

                        key={dashboard.id}

                        onClick={() => setCurrentDashboard(dashboard.id)}

                        className="flex items-center justify-between cursor-pointer"

                      >

                        <div>

                          <p className="font-medium">{dashboard.name}</p>

                          <p className="text-xs text-muted-foreground">{dashboard.description}</p>

                        </div>

                        {currentDashboard === dashboard.id && <Check className="h-4 w-4 text-primary" />}

                      </DropdownMenuItem>

                    ))}

                  </>

                )}

                <DropdownMenuSeparator />

                {dashboardSearch.trim() &&
                  filteredDashboards.system.length === 0 &&
                  filteredDashboards.module.length === 0 &&
                  filteredDashboards.custom.length === 0 && (
                    <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                      No dashboards match &ldquo;{dashboardSearch.trim()}&rdquo;
                    </p>
                  )}

                <DropdownMenuItem onClick={() => setShowCreateDialog(true)} className="gap-2 cursor-pointer">

                  <Plus className="h-4 w-4" />

                  Create custom dashboard

                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => setShowAiDialog(true)} className="gap-2 cursor-pointer">

                  <Sparkles className="h-4 w-4" />

                  AI dashboard builder

                </DropdownMenuItem>

              </DropdownMenuContent>

            </DropdownMenu>

            <DashboardContextSelector

              dashboardId={currentDashboard}

              clientId={contextClientId}

              projectId={contextProjectId}

              onClientChange={setContextClientId}

              onProjectChange={setContextProjectId}

            />

          </div>

          <p className="text-muted-foreground text-sm">

            {currentDashboardInfo?.description || "Overview of your enterprise performance."}

            {user?.firstName ? ` · Welcome back, ${user.firstName}` : ""}

            <span className="hidden sm:inline"> · Press 1–9 to switch, D for default</span>

          </p>

        </div>

        <div className="flex gap-2 items-center flex-wrap">

          {!presentationMode && (

            <>

              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowCreateDialog(true)}>

                <Plus className="h-4 w-4" />

                New

              </Button>

              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAiDialog(true)}>

                <Sparkles className="h-4 w-4" />

                AI

              </Button>

              <HelpMenu />

              <NotificationBell />

              <QuickActionsDropdown />

              <Button

                variant="ghost"

                size="icon"

                onClick={() => setShowConfigDialog(true)}

                data-testid="configure-dashboards-btn"

                title="Configure dashboards"

              >

                <Settings2 className="h-4 w-4" />

              </Button>

            </>

          )}

          <Button

            variant={presentationMode ? "default" : "outline"}

            size="sm"

            className="gap-1.5"

            onClick={() => setPresentationMode((v) => !v)}

          >

            {presentationMode ? <X className="h-4 w-4" /> : <Presentation className="h-4 w-4" />}

            {presentationMode ? "Exit present" : "Present"}

          </Button>

        </div>

      </div>



      {presentationMode && (

        <p className="text-xs text-muted-foreground text-right">

          Presentation mode · {new Date().toLocaleString()} · Press Esc to exit

        </p>

      )}



      {showBriefing && (

        <DashboardBriefingStrip clientId={contextClientId} projectId={contextProjectId} />

      )}



      {renderDashboardContent()}



      <DashboardConfigDialog

        open={showConfigDialog}

        onOpenChange={setShowConfigDialog}

        dashboards={dashboards.filter((d) => d.group !== "custom")}

        defaultDashboard={defaultDashboard}

        hiddenModuleKeys={hiddenModuleKeys}

        onToggleDashboard={toggleDashboard}

        onSetDefault={setDefaultDashboard}

        onToggleModuleVisibility={toggleModuleVisibility}
        customDashboardId={customId}
        contextClientId={contextClientId}
        contextProjectId={contextProjectId}
      />



      <CreateBespokeDashboardDialog

        open={showCreateDialog}

        onOpenChange={setShowCreateDialog}

        onCreated={handleDashboardCreated}

        clientId={contextClientId}

        projectId={contextProjectId}

      />

      <AiDashboardDialog

        open={showAiDialog}

        onOpenChange={setShowAiDialog}

        onCreated={handleDashboardCreated}

        clientId={contextClientId}

        projectId={contextProjectId}

      />

    </div>

  );



  if (presentationMode) {

    return (

      <div className="fixed inset-0 z-50 bg-background overflow-y-auto p-6 md:p-10">{shell}</div>

    );

  }



  return <AppShell>{shell}</AppShell>;

}


