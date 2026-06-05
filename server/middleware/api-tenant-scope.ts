import type { Request, Response, NextFunction } from "express";
import { isApiRequest } from "../lib/request-paths";

const EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/login",
  "/api/logout",
  "/api/feedback",
];

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function parseTenantId(raw: unknown): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function staffMayUseOrg(
  perms: NonNullable<Request["permissions"]>,
  orgId: number,
): boolean {
  if (!perms.isJigantoStaff) return false;
  if (perms.orgId === orgId) return true;
  return perms.orgRoles.some((r) => r.orgId === orgId);
}

/**
 * Bind tenantId to session org; staff may pass ?tenantId= for another org they can access.
 * Stamps mutation bodies when tenantId is omitted.
 */
export function injectApiTenantScope(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isApiRequest(req.path)) return next();
  if (EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  const perms = req.permissions;
  const sessionOrgId = perms?.orgId;
  if (!sessionOrgId) return next();

  const query = req.query as Record<string, string | string[] | undefined>;
  const requested = parseTenantId(query.tenantId);

  let effectiveOrgId = sessionOrgId;

  if (requested !== undefined && requested !== sessionOrgId) {
    const allowed =
      staffMayUseOrg(perms, requested) ||
      perms.orgRoles.some((r) => r.orgId === requested);
    if (!allowed) {
      res.status(403).json({ message: "Access denied for this organisation." });
      return;
    }
    effectiveOrgId = requested;
  }

  query.tenantId = String(effectiveOrgId);

  if (
    MUTATION_METHODS.has(req.method) &&
    req.body &&
    typeof req.body === "object" &&
    !Array.isArray(req.body)
  ) {
    const body = req.body as Record<string, unknown>;
    const bodyTenant = parseTenantId(body.tenantId);
    if (bodyTenant === undefined) {
      body.tenantId = effectiveOrgId;
    } else if (bodyTenant !== effectiveOrgId) {
      res.status(403).json({ message: "Access denied for this organisation." });
      return;
    }
  }

  next();
}
