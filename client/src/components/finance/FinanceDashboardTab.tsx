import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/ui/metric-card";
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
    staleTime: 30_000,
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
      helpText: "Total value of invoices issued in the current calendar month.",
      icon: DollarSign,
      borderColor: "#10B981",
      testId: "kpi-revenue-month",
    },
    {
      title: "Outstanding",
      value: formatMoney(kpis.outstandingInvoices),
      subtitle: "Unpaid invoice balance",
      helpText: "Sum of all invoice amounts not yet marked as paid.",
      icon: TrendingUp,
      borderColor: "#0ea5e9",
      testId: "kpi-outstanding",
    },
    {
      title: "Billed YTD",
      value: formatMoney(kpis.totalBilledYtd),
      subtitle: `${kpis.totalBilledYtdYoYPct >= 0 ? "+" : ""}${kpis.totalBilledYtdYoYPct}% vs last year`,
      helpText: "Year-to-date invoiced amount compared to the same period last year.",
      icon: TrendingUp,
      borderColor: "#8b5cf6",
      testId: "kpi-billed-ytd",
    },
    {
      title: "Avg Margin",
      value: `${kpis.avgProjectMarginPct}%`,
      subtitle: "Across active projects",
      helpText: "Average profit margin (revenue minus cost) across active projects.",
      icon: Percent,
      borderColor: "#f59e0b",
      testId: "kpi-margin",
    },
    {
      title: "Unapproved Timesheets",
      value: String(kpis.unapprovedTimesheets),
      subtitle: "Awaiting approval",
      helpText: "Timesheet submissions pending manager or PM approval. Click to review.",
      icon: Clock,
      borderColor: "#6366f1",
      testId: "kpi-timesheets",
      onClick: onNavigateTab ? () => onNavigateTab("timesheets") : undefined,
    },
    {
      title: "Unapproved Expenses",
      value: String(kpis.unapprovedExpenses),
      subtitle: "Pending review",
      helpText: "Expense reports submitted but not yet approved. Click to review.",
      icon: Receipt,
      borderColor: "#ef4444",
      testId: "kpi-expenses",
      onClick: onNavigateTab ? () => onNavigateTab("expenses") : undefined,
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
          <MetricCard
            key={kpi.testId}
            title={kpi.title}
            value={kpi.value}
            subtitle={kpi.subtitle}
            helpText={kpi.helpText}
            icon={kpi.icon}
            borderColor={kpi.borderColor}
            onClick={kpi.onClick}
            className="border-border/50"
            testId={kpi.testId}
          />
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
