import type { Request, Response, NextFunction } from "express";
import { isApiRequest } from "../lib/request-paths";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const READONLY_CLIENT_STATUSES = new Set(["archived", "pending_delete"]);

/** Mutations still allowed inside a read-only archived workspace. */
const READONLY_EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/login",
  "/api/logout",
  "/api/clients/workspace-context",
];

/**
 * Block writes when the active client workspace is archived or pending deletion (Docs §6.3).
 * Read-only is enforced server-side in addition to the client apiReadOnly guard.
 */
export function enforceArchivedWorkspaceReadOnly(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isApiRequest(req.path)) return next();
  if (!MUTATION_METHODS.has(req.method)) return next();
  if (READONLY_EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  const client = req.workspace?.client;
  if (!client) return next();
  if (!READONLY_CLIENT_STATUSES.has(client.status)) return next();

  res.status(403).json({
    message: "This workspace is read-only (archived). Restore it to make changes.",
    code: "WORKSPACE_READ_ONLY",
  });
}
