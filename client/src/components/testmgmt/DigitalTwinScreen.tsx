import { TmTestSuite, TmTestCase, TmTestResult, TmDefect } from "@shared/schema";
import { cn } from "@/lib/utils";
import { FlaskConical, Bug, Shield, TrendingUp } from "lucide-react";
import { TmScreen } from "@/types/testmgmt";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";

interface Props { onNavigate: (screen: TmScreen) => void; }

function ragColor(rate: number, hasOpenDefects: boolean, hasCritical: boolean) {
  if (hasCritical) return { ring: "border-red-400 dark:border-red-500", bg: "bg-red-50 dark:bg-red-900/10", rag: "bg-red-500", label: "Critical" };
  if (rate === 0 && !hasOpenDefects) return { ring: "border-slate-200 dark:border-slate-700", bg: "", rag: "bg-slate-400", label: "No Data" };
  if (rate >= 0.9 && !hasCritical) return { ring: "border-green-400 dark:border-green-500", bg: "bg-green-50 dark:bg-green-900/10", rag: "bg-green-500", label: "Healthy" };
  if (rate >= 0.7 || hasOpenDefects) return { ring: "border-amber-400 dark:border-amber-500", bg: "bg-amber-50 dark:bg-amber-900/10", rag: "bg-amber-500", label: "At Risk" };
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
  const suitesQuery = useTmFetch<TmTestSuite[]>(["/api/tm/suites"], "/api/tm/suites");
  const casesQuery = useTmFetch<TmTestCase[]>(["/api/tm/cases"], "/api/tm/cases");
  const defectsQuery = useTmFetch<TmDefect[]>(["/api/tm/defects"], "/api/tm/defects");
  const resultsQuery = useTmFetch<TmTestResult[]>(["/api/tm/results/all"], "/api/tm/results/all");

  const suites = suitesQuery.data ?? [];
  const cases = casesQuery.data ?? [];
  const defects = defectsQuery.data ?? [];
  const allResults = resultsQuery.data ?? [];
  const isLoading = suitesQuery.isLoading || casesQuery.isLoading || defectsQuery.isLoading || resultsQuery.isLoading;
  const firstError = suitesQuery.error ?? casesQuery.error ?? defectsQuery.error ?? resultsQuery.error ?? null;

  // Build per-suite metrics
  const modules = suites.map(suite => {
    const suiteCases = cases.filter(c => c.suiteId === suite.id);
    // Get latest result per case
    const caseResults = suiteCases.map(c => {
      const results = allResults.filter(r => r.testCaseId === c.id);
      const latest = results.sort((a, b) => new Date(b.executedAt ?? 0).getTime() - new Date(a.executedAt ?? 0).getTime())[0];
      return latest?.status ?? "not_run";
    });
    const total = suiteCases.length;
    const pass = caseResults.filter(s => s === "pass").length;
    const fail = caseResults.filter(s => s === "fail").length;
    const blocked = caseResults.filter(s => s === "blocked").length;
    const notRun = caseResults.filter(s => s === "not_run" || s === "skipped").length;
    const executed = pass + fail + blocked;
    const passRate = executed > 0 ? pass / executed : 0;

    const openDefects = defects.filter(d =>
      ((d as { tags?: string[] }).tags ?? []).some((tag: string) => suite.name.toLowerCase().includes(tag.toLowerCase()) || tag.toLowerCase().includes(suite.name.toLowerCase().split(" ")[0])) &&
      d.status !== "resolved" && d.status !== "closed" && d.status !== "wont_fix"
    );
    const criticalDefects = openDefects.filter(d => d.severity === "critical");

    const rag = ragColor(passRate, openDefects.length > 0, criticalDefects.length > 0);

    return { suite, total, pass, fail, blocked, notRun, passRate, openDefects: openDefects.length, criticalDefects: criticalDefects.length, rag };
  });

  // Overall stats
  const totalCases = cases.length;
  const totalPass = modules.reduce((s, m) => s + m.pass, 0);
  const totalFail = modules.reduce((s, m) => s + m.fail, 0);
  const totalBlocked = modules.reduce((s, m) => s + m.blocked, 0);
  const openDefTotal = defects.filter(d => d.status !== "resolved" && d.status !== "closed" && d.status !== "wont_fix").length;
  const overallPassRate = (totalPass + totalFail + totalBlocked) > 0 ? totalPass / (totalPass + totalFail + totalBlocked) : 0;

  return (
    <TmScreenShell
      loading={isLoading}
      error={firstError}
      onRetry={() => {
        void suitesQuery.refetch();
        void casesQuery.refetch();
        void defectsQuery.refetch();
        void resultsQuery.refetch();
      }}
      label="Loading digital twin..."
    >
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Digital Twin</h2>
          <p className="text-sm text-muted-foreground">Live test coverage health map across all application modules.</p>
        </div>

      {/* Overall KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Overall Pass Rate", value: `${Math.round(overallPassRate * 100)}%`, icon: TrendingUp, cls: overallPassRate >= 0.8 ? "text-green-600" : overallPassRate >= 0.6 ? "text-amber-600" : "text-red-600" },
          { label: "Total Test Cases", value: totalCases, icon: FlaskConical, cls: "text-primary" },
          { label: "Open Defects", value: openDefTotal, icon: Bug, cls: openDefTotal === 0 ? "text-green-600" : "text-amber-600" },
          { label: "Modules Covered", value: `${modules.filter(m => m.total > 0).length}/${suites.length}`, icon: Shield, cls: "text-blue-600" },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2 flex-shrink-0"><Icon className="h-4 w-4 text-primary" /></div>
            <div>
              <div className={cn("text-2xl font-bold font-mono", cls)}>{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Module Grid */}
      {modules.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          <FlaskConical className="h-8 w-8 mx-auto mb-3" />
          <div className="text-sm">Load demo data first to see the module health map.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(({ suite, total, pass, fail, blocked, notRun, passRate, openDefects, criticalDefects, rag }) => (
            <button
              key={suite.id}
              onClick={() => onNavigate("navigator")}
              className={cn("bg-card border-2 rounded-2xl p-5 space-y-4 transition-all hover:shadow-lg cursor-pointer text-left w-full", rag.ring, rag.bg)}
              data-testid={`module-card-${suite.id}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{suite.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{total} test case{total !== 1 ? "s" : ""}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={cn("w-2.5 h-2.5 rounded-full", rag.rag)} />
                  <span className="text-[10px] font-semibold font-mono">{rag.label}</span>
                </div>
              </div>

              {/* Pass rate bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Pass Rate</span>
                  <span className="font-mono font-semibold">{pass + fail + blocked > 0 ? `${Math.round(passRate * 100)}%` : "—"}</span>
                </div>
                <div className="flex gap-1 items-center">
                  <MiniBar pct={total > 0 ? pass / total : 0} color="bg-green-500" />
                </div>
              </div>

              {/* Status breakdown */}
              <div className="grid grid-cols-4 gap-1 text-center">
                {[
                  { label: "Pass", val: pass, cls: "text-green-600" },
                  { label: "Fail", val: fail, cls: "text-red-600" },
                  { label: "Blocked", val: blocked, cls: "text-orange-600" },
                  { label: "Not Run", val: notRun, cls: "text-muted-foreground" },
                ].map(s => (
                  <div key={s.label}>
                    <div className={cn("text-lg font-bold font-mono leading-none", s.cls)}>{s.val}</div>
                    <div className="text-[9px] text-muted-foreground uppercase mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Defects */}
              {(openDefects > 0 || criticalDefects > 0) && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  <Bug className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-700 dark:text-red-400">
                    {openDefects} open defect{openDefects !== 1 ? "s" : ""}
                    {criticalDefects > 0 && ` (${criticalDefects} critical)`}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
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
