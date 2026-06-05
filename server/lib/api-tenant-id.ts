import type { Request, Response } from "express";
import { resolveApiTenantId } from "./workspace-access";

/** Organisation id for the current API request (query, after scope middleware). */
export function getApiTenantId(req: Request): number | null {
  return resolveApiTenantId(req);
}

/**
 * Tenant id for handlers that historically defaulted to `1`.
 * Prefer checking null and returning 403 on authenticated routes.
 */
export function getApiTenantIdWithFallback(req: Request, fallback = 1): number {
  return getApiTenantId(req) ?? fallback;
}

/** Returns tenant id or sends 403 — use on authenticated module routes. */
export function requireApiTenantId(req: Request, res: Response): number | null {
  const tenantId = getApiTenantId(req);
  if (tenantId == null) {
    res.status(403).json({ message: "Organisation context required." });
    return null;
  }
  return tenantId;
}
