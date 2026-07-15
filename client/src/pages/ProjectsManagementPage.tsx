import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ModuleShell } from "@/components/ModuleShell";
import { cn } from "@/lib/utils";
import { ProjectsLandingView } from "@/components/projects/ProjectsLanding";
import {
  CreateWorkItemWizard,
  WORK_TYPES,
  MASTER_TOOL_ORDER,
  findToolDefinition,
  getAllToolIds,
} from "@/components/projects/CreateWorkItemWizard";

const AgileBoard = lazy(() => import("@/components/projects/AgileBoard"));
const AgileDashboard = lazy(() => import("@/components/projects/AgileDashboard"));
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
const PmStatusReportingTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmStatusReportingTool })));
const PmChangeLogTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmChangeLogTool })));
const PmDocumentationTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmDocumentationTool })));
const PmTestTrackerTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmTestTrackerTool })));
const PmStakeholderTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmStakeholderTool })));
const PmBpmTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmBpmTool })));
const PmSowTrackerTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmSowTrackerTool })));
const PmWbsTool = lazy(() => import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmWbsTool })));

import {
  Plus,
  ChevronRight,
  Loader2,
  X,
  Maximize2,
  Minimize2,
  ChevronLeft,
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

type ViewMode = "dashboard" | "new" | "edit" | "project";

const TYPE_COLORS: Record<string, string> = {
  programme: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  project: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  poc: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  campaign: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  pilot: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  initiative: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  sprint: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  change_request: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  portfolio: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  sub_project: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  user_defined: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const LEGACY_TYPE_MAP: Record<string, string> = {
  simple_board: "project",
  business_initiative: "initiative",
  small_project: "project",
  large_project: "programme",
};

function getWorkTypeLabel(type: string): string {
  const allTypes = [...WORK_TYPES.main, ...WORK_TYPES.extended];
  const found = allTypes.find((t) => t.id === type);
  return found?.name || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_COLORS: Record<string, { bg: string; dot: string }> = {
  active: { bg: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", dot: "bg-green-500" },
  planning: { bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", dot: "bg-yellow-500" },
  draft: { bg: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", dot: "bg-gray-400" },
  on_hold: { bg: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", dot: "bg-orange-500" },
  completed: { bg: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", dot: "bg-green-600" },
  cancelled: { bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", dot: "bg-red-500" },
};

const HEALTH_CONFIG: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  green: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", label: "On Track", dot: "bg-green-500" },
  amber: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", label: "At Risk", dot: "bg-amber-500" },
  red: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", label: "Off Track", dot: "bg-red-500" },
  blue: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "Not Started", dot: "bg-blue-500" },
};

function TypeBadge({ type }: { type: string | null | undefined }) {
  const raw = type || "project";
  const t = LEGACY_TYPE_MAP[raw] || raw;
  const colors = TYPE_COLORS[t] || TYPE_COLORS.project;
  const label = getWorkTypeLabel(t);
  return (
    <Badge variant="outline" className={cn("text-xs font-semibold border-0 rounded-full", colors)} data-testid={`badge-type-${t}`}>
      {label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status || "draft";
  const config = STATUS_COLORS[s] || STATUS_COLORS.draft;
  const label = s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  return (
    <Badge variant="outline" className={cn("text-xs font-semibold border-0 rounded-full gap-1.5", config.bg)} data-testid={`badge-status-${s}`}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {label}
    </Badge>
  );
}

function HealthPill({ health }: { health: string | null | undefined }) {
  const h = health || "green";
  const config = HEALTH_CONFIG[h] || HEALTH_CONFIG.green;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap", config.bg, config.text)} data-testid={`health-${h}`}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

function ProjectDetailView({
  projectId,
  onBack,
}: {
  projectId: number;
  onBack: () => void;
}) {
  const [activeTool, setActiveTool] = useState<string>("");
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [dragTabIdx, setDragTabIdx] = useState<number | null>(null);
  const [dragOverTabIdx, setDragOverTabIdx] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<any>({
    queryKey: ["/api/pm/projects", projectId],
  });

  const { data: projectTools = [], isLoading: toolsLoading } = useQuery<any[]>({
    queryKey: ["/api/pm/projects", projectId, "tools"],
  });

  const updateProjectMutation = useMutation({
    mutationFn: (updates: Record<string, any>) =>
      apiRequest("PUT", `/api/pm/projects/${projectId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects"] });
    },
  });

  const handleRenameSubmit = () => {
    const trimmed = editNameValue.trim();
    if (!trimmed || trimmed === project?.name) {
      setEditingName(false);
      return;
    }
    updateProjectMutation.mutate({ name: trimmed }, {
      onSuccess: () => {
        toast({ title: "Project renamed" });
        setEditingName(false);
      },
      onError: () => {
        toast({ title: "Failed to rename project", variant: "destructive" });
        setEditingName(false);
      },
    });
  };

  const startEditing = () => {
    setEditNameValue(project?.name || "");
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const enabledToolsRaw = projectTools.filter((t: any) => t.isEnabled !== false);

  const getLocalOrder = (): string[] | null => {
    try {
      const stored = localStorage.getItem(`pm-tool-order-${projectId}`);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  };

  const localOrder = getLocalOrder();
  const enabledTools = localOrder
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

  const allToolIds = getAllToolIds();
  const enabledToolIds = enabledTools.map((t: any) => t.toolType);
  const unennabledToolIds = allToolIds.filter((id) => !enabledToolIds.includes(id));

  const currentActiveTool = activeTool || enabledTools[0]?.toolType || "";

  const updateScrollArrows = useCallback(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const check = () => updateScrollArrows();
    check();
    const raf = requestAnimationFrame(check);
    const t = setTimeout(check, 100);
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child as Element);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [updateScrollArrows, enabledTools.length]);

  const scrollTabs = useCallback((dir: "left" | "right") => {
    const el = tabsScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? 200 : -200, behavior: "smooth" });
  }, []);

  const reorderMutation = useMutation({
    mutationFn: async (newOrder: any[]) => {
      await apiRequest("PUT", `/api/pm/projects/${projectId}/tools/reorder`, {
        order: newOrder.map((t: any, i: number) => ({ id: t.id, sortOrder: i })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tools"] });
    },
  });

  const handleTabDragStart = (idx: number) => {
    setDragTabIdx(idx);
  };

  const handleTabDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverTabIdx(idx);
  };

  const handleTabDrop = (idx: number) => {
    if (dragTabIdx === null || dragTabIdx === idx) {
      setDragTabIdx(null);
      setDragOverTabIdx(null);
      return;
    }
    const reordered = [...enabledTools];
    const [moved] = reordered.splice(dragTabIdx, 1);
    reordered.splice(idx, 0, moved);
    const newOrder = reordered.map((t: any) => t.toolType);
    localStorage.setItem(`pm-tool-order-${projectId}`, JSON.stringify(newOrder));
    reorderMutation.mutate(reordered);
    setDragTabIdx(null);
    setDragOverTabIdx(null);
  };

  const handleTabDragEnd = () => {
    setDragTabIdx(null);
    setDragOverTabIdx(null);
  };

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tools"] });
    },
  });

  const removeToolMutation = useMutation({
    mutationFn: async (toolRecord: any) => {
      await apiRequest("DELETE", `/api/pm/project-tools/${toolRecord.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tools"] });
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

  return (
    <div className="flex flex-col h-full overflow-hidden w-full max-w-full" style={{ minWidth: 0 }} data-testid="project-detail-view">
      <div className="flex-shrink-0 border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={onBack} data-testid="button-back-from-detail">
            <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Back
          </Button>
          {editingName ? (
            <input
              ref={nameInputRef}
              className="text-sm font-bold text-foreground bg-muted border border-primary rounded px-2 py-0.5 outline-none min-w-[180px]"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setEditingName(false);
              }}
              data-testid="input-rename-project"
            />
          ) : (
            <h2
              className="text-sm font-bold text-foreground cursor-pointer hover:bg-muted/50 rounded px-1.5 py-0.5 transition-colors"
              onDoubleClick={startEditing}
              title="Double-click to rename"
              data-testid="text-project-name"
            >
              {project.name}
            </h2>
          )}
          <TypeBadge type={project.workType || project.projectType} />
          <HealthPill health={project.ragStatus} />
          <StatusBadge status={project.status} />
          <div className="ml-auto flex items-center gap-1">
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
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowSettings(!showSettings)} data-testid="button-project-settings"><SettingsGearIcon className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
      <SaveAsPlatformTemplateDialog
        open={showSaveTemplate}
        onOpenChange={setShowSaveTemplate}
        endpoint={`/api/pm/projects/${projectId}/save-as-template`}
        defaultName={project.name}
        defaultDescription={project.description ?? ""}
      />

      <div className="flex-shrink-0 flex items-center border-b border-border bg-card sticky top-0 z-40 overflow-hidden" data-testid="tool-tabs-bar">
        {canScrollLeft && (
          <button
            onClick={() => scrollTabs("left")}
            className="flex-shrink-0 flex items-center justify-center w-7 h-full border-0 cursor-pointer bg-card hover:bg-muted transition-colors"
            data-testid="button-scroll-tabs-left"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <div
          ref={tabsScrollRef}
          className="flex items-center overflow-x-auto flex-1 px-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", minWidth: 0, width: 0 } as React.CSSProperties}
        >
          {toolsLoading ? (
            <div className="flex items-center gap-2 py-2 px-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading toolsâ€¦</span>
            </div>
          ) : enabledTools.map((tool: any, idx: number) => {
            const def = findToolDefinition(tool.toolType);
            const Icon = def?.icon || PmDocumentationIcon;
            const isActive = currentActiveTool === tool.toolType;
            const isDragging = dragTabIdx === idx;
            const isDragOver = dragOverTabIdx === idx && dragTabIdx !== idx;
            return (
              <div key={tool.toolType} className="relative flex-shrink-0 group">
                <button
                  draggable
                  onDragStart={() => handleTabDragStart(idx)}
                  onDragOver={(e) => handleTabDragOver(e, idx)}
                  onDrop={() => handleTabDrop(idx)}
                  onDragEnd={handleTabDragEnd}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors bg-transparent border-0 cursor-grab -mb-px select-none",
                    isActive
                      ? "border-b-[#2563eb] text-[#2563eb] font-semibold"
                      : "border-b-transparent text-muted-foreground hover:text-foreground",
                    isDragging && "opacity-40",
                    isDragOver && "border-b-[#2563eb]/50"
                  )}
                  style={isDragOver ? { borderLeftWidth: 2, borderLeftColor: "#2563eb", borderLeftStyle: "solid" } : undefined}
                  onClick={() => setActiveTool(tool.toolType)}
                  data-testid={`tool-tab-${tool.toolType}`}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {def?.name || tool.label || tool.toolType}
                </button>
                <button
                  className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground text-[10px] border-0 cursor-pointer"
                  title="Remove tool"
                  onClick={(e) => { e.stopPropagation(); removeToolMutation.mutate(tool); }}
                  data-testid={`button-remove-tool-${tool.toolType}`}
                >
                  Ã—
                </button>
              </div>
            );
          })}
          {enabledTools.length === 0 && !toolsLoading && (
            <span className="text-xs text-muted-foreground py-2">No tools enabled. Add tools to get started.</span>
          )}
        </div>
        {canScrollRight && (
          <button
            onClick={() => scrollTabs("right")}
            className="flex-shrink-0 flex items-center justify-center w-7 h-full border-0 cursor-pointer bg-card hover:bg-muted transition-colors"
            data-testid="button-scroll-tabs-right"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <div className="flex items-center gap-2 flex-shrink-0 pl-3 pr-4 border-l border-border">
          <button
            className="text-xs font-medium text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer whitespace-nowrap py-2"
            onClick={() => setShowMoreTools(!showMoreTools)}
            data-testid="button-more-tools"
          >
            More tools {showMoreTools ? "\u25B4" : "\u25BE"}
          </button>
          <button
            className="flex items-center gap-1 text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8] bg-transparent border-0 cursor-pointer whitespace-nowrap py-2"
            onClick={() => setShowMoreTools(true)}
            data-testid="button-add-tool"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </div>

      {showMoreTools && (
        <div className="border-b border-border bg-muted/30 p-4 overflow-x-hidden max-w-full" data-testid="more-tools-drawer">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Available Tools</h4>
            <button className="text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-0" onClick={() => setShowMoreTools(false)} data-testid="button-close-more-tools">âœ• Close</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {unennabledToolIds.map((toolId) => {
              const def = findToolDefinition(toolId);
              if (!def) return null;
              const Icon = def.icon;
              return (
                <div key={toolId} className="flex items-center gap-2 p-2 rounded-md bg-card border border-border/50">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs text-foreground flex-1">{def.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#2563eb] text-xs"
                    onClick={() => addToolMutation.mutate(toolId)}
                    data-testid={`button-add-tool-${toolId}`}
                  >
                    <Plus className="h-3 w-3 mr-0.5" /> Add
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            "flex-1",
            currentActiveTool === "gantt_chart"
              ? "overflow-hidden flex flex-col p-0"
              : "overflow-y-auto overflow-x-hidden p-4"
          )}
          style={{ minWidth: 0 }}
          data-testid="tool-content-area"
        >
          {currentActiveTool ? (
            <ToolPlaceholder toolId={currentActiveTool} project={project} />
          ) : (
            <div className="text-center text-muted-foreground py-16">
              <PmProjectIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">Select or add a tool to get started</p>
            </div>
          )}
        </div>
      )}
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
  // CSS height:100% cascading is broken inside Radix ScrollArea (which renders
  // a display:table wrapper internally). JS-calculated height bypasses this
  // entirely â€” window.innerHeight minus the fixed pixel overhead above the Gantt:
  //   Project header  (py-2 + h-7 content + border) â‰ˆ 45 px
  //   Tool tabs bar   (py-1.5 tabs + border)         â‰ˆ 37 px
  //   Tool panel hdr  (py-1.5 + h-5 icon + border)  â‰ˆ 33 px
  //   Total                                          â‰ˆ 115 px  (+15 px safety)
  const OFFSET = 130;
  const [ganttHeight, setGanttHeight] = useState<number>(() =>
    typeof window !== "undefined" ? Math.max(400, window.innerHeight - OFFSET) : 600
  );

  useEffect(() => {
    const onResize = () => setGanttHeight(Math.max(400, window.innerHeight - OFFSET));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ height: ganttHeight, width: "100%", overflow: "hidden", minWidth: 0 }} data-testid="gantt-chart-container">
      <ReactGanttChart projectId={project.id} />
    </div>
  );
}

function ToolPlaceholder({ toolId, project }: { toolId: string; project: any }) {
  const def = findToolDefinition(toolId);
  const Icon = def?.icon || PmDocumentationIcon;
  const name = def?.name || toolId;
  const toolPanelRef = useRef<HTMLDivElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const toggleMaximize = useCallback(() => {
    if (!document.fullscreenElement && toolPanelRef.current) {
      toolPanelRef.current.requestFullscreen().catch(() => {});
      setIsMaximized(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsMaximized(false);
    }
  }, []);

  useEffect(() => {
    const onFSChange = () => {
      if (!document.fullscreenElement) setIsMaximized(false);
    };
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  const renderPlaceholder = () => {
    switch (toolId) {
      case "project_dashboard":
        return <AgileDashboard projectId={project.id} />;
      case "gantt_chart":
        return <ProjectGanttWrapper project={project} />;
      case "sprint_board":
        return <AgileBoard view="board" boardMode="sprint" projectId={project.id} />;
      case "scrum_board":
        return <AgileBoard view="board" boardMode="scrum" projectId={project.id} />;
      case "kanban_board":
        return <AgileBoard view="board" boardMode="kanban" projectId={project.id} />;
      case "tracking_board":
        return <ProjectTrackingBoard projectId={project.id} />;
      case "backlog":
        return <AgileBoard view="backlog" projectId={project.id} />;
      case "epics":
        return <AgileBoard view="epics" projectId={project.id} />;
      case "stories":
        return <AgileBoard view="stories" projectId={project.id} />;
      case "sprints":
        return <AgileBoard view="sprints" projectId={project.id} />;
      case "defects":
        return <AgileBoard view="defects" projectId={project.id} />;
      case "roadmap":
        return <AgileBoard view="roadmap" projectId={project.id} />;
      case "best_practice":
        return <AgileBoard view="bestpractice" projectId={project.id} />;
      case "epics_stories":
        return <AgileBoard view="epics" projectId={project.id} />;
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

  return (
    <div
      ref={toolPanelRef}
      data-testid={`tool-panel-${toolId}`}
      className={
        isMaximized
          ? "bg-background p-4 overflow-auto"
          : isGantt
          ? "h-full flex flex-col overflow-hidden"
          : ""
      }
    >
      {/* Tool header row â€” hidden for Gantt because SVARGanttChart has its own
          compact control bar (zoom + level filter + maximize + edit). */}
      {!isGantt && (
        <div className="flex items-center justify-between gap-4 flex-wrap flex-shrink-0 mb-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <h3 className="text-sm font-bold text-foreground">{name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleMaximize} data-testid={`button-tool-fullscreen-${toolId}`}>
              {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="outline" size="sm" disabled title="Use in-tool controls to add items" data-testid={`button-tool-add-${toolId}`}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      )}
      {/* Content — for Gantt, flex-1 min-h-0 so it fills the remaining height */}
      <div className={isGantt ? "flex-1 min-h-0 overflow-hidden" : ""}>
        <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>}>
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
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);

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
    setSelectedProjectId(id);
    setCurrentView("project");
    setLocation(`/modules/projects/${id}`);
  };

  const handleEditProject = (id: number) => {
    setEditingProjectId(id);
    setCurrentView("edit");
  };

  const handleBackFromProject = () => {
    setCurrentView("dashboard");
    setSelectedProjectId(null);
    setLocation("/modules/projects");
  };

  return (
    <ModuleShell className="flex h-screen bg-background" mainClassName="flex-1 flex flex-col overflow-hidden min-h-0">
      {currentView === "dashboard" && (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <ProjectsLandingView
            projects={projects}
            isLoading={isLoading}
            onOpenProject={handleOpenProject}
            onNewProject={() => setCurrentView("new")}
            onEditProject={handleEditProject}
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

      {currentView === "edit" && editingProjectId && (
        <div className="flex-1 min-h-0 h-full overflow-hidden flex flex-col">
          <CreateWorkItemWizard
            projectId={editingProjectId}
            onCancel={() => {
              setEditingProjectId(null);
              setCurrentView("dashboard");
            }}
            onComplete={() => {
              setEditingProjectId(null);
              setCurrentView("dashboard");
            }}
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
