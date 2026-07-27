import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ModuleShell } from "@/components/ModuleShell";
import {
  modulePageMainClass,
  modulePageShellClass,
} from "@/components/ModulePageChrome";
import { cn } from "@/lib/utils";
import { ProjectsLandingView } from "@/components/projects/ProjectsLanding";
import {
  ProjectWorkspaceSidebar,
  type ProjectToolBadges,
} from "@/components/projects/ProjectWorkspaceSidebar";
import {
  CreateWorkItemWizard,
  WORK_TYPES,
  MASTER_TOOL_ORDER,
  findToolDefinition,
  coalesceAgileTools,
  LEGACY_AGILE_TOOL_ID_SET,
} from "@/components/projects/CreateWorkItemWizard";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import type { AgilePipelineStageId } from "@/components/projects/AgileWorkspace";
import { LEGACY_AGILE_TO_STAGE } from "@/components/projects/AgileWorkspace";

const AgileWorkspace = lazy(() => import("@/components/projects/AgileWorkspace"));
const ProjectOverview = lazy(() => import("@/components/projects/ProjectOverview"));
const RaiddLogTool = lazy(() => import("@/components/projects/RaiddLogTool"));
const DeliverablesTracker = lazy(() => import("@/components/projects/DeliverablesTracker"));
const ProjectWhiteboardTool = lazy(() =>
  import("@/components/whiteboard/ProjectWhiteboardTool").then((m) => ({ default: m.ProjectWhiteboardTool })),
);
const MilestoneTracker = lazy(() => import("@/components/projects/MilestoneTracker"));
const ProjectTrackingBoard = lazy(() =>
  import("@/components/projects/ProjectTrackingBoard").then((m) => ({ default: m.ProjectTrackingBoard })),
);
const Portfolio360ReportView = lazy(() =>
  import("@/components/portfolio/Portfolio360ReportView").then((m) => ({ default: m.Portfolio360ReportView })),
);
const ReactGanttChart = lazy(() =>
  import("@/components/projects/ReactGanttChart").then((m) => ({ default: m.ReactGanttChart })),
);
const HelpDeskProjectTicketsTool = lazy(() =>
  import("@/components/help-desk/HelpDeskProjectTicketsTool").then((m) => ({ default: m.HelpDeskProjectTicketsTool })),
);
const PmTeamOrgTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmTeamOrgTool })));
const PmRaciTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmRaciTool })));
const PmResourceTrackerTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmResourceTrackerTool })));
const PmTimesheetsTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmTimesheetsTool })));
const PmFinanceTrackerTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmFinanceTrackerTool })));
const PmStatusReportingTool = lazy(() =>
  import("@/components/projects/PmWeeklyStatusReport").then((m) => ({ default: m.PmWeeklyStatusReport })),
);
const PmChangeLogTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmChangeLogTool })));
const PmDocumentationTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmDocumentationTool })));
const PmTestTrackerTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmTestTrackerTool })));
const PmStakeholderTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmStakeholderTool })));
const PmBpmTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmBpmTool })));
const PmSowTrackerTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmSowTrackerTool })));
const PmWbsTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmWbsTool })));

import {
  Loader2,
  ChevronLeft,
  Maximize,
  Minimize,
  X,
  MoreHorizontal,
  LayoutTemplate,
} from "lucide-react";
import { SaveAsPlatformTemplateDialog } from "@/components/templates/SaveAsPlatformTemplateDialog";
import {
  PmProjectIcon,
  PmDocumentationIcon,
  SettingsGeneralIcon, SettingsPeopleIcon, SettingsFinancialIcon,
  SettingsScheduleIcon, SettingsStrategyIcon, SettingsRiskIcon, SettingsTagsIcon, SettingsGearIcon,
} from "@/components/icons/ModuleIcons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ViewMode = "dashboard" | "new" | "project";

function buildToolSubtitle(
  toolId: string,
  project: any,
  badges?: ProjectToolBadges | null,
): string {
  const code = project.code ? ` · ${project.code}` : "";
  const b = badges?.badges?.[toolId];
  switch (toolId) {
    case "agile":
      return "Epic → Feature → Story → AC → Test → Sprint → Defect";
    case "project_dashboard":
      return `Project summary, health & activity${code}`;
    case "360_report":
      return `Full project health — for PM & Programme Manager${code}`;
    case "gantt_chart":
      return b?.count != null
        ? `${b.count} timeline instance${b.count === 1 ? "" : "s"}`
        : "Timeline & dependencies";
    case "tracking_board":
      return b?.count != null
        ? `${b.count} board${b.count === 1 ? "" : "s"}`
        : "Lightweight flexible tracking";
    default: {
      const def = findToolDefinition(toolId);
      return def?.name ? `${def.name}${code}` : "Project tool";
    }
  }
}

function ProjectDetailView({
  projectId,
  onBack,
}: {
  projectId: number;
  onBack: () => void;
}) {
  const [activeTool, setActiveTool] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const { toast } = useToast();
  const { setCollapsed, setLockCollapsed } = useSidebarState();
  const searchString = useSearch();

  // Prefer icon-rail layout on project pages (stops ModuleShell from auto-expanding).
  // User can still expand/collapse via the sidebar chevron — toggle clears the lock.
  useEffect(() => {
    setLockCollapsed(true);
    setCollapsed(true);
    return () => setLockCollapsed(false);
  }, [projectId, setCollapsed, setLockCollapsed]);

  const { data: project, isLoading: projectLoading } = useQuery<any>({
    queryKey: ["/api/pm/projects", projectId],
  });

  const { data: projectTools = [], isLoading: toolsLoading } = useQuery<any[]>({
    queryKey: ["/api/pm/projects", projectId, "tools"],
  });

  // Prefetch badges + warm heavy tool data in background
  useEffect(() => {
    if (!projectId) return;
    void queryClient.prefetchQuery({ queryKey: ["/api/pm/projects", projectId, "tool-badges"] });
    void queryClient.prefetchQuery({ queryKey: ["/api/pm/projects", projectId, "team"] });
    void queryClient.prefetchQuery({ queryKey: ["/api/pm/projects", projectId, "tasks"] });
  }, [projectId]);

  const { data: badgeData } = useQuery<ProjectToolBadges>({
    queryKey: ["/api/pm/projects", projectId, "tool-badges"],
    enabled: !!projectId,
  });

  const updateProjectMutation = useMutation({
    mutationFn: (updates: Record<string, any>) =>
      apiRequest("PUT", `/api/pm/projects/${projectId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tool-badges"] });
    },
  });

  const enabledToolsRaw = projectTools.filter((t: any) => t.isEnabled !== false);

  const localOrder = useMemo((): string[] | null => {
    try {
      const stored = localStorage.getItem(`pm-tool-order-${projectId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [projectId]);

  const enabledToolsSorted = localOrder
    ? [...enabledToolsRaw].sort((a: any, b: any) => {
        const ai = localOrder.indexOf(a.toolType);
        const bi = localOrder.indexOf(b.toolType);
        if (ai === -1 && bi === -1) {
          const mi = MASTER_TOOL_ORDER.indexOf(a.toolType);
          const mj = MASTER_TOOL_ORDER.indexOf(b.toolType);
          return (mi === -1 ? 999 : mi) - (mj === -1 ? 999 : mj);
        }
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
    : enabledToolsRaw;
  const enabledTools = useMemo(() => {
    const coalesced = coalesceAgileTools(enabledToolsSorted);
    const withAlways = [...coalesced];
    // Always-on tools: Overview + Status Reporting + 360° even if missing from DB for older projects
    for (const id of ["360_report", "status_reporting", "project_dashboard"] as const) {
      if (!withAlways.some((t: any) => t.toolType === id)) {
        withAlways.unshift({
          id: -Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)),
          toolType: id,
          isEnabled: true,
          label: null,
          toolCategory: "reporting_dashboards",
        });
      }
    }
    return withAlways;
  }, [enabledToolsSorted]);

  const lastUsedTool = useMemo(() => {
    try {
      return localStorage.getItem(`pm-last-tool-${projectId}`) || "";
    } catch {
      return "";
    }
  }, [projectId]);

  // Prefer last-used / Overview over Gantt so workspace open stays snappy
  const preferredDefault =
    (lastUsedTool && enabledTools.find((t: any) => t.toolType === lastUsedTool)?.toolType) ||
    enabledTools.find((t: any) => t.toolType === "project_dashboard")?.toolType ||
    enabledTools.find((t: any) => t.toolType === "360_report")?.toolType ||
    enabledTools.find((t: any) => t.toolType === "gantt_chart")?.toolType ||
    enabledTools.find((t: any) => t.toolType === "agile")?.toolType ||
    enabledTools[0]?.toolType ||
    "";
  const currentActiveTool = activeTool || (!toolsLoading ? preferredDefault : "");
  const activeToolDef = currentActiveTool ? findToolDefinition(currentActiveTool) : null;
  const activeToolTitle =
    currentActiveTool === "project_dashboard"
      ? "Overview"
      : currentActiveTool === "agile" || LEGACY_AGILE_TOOL_ID_SET.has(currentActiveTool)
        ? "Agile"
        : activeToolDef?.name || currentActiveTool;
  const activeSubtitle = currentActiveTool
    ? buildToolSubtitle(currentActiveTool, project || {}, badgeData)
    : "";

  const selectTool = useCallback(
    (toolType: string) => {
      setActiveTool(toolType);
      if (!toolType) return;
      try {
        localStorage.setItem(`pm-last-tool-${projectId}`, toolType);
      } catch {
        /* ignore */
      }
    },
    [projectId],
  );

  // Deep-link from 360 report (and elsewhere): /modules/projects/:id?tool=issues_log
  useEffect(() => {
    const tool = new URLSearchParams(searchString).get("tool");
    if (!tool) return;
    selectTool(tool);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("tool");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch {
      /* ignore */
    }
  }, [projectId, selectTool, searchString]);

  const workspaceContentRef = useRef<HTMLDivElement>(null);
  const [isWorkspaceFullscreen, setIsWorkspaceFullscreen] = useState(false);

  const toggleWorkspaceFullscreen = useCallback(() => {
    const el = workspaceContentRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFSChange = () => {
      const el = workspaceContentRef.current;
      setIsWorkspaceFullscreen(!!document.fullscreenElement && document.fullscreenElement === el);
    };
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, []);

  // Keep heavy tools mounted after first visit so switching back is instant
  const KEEP_ALIVE = useMemo(() => new Set(["gantt_chart", "agile"]), []);
  const [keptAlive, setKeptAlive] = useState<string[]>([]);
  useEffect(() => {
    if (!currentActiveTool || !KEEP_ALIVE.has(currentActiveTool)) return;
    setKeptAlive((prev) => (prev.includes(currentActiveTool) ? prev : [...prev, currentActiveTool]));
  }, [currentActiveTool, KEEP_ALIVE]);

  const addToolMutation = useMutation({
    mutationFn: async (toolId: string) => {
      const toolDef = findToolDefinition(toolId);
      await apiRequest("POST", `/api/pm/projects/${projectId}/tools/bulk`, {
        tools: [{
          toolType: toolId,
          toolCategory: toolDef?.category || "planning_scheduling",
          label: toolDef?.name || toolId,
          sortOrder: enabledTools.length,
        }],
      });
    },
    onSuccess: (_data, toolId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tool-badges"] });
      selectTool(toolId);
      toast({ title: "Tool added" });
    },
  });

  const removeToolMutation = useMutation({
    mutationFn: async (toolRecord: any) => {
      if (!toolRecord?.id || toolRecord.id < 0) {
        throw new Error("Cannot remove built-in tool");
      }
      if (toolRecord.toolType === "agile") {
        const toRemove = enabledToolsRaw.filter(
          (t: any) => t.toolType === "agile" || LEGACY_AGILE_TOOL_ID_SET.has(t.toolType),
        );
        await Promise.all(toRemove.map((t: any) => apiRequest("DELETE", `/api/pm/project-tools/${t.id}`)));
        return toolRecord;
      }
      await apiRequest("DELETE", `/api/pm/project-tools/${toolRecord.id}`);
      return toolRecord;
    },
    onSuccess: (_data, toolRecord) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tool-badges"] });
      if (currentActiveTool === toolRecord.toolType || (toolRecord.toolType === "agile" && LEGACY_AGILE_TOOL_ID_SET.has(currentActiveTool))) {
        selectTool("");
      }
      toast({ title: "Tool removed" });
    },
  });

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-from-detail">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <p className="text-center text-muted-foreground mt-12">Project not found</p>
      </div>
    );
  }

  const ActiveIcon = activeToolDef?.icon;

  return (
    <div className="flex h-full w-full max-w-full overflow-hidden" style={{ minWidth: 0 }} data-testid="project-detail-view">
      <ProjectWorkspaceSidebar
        project={project}
        enabledTools={enabledTools}
        activeTool={currentActiveTool}
        onSelectTool={selectTool}
        onBack={() => {
          setLockCollapsed(false);
          setCollapsed(false);
          onBack();
        }}
        onOpenSettings={() => setShowSettings(true)}
        onSaveAsTemplate={() => setShowSaveTemplate(true)}
        onAddTool={(toolId) => addToolMutation.mutate(toolId)}
        onRemoveTool={(tool) => removeToolMutation.mutate(tool)}
        addingTool={addToolMutation.isPending}
      />

      <div
        ref={workspaceContentRef}
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden min-h-0 bg-[#F0F2FF]/40 dark:bg-background",
          isWorkspaceFullscreen && "bg-background",
        )}
      >
        <div
          className="flex h-11 flex-shrink-0 items-center gap-2 border-b border-border bg-card px-4"
          data-testid="project-content-topbar"
        >
          {ActiveIcon && <ActiveIcon className="h-4 w-4 flex-shrink-0 text-indigo-600" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold text-foreground">
              {toolsLoading ? "Loading…" : activeToolTitle || "Select a tool"}
            </div>
            {activeSubtitle && (
              <div className="truncate text-[11px] font-medium text-muted-foreground">
                {activeSubtitle}
              </div>
            )}
          </div>
          <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={toggleWorkspaceFullscreen}
              title={isWorkspaceFullscreen ? "Exit fullscreen" : "Fullscreen"}
              aria-label={isWorkspaceFullscreen ? "Exit fullscreen" : "Fullscreen"}
              data-testid="button-project-tool-fullscreen"
            >
              {isWorkspaceFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px] font-semibold"
              onClick={() => setShowSettings(true)}
              data-testid="button-topbar-settings"
            >
              Settings
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid="button-project-more">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowSaveTemplate(true)} data-testid="menu-save-project-template">
                  <LayoutTemplate className="h-4 w-4 mr-2" /> Save as Template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSettings(true)} data-testid="menu-project-settings">
                  <SettingsGearIcon className="h-4 w-4 mr-2" /> Project settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      <SaveAsPlatformTemplateDialog
        open={showSaveTemplate}
        onOpenChange={setShowSaveTemplate}
        endpoint={`/api/pm/projects/${projectId}/save-as-template`}
        defaultName={project.name}
        defaultDescription={project.description ?? ""}
      />

      {showSettings ? (
        <ProjectSettingsPanel
          project={project}
          updateProjectMutation={updateProjectMutation}
          toast={toast}
          onClose={() => setShowSettings(false)}
        />
      ) : (
        <div
          className={cn(
              "flex-1 min-h-0",
              currentActiveTool === "gantt_chart" ||
              currentActiveTool === "agile" ||
              currentActiveTool === "tracking_board" ||
              currentActiveTool === "360_report" ||
              currentActiveTool === "status_reporting" ||
              LEGACY_AGILE_TOOL_ID_SET.has(currentActiveTool)
                ? "overflow-hidden flex flex-col p-4"
              : "overflow-y-auto overflow-x-hidden p-4"
          )}
          style={{ minWidth: 0 }}
          data-testid="tool-content-area"
        >
          {currentActiveTool ? (
              <>
                {[
                  ...new Set([
                    ...keptAlive,
                    ...(KEEP_ALIVE.has(currentActiveTool) ? [currentActiveTool] : []),
                  ]),
                ].map((toolId) => (
                  <div
                    key={`keep-${toolId}`}
                    className={cn(
                      toolId === currentActiveTool
                        ? currentActiveTool === "gantt_chart" ||
                          currentActiveTool === "agile" ||
                          currentActiveTool === "tracking_board" ||
                          currentActiveTool === "360_report" ||
                          currentActiveTool === "status_reporting" ||
                          LEGACY_AGILE_TOOL_ID_SET.has(currentActiveTool)
                          ? "relative flex-1 min-h-0 flex flex-col overflow-hidden"
                          : undefined
                        : "hidden"
                    )}
                    aria-hidden={toolId !== currentActiveTool}
                  >
                    <ToolPlaceholder
                      toolId={toolId}
                      project={project}
                      onNavigateTool={selectTool}
                    />
                  </div>
                ))}
                {!KEEP_ALIVE.has(currentActiveTool) && (
                  <ToolPlaceholder
                    toolId={currentActiveTool}
                    project={project}
                    onNavigateTool={selectTool}
                  />
                )}
              </>
          ) : (
            <div className="text-center text-muted-foreground py-16">
                {toolsLoading ? (
                  <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin opacity-50" />
                ) : (
              <PmProjectIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                )}
                <p className="text-sm">{toolsLoading ? "Loading tools…" : "Select or add a tool to get started"}</p>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function SettingsField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SettingsCard({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  const borderColor = accent || "#e5e7eb";
  return (
    <div className="rounded-lg border bg-card overflow-hidden" style={{ borderTopWidth: 3, borderTopColor: borderColor }}>
      <div className="px-4 py-2.5 border-b border-border bg-muted/20">
        <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent || undefined }}>{title}</h4>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}

const SI = "w-full px-2.5 py-[7px] border rounded-md text-[12.5px] bg-background outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";
const SS = "w-full px-2.5 py-[7px] border rounded-md text-[12.5px] bg-background cursor-pointer focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";
const STA = "w-full px-2.5 py-[7px] border rounded-md text-[12.5px] bg-background outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 min-h-[60px] resize-y transition-colors";

const SETTINGS_TABS = [
  { id: "general", label: "General", color: "#1E88C8", Icon: SettingsGeneralIcon },
  { id: "people", label: "People & Governance", color: "#7C3AED", Icon: SettingsPeopleIcon },
  { id: "financial", label: "Financial", color: "#22C55E", Icon: SettingsFinancialIcon },
  { id: "schedule", label: "Schedule", color: "#F59E0B", Icon: SettingsScheduleIcon },
  { id: "strategy", label: "Strategy", color: "#EC4899", Icon: SettingsStrategyIcon },
  { id: "risk", label: "Risk & Commercial", color: "#EF4444", Icon: SettingsRiskIcon },
  { id: "tags", label: "Tags", color: "#6366F1", Icon: SettingsTagsIcon },
] as const;

function RagBadge({ value }: { value: string }) {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    green: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
    red: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  };
  const c = colors[value] || colors.green;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  );
}

function ProjectSettingsPanel({ project, updateProjectMutation, toast, onClose }: {
  project: any;
  updateProjectMutation: any;
  toast: (opts: any) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<string>("general");

  const save = (field: string, value: any, label?: string) => {
    updateProjectMutation.mutate({ [field]: value }, {
      onSuccess: () => toast({ title: label || "Updated" }),
    });
  };

  const textField = (field: string, label: string, placeholder?: string) => (
    <SettingsField label={label}>
      <input className={SI} defaultValue={project[field] || ""} placeholder={placeholder} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (project[field] || "")) save(field, v || null, `${label} updated`); }} data-testid={`input-settings-${field}`} />
    </SettingsField>
  );

  const selectField = (field: string, label: string, options: { value: string; label: string }[], allowEmpty?: boolean) => (
    <SettingsField label={label}>
      <select className={SS} defaultValue={project[field] || ""} onChange={(e) => save(field, e.target.value || null, `${label} updated`)} data-testid={`select-settings-${field}`}>
        {allowEmpty && <option value="">â€” Not set â€”</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </SettingsField>
  );

  const boolField = (field: string, label: string) => (
    <SettingsField label={label}>
      <select className={SS} defaultValue={project[field] ? "true" : "false"} onChange={(e) => save(field, e.target.value === "true", `${label} updated`)} data-testid={`select-settings-${field}`}>
        <option value="false">No</option>
        <option value="true">Yes</option>
      </select>
    </SettingsField>
  );

  const dateField = (field: string, label: string) => (
    <SettingsField label={label}>
      <input type="date" className={SI} defaultValue={project[field] || ""} onChange={(e) => save(field, e.target.value || null, `${label} updated`)} data-testid={`input-settings-${field}`} />
    </SettingsField>
  );

  const ragField = (field: string, label: string) => (
    <SettingsField label={label}>
      <div className="flex items-center gap-2">
        <select className={SS + " flex-1"} defaultValue={project[field] || "green"} onChange={(e) => save(field, e.target.value, `${label} updated`)} data-testid={`select-settings-${field}`}>
          <option value="green">Green</option>
          <option value="amber">Amber</option>
          <option value="red">Red</option>
        </select>
        <RagBadge value={project[field] || "green"} />
      </div>
    </SettingsField>
  );

  const currentTabDef = SETTINGS_TABS.find(t => t.id === activeTab) || SETTINGS_TABS[0];

  const renderTab = () => {
    switch (activeTab) {
      case "general":
        return (
          <div className="space-y-5">
            <SettingsCard title="Project Identity" accent="#1E88C8">
              {textField("name", "Project Name")}
              {textField("shortName", "Short Name / Acronym", "e.g. AICUI")}
              {textField("code", "Project Code", "e.g. PRJ-001")}
              <SettingsField label="Work Type">
                <select className={SS} defaultValue={project.workType || project.projectType || "project"} onChange={(e) => save("workType", e.target.value, "Work type updated")} data-testid="select-settings-workType">
                  {[...WORK_TYPES.main, ...WORK_TYPES.extended].map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </SettingsField>
            </SettingsCard>
            <SettingsCard title="Status & Priority" accent="#1E88C8">
              {selectField("status", "Status", [
                { value: "planning", label: "Planning" }, { value: "active", label: "Active" },
                { value: "on_hold", label: "On Hold" }, { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ])}
              {ragField("ragStatus", "Overall RAG Status")}
              {selectField("priority", "Priority", [
                { value: "critical", label: "Critical" }, { value: "high", label: "High" },
                { value: "medium", label: "Medium" }, { value: "low", label: "Low" },
              ])}
              {selectField("methodology", "Delivery Model", [
                { value: "waterfall", label: "Waterfall" }, { value: "agile", label: "Agile" },
                { value: "hybrid", label: "Hybrid" },
              ])}
            </SettingsCard>
            <SettingsCard title="Executive Summary" accent="#1E88C8">
              <div className="col-span-2 lg:col-span-4">
                <SettingsField label="Description">
                  <textarea className={STA} defaultValue={project.description || ""} placeholder="Brief executive summary of the project scope, objectives, and expected outcomes..." onBlur={(e) => { const v = e.target.value.trim(); if (v !== (project.description || "")) save("description", v || null, "Description updated"); }} data-testid="textarea-settings-description" />
                </SettingsField>
              </div>
            </SettingsCard>
          </div>
        );

      case "people":
        return (
          <div className="space-y-5">
            <SettingsCard title="Key Stakeholders" accent="#7C3AED">
              {textField("executiveSponsor", "Executive Sponsor", "Name")}
              {textField("projectManager", "Project Manager", "Name")}
              {textField("businessOwner", "Business Owner", "Name")}
              {textField("deliveryOwner", "Delivery Owner / Tech Lead", "Name")}
            </SettingsCard>
            <SettingsCard title="Organisation" accent="#7C3AED">
              {textField("customer", "Primary Customer", "Customer / client name")}
              {textField("department", "Department / Business Unit", "e.g. Digital")}
            </SettingsCard>
            <SettingsCard title="Governance" accent="#7C3AED">
              {boolField("steeringCommitteeRequired", "Steering Committee Required?")}
              {selectField("governanceTier", "Governance Tier", [
                { value: "tier1_strategic", label: "Tier 1 â€” Strategic" },
                { value: "tier2_operational", label: "Tier 2 â€” Operational" },
                { value: "tier3_tactical", label: "Tier 3 â€” Tactical" },
              ], true)}
            </SettingsCard>
          </div>
        );

      case "financial":
        return (
          <div className="space-y-5">
            <SettingsCard title="Budget" accent="#22C55E">
              <SettingsField label="Budget Approved">
                <input type="number" className={SI} defaultValue={project.budget || ""} placeholder="e.g. 500000" onBlur={(e) => save("budget", e.target.value || null, "Budget updated")} data-testid="input-settings-budget" />
              </SettingsField>
              <SettingsField label="Forecast at Completion">
                <input type="number" className={SI} defaultValue={project.forecastBudget || ""} placeholder="e.g. 520000" onBlur={(e) => save("forecastBudget", e.target.value || null, "Forecast updated")} data-testid="input-settings-forecastBudget" />
              </SettingsField>
              <SettingsField label="Actuals to Date">
                <input type="number" className={SI} defaultValue={project.spentBudget || ""} placeholder="0" onBlur={(e) => save("spentBudget", e.target.value || "0", "Actuals updated")} data-testid="input-settings-spentBudget" />
              </SettingsField>
              {ragField("financialRag", "Financial RAG")}
            </SettingsCard>
            <SettingsCard title="Funding" accent="#22C55E">
              {selectField("fundingSource", "Funding Source", [
                { value: "capex", label: "CapEx" }, { value: "opex", label: "OpEx" },
                { value: "client_funded", label: "Client Funded" },
                { value: "internal_investment", label: "Internal Investment" },
              ], true)}
            </SettingsCard>
          </div>
        );

      case "schedule":
        return (
          <div className="space-y-5">
            <SettingsCard title="Planned Dates" accent="#F59E0B">
              {dateField("startDate", "Planned Start Date")}
              {dateField("endDate", "Planned End Date")}
              {dateField("baselineEndDate", "Baseline End Date")}
              {ragField("scheduleRag", "Schedule RAG")}
            </SettingsCard>
            <SettingsCard title="Actual Dates" accent="#F59E0B">
              {dateField("actualStartDate", "Actual Start Date")}
              {dateField("actualEndDate", "Actual End Date")}
            </SettingsCard>
            <SettingsCard title="Delivery" accent="#F59E0B">
              {selectField("sprintCadence", "Sprint Cadence", [
                { value: "1_week", label: "1 Week" }, { value: "2_weeks", label: "2 Weeks" },
                { value: "3_weeks", label: "3 Weeks" }, { value: "4_weeks", label: "4 Weeks" },
              ], true)}
              <SettingsField label="Progress %">
                <div className="space-y-1.5">
                  <input type="number" min={0} max={100} className={SI} defaultValue={project.progress ?? 0} onBlur={(e) => { const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)); save("progress", v, "Progress updated"); }} data-testid="input-settings-progress" />
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-[#F59E0B] transition-all duration-500" style={{ width: `${project.progress ?? 0}%` }} />
                  </div>
                </div>
              </SettingsField>
            </SettingsCard>
          </div>
        );

      case "strategy":
        return (
          <div className="space-y-5">
            <SettingsCard title="Strategic Alignment" accent="#EC4899">
              {textField("strategicObjective", "Strategic Objective", "Link to strategic goal")}
              {selectField("benefitCategory", "Benefit Category", [
                { value: "revenue", label: "Revenue Growth" },
                { value: "cost_avoidance", label: "Cost Avoidance" },
                { value: "risk_reduction", label: "Risk Reduction" },
                { value: "compliance", label: "Compliance" },
                { value: "customer_experience", label: "Customer Experience" },
                { value: "operational_efficiency", label: "Operational Efficiency" },
              ], true)}
            </SettingsCard>
            <SettingsCard title="Transformation" accent="#EC4899">
              {boolField("regulatoryDriver", "Regulatory Driver?")}
              {selectField("transformationTheme", "Transformation Theme", [
                { value: "digital", label: "Digital Transformation" },
                { value: "cost_reduction", label: "Cost Reduction" },
                { value: "growth", label: "Growth" },
                { value: "compliance", label: "Compliance" },
                { value: "innovation", label: "Innovation" },
                { value: "modernisation", label: "Modernisation" },
              ], true)}
            </SettingsCard>
          </div>
        );

      case "risk":
        return (
          <div className="space-y-5">
            <SettingsCard title="Risk & Complexity" accent="#EF4444">
              {selectField("complexityLevel", "Complexity Level", [
                { value: "low", label: "Low" }, { value: "medium", label: "Medium" },
                { value: "high", label: "High" }, { value: "strategic", label: "Strategic" },
              ])}
              {boolField("crossFunctional", "Cross-Functional?")}
              <SettingsField label="Risk Exposure Score">
                <input type="number" className={SI} defaultValue={project.riskScore ?? 0} onBlur={(e) => save("riskScore", parseInt(e.target.value) || 0, "Risk score updated")} data-testid="input-settings-riskScore" />
              </SettingsField>
            </SettingsCard>
            <SettingsCard title="Commercial" accent="#EF4444">
              {textField("customer", "Client Name", "Customer / client")}
              {selectField("contractType", "Contract Type", [
                { value: "fixed_price", label: "Fixed Price" },
                { value: "time_and_materials", label: "Time & Materials" },
                { value: "retainer", label: "Retainer" },
                { value: "internal", label: "Internal" },
              ], true)}
              {boolField("sowSigned", "SOW Signed?")}
            </SettingsCard>
          </div>
        );

      case "tags":
        return (
          <div className="space-y-5">
            <SettingsCard title="Tags & Classification" accent="#6366F1">
              <div className="col-span-2 lg:col-span-4">
                <SettingsField label="Tags">
                  <input className={SI} defaultValue={(project.tags || []).join(", ")} placeholder="Comma-separated tags e.g. digital, transformation, phase-2" onBlur={(e) => { const tags = e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean); save("tags", tags.length ? tags : null, "Tags updated"); }} data-testid="input-settings-tags" />
                </SettingsField>
              </div>
              {project.tags && project.tags.length > 0 && (
                <div className="col-span-2 lg:col-span-4">
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {project.tags.map((tag: string, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </SettingsCard>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="project-settings-panel">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: currentTabDef.color + "15" }}>
            <SettingsGearIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Project Settings</h3>
            <p className="text-[11px] text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={onClose} data-testid="button-close-settings">
          <X className="h-3.5 w-3.5" />
          Close
        </Button>
      </div>

      <div className="flex-shrink-0 border-b border-border bg-card px-2 overflow-x-auto">
        <div className="flex items-center gap-0.5">
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.Icon;
            return (
              <button
                key={tab.id}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-all bg-transparent border-0 cursor-pointer -mb-px",
                  isActive
                    ? "font-semibold"
                    : "border-b-transparent text-muted-foreground hover:text-foreground"
                )}
                style={isActive ? { borderBottomColor: tab.color, color: tab.color } : undefined}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`settings-tab-${tab.id}`}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 bg-muted/20" data-testid="settings-tab-content">
        {renderTab()}
      </div>
    </div>
  );
}

function ProjectGanttWrapper({ project }: { project: any }) {
  return (
    <div className="absolute inset-0 overflow-hidden" data-testid="gantt-chart-container">
      <ReactGanttChart projectId={project.id} />
    </div>
  );
}

function ToolPlaceholder({
  toolId,
  project,
  onNavigateTool,
}: {
  toolId: string;
  project: any;
  onNavigateTool?: (toolId: string) => void;
}) {
  const def = findToolDefinition(toolId);
  const Icon = def?.icon || PmDocumentationIcon;
  const name = def?.name || toolId;

  const renderPlaceholder = () => {
    if (toolId === "agile" || LEGACY_AGILE_TOOL_ID_SET.has(toolId)) {
      const stage: AgilePipelineStageId =
        toolId === "agile" ? "epic" : (LEGACY_AGILE_TO_STAGE[toolId] || "epic");
      return <AgileWorkspace projectId={project.id} initialStage={stage} />;
    }

    switch (toolId) {
      case "project_dashboard":
        return <ProjectOverview project={project} onNavigateTool={onNavigateTool} />;
      case "gantt_chart":
        return <ProjectGanttWrapper project={project} />;
      case "tracking_board":
        return <ProjectTrackingBoard projectId={project.id} />;
      case "risk_log":
        return <RaiddLogTool logType="risk" projectId={project.id} />;
      case "issues_log":
        return <RaiddLogTool logType="issues" projectId={project.id} />;
      case "support_tickets":
        return <HelpDeskProjectTicketsTool projectId={project.id} />;
      case "assumptions_log":
        return <RaiddLogTool logType="assumptions" projectId={project.id} />;
      case "dependencies_log":
        return <RaiddLogTool logType="dependencies" projectId={project.id} />;
      case "decisions_log":
        return <RaiddLogTool logType="decisions" projectId={project.id} />;
      case "360_report":
        return <Portfolio360ReportView projectId={project.id} />;
      case "milestone_plan":
        return <MilestoneTracker mode="project" projectId={project.id} />;
      case "deliverables_tracker":
        return <DeliverablesTracker projectId={project.id} />;
      case "change_log":
        return <PmChangeLogTool projectId={project.id} />;
      case "finance_tracker":
        return <PmFinanceTrackerTool projectId={project.id} project={project} />;
      case "sow_tracker":
        return <PmSowTrackerTool projectId={project.id} project={project} />;
      case "wbs":
        return <PmWbsTool projectId={project.id} />;
      case "status_reporting":
        return <PmStatusReportingTool projectId={project.id} project={project} />;
      case "documentation":
        return <PmDocumentationTool projectId={project.id} />;
      case "org_chart":
        return <PmTeamOrgTool projectId={project.id} />;
      case "stakeholder_map":
        return <PmStakeholderTool projectId={project.id} project={project} />;
      case "business_process_model":
        return <PmBpmTool projectId={project.id} />;
      case "whiteboard":
        return <ProjectWhiteboardTool projectId={project.id} />;
      case "raci_model":
        return <PmRaciTool projectId={project.id} />;
      case "resource_tracker":
        return <PmResourceTrackerTool projectId={project.id} />;
      case "timesheets":
        return <PmTimesheetsTool projectId={project.id} />;
      case "test_tracker":
        return <PmTestTrackerTool projectId={project.id} />;
      default:
        return (
          <Card>
            <CardContent className="p-6 text-center py-16">
              <Icon className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">{name}</h3>
              <p className="text-xs text-muted-foreground">This tool will be integrated in a future update.</p>
            </CardContent>
          </Card>
        );
    }
  };

  const isGantt = toolId === "gantt_chart";
  const isAgile = toolId === "agile" || LEGACY_AGILE_TOOL_ID_SET.has(toolId);
  const isTracking = toolId === "tracking_board";
  const isReportShell = toolId === "360_report" || toolId === "status_reporting";
  const fillHeight = isGantt || isAgile || isTracking || isReportShell;

  return (
    <div
      data-testid={`tool-panel-${toolId}`}
      className={fillHeight ? "flex-1 min-h-0 flex flex-col overflow-hidden" : ""}
    >
      <div className={fillHeight ? "relative flex-1 min-h-0 overflow-hidden" : ""}>
        <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>}>
          {renderPlaceholder()}
        </Suspense>
      </div>
    </div>
  );
}

export default function ProjectsManagementPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ projectId?: string }>();

  const [currentView, setCurrentView] = useState<ViewMode>(() =>
    params.projectId ? "project" : "dashboard"
  );
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() =>
    params.projectId ? Number(params.projectId) : null
  );

  useEffect(() => {
    if (params.projectId) {
      const id = Number(params.projectId);
      if (!isNaN(id)) {
        setSelectedProjectId(id);
        setCurrentView("project");
      }
    } else if (!params.projectId && currentView === "project") {
      setCurrentView("dashboard");
      setSelectedProjectId(null);
    }
  }, [params.projectId]);

  const { data: projects = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pm/projects"],
    staleTime: 30_000,
  });

  const handleOpenProject = (id: number) => {
    const fromList = projects.find((p: any) => p.id === id);
    if (fromList) {
      queryClient.setQueryData(["/api/pm/projects", id], fromList);
    }
    void queryClient.prefetchQuery({ queryKey: ["/api/pm/projects", id, "tools"] });
    void queryClient.prefetchQuery({ queryKey: ["/api/pm/projects", id, "tool-badges"] });
    setSelectedProjectId(id);
    setCurrentView("project");
    setLocation(`/modules/projects/${id}`);
  };

  const handleBackFromProject = () => {
    setCurrentView("dashboard");
    setSelectedProjectId(null);
    setLocation("/modules/projects");
  };

  return (
    <ModuleShell className={modulePageShellClass} mainClassName={modulePageMainClass}>
            {currentView === "dashboard" && (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <ProjectsLandingView
                projects={projects}
                isLoading={isLoading}
                onOpenProject={handleOpenProject}
                onNewProject={() => setCurrentView("new")}
              />
        </div>
            )}

            {currentView === "new" && (
        <div className="flex-1 min-h-0 h-full overflow-hidden flex flex-col">
          <CreateWorkItemWizard
                onCancel={() => setCurrentView("dashboard")}
                onComplete={() => setCurrentView("dashboard")}
              />
        </div>
            )}

            {currentView === "project" && selectedProjectId && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <ProjectDetailView
                projectId={selectedProjectId}
                onBack={handleBackFromProject}
              />
          </div>
      )}
    </ModuleShell>
  );
}
