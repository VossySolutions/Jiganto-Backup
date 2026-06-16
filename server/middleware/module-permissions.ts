import type { Request, Response, NextFunction } from "express";
import { isApiRequest } from "../lib/request-paths";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import { apiPathToModuleKey } from "@shared/models/module-access";
import { canAccessModuleApi } from "../lib/module-access";
import { modulePermissionsCache } from "../lib/module-permissions-cache";
import { storage } from "../storage";
const EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/login",
  "/api/logout",
  "/api/settings/",
  "/api/tenants",
  "/api/clients",
  "/api/org-memberships",
  "/api/client-workspace-grants",
  "/api/feedback",
];

/**
 * Enforce per-user module ACL for SI consultants and client roles when module permissions exist.
 */
export async function enforceModulePermissions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isApiRequest(req.path)) return next();
  if (!isRequestAuthenticated(req)) return next();
  if (EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) return next();
  if (!apiPathToModuleKey(req.path)) return next();

  const perms = req.permissions;
  if (!perms) return next();

  try {
    let profile = modulePermissionsCache.getProfile(perms.userId, perms.orgId);
    if (profile === undefined) {
      const loaded = await storage.getProfileByUserId(perms.userId, perms.orgId);
      profile = loaded ?? null;
      modulePermissionsCache.setProfile(perms.userId, perms.orgId, profile);
    }
    if (!profile) return next();

    const allowed = await canAccessModuleApi(
      profile.id,
      perms.orgId,
      perms.platformRole,
      req.path,
      req.method,
    );
    if (!allowed) {
      res.status(403).json({
        message: "Your role does not have access to this module.",
        moduleKey: apiPathToModuleKey(req.path),
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
