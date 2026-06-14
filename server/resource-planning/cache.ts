const store = new Map<string, { data: unknown; expires: number }>();
const DEFAULT_TTL_MS = 30_000;

export async function rpCached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.data as T;
  const data = await fn();
  store.set(key, { data, expires: now + ttlMs });
  return data;
}

export function invalidateRpTenantCache(tenantId: number): void {
  const prefix = `${tenantId}:`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function rpCacheKey(tenantId: number, label: string, params?: Record<string, unknown>): string {
  return `${tenantId}:${label}:${params ? JSON.stringify(params) : ""}`;
}

export { DEFAULT_TTL_MS };
