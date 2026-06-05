import type { Request, Response } from "express";
import type { EffectivePermissions } from "./permissions";
import { PERMISSION_LEVEL_RANK, type PermissionLevel } from "@shared/models/permissions";

/** Client workspace id when request is scoped to a client; undefined in master org view. */
export function workspaceClientId(req: Request): number | undefined {
  if (req.workspace?.mode === "client" && req.workspace.clientId) {
    return req.workspace.clientId;
  }
  return undefined;
}

export function requireAuthenticated(req: Request, res: Response): string | null {
  const userId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return userId;
}

/** Org admin: si_super_admin, client_jiganto_user, jiganto_staff (Section 3). */
export function canManageOrgUsers(permissions: EffectivePermissions | undefined): boolean {
  if (!permissions) return false;
  if (permissions.isJigantoStaff) return true;
  const role = permissions.platformRole;
  return role === "si_super_admin" || role === "client_jiganto_user";
}

export function requireOrgAdmin(
  req: Request,
  res: Response,
): EffectivePermissions | null {
  const perms = req.permissions;
  if (!canManageOrgUsers(perms)) {
    res.status(403).json({
      message: "Organisation admin access required to manage users and roles.",
    });
    return null;
  }
  return perms ?? null;
}

type SettingsOrgResolve =
  | { ok: true; orgId: number }
  | { ok: false; status: number; message: string };

function staffMayAccessOrg(
  permissions: EffectivePermissions,
  orgId: number,
): boolean {
  if (permissions.isJigantoStaff) return true;
  return permissions.orgRoles.some((r) => r.orgId === orgId);
}

/** Resolve tenant/org for Settings APIs — never defaults to tenant 1. */
export function resolveSettingsOrgId(
  permissions: EffectivePermissions | undefined,
  requestedTenantId?: unknown,
): SettingsOrgResolve {
  const sessionOrgId = permissions?.orgId;
  if (!sessionOrgId || !permissions) {
    return { ok: false, status: 403, message: "Organisation context required." };
  }
  if (requestedTenantId != null && requestedTenantId !== "") {
    const n = Number(requestedTenantId);
    if (!Number.isNaN(n) && n > 0 && n !== sessionOrgId) {
      if (!staffMayAccessOrg(permissions, n)) {
        return {
          ok: false,
          status: 403,
          message: "Access denied for this organisation.",
        };
      }
      return { ok: true, orgId: n };
    }
  }
  return { ok: true, orgId: sessionOrgId };
}

/** Tenant id for module API handlers (after injectApiTenantScope). */
export function resolveApiTenantId(req: Request): number | null {
  const raw = req.query.tenantId;
  if (raw !== undefined && raw !== "") {
    const n = Number(Array.isArray(raw) ? raw[0] : raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return req.permissions?.orgId ?? null;
}

/** Returns session org id or sends 403. */
export function requireSettingsOrgId(
  req: Request,
  res: Response,
  requestedTenantId?: unknown,
): number | null {
  const requested =
    requestedTenantId ?? req.query.tenantId ?? req.query.orgId;
  const result = resolveSettingsOrgId(req.permissions, requested);
  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return null;
  }
  return result.orgId;
}

export function hasPermissionLevel(
  permissions: EffectivePermissions | undefined,
  min: PermissionLevel,
): boolean {
  if (!permissions) return false;
  if (permissions.isJigantoStaff) return true;
  return (
    PERMISSION_LEVEL_RANK[permissions.permissionLevel] >= PERMISSION_LEVEL_RANK[min]
  );
}

/**
 * Ensure a record's client_id matches active workspace (Section 4.1).
 * Returns false and sends response if denied.
 */
export function assertRecordInWorkspace(
  req: Request,
  res: Response,
  recordClientId: number | null | undefined,
): boolean {
  const scoped = workspaceClientId(req);
  if (scoped === undefined) return true;
  if (recordClientId == null) {
    res.status(403).json({
      message: "This resource is not available in the selected client workspace.",
    });
    return false;
  }
  if (recordClientId !== scoped) {
    res.status(403).json({ message: "Access denied for this client workspace." });
    return false;
  }
  return true;
}

/** Force clientId on create/update bodies when in client workspace mode. */
export function applyWorkspaceToBody<T extends Record<string, unknown>>(
  req: Request,
  body: T,
): T {
  const scoped = workspaceClientId(req);
  if (scoped !== undefined && "clientId" in body) {
    return { ...body, clientId: scoped };
  }
  if (scoped !== undefined) {
    return { ...body, clientId: scoped };
  }
  return body;
}
