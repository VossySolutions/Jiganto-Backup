import { eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { profiles, userRoles } from "@shared/schema";
import type { ModulePermissions } from "@shared/schema";
import type { PlatformRole } from "@shared/models/permissions";
import {
  apiPathToModuleKey,
  CLIENT_WORKSPACE_BLOCKED_MODULE_KEYS,
} from "@shared/models/module-access";

export type ModulePermissionRow = {
  moduleKey: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function modulePermissionsFromRoleJson(
  permissions: ModulePermissions | null | undefined,
): ModulePermissionRow[] {
  if (!permissions || typeof permissions !== "object") return [];
  return Object.entries(permissions).map(([moduleKey, p]) => ({
    moduleKey,
    canRead: !!p?.read,
    canCreate: !!p?.write,
    canUpdate: !!p?.write,
    canDelete: !!p?.write,
  }));
}

async function getProfileById(profileId: number) {
  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  return row;
}

/** Apply legacy module role template to a user profile. */
export async function applyRoleModulePermissionsToProfile(
  profileId: number,
  tenantId: number,
  roleId: number,
): Promise<void> {
  const [role] = await db.select().from(userRoles).where(eq(userRoles.id, roleId)).limit(1);
  const rows = modulePermissionsFromRoleJson(
    (role?.permissions as ModulePermissions) ?? undefined,
  );
  if (rows.length === 0) return;
  await storage.upsertUserModulePermissions(profileId, tenantId, rows);
}

/** Visible module keys for sidebar; `null` = no ACL restriction (platform role default). */
export async function resolveVisibleModuleKeys(
  profileId: number,
  tenantId: number,
  platformRole: PlatformRole,
  workspaceClientId?: number,
): Promise<string[] | null> {
  if (
    platformRole === "jiganto_staff" ||
    platformRole === "si_super_admin" ||
    platformRole === "client_jiganto_user"
  ) {
    return null;
  }

  const rows = await storage.getUserModulePermissions(profileId);
  let keys: string[];

  if (rows.length > 0) {
    keys = rows.filter((r) => r.canRead).map((r) => r.moduleKey);
  } else {
    const profile = await getProfileById(profileId);
    if (!profile?.roleId) return null;

    const [role] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.id, profile.roleId))
      .limit(1);
    const fromRole = modulePermissionsFromRoleJson(
      (role?.permissions as ModulePermissions) ?? undefined,
    );
    if (fromRole.length === 0) return null;
    keys = fromRole.filter((p) => p.canRead).map((p) => p.moduleKey);
  }

  if (
    workspaceClientId != null &&
    (platformRole === "client_project_user" || platformRole === "client_executive")
  ) {
    keys = keys.filter((k) => !CLIENT_WORKSPACE_BLOCKED_MODULE_KEYS.has(k));
  }

  return keys;
}

export async function profileHasExplicitModuleAcl(profileId: number): Promise<boolean> {
  const rows = await storage.getUserModulePermissions(profileId);
  return rows.length > 0;
}

export async function canAccessModuleApi(
  profileId: number,
  tenantId: number,
  platformRole: PlatformRole,
  apiPath: string,
  method: string,
): Promise<boolean> {
  const moduleKey = apiPathToModuleKey(apiPath);
  if (!moduleKey) return true;

  if (
    platformRole === "jiganto_staff" ||
    platformRole === "si_super_admin" ||
    platformRole === "client_jiganto_user"
  ) {
    return true;
  }

  const rows = await storage.getUserModulePermissions(profileId);
  let effective: ModulePermissionRow[];

  if (rows.length > 0) {
    effective = rows.map((r) => ({
      moduleKey: r.moduleKey,
      canRead: r.canRead,
      canCreate: r.canCreate,
      canUpdate: r.canUpdate,
      canDelete: r.canDelete,
    }));
  } else {
    const profile = await getProfileById(profileId);
    if (!profile?.roleId) return true;
    const [role] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.id, profile.roleId))
      .limit(1);
    effective = modulePermissionsFromRoleJson(
      (role?.permissions as ModulePermissions) ?? undefined,
    );
    if (effective.length === 0) return true;
  }

  const row = effective.find((r) => r.moduleKey === moduleKey);
  if (!row) return false;

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return row.canRead;
  }
  if (method === "DELETE") return row.canDelete;
  if (method === "POST") return row.canCreate;
  return row.canUpdate;
}
