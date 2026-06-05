import type { Request, Response, NextFunction } from "express";
import { isApiRequest } from "../lib/request-paths";
import { assertRecordInWorkspace, workspaceClientId } from "../lib/workspace-access";
import { storage } from "../storage";

const PROJECT_PATH = /^\/api\/pm\/projects\/(\d+)(?:\/|$)/;

/**
 * All routes under /api/pm/projects/:projectId/* must belong to the active client workspace.
 */
export async function guardPmProjectScope(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isApiRequest(req.path)) return next();
  if (workspaceClientId(req) === undefined) return next();

  const match = req.path.match(PROJECT_PATH);
  if (!match) return next();

  const projectId = Number(match[1]);
  if (!Number.isFinite(projectId)) return next();

  try {
    const project = await storage.getPmProject(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    if (!assertRecordInWorkspace(req, res, project.clientId)) return;
    next();
  } catch (err) {
    console.error("[pm-project-guard]", err);
    next(err);
  }
}
