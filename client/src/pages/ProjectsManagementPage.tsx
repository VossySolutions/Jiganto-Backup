import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { cn } from "@/lib/utils";
import AgileBoard from "@/components/projects/AgileBoard";
import AgileDashboard from "@/components/projects/AgileDashboard";
import RaiddLogTool from "@/components/projects/RaiddLogTool";
import DeliverablesTracker from "@/components/projects/DeliverablesTracker";
import MilestoneTracker from "@/components/projects/MilestoneTracker";
import { ProjectTrackingBoard } from "@/components/projects/ProjectTrackingBoard";
import { Portfolio360ReportView } from "@/components/portfolio/Portfolio360ReportView";
import {
  PmTeamOrgTool, PmRaciTool, PmResourceTrackerTool, PmTimesheetsTool,
  PmFinanceTrackerTool, PmStatusReportingTool, PmChangeLogTool, PmDocumentationTool,
  PmTestTrackerTool, PmStakeholderTool, PmBpmTool, PmSowTrackerTool, PmWbsTool,
} from "@/components/projects/PmSecondaryTools";
import { ReactGanttChart } from "@/components/projects/ReactGanttChart";
import type { GanttTask, GanttResource, GanttDependency } from "@/components/projects/gantt.types";
import {
  Plus, Search, ChevronRight, ChevronDown, Loader2,
  Calendar, Users, Settings, Lightbulb,
  X, Trash2, ArrowRight,
  Maximize2, Minimize2, Share2, ChevronLeft,
  LayoutGrid, TableProperties, MoreHorizontal,
  ArrowUpDown, ExternalLink, Check
} from "lucide-react";
import {
  PmProjectIcon, PmProgrammeIcon, PmInitiativeIcon, PmCampaignIcon, PmPocIcon,
  PmUserDefinedIcon, PmPortfolioIcon, PmSubProjectIcon, PmProgramIncrementIcon,
  PmWorkstreamIcon, PmTaskForceIcon, PmChangeRequestIcon, PmEnhancementIcon,
  PmExperimentIcon, PmPilotIcon, PmPrototypeIcon, PmSprintIcon, PmImprovementIcon,
  PmGanttChartIcon, PmMilestonePlanIcon, PmScrumBoardIcon, PmKanbanBoardIcon,
  PmEpicsStoriesIcon, PmWbsIcon, PmStatusReportingIcon, PmProjectDashboardIcon,
  Pm360ReportIcon, PmRiskLogIcon, PmIssuesLogIcon, PmAssumptionsLogIcon,
  PmDependenciesLogIcon, PmDecisionsLogIcon, PmChangeLogIcon, PmRaciModelIcon,
  PmResourceTrackerIcon, PmTimesheetsIcon, PmFinanceTrackerIcon, PmSowTrackerIcon,
  PmDocumentationIcon, PmDeliverablesTrackerIcon, PmTestTrackerIcon,
  PmOrgChartIcon, PmStakeholderMapIcon, PmBusinessProcessModelIcon,
  PmPlanningSchedulingIcon, PmReportingDashboardsIcon, PmRaidGovernanceIcon,
  PmResourcesFinanceIcon, PmDocumentationDeliveryIcon, PmPeopleOrganisationIcon,
  PmStatActiveIcon, PmStatPlanningIcon, PmStatOnHoldIcon, PmStatCompletedIcon, PmStatDraftIcon,
  PmSprintBoardIcon, PmBacklogIcon, PmSprintsIcon, PmDefectsIcon, PmRoadmapIcon,
  PmBestPracticeIcon, PmStoriesIcon,
  SettingsGeneralIcon, SettingsPeopleIcon, SettingsFinancialIcon,
  SettingsScheduleIcon, SettingsStrategyIcon, SettingsRiskIcon, SettingsTagsIcon, SettingsGearIcon,
} from "@/components/icons/ModuleIcons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ViewMode = "dashboard" | "all-projects" | "new" | "project";
type DisplayMode = "table" | "cards";

interface WizardData {
  workType: string;
  name: string;
  description: string;
  customer: string;
  lead: string;
  startDate: string;
  endDate: string;
  budget: string;
  priority: string;
  status: string;
  framework: string;
  parentId: string;
  tags: string;
  selectedTools: string[];
}

interface ToolDef {
  id: string;
  name: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ToolCategory {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tools: ToolDef[];
}

interface WorkTypeItem {
  id: string;
  name: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

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

function getWorkType(p: any): string {
  if (p.workType) return p.workType;
  if (p.projectType && LEGACY_TYPE_MAP[p.projectType]) return LEGACY_TYPE_MAP[p.projectType];
  return p.projectType || "project";
}

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

const WORK_TYPES: { main: WorkTypeItem[]; extended: WorkTypeItem[] } = {
  main: [
    { id: "project", name: "Project", desc: "Defined scope, budget & timeline", icon: PmProjectIcon },
    { id: "programme", name: "Programme", desc: "Group of related projects", icon: PmProgrammeIcon },
    { id: "initiative", name: "Initiative", desc: "Strategic business objective", icon: PmInitiativeIcon },
    { id: "campaign", name: "Campaign", desc: "Marketing or comms drive", icon: PmCampaignIcon },
    { id: "poc", name: "POC", desc: "Proof of concept / feasibility", icon: PmPocIcon },
    { id: "user_defined", name: "User Defined", desc: "Custom work type", icon: PmUserDefinedIcon },
  ],
  extended: [
    { id: "portfolio", name: "Portfolio", desc: "Collection of programmes", icon: PmPortfolioIcon },
    { id: "sub_project", name: "Sub-Project", desc: "Child project", icon: PmSubProjectIcon },
    { id: "program_increment", name: "Program Increment", desc: "SAFe PI planning", icon: PmProgramIncrementIcon },
    { id: "workstream", name: "Workstream", desc: "Parallel work track", icon: PmWorkstreamIcon },
    { id: "task_force", name: "Task Force", desc: "Urgent response team", icon: PmTaskForceIcon },
    { id: "change_request", name: "Change Request", desc: "Formal scope change", icon: PmChangeRequestIcon },
    { id: "enhancement", name: "Enhancement", desc: "Feature improvement", icon: PmEnhancementIcon },
    { id: "experiment", name: "Experiment", desc: "Hypothesis testing", icon: PmExperimentIcon },
    { id: "pilot", name: "Pilot", desc: "Limited rollout test", icon: PmPilotIcon },
    { id: "prototype", name: "Prototype", desc: "Working model / MVP", icon: PmPrototypeIcon },
    { id: "sprint", name: "Sprint / Iteration", desc: "Agile time-box", icon: PmSprintIcon },
    { id: "improvement", name: "Improvement", desc: "Process improvement", icon: PmImprovementIcon },
  ],
};

const TOOL_DEFINITIONS: Record<string, ToolCategory> = {
  planning_scheduling: {
    title: "Planning & Scheduling",
    icon: PmPlanningSchedulingIcon,
    tools: [
      { id: "gantt_chart", name: "Gantt Chart", hint: "Timeline & dependencies", icon: PmGanttChartIcon },
      { id: "milestone_plan", name: "Milestone Plan", hint: "Key deliverables", icon: PmMilestonePlanIcon },
      { id: "sprint_board", name: "Sprint Board", hint: "Agile sprint board with drag & drop", icon: PmSprintBoardIcon },
      { id: "scrum_board", name: "Scrum Board", hint: "Agile sprint management", icon: PmScrumBoardIcon },
      { id: "kanban_board", name: "Kanban Board", hint: "Visual task flow", icon: PmKanbanBoardIcon },
      { id: "tracking_board", name: "Tracking Board", hint: "Lightweight flexible table for project tracking", icon: PmKanbanBoardIcon },
      { id: "backlog", name: "Backlog", hint: "Product backlog refinement", icon: PmBacklogIcon },
      { id: "epics", name: "Epics", hint: "Epic tracking & burn-up", icon: PmEpicsStoriesIcon },
      { id: "stories", name: "Stories", hint: "User story management", icon: PmStoriesIcon },
      { id: "sprints", name: "Sprints", hint: "Sprint planning & tracking", icon: PmSprintsIcon },
      { id: "defects", name: "Defects", hint: "Bug tracking & triage", icon: PmDefectsIcon },
      { id: "roadmap", name: "Roadmap", hint: "Release roadmap timeline", icon: PmRoadmapIcon },
      { id: "epics_stories", name: "Epics & Stories", hint: "Product backlog", icon: PmEpicsStoriesIcon },
    ],
  },
  reporting_dashboards: {
    title: "Reporting & Dashboards",
    icon: PmReportingDashboardsIcon,
    tools: [
      { id: "status_reporting", name: "Status Reporting", hint: "Weekly/monthly reports", icon: PmStatusReportingIcon },
      { id: "project_dashboard", name: "Agile Dashboard", hint: "KPIs & health overview", icon: PmProjectDashboardIcon },
      { id: "360_report", name: "360\u00B0 Report", hint: "Full project health view", icon: Pm360ReportIcon },
      { id: "best_practice", name: "Best Practice", hint: "Agile delivery guides", icon: PmBestPracticeIcon },
    ],
  },
  raid_governance: {
    title: "RAID & Governance",
    icon: PmRaidGovernanceIcon,
    tools: [
      { id: "risk_log", name: "Risk Log", hint: "Risk register & mitigation", icon: PmRiskLogIcon },
      { id: "issues_log", name: "Issues Log", hint: "Open issues & actions", icon: PmIssuesLogIcon },
      { id: "assumptions_log", name: "Assumptions Log", hint: "Document assumptions", icon: PmAssumptionsLogIcon },
      { id: "dependencies_log", name: "Dependencies Log", hint: "Track dependencies", icon: PmDependenciesLogIcon },
      { id: "decisions_log", name: "Decisions Log", hint: "Key decision records", icon: PmDecisionsLogIcon },
      { id: "change_log", name: "Change Log", hint: "Scope change tracking", icon: PmChangeLogIcon },
      { id: "raci_model", name: "RACI Model", hint: "Responsibility matrix", icon: PmRaciModelIcon },
    ],
  },
  resources_finance: {
    title: "Resources & Finance",
    icon: PmResourcesFinanceIcon,
    tools: [
      { id: "resource_tracker", name: "Resource Tracker", hint: "Allocation & capacity", icon: PmResourceTrackerIcon },
      { id: "timesheets", name: "Timesheets", hint: "Time logging", icon: PmTimesheetsIcon },
      { id: "finance_tracker", name: "Finance Tracker", hint: "Budget & spend", icon: PmFinanceTrackerIcon },
    ],
  },
  documentation_delivery: {
    title: "Documentation & Delivery",
    icon: PmDocumentationDeliveryIcon,
    tools: [
      { id: "documentation", name: "Documentation", hint: "Project docs & specs", icon: PmDocumentationIcon },
      { id: "deliverables_tracker", name: "Deliverables Tracker", hint: "Track project outputs", icon: PmDeliverablesTrackerIcon },
      { id: "test_tracker", name: "Test Tracker", hint: "QA test management", icon: PmTestTrackerIcon },
      { id: "sow_tracker", name: "Statement of Work", hint: "Scope & deliverables", icon: PmSowTrackerIcon },
      { id: "wbs", name: "WBS", hint: "Work breakdown structure", icon: PmWbsIcon },
    ],
  },
  people_organisation: {
    title: "People & Organisation",
    icon: PmPeopleOrganisationIcon,
    tools: [
      { id: "org_chart", name: "Org Chart", hint: "Team structure", icon: PmOrgChartIcon },
      { id: "stakeholder_map", name: "Stakeholder Map", hint: "Stakeholder engagement", icon: PmStakeholderMapIcon },
      { id: "business_process_model", name: "Business Process Model", hint: "Process flows & BPM", icon: PmBusinessProcessModelIcon },
    ],
  },
};

const MASTER_TOOL_ORDER: string[] = [
  "gantt_chart", "milestone_plan", "project_dashboard", "sprint_board", "backlog",
  "epics", "stories", "sprints", "defects", "roadmap",
  "status_reporting", "360_report", "risk_log", "issues_log", "assumptions_log",
  "dependencies_log", "decisions_log", "change_log", "documentation", "org_chart",
  "stakeholder_map", "business_process_model", "deliverables_tracker", "kanban_board",
  "raci_model", "resource_tracker", "test_tracker", "timesheets", "finance_tracker",
  "sow_tracker", "wbs",
  "scrum_board", "epics_stories",
];

const DEFAULT_TOOLS: Record<string, string[]> = {
  project: ["gantt_chart", "milestone_plan", "project_dashboard", "sprint_board", "backlog", "epics", "stories", "sprints", "defects", "roadmap", "status_reporting", "360_report", "risk_log", "issues_log", "assumptions_log", "dependencies_log", "decisions_log", "change_log", "documentation", "org_chart", "stakeholder_map", "business_process_model", "deliverables_tracker", "kanban_board", "raci_model", "resource_tracker", "test_tracker", "timesheets", "finance_tracker", "sow_tracker", "wbs"],
  programme: ["gantt_chart", "milestone_plan", "status_reporting", "project_dashboard", "risk_log", "issues_log"],
  initiative: ["milestone_plan", "status_reporting", "project_dashboard", "risk_log"],
  campaign: ["kanban_board", "milestone_plan", "status_reporting"],
  poc: ["sprint_board", "backlog", "kanban_board", "project_dashboard"],
  user_defined: [],
  portfolio: ["project_dashboard", "status_reporting"],
  sub_project: ["gantt_chart", "sprint_board", "backlog", "risk_log", "issues_log"],
  sprint: ["sprint_board", "backlog", "kanban_board"],
  pilot: ["milestone_plan", "project_dashboard", "risk_log"],
};

function findToolDefinition(toolId: string): { name: string; category: string; icon: React.ComponentType<{ className?: string }> } | null {
  for (const [catKey, cat] of Object.entries(TOOL_DEFINITIONS)) {
    const tool = cat.tools.find((t) => t.id === toolId);
    if (tool) return { name: tool.name, category: catKey, icon: tool.icon };
  }
  return null;
}

function getAllToolIds(): string[] {
  return Object.values(TOOL_DEFINITIONS).flatMap((cat) => cat.tools.map((t) => t.id));
}

const STAT_CARDS = [
  { key: "active", label: "Active", subtitle: "In progress", icon: PmStatActiveIcon, color: "#2563eb", filterStatus: "active" },
  { key: "planning", label: "Planning", subtitle: "Being scoped", icon: PmStatPlanningIcon, color: "#ca8a04", filterStatus: "planning" },
  { key: "on_hold", label: "On Hold", subtitle: "Paused", icon: PmStatOnHoldIcon, color: "#ea580c", filterStatus: "on_hold" },
  { key: "completed", label: "Completed", subtitle: "Delivered", icon: PmStatCompletedIcon, color: "#16a34a", filterStatus: "completed" },
  { key: "draft", label: "Draft", subtitle: "Not started", icon: PmStatDraftIcon, color: "#64748b", filterStatus: "draft" },
] as const;

const PAGE_SIZE = 10;

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

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value || 0));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${clamped}%`, backgroundColor: clamped >= 100 ? "#16a34a" : "#2563eb" }}
        />
      </div>
      <span className="text-xs text-muted-foreground font-medium w-8 text-right">{clamped}%</span>
    </div>
  );
}

function Pagination({ total, page, onPageChange }: { total: number; page: number; onPageChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-border/50 flex-wrap" data-testid="pagination">
      <span className="text-xs text-muted-foreground">Showing {start}-{end} of {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} data-testid="pagination-prev">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(p)}
            data-testid={`pagination-page-${p}`}
          >
            {p}
          </Button>
        ))}
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} data-testid="pagination-next">
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ProjectTable({ projects, onOpen }: { projects: any[]; onOpen: (id: number) => void }) {
  const [sortCol, setSortCol] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      let va = a[sortCol] ?? "";
      let vb = b[sortCol] ?? "";
      if (sortCol === "progress") {
        va = a.progress ?? 0;
        vb = b.progress ?? 0;
      }
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [projects, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const healthColor = (h: string | null | undefined) => {
    const map: Record<string, string> = { green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500", blue: "bg-blue-500" };
    return map[h || "green"] || map.green;
  };

  return (
    <div className="border border-border/50 rounded-md overflow-hidden bg-card" data-testid="projects-table">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            {[
              { key: "name", label: "Name" },
              { key: "workType", label: "Type" },
              { key: "status", label: "Status" },
              { key: "customer", label: "Customer" },
              { key: "managerId", label: "Lead" },
              { key: "progress", label: "Progress" },
              { key: "ragStatus", label: "Health" },
              { key: "endDate", label: "Due Date" },
              { key: "actions", label: "" },
            ].map((col) => (
              <TableHead
                key={col.key}
                className={cn("text-xs font-semibold uppercase tracking-wider", col.key !== "actions" && "cursor-pointer select-none")}
                onClick={() => col.key !== "actions" && toggleSort(col.key)}
                data-testid={`table-header-${col.key}`}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.key !== "actions" && <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((p) => (
            <TableRow key={p.id} className="cursor-pointer" onClick={() => onOpen(p.id)} data-testid={`table-row-${p.id}`}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <span className={cn("h-2 w-2 rounded-full flex-shrink-0", healthColor(p.ragStatus))} />
                  <div>
                    <div className="font-semibold text-sm text-foreground">{p.name}</div>
                    {p.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{p.description}</div>}
                  </div>
                </div>
              </TableCell>
              <TableCell><TypeBadge type={p.workType || p.projectType} /></TableCell>
              <TableCell><StatusBadge status={p.status} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.customer || "-"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.metadata?.leadName || p.managerId || p.projectManager || "-"}</TableCell>
              <TableCell className="min-w-[120px]"><ProgressBar value={p.progress || 0} /></TableCell>
              <TableCell><HealthPill health={p.ragStatus} /></TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {p.endDate ? new Date(p.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onOpen(p.id); }} data-testid={`button-open-${p.id}`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-12">No work items found</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ProjectCards({ projects, onOpen }: { projects: any[]; onOpen: (id: number) => void }) {
  const healthColor = (h: string) => {
    const map: Record<string, string> = { green: "#16a34a", amber: "#ca8a04", red: "#dc2626", blue: "#2563eb" };
    return map[h] || map.green;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="projects-cards">
      {projects.map((p) => (
        <Card
          key={p.id}
          className="relative overflow-visible cursor-pointer hover-elevate"
          onClick={() => onOpen(p.id)}
          data-testid={`card-project-${p.id}`}
        >
          <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full" style={{ backgroundColor: healthColor(p.ragStatus || "green") }} />
          <CardContent className="p-4 pl-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm text-foreground truncate">{p.name}</div>
                {p.description && <div className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</div>}
              </div>
              <HealthPill health={p.ragStatus} />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <TypeBadge type={p.workType || p.projectType} />
            </div>
            <ProgressBar value={p.progress || 0} className="mb-3" />
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px] bg-muted">{(p.metadata?.leadName || p.managerId || p.projectManager || "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[100px]">{p.metadata?.leadName || p.managerId || p.projectManager || "Unassigned"}</span>
              </div>
              {p.endDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(p.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {projects.length === 0 && (
        <div className="col-span-full text-center text-muted-foreground py-12">No work items found</div>
      )}
    </div>
  );
}

function DashboardView({
  projects,
  isLoading,
  onOpenProject,
  onViewAll,
  onNewProject,
}: {
  projects: any[];
  isLoading: boolean;
  onOpenProject: (id: number) => void;
  onViewAll: () => void;
  onNewProject: () => void;
}) {
  const [dashTab, setDashTab] = useState<"projects" | "milestones">("projects");
  const [viewMode, setViewMode] = useState<DisplayMode>("table");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [mineFilter, setMineFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const statCounts = useMemo(() => {
    const counts: Record<string, number> = { active: 0, planning: 0, on_hold: 0, completed: 0, draft: 0 };
    projects.forEach((p) => { const s = p.status || "draft"; if (counts[s] !== undefined) counts[s]++; });
    return counts;
  }, [projects]);

  const customers = useMemo(() => Array.from(new Set(projects.map((p) => p.customer).filter(Boolean))), [projects]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter !== "all" && (p.workType || p.projectType) !== typeFilter) return false;
      if (customerFilter !== "all" && p.customer !== customerFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name?.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [projects, statusFilter, typeFilter, customerFilter, searchQuery, mineFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ModuleHeader
        icon={PmProjectIcon}
        title="Projects"
        subtitle="Manage your project portfolio"
        searchPlaceholder="Search projects..."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        actions={
          <Button onClick={onNewProject} data-testid="button-new-work-item">
            <Plus className="h-4 w-4 mr-1.5" />
            New Work Item
          </Button>
        }
      />

      <div className="px-4">
        <div className="flex border-b mb-4" data-testid="projects-dash-tabs">
          <button
            className={cn(
              "px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition",
              dashTab === "projects" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
            )}
            onClick={() => setDashTab("projects")}
            data-testid="tab-projects"
          >
            All Projects
          </button>
          <button
            className={cn(
              "px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition",
              dashTab === "milestones" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
            )}
            onClick={() => setDashTab("milestones")}
            data-testid="tab-milestones"
          >
            Milestones
          </button>
        </div>

        {dashTab === "milestones" && (
          <MilestoneTracker mode="cross-project" />
        )}

        {dashTab === "projects" && <>
        <ModuleWelcomeBanner
          moduleKey="projects"
          features={["Multi-methodology delivery", "RAID management", "Tool-based execution", "Progress tracking"]}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-5" data-testid="stat-cards">
          {STAT_CARDS.map((card) => {
            const Icon = card.icon;
            const isActive = statusFilter === card.filterStatus;
            return (
              <Card
                key={card.key}
                className={cn(
                  "relative overflow-visible cursor-pointer hover-elevate",
                  isActive && "ring-2 ring-offset-1"
                )}
                style={isActive ? { borderColor: card.color, boxShadow: `0 0 0 1px ${card.color}30` } : undefined}
                onClick={() => { setStatusFilter(isActive ? "all" : card.filterStatus); setPage(1); }}
                data-testid={`stat-card-${card.key}`}
              >
                <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full" style={{ backgroundColor: card.color }} />
                <CardContent className="p-4 pl-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-2xl font-bold text-foreground">{statCounts[card.key] || 0}</div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">{card.label}</div>
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">{card.subtitle}</div>
                    </div>
                    <Icon className="h-5 w-5 opacity-40" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap" data-testid="filter-bar">
          <Button
            variant={!mineFilter ? "default" : "outline"}
            size="sm"
            onClick={() => { setMineFilter(false); setPage(1); }}
            data-testid="filter-all"
          >
            All
          </Button>
          <Button
            variant={mineFilter ? "default" : "outline"}
            size="sm"
            onClick={() => { setMineFilter(true); setPage(1); }}
            data-testid="filter-mine"
          >
            My Work Items
          </Button>

          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]" data-testid="filter-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {[...WORK_TYPES.main, ...WORK_TYPES.extended].map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]" data-testid="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.keys(STATUS_COLORS).map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={customerFilter} onValueChange={(v) => { setCustomerFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]" data-testid="filter-customer">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5" data-testid="view-toggle">
            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-1.5", viewMode === "table" && "bg-background shadow-sm")}
              onClick={() => setViewMode("table")}
              data-testid="view-table"
            >
              <TableProperties className="h-3.5 w-3.5" />
              Table
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-1.5", viewMode === "cards" && "bg-background shadow-sm")}
              onClick={() => setViewMode("cards")}
              data-testid="view-cards"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={onViewAll} data-testid="button-view-all">
            View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        {viewMode === "table" ? (
          <ProjectTable projects={paged} onOpen={onOpenProject} />
        ) : (
          <ProjectCards projects={paged} onOpen={onOpenProject} />
        )}

        {filtered.length > PAGE_SIZE && (
          <Pagination total={filtered.length} page={page} onPageChange={setPage} />
        )}
        </>}
      </div>
    </div>
  );
}

function AllProjectsView({
  projects,
  isLoading,
  onOpenProject,
  onNewProject,
  onBack,
}: {
  projects: any[];
  isLoading: boolean;
  onOpenProject: (id: number) => void;
  onNewProject: () => void;
  onBack: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (typeFilter !== "all" && (p.workType || p.projectType) !== typeFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, typeFilter, statusFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-dashboard">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground" data-testid="text-all-work-items-title">All Work Items</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} items</p>
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]" data-testid="allview-filter-type"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {[...WORK_TYPES.main, ...WORK_TYPES.extended].map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]" data-testid="allview-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(STATUS_COLORS).map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onNewProject} data-testid="button-new-work-item-all">
          <Plus className="h-4 w-4 mr-1.5" />
          New Work Item
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <ProjectTable projects={paged} onOpen={onOpenProject} />
          {filtered.length > PAGE_SIZE && <Pagination total={filtered.length} page={page} onPageChange={setPage} />}
        </>
      )}
    </div>
  );
}

function WizardView({
  onCancel,
  onComplete,
  tenantId,
}: {
  onCancel: () => void;
  onComplete: () => void;
  tenantId: number;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showExtended, setShowExtended] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>({
    workType: "",
    name: "",
    description: "",
    customer: "",
    lead: "",
    startDate: "",
    endDate: "",
    budget: "",
    priority: "medium",
    status: "planning",
    framework: "hybrid",
    parentId: "",
    tags: "",
    selectedTools: [],
  });

  const updateField = (field: keyof WizardData, value: any) => {
    setWizardData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTypeSelect = (typeId: string) => {
    const defaults = DEFAULT_TOOLS[typeId] || [];
    setWizardData((prev) => ({ ...prev, workType: typeId, selectedTools: defaults }));
  };

  const toggleTool = (toolId: string) => {
    setWizardData((prev) => ({
      ...prev,
      selectedTools: prev.selectedTools.includes(toolId)
        ? prev.selectedTools.filter((t) => t !== toolId)
        : [...prev.selectedTools, toolId],
    }));
  };

  const createMutation = useMutation({
    mutationFn: async (data: WizardData) => {
      const project = await apiRequest("POST", "/api/pm/projects", {
        tenantId,
        name: data.name,
        description: data.description || null,
        workType: data.workType,
        customer: data.customer || null,
        status: data.status,
        priority: data.priority,
        methodology: data.framework,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        budget: data.budget || null,
        programId: data.parentId ? Number(data.parentId) : null,
        metadata: data.lead ? { leadName: data.lead } : null,
      });
      const projectData = await project.json();
      if (data.selectedTools.length > 0) {
        await apiRequest("POST", `/api/pm/projects/${projectData.id}/tools/bulk`, {
          tools: data.selectedTools.map((toolId, index) => {
            const toolDef = findToolDefinition(toolId);
            return {
              tenantId,
              toolType: toolId,
              toolCategory: toolDef?.category || "planning_scheduling",
              label: toolDef?.name || toolId,
              sortOrder: index,
            };
          }),
        });
      }
      return projectData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/projects?tenantId=1`] });
      toast({ title: "Work item created successfully" });
      onComplete();
    },
    onError: (err: any) => {
      toast({ title: "Error creating work item", description: err.message, variant: "destructive" });
    },
  });

  const canProceed = () => {
    if (step === 1) return !!wizardData.workType;
    if (step === 2) return !!wizardData.name;
    return true;
  };

  const handleNext = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else createMutation.mutate(wizardData);
  };

  const steps = [
    { num: 1, label: "Select Work Type", desc: "Choose what you're creating" },
    { num: 2, label: "Project Details", desc: "Fill in the key info" },
    { num: 3, label: "Choose Execution Tools", desc: "Pick the tools you need" },
  ];

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden" data-testid="wizard-view">
      <div className="w-[280px] flex-shrink-0 border-r border-border bg-card p-6 flex flex-col">
        <h3 className="text-sm font-bold text-foreground mb-1">New Work Item</h3>
        <p className="text-xs text-muted-foreground mb-6 leading-relaxed">Set up your project in three simple steps.</p>

        <div className="space-y-0 flex-1">
          {steps.map((s, i) => (
            <div key={s.num} className="flex gap-3 pb-6 relative" data-testid={`wizard-step-${s.num}`}>
              {i < steps.length - 1 && (
                <div className={cn("absolute left-[14px] top-8 bottom-0 w-0.5", step > s.num ? "bg-[#2563eb]" : "bg-border")} />
              )}
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 relative z-10 border-2 transition-colors",
                  step === s.num && "border-[#2563eb] text-[#2563eb] bg-blue-50 dark:bg-blue-950",
                  step > s.num && "border-[#2563eb] bg-[#2563eb] text-white",
                  step < s.num && "border-border text-muted-foreground bg-background"
                )}
              >
                {step > s.num ? <Check className="h-3.5 w-3.5" /> : s.num}
              </div>
              <div>
                <div className={cn("text-xs font-semibold", step === s.num ? "text-[#2563eb]" : "text-foreground")}>{s.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-muted/50 rounded-md p-3 mt-auto">
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-foreground">Tip</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            You can add or remove tools later from the project detail view. Choose the essentials now.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
        {step === 1 && (
          <div data-testid="wizard-step-1-content">
            <h2 className="text-lg font-bold text-foreground mb-1">Select Work Type</h2>
            <p className="text-sm text-muted-foreground mb-6">What kind of work item are you creating?</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {WORK_TYPES.main.map((t) => {
                const Icon = t.icon;
                const selected = wizardData.workType === t.id;
                return (
                  <Card
                    key={t.id}
                    className={cn(
                      "cursor-pointer text-center p-5 transition-all hover-elevate",
                      selected && "ring-2 ring-[#2563eb] bg-blue-50/50 dark:bg-blue-950/20"
                    )}
                    onClick={() => handleTypeSelect(t.id)}
                    data-testid={`type-card-${t.id}`}
                  >
                    <Icon className={cn("h-7 w-7 mx-auto mb-2", selected ? "text-[#2563eb]" : "text-muted-foreground")} />
                    <div className={cn("text-sm font-bold", selected ? "text-[#2563eb]" : "text-foreground")}>{t.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{t.desc}</div>
                  </Card>
                );
              })}
            </div>

            <button
              className="text-xs font-semibold text-[#2563eb] flex items-center gap-1 mb-4 bg-transparent border-0 cursor-pointer"
              onClick={() => setShowExtended(!showExtended)}
              data-testid="toggle-extended-types"
            >
              {showExtended ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {showExtended ? "Hide" : "Show"} all work types ({WORK_TYPES.extended.length} more)
            </button>

            {showExtended && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {WORK_TYPES.extended.map((t) => {
                  const Icon = t.icon;
                  const selected = wizardData.workType === t.id;
                  return (
                    <Card
                      key={t.id}
                      className={cn(
                        "cursor-pointer text-center p-4 transition-all hover-elevate",
                        selected && "ring-2 ring-[#2563eb] bg-blue-50/50 dark:bg-blue-950/20"
                      )}
                      onClick={() => handleTypeSelect(t.id)}
                      data-testid={`type-card-${t.id}`}
                    >
                      <Icon className={cn("h-6 w-6 mx-auto mb-1.5", selected ? "text-[#2563eb]" : "text-muted-foreground")} />
                      <div className={cn("text-xs font-bold", selected ? "text-[#2563eb]" : "text-foreground")}>{t.name}</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{t.desc}</div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div data-testid="wizard-step-2-content">
            <h2 className="text-lg font-bold text-foreground mb-1">Project Details</h2>
            <p className="text-sm text-muted-foreground mb-6">Fill in the essential information for your {wizardData.workType.replace(/_/g, " ")}.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name *</label>
                <Input
                  value={wizardData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Enter project name"
                  data-testid="input-wizard-name"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                <Textarea
                  value={wizardData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Brief description..."
                  className="resize-none"
                  data-testid="input-wizard-description"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</label>
                <Input
                  value={wizardData.customer}
                  onChange={(e) => updateField("customer", e.target.value)}
                  placeholder="Customer / client name"
                  data-testid="input-wizard-customer"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Lead *</label>
                <Input
                  value={wizardData.lead}
                  onChange={(e) => updateField("lead", e.target.value)}
                  placeholder="Lead name"
                  data-testid="input-wizard-lead"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date</label>
                <Input
                  type="date"
                  value={wizardData.startDate}
                  onChange={(e) => updateField("startDate", e.target.value)}
                  data-testid="input-wizard-start-date"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End Date</label>
                <Input
                  type="date"
                  value={wizardData.endDate}
                  onChange={(e) => updateField("endDate", e.target.value)}
                  data-testid="input-wizard-end-date"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget</label>
                <Input
                  value={wizardData.budget}
                  onChange={(e) => updateField("budget", e.target.value)}
                  placeholder="e.g. 500000"
                  data-testid="input-wizard-budget"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</label>
                <Select value={wizardData.priority} onValueChange={(v) => updateField("priority", v)}>
                  <SelectTrigger data-testid="select-wizard-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
                <Select value={wizardData.status} onValueChange={(v) => updateField("status", v)}>
                  <SelectTrigger data-testid="select-wizard-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(STATUS_COLORS).map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Framework</label>
                <Select value={wizardData.framework} onValueChange={(v) => updateField("framework", v)}>
                  <SelectTrigger data-testid="select-wizard-framework"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waterfall">Waterfall</SelectItem>
                    <SelectItem value="agile">Agile</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parent Programme / Portfolio</label>
                <Input
                  value={wizardData.parentId}
                  onChange={(e) => updateField("parentId", e.target.value)}
                  placeholder="ID (optional)"
                  data-testid="input-wizard-parent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tags</label>
                <Input
                  value={wizardData.tags}
                  onChange={(e) => updateField("tags", e.target.value)}
                  placeholder="Comma-separated tags"
                  data-testid="input-wizard-tags"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div data-testid="wizard-step-3-content">
            <h2 className="text-lg font-bold text-foreground mb-1">Choose Execution Tools</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Select the tools you want enabled for this {wizardData.workType.replace(/_/g, " ")}. You can change these later.
            </p>

            {Object.entries(TOOL_DEFINITIONS).map(([catKey, cat]) => {
              const CatIcon = cat.icon;
              return (
                <div key={catKey} className="mb-5">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
                    <CatIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{cat.title}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {cat.tools.map((tool) => {
                      const selected = wizardData.selectedTools.includes(tool.id);
                      const ToolIcon = tool.icon;
                      return (
                        <div
                          key={tool.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors",
                            selected
                              ? "border-[#2563eb] bg-blue-50/50 dark:bg-blue-950/20"
                              : "border-border/50 bg-card hover:bg-muted/50"
                          )}
                          onClick={() => toggleTool(tool.id)}
                          data-testid={`tool-card-${tool.id}`}
                        >
                          <ToolIcon className={cn("h-4.5 w-4.5 flex-shrink-0", selected ? "text-[#2563eb]" : "text-muted-foreground")} />
                          <div className="flex-1 min-w-0">
                            <div className={cn("text-xs font-semibold", selected ? "text-[#2563eb]" : "text-foreground")}>{tool.name}</div>
                            <div className="text-[10px] text-muted-foreground">{tool.hint}</div>
                          </div>
                          <div
                            className={cn(
                              "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                              selected
                                ? "border-[#2563eb] bg-[#2563eb] text-white"
                                : "border-border"
                            )}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-5 border-t border-border/50">
          <div className="text-xs text-muted-foreground">
            {step === 3 && <span>{wizardData.selectedTools.length} tools selected</span>}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} data-testid="button-wizard-back">
                Back
              </Button>
            )}
            <Button variant="outline" onClick={onCancel} data-testid="button-wizard-cancel">Cancel</Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed() || createMutation.isPending}
              data-testid="button-wizard-next"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {step === 3 ? "Create Work Item" : "Next"}
              {step < 3 && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectDetailView({
  projectId,
  tenantId,
  onBack,
}: {
  projectId: number;
  tenantId: number;
  onBack: () => void;
}) {
  const [activeTool, setActiveTool] = useState<string>("");
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [dragTabIdx, setDragTabIdx] = useState<number | null>(null);
  const [dragOverTabIdx, setDragOverTabIdx] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [showSettings, setShowSettings] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: [`/api/pm/projects?tenantId=${tenantId}`] });
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
          tenantId,
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

  const activeToolDef = findToolDefinition(currentActiveTool);

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
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid="button-fullscreen"><Maximize2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowSettings(!showSettings)} data-testid="button-project-settings"><SettingsGearIcon className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

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
              <span className="text-xs text-muted-foreground">Loading tools…</span>
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
                  ×
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
            <button className="text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-0" onClick={() => setShowMoreTools(false)} data-testid="button-close-more-tools">✕ Close</button>
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
        {allowEmpty && <option value="">— Not set —</option>}
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
                { value: "tier1_strategic", label: "Tier 1 — Strategic" },
                { value: "tier2_operational", label: "Tier 2 — Operational" },
                { value: "tier3_tactical", label: "Tier 3 — Tactical" },
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

const PM_STATUS_TO_GANTT: Record<string, GanttTask['status']> = {
  todo: 'notstarted',
  in_progress: 'inprogress',
  in_review: 'inprogress',
  done: 'completed',
  blocked: 'onhold',
};

const GANTT_STATUS_TO_PM: Record<GanttTask['status'], string> = {
  notstarted: 'todo',
  inprogress: 'in_progress',
  completed: 'done',
  onhold: 'blocked',
  atrisk: 'in_progress',
};

const SUMMARY_TYPES = new Set(['project', 'release', 'phase', 'workstream']);

function parseResourceNamesFromDesc(desc: string | null | undefined): string[] {
  if (!desc) return [];
  const match = desc.match(/^resources:(.+)$/);
  if (!match) return [];
  return match[1].split(';').map(s => s.trim()).filter(Boolean);
}

function pmTaskToGanttTask(t: any): GanttTask {
  const today = new Date().toISOString().slice(0, 10);
  const start = t.plannedStartDate || today;
  const end = t.plannedEndDate || start;
  const rawType = t.ganttType ? String(t.ganttType).toLowerCase() : null;
  const VALID_TYPES = new Set(['project','release','phase','workstream','activity','task','subtask','milestone']);
  const ganttType = (rawType && VALID_TYPES.has(rawType) ? rawType : (t.isSummary ? 'phase' : 'task')) as GanttTask['type'];
  const resNames = parseResourceNamesFromDesc(t.description);
  const resources = t.assigneeId ? [t.assigneeId] : resNames;
  return {
    id: `pm-${t.id}`,
    name: t.name || 'Untitled',
    type: ganttType,
    start,
    end,
    progress: t.progress ?? 0,
    status: PM_STATUS_TO_GANTT[t.status] || 'notstarted',
    priority: (t.priority as GanttTask['priority']) || 'medium',
    resources,
    parent: t.parentTaskId ? `pm-${t.parentTaskId}` : undefined,
  };
}

function ganttToPmUpdate(ganttTask: GanttTask) {
  const numId = parseInt(ganttTask.id.replace('pm-', ''), 10);
  const res: Record<string, any> = {
    id: numId,
    name: ganttTask.name,
    plannedStartDate: ganttTask.start,
    plannedEndDate: ganttTask.end,
    progress: ganttTask.progress ?? 0,
    status: GANTT_STATUS_TO_PM[ganttTask.status] || 'todo',
    priority: ganttTask.priority,
    ganttType: ganttTask.type.toLowerCase(),
    isSummary: SUMMARY_TYPES.has(ganttTask.type),
  };
  if (ganttTask.resources && ganttTask.resources.length > 0) {
    res.assigneeId = ganttTask.resources[0];
  }
  if (ganttTask.parent && ganttTask.parent.startsWith('pm-')) {
    res.parentTaskId = parseInt(ganttTask.parent.replace('pm-', ''), 10);
  }
  return res;
}

function ProjectGanttWrapper({ project }: { project: any }) {
  // CSS height:100% cascading is broken inside Radix ScrollArea (which renders
  // a display:table wrapper internally). JS-calculated height bypasses this
  // entirely — window.innerHeight minus the fixed pixel overhead above the Gantt:
  //   Project header  (py-2 + h-7 content + border) ≈ 45 px
  //   Tool tabs bar   (py-1.5 tabs + border)         ≈ 37 px
  //   Tool panel hdr  (py-1.5 + h-5 icon + border)  ≈ 33 px
  //   Total                                          ≈ 115 px  (+15 px safety)
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
      {/* Tool header row — hidden for Gantt because SVARGanttChart has its own
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
            <Button variant="outline" size="sm" data-testid={`button-tool-add-${toolId}`}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      )}
      {/* Content — for Gantt, flex-1 min-h-0 so it fills the remaining height */}
      <div className={isGantt ? "flex-1 min-h-0 overflow-hidden" : ""}>
        {renderPlaceholder()}
      </div>
    </div>
  );
}

export default function ProjectsManagementPage() {
  const { mainMargin, mobileTopOffset } = useShellLayout();
  const [, setLocation] = useLocation();
  const params = useParams<{ projectId?: string }>();

  const { data: tenants } = useQuery<{ id: number }[]>({ queryKey: ["/api/tenants"] });
  const tenantId = tenants?.[0]?.id ?? 1;

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
    queryKey: [`/api/pm/projects?tenantId=${tenantId}`],
    enabled: !!tenantId,
  });

  const handleOpenProject = (id: number) => {
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
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main
        className={cn(
          "flex-1 flex flex-col overflow-hidden transition-all duration-300",
          mainMargin, mobileTopOffset
        )}
      >
        <ScrollArea className="flex-1">
          <div className="flex flex-col min-h-full">
            {currentView === "dashboard" && (
              <DashboardView
                projects={projects}
                isLoading={isLoading}
                onOpenProject={handleOpenProject}
                onViewAll={() => setCurrentView("all-projects")}
                onNewProject={() => setCurrentView("new")}
              />
            )}

            {currentView === "all-projects" && (
              <AllProjectsView
                projects={projects}
                isLoading={isLoading}
                onOpenProject={handleOpenProject}
                onNewProject={() => setCurrentView("new")}
                onBack={() => setCurrentView("dashboard")}
              />
            )}

            {currentView === "new" && (
              <WizardView
                onCancel={() => setCurrentView("dashboard")}
                onComplete={() => setCurrentView("dashboard")}
                tenantId={tenantId}
              />
            )}

            {currentView === "project" && selectedProjectId && (
              <ProjectDetailView
                projectId={selectedProjectId}
                tenantId={tenantId}
                onBack={handleBackFromProject}
              />
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}