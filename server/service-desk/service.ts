import {
  and,
  asc,
  desc,
  eq,
  inArray,
  sql
} from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  sdSettings,
  sdServiceCategories,
  sdServices,
  sdServiceSlas,
  sdAgentTeams,
  sdAgentTeamMembers,
  sdRoutingRules,
  sdSlaConfigs,
  sdTickets,
  sdTicketComments,
  sdTicketAttachments,
  sdTicketTimeLogs,
  sdTicketStatusHistory,
  sdCabReviews,
  sdCabMembers,
  DEFAULT_INCIDENT_SLA_HOURS,
  DEFAULT_DEFECT_SLA_HOURS,
  type TicketType,
  type TicketPriority,
  type TicketSource,
  CHANGE_STATUSES,
  INCIDENT_STATUSES,
  SERVICE_REQUEST_STATUSES,
  QUESTION_STATUSES,
} from "@shared/models/service-desk";
import { users, tenants } from "@shared/schema";
import { clients } from "@shared/models/clients";
import { businessMsBetween } from "../lib/business-calendar";
import { addBusinessHours, slaStateForTicket, effectiveResolutionDeadline } from "./sla";

export type TicketFilters = {
  source?: TicketSource;
  type?: TicketType | "all";
  priority?: TicketPriority | "all";
  status?: string | "all";
  slaFilter?: "all" | "at_risk" | "breached" | "within";
  agentFilter?: "all" | "me" | "unassigned";
  clientId?: number | null;
  projectId?: number | null;
  /** Skip per-ticket maintenance SLA lookups (faster dashboards). */
  lightweight?: boolean;
  search?: string;
  view?: "list" | "calendar";
  userId?: string;
};

const VALID_TRANSITIONS: Record<TicketType, Record<string, string[]>> = {
  incident: {
    open: ["assigned", "in_progress"],
    assigned: ["in_progress", "pending"],
    in_progress: ["pending", "resolved"],
    pending: ["in_progress", "resolved"],
    resolved: ["closed", "in_progress"],
    closed: [],
  },
  service_request: {
    open: ["assigned", "in_progress"],
    assigned: ["in_progress", "pending"],
    in_progress: ["pending", "completed"],
    pending: ["in_progress", "completed"],
    completed: ["closed"],
    closed: [],
  },
  change_request: {
    draft: ["submitted"],
    submitted: ["under_review"],
    under_review: ["cab_approved", "cab_rejected", "draft"],
    cab_approved: ["scheduled"],
    cab_rejected: ["draft"],
    scheduled: ["implementing"],
    implementing: ["implemented"],
    implemented: ["closed"],
    closed: [],
  },
  question: {
    open: ["assigned"],
    assigned: ["answered"],
    answered: ["closed"],
    closed: [],
  },
  defect: {
    open: ["assigned", "in_progress"],
    assigned: ["in_progress"],
    in_progress: ["fix_ready", "wont_fix"],
    fix_ready: ["retesting"],
    retesting: ["fixed", "open"],
    fixed: ["closed"],
    wont_fix: ["closed"],
    closed: [],
  },
};

export async function getOrCreateSettings(tenantId: number) {
  const [existing] = await db.select().from(sdSettings).where(eq(sdSettings.tenantId, tenantId));
  if (existing) return existing;
  const [created] = await db.insert(sdSettings).values({ tenantId }).returning();
  return created;
}

async function nextTicketRef(tenantId: number, source: TicketSource): Promise<string> {
  const settings = await getOrCreateSettings(tenantId);
  const isSd = source === "service_desk";
  const prefix = isSd ? settings.sdRefPrefix : settings.hdRefPrefix;
  const num = isSd ? settings.nextSdNumber : settings.nextHdNumber;
  const ref = `${prefix}-${String(num).padStart(4, "0")}`;
  await db
    .update(sdSettings)
    .set({
      nextSdNumber: isSd ? num + 1 : settings.nextSdNumber,
      nextHdNumber: !isSd ? num + 1 : settings.nextHdNumber,
      updatedAt: new Date(),
    })
    .where(eq(sdSettings.tenantId, tenantId));
  return ref;
}

export async function resolveSlaHours(
  tenantId: number,
  priority: TicketPriority,
  serviceId?: number | null,
  clientId?: number | null,
  ticketType?: TicketType,
): Promise<{ response: number; resolution: number }> {
  if (clientId) {
    const [override] = await db
      .select()
      .from(sdSlaConfigs)
      .where(and(eq(sdSlaConfigs.tenantId, tenantId), eq(sdSlaConfigs.clientId, clientId), eq(sdSlaConfigs.priority, priority)));
    if (override) {
      return {
        response: Number(override.responseHours),
        resolution: Number(override.resolutionHours),
      };
    }
  }
  if (serviceId) {
    const [svcSla] = await db
      .select()
      .from(sdServiceSlas)
      .where(and(eq(sdServiceSlas.serviceId, serviceId), eq(sdServiceSlas.priority, priority)));
    if (svcSla) {
      return {
        response: Number(svcSla.responseHours),
        resolution: Number(svcSla.resolutionHours),
      };
    }
  }
  if (ticketType === "defect") return DEFAULT_DEFECT_SLA_HOURS[priority];
  return DEFAULT_INCIDENT_SLA_HOURS[priority];
}

function canTransition(type: TicketType, from: string, to: string): boolean {
  const map = VALID_TRANSITIONS[type];
  return (map?.[from] ?? []).includes(to);
}

async function applyRouting(tenantId: number, ticket: {
  type: string;
  priority: string;
  title: string;
  serviceId?: number | null;
  category?: string | null;
  clientId?: number | null;
}): Promise<{ teamId?: number; agentId?: string; priority?: string; tags?: string[] }> {
  const rules = await db
    .select()
    .from(sdRoutingRules)
    .where(and(eq(sdRoutingRules.tenantId, tenantId), eq(sdRoutingRules.isActive, true)))
    .orderBy(asc(sdRoutingRules.sortOrder));

  for (const rule of rules) {
    const cond = (rule.conditions ?? {}) as Record<string, unknown>;
    const actions = (rule.actions ?? {}) as Record<string, unknown>;
    let match = true;
    if (cond.ticketType && cond.ticketType !== ticket.type) match = false;
    if (cond.priority && cond.priority !== ticket.priority) match = false;
    if (cond.serviceId && cond.serviceId !== ticket.serviceId) match = false;
    if (cond.category && cond.category !== ticket.category) match = false;
    if (cond.clientId && cond.clientId !== ticket.clientId) match = false;
    if (cond.keyword && typeof cond.keyword === "string") {
      if (!ticket.title.toLowerCase().includes(cond.keyword.toLowerCase())) match = false;
    }
    if (!match) continue;

    const result: { teamId?: number; agentId?: string; priority?: string; tags?: string[] } = {};
    if (actions.assignTeamId) result.teamId = Number(actions.assignTeamId);
    if (actions.assignAgentId) result.agentId = String(actions.assignAgentId);
    if (actions.setPriority) result.priority = String(actions.setPriority);
    if (actions.addTag) result.tags = [String(actions.addTag)];

    if (result.teamId && !result.agentId) {
      const [team] = await db.select().from(sdAgentTeams).where(eq(sdAgentTeams.id, result.teamId));
      if (team?.roundRobinEnabled) {
        const members = await db
          .select()
          .from(sdAgentTeamMembers)
          .where(eq(sdAgentTeamMembers.teamId, team.id));
        if (members.length > 0) {
          const idx = team.roundRobinIndex ?? 0;
          result.agentId = members[idx % members.length].userId;
          await db
            .update(sdAgentTeams)
            .set({ roundRobinIndex: (idx + 1) % members.length })
            .where(eq(sdAgentTeams.id, team.id));
        }
      }
    }
    return result;
  }

  const settings = await getOrCreateSettings(tenantId);
  if (settings.defaultTeamId) return { teamId: settings.defaultTeamId };
  return {};
}

export async function createTicket(
  tenantId: number,
  userId: string,
  data: {
    source?: TicketSource;
    title: string;
    type: TicketType;
    priority?: TicketPriority;
    description?: unknown;
    category?: string;
    serviceId?: number;
    customFields?: Record<string, unknown>;
    clientId?: number | null;
    projectId?: number | null;
    assignedTeamId?: number;
    changeJustification?: string;
    changeRiskAssessment?: string;
    changeRollbackPlan?: string;
    changeImplementationDate?: string;
    reporterEmail?: string;
    reporterId?: string | null;
    linkedTestCaseId?: number | null;
    linkedTestResultId?: number | null;
    sprintPhase?: string;
    defectSeverity?: string;
    defectStepsToReproduce?: string;
    defectExpectedResult?: string;
    defectActualResult?: string;
    defectEnvironment?: string;
    defectBuildVersion?: string;
    defectWorkaround?: string;
    defectFixVersion?: string;
  },
) {
  const source = data.source ?? "service_desk";
  const priority = data.priority ?? "p3";
  const tenant = await storage.getTenant(tenantId);
  const ref = await nextTicketRef(tenantId, source);

  let assignedTeamId = data.assignedTeamId;
  let assignedAgentId: string | undefined;
  let tags: string[] = [];

  if (data.serviceId) {
    const [svc] = await db.select().from(sdServices).where(eq(sdServices.id, data.serviceId));
    if (svc?.ownerTeamId) assignedTeamId = svc.ownerTeamId;
  }

  const routing = await applyRouting(tenantId, {
    type: data.type,
    priority,
    title: data.title,
    serviceId: data.serviceId,
    category: data.category,
    clientId: data.clientId,
  });
  if (routing.teamId) assignedTeamId = routing.teamId;
  if (routing.agentId) assignedAgentId = routing.agentId;
  if (routing.tags) tags = routing.tags;

  const slaHours = data.type === "question"
    ? null
    : await resolveSlaHours(tenantId, priority, data.serviceId, data.clientId, data.type);

  const now = new Date();
  let slaResponseDeadline: Date | null = null;
  let slaResolutionDeadline: Date | null = null;
  if (slaHours) {
    slaResponseDeadline = addBusinessHours(now, slaHours.response, tenant);
    slaResolutionDeadline = addBusinessHours(now, slaHours.resolution, tenant);
    try {
      const { computeMaintenanceOverlapMs } = await import("../help-desk/maintenance-sla");
      const respPause = await computeMaintenanceOverlapMs(tenantId, data.clientId, now, slaResponseDeadline);
      const resPause = await computeMaintenanceOverlapMs(tenantId, data.clientId, now, slaResolutionDeadline);
      if (respPause > 0) slaResponseDeadline = new Date(slaResponseDeadline.getTime() + respPause);
      if (resPause > 0) slaResolutionDeadline = new Date(slaResolutionDeadline.getTime() + resPause);
    } catch {
      /* maintenance tables may not exist yet */
    }
  }

  const initialStatus = data.type === "change_request" ? "draft" : "open";

  const [ticket] = await db
    .insert(sdTickets)
    .values({
      tenantId,
      source,
      ref,
      title: data.title,
      type: data.type,
      priority: routing.priority ?? priority,
      status: initialStatus,
      description: data.description ?? null,
      category: data.category,
      serviceId: data.serviceId,
      customFields: data.customFields ?? {},
      reporterId: data.reporterId !== undefined ? data.reporterId : userId,
      reporterEmail: data.reporterEmail,
      assignedAgentId,
      assignedTeamId,
      clientId: data.clientId,
      projectId: data.projectId,
      slaResponseDeadline,
      slaResolutionDeadline,
      changeJustification: data.changeJustification,
      changeRiskAssessment: data.changeRiskAssessment,
      changeRollbackPlan: data.changeRollbackPlan,
      changeImplementationDate: data.changeImplementationDate ? new Date(data.changeImplementationDate) : null,
      linkedTestCaseId: data.linkedTestCaseId ?? null,
      linkedTestResultId: data.linkedTestResultId ?? null,
      sprintPhase: data.sprintPhase,
      defectSeverity: data.defectSeverity,
      defectStepsToReproduce: data.defectStepsToReproduce,
      defectExpectedResult: data.defectExpectedResult,
      defectActualResult: data.defectActualResult,
      defectEnvironment: data.defectEnvironment,
      defectBuildVersion: data.defectBuildVersion,
      defectWorkaround: data.defectWorkaround,
      defectFixVersion: data.defectFixVersion,
      tags,
      createdBy: userId,
    })
    .returning();

  await db.insert(sdTicketStatusHistory).values({
    ticketId: ticket.id,
    fromStatus: null,
    toStatus: initialStatus,
    changedBy: userId,
    reason: "Ticket created",
  });

  try {
    const { notifyUser } = await import("../lib/user-notify");
    await notifyUser({
      userId,
      tenantId,
      title: `Ticket ${ref} created`,
      message: `Your request "${data.title}" has been logged. Reference: ${ref}.`,
      category: "serviceDesk",
      emailSubject: `[${ref}] Service Desk confirmation`,
    });
  } catch (err) {
    console.warn("[service-desk] ticket confirmation notify skipped:", err);
  }

  return enrichTicket(ticket, tenant);
}

export async function addTicketAttachment(
  tenantId: number,
  ticketId: number,
  userId: string,
  data: { fileName: string; fileUrl: string; fileSize?: number; mimeType?: string },
) {
  const [ticket] = await db
    .select()
    .from(sdTickets)
    .where(and(eq(sdTickets.id, ticketId), eq(sdTickets.tenantId, tenantId)));
  if (!ticket) return null;
  const [att] = await db
    .insert(sdTicketAttachments)
    .values({
      ticketId,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      uploadedBy: userId,
    })
    .returning();
  return att;
}

export async function enrichTicket(
  ticket: typeof sdTickets.$inferSelect,
  tenant?: typeof tenants.$inferSelect | null,
  precomputedTimeLogged?: number,
  options?: { skipMaintenancePause?: boolean },
) {
  const t = tenant ?? (await storage.getTenant(ticket.tenantId));
  let maintenancePauseMs = 0;
  if (!options?.skipMaintenancePause) {
    try {
      const { maintenancePauseForTicket } = await import("../help-desk/maintenance-sla");
      maintenancePauseMs = await maintenancePauseForTicket(
        ticket.tenantId,
        ticket.clientId,
        new Date(ticket.createdAt),
      );
    } catch {
      /* optional */
    }
  }
  const sla = slaStateForTicket(ticket, t, new Date(), maintenancePauseMs);
  const effectiveDeadline = effectiveResolutionDeadline(ticket, t, new Date(), maintenancePauseMs);
  return {
    ...ticket,
    slaState: sla,
    effectiveResolutionDeadline: effectiveDeadline?.toISOString() ?? null,
    maintenancePauseMs,
    totalTimeLogged: precomputedTimeLogged ?? await getTotalTimeLogged(ticket.id),
  };
}

async function batchTotalTimeLogged(ticketIds: number[]): Promise<Map<number, number>> {
  if (ticketIds.length === 0) return new Map();
  const logs = await db
    .select()
    .from(sdTicketTimeLogs)
    .where(inArray(sdTicketTimeLogs.ticketId, ticketIds));
  const map = new Map<number, number>();
  for (const log of logs) {
    map.set(log.ticketId, (map.get(log.ticketId) ?? 0) + Number(log.hours));
  }
  return map;
}

async function getTotalTimeLogged(ticketId: number): Promise<number> {
  const logs = await db.select().from(sdTicketTimeLogs).where(eq(sdTicketTimeLogs.ticketId, ticketId));
  return logs.reduce((s, l) => s + Number(l.hours), 0);
}

export async function listTickets(tenantId: number, filters: TicketFilters) {
  const conditions = [eq(sdTickets.tenantId, tenantId)];
  if (filters.source) conditions.push(eq(sdTickets.source, filters.source));
  if (filters.type && filters.type !== "all") conditions.push(eq(sdTickets.type, filters.type));
  if (filters.priority && filters.priority !== "all") conditions.push(eq(sdTickets.priority, filters.priority));
  if (filters.status && filters.status !== "all") conditions.push(eq(sdTickets.status, filters.status));
  if (filters.clientId) conditions.push(eq(sdTickets.clientId, filters.clientId));
  if (filters.projectId) conditions.push(eq(sdTickets.projectId, filters.projectId));
  if (filters.agentFilter === "me" && filters.userId) {
    conditions.push(eq(sdTickets.assignedAgentId, filters.userId));
  }
  if (filters.agentFilter === "unassigned") {
    conditions.push(sql`${sdTickets.assignedAgentId} IS NULL`);
  }

  let rows = await db
    .select({
      ticket: sdTickets,
      serviceName: sdServices.name,
      teamName: sdAgentTeams.name,
      clientName: clients.name,
      agentFirst: users.firstName,
      agentLast: users.lastName,
    })
    .from(sdTickets)
    .leftJoin(sdServices, eq(sdTickets.serviceId, sdServices.id))
    .leftJoin(sdAgentTeams, eq(sdTickets.assignedTeamId, sdAgentTeams.id))
    .leftJoin(clients, eq(sdTickets.clientId, clients.id))
    .leftJoin(users, eq(sdTickets.assignedAgentId, users.id))
    .where(and(...conditions))
    .orderBy(desc(sdTickets.createdAt));

  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.ticket.title.toLowerCase().includes(q) ||
        r.ticket.ref.toLowerCase().includes(q),
    );
  }

  const tenant = await storage.getTenant(tenantId);
  const timeLoggedByTicket = await batchTotalTimeLogged(rows.map((r) => r.ticket.id));
  const enrichOpts = filters.lightweight ? { skipMaintenancePause: true } : undefined;
  let enriched = await Promise.all(
    rows.map(async (r) => ({
      ...(await enrichTicket(r.ticket, tenant, timeLoggedByTicket.get(r.ticket.id) ?? 0, enrichOpts)),
      serviceName: r.serviceName,
      teamName: r.teamName,
      clientName: r.clientName,
      agentName: r.agentFirst ? `${r.agentFirst} ${r.agentLast ?? ""}`.trim() : null,
    })),
  );

  if (filters.slaFilter && filters.slaFilter !== "all") {
    enriched = enriched.filter((t) => {
      const res = t.slaState.resolution;
      if (filters.slaFilter === "breached") return res === "breached";
      if (filters.slaFilter === "at_risk") return res === "at_risk";
      if (filters.slaFilter === "within") return res === "within";
      return true;
    });
  }

  if (filters.view === "calendar") {
    enriched = enriched.filter(
      (t) =>
        t.type === "change_request" &&
        ["scheduled", "implementing", "cab_approved"].includes(t.status) &&
        t.changeImplementationDate,
    );
  }

  return enriched;
}

export async function getTicketDetail(tenantId: number, ticketId: number) {
  const [row] = await db.select().from(sdTickets).where(and(eq(sdTickets.id, ticketId), eq(sdTickets.tenantId, tenantId)));
  if (!row) return null;
  const tenant = await storage.getTenant(tenantId);
  const [comments, attachments, timeLogs, history, cabReviews] = await Promise.all([
    db.select().from(sdTicketComments).where(eq(sdTicketComments.ticketId, ticketId)).orderBy(asc(sdTicketComments.createdAt)),
    db.select().from(sdTicketAttachments).where(eq(sdTicketAttachments.ticketId, ticketId)),
    db.select().from(sdTicketTimeLogs).where(eq(sdTicketTimeLogs.ticketId, ticketId)).orderBy(desc(sdTicketTimeLogs.logDate)),
    db.select().from(sdTicketStatusHistory).where(eq(sdTicketStatusHistory.ticketId, ticketId)).orderBy(desc(sdTicketStatusHistory.createdAt)),
    db.select().from(sdCabReviews).where(eq(sdCabReviews.ticketId, ticketId)),
  ]);
  return {
    ...(await enrichTicket(row, tenant)),
    comments,
    attachments,
    timeLogs,
    statusHistory: history,
    cabReviews,
  };
}

export async function updateTicketStatus(
  tenantId: number,
  ticketId: number,
  userId: string,
  newStatus: string,
  reason?: string,
) {
  const [ticket] = await db
    .select()
    .from(sdTickets)
    .where(and(eq(sdTickets.id, ticketId), eq(sdTickets.tenantId, tenantId)));
  if (!ticket) return null;
  if (!canTransition(ticket.type as TicketType, ticket.status, newStatus)) {
    throw new Error(`Invalid status transition from ${ticket.status} to ${newStatus}`);
  }

  const tenant = await storage.getTenant(tenantId);
  const updates: Partial<typeof sdTickets.$inferInsert> = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (newStatus === "pending" && !ticket.slaPausedAt) {
    updates.slaPausedAt = new Date();
  }
  if (ticket.status === "pending" && newStatus !== "pending" && ticket.slaPausedAt) {
    const pausedMs = businessMsBetween(ticket.slaPausedAt, new Date(), tenant);
    updates.slaPausedMs = (ticket.slaPausedMs ?? 0) + pausedMs;
    updates.slaPausedAt = null;
    if (ticket.slaResolutionDeadline) {
      updates.slaResolutionDeadline = new Date(ticket.slaResolutionDeadline.getTime() + pausedMs);
    }
    if (ticket.slaResponseDeadline) {
      updates.slaResponseDeadline = new Date(ticket.slaResponseDeadline.getTime() + pausedMs);
    }
  }

  if (newStatus === "resolved" || newStatus === "completed" || newStatus === "answered" || newStatus === "fixed") {
    updates.resolvedAt = new Date();
  }
  if (newStatus === "closed") {
    updates.closedAt = new Date();
  }
  if (newStatus === "submitted" && ticket.type === "change_request") {
    updates.status = "under_review";
    await notifyCabMembers(tenantId, ticketId);
  }

  const [updated] = await db
    .update(sdTickets)
    .set(updates)
    .where(eq(sdTickets.id, ticketId))
    .returning();

  await db.insert(sdTicketStatusHistory).values({
    ticketId,
    fromStatus: ticket.status,
    toStatus: updates.status ?? newStatus,
    changedBy: userId,
    reason,
  });

  const finalStatus = updates.status ?? newStatus;

  if (ticket.source === "help_desk" && finalStatus === "closed") {
    try {
      const { triggerCsatSurvey } = await import("../help-desk/csat");
      await triggerCsatSurvey(tenantId, updated);
    } catch (err) {
      console.warn("[help-desk] CSAT trigger skipped:", err);
    }
  }

  if (ticket.type === "defect" && finalStatus === "fix_ready" && ticket.linkedTestCaseId) {
    try {
      const { notifyTestCaseReadyForRetest } = await import("../help-desk/tm-bridge");
      await notifyTestCaseReadyForRetest(tenantId, updated, userId);
    } catch (err) {
      console.warn("[help-desk] TM retest notify skipped:", err);
    }
  }

  if (newStatus === "under_review" || (newStatus === "submitted" && ticket.type === "change_request")) {
    // handled above
  }

  return enrichTicket(updated, tenant);
}

/** Post-go-live: convert a defect ticket to incident while preserving history. */
export async function convertDefectToIncident(
  tenantId: number,
  ticketId: number,
  userId: string,
  reason?: string,
) {
  const [ticket] = await db
    .select()
    .from(sdTickets)
    .where(and(eq(sdTickets.id, ticketId), eq(sdTickets.tenantId, tenantId)));
  if (!ticket) return null;
  if (ticket.type !== "defect") throw new Error("Only defect tickets can be converted to incidents");

  const tenant = await storage.getTenant(tenantId);
  const slaHours = await resolveSlaHours(tenantId, ticket.priority as TicketPriority, ticket.serviceId, ticket.clientId, "incident");
  const now = new Date();
  let slaResponseDeadline = addBusinessHours(now, slaHours.response, tenant);
  let slaResolutionDeadline = addBusinessHours(now, slaHours.resolution, tenant);
  try {
    const { computeMaintenanceOverlapMs } = await import("../help-desk/maintenance-sla");
    const respPause = await computeMaintenanceOverlapMs(tenantId, ticket.clientId, now, slaResponseDeadline);
    const resPause = await computeMaintenanceOverlapMs(tenantId, ticket.clientId, now, slaResolutionDeadline);
    if (respPause > 0) slaResponseDeadline = new Date(slaResponseDeadline.getTime() + respPause);
    if (resPause > 0) slaResolutionDeadline = new Date(slaResolutionDeadline.getTime() + resPause);
  } catch { /* */ }

  const priorType = ticket.type;
  const [updated] = await db
    .update(sdTickets)
    .set({
      type: "incident",
      status: "open",
      slaResponseDeadline,
      slaResolutionDeadline,
      slaPausedAt: null,
      slaPausedMs: 0,
      tags: [...((ticket.tags as string[] | null) ?? []), "converted_from_defect"],
      updatedAt: now,
    })
    .where(eq(sdTickets.id, ticketId))
    .returning();

  await db.insert(sdTicketStatusHistory).values({
    ticketId,
    fromStatus: ticket.status,
    toStatus: "open",
    changedBy: userId,
    reason: reason ?? `Converted from ${priorType} to incident (post-go-live)`,
  });

  return enrichTicket(updated, tenant);
}

async function notifyCabMembers(tenantId: number, ticketId: number) {
  const members = await db.select().from(sdCabMembers).where(eq(sdCabMembers.tenantId, tenantId));
  const { notifyUser } = await import("../lib/user-notify");
  for (const m of members) {
    await notifyUser({
      userId: m.userId,
      tenantId,
      title: "Change request awaiting CAB review",
      message: `Ticket #${ticketId} requires your review.`,
      type: "workflow",
      source: "service-desk",
      sourceId: String(ticketId),
      category: "serviceDesk",
    });
  }
}

export async function addTicketComment(
  tenantId: number,
  ticketId: number,
  userId: string,
  body: unknown,
  isInternal = false,
) {
  const [ticket] = await db
    .select()
    .from(sdTickets)
    .where(and(eq(sdTickets.id, ticketId), eq(sdTickets.tenantId, tenantId)));
  if (!ticket) return null;

  const [comment] = await db
    .insert(sdTicketComments)
    .values({ ticketId, authorId: userId, body, isInternal })
    .returning();

  if (!isInternal && !ticket.firstResponseAt) {
    await db
      .update(sdTickets)
      .set({ firstResponseAt: new Date(), updatedAt: new Date() })
      .where(eq(sdTickets.id, ticketId));
  }
  return comment;
}

export async function updateTicket(
  tenantId: number,
  ticketId: number,
  _userId: string,
  patch: Partial<{
    title: string;
    priority: TicketPriority;
    description: unknown;
    assignedAgentId: string | null;
    assignedTeamId: number | null;
    internalNotes: string;
    category: string;
    projectId: number | null;
    changeJustification: string;
    changeRiskAssessment: string;
    changeRollbackPlan: string;
    changeImplementationDate: string | null;
    changePostReview: string;
  }>,
) {
  const [ticket] = await db
    .select()
    .from(sdTickets)
    .where(and(eq(sdTickets.id, ticketId), eq(sdTickets.tenantId, tenantId)));
  if (!ticket) return null;

  const updates: Record<string, unknown> = { ...patch, updatedAt: new Date() };
  if (patch.changeImplementationDate !== undefined) {
    updates.changeImplementationDate = patch.changeImplementationDate
      ? new Date(patch.changeImplementationDate)
      : null;
  }
  if (patch.priority && patch.priority !== ticket.priority && ticket.type !== "question") {
    const tenant = await storage.getTenant(tenantId);
    const slaHours = await resolveSlaHours(tenantId, patch.priority, ticket.serviceId, ticket.clientId, ticket.type as TicketType);
    const created = ticket.createdAt ?? new Date();
    updates.slaResponseDeadline = addBusinessHours(created, slaHours.response, tenant);
    updates.slaResolutionDeadline = addBusinessHours(created, slaHours.resolution, tenant);
  }

  const [updated] = await db.update(sdTickets).set(updates).where(eq(sdTickets.id, ticketId)).returning();
  return enrichTicket(updated);
}

export async function submitCabReview(
  tenantId: number,
  ticketId: number,
  reviewerId: string,
  decision: "approved" | "rejected" | "more_info",
  comments?: string,
) {
  const [ticket] = await db
    .select()
    .from(sdTickets)
    .where(and(eq(sdTickets.id, ticketId), eq(sdTickets.tenantId, tenantId)));
  if (!ticket || ticket.type !== "change_request") return null;

  const [existing] = await db
    .select()
    .from(sdCabReviews)
    .where(and(eq(sdCabReviews.ticketId, ticketId), eq(sdCabReviews.reviewerId, reviewerId)));

  if (existing) {
    await db
      .update(sdCabReviews)
      .set({ decision, comments, updatedAt: new Date() })
      .where(eq(sdCabReviews.id, existing.id));
  } else {
    await db.insert(sdCabReviews).values({ ticketId, reviewerId, decision, comments });
  }

  const reviews = await db.select().from(sdCabReviews).where(eq(sdCabReviews.ticketId, ticketId));
  const members = await db.select().from(sdCabMembers).where(eq(sdCabMembers.tenantId, tenantId));
  const required = members.filter((m) => m.isRequired);

  const anyRejected = reviews.some((r) => r.decision === "rejected");
  if (anyRejected) {
    return updateTicketStatus(tenantId, ticketId, reviewerId, "cab_rejected", "CAB rejected");
  }

  const allApproved =
    required.length > 0 &&
    required.every((m) => reviews.some((r) => r.reviewerId === m.userId && r.decision === "approved"));

  if (allApproved) {
    return updateTicketStatus(tenantId, ticketId, reviewerId, "cab_approved", "CAB approved");
  }

  return getTicketDetail(tenantId, ticketId);
}

export async function addTimeLog(
  tenantId: number,
  ticketId: number,
  agentId: string,
  data: { logDate: string; hours: number; description?: string; isBillable?: boolean; rate?: number },
) {
  const [ticket] = await db
    .select()
    .from(sdTickets)
    .where(and(eq(sdTickets.id, ticketId), eq(sdTickets.tenantId, tenantId)));
  if (!ticket) return null;

  const [log] = await db
    .insert(sdTicketTimeLogs)
    .values({
      ticketId,
      agentId,
      logDate: data.logDate,
      hours: String(data.hours),
      description: data.description,
      isBillable: data.isBillable ?? true,
      rate: data.rate != null ? String(data.rate) : null,
    })
    .returning();

  if (log && ticket.projectId && (data.isBillable ?? true)) {
    try {
      const { syncTicketTimeLogToFinance } = await import("./finance-sync");
      await syncTicketTimeLogToFinance(tenantId, log.id);
    } catch (err) {
      console.warn("[service-desk] finance sync skipped:", err);
    }
  }

  return log;
}

export async function getBillableTimeForInvoicing(tenantId: number, ticketIds?: number[]) {
  const conditions = [eq(sdTickets.tenantId, tenantId)];
  if (ticketIds?.length) conditions.push(inArray(sdTickets.id, ticketIds));

  const rows = await db
    .select({
      ticket: sdTickets,
      log: sdTicketTimeLogs,
    })
    .from(sdTicketTimeLogs)
    .innerJoin(sdTickets, eq(sdTicketTimeLogs.ticketId, sdTickets.id))
    .where(and(...conditions, eq(sdTicketTimeLogs.isBillable, true)));

  return rows.map((r) => ({
    ticketId: r.ticket.id,
    ticketRef: r.ticket.ref,
    clientId: r.ticket.clientId,
    projectId: r.ticket.projectId,
    hours: Number(r.log.hours),
    rate: r.log.rate ? Number(r.log.rate) : 0,
    amount: Number(r.log.hours) * (r.log.rate ? Number(r.log.rate) : 0),
    description: r.log.description,
    logDate: r.log.logDate,
    logId: r.log.id,
  }));
}

// --- Service Catalogue ---

export async function listCategories(tenantId: number) {
  return db
    .select()
    .from(sdServiceCategories)
    .where(eq(sdServiceCategories.tenantId, tenantId))
    .orderBy(asc(sdServiceCategories.sortOrder), asc(sdServiceCategories.name));
}

export async function listServices(tenantId: number, clientId?: number | null, options?: { admin?: boolean }) {
  const categories = await listCategories(tenantId);
  const serviceWhere = options?.admin
    ? eq(sdServices.tenantId, tenantId)
    : and(eq(sdServices.tenantId, tenantId), eq(sdServices.isActive, true));
  const services = await db
    .select({
      service: sdServices,
      teamName: sdAgentTeams.name,
      categoryName: sdServiceCategories.name,
    })
    .from(sdServices)
    .leftJoin(sdAgentTeams, eq(sdServices.ownerTeamId, sdAgentTeams.id))
    .leftJoin(sdServiceCategories, eq(sdServices.categoryId, sdServiceCategories.id))
    .where(serviceWhere)
    .orderBy(asc(sdServices.sortOrder), asc(sdServices.name));

  const filtered = options?.admin ? services : services.filter((s) => {
    if (s.service.visibility === "internal_only" && clientId) return false;
    if (s.service.visibility === "specific_clients" && clientId) {
      const ids = (s.service.visibleClientIds as number[]) ?? [];
      return ids.includes(clientId);
    }
    return true;
  });

  const withSlas = await Promise.all(
    filtered.map(async (s) => {
      const slas = await db.select().from(sdServiceSlas).where(eq(sdServiceSlas.serviceId, s.service.id));
      return { ...s.service, teamName: s.teamName, categoryName: s.categoryName, slas };
    }),
  );

  return { categories, services: withSlas };
}

export async function upsertService(
  tenantId: number,
  userId: string,
  data: Partial<typeof sdServices.$inferInsert> & { slas?: { priority: string; responseHours: number; resolutionHours: number }[] },
  serviceId?: number,
) {
  const { slas, ...rest } = data;
  const fields = rest as Partial<typeof sdServices.$inferInsert>;
  let service;
  if (serviceId) {
    [service] = await db
      .update(sdServices)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(sdServices.id, serviceId), eq(sdServices.tenantId, tenantId)))
      .returning();
  } else {
    [service] = await db
      .insert(sdServices)
      .values({ ...fields, tenantId, createdBy: userId } as typeof sdServices.$inferInsert)
      .returning();
  }
  if (slas && service) {
    await db.delete(sdServiceSlas).where(eq(sdServiceSlas.serviceId, service.id));
    for (const s of slas) {
      await db.insert(sdServiceSlas).values({
        serviceId: service.id,
        priority: s.priority,
        responseHours: String(s.responseHours),
        resolutionHours: String(s.resolutionHours),
      });
    }
  }
  return service;
}

export async function upsertCategory(tenantId: number, data: { name: string; description?: string; sortOrder?: number }, id?: number) {
  if (id) {
    const [cat] = await db
      .update(sdServiceCategories)
      .set(data)
      .where(and(eq(sdServiceCategories.id, id), eq(sdServiceCategories.tenantId, tenantId)))
      .returning();
    return cat;
  }
  const [cat] = await db.insert(sdServiceCategories).values({ ...data, tenantId }).returning();
  return cat;
}

// --- Teams ---

export async function listTeams(tenantId: number) {
  const teams = await db.select().from(sdAgentTeams).where(eq(sdAgentTeams.tenantId, tenantId)).orderBy(asc(sdAgentTeams.name));
  return Promise.all(
    teams.map(async (t) => {
      const members = await db.select().from(sdAgentTeamMembers).where(eq(sdAgentTeamMembers.teamId, t.id));
      return { ...t, memberIds: members.map((m) => m.userId) };
    }),
  );
}

export async function upsertTeam(
  tenantId: number,
  data: Partial<typeof sdAgentTeams.$inferInsert> & { memberIds?: string[] },
  teamId?: number,
) {
  const { memberIds, ...fields } = data;
  let team;
  if (teamId) {
    [team] = await db
      .update(sdAgentTeams)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(sdAgentTeams.id, teamId), eq(sdAgentTeams.tenantId, tenantId)))
      .returning();
  } else {
    [team] = await db.insert(sdAgentTeams).values({ ...fields, tenantId, name: fields.name ?? "Team" } as typeof sdAgentTeams.$inferInsert).returning();
  }
  if (team && memberIds) {
    await db.delete(sdAgentTeamMembers).where(eq(sdAgentTeamMembers.teamId, team.id));
    for (const uid of memberIds) {
      await db.insert(sdAgentTeamMembers).values({ teamId: team.id, userId: uid });
    }
  }
  return team;
}

// --- Routing ---

export async function listRoutingRules(tenantId: number) {
  return db
    .select()
    .from(sdRoutingRules)
    .where(eq(sdRoutingRules.tenantId, tenantId))
    .orderBy(asc(sdRoutingRules.sortOrder));
}

export async function upsertRoutingRule(tenantId: number, data: Partial<typeof sdRoutingRules.$inferInsert>, id?: number) {
  if (id) {
    const [rule] = await db
      .update(sdRoutingRules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(sdRoutingRules.id, id), eq(sdRoutingRules.tenantId, tenantId)))
      .returning();
    return rule;
  }
  const [rule] = await db.insert(sdRoutingRules).values({ ...data, tenantId, name: data.name ?? "Rule" } as typeof sdRoutingRules.$inferInsert).returning();
  return rule;
}

export async function deleteRoutingRule(tenantId: number, id: number) {
  await db.delete(sdRoutingRules).where(and(eq(sdRoutingRules.id, id), eq(sdRoutingRules.tenantId, tenantId)));
}

// --- SLA Config ---

export async function listSlaConfigs(tenantId: number) {
  return db
    .select({
      config: sdSlaConfigs,
      clientName: clients.name,
    })
    .from(sdSlaConfigs)
    .leftJoin(clients, eq(sdSlaConfigs.clientId, clients.id))
    .where(eq(sdSlaConfigs.tenantId, tenantId));
}

export async function upsertSlaConfig(
  tenantId: number,
  data: { clientId?: number | null; priority: string; responseHours: number; resolutionHours: number },
  id?: number,
) {
  if (id) {
    const [cfg] = await db
      .update(sdSlaConfigs)
      .set({
        clientId: data.clientId,
        priority: data.priority,
        responseHours: String(data.responseHours),
        resolutionHours: String(data.resolutionHours),
      })
      .where(and(eq(sdSlaConfigs.id, id), eq(sdSlaConfigs.tenantId, tenantId)))
      .returning();
    return cfg;
  }
  const [cfg] = await db
    .insert(sdSlaConfigs)
    .values({
      tenantId,
      clientId: data.clientId,
      priority: data.priority,
      responseHours: String(data.responseHours),
      resolutionHours: String(data.resolutionHours),
    })
    .returning();
  return cfg;
}

export async function deleteSlaConfig(tenantId: number, id: number) {
  await db.delete(sdSlaConfigs).where(and(eq(sdSlaConfigs.id, id), eq(sdSlaConfigs.tenantId, tenantId)));
}

// --- CAB Members ---

export async function listCabMembers(tenantId: number) {
  return db.select().from(sdCabMembers).where(eq(sdCabMembers.tenantId, tenantId));
}

export async function setCabMembers(tenantId: number, memberIds: string[]) {
  await db.delete(sdCabMembers).where(eq(sdCabMembers.tenantId, tenantId));
  for (const userId of memberIds) {
    await db.insert(sdCabMembers).values({ tenantId, userId, isRequired: true });
  }
  return listCabMembers(tenantId);
}

// --- Dashboard ---

function resolveSlaComplianceTarget(configs: Awaited<ReturnType<typeof listSlaConfigs>>): number {
  if (!configs.length) return 95;
  const avgResolutionHours =
    configs.reduce((sum, row) => sum + parseFloat(String(row.config.resolutionHours)), 0) / configs.length;
  if (avgResolutionHours <= 4) return 98;
  if (avgResolutionHours <= 8) return 95;
  if (avgResolutionHours <= 24) return 92;
  return 88;
}

export async function loadServiceDeskDashboard(tenantId: number, clientId?: number | null) {
  const filters: TicketFilters = { source: "service_desk", clientId: clientId ?? undefined, lightweight: true };
  const tickets = await listTickets(tenantId, filters);
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const open = tickets.filter((t) => !["closed", "resolved", "completed", "answered", "fixed", "wont_fix"].includes(t.status));
  const breached = open.filter((t) => t.slaState.resolution === "breached");
  const atRisk = open.filter((t) => t.slaState.resolution === "at_risk");
  const p1p2Open = open.filter((t) => t.type === "incident" && (t.priority === "p1" || t.priority === "p2"));
  const pendingApproval = tickets.filter(
    (t) => t.type === "change_request" && ["submitted", "under_review"].includes(t.status),
  );

  const resolvedRecent = tickets.filter(
    (t) => t.resolvedAt && t.resolvedAt >= thirtyDaysAgo,
  );
  let totalMs = 0;
  let count = 0;
  for (const t of resolvedRecent) {
    if (t.resolvedAt && t.createdAt) {
      totalMs += t.resolvedAt.getTime() - t.createdAt.getTime();
      count++;
    }
  }
  const avgResolutionHours = count > 0 ? Math.round(totalMs / count / 3600000) : 0;

  const byType: Record<string, number> = { incident: 0, service_request: 0, change_request: 0, question: 0, defect: 0 };
  const recent30 = tickets.filter((t) => t.createdAt >= thirtyDaysAgo);
  for (const t of recent30) {
    byType[t.type] = (byType[t.type] ?? 0) + 1;
  }

  const slaWithin = resolvedRecent.filter((t) => t.slaState.resolution === "within").length;
  const slaTotal = resolvedRecent.length || 1;
  const slaPerformancePct = Math.round((slaWithin / slaTotal) * 100);
  const slaConfigs = await listSlaConfigs(tenantId);
  const slaComplianceTarget = resolveSlaComplianceTarget(slaConfigs);

  const volumeTrend: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const countDay = tickets.filter((t) => t.createdAt >= dayStart && t.createdAt < dayEnd).length;
    volumeTrend.push({
      day: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      count: countDay,
    });
  }

  const breachedTable = [...breached, ...atRisk]
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
      slaState: t.slaState.resolution,
      overdueHours: t.effectiveResolutionDeadline
        ? Math.max(0, Math.round((now.getTime() - new Date(t.effectiveResolutionDeadline).getTime()) / 3600000))
        : 0,
    }));

  return {
    kpis: {
      openTickets: open.length,
      slaBreached: breached.length,
      slaAtRisk: atRisk.length,
      avgResolutionHours,
      p1p2Open: p1p2Open.length,
      pendingApproval: pendingApproval.length,
    },
    volumeByType: Object.entries(byType).map(([type, countVal]) => ({ type, count: countVal })),
    slaPerformance: { withinPct: slaPerformancePct, target: slaComplianceTarget },
    volumeTrend,
    breachedTable,
  };
}

export async function getTimeAnalysisReport(tenantId: number, clientId?: number | null) {
  const rows = await getBillableTimeForInvoicing(tenantId);
  const filtered = clientId ? rows.filter((r) => r.clientId === clientId) : rows;
  const byService: Record<string, { hours: number; amount: number }> = {};
  for (const r of filtered) {
    const key = r.ticketRef;
    if (!byService[key]) byService[key] = { hours: 0, amount: 0 };
    byService[key].hours += r.hours;
    byService[key].amount += r.amount;
  }
  return {
    rows: filtered,
    summary: Object.entries(byService).map(([ref, v]) => ({ ref, ...v })),
    totalHours: filtered.reduce((s, r) => s + r.hours, 0),
    totalBillable: filtered.reduce((s, r) => s + r.amount, 0),
  };
}

export { INCIDENT_STATUSES, SERVICE_REQUEST_STATUSES, CHANGE_STATUSES, QUESTION_STATUSES };
