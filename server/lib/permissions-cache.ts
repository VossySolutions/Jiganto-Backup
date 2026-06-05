import type { EffectivePermissions } from "./permissions";

const PERMISSION_CACHE_TTL_MS = 30_000;
const cache = new Map<
  string,
  { expiresAt: number; value: EffectivePermissions }
>();

function key(userId: string, orgId: number): string {
  return `${userId}:${orgId}`;
}

export const permissionCache = {
  get(userId: string, orgId: number): EffectivePermissions | null {
    const entry = cache.get(key(userId, orgId));
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return entry.value;
  },
  set(userId: string, orgId: number, value: EffectivePermissions): void {
    cache.set(key(userId, orgId), {
      expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS,
      value,
    });
  },
  invalidate(userId: string): void {
    for (const k of cache.keys()) {
      if (k.startsWith(`${userId}:`)) cache.delete(k);
    }
  },
};
