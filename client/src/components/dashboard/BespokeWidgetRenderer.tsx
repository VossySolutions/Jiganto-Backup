import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchWithAuth } from "@/lib/queryClient";
import type { BespokeDashboardPayload } from "@shared/models/dashboard";
import { DASHBOARD_WIDGET_CATALOG } from "@shared/models/dashboard";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SI_DASHBOARD_MODULES, siModuleLabel } from "@/lib/workspace-nav-filter";
import { DashboardKpiStrip } from "./DashboardKpiStrip";
import { CategoryBarChart } from "./CategoryBarChart";
import { scopeQuery } from "./dashboard-utils";

type Widget = BespokeDashboardPayload["widgets"][number];

function widgetDisplayName(type: string): string {
  return DASHBOARD_WIDGET_CATALOG.find((w) => w.type === type)?.name ?? type.replace(/_/g, " ");
}

function KpiCards({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((k) => (
        <div key={k.label} className="rounded-lg border border-border/50 p-3">
          <div className="text-lg font-bold">{k.value}</div>
          <div className="text-xs text-muted-foreground">{k.label}</div>
        </div>
      ))}
    </div>
  );
}

export function BespokeWidgetRenderer({
  widget,
  clientId,
  projectId,
}: {
  widget: Widget;
  clientId?: number | null;
  projectId?: number | null;
}) {
  if (widget.widgetType === "kpi_strip") {
    return <DashboardKpiStrip clientId={clientId} projectId={projectId} />;
  }

  if (widget.widgetType === "text_note") {
    const text = String((widget.config as { text?: string }).text ?? "");
    return (
      <Card className="rounded-xl border-border/50 h-full shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{widgetDisplayName("text_note")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{text || "Add a note in widget settings."}</CardContent>
      </Card>
    );
  }

  return <BespokeDataWidget widget={widget} clientId={clientId} projectId={projectId} />;
}

function BespokeDataWidget({
  widget,
  clientId,
  projectId,
}: {
  widget: Widget;
  clientId?: number | null;
  projectId?: number | null;
}) {
  const url = scopeQuery(`/api/dashboard-data/${widget.widgetType}`, clientId, projectId);
  const { data, isLoading, isError } = useQuery({
    queryKey: [url, widget.widgetType],
    queryFn: async () => {
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("Failed to load widget");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-full min-h-[160px] rounded-xl" />;

  if (isError) {
    return (
      <Card className="rounded-xl border-destructive/30 h-full min-h-[160px] flex items-center justify-center">
        <CardContent className="text-center py-6 text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5 mx-auto mb-2 text-destructive/70" />
          Could not load widget
        </CardContent>
      </Card>
    );
  }

  const catalogEntry = DASHBOARD_WIDGET_CATALOG.find((w) => w.type === widget.widgetType);
  const fromSiModule = catalogEntry && SI_DASHBOARD_MODULES.has(catalogEntry.module);

  return (
    <Card className="rounded-xl border-border/50 h-full flex flex-col shadow-sm">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-sm">{widgetDisplayName(widget.widgetType)}</CardTitle>
          {fromSiModule && (
            <Badge variant="outline" className="text-[10px] font-normal">
              Data from {siModuleLabel(catalogEntry!.module)} module
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto">
        <WidgetBody type={widget.widgetType} data={data} />
      </CardContent>
    </Card>
  );
}

function WidgetBody({ type, data }: { type: string; data: unknown }) {
  const d = data as Record<string, unknown>;

  if (type === "projects_kpi" && d.kpis) {
    const k = d.kpis as Record<string, string | number>;
    return (
      <KpiCards
        items={[
          { label: "Active", value: k.activeProjects ?? 0 },
          { label: "At risk", value: k.atRiskBehind ?? 0 },
          { label: "Portfolio", value: k.portfolioValueLabel ?? "—" },
          { label: "Milestones (30d)", value: k.milestonesDue ?? 0 },
        ]}
      />
    );
  }

  if (type === "projects_health" && Array.isArray(d.healthDistribution)) {
    return (
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={d.healthDistribution as { label: string; count: number; color: string }[]} dataKey="count" nameKey="label" innerRadius={40} outerRadius={70}>
            {(d.healthDistribution as { label: string; color: string }[]).map((e) => (
              <Cell key={e.label} fill={e.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "projects_table" && Array.isArray(d.activeProjects)) {
    const rows = d.activeProjects as { id: number; name: string; progress: number; health: string }[];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Health</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 6).map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell>{p.progress}%</TableCell>
              <TableCell className="capitalize">{p.health}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (type === "tasks_kpi" && d.kpis) {
    const k = d.kpis as Record<string, number>;
    return (
      <KpiCards
        items={[
          { label: "My open", value: k.myOpenTasks ?? 0 },
          { label: "Overdue", value: k.overdue ?? 0 },
          { label: "Done this week", value: k.completedThisWeek ?? 0 },
          { label: "Team open", value: k.teamOpenTasks ?? 0 },
        ]}
      />
    );
  }

  if (type === "tasks_due" && Array.isArray(d.dueSoon)) {
    const rows = d.dueSoon as { id: number | string; title: string; dueDate: string | null; priority: string }[];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Priority</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 6).map((t) => (
            <TableRow key={String(t.id)} className="cursor-pointer hover:bg-muted/40" onClick={() => { window.location.href = `/modules/tasks?status=overdue`; }}>
              <TableCell>{t.title}</TableCell>
              <TableCell>{t.dueDate ?? "—"}</TableCell>
              <TableCell className="capitalize">{t.priority}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (type === "my_tasks_summary" && d.kpis) {
    const k = d.kpis as Record<string, number>;
    const bySource = (d.bySource as { source: string; count: number }[] | undefined) ?? [];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "To Do", value: k.myOpenTasks ?? 0, href: "/modules/tasks?status=todo" },
            { label: "Overdue", value: k.overdue ?? 0, href: "/modules/tasks?status=overdue" },
            { label: "Done (week)", value: k.completedThisWeek ?? 0, href: "/modules/tasks?status=completed" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-lg border border-border/50 p-2 hover:bg-muted/40 transition-colors"
            >
              <div className="text-lg font-bold">{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </a>
          ))}
        </div>
        <div className="space-y-1">
          {bySource.filter((s) => s.count > 0).slice(0, 5).map((s) => (
            <a
              key={s.source}
              href={`/modules/tasks?source=${s.source}`}
              className="flex justify-between text-sm hover:text-primary"
            >
              <span className="capitalize">{s.source}</span>
              <span>{s.count}</span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  if (type === "crm_pipeline" && Array.isArray(d.pipelineByStage)) {
    return (
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={d.pipelineByStage as { name: string; value: number }[]} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" width={80} />
          <Tooltip />
          <Bar dataKey="value" fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "crm_hot" && Array.isArray(d.hotOpportunities)) {
    const rows = d.hotOpportunities as { id: number; name: string; amount: number }[];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Opportunity</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 6).map((o) => (
            <TableRow key={o.id}>
              <TableCell>{o.name}</TableCell>
              <TableCell>£{o.amount.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (type === "helpdesk_kpi" && d.kpis) {
    const k = d.kpis as Record<string, number>;
    return (
      <KpiCards
        items={[
          { label: "Open", value: k.openTickets ?? 0 },
          { label: "SLA breached", value: k.slaBreached ?? 0 },
          { label: "Avg resolution (h)", value: k.avgResolutionHours ?? 0 },
          { label: "CSAT", value: (k.csatScore ?? 0).toFixed(1) },
        ]}
      />
    );
  }

  if (type === "helpdesk_volume" && Array.isArray(d.volumeTrend)) {
    return (
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={(d.volumeTrend as { day: string; count: number }[]).slice(-14)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" hide />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "finance_kpi" && d.kpis) {
    const k = d.kpis as Record<string, string | number>;
    return (
      <KpiCards
        items={[
          { label: "Revenue YTD", value: k.revenueYtdLabel ?? "—" },
          { label: "Outstanding", value: k.outstandingInvoicesLabel ?? "—" },
          { label: "Budget use", value: `${k.budgetUtilisationPercent ?? 0}%` },
          { label: "Overdue", value: k.overduePayments ?? 0 },
        ]}
      />
    );
  }

  if (type === "finance_revenue" && Array.isArray(d.revenueVsBudget)) {
    return (
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={d.revenueVsBudget as { month: string; budget: number; actual: number }[]}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="budget" fill="#94a3b8" name="Budget" />
          <Bar dataKey="actual" fill="#22c55e" name="Actual" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "business_kpi" && d.kpis) {
    const k = d.kpis as Record<string, number>;
    return (
      <KpiCards
        items={[
          { label: "Strategies", value: k.activeStrategies ?? 0 },
          { label: "OKRs on track", value: `${k.okrsOnTrackPercent ?? 0}%` },
          { label: "Overdue reviews", value: k.overdueReviews ?? 0 },
          { label: "Avg progress", value: `${k.avgStrategyProgress ?? 0}%` },
        ]}
      />
    );
  }

  if (type === "business_initiatives" && Array.isArray(d.initiativeProgress)) {
    return (
      <CategoryBarChart
        data={d.initiativeProgress as { name: string; progress: number }[]}
      />
    );
  }

  return <p className="text-sm text-muted-foreground">No preview for this widget.</p>;
}
