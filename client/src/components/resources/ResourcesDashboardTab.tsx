import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Users, Activity, AlertTriangle, Clock, TrendingUp, Briefcase, BarChart3, Percent,
} from "lucide-react";
import { getInitials, UTILISATION_TARGET } from "./constants";
import {
  ResourcesKpiSkeleton, ResourcesChartSkeleton,
  ResourcesErrorState, ResourcesEmptyState,
} from "./ResourcesUi";
import type { Resource, ResourceAllocation } from "@shared/models/resources";
import { Button } from "@/components/ui/button";
import { ArrowRight, UserCheck } from "lucide-react";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";

type DashboardData = {
  stats: {
    utilisationPct: number;
    utilisationColor: string;
    onBench: number;
    overAllocated: number;
    activeResources: number;
    permanentCount: number;
    contractorCount: number;
    unapprovedTimesheets: number;
    forecastDemand90d: number;
    forecastSurplusDeficit: number;
    avgUtilisation3m: number;
    contractorRatio: number;
    utilByResource: Record<number, number>;
  };
  trend: { month: string; utilisation: number }[];
  capacityDemand: { week: string; available: number; allocated: number; pipeline: number }[];
  skillsHeatmap: { roles: string[]; weekLabels: string[]; matrix: Record<string, number[]> };
};

type Props = {
  resources: Resource[];
  allocations: ResourceAllocation[];
  onNavigate: (tab: string, filter?: string) => void;
  onOpenProfile: (id: number) => void;
};

function KpiCard({
  label, value, subtitle, icon: Icon, color, badge, onClick, testId,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Users;
  color?: string;
  badge?: string;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <Card
      className={cn(
        "rounded-xl border-border/50 overflow-hidden transition-all duration-200",
        "hover:shadow-md hover:border-orange-500/30 active:scale-[0.99]",
        onClick && "cursor-pointer",
      )}
      onClick={onClick}
      data-testid={testId}
    >
      <div className="h-1 bg-gradient-to-r from-orange-500/80 to-orange-400/40" />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{label}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className={cn("text-2xl sm:text-3xl font-bold tabular-nums", color)}>{value}</p>
              {badge && <Badge variant="destructive" className="text-xs shrink-0">{badge}</Badge>}
            </div>
            {subtitle && <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>}
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-orange-500/10 shrink-0">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ResourcesDashboardTab({ resources, onNavigate, onOpenProfile }: Props) {
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/resources/dashboard"],
  });

  const stats = data?.stats;
  const utilMap = stats?.utilByResource ?? {};

  const topUtilised = useMemo(() => {
    return [...resources]
      .map((r) => ({ ...r, util: utilMap[r.id] ?? 0 }))
      .sort((a, b) => b.util - a.util)
      .slice(0, 10);
  }, [resources, utilMap]);

  const skillsRows = data?.skillsHeatmap?.roles ?? [];
  const skillsPagination = useTablePagination(skillsRows, {
    resetKey: `${data?.skillsHeatmap?.weekLabels?.join("|") ?? ""}`,
  });

  const utilColor = (pct: number) =>
    pct >= UTILISATION_TARGET ? "text-emerald-600" : pct >= UTILISATION_TARGET - 10 ? "text-amber-600" : "text-red-600";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ResourcesKpiSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <ResourcesChartSkeleton />
          <ResourcesChartSkeleton />
        </div>
      </div>
    );
  }

  if (isError) {
    return <ResourcesErrorState message="Could not load dashboard metrics" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {(stats?.unapprovedTimesheets ?? 0) > 0 && (
        <Card className="rounded-xl border-orange-500/40 bg-orange-500/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <UserCheck className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{stats!.unapprovedTimesheets} timesheet{stats!.unapprovedTimesheets === 1 ? "" : "s"} awaiting approval</p>
                <p className="text-xs text-muted-foreground">Review submissions, approve lines, or bulk approve PM/RM</p>
              </div>
            </div>
            <Button size="sm" className="shrink-0" onClick={() => onNavigate("timesheets", "approvals")}>
              Review approvals <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Utilisation %" value={`${stats?.utilisationPct ?? 0}%`} subtitle={`Target ${UTILISATION_TARGET}%`} icon={Activity} color={utilColor(stats?.utilisationPct ?? 0)} onClick={() => onNavigate("timesheets")} testId="kpi-utilisation" />
        <KpiCard label="On the Bench" value={stats?.onBench ?? 0} subtitle="Zero allocation this week" icon={Users} color={stats?.onBench ? "text-red-600" : undefined} badge={stats?.onBench ? "!" : undefined} onClick={() => onNavigate("people", "bench")} testId="kpi-bench" />
        <KpiCard label="Over-allocated" value={stats?.overAllocated ?? 0} subtitle="Next 4 weeks > 100%" icon={AlertTriangle} color={stats?.overAllocated ? "text-amber-600" : undefined} onClick={() => onNavigate("allocations", "overallocated")} testId="kpi-overallocated" />
        <KpiCard label="Active Resources" value={stats?.activeResources ?? 0} subtitle={`${stats?.permanentCount ?? 0} permanent / ${stats?.contractorCount ?? 0} contractors`} icon={Briefcase} onClick={() => onNavigate("people")} testId="kpi-headcount" />
        <KpiCard label="Unapproved Timesheets" value={stats?.unapprovedTimesheets ?? 0} subtitle="Awaiting approval" icon={Clock} color={(stats?.unapprovedTimesheets ?? 0) > 5 ? "text-red-600" : undefined} badge={(stats?.unapprovedTimesheets ?? 0) > 5 ? "!" : undefined} onClick={() => onNavigate("timesheets", "approvals")} testId="kpi-unapproved" />
        <KpiCard label="Forecast Demand (90d)" value={`${stats?.forecastDemand90d ?? 0}d`} subtitle={(stats?.forecastSurplusDeficit ?? 0) >= 0 ? `Surplus ${stats?.forecastSurplusDeficit}d` : `Deficit ${Math.abs(stats?.forecastSurplusDeficit ?? 0)}d`} icon={TrendingUp} color={(stats?.forecastSurplusDeficit ?? 0) < 0 ? "text-red-600" : "text-emerald-600"} onClick={() => onNavigate("pipeline")} testId="kpi-forecast" />
        <KpiCard label="Avg Utilisation (3m)" value={`${stats?.avgUtilisation3m ?? 0}%`} subtitle="Rolling 3-month average" icon={BarChart3} color={utilColor(stats?.avgUtilisation3m ?? 0)} testId="kpi-avg-3m" />
        <KpiCard label="Contractor Ratio" value={`${stats?.contractorRatio ?? 0}%`} subtitle="Of active workforce" icon={Percent} testId="kpi-contractor-ratio" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="rounded-xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base font-semibold">12-Month Utilisation Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {(data?.trend ?? []).map((m) => (
                <div key={m.month} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <span className="w-12 sm:w-14 text-muted-foreground shrink-0">{m.month}</span>
                  <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden relative min-w-0">
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${Math.min(m.utilisation, 100)}%` }} />
                    <div className="absolute top-0 h-full w-0.5 bg-amber-500" style={{ left: `${UTILISATION_TARGET}%` }} />
                  </div>
                  <span className={cn("w-9 sm:w-10 text-right font-medium tabular-nums shrink-0", utilColor(m.utilisation))}>{m.utilisation}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base font-semibold">8-Week Capacity vs Demand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.capacityDemand ?? []).map((w) => {
                const total = w.available + w.allocated + w.pipeline;
                return (
                  <div key={w.week} className="space-y-1">
                    <div className="flex justify-between text-[11px] sm:text-xs text-muted-foreground">
                      <span>{w.week}</span>
                      <span>Pipeline {w.pipeline}d</span>
                    </div>
                    <div className="flex h-4 sm:h-5 rounded-md overflow-hidden bg-muted">
                      <div className="bg-emerald-500 transition-all" style={{ width: `${total ? (w.available / total) * 100 : 0}%` }} title="Available" />
                      <div className="bg-blue-500 transition-all" style={{ width: `${total ? (w.allocated / total) * 100 : 0}%` }} title="Allocated" />
                      <div className="bg-amber-400 transition-all" style={{ width: `${total ? (w.pipeline / total) * 100 : 0}%` }} title="Pipeline" />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 sm:gap-4 mt-3 text-[11px] sm:text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded" /> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded" /> Allocated</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-amber-400 rounded" /> Pipeline</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {data?.skillsHeatmap?.roles?.length ? (
        <Card className="rounded-xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base font-semibold">Skills Demand Heatmap</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-card z-10">Role</th>
                  {(data.skillsHeatmap.weekLabels ?? []).map((w) => (
                    <th key={w} className="p-1 text-center font-normal text-muted-foreground whitespace-nowrap">{w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skillsPagination.paginatedItems.map((role) => (
                  <tr key={role} className="border-t border-border/30">
                    <td className="p-2 font-medium sticky left-0 bg-card z-10 max-w-[120px] truncate">{role}</td>
                    {(data.skillsHeatmap.matrix[role] ?? []).map((v, i) => (
                      <td key={i} className="p-0.5">
                        <div className={cn("h-6 sm:h-7 rounded text-center text-[10px] leading-6 sm:leading-7 tabular-nums", v === 0 ? "bg-muted" : v < 3 ? "bg-amber-200 dark:bg-amber-900/40" : v < 6 ? "bg-orange-300 dark:bg-orange-800/50" : "bg-red-500 text-white")}>
                          {v > 0 ? v : ""}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              page={skillsPagination.page}
              totalPages={skillsPagination.totalPages}
              total={skillsPagination.total}
              startIndex={skillsPagination.startIndex}
              endIndex={skillsPagination.endIndex}
              pageSize={skillsPagination.pageSize}
              onPageChange={skillsPagination.setPage}
              onPageSizeChange={skillsPagination.setPageSize}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-xl border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base font-semibold">Top Utilised Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 sm:space-y-2">
          {topUtilised.length === 0 ? (
            <ResourcesEmptyState title="No utilisation data yet" description="Add people and allocations to see utilisation rankings." />
          ) : topUtilised.map((r) => (
            <button
              key={r.id}
              type="button"
              className="flex items-center gap-2 sm:gap-3 w-full text-left hover:bg-muted/50 rounded-lg p-2 sm:p-2.5 transition-colors"
              onClick={() => onOpenProfile(r.id)}
            >
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
                <AvatarImage src={r.photoUrl ?? undefined} />
                <AvatarFallback className="text-xs">{getInitials(r.firstName, r.lastName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 sm:w-32 sm:flex-none">
                <p className="text-sm font-medium truncate">{r.firstName} {r.lastName}</p>
                <p className="text-xs text-muted-foreground truncate">{r.jobTitle ?? "—"}</p>
              </div>
              <div className="hidden sm:block flex-1 max-w-[200px]"><Progress value={Math.min(r.util, 100)} className="h-2" /></div>
              <Badge variant="outline" className={cn("shrink-0 tabular-nums", r.util > 100 && "border-red-300 text-red-700")}>{r.util}%</Badge>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
