import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  fetchOrgMemberCandidates,
  type OrgMemberCandidate,
} from "@/components/workspaces/orgMembers";
import {
  METHODOLOGY_PRESETS,
  recommendedMethodologyId,
  presetToEditablePhases,
  type EditablePhase,
  type MethodologyPreset,
} from "@/lib/pm-methodology-presets";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Loader2,
} from "lucide-react";
import {
  PmProjectIcon, PmProgrammeIcon, PmInitiativeIcon, PmCampaignIcon, PmPocIcon,
  PmUserDefinedIcon, PmPortfolioIcon, PmSubProjectIcon, PmProgramIncrementIcon,
  PmWorkstreamIcon, PmTaskForceIcon, PmChangeRequestIcon, PmEnhancementIcon,
  PmExperimentIcon, PmPilotIcon, PmPrototypeIcon, PmSprintIcon, PmImprovementIcon,
  PmGanttChartIcon, PmMilestonePlanIcon, PmKanbanBoardIcon,
  PmWbsIcon, PmStatusReportingIcon, PmProjectDashboardIcon,
  Pm360ReportIcon, PmRiskLogIcon, PmIssuesLogIcon, PmAssumptionsLogIcon,
  PmDependenciesLogIcon, PmDecisionsLogIcon, PmChangeLogIcon, PmRaciModelIcon,
  PmResourceTrackerIcon, PmTimesheetsIcon, PmFinanceTrackerIcon, PmSowTrackerIcon,
  PmDocumentationIcon, PmDeliverablesTrackerIcon, PmTestTrackerIcon,
  PmOrgChartIcon, PmStakeholderMapIcon, PmBusinessProcessModelIcon,
  PmPlanningSchedulingIcon, PmReportingDashboardsIcon, PmRaidGovernanceIcon,
  PmResourcesFinanceIcon, PmDocumentationDeliveryIcon, PmPeopleOrganisationIcon,
  PmSprintBoardIcon,
} from "@/components/icons/ModuleIcons";

type IconComp = ComponentType<{ className?: string }>;

type WorkTypeItem = { id: string; name: string; desc: string; icon: IconComp };
type ToolDef = { id: string; name: string; hint: string; icon: IconComp; crossModule?: string; multiInstance?: boolean; pickerHidden?: boolean };
type ToolCategory = { title: string; icon: IconComp; tag?: string; tools: ToolDef[] };

/** Granular Agile tools folded into the single `agile` workspace tool. */
export const LEGACY_AGILE_TOOL_IDS = [
  "kanban_board",
  "sprint_board",
  "scrum_board",
  "backlog",
  "epics",
  "stories",
  "sprints",
  "defects",
  "roadmap",
  "epics_stories",
  "best_practice",
] as const;

export const LEGACY_AGILE_TOOL_ID_SET = new Set<string>(LEGACY_AGILE_TOOL_IDS);

export const WORK_TYPES: { main: WorkTypeItem[]; extended: WorkTypeItem[] } = {
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

export const TOOL_DEFINITIONS: Record<string, ToolCategory> = {
  planning_scheduling: {
    title: "Planning & Scheduling",
    icon: PmPlanningSchedulingIcon,
    tools: [
      { id: "gantt_chart", name: "Gantt Chart", hint: "Timeline & dependencies", icon: PmGanttChartIcon, multiInstance: true },
      { id: "milestone_plan", name: "Milestone Plan", hint: "Key deliverables & gates", icon: PmMilestonePlanIcon },
      {
        id: "agile",
        name: "Agile",
        hint: "Epic → Feature → Story → AC → Test → Sprint → Defect pipeline",
        icon: PmSprintBoardIcon,
      },
      { id: "tracking_board", name: "Tracking Board", hint: "Lightweight flexible tracking", icon: PmKanbanBoardIcon, multiInstance: true },
      { id: "whiteboard", name: "Whiteboard", hint: "Collaborative sticky notes", icon: PmKanbanBoardIcon },
    ],
  },
  reporting_dashboards: {
    title: "Reporting & Dashboards",
    icon: PmReportingDashboardsIcon,
    tools: [
      { id: "status_reporting", name: "Status Reporting", hint: "Weekly/monthly reports — open from Projects → Status Reports", icon: PmStatusReportingIcon, pickerHidden: true },
      { id: "360_report", name: "360° Report", hint: "Full project health — open from Projects → 360° Reports", icon: Pm360ReportIcon, pickerHidden: true },
      { id: "project_dashboard", name: "Overview", hint: "KPIs & health — velocity, burn-down, cycle time", icon: PmProjectDashboardIcon },
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
      { id: "change_log", name: "Change Log", hint: "Scope change tracking", icon: PmChangeLogIcon },
      { id: "raci_model", name: "RACI Model", hint: "Responsibility matrix", icon: PmRaciModelIcon },
      { id: "decisions_log", name: "Decisions Log", hint: "Key decision records", icon: PmDecisionsLogIcon },
      { id: "support_tickets", name: "Support Tickets", hint: "Help Desk tickets linked to this project", icon: PmIssuesLogIcon },
    ],
  },
  resources_finance: {
    title: "Resources & Finance",
    icon: PmResourcesFinanceIcon,
    tag: "Links to other modules",
    tools: [
      { id: "resource_tracker", name: "Resource Tracker", hint: "Allocation & capacity", icon: PmResourceTrackerIcon, crossModule: "Resource Planning" },
      { id: "timesheets", name: "Timesheets", hint: "Time logging", icon: PmTimesheetsIcon, crossModule: "Timesheets" },
      { id: "finance_tracker", name: "Finance Tracker", hint: "Budget & spend", icon: PmFinanceTrackerIcon, crossModule: "Finance" },
    ],
  },
  documentation_delivery: {
    title: "Documentation & Delivery",
    icon: PmDocumentationDeliveryIcon,
    tools: [
      { id: "documentation", name: "Documentation", hint: "Project docs & specs", icon: PmDocumentationIcon, crossModule: "Documents" },
      { id: "deliverables_tracker", name: "Deliverables Tracker", hint: "Track project outputs", icon: PmDeliverablesTrackerIcon },
      { id: "test_tracker", name: "Test Tracker", hint: "QA test management", icon: PmTestTrackerIcon, crossModule: "Test Management" },
      { id: "sow_tracker", name: "Statement of Work", hint: "Scope & deliverables contract", icon: PmSowTrackerIcon },
      { id: "wbs", name: "WBS", hint: "Work breakdown structure", icon: PmWbsIcon },
    ],
  },
  people_organisation: {
    title: "People & Organisation",
    icon: PmPeopleOrganisationIcon,
    tag: "Links to other modules",
    tools: [
      { id: "org_chart", name: "Org Chart", hint: "Project organisation chart", icon: PmOrgChartIcon, crossModule: "Resources" },
      { id: "stakeholder_map", name: "Stakeholder Map", hint: "Stakeholder influence & interest", icon: PmStakeholderMapIcon },
      { id: "business_process_model", name: "Business Process Model", hint: "Process flows & BPM diagrams", icon: PmBusinessProcessModelIcon, crossModule: "BPM" },
    ],
  },
};

export const MASTER_TOOL_ORDER: string[] = [
  "project_dashboard", "360_report", "gantt_chart", "milestone_plan", "agile", "tracking_board",
  "status_reporting", "risk_log", "issues_log", "assumptions_log",
  "dependencies_log", "decisions_log", "change_log", "documentation", "org_chart",
  "stakeholder_map", "business_process_model", "deliverables_tracker",
  "raci_model", "resource_tracker", "test_tracker", "timesheets", "finance_tracker",
  "sow_tracker", "wbs", "whiteboard", "support_tickets",
];

const ALWAYS_TOOLS = ["project_dashboard"] as const;

const DEFAULT_TOOLS: Record<string, string[]> = {
  project: ["project_dashboard", "gantt_chart", "milestone_plan", "tracking_board", "risk_log", "issues_log", "assumptions_log", "dependencies_log", "change_log", "raci_model", "resource_tracker", "timesheets", "finance_tracker", "documentation", "deliverables_tracker", "test_tracker", "wbs"],
  programme: ["project_dashboard", "gantt_chart", "milestone_plan", "risk_log", "issues_log"],
  initiative: ["project_dashboard", "milestone_plan", "risk_log"],
  campaign: ["project_dashboard", "agile", "milestone_plan"],
  poc: ["project_dashboard", "agile"],
  user_defined: [...ALWAYS_TOOLS],
  portfolio: ["project_dashboard"],
  sub_project: ["project_dashboard", "gantt_chart", "agile", "risk_log", "issues_log"],
  sprint: ["project_dashboard", "agile"],
  pilot: ["project_dashboard", "milestone_plan", "risk_log"],
};

export function findToolDefinition(toolId: string): { name: string; category: string; icon: IconComp; pickerHidden?: boolean } | null {
  if (LEGACY_AGILE_TOOL_ID_SET.has(toolId)) {
    return { name: "Agile", category: "planning_scheduling", icon: PmSprintBoardIcon, pickerHidden: true };
  }
  for (const [catKey, cat] of Object.entries(TOOL_DEFINITIONS)) {
    const tool = cat.tools.find((t) => t.id === toolId);
    if (tool) return { name: tool.name, category: catKey, icon: tool.icon, pickerHidden: tool.pickerHidden };
  }
  return null;
}

export function getAllToolIds(): string[] {
  return Object.values(TOOL_DEFINITIONS).flatMap((cat) => cat.tools.map((t) => t.id));
}

/** Tool IDs shown in wizard / add-tool pickers. */
export function getPickerToolIds(): string[] {
  return getAllToolIds().filter((id) => !findToolDefinition(id)?.pickerHidden);
}

/** Collapse legacy Agile tool rows into a single Agile nav entry. */
export function coalesceAgileTools<T extends { toolType: string; label?: string | null }>(tools: T[]): T[] {
  const legacy = tools.filter((t) => LEGACY_AGILE_TOOL_ID_SET.has(t.toolType));
  const hasUnified = tools.some((t) => t.toolType === "agile");
  const withoutLegacy = tools.filter((t) => !LEGACY_AGILE_TOOL_ID_SET.has(t.toolType));
  if (legacy.length === 0) return withoutLegacy;
  if (hasUnified) return withoutLegacy;
  const seed = legacy[0];
  return [
    ...withoutLegacy,
    {
      ...seed,
      toolType: "agile",
      label: "Agile",
    },
  ];
}

type PortfolioRow = { id: number; name: string; ownerId?: string | null };

type WizardData = {
  workType: string;
  name: string;
  description: string;
  code: string;
  strategicObjective: string;
  tags: string[];
  visibility: string;
  leadId: string;
  lead: string;
  pmoOwnerId: string;
  pmoOwner: string;
  customer: string;
  sponsor: string;
  contactPhone: string;
  contactEmail: string;
  teamMemberIds: string[];
  priority: string;
  complexityLevel: string;
  startDate: string;
  endDate: string;
  status: string;
  statusCadence: string;
  reportAudience: string;
  budget: string;
  currency: string;
  contractValue: string;
  portfolioId: string;
  methodologyId: string;
  ragStatus: string;
  financialRag: string;
  scheduleRag: string;
  selectedTools: string[];
  toolInstances: Record<string, string[]>;
};

type LoadedProject = Record<string, unknown> & {
  id: number;
  name: string;
  metadata?: Record<string, unknown> | null;
};

type LoadedTeamRow = {
  id: number;
  userId: string;
  role?: string | null;
};

type LoadedToolRow = {
  id: number;
  toolType: string;
  label?: string | null;
  isEnabled?: boolean | null;
};

type LoadedPhaseRow = {
  id: number;
  name: string;
  description?: string | null;
};

function toDecimalOrNull(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return cleaned;
}

function formatDateInput(value: string | null | undefined) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatMoneyInput(value: string | number | null | undefined) {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(n)) return String(value);
  return Number.isInteger(n) ? String(n) : String(value);
}

function buildProjectPayload(data: WizardData, phases: EditablePhase[], activePreset: MethodologyPreset) {
  const methodologyDocs = phases.map((p) => ({
    phase: p.name,
    docs: p.docs.map((d) => ({ name: d.name, optional: !!d.optional })),
  }));
  const budgetValue = toDecimalOrNull(data.budget);
  const contractNumeric = toDecimalOrNull(data.contractValue);
  return {
    name: data.name,
    description: data.description || null,
    code: data.code || null,
    workType: data.workType,
    customer: data.customer || null,
    status: data.status,
    priority: data.priority,
    methodology: data.methodologyId,
    framework: data.methodologyId,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    budget: budgetValue,
    forecastBudget: contractNumeric,
    portfolioId: data.portfolioId ? Number(data.portfolioId) : null,
    managerId: data.leadId || null,
    ownerId: data.pmoOwnerId || null,
    projectManager: data.lead || null,
    deliveryOwner: data.pmoOwner || null,
    executiveSponsor: data.sponsor || null,
    strategicObjective: data.strategicObjective || null,
    complexityLevel: data.complexityLevel || null,
    tags: data.tags.length ? data.tags : null,
    ragStatus: data.ragStatus || "green",
    financialRag: data.financialRag || "green",
    scheduleRag: data.scheduleRag || "green",
    metadata: {
      leadName: data.lead || undefined,
      visibility: data.visibility,
      statusCadence: data.statusCadence,
      reportAudience: data.reportAudience,
      currency: data.currency,
      contractValue: data.contractValue || undefined,
      contactPhone: data.contactPhone || undefined,
      contactEmail: data.contactEmail || undefined,
      methodologyDocs,
      methodologyName: activePreset.name,
    },
  };
}

function projectToWizardData(
  project: LoadedProject,
  teamRows: LoadedTeamRow[],
  toolRows: LoadedToolRow[],
  phaseRows: LoadedPhaseRow[],
): { wizard: WizardData; phases: EditablePhase[]; teamLabels: Record<string, string> } {
  const meta = (project.metadata && typeof project.metadata === "object" ? project.metadata : {}) as Record<string, unknown>;
  const methodologyDocs = Array.isArray(meta.methodologyDocs) ? meta.methodologyDocs as Array<{ phase?: string; docs?: Array<{ name: string; optional?: boolean }> }> : [];
  const leadId = String(project.managerId || "");
  const teamMemberIds = teamRows
    .filter((m) => m.role === "team_member" || (m.role !== "project_manager" && m.userId !== leadId))
    .map((m) => m.userId);

  const enabledTools = toolRows.filter((t) => t.isEnabled !== false);
  const selectedTools = Array.from(new Set([...ALWAYS_TOOLS, ...enabledTools.map((t) => t.toolType)]));
  const toolInstances: Record<string, string[]> = {};
  for (const tool of enabledTools) {
    const def = Object.values(TOOL_DEFINITIONS).flatMap((c) => c.tools).find((t) => t.id === tool.toolType);
    if (def?.multiInstance) {
      toolInstances[tool.toolType] = [...(toolInstances[tool.toolType] || []), tool.label || def.name];
    }
  }

  const phases: EditablePhase[] = phaseRows.length
    ? phaseRows.map((p, i) => {
        const docGroup = methodologyDocs.find((d) => d.phase === p.name);
        return {
          id: `phase-${p.id}-${i}`,
          name: p.name,
          duration: p.description || "",
          docs: (docGroup?.docs || []).map((d, j) => ({
            id: `doc-${p.id}-${j}`,
            name: d.name,
            optional: d.optional,
          })),
        };
      })
    : [];

  const teamLabels: Record<string, string> = {};
  for (const m of teamRows) {
    teamLabels[m.userId] = "";
  }

  return {
    wizard: {
      workType: String(project.workType || project.projectType || "project"),
      name: String(project.name || ""),
      description: String(project.description || ""),
      code: String(project.code || ""),
      strategicObjective: String(project.strategicObjective || ""),
      tags: Array.isArray(project.tags) ? (project.tags as string[]) : [],
      visibility: String(meta.visibility || "organisation"),
      leadId,
      lead: String(project.projectManager || meta.leadName || ""),
      pmoOwnerId: String(project.ownerId || ""),
      pmoOwner: String(project.deliveryOwner || ""),
      customer: String(project.customer || ""),
      sponsor: String(project.executiveSponsor || ""),
      contactPhone: String(meta.contactPhone || ""),
      contactEmail: String(meta.contactEmail || ""),
      teamMemberIds,
      priority: String(project.priority || "medium"),
      complexityLevel: String(project.complexityLevel || "medium"),
      startDate: formatDateInput(project.startDate as string | null | undefined),
      endDate: formatDateInput(project.endDate as string | null | undefined),
      status: String(project.status || "planning"),
      statusCadence: String(meta.statusCadence || "monthly"),
      reportAudience: String(meta.reportAudience || "steering_committee"),
      budget: formatMoneyInput(project.budget as string | number | null | undefined),
      currency: String(meta.currency || "GBP"),
      contractValue: formatMoneyInput((meta.contractValue as string | undefined) || (project.forecastBudget as string | number | null | undefined)),
      portfolioId: project.portfolioId != null ? String(project.portfolioId) : "",
      methodologyId: String(project.methodology || project.framework || "hybrid"),
      ragStatus: String(project.ragStatus || "green"),
      financialRag: String(project.financialRag || "green"),
      scheduleRag: String(project.scheduleRag || "green"),
      selectedTools,
      toolInstances,
    },
    phases,
    teamLabels,
  };
}

const TIPS: Record<number, string> = {
  1: "Choose the work type that best matches how this engagement will be governed. You can refine tools and details in later steps.",
  2: "Fill in the key attributes. Required fields are marked with a red asterisk. You can update everything later from the project workspace.",
  3: "Select the methodology that best fits this project. Jiganto pre-configures the phases and documentation — you can customise everything afterwards.",
  4: "Tools can be added or removed at any time from the project workspace. Suggested tools from your methodology are highlighted. Status Reporting and 360° Report are always included.",
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const CHIP_AVATAR_COLORS = ["#4338CA", "#0D9488", "#7C3AED", "#D97706", "#059669", "#DC2626"];

function chipColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CHIP_AVATAR_COLORS[h % CHIP_AVATAR_COLORS.length];
}

function chipInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="text-[10px] font-bold text-[#334155] dark:text-foreground/80 uppercase tracking-[0.04em]">
      {children}{required && <span className="text-red-600 ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] text-red-600 font-medium" role="alert">{message}</p>;
}

function isValidMoney(raw: string): boolean {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return true;
  return /^-?\d+(\.\d{1,2})?$/.test(cleaned);
}

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/** Accepts international formats: +44 7700 900123, (020) 7946 0958, 07700900123 */
function isValidPhone(raw: string): boolean {
  const v = raw.trim();
  if (!v) return true;
  const digits = v.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  return /^[+]?[\d\s()./-]{7,}$/.test(v);
}

function isValidRefCode(raw: string): boolean {
  if (!raw.trim()) return true;
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(raw.trim());
}

function looksLikeEmail(raw: string): boolean {
  return raw.includes("@");
}

function looksLikePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 && /^[+(\d]/.test(raw.trim());
}

function FormSection({
  icon,
  iconClass,
  title,
  subtitle,
  children,
}: {
  icon: string;
  iconClass: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] dark:border-border bg-white dark:bg-card overflow-hidden mb-3.5">
      <div className="flex items-center gap-3 px-[18px] py-[13px] border-b border-[#F1F5F9] dark:border-border bg-[#F1F5F9] dark:bg-muted/40">
        <div className={cn("h-[34px] w-[34px] rounded-lg flex items-center justify-center text-base shrink-0", iconClass)}>{icon}</div>
        <div>
          <div className="text-[13px] font-extrabold">{title}</div>
          <div className="text-[11px] text-[#64748B] dark:text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 px-[18px] py-[18px]">{children}</div>
    </div>
  );
}

function personDisplayName(user: OrgMemberCandidate | undefined, fallback = ""): string {
  if (!user) return fallback;
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  if (full) return full;
  if (user.email?.trim()) return user.email.trim();
  return fallback || "Unnamed user";
}

function UserPicker({
  users,
  value,
  onChange,
  placeholder,
  role,
  testId,
  allowClear,
  displayName,
}: {
  users: OrgMemberCandidate[];
  value: string;
  onChange: (userId: string, label: string) => void;
  placeholder: string;
  role?: string;
  testId?: string;
  allowClear?: boolean;
  /** Cached label so we never flash the raw user id */
  displayName?: string;
}) {
  const selected = users.find((u) => u.id === value);
  const label = personDisplayName(selected, displayName?.trim() || "");
  return (
    <div
      className={cn(
        "flex items-center gap-2 h-[38px] px-2 rounded-lg border bg-white dark:bg-card",
        value ? "border-primary/40" : "border-input",
      )}
    >
      {label && (
        <span
          className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ml-1"
          style={{ backgroundColor: chipColor(label) }}
        >
          {chipInitials(label)}
        </span>
      )}
      <Select
        value={value || undefined}
        onValueChange={(id) => {
          const u = users.find((x) => x.id === id);
          onChange(id, personDisplayName(u));
        }}
      >
        <SelectTrigger className="h-8 border-0 shadow-none focus:ring-0 px-1 flex-1 [&>span]:line-clamp-1" data-testid={testId}>
          {label ? (
            <span className="truncate text-left text-sm font-semibold font-sans">{label}</span>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => {
            const name = personDisplayName(u);
            return (
              <SelectItem key={u.id} value={u.id} textValue={name}>
                <div className="flex flex-col gap-0.5 py-0.5">
                  <span className="text-sm font-medium">{name}</span>
                  {u.email && u.email !== name && (
                    <span className="text-[11px] text-muted-foreground">{u.email}</span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {label && role && <span className="text-[10px] text-muted-foreground shrink-0 pr-1">{role}</span>}
      {allowClear && value && (
        <button type="button" className="text-[10px] font-bold text-primary pr-2" onClick={() => onChange("", "")}>
          Clear
        </button>
      )}
    </div>
  );
}

function ChipInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="rounded-lg border border-[#818CF8] bg-white dark:bg-card min-h-[38px] px-2.5 py-1.5 flex flex-wrap items-center gap-1.5">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-[#CCFBF1] dark:bg-teal-950/50 text-[#0F766E] dark:text-teal-200 px-2.5 py-0.5 text-[11px] font-bold">
          {v}
          <button type="button" className="text-[#0D9488] dark:text-teal-300 font-extrabold" onClick={() => onChange(values.filter((x) => x !== v))}>✕</button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        placeholder={placeholder}
        className="h-7 flex-1 min-w-[100px] border-0 shadow-none focus-visible:ring-0 px-1 text-[12px]"
      />
    </div>
  );
}

export function CreateWorkItemWizard({
  projectId,
  onCancel,
  onComplete,
}: {
  projectId?: number;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const isEditMode = projectId != null;
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [showExtended, setShowExtended] = useState(false);
  const [teamDraft, setTeamDraft] = useState("");
  const [phases, setPhases] = useState<EditablePhase[]>([]);
  const [phaseDbIds, setPhaseDbIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const initialTeamRef = useRef<LoadedTeamRow[]>([]);
  const initialToolRowsRef = useRef<LoadedToolRow[]>([]);
  const [wizardData, setWizardData] = useState<WizardData>({
    workType: "",
    name: "",
    description: "",
    code: "",
    strategicObjective: "",
    tags: [],
    visibility: "organisation",
    leadId: "",
    lead: "",
    pmoOwnerId: "",
    pmoOwner: "",
    customer: "",
    sponsor: "",
    contactPhone: "",
    contactEmail: "",
    teamMemberIds: [],
    priority: "medium",
    complexityLevel: "medium",
    startDate: "",
    endDate: "",
    status: "planning",
    statusCadence: "monthly",
    reportAudience: "steering_committee",
    budget: "",
    currency: "GBP",
    contractValue: "",
    portfolioId: "",
    methodologyId: "hybrid",
    ragStatus: "green",
    financialRag: "green",
    scheduleRag: "green",
    selectedTools: [...ALWAYS_TOOLS],
    toolInstances: {},
  });

  const { data: editProject, isLoading: editProjectLoading } = useQuery<LoadedProject>({
    queryKey: ["/api/pm/projects", projectId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pm/projects/${projectId}`);
      return res.json();
    },
    enabled: isEditMode,
  });

  const { data: editTeam = [], isLoading: editTeamLoading } = useQuery<LoadedTeamRow[]>({
    queryKey: ["/api/pm/projects", projectId, "team"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pm/projects/${projectId}/team`);
      return res.json();
    },
    enabled: isEditMode,
  });

  const { data: editTools = [], isLoading: editToolsLoading } = useQuery<LoadedToolRow[]>({
    queryKey: ["/api/pm/projects", projectId, "tools"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pm/projects/${projectId}/tools`);
      return res.json();
    },
    enabled: isEditMode,
  });

  const { data: editPhases = [], isLoading: editPhasesLoading } = useQuery<LoadedPhaseRow[]>({
    queryKey: ["/api/pm/projects", projectId, "phases"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pm/projects/${projectId}/phases`);
      return res.json();
    },
    enabled: isEditMode,
  });

  const editHydratedRef = useRef(false);
  const [editReady, setEditReady] = useState(!isEditMode);
  const [teamLabels, setTeamLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isEditMode || !editProject || editHydratedRef.current) return;
    if (editTeamLoading || editToolsLoading || editPhasesLoading) return;
    const mapped = projectToWizardData(editProject, editTeam, editTools, editPhases);
    setWizardData(mapped.wizard);
    setTeamLabels(mapped.teamLabels);
    initialTeamRef.current = editTeam;
    initialToolRowsRef.current = editTools;
    if (mapped.phases.length > 0) {
      setPhases(mapped.phases);
      setPhaseDbIds(editPhases.map((p) => p.id));
    }
    editHydratedRef.current = true;
    setEditReady(true);
    setStep(2);
  }, [isEditMode, editProject, editTeam, editTools, editPhases, editTeamLoading, editToolsLoading, editPhasesLoading]);

  const { data: portfolios = [] } = useQuery<PortfolioRow[]>({
    queryKey: ["/api/pm/portfolios"],
    staleTime: 30_000,
  });

  const { data: orgUsers = [] } = useQuery({
    queryKey: ["/api/chat/users", "pm-wizard"],
    queryFn: fetchOrgMemberCandidates,
    staleTime: 60_000,
  });

  const userLabel = (id: string) => {
    const u = orgUsers.find((x) => x.id === id);
    return personDisplayName(u, teamLabels[id] || "");
  };

  const selectedType = useMemo(
    () => [...WORK_TYPES.main, ...WORK_TYPES.extended].find((t) => t.id === wizardData.workType),
    [wizardData.workType],
  );

  const activePreset = useMemo(
    () => METHODOLOGY_PRESETS.find((p) => p.id === wizardData.methodologyId) || METHODOLOGY_PRESETS.find((p) => p.id === "hybrid")!,
    [wizardData.methodologyId],
  );

  const recommendedId = recommendedMethodologyId(wizardData.workType || "project");

  const suggestedSet = useMemo(() => new Set(activePreset.suggestedTools), [activePreset]);

  useEffect(() => {
    if (isEditMode) return;
    if (step === 3 && phases.length === 0 && !activePreset.custom) {
      setPhases(presetToEditablePhases(activePreset));
    }
  }, [step, activePreset, phases.length, isEditMode]);

  const updateField = <K extends keyof WizardData>(field: K, value: WizardData[K]) => {
    setWizardData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field as string]) return prev;
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  };

  const validateStep = (s: 1 | 2 | 3 | 4): Record<string, string> => {
    const next: Record<string, string> = {};
    if (s === 1) {
      if (!wizardData.workType) next.workType = "Select a work type to continue.";
    }
    if (s === 2) {
      if (!wizardData.name.trim()) next.name = "Project name is required.";
      else if (wizardData.name.trim().length < 2) next.name = "Name must be at least 2 characters.";
      else if (wizardData.name.trim().length > 200) next.name = "Name must be 200 characters or fewer.";

      if (!wizardData.description.trim()) next.description = "Description is required.";
      else if (wizardData.description.trim().length < 10) next.description = "Description must be at least 10 characters.";

      if (wizardData.code && !isValidRefCode(wizardData.code)) {
        next.code = "Use letters, numbers, and . _ / - only (max 64 characters).";
      }

      if (!wizardData.leadId) next.leadId = "Lead is required.";

      if (wizardData.contactEmail && !isValidEmail(wizardData.contactEmail)) {
        next.contactEmail = "Enter a valid email address.";
      }
      if (wizardData.contactPhone && !isValidPhone(wizardData.contactPhone)) {
        next.contactPhone = "Enter a valid phone number (7–15 digits).";
      }
      if (wizardData.sponsor) {
        if (looksLikeEmail(wizardData.sponsor) && !isValidEmail(wizardData.sponsor)) {
          next.sponsor = "Sponsor looks like an email — enter a valid address or a name.";
        } else if (looksLikePhone(wizardData.sponsor) && !isValidPhone(wizardData.sponsor)) {
          next.sponsor = "Sponsor looks like a phone number — enter a valid number or a name.";
        }
      }

      if (!wizardData.startDate) next.startDate = "Start date is required.";
      if (!wizardData.endDate) next.endDate = "End date is required.";
      if (wizardData.startDate && wizardData.endDate && wizardData.endDate < wizardData.startDate) {
        next.endDate = "End date must be on or after the start date.";
      }

      if (wizardData.budget && !isValidMoney(wizardData.budget)) {
        next.budget = "Enter a valid amount (e.g. 2400000 or 2,400,000.00).";
      }
      if (wizardData.contractValue && !isValidMoney(wizardData.contractValue)) {
        next.contractValue = "Enter a valid amount (e.g. 1500000 or 1,500,000).";
      }

      if (portfolios.length > 0 && !wizardData.portfolioId) {
        next.portfolioId = "Select a parent portfolio.";
      }
    }
    if (s === 3) {
      if (!wizardData.methodologyId) next.methodologyId = "Select a methodology.";
      if (phases.length === 0) next.phases = "Add at least one phase.";
    }
    if (s === 4) {
      if (wizardData.selectedTools.length === 0) next.selectedTools = "Select at least one execution tool.";
    }
    return next;
  };

/** Replace legacy Agile fragments with the unified `agile` tool id. */
function normalizeSelectedTools(ids: string[]): string[] {
  const hasLegacy = ids.some((id) => LEGACY_AGILE_TOOL_ID_SET.has(id));
  const next = ids.filter((id) => !LEGACY_AGILE_TOOL_ID_SET.has(id));
  if (hasLegacy && !next.includes("agile")) next.push("agile");
  return Array.from(new Set(next));
}

  const applyMethodology = (preset: MethodologyPreset) => {
    const editable = presetToEditablePhases(preset);
    setPhases(editable);
    const base = DEFAULT_TOOLS[wizardData.workType] || [...ALWAYS_TOOLS];
    const merged = normalizeSelectedTools(
      Array.from(new Set([...ALWAYS_TOOLS, ...base.filter((t) => preset.suggestedTools.includes(t) || ALWAYS_TOOLS.includes(t as any)), ...preset.suggestedTools])),
    );
    updateField("methodologyId", preset.id);
    updateField("selectedTools", merged);
  };

  const handleTypeSelect = (typeId: string) => {
    const rec = recommendedMethodologyId(typeId);
    const preset = METHODOLOGY_PRESETS.find((p) => p.id === rec) || METHODOLOGY_PRESETS.find((p) => p.id === "hybrid")!;
    const defaults = normalizeSelectedTools(
      Array.from(new Set([...(DEFAULT_TOOLS[typeId] || []), ...ALWAYS_TOOLS, ...preset.suggestedTools.slice(0, 8)])),
    );
    setWizardData((prev) => ({
      ...prev,
      workType: typeId,
      methodologyId: rec,
      selectedTools: defaults,
      toolInstances: {},
    }));
    setPhases(presetToEditablePhases(preset));
  };

  const toggleTool = (toolId: string) => {
    if ((ALWAYS_TOOLS as readonly string[]).includes(toolId)) return;
    setWizardData((prev) => {
      const selected = prev.selectedTools.includes(toolId);
      const nextTools = selected ? prev.selectedTools.filter((t) => t !== toolId) : [...prev.selectedTools, toolId];
      const nextInstances = { ...prev.toolInstances };
      if (selected) delete nextInstances[toolId];
      else if (findToolDefinition(toolId) && TOOL_DEFINITIONS.planning_scheduling.tools.find((t) => t.id === toolId)?.multiInstance) {
        nextInstances[toolId] = nextInstances[toolId]?.length ? nextInstances[toolId] : [`${findToolDefinition(toolId)?.name || toolId} 1`];
      }
      return { ...prev, selectedTools: nextTools, toolInstances: nextInstances };
    });
  };

  const seedInstances = (tools: string[], prev: Record<string, string[]>) => {
    const next = { ...prev };
    for (const toolId of tools) {
      const tool = Object.values(TOOL_DEFINITIONS).flatMap((c) => c.tools).find((t) => t.id === toolId);
      if (tool?.multiInstance && !next[toolId]?.length) {
        next[toolId] = [`${tool.name} 1`];
      }
    }
    return next;
  };

  const acceptSuggested = () => {
    const tools = normalizeSelectedTools(Array.from(new Set([...ALWAYS_TOOLS, ...activePreset.suggestedTools])));
    setWizardData((prev) => ({
      ...prev,
      selectedTools: tools,
      toolInstances: seedInstances(tools, prev.toolInstances),
    }));
  };

  const clearTools = () => updateField("selectedTools", [...ALWAYS_TOOLS]);

  const selectCategory = (catKey: string) => {
    const ids = TOOL_DEFINITIONS[catKey].tools.map((t) => t.id);
    updateField("selectedTools", Array.from(new Set([...wizardData.selectedTools, ...ids])));
  };

  const syncTeamMembers = async (projectId: number, data: WizardData, followUpErrors: string[]) => {
    const desiredTeamIds = new Set(data.teamMemberIds.filter(Boolean));
    const initialRows = initialTeamRef.current.filter((m) => m.role === "team_member");

    for (const row of initialRows) {
      if (!desiredTeamIds.has(row.userId)) {
        try {
          await apiRequest("DELETE", `/api/pm/team/${row.id}`);
        } catch (e: any) {
          followUpErrors.push(`Remove team member: ${e?.message || "failed"}`);
        }
      }
    }

    const existingTeamUserIds = new Set(initialRows.map((m) => m.userId));
    for (const memberUserId of desiredTeamIds) {
      if (existingTeamUserIds.has(memberUserId)) continue;
      try {
        await apiRequest("POST", "/api/pm/team", {
          projectId,
          userId: memberUserId,
          role: "team_member",
          isActive: true,
        });
      } catch (e: any) {
        followUpErrors.push(`Team member: ${e?.message || "failed"}`);
      }
    }

    const leadOnTeam = initialTeamRef.current.some((m) => m.userId === data.leadId);
    if (data.leadId && !leadOnTeam && !desiredTeamIds.has(data.leadId)) {
      try {
        await apiRequest("POST", "/api/pm/team", {
          projectId,
          userId: data.leadId,
          role: "project_manager",
          isActive: true,
        });
      } catch {
        // non-fatal
      }
    }
  };

  const syncPhases = async (projectId: number, data: WizardData, followUpErrors: string[]) => {
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const dbId = phaseDbIds[i];
      try {
        if (dbId) {
          await apiRequest("PUT", `/api/pm/phases/${dbId}`, {
            name: phase.name,
            phaseNumber: i + 1,
            order: i,
            methodology: data.methodologyId,
            description: phase.duration || null,
          });
        } else {
          await apiRequest("POST", "/api/pm/phases", {
            projectId,
            name: phase.name,
            phaseNumber: i + 1,
            order: i,
            methodology: data.methodologyId,
            description: phase.duration || null,
            status: "not_started",
          });
        }
      } catch (e: any) {
        followUpErrors.push(`Phase "${phase.name}": ${e?.message || "failed"}`);
      }
    }

    for (let i = phases.length; i < phaseDbIds.length; i++) {
      const dbId = phaseDbIds[i];
      if (!dbId) continue;
      try {
        await apiRequest("DELETE", `/api/pm/phases/${dbId}`);
      } catch (e: any) {
        followUpErrors.push(`Remove phase: ${e?.message || "failed"}`);
      }
    }
  };

  const syncTools = async (projectId: number, data: WizardData, followUpErrors: string[]) => {
    const existingByType = new Map<string, LoadedToolRow[]>();
    for (const row of initialToolRowsRef.current.filter((t) => t.isEnabled !== false)) {
      const list = existingByType.get(row.toolType) || [];
      list.push(row);
      existingByType.set(row.toolType, list);
    }

    const selectedSet = new Set(data.selectedTools);
    for (const [toolType, rows] of existingByType.entries()) {
      if (selectedSet.has(toolType) || (ALWAYS_TOOLS as readonly string[]).includes(toolType)) continue;
      for (const row of rows) {
        try {
          await apiRequest("DELETE", `/api/pm/project-tools/${row.id}`);
        } catch (e: any) {
          followUpErrors.push(`Remove tool: ${e?.message || "failed"}`);
        }
      }
    }

    const toolRows: Array<{ toolType: string; toolCategory: string; label: string; sortOrder: number }> = [];
    let order = initialToolRowsRef.current.length;
    for (const toolId of data.selectedTools) {
      if (existingByType.has(toolId)) continue;
      const def = findToolDefinition(toolId);
      const instances = data.toolInstances[toolId];
      if (instances?.length) {
        for (const label of instances) {
          toolRows.push({
            toolType: toolId,
            toolCategory: def?.category || "planning_scheduling",
            label: label.trim() || def?.name || toolId,
            sortOrder: order++,
          });
        }
      } else {
        toolRows.push({
          toolType: toolId,
          toolCategory: def?.category || "planning_scheduling",
          label: def?.name || toolId,
          sortOrder: order++,
        });
      }
    }

    if (toolRows.length > 0) {
      try {
        await apiRequest("POST", `/api/pm/projects/${projectId}/tools/bulk`, { tools: toolRows });
      } catch (e: any) {
        followUpErrors.push(`Tools: ${e?.message || "failed"}`);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: WizardData) => {
      const res = await apiRequest("POST", "/api/pm/projects", buildProjectPayload(data, phases, activePreset));
      const projectData = await res.json();
      const followUpErrors: string[] = [];

      const toolRows: Array<{ toolType: string; toolCategory: string; label: string; sortOrder: number }> = [];
      let order = 0;
      for (const toolId of data.selectedTools) {
        const def = findToolDefinition(toolId);
        const instances = data.toolInstances[toolId];
        if (instances?.length) {
          for (const label of instances) {
            toolRows.push({
              toolType: toolId,
              toolCategory: def?.category || "planning_scheduling",
              label: label.trim() || def?.name || toolId,
              sortOrder: order++,
            });
          }
        } else {
          toolRows.push({
            toolType: toolId,
            toolCategory: def?.category || "planning_scheduling",
            label: def?.name || toolId,
            sortOrder: order++,
          });
        }
      }
      if (toolRows.length > 0) {
        try {
          await apiRequest("POST", `/api/pm/projects/${projectData.id}/tools/bulk`, { tools: toolRows });
        } catch (e: any) {
          followUpErrors.push(`Tools: ${e?.message || "failed"}`);
        }
      }

      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        try {
          await apiRequest("POST", "/api/pm/phases", {
            projectId: projectData.id,
            name: phase.name,
            phaseNumber: i + 1,
            order: i,
            methodology: data.methodologyId,
            description: phase.duration || null,
            status: "not_started",
          });
        } catch (e: any) {
          followUpErrors.push(`Phase "${phase.name}": ${e?.message || "failed"}`);
        }
      }

      await syncTeamMembers(projectData.id, data, followUpErrors);

      if (followUpErrors.length > 0) {
        return { project: projectData, warnings: followUpErrors };
      }

      return { project: projectData, warnings: [] as string[] };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects"] });
      if (result.warnings.length > 0) {
        toast({
          title: "Work item created with warnings",
          description: result.warnings.join("; "),
          variant: "destructive",
        });
      } else {
        toast({ title: "Work item created successfully" });
      }
      onComplete();
    },
    onError: (err: Error) => {
      toast({ title: "Error creating work item", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: WizardData) => {
      if (!projectId) throw new Error("Missing project id");
      const existingMeta = (editProject?.metadata && typeof editProject.metadata === "object" ? editProject.metadata : {}) as Record<string, unknown>;
      const payload = buildProjectPayload(data, phases, activePreset);
      const res = await apiRequest("PUT", `/api/pm/projects/${projectId}`, {
        ...payload,
        metadata: { ...existingMeta, ...(payload.metadata as Record<string, unknown>) },
      });
      const projectData = await res.json();
      const followUpErrors: string[] = [];

      await syncPhases(projectId, data, followUpErrors);
      await syncTools(projectId, data, followUpErrors);
      await syncTeamMembers(projectId, data, followUpErrors);

      if (followUpErrors.length > 0) {
        return { project: projectData, warnings: followUpErrors };
      }
      return { project: projectData, warnings: [] as string[] };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "phases"] });
      if (result.warnings.length > 0) {
        toast({
          title: "Project updated with warnings",
          description: result.warnings.join("; "),
          variant: "destructive",
        });
      } else {
        toast({ title: "Project updated successfully" });
      }
      onComplete();
    },
    onError: (err: Error) => {
      toast({ title: "Error updating project", description: err.message, variant: "destructive" });
    },
  });

  const saveMutation = isEditMode ? updateMutation : createMutation;
  const editLoading = isEditMode && (!editReady || editProjectLoading);

  const handleNext = () => {
    const nextErrors = validateStep(step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast({
        title: "Please fix the highlighted fields",
        description: Object.values(nextErrors)[0],
        variant: "destructive",
      });
      return;
    }
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else if (step === 3) setStep(4);
    else saveMutation.mutate(wizardData);
  };

  const steps = [
    { num: 1 as const, label: "Work type", desc: selectedType && step > 1 ? `${selectedType.name} selected` : "Choose what you're creating" },
    { num: 2 as const, label: "Project details", desc: wizardData.name && step > 2 ? wizardData.name : "Identity, people, planning & finance" },
    { num: 3 as const, label: "Methodology", desc: step > 3 ? `${activePreset.name} · ${phases.length} phases` : "Choose framework & review phases" },
    { num: 4 as const, label: "Execution tools", desc: "Pick the tools you need" },
  ];

  const addTeamMember = (userId: string) => {
    if (!userId || wizardData.teamMemberIds.includes(userId)) return;
    const u = orgUsers.find((x) => x.id === userId);
    const label = personDisplayName(u);
    setTeamLabels((prev) => ({ ...prev, [userId]: label }));
    updateField("teamMemberIds", [...wizardData.teamMemberIds, userId]);
    setTeamDraft("");
  };

  if (editLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center font-sans" data-testid="wizard-edit-loading">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading project details…</p>
        </div>
      </div>
    );
  }

  const wizardTitle = isEditMode ? "Edit Work Item" : "New Work Item";
  const wizardSubtitle = isEditMode ? "Update your project in four steps" : "Configure your project in four steps.";

  return (
    <div className="flex h-full flex-1 w-full min-h-0 overflow-hidden font-sans" style={{ fontFamily: "var(--font-sans)" }} data-testid="wizard-view">
      {/* Left stepper */}
      <div className="w-[280px] h-full flex-shrink-0 border-r border-border bg-card p-7 flex flex-col min-h-0">
        <h3 className="text-base font-semibold text-foreground mb-1 font-sans">{wizardTitle}</h3>
        <p className="text-xs text-muted-foreground mb-7 leading-relaxed font-sans">{wizardSubtitle}</p>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {steps.map((s, i) => (
            <div key={s.num} className="flex gap-3.5 pb-6 relative" data-testid={`wizard-step-${s.num}`}>
              {i < steps.length - 1 && (
                <div className={cn(
                  "absolute left-[14px] top-8 bottom-0 w-0.5",
                  step > s.num ? "bg-emerald-500" : step === s.num ? "bg-gradient-to-b from-primary to-border" : "bg-border",
                )} />
              )}
              <div
                className={cn(
                  "h-[30px] w-[30px] rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 relative z-10 border-2 font-sans",
                  step === s.num && "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]",
                  step > s.num && "border-emerald-500 bg-emerald-500 text-white",
                  step < s.num && "border-border text-muted-foreground bg-background",
                )}
              >
                {step > s.num ? <Check className="h-3.5 w-3.5" /> : s.num}
              </div>
              <div>
                <div className={cn(
                  "text-xs font-semibold font-sans",
                  step === s.num ? "text-foreground" : step > s.num ? "text-emerald-800 dark:text-emerald-300" : "text-muted-foreground",
                )}>{s.label}</div>
                <div className={cn("text-[11px] mt-0.5 leading-snug font-sans", step > s.num ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex-shrink-0 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 font-sans">Tip</span>
          </div>
          <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed font-sans">{TIPS[step]}</p>
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 bg-muted/30">
        <div className="flex-shrink-0 h-[52px] border-b border-border bg-card px-6 flex items-center gap-3">
          <div>
            <div className="text-[15px] font-semibold font-sans">{wizardTitle}</div>
            <div className="text-[11px] text-muted-foreground font-sans">{isEditMode ? "Update key project information" : "Set up your project in four steps"}</div>
          </div>
          <div className="flex-1" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-10 py-8 pb-6 font-sans">
          {step === 1 && (
            <div data-testid="wizard-step-1-content">
              <h2 className="text-[22px] font-semibold tracking-tight mb-1 font-sans">Select work type</h2>
              <p className="text-sm text-muted-foreground mb-6">What kind of work item are you creating?</p>
              {errors.workType && <div className="mb-3"><FieldError message={errors.workType} /></div>}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {WORK_TYPES.main.map((t) => {
                  const Icon = t.icon;
                  const selected = wizardData.workType === t.id;
                  return (
                    <Card
                      key={t.id}
                      className={cn(
                        "cursor-pointer text-center p-5 transition-all",
                        selected && "ring-2 ring-primary bg-primary/5",
                        errors.workType && !selected && "border-red-300",
                      )}
                      onClick={() => { handleTypeSelect(t.id); setErrors((prev) => { const n = { ...prev }; delete n.workType; return n; }); }}
                      data-testid={`type-card-${t.id}`}
                    >
                      <Icon className={cn("h-7 w-7 mx-auto mb-2", selected ? "text-indigo-600" : "text-muted-foreground")} />
                      <div className={cn("text-sm font-bold", selected ? "text-indigo-700" : "text-foreground")}>{t.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{t.desc}</div>
                    </Card>
                  );
                })}
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 flex items-center gap-1 mb-4 bg-transparent border-0 cursor-pointer"
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
                        className={cn("cursor-pointer text-center p-4 transition-all", selected && "ring-2 ring-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20")}
                        onClick={() => handleTypeSelect(t.id)}
                        data-testid={`type-card-${t.id}`}
                      >
                        <Icon className={cn("h-6 w-6 mx-auto mb-1.5", selected ? "text-indigo-600" : "text-muted-foreground")} />
                        <div className={cn("text-xs font-bold", selected ? "text-indigo-700" : "text-foreground")}>{t.name}</div>
                        <div className="text-[9px] text-muted-foreground mt-0.5">{t.desc}</div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div data-testid="wizard-step-2-content" className="max-w-4xl">
              <h2 className="text-[22px] font-semibold tracking-tight mb-1 font-sans">Project details</h2>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                Fill in the essential information. Fields marked <span className="text-red-600">*</span> are required.
              </p>

              <div className="rounded-xl border border-border bg-card p-3.5 mb-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">📁</div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-foreground font-sans">{selectedType?.name || "Work item"}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-sans">{selectedType?.desc}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-8 text-xs font-medium font-sans"
                  onClick={() => setStep(1)}
                  data-testid="button-change-type"
                >
                  Change type
                </Button>
              </div>

              <FormSection icon="📋" iconClass="bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200" title="Identity" subtitle="What is this work item and what is it trying to achieve?">
                <div className="space-y-1 md:col-span-2">
                  <FieldLabel required>Project / Work item name</FieldLabel>
                  <Input
                    value={wizardData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="e.g. HSBC — Digital Transformation Programme"
                    className={cn(errors.name && "border-red-500 focus-visible:ring-red-500/30")}
                    data-testid="input-wizard-name"
                  />
                  <FieldError message={errors.name} />
                  {!errors.name && <p className="text-[10px] text-muted-foreground">Use a clear, descriptive name. Include the client name for client-facing work.</p>}
                </div>
                <div className="space-y-1 md:col-span-2">
                  <FieldLabel>Reference / contract number</FieldLabel>
                  <Input
                    value={wizardData.code}
                    onChange={(e) => updateField("code", e.target.value)}
                    placeholder="PRJ-2026-001"
                    className={cn(errors.code && "border-red-500 focus-visible:ring-red-500/30")}
                    data-testid="input-wizard-code"
                  />
                  <FieldError message={errors.code} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <FieldLabel required>Description</FieldLabel>
                  <Textarea
                    value={wizardData.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    className={cn("min-h-[72px] resize-y", errors.description && "border-red-500 focus-visible:ring-red-500/30")}
                    data-testid="input-wizard-description"
                  />
                  <FieldError message={errors.description} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <FieldLabel>Objective / scope statement</FieldLabel>
                  <Textarea value={wizardData.strategicObjective} onChange={(e) => updateField("strategicObjective", e.target.value)} className="min-h-[72px] resize-y" data-testid="input-wizard-objective" />
                  <p className="text-[10px] text-muted-foreground">Keep this concise — 1 to 3 sentences.</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <FieldLabel>Tags</FieldLabel>
                  <ChipInput values={wizardData.tags} onChange={(tags) => updateField("tags", tags)} placeholder="+ add tag…" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Visibility / access</FieldLabel>
                  <Select value={wizardData.visibility} onValueChange={(v) => updateField("visibility", v)}>
                    <SelectTrigger data-testid="select-wizard-visibility"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organisation">Organisation-wide</SelectItem>
                      <SelectItem value="team">Team only</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </FormSection>

              <FormSection icon="👥" iconClass="bg-violet-100 text-violet-900 dark:bg-violet-900/40" title="People & governance" subtitle="Who is leading, governing and delivering this work?">
                <div className="space-y-1">
                  <FieldLabel required>Lead (PM / Programme Manager)</FieldLabel>
                  <UserPicker
                    users={orgUsers}
                    value={wizardData.leadId}
                    displayName={wizardData.lead}
                    onChange={(id, label) => {
                      setWizardData((prev) => ({ ...prev, leadId: id, lead: label }));
                      setErrors((prev) => { const n = { ...prev }; delete n.leadId; return n; });
                    }}
                    placeholder="Select lead…"
                    role="Project Lead"
                    testId="input-wizard-lead"
                  />
                  <FieldError message={errors.leadId} />
                  {!errors.leadId && <p className="text-[10px] text-muted-foreground">Primary accountable owner for delivery.</p>}
                </div>
                <div className="space-y-1">
                  <FieldLabel>PMO owner</FieldLabel>
                  <UserPicker
                    users={orgUsers}
                    value={wizardData.pmoOwnerId}
                    displayName={wizardData.pmoOwner}
                    onChange={(id, label) => {
                      setWizardData((prev) => ({ ...prev, pmoOwnerId: id, pmoOwner: label }));
                    }}
                    placeholder="Select PMO owner…"
                    role="PMO"
                    testId="input-wizard-pmo"
                    allowClear
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Customer / client</FieldLabel>
                  <Input value={wizardData.customer} onChange={(e) => updateField("customer", e.target.value)} data-testid="input-wizard-customer" className="h-[38px]" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Customer contact / sponsor</FieldLabel>
                  <Input
                    value={wizardData.sponsor}
                    onChange={(e) => updateField("sponsor", e.target.value)}
                    placeholder="Name or email"
                    className={cn("h-[38px]", errors.sponsor && "border-red-500")}
                    data-testid="input-wizard-sponsor"
                  />
                  <FieldError message={errors.sponsor} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Contact email</FieldLabel>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={wizardData.contactEmail}
                    onChange={(e) => updateField("contactEmail", e.target.value)}
                    placeholder="name@company.com"
                    className={cn("h-[38px]", errors.contactEmail && "border-red-500")}
                    data-testid="input-wizard-contact-email"
                  />
                  <FieldError message={errors.contactEmail} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Contact phone</FieldLabel>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={wizardData.contactPhone}
                    onChange={(e) => updateField("contactPhone", e.target.value)}
                    placeholder="+44 7700 900123"
                    className={cn("h-[38px]", errors.contactPhone && "border-red-500")}
                    data-testid="input-wizard-contact-phone"
                  />
                  <FieldError message={errors.contactPhone} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <FieldLabel>Team members</FieldLabel>
                  <div className="rounded-lg border border-[#E2E8F0] dark:border-border p-2.5 space-y-2 bg-white dark:bg-card">
                    {wizardData.teamMemberIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pb-1.5 border-b border-[#F1F5F9] dark:border-border">
                        {wizardData.teamMemberIds.map((id) => {
                          const label = userLabel(id);
                          return (
                            <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] dark:bg-indigo-950/50 border border-[#818CF8] px-2.5 py-0.5 text-[11px] font-bold text-[#1E1B4B] dark:text-indigo-200">
                              <span
                                className="h-4 w-4 rounded-full text-[7px] font-bold text-white flex items-center justify-center"
                                style={{ backgroundColor: chipColor(label) }}
                              >
                                {chipInitials(label)}
                              </span>
                              {label}
                              <button type="button" className="text-[#4338CA] font-extrabold" onClick={() => updateField("teamMemberIds", wizardData.teamMemberIds.filter((x) => x !== id))}>✕</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <Select value={teamDraft || undefined} onValueChange={(id) => addTeamMember(id)}>
                      <SelectTrigger className="h-8 text-xs" data-testid="input-wizard-team">
                        <SelectValue placeholder="Add team member…" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgUsers
                          .filter((u) => !wizardData.teamMemberIds.includes(u.id) && u.id !== wizardData.leadId)
                          .map((u) => {
                            const name = personDisplayName(u);
                            return (
                              <SelectItem key={u.id} value={u.id} textValue={name}>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium">{name}</span>
                                  {u.email && u.email !== name && (
                                    <span className="text-[11px] text-muted-foreground">{u.email}</span>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-[#94A3B8] pt-1">Add core delivery team now — more can be added later from the workspace.</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Priority</FieldLabel>
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
                <div className="space-y-1">
                  <FieldLabel>Risk level</FieldLabel>
                  <Select value={wizardData.complexityLevel} onValueChange={(v) => updateField("complexityLevel", v)}>
                    <SelectTrigger data-testid="select-wizard-risk"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="very_high">Very High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </FormSection>

              <FormSection icon="📅" iconClass="bg-teal-100 text-teal-900 dark:bg-teal-900/40" title="Planning" subtitle="When does this run and how will it be reported?">
                <div className="space-y-1">
                  <FieldLabel required>Start date</FieldLabel>
                  <Input
                    type="date"
                    value={wizardData.startDate}
                    onChange={(e) => updateField("startDate", e.target.value)}
                    className={cn(errors.startDate && "border-red-500")}
                    data-testid="input-wizard-start-date"
                  />
                  <FieldError message={errors.startDate} />
                </div>
                <div className="space-y-1">
                  <FieldLabel required>End date</FieldLabel>
                  <Input
                    type="date"
                    value={wizardData.endDate}
                    min={wizardData.startDate || undefined}
                    onChange={(e) => updateField("endDate", e.target.value)}
                    className={cn(errors.endDate && "border-red-500")}
                    data-testid="input-wizard-end-date"
                  />
                  <FieldError message={errors.endDate} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Status reporting cadence</FieldLabel>
                  <Select value={wizardData.statusCadence} onValueChange={(v) => updateField("statusCadence", v)}>
                    <SelectTrigger data-testid="select-wizard-cadence"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Report audience</FieldLabel>
                  <Select value={wizardData.reportAudience} onValueChange={(v) => updateField("reportAudience", v)}>
                    <SelectTrigger data-testid="select-wizard-audience"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="steering_committee">Steering Committee</SelectItem>
                      <SelectItem value="sponsor">Sponsor</SelectItem>
                      <SelectItem value="pmo">PMO</SelectItem>
                      <SelectItem value="team">Project team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Status</FieldLabel>
                  <Select value={wizardData.status} onValueChange={(v) => updateField("status", v)}>
                    <SelectTrigger data-testid="select-wizard-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["draft", "planning", "active", "on_hold", "completed", "cancelled"].map((s) => (
                        <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </FormSection>

              <FormSection icon="🚦" iconClass="bg-green-100 text-green-900 dark:bg-green-900/40" title="Health & RAG" subtitle="Overall delivery health indicators.">
                <div className="space-y-1">
                  <FieldLabel>Scope RAG</FieldLabel>
                  <Select value={wizardData.ragStatus} onValueChange={(v) => updateField("ragStatus", v)}>
                    <SelectTrigger data-testid="select-wizard-rag-scope"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">Green — on track</SelectItem>
                      <SelectItem value="amber">Amber — monitor</SelectItem>
                      <SelectItem value="red">Red — at risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Budget RAG</FieldLabel>
                  <Select value={wizardData.financialRag} onValueChange={(v) => updateField("financialRag", v)}>
                    <SelectTrigger data-testid="select-wizard-rag-budget"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">Green — on track</SelectItem>
                      <SelectItem value="amber">Amber — monitor</SelectItem>
                      <SelectItem value="red">Red — at risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Schedule RAG</FieldLabel>
                  <Select value={wizardData.scheduleRag} onValueChange={(v) => updateField("scheduleRag", v)}>
                    <SelectTrigger data-testid="select-wizard-rag-schedule"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">Green — on track</SelectItem>
                      <SelectItem value="amber">Amber — monitor</SelectItem>
                      <SelectItem value="red">Red — at risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </FormSection>

              <FormSection icon="💰" iconClass="bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40" title="Finance" subtitle="Budget, portfolio linkage and financial governance.">
                <div className="space-y-1">
                  <FieldLabel>Budget</FieldLabel>
                  <div className="flex gap-1.5">
                    <Select value={wizardData.currency} onValueChange={(v) => updateField("currency", v)}>
                      <SelectTrigger className="w-[96px]" data-testid="select-wizard-currency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">GBP £</SelectItem>
                        <SelectItem value="USD">USD $</SelectItem>
                        <SelectItem value="EUR">EUR €</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className={cn("flex-1", errors.budget && "border-red-500")}
                      inputMode="decimal"
                      value={wizardData.budget}
                      onChange={(e) => updateField("budget", e.target.value)}
                      placeholder="2,400,000"
                      data-testid="input-wizard-budget"
                    />
                  </div>
                  <FieldError message={errors.budget} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Contract value (revenue)</FieldLabel>
                  <Input
                    inputMode="decimal"
                    value={wizardData.contractValue}
                    onChange={(e) => updateField("contractValue", e.target.value)}
                    placeholder="1,500,000"
                    className={cn(errors.contractValue && "border-red-500")}
                    data-testid="input-wizard-contract"
                  />
                  <FieldError message={errors.contractValue} />
                </div>
                <div className="space-y-1">
                  <FieldLabel required={portfolios.length > 0}>Parent programme / portfolio</FieldLabel>
                  <Select value={wizardData.portfolioId || "none"} onValueChange={(v) => updateField("portfolioId", v === "none" ? "" : v)}>
                    <SelectTrigger className={cn(errors.portfolioId && "border-red-500")} data-testid="select-wizard-portfolio">
                      <SelectValue placeholder="Select portfolio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {portfolios.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.portfolioId} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Portfolio owner</FieldLabel>
                  <Input
                    readOnly
                    value={wizardData.portfolioId ? (portfolios.find((p) => String(p.id) === wizardData.portfolioId)?.name ? "Auto-populated from portfolio" : "—") : "Select a portfolio first"}
                    className="bg-muted text-muted-foreground"
                    data-testid="input-wizard-portfolio-owner"
                  />
                </div>
              </FormSection>
            </div>
          )}

          {step === 3 && (() => {
            const portfolioName = portfolios.find((p) => String(p.id) === wizardData.portfolioId)?.name;
            const docGroups = (() => {
              if (phases.length <= 4) return phases.map((p) => ({ label: p.name, phases: [p] }));
              // Match HTML: show first n-3 phases alone, group trailing Realise · Deploy · Run style
              const head = phases.slice(0, Math.max(1, phases.length - 3));
              const tail = phases.slice(Math.max(1, phases.length - 3));
              return [
                ...head.map((p) => ({ label: p.name, phases: [p] })),
                { label: tail.map((p) => p.name).join(" · "), phases: tail },
              ];
            })();
            return (
            <div data-testid="wizard-step-3-content">
              <h2 className="text-[22px] font-semibold tracking-tight mb-1 font-sans">Methodology</h2>
              <p className="text-[13px] text-muted-foreground mb-5 leading-relaxed max-w-3xl font-sans">
                Choose the framework that best fits how this work will be run. Your selection pre-configures phases and documentation — you can refine everything afterwards.
              </p>
              {(errors.methodologyId || errors.phases) && (
                <div className="mb-3 space-y-1">
                  <FieldError message={errors.methodologyId} />
                  <FieldError message={errors.phases} />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-6">
                {METHODOLOGY_PRESETS.map((preset) => {
                  const selected = wizardData.methodologyId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        applyMethodology(preset);
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n.methodologyId;
                          delete n.phases;
                          return n;
                        });
                      }}
                      className={cn(
                        "relative text-center rounded-xl border-2 p-3.5 bg-white dark:bg-card transition-colors",
                        selected && "border-[#4338CA] bg-[#EEF2FF] dark:bg-indigo-950/30",
                        !selected && !preset.custom && "border-[#E2E8F0] dark:border-border hover:border-[#818CF8]",
                        preset.custom && !selected && "border-violet-400 bg-violet-50/50 dark:bg-violet-950/20",
                        preset.custom && selected && "border-violet-600",
                        errors.methodologyId && !selected && "border-red-300",
                      )}
                      data-testid={`method-tile-${preset.id}`}
                    >
                      {recommendedId === preset.id && (
                        <span className="absolute -top-px right-2 bg-[#4338CA] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-b-md">Recommended</span>
                      )}
                      {selected && (
                        <span className="absolute top-2 right-2 h-[18px] w-[18px] rounded-full bg-[#4338CA] text-white flex items-center justify-center text-[10px]"><Check className="h-3 w-3" /></span>
                      )}
                      <div className="text-xl mb-1.5">{preset.icon}</div>
                      <div className={cn("text-[11px] font-extrabold", selected ? "text-[#1E1B4B] dark:text-indigo-200" : "text-foreground")}>{preset.name}</div>
                      <div className="text-[9px] text-[#64748B] dark:text-muted-foreground mt-1 leading-snug">{preset.desc}</div>
                      {preset.custom && <div className="mt-1.5 inline-block text-[8px] font-extrabold text-violet-800 bg-violet-100 dark:bg-violet-900/40 rounded px-1.5 py-0.5">+ Build your own</div>}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-[#E2E8F0] dark:border-border bg-white dark:bg-card p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="text-sm font-extrabold">Phases for {activePreset.name}</div>
                    <div className="text-[11px] text-[#64748B] dark:text-muted-foreground mt-0.5">Pre-configured by Jiganto · Add, remove or rename phases</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-[11px] font-bold border-[#818CF8] text-[#1E1B4B] dark:text-indigo-200"
                    onClick={() => {
                      const el = document.querySelector("[data-testid='wizard-step-3-content']");
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    data-testid="button-change-methodology"
                  >
                    Change methodology
                  </Button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 mb-5 items-stretch">
                  {phases.map((phase, idx) => (
                    <div key={phase.id} className="flex items-center flex-1 min-w-[110px]">
                      <div className="relative flex-1 rounded-lg border-[1.5px] border-[#818CF8] bg-[#EEF2FF] dark:bg-indigo-950/40 p-2.5 text-center">
                        <div className="text-[9px] font-extrabold text-[#4338CA] uppercase tracking-wide mb-0.5">Phase {idx + 1}</div>
                        <Input
                          value={phase.name}
                          onChange={(e) => setPhases((prev) => prev.map((p) => p.id === phase.id ? { ...p, name: e.target.value } : p))}
                          className="h-7 text-[11px] font-extrabold text-center border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                        />
                        <Input
                          value={phase.duration}
                          onChange={(e) => setPhases((prev) => prev.map((p) => p.id === phase.id ? { ...p, duration: e.target.value } : p))}
                          className="h-6 text-[9px] text-center border-0 bg-transparent p-0 text-[#64748B] dark:text-muted-foreground shadow-none focus-visible:ring-0"
                        />
                        <div className="text-[9px] bg-[#4338CA] text-white rounded-full px-1.5 py-0.5 mt-1 inline-block font-bold">{phase.docs.length} docs</div>
                        <button
                          type="button"
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white dark:bg-card border text-[10px]"
                          onClick={() => setPhases((prev) => prev.filter((p) => p.id !== phase.id))}
                        >✕</button>
                      </div>
                      {idx < phases.length - 1 && (
                        <span className="text-[#94A3B8] text-[9px] px-0.5 shrink-0" aria-hidden>▶</span>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="min-w-[90px] rounded-lg border border-dashed border-[#E2E8F0] dark:border-border text-[11px] font-bold text-[#64748B] dark:text-muted-foreground px-2"
                    onClick={() => setPhases((prev) => [...prev, { id: uid(), name: "New phase", duration: "TBC", docs: [] }])}
                    data-testid="button-add-phase"
                  >
                    + Add phase
                  </button>
                </div>

                <div className="text-[13px] font-extrabold mb-1">Documentation template</div>
                <div className="text-[11px] text-[#64748B] dark:text-muted-foreground mb-3">Documents pre-configured by the methodology. Add or remove items. All documents appear in the project workspace once created.</div>
                <div className="space-y-2">
                  {docGroups.map((group) => (
                    <div key={group.label} className="rounded-lg bg-[#F1F5F9] dark:bg-muted/50 p-2.5 px-3.5">
                      <div className="text-[10px] font-extrabold uppercase tracking-wide text-[#64748B] dark:text-muted-foreground mb-1.5">{group.label}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.phases.flatMap((phase) =>
                          phase.docs.map((doc) => (
                            <span
                              key={`${phase.id}-${doc.id}`}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full bg-white dark:bg-background border border-[#E2E8F0] dark:border-border px-2.5 py-1 text-[11px] font-semibold",
                                doc.optional && "border-dashed text-[#64748B] dark:text-muted-foreground",
                              )}
                            >
                              📄 {doc.name}
                              <button
                                type="button"
                                className="text-[#94A3B8]"
                                onClick={() => setPhases((prev) => prev.map((p) => p.id === phase.id ? { ...p, docs: p.docs.filter((d) => d.id !== doc.id) } : p))}
                              >✕</button>
                            </span>
                          )),
                        )}
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-dashed border-[#4338CA] px-2.5 py-1 text-[11px] font-bold text-[#4338CA]"
                          onClick={() => {
                            const target = group.phases[0];
                            if (!target) return;
                            const name = window.prompt("Document name");
                            if (!name?.trim()) return;
                            setPhases((prev) => prev.map((p) => p.id === target.id
                              ? { ...p, docs: [...p.docs, { id: uid(), name: name.trim() }] }
                              : p));
                          }}
                        >
                          + Add doc
                        </button>
                      </div>
                    </div>
                  ))}
                  {phases.length === 0 && (
                    <p className="text-xs text-[#64748B] dark:text-muted-foreground">No phases yet — add a phase or pick a methodology above.</p>
                  )}
                </div>

                <div className="mt-4 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] dark:bg-indigo-950/30 dark:border-indigo-800 p-3.5">
                  <div className="text-xs font-bold text-[#1E1B4B] dark:text-indigo-200 mb-1">✦ AI suggestion</div>
                  <p className="text-xs text-[#1E1B4B]/90 dark:text-indigo-200/90 leading-relaxed">
                    Based on your work type ({selectedType?.name || "Project"})
                    {portfolioName ? <> and portfolio (<strong>{portfolioName}</strong>)</> : null}
                    , <strong>{METHODOLOGY_PRESETS.find((p) => p.id === recommendedId)?.name}</strong> is the recommended methodology
                    {phases.length > 0 ? <> for this type of engagement. The {phases.length} phases above are pre-configured</> : null}
                    — you can add, remove or rename phases to match your specific approach.
                  </p>
                </div>
              </div>
            </div>
            );
          })()}

          {step === 4 && (
            <div data-testid="wizard-step-4-content">
              <h2 className="text-[22px] font-semibold tracking-tight mb-1 font-sans">Choose execution tools</h2>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Select the tools you want enabled.{" "}
                <span className="text-indigo-900 dark:text-indigo-200 font-bold">Tools highlighted are suggested by {activePreset.name}.</span>
              </p>
              {errors.selectedTools && <div className="mb-3"><FieldError message={errors.selectedTools} /></div>}

              <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#818CF8] bg-[#EEF2FF] dark:bg-indigo-950/30 p-3 px-4 mb-5">
                <span className="text-lg">🔧</span>
                <div className="text-[12px] text-[#1E1B4B] dark:text-indigo-200 flex-1">
                  Methodology: <strong>{activePreset.name}</strong> · <strong>{activePreset.suggestedTools.length}</strong> tools pre-suggested ·{" "}
                  <strong>{wizardData.selectedTools.length}</strong> currently selected
                </div>
                <Button size="sm" className="h-[30px] text-[11px] font-bold bg-[#4338CA] hover:bg-[#3730A3] text-white" onClick={acceptSuggested} data-testid="button-accept-suggested">✓ Accept all suggested</Button>
                <Button size="sm" variant="outline" className="h-[30px] text-[11px] font-bold border-[#818CF8] text-[#1E1B4B] dark:text-indigo-200" onClick={clearTools} data-testid="button-clear-tools">Clear all</Button>
              </div>

              {Object.entries(TOOL_DEFINITIONS).map(([catKey, cat]) => {
                const CatIcon = cat.icon;
                return (
                  <div key={catKey} className="mb-5" data-testid={`tool-category-${catKey}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{cat.title}</span>
                      {cat.tag && (
                        <Badge variant="secondary" className="text-[9px] font-bold">{cat.tag}</Badge>
                      )}
                      <div className="flex-1 h-px bg-border" />
                      <button type="button" className="text-[11px] font-bold text-indigo-600" onClick={() => selectCategory(catKey)}>Select all</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {cat.tools.map((tool) => {
                        const always = (ALWAYS_TOOLS as readonly string[]).includes(tool.id);
                        const selected = always || wizardData.selectedTools.includes(tool.id);
                        const suggested = !selected && suggestedSet.has(tool.id);
                        const ToolIcon = tool.icon;
                        const instances = wizardData.toolInstances[tool.id] || [];
                        return (
                          <div
                            key={tool.id}
                            className={cn(
                              "relative rounded-lg border-[1.5px] p-[11px] px-3 transition-colors cursor-pointer bg-white dark:bg-card",
                              always && "border-[#065F46] bg-[#D1FAE5] dark:bg-emerald-950/30",
                              !always && selected && "border-[#4338CA] bg-[#EEF2FF] dark:bg-indigo-950/30",
                              suggested && "border-[#818CF8] bg-[rgba(129,140,248,0.05)]",
                              !always && !selected && !suggested && "border-[#E2E8F0] dark:border-border hover:bg-[#F8FAFC] dark:hover:bg-muted",
                              tool.crossModule && "border-dashed",
                            )}
                            onClick={() => toggleTool(tool.id)}
                            data-testid={`tool-card-${tool.id}`}
                          >
                            {always && <span className="absolute -top-px left-2 bg-[#059669] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-b">Always included</span>}
                            {suggested && <span className="absolute -top-px left-2 bg-[#818CF8] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-b">Suggested</span>}
                            {selected && !always && (
                              <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-[#4338CA] text-white flex items-center justify-center"><Check className="h-2.5 w-2.5" /></span>
                            )}
                            <div className="flex items-start gap-2.5">
                              <ToolIcon className={cn("h-[18px] w-[18px] mt-0.5 shrink-0", selected ? "text-[#1E1B4B] dark:text-indigo-200" : "text-[#64748B] dark:text-muted-foreground")} />
                              <div className="min-w-0 flex-1">
                                <div className={cn("text-[12px] font-bold leading-snug", always ? "text-[#065F46] dark:text-emerald-200" : selected ? "text-[#1E1B4B] dark:text-indigo-200" : "text-foreground")}>
                                  {tool.name}{always && <span className="text-[9px] text-[#065F46] dark:text-emerald-300 ml-1">✓ Included</span>}
                                </div>
                                <div className="text-[10px] text-[#64748B] dark:text-muted-foreground mt-0.5 leading-snug">{tool.hint}</div>
                                {tool.crossModule && <div className="text-[9px] font-bold text-[#94A3B8] mt-1">🔗 Data in: {tool.crossModule}</div>}
                              </div>
                            </div>
                            {selected && tool.multiInstance && (
                              <div
                                className="mt-2 pt-2 border-t border-border/60 space-y-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="text-[9px] font-bold text-indigo-900 dark:text-indigo-200">Instances — name each board:</div>
                                {instances.map((label, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5">
                                    <Input
                                      value={label}
                                      className="h-7 text-[10px]"
                                      onChange={(e) => {
                                        const next = [...instances];
                                        next[idx] = e.target.value;
                                        updateField("toolInstances", { ...wizardData.toolInstances, [tool.id]: next });
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="h-4 w-4 rounded-full bg-muted text-[9px] flex items-center justify-center"
                                      onClick={() => {
                                        const next = instances.filter((_, i) => i !== idx);
                                        updateField("toolInstances", { ...wizardData.toolInstances, [tool.id]: next.length ? next : [`${tool.name} 1`] });
                                      }}
                                    >✕</button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  className="text-[10px] font-bold text-indigo-600"
                                  onClick={() => updateField("toolInstances", {
                                    ...wizardData.toolInstances,
                                    [tool.id]: [...(instances.length ? instances : [`${tool.name} 1`]), `${tool.name} ${instances.length + 2}`],
                                  })}
                                >
                                  + Add another instance
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-border bg-card px-10 py-3.5 flex items-center justify-between gap-3 font-sans">
          <Button variant="ghost" className="text-muted-foreground font-medium font-sans" onClick={onCancel} data-testid="button-wizard-cancel">Cancel</Button>
          <div className="text-xs text-muted-foreground font-medium font-sans">Step {step} of 4</div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                className="font-medium font-sans"
                onClick={() => {
                  setErrors({});
                  setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
                }}
                data-testid="button-wizard-back"
              >
                ← Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={saveMutation.isPending}
              className="font-medium font-sans px-7"
              data-testid="button-wizard-next"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {step === 4 ? (isEditMode ? "Save changes →" : "Review & Create →") : "Next →"}
              {step < 4 && !saveMutation.isPending && <ArrowRight className="h-3.5 w-3.5 ml-1 hidden" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
