import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Calendar, Target, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import type { PortfolioDashboardData } from "./types";
import { formatBudget } from "./rag-utils";

function RagDot({ status }: { status: string | null }) {
  const s = (status || "green").toLowerCase();
  const cls = s === "red" ? "bg-red-500" : s === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", cls)} />;
}

export function PortfolioDashboardTab({ onNavigate, headerSearch }: { onNavigate?: (tab: string) => void; headerSearch?: string }) {
  const [, setLocation] = useLocation();
  const [localSearch, setLocalSearch] = useState("");
  const search = headerSearch?.trim() ? headerSearch : localSearch;
  const [filter, setFilter] = useState("all");

  const { data, isLoading } = useQuery<PortfolioDashboardData>({
    queryKey: ["/api/portfolio/dashboard"],
    staleTime: 30_000,
  });

  const hierarchy = useMemo(() => {
    if (!data) return [];
    return data.programmes.map((prog) => ({
      id: `prog-${prog.source}-${prog.id}`,
      name: prog.name,
      type: "programme" as const,
      ragStatus: prog.ragStatus,
      status: prog.status,
      progress: prog.progress,
      budget: prog.budget,
      clientName: prog.clientNames.join(", "),
      children: prog.children,
    }));
  }, [data]);

  const filtered = useMemo(() => {
    let items = hierarchy;
    if (filter === "risk") items = items.filter((i) => ["amber", "red"].includes((i.ragStatus || "").toLowerCase()));
    if (filter === "critical") items = items.filter((i) => (i.ragStatus || "").toLowerCase() === "red");
    if (search) items = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [hierarchy, filter, search]);

  const pagination = useTablePagination(filtered, { defaultPageSize: 10 });

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const { kpis, portfolioHealth, budgetByPortfolio, milestoneTimeline, attentionQueue, resourceUtilisation, activityFeed } = data;
  const healthChartData = portfolioHealth.map((p) => ({ name: p.name, OnTrack: p.green, AtRisk: p.amber, Behind: p.red }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <MetricCard title="Active Projects" value={kpis.activeProjects} subtitle={`${kpis.greenCount} on track`} helpText="Projects currently in active status across all portfolios." borderColor="#22C55E" onClick={() => setLocation("/modules/projects")} testId="pf-kpi-active-projects" />
        <MetricCard title="At Risk / Behind" value={kpis.atRiskCount} subtitle="Amber + Red RAG" helpText="Projects flagged amber (at risk) or red (behind) on the RAG health scale." borderColor="#F59E0B" onClick={() => onNavigate?.("health")} testId="pf-kpi-at-risk" />
        <MetricCard title="Portfolio Budget" value={formatBudget(kpis.totalBudget)} subtitle={`${formatBudget(kpis.totalSpent)} spent`} helpText="Total approved budget across portfolios and spend to date." borderColor="#3B82F6" testId="pf-kpi-budget" />
        <MetricCard title="Milestones Due (30d)" value={kpis.milestonesDue30d} subtitle="Across all projects" helpText="Milestones with target dates in the next 30 days." borderColor="#8B5CF6" onClick={() => onNavigate?.("milestones")} testId="pf-kpi-milestones" />
        <MetricCard
          title="Avg Project Health"
          value={`${kpis.avgHealth}%`}
          subtitle={kpis.avgHealthTrend > 0 ? `+${kpis.avgHealthTrend}% vs 4 wks ago` : kpis.avgHealthTrend < 0 ? `${kpis.avgHealthTrend}% vs 4 wks ago` : "No prior snapshot"}
          helpText="Weighted average RAG health score (0–100) across active projects."
          borderColor="#14B8A6"
          testId="pf-kpi-health"
        />
        <MetricCard title="Programmes" value={kpis.programmeCount} subtitle={`${kpis.childProjectCount} child projects`} helpText="Top-level programmes and their linked child projects." borderColor="#7C3AED" onClick={() => onNavigate?.("programmes")} testId="pf-kpi-programmes" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-border/30">
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-bold">Portfolio Health by Portfolio</CardTitle></CardHeader>
          <CardContent className="h-64">
            {healthChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={healthChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="OnTrack" stackId="a" fill="#22C55E" />
                  <Bar dataKey="AtRisk" stackId="a" fill="#F59E0B" />
                  <Bar dataKey="Behind" stackId="a" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No portfolio data</p>}
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-bold">Budget vs Actual by Portfolio</CardTitle></CardHeader>
          <CardContent className="h-64">
            {budgetByPortfolio.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetByPortfolio}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatBudget(v)} />
                  <Legend />
                  <Bar dataKey="budget" name="Budget" fill="#3B82F6" />
                  <Bar dataKey="spent" name="Actual" fill="#F59E0B" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No budget data</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/30">
        <CardHeader className="py-3 px-4 flex-row items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-bold flex-1">Milestone Timeline — Next 90 Days</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {milestoneTimeline.length ? milestoneTimeline.map((m) => (
            <div key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm border-b border-border/30 pb-2 last:border-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <RagDot status={m.ragStatus} />
                <span className="font-medium truncate">{m.name}</span>
              </div>
              <span className="text-muted-foreground text-xs truncate sm:max-w-[140px]">{m.projectName}</span>
              <span className="font-mono text-xs shrink-0">{m.targetDate}</span>
            </div>
          )) : <p className="text-sm text-muted-foreground text-center py-6">No upcoming milestones</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        <Card className="border-border/30">
          <CardHeader className="py-3 px-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-bold">Projects Needing Attention</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {["all", "risk", "critical"].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("text-xs px-2 py-1 rounded-full border capitalize", filter === f ? "bg-primary/10 border-primary/30 text-primary" : "text-muted-foreground")}>{f}</button>
              ))}
              <div className="flex items-center gap-1 bg-muted/50 border rounded-lg px-2 py-1 flex-1 sm:flex-none min-w-[120px]">
                <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                <input value={headerSearch != null ? search : localSearch} onChange={(e) => { if (headerSearch == null) setLocalSearch(e.target.value); }} placeholder="Search..." className="bg-transparent border-none outline-none text-xs w-full sm:w-24" />
              </div>
            </div>
          </CardHeader>
          <div className="md:hidden divide-y divide-border/30">
            {pagination.paginatedItems.map((row) => (
              <div key={row.id} className="px-4 py-3 flex items-center gap-3 active:bg-muted/30" onClick={() => row.children[0]?.id && setLocation(`/modules/projects/${row.children[0].id}`)}>
                <RagDot status={row.ragStatus} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{row.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{row.clientName || "—"} · {row.children[0]?.managerName || "—"}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-gray-700 dark:text-foreground">
              <thead><tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Project</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Client</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">PM</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">RAG</th>
                <th className="px-3 py-2.5 text-right align-middle font-semibold"></th>
              </tr></thead>
              <tbody>
                {pagination.paginatedItems.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-2.5 align-middle font-medium">{row.name}</td>
                    <td className="px-3 py-2.5 align-middle text-muted-foreground text-xs">{row.clientName || "—"}</td>
                    <td className="px-3 py-2.5 align-middle text-xs">{row.children[0]?.managerName || "—"}</td>
                    <td className="px-3 py-2.5 align-middle"><RagDot status={row.ragStatus} /></td>
                    <td className="px-3 py-2.5 align-middle text-right"><Button variant="ghost" size="sm" onClick={() => setLocation(`/modules/projects/${row.children[0]?.id || ""}`)}><ArrowUpRight className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </Card>

        <div className="space-y-4">
          <Card className="border-border/30">
            <CardHeader className="py-3 px-4 flex-row items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-bold flex-1">Attention Queue</CardTitle>
              <Badge variant="outline">{attentionQueue.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {attentionQueue.map((a) => (
                <div key={a.id} className="px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setLocation(`/modules/projects/${a.id}`)}>
                  <p className="text-xs font-semibold">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground">{a.clientName} · <RagDot status={a.ragStatus} /></p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border/30">
            <CardHeader className="py-3 px-4 flex-row items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold flex-1">Resource Utilisation</CardTitle>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">Allocation ÷ capacity this week</span>
              {resourceUtilisation.filter((r) => r.utilisation > 90).length > 0 && (
                <Badge variant="outline" className="text-xs text-red-600">{resourceUtilisation.filter((r) => r.utilisation > 90).length} overloaded</Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {resourceUtilisation.length ? resourceUtilisation.map((r) => (
                <div key={r.initials} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: r.color }}>{r.initials}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-semibold truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">{r.role}</p>
                  </div>
                  <span className="font-mono text-[10px] font-semibold" style={{ color: r.color }}>{r.utilisation}%</span>
                </div>
              )) : <p className="text-xs text-muted-foreground text-center py-6">No resource data</p>}
            </CardContent>
          </Card>

          <Card className="border-border/30">
            <CardHeader className="py-3 px-4 flex-row items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">Portfolio Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activityFeed.length ? activityFeed.map((a) => (
                <div key={a.id} className="px-4 py-2.5 border-b border-border/30 last:border-0">
                  <p className="text-[11.5px] text-muted-foreground">
                    <strong className="text-foreground">{a.user}</strong> {a.action} <strong className="text-foreground">{a.target}</strong>
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{a.time}</p>
                </div>
              )) : <p className="text-xs text-muted-foreground text-center py-6">No recent activity</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
