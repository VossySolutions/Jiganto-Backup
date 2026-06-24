import { MetricCard } from "@/components/ui/metric-card";
import { cn } from "@/lib/utils";
import { FlaskConical, Bug, Shield, TrendingUp } from "lucide-react";
import { TmScreen } from "@/types/testmgmt";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";
import type { TmDashboardData } from "@/types/testmgmt";

interface Props { onNavigate: (screen: TmScreen) => void; }

function ragColor(passRatePct: number, openDefects: number, criticalDefects: number) {
  if (criticalDefects > 0) return { ring: "border-red-400 dark:border-red-500", bg: "bg-red-50 dark:bg-red-900/10", rag: "bg-red-500", label: "Critical" };
  if (passRatePct === 0 && openDefects === 0) return { ring: "border-slate-200 dark:border-slate-700", bg: "", rag: "bg-slate-400", label: "No Data" };
  if (passRatePct >= 90 && criticalDefects === 0) return { ring: "border-green-400 dark:border-green-500", bg: "bg-green-50 dark:bg-green-900/10", rag: "bg-green-500", label: "Healthy" };
  if (passRatePct >= 70 || openDefects > 0) return { ring: "border-amber-400 dark:border-amber-500", bg: "bg-amber-50 dark:bg-amber-900/10", rag: "bg-amber-500", label: "At Risk" };
  return { ring: "border-red-400 dark:border-red-500", bg: "bg-red-50 dark:bg-red-900/10", rag: "bg-red-500", label: "Critical" };
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
  );
}

export function DigitalTwinScreen({ onNavigate }: Props) {
  const dashboardQuery = useTmFetch<TmDashboardData>(["/api/tm/dashboard"], "/api/tm/dashboard");
  const dashboard = dashboardQuery.data;
  const modules = dashboard?.bySuite ?? [];
  const kpis = dashboard?.kpis;
  const isLoading = dashboardQuery.isLoading;
  const firstError = dashboardQuery.error ?? null;

  const overallPassRate = kpis?.passRatePct ?? 0;
  const totalCases = kpis?.totalCases ?? 0;
  const openDefTotal = kpis?.openDefects ?? 0;
  const suitesWithCases = modules.filter((m) => m.total > 0).length;
  const suiteCount = modules.length;

  return (
    <TmScreenShell
      loading={isLoading}
      error={firstError}
      onRetry={() => { void dashboardQuery.refetch(); }}
      label="Loading digital twin..."
    >
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Digital Twin</h2>
          <p className="text-sm text-muted-foreground">Live test coverage health map across all application modules.</p>
        </div>

      {/* Overall KPIs — from /api/tm/dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Overall Pass Rate" value={`${overallPassRate}%`} subtitle="Passed ÷ executed" helpText="Percentage of test executions that passed across all suites." borderColor="#22c55e" valueClassName={overallPassRate >= 80 ? "text-green-600" : overallPassRate >= 60 ? "text-amber-600" : "text-red-600"} testId="dt-pass-rate" />
        <MetricCard title="Total Test Cases" value={totalCases} subtitle="In project" helpText="All test cases defined in the active test project." borderColor="#6366f1" testId="dt-total-cases" />
        <MetricCard title="Open Defects" value={openDefTotal} subtitle="Unresolved" helpText="Defects linked to test failures that are still open." borderColor="#f59e0b" valueClassName={openDefTotal === 0 ? "text-green-600" : "text-amber-600"} testId="dt-open-defects" />
        <MetricCard title="Modules Covered" value={`${suitesWithCases}/${suiteCount}`} subtitle="Suites with ≥1 case" helpText="Test suites that have at least one test case defined." borderColor="#3b82f6" testId="dt-modules-covered" />
      </div>

      {/* Module Grid */}
      {modules.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          <FlaskConical className="h-8 w-8 mx-auto mb-3" />
          <div className="text-sm">Load demo data first to see the module health map.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((suite) => {
            const rag = ragColor(suite.passRatePct, suite.openDefects, suite.criticalDefects);
            return (
            <button
              key={suite.suiteId}
              onClick={() => onNavigate("navigator")}
              className={cn("bg-card border-2 rounded-2xl p-5 space-y-4 transition-all hover:shadow-lg cursor-pointer text-left w-full", rag.ring, rag.bg)}
              data-testid={`module-card-${suite.suiteId}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{suite.suiteName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{suite.total} test case{suite.total !== 1 ? "s" : ""}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={cn("w-2.5 h-2.5 rounded-full", rag.rag)} />
                  <span className="text-[10px] font-semibold font-mono">{rag.label}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Pass Rate</span>
                  <span className="font-mono font-semibold">{suite.pass + suite.fail + suite.blocked > 0 ? `${suite.passRatePct}%` : "—"}</span>
                </div>
                <div className="flex gap-1 items-center">
                  <MiniBar pct={suite.total > 0 ? suite.pass / suite.total : 0} color="bg-green-500" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1 text-center">
                {[
                  { label: "Pass", val: suite.pass, cls: "text-green-600" },
                  { label: "Fail", val: suite.fail, cls: "text-red-600" },
                  { label: "Blocked", val: suite.blocked, cls: "text-orange-600" },
                  { label: "Not Run", val: suite.notRun, cls: "text-muted-foreground" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className={cn("text-lg font-bold font-mono leading-none", s.cls)}>{s.val}</div>
                    <div className="text-[9px] text-muted-foreground uppercase mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {(suite.openDefects > 0 || suite.criticalDefects > 0) && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  <Bug className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-700 dark:text-red-400">
                    {suite.openDefects} open defect{suite.openDefects !== 1 ? "s" : ""}
                    {suite.criticalDefects > 0 && ` (${suite.criticalDefects} critical)`}
                  </span>
                </div>
              )}
            </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        {[
          { color: "bg-green-500", label: "Healthy (≥90% pass, no critical defects)" },
          { color: "bg-amber-500", label: "At Risk (70–89% pass or open defects)" },
          { color: "bg-red-500", label: "Critical (<70% pass or critical defects)" },
          { color: "bg-slate-400", label: "No Data" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", color)} />
            <span>{label}</span>
          </div>
        ))}
      </div>
      </div>
    </TmScreenShell>
  );
}
