import type { Request, Response, NextFunction } from "express";
import { isApiRequest } from "../lib/request-paths";
import { workspaceClientId } from "../lib/workspace-access";

/** SI-internal modules with no client_id — hidden for client roles in client workspace view. */
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

const CLIENT_ROLES = new Set([
  "client_project_user",
  "client_executive",
  "client_jiganto_user",
]);

/**
 * Client users in a scoped workspace cannot access tenant-wide SI modules (Section 4).
 * SI staff retain access when switching into a client context.
 */
export function restrictClientWorkspaceModules(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isApiRequest(req.path)) return next();
  if (workspaceClientId(req) === undefined) return next();

  const role = req.permissions?.platformRole;
  if (!role || !CLIENT_ROLES.has(role)) return next();
  if (role === "client_jiganto_user") return next();

  if (!CLIENT_ROLE_BLOCKED_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  if (req.method === "GET") {
    res.json([]);
    return;
  }
  res.status(403).json({
    message: "This module is not available in client workspace view.",
  });
}
