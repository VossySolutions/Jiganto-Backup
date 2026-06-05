import type { Request, Response, NextFunction } from "express";
import { isApiRequest } from "../lib/request-paths";
import { workspaceClientId } from "../lib/workspace-access";

const EXEMPT_GET_PREFIXES = [
  "/api/auth/",
  "/api/login",
  "/api/clients/pmo-dashboard",
  "/api/clients/me",
  "/api/org-memberships",
  "/api/tenants",
  "/api/settings/",
];

/**
 * In client workspace mode, inject clientId into query so list handlers can filter consistently.
 */
export function injectWorkspaceQueryScope(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!isApiRequest(req.path) || req.method !== "GET") return next();
  if (EXEMPT_GET_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  const scoped = workspaceClientId(req);
  if (scoped === undefined) return next();

  (req.query as Record<string, string>).clientId = String(scoped);
  next();
}
