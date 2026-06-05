import type { Request, Response, NextFunction } from "express";
import {
  resolveUserPermissions,
  resolveSessionOrgId,
  parseRequestedOrgId,
  canMutateApi,
  hasActiveOrgMembership,
  type EffectivePermissions,
} from "../lib/permissions";
import { isApiRequest } from "../lib/request-paths";
import { effectiveUserId } from "../auth/impersonationRoutes";
import { isRequestAuthenticated } from "../auth/supabaseAuth";

declare global {
  namespace Express {
    interface Request {
      permissions?: EffectivePermissions;
    }
  }
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const WRITE_EXEMPT_PREFIXES = [
  "/api/login",
  "/api/logout",
  "/api/auth/impersonation",
  "/api/auth/roles",
  "/api/auth/session",
  "/api/auth/bootstrap-admin",
  "/api/auth/clear-dev-session",
  "/api/auth/invitations/",
  "/api/feedback",
];

const MEMBERSHIP_EXEMPT_PREFIXES = [
  "/api/auth/config",
  "/api/auth/user",
  "/api/auth/access",
  "/api/auth/bootstrap-admin",
  "/api/auth/clear-dev-session",
  "/api/auth/invitations/",
  "/api/logout",
  "/api/feedback",
];

function isExemptFromReadOnlyGuard(path: string): boolean {
  return WRITE_EXEMPT_PREFIXES.some((p) => path.startsWith(p));
}

/** Attach resolved permissions to req.permissions (per Section 3.1). */
export async function attachPermissionContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isApiRequest(req.path)) {
    return next();
  }
  if (!isRequestAuthenticated(req)) {
    return next();
  }

  try {
    const userId = effectiveUserId(req);
    if (!userId) return next();

    const requested = parseRequestedOrgId(req.query);
    const orgId = await resolveSessionOrgId(userId, requested);
    if (orgId != null) {
      req.permissions = await resolveUserPermissions(userId, orgId);
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require at least one org_membership for authenticated users.
 * Allows auth/invitation endpoints so a new user can accept invite first.
 */
export async function enforceOrgMembershipAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isApiRequest(req.path)) return next();
  if (!isRequestAuthenticated(req)) return next();
  if (MEMBERSHIP_EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  const userId = effectiveUserId(req);
  if (!userId) return next();

  try {
    const hasMembership = await hasActiveOrgMembership(userId);
    if (!hasMembership) {
      res.status(403).json({
        message: "Account is authenticated but not assigned to an organisation yet.",
        code: "ACCESS_PENDING",
      });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Enforce read-only at API level (Section 3.1): viewer roles may only use GET/HEAD/OPTIONS.
 */
export function enforceReadOnlyApiAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isApiRequest(req.path)) return next();
  if (!isRequestAuthenticated(req)) return next();
  if (!MUTATION_METHODS.has(req.method)) return next();
  if (isExemptFromReadOnlyGuard(req.path)) return next();

  const perms = req.permissions;
  if (!perms) return next();

  if (!canMutateApi(perms)) {
    res.status(403).json({
      message: "Read-only access: your role cannot create or modify data.",
      role: perms.platformRole,
    });
    return;
  }

  next();
}
