import type { Request, Response, NextFunction } from "express";

/** Inject active workspace into request claims (Docs §8.2 — workspace_id in session/JWT). */
export function attachWorkspaceClaims(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const workspaceId = req.workspace?.clientId ?? null;
  const user = req.user as { claims?: Record<string, unknown> } | undefined;
  if (user?.claims) {
    user.claims.workspace_id = workspaceId;
    user.claims.workspaceId = workspaceId;
  }
  next();
}
