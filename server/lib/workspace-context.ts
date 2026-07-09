import type { Client } from "@shared/models/clients";
import { canViewPmoMasterForRole } from "@shared/models/permissions";
import { storage } from "../storage";
import type { EffectivePermissions } from "./permissions";

export type WorkspaceViewMode = "master" | "client";

export interface WorkspaceContext {
  tenantId: number;
  mode: WorkspaceViewMode;
  /** Active client workspace (`clients.id`). Null in master org view. */
  clientId: number | null;
  client: Client | null;
  /** SI roles that may use master PMO view (Section 4.3). */
  canViewPmoMaster: boolean;
}

function parseClientId(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function userMayAccessClient(
  userId: string,
  tenantId: number,
  clientId: number,
  permissions: EffectivePermissions | undefined,
): Promise<boolean> {
  if (permissions?.isJigantoStaff) return true;
  const role = permissions?.platformRole;
  if (role === "si_super_admin" || role === "client_jiganto_user") return true;
  if (role !== "si_consultant_pm") return false;

  const assigned = await storage.getAssignedClientIdsForUser(userId, tenantId);
  return assigned.includes(clientId);
}

/**
 * Resolve workspace scope from request + permissions (Section 4.1).
 * Client users are always locked to their client; SI users may use master or a client.
 */
export async function resolveWorkspaceContext(
  userId: string,
  tenantId: number,
  permissions: EffectivePermissions | undefined,
  requestedClientId: number | null,
): Promise<WorkspaceContext> {
  const platformRole = permissions?.platformRole ?? "client_executive";
  const canViewPmoMaster = canViewPmoMasterForRole(platformRole);

  const membership = await storage.getLockedClientMembershipByUserId(userId, tenantId);
  if (membership) {
    return {
      tenantId,
      mode: "client",
      clientId: membership.client.id,
      client: membership.client,
      canViewPmoMaster: false,
    };
  }

  const lockedId = permissions?.lockedWorkspaceId ?? null;
  if (lockedId) {
    const client = await storage.getClientById(lockedId, tenantId);
    if (client) {
      return {
        tenantId,
        mode: "client",
        clientId: client.id,
        client,
        canViewPmoMaster: false,
      };
    }
  }

  let clientId = requestedClientId;
  if (clientId) {
    const client = await storage.getClientById(clientId, tenantId);
    if (!client) {
      throw new WorkspaceAccessError("Workspace not found", 404);
    }
    const allowed = await userMayAccessClient(userId, tenantId, client.id, permissions);
    if (!allowed) {
      throw new WorkspaceAccessError("You do not have access to this workspace", 403);
    }
    if (!permissions?.canAccessMultipleWorkspaces && !permissions?.isJigantoStaff) {
      throw new WorkspaceAccessError("You do not have access to this workspace", 403);
    }
    return {
      tenantId,
      mode: "client",
      clientId: client.id,
      client,
      canViewPmoMaster,
    };
  }

  if (!canViewPmoMaster && !permissions?.isJigantoStaff) {
    // No permissions resolved yet (e.g. new user, no org membership) → fallback to master
    if (!permissions) {
      return { tenantId, mode: "master", clientId: null, client: null, canViewPmoMaster: false };
    }
    const clients = await storage.getClients(tenantId);
    if (clients.length === 1) {
      return {
        tenantId,
        mode: "client",
        clientId: clients[0].id,
        client: clients[0],
        canViewPmoMaster: false,
      };
    }
    if (clients.length === 0) {
      return { tenantId, mode: "master", clientId: null, client: null, canViewPmoMaster: false };
    }
    throw new WorkspaceAccessError("Select a client workspace", 403);
  }

  return {
    tenantId,
    mode: "master",
    clientId: null,
    client: null,
    canViewPmoMaster,
  };
}

export class WorkspaceAccessError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

export function requestedClientIdFromQuery(query: Record<string, unknown>): number | null {
  return parseClientId(query.clientId ?? query.workspaceId);
}

/** Resolve active workspace — session first (Docs §8.2), then header, then query fallback. */
export function resolveRequestedClientId(
  query: Record<string, unknown>,
  sessionClientId?: number | null,
  workspaceHeader?: string | string[] | undefined,
): number | null {
  if (sessionClientId != null && sessionClientId > 0) return sessionClientId;
  const rawHeader = Array.isArray(workspaceHeader) ? workspaceHeader[0] : workspaceHeader;
  if (rawHeader) {
    const fromHeader = parseClientId(rawHeader);
    if (fromHeader) return fromHeader;
  }
  return requestedClientIdFromQuery(query);
}
