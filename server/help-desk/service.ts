import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { clients } from "@shared/models/clients";
import { users } from "@shared/schema";
import {
  hdMaintenanceWindows,
  hdSlaContractedHours,
  sdTicketTimeLogs,
  sdTickets,
} from "@shared/models/service-desk";
import * as sd from "../service-desk/service";

export async function loadHelpDeskDashboard(tenantId: number, clientId?: number | null) {
  const tickets = await sd.listTickets(tenantId, { source: "help_desk", clientId: clientId ?? undefined });
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const open = tickets.filter((t) => !["closed", "resolved", "completed", "answered", "fixed", "wont_fix"].includes(t.status));
  const breached = open.filter((t) => t.slaState.resolution === "breached");
  const openDefects = open.filter((t) => t.type === "defect").length;

  const resolvedRecent = tickets.filter((t) => t.resolvedAt && t.resolvedAt >= thirtyDaysAgo);
  let totalMs = 0;
  let count = 0;
  for (const t of resolvedRecent) {
    if (t.resolvedAt && t.createdAt) {
      totalMs += new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
      count++;
    }
  }
  const avgResolutionHours = count > 0 ? Math.round(totalMs / count / 3600000) : 0;

  const closedWithCsat = tickets.filter(
    (t) => t.closedAt && t.closedAt >= thirtyDaysAgo && t.csatScore != null,
  );
  const csatScore =
    closedWithCsat.length > 0
      ? Math.round((closedWithCsat.reduce((s, t) => s + (t.csatScore ?? 0), 0) / closedWithCsat.length) * 10) / 10
      : 0;

  const timeLogs = await db
    .select({ hours: sdTicketTimeLogs.hours, logDate: sdTicketTimeLogs.logDate, ticketId: sdTicketTimeLogs.ticketId })
    .from(sdTicketTimeLogs)
    .innerJoin(sdTickets, eq(sdTicketTimeLogs.ticketId, sdTickets.id))
    .where(and(eq(sdTickets.tenantId, tenantId), eq(sdTickets.source, "help_desk"), gte(sdTicketTimeLogs.logDate, monthStart.toISOString().slice(0, 10))));

  const billableHoursThisMonth = timeLogs
    .filter((l) => l.logDate >= monthStart.toISOString().slice(0, 10))
    .reduce((s, l) => s + Number(l.hours), 0);

  const byType: Record<string, number> = { incident: 0, service_request: 0, change_request: 0, question: 0, defect: 0 };
  const recent30 = tickets.filter((t) => new Date(t.createdAt) >= thirtyDaysAgo);
  for (const t of recent30) {
    byType[t.type] = (byType[t.type] ?? 0) + 1;
  }

  const resolutionTrend: { week: string; hours: number }[] = [];
  for (let w = 11; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekTickets = tickets.filter(
      (t) => t.resolvedAt && new Date(t.resolvedAt) >= weekStart && new Date(t.resolvedAt) < weekEnd,
    );
    let ms = 0;
    let c = 0;
    for (const t of weekTickets) {
      if (t.resolvedAt && t.createdAt) {
        ms += new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
        c++;
      }
    }
    resolutionTrend.push({
      week: weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      hours: c > 0 ? Math.round(ms / c / 3600000) : 0,
    });
  }

  const csatTrend: { month: string; score: number }[] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const monthTickets = tickets.filter(
      (t) => t.closedAt && new Date(t.closedAt) >= d && new Date(t.closedAt) <= end && t.csatScore != null,
    );
    csatTrend.push({
      month: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      score: monthTickets.length
        ? Math.round((monthTickets.reduce((s, t) => s + (t.csatScore ?? 0), 0) / monthTickets.length) * 10) / 10
        : 0,
    });
  }

  const overdueTable = breached
    .slice(0, 20)
    .map((t) => ({
      id: t.id,
      ref: t.ref,
      title: t.title,
      type: t.type,
      priority: t.priority,
      clientName: t.clientName,
      agentName: t.agentName,
      slaDeadline: t.effectiveResolutionDeadline,
      overdueHours: t.effectiveResolutionDeadline
        ? Math.max(0, Math.round((now.getTime() - new Date(t.effectiveResolutionDeadline).getTime()) / 3600000))
        : 0,
    }));

  return {
    kpis: {
      openTickets: open.length,
      slaBreached: breached.length,
      avgResolutionHours,
      csatScore,
      openDefects,
      billableHoursThisMonth: Math.round(billableHoursThisMonth * 10) / 10,
    },
    volumeByType: Object.entries(byType).map(([type, countVal]) => ({ type, count: countVal })),
    resolutionTrend,
    csatTrend,
    overdueTable,
  };
}

export async function listContractedHours(tenantId: number) {
  return db.select().from(hdSlaContractedHours).where(eq(hdSlaContractedHours.tenantId, tenantId));
}

export async function upsertContractedHours(
  tenantId: number,
  data: {
    id?: number;
    clientId?: number | null;
    monthlyHours: number;
    overageRate?: number;
    currency?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
  },
) {
  if (data.id) {
    const [row] = await db
      .update(hdSlaContractedHours)
      .set({
        clientId: data.clientId,
        monthlyHours: String(data.monthlyHours),
        overageRate: data.overageRate != null ? String(data.overageRate) : null,
        currency: data.currency,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
      })
      .where(and(eq(hdSlaContractedHours.id, data.id), eq(hdSlaContractedHours.tenantId, tenantId)))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(hdSlaContractedHours)
    .values({
      tenantId,
      clientId: data.clientId ?? null,
      monthlyHours: String(data.monthlyHours),
      overageRate: data.overageRate != null ? String(data.overageRate) : null,
      currency: data.currency ?? "GBP",
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo,
    })
    .returning();
  return row;
}

export async function getContractedHoursUsage(tenantId: number, clientId?: number | null) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const contracts = await db
    .select()
    .from(hdSlaContractedHours)
    .where(
      clientId
        ? and(eq(hdSlaContractedHours.tenantId, tenantId), eq(hdSlaContractedHours.clientId, clientId))
        : eq(hdSlaContractedHours.tenantId, tenantId),
    );

  const results = [];
  for (const c of contracts) {
    const logs = await db
      .select({ hours: sdTicketTimeLogs.hours })
      .from(sdTicketTimeLogs)
      .innerJoin(sdTickets, eq(sdTicketTimeLogs.ticketId, sdTickets.id))
      .where(
        and(
          eq(sdTickets.tenantId, tenantId),
          eq(sdTickets.source, "help_desk"),
          c.clientId ? eq(sdTickets.clientId, c.clientId) : sql`true`,
          gte(sdTicketTimeLogs.logDate, monthStart),
          eq(sdTicketTimeLogs.isBillable, true),
        ),
      );
    const used = logs.reduce((s, l) => s + Number(l.hours), 0);
    const contracted = Number(c.monthlyHours);
    results.push({
      contract: c,
      usedHours: used,
      contractedHours: contracted,
      pctUsed: contracted > 0 ? Math.round((used / contracted) * 100) : 0,
      alertAt80: contracted > 0 && used / contracted >= 0.8,
      overageHours: Math.max(0, used - contracted),
    });
  }
  return results;
}

export async function listMaintenanceWindows(tenantId: number) {
  return db
    .select()
    .from(hdMaintenanceWindows)
    .where(eq(hdMaintenanceWindows.tenantId, tenantId))
    .orderBy(desc(hdMaintenanceWindows.startAt));
}

export async function upsertMaintenanceWindow(
  tenantId: number,
  data: { id?: number; clientId?: number | null; name: string; startAt: string; endAt: string },
) {
  if (data.id) {
    const [row] = await db
      .update(hdMaintenanceWindows)
      .set({
        clientId: data.clientId,
        name: data.name,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
      })
      .where(and(eq(hdMaintenanceWindows.id, data.id), eq(hdMaintenanceWindows.tenantId, tenantId)))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(hdMaintenanceWindows)
    .values({
      tenantId,
      clientId: data.clientId ?? null,
      name: data.name,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
    })
    .returning();
  return row;
}

export async function deleteMaintenanceWindow(tenantId: number, id: number) {
  await db.delete(hdMaintenanceWindows).where(and(eq(hdMaintenanceWindows.id, id), eq(hdMaintenanceWindows.tenantId, tenantId)));
}

/** Notify admins when contracted hours reach 80% usage. */
export async function checkContractedHoursAlerts(tenantId: number): Promise<void> {
  const usage = await getContractedHoursUsage(tenantId);
  const alerts = usage.filter((u) => u.alertAt80);
  if (!alerts.length) return;

  try {
    const { notifyUser } = await import("../lib/user-notify");
    const { orgMemberships } = await import("@shared/models/permissions");
    const admins = await db
      .select({ userId: orgMemberships.userId })
      .from(orgMemberships)
      .where(and(eq(orgMemberships.orgId, tenantId), eq(orgMemberships.platformRole, "si_super_admin")))
      .limit(5);

    for (const u of alerts) {
      const msg = `Client #${u.contract.clientId ?? "All"}: ${u.usedHours.toFixed(1)}h of ${u.contractedHours}h used (${u.pctUsed}%)`;
      for (const admin of admins) {
        await notifyUser({
          userId: admin.userId,
          tenantId,
          title: "Contracted support hours at 80%+",
          message: msg,
          type: "alert",
          source: "help-desk",
          category: "helpDesk",
        });
      }
    }
  } catch (err) {
    console.warn("[help-desk] contracted hours alert skipped:", err);
  }
}

export async function getHelpDeskReports(tenantId: number, clientId?: number | null, periodDays = 30) {
  void checkContractedHoursAlerts(tenantId);
  const since = new Date();
  since.setDate(since.getDate() - periodDays);
  const tickets = await sd.listTickets(tenantId, { source: "help_desk", clientId: clientId ?? undefined });
  const periodTickets = tickets.filter((t) => new Date(t.createdAt) >= since);

  const slaPerformance = {
    total: periodTickets.filter((t) => ["closed", "resolved", "fixed", "completed"].includes(t.status)).length,
    within: periodTickets.filter((t) => t.slaState.resolution === "within").length,
    byType: {} as Record<string, { total: number; within: number }>,
  };
  for (const t of periodTickets) {
    if (!slaPerformance.byType[t.type]) slaPerformance.byType[t.type] = { total: 0, within: 0 };
    if (["closed", "resolved", "fixed"].includes(t.status)) {
      slaPerformance.byType[t.type].total++;
      if (t.slaState.resolution === "within") slaPerformance.byType[t.type].within++;
    }
  }

  const volumeByStatus: Record<string, number> = {};
  for (const t of periodTickets) {
    volumeByStatus[t.status] = (volumeByStatus[t.status] ?? 0) + 1;
  }

  const defects = periodTickets.filter((t) => t.type === "defect");
  const defectAnalysis = {
    byPhase: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    total: defects.length,
  };
  for (const d of defects) {
    const phase = (d as { sprintPhase?: string }).sprintPhase ?? "Unassigned";
    const sev = (d as { defectSeverity?: string }).defectSeverity ?? "medium";
    defectAnalysis.byPhase[phase] = (defectAnalysis.byPhase[phase] ?? 0) + 1;
    defectAnalysis.bySeverity[sev] = (defectAnalysis.bySeverity[sev] ?? 0) + 1;
    defectAnalysis.byStatus[d.status] = (defectAnalysis.byStatus[d.status] ?? 0) + 1;
  }

  const agentMap: Record<string, { resolved: number; totalMs: number; csatSum: number; csatCount: number }> = {};
  for (const t of periodTickets) {
    const agent = t.agentName ?? "Unassigned";
    if (!agentMap[agent]) agentMap[agent] = { resolved: 0, totalMs: 0, csatSum: 0, csatCount: 0 };
    if (["closed", "resolved", "fixed"].includes(t.status)) {
      agentMap[agent].resolved++;
      if (t.resolvedAt && t.createdAt) {
        agentMap[agent].totalMs += new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
      }
    }
    if (t.csatScore != null) {
      agentMap[agent].csatSum += t.csatScore;
      agentMap[agent].csatCount++;
    }
  }
  const agentPerformance = Object.entries(agentMap).map(([agent, v]) => ({
    agent,
    resolved: v.resolved,
    avgResolutionHours: v.resolved > 0 ? Math.round(v.totalMs / v.resolved / 3600000) : 0,
    csatScore: v.csatCount > 0 ? Math.round((v.csatSum / v.csatCount) * 10) / 10 : null,
  }));

  const hdTickets = await sd.listTickets(tenantId, { source: "help_desk", clientId: clientId ?? undefined });
  const hdTicketIds = new Set(hdTickets.map((t) => t.id));
  const timeBillingAll = await sd.getTimeAnalysisReport(tenantId, clientId ?? undefined);
  const timeBilling = {
    ...timeBillingAll,
    rows: timeBillingAll.rows.filter((r) => hdTicketIds.has(r.ticketId)),
    totalHours: timeBillingAll.rows.filter((r) => hdTicketIds.has(r.ticketId)).reduce((s, r) => s + r.hours, 0),
    totalBillable: timeBillingAll.rows.filter((r) => hdTicketIds.has(r.ticketId)).reduce((s, r) => s + r.amount, 0),
  };

  const clientRows = await db.select().from(clients).where(eq(clients.tenantId, tenantId));
  const clientSummaries = [];
  for (const cl of clientRows) {
    if (clientId && cl.id !== clientId) continue;
    const ct = tickets.filter((t) => t.clientId === cl.id);
    const open = ct.filter((t) => !["closed", "fixed", "wont_fix"].includes(t.status)).length;
    const usage = await getContractedHoursUsage(tenantId, cl.id);
    clientSummaries.push({
      clientId: cl.id,
      clientName: cl.name,
      openTickets: open,
      slaCompliancePct: ct.length
        ? Math.round((ct.filter((t) => t.slaState.resolution === "within").length / ct.length) * 100)
        : 100,
      avgResolutionHours: loadHelpDeskDashboard(tenantId, cl.id).then((d) => d.kpis.avgResolutionHours),
      hoursUsed: usage[0]?.usedHours ?? 0,
      hoursContracted: usage[0]?.contractedHours ?? 0,
    });
  }

  const summariesResolved = await Promise.all(
    clientSummaries.map(async (s) => ({
      ...s,
      avgResolutionHours: (await s.avgResolutionHours) as number,
    })),
  );

  return {
    slaPerformance,
    volume: { byStatus: volumeByStatus, byType: slaPerformance.byType, total: periodTickets.length },
    defectAnalysis,
    agentPerformance,
    timeBilling,
    clientSummaries: summariesResolved,
  };
}

export async function listProjectTickets(tenantId: number, projectId: number) {
  return sd.listTickets(tenantId, { source: "help_desk" }).then((rows) =>
    rows.filter((t) => t.projectId === projectId),
  );
}
