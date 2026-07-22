import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Settings, X, Search, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  TOOL_DEFINITIONS,
  findToolDefinition,
  getPickerToolIds,
} from "@/components/projects/CreateWorkItemWizard";

type ProjectTool = {
  id: number;
  toolType: string;
  toolCategory?: string | null;
  label?: string | null;
  isEnabled?: boolean | null;
  sortOrder?: number | null;
};

type ProjectLike = {
  id: number;
  name: string;
  description?: string | null;
  status?: string | null;
  workType?: string | null;
  projectType?: string | null;
  ragStatus?: string | null;
  financialRag?: string | null;
  scheduleRag?: string | null;
  progress?: number | null;
  healthScore?: number | null;
  attention?: boolean | null;
  code?: string | null;
};

export type ToolBadgeTone = "red" | "amber" | "green" | "blue" | "gray";

export type ToolBadge = {
  label: string;
  tone: ToolBadgeTone;
  count?: number;
};

export type ProjectToolBadges = {
  healthScore: number;
  attention: boolean;
  alertCount: number;
  progress: number;
  financialRag: string;
  scheduleRag: string;
  ragStatus: string;
  badges: Record<string, ToolBadge | null>;
  teamMembers: number;
  statusReportCount: number;
};

const SECTION_ORDER = [
  "raid_governance",
  "reporting_dashboards",
  "planning_scheduling",
  "documentation_delivery",
  "resources_finance",
  "people_organisation",
] as const;

const SECTION_TITLES: Record<string, string> = {
  reporting_dashboards: "Reporting",
  raid_governance: "Governance",
  planning_scheduling: "Planning",
  resources_finance: "Resources & Finance",
  documentation_delivery: "Delivery",
  people_organisation: "People & Organisation",
};

/** Match mock placement where catalog category differs. */
const SECTION_OVERRIDES: Record<string, string> = {
  wbs: "planning_scheduling",
  raci_model: "reporting_dashboards",
};

const OVERVIEW_TOOL_IDS = ["project_dashboard", "360_report"] as const;
const ALWAYS_TOOL_IDS = new Set<string>(["project_dashboard", "360_report"]);

function toolDisplayName(toolType: string, fallback?: string | null): string {
  if (toolType === "project_dashboard") return "Overview";
  if (toolType === "agile") return "Agile";
  const def = findToolDefinition(toolType);
  return def?.name || fallback || toolType;
}

function toolSectionKey(tool: ProjectTool): string {
  if (SECTION_OVERRIDES[tool.toolType]) return SECTION_OVERRIDES[tool.toolType];
  const def = findToolDefinition(tool.toolType);
  return tool.toolCategory || def?.category || "planning_scheduling";
}

function ragTone(rag?: string | null): "g" | "a" | "r" {
  const v = (rag || "green").toLowerCase();
  if (v === "red" || v === "r") return "r";
  if (v === "amber" || v === "a" || v === "yellow") return "a";
  return "g";
}

function ragLabel(tone: "g" | "a" | "r"): string {
  return tone === "r" ? "Off track" : tone === "a" ? "Monitor" : "On track";
}

function statusLabel(status?: string | null): string {
  if (!status) return "Draft";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function typeLabel(project: ProjectLike): string {
  const raw = project.workType || project.projectType || "project";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const BADGE_TONE_CLASS: Record<ToolBadgeTone, string> = {
  red: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  blue: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  gray: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function ToolBadgeChip({ badge }: { badge: ToolBadge }) {
  return (
    <span
      className={cn(
        "ml-auto flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold leading-none",
        BADGE_TONE_CLASS[badge.tone]
      )}
    >
      {badge.label}
    </span>
  );
}

export function ProjectWorkspaceSidebar({
  project,
  enabledTools,
  activeTool,
  onSelectTool,
  onBack,
  onOpenSettings,
  onSaveAsTemplate,
  onAddTool,
  onRemoveTool,
  addingTool,
}: {
  project: ProjectLike;
  enabledTools: ProjectTool[];
  activeTool: string;
  onSelectTool: (toolType: string) => void;
  onBack: () => void;
  onOpenSettings: () => void;
  onSaveAsTemplate?: () => void;
  onAddTool: (toolId: string) => void;
  onRemoveTool: (tool: ProjectTool) => void;
  addingTool?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addQuery, setAddQuery] = useState("");

  const { data: badgeData } = useQuery<ProjectToolBadges>({
    queryKey: ["/api/pm/projects", project.id, "tool-badges"],
    enabled: !!project.id,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowAdd(true);
        setCollapsed(false);
      }
      if (e.key === "Escape" && showAdd) {
        setShowAdd(false);
        setAddQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAdd]);

  const enabledIds = useMemo(() => new Set(enabledTools.map((t) => t.toolType)), [enabledTools]);
  const healthRaw = badgeData?.healthScore ?? project.healthScore ?? 0;
  const health = Math.max(
    0,
    Math.min(100, Number.isFinite(Number(healthRaw)) ? Number(healthRaw) : 0),
  );
  const progressRaw = badgeData?.progress ?? project.progress ?? 0;
  const progress = Math.max(
    0,
    Math.min(100, Number.isFinite(Number(progressRaw)) ? Number(progressRaw) : 0),
  );
  const healthTone = ragTone(badgeData?.ragStatus ?? project.ragStatus);
  const bgt = ragTone(badgeData?.financialRag ?? project.financialRag ?? project.ragStatus);
  const sch = ragTone(badgeData?.scheduleRag ?? project.scheduleRag ?? project.ragStatus);
  const scp = ragTone(badgeData?.ragStatus ?? project.ragStatus);
  const alertCount = badgeData?.alertCount ?? (project.attention ? 1 : 0);
  const badges = badgeData?.badges ?? {};

  const { overviewTools, sections } = useMemo(() => {
    const overview = OVERVIEW_TOOL_IDS.map((id) => enabledTools.find((t) => t.toolType === id)).filter(
      Boolean
    ) as ProjectTool[];
    const overviewSet = new Set(overview.map((t) => t.toolType));
    const byCat = new Map<string, ProjectTool[]>();
    for (const tool of enabledTools) {
      if (overviewSet.has(tool.toolType)) continue;
      const cat = toolSectionKey(tool);
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(tool);
    }
    const secs = SECTION_ORDER.filter((k) => (byCat.get(k)?.length ?? 0) > 0).map((k) => ({
      key: k,
      title: SECTION_TITLES[k] || TOOL_DEFINITIONS[k]?.title || k,
      tools: byCat.get(k) || [],
    }));
    return { overviewTools: overview, sections: secs };
  }, [enabledTools]);

  const allToolsForModal = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    return getPickerToolIds()
      .map((id) => ({ id, def: findToolDefinition(id), active: enabledIds.has(id) }))
      .filter((x) => x.def)
      .filter((x) => !q || x.def!.name.toLowerCase().includes(q) || x.id.includes(q));
  }, [enabledIds, addQuery]);

  const modalByCat = useMemo(() => {
    const map = new Map<string, typeof allToolsForModal>();
    for (const item of allToolsForModal) {
      const cat = SECTION_OVERRIDES[item.id] || item.def!.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return SECTION_ORDER.filter((k) => map.has(k)).map((k) => ({
      key: k,
      title: SECTION_TITLES[k] || TOOL_DEFINITIONS[k]?.title || k,
      tools: map.get(k)!,
    }));
  }, [allToolsForModal]);

  const renderToolRow = (tool: ProjectTool) => {
    const def = findToolDefinition(tool.toolType);
    const Icon = def?.icon;
    const on = activeTool === tool.toolType;
    const always = ALWAYS_TOOL_IDS.has(tool.toolType);
    const badge = badges[tool.toolType] ?? null;
    return (
      <div key={tool.toolType} className="group relative">
        <button
          type="button"
          onClick={() => onSelectTool(tool.toolType)}
          className={cn(
            "flex w-full items-center gap-2 border-0 border-l-2 px-3 py-1.5 text-left transition-colors",
            on
              ? "border-l-indigo-600 bg-indigo-50 text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-100"
              : "border-l-transparent text-foreground/80 hover:bg-muted/60"
          )}
          data-testid={`tool-tab-${tool.toolType}`}
        >
          <span
            className={cn(
              "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md",
              on ? "bg-indigo-100 dark:bg-indigo-900/40" : "bg-muted/70"
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="text-[11px]">•</span>}
          </span>
          <span className={cn("min-w-0 flex-1 truncate text-xs font-semibold leading-tight", on && "font-bold")}>
            {toolDisplayName(tool.toolType, tool.label)}
          </span>
          {badge ? <ToolBadgeChip badge={badge} /> : null}
          {!badge && always ? (
            <span className="h-1 w-1 flex-shrink-0 rounded-full bg-emerald-500" title="Always available" />
          ) : null}
        </button>
        {!always && (
          <button
            type="button"
            className="absolute right-1.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-muted text-[10px] text-muted-foreground hover:bg-destructive hover:text-destructive-foreground group-hover:flex"
            title="Remove tool"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveTool(tool);
            }}
            data-testid={`button-remove-tool-${tool.toolType}`}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  if (collapsed) {
    return (
      <aside
        className="relative flex w-[52px] flex-shrink-0 flex-col items-center border-r border-border bg-card py-3"
        data-testid="project-workspace-sidebar-collapsed"
      >
        <button
          type="button"
          className="mb-3 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted"
          onClick={() => setCollapsed(false)}
          title="Expand project tools"
          aria-label="Expand project tools"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="mb-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
          onClick={onBack}
          title="All projects"
        >
          ‹
        </button>
        <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-1">
          {enabledTools.map((tool) => {
            const def = findToolDefinition(tool.toolType);
            const Icon = def?.icon;
            const on = activeTool === tool.toolType;
            return (
              <button
                key={tool.toolType}
                type="button"
                title={toolDisplayName(tool.toolType, tool.label)}
                onClick={() => onSelectTool(tool.toolType)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border-0",
                  on
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs">•</span>}
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="relative flex w-[228px] flex-shrink-0 flex-col overflow-hidden border-r border-border bg-card"
      data-testid="project-workspace-sidebar"
    >
      <button
        type="button"
        className="absolute -right-2.5 top-1/2 z-20 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-[10px] text-muted-foreground shadow-sm hover:bg-indigo-50 hover:text-indigo-700"
        onClick={() => setCollapsed(true)}
        title="Collapse sidebar"
        aria-label="Collapse project sidebar"
      >
        ‹
      </button>

      <div className="flex-shrink-0 bg-gradient-to-b from-[#1E1B4B] to-[#1e1458] px-3.5 pb-3 pt-3.5 text-white">
        <button
          type="button"
          onClick={onBack}
          className="mb-2.5 flex items-center gap-1 border-0 bg-transparent p-0 text-[11px] font-semibold text-white/50 hover:text-white/85"
          data-testid="button-back-from-detail"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All projects
        </button>
        <div className="mb-1.5 text-[13px] font-extrabold leading-snug" data-testid="text-project-name">
          {project.name}
        </div>
        <div className="mb-2.5 flex flex-wrap gap-1">
          <span className="rounded-full bg-white/12 px-2 py-0.5 text-[9px] font-bold text-white/80">
            {typeLabel(project)}
          </span>
          <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[9px] font-bold text-emerald-200">
            ● {statusLabel(project.status)}
          </span>
          {alertCount > 0 && (
            <span
              className="rounded-full bg-red-500/25 px-2 py-0.5 text-[9px] font-bold text-red-200"
              data-testid="project-alert-badge"
            >
              ⚠ {alertCount} alert{alertCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-[3px] text-[11px] font-black",
              healthTone === "r" && "border-red-400 bg-red-500/15 text-red-300",
              healthTone === "a" && "border-amber-400 bg-amber-500/15 text-amber-300",
              healthTone === "g" && "border-emerald-400 bg-emerald-500/15 text-emerald-300"
            )}
            title="Health score"
            data-testid="project-health-score"
          >
            {health}
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            {(
              [
                ["Bgt", bgt],
                ["Sch", sch],
                ["Scp", scp],
              ] as const
            ).map(([label, tone]) => (
              <div key={label} className="flex items-center gap-1 text-[9px] font-bold">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    tone === "r" && "bg-red-400",
                    tone === "a" && "bg-amber-400",
                    tone === "g" && "bg-emerald-400"
                  )}
                />
                <span className="min-w-[22px] text-white/45">{label}</span>
                <span
                  className={cn(
                    tone === "r" && "text-red-300",
                    tone === "a" && "text-amber-300",
                    tone === "g" && "text-emerald-300"
                  )}
                >
                  {ragLabel(tone)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2.5 border-t border-white/10 pt-2.5">
          <div className="mb-1 flex justify-between text-[9px] font-bold text-white/40">
            <span>Progress</span>
            <span>{progress}% complete</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-sm bg-white/10">
            <div className="h-full rounded-sm bg-indigo-400" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2" data-testid="project-tool-nav">
        {overviewTools.length === 0 && sections.length === 0 && (
          <p className="px-3.5 py-6 text-center text-xs text-muted-foreground">No tools enabled yet.</p>
        )}
        {overviewTools.length > 0 && (
          <div className="mb-0.5">{overviewTools.map(renderToolRow)}</div>
        )}
        {sections.map((section) => (
          <div key={section.key} className="mb-0.5">
            <div className="px-3.5 pb-1 pt-2 text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground/80">
              {section.title}
            </div>
            {section.tools.map(renderToolRow)}
          </div>
        ))}
      </nav>

      <div className="flex flex-shrink-0 items-center gap-1 border-t border-border/70">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
          onClick={() => setShowAdd(true)}
          data-testid="button-add-tool"
        >
          <Plus className="h-3.5 w-3.5" />
          Add tool
        </button>
        {onSaveAsTemplate && (
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md border-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onSaveAsTemplate}
            title="Save as template"
            data-testid="button-save-as-template"
          >
            <LayoutTemplate className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          className="mr-1.5 flex h-8 w-8 items-center justify-center rounded-md border-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onOpenSettings}
          title="Project settings"
          data-testid="button-project-settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {showAdd && (
        <div className="absolute inset-0 z-30 flex flex-col bg-card shadow-xl" data-testid="more-tools-drawer">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
            <h4 className="text-xs font-extrabold">Add tool to this project</h4>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
              onClick={() => {
                setShowAdd(false);
                setAddQuery("");
              }}
              data-testid="button-close-more-tools"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="border-b border-border/60 px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                placeholder="Search tools…"
                className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-indigo-500"
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {modalByCat.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">No tools match your search.</p>
            )}
            {modalByCat.map((section) => (
              <div key={section.key}>
                <div className="px-3.5 pb-1 pt-2 text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground/80">
                  {section.title}
                </div>
                {section.tools.map(({ id, def, active }) => {
                  const Icon = def!.icon;
                  return (
                    <div key={id} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted/50">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 text-xs font-semibold">{def!.name}</span>
                      {active ? (
                        <span className="text-[10px] font-bold text-emerald-600">✓ Active</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 border-indigo-500 px-2 text-[10px] font-bold text-indigo-600"
                          disabled={addingTool}
                          onClick={() => {
                            onAddTool(id);
                            setShowAdd(false);
                            setAddQuery("");
                          }}
                          data-testid={`button-add-tool-${id}`}
                        >
                          + Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export default ProjectWorkspaceSidebar;
