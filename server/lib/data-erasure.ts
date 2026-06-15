import { eq } from "drizzle-orm";
import { db } from "../db";
import { users as usersTable, profiles, notifications } from "@shared/schema";
import { storage } from "../storage";
import { logOrgAuditEvent } from "./org-audit";

export type ErasureRequest = {
  id: string;
  userId: string;
  userEmail?: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
};

export function listErasureRequests(brandingConfig: unknown): ErasureRequest[] {
  const dg = (brandingConfig as { dataGovernance?: { erasureRequests?: ErasureRequest[] } })
    ?.dataGovernance;
  return dg?.erasureRequests ?? [];
}

export function appendErasureRequest(
  brandingConfig: Record<string, unknown>,
  req: ErasureRequest,
): Record<string, unknown> {
  const dg = (brandingConfig.dataGovernance as Record<string, unknown>) || {};
  const list = (dg.erasureRequests as ErasureRequest[]) ?? [];
  return {
    ...brandingConfig,
    dataGovernance: {
      ...dg,
      erasureRequests: [...list, req],
    },
  };
}

export function updateErasureRequestStatus(
  brandingConfig: Record<string, unknown>,
  requestId: string,
  status: ErasureRequest["status"],
  processedBy: string,
): Record<string, unknown> | null {
  const dg = (brandingConfig.dataGovernance as Record<string, unknown>) || {};
  const list = (dg.erasureRequests as ErasureRequest[]) ?? [];
  let found = false;
  const next = list.map((r) => {
    if (r.id !== requestId) return r;
    found = true;
    return {
      ...r,
      status,
      processedAt: new Date().toISOString(),
      processedBy,
    };
  });
  if (!found) return null;
  return {
    ...brandingConfig,
    dataGovernance: { ...dg, erasureRequests: next },
  };
}

export async function anonymizeUserData(userId: string, orgId: number): Promise<void> {
  await db
    .update(usersTable)
    .set({
      email: `deleted-${userId.slice(0, 8)}@anonymized.local`,
      firstName: "Deleted",
      lastName: "User",
      profileImageUrl: null,
      preferences: {},
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));

  await db.delete(notifications).where(eq(notifications.userId, userId));

  const orgProfiles = await storage.getProfiles(orgId);
  const profile = orgProfiles.find((p) => p.userId === userId);
  if (profile) {
    await db
      .update(profiles)
      .set({
        jobTitle: null,
        department: null,
      })
      .where(eq(profiles.id, profile.id));
  }

  await logOrgAuditEvent({
    orgId,
    actorUserId: userId,
    action: "data.erasure_completed",
    targetUserId: userId,
    metadata: { anonymized: true },
  });
}
