import type { Request, Response } from "express";
import type { EffectivePermissions } from "../lib/permissions";
import type { PlatformRole } from "@shared/models/permissions";

export function getClientUserId(req: Request): string | null {
  return (
    (req.user as { claims?: { sub?: string } })?.claims?.sub ??
    (req.user as { id?: string })?.id ??
    null
  );
}

export function canAccessClientsModule(
  permissions: EffectivePermissions | undefined,
): boolean {
  if (!permissions) return false;
  if (permissions.isJigantoStaff) return true;
  const role = permissions.platformRole;
  if (role === "client_project_user" || role === "client_executive") return false;
  return role === "si_super_admin" || role === "si_consultant_pm" || role === "jiganto_staff";
}

export function canCreateClient(permissions: EffectivePermissions | undefined): boolean {
  if (!permissions) return false;
  if (permissions.isJigantoStaff) return true;
  return permissions.platformRole === "si_super_admin";
}

export function canDeleteClient(permissions: EffectivePermissions | undefined): boolean {
  return canCreateClient(permissions);
}

export function canManageClientMembers(permissions: EffectivePermissions | undefined): boolean {
  if (!permissions) return false;
  if (permissions.isJigantoStaff) return true;
  return (
    permissions.platformRole === "si_super_admin" ||
    permissions.platformRole === "si_consultant_pm"
  );
}

export function requireClientsAccess(
  req: Request,
  res: Response,
): EffectivePermissions | null {
  const perms = req.permissions;
  if (!canAccessClientsModule(perms)) {
    res.status(403).json({ message: "Clients module is not available for your role." });
    return null;
  }
  return perms ?? null;
}

export function isSiRole(role: PlatformRole | undefined): boolean {
  return (
    role === "si_super_admin" ||
    role === "si_consultant_pm" ||
    role === "jiganto_staff"
  );
}
