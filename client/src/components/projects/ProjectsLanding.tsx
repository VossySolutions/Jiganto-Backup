import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  modulePageBannerWrapClass,
  modulePageStickyHeaderClass,
  modulePageTabContentClass,
  modulePageTabsListClass,
  modulePageTabsWrapClass,
  modulePageTabTriggerClass,
  ModulePageLoading,
} from "@/components/ModulePageChrome";
import { TablePagination } from "@/components/TablePagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import { matchBoardFilterValue } from "@/lib/board-filters";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { useDebouncedValue, downloadBoardCsv, downloadImportTemplateCsv } from "@/lib/crm-monday-chrome";
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EditWorkItemPanel } from "@/components/projects/EditWorkItemPanel";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ExternalLink,
  GripVertical,
  Loader2,
  Plus,
  Pencil,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { AppKanbanBoard } from "@/components/kanban";
import {
  PmProjectIcon,
  PmStatActiveIcon,
  PmStatPlanningIcon,
  PmStatOnHoldIcon,
  PmStatCompletedIcon,
  PmStatDraftIcon,
} from "@/components/icons/ModuleIcons";

interface LandingProject {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  status?: string | null;
  workType?: string | null;
  projectType?: string | null;
  customer?: string | null;
  progress?: number | null;
  ragStatus?: string | null;
  financialRag?: string | null;
  scheduleRag?: string | null;
  methodology?: string | null;
  framework?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budget?: string | number | null;
  managerId?: string | null;
  ownerId?: string | null;
  projectManager?: string | null;
  deliveryOwner?: string | null;
  leadName?: string | null;
  pmoName?: string | null;
  portfolioName?: string | null;
  healthScore?: number | null;
  attention?: boolean;
  team?: Array<{ id: string; initials: string; firstName: string | null; lastName: string | null }>;
  metadata?: { leadName?: string } | null;
}

const MilestoneTracker = lazy(() => import("@/components/projects/MilestoneTracker"));

type LandingDisplayMode = "table" | "cards" | "kanban";

type ColumnId =
  | "type"
  | "status"
  | "customer"
  | "lead"
  | "pmo"
  | "portfolio"
  | "method"
  | "team"
  | "start"
  | "end"
  | "progress"
  | "ragBudget"
  | "ragSchedule"
  | "ragScope"
  | "score";

const COLUMN_DEFS: { id: ColumnId; label: string }[] = [
  { id: "type", label: "Type" },
  { id: "status", label: "Status" },
  { id: "customer", label: "Customer" },
  { id: "lead", label: "Lead" },
  { id: "pmo", label: "PMO Owner" },
  { id: "portfolio", label: "Portfolio" },
  { id: "method", label: "Methodology" },
  { id: "team", label: "Team" },
  { id: "start", label: "Start date" },
  { id: "end", label: "End date" },
  { id: "progress", label: "Progress" },
  { id: "ragBudget", label: "Budget RAG" },
  { id: "ragSchedule", label: "Schedule RAG" },
  { id: "ragScope", label: "Scope RAG" },
  { id: "score", label: "Health score" },
];

const COLS_STORAGE_KEY = "pm.landing.visibleColumns.v2";

const TYPE_COLORS: Record<string, string> = {
  programme: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  project: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  poc: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  campaign: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  pilot: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  initiative: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  improvement: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  prototype: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  change_request: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  portfolio: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
};

const LEGACY_TYPE_MAP: Record<string, string> = {
  simple_board: "project",
  business_initiative: "initiative",
  small_project: "project",
  large_project: "programme",
};

const STATUS_COLORS: Record<string, { bg: string; dot: string }> = {
  active: { bg: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", dot: "bg-green-500" },
  planning: { bg: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", dot: "bg-amber-500" },
  draft: { bg: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-400" },
  on_hold: { bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", dot: "bg-red-500" },
  completed: { bg: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300", dot: "bg-teal-600" },
  cancelled: { bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", dot: "bg-red-500" },
};

const RAG_CHIP: Record<string, string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const KPI_CARDS = [
  { key: "all", label: "All projects", subtitle: "Total portfolio", color: "#4338CA", filterStatus: "all", icon: null },
  { key: "active", label: "Active", subtitle: "In progress", color: "#059669", filterStatus: "active", icon: PmStatActiveIcon },
  { key: "planning", label: "Planning", subtitle: "Being scoped", color: "#D97706", filterStatus: "planning", icon: PmStatPlanningIcon },
  { key: "on_hold", label: "On hold", subtitle: "Paused · needs attention", color: "#DC2626", filterStatus: "on_hold", icon: PmStatOnHoldIcon },
  { key: "completed", label: "Completed", subtitle: "Delivered", color: "#0D9488", filterStatus: "completed", icon: PmStatCompletedIcon },
  { key: "draft", label: "Draft", subtitle: "Not started", color: "#94A3B8", filterStatus: "draft", icon: PmStatDraftIcon },
] as const;

const KANBAN_COLS = [
  { status: "draft", title: "Draft", color: "#94A3B8" },
  { status: "planning", title: "Planning", color: "#D97706" },
  { status: "active", title: "Active", color: "#059669" },
  { status: "on_hold", title: "On Hold", color: "#DC2626" },
  { status: "completed", title: "Completed", color: "#0D9488" },
] as const;

const WORK_TYPE_OPTIONS = [
  { id: "project", name: "Project" },
  { id: "programme", name: "Programme" },
  { id: "initiative", name: "Initiative" },
  { id: "campaign", name: "Campaign" },
  { id: "poc", name: "POC" },
  { id: "user_defined", name: "User Defined" },
  { id: "portfolio", name: "Portfolio" },
  { id: "sub_project", name: "Sub-Project" },
  { id: "program_increment", name: "Program Increment" },
  { id: "workstream", name: "Workstream" },
  { id: "task_force", name: "Task Force" },
  { id: "change_request", name: "Change Request" },
  { id: "enhancement", name: "Enhancement" },
  { id: "experiment", name: "Experiment" },
  { id: "pilot", name: "Pilot" },
  { id: "prototype", name: "Prototype" },
  { id: "sprint", name: "Sprint / Iteration" },
  { id: "improvement", name: "Improvement" },
];

function workTypeLabel(type: string | null | undefined) {
  const raw = type || "project";
  const t = LEGACY_TYPE_MAP[raw] || raw;
  return WORK_TYPE_OPTIONS.find((o) => o.id === t)?.name || t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function TypeBadge({ type }: { type: string | null | undefined }) {
  const raw = type || "project";
  const t = LEGACY_TYPE_MAP[raw] || raw;
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold border-0 rounded-full", TYPE_COLORS[t] || TYPE_COLORS.project)}>
      {workTypeLabel(t)}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status || "draft";
  const config = STATUS_COLORS[s] || STATUS_COLORS.draft;
  const label = s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold border-0 rounded-full gap-1.5", config.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {label}
    </Badge>
  );
}

type RagDimension = "budget" | "schedule" | "scope";

const RAG_LABELS: Record<RagDimension, Record<string, string>> = {
  budget: { green: "On Track", amber: "At Risk", red: "Over Budget" },
  schedule: { green: "On Track", amber: "At Risk", red: "Delayed" },
  scope: { green: "On Track", amber: "At Risk", red: "Scope Increase" },
};

function normalizeRag(rag: string | null | undefined) {
  const r = (rag || "").toLowerCase();
  if (r === "green" || r === "amber" || r === "red" || r === "blue") return r;
  return "";
}

/** Full-width RAG pill used as a dedicated table column — left-aligned so dots line up. */
function RagPill({
  rag,
  dimension,
  compact = false,
}: {
  rag: string | null | undefined;
  dimension: RagDimension;
  compact?: boolean;
}) {
  const r = normalizeRag(rag) || "green";
  const cls = RAG_CHIP[r] || RAG_CHIP.green;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-start gap-1.5 rounded-md font-bold whitespace-nowrap",
        compact ? "w-auto px-1.5 py-0.5 text-[9px]" : "w-[108px] px-2.5 py-1 text-[10px]",
        cls,
      )}
      data-testid={`rag-pill-${dimension}-${r}`}
    >
      <span
        className={cn(
          "rounded-full shrink-0",
          compact ? "h-1.5 w-1.5" : "h-1.5 w-1.5",
          r === "green" ? "bg-green-500" : r === "amber" ? "bg-amber-500" : r === "red" ? "bg-red-500" : "bg-blue-500",
        )}
      />
      <span className="truncate">{RAG_LABELS[dimension][r] || "On Track"}</span>
    </span>
  );
}

function HealthScore({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-extrabold border-2 border-slate-200 text-slate-400">—</span>;
  }
  const s = Math.max(0, Math.min(100, score));
  const tone = s >= 80 ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-300"
    : s >= 60 ? "border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300"
    : "border-red-500 text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300";
  return (
    <span className={cn("inline-flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-extrabold border-2", tone)}>
      {s}
    </span>
  );
}

function ProgressBar({ value, completed }: { value: number; completed?: boolean }) {
  const clamped = Math.min(100, Math.max(0, value || 0));
  const fill = completed || clamped >= 100 ? "#0D9488" : clamped >= 80 ? "#059669" : clamped >= 40 ? "#D97706" : "#4338CA";
  return (
    <div className="flex items-center gap-1.5 min-w-[72px]">
      <div className="h-[5px] w-[52px] bg-[#F1F5F9] rounded-[3px] overflow-hidden">
        <div className="h-full rounded-[3px]" style={{ width: `${clamped}%`, backgroundColor: fill }} />
      </div>
      <span className="text-[10px] font-bold text-muted-foreground font-mono w-7">{clamped}%</span>
    </div>
  );
}

const AVATAR_PALETTE = ["#4338CA", "#0D9488", "#7C3AED", "#D97706", "#059669", "#DC2626", "#0284C7", "#BE185D"];

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PersonCell({ name, role, size = "md" }: { name: string | null | undefined; role?: string; size?: "sm" | "md" }) {
  if (!name) return <span className="text-xs text-muted-foreground">—</span>;
  const dim = size === "sm" ? "h-[18px] w-[18px] text-[7px]" : "h-7 w-7 text-[9px]";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", dim)}
        style={{ backgroundColor: avatarColor(name) }}
      >
        {initialsOf(name)}
      </span>
      <div className="min-w-0">
        <div className="text-xs font-medium truncate">{name}</div>
        {role && <div className="text-xs text-muted-foreground truncate">{role}</div>}
      </div>
    </div>
  );
}

function TeamAvatars({ team }: { team?: LandingProject["team"] }) {
  const members = team || [];
  if (members.length === 0) return <span className="text-xs text-[#94A3B8]">—</span>;
  const shown = members.slice(0, 4);
  const overflow = members.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((m, i) => {
        const label = [m.firstName, m.lastName].filter(Boolean).join(" ") || m.initials;
        return (
          <span
            key={m.id + i}
            title={label}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[8px] font-bold text-white",
              i > 0 && "-ml-1.5",
            )}
            style={{ backgroundColor: avatarColor(label) }}
          >
            {m.initials}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="-ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#F1F5F9] text-[7px] font-extrabold text-[#64748B]">
          +{overflow}
        </span>
      )}
    </div>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function formatBudget(budget: string | number | null | undefined) {
  if (budget == null || budget === "") return "—";
  const n = typeof budget === "number" ? budget : Number(budget);
  if (Number.isNaN(n)) return String(budget);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function daysLeft(endDate: string | null | undefined) {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
}

function leadOf(p: LandingProject) {
  return p.leadName || p.metadata?.leadName || p.projectManager || null;
}

function loadVisibleColumns(): Record<ColumnId, boolean> {
  const defaults = Object.fromEntries(COLUMN_DEFS.map((c) => [c.id, true])) as Record<ColumnId, boolean>;
  try {
    const raw = localStorage.getItem(COLS_STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

function normalizeStatus(status: string | null | undefined): string {
  return (status || "draft").toLowerCase().trim().replace(/\s+/g, "_");
}

function projectKanbanColumnId(status: string | null | undefined): string {
  const s = normalizeStatus(status);
  if (s === "cancelled") return "on_hold";
  if (KANBAN_COLS.some((c) => c.status === s)) return s;
  return "draft";
}

type ProjectSortCol = "name" | "type" | "status" | "customer" | "lead" | "progress" | "score" | "end" | "start";

const SORT_LABELS: Record<ProjectSortCol, string> = {
  name: "Project name",
  type: "Type",
  status: "Status",
  customer: "Customer",
  lead: "Lead",
  start: "Start date",
  end: "End date",
  progress: "Progress",
  score: "Health score",
};

function ProjectTable({
  projects,
  visible,
  onOpen,
  onOpenWorkspace,
  onEdit,
  searchHighlight,
  paginationResetKey,
  totalCount,
  sortCol,
  sortDir,
  pinFirstColumn = true,
}: {
  projects: LandingProject[];
  visible: Record<ColumnId, boolean>;
  onOpen: (p: LandingProject) => void;
  onOpenWorkspace: (id: number) => void;
  onEdit: (id: number) => void;
  searchHighlight: string;
  paginationResetKey: string;
  totalCount: number;
  sortCol: ProjectSortCol;
  sortDir: "asc" | "desc";
  pinFirstColumn?: boolean;
}) {
  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      const pick = (p: LandingProject): string | number => {
        switch (sortCol) {
          case "name": return p.name || "";
          case "type": return p.workType || p.projectType || "";
          case "status": return p.status || "";
          case "customer": return p.customer || "";
          case "lead": return leadOf(p) || "";
          case "progress": return p.progress ?? 0;
          case "score": return p.healthScore ?? 0;
          case "end": return p.endDate || "";
          case "start": return p.startDate || "";
          default: return "";
        }
      };
      const va = pick(a);
      const vb = pick(b);
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [projects, sortCol, sortDir]);

  const mondayColumns: MondayColumnDef<LandingProject>[] = useMemo(() => [
    {
      id: "name",
      header: "Project name",
      type: "text",
      accessor: "name",
      width: "240px",
      sticky: pinFirstColumn,
      editable: true,
      render: (p) => (
        <div className="flex items-start gap-2.5 min-w-0">
          <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", STATUS_COLORS[normalizeStatus(p.status)]?.dot || "bg-slate-400")} />
          <div className="min-w-0">
            <p className="font-semibold truncate text-sm">{p.name}</p>
            {p.code && <p className="truncate text-xs text-muted-foreground font-mono">{p.code}</p>}
            {p.attention && (
              <p className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold text-red-700">
                <AlertTriangle className="h-2.5 w-2.5" /> Needs attention
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      type: "text",
      accessor: (p) => p.workType || p.projectType,
      width: "120px",
      hidden: !visible.type,
      editable: false,
      render: (p) => <TypeBadge type={p.workType || p.projectType} />,
    },
    {
      id: "status",
      header: "Status",
      type: "status",
      accessor: "status",
      width: "120px",
      hidden: !visible.status,
      editable: true,
      options: Object.keys(STATUS_COLORS).map((s) => ({
        value: s,
        label: s.replace(/_/g, " "),
        color: STATUS_COLORS[s]?.bg,
      })),
      render: (p) => <StatusBadge status={normalizeStatus(p.status)} />,
    },
    {
      id: "customer",
      header: "Customer",
      type: "text",
      accessor: (p) => p.customer || "",
      width: "140px",
      hidden: !visible.customer,
      editable: true,
      render: (p) => <span className="text-xs text-muted-foreground">{p.customer || "—"}</span>,
    },
    {
      id: "lead",
      header: "Lead",
      type: "person",
      accessor: (p) => leadOf(p),
      width: "160px",
      hidden: !visible.lead,
      editable: false,
      render: (p) => <PersonCell name={leadOf(p)} role="PM" />,
    },
    {
      id: "pmo",
      header: "PMO owner",
      type: "person",
      accessor: "pmoName",
      width: "140px",
      hidden: !visible.pmo,
      editable: false,
      render: (p) => <PersonCell name={p.pmoName} />,
    },
    {
      id: "portfolio",
      header: "Portfolio",
      type: "text",
      accessor: (p) => p.portfolioName || "",
      width: "130px",
      hidden: !visible.portfolio,
      editable: false,
      render: (p) => <span className="text-xs text-muted-foreground">{p.portfolioName || "—"}</span>,
    },
    {
      id: "method",
      header: "Methodology",
      type: "text",
      accessor: (p) => p.framework || p.methodology || "",
      width: "130px",
      hidden: !visible.method,
      editable: false,
      render: (p) => <span className="text-xs text-muted-foreground capitalize">{p.framework || p.methodology || "—"}</span>,
    },
    {
      id: "team",
      header: "Team",
      type: "text",
      accessor: () => "",
      width: "100px",
      hidden: !visible.team,
      editable: false,
      render: (p) => <TeamAvatars team={p.team} />,
    },
    {
      id: "start",
      header: "Start date",
      type: "date",
      accessor: "startDate",
      width: "110px",
      hidden: !visible.start,
      editable: true,
      render: (p) => <span className="text-xs tabular-nums">{formatDate(p.startDate)}</span>,
    },
    {
      id: "end",
      header: "End date",
      type: "date",
      accessor: "endDate",
      width: "110px",
      hidden: !visible.end,
      editable: true,
      render: (p) => <span className="text-xs tabular-nums">{formatDate(p.endDate)}</span>,
    },
    {
      id: "progress",
      header: "Progress",
      type: "number",
      accessor: "progress",
      width: "120px",
      hidden: !visible.progress,
      editable: true,
      render: (p) => <ProgressBar value={p.progress || 0} completed={normalizeStatus(p.status) === "completed"} />,
    },
    {
      id: "ragBudget",
      header: "Budget",
      type: "status",
      accessor: "financialRag",
      width: "120px",
      hidden: !visible.ragBudget,
      editable: true,
      options: Object.keys(RAG_CHIP).map((r) => ({ value: r, label: r, color: RAG_CHIP[r] })),
      render: (p) => <RagPill rag={p.financialRag} dimension="budget" />,
    },
    {
      id: "ragSchedule",
      header: "Sched",
      type: "status",
      accessor: "scheduleRag",
      width: "120px",
      hidden: !visible.ragSchedule,
      editable: true,
      options: Object.keys(RAG_CHIP).map((r) => ({ value: r, label: r, color: RAG_CHIP[r] })),
      render: (p) => <RagPill rag={p.scheduleRag} dimension="schedule" />,
    },
    {
      id: "ragScope",
      header: "Scope",
      type: "status",
      accessor: "ragStatus",
      width: "120px",
      hidden: !visible.ragScope,
      editable: true,
      options: Object.keys(RAG_CHIP).map((r) => ({ value: r, label: r, color: RAG_CHIP[r] })),
      render: (p) => <RagPill rag={p.ragStatus} dimension="scope" />,
    },
    {
      id: "score",
      header: "Health score",
      type: "number",
      accessor: "healthScore",
      width: "90px",
      hidden: !visible.score,
      editable: false,
      render: (p) => <HealthScore score={p.healthScore} />,
    },
  ], [visible, pinFirstColumn]);

  const PROJECT_COL_FIELD: Record<string, string> = {
    start: "startDate",
    end: "endDate",
    ragBudget: "financialRag",
    ragSchedule: "scheduleRag",
    ragScope: "ragStatus",
  };

  return (
    <div data-testid="projects-table">
      <MondayBoardShell.Table
        columns={mondayColumns}
        data={sorted}
        onRowClick={(p) => onOpenWorkspace(p.id)}
        onCellEdit={(rowId, columnId, value) => {
          const field = PROJECT_COL_FIELD[columnId] || columnId;
          apiRequest("PUT", `/api/pm/projects/${Number(rowId)}`, {
            [field]: value === "" ? null : value,
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/pm/projects"] });
          });
        }}
        emptyMessage="No work items found"
        searchHighlightTerm={searchHighlight}
        columnWidthStorageKey="jiganto-projects-landing-col-widths"
        paginationResetKey={`${paginationResetKey}|${sortCol}|${sortDir}`}
        totalCount={totalCount}
        renderRowActions={(p) => (
          <div className="inline-flex gap-0.5 justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(p.id)}
              title="Edit project"
              data-testid={`button-edit-row-${p.id}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
              onClick={() => onOpenWorkspace(p.id)}
              title="Open workspace"
              data-testid={`button-open-${p.id}`}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onOpen(p)}
              title="Preview project"
              data-testid={`button-preview-${p.id}`}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        )}
      />
    </div>
  );
}

function ProjectCards({
  projects,
  onOpen,
  onOpenWorkspace,
}: {
  projects: readonly LandingProject[];
  onOpen: (p: LandingProject) => void;
  onOpenWorkspace: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5" data-testid="projects-cards">
      {projects.map((p) => {
        const lead = leadOf(p);
        const hasRed = [p.financialRag, p.scheduleRag, p.ragStatus].includes("red") || p.attention;
        const hasAmber = !hasRed && [p.financialRag, p.scheduleRag, p.ragStatus].includes("amber");
        const edge = hasRed ? "border-l-red-500" : hasAmber ? "border-l-amber-500" : "border-l-green-500";
        return (
          <div
            key={p.id}
            className={cn(
              "overflow-hidden cursor-pointer rounded-xl border border-[#E2E8F0] bg-white dark:bg-card border-l-4 transition-all",
              "hover:border-[#818CF8] hover:shadow-[0_4px_16px_rgba(67,56,202,0.1)] hover:-translate-y-px",
              edge,
            )}
            onClick={() => onOpenWorkspace(p.id)}
            data-testid={`card-project-${p.id}`}
          >
            <div className="px-4 py-3.5 border-b border-[#F1F5F9]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold text-[#0F172A] dark:text-foreground leading-snug">{p.name}</div>
                  {p.code && <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5">{p.code}</div>}
                </div>
                <HealthScore score={p.healthScore} />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <TypeBadge type={p.workType || p.projectType} />
                <StatusBadge status={p.status} />
              </div>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-[#94A3B8] min-w-[56px] font-semibold text-[10px]">PM</span>
                <PersonCell name={lead} size="sm" />
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-[#94A3B8] min-w-[56px] font-semibold text-[10px]">Customer</span>
                <span className="font-semibold text-[#334155] dark:text-foreground">{p.customer || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-[#94A3B8] min-w-[56px] font-semibold text-[10px]">Progress</span>
                <ProgressBar value={p.progress || 0} completed={normalizeStatus(p.status) === "completed"} />
              </div>
              {p.endDate && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-[#94A3B8] min-w-[56px] font-semibold text-[10px]">Due</span>
                  <span className="font-semibold text-[#334155] inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {formatDate(p.endDate)}
                  </span>
                </div>
              )}
            </div>
            <div className="px-4 py-2.5 bg-[#F1F5F9] dark:bg-muted/40 border-t border-[#F1F5F9] flex items-center gap-2 flex-wrap">
              <RagPill rag={p.financialRag} dimension="budget" />
              <RagPill rag={p.scheduleRag} dimension="schedule" />
              <RagPill rag={p.ragStatus} dimension="scope" />
            </div>
            <div className="px-4 py-2.5 border-t border-[#F1F5F9] flex items-center justify-between gap-2">
              <TeamAvatars team={p.team} />
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] font-semibold"
                  onClick={() => onOpen(p)}
                  data-testid={`button-preview-card-${p.id}`}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-[11px] font-bold bg-[#4338CA] hover:bg-[#3730A3] text-white"
                  onClick={() => onOpenWorkspace(p.id)}
                  data-testid={`button-open-card-${p.id}`}
                >
                  Open workspace →
                </Button>
              </div>
            </div>
          </div>
        );
      })}
      {projects.length === 0 && (
        <div className="col-span-full text-center text-muted-foreground py-12">No work items found</div>
      )}
    </div>
  );
}

function ProjectKanbanCard({
  project,
  onOpen,
  dragHandleProps,
  isDragging,
}: {
  project: LandingProject;
  onOpen: (p: LandingProject) => void;
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  isDragging: boolean;
}) {
  const lead = leadOf(project);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (isDragging) suppressClickRef.current = true;
  }, [isDragging]);

  return (
    <div
      {...(dragHandleProps ?? {})}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onOpen(project);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(project);
        }
      }}
      className={cn(
        "w-full rounded-lg border border-[#E2E8F0] bg-white dark:bg-card p-3 text-left transition-all",
        "hover:border-[#818CF8] hover:shadow-[0_2px_8px_rgba(67,56,202,0.08)] cursor-grab active:cursor-grabbing",
        isDragging && "opacity-90 shadow-lg ring-2 ring-[#4338CA]/25",
        project.attention && "border-l-4 border-l-red-500",
      )}
      data-testid={`kanban-card-${project.id}`}
    >
      <div className="flex items-start gap-1.5">
        <span className="shrink-0 text-[#94A3B8] mt-0.5 pointer-events-none" aria-hidden>
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-[#0F172A] dark:text-foreground leading-snug mb-1.5">{project.name}</div>
          <div className="flex flex-col gap-[3px] text-[10px] text-[#64748B]">
            <span><TypeBadge type={project.workType || project.projectType} /></span>
            <span className="mt-0.5">👤 {lead || "Unassigned"}</span>
            <span>🏢 {project.customer || "—"}</span>
            {project.endDate && <span>📅 Due {formatDate(project.endDate)}</span>}
            <div className="mt-1 flex gap-0.5 flex-wrap">
              <RagPill rag={project.financialRag} dimension="budget" compact />
              <RagPill rag={project.scheduleRag} dimension="schedule" compact />
              <RagPill rag={project.ragStatus} dimension="scope" compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectKanban({
  projects,
  onOpen,
}: {
  projects: LandingProject[];
  onOpen: (p: LandingProject) => void;
}) {
  const { toast } = useToast();

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PUT", `/api/pm/projects/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects"] });
    },
  });

  const colMeta: Record<string, { color: string; bg: string }> = {
    draft: { color: "#94A3B8", bg: "#F8FAFC" },
    planning: { color: "#D97706", bg: "#FEF3C7" },
    active: { color: "#059669", bg: "#D1FAE5" },
    on_hold: { color: "#DC2626", bg: "#FEE2E2" },
    completed: { color: "#0D9488", bg: "#CCFBF1" },
  };

  const columns = useMemo(
    () =>
      KANBAN_COLS.map((col) => {
        const meta = colMeta[col.status];
        const count = projects.filter((p) => projectKanbanColumnId(p.status) === col.status).length;
        return {
          id: col.status,
          title: col.title,
          accentColor: col.color,
          className: "min-w-0 bg-[#F1F5F9] rounded-xl overflow-hidden",
          header: (
            <div
              className="px-3 pt-3 pb-2.5 shrink-0"
              style={{ borderTop: `3px solid ${col.color}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[#0F172A] dark:text-foreground">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  {col.title}
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: meta.bg, color: meta.color }}
                >
                  {count}
                </span>
              </div>
            </div>
          ),
        };
      }),
    [projects],
  );

  return (
    <div className="w-full pb-2" data-testid="projects-kanban">
      <AppKanbanBoard
        columns={columns}
        items={projects}
        getItemId={(p) => String(p.id)}
        getColumnId={(p) => projectKanbanColumnId(p.status)}
        setColumnIdOnItem={(p, columnId) => ({ ...p, status: columnId })}
        onMove={(move) =>
          new Promise<void>((resolve, reject) => {
            moveMutation.mutate(
              { id: Number(move.itemId), status: move.toColumnId },
              {
                onSuccess: () => {
                  toast({ title: "Status updated", description: `Moved to ${move.toColumnId.replace(/_/g, " ")}` });
                  resolve();
                },
                onError: (e) => reject(e),
              },
            );
          })
        }
        testIdPrefix="projects-kanban"
        idPrefix="pm-project-"
        emptyColumnLabel="Drop projects here"
        columnWidthClass="flex-1 min-w-[220px]"
        columnBodyClass="min-h-[180px] max-h-[min(560px,60vh)] overflow-y-auto overscroll-y-contain space-y-2 px-3 pb-3 pt-0 border-0 rounded-none bg-transparent"
        className="w-full gap-3"
        renderCard={(project, ctx) => (
          <ProjectKanbanCard
            project={project}
            onOpen={onOpen}
            dragHandleProps={ctx.dragHandleProps}
            isDragging={ctx.isDragging}
          />
        )}
      />
    </div>
  );
}

export function ProjectsLandingView({
  projects,
  isLoading,
  onOpenProject,
  onNewProject,
}: {
  projects: LandingProject[];
  isLoading: boolean;
  onOpenProject: (id: number) => void;
  onNewProject: () => void;
}) {
  const { user } = useAuth();
  type DashTab = "projects" | "milestones" | "my";
  const [dashTab, setDashTab] = useState<DashTab>("projects");
  const [viewMode, setViewMode] = useState<LandingDisplayMode>("table");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [portfolioFilter, setPortfolioFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [mineFilter, setMineFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [visibleCols, setVisibleCols] = useState<Record<ColumnId, boolean>>(loadVisibleColumns);
  const [sortCol, setSortCol] = useState<ProjectSortCol>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pinName, setPinName] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("projects-landing-pin-name") !== "0";
  });
  const { toast } = useToast();

  const handleProjectSort = (col: ProjectSortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };
  const [selected, setSelected] = useState<LandingProject | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editProjectId, setEditProjectId] = useState<number | null>(null);
  const [editPanelOpen, setEditPanelOpen] = useState(false);

  const openEdit = (id: number) => {
    setPanelOpen(false);
    setEditProjectId(id);
    setEditPanelOpen(true);
  };

  useEffect(() => {
    localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(visibleCols));
  }, [visibleCols]);

  const openPreview = (p: LandingProject) => {
    setSelected(p);
    setPanelOpen(true);
  };

  const showListChrome = dashTab === "projects" || dashTab === "my";

  const statCounts = useMemo(() => {
    const counts: Record<string, number> = { all: projects.length, active: 0, planning: 0, on_hold: 0, completed: 0, draft: 0 };
    projects.forEach((p) => {
      const s = p.status || "draft";
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [projects]);

  const customers = useMemo(() => Array.from(new Set(projects.map((p) => p.customer).filter(Boolean))) as string[], [projects]);
  const portfolios = useMemo(() => Array.from(new Set(projects.map((p) => p.portfolioName).filter(Boolean))) as string[], [projects]);
  const attentionCount = useMemo(() => projects.filter((p) => p.attention).length, [projects]);

  const isMine = (p: LandingProject) => {
    if (!user?.id) return false;
    if (p.managerId === user.id || p.ownerId === user.id) return true;
    if (p.team?.some((t) => t.id === user.id)) return true;
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim().toLowerCase();
    const lead = (leadOf(p) || "").toLowerCase();
    return !!name && lead === name;
  };

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (mineFilter && !isMine(p)) return false;
      if (statusFilter !== "all" && normalizeStatus(p.status) !== statusFilter) return false;
      if (typeFilter !== "all" && (p.workType || p.projectType) !== typeFilter) return false;
      if (customerFilter !== "all" && p.customer !== customerFilter) return false;
      if (portfolioFilter !== "all" && p.portfolioName !== portfolioFilter) return false;
      if (healthFilter !== "all") {
        const worst = [p.financialRag, p.scheduleRag, p.ragStatus].includes("red")
          ? "red"
          : [p.financialRag, p.scheduleRag, p.ragStatus].includes("amber")
            ? "amber"
            : "green";
        if (healthFilter === "attention") {
          const hasIssue =
            p.attention ||
            [p.financialRag, p.scheduleRag, p.ragStatus].some((r) => r === "red" || r === "amber");
          if (!hasIssue) return false;
        } else if (worst !== healthFilter) {
          return false;
        }
      }
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const hay = `${p.name || ""} ${p.description || ""} ${p.code || ""} ${p.customer || ""} ${leadOf(p) || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [projects, statusFilter, typeFilter, customerFilter, portfolioFilter, healthFilter, debouncedSearch, mineFilter, user]);

  const tablePaginationResetKey = `${statusFilter}-${typeFilter}-${customerFilter}-${portfolioFilter}-${healthFilter}-${debouncedSearch}-${mineFilter}`;

  const pagination = useTablePagination(filtered, {
    resetKey: `${tablePaginationResetKey}-${viewMode}`,
    enabled: viewMode === "cards",
  });

  const paged = viewMode === "cards" ? pagination.paginatedItems : filtered;

  const visibleCount = Object.values(visibleCols).filter(Boolean).length;
  const activeFilterCount =
    (mineFilter ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (customerFilter !== "all" ? 1 : 0) +
    (portfolioFilter !== "all" ? 1 : 0) +
    (healthFilter !== "all" ? 1 : 0);

  const PROJECT_CSV_HEADERS = ["Project name", "Code", "Type", "Status", "Customer", "Lead", "Progress", "RAG", "Start", "End"];

  const exportProjects = () => {
    const rows = filtered.map((p) => [
      p.name || "",
      p.code || "",
      p.workType || p.projectType || "",
      p.status || "",
      p.customer || "",
      leadOf(p) || "",
      String(p.progress ?? 0),
      p.ragStatus || "",
      p.startDate || "",
      p.endDate || "",
    ]);
    downloadBoardCsv(`projects-${new Date().toISOString().split("T")[0]}.csv`, PROJECT_CSV_HEADERS, rows);
    toast({ title: "Projects exported to CSV" });
  };

  const downloadProjectsTemplate = () => {
    downloadImportTemplateCsv("projects-import-template.csv", PROJECT_CSV_HEADERS, PROJECT_CSV_HEADERS.map(() => ""));
    toast({ title: "Import template downloaded" });
  };

  const importUnavailable = () => toast({ title: "Import is not available for this table yet" });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <ModulePageLoading label="Loading projects..." />
      </div>
    );
  }

  const tabs: Array<{ id: DashTab; label: string; count?: number }> = [
    { id: "projects", label: "All Projects", count: projects.length },
    { id: "my", label: "My Projects", count: projects.filter(isMine).length },
    { id: "milestones", label: "Milestones" },
  ];

  return (
    <div className="font-sans min-h-full" data-testid="projects-landing">
      <div className={modulePageBannerWrapClass}>
        <ModuleWelcomeBanner moduleKey="projects" features={["Portfolio views", "Milestones", "Kanban & table", "Work item wizard"]} />
      </div>
      <div className={modulePageStickyHeaderClass}>
        <ModuleHeader
          icon={PmProjectIcon}
          title="Projects"
          subtitle="Click a project to open its workspace"
          searchPlaceholder="Search projects..."
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); }}
          actions={
            <Button size="sm" onClick={onNewProject} data-testid="button-new-work-item">
              <Plus className="h-4 w-4 mr-1" />
              New Work Item
            </Button>
          }
        />
        <div className={modulePageTabsWrapClass}>
          <Tabs
            value={dashTab}
            onValueChange={(v) => {
              const next = v as DashTab;
              setDashTab(next);
              if (next === "my") { setMineFilter(true); }
              if (next === "projects") { setMineFilter(false); }
            }}
            data-testid="projects-dash-tabs"
          >
            <TabsList className={modulePageTabsListClass}>
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={modulePageTabTriggerClass}
                  data-testid={`tab-${tab.id}`}
                >
                  {tab.label}
                  {tab.count != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-muted text-muted-foreground">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className={modulePageTabContentClass}>
        {dashTab === "milestones" && (
          <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <MilestoneTracker mode="cross-project" />
          </Suspense>
        )}

        {showListChrome && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4" data-testid="stat-cards">
              {KPI_CARDS.map((card) => {
                const isActive = statusFilter === card.filterStatus;
                return (
                  <Card
                    key={card.key}
                    className={cn(
                      "relative overflow-hidden cursor-pointer transition-shadow hover:shadow-sm",
                      isActive && "outline outline-2 outline-offset-0 outline-primary",
                    )}
                    onClick={() => { setStatusFilter(isActive && card.filterStatus !== "all" ? "all" : card.filterStatus); }}
                    data-testid={`stat-card-${card.key}`}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: card.color }} />
                    <CardContent className="p-3.5 pl-4">
                      <div className="text-2xl font-black font-mono tracking-tight" style={{ color: card.color }}>
                        {statCounts[card.key] ?? 0}
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-wide mt-0.5" style={{ color: card.color }}>{card.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{card.subtitle}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <MondayBoardShell.Legacy
              storageKey="jiganto-projects-landing"
              entityType="project"
              stateHook={useMondayBoardShellState}
              filterMatcher={matchBoardFilterValue}
            >
            <MondayBoardShell.Toolbar
              newLabel="New Work Item"
              onNew={onNewProject}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search projects..."
              viewLabel={viewMode === "table" ? "Table" : viewMode === "cards" ? "Cards" : "Kanban"}
              viewMenu={
                <>
                  <DropdownMenuItem onClick={() => setViewMode("table")} data-testid="view-table">Table</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("cards")} data-testid="view-cards">Cards</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => { setViewMode("kanban"); setStatusFilter("all"); }}
                    data-testid="view-kanban"
                  >
                    Kanban
                  </DropdownMenuItem>
                </>
              }
              filterActive={activeFilterCount > 0}
              filterCount={activeFilterCount}
              filterContent={
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={mineFilter}
                      onCheckedChange={(v) => {
                        const next = v === true;
                        setMineFilter(next);
                        setDashTab(next ? "my" : "projects");
                      }}
                    />
                    My Projects only
                  </label>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="h-8 text-xs" data-testid="filter-type"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {WORK_TYPE_OPTIONS.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 text-xs" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {Object.keys(STATUS_COLORS).map((s) => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Customer</Label>
                    <Select value={customerFilter} onValueChange={setCustomerFilter}>
                      <SelectTrigger className="h-8 text-xs" data-testid="filter-customer"><SelectValue placeholder="Customer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All customers</SelectItem>
                        {customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Portfolio</Label>
                    <Select value={portfolioFilter} onValueChange={setPortfolioFilter}>
                      <SelectTrigger className="h-8 text-xs" data-testid="filter-portfolio"><SelectValue placeholder="Portfolio" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All portfolios</SelectItem>
                        {portfolios.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">RAG / Health</Label>
                    <Select value={healthFilter} onValueChange={setHealthFilter}>
                      <SelectTrigger className="h-8 text-xs" data-testid="filter-health"><SelectValue placeholder="RAG" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All RAG</SelectItem>
                        <SelectItem value="attention">Needs attention</SelectItem>
                        <SelectItem value="red">Red — needs attention</SelectItem>
                        <SelectItem value="amber">Amber — monitor</SelectItem>
                        <SelectItem value="green">Green — on track</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              }
              sortContent={
                viewMode === "table" ? (
                  <>
                    {(Object.keys(SORT_LABELS) as ProjectSortCol[]).map((col) => (
                      <DropdownMenuItem key={col} onClick={() => handleProjectSort(col)} data-testid={`sort-projects-${col}`}>
                        {SORT_LABELS[col]} {sortCol === col ? `(${sortDir})` : ""}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : undefined
              }
              sortActive={viewMode === "table" && (sortCol !== "name" || sortDir !== "asc")}
              sortLabel={viewMode === "table" ? `Sort: ${SORT_LABELS[sortCol]}` : "Sort"}
              columnsContent={
                viewMode === "table" ? (
                  <>
                    {COLUMN_DEFS.map((col) => (
                      <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted rounded-sm">
                        <Checkbox
                          checked={visibleCols[col.id]}
                          onCheckedChange={(v) => setVisibleCols((prev) => ({ ...prev, [col.id]: v === true }))}
                        />
                        {col.label}
                      </label>
                    ))}
                  </>
                ) : undefined
              }
              columnsHiddenCount={viewMode === "table" ? COLUMN_DEFS.length - visibleCount : 0}
              pinActive={pinName}
              onPinToggle={() => {
                setPinName((v) => {
                  const next = !v;
                  localStorage.setItem("projects-landing-pin-name", next ? "1" : "0");
                  return next;
                });
              }}
              pinTitle={pinName ? "Unpin Project name column" : "Pin Project name column"}
              onExport={exportProjects}
              onDownloadTemplate={downloadProjectsTemplate}
              onPaste={importUnavailable}
              onImport={importUnavailable}
              afterGroupSlot={
                attentionCount > 0 ? (
                  <span className="text-xs font-bold text-red-700 dark:text-red-400 inline-flex items-center gap-1 px-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {attentionCount} need attention
                  </span>
                ) : undefined
              }
              testId="projects-landing-toolbar"
            />

            {viewMode === "table" && (
              <ProjectTable
                projects={filtered}
                visible={visibleCols}
                onOpen={openPreview}
                onOpenWorkspace={onOpenProject}
                onEdit={openEdit}
                searchHighlight={debouncedSearch}
                paginationResetKey={tablePaginationResetKey}
                totalCount={projects.length}
                sortCol={sortCol}
                sortDir={sortDir}
                pinFirstColumn={pinName}
              />
            )}
            {viewMode === "cards" && (
              <>
                <ProjectCards projects={paged} onOpen={openPreview} onOpenWorkspace={onOpenProject} />
                <TablePagination
                  className="mt-3 rounded-xl border border-border/50 bg-card"
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  startIndex={pagination.startIndex}
                  endIndex={pagination.endIndex}
                  pageSize={pagination.pageSize}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              </>
            )}
            {viewMode === "kanban" && (
              <ProjectKanban
                projects={filtered}
                onOpen={(p) => onOpenProject(p.id)}
              />
            )}
            </MondayBoardShell.Legacy>
          </>
        )}
      </div>

      <ProjectDetailPanel
        project={selected}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onOpenWorkspace={onOpenProject}
        onEditProject={openEdit}
      />

      <EditWorkItemPanel
        projectId={editProjectId}
        open={editPanelOpen}
        onOpenChange={(open) => {
          setEditPanelOpen(open);
          if (!open) setEditProjectId(null);
        }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/pm/projects"] });
        }}
      />
    </div>
  );
}

function ProjectDetailPanel({
  project,
  open,
  onOpenChange,
  onOpenWorkspace,
  onEditProject,
}: {
  project: LandingProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenWorkspace: (id: number) => void;
  onEditProject: (id: number) => void;
}) {
  if (!project) return null;
  const lead = leadOf(project);
  const left = daysLeft(project.endDate);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] p-0 flex flex-col" data-testid="project-detail-panel">
        <div className="border-b bg-gray-50 dark:bg-muted/40 p-5">
          <SheetHeader className="space-y-1 pr-8 text-left">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <TypeBadge type={project.workType || project.projectType} />
              <StatusBadge status={project.status} />
            </div>
            <SheetTitle className="text-lg font-semibold leading-snug">{project.name}</SheetTitle>
            <p className="text-[11px] text-muted-foreground font-mono">{project.code || `PRJ-${project.id}`}</p>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 mt-3.5">
            <div className="rounded-lg border bg-white dark:bg-card p-2.5 text-center">
              <div className="text-lg font-semibold tabular-nums">{project.progress ?? 0}%</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">Progress</div>
            </div>
            <div className="rounded-lg border bg-white dark:bg-card p-2.5 text-center">
              <div className="text-lg font-semibold tabular-nums truncate">{formatBudget(project.budget)}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">Budget</div>
            </div>
            <div className="rounded-lg border bg-white dark:bg-card p-2.5 text-center">
              <div className="text-lg font-semibold tabular-nums">{left == null ? "—" : left}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">Days left</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 pb-1.5 border-b">
              Health status
            </h4>
            <div className="flex flex-wrap gap-1.5 items-center">
              <RagPill rag={project.financialRag} dimension="budget" />
              <RagPill rag={project.scheduleRag} dimension="schedule" />
              <RagPill rag={project.ragStatus} dimension="scope" />
              <HealthScore score={project.healthScore} />
            </div>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 pb-1.5 border-b">
              Project details
            </h4>
            <div className="space-y-0">
              {[
                ["Customer", project.customer || "—"],
                ["Lead", lead || "—"],
                ["PMO owner", project.pmoName || "—"],
                ["Portfolio", project.portfolioName || "—"],
                ["Methodology", project.framework || project.methodology || "—"],
                ["Start", formatDate(project.startDate)],
                ["End", formatDate(project.endDate)],
              ].map(([label, val]) => (
                <div key={label} className="flex gap-2 py-1.5 border-b text-[12px] last:border-0">
                  <span className="text-muted-foreground font-semibold w-[100px] shrink-0 text-[11px]">{label}</span>
                  <span className="font-semibold">{val}</span>
                </div>
              ))}
              {project.description && (
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{project.description}</p>
              )}
            </div>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 pb-1.5 border-b">
              Team
            </h4>
            <div className="flex flex-wrap gap-2">
              {(project.team || []).length === 0 && (
                <span className="text-xs text-muted-foreground">No team members assigned</span>
              )}
              {(project.team || []).map((m) => {
                const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || m.initials;
                return (
                  <div key={m.id} className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1">
                    <span
                      className="h-5 w-5 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
                      style={{ backgroundColor: avatarColor(name) }}
                    >
                      {m.initials}
                    </span>
                    <span className="text-xs font-medium">{name}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {project.attention && (
            <section>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 pb-1.5 border-b">
                Attention
              </h4>
              <div className="text-xs text-red-700 dark:text-red-400 flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5" /> Flagged for attention — review RAG status
              </div>
            </section>
          )}
        </div>

        <div className="p-3.5 px-5 border-t flex flex-col gap-2">
          <Button
            className="w-full bg-[#4338CA] hover:bg-[#3730A3]"
            onClick={() => {
              onOpenChange(false);
              onOpenWorkspace(project.id);
            }}
            data-testid="button-open-workspace"
          >
            Open project workspace <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              onEditProject(project.id);
            }}
            data-testid="button-edit-project"
          >
            Edit project
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

