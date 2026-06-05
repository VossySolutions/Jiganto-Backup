import type { Request } from "express";
import { workspaceClientId } from "./workspace-access";

/** Resolve clientId for list queries from workspace context or query string. */
export function resolveListClientId(req: Request): number | undefined {
  const fromWorkspace = workspaceClientId(req);
  if (fromWorkspace !== undefined) return fromWorkspace;
  const raw = req.query.clientId;
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
