import { cn } from "@/lib/utils";
import { useTmProject } from "@/contexts/TmProjectContext";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";
import { TEST_PHASES } from "@/lib/tm-utils";
import { BarChart3, GitCompare } from "lucide-react";
import type { TmPhaseComparisonData } from "@/types/testmgmt";

function phaseLabel(phase: string) {
  return TEST_PHASES.find((p) => p.value === phase)?.label ?? phase.toUpperCase();
}

export function PhaseComparisonScreen() {
  const { activeProject } = useTmProject();
  const { data, isLoading, isError, error, refetch } = useTmFetch<TmPhaseComparisonData>(
    ["/api/tm/reports/phase-comparison"],
    "/api/tm/reports/phase-comparison",
  );

  const phases = data?.phases ?? [];

  return (
    <TmScreenShell
      loading={isLoading}
      error={isError ? error : null}
      onRetry={() => refetch()}
      label="Loading phase comparison..."
    >
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-start gap-3 flex-wrap">
          <GitCompare className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-xl font-semibold">Phase Comparison Report</h2>
            <p className="text-sm text-muted-foreground">
              Compare execution metrics across test phases for {activeProject?.name ?? "this project"}
            </p>
          </div>
        </div>

        {phases.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm border border-dashed rounded-xl">
            No test cycles with phases yet. Create cycles with UAT, SIT, or regression phases to compare.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {phases.map((phase) => (
                <div key={phase.phase} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{phaseLabel(phase.phase)}</span>
                    <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded">{phase.cycleCount} cycles</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className="text-lg font-bold font-mono text-primary">{phase.totals.completionPct}%</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Completion</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className={cn("text-lg font-bold font-mono", phase.totals.passRatePct >= 80 ? "text-green-600" : "text-amber-600")}>
                        {phase.totals.passRatePct}%
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">Pass Rate</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className="text-lg font-bold font-mono">{phase.totals.executed}/{phase.totals.total}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Executed</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className="text-lg font-bold font-mono text-red-600">{phase.openDefects}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Open Defects</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Cycle Detail by Phase</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-700 dark:text-foreground min-w-[640px]">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                      <th className="px-3 py-2.5 text-left align-middle font-semibold">Phase</th>
                      <th className="px-3 py-2.5 text-left align-middle font-semibold">Cycle</th>
                      <th className="px-3 py-2.5 text-left align-middle font-semibold">Status</th>
                      <th className="px-3 py-2.5 text-right align-middle font-semibold">Completion</th>
                      <th className="px-3 py-2.5 text-right align-middle font-semibold">Pass Rate</th>
                      <th className="px-3 py-2.5 text-right align-middle font-semibold">Failed</th>
                      <th className="px-3 py-2.5 text-right align-middle font-semibold">Defects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phases.flatMap((phase) =>
                      phase.cycles.map((cycle) => (
                        <tr key={cycle.id} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="px-3 py-2.5 align-middle text-xs font-mono">{phaseLabel(phase.phase)}</td>
                          <td className="px-3 py-2.5 align-middle font-medium">{cycle.name}</td>
                          <td className="px-3 py-2.5 align-middle capitalize text-xs">{cycle.status?.replace("_", " ")}</td>
                          <td className="px-3 py-2.5 align-middle text-right font-mono">{cycle.metrics.completionPct}%</td>
                          <td className="px-3 py-2.5 align-middle text-right font-mono">{cycle.metrics.passRatePct}%</td>
                          <td className="px-3 py-2.5 align-middle text-right font-mono text-red-600">{cycle.metrics.failed}</td>
                          <td className="px-3 py-2.5 align-middle text-right font-mono">{cycle.openDefects}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </TmScreenShell>
  );
}
