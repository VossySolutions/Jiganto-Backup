import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, AlertTriangle, Clock, Star, Bug, Wallet, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import type { HelpDeskDashboard } from "../service-desk/types";
import { TYPE_LABELS, slaBadgeClass } from "../service-desk/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  HelpDeskKpiSkeleton,
  HelpDeskChartSkeleton,
  HelpDeskTableSkeleton,
  HelpDeskErrorState,
  HelpDeskTableWrap,
  HelpDeskRefreshing,
  HD_ACCENT,
} from "./HelpDeskUi";

interface Props {
  onFilterTickets?: (filter: { slaFilter?: string; status?: string; priority?: string; type?: string }) => void;
}

export function HelpDeskDashboardTab({ onFilterTickets }: Props) {
  const { data, isLoading, isError, isFetching, refetch } = useQuery<HelpDeskDashboard>({
    queryKey: ["/api/help-desk/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6" data-testid="hd-dashboard-loading">
        <HelpDeskKpiSkeleton count={6} />
        <HelpDeskChartSkeleton cols={3} />
        <HelpDeskTableSkeleton rows={4} cols={7} />
      </div>
    );
  }

  if (isError) {
    return (
      <HelpDeskErrorState
        message="Could not load the Help Desk dashboard. Run npm run db:patch-help-desk if tables are missing."
        onRetry={() => refetch()}
      />
    );
  }

  if (!data) return null;

  const kpis = [
    { label: "Open Tickets", value: data.kpis.openTickets, icon: Ticket, color: HD_ACCENT, filter: { status: "open" } },
    { label: "SLA Breached", value: data.kpis.slaBreached, icon: AlertTriangle, color: "#ef4444", filter: { slaFilter: "breached" } },
    { label: "Avg Resolution", value: `${data.kpis.avgResolutionHours}h`, icon: Clock, color: "#6366f1" },
    { label: "CSAT Score", value: data.kpis.csatScore > 0 ? data.kpis.csatScore : "—", icon: Star, color: "#f59e0b" },
    { label: "Open Defects", value: data.kpis.openDefects, icon: Bug, color: "#dc2626", filter: { type: "defect" } },
    { label: "Billable Hrs", value: `${data.kpis.billableHoursThisMonth}h`, icon: Wallet, color: "#22c55e", href: "/modules/finance" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="hd-dashboard">
      <HelpDeskRefreshing show={isFetching && !isLoading} />

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="rounded-xl border-border/50 cursor-pointer hover:border-sky-500/40 active:scale-[0.98] transition-all"
            onClick={() => {
              if ("href" in k && k.href) { window.location.href = k.href; return; }
              if (k.filter) onFilterTickets?.(k.filter);
            }}
          >
            <div className="h-0.5 w-full rounded-t-xl" style={{ backgroundColor: k.color }} />
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-1 mb-1">
                <k.icon className="h-3.5 w-3.5 shrink-0" style={{ color: k.color }} />
                <span className="text-[10px] sm:text-xs text-muted-foreground leading-tight line-clamp-2">{k.label}</span>
              </div>
              <p className="text-lg sm:text-2xl font-semibold tabular-nums">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        <Card className="rounded-xl border-border/50 md:col-span-1">
          <CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-xs sm:text-sm">Volume by Type (30d)</CardTitle></CardHeader>
          <CardContent className="h-44 sm:h-52 px-2 sm:px-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.volumeByType.map((v) => ({ ...v, label: TYPE_LABELS[v.type as keyof typeof TYPE_LABELS] ?? v.type }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={40} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} width={24} />
                <Tooltip />
                <Bar dataKey="count" fill={HD_ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50">
          <CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-xs sm:text-sm">Resolution Trend (12w)</CardTitle></CardHeader>
          <CardContent className="h-44 sm:h-52 px-2 sm:px-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.resolutionTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="week" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} width={24} />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke={HD_ACCENT} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-xs sm:text-sm">CSAT Trend</CardTitle></CardHeader>
          <CardContent className="h-44 sm:h-52 px-2 sm:px-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.csatTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 8 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 9 }} width={24} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-border/50">
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-xs sm:text-sm">Overdue Tickets</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-border/50">
            {data.overdueTable.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No overdue tickets.</p>
            ) : data.overdueTable.map((t) => (
              <button
                key={t.id}
                type="button"
                className="w-full text-left p-3 hover:bg-muted/40"
                onClick={() => onFilterTickets?.({ slaFilter: "breached" })}
              >
                <div className="flex justify-between gap-2 mb-1">
                  <span className="font-mono text-xs text-muted-foreground">{t.ref}</span>
                  <Badge className={cn(slaBadgeClass("breached"), "text-[10px]")}>{t.overdueHours}h over</Badge>
                </div>
                <p className="font-medium text-sm line-clamp-2">{t.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{TYPE_LABELS[t.type as keyof typeof TYPE_LABELS] ?? t.type} · {t.priority.toUpperCase()}</p>
              </button>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <HelpDeskTableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="hidden lg:table-cell">Client</TableHead>
                    <TableHead className="hidden lg:table-cell">Agent</TableHead>
                    <TableHead>Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.overdueTable.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No overdue tickets.</TableCell></TableRow>
                  ) : data.overdueTable.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onFilterTickets?.({ slaFilter: "breached" })}>
                      <TableCell className="font-mono text-xs">{t.ref}</TableCell>
                      <TableCell className="font-medium max-w-[180px] truncate">{t.title}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{TYPE_LABELS[t.type as keyof typeof TYPE_LABELS] ?? t.type}</TableCell>
                      <TableCell className="text-xs">{t.priority.toUpperCase()}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">{t.clientName ?? "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">{t.agentName ?? "Unassigned"}</TableCell>
                      <TableCell>
                        <Badge className={cn(slaBadgeClass("breached"), "text-[10px]")}>{t.overdueHours}h over</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </HelpDeskTableWrap>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
