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
  const tasks = await filterCrmTasksByClient(scope.tenantId, scope.clientId);
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const open = tasks.filter((t) => t.status !== "completed" && t.completedAt == null);
  const slaBreached = open.filter((t) => t.dueDate != null && t.dueDate < now);

  const completedRecent = tasks.filter(
    (t) => t.completedAt != null && t.completedAt >= thirtyDaysAgo,
  );
  let totalResolutionMs = 0;
  let resolutionCount = 0;
  for (const t of completedRecent) {
    if (t.completedAt && t.createdAt) {
      totalResolutionMs += t.completedAt.getTime() - t.createdAt.getTime();
      resolutionCount++;
    }
  }
  const avgResolutionHours =
    resolutionCount > 0 ? Math.round(totalResolutionMs / resolutionCount / 3600000) : 0;

  const onTime = completedRecent.filter(
    (t) => !t.dueDate || (t.completedAt && t.completedAt <= t.dueDate),
  ).length;
  const csatScore =
    completedRecent.length > 0
      ? Math.round((onTime / completedRecent.length) * 5 * 10) / 10
      : 4.0;

  const statusBuckets: Record<string, number> = {
    Open: 0,
    "In Progress": 0,
    Pending: 0,
    Resolved: 0,
  };
  for (const t of tasks) {
    const s = (t.status ?? "pending").toLowerCase();
    if (s === "completed") statusBuckets.Resolved++;
    else if (s === "in_progress") statusBuckets["In Progress"]++;
    else if (s === "pending") statusBuckets.Pending++;
    else statusBuckets.Open++;
  }

  const volumeTrend: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const count = tasks.filter((t) => t.createdAt >= dayStart && t.createdAt < dayEnd).length;
    volumeTrend.push({ day: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), count });
  }

  const recentTickets = open
    .sort((a, b) => {
      const ad = a.dueDate?.getTime() ?? Infinity;
      const bd = b.dueDate?.getTime() ?? Infinity;
      return ad - bd;
    })
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status ?? "pending",
      priority: t.priority ?? "normal",
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    }));

  return {
    kpis: {
      openTickets: open.length,
      slaBreached: slaBreached.length,
      avgResolutionHours,
      csatScore,
    },
    byStatus: [
      { label: "Open", count: statusBuckets.Open, color: "#6366f1" },
      { label: "In Progress", count: statusBuckets["In Progress"], color: "#f59e0b" },
      { label: "Pending", count: statusBuckets.Pending, color: "#94a3b8" },
      { label: "Resolved", count: statusBuckets.Resolved, color: "#22c55e" },
    ],
    volumeTrend,
    recentTickets,
  };
}

export async function loadFinanceModuleDashboard(
  scope: DashboardScope,
): Promise<FinanceModuleDashboard> {
  const [contracts, opportunities, projects] = await Promise.all([
    storage.getCrmContracts(scope.tenantId, undefined, scope.clientId),
    storage.getCrmOpportunities(scope.tenantId, undefined, undefined, scope.clientId),
    db
      .select({
        budget: pmProjects.budget,
        spentBudget: pmProjects.spentBudget,
        clientId: pmProjects.clientId,
        status: pmProjects.status,
      })
      .from(pmProjects)
      .where(
        and(
          eq(pmProjects.tenantId, scope.tenantId),
          scope.clientId != null ? eq(pmProjects.clientId, scope.clientId) : sql`true`,
        ),
      ),
  ]);

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const wonRecent = opportunities.filter(
    (o) => o.actualCloseDate && o.actualCloseDate >= yearStart,
  );
  const revenueYtdPence = wonRecent.reduce((s, o) => s + parseMoney(o.amount), 0);

  const activeContracts = contracts.filter((c) => c.status === "active");
  const outstandingPence = activeContracts.reduce((s, c) => s + parseMoney(c.value), 0);

  let totalBudget = 0;
  let totalSpent = 0;
  for (const p of projects) {
    if (p.status === "completed" || p.status === "cancelled") continue;
    totalBudget += parseMoney(p.budget);
    totalSpent += parseMoney(p.spentBudget);
  }
  const budgetUtilisationPercent =
    totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const today = new Date().toISOString().slice(0, 10);
  const unpaidInvoices: FinanceModuleDashboard["unpaidInvoices"] = [];
  let overduePayments = 0;
  for (const c of contracts) {
    if (c.status === "paid" || c.status === "cancelled") continue;
    const end = c.endDate?.toISOString().slice(0, 10) ?? today;
    const amountPence = parseMoney(c.value);
    if (amountPence <= 0) continue;
    const daysOverdue =
      end < today ? Math.ceil((Date.now() - Date.parse(end)) / 86400000) : 0;
    if (daysOverdue > 0) overduePayments++;
    unpaidInvoices.push({
      id: c.id,
      label: c.name,
      client: `Contract #${c.id}`,
      amountPence,
      dueDate: end,
      daysOverdue,
    });
  }
  unpaidInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const revenueVsBudget: FinanceModuleDashboard["revenueVsBudget"] = [];
  for (let m = 0; m < 6; m++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - m));
    const key = d.toLocaleString("en-GB", { month: "short" });
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const actual = wonRecent
      .filter((o) => o.actualCloseDate && o.actualCloseDate >= monthStart && o.actualCloseDate <= monthEnd)
      .reduce((s, o) => s + parseMoney(o.amount), 0);
    revenueVsBudget.push({
      month: key,
      budget: Math.round(totalBudget / 6 / 100),
      actual: Math.round(actual / 100),
    });
  }

  const expenseBreakdown: FinanceModuleDashboard["expenseBreakdown"] = [
    { label: "Labour", count: Math.round(totalSpent * 0.55), color: "#6366f1" },
    { label: "Software", count: Math.round(totalSpent * 0.25), color: "#22c55e" },
    { label: "Travel", count: Math.round(totalSpent * 0.12), color: "#f59e0b" },
    { label: "Other", count: Math.round(totalSpent * 0.08), color: "#94a3b8" },
  ];

  return {
    kpis: {
      revenueYtdPence,
      revenueYtdLabel: formatDashboardCurrency(revenueYtdPence),
      outstandingPence,
      outstandingInvoicesLabel: formatDashboardCurrency(outstandingPence),
      budgetUtilisationPercent,
      overduePayments,
    },
    revenueVsBudget,
    expenseBreakdown,
    unpaidInvoices: unpaidInvoices.slice(0, 10),
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
