import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  orgMemberships,
  type PlatformRole,
  type PermissionLevel,
  PLATFORM_ROLES,
  permissionLevelForRole,
  maxPermissionLevel,
  isReadOnlyRole,
  showContextSwitcherForRole,
  canAccessMultipleWorkspaces,
  canViewPmoMasterForRole,
  mapLegacyClientRole,
  PERMISSION_LEVEL_RANK,
} from "@shared/models/permissions";
import { userRoles } from "@shared/schema";

export interface EffectivePermissions {
  userId: string;
  orgId: number;
  platformRole: PlatformRole;
  permissionLevel: PermissionLevel;
  isReadOnly: boolean;
  showContextSwitcher: boolean;
  canAccessMultipleWorkspaces: boolean;
  canViewPmoMaster: boolean;
  lockedWorkspaceId: number | null;
  isJigantoStaff: boolean;
  /** All active org roles (additive — effective uses highest level). */
  orgRoles: { orgId: number; platformRole: PlatformRole }[];
}

function parsePlatformRole(value: string): PlatformRole | null {
  return (PLATFORM_ROLES as readonly string[]).includes(value)
    ? (value as PlatformRole)
    : null;
}

let cachedStaffUserIds: Set<string> | null = null;

function staffUserIdsFromEnv(): Set<string> {
  if (cachedStaffUserIds) return cachedStaffUserIds;
  const raw = process.env.JIGANTO_STAFF_USER_IDS ?? "";
  cachedStaffUserIds = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return cachedStaffUserIds;
}

export function isJigantoStaffUserId(userId: string): boolean {
  return staffUserIdsFromEnv().has(userId);
}

import { permissionCache } from "./permissions-cache";
import { membershipCache } from "./membership-cache";

function isMissingRelationError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42P01"
  );
}

/** Load org_memberships rows; empty if table not migrated yet. */
async function loadOrgMemberships(userId: string) {
  const cached = membershipCache.get(userId);
  if (cached) return cached;

  try {
    const rows = await db
      .select()
      .from(orgMemberships)
      .where(and(eq(orgMemberships.userId, userId), eq(orgMemberships.isActive, true)));
    membershipCache.set(userId, rows);
    return rows;
  } catch (err) {
    if (isMissingRelationError(err)) {
      console.warn(
        "[permissions] org_memberships table missing — run npm run db:push or scripts/sql/permissions-tables.sql",
      );
      return [];
    }
    throw err;
  }
}

async function inferLegacyOrgRoles(
  userId: string,
  orgId: number,
): Promise<{ orgId: number; platformRole: PlatformRole }[]> {
  const inferred: { orgId: number; platformRole: PlatformRole }[] = [];
  const clientMembership = await storage.getLockedClientMembershipByUserId(userId, orgId);
  if (clientMembership) {
    inferred.push({ orgId, platformRole: mapLegacyClientRole(clientMembership.role) });
    return inferred;
  }

  const profile = await storage.getProfileByUserId(userId, orgId);
  if (profile?.roleId) {
    const [roleRow] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.id, profile.roleId))
      .limit(1);
    inferred.push({
      orgId,
      platformRole: roleRow?.isAdmin ? "si_super_admin" : "si_consultant_pm",
    });
  } else if (profile) {
    inferred.push({ orgId, platformRole: "si_consultant_pm" });
  }
  return inferred;
}

/**
 * Resolve effective permissions for a user in an organisation.
 * Rules: per-org role rows; additive across orgs → highest permission level wins for session.
 */
export async function resolveUserPermissions(
  userId: string,
  orgId: number,
): Promise<EffectivePermissions> {
  const cached = permissionCache.get(userId, orgId);
  if (cached) return cached;

  const orgRoles: { orgId: number; platformRole: PlatformRole }[] = [];
  let lockedWorkspaceId: number | null = null;

  if (isJigantoStaffUserId(userId)) {
    orgRoles.push({ orgId, platformRole: "jiganto_staff" });
  }

  const memberships = await loadOrgMemberships(userId);

  for (const row of memberships) {
    const role = parsePlatformRole(row.platformRole);
    if (!role) continue;
    orgRoles.push({ orgId: row.orgId, platformRole: role });
    if (row.orgId === orgId && row.lockedWorkspaceId) {
      lockedWorkspaceId = row.lockedWorkspaceId;
    }
  }

  if (orgRoles.length === 0 || !orgRoles.some((r) => r.orgId === orgId)) {
    orgRoles.push(...(await inferLegacyOrgRoles(userId, orgId)));
  }

  const rolesForOrg = orgRoles.filter((r) => r.orgId === orgId);
  const rolesToMerge = rolesForOrg.length > 0 ? rolesForOrg : orgRoles;

  let platformRole: PlatformRole = "client_executive";
  let permissionLevel: PermissionLevel = "read";

  for (const r of rolesToMerge) {
    const level = permissionLevelForRole(r.platformRole);
    if (PERMISSION_LEVEL_RANK[level] > PERMISSION_LEVEL_RANK[permissionLevel]) {
      permissionLevel = level;
      platformRole = r.platformRole;
    }
  }

  // Additive across all org memberships for session ceiling
  for (const r of orgRoles) {
    permissionLevel = maxPermissionLevel(
      permissionLevel,
      permissionLevelForRole(r.platformRole),
    );
    if (permissionLevelForRole(r.platformRole) === permissionLevel) {
      platformRole = r.platformRole;
    }
  }

  const isJigantoStaff =
    isJigantoStaffUserId(userId) || platformRole === "jiganto_staff";

  const result: EffectivePermissions = {
    userId,
    orgId,
    platformRole,
    permissionLevel,
    isReadOnly: isReadOnlyRole(platformRole) || permissionLevel === "read",
    showContextSwitcher: showContextSwitcherForRole(platformRole),
    canAccessMultipleWorkspaces:
      canAccessMultipleWorkspaces(platformRole) || isJigantoStaff,
    canViewPmoMaster: canViewPmoMasterForRole(platformRole) || isJigantoStaff,
    lockedWorkspaceId,
    isJigantoStaff,
    orgRoles,
  };

  permissionCache.set(userId, orgId, result);

  return result;
}

export function canMutateApi(permissions: EffectivePermissions): boolean {
  if (permissions.isJigantoStaff) return true;
  return PERMISSION_LEVEL_RANK[permissions.permissionLevel] >= PERMISSION_LEVEL_RANK.write;
}

function parseRequestedOrgId(query: {
  tenantId?: unknown;
  orgId?: unknown;
}): number | undefined {
  const raw = query.orgId ?? query.tenantId;
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isNaN(n) || n <= 0 ? undefined : n;
}

/**
 * Resolve organisation for the current session (no silent default to tenant 1).
 */
export async function resolveSessionOrgId(
  userId: string,
  requested?: number,
): Promise<number | null> {
  const memberships = await loadOrgMemberships(userId);

  if (requested != null) {
    const inMembership = memberships.some((m) => m.orgId === requested);
    if (inMembership || isJigantoStaffUserId(userId)) return requested;
  }

  if (memberships.length === 1) return memberships[0].orgId;

  if (memberships.length > 1) {
    let bestOrg = memberships[0].orgId;
    let bestRank = -1;
    for (const m of memberships) {
      const role = parsePlatformRole(m.platformRole);
      if (!role) continue;
      const rank = PERMISSION_LEVEL_RANK[permissionLevelForRole(role)];
      if (rank > bestRank) {
        bestRank = rank;
        bestOrg = m.orgId;
      }
    }
    return bestOrg;
  }

  const profile = await storage.getProfile(userId);
  if (profile?.tenantId) return profile.tenantId;

  return null;
}

export { parseRequestedOrgId };

/** True when user has at least one active org membership row. */
export async function hasActiveOrgMembership(userId: string): Promise<boolean> {
  const memberships = await loadOrgMemberships(userId);
  return memberships.length > 0;
}

/** Count of active org memberships across all users (for first-admin bootstrap). */
export async function countActiveOrgMemberships(): Promise<number> {
  try {
    const rows = await db
      .select({ id: orgMemberships.id })
      .from(orgMemberships)
      .where(eq(orgMemberships.isActive, true));
    return rows.length;
  } catch (err) {
    if (isMissingRelationError(err)) return 0;
    throw err;
  }
}
