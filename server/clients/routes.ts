import type { Express } from "express";
import { storage } from "../storage";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import { getApiTenantIdWithFallback } from "../lib/api-tenant-id";
import { requireMasterWorkspace } from "../middleware/workspace";
import { isLegacySampleClient } from "@shared/sample-clients";
import { insertClientSchema, insertClientUserSchema } from "@shared/models/clients";
import { slugify } from "../lib/slug";
import {
  canAccessClientsModule,
  canCreateClient,
  canDeleteClient,
  canManageClientMembers,
  getClientUserId,
  requireClientsAccess,
} from "./access";
import { newInvitationToken, provisionClientWorkspace } from "./provision";
import { sendInvitationEmail } from "../lib/invite-email";
import { CLIENT_WORKSPACE_CONFIGURABLE_KEYS } from "@shared/client-workspace-modules";
import { enrichClientsWithUsers, enrichClientWithUsers } from "./enrich";

function tenantId(req: Parameters<typeof getApiTenantIdWithFallback>[0]): number {
  return req.workspace?.tenantId ?? getApiTenantIdWithFallback(req);
}

async function assertClientAccess(
  req: Parameters<typeof getApiTenantIdWithFallback>[0],
  res: import("express").Response,
  clientId: number,
): Promise<boolean> {
  const userId = getClientUserId(req);
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  const allowed = await storage.userCanAccessClient(userId, tenantId(req), clientId, {
    platformRole: req.permissions?.platformRole,
    isJigantoStaff: req.permissions?.isJigantoStaff,
  });
  if (!allowed) {
    res.status(403).json({ message: "Access denied for this client workspace." });
    return false;
  }
  return true;
}

declare module "express-session" {
  interface SessionData {
    activeClientId?: number | null;
  }
}

export function registerClientRoutes(app: Express): void {
  app.get("/api/clients/workspace-context", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const workspaceId = req.session?.activeClientId ?? null;
    let client = null;
    if (workspaceId != null && workspaceId > 0) {
      client = await storage.getClientById(workspaceId, tenantId(req));
    }
    res.json({ clientId: workspaceId, workspaceId, client });
  });

  app.put("/api/clients/workspace-context", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const raw = req.body?.clientId ?? req.body?.workspaceId;
    const clientId = raw === null || raw === undefined || raw === ""
      ? null
      : Number(raw);
    if (clientId !== null && (!Number.isFinite(clientId) || clientId <= 0)) {
      return res.status(400).json({ message: "Invalid workspace id" });
    }
    const userId = getClientUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req);
    if (clientId !== null) {
      const allowed = await storage.userCanAccessClient(userId, tid, clientId, {
        platformRole: req.permissions?.platformRole,
        isJigantoStaff: req.permissions?.isJigantoStaff,
      });
      if (!allowed) {
        return res.status(403).json({ message: "Access denied for this client workspace." });
      }
    }
    const respond = () => res.json({ clientId, workspaceId: clientId });
    if (!req.session) return respond();
    req.session.activeClientId = clientId;
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "Failed to persist workspace session" });
      respond();
    });
  });

  app.get("/api/clients/kpis", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!requireClientsAccess(req, res)) return;
    try {
      const tid = tenantId(req);
      const [clientList, summaries] = await Promise.all([
        storage.getAccessibleClients(getClientUserId(req)!, tid, {
          platformRole: req.permissions?.platformRole,
          isJigantoStaff: req.permissions?.isJigantoStaff,
          includeArchived: true,
        }),
        storage.getClientProjectSummary(tid),
      ]);
      const visible = clientList.filter((c) => !isLegacySampleClient(c.shortCode));
      const activeEngagements = summaries.filter(
        (s) => s.clientId != null && s.activeProjectCount > 0,
      ).length;
      res.json({
        totalClients: visible.length,
        activeEngagements,
        projectsTracked: summaries.reduce((s, x) => s + x.projectCount, 0),
        atRiskProjects: summaries.reduce((s, x) => s + x.atRiskCount, 0),
      });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.get("/api/clients", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });

    const userId = getClientUserId(req)!;
    const isSi = canAccessClientsModule(req.permissions);
    const isClientMode = req.workspace?.mode === "client";

    if (!isSi && !isClientMode) {
      return res.status(403).json({ message: "Clients module is not available for your role." });
    }

    try {
      const tid = tenantId(req);
      const ws = req.workspace;

      // Client-role users in workspace mode: return only their workspace (for bootstrap/context)
      if (!isSi && isClientMode && ws?.client) {
        const summaries = await storage.getClientProjectSummary(tid);
        const summary = summaries.find((s) => s.clientId === ws.client!.id);
        return res.json([{
          ...ws.client,
          projectCount: summary?.projectCount ?? 0,
          atRiskCount: summary?.atRiskCount ?? 0,
          activeProjectCount: summary?.activeProjectCount ?? 0,
        }]);
      }

      // SI roles always receive the full list (management view) regardless of active workspace
      const includeArchived = req.query.includeArchived === "true";
      const [clientList, summaries] = await Promise.all([
        storage.getAccessibleClients(userId, tid, {
          platformRole: req.permissions?.platformRole,
          isJigantoStaff: req.permissions?.isJigantoStaff,
          includeArchived,
        }),
        storage.getClientProjectSummary(tid),
      ]);
      const summaryMap = new Map(summaries.map((s) => [s.clientId, s]));
      const filteredIds = clientList
        .filter((c) => !isLegacySampleClient(c.shortCode))
        .map((c) => c.id);
      const memberCounts = await storage.getClientMemberCounts(filteredIds);
      const result = clientList
        .filter((c) => !isLegacySampleClient(c.shortCode))
        .map((c) => ({
          ...c,
          projectCount: summaryMap.get(c.id)?.projectCount ?? 0,
          atRiskCount: summaryMap.get(c.id)?.atRiskCount ?? 0,
          activeProjectCount: summaryMap.get(c.id)?.activeProjectCount ?? 0,
          memberCount: memberCounts.get(c.id) ?? 0,
        }));
      res.json(await enrichClientsWithUsers(result));
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.get("/api/clients/pmo-dashboard", requireMasterWorkspace, async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tid = tenantId(req);
      const clientList = await storage.getClients(tid);
      const summaries = await storage.getClientProjectSummary(tid);
      const summaryMap = new Map(summaries.map((s) => [s.clientId, s]));
      const internalSummary = summaryMap.get(null) ?? { clientId: null, projectCount: 0, atRiskCount: 0, activeProjectCount: 0 };
      const cards = clientList.map((c) => ({
        ...c,
        projectCount: summaryMap.get(c.id)?.projectCount ?? 0,
        atRiskCount: summaryMap.get(c.id)?.atRiskCount ?? 0,
      }));
      res.json({
        clients: cards,
        totals: {
          totalClients: clientList.length,
          totalProjects: summaries.reduce((sum, s) => sum + s.projectCount, 0),
          totalAtRisk: summaries.reduce((sum, s) => sum + s.atRiskCount, 0),
          internalProjects: internalSummary.projectCount,
        },
      });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.get("/api/clients/by-slug/:slug", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tid = tenantId(req);
      const allowArchived = req.query.allowArchived === "true";
      const client = await storage.getClientBySlug(req.params.slug, tid, { allowArchived });
      if (!client) return res.status(404).json({ message: "Workspace not found" });
      const userId = getClientUserId(req);
      if (userId) {
        const allowed = await storage.userCanAccessClient(userId, tid, client.id, {
          platformRole: req.permissions?.platformRole,
          isJigantoStaff: req.permissions?.isJigantoStaff,
        });
        if (!allowed) return res.status(403).json({ message: "Access denied" });
      }
      if (req.workspace?.mode === "client" && req.workspace.clientId !== client.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(client);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.get("/api/clients/me", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const userId = getClientUserId(req);
      const tid = tenantId(req);
      const membership = await storage.getLockedClientMembershipByUserId(userId!, tid);
      res.json(membership ?? null);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.get("/api/clients/admin/pending-delete", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!req.permissions?.isJigantoStaff && req.permissions?.platformRole !== "si_super_admin") {
      return res.status(403).json({ message: "Admin access required." });
    }
    try {
      const tid = tenantId(req);
      const pending = await storage.getClientsPendingDelete(tid);
      const enriched = await enrichClientsWithUsers(pending);
      res.json(enriched);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!requireClientsAccess(req, res)) return;
    try {
      const id = Number(req.params.id);
      const tid = tenantId(req);
      if (!(await assertClientAccess(req, res, id))) return;

      const [client, users, invitations, visibility] = await Promise.all([
        storage.getClientById(id, tid),
        storage.getClientUsers(id),
        storage.getClientInvitations(id),
        storage.getClientModuleVisibility(id),
      ]);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const enriched = await enrichClientWithUsers(client);
      res.json({
        ...enriched,
        users,
        invitations,
        moduleVisibility: visibility,
        memberCount: users.length,
      });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!requireClientsAccess(req, res)) return;
    if (!canCreateClient(req.permissions)) {
      return res.status(403).json({ message: "Only SI Super Admins can create client workspaces." });
    }
    try {
      const tid = tenantId(req);
      const userId = getClientUserId(req)!;
      let slug = typeof req.body.slug === "string" && req.body.slug.trim()
        ? slugify(req.body.slug)
        : slugify(req.body.name ?? "workspace");
      const existingSlugs = await storage.getClientSlugs(tid);
      const taken = new Set(existingSlugs);
      let suffix = 0;
      let candidate = slug;
      while (taken.has(candidate)) {
        suffix += 1;
        candidate = `${slug}-${suffix}`;
      }
      slug = candidate;
      const parsed = insertClientSchema.safeParse({
        ...req.body,
        tenantId: tid,
        slug,
        createdBy: userId,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const client = await storage.createClient(parsed.data);
      await provisionClientWorkspace(client, userId, tid);
      // Clear any active workspace scope so the landing page refreshes to full list
      if (req.session) req.session.activeClientId = null;
      res.status(201).json(client);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.put("/api/clients/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!requireClientsAccess(req, res)) return;
    try {
      const id = Number(req.params.id);
      const tid = tenantId(req);
      if (!(await assertClientAccess(req, res, id))) return;
      const client = await storage.updateClient(id, tid, req.body);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!requireClientsAccess(req, res)) return;
    try {
      const id = Number(req.params.id);
      const tid = tenantId(req);
      if (!(await assertClientAccess(req, res, id))) return;
      const client = await storage.archiveClient(id, tid);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json({ success: true, client });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.post("/api/clients/:id/unarchive", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!canCreateClient(req.permissions)) {
      return res.status(403).json({ message: "Only SI Super Admins can restore workspaces." });
    }
    try {
      const id = Number(req.params.id);
      const tid = tenantId(req);
      const client = await storage.unarchiveClient(id, tid);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.post("/api/clients/:id/delete-request", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!canDeleteClient(req.permissions)) {
      return res.status(403).json({ message: "Only SI Super Admins can delete workspaces." });
    }
    try {
      const id = Number(req.params.id);
      const tid = tenantId(req);
      const client = await storage.getClientById(id, tid);
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (req.body.confirmName !== client.name) {
        return res.status(400).json({ message: "Confirmation name does not match." });
      }
      const deleted = await storage.requestClientDeletion(id, tid);
      res.json({ success: true, client: deleted, purgeAt: deleted?.purgeAt });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.post("/api/clients/:id/restore", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!canDeleteClient(req.permissions)) {
      return res.status(403).json({ message: "Only SI Super Admins can restore deleted workspaces." });
    }
    try {
      const id = Number(req.params.id);
      const tid = tenantId(req);
      const client = await storage.restoreClient(id, tid);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.get("/api/clients/:id/users", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!requireClientsAccess(req, res)) return;
    try {
      const id = Number(req.params.id);
      if (!(await assertClientAccess(req, res, id))) return;
      const users = await storage.getClientUsers(id);
      res.json(users);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.post("/api/clients/:id/users", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!canManageClientMembers(req.permissions)) {
      return res.status(403).json({ message: "Cannot manage workspace members." });
    }
    try {
      const id = Number(req.params.id);
      const tid = tenantId(req);
      if (!(await assertClientAccess(req, res, id))) return;
      const parsed = insertClientUserSchema.safeParse({
        ...req.body,
        clientId: id,
        tenantId: tid,
        invitedBy: getClientUserId(req),
        joinedAt: new Date(),
        isActive: 1,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const cu = await storage.addClientUser(parsed.data);
      res.status(201).json(cu);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.delete("/api/clients/:id/users/:userId", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!canManageClientMembers(req.permissions)) {
      return res.status(403).json({ message: "Cannot manage workspace members." });
    }
    try {
      const id = Number(req.params.id);
      if (!(await assertClientAccess(req, res, id))) return;
      await storage.removeClientUser(id, req.params.userId);
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.post("/api/clients/:id/invitations", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!canManageClientMembers(req.permissions)) {
      return res.status(403).json({ message: "Cannot invite workspace members." });
    }
    try {
      const id = Number(req.params.id);
      const tid = tenantId(req);
      if (!(await assertClientAccess(req, res, id))) return;
      const { email, role = "viewer", memberType = "client" } = req.body as {
        email?: string;
        role?: string;
        memberType?: string;
      };
      if (!email?.trim()) return res.status(400).json({ message: "Email is required." });
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const token = newInvitationToken();
      const invite = await storage.createClientInvitation({
        tenantId: tid,
        clientId: id,
        email: email.trim().toLowerCase(),
        role,
        memberType,
        token,
        invitedBy: getClientUserId(req)!,
        expiresAt,
      });
      const [client, tenant] = await Promise.all([
        storage.getClientById(id, tid),
        storage.getTenant(tid),
      ]);
      void sendInvitationEmail({
        to: email.trim(),
        token,
        orgName: client?.name ?? tenant?.name,
      }).catch((err) => console.warn("[clients] invite email failed:", err));
      res.status(201).json(invite);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.get("/api/clients/:id/module-visibility", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!requireClientsAccess(req, res)) return;
    try {
      const id = Number(req.params.id);
      if (!(await assertClientAccess(req, res, id))) return;
      const rows = await storage.getClientModuleVisibility(id);
      const map = Object.fromEntries(rows.map((r) => [r.moduleKey, r.isVisible === 1]));
      const defaults = CLIENT_WORKSPACE_CONFIGURABLE_KEYS.map((m) => ({
        key: m.key,
        label: m.label,
        locked: m.locked,
        isVisible: map[m.key] ?? m.defaultVisible,
      }));
      res.json(defaults);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.put("/api/clients/:id/module-visibility", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!canCreateClient(req.permissions)) {
      return res.status(403).json({ message: "Only SI Super Admins can configure module visibility." });
    }
    try {
      const id = Number(req.params.id);
      if (!(await assertClientAccess(req, res, id))) return;
      const { modules } = req.body as { modules?: { key: string; isVisible: boolean }[] };
      if (!Array.isArray(modules)) return res.status(400).json({ message: "modules array required" });
      const userId = getClientUserId(req)!;
      await Promise.all(
        modules.map((m) =>
          storage.upsertClientModuleVisibility(id, m.key, m.isVisible ? 1 : 0, userId),
        ),
      );
      const rows = await storage.getClientModuleVisibility(id);
      res.json(rows);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.get("/api/clients/invitations/:token/preview", async (req, res) => {
    try {
      const invite = await storage.getClientInvitationByToken(req.params.token);
      if (!invite || invite.acceptedAt) return res.status(404).json({ message: "Invitation not found" });
      if (invite.expiresAt < new Date()) return res.status(410).json({ message: "Invitation expired" });
      const client = await storage.getClientById(invite.clientId, invite.tenantId);
      res.json({ email: invite.email, clientName: client?.name, role: invite.role });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.post("/api/clients/invitations/:token/accept", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const userId = getClientUserId(req)!;
      const member = await storage.acceptClientInvitation(req.params.token, userId);
      if (!member) return res.status(400).json({ message: "Invalid or expired invitation" });
      res.json({ success: true, member });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Error" });
    }
  });

  app.post("/api/clients/purge-expired", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    if (!req.permissions?.isJigantoStaff) {
      return res.status(403).json({ message: "Staff only." });
    }
    const count = await storage.purgeExpiredDeletedClients();
    res.json({ purged: count });
  });
}
