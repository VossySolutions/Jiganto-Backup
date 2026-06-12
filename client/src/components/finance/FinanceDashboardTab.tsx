import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertTriangle, Clock, Percent, Receipt } from "lucide-react";
import { FinanceKpiSkeleton, FinanceChartSkeleton, FinanceEmptyState, FinanceErrorState } from "./FinanceUi";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import type { FinanceDashboardData } from "./types";

function formatMoney(value: number, currency = "GBP"): string {
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${sym}${(value / 1_000).toFixed(0)}K`;
  return `${sym}${value.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface FinanceDashboardTabProps {
  data?: FinanceDashboardData;
  isLoading?: boolean;
  searchTerm?: string;
  onNavigateTab?: (tab: string) => void;
}

export function FinanceDashboardTab({ data: dataProp, isLoading: isLoadingProp, searchTerm, onNavigateTab }: FinanceDashboardTabProps) {
  const { data: fetched, isLoading: fetchLoading, isError, refetch } = useQuery<FinanceDashboardData>({
    queryKey: ["/api/finance/dashboard"],
    enabled: dataProp === undefined,
  });

  const data = dataProp ?? fetched;
  const isLoading = isLoadingProp ?? fetchLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6" data-testid="finance-dashboard-loading">
        <FinanceKpiSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <FinanceChartSkeleton />
          <FinanceChartSkeleton />
          <FinanceChartSkeleton />
          <FinanceChartSkeleton />
        </div>
      </div>
    );
  }

  if (isError) {
    return <FinanceErrorState message="Failed to load finance dashboard" onRetry={() => refetch()} />;
  }

  if (!data) {
    return (
      <div data-testid="finance-dashboard-empty">
        <FinanceEmptyState
          icon={DollarSign}
          title="No finance dashboard data"
          description="Dashboard metrics will appear once budgets, invoices, and timesheets are recorded."
        />
      </div>
    );
  }

  const { kpis } = data;
  const kpiCards = [
    {
      title: "Revenue (Month)",
      value: formatMoney(kpis.revenueThisMonth),
      subtitle: "Invoiced this month",
      icon: DollarSign,
      color: "#10B981",
      testId: "kpi-revenue-month",
    },
    {
      title: "Outstanding",
      value: formatMoney(kpis.outstandingInvoices),
      subtitle: "Unpaid invoice balance",
      icon: TrendingUp,
      color: "#0ea5e9",
      testId: "kpi-outstanding",
    },
    {
      title: "Billed YTD",
      value: formatMoney(kpis.totalBilledYtd),
      subtitle: `${kpis.totalBilledYtdYoYPct >= 0 ? "+" : ""}${kpis.totalBilledYtdYoYPct}% vs last year`,
      icon: TrendingUp,
      color: "#8b5cf6",
      testId: "kpi-billed-ytd",
    },
    {
      title: "Avg Margin",
      value: `${kpis.avgProjectMarginPct}%`,
      subtitle: "Across active projects",
      icon: Percent,
      color: "#f59e0b",
      testId: "kpi-margin",
    },
    {
      title: "Unapproved Timesheets",
      value: String(kpis.unapprovedTimesheets),
      subtitle: "Awaiting approval",
      icon: Clock,
      color: "#6366f1",
      testId: "kpi-timesheets",
    },
    {
      title: "Unapproved Expenses",
      value: String(kpis.unapprovedExpenses),
      subtitle: "Pending review",
      icon: Receipt,
      color: "#ef4444",
      testId: "kpi-expenses",
    },
  ];

  const utilisationData = [
    { label: "Billable", value: data.utilisation.billableHours, color: "#10B981" },
    { label: "Non-billable", value: data.utilisation.nonBillableHours, color: "#94a3b8" },
    { label: "Available", value: Math.max(0, data.utilisation.availableHours - data.utilisation.billableHours - data.utilisation.nonBillableHours), color: "#e2e8f0" },
  ].filter((d) => d.value > 0);

  const healthChart = data.projectFinancialHealth.map((p) => ({
    name: p.projectName.length > 14 ? `${p.projectName.slice(0, 12)}…` : p.projectName,
    margin: p.marginPct,
    budget: p.budget,
    actual: p.actualCost,
  }));

  const filteredAgeing = searchTerm
    ? data.invoiceAgeing.filter((b) => b.bucket.toLowerCase().includes(searchTerm.toLowerCase()))
    : data.invoiceAgeing;

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="finance-dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {kpiCards.map((kpi) => (
          <Card
            key={kpi.testId}
            className={`rounded-xl border-border/50 overflow-hidden ${(kpi.testId === "kpi-timesheets" || kpi.testId === "kpi-expenses") && onNavigateTab ? "cursor-pointer hover:border-emerald-500/50" : ""}`}
            data-testid={kpi.testId}
            onClick={() => {
              if (kpi.testId === "kpi-timesheets") onNavigateTab?.("timesheets");
              if (kpi.testId === "kpi-expenses") onNavigateTab?.("expenses");
            }}
          >
            <div className="h-1" style={{ backgroundColor: kpi.color }} />
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{kpi.title}</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums">{kpi.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.subtitle}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50 shrink-0">
                  <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="rounded-xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenue vs Budget</CardTitle>
          </CardHeader>
          <CardContent className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <BarChart data={data.revenueVsBudget}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Legend />
                <Bar dataKey="budget" fill="#94a3b8" name="Budget" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="#10B981" name="Actual" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Project Financial Health</CardTitle>
          </CardHeader>
          <CardContent className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Bar dataKey="margin" fill="#8b5cf6" name="Margin %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Invoice Ageing
            </CardTitle>
          </CardHeader>
          <CardContent className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredAgeing} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="bucket" width={70} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Bar dataKey="amount" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Utilisation ({data.utilisation.pct}%)</CardTitle>
          </CardHeader>
          <CardContent className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={utilisationData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {utilisationData.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
