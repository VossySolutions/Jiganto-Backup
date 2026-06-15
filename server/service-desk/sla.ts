import type { Tenant } from "@shared/schema";
import { businessMsBetween, getOrgCalendarConfig } from "../lib/business-calendar";

/** Add business hours to a start date (respecting org calendar). */
export function addBusinessHours(
  start: Date,
  hours: number,
  tenant: Tenant | null | undefined,
): Date {
  if (hours <= 0) return new Date(start);
  let remainingMs = hours * 3600_000;
  const cursor = new Date(start);
  const maxIterations = hours * 24 * 60 + 10080; // safety cap
  let iterations = 0;
  while (remainingMs > 0 && iterations < maxIterations) {
    const next = new Date(cursor.getTime() + 60_000);
    const ms = businessMsBetween(cursor, next, tenant);
    if (ms > 0) {
      remainingMs -= ms;
    }
    cursor.setTime(next.getTime());
    iterations++;
  }
  return cursor;
}

export type SlaState = "within" | "at_risk" | "breached" | "none";

export function computeSlaState(
  deadline: Date | null | undefined,
  now = new Date(),
): SlaState {
  if (!deadline) return "none";
  if (now > deadline) return "breached";
  const totalMs = deadline.getTime() - now.getTime();
  const windowMs = deadline.getTime() - (deadline.getTime() - totalMs * 5); // 20% of remaining
  const atRiskThreshold = deadline.getTime() - totalMs * 0.2;
  if (now.getTime() >= atRiskThreshold) return "at_risk";
  return "within";
}

export function effectiveResolutionDeadline(
  ticket: {
    slaResolutionDeadline: Date | null;
    slaPausedAt: Date | null;
    slaPausedMs: number | null;
    status: string;
  },
  tenant: Tenant | null | undefined,
  now = new Date(),
  maintenancePauseMs = 0,
): Date | null {
  if (!ticket.slaResolutionDeadline) return null;
  let deadline = new Date(ticket.slaResolutionDeadline);
  if (ticket.slaPausedAt && ticket.status === "pending") {
    const pausedMs = ticket.slaPausedMs ?? 0;
    const extraPause = businessMsBetween(ticket.slaPausedAt, now, tenant);
    deadline = new Date(deadline.getTime() + pausedMs + extraPause);
  } else if (ticket.slaPausedMs) {
    deadline = new Date(deadline.getTime() + ticket.slaPausedMs);
  }
  if (maintenancePauseMs > 0) {
    deadline = new Date(deadline.getTime() + maintenancePauseMs);
  }
  return deadline;
}

export function slaStateForTicket(
  ticket: {
    slaResolutionDeadline: Date | null;
    slaResponseDeadline: Date | null;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
    status: string;
    slaPausedAt: Date | null;
    slaPausedMs: number | null;
    type: string;
  },
  tenant: Tenant | null | undefined,
  now = new Date(),
  maintenancePauseMs = 0,
): { response: SlaState; resolution: SlaState } {
  if (ticket.type === "question") {
    return { response: "none", resolution: "none" };
  }
  const resolutionDeadline = effectiveResolutionDeadline(ticket, tenant, now, maintenancePauseMs);
  let response: SlaState = "none";
  if (ticket.slaResponseDeadline && !ticket.firstResponseAt) {
    response = computeSlaState(ticket.slaResponseDeadline, now);
  } else if (ticket.firstResponseAt && ticket.slaResponseDeadline) {
    response = ticket.firstResponseAt <= ticket.slaResponseDeadline ? "within" : "breached";
  }
  let resolution: SlaState = "none";
  if (ticket.resolvedAt && resolutionDeadline) {
    resolution = ticket.resolvedAt <= resolutionDeadline ? "within" : "breached";
  } else if (resolutionDeadline) {
    resolution = computeSlaState(resolutionDeadline, now);
  }
  return { response, resolution };
}

export function getOrgBusinessHoursSummary(tenant: Tenant | null | undefined): string {
  const cfg = getOrgCalendarConfig(tenant);
  return `${cfg.businessHoursStart ?? "09:00"} – ${cfg.businessHoursEnd ?? "18:00"} (Mon–Fri)`;
}
