import type { Request, Response, NextFunction } from "express";
import { isApiRequest } from "../lib/request-paths";
import {
  resolveWorkspaceContext,
  resolveRequestedClientId,
  WorkspaceAccessError,
  type WorkspaceContext,
} from "../lib/workspace-context";
import { effectiveUserId } from "../auth/impersonationRoutes";
import { isRequestAuthenticated } from "../auth/supabaseAuth";

declare global {
  namespace Express {
    interface Request {
      workspace?: WorkspaceContext;
    }
  }
}

const WORKSPACE_EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/login",
  "/api/logout",
];

/** Attach workspace scope for API routes (Section 4.1). */
export async function attachWorkspaceContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isApiRequest(req.path)) {
    return next();
  }
  if (WORKSPACE_EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) {
    return next();
  }
  if (!isRequestAuthenticated(req)) {
    return next();
  }

  const userId = effectiveUserId(req);
  if (!userId) {
    return next();
  }

  const tenantId = req.permissions?.orgId;
  if (!tenantId) {
    return next();
  }

  try {
    const requested = resolveRequestedClientId(
      req.query as Record<string, unknown>,
      req.session?.activeClientId,
      req.headers["x-workspace-id"],
    );
    req.workspace = await resolveWorkspaceContext(
      userId,
      tenantId,
      req.permissions,
      requested,
    );
    next();
  } catch (err) {
    if (err instanceof WorkspaceAccessError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    next(err);
  }
}

/** Require master org view (PMO dashboard, Section 4.3). */
export function requireMasterWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ws = req.workspace;
  if (!ws) return next();
  if (ws.mode !== "master") {
    res.status(403).json({
      message: "PMO master view requires organisation context (exit client workspace).",
    });
    return;
  }
  if (!ws.canViewPmoMaster) {
    res.status(403).json({
      message: "Your role cannot access the PMO master view.",
    });
    return;
  }
  next();
}
