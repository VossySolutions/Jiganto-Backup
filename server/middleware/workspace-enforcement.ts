import type { Request, Response, NextFunction } from "express";
import { isApiRequest } from "../lib/request-paths";
import { workspaceClientId } from "../lib/workspace-access";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH"]);

const EXEMPT_MUTATION_PREFIXES = [
  "/api/login",
  "/api/logout",
  "/api/auth/",
  "/api/clients/pmo-dashboard",
  "/api/surveys/by-token",
  "/api/org-memberships",
  "/api/client-workspace-grants",
  "/api/settings/",
  "/api/tenants",
  "/api/feedback",
  "/api/notifications",
];

function isClientScopedMutation(path: string, method: string): boolean {
  if (!MUTATION_METHODS.has(method)) return false;
  if (!path.startsWith("/api/")) return false;
  if (EXEMPT_MUTATION_PREFIXES.some((p) => path.startsWith(p))) return false;
  return true;
}

/**
 * When in client workspace mode, stamp clientId on mutation bodies (Section 4.1).
 * Rejects explicit clientId that does not match the active workspace.
 */
export function enforceWorkspaceMutations(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isApiRequest(req.path)) return next();
  if (!isClientScopedMutation(req.path, req.method)) return next();

  const scoped = workspaceClientId(req);
  if (scoped === undefined) return next();

  const body = req.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const b = body as Record<string, unknown>;
    if (b.clientId !== undefined && b.clientId !== null && Number(b.clientId) !== scoped) {
      res.status(403).json({
        message: "Cannot modify data for another client workspace.",
      });
      return;
    }
    if (pathMayUseClientId(req.path)) {
      b.clientId = scoped;
    }
    if (pathMayUseWorkspaceId(req.path)) {
      b.workspaceId = scoped;
    }
  }

  next();
}

function pathMayUseClientId(path: string): boolean {
  return path.startsWith("/api/") && !path.startsWith("/api/auth/");
}

function pathMayUseWorkspaceId(path: string): boolean {
  return path.includes("/boards") || path.includes("/api/boards");
}
