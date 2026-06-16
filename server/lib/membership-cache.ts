import type { orgMemberships } from "@shared/models/permissions";

type MembershipRow = typeof orgMemberships.$inferSelect;

const TTL_MS = 30_000;
const cache = new Map<string, { expiresAt: number; value: MembershipRow[] }>();

export const membershipCache = {
  get(userId: string): MembershipRow[] | null {
    const entry = cache.get(userId);
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return entry.value;
  },
  set(userId: string, value: MembershipRow[]): void {
    cache.set(userId, { expiresAt: Date.now() + TTL_MS, value });
  },
  invalidate(userId: string): void {
    cache.delete(userId);
  },
};
