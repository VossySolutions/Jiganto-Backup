import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, AlertTriangle, Clock, ShieldAlert, CheckCircle, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import type { ServiceDeskDashboard } from "./types";
import { TYPE_LABELS, slaBadgeClass } from "./types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ServiceDeskKpiSkeleton,
  ServiceDeskChartSkeleton,
  ServiceDeskTableSkeleton,
  ServiceDeskTabLoading,
  ServiceDeskErrorState,
  ServiceDeskTableWrap,
  SD_ACCENT,
} from "./ServiceDeskUi";

interface Props {
  onFilterTickets?: (filter: { slaFilter?: string; status?: string; priority?: string }) => void;
}

export function ServiceDeskDashboardTab({ onFilterTickets }: Props) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<ServiceDeskDashboard>({
    queryKey: ["/api/service-desk/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="sd-dashboard-loading">
        <ServiceDeskKpiSkeleton />
        <ServiceDeskChartSkeleton cols={3} />
        <ServiceDeskTableSkeleton rows={4} cols={7} />
      </div>
    );
  }

  if (isError) {
    return (
      <ServiceDeskErrorState
        message="Could not load the Service Desk dashboard. Ensure database tables are migrated (npm run db:push)."
        onRetry={() => refetch()}
      />
    );
  }

  if (!data) {
    return <ServiceDeskTabLoading label="Loading dashboard…" />;
  }

  const kpis = [
    { label: "Open Tickets", value: data.kpis.openTickets, icon: Ticket, color: "#6366f1", filter: { status: "open" } },
    { label: "SLA Breached", value: data.kpis.slaBreached, icon: AlertTriangle, color: "#ef4444", filter: { slaFilter: "breached" } },
    { label: "SLA At Risk", value: data.kpis.slaAtRisk, icon: Clock, color: "#f59e0b", filter: { slaFilter: "at_risk" } },
    { label: "Avg Resolution", value: `${data.kpis.avgResolutionHours}h`, icon: BarChart3, color: "#0ea5e9" },
    { label: "P1 / P2 Open", value: data.kpis.p1p2Open, icon: ShieldAlert, color: "#dc2626", filter: { priority: "p1" } },
    { label: "Pending Approval", value: data.kpis.pendingApproval, icon: CheckCircle, color: "#8b5cf6" },
  ];

  const slaPie = [
    { name: "Within SLA", value: data.slaPerformance.withinPct, color: "#22c55e" },
    { name: "Below target", value: Math.max(0, 100 - data.slaPerformance.withinPct), color: "#ef4444" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="sd-dashboard">
      {isFetching && (
        <p className="text-xs text-muted-foreground text-right">Refreshing…</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="rounded-xl border-border/50 cursor-pointer hover:border-teal-500/40 active:scale-[0.98] transition-all"
            onClick={() => k.filter && onFilterTickets?.(k.filter)}
          >
            <div className="h-0.5 w-full rounded-t-xl" style={{ backgroundColor: k.color }} />
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <k.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" style={{ color: k.color }} />
                <span className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{k.label}</span>
              </div>
              <p className="text-xl sm:text-2xl font-semibold tabular-nums">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="rounded-xl border-border/50 md:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">Volume by Type (30d)</CardTitle></CardHeader>
          <CardContent className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.volumeByType.map((v) => ({ ...v, label: TYPE_LABELS[v.type as keyof typeof TYPE_LABELS] ?? v.type }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                <Tooltip />
                <Bar dataKey="count" fill={SD_ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">SLA Performance</CardTitle>
            <p className="text-xs text-muted-foreground">Target: {data.slaPerformance.target}%</p>
          </CardHeader>
          <CardContent className="h-48 sm:h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slaPie} dataKey="value" nameKey="name" innerRadius="40%" outerRadius="65%">
                  {slaPie.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-lg sm:text-xl font-bold">{data.slaPerformance.withinPct}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">Volume Trend (30d)</CardTitle></CardHeader>
          <CardContent className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.volumeTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="day" hide />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke={SD_ACCENT} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base">Breached &amp; At-Risk SLAs</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <ServiceDeskTableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                  <TableHead className="hidden lg:table-cell">Agent</TableHead>
                  <TableHead>SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.breachedTable.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No breached or at-risk tickets.
                    </TableCell>
                  </TableRow>
                ) : data.breachedTable.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onFilterTickets?.({ slaFilter: t.slaState })}
                  >
                    <TableCell className="font-mono text-xs">{t.ref}</TableCell>
                    <TableCell className="font-medium max-w-[140px] sm:max-w-[200px] truncate">{t.title}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs">{TYPE_LABELS[t.type as keyof typeof TYPE_LABELS] ?? t.type}</TableCell>
                    <TableCell className="text-xs">{t.priority.toUpperCase()}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{t.clientName ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{t.agentName ?? "Unassigned"}</TableCell>
                    <TableCell>
                      <Badge className={cn(slaBadgeClass(t.slaState), "text-[10px]")}>
                        {t.slaState === "breached" ? `${t.overdueHours}h over` : "At risk"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ServiceDeskTableWrap>
        </CardContent>
      </Card>
    </div>
  );
}