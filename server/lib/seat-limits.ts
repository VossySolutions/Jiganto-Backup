import type { Tenant } from "@shared/schema";
import { storage } from "../storage";

export function getLicensedSeatCount(tenant: Tenant | null | undefined): number | null {
  const seats = (tenant?.brandingConfig as { billing?: { seatCount?: number } })?.billing
    ?.seatCount;
  if (seats == null || seats <= 0) return null;
  return seats;
}

export async function countSeatsInUse(tenantId: number): Promise<number> {
  const profiles = await storage.getProfiles(tenantId);
  const invitations = await storage.getUserInvitations(tenantId);
  const pendingInvites = invitations.filter((i) => i.status === "pending").length;
  return profiles.length + pendingInvites;
}

export async function assertSeatAvailable(tenantId: number): Promise<void> {
  const tenant = await storage.getTenant(tenantId);
  const licensed = getLicensedSeatCount(tenant);
  if (licensed == null) return;
  const used = await countSeatsInUse(tenantId);
  if (used >= licensed) {
    throw new Error(
      `Seat limit reached (${used}/${licensed}). Increase licensed seats in Settings → Billing or revoke pending invites.`,
    );
  }
}
