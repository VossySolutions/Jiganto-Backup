import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { resources } from "@shared/models/resources";
import { pmProjects } from "@shared/models/projects";
import { sdTicketTimeLogs, sdTickets } from "@shared/models/service-desk";
import {
  createTimesheetPeriod,
  listTimesheetPeriods,
  upsertTimesheetEntry,
} from "../finance/repository";

function getMonday(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function dayOfWeekIso(dateStr: string): number {
  const js = new Date(dateStr).getDay();
  return js === 0 ? 7 : js;
}

async function getOrCreatePeriodForWeek(
  tenantId: number,
  resourceId: number,
  logDate: string,
) {
  const weekStart = getMonday(logDate);
  const periods = await listTimesheetPeriods(tenantId, { resourceId });
  const existing = periods.find(
    (p) => new Date(p.weekStartDate).toISOString().slice(0, 10) === weekStart,
  );
  if (existing) return existing;
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return createTimesheetPeriod(tenantId, {
    resourceId,
    weekStartDate: weekStart,
    weekEndDate: end.toISOString().slice(0, 10),
  });
}

export async function syncTicketTimeLogToFinance(
  tenantId: number,
  timeLogId: number,
): Promise<{ synced: boolean; entryId?: number; reason?: string }> {
  const [row] = await db
    .select({ log: sdTicketTimeLogs, ticket: sdTickets })
    .from(sdTicketTimeLogs)
    .innerJoin(sdTickets, eq(sdTicketTimeLogs.ticketId, sdTickets.id))
    .where(and(eq(sdTicketTimeLogs.id, timeLogId), eq(sdTickets.tenantId, tenantId)));

  if (!row) return { synced: false, reason: "Time log not found" };
  if (row.log.financeTimesheetEntryId) {
    return { synced: true, entryId: row.log.financeTimesheetEntryId, reason: "Already synced" };
  }
  if (!row.ticket.projectId) {
    return { synced: false, reason: "Ticket has no linked project" };
  }

  const [resource] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.tenantId, tenantId), eq(resources.userId, row.log.agentId)))
    .limit(1);

  if (!resource) {
    return { synced: false, reason: "No resource record for agent — link user in Resources module" };
  }

  const logDate = String(row.log.logDate);
  const period = await getOrCreatePeriodForWeek(tenantId, resource.id, logDate);

  let projectName: string | null = null;
  if (row.ticket.projectId) {
    const [proj] = await db
      .select({ name: pmProjects.name })
      .from(pmProjects)
      .where(eq(pmProjects.id, row.ticket.projectId))
      .limit(1);
    projectName = proj?.name ?? null;
  }

  const entry = await upsertTimesheetEntry(tenantId, period.id, {
    resourceId: resource.id,
    projectId: row.ticket.projectId,
    projectName,
    dayOfWeek: dayOfWeekIso(logDate),
    hours: row.log.hours,
    activityType: row.log.isBillable ? "billable" : "non_billable",
    role: "Service Desk",
    description: `[${row.ticket.ref}] ${row.log.description ?? row.ticket.title}`,
  });

  if (!entry) {
    return { synced: false, reason: "Timesheet period is not in draft status" };
  }

  await db
    .update(sdTicketTimeLogs)
    .set({ financeTimesheetEntryId: entry.id })
    .where(eq(sdTicketTimeLogs.id, timeLogId));

  return { synced: true, entryId: entry.id };
}

export async function syncAllUnlinkedBillableTime(tenantId: number) {
  const rows = await db
    .select({ logId: sdTicketTimeLogs.id })
    .from(sdTicketTimeLogs)
    .innerJoin(sdTickets, eq(sdTicketTimeLogs.ticketId, sdTickets.id))
    .where(
      and(
        eq(sdTickets.tenantId, tenantId),
        eq(sdTicketTimeLogs.isBillable, true),
        isNull(sdTicketTimeLogs.financeTimesheetEntryId),
      ),
    );

  const results = [];
  for (const { logId } of rows) {
    results.push({ logId, ...(await syncTicketTimeLogToFinance(tenantId, logId)) });
  }
  return {
    total: results.length,
    synced: results.filter((r) => r.synced && r.reason !== "Already synced").length,
    skipped: results.filter((r) => !r.synced).length,
    results,
  };
}
