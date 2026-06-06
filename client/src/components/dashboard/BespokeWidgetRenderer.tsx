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
import { DashboardKpiStrip } from "./DashboardKpiStrip";

type Widget = BespokeDashboardPayload["widgets"][number];

function scopeQuery(base: string, clientId?: number | null, projectId?: number | null) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", String(clientId));
  if (projectId) params.set("projectId", String(projectId));
  const q = params.toString();
  return q ? `${base}?${q}` : base;
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
      <Card className="rounded-xl border-border/50 h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Note</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{text || "Add a note in widget settings."}</CardContent>
      </Card>
    );
  }

  const url = scopeQuery(`/api/dashboard-data/${widget.widgetType}`, clientId, projectId);
  const { data, isLoading } = useQuery({
    queryKey: [url, widget.widgetType],
    queryFn: async () => {
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("Failed to load widget");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-full min-h-[160px] rounded-xl" />;

  return (
    <Card className="rounded-xl border-border/50 h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm capitalize">{widget.widgetType.replace(/_/g, " ")}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
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
    const rows = d.dueSoon as { id: number; title: string; dueDate: string | null; priority: string }[];
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
            <TableRow key={t.id}>
              <TableCell>{t.title}</TableCell>
              <TableCell>{t.dueDate ?? "—"}</TableCell>
              <TableCell className="capitalize">{t.priority}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={d.initiativeProgress as { name: string; progress: number }[]} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 100]} />
          <YAxis type="category" dataKey="name" width={90} />
          <Tooltip />
          <Bar dataKey="progress" fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return <p className="text-sm text-muted-foreground">No preview for this widget.</p>;
}
