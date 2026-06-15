import type {
  TmBusinessArea,
  TmBusinessProcess,
  TmScenario,
  TmTestCase,
  TmTestResult,
  TmTestRun,
  TmProject,
} from "@shared/models/testmgmt";

export type TmMethodology = "waterfall" | "agile" | "hybrid";

export const TM_LABELS: Record<TmMethodology, { area: string; process: string; scenario: string }> = {
  waterfall: { area: "Business Area", process: "Business Process", scenario: "Scenario" },
  agile: { area: "Epic", process: "Feature", scenario: "User Story" },
  hybrid: { area: "Business Area / Epic", process: "Process / Feature", scenario: "Scenario / Story" },
};

export function getTmLabels(methodology?: string | null) {
  const m = (methodology ?? "waterfall") as TmMethodology;
  return TM_LABELS[m] ?? TM_LABELS.waterfall;
}

/** Map legacy execution statuses to spec statuses */
export function normalizeExecutionStatus(status?: string | null): string {
  if (!status || status === "not_run") return "not_started";
  if (status === "skipped") return "deferred";
  return status;
}

/** Statuses that count toward executed total */
export function isExecutedStatus(status?: string | null): boolean {
  const s = normalizeExecutionStatus(status);
  return !["not_started", "in_progress"].includes(s);
}

/** Statuses excluded from pass rate denominator */
export function isPassRateEligible(status?: string | null): boolean {
  const s = normalizeExecutionStatus(status);
  return s !== "not_applicable" && s !== "deferred";
}

export function computeCycleMetrics(results: TmTestResult[]) {
  const total = results.length;
  const normalized = results.map(r => ({ ...r, status: normalizeExecutionStatus(r.status) }));
  const executed = normalized.filter(r => isExecutedStatus(r.status)).length;
  const passed = normalized.filter(r => r.status === "pass").length;
  const failed = normalized.filter(r => r.status === "fail").length;
  const blocked = normalized.filter(r => r.status === "blocked").length;
  const deferred = normalized.filter(r => r.status === "deferred").length;
  const notApplicable = normalized.filter(r => r.status === "not_applicable").length;
  const eligible = normalized.filter(r => isPassRateEligible(r.status) && isExecutedStatus(r.status));
  const passEligible = eligible.filter(r => r.status === "pass").length;
  const completionPct = total > 0 ? Math.round((executed / total) * 100) : 0;
  const passRatePct = eligible.length > 0 ? Math.round((passEligible / eligible.length) * 100) : 0;
  return { total, executed, passed, failed, blocked, deferred, notApplicable, completionPct, passRatePct };
}

export function computeReleaseReadiness(passRatePct: number, criticalDefects: number): number {
  const penalty = Math.min(criticalDefects * 0.15, 0.6);
  return Math.max(0, Math.round(passRatePct * (1 - penalty)));
}

export type HierarchyNode = {
  area: TmBusinessArea;
  processes: Array<{
    process: TmBusinessProcess;
    scenarios: Array<{
      scenario: TmScenario;
      cases: TmTestCase[];
    }>;
  }>;
};

export function buildHierarchyTree(
  areas: TmBusinessArea[],
  processes: TmBusinessProcess[],
  scenarios: TmScenario[],
  cases: TmTestCase[],
): HierarchyNode[] {
  return areas.map(area => ({
    area,
    processes: processes
      .filter(p => p.businessAreaId === area.id)
      .map(process => ({
        process,
        scenarios: scenarios
          .filter(s => s.businessProcessId === process.id)
          .map(scenario => ({
            scenario,
            cases: cases.filter(c => c.scenarioId === scenario.id),
          })),
      })),
  }));
}

export function ragFromPassRate(rate: number, hasOpenDefects: boolean, hasCritical: boolean): "red" | "amber" | "green" | "grey" {
  if (hasCritical) return "red";
  if (rate === 0 && !hasOpenDefects) return "grey";
  if (rate >= 90 && !hasCritical) return "green";
  if (rate >= 70 || hasOpenDefects) return "amber";
  return "red";
}

export const EXECUTION_STATUS_DOT: Record<string, string> = {
  not_started: "bg-muted-foreground",
  in_progress: "bg-blue-500",
  pass: "bg-green-500",
  fail: "bg-red-500",
  blocked: "bg-amber-500",
  deferred: "bg-muted-foreground line-through",
  not_applicable: "bg-white border border-border",
  ready_for_retest: "bg-sky-500",
};

export const CYCLE_STATUS_COLORS: Record<string, string> = {
  planning: "bg-violet-500",
  in_progress: "bg-blue-500",
  completed: "bg-teal-500",
  signed_off: "bg-green-500",
  abandoned: "bg-muted-foreground",
};

export const DEFECT_BOARD_COLUMNS = [
  { id: "open", label: "Open" },
  { id: "assigned", label: "In Progress" },
  { id: "fix_ready", label: "Fix Ready (Retesting)" },
  { id: "fixed", label: "Fixed" },
  { id: "wont_fix", label: "Won't Fix" },
  { id: "closed", label: "Closed" },
] as const;

export function mapHdStatusToBoardColumn(status: string): string {
  if (status === "in_progress" || status === "retesting") return "assigned";
  if (status === "fix_ready") return "fix_ready";
  return status;
}

export function enrichCycle(cycle: TmTestRun, results: TmTestResult[]) {
  return { ...cycle, metrics: computeCycleMetrics(results) };
}

export function enrichProject(project: TmProject, cycles: TmTestRun[]) {
  const active = project.activeCycleId
    ? cycles.find(c => c.id === project.activeCycleId)
    : cycles.find(c => c.status === "in_progress") ?? cycles[0];
  return { ...project, activeCycle: active ?? null };
}
