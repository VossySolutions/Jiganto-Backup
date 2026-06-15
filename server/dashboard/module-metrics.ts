import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  crmAccounts,
  crmContracts,
  crmTasks,
  initiatives,
  okrs,
  pmProjects,
  strategyItems,
} from "@shared/schema";
import type {
  BusinessModuleDashboard,
  FinanceModuleDashboard,
  HelpDeskModuleDashboard,
} from "@shared/models/dashboard";
import { formatDashboardCurrency } from "@shared/models/dashboard";
import type { DashboardScope } from "./metrics";

function parseMoney(value: string | null | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function clientAccountIds(tenantId: number, clientId?: number): Promise<Set<number>> {
  if (clientId == null) return Promise.resolve(new Set());
  return db
    .select({ id: crmAccounts.id })
    .from(crmAccounts)
    .where(and(eq(crmAccounts.tenantId, tenantId), eq(crmAccounts.clientId, clientId)))
    .then((rows) => new Set(rows.map((r) => r.id)));
}

async function filterCrmTasksByClient(tenantId: number, clientId?: number) {
  const rows = await db.select().from(crmTasks).where(eq(crmTasks.tenantId, tenantId));
  if (clientId == null) return rows;
  const accountIds = await clientAccountIds(tenantId, clientId);
  return rows.filter((t) => t.accountId != null && accountIds.has(t.accountId));
}

function businessClientFilter(clientId?: number) {
  return clientId != null ? eq(strategyItems.clientId, clientId) : sql`true`;
}

export async function loadHelpDeskModuleDashboard(
  scope: DashboardScope,
): Promise<HelpDeskModuleDashboard> {
  const { loadHelpDeskDashboard } = await import("../help-desk/service");
  const data = await loadHelpDeskDashboard(scope.tenantId, scope.clientId);

  const statusBuckets: Record<string, number> = {
    Open: 0,
    "In Progress": 0,
    Pending: 0,
    Resolved: 0,
  };

  return {
    kpis: {
      openTickets: data.kpis.openTickets,
      slaBreached: data.kpis.slaBreached,
      avgResolutionHours: data.kpis.avgResolutionHours,
      csatScore: data.kpis.csatScore,
    },
    byStatus: [
      { label: "Open", count: statusBuckets.Open, color: "#6366f1" },
      { label: "In Progress", count: statusBuckets["In Progress"], color: "#f59e0b" },
      { label: "Pending", count: statusBuckets.Pending, color: "#8b5cf6" },
      { label: "Resolved", count: statusBuckets.Resolved, color: "#22c55e" },
    ],
    volumeTrend: data.volumeByType.map((v) => ({ day: v.type, count: v.count })),
    recentTickets: data.overdueTable.map((t) => ({
      id: t.id,
      subject: t.title,
      status: t.type,
      priority: t.priority,
      dueDate: t.slaDeadline ? String(t.slaDeadline).slice(0, 10) : null,
    })),
  };
}

export async function loadFinanceModuleDashboard(
  scope: DashboardScope,
): Promise<FinanceModuleDashboard> {
  const { loadFinanceDashboard } = await import("../finance/repository");
  const dash = await loadFinanceDashboard(scope.tenantId, scope.clientId ?? undefined);

  const sym = "£";
  const fmt = (v: number) => `${sym}${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

  const unpaidInvoices: FinanceModuleDashboard["unpaidInvoices"] = dash.invoiceAgeing
    .filter((b) => b.bucket !== "current" && b.count > 0)
    .flatMap((b) =>
      Array.from({ length: Math.min(b.count, 3) }, (_, i) => ({
        id: i,
        label: `Overdue (${b.bucket} days)`,
        client: "—",
        amountPence: Math.round((b.amount / Math.max(b.count, 1)) * 100),
        dueDate: b.bucket,
        daysOverdue: b.bucket === "60+" ? 61 : b.bucket === "31-60" ? 45 : 15,
      })),
    )
    .slice(0, 10);

  const expenseBreakdown: FinanceModuleDashboard["expenseBreakdown"] = [
    { label: "Billable", count: dash.utilisation.billableHours, color: "#22c55e" },
    { label: "Non-Billable", count: dash.utilisation.nonBillableHours, color: "#94a3b8" },
    { label: "Available", count: Math.max(0, dash.utilisation.availableHours - dash.utilisation.billableHours - dash.utilisation.nonBillableHours), color: "#6366f1" },
  ];

  return {
    kpis: {
      revenueYtdPence: Math.round(dash.kpis.totalBilledYtd * 100),
      revenueYtdLabel: fmt(dash.kpis.totalBilledYtd),
      outstandingPence: Math.round(dash.kpis.outstandingInvoices * 100),
      outstandingInvoicesLabel: fmt(dash.kpis.outstandingInvoices),
      budgetUtilisationPercent: dash.kpis.avgProjectMarginPct,
      overduePayments: dash.invoiceAgeing.filter((b) => b.bucket !== "current").reduce((s, b) => s + b.count, 0),
      revenueThisMonth: dash.kpis.revenueThisMonth,
      revenueThisMonthLabel: fmt(dash.kpis.revenueThisMonth),
      totalBilledYtdYoYPct: dash.kpis.totalBilledYtdYoYPct,
      avgProjectMarginPct: dash.kpis.avgProjectMarginPct,
      unapprovedTimesheets: dash.kpis.unapprovedTimesheets,
      unapprovedExpenses: dash.kpis.unapprovedExpenses,
    },
    revenueVsBudget: dash.revenueVsBudget.map((r) => ({
      month: r.month,
      budget: r.budget,
      actual: r.actual,
      isFuture: r.isFuture,
    })),
    expenseBreakdown,
    unpaidInvoices,
    projectFinancialHealth: dash.projectFinancialHealth,
    invoiceAgeing: dash.invoiceAgeing,
    utilisation: dash.utilisation,
  };
}

export async function loadBusinessModuleDashboard(
  scope: DashboardScope,
): Promise<BusinessModuleDashboard> {
  const clientCond = scope.clientId != null ? eq(strategyItems.clientId, scope.clientId) : sql`true`;
  const tenantCond = eq(strategyItems.tenantId, scope.tenantId);

  const [strategies, okrRows, initiativeRows] = await Promise.all([
    db.select().from(strategyItems).where(and(tenantCond, clientCond)),
    db.select().from(okrs).where(eq(okrs.tenantId, scope.tenantId)),
    db
      .select()
      .from(initiatives)
      .where(
        and(
          eq(initiatives.tenantId, scope.tenantId),
          scope.clientId != null ? eq(initiatives.clientId, scope.clientId) : sql`true`,
        ),
      ),
  ]);

  const activeStrategies = strategies.filter(
    (s) => s.status !== "completed" && s.status !== "archived",
  ).length;

  const okrsTotal = okrRows.length || 1;
  const okrsGreen = okrRows.filter((o) => (o.ragStatus ?? "green").toLowerCase() === "green").length;
  const okrsOnTrackPercent = Math.round((okrsGreen / okrsTotal) * 100);

  const today = new Date().toISOString().slice(0, 10);
  const overdueReviews = strategies.filter(
    (s) => s.nextReviewDate != null && s.nextReviewDate < today,
  ).length;

  const progressValues = [
    ...strategies.map((s) => s.progress ?? 0),
    ...initiativeRows.map((i) => i.progress ?? 0),
  ];
  const avgStrategyProgress =
    progressValues.length > 0
      ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length)
      : 0;

  const healthBuckets = { onTrack: 0, atRisk: 0, behind: 0 };
  for (const s of strategies) {
    const rag = (s.ragStatus ?? "green").toLowerCase();
    if (rag === "red") healthBuckets.behind++;
    else if (rag === "amber") healthBuckets.atRisk++;
    else healthBuckets.onTrack++;
  }

  const initiativeProgress = [...initiativeRows]
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
    .slice(0, 10)
    .map((i) => ({ name: i.title, progress: i.progress ?? 0 }));

  const overdueGovernance = strategies
    .filter((s) => s.nextReviewDate != null && s.nextReviewDate < today)
    .slice(0, 10)
    .map((s) => ({
      name: s.title,
      owner: s.ownerName,
      layer: s.templateType ?? "Strategy",
      daysOverdue: Math.ceil((Date.now() - Date.parse(s.nextReviewDate!)) / 86400000),
    }));

  return {
    kpis: {
      activeStrategies,
      okrsOnTrackPercent,
      overdueReviews,
      avgStrategyProgress,
    },
    strategyHealth: [
      { label: "On Track", count: healthBuckets.onTrack, color: "#22c55e" },
      { label: "At Risk", count: healthBuckets.atRisk, color: "#f59e0b" },
      { label: "Behind", count: healthBuckets.behind, color: "#ef4444" },
    ],
    initiativeProgress,
    overdueGovernance,
  };
}

export async function loadDashboardBriefing(scope: DashboardScope) {
  const { loadKpiStrip, loadTasksModuleDashboard } = await import("./metrics");
  const [kpi, tasks] = await Promise.all([
    loadKpiStrip(scope),
    loadTasksModuleDashboard(scope),
  ]);

  const healthScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        kpi.atRisk * 4 -
        kpi.critical * 8 -
        (tasks.kpis.overdue > 0 ? 10 : 0),
    ),
  );

  const items: import("@shared/models/dashboard").DashboardBriefingItem[] = [];
  if (kpi.critical > 0) {
    items.push({
      id: "critical",
      title: `${kpi.critical} critical items need attention`,
      detail: "Review overdue and red-status work across modules.",
      severity: "critical",
      href: kpi.links.critical,
    });
  }
  if (kpi.atRisk > 0) {
    items.push({
      id: "at-risk",
      title: `${kpi.atRisk} items at risk`,
      detail: "Amber RAG status detected on active projects.",
      severity: "warn",
      href: kpi.links.atRisk,
    });
  }
  if (tasks.kpis.overdue > 0) {
    items.push({
      id: "overdue-tasks",
      title: `${tasks.kpis.overdue} overdue tasks`,
      detail: "Tasks past due date and not completed.",
      severity: "warn",
      href: "/modules/tasks",
    });
  }
  if (items.length === 0) {
    items.push({
      id: "all-clear",
      title: "Platform health looks good",
      detail: `${kpi.activeItems} active items tracked across your workspace.`,
      severity: "info",
    });
  }

  return {
    healthScore,
    healthLabel: healthScore >= 80 ? "Healthy" : healthScore >= 60 ? "Watch" : "At risk",
    items: items.slice(0, 5),
  };
}
