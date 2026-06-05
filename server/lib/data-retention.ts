import { and, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { notifications, tenants } from "@shared/schema";
import { orgAuditEvents } from "@shared/models/permissions";

export type RetentionRunResult = {
  orgId: number;
  notificationsDeleted: number;
  auditEventsDeleted: number;
};

export async function runOrgDataRetention(orgId: number): Promise<RetentionRunResult> {
  const tenant = await db.select().from(tenants).where(eq(tenants.id, orgId)).limit(1);
  const row = tenant[0];
  const days =
    (row?.brandingConfig as { dataGovernance?: { dataRetentionDays?: number } })?.dataGovernance
      ?.dataRetentionDays ?? 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(30, Math.min(3650, days)));

  let notificationsDeleted = 0;
  let auditEventsDeleted = 0;

  try {
    const notifResult = await db
      .delete(notifications)
      .where(and(eq(notifications.tenantId, orgId), lt(notifications.createdAt, cutoff)))
      .returning({ id: notifications.id });
    notificationsDeleted = notifResult.length;
  } catch {
    /* table may lack tenant_id rows */
  }

  try {
    const auditResult = await db
      .delete(orgAuditEvents)
      .where(and(eq(orgAuditEvents.orgId, orgId), lt(orgAuditEvents.createdAt, cutoff)))
      .returning({ id: orgAuditEvents.id });
    auditEventsDeleted = auditResult.length;
  } catch {
    /* org_audit_events may not exist */
  }

  return { orgId, notificationsDeleted, auditEventsDeleted };
}
