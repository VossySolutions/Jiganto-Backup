import type { TmMethodology } from "@/types/testmgmt";

export const TM_LABELS: Record<TmMethodology, { area: string; process: string; scenario: string }> = {
  waterfall: { area: "Business Area", process: "Business Process", scenario: "Scenario" },
  agile: { area: "Epic", process: "Feature", scenario: "User Story" },
  hybrid: { area: "Business Area / Epic", process: "Process / Feature", scenario: "Scenario / Story" },
};

export function getTmLabels(methodology?: string | null) {
  const m = (methodology ?? "waterfall") as TmMethodology;
  return TM_LABELS[m] ?? TM_LABELS.waterfall;
}

export function normalizeStatus(status?: string | null): string {
  if (!status || status === "not_run") return "not_started";
  if (status === "skipped") return "deferred";
  return status;
}

export const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  pass: "Passed",
  fail: "Failed",
  blocked: "Blocked",
  deferred: "Deferred",
  not_applicable: "N/A",
  ready_for_retest: "Ready for Retest",
  planning: "Planning",
  completed: "Completed",
  signed_off: "Signed Off",
  abandoned: "Abandoned",
};

export const STATUS_DOT: Record<string, string> = {
  not_started: "bg-muted-foreground",
  in_progress: "bg-blue-500",
  pass: "bg-green-500",
  fail: "bg-red-500",
  blocked: "bg-amber-500",
  deferred: "bg-muted-foreground opacity-60",
  not_applicable: "bg-white border-2 border-border",
  ready_for_retest: "bg-sky-500",
};

export const TEST_PHASES = [
  { value: "unit", label: "Unit Testing" },
  { value: "component", label: "Component Testing" },
  { value: "integration", label: "Integration Testing (SIT)" },
  { value: "system", label: "System Testing" },
  { value: "uat", label: "User Acceptance Testing (UAT)" },
  { value: "regression", label: "Regression" },
  { value: "performance", label: "Performance" },
  { value: "smoke", label: "Smoke" },
  { value: "other", label: "Other" },
];

export const TEST_TYPES = ["functional", "regression", "performance", "security", "smoke", "exploratory"] as const;

export const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export const HD_BOARD_COLUMNS = [
  { id: "open", label: "Open", color: "border-slate-400/50 bg-slate-500/10" },
  { id: "assigned", label: "Assigned", color: "border-blue-400/50 bg-blue-500/10" },
  { id: "in_progress", label: "In Progress", color: "border-indigo-400/50 bg-indigo-500/10" },
  { id: "fix_ready", label: "Fix Ready", color: "border-amber-400/50 bg-amber-500/10" },
  { id: "retesting", label: "Retesting", color: "border-violet-400/50 bg-violet-500/10" },
  { id: "fixed", label: "Fixed", color: "border-green-400/50 bg-green-500/10" },
  { id: "wont_fix", label: "Won't Fix", color: "border-orange-400/50 bg-orange-500/10" },
  { id: "closed", label: "Closed", color: "border-muted bg-muted/30" },
] as const;

/** Map HD ticket status → kanban column id. */
export function mapTicketToColumn(status: string): string {
  if (status === "in_progress") return "in_progress";
  if (status === "retesting") return "retesting";
  if (HD_BOARD_COLUMNS.some((c) => c.id === status)) return status;
  return "open";
}

/** Client-side: check if dropping on column is reachable (approximate). */
export function canMoveToColumn(fromStatus: string, columnId: string): boolean {
  const transitions: Record<string, string[]> = {
    open: ["assigned", "in_progress"],
    assigned: ["in_progress"],
    in_progress: ["fix_ready", "wont_fix"],
    fix_ready: ["retesting"],
    retesting: ["fixed", "open"],
    fixed: ["closed"],
    wont_fix: ["closed"],
    closed: [],
  };
  const target = columnId;
  if (fromStatus === target || mapTicketToColumn(fromStatus) === columnId) return false;
  const queue = [fromStatus];
  const visited = new Set<string>([fromStatus]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of transitions[cur] ?? []) {
      if (next === target) return true;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

export const CYCLE_STATUS_COLORS: Record<string, string> = {
  planning: "bg-violet-500",
  in_progress: "bg-blue-500",
  completed: "bg-teal-500",
  signed_off: "bg-green-500",
  abandoned: "bg-muted-foreground",
  planned: "bg-violet-500",
  aborted: "bg-muted-foreground",
};
