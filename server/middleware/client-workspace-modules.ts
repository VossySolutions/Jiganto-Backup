import type { Request, Response, NextFunction } from "express";
import { isApiRequest } from "../lib/request-paths";
import { workspaceClientId } from "../lib/workspace-access";

/**
 * SI-internal API prefixes blocked for CLIENT-role users in workspace mode (Docs §5).
 * SI roles (si_super_admin, si_consultant_pm, jiganto_staff) are NOT blocked here —
 * they can still manage workspaces via API even when a workspace is active.
 * Sidebar visibility is handled separately (client-side).
 */
const SI_INTERNAL_PREFIXES = [
  "/api/business",
  "/api/crm",
  "/api/finance",
  "/api/customer-mgmt",
];

/**
 * /api/clients is a management API — SI roles must always be able to use it
 * (create, list, archive, switch context) regardless of active workspace.
 * It is only blocked for pure client-role users who should never see it.
 */
const CLIENT_ROLE_ALWAYS_BLOCKED_PREFIXES = [
  "/api/business",
  "/api/crm",
  "/api/finance",
  "/api/customer-mgmt",
  "/api/clients",
];

/** Additional prefixes blocked for client-role users. */
const CLIENT_ROLE_BLOCKED_PREFIXES = [
  "/api/resources",
  "/api/bpm",
  "/api/tm",
  "/api/portal",
  "/api/frameworks",
  "/api/org-chart",
  "/api/org-charts",
  "/api/org-chart-templates",
  "/api/workspaces",
  "/api/surveys",
  "/api/signoff",
  "/api/admin/",
];

const SI_ROLES = new Set([
  "si_super_admin",
  "si_consultant_pm",
  "jiganto_staff",
]);

const CLIENT_ROLES = new Set([
  "client_project_user",
  "client_executive",
  "client_jiganto_user",
]);

function blockModule(
  req: Request,
  res: Response,
  prefixes: string[],
): boolean {
  if (!prefixes.some((p) => req.path.startsWith(p))) return false;
  if (req.method === "GET") {
    res.json([]);
    return true;
  }
  res.status(403).json({
    message: "This module is not available in client workspace view.",
  });
  return true;
}

/**
 * In a client workspace:
 *   - SI roles: SI-internal data modules (business, crm, finance, customer-mgmt)
 *     are blocked to prevent leaking internal data. The /api/clients management API
 *     remains accessible so SI users can still manage workspaces.
 *   - Client roles: additionally blocked from /api/clients and tenant-wide modules.
 */
export function restrictClientWorkspaceModules(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isApiRequest(req.path)) return next();

  const scoped = workspaceClientId(req);
  const role = req.permissions?.platformRole;
  const isJigantoStaff = req.permissions?.isJigantoStaff ?? false;

  if (scoped !== undefined) {
    if (CLIENT_ROLES.has(role ?? "") && !isJigantoStaff) {
      // Client-role users: block all SI-internal prefixes including /api/clients
      if (blockModule(req, res, CLIENT_ROLE_ALWAYS_BLOCKED_PREFIXES)) return;
      if (blockModule(req, res, CLIENT_ROLE_BLOCKED_PREFIXES)) return;
    } else if (SI_ROLES.has(role ?? "") || isJigantoStaff) {
      // SI roles: only block SI-internal data modules, not /api/clients management
      if (blockModule(req, res, SI_INTERNAL_PREFIXES)) return;
    }
  }

  next();
}
