import type { Request, Response, NextFunction } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { isApiRequest } from "../lib/request-paths";
import { workspaceClientId } from "../lib/workspace-access";
import { crmAccounts } from "@shared/models/crm";
import { pmProjects } from "@shared/models/projects";
import { boards } from "@shared/schema";

const EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/login",
  "/api/clients",
  "/api/org-memberships",
  "/api/tenants",
  "/api/settings/",
  "/api/notifications",
];

function recordClientId(record: Record<string, unknown>): number | null | undefined {
  if (record.clientId !== undefined) return record.clientId as number | null;
  if (record.client_id !== undefined) return record.client_id as number | null;
  if (record.workspaceId !== undefined) return record.workspaceId as number | null;
  return undefined;
}

function isScopedRecord(record: unknown): record is Record<string, unknown> {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  const r = record as Record<string, unknown>;
  return "clientId" in r || "client_id" in r || "workspaceId" in r;
}

function getOrgId(req: Request): number | null {
  const orgId = (req.permissions as any)?.orgId;
  return typeof orgId === "number" && Number.isFinite(orgId) ? orgId : null;
}

function readAccountId(item: unknown): number | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const r = item as Record<string, unknown>;
  const v = r.accountId ?? r.account_id ?? r.convertedAccountId ?? r.converted_account_id;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readProjectId(item: unknown): number | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const r = item as Record<string, unknown>;
  const v = r.projectId ?? r.project_id;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readBoardId(item: unknown): number | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const r = item as Record<string, unknown>;
  const v = r.boardId ?? r.board_id;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function filterArray(req: Request, arr: unknown[], scoped: number): Promise<unknown[]> {
  if (arr.length === 0) return arr;

  // Fast path: if the handler already returned a scoped record, filter normally.
  if (isScopedRecord(arr[0])) {
    return arr.filter((item) => {
      if (!isScopedRecord(item)) return false;
      const cid = recordClientId(item);
      return cid === scoped;
    });
  }

  // Slow-but-safe path: infer scope using common foreign keys (accountId/projectId/boardId).
  const orgId = getOrgId(req);
  if (orgId == null) return arr;

  // accountId-based rows (CRM lists like contacts/tasks/notes may not expose clientId)
  const anyHasAccount = readAccountId(arr[0]) != null;
  if (anyHasAccount) {
    const accountIds = [
      ...new Set(arr.map((x) => readAccountId(x)).filter((n): n is number => n != null)),
    ];
    if (accountIds.length === 0) return arr;
    const rows = await db
      .select({ id: crmAccounts.id, clientId: crmAccounts.clientId })
      .from(crmAccounts)
      .where(and(eq(crmAccounts.tenantId, orgId), inArray(crmAccounts.id, accountIds)));
    const accountToClientId = new Map(rows.map((r) => [r.id, r.clientId]));
    return arr.filter((item) => {
      const aid = readAccountId(item);
      if (aid == null) return false;
      const cid = accountToClientId.get(aid);
      return cid === scoped;
    });
  }

  // projectId-based rows (PM lists that may omit clientId)
  const anyHasProject = readProjectId(arr[0]) != null;
  if (anyHasProject) {
    const projectIds = [
      ...new Set(arr.map((x) => readProjectId(x)).filter((n): n is number => n != null)),
    ];
    if (projectIds.length === 0) return arr;
    const rows = await db
      .select({ id: pmProjects.id, clientId: pmProjects.clientId })
      .from(pmProjects)
      .where(and(eq(pmProjects.tenantId, orgId), inArray(pmProjects.id, projectIds)));
    const projectToClientId = new Map(rows.map((r) => [r.id, r.clientId]));
    return arr.filter((item) => {
      const pid = readProjectId(item);
      if (pid == null) return false;
      const cid = projectToClientId.get(pid);
      return cid === scoped;
    });
  }

  // boardId-based rows (tasks board lists)
  const anyHasBoard = readBoardId(arr[0]) != null;
  if (anyHasBoard) {
    const boardIds = [
      ...new Set(arr.map((x) => readBoardId(x)).filter((n): n is number => n != null)),
    ];
    if (boardIds.length === 0) return arr;
    const rows = await db
      .select({ id: boards.id, workspaceId: boards.workspaceId })
      .from(boards)
      .where(and(eq(boards.tenantId, orgId), inArray(boards.id, boardIds)));
    const boardToWorkspaceId = new Map(rows.map((r) => [r.id, r.workspaceId]));
    return arr.filter((item) => {
      const bid = readBoardId(item);
      if (bid == null) return false;
      const wid = boardToWorkspaceId.get(bid);
      return wid === scoped;
    });
  }

  return arr;
}

async function filterPayload(req: Request, body: unknown, scoped: number): Promise<unknown> {
  if (Array.isArray(body)) return filterArray(req, body, scoped);

  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;

    if (Array.isArray(obj.clients)) {
      return { ...obj, clients: await filterArray(req, obj.clients, scoped) };
    }
    if (Array.isArray(obj.data)) {
      return { ...obj, data: await filterArray(req, obj.data, scoped) };
    }

    if (isScopedRecord(obj)) {
      const cid = recordClientId(obj);
      if (cid != null && cid !== scoped) return null;
    }
  }

  return body;
}

/**
 * Filter list API responses to active client workspace when objects expose clientId/workspaceId.
 * Section 4.1 — defence in depth when a route handler forgot to filter.
 */
export function filterWorkspaceResponses(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isApiRequest(req.path) || req.method !== "GET") return next();
  if (EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  const scoped = workspaceClientId(req);
  if (scoped === undefined) return next();

  const originalJson = res.json.bind(res);
  res.json = function workspaceFilteredJson(body: unknown) {
    if (res.statusCode >= 400) return originalJson(body);

    void (async () => {
      const filtered = await filterPayload(req, body, scoped);
      if (filtered === null) {
        res.status(403).json({ message: "Access denied for this client workspace." });
        return;
      }
      originalJson(filtered);
    })().catch((err) => {
      // Never hard-fail requests due to filtering; log and return the unfiltered response.
      // (Isolation is still enforced by handler asserts/mutations; this is defence-in-depth.)
      console.error("[workspace-response-filter]", err);
      originalJson(body);
    });

    // The response is sent asynchronously by the wrapper above.
    return res;
  };

  next();
}
