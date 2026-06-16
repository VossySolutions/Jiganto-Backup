import type { profiles } from "@shared/schema";
import type { ModulePermissionRow } from "./module-access";

const TTL_MS = 60_000;

type ProfileRow = typeof profiles.$inferSelect;

const moduleRowsCache = new Map<string, { expiresAt: number; value: ModulePermissionRow[] }>();
const profileCache = new Map<string, { expiresAt: number; value: ProfileRow | null }>();

function moduleKey(profileId: number): string {
  return String(profileId);
}

function profileKey(userId: string, orgId: number): string {
  return `${userId}:${orgId}`;
}

export const modulePermissionsCache = {
  getModuleRows(profileId: number): ModulePermissionRow[] | null {
    const entry = moduleRowsCache.get(moduleKey(profileId));
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return entry.value;
  },
  setModuleRows(profileId: number, value: ModulePermissionRow[]): void {
    moduleRowsCache.set(moduleKey(profileId), {
      expiresAt: Date.now() + TTL_MS,
      value,
    });
  },
  getProfile(userId: string, orgId: number): ProfileRow | null | undefined {
    const entry = profileCache.get(profileKey(userId, orgId));
    if (!entry || entry.expiresAt <= Date.now()) return undefined;
    return entry.value;
  },
  setProfile(userId: string, orgId: number, value: ProfileRow | null): void {
    profileCache.set(profileKey(userId, orgId), {
      expiresAt: Date.now() + TTL_MS,
      value,
    });
  },
  invalidateUser(userId: string): void {
    for (const k of profileCache.keys()) {
      if (k.startsWith(`${userId}:`)) profileCache.delete(k);
    }
  },
  invalidateProfile(profileId: number): void {
    moduleRowsCache.delete(moduleKey(profileId));
  },
};
