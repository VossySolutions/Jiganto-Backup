import { and, eq, lte, or, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  timesheetIntegrations,
  timesheetIntegrationLog,
  timesheetPeriods,
  timesheetEntries,
  resources,
} from "@shared/schema";
import { exportTimesheetsCsv } from "./service";

const MAX_RETRIES = 5;

async function postIntegration(
  integration: typeof timesheetIntegrations.$inferSelect,
  payload: string,
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "text/csv",
    "User-Agent": "Jiganto-Timesheet-Integration/1.0",
  };
  const authConfig = integration.authConfig as { token?: string; header?: string } | null;
  if (integration.authType === "bearer" && authConfig?.token) {
    headers.Authorization = `Bearer ${authConfig.token}`;
  } else if (authConfig?.header && authConfig?.token) {
    headers[authConfig.header] = authConfig.token;
  }

  try {
    const res = await fetch(integration.endpointUrl, {
      method: "POST",
      headers,
      body: payload,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, statusCode: res.status, error: text || res.statusText };
    }
    return { ok: true, statusCode: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deliverTimesheetIntegration(
  tenantId: number,
  integrationId: number,
  periodIds?: number[],
): Promise<{ recordsSent: number; status: string; error?: string }> {
  const [integration] = await db
    .select()
    .from(timesheetIntegrations)
    .where(and(eq(timesheetIntegrations.id, integrationId), eq(timesheetIntegrations.tenantId, tenantId)))
    .limit(1);

  if (!integration || !integration.isActive) {
    return { recordsSent: 0, status: "skipped", error: "Integration inactive" };
  }

  const csv = await exportTimesheetsCsv(tenantId, { format: "standard" });
  const lineCount = Math.max(0, csv.split("\n").length - 1);

  const result = await postIntegration(integration, csv);

  await db.insert(timesheetIntegrationLog).values({
    tenantId,
    integrationId,
    recordsSent: lineCount,
    status: result.ok ? "delivered" : "failed",
    errorMessage: result.error,
    payload: { periodIds: periodIds ?? [], lineCount },
    retryCount: 0,
  });

  return {
    recordsSent: lineCount,
    status: result.ok ? "delivered" : "failed",
    error: result.error,
  };
}

export async function deliverOnTimesheetApproval(tenantId: number, periodId: number): Promise<void> {
  const integrations = await db
    .select()
    .from(timesheetIntegrations)
    .where(and(
      eq(timesheetIntegrations.tenantId, tenantId),
      eq(timesheetIntegrations.isActive, true),
      eq(timesheetIntegrations.trigger, "on_approval"),
    ));

  for (const integration of integrations) {
    await deliverTimesheetIntegration(tenantId, integration.id, [periodId]);
  }
}

export async function retryFailedIntegrationDeliveries(): Promise<number> {
  const now = new Date();
  const failed = await db
    .select()
    .from(timesheetIntegrationLog)
    .where(and(
      eq(timesheetIntegrationLog.status, "failed"),
      or(isNull(timesheetIntegrationLog.nextRetryAt), lte(timesheetIntegrationLog.nextRetryAt, now)),
    ))
    .limit(50);

  let retried = 0;
  for (const log of failed) {
    if ((log.retryCount ?? 0) >= MAX_RETRIES || !log.integrationId) continue;

    const [integration] = await db
      .select()
      .from(timesheetIntegrations)
      .where(eq(timesheetIntegrations.id, log.integrationId))
      .limit(1);
    if (!integration?.isActive) continue;

    const csv = await exportTimesheetsCsv(log.tenantId, { format: "standard" });
    const result = await postIntegration(integration, csv);
    const nextRetry = new Date(Date.now() + 60 * 60 * 1000 * Math.pow(2, (log.retryCount ?? 0) + 1));

    await db
      .update(timesheetIntegrationLog)
      .set({
        status: result.ok ? "delivered" : "failed",
        errorMessage: result.error,
        retryCount: (log.retryCount ?? 0) + 1,
        nextRetryAt: result.ok ? null : nextRetry,
      })
      .where(eq(timesheetIntegrationLog.id, log.id));

    retried++;
  }
  return retried;
}

export async function runScheduledTimesheetExports(): Promise<number> {
  const integrations = await db
    .select()
    .from(timesheetIntegrations)
    .where(and(
      eq(timesheetIntegrations.isActive, true),
      eq(timesheetIntegrations.trigger, "scheduled"),
    ));

  let sent = 0;
  for (const integration of integrations) {
    if (!integration.scheduleCron) continue;
    const result = await deliverTimesheetIntegration(integration.tenantId, integration.id);
    if (result.status === "delivered") sent++;
  }
  return sent;
}

export async function runContractorExpiryAlerts(): Promise<number> {
  const all = await db.select().from(resources);
  const in30Days = new Date(Date.now() + 30 * 86400000);
  let alerts = 0;
  for (const r of all) {
    if (r.personType !== "contractor" || !r.endDate) continue;
    const end = new Date(r.endDate);
    if (end <= in30Days && end > new Date()) alerts++;
  }
  return alerts;
}
