import type { Request, Response, NextFunction } from "express";
import { isApiRequest } from "../lib/request-paths";
import { workspaceClientId } from "../lib/workspace-access";
import { pool } from "../db";

/**
 * Sets Postgres session variable for RLS policies (Docs §7.1).
 * Cleared automatically at end of transaction; uses SET LOCAL per request.
 */
export async function setWorkspaceRlsContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isApiRequest(req.path)) return next();
  try {
    const scoped = workspaceClientId(req);
    const value = scoped !== undefined ? String(scoped) : "";
    await pool.query(`SELECT set_config('app.client_id', $1, false)`, [value]);
    next();
  } catch (err) {
    next(err);
  }
}
