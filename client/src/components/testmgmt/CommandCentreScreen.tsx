import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TmTestCase, TmTestRun, TmDefect } from "@shared/schema";
import { CheckCircle2, XCircle, AlertCircle, Clock, FlaskConical, Bug, PlayCircle, Sparkles, Loader2, ExternalLink, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTmProject } from "@/contexts/TmProjectContext";
import { TmScreen } from "@/types/testmgmt";
import { cn } from "@/lib/utils";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";
import { TmBurndownChart, TmDefectTrendChart, TmPassRateTrendChart, TmAreaHealthChart } from "@/components/testmgmt/TmCharts";
import type { TmDashboardData } from "@/types/testmgmt";

interface Props {
  onNavigate: (screen: TmScreen) => void;
}

function StatCard({ label, value, sub, color, onClick }: {
  label: string; value: string | number; sub?: string; color: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`kpi-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "bg-card border border-border rounded-xl p-5 flex flex-col gap-1 text-left w-full transition-all",
        onClick ? "hover:border-primary/40 hover:shadow-md cursor-pointer group" : "cursor-default"
      )}
    >
      <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono flex items-center gap-1">
        {label}
        {onClick && <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />}
      </span>
      <span className={`text-3xl font-bold font-mono ${color}`}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </button>
  );
}

export function CommandCentreScreen({ onNavigate }: Props) {
  const { toast } = useToast();
  const { activeProjectId } = useTmProject();

  const dashboardQuery = useTmFetch<TmDashboardData>(["/api/tm/dashboard"], "/api/tm/dashboard");
  const casesQuery = useTmFetch<TmTestCase[]>(["/api/tm/cases"], "/api/tm/cases");
  const runsQuery = useTmFetch<TmTestRun[]>(["/api/tm/runs"], "/api/tm/runs");
  const defectsQuery = useTmFetch<TmDefect[]>(["/api/tm/defects"], "/api/tm/defects");

  const dashboard = dashboardQuery.data;
  const cases = casesQuery.data ?? [];
  const runs = runsQuery.data ?? [];
  const defects = defectsQuery.data ?? [];
  const isLoading = dashboardQuery.isLoading || casesQuery.isLoading || runsQuery.isLoading || defectsQuery.isLoading;
  const firstError = dashboardQuery.error ?? casesQuery.error ?? runsQuery.error ?? defectsQuery.error ?? null;

  const seedMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/tm/migrate-schema").catch(() => {});
      const data = await apiRequest("POST", "/api/tm/seed-demo");
      await apiRequest("POST", "/api/tm/migrate-project");
      if (activeProjectId) await apiRequest("POST", "/api/tm/seed-hierarchy", { projectId: activeProjectId }).catch(() => {});
      return data;
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/defects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/suites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/dashboard"] });
      toast({ title: "Demo data loaded", description: `${data.cases} test cases, ${data.defects} defects across ${data.suites} suites.` });
    },
    onError: (e: any) => toast({ title: "Could not load demo data", description: e.message, variant: "destructive" }),
  });

  const kpis = dashboard?.kpis;
  const isEmpty = !isLoading && !firstError && !dashboard && cases.length === 0 && runs.length === 0 && defects.length === 0;

  const activeCases = cases.filter(c => c.status === "active").length;
  const draftCases = cases.filter(c => c.status === "draft").length;
  const activeRuns = runs.filter(r => r.status === "in_progress").length;
  const openDefects = kpis?.openDefects ?? defects.filter(d => d.status !== "resolved" && d.status !== "closed" && d.status !== "wont_fix").length;
  const criticalDefects = kpis?.criticalDefects ?? defects.filter(d => d.severity === "critical" && d.status !== "resolved" && d.status !== "closed").length;

  if (isEmpty) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[500px] text-center gap-4">
        <div className="bg-primary/10 rounded-full p-5 mb-2">
          <FlaskConical className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Command Centre</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          No test data yet. Load the sample ERP Implementation project to see a realistic view with test suites, test cases, defects, and execution runs.
        </p>
        <Button
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          size="lg"
          className="mt-2"
          data-testid="button-load-demo-data"
        >
          {seedMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading demo data...</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" /> Load Demo Data</>
          )}
        </Button>
        <p className="text-xs text-muted-foreground max-w-sm">
          Loads 12 test cases with steps, 6 test suites, 3 test runs, and 10 defects based on a real ERP implementation project scenario.
        </p>
      </div>
    );
  }

  return (
    <TmScreenShell
      loading={isLoading}
      error={firstError}
      onRetry={() => {
        void dashboardQuery.refetch();
        void casesQuery.refetch();
        void runsQuery.refetch();
        void defectsQuery.refetch();
      }}
      label="Loading command centre..."
    >
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Command Centre</h2>
          <p className="text-sm text-muted-foreground">Click any KPI card to drill into the detail view</p>
        </div>
      </div>

      {/* KPI Row — spec dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Cases" value={kpis?.totalCases ?? cases.length} sub={`${activeCases} active`} color="text-primary" onClick={() => onNavigate("test-cases")} />
        <StatCard label="Executed" value={kpis ? `${kpis.executed} (${kpis.executedPct}%)` : activeRuns} color="text-blue-500" onClick={() => onNavigate("execution")} />
        <StatCard label="Passed" value={kpis ? `${kpis.passed} (${kpis.passedPct}%)` : "—"} color="text-green-600" onClick={() => onNavigate("execution")} />
        <StatCard label="Failed" value={kpis ? `${kpis.failed} (${kpis.failedPct}%)` : "—"} color="text-red-500" onClick={() => onNavigate("defect-triage")} />
        <StatCard label="Open Defects" value={openDefects} sub={`${criticalDefects} critical`} color="text-amber-500" onClick={() => onNavigate("defect-board")} />
      </div>

      {(kpis || dashboard) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Completion</div>
            <div className="text-3xl font-bold font-mono text-primary">{kpis?.completionPct ?? 0}%</div>
            <div className="mt-2 bg-muted rounded-full h-2"><div className="h-full bg-primary rounded-full" style={{ width: `${kpis?.completionPct ?? 0}%` }} /></div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pass Rate</div>
            <div className="text-3xl font-bold font-mono text-green-600">{kpis?.passRatePct ?? 0}%</div>
            <div className="mt-2 bg-muted rounded-full h-2"><div className="h-full bg-green-500 rounded-full" style={{ width: `${kpis?.passRatePct ?? 0}%` }} /></div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Release Readiness</div>
            <div className={cn("text-3xl font-bold font-mono", (kpis?.releaseReadiness ?? 0) >= 80 ? "text-green-600" : "text-amber-600")}>{kpis?.releaseReadiness ?? 0}%</div>
            {dashboard?.activeCycle && <div className="text-xs text-muted-foreground mt-1">Active cycle: {dashboard.activeCycle.name}</div>}
          </div>
        </div>
      )}

      {dashboard && (dashboard.burndown?.length || dashboard.passRateTrend?.length) ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-primary" />
            Analytics
            <button onClick={() => onNavigate("phase-comparison")} className="ml-auto text-xs text-primary hover:underline">
              Phase comparison →
            </button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {dashboard.burndown?.length ? (
              <TmBurndownChart data={dashboard.burndown.map(d => ({ date: d.date, target: d.target ?? 0, actual: d.actual ?? d.remaining ?? 0 }))} />
            ) : null}
            {dashboard.defectTrend?.length ? (
              <TmDefectTrendChart data={dashboard.defectTrend.map(d => ({ date: d.date, open: d.open ?? d.count ?? 0, closed: d.closed ?? 0 }))} />
            ) : null}
            {dashboard.passRateTrend?.length ? (
              <TmPassRateTrendChart data={dashboard.passRateTrend.map(d => ({ label: d.label ?? d.cycleName ?? "Cycle", rate: d.rate ?? d.passRatePct ?? 0 }))} />
            ) : null}
            {dashboard.byArea?.length ? (
              <TmAreaHealthChart data={dashboard.byArea.map(a => ({ name: a.name ?? (a as { areaName?: string }).areaName ?? "Area", passRatePct: a.passRatePct ?? 0, completionPct: a.completionPct ?? 0 }))} />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Legacy KPI row hidden when dashboard loaded — keep runs/defects panels below */}
      {!kpis && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Test Cases"
          value={cases.length}
          sub={`${activeCases} active · ${draftCases} draft`}
          color="text-primary"
          onClick={() => onNavigate("test-cases")}
        />
        <StatCard
          label="Active Runs"
          value={activeRuns}
          sub={`${runs.length} total cycles`}
          color="text-blue-500"
          onClick={() => onNavigate("execution")}
        />
        <StatCard
          label="Open Defects"
          value={openDefects}
          sub={`${defects.length} total raised`}
          color="text-amber-500"
          onClick={() => onNavigate("defect-triage")}
        />
        <StatCard
          label="Critical Defects"
          value={criticalDefects}
          sub="requiring immediate attention"
          color={criticalDefects > 0 ? "text-red-500" : "text-green-500"}
          onClick={() => onNavigate("defect-board")}
        />
      </div>
      )}

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Runs */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Test Cycles</span>
            <button
              onClick={() => onNavigate("execution")}
              className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
              data-testid="link-view-all-runs"
            >
              View all <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-border">
            {runs.slice(0, 6).map(run => (
              <button
                key={run.id}
                onClick={() => onNavigate("execution")}
                data-testid={`run-row-${run.id}`}
                className="w-full px-5 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors text-left"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  run.status === "completed" ? "bg-green-500" :
                  run.status === "in_progress" ? "bg-blue-500" :
                  run.status === "aborted" ? "bg-red-500" : "bg-muted-foreground"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{run.name}</div>
                  {(run.startDate || run.endDate) && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {run.startDate} {run.endDate ? `→ ${run.endDate}` : ""}
                    </div>
                  )}
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                  run.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  run.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {run.status?.replace("_", " ")}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Defect Summary */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Bug className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-sm">Defect Summary</span>
            <span className="ml-auto text-xs font-mono text-muted-foreground">{openDefects} open · {defects.length} total</span>
          </div>
          <div className="p-5 space-y-3">
            {(["critical", "high", "medium", "low"] as const).map(sev => {
              const total = defects.filter(d => d.severity === sev).length;
              const open = defects.filter(d => d.severity === sev && d.status !== "resolved" && d.status !== "closed" && d.status !== "wont_fix").length;
              const pct = defects.length > 0 ? Math.round((total / defects.length) * 100) : 0;
              const barColor = sev === "critical" ? "bg-red-500" : sev === "high" ? "bg-orange-500" : sev === "medium" ? "bg-amber-500" : "bg-blue-400";
              const labelColor = sev === "critical" ? "text-red-500" : sev === "high" ? "text-orange-500" : sev === "medium" ? "text-amber-500" : "text-blue-400";
              return (
                <button
                  key={sev}
                  onClick={() => onNavigate("defect-triage")}
                  className="flex items-center gap-3 w-full hover:opacity-75 transition-opacity"
                  data-testid={`defect-sev-row-${sev}`}
                >
                  <span className={`text-xs font-mono capitalize w-16 font-semibold text-left ${labelColor}`}>{sev}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-mono w-14 text-right text-muted-foreground">
                    {open} open / {total}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Top open defects */}
          <div className="border-t border-border px-5 py-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Top Open Defects</div>
            <div className="space-y-2">
              {defects
                .filter(d => d.status !== "resolved" && d.status !== "closed" && d.status !== "wont_fix")
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (order[a.severity as keyof typeof order] ?? 9) - (order[b.severity as keyof typeof order] ?? 9);
                })
                .slice(0, 4)
                .map(d => (
                  <button
                    key={d.id}
                    onClick={() => onNavigate("defect-board")}
                    className="flex items-start gap-2 w-full hover:opacity-75 transition-opacity text-left"
                    data-testid={`top-defect-${d.id}`}
                  >
                    <span className={`text-xs font-mono font-bold mt-0.5 ${
                      d.severity === "critical" ? "text-red-500" :
                      d.severity === "high" ? "text-orange-500" : "text-amber-500"
                    }`}>
                      {(d.severity ?? "").toUpperCase().slice(0, 4)}
                    </span>
                    <span className="text-xs text-foreground truncate flex-1">{d.title}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Test Case status breakdown */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Test Case Library</span>
          <button
            onClick={() => onNavigate("test-cases")}
            className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
            data-testid="link-view-all-cases"
          >
            View all <ExternalLink className="h-3 w-3" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(["draft", "active", "deprecated"] as const).map(s => {
            const count = cases.filter(c => c.status === s).length;
            const icon = s === "active" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                         s === "deprecated" ? <XCircle className="h-4 w-4 text-muted-foreground" /> :
                         <Clock className="h-4 w-4 text-amber-500" />;
            return (
              <button
                key={s}
                onClick={() => onNavigate("test-cases")}
                className="flex items-center gap-2 hover:opacity-75 transition-opacity text-left"
                data-testid={`case-status-${s}`}
              >
                {icon}
                <div>
                  <div className="text-lg font-bold font-mono">{count}</div>
                  <div className="text-xs text-muted-foreground capitalize">{s}</div>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => onNavigate("navigator")}
            className="flex items-center gap-2 hover:opacity-75 transition-opacity text-left"
            data-testid="case-status-automated"
          >
            <AlertCircle className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-lg font-bold font-mono">{cases.filter(c => c.caseType === "automated").length}</div>
              <div className="text-xs text-muted-foreground">Automated</div>
            </div>
          </button>
        </div>
      </div>
      </div>
    </TmScreenShell>
  );
}
