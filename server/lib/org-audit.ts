import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { orgAuditEvents, type OrgAuditAction } from "@shared/models/permissions";

export async function logOrgAuditEvent(input: {
  orgId: number;
  actorUserId: string;
  action: OrgAuditAction | string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(orgAuditEvents).values({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: input.action,
      targetUserId: input.targetUserId ?? null,
      targetEmail: input.targetEmail ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "42P01"
    ) {
      return;
    }
    console.warn("[org-audit] Failed to log event:", (err as Error).message);
  }
}

export async function listOrgAuditEvents(orgId: number, limit = 100) {
  try {
    return await db
      .select()
      .from(orgAuditEvents)
      .where(eq(orgAuditEvents.orgId, orgId))
      .orderBy(desc(orgAuditEvents.createdAt))
      .limit(limit);
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "42P01"
    ) {
      return [];
    }
    throw err;
  }
}
