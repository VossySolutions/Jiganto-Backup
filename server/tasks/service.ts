import { db } from "../db";
import { storage } from "../storage";
import { eq, and, or, inArray, isNull, sql, desc } from "drizzle-orm";
import {
  tasks,
  taskSubtasks,
  taskComments,
  taskTimeLogs,
  taskAttachments,
  type AggregatedTask,
  type TaskSource,
  type TaskStatus,
  type TaskPriority,
  type TaskSummaryCounts,
  taskSourceEnum,
  taskStatusEnum,
} from "@shared/models/tasks";
import { clients } from "@shared/models/clients";
import { pmTasks, pmProjects } from "@shared/models/projects";
import { crmTasks } from "@shared/models/crm";
import { signoffSigners, signoffRequests } from "@shared/models/signoff";
import { timesheetPeriods } from "@shared/models/resources";
import { businessTasks, governanceItems } from "@shared/models/business";
import { users } from "@shared/models/auth";

export interface TaskListFilters {
  source?: string;
  status?: string;
  priority?: string;
  dueDatePreset?: string;
  projectId?: number;
  workspaceId?: number;
  search?: string;
}

export interface TaskScope {
  userId: string;
  tenantId: number;
  platformRole?: string;
  isJigantoStaff?: boolean;
  lockedWorkspaceId?: number | null;
}

const CLOSED_STATUSES = new Set(["completed", "cancelled", "done", "complete"]);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function endOfWeekIso(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function endOfMonthIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

export function normalizeStatus(raw: string | null | undefined): TaskStatus {
  const v = (raw ?? "todo").toLowerCase().replace(/\s+/g, "_");
  if (["completed", "done", "complete"].includes(v)) return "completed";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  if (["in_progress", "in_review", "blocked", "delayed", "at_risk"].includes(v)) return "in_progress";
  return "todo";
}

export function normalizePriority(raw: string | null | undefined): TaskPriority {
  const v = (raw ?? "medium").toLowerCase();
  if (v === "critical" || v === "urgent" || v === "high") return "high";
  if (v === "low") return "low";
  return "medium";
}

function isOverdue(dueDate: string | null | undefined, status: TaskStatus): boolean {
  if (!dueDate || CLOSED_STATUSES.has(status)) return false;
  return dueDate < todayIso();
}

async function getAccessibleWorkspaceIds(scope: TaskScope): Promise<number[] | "all"> {
  if (scope.lockedWorkspaceId != null) return [scope.lockedWorkspaceId];
  const accessible = await storage.getAccessibleClients(scope.userId, scope.tenantId, {
    platformRole: scope.platformRole,
    isJigantoStaff: scope.isJigantoStaff,
  });
  if (accessible.length === 0) return [];
  return accessible.map((c) => c.id);
}

function workspaceAllowed(workspaceId: number | null | undefined, allowed: number[] | "all"): boolean {
  if (allowed === "all") return true;
  if (workspaceId == null) return true;
  return allowed.includes(workspaceId);
}

function parseCompositeId(id: string): { kind: string; ref: string } | null {
  const idx = id.indexOf(":");
  if (idx <= 0) return null;
  return { kind: id.slice(0, idx), ref: id.slice(idx + 1) };
}

export function buildCompositeId(kind: string, ref: string | number): string {
  return `${kind}:${ref}`;
}

async function loadWorkspaceMap(tenantId: number): Promise<Map<number, { name: string; color: string }>> {
  const rows = await db
    .select({ id: clients.id, name: clients.name, color: clients.color })
    .from(clients)
    .where(eq(clients.tenantId, tenantId));
  return new Map(rows.map((r) => [r.id, { name: r.name, color: r.color }]));
}

async function loadSubtaskCounts(nativeIds: number[]): Promise<Map<number, { total: number; done: number }>> {
  if (nativeIds.length === 0) return new Map();
  const rows = await db
    .select({
      taskId: taskSubtasks.taskId,
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${taskSubtasks.isCompleted} = true)::int`,
    })
    .from(taskSubtasks)
    .where(inArray(taskSubtasks.taskId, nativeIds))
    .groupBy(taskSubtasks.taskId);
  return new Map(rows.map((r) => [r.taskId, { total: r.total, done: r.done }]));
}

function applyListFilters(items: AggregatedTask[], filters: TaskListFilters): AggregatedTask[] {
  let result = items;
  const today = todayIso();
  const weekEnd = endOfWeekIso();
  const monthEnd = endOfMonthIso();

  if (filters.source && filters.source !== "all") {
    result = result.filter((t) => t.source === filters.source);
  }
  if (filters.status && filters.status !== "all") {
    if (filters.status === "overdue") {
      result = result.filter((t) => t.isOverdue);
    } else {
      result = result.filter((t) => t.status === filters.status);
    }
  }
  if (filters.priority && filters.priority !== "all") {
    result = result.filter((t) => t.priority === filters.priority);
  }
  if (filters.projectId) {
    result = result.filter((t) => t.projectId === filters.projectId);
  }
  if (filters.workspaceId) {
    result = result.filter((t) => (t.workspaceId ?? null) === filters.workspaceId);
  }
  if (filters.dueDatePreset && filters.dueDatePreset !== "all") {
    result = result.filter((t) => {
      switch (filters.dueDatePreset) {
        case "today":
          return t.dueDate === today;
        case "this_week":
          return t.dueDate != null && t.dueDate >= today && t.dueDate <= weekEnd;
        case "this_month":
          return t.dueDate != null && t.dueDate >= today && t.dueDate <= monthEnd;
        case "overdue":
          return t.isOverdue;
        case "no_due":
          return !t.dueDate;
        default:
          return true;
      }
    });
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.contextLabel ?? "").toLowerCase().includes(q),
    );
  }
  return result;
}

export async function listAggregatedTasks(
  scope: TaskScope,
  filters: TaskListFilters = {},
): Promise<AggregatedTask[]> {
  const allowedWorkspaces = await getAccessibleWorkspaceIds(scope);
  const workspaceMap = await loadWorkspaceMap(scope.tenantId);
  const items: AggregatedTask[] = [];

  const nativeConditions = [
    eq(tasks.tenantId, scope.tenantId),
    eq(tasks.assigneeId, scope.userId),
  ];
  if (allowedWorkspaces !== "all" && allowedWorkspaces.length > 0) {
    nativeConditions.push(
      or(isNull(tasks.clientId), inArray(tasks.clientId, allowedWorkspaces))!,
    );
  } else if (Array.isArray(allowedWorkspaces) && allowedWorkspaces.length === 0) {
    nativeConditions.push(isNull(tasks.clientId));
  }

  const nativeRows = await db
    .select({
      task: tasks,
      assignee: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      },
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(...nativeConditions));

  const nativeIds = nativeRows.map((r) => r.task.id);
  const subtaskCounts = await loadSubtaskCounts(nativeIds);

  for (const row of nativeRows) {
    const t = row.task;
    if (!workspaceAllowed(t.clientId, allowedWorkspaces)) continue;
    if (t.isPersonal && t.creatorId !== scope.userId && t.assigneeId !== scope.userId) continue;
    const status = normalizeStatus(t.status);
    const ws = t.clientId ? workspaceMap.get(t.clientId) : null;
    const sub = subtaskCounts.get(t.id);
    const source = (taskSourceEnum.includes(t.source as TaskSource) ? t.source : "personal") as TaskSource;
    items.push({
      id: buildCompositeId("native", t.id),
      nativeId: t.id,
      title: t.title,
      description: t.description,
      status,
      priority: normalizePriority(t.priority),
      source,
      assigneeId: t.assigneeId,
      assignee: row.assignee?.id ? row.assignee : undefined,
      dueDate: t.dueDate,
      startDate: t.startDate,
      workspaceId: t.clientId,
      workspaceName: ws?.name ?? (t.clientId ? null : "Internal"),
      workspaceColor: ws?.color ?? "#6366f1",
      projectId: t.projectId,
      projectName: null,
      contextLabel: t.projectId ? `Project #${t.projectId}` : ws?.name ?? "Internal",
      contextHref: t.projectId ? `/modules/projects/${t.projectId}` : undefined,
      isPersonal: Boolean(t.isPersonal || source === "personal"),
      isOverdue: isOverdue(t.dueDate, status),
      isReadOnly: false,
      tags: t.tags ?? [],
      subtaskTotal: sub?.total ?? 0,
      subtaskCompleted: sub?.done ?? 0,
      externalKind: "native",
      externalId: t.id,
      createdAt: t.createdAt?.toISOString() ?? null,
      updatedAt: t.updatedAt?.toISOString() ?? null,
    });
  }

  const pmRows = await db
    .select({
      task: pmTasks,
      project: pmProjects,
      assignee: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      },
    })
    .from(pmTasks)
    .innerJoin(pmProjects, eq(pmTasks.projectId, pmProjects.id))
    .leftJoin(users, eq(pmTasks.assigneeId, users.id))
    .where(and(eq(pmTasks.tenantId, scope.tenantId), eq(pmTasks.assigneeId, scope.userId)));

  for (const row of pmRows) {
    if (!workspaceAllowed(row.project.clientId, allowedWorkspaces)) continue;
    const status = normalizeStatus(row.task.status);
    const ws = row.project.clientId ? workspaceMap.get(row.project.clientId) : null;
    items.push({
      id: buildCompositeId("project", row.task.id),
      title: row.task.name,
      description: row.task.description,
      status,
      priority: normalizePriority(row.task.priority),
      source: "project",
      assigneeId: row.task.assigneeId,
      assignee: row.assignee?.id ? row.assignee : undefined,
      dueDate: row.task.plannedEndDate,
      startDate: row.task.plannedStartDate,
      workspaceId: row.project.clientId,
      workspaceName: ws?.name ?? "Internal",
      workspaceColor: ws?.color ?? "#6366f1",
      projectId: row.project.id,
      projectName: row.project.name,
      contextLabel: row.project.name,
      contextHref: `/modules/projects/${row.project.id}`,
      isOverdue: isOverdue(row.task.plannedEndDate, status),
      isReadOnly: false,
      externalKind: "pm",
      externalId: row.task.id,
      createdAt: row.task.createdAt?.toISOString() ?? null,
      updatedAt: row.task.updatedAt?.toISOString() ?? null,
    });
  }

  const teamRows = await db
    .select({
      task: businessTasks,
      assignee: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      },
    })
    .from(businessTasks)
    .leftJoin(users, eq(businessTasks.assigneeId, users.id))
    .where(and(eq(businessTasks.tenantId, scope.tenantId), eq(businessTasks.assigneeId, scope.userId)));

  for (const row of teamRows) {
    const status = normalizeStatus(row.task.status);
    items.push({
      id: buildCompositeId("team", row.task.id),
      title: row.task.title,
      description: row.task.description,
      status,
      priority: normalizePriority(row.task.priority),
      source: "team",
      assigneeId: row.task.assigneeId,
      assignee: row.assignee?.id ? row.assignee : undefined,
      dueDate: row.task.dueDate,
      workspaceId: null,
      workspaceName: "Internal",
      workspaceColor: "#6366f1",
      contextLabel: "Business initiative",
      contextHref: "/modules/business-mgmt",
      isOverdue: isOverdue(row.task.dueDate, status),
      isReadOnly: false,
      externalKind: "business",
      externalId: row.task.id,
    });
  }

  const govRows = await db
    .select()
    .from(governanceItems)
    .where(and(eq(governanceItems.tenantId, scope.tenantId), sql`${governanceItems.actionItems} IS NOT NULL`));

  for (const gov of govRows) {
    if (!workspaceAllowed(gov.clientId, allowedWorkspaces)) continue;
    const actions = gov.actionItems as unknown;
    if (!Array.isArray(actions)) continue;
    actions.forEach((action, index) => {
      if (!action || typeof action !== "object") return;
      const a = action as Record<string, unknown>;
      const assignee = String(a.assigneeId ?? a.assignee ?? a.ownerId ?? "");
      if (assignee && assignee !== scope.userId) return;
      const title = String(a.title ?? a.text ?? a.name ?? "Meeting action");
      const done = Boolean(a.done ?? a.completed ?? a.isDone);
      const ws = gov.clientId ? workspaceMap.get(gov.clientId) : null;
      items.push({
        id: buildCompositeId("meeting", `${gov.id}-${index}`),
        title,
        description: String(a.description ?? ""),
        status: done ? "completed" : "todo",
        priority: normalizePriority(String(a.priority ?? "medium")),
        source: "meeting",
        assigneeId: scope.userId,
        dueDate: a.dueDate ? String(a.dueDate).slice(0, 10) : null,
        workspaceId: gov.clientId,
        workspaceName: ws?.name ?? "Internal",
        workspaceColor: ws?.color ?? "#6366f1",
        contextLabel: gov.title,
        contextHref: "/modules/business-mgmt",
        isOverdue: isOverdue(a.dueDate ? String(a.dueDate).slice(0, 10) : null, done ? "completed" : "todo"),
        isReadOnly: true,
        externalKind: "meeting",
        externalId: `${gov.id}-${index}`,
      });
    });
  }

  const helpdeskRows = await db
    .select({
      task: crmTasks,
      assignee: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      },
    })
    .from(crmTasks)
    .leftJoin(users, eq(crmTasks.assignedToUserId, users.id))
    .where(and(eq(crmTasks.tenantId, scope.tenantId), eq(crmTasks.assignedToUserId, scope.userId)));

  for (const row of helpdeskRows) {
    const status = normalizeStatus(row.task.status === "completed" ? "completed" : row.task.status);
    if (status === "completed") continue;
    items.push({
      id: buildCompositeId("helpdesk", row.task.id),
      title: row.task.subject,
      description: row.task.description,
      status,
      priority: normalizePriority(row.task.priority),
      source: "helpdesk",
      assigneeId: row.task.assignedToUserId,
      assignee: row.assignee?.id ? row.assignee : undefined,
      dueDate: row.task.dueDate ? row.task.dueDate.toISOString().slice(0, 10) : null,
      workspaceId: null,
      workspaceName: "Internal",
      workspaceColor: "#14B8A6",
      contextLabel: "Help desk ticket",
      contextHref: "/modules/help-desk",
      isOverdue: isOverdue(row.task.dueDate ? row.task.dueDate.toISOString().slice(0, 10) : null, status),
      isReadOnly: false,
      externalKind: "crm",
      externalId: row.task.id,
    });
  }

  try {
    const { sdTickets } = await import("@shared/models/service-desk");
    const sdRows = await db
      .select({ ticket: sdTickets, assignee: { id: users.id, firstName: users.firstName, lastName: users.lastName, profileImageUrl: users.profileImageUrl } })
      .from(sdTickets)
      .leftJoin(users, eq(sdTickets.assignedAgentId, users.id))
      .where(
        and(
          eq(sdTickets.tenantId, scope.tenantId),
          eq(sdTickets.assignedAgentId, scope.userId),
          eq(sdTickets.source, "service_desk"),
        ),
      );

    for (const row of sdRows) {
      const closed = ["closed", "resolved", "completed", "answered"].includes(row.ticket.status);
      if (closed) continue;
      const status = normalizeStatus(
        row.ticket.status === "in_progress" ? "in_progress" : row.ticket.status === "pending" ? "in_progress" : "todo",
      );
      items.push({
        id: buildCompositeId("helpdesk", `sd-${row.ticket.id}`),
        title: `${row.ticket.ref}: ${row.ticket.title}`,
        description: null,
        status,
        priority: normalizePriority(row.ticket.priority === "p1" ? "urgent" : row.ticket.priority === "p2" ? "high" : "medium"),
        source: "helpdesk",
        assigneeId: row.ticket.assignedAgentId,
        assignee: row.assignee?.id ? row.assignee : undefined,
        dueDate: row.ticket.slaResolutionDeadline ? row.ticket.slaResolutionDeadline.toISOString().slice(0, 10) : null,
        workspaceId: row.ticket.clientId,
        workspaceName: "Service Desk",
        workspaceColor: "#14B8A6",
        contextLabel: "Service desk ticket",
        contextHref: `/modules/service-desk?ticket=${row.ticket.id}`,
        isOverdue: isOverdue(row.ticket.slaResolutionDeadline ? row.ticket.slaResolutionDeadline.toISOString().slice(0, 10) : null, status),
        isReadOnly: false,
        externalKind: "crm",
        externalId: row.ticket.id,
      });
    }
  } catch (err) {
    console.warn("[tasks] service desk ticket aggregation skipped:", err);
  }

  const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, scope.userId)).limit(1);
  const userEmail = userRow?.email?.toLowerCase() ?? null;

  const signoffRows = await db
    .select({
      signer: signoffSigners,
      request: signoffRequests,
    })
    .from(signoffSigners)
    .innerJoin(signoffRequests, eq(signoffSigners.requestId, signoffRequests.id))
    .where(
      and(
        eq(signoffRequests.tenantId, scope.tenantId),
        inArray(signoffRequests.status, ["pending", "partially_signed"]),
        inArray(signoffSigners.status, ["pending", "notified", "viewed"]),
        or(
          eq(signoffSigners.userId, scope.userId),
          userEmail ? sql`lower(${signoffSigners.email}) = ${userEmail}` : sql`false`,
        ),
      ),
    );

  for (const row of signoffRows) {
    items.push({
      id: buildCompositeId("approval", `signoff-${row.signer.id}`),
      title: `Sign: ${row.request.title}`,
      description: row.request.message,
      status: "todo",
      priority: "high",
      source: "approval",
      assigneeId: scope.userId,
      dueDate: row.request.deadline,
      workspaceId: null,
      workspaceName: "Internal",
      workspaceColor: "#EC4899",
      contextLabel: "E-Sign approval",
      contextHref: `/modules/e-sign?request=${row.request.id}`,
      isOverdue: isOverdue(row.request.deadline, "todo"),
      isReadOnly: true,
      externalKind: "signoff",
      externalId: row.signer.id,
    });
  }

  try {
    const tsRows = await db
      .select()
      .from(timesheetPeriods)
      .where(
        and(
          eq(timesheetPeriods.tenantId, scope.tenantId),
          or(
            eq(timesheetPeriods.approvedByPmId, scope.userId),
            eq(timesheetPeriods.approvedByRmId, scope.userId),
          ),
          inArray(timesheetPeriods.approvalStatus, ["submitted", "pending", "pending_pm", "pending_rm"]),
        ),
      );

    for (const period of tsRows) {
    items.push({
      id: buildCompositeId("approval", `timesheet-${period.id}`),
      title: `Approve timesheet (week of ${period.weekStartDate.toISOString().slice(0, 10)})`,
      description: `${period.totalHours ?? 0} hours submitted`,
      status: "todo",
      priority: "medium",
      source: "approval",
      assigneeId: scope.userId,
      dueDate: period.weekEndDate.toISOString().slice(0, 10),
      workspaceId: null,
      workspaceName: "Internal",
      workspaceColor: "#F97316",
      contextLabel: "Timesheet approval",
      contextHref: "/modules/resource-mgmt?tab=timesheets&timesheetView=approval",
      isOverdue: false,
      isReadOnly: true,
      externalKind: "timesheet",
      externalId: period.id,
    });
    }
  } catch (err) {
    console.warn("[tasks] timesheet approval aggregation skipped:", err);
  }

  return applyListFilters(items, filters);
}

export function summarizeTasks(items: AggregatedTask[]): TaskSummaryCounts {
  const bySource = Object.fromEntries(taskSourceEnum.map((s) => [s, 0])) as Record<TaskSource, number>;
  let todo = 0;
  let inProgress = 0;
  let completed = 0;
  let overdue = 0;
  for (const t of items) {
    bySource[t.source]++;
    if (t.isOverdue) overdue++;
    if (t.status === "todo") todo++;
    else if (t.status === "in_progress") inProgress++;
    else if (t.status === "completed") completed++;
  }
  return { todo, inProgress, completed, overdue, bySource };
}

export async function getAggregatedTask(scope: TaskScope, compositeId: string): Promise<AggregatedTask | null> {
  const all = await listAggregatedTasks(scope, {});
  return all.find((t) => t.id === compositeId) ?? null;
}

export async function updateAggregatedTaskStatus(
  scope: TaskScope,
  compositeId: string,
  status: TaskStatus,
): Promise<AggregatedTask | null> {
  const parsed = parseCompositeId(compositeId);
  if (!parsed) return null;

  if (parsed.kind === "native") {
    const id = Number(parsed.ref);
    await storage.updateTask(id, {
      status,
      completedAt: status === "completed" ? new Date() : null,
    });
    return getAggregatedTask(scope, compositeId);
  }
  if (parsed.kind === "project") {
    const id = Number(parsed.ref);
    const pmStatus = status === "completed" ? "done" : status === "in_progress" ? "in_progress" : "todo";
    await storage.updatePmTask(id, { status: pmStatus });
    return getAggregatedTask(scope, compositeId);
  }
  if (parsed.kind === "helpdesk") {
    const ref = parsed.ref;
    if (ref.startsWith("sd-")) {
      const ticketId = Number(ref.slice(3));
      if (!Number.isFinite(ticketId)) return null;
      const sdStatus = status === "completed" ? "resolved" : status === "in_progress" ? "in_progress" : "pending";
      const { sdTickets } = await import("@shared/schema");
      await db.update(sdTickets).set({ status: sdStatus, updatedAt: new Date() }).where(eq(sdTickets.id, ticketId));
      return getAggregatedTask(scope, compositeId);
    }
    const id = Number(ref);
    if (!Number.isFinite(id)) return null;
    const crmStatus = status === "completed" ? "completed" : status === "in_progress" ? "in_progress" : "pending";
    await db.update(crmTasks).set({ status: crmStatus, updatedAt: new Date() }).where(eq(crmTasks.id, id));
    return getAggregatedTask(scope, compositeId);
  }
  if (parsed.kind === "team") {
    const id = Number(parsed.ref);
    await db.update(businessTasks).set({ status, updatedAt: new Date() }).where(eq(businessTasks.id, id));
    return getAggregatedTask(scope, compositeId);
  }
  return getAggregatedTask(scope, compositeId);
}

export async function updateAggregatedTaskFields(
  scope: TaskScope,
  compositeId: string,
  updates: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string | null;
    startDate: string | null;
    tags: string[];
    assigneeId: string;
  }>,
): Promise<AggregatedTask | null> {
  if (updates.status) {
    const statusUpdated = await updateAggregatedTaskStatus(scope, compositeId, updates.status);
    if (!statusUpdated) return null;
    if (Object.keys(updates).length === 1) return statusUpdated;
  }

  const parsed = parseCompositeId(compositeId);
  if (!parsed) return null;

  if (parsed.kind === "native") {
    const nativeId = Number(parsed.ref);
    await updateNativeTaskFields(scope, nativeId, updates);
    return getAggregatedTask(scope, compositeId);
  }

  if (parsed.kind === "project") {
    const id = Number(parsed.ref);
    const pmUpdates: Record<string, unknown> = {};
    if (updates.priority) pmUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) pmUpdates.plannedEndDate = updates.dueDate;
    if (updates.status) {
      pmUpdates.status =
        updates.status === "completed" ? "done" : updates.status === "in_progress" ? "in_progress" : "todo";
    }
    if (Object.keys(pmUpdates).length > 0) await storage.updatePmTask(id, pmUpdates);
    return getAggregatedTask(scope, compositeId);
  }

  if (parsed.kind === "helpdesk") {
    const id = Number(parsed.ref);
    const crmUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.priority) crmUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) crmUpdates.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    if (updates.status) {
      crmUpdates.status =
        updates.status === "completed" ? "completed" : updates.status === "in_progress" ? "in_progress" : "pending";
    }
    if (Object.keys(crmUpdates).length > 1) {
      await db.update(crmTasks).set(crmUpdates).where(eq(crmTasks.id, id));
    }
    return getAggregatedTask(scope, compositeId);
  }

  if (parsed.kind === "team") {
    const id = Number(parsed.ref);
    const teamUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.priority) teamUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) teamUpdates.dueDate = updates.dueDate;
    if (updates.status) teamUpdates.status = updates.status;
    if (Object.keys(teamUpdates).length > 1) {
      await db.update(businessTasks).set(teamUpdates).where(eq(businessTasks.id, id));
    }
    return getAggregatedTask(scope, compositeId);
  }

  return getAggregatedTask(scope, compositeId);
}

export async function createPersonalTask(
  scope: TaskScope,
  input: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string;
    startDate?: string;
    source?: TaskSource;
    assigneeId?: string;
    clientId?: number;
    projectId?: number;
    tags?: string[];
    isPersonal?: boolean;
  },
) {
  const source = input.source ?? "personal";
  const isPersonal = input.isPersonal ?? source === "personal";
  return storage.createTask({
    tenantId: scope.tenantId,
    title: input.title,
    description: input.description ?? null,
    priority: input.priority ?? "medium",
    status: input.status ?? "todo",
    source,
    assigneeId: input.assigneeId ?? scope.userId,
    creatorId: scope.userId,
    dueDate: input.dueDate ?? null,
    startDate: input.startDate ?? null,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    tags: input.tags ?? null,
    isPersonal,
  });
}

export async function updateNativeTaskFields(
  scope: TaskScope,
  nativeId: number,
  updates: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string | null;
    startDate: string | null;
    tags: string[];
    assigneeId: string;
  }>,
) {
  const existing = await storage.getTask(nativeId);
  if (!existing || existing.tenantId !== scope.tenantId) return null;
  if (existing.isPersonal && existing.creatorId !== scope.userId && existing.assigneeId !== scope.userId) {
    return null;
  }
  return storage.updateTask(nativeId, {
    ...updates,
    completedAt: updates.status === "completed" ? new Date() : undefined,
  });
}

export async function deleteNativeTask(scope: TaskScope, nativeId: number): Promise<boolean> {
  const existing = await storage.getTask(nativeId);
  if (!existing || existing.tenantId !== scope.tenantId) return false;
  if (existing.isPersonal && existing.creatorId !== scope.userId) return false;
  await storage.deleteTask(nativeId);
  return true;
}

export async function getTaskComments(taskId: number) {
  return db
    .select({
      comment: taskComments,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      },
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(taskComments.createdAt);
}

export async function addTaskComment(taskId: number, userId: string, body: string, parentId?: number) {
  const [row] = await db
    .insert(taskComments)
    .values({ taskId, userId, body, parentId: parentId ?? null })
    .returning();
  return row;
}

export async function getTaskTimeLogs(taskId: number) {
  return db.select().from(taskTimeLogs).where(eq(taskTimeLogs.taskId, taskId)).orderBy(desc(taskTimeLogs.loggedAt));
}

export async function addTaskTimeLog(taskId: number, userId: string, hours: number, notes?: string) {
  const [row] = await db
    .insert(taskTimeLogs)
    .values({ taskId, userId, hours: String(hours), notes: notes ?? null })
    .returning();
  return row;
}

export async function getTaskAttachments(taskId: number) {
  return db.select().from(taskAttachments).where(eq(taskAttachments.taskId, taskId)).orderBy(desc(taskAttachments.createdAt));
}

export async function addTaskAttachment(
  taskId: number,
  uploadedBy: string,
  file: { fileName: string; fileUrl: string; fileSize?: number; mimeType?: string },
) {
  const [row] = await db
    .insert(taskAttachments)
    .values({
      taskId,
      uploadedBy,
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      fileSize: file.fileSize ?? null,
      mimeType: file.mimeType ?? null,
    })
    .returning();
  return row;
}

export async function deleteTaskAttachment(id: number) {
  await db.delete(taskAttachments).where(eq(taskAttachments.id, id));
}

export async function listAccessibleWorkspaces(scope: TaskScope) {
  const allowed = await getAccessibleWorkspaceIds(scope);
  if (allowed === "all") {
    return db.select({ id: clients.id, name: clients.name, color: clients.color }).from(clients).where(eq(clients.tenantId, scope.tenantId));
  }
  if (allowed.length === 0) return [];
  return db
    .select({ id: clients.id, name: clients.name, color: clients.color })
    .from(clients)
    .where(and(eq(clients.tenantId, scope.tenantId), inArray(clients.id, allowed)));
}

export async function listAccessibleProjects(scope: TaskScope) {
  const allowed = await getAccessibleWorkspaceIds(scope);
  const conditions = [eq(pmProjects.tenantId, scope.tenantId)];
  if (allowed !== "all") {
    conditions.push(or(isNull(pmProjects.clientId), inArray(pmProjects.clientId, allowed))!);
  }
  return db
    .select({ id: pmProjects.id, name: pmProjects.name, clientId: pmProjects.clientId })
    .from(pmProjects)
    .where(and(...conditions))
    .orderBy(pmProjects.name);
}

export function detectDueDateFromTitle(title: string): string | null {
  const lower = title.toLowerCase();
  const today = new Date();
  if (/\btoday\b/.test(lower)) return today.toISOString().slice(0, 10);
  if (/\btomorrow\b/.test(lower)) {
    today.setDate(today.getDate() + 1);
    return today.toISOString().slice(0, 10);
  }
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i])) {
      const d = new Date();
      const diff = (i - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}
