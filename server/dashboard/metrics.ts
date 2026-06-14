import { and, count, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  clientUsers,
  crmAccounts,
  crmTasks,
  orgMemberships,
  pmMilestones,
  pmProjects,
  pmTasks,
  tasks,
  users,
} from "@shared/schema";
import type {
  CrmModuleDashboard,
  DashboardKpiStrip,
  DashboardProjectRow,
  ProjectsModuleDashboard,
  TasksModuleDashboard,
} from "@shared/models/dashboard";
import { formatDashboardCurrency } from "@shared/models/dashboard";

const CLOSED_PROJECT_STATUSES = ["completed", "cancelled", "closed", "archived"];
const CLOSED_TASK_STATUSES = ["done", "cancelled", "completed"];
const ACTIVE_PROJECT_STATUSES = ["active", "in_progress", "planning", "on_track", "draft"];

function normalizeRag(rag: string | null | undefined): string {
  return (rag ?? "green").toLowerCase();
}

function isAtRiskRag(rag: string | null | undefined): boolean {
  const r = normalizeRag(rag);
  return r === "amber" || r === "yellow";
}

function isCriticalRag(rag: string | null | undefined): boolean {
  return normalizeRag(rag) === "red";
}

function parseBudget(value: string | null | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function weeksAgoLabels(weeks: number): string[] {
  const labels: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    labels.push(`W${weeks - i}`);
  }
  return labels;
}

export interface DashboardScope {
  tenantId: number;
  clientId?: number;
  projectId?: number;
  userId: string;
}

function projectScopeConditions(scope: DashboardScope) {
  const conditions = [eq(pmProjects.tenantId, scope.tenantId)];
  if (scope.clientId != null) conditions.push(eq(pmProjects.clientId, scope.clientId));
  if (scope.projectId != null) conditions.push(eq(pmProjects.id, scope.projectId));
  return conditions;
}

function taskScopeConditions(scope: DashboardScope) {
  const conditions = [eq(tasks.tenantId, scope.tenantId)];
  if (scope.clientId != null) conditions.push(eq(tasks.clientId, scope.clientId));
  return conditions;
}

export async function loadKpiStrip(scope: DashboardScope): Promise<DashboardKpiStrip> {
  const projectWhere = and(...projectScopeConditions(scope));
  const taskWhere = and(...taskScopeConditions(scope));

  const [projectRows, taskRows, pmTaskRows, teamRow] = await Promise.all([
    db
      .select({
        status: pmProjects.status,
        ragStatus: pmProjects.ragStatus,
        budget: pmProjects.budget,
        endDate: pmProjects.endDate,
      })
      .from(pmProjects)
      .where(projectWhere),
    db
      .select({
        status: tasks.status,
        dueDate: tasks.dueDate,
        ragStatus: sql<string | null>`null`,
      })
      .from(tasks)
      .where(taskWhere),
    db
      .select({
        status: pmTasks.status,
        plannedEndDate: pmTasks.plannedEndDate,
      })
      .from(pmTasks)
      .innerJoin(pmProjects, eq(pmTasks.projectId, pmProjects.id))
      .where(projectWhere),
    scope.clientId != null
      ? db
          .select({ count: count() })
          .from(clientUsers)
          .where(and(eq(clientUsers.clientId, scope.clientId), eq(clientUsers.tenantId, scope.tenantId)))
      : db
          .select({ count: count() })
          .from(orgMemberships)
          .where(and(eq(orgMemberships.orgId, scope.tenantId), eq(orgMemberships.isActive, true))),
  ]);

  const today = todayIso();
  const openProjects = projectRows.filter(
    (p) => p.status && !CLOSED_PROJECT_STATUSES.includes(p.status.toLowerCase()),
  );
  const openTasks = taskRows.filter(
    (t) => t.status && !CLOSED_TASK_STATUSES.includes(t.status.toLowerCase()),
  );
  const openPmTasks = pmTaskRows.filter(
    (t) => t.status && !CLOSED_TASK_STATUSES.includes((t.status ?? "").toLowerCase()),
  );

  const atRiskProjects = openProjects.filter((p) => isAtRiskRag(p.ragStatus)).length;
  const criticalProjects = openProjects.filter((p) => isCriticalRag(p.ragStatus)).length;
  const overdueTasks = [...taskRows, ...pmTaskRows].filter((t) => {
    const status = ("status" in t ? t.status : null) ?? "";
    if (CLOSED_TASK_STATUSES.includes(status.toLowerCase())) return false;
    const due = "dueDate" in t ? t.dueDate : "plannedEndDate" in t ? t.plannedEndDate : null;
    return due != null && due < today;
  }).length;

  const portfolioBudgetPence = openProjects.reduce((sum, p) => sum + parseBudget(p.budget), 0);

  const clientQuery = scope.clientId != null ? `&clientId=${scope.clientId}` : "";
  const projectQuery = scope.projectId != null ? `&projectId=${scope.projectId}` : "";

  return {
    activeItems: openProjects.length + openTasks.length + openPmTasks.length,
    atRisk: atRiskProjects,
    critical: criticalProjects + overdueTasks,
    portfolioBudgetPence,
    portfolioBudgetLabel: formatDashboardCurrency(portfolioBudgetPence),
    teamMembers: teamRow[0]?.count ?? 0,
    links: {
      activeItems: `/modules/projects?status=active${clientQuery}${projectQuery}`,
      atRisk: `/modules/projects?rag=amber${clientQuery}${projectQuery}`,
      critical: `/modules/projects?rag=red${clientQuery}${projectQuery}`,
      portfolioBudget: `/modules/portfolio${clientQuery}`,
      teamMembers: `/settings/system${clientQuery}`,
    },
  };
}

export async function loadProjectsModuleDashboard(
  scope: DashboardScope,
): Promise<ProjectsModuleDashboard> {
  const where = and(...projectScopeConditions(scope));
  const today = todayIso();
  const in30 = daysFromNow(30);

  const [projects, milestones, ownerRows] = await Promise.all([
    db
      .select({
        id: pmProjects.id,
        name: pmProjects.name,
        status: pmProjects.status,
        ragStatus: pmProjects.ragStatus,
        progress: pmProjects.progress,
        budget: pmProjects.budget,
        endDate: pmProjects.endDate,
        startDate: pmProjects.startDate,
        customer: pmProjects.customer,
        managerId: pmProjects.managerId,
        updatedAt: pmProjects.updatedAt,
      })
      .from(pmProjects)
      .where(where)
      .orderBy(desc(pmProjects.updatedAt))
      .limit(50),
    db
      .select({ id: pmMilestones.id })
      .from(pmMilestones)
      .innerJoin(pmProjects, eq(pmMilestones.projectId, pmProjects.id))
      .where(
        and(
          where,
          ne(pmMilestones.status, "completed"),
          gte(pmMilestones.dueDate, today),
          lte(pmMilestones.dueDate, in30),
        ),
      ),
    db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users),
  ]);

  const ownerMap = new Map(
    ownerRows.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(" ") || null]),
  );

  const active = projects.filter(
    (p) =>
      p.status &&
      (ACTIVE_PROJECT_STATUSES.includes(p.status.toLowerCase()) ||
        !CLOSED_PROJECT_STATUSES.includes(p.status.toLowerCase())),
  );

  const healthBuckets = {
    onTrack: 0,
    atRisk: 0,
    behind: 0,
    completed: 0,
  };
  for (const p of projects) {
    const rag = normalizeRag(p.ragStatus);
    if (CLOSED_PROJECT_STATUSES.includes((p.status ?? "").toLowerCase())) healthBuckets.completed++;
    else if (rag === "red") healthBuckets.behind++;
    else if (rag === "amber" || rag === "yellow") healthBuckets.atRisk++;
    else healthBuckets.onTrack++;
  }

  const portfolioValuePence = active.reduce((sum, p) => sum + parseBudget(p.budget), 0);

  const activeProjects: DashboardProjectRow[] = active.slice(0, 10).map((p) => ({
    id: p.id,
    name: p.name,
    customer: p.customer,
    lead: p.managerId ? ownerMap.get(p.managerId) ?? null : null,
    progress: p.progress ?? 0,
    health: normalizeRag(p.ragStatus),
    dueDate: p.endDate,
  }));

  return {
    kpis: {
      activeProjects: active.length,
      atRiskBehind: projects.filter(
        (p) => isAtRiskRag(p.ragStatus) || isCriticalRag(p.ragStatus),
      ).length,
      portfolioValuePence,
      portfolioValueLabel: formatDashboardCurrency(portfolioValuePence),
      milestonesDue: milestones.length,
    },
    healthDistribution: [
      { label: "On Track", count: healthBuckets.onTrack, color: "#22c55e" },
      { label: "At Risk", count: healthBuckets.atRisk, color: "#f59e0b" },
      { label: "Behind", count: healthBuckets.behind, color: "#ef4444" },
      { label: "Completed", count: healthBuckets.completed, color: "#6366f1" },
    ],
    timeline: active.slice(0, 8).map((p) => ({
      id: p.id,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      health: normalizeRag(p.ragStatus),
    })),
    activeProjects,
  };
}

export async function loadTasksModuleDashboard(scope: DashboardScope): Promise<TasksModuleDashboard> {
  const { listAggregatedTasks, summarizeTasks } = await import("../tasks/service");
  const taskScope = {
    userId: scope.userId,
    tenantId: scope.tenantId,
  };
  const items = await listAggregatedTasks(taskScope, scope.clientId != null ? { workspaceId: scope.clientId } : {});
  const summary = summarizeTasks(items);
  const open = items.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const completedWeek = items.filter((t) => t.status === "completed").length;

  const priorityCounts = { high: 0, medium: 0, low: 0 };
  for (const t of open) {
    if (t.priority === "high") priorityCounts.high++;
    else if (t.priority === "low") priorityCounts.low++;
    else priorityCounts.medium++;
  }

  const weekLabels = weeksAgoLabels(4);
  const byStatus = weekLabels.map((week, idx) => {
    const start = new Date();
    start.setDate(start.getDate() - (3 - idx) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const inWeek = items.filter((t) => {
      if (!t.createdAt) return false;
      const d = new Date(t.createdAt);
      return d >= start && d < end;
    });
    return {
      week,
      todo: inWeek.filter((t) => t.status === "todo").length,
      inProgress: inWeek.filter((t) => t.status === "in_progress").length,
      done: inWeek.filter((t) => t.status === "completed").length,
    };
  });

  const dueSoon = open
    .filter((t) => t.dueDate != null)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate ?? null,
      priority: t.priority,
      status: t.status,
    }));

  return {
    kpis: {
      myOpenTasks: summary.todo + summary.inProgress,
      overdue: summary.overdue,
      completedThisWeek: completedWeek,
      teamOpenTasks: open.length,
    },
    byStatus,
    byPriority: [
      { label: "High", count: priorityCounts.high, color: "#ef4444" },
      { label: "Medium", count: priorityCounts.medium, color: "#f59e0b" },
      { label: "Low", count: priorityCounts.low, color: "#22c55e" },
    ],
    bySource: Object.entries(summary.bySource).map(([source, count]) => ({ source, count })),
    dueSoon,
  };
}

export async function loadCrmModuleDashboard(scope: DashboardScope): Promise<CrmModuleDashboard> {
  const [opportunities, stages, crmTaskRows] = await Promise.all([
    storage.getCrmOpportunities(scope.tenantId, undefined, undefined, scope.clientId),
    storage.getCrmOpportunityStages(scope.tenantId),
    db
      .select({ dueDate: crmTasks.dueDate, status: crmTasks.status, accountId: crmTasks.accountId })
      .from(crmTasks)
      .where(eq(crmTasks.tenantId, scope.tenantId)),
  ]);

  let filteredTasks = crmTaskRows;
  if (scope.clientId != null) {
    const accountRows = await db
      .select({ id: crmAccounts.id })
      .from(crmAccounts)
      .where(and(eq(crmAccounts.tenantId, scope.tenantId), eq(crmAccounts.clientId, scope.clientId)));
    const accountIds = new Set(accountRows.map((a) => a.id));
    filteredTasks = crmTaskRows.filter((t) => t.accountId != null && accountIds.has(t.accountId));
  }

  const openStages = stages.filter((s) => !s.isClosed);
  const wonStages = stages.filter((s) => s.isWon);
  const lostStages = stages.filter((s) => s.isClosed && !s.isWon);
  const openOpps = opportunities.filter((o) => openStages.some((s) => s.id === o.stageId));

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const recentWon = opportunities.filter(
    (o) => wonStages.some((s) => s.id === o.stageId) && o.updatedAt && o.updatedAt >= ninetyDaysAgo,
  );
  const recentLost = opportunities.filter(
    (o) => lostStages.some((s) => s.id === o.stageId) && o.updatedAt && o.updatedAt >= ninetyDaysAgo,
  );
  const closedRecent = recentWon.length + recentLost.length;
  const winRate90d = closedRecent > 0 ? Math.round((recentWon.length / closedRecent) * 100) : 0;

  const now = new Date();
  const overdueFollowUps = filteredTasks.filter(
    (t) =>
      t.status !== "completed" &&
      t.dueDate != null &&
      t.dueDate < now,
  ).length;

  const pipelineValue = openOpps.reduce(
    (sum, o) => sum + (parseFloat(o.amount ?? "0") || 0),
    0,
  );

  const pipelineByStage = openStages.map((stage) => {
    const stageOpps = openOpps.filter((o) => o.stageId === stage.id);
    return {
      name: stage.name,
      value: stageOpps.reduce((sum, o) => sum + (parseFloat(o.amount ?? "0") || 0), 0),
      count: stageOpps.length,
      color: stage.color ?? "#6366f1",
    };
  });

  const revenueForecast: { month: string; value: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    const key = d.toLocaleString("en-GB", { month: "short", year: "2-digit" });
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const value = openOpps
      .filter(
        (o) =>
          o.expectedCloseDate &&
          o.expectedCloseDate >= monthStart &&
          o.expectedCloseDate <= monthEnd,
      )
      .reduce((sum, o) => sum + (parseFloat(o.amount ?? "0") || 0), 0);
    revenueForecast.push({ month: key, value });
  }

  const hotOpportunities = [...openOpps]
    .sort((a, b) => (parseFloat(b.amount ?? "0") || 0) - (parseFloat(a.amount ?? "0") || 0))
    .slice(0, 10)
    .map((o) => ({
      id: o.id,
      name: o.name,
      owner: o.ownerUserId,
      amount: parseFloat(o.amount ?? "0") || 0,
      closeDate: o.expectedCloseDate ? o.expectedCloseDate.toISOString().slice(0, 10) : null,
    }));

  return {
    kpis: {
      pipelineValue,
      pipelineLabel: formatDashboardCurrency(Math.round(pipelineValue * 100), "£"),
      openOpportunities: openOpps.length,
      winRate90d,
      overdueFollowUps,
    },
    pipelineByStage,
    revenueForecast,
    hotOpportunities,
  };
}

export async function loadScopedProjects(scope: DashboardScope) {
  const where = and(...projectScopeConditions(scope));
  return db
    .select({ id: pmProjects.id, name: pmProjects.name, clientId: pmProjects.clientId })
    .from(pmProjects)
    .where(where)
    .orderBy(pmProjects.name);
}
