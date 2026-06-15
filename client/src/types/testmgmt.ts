export type TmScreen =
  | "command-centre" | "digital-twin" | "navigator" | "test-library" | "test-cycles"
  | "scenarios" | "test-suites" | "test-cases" | "traceability" | "import" | "execution"
  | "defect-triage" | "defect-board" | "audit" | "access" | "phase-comparison";

export type TmMethodology = "waterfall" | "agile" | "hybrid";

export type TmExecutionStatus =
  | "not_started" | "in_progress" | "pass" | "fail" | "blocked"
  | "deferred" | "not_applicable" | "ready_for_retest";

export type TmCycleStatus = "planning" | "in_progress" | "completed" | "signed_off" | "abandoned";

export interface TmCycleMetrics {
  total: number;
  executed: number;
  passed: number;
  failed: number;
  blocked: number;
  deferred: number;
  notApplicable: number;
  completionPct: number;
  passRatePct: number;
}

export interface TmDashboardData {
  kpis: {
    totalCases: number;
    executed: number;
    executedPct: number;
    passed: number;
    passedPct: number;
    failed: number;
    failedPct: number;
    blocked: number;
    openDefects: number;
    criticalDefects: number;
    completionPct: number;
    passRatePct: number;
    releaseReadiness: number;
  };
  burndown: Array<{ date: string; target: number; actual: number; remaining?: number }>;
  byArea: Array<{ name: string; areaName?: string; passRatePct?: number; completionPct?: number; passed: number; failed: number; blocked: number; notStarted: number }>;
  defectTrend: Array<{ date: string; open: number; closed: number; count?: number }>;
  passRateTrend: Array<{ date?: string; label?: string; cycleName?: string; rate?: number; passRatePct?: number }>;
  activeCycle: { id: number; name: string; status: string } | null;
  charts?: {
    burndown: Array<{ date: string; target?: number; actual?: number; remaining?: number }>;
    byArea: Array<{ areaName: string; passRatePct: number; completionPct: number }>;
    defectTrend: Array<{ date: string; open?: number; closed?: number; count?: number }>;
    passRateTrend: Array<{ cycleName: string; passRatePct: number; label?: string; rate?: number }>;
  };
}

export interface TmPhaseComparisonData {
  projectId: number;
  generatedAt: string;
  phases: Array<{
    phase: string;
    phaseLabel: string;
    cycleCount: number;
    defectCount: number;
    openDefects: number;
    totals: {
      total: number;
      executed: number;
      passed: number;
      failed: number;
      blocked: number;
      completionPct: number;
      passRatePct: number;
    };
    cycles: Array<{
      id: number;
      name: string;
      status?: string | null;
      buildVersion?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      metrics: TmCycleMetrics;
      defectCount: number;
      openDefects: number;
    }>;
  }>;
}

export interface TmHdDefect {
  id: number;
  ref: string;
  title: string;
  severity: string;
  status: string;
  assigneeId?: string | null;
  linkedTestCaseId?: number | null;
  linkedTestResultId?: number | null;
  daysOpen: number;
  businessArea?: string;
}

export interface TmHierarchyNode {
  area: { id: number; name: string; signOffStatus?: string | null; health?: string };
  processes: Array<{
    process: { id: number; name: string; priority?: string | null; signOffStatus?: string | null; health?: string };
    scenarios: Array<{
      scenario: { id: number; scenarioId: string; title: string; signOffStatus?: string | null; health?: string };
      cases: Array<{ id: number; title: string; priority?: string | null; lastStatus?: string; openDefects?: number }>;
    }>;
  }>;
}
