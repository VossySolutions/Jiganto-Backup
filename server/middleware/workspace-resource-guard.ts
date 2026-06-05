import type { Request, Response, NextFunction } from "express";
import { isApiRequest } from "../lib/request-paths";
import { assertRecordInWorkspace, workspaceClientId } from "../lib/workspace-access";
import { resolveClientIdForRequest } from "../lib/workspace-resolve";

const EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/login",
  "/api/logout",
  "/api/clients/pmo-dashboard",
  "/api/clients/me",
  "/api/clients/by-slug",
  "/api/org-memberships",
  "/api/client-workspace-grants",
  "/api/tenants",
  "/api/settings/",
  "/api/notifications",
  "/api/feedback",
  "/api/modules",
  "/api/surveys/by-token",
];

const LIST_SUFFIXES = ["/bulk-import", "/bulk-delete", "/reorder", "/seed-", "/dashboard-stats"];

function looksLikeListRoute(path: string, method: string): boolean {
  if (method === "GET" && !path.match(/\/\d+(\/|$)/)) return true;
  if (LIST_SUFFIXES.some((s) => path.includes(s))) return false;
  return false;
}

/**
 * Section 4 — For client workspace mode, block single-resource access when
 * the record belongs to another client (PM, CRM, tasks, boards, business, documents).
 */
export async function guardWorkspaceResourceAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isApiRequest(req.path)) return next();
  if (workspaceClientId(req) === undefined) return next();
  if (EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) return next();
  if (looksLikeListRoute(req.path, req.method)) return next();

  try {
    const recordClientId = await resolveClientIdForRequest(req);
    if (recordClientId === undefined) return next();
    if (!assertRecordInWorkspace(req, res, recordClientId)) return;
    next();
  } catch (err) {
    console.error("[workspace-guard]", req.method, req.path, err);
    next();
  }
}
