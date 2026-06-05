import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  staffImpersonationLogs,
  type ImpersonationStatus,
} from "@shared/models/permissions";
import { isJigantoStaffUserId } from "./permissions";

export interface ActiveImpersonation {
  logId: number;
  staffUserId: string;
  targetUserId: string;
  orgId: number;
}

export async function getActiveImpersonationForStaff(
  staffUserId: string,
): Promise<ActiveImpersonation | null> {
  try {
    const [row] = await db
      .select()
      .from(staffImpersonationLogs)
      .where(
        and(
          eq(staffImpersonationLogs.staffUserId, staffUserId),
          eq(staffImpersonationLogs.approvalStatus, "active"),
        ),
      )
      .orderBy(desc(staffImpersonationLogs.startedAt))
      .limit(1);
    if (!row?.targetUserId) return null;
    return {
      logId: row.id,
      staffUserId: row.staffUserId,
      targetUserId: row.targetUserId,
      orgId: row.orgId,
    };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "42P01"
    ) {
      return null;
    }
    throw err;
  }
}

export function canStartImpersonation(staffUserId: string): boolean {
  return isJigantoStaffUserId(staffUserId);
}

export async function requestImpersonation(input: {
  staffUserId: string;
  targetUserId: string;
  orgId: number;
  reason: string;
}): Promise<{ id: number; approvalStatus: ImpersonationStatus }> {
  const [row] = await db
    .insert(staffImpersonationLogs)
    .values({
      staffUserId: input.staffUserId,
      targetUserId: input.targetUserId,
      orgId: input.orgId,
      reason: input.reason,
      approvalStatus: "approved",
      approvedBy: input.staffUserId,
      startedAt: new Date(),
    })
    .returning();
  return { id: row.id, approvalStatus: row.approvalStatus as ImpersonationStatus };
}

export async function endImpersonation(logId: number, staffUserId: string): Promise<boolean> {
  const [row] = await db
    .update(staffImpersonationLogs)
    .set({ approvalStatus: "ended", endedAt: new Date() })
    .where(
      and(
        eq(staffImpersonationLogs.id, logId),
        eq(staffImpersonationLogs.staffUserId, staffUserId),
        eq(staffImpersonationLogs.approvalStatus, "active"),
      ),
    )
    .returning();
  return !!row;
}

export async function listImpersonationLogs(orgId: number, limit = 100) {
  try {
    return await db
      .select()
      .from(staffImpersonationLogs)
      .where(eq(staffImpersonationLogs.orgId, orgId))
      .orderBy(desc(staffImpersonationLogs.createdAt))
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
