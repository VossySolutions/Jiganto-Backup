
import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { setupAuth, registerAuthRoutes, registerPermissionsRoutes } from "./auth";
import {
  attachPermissionContext,
  enforceOrgMembershipAccess,
  enforceReadOnlyApiAccess,
} from "./middleware/permissions";
import { enforceModulePermissions } from "./middleware/module-permissions";
import { injectApiTenantScope } from "./middleware/api-tenant-scope";
import {
  attachWorkspaceContext,
  requireMasterWorkspace,
} from "./middleware/workspace";
import { enforceWorkspaceMutations } from "./middleware/workspace-enforcement";
import { enforceArchivedWorkspaceReadOnly } from "./middleware/workspace-readonly";
import { injectWorkspaceQueryScope } from "./middleware/workspace-query-scope";
import { filterWorkspaceResponses } from "./middleware/workspace-response-filter";
import { guardWorkspaceResourceAccess } from "./middleware/workspace-resource-guard";
import { restrictClientWorkspaceModules } from "./middleware/client-workspace-modules";
import { setWorkspaceRlsContext } from "./middleware/workspace-rls";
import { attachWorkspaceClaims } from "./lib/workspace-claims";
import { guardPmProjectScope } from "./middleware/pm-project-guard";
import {
  workspaceClientId,
  assertRecordInWorkspace,
  canManageOrgUsers,
  requireSettingsOrgId,
  resolveSettingsOrgId,
  requireOrgAdmin,
} from "./lib/workspace-access";
import { resolveListClientId } from "./lib/list-client-id";
import { ensureDefaultModuleRoles } from "./lib/default-module-roles";
import { getApiTenantIdWithFallback, requireApiTenantId } from "./lib/api-tenant-id";
import { isRequestAuthenticated } from "./auth/supabaseAuth";
import { registerOrgMembershipRoutes } from "./auth/orgMembershipRoutes";
import { registerImpersonationRoutes } from "./auth/impersonationRoutes";
import { registerChatRoutes } from "./chat";
import { api } from "@shared/routes";
import { isLegacySampleClient } from "@shared/sample-clients";
import { z } from "zod";
import { 
  insertStrategyItemSchema, 
  insertGoalSchema,
  insertObjectiveSchema,
  insertOkrSchema,
  insertInitiativeSchema,
  insertRiskSchema,
  insertDepartmentSchema,
  insertProcessSchema,
  insertToolSchema,
  insertKeyResultSchema,
  insertKpiSchema,
  insertBusinessTaskSchema,
  insertMeetingSchema
} from "@shared/models/business";
import {
  insertDocumentFolderSchema,
  insertDocumentSchema,
  insertDocumentCommentSchema,
  insertDocumentTemplateSchema,
  insertDocumentAclSchema,
  insertTagSchema,
  insertDocumentTagSchema,
  insertDocumentInitiativeLinkSchema,
  documentFiles,
} from "@shared/models/documents";
import {
  insertTaskSchema,
  insertTaskBoardSchema,
  insertTaskLinkSchema,
  insertTaskSubtaskSchema,
  insertTaskViewSchema,
} from "@shared/models/tasks";
import {
  insertPmPortfolioSchema,
  insertPmProgramSchema,
  insertPmProjectSchema,
  insertPmProjectPhaseSchema,
  insertPmMilestoneSchema,
  insertPmTaskSchema,
  insertPmTeamMemberSchema,
  insertPmRaiddItemSchema,
  insertPmDeliverablePhaseSchema,
  insertPmDeliverableSchema,
  insertPmBusinessRequirementSchema,
  insertPmPhaseTemplateSchema,
  insertPmWorkstreamSchema,
  insertPmSprintSchema,
  insertPmBacklogItemSchema,
  insertPmProjectToolSchema,
  pmToolTypeEnum,
  pmToolCategoryEnum,
  insertPmAgileWorkstreamSchema,
  insertPmEpicSchema,
  insertPmAgileSprintSchema,
  insertPmAgileStorySchema,
  insertPmAgileDefectSchema,
} from "@shared/models/projects";
import {
  insertResourceSchema,
  insertSkillCategorySchema,
  insertSkillSchema,
  insertResourceSkillSchema,
  insertResourceAllocationSchema,
  insertTimesheetPeriodSchema,
  insertTimesheetEntrySchema,
  insertProjectCodeSchema,
} from "@shared/models/resources";
import {
  insertBpmDiagramSchema,
  insertBpmNodeSchema,
  insertBpmEdgeSchema,
  insertBpmSwimlaneSchema,
  insertBpmLibrarySchema,
  insertBpmTemplateSchema,
  insertBpmAttachmentSchema,
  bpmTemplates,
} from "@shared/models/bpm";
import {
  insertOrgChartSchema,
  insertOrgChartMemberSchema,
  insertOrgChartTemplateSchema,
} from "@shared/models/orgchart";
import {
  insertUserRoleSchema,
  insertUserInvitationSchema,
  insertTenantSchema,
  insertProfileSchema,
  profiles,
} from "@shared/schema";
import { users as usersTable } from "@shared/models/auth";
import { PLATFORM_ROLES, type PlatformRole } from "@shared/models/permissions";
import { listImpersonationLogs } from "./lib/impersonation";
import { logOrgAuditEvent, listOrgAuditEvents } from "./lib/org-audit";
import { sendInvitationEmail, buildInviteUrl } from "./lib/invite-email";
import {
  dispatchTenantWebhook,
  invitationWebhookPayload,
} from "./lib/integration-webhook";
import { authStorage } from "./auth/storage";
import { seedApexData } from "./seedApexData";
import {
  insertClientSchema,
  insertClientUserSchema,
} from "@shared/models/clients";
import { slugify } from "./lib/slug";

function getWorstRag(ragStatuses: (string | null | undefined)[]): string {
  const ragPriority: Record<string, number> = { red: 3, amber: 2, green: 1 };
  let worst = 'green';
  let worstPriority = 0;
  for (const rag of ragStatuses) {
    if (rag && ragPriority[rag] && ragPriority[rag] > worstPriority) {
      worst = rag;
      worstPriority = ragPriority[rag];
    }
  }
  return worst;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ── Public document access (no auth required) ─────────────────────────────
  app.get("/public/documents/:token", async (req, res) => {
    try {
      const { token } = req.params;
      if (!token || !/^[a-f0-9]{48}$/.test(token)) {
        return res.status(404).send("Document not found");
      }
      const doc = await storage.getDocumentByPublicToken(token);
      if (!doc) return res.status(404).send("Document not found or link has been revoked");
      // Return a minimal read-only HTML page
      const htmlStyles = `
        body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.6; color: #1a1a1a; }
        h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem; }
        .meta { color: #666; font-size: 0.875rem; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #eee; }
        .badge { display: inline-flex; align-items: center; border-radius: 4px; border: 1px solid; padding: 2px 8px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 0.5rem; }
        .badge-draft { border-color: #d97706; color: #d97706; }
        .badge-published { border-color: #16a34a; color: #16a34a; }
        .badge-review { border-color: #2563eb; color: #2563eb; }
        .content { line-height: 1.7; }
        [data-callout="info"] { border-left: 4px solid #3b82f6; background: #eff6ff; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
        [data-callout="warning"] { border-left: 4px solid #f59e0b; background: #fffbeb; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
        [data-callout="success"] { border-left: 4px solid #22c55e; background: #f0fdf4; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
        [data-callout="danger"]  { border-left: 4px solid #ef4444; background: #fef2f2; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; color: #999; font-size: 0.75rem; text-align: center; }
      `;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.title} — Jiganto</title>
  <style>${htmlStyles}</style>
</head>
<body>
  <h1>${doc.title}<span class="badge badge-${doc.status}">${doc.status}</span></h1>
  <div class="meta">
    Shared document · Last updated ${new Date(doc.updatedAt!).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
  </div>
  <div class="content">${doc.content || "<p><em>No content</em></p>"}</div>
  <div class="footer">Shared via Jiganto · Read-only public view</div>
</body>
</html>`);
    } catch (err) {
      console.error("Public doc error:", err);
      res.status(500).send("An error occurred");
    }
  });

  // Setup Auth and Integrations
  await setupAuth(app);
  app.use(attachPermissionContext);
  app.use(injectApiTenantScope);
  app.use(enforceOrgMembershipAccess);
  app.use(attachWorkspaceContext);
  app.use(attachWorkspaceClaims);
  app.use(injectWorkspaceQueryScope);
  app.use(enforceWorkspaceMutations);
  app.use(enforceArchivedWorkspaceReadOnly);
  app.use(guardPmProjectScope);
  app.use(guardWorkspaceResourceAccess);
  app.use(restrictClientWorkspaceModules);
  app.use(setWorkspaceRlsContext);
  app.use(enforceModulePermissions);
  app.use(enforceReadOnlyApiAccess);
  app.use(filterWorkspaceResponses);

  app.use("/api/settings", (req, res, next) => {
    if (!isRequestAuthenticated(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Personal endpoints — any member with app access
    if (
      req.path === "/preferences" ||
      req.path === "/data-export" ||
      req.path.startsWith("/data-export/") ||
      req.path === "/data-erasure-request"
    ) {
      return next();
    }
    if (!canManageOrgUsers(req.permissions)) {
      return res.status(403).json({
        message: "Organisation admin access required for Settings.",
      });
    }
    next();
  });

  registerAuthRoutes(app);
  registerPermissionsRoutes(app);
  registerOrgMembershipRoutes(app);
  registerImpersonationRoutes(app);
  registerChatRoutes(app);

  const { registerCustomerMgmtRoutes } = await import("./customer-management/routes");
  registerCustomerMgmtRoutes(app);

  const { registerDashboardRoutes } = await import("./dashboard/routes");
  registerDashboardRoutes(app);

  const { registerFinanceRoutes } = await import("./finance/routes");
  registerFinanceRoutes(app);

  const { registerResourcesRoutes } = await import("./resources/routes");
  registerResourcesRoutes(app);

  const { registerClientRoutes } = await import("./clients/routes");
  registerClientRoutes(app);

  const { registerPortfolioRoutes } = await import("./portfolio/routes");
  registerPortfolioRoutes(app);

  // === Application Routes ===

  // Tenants
  app.get(api.tenants.list.path, async (req, res) => {
    if (!isRequestAuthenticated(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const orgId = req.permissions?.orgId ?? req.workspace?.tenantId;
    if (orgId) {
      const tenant = await storage.getTenant(orgId);
      return res.json(tenant ? [tenant] : []);
    }
    const tenants = await storage.getTenants();
    res.json(tenants);
  });

  app.post(api.tenants.create.path, async (req, res) => {
    try {
      const input = api.tenants.create.input.parse(req.body);
      const tenant = await storage.createTenant(input);
      res.status(201).json(tenant);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.tenants.get.path, async (req, res) => {
    if (!isRequestAuthenticated(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = Number(req.params.id);
    const sessionOrgId = req.permissions?.orgId;
    if (
      sessionOrgId != null &&
      sessionOrgId !== id &&
      !req.permissions?.isJigantoStaff
    ) {
      return res.status(403).json({ message: "Access denied for this organisation." });
    }
    const tenant = await storage.getTenant(id);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    res.json(tenant);
  });

  app.put("/api/tenants/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = Number(req.params.id);
    const sessionOrgId = req.permissions?.orgId;
    if (!canManageOrgUsers(req.permissions) || sessionOrgId !== id) {
      return res.status(403).json({ message: "Cannot update this organisation." });
    }
    try {
      const tenant = await storage.updateTenant(id, req.body);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      res.json(tenant);
    } catch (err) {
      res.status(500).json({ message: "Failed to update tenant" });
    }
  });

  // Settings - Client companies (full list for roles / grants; not scoped to sidebar workspace)
  app.get("/api/settings/clients", async (req, res) => {
    if (!requireOrgAdmin(req, res)) return;
    const tenantId = requireSettingsOrgId(req, res);
    if (tenantId == null) return;
    try {
      const list = await storage.getClients(tenantId);
      res.json(
        list
          .filter((c) => c.status === "active")
          .map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      );
    } catch (err) {
      res.status(500).json({ message: "Failed to list client companies" });
    }
  });

  // Settings - User Roles
  app.get("/api/settings/roles", async (req, res) => {
    const tenantId = requireSettingsOrgId(req, res);
    if (tenantId == null) return;
    await ensureDefaultModuleRoles(tenantId);
    const roles = await storage.getUserRoles(tenantId);
    res.json(roles);
  });

  app.post("/api/settings/roles", async (req, res) => {
    try {
      const tenantId = requireSettingsOrgId(req, res, req.body.tenantId);
      if (tenantId == null) return;
      const input = insertUserRoleSchema.parse({ ...req.body, tenantId });
      const role = await storage.createUserRole(input);
      res.status(201).json(role);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.put("/api/settings/roles/:id", async (req, res) => {
    try {
      const role = await storage.updateUserRole(Number(req.params.id), req.body);
      if (!role) return res.status(404).json({ message: "Role not found" });
      res.json(role);
    } catch (err) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/settings/roles/:id", async (req, res) => {
    try {
      await storage.deleteUserRole(Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // Settings - User Invitations
  app.get("/api/settings/invitations", async (req, res) => {
    const tenantId = requireSettingsOrgId(req, res);
    if (tenantId == null) return;
    const invitations = await storage.getUserInvitations(tenantId);
    res.json(invitations);
  });

  app.post("/api/settings/invitations", async (req, res) => {
    try {
      const tenantId = requireSettingsOrgId(req, res, req.body.tenantId);
      if (tenantId == null) return;
      const invitedBy = (req.user as { claims?: { sub?: string } })?.claims?.sub;
      if (!invitedBy) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (
        req.body.platformRole !== undefined &&
        req.body.platformRole !== null &&
        !(PLATFORM_ROLES as readonly string[]).includes(req.body.platformRole)
      ) {
        return res.status(400).json({ message: "Invalid platform role" });
      }
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const { assertSeatAvailable } = await import("./lib/seat-limits");
      await assertSeatAvailable(tenantId);

      const invitationInput = insertUserInvitationSchema.parse({
        ...req.body,
        tenantId,
        invitedBy: req.body.invitedBy ?? invitedBy,
        token,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      const invitation = await storage.createUserInvitation(invitationInput);

      const tenant = await storage.getTenant(invitation.tenantId);
      const inviter = await authStorage.getUser(invitedBy);
      const emailDelivery = await sendInvitationEmail({
        to: invitation.email,
        token: invitation.token,
        orgName: tenant?.name,
        invitedByEmail: inviter?.email ?? undefined,
        tenant: tenant ?? undefined,
      });

      const webhookDelivery = await dispatchTenantWebhook(
        tenant?.brandingConfig,
        "invitation.created",
        invitationWebhookPayload({
          id: invitation.id,
          email: invitation.email,
          tenantId: invitation.tenantId,
          token: invitation.token,
          platformRole: invitation.platformRole,
          roleId: invitation.roleId,
          invitedBy: invitation.invitedBy,
        }),
      );

      await logOrgAuditEvent({
        orgId: invitation.tenantId,
        actorUserId: invitedBy,
        action: "invitation.created",
        targetEmail: invitation.email,
        metadata: {
          platformRole: invitation.platformRole,
          roleId: invitation.roleId,
          invitationId: invitation.id,
          webhookDelivered: webhookDelivery.delivered,
        },
      });

      res.status(201).json({
        ...invitation,
        invitePath: `/invite/${invitation.token}`,
        inviteUrl: buildInviteUrl(invitation.token),
        emailDelivery,
        webhookDelivery,
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("Seat limit")) {
        return res.status(400).json({ message: err.message });
      }
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.delete("/api/settings/invitations/:id", async (req, res) => {
    try {
      const actorUserId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
      const inv = await storage.getUserInvitation(Number(req.params.id));
      await storage.deleteUserInvitation(Number(req.params.id));
      if (actorUserId && inv) {
        const tenant = await storage.getTenant(inv.tenantId);
        await dispatchTenantWebhook(tenant?.brandingConfig, "invitation.revoked", {
          ...invitationWebhookPayload({
            id: inv.id,
            email: inv.email,
            tenantId: inv.tenantId,
            token: inv.token,
            platformRole: inv.platformRole,
            roleId: inv.roleId,
          }),
          revokedBy: actorUserId,
        });
        await logOrgAuditEvent({
          orgId: inv.tenantId,
          actorUserId,
          action: "invitation.revoked",
          targetEmail: inv.email,
          metadata: { invitationId: inv.id },
        });
      }
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete invitation" });
    }
  });

  app.get("/api/settings/audit/impersonation", async (req, res) => {
    const perms = req.permissions;
    if (
      !perms?.isJigantoStaff &&
      perms?.platformRole !== "si_super_admin"
    ) {
      return res.status(403).json({ message: "Audit log access requires organisation owner or Jiganto staff." });
    }
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const rows = await listImpersonationLogs(orgId);
      const userIds = [
        ...new Set(rows.flatMap((r) => [r.staffUserId, r.targetUserId])),
      ];
      const userRows =
        userIds.length > 0
          ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
          : [];
      const userById = new Map(userRows.map((u) => [u.id, u]));

      res.json({
        logs: rows.map((row) => {
          const staff = userById.get(row.staffUserId);
          const target = userById.get(row.targetUserId);
          return {
            ...row,
            staffEmail: staff?.email ?? null,
            staffName: [staff?.firstName, staff?.lastName].filter(Boolean).join(" ") || null,
            targetEmail: target?.email ?? null,
            targetName: [target?.firstName, target?.lastName].filter(Boolean).join(" ") || null,
          };
        }),
      });
    } catch (err) {
      console.error("Audit log error:", err);
      res.status(500).json({ message: "Failed to load audit log" });
    }
  });

  app.get("/api/settings/preferences", async (req, res) => {
    const userId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { mergeNotificationPreferences } = await import("./lib/notification-preferences");
      res.json({ notifications: mergeNotificationPreferences(user.preferences) });
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "42703"
      ) {
        const { mergeNotificationPreferences } = await import("./lib/notification-preferences");
        return res.json({ notifications: mergeNotificationPreferences(undefined) });
      }
      console.error("Preferences GET error:", err);
      res.status(500).json({ message: "Failed to load preferences" });
    }
  });

  app.post("/api/settings/webhook-test", async (req, res) => {
    const orgId = req.permissions?.orgId;
    if (!orgId) {
      return res.status(403).json({ message: "No organisation context." });
    }
    try {
      const tenant = await storage.getTenant(orgId);
      const webhookDelivery = await dispatchTenantWebhook(
        tenant?.brandingConfig,
        "webhook.test",
        {
          orgId,
          message: "Test delivery from Jiganto Settings",
        },
      );
      res.json({ webhookDelivery });
    } catch (err) {
      console.error("Webhook test error:", err);
      res.status(500).json({ message: "Failed to send test webhook" });
    }
  });

  app.post("/api/settings/data-export", async (req, res) => {
    const userId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const user = await authStorage.getUser(userId);
      const orgId = req.permissions?.orgId;
      if (!orgId) {
        return res.status(403).json({ message: "Organisation context required." });
      }
      const tenant = await storage.getTenant(orgId);
      const dg = (tenant?.brandingConfig as { dataGovernance?: { allowSelfServiceExport?: boolean } })
        ?.dataGovernance;
      if (!dg?.allowSelfServiceExport) {
        return res.status(403).json({
          message: "Self-service data export is not enabled for this organisation.",
        });
      }
      const requestId = `export-${Date.now()}-${userId.slice(0, 8)}`;
      await logOrgAuditEvent({
        orgId,
        actorUserId: userId,
        action: "data.export_requested",
        targetUserId: userId,
        targetEmail: user?.email ?? undefined,
        metadata: { requestId },
      });
      res.json({
        requestId,
        message:
          "Your export request has been logged. You can also download a JSON snapshot immediately from Profile → Data & privacy.",
        downloadUrl: "/api/settings/data-export/download",
      });
    } catch (err) {
      console.error("Data export request error:", err);
      res.status(500).json({ message: "Failed to submit export request" });
    }
  });

  app.get("/api/settings/data-export/download", async (req, res) => {
    const userId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const orgId = req.permissions?.orgId;
      if (!orgId) {
        return res.status(403).json({ message: "Organisation context required." });
      }
      const tenant = await storage.getTenant(orgId);
      const dg = (tenant?.brandingConfig as { dataGovernance?: { allowSelfServiceExport?: boolean } })
        ?.dataGovernance;
      if (!dg?.allowSelfServiceExport) {
        return res.status(403).json({
          message: "Self-service data export is not enabled for this organisation.",
        });
      }
      const format = String(req.query.format || "json").toLowerCase();
      await logOrgAuditEvent({
        orgId,
        actorUserId: userId,
        action: "data.export_downloaded",
        targetUserId: userId,
        metadata: { format },
      });
      if (format === "zip") {
        const { buildPersonalDataZip } = await import("./lib/data-export-zip");
        const zip = await buildPersonalDataZip(userId, orgId);
        const filename = `jiganto-data-export-${userId.slice(0, 8)}.zip`;
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(zip);
      }
      const { buildPersonalDataExport } = await import("./lib/data-export-bundle");
      const bundle = await buildPersonalDataExport(userId, orgId);
      const filename = `jiganto-data-export-${userId.slice(0, 8)}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(JSON.stringify(bundle, null, 2));
    } catch (err) {
      console.error("Data export download error:", err);
      res.status(500).json({ message: "Failed to generate export" });
    }
  });

  app.get("/api/ai/status", async (req, res) => {
    if (!isRequestAuthenticated(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { getAiModuleStatus } = await import("./lib/openai");
    res.json(getAiModuleStatus());
  });

  app.get("/api/settings/ai-usage", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const {
        ensureAiTokenBalance,
        listAiUsageLast30Days,
      } = await import("./lib/ai-tokens");
      try {
        const balance = await ensureAiTokenBalance(orgId);
        const usage = await listAiUsageLast30Days(orgId);
        res.json({
          balance: {
            balance: balance.balance,
            monthlyAllocation: balance.monthlyAllocation,
          },
          usage,
        });
      } catch (err: unknown) {
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code?: string }).code === "42P01"
        ) {
          return res.json({ balance: null, usage: [], tableMissing: true });
        }
        throw err;
      }
    } catch (err) {
      console.error("AI usage error:", err);
      res.status(500).json({ message: "Failed to load AI usage" });
    }
  });

  app.get("/api/settings/ai-usage/export", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const { listAiUsageLast30Days, aiUsageToCsv } = await import("./lib/ai-tokens");
      const usage = await listAiUsageLast30Days(orgId);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="ai-usage-${orgId}.csv"`);
      res.send(aiUsageToCsv(usage));
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "42P01"
      ) {
        return res.status(503).json({ message: "AI usage tables not installed." });
      }
      console.error("AI usage export error:", err);
      res.status(500).json({ message: "Failed to export AI usage" });
    }
  });

  app.get("/api/settings/ai-limits", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const { listAiTokenLimits } = await import("./lib/ai-tokens");
      const limits = await listAiTokenLimits(orgId);
      res.json({ limits });
    } catch (err) {
      console.error("AI limits GET error:", err);
      res.status(500).json({ message: "Failed to load AI limits" });
    }
  });

  app.post("/api/settings/ai-limits", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const monthlyLimit = Number(req.body?.monthlyLimit);
      if (!monthlyLimit || monthlyLimit < 1) {
        return res.status(400).json({ message: "monthlyLimit is required" });
      }
      const { upsertAiTokenLimit } = await import("./lib/ai-tokens");
      const row = await upsertAiTokenLimit({
        orgId,
        monthlyLimit,
        module: req.body?.module ?? null,
        userId: req.body?.userId ?? null,
      });
      res.status(201).json({ limit: row });
    } catch (err) {
      console.error("AI limits POST error:", err);
      res.status(500).json({ message: "Failed to create AI limit" });
    }
  });

  app.delete("/api/settings/ai-limits/:id", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const { deleteAiTokenLimit } = await import("./lib/ai-tokens");
      await deleteAiTokenLimit(Number(req.params.id), orgId);
      res.status(204).send();
    } catch (err) {
      console.error("AI limits DELETE error:", err);
      res.status(500).json({ message: "Failed to delete AI limit" });
    }
  });

  app.post("/api/settings/smtp-test", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const userId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
      const user = userId ? await authStorage.getUser(userId) : null;
      const to = (req.body?.to as string)?.trim() || user?.email;
      if (!to) return res.status(400).json({ message: "Recipient email required" });
      const tenant = await storage.getTenant(orgId);
      const { sendOrgEmail } = await import("./lib/org-email");
      const result = await sendOrgEmail({
        tenant,
        to,
        subject: "Jiganto SMTP test",
        html: "<p>This is a test message from Jiganto Settings.</p>",
        smtpPassword: req.body?.password as string | undefined,
      });
      res.json(result);
    } catch (err) {
      console.error("SMTP test error:", err);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  app.get("/api/settings/api-keys", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const tenant = await storage.getTenant(orgId);
      const { listApiKeysPublic } = await import("./lib/api-keys");
      res.json({ keys: listApiKeysPublic(tenant?.brandingConfig) });
    } catch (err) {
      console.error("API keys GET error:", err);
      res.status(500).json({ message: "Failed to list API keys" });
    }
  });

  app.post("/api/settings/api-keys", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const tenant = await storage.getTenant(orgId);
      const current = (tenant?.brandingConfig as Record<string, unknown>) || {};
      const { createApiKey } = await import("./lib/api-keys");
      const { brandingConfig, rawKey, public: pub } = createApiKey(
        current,
        String(req.body?.name || "API key"),
        Array.isArray(req.body?.scopes) ? req.body.scopes : ["read"],
      );
      await storage.updateTenant(orgId, { brandingConfig });
      await logOrgAuditEvent({
        orgId,
        actorUserId: (req.user as { claims?: { sub?: string } })!.claims!.sub!,
        action: "api_key.created",
        metadata: { keyId: pub.id, name: pub.name },
      });
      res.status(201).json({ key: pub, rawKey });
    } catch (err) {
      console.error("API keys POST error:", err);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.delete("/api/settings/api-keys/:id", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const tenant = await storage.getTenant(orgId);
      const current = (tenant?.brandingConfig as Record<string, unknown>) || {};
      const { revokeApiKey } = await import("./lib/api-keys");
      await storage.updateTenant(orgId, {
        brandingConfig: revokeApiKey(current, req.params.id),
      });
      res.status(204).send();
    } catch (err) {
      console.error("API keys DELETE error:", err);
      res.status(500).json({ message: "Failed to revoke API key" });
    }
  });

  app.post("/api/settings/retention-run", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const { runOrgDataRetention } = await import("./lib/data-retention");
      const result = await runOrgDataRetention(orgId);
      const actorUserId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
      if (actorUserId) {
        await logOrgAuditEvent({
          orgId,
          actorUserId,
          action: "data.retention_run",
          metadata: result,
        });
      }
      res.json(result);
    } catch (err) {
      console.error("Retention run error:", err);
      res.status(500).json({ message: "Failed to run retention" });
    }
  });

  app.post("/api/settings/digest-run", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const { runNotificationDigests } = await import("./lib/notification-digest");
      const result = await runNotificationDigests();
      res.json(result);
    } catch (err) {
      console.error("Digest run error:", err);
      res.status(500).json({ message: "Failed to run digest" });
    }
  });

  app.post("/api/settings/data-erasure-request", async (req, res) => {
    const userId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const orgId = req.permissions?.orgId;
      if (!orgId) return res.status(403).json({ message: "Organisation context required." });
      const tenant = await storage.getTenant(orgId);
      const user = await authStorage.getUser(userId);
      const {
        appendErasureRequest,
        listErasureRequests,
      } = await import("./lib/data-erasure");
      const existing = listErasureRequests(tenant?.brandingConfig).filter(
        (r) => r.userId === userId && r.status === "pending",
      );
      if (existing.length) {
        return res.status(409).json({ message: "You already have a pending erasure request." });
      }
      const request = {
        id: `erasure-${Date.now()}`,
        userId,
        userEmail: user?.email ?? undefined,
        status: "pending" as const,
        requestedAt: new Date().toISOString(),
      };
      const brandingConfig = appendErasureRequest(
        (tenant?.brandingConfig as Record<string, unknown>) || {},
        request,
      );
      await storage.updateTenant(orgId, { brandingConfig });
      await logOrgAuditEvent({
        orgId,
        actorUserId: userId,
        action: "data.erasure_requested",
        targetUserId: userId,
        metadata: { requestId: request.id },
      });
      res.status(201).json({ request });
    } catch (err) {
      console.error("Erasure request error:", err);
      res.status(500).json({ message: "Failed to submit erasure request" });
    }
  });

  app.get("/api/settings/data-erasure-requests", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const tenant = await storage.getTenant(orgId);
      const { listErasureRequests } = await import("./lib/data-erasure");
      res.json({ requests: listErasureRequests(tenant?.brandingConfig) });
    } catch (err) {
      res.status(500).json({ message: "Failed to load erasure requests" });
    }
  });

  app.post("/api/settings/data-erasure-requests/:id/approve", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const actorUserId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
      if (!actorUserId) return res.status(401).json({ message: "Unauthorized" });
      const tenant = await storage.getTenant(orgId);
      const current = (tenant?.brandingConfig as Record<string, unknown>) || {};
      const {
        updateErasureRequestStatus,
        listErasureRequests,
        anonymizeUserData,
      } = await import("./lib/data-erasure");
      const target = listErasureRequests(current).find((r) => r.id === req.params.id);
      if (!target) return res.status(404).json({ message: "Request not found" });
      const brandingConfig = updateErasureRequestStatus(
        current,
        req.params.id,
        "approved",
        actorUserId,
      );
      if (!brandingConfig) return res.status(404).json({ message: "Request not found" });
      await storage.updateTenant(orgId, { brandingConfig });
      await anonymizeUserData(target.userId, orgId);
      res.json({ success: true });
    } catch (err) {
      console.error("Erasure approve error:", err);
      res.status(500).json({ message: "Failed to process erasure" });
    }
  });

  app.post("/api/settings/holidays/import", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const tenant = await storage.getTenant(orgId);
      const region =
        (req.body?.region as string)?.trim() ||
        (tenant?.brandingConfig as { organization?: { publicHolidayRegion?: string } })
          ?.organization?.publicHolidayRegion ||
        "GB-England";
      const { holidaysForRegion, mergeCustomHolidays } = await import("./lib/public-holidays");
      const imported = holidaysForRegion(region);
      const current = (tenant?.brandingConfig as Record<string, unknown>) || {};
      const existing = (current.holidays as string[]) ?? [];
      const holidays = mergeCustomHolidays(existing, imported);
      await storage.updateTenant(orgId, {
        brandingConfig: { ...current, holidays, organization: { ...(current.organization as object), publicHolidayRegion: region } },
      });
      res.json({ region, count: holidays.length, holidays });
    } catch (err) {
      res.status(500).json({ message: "Failed to import holidays" });
    }
  });

  app.get("/api/settings/business-calendar", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const tenant = await storage.getTenant(orgId);
      const { getOrgCalendarConfig, isWithinBusinessTime } = await import(
        "./lib/business-calendar"
      );
      const cfg = getOrgCalendarConfig(tenant);
      const now = new Date();
      res.json({
        config: cfg,
        isBusinessTimeNow: isWithinBusinessTime(now, tenant),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to load calendar config" });
    }
  });

  app.post("/api/settings/logo", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const dataUrl = req.body?.dataUrl as string;
      if (!dataUrl?.startsWith("data:image/")) {
        return res.status(400).json({ message: "dataUrl must be a data:image/... URI" });
      }
      if (dataUrl.length > 600_000) {
        return res.status(400).json({ message: "Image too large (max ~500KB)" });
      }
      await storage.updateTenant(orgId, { logoUrl: dataUrl });
      res.json({ logoUrl: dataUrl });
    } catch (err) {
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  app.get("/api/settings/org-units/export", async (req, res) => {
    try {
      const tenantId = requireSettingsOrgId(req, res);
      if (tenantId == null) return;
      const units = await storage.getOrgUnits(tenantId);
      const header = "id,name,type,parentId,description";
      const lines = units.map(
        (u) =>
          `${u.id},"${(u.name || "").replace(/"/g, '""')}",${u.type},${u.parentId ?? ""},"${(u.description || "").replace(/"/g, '""')}"`,
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="org-units-${tenantId}.csv"`);
      res.send([header, ...lines].join("\n"));
    } catch (err) {
      res.status(500).json({ message: "Failed to export org units" });
    }
  });

  app.post("/api/settings/org-units/import", async (req, res) => {
    try {
      const tenantId = requireSettingsOrgId(req, res);
      if (tenantId == null) return;
      const rows = req.body?.rows as Array<{
        name: string;
        type?: string;
        parentId?: number | null;
        description?: string;
      }>;
      if (!Array.isArray(rows) || !rows.length) {
        return res.status(400).json({ message: "rows array required" });
      }
      let created = 0;
      for (const row of rows) {
        if (!row.name?.trim()) continue;
        await storage.createOrgUnit({
          tenantId,
          name: row.name.trim(),
          type: row.type || "department",
          parentId: row.parentId ?? null,
          description: row.description ?? null,
        });
        created++;
      }
      res.json({ created });
    } catch (err) {
      res.status(500).json({ message: "Failed to import org units" });
    }
  });

  app.put("/api/settings/preferences", async (req, res) => {
    const userId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { mergeNotificationPreferences } = await import("./lib/notification-preferences");
      const notifications = mergeNotificationPreferences(req.body?.notifications ?? req.body);
      const [row] = await db
        .update(usersTable)
        .set({ preferences: notifications, updatedAt: new Date() })
        .where(eq(usersTable.id, userId))
        .returning();
      if (!row) return res.status(404).json({ message: "User not found" });
      res.json({ notifications: mergeNotificationPreferences(row.preferences) });
    } catch (err) {
      console.error("Preferences PUT error:", err);
      res.status(500).json({ message: "Failed to save preferences" });
    }
  });

  app.get("/api/settings/audit/org-events", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res);
      if (orgId == null) return;
      const rows = await listOrgAuditEvents(orgId);
      const userIds = [...new Set(rows.map((r) => r.actorUserId).filter(Boolean))];
      const userRows =
        userIds.length > 0
          ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
          : [];
      const userById = new Map(userRows.map((u) => [u.id, u]));

      res.json({
        events: rows.map((row) => {
          const actor = userById.get(row.actorUserId);
          return {
            ...row,
            actorEmail: actor?.email ?? null,
            actorName: [actor?.firstName, actor?.lastName].filter(Boolean).join(" ") || null,
          };
        }),
      });
    } catch (err) {
      console.error("Org audit error:", err);
      res.status(500).json({ message: "Failed to load organisation activity" });
    }
  });

  // Notifications
  app.get("/api/notifications", async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const scopedClientId = workspaceClientId(req);
    const notifications = await storage.getNotifications(userId, limit, scopedClientId);
    res.json(notifications);
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const scopedClientId = workspaceClientId(req);
    const count = await storage.getUnreadNotificationCount(userId, scopedClientId);
    res.json({ count });
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const notification = await storage.markNotificationAsRead(Number(req.params.id), userId);
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json(notification);
  });

  app.post("/api/notifications/read-all", async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await storage.markAllNotificationsAsRead(userId);
    res.json({ success: true });
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteNotification(Number(req.params.id), userId);
    res.status(204).send();
  });

  // Feedback
  app.get("/api/feedback", async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const profile = await storage.getProfile(userId);
    const tenantId = profile?.tenantId || (req.query.tenantId ? Number(req.query.tenantId) : undefined);
    const feedbackItems = await storage.getFeedback(tenantId);
    res.json(feedbackItems);
  });

  app.post("/api/feedback", async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { type, title, description, priority, pageUrl, userAgent } = req.body;
      if (!type || !title || !description) {
        return res.status(400).json({ message: "Type, title, and description are required" });
      }
      const validTypes = ["bug", "feature", "improvement", "general"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ message: "Invalid feedback type" });
      }
      const validPriorities = ["low", "medium", "high", "critical"];
      if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({ message: "Invalid priority" });
      }
      const profile = await storage.getProfile(userId);
      const feedbackData = {
        userId,
        tenantId: profile?.tenantId,
        type,
        title,
        description,
        priority: priority || "medium",
        pageUrl,
        userAgent,
      };
      const feedbackItem = await storage.createFeedback(feedbackData);
      res.status(201).json(feedbackItem);
    } catch (err) {
      console.error("Error creating feedback:", err);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  app.patch("/api/feedback/:id/status", async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { status } = req.body;
    const validStatuses = ["open", "in-review", "planned", "closed"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Valid status is required" });
    }
    const feedbackItem = await storage.updateFeedbackStatus(Number(req.params.id), status);
    if (!feedbackItem) return res.status(404).json({ message: "Feedback not found" });
    res.json(feedbackItem);
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      if (!isRequestAuthenticated(req)) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const tenantId = getApiTenantIdWithFallback(req);
      const profilesWithUsers = await storage.getProfiles(tenantId);
      const result = profilesWithUsers.map((p: any) => ({
        id: p.user?.id || p.userId,
        firstName: p.user?.firstName || p.firstName || null,
        lastName: p.user?.lastName || p.lastName || null,
        email: p.user?.email || null,
        profileImageUrl: p.user?.profileImageUrl || p.photoUrl || null,
        department: p.department || null,
        jobTitle: p.jobTitle || null,
      }));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch admin users" });
    }
  });

  // Settings - Profiles (Users)
  app.get("/api/settings/users", async (req, res) => {
    const tenantId = requireSettingsOrgId(req, res);
    if (tenantId == null) return;
    const profiles = await storage.getProfiles(tenantId);
    res.json(profiles);
  });

  app.put("/api/settings/users/:id", async (req, res) => {
    try {
      const { email, firstName, lastName, ...profileData } = req.body;
      const profile = await storage.updateProfile(Number(req.params.id), profileData);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      if (email !== undefined || firstName !== undefined || lastName !== undefined) {
        const userUpdates: Record<string, any> = { updatedAt: new Date() };
        if (email !== undefined) userUpdates.email = email;
        if (firstName !== undefined) userUpdates.firstName = firstName;
        if (lastName !== undefined) userUpdates.lastName = lastName;
        await db.update(usersTable).set(userUpdates).where(eq(usersTable.id, profile.userId));
      }

      res.json(profile);
    } catch (err: any) {
      console.error("Update profile error:", err?.message || err);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/settings/users", async (req, res) => {
    try {
      const tenantId = requireSettingsOrgId(req, res, req.body.tenantId);
      if (tenantId == null) return;
      const { firstName, lastName, email, userId: providedUserId, ...profileData } = req.body;

      let userId = providedUserId;

      if (!userId && email) {
        const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
        if (existingUser.length > 0) {
          userId = existingUser[0].id;
        } else {
          const [newUser] = await db.insert(usersTable).values({
            email,
            firstName: firstName || null,
            lastName: lastName || null,
          }).returning();
          userId = newUser.id;
        }
      }

      if (!userId) {
        return res.status(400).json({ message: "Email is required to create a user" });
      }

      const existingProfile = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
      if (existingProfile.length > 0) {
        return res.status(409).json({ message: "A profile already exists for this user" });
      }

      const profile = await storage.createProfile({
        userId,
        tenantId,
        userType: profileData.userType || "internal",
        department: profileData.department || null,
        jobTitle: profileData.jobTitle || null,
        phone: profileData.phone || null,
        roleId: profileData.roleId || null,
        orgUnitId: profileData.orgUnitId || null,
        costCentreId: profileData.costCentreId || null,
        managerId: profileData.managerId || null,
        startDate: profileData.startDate ? new Date(profileData.startDate) : null,
        endDate: profileData.endDate ? new Date(profileData.endDate) : null,
      });
      res.status(201).json(profile);
    } catch (err: any) {
      console.error("Create user error:", err?.message || err);
      res.status(500).json({ message: "Failed to create user profile" });
    }
  });

  app.delete("/api/settings/users/:id", async (req, res) => {
    try {
      await storage.deleteProfile(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete profile" });
    }
  });

  app.get("/api/settings/users/:id/permissions", async (req, res) => {
    try {
      const permissions = await storage.getUserModulePermissions(Number(req.params.id));
      res.json(permissions);
    } catch (err) {
      res.status(500).json({ message: "Failed to get permissions" });
    }
  });

  app.put("/api/settings/users/:id/permissions", async (req, res) => {
    try {
      const orgId = requireSettingsOrgId(req, res, req.body.tenantId);
      if (orgId == null) return;
      const { permissions } = req.body;
      const result = await storage.upsertUserModulePermissions(
        Number(req.params.id),
        orgId,
        permissions || [],
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to update permissions" });
    }
  });

  // Org Units
  app.get("/api/settings/org-units", async (req, res) => {
    try {
      const tenantId = requireSettingsOrgId(req, res);
      if (tenantId == null) return;
      const orgUnitsList = await storage.getOrgUnits(tenantId);
      res.json(orgUnitsList);
    } catch (err) {
      res.status(500).json({ message: "Failed to get org units" });
    }
  });

  app.post("/api/settings/org-units", async (req, res) => {
    try {
      const tenantId = requireSettingsOrgId(req, res, req.body.tenantId);
      if (tenantId == null) return;
      const orgUnit = await storage.createOrgUnit({
        ...req.body,
        tenantId,
      });
      res.status(201).json(orgUnit);
    } catch (err) {
      res.status(500).json({ message: "Failed to create org unit" });
    }
  });

  app.put("/api/settings/org-units/:id", async (req, res) => {
    try {
      const orgUnit = await storage.updateOrgUnit(Number(req.params.id), req.body);
      if (!orgUnit) return res.status(404).json({ message: "Org unit not found" });
      res.json(orgUnit);
    } catch (err) {
      res.status(500).json({ message: "Failed to update org unit" });
    }
  });

  app.delete("/api/settings/org-units/:id", async (req, res) => {
    try {
      await storage.deleteOrgUnit(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete org unit" });
    }
  });

  // Cost Centres
  app.get("/api/settings/cost-centres", async (req, res) => {
    try {
      const tenantId = requireSettingsOrgId(req, res);
      if (tenantId == null) return;
      const list = await storage.getCostCentres(tenantId);
      res.json(list);
    } catch (err) {
      res.status(500).json({ message: "Failed to get cost centres" });
    }
  });

  app.post("/api/settings/cost-centres", async (req, res) => {
    try {
      const tenantId = requireSettingsOrgId(req, res, req.body.tenantId);
      if (tenantId == null) return;
      const costCentre = await storage.createCostCentre({
        ...req.body,
        tenantId,
      });
      res.status(201).json(costCentre);
    } catch (err) {
      res.status(500).json({ message: "Failed to create cost centre" });
    }
  });

  app.put("/api/settings/cost-centres/:id", async (req, res) => {
    try {
      const costCentre = await storage.updateCostCentre(Number(req.params.id), req.body);
      if (!costCentre) return res.status(404).json({ message: "Cost centre not found" });
      res.json(costCentre);
    } catch (err) {
      res.status(500).json({ message: "Failed to update cost centre" });
    }
  });

  app.delete("/api/settings/cost-centres/:id", async (req, res) => {
    try {
      await storage.deleteCostCentre(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete cost centre" });
    }
  });

  // User Project Assignment counts (batch)
  app.get("/api/settings/assignment-counts", async (req, res) => {
    try {
      const tenantId = requireSettingsOrgId(req, res);
      if (tenantId == null) return;
      const counts = await storage.getAssignmentCountsByTenant(tenantId);
      res.json(counts);
    } catch (err) {
      res.status(500).json({ message: "Failed to get assignment counts" });
    }
  });

  // User Project Assignments
  app.get("/api/settings/users/:id/assignments", async (req, res) => {
    try {
      const assignments = await storage.getUserProjectAssignments(Number(req.params.id));
      res.json(assignments);
    } catch (err) {
      res.status(500).json({ message: "Failed to get assignments" });
    }
  });

  app.post("/api/settings/users/:id/assignments", async (req, res) => {
    try {
      const tenantId = requireSettingsOrgId(req, res, req.body.tenantId);
      if (tenantId == null) return;
      const { profileId: _ignored, ...body } = req.body;
      const assignment = await storage.createUserProjectAssignment({
        ...body,
        profileId: Number(req.params.id),
        tenantId,
      });
      res.status(201).json(assignment);
    } catch (err: any) {
      console.error("Create assignment error:", err?.message || err);
      res.status(500).json({ message: "Failed to create assignment" });
    }
  });

  const bulkAssignmentSchema = z.object({
    profileIds: z.array(z.number().int().positive()).min(1, "At least one profile is required"),
    assignmentType: z.enum(["project", "programme"]),
    projectId: z.number().int().positive().nullable(),
    programId: z.number().int().positive().nullable(),
    accessLevel: z.enum(["view", "contribute", "manage"]),
    tenantId: z.number().int().positive().optional(),
  }).refine(
    (d) => (d.assignmentType === "project" ? d.projectId != null : d.programId != null),
    { message: "projectId or programId must be provided based on assignmentType" }
  );

  app.post("/api/settings/bulk-assignments", async (req, res) => {
    try {
      const parsed = bulkAssignmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
      }
      const { profileIds, assignmentType, projectId, programId, accessLevel, tenantId: bodyTenantId } = parsed.data;
      const orgResolve = resolveSettingsOrgId(req.permissions, bodyTenantId);
      if (!orgResolve.ok) {
        return res.status(orgResolve.status).json({ message: orgResolve.message });
      }
      const tid = orgResolve.orgId;
      const results = [];
      const errors = [];
      for (const pid of profileIds) {
        try {
          const assignment = await storage.createUserProjectAssignment({
            profileId: Number(pid),
            tenantId: tid,
            assignmentType: assignmentType || "project",
            projectId: projectId ? Number(projectId) : null,
            programId: programId ? Number(programId) : null,
            accessLevel: accessLevel || "view",
            isActive: true,
          });
          results.push(assignment);
        } catch (err: any) {
          errors.push({ profileId: pid, error: err?.message || "Failed" });
        }
      }
      res.status(201).json({ created: results.length, errors: errors.length, results, errorDetails: errors });
    } catch (err: any) {
      console.error("Bulk assignment error:", err?.message || err);
      res.status(500).json({ message: "Failed to create bulk assignments" });
    }
  });

  app.put("/api/settings/assignments/:id", async (req, res) => {
    try {
      const assignment = await storage.updateUserProjectAssignment(Number(req.params.id), req.body);
      if (!assignment) return res.status(404).json({ message: "Assignment not found" });
      res.json(assignment);
    } catch (err) {
      res.status(500).json({ message: "Failed to update assignment" });
    }
  });

  app.delete("/api/settings/assignments/:id", async (req, res) => {
    try {
      await storage.deleteUserProjectAssignment(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete assignment" });
    }
  });

  // Modules
  app.get(api.modules.list.path, async (req, res) => {
    const modules = await storage.getModules();
    res.json(modules);
  });

  // Boards
  app.get(api.boards.list.path, async (req, res) => {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const moduleId = req.query.moduleId ? Number(req.query.moduleId) : undefined;
    const boards = await storage.getBoards(tenantId, moduleId, workspaceClientId(req));
    res.json(boards);
  });

  app.post(api.boards.create.path, async (req, res) => {
    try {
      const input = api.boards.create.input.parse(req.body);
      const board = await storage.createBoard(input);
      res.status(201).json(board);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.boards.get.path, async (req, res) => {
    const board = await storage.getBoard(Number(req.params.id));
    if (!board) return res.status(404).json({ message: "Board not found" });
    if (!assertRecordInWorkspace(req, res, board.workspaceId)) return;
    res.json(board);
  });

  // Columns
  app.get(api.columns.list.path, async (req, res) => {
    const columns = await storage.getColumns(Number(req.params.boardId));
    res.json(columns);
  });

  app.post(api.columns.create.path, async (req, res) => {
    try {
      const boardId = Number(req.params.boardId);
      const parsedBody = api.columns.create.input.parse(req.body);
      const column = await storage.createColumn({ ...parsedBody, boardId });
      res.status(201).json(column);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Items
  app.get(api.items.list.path, async (req, res) => {
    const items = await storage.getItems(Number(req.params.boardId));
    res.json(items);
  });

  app.post(api.items.create.path, async (req, res) => {
    try {
      const boardId = Number(req.params.boardId);
      const parsedBody = api.items.create.input.parse(req.body);
      const item = await storage.createItem({ ...parsedBody, boardId });
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.items.update.path, async (req, res) => {
    try {
      const input = api.items.update.input.parse(req.body);
      const item = await storage.updateItem(Number(req.params.id), input);
      if (!item) return res.status(404).json({ message: "Item not found" });
      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.items.delete.path, async (req, res) => {
    await storage.deleteItem(Number(req.params.id));
    res.status(204).send();
  });

  // === CHAT MODULE ROUTES ===

  const { assertCanAccessChannel, assertCanAccessMessage, assertCanPostToChannel } = await import("./chat/access");

  // Helper to get user ID from OIDC claims
  const getUserId = (req: any): string | null => {
    return req.user?.claims?.sub || null;
  };

  // Projects
  app.get("/api/chat/projects", async (req, res) => {
    if (!isRequestAuthenticated(req) || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const tenantId = getApiTenantIdWithFallback(req);
    const projects = await storage.getProjects(tenantId);
    res.json(projects);
  });

  app.get("/api/chat/projects/user", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const tenantId = getApiTenantIdWithFallback(req);
    const projects = await storage.getUserProjects(userId, tenantId);
    res.json(projects);
  });

  app.post("/api/chat/projects", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const project = await storage.createProject({ ...req.body, tenantId });
      // Add creator as project owner
      await storage.addProjectMember({
        projectId: project.id,
        userId,
        role: "owner",
      });
      res.status(201).json(project);
    } catch (err) {
      res.status(400).json({ message: "Failed to create project" });
    }
  });

  app.get("/api/chat/projects/:id", async (req, res) => {
    if (!isRequestAuthenticated(req) || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const project = await storage.getProject(Number(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });

  app.patch("/api/chat/projects/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const projectId = Number(req.params.id);
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Team not found" });

    const tenantId = getApiTenantIdWithFallback(req);
    if (project.tenantId !== tenantId) return res.status(403).json({ message: "Access denied" });

    const isMember = await storage.isProjectMember(projectId, userId);
    if (!isMember) return res.status(403).json({ message: "Not a team member" });

    const { name, description } = req.body as { name?: string; description?: string };
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ message: "Team name is required" });
    }

    try {
      const updated = await storage.updateProject(projectId, {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
      });
      res.json(updated);
    } catch {
      res.status(400).json({ message: "Failed to update team" });
    }
  });

  // Project Members
  app.get("/api/chat/projects/:id/members", async (req, res) => {
    if (!isRequestAuthenticated(req)) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const members = await storage.getProjectMembers(Number(req.params.id));
    res.json(members);
  });

  app.post("/api/chat/projects/:id/members", async (req, res) => {
    if (!isRequestAuthenticated(req) || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const member = await storage.addProjectMember({
        projectId: Number(req.params.id),
        userId: req.body.userId,
        role: req.body.role || "member",
      });
      res.status(201).json(member);
    } catch (err) {
      res.status(400).json({ message: "Failed to add member" });
    }
  });

  // Channels
  app.get("/api/chat/channels", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const projectId = req.query.projectId === "null" ? null : req.query.projectId ? Number(req.query.projectId) : undefined;
      const channels = await storage.getChannels(tenantId, userId, projectId);
      res.json(channels);
    } catch (err) {
      console.error("[chat/channels] error:", err);
      res.status(500).json({ message: "Failed to load channels" });
    }
  });

  app.post("/api/chat/channels", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const channel = await storage.createChannel({
        ...req.body,
        tenantId,
        createdById: userId,
      });
      // Add creator as channel admin
      await storage.addChannelMember({
        channelId: channel.id,
        userId,
        role: "admin",
      });
      res.status(201).json(channel);
    } catch (err) {
      res.status(400).json({ message: "Failed to create channel" });
    }
  });

  app.get("/api/chat/channels/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const channelId = Number(req.params.id);
    const access = await assertCanAccessChannel(channelId, userId);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    res.json(access.channel);
  });

  app.delete("/api/chat/channels/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const channelId = Number(req.params.id);
    const isAdmin = await storage.isChannelAdmin(channelId, userId);
    if (!isAdmin) return res.status(403).json({ message: "Admin only" });
    await storage.deleteChannel(channelId);
    res.status(204).send();
  });

  // Channel Members
  app.get("/api/chat/channels/:id/members", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const channelId = Number(req.params.id);
    const access = await assertCanAccessChannel(channelId, userId);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    const members = await storage.getChannelMembers(channelId);
    res.json(members);
  });

  app.post("/api/chat/channels/:id/members", async (req, res) => {
    if (!isRequestAuthenticated(req) || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const member = await storage.addChannelMember({
        channelId: Number(req.params.id),
        userId: req.body.userId,
        role: req.body.role || "member",
      });
      res.status(201).json(member);
    } catch (err) {
      res.status(400).json({ message: "Failed to add member" });
    }
  });

  app.post("/api/chat/channels/:id/join", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const channel = await storage.getChannel(Number(req.params.id));
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    if (channel.type === "private") return res.status(403).json({ message: "Cannot join private channel" });
    
    try {
      const member = await storage.addChannelMember({
        channelId: channel.id,
        userId,
        role: "member",
      });
      res.status(201).json(member);
    } catch (err) {
      res.status(400).json({ message: "Already a member" });
    }
  });

  app.post("/api/chat/channels/:id/read", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    await storage.updateLastRead(Number(req.params.id), userId);
    res.status(200).json({ success: true });
  });

  // Messages
  app.get("/api/chat/channels/:id/messages", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const channelId = Number(req.params.id);
      const access = await assertCanAccessChannel(channelId, userId);
      if (!access.ok) return res.status(access.status).json({ message: access.message });
      const channel = access.channel;

      const limit = Number(req.query.limit) || 50;
      const before = req.query.before ? Number(req.query.before) : undefined;
      const parentId =
        req.query.parentId === "null" || req.query.parentId === undefined
          ? null
          : Number(req.query.parentId);
      const messages = await storage.getMessages(channel.id, limit, before, parentId, userId);
      res.json(messages);
    } catch (err) {
      console.error("[chat/messages] error:", err);
      res.status(500).json({ message: "Failed to load messages" });
    }
  });

  app.post("/api/chat/channels/:id/messages", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const channelId = Number(req.params.id);
    const { assertCanPostToChannel, afterChatMessageCreated } = await import("./chat/extended-routes");
    const gate = await assertCanPostToChannel(channelId, userId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const channel = await storage.getChannel(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    try {
      const message = await storage.createMessage({
        channelId: channel.id,
        userId,
        content: req.body.content,
        parentId: req.body.parentId || null,
      });
      if (channel.type === "public") {
        const isMember = await storage.isChannelMember(channel.id, userId);
        if (!isMember) {
          await storage.addChannelMember({ channelId: channel.id, userId, role: "member" });
        }
      }
      const members = await storage.getChannelMembers(channel.id);
      const author = members.find((m) => m.user.id === userId)?.user;
      const authorName = [author?.firstName, author?.lastName].filter(Boolean).join(" ") || "User";
      await afterChatMessageCreated({
        channelId: channel.id,
        userId,
        content: req.body.content,
        messageId: message.id,
        attachmentIds: Array.isArray(req.body.attachmentIds) ? req.body.attachmentIds : undefined,
        authorName,
      });
      res.status(201).json(message);
    } catch (err) {
      res.status(400).json({ message: "Failed to send message" });
    }
  });

  app.put("/api/chat/messages/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const message = await storage.getMessage(Number(req.params.id));
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.userId !== userId) return res.status(403).json({ message: "Can only edit own messages" });

    const updated = await storage.updateMessage(message.id, req.body.content);
    res.json(updated);
  });

  app.delete("/api/chat/messages/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const message = await storage.getMessage(Number(req.params.id));
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.userId !== userId) return res.status(403).json({ message: "Can only delete own messages" });

    await storage.deleteMessage(message.id);
    res.status(204).send();
  });

  // Reactions
  app.post("/api/chat/messages/:id/reactions", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const messageId = Number(req.params.id);
      const access = await assertCanAccessMessage(messageId, userId);
      if (!access.ok) return res.status(access.status).json({ message: access.message });
      const reaction = await storage.addReaction({
        messageId,
        userId,
        emoji: req.body.emoji,
      });
      const { getChatWebSocket } = await import("./websocket");
      const wss = getChatWebSocket();
      if (wss) {
        wss.sendToChannel(access.message.channelId, {
          type: "reaction",
          payload: { channelId: access.message.channelId, messageId },
        });
      }
      res.status(201).json(reaction);
    } catch (err) {
      res.status(400).json({ message: "Reaction already exists" });
    }
  });

  app.delete("/api/chat/messages/:id/reactions/:emoji", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const messageId = Number(req.params.id);
    const access = await assertCanAccessMessage(messageId, userId);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    await storage.removeReaction(messageId, userId, decodeURIComponent(req.params.emoji));
    const { getChatWebSocket } = await import("./websocket");
    const wss = getChatWebSocket();
    if (wss) {
      wss.sendToChannel(access.message.channelId, {
        type: "reaction",
        payload: { channelId: access.message.channelId, messageId },
      });
    }
    res.status(204).send();
  });

  app.get("/api/chat/messages/:id/thread", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const parentId = Number(req.params.id);
      const access = await assertCanAccessMessage(parentId, userId);
      if (!access.ok) return res.status(access.status).json({ message: access.message });
      const parentMsg = await storage.getMessageWithUser(parentId);
      if (!parentMsg) return res.status(404).json({ message: "Message not found" });
      const replies = await storage.getThreadReplies(parentId);
      res.json({ parent: parentMsg, replies });
    } catch (err) {
      console.error("[chat/thread] error:", err);
      res.status(500).json({ message: "Failed to load thread" });
    }
  });

  app.get("/api/chat/inbox", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    try {
      const scopedClientId = workspaceClientId(req);
      const inbox = await storage.getChatInbox(userId, tenantId, scopedClientId);
      res.json(inbox);
    } catch (err) {
      console.error("[chat/inbox] error:", err);
      res.status(500).json({ message: "Failed to load inbox" });
    }
  });

  app.post("/api/chat/channel-favorites/:channelId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    await storage.addChannelFavorite(userId, Number(req.params.channelId), tenantId);
    res.status(201).json({ success: true });
  });

  app.delete("/api/chat/channel-favorites/:channelId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    await storage.removeChannelFavorite(userId, Number(req.params.channelId), tenantId);
    res.status(204).send();
  });

  app.post("/api/chat/teams", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const { name, description, isPrivate, memberIds } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Team name is required" });
    try {
      const result = await storage.createChatTeam(userId, tenantId, {
        name: name.trim(),
        description,
        isPrivate: Boolean(isPrivate),
        memberIds: Array.isArray(memberIds) ? memberIds : [],
      });
      res.status(201).json(result);
    } catch {
      res.status(400).json({ message: "Failed to create team" });
    }
  });

  app.get("/api/chat/search", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const q = String(req.query.q ?? "");
      const channelId = req.query.channelId ? Number(req.query.channelId) : undefined;
      const hits = await storage.searchChatMessages(userId, tenantId, q, channelId);
      res.json(hits);
    } catch (err) {
      console.error("[chat/search] error:", err);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // ── Chat Polls ──────────────────────────────────────────────────────────────

  app.post("/api/chat/channels/:id/polls", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const channelId = Number(req.params.id);
    const gate = await assertCanPostToChannel(channelId, userId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
    const { question, options, durationMinutes = 1440, anonymous = false } = req.body;
    if (!question || !Array.isArray(options) || options.length < 2 || options.length > 6) {
      return res.status(400).json({ message: "Question and 2–6 options required" });
    }
    try {
      const { chatPolls, chatMessages: chatMessagesTable } = await import("@shared/models/chat");
      const closedAt = new Date(Date.now() + Number(durationMinutes) * 60 * 1000);
      const [poll] = await db.insert(chatPolls).values({
        channelId, createdByUserId: userId,
        question, options: JSON.stringify(options),
        durationMinutes: Number(durationMinutes), anonymous: Boolean(anonymous), closedAt,
      }).returning();
      const [message] = await db.insert(chatMessagesTable).values({
        channelId, userId, content: `📊 ${question}`,
        messageType: "poll", pollId: poll.id,
      }).returning();
      const { getChatWebSocket } = await import("./websocket");
      const wss = getChatWebSocket();
      if (wss) wss.sendToChannel(channelId, { type: "message", payload: { channelId } });
      res.status(201).json({ poll, message });
    } catch (err) {
      console.error("Error creating poll:", err);
      res.status(500).json({ message: "Failed to create poll", error: String(err) });
    }
  });

  app.get("/api/chat/polls/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const pollId = Number(req.params.id);
    try {
      const { chatPolls, chatPollVotes } = await import("@shared/models/chat");
      const [poll] = await db.select().from(chatPolls).where(eq(chatPolls.id, pollId));
      if (!poll) return res.status(404).json({ message: "Poll not found" });
      const access = await assertCanAccessChannel(poll.channelId, userId);
      if (!access.ok) return res.status(access.status).json({ message: access.message });
      const votes = await db.select().from(chatPollVotes).where(eq(chatPollVotes.pollId, pollId));
      const options: string[] = JSON.parse(poll.options);
      const voteCounts = options.map((_, i) => votes.filter(v => v.optionIndex === i).length);
      const myVote = votes.find(v => v.userId === userId)?.optionIndex ?? null;
      const isClosed = poll.closedAt ? new Date(poll.closedAt) < new Date() : false;
      res.json({ ...poll, options, voteCounts, totalVotes: votes.length, myVote, isClosed });
    } catch (err) {
      res.status(500).json({ message: "Failed to get poll" });
    }
  });

  app.post("/api/chat/polls/:id/vote", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const pollId = Number(req.params.id);
    const { optionIndex } = req.body;
    if (typeof optionIndex !== "number") return res.status(400).json({ message: "optionIndex required" });
    try {
      const { chatPolls, chatPollVotes } = await import("@shared/models/chat");
      const [poll] = await db.select().from(chatPolls).where(eq(chatPolls.id, pollId));
      if (!poll) return res.status(404).json({ message: "Poll not found" });
      const access = await assertCanAccessChannel(poll.channelId, userId);
      if (!access.ok) return res.status(access.status).json({ message: access.message });
      if (poll.closedAt && new Date(poll.closedAt) < new Date()) {
        return res.status(400).json({ message: "Poll is closed" });
      }
      const options: string[] = JSON.parse(poll.options);
      if (optionIndex < 0 || optionIndex >= options.length) {
        return res.status(400).json({ message: "Invalid option" });
      }
      const existing = await db.select().from(chatPollVotes)
        .where(and(eq(chatPollVotes.pollId, pollId), eq(chatPollVotes.userId, userId)));
      if (existing.length > 0) {
        await db.update(chatPollVotes).set({ optionIndex })
          .where(and(eq(chatPollVotes.pollId, pollId), eq(chatPollVotes.userId, userId)));
      } else {
        await db.insert(chatPollVotes).values({ pollId, userId, optionIndex });
      }
      const { getChatWebSocket } = await import("./websocket");
      const wss = getChatWebSocket();
      if (wss) wss.sendToChannel(poll.channelId, { type: "poll_vote", payload: { pollId, channelId: poll.channelId } });
      res.json({ success: true });
    } catch (err) {
      console.error("Error voting on poll:", err);
      res.status(500).json({ message: "Failed to vote", error: String(err) });
    }
  });

  // User Favorites for Chat
  app.get("/api/chat/favorites", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const favorites = await storage.getUserFavorites(userId, tenantId);
    res.json(favorites);
  });

  app.post("/api/chat/favorites", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const favorite = await storage.addUserFavorite(userId, req.body.favoriteUserId, tenantId);
      res.status(201).json(favorite);
    } catch (err) {
      res.status(400).json({ message: "Failed to add favorite" });
    }
  });

  app.delete("/api/chat/favorites/:favoriteUserId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    await storage.removeUserFavorite(userId, req.params.favoriteUserId, tenantId);
    res.status(204).send();
  });

  // User Search for Chat
  app.get("/api/chat/users/search", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const query = (req.query.q as string) || "";
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const users = await storage.searchUsers(tenantId, query, projectId);
    res.json(users);
  });

  // Get all tenant users
  app.get("/api/chat/users", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const users = await storage.getTenantUsers(tenantId);
    res.json(users);
  });

  // Direct Messages - Get or create DM channel with another user
  app.post("/api/chat/dm", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const otherUserId = req.body.otherUserId;
      const channel = await storage.getOrCreateDMChannel(userId, otherUserId, tenantId);
      res.json(channel);
    } catch (err) {
      res.status(400).json({ message: "Failed to create DM channel" });
    }
  });

  // Get direct message conversations
  app.get("/api/chat/dm", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const dms = await storage.getDirectMessageChannels(userId, tenantId);
    res.json(dms);
  });

  const { registerExtendedChatRoutes } = await import("./chat/extended-routes");
  await registerExtendedChatRoutes(app, getUserId, getApiTenantIdWithFallback);

  // === CRM MODULE ROUTES ===

  app.post("/api/crm/seed-demo-data", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ message: "Demo seed is disabled in production" });
    }
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { seedCrmDemoData } = await import("./seed-crm-demo");
      const counts = await seedCrmDemoData();
      res.json({ success: true, counts });
    } catch (err) {
      console.error("Failed to seed CRM demo data:", err);
      res.status(500).json({ message: "Failed to seed demo data" });
    }
  });

  app.get("/api/crm/dashboard-stats", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    try {
      const listClientId = resolveListClientId(req);
      const [accounts, leads, opportunities, stages, contracts] = await Promise.all([
        storage.getCrmAccounts(tenantId, listClientId),
        storage.getCrmLeads(tenantId, listClientId),
        storage.getCrmOpportunities(tenantId, undefined, undefined, listClientId),
        storage.getCrmOpportunityStages(tenantId),
        storage.getCrmContracts(tenantId, undefined, listClientId),
      ]);

      const openStages = stages.filter((s: any) => !s.isClosed);
      const wonStages = stages.filter((s: any) => s.isWon);
      const lostStages = stages.filter((s: any) => s.isClosed && !s.isWon);

      const openOpps = opportunities.filter((o: any) => openStages.some((s: any) => s.id === o.stageId));
      const wonOpps = opportunities.filter((o: any) => wonStages.some((s: any) => s.id === o.stageId));
      const lostOpps = opportunities.filter((o: any) => lostStages.some((s: any) => s.id === o.stageId));

      const totalPipelineValue = openOpps.reduce((sum: number, o: any) => sum + (parseFloat(o.amount || "0") || 0), 0);
      const revenueWon = wonOpps.reduce((sum: number, o: any) => sum + (parseFloat(o.amount || "0") || 0), 0);
      const closedCount = wonOpps.length + lostOpps.length;
      const winRate = closedCount > 0 ? Math.round((wonOpps.length / closedCount) * 100) : 0;
      const avgDealSize = wonOpps.length > 0 ? Math.round(revenueWon / wonOpps.length) : 0;

      const weightedPipelineValue = openOpps.reduce((sum: number, o: any) => {
        const stage = stages.find((s: any) => s.id === o.stageId);
        const prob = o.probability || stage?.probability || 0;
        return sum + ((parseFloat(o.amount || "0") || 0) * prob / 100);
      }, 0);

      const now = new Date();
      const activeContracts = contracts.filter((c: any) => c.status === 'active');
      const expiringContracts = activeContracts.filter((c: any) => {
        if (!c.endDate) return false;
        const daysUntil = Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 90 && daysUntil > 0;
      });

      const activeLeads = leads.filter((l: any) => l.status !== 'converted');
      const hotLeads = activeLeads.filter((l: any) => (l.score || 0) >= 80);
      const newLeads = activeLeads.filter((l: any) => l.status === 'new');
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const newLeadsThisMonth = leads.filter((l: any) => new Date(l.createdAt) >= startOfMonth).length;
      const convertedLeads = leads.filter((l: any) => l.status === 'converted');
      const leadConversionRate = leads.length > 0 ? Math.round((convertedLeads.length / leads.length) * 100) : 0;

      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const recentWon = wonOpps.filter((o: any) => o.actualCloseDate && new Date(o.actualCloseDate) >= ninetyDaysAgo);
      const recentLost = lostOpps.filter((o: any) => o.actualCloseDate && new Date(o.actualCloseDate) >= ninetyDaysAgo);
      const closedRecent = recentWon.length + recentLost.length;
      const winRate90d = closedRecent > 0 ? Math.round((recentWon.length / closedRecent) * 100) : 0;

      const salesCycles = recentWon
        .filter((o: any) => o.createdAt && o.actualCloseDate)
        .map((o: any) => Math.ceil((new Date(o.actualCloseDate).getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
      const avgSalesCycle = salesCycles.length > 0 ? Math.round(salesCycles.reduce((a: number, b: number) => a + b, 0) / salesCycles.length) : 0;

      const hotOpportunities = [...openOpps]
        .sort((a: any, b: any) => (parseFloat(b.amount || "0") || 0) - (parseFloat(a.amount || "0") || 0))
        .slice(0, 10)
        .map((o: any) => {
          const stage = stages.find((s: any) => s.id === o.stageId);
          const account = accounts.find((a: any) => a.id === o.accountId);
          return { id: o.id, name: o.name, accountName: account?.name || "—", stage: stage?.name || "—", amount: parseFloat(o.amount || "0") || 0, expectedCloseDate: o.expectedCloseDate };
        });

      const activities = await storage.getCrmActivities(tenantId, undefined, undefined, undefined, listClientId);
      const recentActivity = activities
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map((a: any) => ({ id: a.id, type: a.type, subject: a.subject, createdAt: a.createdAt }));

      const ownerLeaderboard: Record<string, { ownerId: string; total: number; count: number }> = {};
      for (const o of openOpps) {
        const owner = o.ownerUserId || "unassigned";
        if (!ownerLeaderboard[owner]) ownerLeaderboard[owner] = { ownerId: owner, total: 0, count: 0 };
        ownerLeaderboard[owner].total += parseFloat(o.amount || "0") || 0;
        ownerLeaderboard[owner].count += 1;
      }
      const leaderboard = Object.values(ownerLeaderboard).sort((a, b) => b.total - a.total).slice(0, 8);

      const revenueForecast: { month: string; value: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
        const monthOpps = openOpps.filter((o: any) => {
          if (!o.expectedCloseDate) return i === 0;
          const cd = new Date(o.expectedCloseDate);
          return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
        });
        const value = monthOpps.reduce((s: number, o: any) => s + (parseFloat(o.amount || "0") || 0) * ((o.probability || 0) / 100), 0);
        revenueForecast.push({ month: key, value: Math.round(value) });
      }

      const stageBreakdown = openStages.map((stage: any) => {
        const stageOpps = opportunities.filter((o: any) => o.stageId === stage.id);
        const stageValue = stageOpps.reduce((sum: number, o: any) => sum + (parseFloat(o.amount || "0") || 0), 0);
        return { name: stage.name, count: stageOpps.length, value: stageValue, color: stage.color || '#6366f1' };
      });

      const topAccounts = accounts
        .map((a: any) => {
          const acctOpps = opportunities.filter((o: any) => o.accountId === a.id);
          const totalValue = acctOpps.reduce((sum: number, o: any) => sum + (parseFloat(o.amount || "0") || 0), 0);
          const openDeals = acctOpps.filter((o: any) => openStages.some((s: any) => s.id === o.stageId)).length;
          return { id: a.id, name: a.name, type: a.type, industry: a.industry, totalValue, openDeals, dealCount: acctOpps.length };
        })
        .sort((a: any, b: any) => b.totalValue - a.totalValue)
        .slice(0, 5);

      res.json({
        totalPipelineValue,
        weightedPipelineValue,
        revenueWon,
        winRate,
        avgDealSize,
        openOpportunities: openOpps.length,
        wonDeals: wonOpps.length,
        lostDeals: lostOpps.length,
        totalAccounts: accounts.length,
        activeLeads: activeLeads.length,
        hotLeads: hotLeads.length,
        newLeads: newLeads.length,
        newLeadsThisMonth,
        leadConversionRate,
        winRate90d,
        avgSalesCycle,
        activeContracts: activeContracts.length,
        expiringContracts: expiringContracts.length,
        stageBreakdown,
        topAccounts,
        hotOpportunities,
        recentActivity,
        leaderboard,
        revenueForecast,
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Failed to load dashboard stats" });
    }
  });

  // CRM Accounts
  app.get("/api/crm/accounts", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const accounts = await storage.getCrmAccounts(tenantId, resolveListClientId(req));
    res.json(accounts);
  });

  app.get("/api/crm/accounts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const account = await storage.getCrmAccount(Number(req.params.id));
    if (!account) return res.status(404).json({ message: "Account not found" });
    if (!assertRecordInWorkspace(req, res, account.clientId)) return;
    res.json(account);
  });

  app.get("/api/crm/accounts/:id/tickets", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const account = await storage.getCrmAccount(Number(req.params.id));
    if (!account) return res.status(404).json({ message: "Account not found" });
    if (!assertRecordInWorkspace(req, res, account.clientId)) return;
    const tenantId = getApiTenantIdWithFallback(req);
    const tickets = await storage.getCrmAccountTickets(tenantId, account.id, resolveListClientId(req));
    res.json(tickets);
  });

  app.get("/api/crm/accounts/:id/documents", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const account = await storage.getCrmAccount(Number(req.params.id));
    if (!account) return res.status(404).json({ message: "Account not found" });
    if (!assertRecordInWorkspace(req, res, account.clientId)) return;
    const tenantId = getApiTenantIdWithFallback(req);
    const clientId = account.clientId ?? resolveListClientId(req);
    if (clientId === undefined) {
      return res.json([]);
    }
    const docs = await storage.getDocumentsWithOwner(tenantId, undefined, clientId);
    res.json(docs.map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      status: d.status,
      updatedAt: d.updatedAt,
      ownerName: d.ownerName,
    })));
  });

  app.post("/api/crm/accounts", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const account = await storage.createCrmAccount({ ...req.body, tenantId, ownerUserId: userId });
      res.status(201).json(account);
    } catch (err) {
      res.status(400).json({ message: "Failed to create account" });
    }
  });

  app.put("/api/crm/accounts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const account = await storage.updateCrmAccount(Number(req.params.id), req.body);
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.json(account);
  });

  app.delete("/api/crm/accounts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmAccount(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Contacts
  app.get("/api/crm/contacts", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const contacts = await storage.getCrmContacts(tenantId, accountId, resolveListClientId(req));
    res.json(contacts);
  });

  app.get("/api/crm/contacts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const contact = await storage.getCrmContact(Number(req.params.id));
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    if (contact.accountId) {
      const account = await storage.getCrmAccount(contact.accountId);
      if (!assertRecordInWorkspace(req, res, account?.clientId)) return;
    }
    res.json(contact);
  });

  app.post("/api/crm/contacts", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const contact = await storage.createCrmContact({ ...req.body, tenantId, ownerUserId: userId });
      res.status(201).json(contact);
    } catch (err) {
      res.status(400).json({ message: "Failed to create contact" });
    }
  });

  app.put("/api/crm/contacts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const contact = await storage.updateCrmContact(Number(req.params.id), req.body);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  });

  app.delete("/api/crm/contacts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmContact(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Contact Relationships
  app.get("/api/crm/contacts/:id/relationships", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const relationships = await storage.getCrmContactRelationships(Number(req.params.id));
    res.json(relationships);
  });

  app.post("/api/crm/contact-relationships", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const relationship = await storage.createCrmContactRelationship(req.body);
    res.status(201).json(relationship);
  });

  app.delete("/api/crm/contact-relationships/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmContactRelationship(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Saved Views
  app.get("/api/crm/saved-views", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const entityType = req.query.entityType as string | undefined;
    const views = await storage.getCrmSavedViews(tenantId, entityType, userId);
    res.json(views);
  });

  app.post("/api/crm/saved-views", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const view = await storage.createCrmSavedView({ ...req.body, tenantId, userId });
      res.status(201).json(view);
    } catch (err) {
      console.error("Failed to create saved view:", err);
      res.status(400).json({ message: "Failed to create saved view" });
    }
  });

  app.put("/api/crm/saved-views/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const view = await storage.updateCrmSavedView(Number(req.params.id), req.body);
    if (!view) return res.status(404).json({ message: "Saved view not found" });
    res.json(view);
  });

  app.delete("/api/crm/saved-views/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmSavedView(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Email Templates
  app.get("/api/crm/email-templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const templates = await storage.getCrmEmailTemplates(tenantId);
    res.json(templates);
  });

  app.post("/api/crm/email-templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const template = await storage.createCrmEmailTemplate({ ...req.body, tenantId, createdByUserId: userId });
      res.status(201).json(template);
    } catch (err) {
      console.error("Failed to create email template:", err);
      res.status(400).json({ message: "Failed to create email template" });
    }
  });

  app.put("/api/crm/email-templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const template = await storage.updateCrmEmailTemplate(Number(req.params.id), req.body);
    if (!template) return res.status(404).json({ message: "Email template not found" });
    res.json(template);
  });

  app.delete("/api/crm/email-templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmEmailTemplate(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Email Logs
  app.get("/api/crm/email-logs", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
    const logs = await storage.getCrmEmailLogs(tenantId, entityType, entityId);
    res.json(logs);
  });

  app.post("/api/crm/email-logs", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const log = await storage.createCrmEmailLog({ ...req.body, tenantId, sentByUserId: userId });
      res.status(201).json(log);
    } catch (err) {
      console.error("Failed to create email log:", err);
      res.status(400).json({ message: "Failed to create email log" });
    }
  });

  // CRM Forecasts
  app.get("/api/crm/forecasts", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const userIdFilter = req.query.userId as string | undefined;
    const forecasts = await storage.getCrmForecasts(tenantId, userIdFilter);
    res.json(forecasts);
  });

  app.post("/api/crm/forecasts", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const forecastData = {
        ...req.body,
        tenantId,
        userId: req.body.userId || userId,
        periodStart: req.body.periodStart ? new Date(req.body.periodStart) : null,
        periodEnd: req.body.periodEnd ? new Date(req.body.periodEnd) : null,
      };
      const forecast = await storage.createCrmForecast(forecastData);
      res.status(201).json(forecast);
    } catch (err) {
      console.error("Failed to create forecast:", err);
      res.status(400).json({ message: "Failed to create forecast" });
    }
  });

  app.put("/api/crm/forecasts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const updateData = {
        forecastPeriod: req.body.forecastPeriod,
        periodStart: req.body.periodStart ? new Date(req.body.periodStart) : undefined,
        periodEnd: req.body.periodEnd ? new Date(req.body.periodEnd) : undefined,
        quotaAmount: req.body.quotaAmount,
        notes: req.body.notes,
      };
      const forecast = await storage.updateCrmForecast(Number(req.params.id), updateData);
      if (!forecast) return res.status(404).json({ message: "Forecast not found" });
      res.json(forecast);
    } catch (err) {
      console.error("Failed to update forecast:", err);
      res.status(400).json({ message: "Failed to update forecast" });
    }
  });

  app.delete("/api/crm/forecasts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmForecast(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Territories
  app.get("/api/crm/territories", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const territories = await storage.getCrmTerritories(tenantId);
    res.json(territories);
  });

  app.post("/api/crm/territories", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const territory = await storage.createCrmTerritory({ ...req.body, tenantId });
      res.status(201).json(territory);
    } catch (err) {
      console.error("Failed to create territory:", err);
      res.status(400).json({ message: "Failed to create territory" });
    }
  });

  app.put("/api/crm/territories/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const territory = await storage.updateCrmTerritory(Number(req.params.id), req.body);
    if (!territory) return res.status(404).json({ message: "Territory not found" });
    res.json(territory);
  });

  app.delete("/api/crm/territories/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmTerritory(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Custom Fields
  app.get("/api/crm/custom-fields", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const entityType = req.query.entityType as string | undefined;
    const fields = await storage.getCrmCustomFields(tenantId, entityType);
    res.json(fields);
  });

  app.post("/api/crm/custom-fields", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const existing = await storage.getCrmCustomFields(tenantId, req.body.entityType);
      if (existing.length >= 20) return res.status(400).json({ message: "Maximum 20 custom fields per entity" });
      const field = await storage.createCrmCustomField({ ...req.body, tenantId });
      res.status(201).json(field);
    } catch (err) {
      res.status(400).json({ message: "Failed to create custom field" });
    }
  });

  app.put("/api/crm/custom-fields/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const field = await storage.updateCrmCustomField(Number(req.params.id), req.body);
    if (!field) return res.status(404).json({ message: "Custom field not found" });
    res.json(field);
  });

  app.delete("/api/crm/custom-fields/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmCustomField(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/crm/forecast-matrix", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const period = (req.query.period as string) || "monthly";
    const scenario = (req.query.scenario as string) || "expected";
    const pipelineId = req.query.pipelineId ? Number(req.query.pipelineId) : undefined;
    const ownerUserId = req.query.ownerUserId as string | undefined;
    const monthsAhead = req.query.monthsAhead ? Number(req.query.monthsAhead) : undefined;
    const listClientId = resolveListClientId(req);
    const [opportunities, stages, accounts] = await Promise.all([
      storage.getCrmOpportunities(tenantId, undefined, undefined, listClientId),
      storage.getCrmOpportunityStages(tenantId),
      storage.getCrmAccounts(tenantId, listClientId),
    ]);
    const openStages = new Set(stages.filter((s: any) => !s.isClosed).map((s: any) => s.id));
    let openOpps = opportunities.filter((o: any) => openStages.has(o.stageId));
    if (pipelineId) {
      const pipelineStageIds = new Set(stages.filter((s: any) => s.pipelineId === pipelineId).map((s: any) => s.id));
      openOpps = openOpps.filter((o: any) => pipelineStageIds.has(o.stageId));
    }
    if (ownerUserId) {
      if (ownerUserId === "unassigned") {
        openOpps = openOpps.filter((o: any) => !o.ownerUserId);
      } else {
        openOpps = openOpps.filter((o: any) => o.ownerUserId === ownerUserId);
      }
    }
    const now = new Date();
    const columns: string[] = [];
    const defaultColCount = period === "annual" ? 4 : period === "quarterly" ? 8 : period === "half-year" ? 6 : 12;
    const colCount = monthsAhead && monthsAhead > 0 ? Math.min(monthsAhead, 24) : defaultColCount;
    for (let i = 0; i < colCount; i++) {
      if (period === "monthly") {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        columns.push(d.toLocaleString("en-US", { month: "short", year: "2-digit" }));
      } else if (period === "quarterly") {
        const q = Math.ceil((now.getMonth() + 1) / 3) + i;
        const year = now.getFullYear() + Math.floor((q - 1) / 4);
        const actualQ = ((q - 1) % 4) + 1;
        columns.push(`Q${actualQ} ${year}`);
      } else if (period === "half-year") {
        const d = new Date(now.getFullYear(), now.getMonth() + i * 6, 1);
        const h = Math.floor(d.getMonth() / 6) + 1;
        columns.push(`H${h} ${d.getFullYear()}`);
      } else {
        columns.push(String(now.getFullYear() + i));
      }
    }
    const rows = openOpps.map((o: any) => {
      const account = accounts.find((a: any) => a.id === o.accountId);
      const amount = parseFloat(o.amount || "0") || 0;
      const prob = o.probability || 0;
      const cellValues = columns.map((_, i) => {
        if (!o.expectedCloseDate) return 0;
        const cd = new Date(o.expectedCloseDate);
        let match = false;
        if (period === "monthly") {
          const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
          match = cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
        } else if (period === "quarterly") {
          const q = Math.ceil((now.getMonth() + 1) / 3) + i;
          const year = now.getFullYear() + Math.floor((q - 1) / 4);
          const actualQ = ((q - 1) % 4) + 1;
          match = Math.ceil((cd.getMonth() + 1) / 3) === actualQ && cd.getFullYear() === year;
        } else if (period === "half-year") {
          const d = new Date(now.getFullYear(), now.getMonth() + i * 6, 1);
          const h = Math.floor(d.getMonth() / 6) + 1;
          match = Math.floor(cd.getMonth() / 6) + 1 === h && cd.getFullYear() === d.getFullYear();
        } else if (period === "annual") {
          match = cd.getFullYear() === now.getFullYear() + i;
        }
        if (!match) return 0;
        if (scenario === "best") return amount;
        if (scenario === "worst") return prob >= 70 ? amount : 0;
        return amount * (prob / 100);
      });
      return { opportunityId: o.id, name: o.name, accountName: account?.name || "—", cells: cellValues };
    });
    const totals = columns.map((_, ci) => rows.reduce((s, r) => s + (r.cells[ci] || 0), 0));
    res.json({ period, scenario, columns, rows, totals });
  });

  // CRM Automation Rules
  app.get("/api/crm/automation-rules", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const entityType = req.query.entityType as string | undefined;
    const rules = await storage.getCrmAutomationRules(tenantId, entityType);
    res.json(rules);
  });

  app.post("/api/crm/automation-rules", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const rule = await storage.createCrmAutomationRule({ ...req.body, tenantId, createdByUserId: userId });
      res.status(201).json(rule);
    } catch (err) {
      console.error("Failed to create automation rule:", err);
      res.status(400).json({ message: "Failed to create automation rule" });
    }
  });

  app.put("/api/crm/automation-rules/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const rule = await storage.updateCrmAutomationRule(Number(req.params.id), req.body);
    if (!rule) return res.status(404).json({ message: "Automation rule not found" });
    res.json(rule);
  });

  app.delete("/api/crm/automation-rules/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmAutomationRule(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Leads
  app.get("/api/crm/leads", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const leads = await storage.getCrmLeads(tenantId, resolveListClientId(req));
    res.json(leads);
  });

  app.get("/api/crm/leads/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const lead = await storage.getCrmLead(Number(req.params.id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(lead);
  });

  app.post("/api/crm/leads", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const lead = await storage.createCrmLead({ ...req.body, tenantId, ownerUserId: userId });
      res.status(201).json(lead);
    } catch (err) {
      res.status(400).json({ message: "Failed to create lead" });
    }
  });

  app.put("/api/crm/leads/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const lead = await storage.updateCrmLead(Number(req.params.id), req.body);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(lead);
  });

  app.delete("/api/crm/leads/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmLead(Number(req.params.id));
    res.status(204).send();
  });

  // Bulk import endpoints
  app.post("/api/crm/leads/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { rows, mode } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ message: "rows must be an array" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await storage.bulkImportCrmLeads(tenantId, rows, mode || "append");
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/crm/contacts/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { rows, mode } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ message: "rows must be an array" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await storage.bulkImportCrmContacts(tenantId, rows, mode || "append");
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/crm/accounts/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { rows, mode } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ message: "rows must be an array" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await storage.bulkImportCrmAccounts(tenantId, rows, mode || "append");
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/crm/opportunities/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { rows, mode } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ message: "rows must be an array" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await storage.bulkImportCrmOpportunities(tenantId, rows, mode || "append");
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/crm/contracts/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { rows, mode } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ message: "rows must be an array" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await storage.bulkImportCrmContracts(tenantId, rows, mode || "append");
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Bulk delete endpoints
  app.post("/api/crm/accounts/bulk-delete", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: "ids must be an array" });
    for (const id of ids) await storage.deleteCrmAccount(Number(id));
    res.status(204).send();
  });

  app.post("/api/crm/contacts/bulk-delete", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: "ids must be an array" });
    for (const id of ids) await storage.deleteCrmContact(Number(id));
    res.status(204).send();
  });

  app.post("/api/crm/leads/bulk-delete", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: "ids must be an array" });
    for (const id of ids) await storage.deleteCrmLead(Number(id));
    res.status(204).send();
  });

  app.post("/api/crm/opportunities/bulk-delete", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: "ids must be an array" });
    for (const id of ids) await storage.deleteCrmOpportunity(Number(id));
    res.status(204).send();
  });

  app.post("/api/crm/contracts/bulk-delete", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: "ids must be an array" });
    for (const id of ids) await storage.deleteCrmContract(Number(id));
    res.status(204).send();
  });

  app.post("/api/crm/leads/:id/convert", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const lead = await storage.getCrmLead(Number(req.params.id));
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      
      const tenantId = lead.tenantId;
      const { createAccount, createContact, createOpportunity, accountName, opportunityAmount, opportunityName } = req.body;
      
      let accountId = req.body.accountId;
      let contactId = req.body.contactId;
      let opportunityId = req.body.opportunityId;
      
      if (createAccount) {
        const account = await storage.createCrmAccount({
          tenantId,
          name: accountName || lead.company || `${lead.firstName} ${lead.lastName}`,
          type: "customer",
          industry: lead.industry || null,
          website: lead.website || null,
          phone: lead.phone || null,
          email: lead.email || null,
          description: lead.description || null,
          ownerUserId: userId,
        });
        accountId = account.id;
      }
      
      if (createContact && accountId) {
        const contact = await storage.createCrmContact({
          tenantId,
          accountId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email || null,
          phone: lead.phone || null,
          title: lead.title || null,
          isPrimary: true,
          ownerUserId: userId,
        });
        contactId = contact.id;
      }
      
      if (createOpportunity && accountId) {
        const stages = await storage.getCrmOpportunityStages(tenantId);
        const firstStage = stages.find(s => s.order === 1) || stages[0];
        
        const opportunity = await storage.createCrmOpportunity({
          tenantId,
          accountId,
          contactId: contactId || null,
          stageId: firstStage?.id || null,
          name: opportunityName || `${lead.company || lead.firstName} - Opportunity`,
          amount: opportunityAmount || null,
          probability: 20,
          source: lead.source || null,
          ownerUserId: userId,
        });
        opportunityId = opportunity.id;
      }
      
      const convertedLead = await storage.convertLead(
        Number(req.params.id),
        accountId,
        contactId,
        opportunityId
      );
      
      res.json({ 
        lead: convertedLead,
        accountId,
        contactId,
        opportunityId
      });
    } catch (err) {
      console.error("Lead conversion error:", err);
      res.status(400).json({ message: "Failed to convert lead" });
    }
  });

  // CRM Pipelines
  app.get("/api/crm/pipelines", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const pipelines = await storage.getCrmPipelines(tenantId);
    res.json(pipelines);
  });

  app.post("/api/crm/pipelines", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const pipeline = await storage.createCrmPipeline({ ...req.body, tenantId: getApiTenantIdWithFallback(req) });
    res.status(201).json(pipeline);
  });

  app.put("/api/crm/pipelines/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const pipeline = await storage.updateCrmPipeline(Number(req.params.id), req.body);
    if (!pipeline) return res.status(404).json({ message: "Pipeline not found" });
    res.json(pipeline);
  });

  app.delete("/api/crm/pipelines/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const pipelineId = Number(req.params.id);
    const stages = await storage.getCrmOpportunityStages(tenantId, pipelineId);
    const stageIds = stages.map((s: any) => s.id);
    if (stageIds.length > 0) {
      const opps = await storage.getCrmOpportunities(tenantId);
      const hasOpps = opps.some((o: any) => stageIds.includes(o.stageId));
      if (hasOpps) {
        await storage.updateCrmPipeline(pipelineId, { isArchived: true });
        return res.json({ archived: true, message: "Pipeline archived (contains opportunities)" });
      }
    }
    await storage.deleteCrmPipeline(pipelineId);
    res.status(204).send();
  });

  // CRM Opportunity Stages
  app.get("/api/crm/stages", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const pipelineId = req.query.pipelineId ? Number(req.query.pipelineId) : undefined;
    const stages = await storage.getCrmOpportunityStages(tenantId, pipelineId);
    res.json(stages);
  });

  app.post("/api/crm/stages", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const stage = await storage.createCrmOpportunityStage({ ...req.body, tenantId });
      res.status(201).json(stage);
    } catch (err) {
      res.status(400).json({ message: "Failed to create stage" });
    }
  });

  app.put("/api/crm/stages/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const stage = await storage.updateCrmOpportunityStage(Number(req.params.id), req.body);
    if (!stage) return res.status(404).json({ message: "Stage not found" });
    res.json(stage);
  });

  app.delete("/api/crm/stages/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmOpportunityStage(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Opportunities
  app.get("/api/crm/opportunities", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const stageId = req.query.stageId ? Number(req.query.stageId) : undefined;
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const opportunities = await storage.getCrmOpportunities(
      tenantId,
      stageId,
      accountId,
      resolveListClientId(req),
    );
    res.json(opportunities);
  });

  app.get("/api/crm/opportunities/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const opportunity = await storage.getCrmOpportunity(Number(req.params.id));
    if (!opportunity) return res.status(404).json({ message: "Opportunity not found" });
    if (opportunity.accountId) {
      const account = await storage.getCrmAccount(opportunity.accountId);
      if (!assertRecordInWorkspace(req, res, account?.clientId)) return;
    }
    res.json(opportunity);
  });

  app.post("/api/crm/opportunities", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const opportunityData = { 
        ...req.body, 
        tenantId, 
        ownerUserId: userId,
        stageId: req.body.stageId ? Number(req.body.stageId) : null,
        accountId: req.body.accountId ? Number(req.body.accountId) : null,
        probability: req.body.probability ? Number(req.body.probability) : null,
        expectedCloseDate: req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : null,
        actualCloseDate: req.body.actualCloseDate ? new Date(req.body.actualCloseDate) : null,
      };
      const opportunity = await storage.createCrmOpportunity(opportunityData);
      res.status(201).json(opportunity);
    } catch (err) {
      console.error("Failed to create opportunity:", err);
      res.status(400).json({ message: "Failed to create opportunity" });
    }
  });

  app.put("/api/crm/opportunities/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const opportunity = await storage.updateCrmOpportunity(Number(req.params.id), req.body);
    if (!opportunity) return res.status(404).json({ message: "Opportunity not found" });
    res.json(opportunity);
  });

  app.delete("/api/crm/opportunities/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmOpportunity(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/crm/opportunities/:id/clone", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const cloned = await storage.cloneCrmOpportunity(Number(req.params.id));
    if (!cloned) return res.status(404).json({ message: "Opportunity not found" });
    res.status(201).json(cloned);
  });

  app.post("/api/crm/opportunities/:id/archive", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const opp = await storage.updateCrmOpportunity(Number(req.params.id), { isArchived: true });
    if (!opp) return res.status(404).json({ message: "Opportunity not found" });
    res.json(opp);
  });

  app.post("/api/crm/opportunities/:id/convert-to-project", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const opp = await storage.getCrmOpportunity(Number(req.params.id));
      if (!opp) return res.status(404).json({ message: "Opportunity not found" });
      const tenantId = getApiTenantIdWithFallback(req);
      const project = await storage.createProject({
        tenantId,
        name: opp.name,
        description: opp.description || undefined,
        status: "planning",
        createdByUserId: userId,
      } as any);
      const updated = await storage.updateCrmOpportunity(opp.id, { projectId: project.id });
      res.json({ opportunity: updated, project });
    } catch (err) {
      console.error("Convert to project failed:", err);
      res.status(400).json({ message: "Failed to convert opportunity to project" });
    }
  });

  // CRM Activities
  app.get("/api/crm/activities", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const activities = await storage.getCrmActivities(tenantId, entityType, entityId, accountId, resolveListClientId(req));
    res.json(activities);
  });

  app.post("/api/crm/activities", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const activityData = {
        ...req.body,
        tenantId,
        ownerUserId: userId,
        accountId: req.body.accountId ? Number(req.body.accountId) : null,
        contactId: req.body.contactId ? Number(req.body.contactId) : null,
        opportunityId: req.body.opportunityId ? Number(req.body.opportunityId) : null,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        reminderDate: req.body.reminderDate ? new Date(req.body.reminderDate) : null,
      };
      const activity = await storage.createCrmActivity(activityData);
      res.status(201).json(activity);
    } catch (err) {
      console.error("Failed to create activity:", err);
      res.status(400).json({ message: "Failed to create activity" });
    }
  });

  app.put("/api/crm/activities/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const activity = await storage.updateCrmActivity(Number(req.params.id), req.body);
    if (!activity) return res.status(404).json({ message: "Activity not found" });
    res.json(activity);
  });

  app.delete("/api/crm/activities/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmActivity(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/crm/activities/bulk-delete", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const ids = req.body.ids as number[];
    for (const id of ids) {
      await storage.deleteCrmActivity(id);
    }
    res.status(204).send();
  });

  // CRM Tasks
  app.get("/api/crm/tasks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const tasks = await storage.getCrmTasks(tenantId, entityType, entityId, accountId, resolveListClientId(req));
    res.json(tasks);
  });

  app.post("/api/crm/tasks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const task = await storage.createCrmTask({ ...req.body, tenantId, ownerUserId: userId });
      res.status(201).json(task);
    } catch (err) {
      res.status(400).json({ message: "Failed to create task" });
    }
  });

  app.put("/api/crm/tasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const task = await storage.updateCrmTask(Number(req.params.id), req.body);
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  });

  app.delete("/api/crm/tasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmTask(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Notes
  app.get("/api/crm/notes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const entityType = req.query.entityType as string;
    const entityId = Number(req.query.entityId);
    if (!entityType || !entityId) return res.status(400).json({ message: "entityType and entityId required" });
    const notes = await storage.getCrmNotes(tenantId, entityType, entityId, resolveListClientId(req));
    res.json(notes);
  });

  app.post("/api/crm/notes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const note = await storage.createCrmNote({ ...req.body, tenantId, createdByUserId: userId });
      res.status(201).json(note);
    } catch (err) {
      res.status(400).json({ message: "Failed to create note" });
    }
  });

  app.put("/api/crm/notes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const note = await storage.updateCrmNote(Number(req.params.id), req.body.content);
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.json(note);
  });

  app.delete("/api/crm/notes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmNote(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Contracts
  app.get("/api/crm/contracts", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const contracts = await storage.getCrmContracts(tenantId, accountId, resolveListClientId(req));
    res.json(contracts);
  });

  app.get("/api/crm/contracts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const contract = await storage.getCrmContract(Number(req.params.id));
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    res.json(contract);
  });

  app.post("/api/crm/contracts", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const contract = await storage.createCrmContract({ ...req.body, tenantId, ownerUserId: userId });
      res.status(201).json(contract);
    } catch (err) {
      res.status(400).json({ message: "Failed to create contract" });
    }
  });

  app.put("/api/crm/contracts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const contract = await storage.updateCrmContract(Number(req.params.id), req.body);
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    res.json(contract);
  });

  app.delete("/api/crm/contracts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmContract(Number(req.params.id));
    res.status(204).send();
  });

  // CRM Customer Systems
  app.get("/api/crm/systems", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const systems = await storage.getCrmCustomerSystems(tenantId, accountId, resolveListClientId(req));
    res.json(systems);
  });

  app.get("/api/crm/systems/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const system = await storage.getCrmCustomerSystem(Number(req.params.id));
    if (!system) return res.status(404).json({ message: "System not found" });
    res.json(system);
  });

  app.post("/api/crm/systems", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const system = await storage.createCrmCustomerSystem({ ...req.body, tenantId });
      res.status(201).json(system);
    } catch (err) {
      res.status(400).json({ message: "Failed to create system" });
    }
  });

  app.put("/api/crm/systems/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const system = await storage.updateCrmCustomerSystem(Number(req.params.id), req.body);
    if (!system) return res.status(404).json({ message: "System not found" });
    res.json(system);
  });

  app.delete("/api/crm/systems/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteCrmCustomerSystem(Number(req.params.id));
    res.status(204).send();
  });

  // === Rate Cards CRUD ===

  app.get("/api/crm/rate-cards", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const cards = await storage.getRateCards(tenantId);
    const cardsWithItems = await Promise.all(
      cards.map(async (card) => {
        const items = await storage.getRateCardItems(card.id);
        return { ...card, items };
      })
    );
    res.json(cardsWithItems);
  });

  app.post("/api/crm/rate-cards", async (_req, res) => {
    res.status(403).json({ message: "Rate cards are managed in the Resources module (read-only in CRM per ADR-003)" });
  });

  app.put("/api/crm/rate-cards/:id", async (_req, res) => {
    res.status(403).json({ message: "Rate cards are managed in the Resources module (read-only in CRM per ADR-003)" });
  });

  app.delete("/api/crm/rate-cards/:id", async (_req, res) => {
    res.status(403).json({ message: "Rate cards are managed in the Resources module (read-only in CRM per ADR-003)" });
  });

  app.get("/api/crm/rate-cards/:id/items", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const items = await storage.getRateCardItems(Number(req.params.id));
    res.json(items);
  });

  app.post("/api/crm/rate-cards/:id/items", async (_req, res) => {
    res.status(403).json({ message: "Rate card items are managed in the Resources module (read-only in CRM per ADR-003)" });
  });

  app.delete("/api/crm/rate-card-items/:id", async (_req, res) => {
    res.status(403).json({ message: "Rate card items are managed in the Resources module (read-only in CRM per ADR-003)" });
  });

  // === Resource Plan Templates CRUD ===

  app.get("/api/crm/resource-plan-templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const templates = await storage.getResourcePlanTemplates(tenantId);
    const templatesWithRows = await Promise.all(
      templates.map(async (tmpl) => {
        const rows = await storage.getResourcePlanTemplateRows(tmpl.id);
        return { ...tmpl, rows };
      })
    );
    res.json(templatesWithRows);
  });

  app.post("/api/crm/resource-plan-templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const { rows: inlineRows, ...tmplData } = req.body;
      const template = await storage.createResourcePlanTemplate({ ...tmplData, tenantId });
      if (Array.isArray(inlineRows)) {
        for (let i = 0; i < inlineRows.length; i++) {
          const row = inlineRows[i];
          const weeks = row.startDate && row.endDate
            ? Math.max(1, Math.round((new Date(row.endDate).getTime() - new Date(row.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)))
            : 12;
          await storage.createResourcePlanTemplateRow({
            templateId: template.id,
            phase: row.phase || "Build",
            roleName: row.roleName || "TBA",
            daysPerWeek: String(row.daysPerWeek || 5),
            dailyRate: String(row.dailyRate || 0),
            defaultDurationWeeks: weeks,
            sortOrder: row.sortOrder ?? i,
          });
        }
      }
      const full = await storage.getResourcePlanTemplates(tenantId);
      const created = full.find(t => t.id === template.id);
      res.status(201).json(created || template);
    } catch (err) {
      console.error("Failed to create template:", err);
      res.status(400).json({ message: "Failed to create template" });
    }
  });

  app.put("/api/crm/resource-plan-templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const template = await storage.updateResourcePlanTemplate(Number(req.params.id), req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/crm/resource-plan-templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteResourcePlanTemplate(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/crm/resource-plan-templates/:id/rows", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const rows = await storage.getResourcePlanTemplateRows(Number(req.params.id));
    res.json(rows);
  });

  app.post("/api/crm/resource-plan-templates/:id/rows", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const row = await storage.createResourcePlanTemplateRow({ ...req.body, templateId: Number(req.params.id) });
      res.status(201).json(row);
    } catch (err) {
      res.status(400).json({ message: "Failed to create template row" });
    }
  });

  app.delete("/api/crm/resource-plan-template-rows/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteResourcePlanTemplateRow(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/crm/resource-plans/all-rows", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const allRows = await storage.getAllOpportunityResourceRowsWithPlans(tenantId);
      const safeDateStr = (d: unknown): string | null => {
        if (!d) return null;
        const s = d instanceof Date ? d.toISOString() : String(d);
        const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : null;
      };
      const normalized = allRows.map(r => ({
        ...r,
        startDate: safeDateStr(r.startDate),
        endDate: safeDateStr(r.endDate),
        daysPerWeek: Number(r.daysPerWeek) || 5,
        dailyRate: Number(r.dailyRate) || 0,
      }));
      res.json(normalized);
    } catch (err) {
      console.error("Failed to get all resource plan rows:", err);
      res.status(500).json({ message: "Failed to get resource plan data" });
    }
  });

  // === Opportunity Resource Plans CRUD ===

  app.get("/api/crm/opportunities/:oppId/resource-plans", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const plans = await storage.getOpportunityResourcePlans(Number(req.params.oppId));
    const withRows = await Promise.all(plans.map(async (plan) => {
      const rows = await storage.getOpportunityResourceRows(plan.id);
      return { ...plan, rows };
    }));
    res.json(withRows);
  });

  app.get("/api/crm/opportunities/:oppId/resource-plan", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const plan = await storage.getOpportunityResourcePlan(Number(req.params.oppId));
    if (!plan) return res.json(null);
    const rows = await storage.getOpportunityResourceRows(plan.id);
    res.json({ ...plan, rows });
  });

  app.get("/api/crm/resource-plans/:planId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const plan = await storage.getOpportunityResourcePlanById(Number(req.params.planId));
    if (!plan) return res.status(404).json({ message: "Resource plan not found" });
    const rows = await storage.getOpportunityResourceRows(plan.id);
    res.json({ ...plan, rows });
  });

  app.post("/api/crm/resource-plans/:planId/clone", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const cloned = await storage.cloneOpportunityResourcePlan(Number(req.params.planId), req.body.planName);
      if (!cloned) return res.status(404).json({ message: "Resource plan not found" });
      const rows = await storage.getOpportunityResourceRows(cloned.id);
      res.status(201).json({ ...cloned, rows });
    } catch (err) {
      console.error("Failed to clone resource plan:", err);
      res.status(400).json({ message: "Failed to clone resource plan" });
    }
  });

  app.post("/api/crm/opportunities/:oppId/resource-plan", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const oppId = Number(req.params.oppId);
      const { rows, planId, createNew, planName, ...planData } = req.body;

      let plan: Awaited<ReturnType<typeof storage.getOpportunityResourcePlanById>>;
      if (createNew) {
        plan = await storage.createOpportunityResourcePlan({
          tenantId,
          opportunityId: oppId,
          planName: planName || `Scenario ${Date.now()}`,
          rateCardId: planData.rateCardId || null,
          currency: planData.currency || "GBP",
          notes: planData.notes || null,
          templateName: planData.templateName || null,
        });
      } else if (planId) {
        plan = await storage.getOpportunityResourcePlanById(Number(planId));
        if (!plan) return res.status(404).json({ message: "Resource plan not found" });
        plan = (await storage.updateOpportunityResourcePlan(plan.id, {
          rateCardId: planData.rateCardId ?? plan.rateCardId,
          currency: planData.currency || plan.currency || "GBP",
          notes: planData.notes ?? plan.notes,
          templateName: planData.templateName ?? plan.templateName,
          planName: planName ?? plan.planName,
        }))!;
        const existingRows = await storage.getOpportunityResourceRows(plan.id);
        for (const er of existingRows) {
          await storage.deleteOpportunityResourceRow(er.id);
        }
      } else {
        plan = await storage.getOpportunityResourcePlan(oppId);
        if (plan) {
          plan = (await storage.updateOpportunityResourcePlan(plan.id, {
            rateCardId: planData.rateCardId || null,
            currency: planData.currency || "GBP",
            notes: planData.notes || null,
            templateName: planData.templateName || null,
            planName: planName || plan.planName,
          }))!;
          const existingRows = await storage.getOpportunityResourceRows(plan.id);
          for (const er of existingRows) {
            await storage.deleteOpportunityResourceRow(er.id);
          }
        } else {
          plan = await storage.createOpportunityResourcePlan({
            tenantId,
            opportunityId: oppId,
            planName: planName || "Base Plan",
            rateCardId: planData.rateCardId || null,
            currency: planData.currency || "GBP",
            notes: planData.notes || null,
            templateName: planData.templateName || null,
          });
        }
      }

      const savedRows = [];
      if (Array.isArray(rows)) {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const saved = await storage.createOpportunityResourceRow({
            planId: plan.id,
            phase: r.phase || "Discovery",
            roleName: r.roleName || "TBA",
            resourceId: r.resourceId || null,
            namedResourceLabel: r.namedResourceLabel || null,
            startDate: r.startDate ? new Date(r.startDate) : null,
            endDate: r.endDate ? new Date(r.endDate) : null,
            daysPerWeek: String(r.daysPerWeek ?? "5"),
            dailyRate: String(r.dailyRate ?? "0"),
            discountPercent: String(r.discountPercent ?? "0"),
            status: r.status || "Open",
            sortOrder: i,
            breaks: r.breaks || [],
            weekOverrides: r.weekOverrides || {},
          });
          savedRows.push(saved);
        }
      }

      res.status(201).json({ ...plan, rows: savedRows });
    } catch (err) {
      console.error("Failed to save resource plan:", err);
      res.status(400).json({ message: "Failed to save resource plan" });
    }
  });

  app.put("/api/crm/resource-plans/:planId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const plan = await storage.updateOpportunityResourcePlan(Number(req.params.planId), req.body);
    if (!plan) return res.status(404).json({ message: "Resource plan not found" });
    res.json(plan);
  });

  // === Opportunity Resource Plan Rows CRUD ===

  app.get("/api/crm/resource-plans/:planId/rows", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const rows = await storage.getOpportunityResourceRows(Number(req.params.planId));
    res.json(rows);
  });

  app.post("/api/crm/resource-plans/:planId/rows", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const row = await storage.createOpportunityResourceRow({
        ...req.body,
        planId: Number(req.params.planId),
      });
      res.status(201).json(row);
    } catch (err) {
      res.status(400).json({ message: "Failed to create resource row" });
    }
  });

  app.put("/api/crm/resource-plan-rows/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const row = await storage.updateOpportunityResourceRow(Number(req.params.id), req.body);
    if (!row) return res.status(404).json({ message: "Resource row not found" });
    res.json(row);
  });

  app.delete("/api/crm/resource-plan-rows/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteOpportunityResourceRow(Number(req.params.id));
    res.status(204).send();
  });

  app.put("/api/crm/resource-plans/:planId/reorder", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { rowIds } = req.body;
      if (!Array.isArray(rowIds)) return res.status(400).json({ message: "rowIds array required" });
      for (let i = 0; i < rowIds.length; i++) {
        await storage.updateOpportunityResourceRow(rowIds[i], { sortOrder: i });
      }
      const rows = await storage.getOpportunityResourceRows(Number(req.params.planId));
      res.json(rows);
    } catch (err) {
      res.status(400).json({ message: "Failed to reorder rows" });
    }
  });

  // === Notify Resource Manager ===

  app.post("/api/crm/resource-plans/:planId/notify", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const plan = await storage.getOpportunityResourcePlanById(Number(req.params.planId));
      if (!plan) return res.status(404).json({ message: "Resource plan not found" });
      const rows = await storage.getOpportunityResourceRows(plan.id);
      const opportunity = await storage.getCrmOpportunity(plan.opportunityId);
      await storage.updateOpportunityResourcePlan(plan.id, { notifiedAt: new Date() } as any);
      const tenant = plan.tenantId ? await storage.getTenant(plan.tenantId) : null;
      const { notifyUser } = await import("./lib/user-notify");
      await notifyUser({
        userId,
        tenantId: plan.tenantId,
        tenant,
        title: "Resource Plan Submitted",
        message: `Resource plan for opportunity "${opportunity?.name || "Unknown"}" with ${rows.length} resource rows has been submitted for review.`,
        type: "workflow",
        source: "crm",
        sourceId: String(plan.id),
        category: "finance",
      });
      res.json({ success: true, notifiedAt: new Date() });
    } catch (err) {
      console.error("Failed to notify RM:", err);
      res.status(500).json({ message: "Failed to send notification" });
    }
  });

  app.post("/api/crm/seed-resource-plan-data", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ message: "Demo seed is disabled in production" });
    }
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const existing = await storage.getResourcePlanTemplates(tenantId);
      if (existing.length > 0) return res.json({ message: "Seed data already exists", count: existing.length });

      const rc = await storage.createRateCard({ tenantId, name: "Standard 2026", description: "Default rate card for 2026 engagements", currency: "GBP", isDefault: true });
      const roles = [
        { roleName: "Program Manager", dailyRate: "1100" },
        { roleName: "Project Manager", dailyRate: "950" },
        { roleName: "Solution Architect", dailyRate: "1050" },
        { roleName: "Business Analyst", dailyRate: "700" },
        { roleName: "SAP FICO Consultant", dailyRate: "850" },
        { roleName: "SAP SD/MM Consultant", dailyRate: "850" },
        { roleName: "Integration Specialist", dailyRate: "900" },
        { roleName: "Test Manager", dailyRate: "800" },
        { roleName: "Change Manager", dailyRate: "750" },
        { roleName: "Oracle Financials", dailyRate: "900" },
        { roleName: "Developer", dailyRate: "750" },
        { roleName: "D365 Consultant", dailyRate: "850" },
        { roleName: "Power Platform Dev", dailyRate: "750" },
        { roleName: "CRM Architect", dailyRate: "1000" },
        { roleName: "CRM Developer", dailyRate: "750" },
        { roleName: "Scrum Master", dailyRate: "800" },
        { roleName: "Technical Lead", dailyRate: "950" },
        { roleName: "Data Migration Lead", dailyRate: "900" },
      ];
      for (const r of roles) {
        await storage.createRateCardItem({ rateCardId: rc.id, roleName: r.roleName, dailyRate: r.dailyRate });
      }

      const sapTmpl = await storage.createResourcePlanTemplate({ tenantId, name: "SAP S/4HANA", description: "SAP S/4HANA implementation template", phases: JSON.stringify(["Discovery","Build","UAT"]) });
      const sapRows = [
        { phase: "Discovery", roleName: "Program Manager", daysPerWeek: "5", dailyRate: "1100", defaultDurationWeeks: 34 },
        { phase: "Discovery", roleName: "Project Manager", daysPerWeek: "5", dailyRate: "950", defaultDurationWeeks: 38 },
        { phase: "Discovery", roleName: "Solution Architect", daysPerWeek: "4", dailyRate: "1050", defaultDurationWeeks: 6 },
        { phase: "Build", roleName: "SAP FICO Consultant", daysPerWeek: "5", dailyRate: "850", defaultDurationWeeks: 17 },
        { phase: "Build", roleName: "SAP SD/MM Consultant", daysPerWeek: "5", dailyRate: "850", defaultDurationWeeks: 17 },
        { phase: "Build", roleName: "Integration Specialist", daysPerWeek: "5", dailyRate: "900", defaultDurationWeeks: 13 },
        { phase: "Build", roleName: "Business Analyst", daysPerWeek: "5", dailyRate: "700", defaultDurationWeeks: 25 },
        { phase: "UAT", roleName: "Test Manager", daysPerWeek: "5", dailyRate: "800", defaultDurationWeeks: 8 },
        { phase: "UAT", roleName: "Change Manager", daysPerWeek: "3", dailyRate: "750", defaultDurationWeeks: 12 },
      ];
      for (let i = 0; i < sapRows.length; i++) {
        await storage.createResourcePlanTemplateRow({ templateId: sapTmpl.id, ...sapRows[i], sortOrder: i });
      }

      const oracleTmpl = await storage.createResourcePlanTemplate({ tenantId, name: "Oracle Cloud", description: "Oracle Cloud ERP implementation template", phases: JSON.stringify(["Discovery","Build","UAT"]) });
      const oracleRows = [
        { phase: "Discovery", roleName: "Program Manager", daysPerWeek: "5", dailyRate: "1100", defaultDurationWeeks: 8 },
        { phase: "Discovery", roleName: "Solution Architect", daysPerWeek: "5", dailyRate: "1050", defaultDurationWeeks: 8 },
        { phase: "Build", roleName: "Oracle Financials", daysPerWeek: "5", dailyRate: "900", defaultDurationWeeks: 17 },
        { phase: "Build", roleName: "Developer", daysPerWeek: "5", dailyRate: "750", defaultDurationWeeks: 13 },
        { phase: "UAT", roleName: "Test Manager", daysPerWeek: "5", dailyRate: "800", defaultDurationWeeks: 6 },
      ];
      for (let i = 0; i < oracleRows.length; i++) {
        await storage.createResourcePlanTemplateRow({ templateId: oracleTmpl.id, ...oracleRows[i], sortOrder: i });
      }

      const msTmpl = await storage.createResourcePlanTemplate({ tenantId, name: "Microsoft D365", description: "Microsoft Dynamics 365 implementation template", phases: JSON.stringify(["Discovery","Build","UAT"]) });
      const msRows = [
        { phase: "Discovery", roleName: "Program Manager", daysPerWeek: "5", dailyRate: "1000", defaultDurationWeeks: 6 },
        { phase: "Build", roleName: "D365 Consultant", daysPerWeek: "5", dailyRate: "850", defaultDurationWeeks: 13 },
        { phase: "Build", roleName: "Power Platform Dev", daysPerWeek: "5", dailyRate: "750", defaultDurationWeeks: 11 },
        { phase: "UAT", roleName: "Test Manager", daysPerWeek: "5", dailyRate: "800", defaultDurationWeeks: 6 },
      ];
      for (let i = 0; i < msRows.length; i++) {
        await storage.createResourcePlanTemplateRow({ templateId: msTmpl.id, ...msRows[i], sortOrder: i });
      }

      const crmTmpl = await storage.createResourcePlanTemplate({ tenantId, name: "CRM", description: "CRM implementation template", phases: JSON.stringify(["Discovery","Build","Go Live"]) });
      const crmRows = [
        { phase: "Discovery", roleName: "CRM Architect", daysPerWeek: "5", dailyRate: "1000", defaultDurationWeeks: 4 },
        { phase: "Build", roleName: "CRM Developer", daysPerWeek: "5", dailyRate: "750", defaultDurationWeeks: 11 },
        { phase: "Build", roleName: "Business Analyst", daysPerWeek: "4", dailyRate: "700", defaultDurationWeeks: 13 },
        { phase: "Go Live", roleName: "Change Manager", daysPerWeek: "3", dailyRate: "750", defaultDurationWeeks: 6 },
      ];
      for (let i = 0; i < crmRows.length; i++) {
        await storage.createResourcePlanTemplateRow({ templateId: crmTmpl.id, ...crmRows[i], sortOrder: i });
      }

      res.json({ success: true, templates: 4, rateCards: 1, rateCardItems: roles.length });
    } catch (err) {
      console.error("Failed to seed resource plan data:", err);
      res.status(500).json({ message: "Failed to seed data" });
    }
  });

  // === Business Management Routes ===

  // Strategy Items
  app.get("/api/business/strategy", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const templateType = req.query.templateType as string | undefined;
    const items = await storage.getStrategyItems(tenantId, templateType, resolveListClientId(req));
    res.json(items);
  });

  app.get("/api/business/strategy/:id", async (req, res) => {
    const item = await storage.getStrategyItem(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Strategy item not found" });
    if (!assertRecordInWorkspace(req, res, item.clientId)) return;
    res.json(item);
  });

  // Multi-layer bulk import (Strategy Map + Manage layer tabs)
  app.post("/api/business/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ message: "rows must be an array" });
    try {
      const result = await storage.bulkImportBusinessLayers(tenantId, userId, rows);
      const total = Object.values(result.created).reduce((a, b) => a + b, 0);
      res.json({ success: true, ...result, total });
    } catch (err: any) {
      res.status(400).json({ message: "Import failed", error: err.message });
    }
  });

  app.post("/api/business/strategy/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { rows, mode = "append" } = req.body;
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await storage.bulkImportStrategyItems(tenantId, rows, mode);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/business/strategy", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertStrategyItemSchema.parse({ ...req.body, tenantId, ownerId: userId });
      const item = await storage.createStrategyItem(validated);
      const refSeq = await storage.assignEntityRef(tenantId, "strategy", item.id);
      res.status(201).json({ ...item, refSeq, refCode: `S-${String(refSeq).padStart(3,"0")}` });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create strategy item" });
    }
  });

  app.put("/api/business/strategy/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const id = Number(req.params.id);
    const existing = await storage.getStrategyItem(id);
    const item = await storage.updateStrategyItem(id, req.body);
    if (!item) return res.status(404).json({ message: "Strategy item not found" });
    // Auto-log RAG change
    if (existing && req.body.ragStatus && req.body.ragStatus !== existing.ragStatus) {
      const user = req.session?.user as { firstName?: string; lastName?: string; email?: string } | undefined;
      const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "System" : "System";
      await storage.createStrategyRagHistory({ tenantId: existing.tenantId, entityType: "strategy", entityId: id, entityTitle: existing.title, fromRag: existing.ragStatus, toRag: req.body.ragStatus, changedByName: name, changedById: userId }).catch(() => {});
    }
    res.json(item);
  });

  app.delete("/api/business/strategy/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteStrategyItem(Number(req.params.id));
    res.status(204).send();
  });

  // Risks
  app.get("/api/business/risks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const strategyItemId = req.query.strategyItemId ? Number(req.query.strategyItemId) : undefined;
    const risks = await storage.getRisks(tenantId, strategyItemId, resolveListClientId(req));
    res.json(risks);
  });

  app.post("/api/business/risks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertRiskSchema.parse({ ...req.body, tenantId, ownerId: userId });
      const risk = await storage.createRisk(validated);
      res.status(201).json(risk);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create risk" });
    }
  });

  app.put("/api/business/risks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const risk = await storage.updateRisk(Number(req.params.id), req.body);
    if (!risk) return res.status(404).json({ message: "Risk not found" });
    res.json(risk);
  });

  app.delete("/api/business/risks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteRisk(Number(req.params.id));
    res.status(204).send();
  });

  // Departments
  app.get("/api/business/departments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const departments = await storage.getDepartments(tenantId);
    res.json(departments);
  });

  app.post("/api/business/departments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertDepartmentSchema.parse({ ...req.body, tenantId });
      const dept = await storage.createDepartment(validated);
      res.status(201).json(dept);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create department" });
    }
  });

  app.put("/api/business/departments/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const dept = await storage.updateDepartment(Number(req.params.id), req.body);
    if (!dept) return res.status(404).json({ message: "Department not found" });
    res.json(dept);
  });

  app.delete("/api/business/departments/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteDepartment(Number(req.params.id));
    res.status(204).send();
  });

  // Processes
  app.get("/api/business/processes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const processes = await storage.getProcesses(tenantId, departmentId);
    res.json(processes);
  });

  app.post("/api/business/processes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertProcessSchema.parse({ ...req.body, tenantId, ownerId: userId });
      const process = await storage.createProcess(validated);
      res.status(201).json(process);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create process" });
    }
  });

  app.put("/api/business/processes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const process = await storage.updateProcess(Number(req.params.id), req.body);
    if (!process) return res.status(404).json({ message: "Process not found" });
    res.json(process);
  });

  app.delete("/api/business/processes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteProcess(Number(req.params.id));
    res.status(204).send();
  });

  // Tools
  app.get("/api/business/tools", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const tools = await storage.getTools(tenantId);
    res.json(tools);
  });

  app.post("/api/business/tools", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertToolSchema.parse({ ...req.body, tenantId, ownerId: userId });
      const tool = await storage.createTool(validated);
      res.status(201).json(tool);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create tool" });
    }
  });

  app.put("/api/business/tools/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tool = await storage.updateTool(Number(req.params.id), req.body);
    if (!tool) return res.status(404).json({ message: "Tool not found" });
    res.json(tool);
  });

  app.delete("/api/business/tools/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteTool(Number(req.params.id));
    res.status(204).send();
  });

  // Goals
  app.get("/api/business/goals", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const strategyItemId = req.query.strategyItemId ? Number(req.query.strategyItemId) : undefined;
    const goals = await storage.getGoals(tenantId, strategyItemId, resolveListClientId(req));
    res.json(goals);
  });

  app.get("/api/business/goals/:id", async (req, res) => {
    const goal = await storage.getGoal(Number(req.params.id));
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    res.json(goal);
  });

  app.post("/api/business/goals", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertGoalSchema.parse({ ...req.body, tenantId, ownerId: userId });
      const goal = await storage.createGoal(validated);
      const refSeq = await storage.assignEntityRef(tenantId, "goal", goal.id);
      res.status(201).json({ ...goal, refSeq, refCode: `G-${String(refSeq).padStart(3,"0")}` });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create goal" });
    }
  });

  app.put("/api/business/goals/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const id = Number(req.params.id);
    const existing = await storage.getGoal(id);
    const goal = await storage.updateGoal(id, req.body);
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    if (existing && req.body.ragStatus && req.body.ragStatus !== existing.ragStatus) {
      const user = req.session?.user as { firstName?: string; lastName?: string; email?: string } | undefined;
      const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "System" : "System";
      await storage.createStrategyRagHistory({ tenantId: existing.tenantId, entityType: "goal", entityId: id, entityTitle: existing.title, fromRag: existing.ragStatus, toRag: req.body.ragStatus, changedByName: name, changedById: userId }).catch(() => {});
    }
    res.json(goal);
  });

  app.delete("/api/business/goals/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteGoal(Number(req.params.id));
    res.status(204).send();
  });

  // Key Results
  app.get("/api/business/key-results", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const goalId = req.query.goalId ? Number(req.query.goalId) : undefined;
    const keyResults = await storage.getKeyResults(tenantId, goalId);
    res.json(keyResults);
  });

  app.post("/api/business/key-results", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertKeyResultSchema.parse({ ...req.body, tenantId, ownerId: userId });
      const kr = await storage.createKeyResult(validated);
      res.status(201).json(kr);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create key result" });
    }
  });

  app.put("/api/business/key-results/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const kr = await storage.updateKeyResult(Number(req.params.id), req.body);
    if (!kr) return res.status(404).json({ message: "Key result not found" });
    res.json(kr);
  });

  app.delete("/api/business/key-results/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteKeyResult(Number(req.params.id));
    res.status(204).send();
  });

  // KPIs
  app.get("/api/business/kpis", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const goalId = req.query.goalId ? Number(req.query.goalId) : undefined;
    const kpis = await storage.getKpis(tenantId, goalId, resolveListClientId(req));
    res.json(kpis);
  });

  app.post("/api/business/kpis", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertKpiSchema.parse({ ...req.body, tenantId, ownerId: userId });
      const kpi = await storage.createKpi(validated);
      const refSeq = await storage.assignEntityRef(tenantId, "kpi", kpi.id);
      res.status(201).json({ ...kpi, refSeq, refCode: `KPI-${String(refSeq).padStart(3,"0")}` });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create KPI" });
    }
  });

  app.put("/api/business/kpis/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const id = Number(req.params.id);
    const existing = await storage.getKpi(id);
    const kpi = await storage.updateKpi(id, req.body);
    if (!kpi) return res.status(404).json({ message: "KPI not found" });
    if (existing && req.body.ragStatus && req.body.ragStatus !== existing.ragStatus) {
      const user = req.session?.user as { firstName?: string; lastName?: string; email?: string } | undefined;
      const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "System" : "System";
      await storage.createStrategyRagHistory({ tenantId: existing.tenantId, entityType: "kpi", entityId: id, entityTitle: existing.name, fromRag: existing.ragStatus, toRag: req.body.ragStatus, changedByName: name, changedById: userId }).catch(() => {});
    }
    res.json(kpi);
  });

  app.delete("/api/business/kpis/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteKpi(Number(req.params.id));
    res.status(204).send();
  });

  // Objectives
  app.get("/api/business/objectives", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const goalId = req.query.goalId ? Number(req.query.goalId) : undefined;
    const objectivesList = await storage.getObjectives(tenantId, goalId, resolveListClientId(req));
    res.json(objectivesList);
  });

  app.get("/api/business/objectives/:id", async (req, res) => {
    const objective = await storage.getObjective(Number(req.params.id));
    if (!objective) return res.status(404).json({ message: "Objective not found" });
    res.json(objective);
  });

  app.post("/api/business/objectives", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertObjectiveSchema.parse({ ...req.body, tenantId, ownerId: userId });
      const objective = await storage.createObjective(validated);
      const refSeq = await storage.assignEntityRef(tenantId, "objective", objective.id);
      res.status(201).json({ ...objective, refSeq, refCode: `OBJ-${String(refSeq).padStart(3,"0")}` });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create objective" });
    }
  });

  app.put("/api/business/objectives/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const id = Number(req.params.id);
    const existing = await storage.getObjective(id);
    const objective = await storage.updateObjective(id, req.body);
    if (!objective) return res.status(404).json({ message: "Objective not found" });
    if (existing && req.body.ragStatus && req.body.ragStatus !== existing.ragStatus) {
      const user = req.session?.user as { firstName?: string; lastName?: string; email?: string } | undefined;
      const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "System" : "System";
      await storage.createStrategyRagHistory({ tenantId: existing.tenantId, entityType: "objective", entityId: id, entityTitle: existing.title, fromRag: existing.ragStatus, toRag: req.body.ragStatus, changedByName: name, changedById: userId }).catch(() => {});
    }
    res.json(objective);
  });

  app.delete("/api/business/objectives/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteObjective(Number(req.params.id));
    res.status(204).send();
  });

  // OKRs
  app.get("/api/business/okrs", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const initiativeId = req.query.initiativeId ? Number(req.query.initiativeId) : undefined;
    const okrsList = await storage.getOkrs(tenantId, initiativeId, resolveListClientId(req));
    res.json(okrsList);
  });

  app.get("/api/business/okrs/:id", async (req, res) => {
    const okr = await storage.getOkr(Number(req.params.id));
    if (!okr) return res.status(404).json({ message: "OKR not found" });
    res.json(okr);
  });

  app.post("/api/business/okrs", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertOkrSchema.parse({ ...req.body, tenantId, ownerId: userId });
      const okr = await storage.createOkr(validated);
      const refSeq = await storage.assignEntityRef(tenantId, "okr", okr.id);
      res.status(201).json({ ...okr, refSeq, refCode: `OKR-${String(refSeq).padStart(3,"0")}` });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create OKR" });
    }
  });

  app.put("/api/business/okrs/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const id = Number(req.params.id);
    const existing = await storage.getOkr(id);
    const okr = await storage.updateOkr(id, req.body);
    if (!okr) return res.status(404).json({ message: "OKR not found" });
    if (existing && req.body.ragStatus && req.body.ragStatus !== existing.ragStatus) {
      const user = req.session?.user as { firstName?: string; lastName?: string; email?: string } | undefined;
      const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "System" : "System";
      await storage.createStrategyRagHistory({ tenantId: existing.tenantId, entityType: "okr", entityId: id, entityTitle: existing.title, fromRag: existing.ragStatus, toRag: req.body.ragStatus, changedByName: name, changedById: userId }).catch(() => {});
    }
    res.json(okr);
  });

  app.delete("/api/business/okrs/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteOkr(Number(req.params.id));
    res.status(204).send();
  });

  // Initiatives
  app.get("/api/business/initiatives", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const goalId = req.query.goalId ? Number(req.query.goalId) : undefined;
    const initiatives = await storage.getInitiatives(tenantId, goalId, resolveListClientId(req));
    res.json(initiatives);
  });

  app.get("/api/business/initiatives/:id", async (req, res) => {
    const initiative = await storage.getInitiative(Number(req.params.id));
    if (!initiative) return res.status(404).json({ message: "Initiative not found" });
    if (!assertRecordInWorkspace(req, res, initiative.clientId)) return;
    res.json(initiative);
  });

  app.post("/api/business/initiatives", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertInitiativeSchema.parse({ ...req.body, tenantId, ownerId: userId });
      const initiative = await storage.createInitiative(validated);
      const refSeq = await storage.assignEntityRef(tenantId, "initiative", initiative.id);
      res.status(201).json({ ...initiative, refSeq, refCode: `INI-${String(refSeq).padStart(3,"0")}` });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create initiative" });
    }
  });

  app.put("/api/business/initiatives/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const id = Number(req.params.id);
    const existing = await storage.getInitiative(id);
    const initiative = await storage.updateInitiative(id, req.body);
    if (!initiative) return res.status(404).json({ message: "Initiative not found" });
    if (existing && req.body.ragStatus && req.body.ragStatus !== existing.ragStatus) {
      const user = req.session?.user as { firstName?: string; lastName?: string; email?: string } | undefined;
      const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "System" : "System";
      await storage.createStrategyRagHistory({ tenantId: existing.tenantId, entityType: "initiative", entityId: id, entityTitle: existing.title, fromRag: existing.ragStatus, toRag: req.body.ragStatus, changedByName: name, changedById: userId }).catch(() => {});
    }
    res.json(initiative);
  });

  app.delete("/api/business/initiatives/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteInitiative(Number(req.params.id));
    res.status(204).send();
  });

  // Business Tasks
  app.get("/api/business/tasks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const initiativeId = req.query.initiativeId ? Number(req.query.initiativeId) : undefined;
    const tasks = await storage.getBusinessTasks(tenantId, initiativeId, resolveListClientId(req));
    res.json(tasks);
  });

  app.post("/api/business/tasks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertBusinessTaskSchema.parse({ ...req.body, tenantId, assigneeId: userId });
      const task = await storage.createBusinessTask(validated);
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create task" });
    }
  });

  app.put("/api/business/tasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const task = await storage.updateBusinessTask(Number(req.params.id), req.body);
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  });

  app.delete("/api/business/tasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteBusinessTask(Number(req.params.id));
    res.status(204).send();
  });

  // Meetings
  app.get("/api/business/meetings", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const initiativeId = req.query.initiativeId ? Number(req.query.initiativeId) : undefined;
    const meetings = await storage.getMeetings(tenantId, initiativeId);
    res.json(meetings);
  });

  app.post("/api/business/meetings", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertMeetingSchema.parse({ ...req.body, tenantId, organizerId: userId });
      const meeting = await storage.createMeeting(validated);
      res.status(201).json(meeting);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(400).json({ message: "Failed to create meeting" });
    }
  });

  app.put("/api/business/meetings/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const meeting = await storage.updateMeeting(Number(req.params.id), req.body);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    res.json(meeting);
  });

  app.delete("/api/business/meetings/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteMeeting(Number(req.params.id));
    res.status(204).send();
  });

  // Business Management Dashboard Stats
  app.get("/api/business/stats", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    
    const statsClientId = resolveListClientId(req);
    const [strategyItemsList, goalsList, initiativesList, kpisList, risksList] = await Promise.all([
      storage.getStrategyItems(tenantId, undefined, statsClientId),
      storage.getGoals(tenantId, undefined, resolveListClientId(req)),
      storage.getInitiatives(tenantId, undefined, statsClientId),
      storage.getKpis(tenantId, undefined, resolveListClientId(req)),
      storage.getRisks(tenantId, undefined, resolveListClientId(req)),
    ]);

    const goalsOnTrack = goalsList.filter(g => g.status === "on_track").length;
    const goalsAtRisk = goalsList.filter(g => g.status === "at_risk").length;
    const initiativesInProgress = initiativesList.filter(i => i.status === "in_progress").length;
    const openRisks = risksList.filter(r => r.status === "open").length;

    res.json({
      strategyItems: strategyItemsList.length,
      goals: goalsList.length,
      goalsOnTrack,
      goalsAtRisk,
      initiatives: initiativesList.length,
      initiativesInProgress,
      kpis: kpisList.length,
      risks: risksList.length,
      openRisks,
    });
  });

  // Seed Apex Solutions Group demo data
  app.post("/api/business/seed-apex-data", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const result = await seedApexData();
      res.json(result);
    } catch (err: any) {
      console.error("Seed error:", err);
      res.status(500).json({ message: err.message || "Seed failed" });
    }
  });

  // ── Business Governance API ──────────────────────────────────────────────────

  // Review Notes
  app.get("/api/business/review-notes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const { entityType, entityId } = req.query;
    if (entityType && entityId) {
      const notes = await storage.getStrategyReviewNotes(tenantId, String(entityType), Number(entityId));
      return res.json(notes);
    }
    const notes = await storage.getAllStrategyReviewNotes(tenantId);
    res.json(notes);
  });

  app.post("/api/business/review-notes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const claims = (req.user as any)?.claims;
    const authorName = claims?.first_name && claims?.last_name
      ? `${claims.first_name} ${claims.last_name}`.trim()
      : claims?.email || "Unknown";
    try {
      const note = await storage.createStrategyReviewNote({
        tenantId: getApiTenantIdWithFallback(req),
        entityType: req.body.entityType,
        entityId: Number(req.body.entityId),
        content: req.body.content,
        ragSnapshot: req.body.ragSnapshot ?? null,
        progressAtCheckin: req.body.progressAtCheckin != null ? Number(req.body.progressAtCheckin) : null,
        authorName: req.body.authorName || authorName,
        authorId: userId,
        signoffRequestId: req.body.signoffRequestId ?? null,
      });
      res.status(201).json(note);
    } catch (err) {
      res.status(400).json({ message: "Failed to create review note" });
    }
  });

  app.delete("/api/business/review-notes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteStrategyReviewNote(Number(req.params.id));
    res.status(204).send();
  });

  app.put("/api/business/review-notes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const content = String(req.body.content ?? "").trim();
    if (!content) return res.status(400).json({ message: "Content is required" });
    const note = await storage.updateStrategyReviewNote(Number(req.params.id), userId, content);
    if (!note) return res.status(403).json({ message: "Not allowed to edit this note" });
    res.json(note);
  });

  // RAG History
  app.get("/api/business/rag-history", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
    const history = await storage.getStrategyRagHistory(tenantId, entityType, entityId);
    res.json(history);
  });

  // Overdue Reviews
  app.get("/api/business/overdue-reviews", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const overdue = await storage.getOverdueReviews(tenantId);
    res.json(overdue);
  });

  // Strategy Map - Consolidated Strategy to Execution View
  app.get("/api/business/strategy-map", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    
    const groupBy = req.query.groupBy as string | undefined;
    const filterStatus = req.query.status as string | undefined;
    const filterOwner = req.query.ownerId as string | undefined;
    const filterDepartment = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const filterTimeframe = req.query.timeframe as string | undefined;

    const [
      strategyItemsList,
      goalsList,
      objectivesList,
      initiativesList,
      okrsList,
      kpisList,
      governanceList,
      departmentsList,
      allUsers,
    ] = await Promise.all([
      storage.getStrategyItems(tenantId, undefined, resolveListClientId(req)),
      storage.getGoals(tenantId, undefined, resolveListClientId(req)),
      storage.getObjectives(tenantId, undefined, resolveListClientId(req)),
      storage.getInitiatives(tenantId, undefined, resolveListClientId(req)),
      storage.getOkrs(tenantId, undefined, resolveListClientId(req)),
      storage.getKpis(tenantId, undefined, resolveListClientId(req)),
      storage.getGovernanceItems(tenantId),
      storage.getDepartments(tenantId),
      db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable),
    ]);

    const userNameMap = new Map<string, string>();
    for (const u of allUsers) {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.id;
      userNameMap.set(u.id, name);
    }

    const deptNameMap = new Map<number, string>();
    for (const d of departmentsList) {
      deptNameMap.set(d.id, d.name);
    }

    function resolveOwnerName(ownerId: string | null | undefined): string | null {
      if (!ownerId) return null;
      return userNameMap.get(ownerId) || null;
    }

    function resolveDeptName(departmentId: number | null | undefined): string | null {
      if (!departmentId) return null;
      return deptNameMap.get(departmentId) || null;
    }

    function withOwnerName<T extends { ownerId?: string | null; departmentId?: number | null }>(entity: T): T & { ownerName: string | null; departmentName: string | null } {
      return { ...entity, ownerName: (entity as any).ownerName || resolveOwnerName(entity.ownerId), departmentName: resolveDeptName(entity.departmentId) };
    }

    function withAssigneeName<T extends { assigneeId?: string | null; departmentId?: number | null }>(entity: T): T & { assigneeName: string | null; ownerName: string | null; departmentName: string | null } {
      const stored = (entity as any).ownerName as string | null | undefined;
      return { ...entity, assigneeName: stored || resolveOwnerName(entity.assigneeId), ownerName: stored || resolveOwnerName(entity.assigneeId), departmentName: resolveDeptName(entity.departmentId) };
    }

    const rows: Array<{
      id: string;
      strategy: (typeof strategyItemsList[0] & { ownerName: string | null; departmentName: string | null }) | null;
      goal: (typeof goalsList[0] & { ownerName: string | null; departmentName: string | null }) | null;
      objective: (typeof objectivesList[0] & { ownerName: string | null; departmentName: string | null }) | null;
      initiative: (typeof initiativesList[0] & { ownerName: string | null; departmentName: string | null }) | null;
      okr: (typeof okrsList[0] & { ownerName: string | null; departmentName: string | null }) | null;
      kpi: (typeof kpisList[0] & { ownerName: string | null; departmentName: string | null }) | null;
      governance: (typeof governanceList[0] & { ownerName: string | null; departmentName: string | null }) | null;
      worstRag: string;
    }> = [];

    let rowId = 0;

    for (const strategy of strategyItemsList) {
      const linkedGoals = goalsList.filter(g => g.strategyItemId === strategy.id);
      
      if (linkedGoals.length === 0) {
        rows.push({
          id: `row-${rowId++}`,
          strategy: withOwnerName(strategy),
          goal: null,
          objective: null,
          initiative: null,
          okr: null,
          kpi: null,
          governance: null,
          worstRag: strategy.ragStatus || 'green',
        });
      } else {
        for (const goal of linkedGoals) {
          const linkedObjectives = objectivesList.filter(o => o.goalId === goal.id);
          
          if (linkedObjectives.length === 0) {
            rows.push({
              id: `row-${rowId++}`,
              strategy: withOwnerName(strategy),
              goal: withOwnerName(goal),
              objective: null,
              initiative: null,
              okr: null,
              kpi: null,
              governance: null,
              worstRag: getWorstRag([strategy.ragStatus, goal.ragStatus]),
            });
          } else {
            for (const objective of linkedObjectives) {
              const linkedInitiatives = initiativesList.filter(i => i.objectiveId === objective.id);
              
              if (linkedInitiatives.length === 0) {
                rows.push({
                  id: `row-${rowId++}`,
                  strategy: withOwnerName(strategy),
                  goal: withOwnerName(goal),
                  objective: withOwnerName(objective),
                  initiative: null,
                  okr: null,
                  kpi: null,
                  governance: null,
                  worstRag: getWorstRag([strategy.ragStatus, goal.ragStatus, objective.ragStatus]),
                });
              } else {
                for (const initiative of linkedInitiatives) {
                  const linkedOkrs = okrsList.filter(o => o.initiativeId === initiative.id);
                  const linkedKpis = kpisList.filter(k => k.initiativeId === initiative.id);
                  
                  if (linkedOkrs.length === 0 && linkedKpis.length === 0) {
                    rows.push({
                      id: `row-${rowId++}`,
                      strategy: withOwnerName(strategy),
                      goal: withOwnerName(goal),
                      objective: withOwnerName(objective),
                      initiative: withOwnerName(initiative),
                      okr: null,
                      kpi: null,
                      governance: null,
                      worstRag: getWorstRag([strategy.ragStatus, goal.ragStatus, objective.ragStatus, initiative.ragStatus]),
                    });
                  } else {
                    const maxLen = Math.max(linkedOkrs.length, linkedKpis.length, 1);
                    for (let i = 0; i < maxLen; i++) {
                      rows.push({
                        id: `row-${rowId++}`,
                        strategy: i === 0 ? withOwnerName(strategy) : null,
                        goal: i === 0 ? withOwnerName(goal) : null,
                        objective: i === 0 ? withOwnerName(objective) : null,
                        initiative: i === 0 ? withOwnerName(initiative) : null,
                        okr: linkedOkrs[i] ? withOwnerName(linkedOkrs[i]) : null,
                        kpi: linkedKpis[i] ? withOwnerName(linkedKpis[i]) : null,
                        governance: null,
                        worstRag: getWorstRag([
                          strategy.ragStatus,
                          goal.ragStatus,
                          objective.ragStatus,
                          initiative.ragStatus,
                          linkedOkrs[i]?.ragStatus,
                          linkedKpis[i]?.ragStatus,
                        ]),
                      });
                    }
                  }
                }
              }
              {
                // OKRs linked directly to this objective (not to a specific initiative)
                const objLevelOkrs = okrsList.filter(o => o.objectiveId === objective.id && !o.initiativeId);
                objLevelOkrs.forEach(okr => {
                  rows.push({
                    id: `row-${rowId++}`,
                    strategy: withOwnerName(strategy),
                    goal: withOwnerName(goal),
                    objective: withOwnerName(objective),
                    initiative: null,
                    okr: withOwnerName(okr),
                    kpi: null,
                    governance: null,
                    worstRag: getWorstRag([strategy.ragStatus, goal.ragStatus, objective.ragStatus, okr.ragStatus]),
                  });
                });
              }
            }
          }
          {
            // KPIs linked directly to this goal (no initiativeId set)
            const goalLevelKpis = kpisList.filter(k => k.goalId === goal.id && !k.initiativeId);
            goalLevelKpis.forEach(kpi => {
              rows.push({
                id: `row-${rowId++}`,
                strategy: withOwnerName(strategy),
                goal: withOwnerName(goal),
                objective: null,
                initiative: null,
                okr: null,
                kpi: withOwnerName(kpi),
                governance: null,
                worstRag: getWorstRag([strategy.ragStatus, goal.ragStatus, kpi.ragStatus]),
              });
            });
          }
        }
      }
    }

    // Add standalone governance rows linked at strategy level
    for (const gov of governanceList) {
      const linkedStrategy = gov.linkedStrategyId ? strategyItemsList.find(s => s.id === gov.linkedStrategyId) : null;
      rows.push({
        id: `row-${rowId++}`,
        strategy: linkedStrategy ? withOwnerName(linkedStrategy) : null,
        goal: null,
        objective: null,
        initiative: null,
        okr: null,
        kpi: null,
        governance: withOwnerName(gov as any),
        worstRag: getWorstRag([linkedStrategy?.ragStatus, gov.ragStatus]),
      });
    }

    let filteredRows = rows;
    if (filterStatus) {
      filteredRows = filteredRows.filter(r => 
        r.strategy?.status === filterStatus ||
        r.goal?.status === filterStatus ||
        r.objective?.status === filterStatus ||
        r.initiative?.status === filterStatus
      );
    }
    if (filterOwner) {
      filteredRows = filteredRows.filter(r =>
        r.strategy?.ownerId === filterOwner ||
        r.goal?.ownerId === filterOwner ||
        r.objective?.ownerId === filterOwner ||
        r.initiative?.ownerId === filterOwner ||
        r.okr?.ownerId === filterOwner ||
        r.kpi?.ownerId === filterOwner ||
        r.governance?.ownerId === filterOwner
      );
    }
    if (filterDepartment) {
      filteredRows = filteredRows.filter(r =>
        r.strategy?.departmentId === filterDepartment ||
        r.goal?.departmentId === filterDepartment ||
        r.objective?.departmentId === filterDepartment ||
        r.initiative?.departmentId === filterDepartment
      );
    }
    if (filterTimeframe) {
      filteredRows = filteredRows.filter(r =>
        r.strategy?.timeframe === filterTimeframe ||
        r.goal?.timeframe === filterTimeframe ||
        r.objective?.timeframe === filterTimeframe ||
        r.initiative?.timeframe === filterTimeframe
      );
    }

    res.json({
      rows: filteredRows,
      summary: {
        totalStrategies: strategyItemsList.length,
        totalGoals: goalsList.length,
        totalObjectives: objectivesList.length,
        totalInitiatives: initiativesList.length,
        totalOkrs: okrsList.length,
        totalKpis: kpisList.length,
        totalGovernance: governanceList.length,
      },
      departments: departmentsList,
    });
  });

  // ── AI Insights ──────────────────────────────────────────────────────────────

  app.post("/api/business/ai-insights", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);

    // Gather strategy data
    const [strategies, goals, objectives, initiatives, okrs, kpis, govItems] = await Promise.all([
      storage.getStrategyItems(tenantId),
      storage.getGoals(tenantId),
      storage.getObjectives(tenantId),
      storage.getInitiatives(tenantId),
      storage.getOkrs(tenantId),
      storage.getKpis(tenantId),
      storage.getGovernanceItems(tenantId),
    ]);

    const ragCounts = (items: Array<{ ragStatus?: string | null }>) => {
      const c = { green: 0, amber: 0, red: 0 };
      items.forEach(i => { const r = i.ragStatus || "green"; if (r in c) c[r as keyof typeof c]++; });
      return c;
    };

    const now = Date.now();
    const overdueInitiatives = initiatives.filter(i => i.endDate && new Date(i.endDate).getTime() < now && i.status !== "completed");
    const staleItems = [...strategies, ...goals, ...objectives, ...initiatives].filter(i => {
      if (!i.updatedAt) return false;
      const daysSince = (now - new Date(i.updatedAt).getTime()) / (1000 * 86400);
      return daysSince > 60;
    });

    const summary = {
      strategies: { total: strategies.length, rag: ragCounts(strategies) },
      goals: { total: goals.length, rag: ragCounts(goals) },
      objectives: { total: objectives.length, rag: ragCounts(objectives) },
      initiatives: { total: initiatives.length, rag: ragCounts(initiatives), overdue: overdueInitiatives.length },
      okrs: { total: okrs.length, rag: ragCounts(okrs) },
      kpis: { total: kpis.length, rag: ragCounts(kpis) },
      governance: { total: govItems.length },
      staleItems: staleItems.length,
      redRiskItems: [
        ...strategies.filter(i => i.ragStatus === "red").map(i => ({ type: "Strategy", title: i.title })),
        ...goals.filter(i => i.ragStatus === "red").map(i => ({ type: "Goal", title: i.title })),
        ...initiatives.filter(i => i.ragStatus === "red").map(i => ({ type: "Initiative", title: i.title })),
      ].slice(0, 10),
      overdueList: overdueInitiatives.slice(0, 5).map(i => ({ title: i.title, endDate: i.endDate })),
    };

    // Try AI generation
    const { getOpenAIConfig } = await import("./lib/openai");
    const { apiKey, baseURL } = getOpenAIConfig();
    if (!apiKey) {
      // Return data-driven insights without AI when key is not configured
      const insights = [];
      if (summary.strategies.rag.red > 0)
        insights.push({ type: "anomaly", severity: "high", title: "Red-status strategies detected", description: `${summary.strategies.rag.red} strategy item(s) are currently red. Immediate review recommended.` });
      if (summary.goals.rag.amber + summary.goals.rag.red > 0)
        insights.push({ type: "risk", severity: "medium", title: "Goals at risk", description: `${summary.goals.rag.amber} goals are amber and ${summary.goals.rag.red} are red. Consider re-planning.` });
      if (summary.initiatives.overdue > 0)
        insights.push({ type: "anomaly", severity: "high", title: "Overdue initiatives", description: `${summary.initiatives.overdue} initiative(s) are past their end date without completion.` });
      if (summary.staleItems > 0)
        insights.push({ type: "recommendation", severity: "low", title: "Stale items need attention", description: `${summary.staleItems} item(s) haven't been updated in over 60 days. Schedule a review session.` });
      if (insights.length === 0)
        insights.push({ type: "positive", severity: "info", title: "Strategy health looks good", description: "All tracked items are on track. Keep up the momentum and ensure regular check-ins." });
      return res.json({ insights, summary, generatedAt: new Date().toISOString(), source: "rules" });
    }

    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey, baseURL });
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a strategic planning advisor for Jiganto. Analyze strategy data and return JSON: 
{ "insights": [{ "type": "anomaly"|"risk"|"recommendation"|"positive", "severity": "high"|"medium"|"low"|"info", "title": string, "description": string }] }
Focus on: RAG status deteriorations, overdue items, cascade risks (red strategy → blocked goals), achievement opportunities, governance gaps. Be specific and actionable. Return 4-6 insights max.`,
          },
          {
            role: "user",
            content: `Business strategy data summary:\n${JSON.stringify(summary, null, 2)}`,
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content;
      const parsed = raw ? JSON.parse(raw) : { insights: [] };
      res.json({ ...parsed, summary, generatedAt: new Date().toISOString(), source: "ai" });
    } catch (aiErr) {
      res.status(500).json({ message: "AI generation failed", error: String(aiErr) });
    }
  });

  // AI Strategy Creation Assist
  app.post("/api/business/ai-assist", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { type, title, action = "describe" } = req.body;
    if (!title) return res.status(400).json({ message: "title is required" });

    const { getOpenAIConfig: getConfig } = await import("./lib/openai");
    const { apiKey, baseURL } = getConfig();
    if (!apiKey) {
      const fallback = `A ${type || "strategic"} focused on "${title}": drive measurable progress, align stakeholders, and deliver value through structured execution and clear accountability.`;
      return res.json({ description: fallback, source: "fallback" });
    }

    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey, baseURL });
      const prompts: Record<string, string> = {
        describe: `Write a concise, professional description (2-3 sentences) for a ${type || "strategy"} item titled: "${title}". Focus on purpose, expected outcomes, and business value. Be specific and actionable.`,
        objectives: `List 3-5 SMART objectives for a ${type || "strategy"} titled: "${title}". Return as a JSON array of strings.`,
      };
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a strategic planning expert for Jiganto. Be concise, professional, and business-focused." },
          { role: "user", content: prompts[action] ?? prompts.describe },
        ],
        max_tokens: 300,
      });
      const content = completion.choices[0]?.message?.content ?? "";
      res.json({ description: content, source: "ai" });
    } catch (err) {
      res.status(500).json({ message: "AI assist failed", error: String(err) });
    }
  });

  // ── Governance Items ──────────────────────────────────────────────────────────

  // Entity refs endpoint — returns a map of entityType+id → refSeq for all entities in tenant
  app.get("/api/business/entity-refs", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const refs = await storage.getEntityRefs(tenantId);
    const map: Record<string, number> = {};
    refs.forEach(r => { map[`${r.entityType}-${r.entityId}`] = r.refSeq; });
    res.json(map);
  });

  app.post("/api/business/entity-refs/backfill", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const result = await storage.backfillEntityRefs(tenantId);
    res.json(result);
  });

  app.get("/api/business/governance", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const items = await storage.getGovernanceItems(tenantId);
    res.json(items);
  });

  app.post("/api/business/governance", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    try {
      const item = await storage.createGovernanceItem({ ...req.body, tenantId });
      const refSeq = await storage.assignEntityRef(tenantId, "governance", item.id);
      res.status(201).json({ ...item, refSeq, refCode: `GOV-${String(refSeq).padStart(3,"0")}` });
    } catch (err) {
      res.status(400).json({ message: "Failed to create governance item", error: String(err) });
    }
  });

  app.patch("/api/business/governance/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const item = await storage.updateGovernanceItem(Number(req.params.id), req.body);
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (err) {
      res.status(400).json({ message: "Failed to update governance item" });
    }
  });

  app.delete("/api/business/governance/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteGovernanceItem(Number(req.params.id));
    res.status(204).send();
  });

  // ── Strategy Document Links ───────────────────────────────────────────────────

  app.get("/api/business/doc-links", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const layerType = req.query.layerType ? String(req.query.layerType) : undefined;
    const layerItemId = req.query.layerItemId ? Number(req.query.layerItemId) : undefined;
    const links = await storage.getStrategyDocLinks(tenantId, layerType, layerItemId);
    res.json(links);
  });

  app.post("/api/business/doc-links", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const claims = (req.user as any)?.claims;
    const addedByName = claims?.first_name && claims?.last_name
      ? `${claims.first_name} ${claims.last_name}`.trim()
      : claims?.email || "Unknown";
    const tenantId = getApiTenantIdWithFallback(req);
    try {
      const link = await storage.createStrategyDocLink({
        ...req.body,
        tenantId,
        addedBy: userId,
        addedByName: req.body.addedByName || addedByName,
      });
      res.status(201).json(link);
    } catch (err) {
      res.status(400).json({ message: "Failed to create doc link", error: String(err) });
    }
  });

  app.delete("/api/business/doc-links/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteStrategyDocLink(Number(req.params.id));
    res.status(204).send();
  });

  // ── KPI Time-series Values ────────────────────────────────────────────────────

  app.get("/api/business/kpi-values", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const kpiId = req.query.kpiId ? Number(req.query.kpiId) : undefined;
    const values = await storage.getStrategyKpiValues(tenantId, kpiId);
    res.json(values);
  });

  app.post("/api/business/kpi-values", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    try {
      const val = await storage.createStrategyKpiValue({ ...req.body, tenantId, createdBy: userId });
      res.status(201).json(val);
    } catch (err) {
      res.status(400).json({ message: "Failed to create KPI value", error: String(err) });
    }
  });

  app.delete("/api/business/kpi-values/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteStrategyKpiValue(Number(req.params.id));
    res.status(204).send();
  });

  // Seed Jiganto Strategy Data for Business Management
  app.post("/api/business/seed-demo", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    
    try {
      const { seedApexBusinessData } = await import("./seeds/apexBusiness");
      const result = await seedApexBusinessData(tenantId);
      res.json(result);
    } catch (error) {
      console.error("Error seeding Apex business data:", error);
      res.status(500).json({ message: "Failed to seed Apex business data", error: String(error) });
    }
  });

  // Clear Business Strategy Data
  app.delete("/api/business/seed-demo", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    
    try {
      const { clearApexBusinessData } = await import("./seeds/apexBusiness");
      const result = await clearApexBusinessData(tenantId);
      res.json(result);
    } catch (error) {
      console.error("Error clearing business data:", error);
      res.status(500).json({ message: "Failed to clear business data", error: String(error) });
    }
  });

  // ========================
  // Document Management Routes
  // ========================

  // Document Folders
  const multer = (await import("multer")).default;
  const path = await import("path");
  const fs = await import("fs");
  const express = (await import("express")).default;
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));
  const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.tif']);
  const imageUpload = multer({
    storage: multer.diskStorage({
      destination: (_req: any, _file: any, cb: any) => cb(null, uploadsDir),
      filename: (_req: any, file: any, cb: any) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (file.mimetype.startsWith("image/") && ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        cb(null, true);
      } else {
        cb(new Error("Only image files (jpg, png, gif, webp, svg) are allowed"));
      }
    },
  });

  app.post("/api/documents/upload-image", (req: any, res, next) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    next();
  }, imageUpload.single("image"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  app.post("/api/workspace-pages/upload-cover", (req: any, res, next) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    next();
  }, (req: any, res: any, next: any) => {
    imageUpload.single("image")(req, res, (err: any) => {
      if (err) {
        console.error("Cover upload multer error:", err);
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
      next();
    });
  }, (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  app.post("/api/bpm/upload-image", (req: any, res, next) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    next();
  }, imageUpload.single("image"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  app.post("/api/org-charts/upload-photo", (req: any, res, next) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    next();
  }, imageUpload.single("image"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  const fileUpload = multer({
    storage: multer.diskStorage({
      destination: (_req: any, _file: any, cb: any) => cb(null, uploadsDir),
      filename: (_req: any, file: any, cb: any) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
        cb(null, safeName);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.post("/api/document-files/upload", (req: any, res, next) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    next();
  }, fileUpload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const userId = getUserId(req);
      const tenantId = getApiTenantIdWithFallback(req);
      const folderId = req.body.folderId ? Number(req.body.folderId) : null;
      const [file] = await db.insert(documentFiles).values({
        tenantId,
        folderId,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedById: userId,
      }).returning();
      res.json(file);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to upload file: " + (error.message || "Unknown error") });
    }
  });

  app.get("/api/document-files", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const folderId = req.query.folderId === "null" ? null : req.query.folderId ? Number(req.query.folderId) : undefined;
    let query = db.select().from(documentFiles).where(eq(documentFiles.tenantId, tenantId));
    if (folderId === null) {
      query = db.select().from(documentFiles).where(and(eq(documentFiles.tenantId, tenantId), isNull(documentFiles.folderId)));
    } else if (folderId !== undefined) {
      query = db.select().from(documentFiles).where(and(eq(documentFiles.tenantId, tenantId), eq(documentFiles.folderId, folderId)));
    }
    const files = await query;
    res.json(files);
  });

  app.get("/api/document-files/all", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const files = await db.select().from(documentFiles).where(eq(documentFiles.tenantId, tenantId));
    res.json(files);
  });

  app.get("/api/document-files/:id/download", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const [file] = await db.select().from(documentFiles).where(eq(documentFiles.id, Number(req.params.id)));
    if (!file) return res.status(404).json({ message: "File not found" });
    const filePath = path.join(uploadsDir, file.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found on disk" });
    const inline = req.query.inline === "true";
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.originalName)}"`);
    if (inline) {
      res.removeHeader("X-Frame-Options");
      res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
    const stat = fs.statSync(filePath);
    res.setHeader("Content-Length", stat.size);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });

  app.get("/api/document-files/:id/preview", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const [file] = await db.select().from(documentFiles).where(eq(documentFiles.id, Number(req.params.id)));
    if (!file) return res.status(404).json({ message: "File not found" });
    const filePath = path.join(uploadsDir, file.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found on disk" });

    try {
      const ext = file.originalName.split(".").pop()?.toLowerCase() || "";
      if (ext === "docx" || file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const mammoth = await import("mammoth");
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.convertToHtml({ buffer });
        res.json({ type: "html", content: result.value, fileName: file.originalName });
      } else if (ext === "ppt" && !file.originalName.endsWith(".pptx")) {
        res.json({ type: "unsupported", fileName: file.originalName, message: "Legacy .ppt format preview is not supported. Please download the file or convert to .pptx." });
      } else if (ext === "pptx" || file.mimeType.includes("presentation")) {
        const JSZip = (await import("jszip")).default;
        const buffer = fs.readFileSync(filePath);
        const zip = await JSZip.loadAsync(buffer);
        const slides: { index: number; title: string; content: string }[] = [];
        const slideFiles = Object.keys(zip.files)
          .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
          .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
            const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
            return numA - numB;
          });
        for (const slidePath of slideFiles) {
          const xml = await zip.files[slidePath].async("text");
          const textParts: string[] = [];
          const textMatches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
          for (const match of textMatches) {
            const text = match.replace(/<[^>]+>/g, "").trim();
            if (text) textParts.push(text);
          }
          const slideNum = parseInt(slidePath.match(/slide(\d+)/)?.[1] || "0");
          slides.push({
            index: slideNum,
            title: textParts[0] || `Slide ${slideNum}`,
            content: textParts.join("\n"),
          });
        }
        res.json({ type: "presentation", slides, fileName: file.originalName, totalSlides: slides.length });
      } else if (ext === "xlsx" || ext === "xls" || file.mimeType.includes("spreadsheet") || file.mimeType.includes("excel")) {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(fs.readFileSync(filePath));
        const sheets = workbook.SheetNames.map(name => ({
          name,
          html: XLSX.utils.sheet_to_html(workbook.Sheets[name]),
          data: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }) as unknown[][],
        }));
        res.json({ type: "spreadsheet", sheets, fileName: file.originalName });
      } else if (file.mimeType.startsWith("text/") || ["json", "xml", "csv", "txt", "md", "js", "ts", "py", "html", "css", "sql", "yaml", "yml", "log", "ini", "cfg", "env", "sh"].includes(ext)) {
        const content = fs.readFileSync(filePath, "utf-8");
        res.json({ type: "text", content, fileName: file.originalName, ext });
      } else {
        res.json({ type: "unsupported", fileName: file.originalName });
      }
    } catch (err: any) {
      res.status(500).json({ message: "Preview generation failed", error: err.message });
    }
  });

  app.delete("/api/document-files/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const [file] = await db.select().from(documentFiles).where(eq(documentFiles.id, Number(req.params.id)));
    if (!file) return res.status(404).json({ message: "File not found" });
    const filePath = path.join(uploadsDir, file.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.delete(documentFiles).where(eq(documentFiles.id, file.id));
    res.json({ success: true });
  });

  app.put("/api/document-files/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { folderId, originalName } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (folderId !== undefined) updates.folderId = folderId;
    if (originalName) updates.originalName = originalName;
    const [file] = await db.update(documentFiles).set(updates).where(eq(documentFiles.id, Number(req.params.id))).returning();
    if (!file) return res.status(404).json({ message: "File not found" });
    res.json(file);
  });

  app.get("/api/documents/folders", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const parentId = req.query.parentId === "null" ? null : req.query.parentId ? Number(req.query.parentId) : undefined;
    const folders = await storage.getDocumentFolders(tenantId, parentId, resolveListClientId(req));
    res.json(folders);
  });

  app.get("/api/documents/folders/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const folder = await storage.getDocumentFolder(Number(req.params.id));
    if (!folder) return res.status(404).json({ message: "Folder not found" });
    if (!assertRecordInWorkspace(req, res, folder.clientId)) return;
    res.json(folder);
  });

  app.post("/api/documents/folders", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertDocumentFolderSchema.parse({ ...req.body, ownerId: userId });
      const folder = await storage.createDocumentFolder(input);
      res.status(201).json(folder);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/documents/folders/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const existingFolder = await storage.getDocumentFolder(Number(req.params.id));
      if (!existingFolder) return res.status(404).json({ message: "Folder not found" });
      
      const updateSchema = insertDocumentFolderSchema.partial();
      const input = updateSchema.parse(req.body);
      const folder = await storage.updateDocumentFolder(Number(req.params.id), input);
      res.json(folder);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/documents/folders/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteDocumentFolder(Number(req.params.id));
    res.status(204).send();
  });

  // Documents
  app.get("/api/documents", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const folderId = req.query.folderId === "null" ? null : req.query.folderId ? Number(req.query.folderId) : undefined;
      const docs = await storage.getDocumentsWithOwner(tenantId, folderId, resolveListClientId(req));
      res.json(docs);
    } catch (err) {
      console.error("Error fetching documents:", err);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/search", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const query = String(req.query.q || "").trim();
    if (!query) return res.json([]);
    try {
      const hits = await storage.globalSearch(
        userId,
        tenantId,
        query,
        resolveListClientId(req),
      );
      res.json(hits);
    } catch (err) {
      console.error("[search] error:", err);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/documents/search", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const query = String(req.query.q || "");
    const docs = await storage.searchDocuments(tenantId, query, resolveListClientId(req));
    res.json(docs);
  });

  app.get("/api/documents/favorites", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const docs = await storage.getFavoriteDocuments(tenantId, userId, resolveListClientId(req));
    res.json(docs);
  });

  app.get("/api/documents/recent", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const limit = Number(req.query.limit) || 10;
    const docs = await storage.getRecentDocuments(tenantId, userId, limit, resolveListClientId(req));
    res.json(docs);
  });

  // Documents shared with the current user via ACL
  app.get("/api/documents/shared-with-me", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    try {
      const docs = await storage.getSharedWithMeDocuments(tenantId, userId, resolveListClientId(req));
      res.json(docs);
    } catch (err) {
      console.error("Error fetching shared docs:", err);
      res.status(500).json({ message: "Failed to fetch shared documents" });
    }
  });

  // Public token management for documents
  app.get("/api/documents/:id/public-token", async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const doc = await storage.getDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ message: "Not found" });
    const token = (doc.metadata as any)?.publicToken ?? null;
    res.json({ token });
  });

  app.post("/api/documents/:id/public-token", async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const doc = await storage.getDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ message: "Not found" });
    const existingToken = (doc.metadata as any)?.publicToken;
    if (existingToken) return res.json({ token: existingToken });
    const { randomBytes } = await import("crypto");
    const token = randomBytes(24).toString("hex");
    const metadata = { ...((doc.metadata as object) || {}), publicToken: token };
    await storage.updateDocument(doc.id, { metadata });
    res.json({ token });
  });

  app.delete("/api/documents/:id/public-token", async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const doc = await storage.getDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ message: "Not found" });
    const metadata = { ...((doc.metadata as object) || {}) };
    delete (metadata as any).publicToken;
    await storage.updateDocument(doc.id, { metadata });
    res.status(204).send();
  });

  // Server-side PDF export via Puppeteer
  app.get("/api/documents/:id/export-pdf", async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const doc = await storage.getDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ message: "Not found" });
    try {
      const puppeteer = await import("puppeteer-core");
      const browser = await puppeteer.default.launch({
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
        headless: true,
      });
      const page = await browser.newPage();
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${doc.title}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1.5rem;line-height:1.6;color:#1a1a1a;}
  h1,h2,h3,h4{margin-top:1.5em;margin-bottom:0.5em;}
  table{border-collapse:collapse;width:100%;margin:1em 0;}
  th,td{border:1px solid #ddd;padding:8px;text-align:left;}
  th{background:#f5f5f5;font-weight:600;}
  ul,ol{padding-left:1.5em;}
  blockquote{border-left:4px solid #ddd;margin:1em 0;padding-left:1em;font-style:italic;}
  code{background:#f5f5f5;padding:0.2em 0.4em;border-radius:3px;font-family:monospace;}
  pre{background:#f5f5f5;padding:1em;border-radius:6px;overflow-x:auto;}
  [data-callout="info"]{border-left:4px solid #3b82f6;background:#eff6ff;border-radius:6px;padding:12px 16px;margin:8px 0;}
  [data-callout="warning"]{border-left:4px solid #f59e0b;background:#fffbeb;border-radius:6px;padding:12px 16px;margin:8px 0;}
  [data-callout="success"]{border-left:4px solid #22c55e;background:#f0fdf4;border-radius:6px;padding:12px 16px;margin:8px 0;}
  [data-callout="danger"]{border-left:4px solid #ef4444;background:#fef2f2;border-radius:6px;padding:12px 16px;margin:8px 0;}
  @media print{body{margin:0;padding:1cm 1.5cm;}}
</style>
</head>
<body>
  <h1 style="border-bottom:2px solid #e5e7eb;padding-bottom:0.5rem;margin-bottom:1rem;">${doc.title}</h1>
  <p style="color:#666;font-size:0.875rem;margin-bottom:2rem;">Last updated: ${new Date(doc.updatedAt!).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
  ${doc.content || "<p><em>No content</em></p>"}
</body>
</html>`;
      await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: { top: "2cm", right: "1.5cm", bottom: "2cm", left: "1.5cm" },
        printBackground: true,
      });
      await browser.close();
      const safeTitle = doc.title.replace(/[^a-z0-9]/gi, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (err: any) {
      console.error("PDF export error:", err);
      res.status(500).json({ message: "PDF generation failed: " + err.message });
    }
  });

  app.get("/api/documents/:id", async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const doc = await storage.getDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (!assertRecordInWorkspace(req, res, doc.clientId)) return;

    // Update view count and last viewed
    await storage.updateDocument(doc.id, {
      viewCount: (doc.viewCount || 0) + 1,
      lastViewedAt: new Date(),
    });
    
    res.json(doc);
  });

  app.post("/api/documents", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const input = insertDocumentSchema.parse({ ...req.body, ownerId: userId });
      const doc = await storage.createDocument(input);
      
      // Create initial version
      await storage.createDocumentVersion({
        documentId: doc.id,
        version: 1,
        title: doc.title,
        content: doc.content,
        changeDescription: "Initial version",
        authorId: userId,
      });
      
      // Audit log
      await storage.createDocumentAuditLog({
        tenantId: doc.tenantId,
        documentId: doc.id,
        userId,
        action: "create",
        details: { title: doc.title },
      });
      
      res.status(201).json(doc);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  const contentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.post("/api/documents/:id/content", (req: any, res, next) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    next();
  }, contentUpload.single("content"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const documentId = Number(req.params.id);
      if (!Number.isFinite(documentId) || documentId <= 0) {
        return res.status(400).json({ message: "Invalid document id" });
      }

      let content = "";
      if (req.file) {
        const buffer = req.file.buffer as Buffer;
        const isGzipped =
          req.file.originalname?.endsWith(".gz") ||
          (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b);
        if (isGzipped) {
          try {
            const zlib = await import("zlib");
            content = zlib.gunzipSync(buffer).toString("utf-8");
          } catch (gunzipErr) {
            console.warn("Document content gunzip failed, using raw buffer:", gunzipErr);
            content = buffer.toString("utf-8");
          }
        } else {
          content = buffer.toString("utf-8");
        }
      } else {
        content = req.body?.content || "";
      }

      const existingDoc = await storage.getDocument(documentId);
      if (!existingDoc) return res.status(404).json({ message: "Document not found" });

      const existingContent = existingDoc.content ?? "";
      const normalizedContent = content ?? "";

      if (normalizedContent === existingContent) {
        return res.json(existingDoc);
      }

      const nextVersion = await storage.getNextDocumentVersionNumber(documentId);
      await storage.createDocumentVersion({
        documentId: existingDoc.id,
        version: nextVersion,
        title: existingDoc.title,
        content: existingContent,
        changeDescription: "Content updated",
        authorId: userId ?? existingDoc.ownerId ?? undefined,
      });

      const doc = await storage.updateDocument(documentId, {
        content: normalizedContent,
        currentVersion: nextVersion,
      });

      await storage.createDocumentAuditLog({
        tenantId: existingDoc.tenantId,
        documentId: existingDoc.id,
        userId: userId!,
        action: "update",
        details: { title: doc?.title },
      });

      res.json(doc);
    } catch (err) {
      console.error("Document content save error:", err);
      res.status(500).json({ message: "Failed to save document content" });
    }
  });

  app.put("/api/documents/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const existingDoc = await storage.getDocument(Number(req.params.id));
      if (!existingDoc) return res.status(404).json({ message: "Document not found" });
      
      const updateSchema = insertDocumentSchema.partial();
      const input = updateSchema.parse(req.body);
      
      // Create version if content changed
      if (input.content && input.content !== existingDoc.content) {
        await storage.createDocumentVersion({
          documentId: existingDoc.id,
          version: (existingDoc.currentVersion || 1) + 1,
          title: existingDoc.title,
          content: existingDoc.content,
          changeDescription: input.changeDescription || "Content updated",
          authorId: userId,
        });
        input.currentVersion = (existingDoc.currentVersion || 1) + 1;
      }
      
      const doc = await storage.updateDocument(Number(req.params.id), input);
      
      // Audit log
      await storage.createDocumentAuditLog({
        tenantId: existingDoc.tenantId,
        documentId: existingDoc.id,
        userId,
        action: "update",
        details: { title: doc?.title },
      });
      
      res.json(doc);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    
    const doc = await storage.getDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ message: "Document not found" });
    
    // Audit log before deletion
    await storage.createDocumentAuditLog({
      tenantId: doc.tenantId,
      documentId: doc.id,
      userId,
      action: "delete",
      details: { title: doc.title },
    });
    
    await storage.deleteDocument(Number(req.params.id));
    res.status(204).send();
  });

  // Document Versions
  app.get("/api/documents/:id/versions", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const versions = await storage.getDocumentVersions(Number(req.params.id));
    res.json(versions);
  });

  app.post("/api/documents/:id/versions/:versionId/restore", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const doc = await storage.restoreDocumentVersion(Number(req.params.id), Number(req.params.versionId));
    if (!doc) return res.status(404).json({ message: "Document or version not found" });
    
    // Audit log
    await storage.createDocumentAuditLog({
      tenantId: doc.tenantId,
      documentId: doc.id,
      userId,
      action: "restore_version",
      details: { versionId: Number(req.params.versionId) },
    });
    
    res.json(doc);
  });

  // Document Tags
  app.get("/api/documents/tags", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const docTags = await storage.getTags(tenantId);
    res.json(docTags);
  });

  app.post("/api/documents/tags", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(input);
      res.status(201).json(tag);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/documents/tags/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const existingTag = await storage.getTag(Number(req.params.id));
      if (!existingTag) return res.status(404).json({ message: "Tag not found" });
      
      const updateSchema = insertTagSchema.partial();
      const input = updateSchema.parse(req.body);
      const tag = await storage.updateTag(Number(req.params.id), input);
      res.json(tag);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/documents/tags/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteTag(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/documents/:id/tags", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const docTags = await storage.getDocumentTags(Number(req.params.id));
    res.json(docTags);
  });

  app.post("/api/documents/:id/tags", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertDocumentTagSchema.parse({ documentId: Number(req.params.id), tagId: req.body.tagId });
      const docTag = await storage.addDocumentTag(input);
      res.status(201).json(docTag);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/documents/:id/tags/:tagId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.removeDocumentTag(Number(req.params.id), Number(req.params.tagId));
    res.status(204).send();
  });

  // Document Access Control
  app.get("/api/documents/:id/acl", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const acl = await storage.getDocumentAcl(Number(req.params.id));
    res.json(acl);
  });

  app.post("/api/documents/:id/acl", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertDocumentAclSchema.parse({ ...req.body, documentId: Number(req.params.id), grantedById: userId });
      const acl = await storage.createDocumentAcl(input);
      res.status(201).json(acl);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/documents/acl/:aclId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const existingAcl = await storage.getDocumentAclEntry(Number(req.params.aclId));
      if (!existingAcl) return res.status(404).json({ message: "ACL entry not found" });
      
      const updateSchema = insertDocumentAclSchema.partial();
      const input = updateSchema.parse(req.body);
      const acl = await storage.updateDocumentAcl(Number(req.params.aclId), input);
      res.json(acl);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/documents/acl/:aclId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteDocumentAcl(Number(req.params.aclId));
    res.status(204).send();
  });

  // Document Comments
  app.get("/api/documents/:id/comments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const comments = await storage.getDocumentComments(Number(req.params.id));
    res.json(comments);
  });

  app.post("/api/documents/:id/comments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertDocumentCommentSchema.parse({ ...req.body, documentId: Number(req.params.id), authorId: userId });
      const comment = await storage.createDocumentComment(input);
      res.status(201).json(comment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/documents/comments/:commentId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const updateSchema = z.object({
        content: z.string().optional(),
        isResolved: z.boolean().optional(),
      });
      const input = updateSchema.parse(req.body);
      
      const existingComment = await storage.getDocumentComment(Number(req.params.commentId));
      if (!existingComment) return res.status(404).json({ message: "Comment not found" });
      
      const comment = await storage.updateDocumentComment(Number(req.params.commentId), input.content || existingComment.content, input.isResolved);
      res.json(comment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/documents/comments/:commentId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteDocumentComment(Number(req.params.commentId));
    res.status(204).send();
  });

  // Document Templates
  app.get("/api/documents/templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const category = req.query.category as string | undefined;
    const scope = req.query.scope as string | undefined;
    const department = req.query.department as string | undefined;
    const module = req.query.module as string | undefined;
    let templates = await storage.getDocumentTemplates(tenantId, category);
    if (scope) templates = templates.filter((t: any) => t.scope === scope);
    if (department) templates = templates.filter((t: any) => t.department === department);
    if (module) templates = templates.filter((t: any) => t.module === module);
    res.json(templates);
  });

  app.get("/api/documents/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const template = await storage.getDocumentTemplate(Number(req.params.id));
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.post("/api/documents/templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertDocumentTemplateSchema.parse({ ...req.body, createdById: userId });
      const template = await storage.createDocumentTemplate(input);
      res.status(201).json(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/documents/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const existingTemplate = await storage.getDocumentTemplate(Number(req.params.id));
      if (!existingTemplate) return res.status(404).json({ message: "Template not found" });
      
      const updateSchema = insertDocumentTemplateSchema.partial();
      const input = updateSchema.parse(req.body);
      const template = await storage.updateDocumentTemplate(Number(req.params.id), input);
      res.json(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/documents/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteDocumentTemplate(Number(req.params.id));
    res.status(204).send();
  });

  // Document Audit Logs
  app.get("/api/documents/audit-logs", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const documentId = req.query.documentId ? Number(req.query.documentId) : undefined;
    const logs = await storage.getDocumentAuditLogs(tenantId, documentId);
    res.json(logs);
  });

  // Document-Initiative Links
  app.get("/api/documents/initiative-links", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const initiativeIdParam = req.query.initiativeId;
      const documentIdParam = req.query.documentId;
      const initiativeId = initiativeIdParam && !isNaN(Number(initiativeIdParam)) ? Number(initiativeIdParam) : undefined;
      const documentId = documentIdParam && !isNaN(Number(documentIdParam)) ? Number(documentIdParam) : undefined;
      const links = await storage.getDocumentInitiativeLinks(tenantId, initiativeId, documentId);
      res.json(links);
    } catch (err) {
      console.error("Error fetching document initiative links:", err);
      res.status(500).json({ message: "Failed to fetch document initiative links" });
    }
  });

  app.post("/api/documents/initiative-links", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertDocumentInitiativeLinkSchema.parse({ ...req.body, createdById: userId });
      const link = await storage.createDocumentInitiativeLink(input);
      res.status(201).json(link);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/documents/initiative-links/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteDocumentInitiativeLink(Number(req.params.id));
    res.status(204).send();
  });

  // ========== TASK MANAGEMENT ==========

  // Tasks
  app.get("/api/tasks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const filters: {
      assigneeId?: string;
      status?: string;
      priority?: string;
      source?: string;
      boardId?: number;
      clientId?: number;
    } = {};
    if (req.query.assigneeId) filters.assigneeId = req.query.assigneeId as string;
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.priority) filters.priority = req.query.priority as string;
    if (req.query.source) filters.source = req.query.source as string;
    if (req.query.boardId) filters.boardId = Number(req.query.boardId);
    const listClientId = resolveListClientId(req);
    if (listClientId !== undefined) {
      filters.clientId = listClientId;
    }
    const tasks = await storage.getTasks(tenantId, filters);
    res.json(tasks);
  });

  app.get("/api/tasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const task = await storage.getTask(Number(req.params.id));
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!assertRecordInWorkspace(req, res, task.clientId)) return;
    res.json(task);
  });

  app.post("/api/tasks/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { rows, mode = "append" } = req.body;
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await storage.bulkImportTasks(tenantId, rows, mode);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertTaskSchema.parse({ ...req.body, creatorId: userId });
      const task = await storage.createTask(input);
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const existingTask = await storage.getTask(Number(req.params.id));
      if (!existingTask) return res.status(404).json({ message: "Task not found" });
      
      const updateSchema = insertTaskSchema.partial();
      const input = updateSchema.parse(req.body);
      const task = await storage.updateTask(Number(req.params.id), input);
      res.json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteTask(Number(req.params.id));
    res.status(204).send();
  });

  // Task Boards
  app.get("/api/tasks/boards", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const taskBoards = await storage.getTaskBoards(tenantId, resolveListClientId(req));
    res.json(taskBoards);
  });

  app.post("/api/tasks/boards", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertTaskBoardSchema.parse(req.body);
      const taskBoard = await storage.createTaskBoard(input);
      res.status(201).json(taskBoard);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Task Subtasks
  app.get("/api/tasks/:taskId/subtasks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const subtasks = await storage.getTaskSubtasks(Number(req.params.taskId));
    res.json(subtasks);
  });

  app.post("/api/tasks/:taskId/subtasks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertTaskSubtaskSchema.parse({ ...req.body, taskId: Number(req.params.taskId) });
      const subtask = await storage.createTaskSubtask(input);
      res.status(201).json(subtask);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/tasks/subtasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const updateSchema = insertTaskSubtaskSchema.partial();
      const input = updateSchema.parse(req.body);
      const subtask = await storage.updateTaskSubtask(Number(req.params.id), input);
      if (!subtask) return res.status(404).json({ message: "Subtask not found" });
      res.json(subtask);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/tasks/subtasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteTaskSubtask(Number(req.params.id));
    res.status(204).send();
  });

  // Task Links (linking to other entities)
  app.get("/api/tasks/:taskId/links", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const links = await storage.getTaskLinks(Number(req.params.taskId));
    res.json(links);
  });

  app.post("/api/tasks/:taskId/links", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertTaskLinkSchema.parse({ ...req.body, taskId: Number(req.params.taskId) });
      const link = await storage.createTaskLink(input);
      res.status(201).json(link);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/tasks/links/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteTaskLink(Number(req.params.id));
    res.status(204).send();
  });

  // Task Views (saved filters/views)
  app.get("/api/tasks/views", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const views = await storage.getTaskViews(tenantId, userId);
    res.json(views);
  });

  app.post("/api/tasks/views", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertTaskViewSchema.parse({ ...req.body, userId });
      const view = await storage.createTaskView(input);
      res.status(201).json(view);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/tasks/views/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteTaskView(Number(req.params.id));
    res.status(204).send();
  });

  // ========== PROJECTS MODULE ==========

  // Portfolios
  app.get("/api/pm/portfolios", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const portfolios = await storage.getPmPortfolios(tenantId, resolveListClientId(req));
    res.json(portfolios);
  });

  app.get("/api/pm/portfolios/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const portfolio = await storage.getPmPortfolio(Number(req.params.id));
    if (!portfolio) return res.status(404).json({ message: "Portfolio not found" });
    res.json(portfolio);
  });

  app.post("/api/pm/portfolios", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmPortfolioSchema.parse(req.body);
      const portfolio = await storage.createPmPortfolio(input);
      res.status(201).json(portfolio);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/portfolios/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const portfolio = await storage.updatePmPortfolio(Number(req.params.id), req.body);
    if (!portfolio) return res.status(404).json({ message: "Portfolio not found" });
    res.json(portfolio);
  });

  app.delete("/api/pm/portfolios/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmPortfolio(Number(req.params.id));
    res.status(204).send();
  });

  // Programs
  app.get("/api/pm/programs", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const portfolioId = req.query.portfolioId ? Number(req.query.portfolioId) : undefined;
    const programs = await storage.getPmPrograms(tenantId, portfolioId, resolveListClientId(req));
    res.json(programs);
  });

  app.get("/api/pm/programs/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const program = await storage.getPmProgram(Number(req.params.id));
    if (!program) return res.status(404).json({ message: "Program not found" });
    res.json(program);
  });

  app.post("/api/pm/programs", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmProgramSchema.parse(req.body);
      const program = await storage.createPmProgram(input);
      res.status(201).json(program);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/programs/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const program = await storage.updatePmProgram(Number(req.params.id), req.body);
    if (!program) return res.status(404).json({ message: "Program not found" });
    res.json(program);
  });

  app.delete("/api/pm/programs/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmProgram(Number(req.params.id));
    res.status(204).send();
  });

  // Projects
  app.get("/api/pm/projects", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const filters: {
      portfolioId?: number;
      programId?: number;
      status?: string;
      methodology?: string;
      clientId?: number;
    } = {};
    if (req.query.portfolioId) filters.portfolioId = Number(req.query.portfolioId);
    if (req.query.programId) filters.programId = Number(req.query.programId);
    if (req.query.status) filters.status = String(req.query.status);
    if (req.query.methodology) filters.methodology = String(req.query.methodology);
    const listClientId = resolveListClientId(req);
    if (listClientId !== undefined) {
      filters.clientId = listClientId;
    }
    const projects = await storage.getPmProjects(tenantId, filters);
    res.json(projects);
  });

  app.get("/api/pm/projects/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const project = await storage.getPmProject(Number(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!assertRecordInWorkspace(req, res, project.clientId)) return;
    res.json(project);
  });

  app.post("/api/pm/projects", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmProjectSchema.parse(req.body);
      const project = await storage.createPmProject(input);
      res.status(201).json(project);
    } catch (err: any) {
      console.error("POST /api/pm/projects error:", err?.message || err, JSON.stringify(req.body).slice(0, 500));
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ') });
      }
      res.status(500).json({ message: err?.message || "Internal server error" });
    }
  });

  app.put("/api/pm/projects/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const project = await storage.updatePmProject(Number(req.params.id), req.body);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });

  app.delete("/api/pm/projects/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmProject(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/pm/seed-erp-portfolio", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    try {
      const { seedErpPortfolio } = await import("./seeds/erpPortfolioSeed");
      const result = await seedErpPortfolio(tenantId);
      res.json({ message: "ERP portfolio demo data seeded successfully", ...result });
    } catch (error) {
      console.error("Error seeding ERP portfolio:", error);
      res.status(500).json({ message: "Failed to seed ERP portfolio", error: String(error) });
    }
  });

  app.post("/api/pm/projects/:id/seed-s4hana", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const projectId = Number(req.params.id);
    
    try {
      const { seedS4HanaProject } = await import("./seeds/s4hanaProject");
      const result = await seedS4HanaProject(tenantId, projectId);
      res.json(result);
    } catch (error) {
      console.error("Error seeding S/4HANA project data:", error);
      res.status(500).json({ message: "Failed to seed S/4HANA project data", error: String(error) });
    }
  });

  // Project Tools
  app.get("/api/pm/projects/:projectId/tools", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tools = await storage.getPmProjectTools(Number(req.params.projectId));
    res.json(tools);
  });

  app.post("/api/pm/projects/:projectId/tools", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmProjectToolSchema.parse({ ...req.body, projectId: Number(req.params.projectId) });
      const tool = await storage.createPmProjectTool(input);
      res.status(201).json(tool);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post("/api/pm/projects/:projectId/tools/bulk", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const projectId = Number(req.params.projectId);
    try {
      const toolsArray = req.body.tools || [];
      const validatedTools = toolsArray.map((t: any) => insertPmProjectToolSchema.parse({ ...t, projectId }));
      const tools = await storage.bulkCreatePmProjectTools(validatedTools);
      res.status(201).json(tools);
    } catch (err: any) {
      console.error("POST /api/pm/projects/:id/tools/bulk error:", err?.message || err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ') });
      res.status(500).json({ message: err?.message || "Internal server error" });
    }
  });

  app.put("/api/pm/projects/:projectId/tools/reorder", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const projectId = Number(req.params.projectId);
    try {
      const { order } = req.body as { order: { id: number; sortOrder: number }[] };
      if (!Array.isArray(order)) return res.status(400).json({ message: "order array required" });
      const existingTools = await storage.getPmProjectTools(projectId);
      const validIds = new Set(existingTools.map(t => t.id));
      for (const item of order) {
        if (!validIds.has(item.id)) continue;
        await storage.updatePmProjectTool(item.id, { sortOrder: item.sortOrder });
      }
      const tools = await storage.getPmProjectTools(projectId);
      res.json(tools);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Internal server error" });
    }
  });

  app.put("/api/pm/project-tools/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tool = await storage.updatePmProjectTool(Number(req.params.id), req.body);
    if (!tool) return res.status(404).json({ message: "Tool not found" });
    res.json(tool);
  });

  app.delete("/api/pm/project-tools/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmProjectTool(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/pm/projects/:projectId/documents", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const projectId = Number(req.params.projectId);
    const project = await storage.getPmProject(projectId);
    const meta = (project?.metadata as Record<string, unknown>) || {};
    const linkedIds = Array.isArray(meta.linkedDocumentIds)
      ? (meta.linkedDocumentIds as number[]).filter((id) => typeof id === "number")
      : [];
    const docs = await storage.getDocumentsForProject(tenantId, projectId, linkedIds);
    res.json(docs);
  });

  app.get("/api/finance/timesheet-entries", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    if (!projectId) return res.status(400).json({ message: "projectId is required" });
    const entries = await storage.getTimesheetEntriesByProject(tenantId, projectId);
    res.json(entries);
  });

  // ── Agile Workstreams ────────────────────────────────────────────────────
  app.get("/api/pm/projects/:projectId/agile/workstreams", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const workstreams = await storage.getPmAgileWorkstreams(Number(req.params.projectId));
    res.json(workstreams);
  });

  app.get("/api/pm/projects/:projectId/agile/dashboard", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const dashboard = await storage.getPmAgileDashboard(Number(req.params.projectId));
    res.json(dashboard);
  });

  app.post("/api/pm/projects/:projectId/agile/workstreams", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenant = await storage.getDefaultTenant();
    try {
      const input = insertPmAgileWorkstreamSchema.parse({ ...req.body, projectId: Number(req.params.projectId), tenantId: tenant?.id || 1 });
      const ws = await storage.createPmAgileWorkstream(input);
      res.status(201).json(ws);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: err.errors?.[0]?.message });
      throw err;
    }
  });

  app.put("/api/pm/agile/workstreams/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const ws = await storage.updatePmAgileWorkstream(Number(req.params.id), req.body);
    if (!ws) return res.status(404).json({ message: "Workstream not found" });
    res.json(ws);
  });

  app.delete("/api/pm/agile/workstreams/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmAgileWorkstream(Number(req.params.id));
    res.status(204).send();
  });

  // ── Agile Epics ──────────────────────────────────────────────────────────
  app.get("/api/pm/agile/workstreams/:wsId/epics", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    res.json(await storage.getPmEpics(Number(req.params.wsId)));
  });

  app.post("/api/pm/agile/workstreams/:wsId/epics", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenant = await storage.getDefaultTenant();
    try {
      const input = insertPmEpicSchema.parse({ ...req.body, agileWorkstreamId: Number(req.params.wsId), tenantId: tenant?.id || 1 });
      res.status(201).json(await storage.createPmEpic(input));
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: err.errors?.[0]?.message });
      throw err;
    }
  });

  app.put("/api/pm/agile/epics/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const epic = await storage.updatePmEpic(Number(req.params.id), req.body);
    if (!epic) return res.status(404).json({ message: "Epic not found" });
    res.json(epic);
  });

  app.delete("/api/pm/agile/epics/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmEpic(Number(req.params.id));
    res.status(204).send();
  });

  // ── Agile Sprints ────────────────────────────────────────────────────────
  app.get("/api/pm/agile/workstreams/:wsId/sprints", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    res.json(await storage.getPmAgileSprints(Number(req.params.wsId)));
  });

  app.post("/api/pm/agile/workstreams/:wsId/sprints", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenant = await storage.getDefaultTenant();
    try {
      const input = insertPmAgileSprintSchema.parse({ ...req.body, agileWorkstreamId: Number(req.params.wsId), tenantId: tenant?.id || 1 });
      res.status(201).json(await storage.createPmAgileSprint(input));
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: err.errors?.[0]?.message });
      throw err;
    }
  });

  app.put("/api/pm/agile/sprints/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const sprint = await storage.updatePmAgileSprint(Number(req.params.id), req.body);
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });
    res.json(sprint);
  });

  app.delete("/api/pm/agile/sprints/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmAgileSprint(Number(req.params.id));
    res.status(204).send();
  });

  // ── Agile Stories ────────────────────────────────────────────────────────
  app.get("/api/pm/agile/workstreams/:wsId/stories", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    res.json(await storage.getPmAgileStories(Number(req.params.wsId)));
  });

  app.post("/api/pm/agile/workstreams/:wsId/stories", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenant = await storage.getDefaultTenant();
    try {
      const input = insertPmAgileStorySchema.parse({ ...req.body, agileWorkstreamId: Number(req.params.wsId), tenantId: tenant?.id || 1 });
      res.status(201).json(await storage.createPmAgileStory(input));
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: err.errors?.[0]?.message });
      throw err;
    }
  });

  app.put("/api/pm/agile/stories/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const story = await storage.updatePmAgileStory(Number(req.params.id), req.body);
    if (!story) return res.status(404).json({ message: "Story not found" });
    res.json(story);
  });

  app.delete("/api/pm/agile/stories/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmAgileStory(Number(req.params.id));
    res.status(204).send();
  });

  // ── Agile Defects ────────────────────────────────────────────────────────
  app.get("/api/pm/agile/workstreams/:wsId/defects", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    res.json(await storage.getPmAgileDefects(Number(req.params.wsId)));
  });

  app.post("/api/pm/agile/workstreams/:wsId/defects", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenant = await storage.getDefaultTenant();
    try {
      const input = insertPmAgileDefectSchema.parse({ ...req.body, agileWorkstreamId: Number(req.params.wsId), tenantId: tenant?.id || 1 });
      res.status(201).json(await storage.createPmAgileDefect(input));
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: err.errors?.[0]?.message });
      throw err;
    }
  });

  app.put("/api/pm/agile/defects/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const defect = await storage.updatePmAgileDefect(Number(req.params.id), req.body);
    if (!defect) return res.status(404).json({ message: "Defect not found" });
    res.json(defect);
  });

  app.delete("/api/pm/agile/defects/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmAgileDefect(Number(req.params.id));
    res.status(204).send();
  });

  // Project Phases
  app.get("/api/pm/projects/:projectId/phases", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const phases = await storage.getPmProjectPhases(Number(req.params.projectId));
    res.json(phases);
  });

  app.get("/api/pm/phases/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const phase = await storage.getPmProjectPhase(Number(req.params.id));
    if (!phase) return res.status(404).json({ message: "Phase not found" });
    res.json(phase);
  });

  app.post("/api/pm/phases", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmProjectPhaseSchema.parse(req.body);
      const phase = await storage.createPmProjectPhase(input);
      res.status(201).json(phase);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/phases/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const phase = await storage.updatePmProjectPhase(Number(req.params.id), req.body);
    if (!phase) return res.status(404).json({ message: "Phase not found" });
    res.json(phase);
  });

  app.delete("/api/pm/phases/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmProjectPhase(Number(req.params.id));
    res.status(204).send();
  });

  // Project Milestones
  app.get("/api/pm/milestones", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const milestones = await storage.getAllPmMilestones(tenantId);
    res.json(milestones);
  });

  app.post("/api/pm/milestones/import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { milestones } = req.body;
    if (!Array.isArray(milestones)) return res.status(400).json({ message: "milestones must be an array" });
    const created = [];
    for (const m of milestones) {
      const result = await storage.createPmMilestone(m);
      created.push(result);
    }
    res.status(201).json(created);
  });

  app.get("/api/pm/projects/:projectId/milestones", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const phaseId = req.query.phaseId ? Number(req.query.phaseId) : undefined;
    const milestones = await storage.getPmMilestones(Number(req.params.projectId), phaseId);
    res.json(milestones);
  });

  app.get("/api/pm/milestones/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const milestone = await storage.getPmMilestone(Number(req.params.id));
    if (!milestone) return res.status(404).json({ message: "Milestone not found" });
    res.json(milestone);
  });

  app.post("/api/pm/milestones", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmMilestoneSchema.parse(req.body);
      const milestone = await storage.createPmMilestone(input);
      res.status(201).json(milestone);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/milestones/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const milestone = await storage.updatePmMilestone(Number(req.params.id), req.body);
    if (!milestone) return res.status(404).json({ message: "Milestone not found" });
    res.json(milestone);
  });

  app.delete("/api/pm/milestones/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmMilestone(Number(req.params.id));
    res.status(204).send();
  });

  // Project Tasks
  app.get("/api/pm/projects/:projectId/tasks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const filters: { phaseId?: number; status?: string; assigneeId?: string } = {};
    if (req.query.phaseId) filters.phaseId = Number(req.query.phaseId);
    if (req.query.status) filters.status = String(req.query.status);
    if (req.query.assigneeId) filters.assigneeId = String(req.query.assigneeId);
    const tasks = await storage.getPmTasks(Number(req.params.projectId), filters);
    res.json(tasks);
  });

  app.get("/api/pm/tasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const task = await storage.getPmTask(Number(req.params.id));
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  });

  app.post("/api/pm/tasks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmTaskSchema.parse(req.body);
      const task = await storage.createPmTask(input);
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/tasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const task = await storage.updatePmTask(Number(req.params.id), req.body);
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  });

  app.delete("/api/pm/tasks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmTask(Number(req.params.id));
    res.status(204).send();
  });

  app.delete("/api/pm/projects/:projectId/tasks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const projectId = Number(req.params.projectId);
    await storage.deleteAllPmTasksByProject(projectId);
    res.status(204).send();
  });

  app.post("/api/pm/projects/:projectId/tasks/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const projectId = Number(req.params.projectId);
    try {
      const { tasks } = req.body as { tasks: { tempId: string; parentTempId: string | null; data: any }[] };
      if (!Array.isArray(tasks)) return res.status(400).json({ message: "tasks array required" });
      const results = await storage.bulkImportPmTasks(projectId, tasks);
      res.json({ results });
    } catch (err: any) {
      console.error("POST bulk-import error:", err?.message || err);
      res.status(500).json({ message: err?.message || "Bulk import failed" });
    }
  });

  app.post("/api/pm/projects/:projectId/gantt/import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const projectId = Number(req.params.projectId);
    const project = await storage.getPmProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    try {
      const { mode, items } = req.body as {
        mode?: "append" | "overwrite";
        items: {
          wbs: string; name: string; type: number; parentWbs?: string | null; predecessorWbs?: string | null;
          owner?: string; start: string; end?: string; progress?: number; rag?: string; notes?: string;
        }[];
      };
      if (!Array.isArray(items)) return res.status(400).json({ message: "items array required" });
      const result = await storage.bulkImportGanttPlan(
        projectId,
        project.tenantId,
        mode === "overwrite" ? "overwrite" : "append",
        items,
      );
      res.json(result);
    } catch (err: any) {
      console.error("POST gantt import error:", err?.message || err);
      res.status(500).json({ message: err?.message || "Gantt import failed" });
    }
  });

  app.get("/api/test-mgmt/test-cases", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const suiteId = req.query.suiteId ? Number(req.query.suiteId) : undefined;
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      const cases = await storage.getTmTestCases(tenantId, suiteId, projectId);
      res.json(cases);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Project Team Members
  app.get("/api/pm/projects/:projectId/team", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const members = await storage.getPmTeamMembers(Number(req.params.projectId));
    res.json(members);
  });

  app.post("/api/pm/team", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmTeamMemberSchema.parse(req.body);
      const member = await storage.createPmTeamMember(input);
      res.status(201).json(member);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/team/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const member = await storage.updatePmTeamMember(Number(req.params.id), req.body);
    if (!member) return res.status(404).json({ message: "Team member not found" });
    res.json(member);
  });

  app.delete("/api/pm/team/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmTeamMember(Number(req.params.id));
    res.status(204).send();
  });

  // RAIDD Items (Risks, Assumptions, Issues, Dependencies, Decisions)
  app.get("/api/pm/projects/:projectId/raidd", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const type = req.query.type ? String(req.query.type) : undefined;
    const items = await storage.getPmRaiddItems(Number(req.params.projectId), type);
    res.json(items);
  });

  app.get("/api/pm/raidd/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const item = await storage.getPmRaiddItem(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "RAIDD item not found" });
    res.json(item);
  });

  app.post("/api/pm/projects/:projectId/raidd/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { rows, mode = "append" } = req.body;
      const projectId = Number(req.params.projectId);
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await storage.bulkImportPmRaiddItems(projectId, tenantId, rows, mode);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/pm/raidd", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmRaiddItemSchema.parse(req.body);
      const item = await storage.createPmRaiddItem(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/raidd/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const item = await storage.updatePmRaiddItem(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ message: "RAIDD item not found" });
    res.json(item);
  });

  app.delete("/api/pm/raidd/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmRaiddItem(Number(req.params.id));
    res.status(204).send();
  });

  // ── Deliverable Phases Routes ──
  app.get("/api/pm/projects/:projectId/deliverable-phases", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const phases = await storage.getPmDeliverablePhases(Number(req.params.projectId));
    res.json(phases);
  });

  app.post("/api/pm/deliverable-phases", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const input = insertPmDeliverablePhaseSchema.parse(req.body);
    const phase = await storage.createPmDeliverablePhase(input);
    res.status(201).json(phase);
  });

  app.put("/api/pm/deliverable-phases/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const updated = await storage.updatePmDeliverablePhase(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Phase not found" });
    res.json(updated);
  });

  app.delete("/api/pm/deliverable-phases/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmDeliverablePhase(Number(req.params.id));
    res.status(204).send();
  });

  app.put("/api/pm/projects/:projectId/deliverable-phases/replace", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const projectId = Number(req.params.projectId);
    const { phases, deliverableUpdates } = req.body;
    if (!Array.isArray(phases)) return res.status(400).json({ message: "phases must be an array" });
    const result = await storage.replaceAllPmDeliverablePhases(
      projectId,
      phases,
      Array.isArray(deliverableUpdates) ? deliverableUpdates : undefined
    );
    res.json(result);
  });

  app.post("/api/pm/projects/:projectId/deliverable-phases/template", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { template, tenantId } = req.body;
    const TPLS: Record<string, { name: string; color: string }[]> = {
      agile: [
        { name: "Discovery", color: "#3b6cf4" }, { name: "Sprint Planning", color: "#7c3aed" },
        { name: "Sprint 1", color: "#059669" }, { name: "Sprint 2", color: "#db2777" },
        { name: "Sprint 3", color: "#d97706" }, { name: "UAT", color: "#4f46e5" },
        { name: "Release", color: "#dc2626" }, { name: "Retrospective", color: "#9ca3af" },
      ],
      waterfall: [
        { name: "Initiation", color: "#3b6cf4" }, { name: "Planning", color: "#7c3aed" },
        { name: "Design", color: "#059669" }, { name: "Build", color: "#db2777" },
        { name: "Testing", color: "#d97706" }, { name: "Go Live", color: "#dc2626" },
        { name: "Closure", color: "#9ca3af" },
      ],
      erp: [
        { name: "Initiation", color: "#3b6cf4" }, { name: "Blueprinting", color: "#7c3aed" },
        { name: "Realisation", color: "#059669" }, { name: "Testing", color: "#db2777" },
        { name: "Cutover Prep", color: "#d97706" }, { name: "Go Live", color: "#dc2626" },
        { name: "Stabilisation", color: "#9ca3af" },
      ],
      saas: [
        { name: "Assessment", color: "#3b6cf4" }, { name: "Vendor Selection", color: "#7c3aed" },
        { name: "Configuration", color: "#059669" }, { name: "Integration", color: "#db2777" },
        { name: "Testing", color: "#d97706" }, { name: "Migration", color: "#dc2626" },
        { name: "Hypercare", color: "#9ca3af" },
      ],
    };
    const tpl = TPLS[template];
    if (!tpl) return res.status(400).json({ message: "Unknown template" });
    const projectId = Number(req.params.projectId);
    const created = [];
    for (let i = 0; i < tpl.length; i++) {
      const phase = await storage.createPmDeliverablePhase({
        tenantId, projectId, name: tpl[i].name, color: tpl[i].color, sortOrder: i,
      });
      created.push(phase);
    }
    res.status(201).json(created);
  });

  // ── Deliverables Routes ──
  app.get("/api/pm/projects/:projectId/deliverables", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const items = await storage.getPmDeliverables(Number(req.params.projectId));
    res.json(items);
  });

  app.post("/api/pm/deliverables", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const input = insertPmDeliverableSchema.parse(req.body);
    const item = await storage.createPmDeliverable(input);
    res.status(201).json(item);
  });

  app.put("/api/pm/deliverables/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const updated = await storage.updatePmDeliverable(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Deliverable not found" });
    res.json(updated);
  });

  app.delete("/api/pm/deliverables/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmDeliverable(Number(req.params.id));
    res.status(204).send();
  });

  // Business Requirements Routes
  app.get("/api/pm/projects/:projectId/requirements", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const requirements = await storage.getPmBusinessRequirements(Number(req.params.projectId));
    res.json(requirements);
  });

  app.get("/api/pm/requirements/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const requirement = await storage.getPmBusinessRequirement(Number(req.params.id));
    if (!requirement) return res.status(404).json({ message: "Business requirement not found" });
    res.json(requirement);
  });

  app.post("/api/pm/requirements", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmBusinessRequirementSchema.parse(req.body);
      const requirement = await storage.createPmBusinessRequirement(input);
      res.status(201).json(requirement);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/requirements/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const requirement = await storage.updatePmBusinessRequirement(Number(req.params.id), req.body);
    if (!requirement) return res.status(404).json({ message: "Business requirement not found" });
    res.json(requirement);
  });

  app.delete("/api/pm/requirements/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmBusinessRequirement(Number(req.params.id));
    res.status(204).send();
  });

  // Phase Templates
  app.get("/api/pm/templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const templates = await storage.getPmPhaseTemplates(tenantId);
    res.json(templates);
  });

  app.get("/api/pm/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const template = await storage.getPmPhaseTemplate(Number(req.params.id));
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.post("/api/pm/templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmPhaseTemplateSchema.parse(req.body);
      const template = await storage.createPmPhaseTemplate(input);
      res.status(201).json(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const template = await storage.updatePmPhaseTemplate(Number(req.params.id), req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/pm/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmPhaseTemplate(Number(req.params.id));
    res.status(204).send();
  });

  // Projects Module - Workstreams
  app.get("/api/pm/workstreams", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const projectId = Number(req.query.projectId);
    if (!projectId) return res.status(400).json({ message: "Project ID is required" });
    const workstreams = await storage.getPmWorkstreams(projectId);
    res.json(workstreams);
  });

  app.get("/api/pm/workstreams/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const workstream = await storage.getPmWorkstream(Number(req.params.id));
    if (!workstream) return res.status(404).json({ message: "Workstream not found" });
    res.json(workstream);
  });

  app.post("/api/pm/workstreams", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmWorkstreamSchema.parse(req.body);
      const workstream = await storage.createPmWorkstream(input);
      res.status(201).json(workstream);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/workstreams/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const workstream = await storage.updatePmWorkstream(Number(req.params.id), req.body);
    if (!workstream) return res.status(404).json({ message: "Workstream not found" });
    res.json(workstream);
  });

  app.delete("/api/pm/workstreams/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmWorkstream(Number(req.params.id));
    res.status(204).send();
  });

  // Projects Module - Sprints
  app.get("/api/pm/sprints", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const projectId = Number(req.query.projectId);
    if (!projectId) return res.status(400).json({ message: "Project ID is required" });
    const sprints = await storage.getPmSprints(projectId);
    res.json(sprints);
  });

  app.get("/api/pm/sprints/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const sprint = await storage.getPmSprint(Number(req.params.id));
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });
    res.json(sprint);
  });

  app.post("/api/pm/sprints", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmSprintSchema.parse(req.body);
      const sprint = await storage.createPmSprint(input);
      res.status(201).json(sprint);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/sprints/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const sprint = await storage.updatePmSprint(Number(req.params.id), req.body);
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });
    res.json(sprint);
  });

  app.delete("/api/pm/sprints/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmSprint(Number(req.params.id));
    res.status(204).send();
  });

  // Projects Module - Backlog Items
  app.get("/api/pm/backlog", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const projectId = Number(req.query.projectId);
    if (!projectId) return res.status(400).json({ message: "Project ID is required" });
    const sprintId = req.query.sprintId ? Number(req.query.sprintId) : undefined;
    const items = await storage.getPmBacklogItems(projectId, sprintId);
    res.json(items);
  });

  app.get("/api/pm/backlog/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const item = await storage.getPmBacklogItem(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Backlog item not found" });
    res.json(item);
  });

  app.post("/api/pm/backlog", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const input = insertPmBacklogItemSchema.parse(req.body);
      const item = await storage.createPmBacklogItem(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/pm/backlog/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const item = await storage.updatePmBacklogItem(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ message: "Backlog item not found" });
    res.json(item);
  });

  app.delete("/api/pm/backlog/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmBacklogItem(Number(req.params.id));
    res.status(204).send();
  });

  // ============================================
  // RACI Module Routes
  // ============================================

  // RACI Roles
  app.get("/api/pm/raci/roles", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const roles = await storage.getPmRaciRoles(tenantId, projectId);
    res.json(roles);
  });

  app.get("/api/pm/raci/roles/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const role = await storage.getPmRaciRole(Number(req.params.id));
    if (!role) return res.status(404).json({ message: "Role not found" });
    res.json(role);
  });

  app.post("/api/pm/raci/roles", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenant = await storage.getDefaultTenant();
      const role = await storage.createPmRaciRole({ ...req.body, tenantId: req.body.tenantId || tenant?.id || 1 });
      res.status(201).json(role);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/pm/raci/roles/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const role = await storage.updatePmRaciRole(Number(req.params.id), req.body);
    res.json(role);
  });

  app.delete("/api/pm/raci/roles/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmRaciRole(Number(req.params.id));
    res.status(204).send();
  });

  // RACI Activities
  app.get("/api/pm/raci/activities", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const activities = await storage.getPmRaciActivities(tenantId, projectId);
    res.json(activities);
  });

  app.get("/api/pm/raci/activities/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const activity = await storage.getPmRaciActivity(Number(req.params.id));
    if (!activity) return res.status(404).json({ message: "Activity not found" });
    res.json(activity);
  });

  app.post("/api/pm/raci/activities", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenant = await storage.getDefaultTenant();
      const activity = await storage.createPmRaciActivity({ ...req.body, tenantId: req.body.tenantId || tenant?.id || 1 });
      res.status(201).json(activity);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/pm/raci/activities/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const activity = await storage.updatePmRaciActivity(Number(req.params.id), req.body);
    res.json(activity);
  });

  app.delete("/api/pm/raci/activities/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmRaciActivity(Number(req.params.id));
    res.status(204).send();
  });

  // RACI Types
  app.get("/api/pm/raci/types", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const types = await storage.getPmRaciTypes(tenantId);
    res.json(types);
  });

  app.get("/api/pm/raci/types/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const type = await storage.getPmRaciType(Number(req.params.id));
    if (!type) return res.status(404).json({ message: "Type not found" });
    res.json(type);
  });

  app.post("/api/pm/raci/types", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const type = await storage.createPmRaciType(req.body);
      res.status(201).json(type);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/pm/raci/types/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const type = await storage.updatePmRaciType(Number(req.params.id), req.body);
    res.json(type);
  });

  app.delete("/api/pm/raci/types/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmRaciType(Number(req.params.id));
    res.status(204).send();
  });

  // RACI Assignments
  app.get("/api/pm/raci/assignments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const assignments = await storage.getPmRaciAssignments(tenantId, projectId);
    res.json(assignments);
  });

  app.get("/api/pm/raci/assignments/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const assignment = await storage.getPmRaciAssignment(Number(req.params.id));
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    res.json(assignment);
  });

  app.post("/api/pm/raci/assignments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const assignment = await storage.createPmRaciAssignment({ ...req.body, createdBy: userId });
      res.status(201).json(assignment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/pm/raci/assignments/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const assignment = await storage.updatePmRaciAssignment(Number(req.params.id), req.body);
    res.json(assignment);
  });

  app.delete("/api/pm/raci/assignments/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmRaciAssignment(Number(req.params.id));
    res.status(204).send();
  });

  // RACI Templates
  app.get("/api/pm/raci/templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const templates = await storage.getPmRaciTemplates(tenantId);
    res.json(templates);
  });

  app.get("/api/pm/raci/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const template = await storage.getPmRaciTemplate(Number(req.params.id));
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.post("/api/pm/raci/templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const template = await storage.createPmRaciTemplate({ ...req.body, createdBy: userId });
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/pm/raci/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const template = await storage.updatePmRaciTemplate(Number(req.params.id), req.body);
    res.json(template);
  });

  app.delete("/api/pm/raci/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePmRaciTemplate(Number(req.params.id));
    res.status(204).send();
  });

  // === RESOURCE MANAGEMENT ROUTES ===

  // Resources — Rate Cards (ADR-003: single source of truth)
  app.get("/api/resources/rate-cards", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const cards = await storage.getRateCards(tenantId);
    const cardsWithItems = await Promise.all(cards.map(async (card) => {
      const items = await storage.getRateCardItems(card.id);
      return { ...card, items };
    }));
    res.json(cardsWithItems);
  });

  app.post("/api/resources/rate-cards", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const card = await storage.createRateCard({ ...req.body, tenantId });
      res.status(201).json(card);
    } catch (err) {
      res.status(400).json({ message: "Failed to create rate card" });
    }
  });

  app.put("/api/resources/rate-cards/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const card = await storage.updateRateCard(Number(req.params.id), req.body);
    if (!card) return res.status(404).json({ message: "Rate card not found" });
    res.json(card);
  });

  app.delete("/api/resources/rate-cards/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteRateCard(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/resources/rate-cards/:id/items", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const item = await storage.createRateCardItem({ ...req.body, rateCardId: Number(req.params.id) });
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ message: "Failed to create rate card item" });
    }
  });

  app.delete("/api/resources/rate-card-items/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteRateCardItem(Number(req.params.id));
    res.status(204).send();
  });

  // Resources (People)
  app.get("/api/resources", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const resourcesList = await storage.getResources(tenantId);
    res.json(resourcesList);
  });

  app.get("/api/resources/stats", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const { getExtendedResourceStats } = await import("./resources/service");
    res.json(await getExtendedResourceStats(tenantId));
  });

  // Skill Categories (must be before /api/resources/:id)
  app.get("/api/resources/skill-categories", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const categories = await storage.getSkillCategories(tenantId);
    res.json(categories);
  });

  app.post("/api/resources/skill-categories", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertSkillCategorySchema.parse({ ...req.body, tenantId });
      const category = await storage.createSkillCategory(validated);
      res.status(201).json(category);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Failed to create skill category" });
    }
  });

  app.put("/api/resources/skill-categories/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const validated = insertSkillCategorySchema.partial().parse(req.body);
      const category = await storage.updateSkillCategory(Number(req.params.id), validated);
      if (!category) return res.status(404).json({ message: "Skill category not found" });
      res.json(category);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Invalid data" });
    }
  });

  app.delete("/api/resources/skill-categories/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteSkillCategory(Number(req.params.id));
    res.status(204).send();
  });

  // Skills (must be before /api/resources/:id)
  app.get("/api/resources/skills", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const skillsList = await storage.getSkills(tenantId);
    res.json(skillsList);
  });

  app.post("/api/resources/skills", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertSkillSchema.parse({ ...req.body, tenantId });
      const skill = await storage.createSkill(validated);
      res.status(201).json(skill);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Failed to create skill" });
    }
  });

  app.put("/api/resources/skills/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const validated = insertSkillSchema.partial().parse(req.body);
      const skill = await storage.updateSkill(Number(req.params.id), validated);
      if (!skill) return res.status(404).json({ message: "Skill not found" });
      res.json(skill);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Invalid data" });
    }
  });

  app.delete("/api/resources/skills/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteSkill(Number(req.params.id));
    res.status(204).send();
  });

  // Allocations (must be before /api/resources/:id)
  app.get("/api/resources/allocations", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const allocationsList = await storage.getAllocations(tenantId, projectId);
    res.json(allocationsList);
  });

  app.get("/api/resources/allocations/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const allocation = await storage.getAllocation(Number(req.params.id));
    if (!allocation) return res.status(404).json({ message: "Allocation not found" });
    res.json(allocation);
  });

  app.post("/api/resources/allocations", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const body = { ...req.body, tenantId };
      Object.keys(body).forEach(k => { if (body[k] === "") body[k] = undefined; });
      const validated = insertResourceAllocationSchema.parse(body);
      const allocation = await storage.createAllocation(validated);
      res.status(201).json(allocation);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Failed to create allocation" });
    }
  });

  app.put("/api/resources/allocations/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const validated = insertResourceAllocationSchema.partial().parse(req.body);
      const allocation = await storage.updateAllocation(Number(req.params.id), validated);
      if (!allocation) return res.status(404).json({ message: "Allocation not found" });
      res.json(allocation);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Invalid data" });
    }
  });

  app.delete("/api/resources/allocations/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteAllocation(Number(req.params.id));
    res.status(204).send();
  });

  // Timesheet Periods (must be before /api/resources/:id)
  app.get("/api/resources/timesheets", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const resourceId = req.query.resourceId ? Number(req.query.resourceId) : undefined;
    const periods = await storage.getTimesheetPeriods(tenantId, resourceId);
    res.json(periods);
  });

  app.get("/api/resources/timesheets/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const period = await storage.getTimesheetPeriod(Number(req.params.id));
    if (!period) return res.status(404).json({ message: "Timesheet period not found" });
    res.json(period);
  });

  app.post("/api/resources/timesheets", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const body = { ...req.body, tenantId };
      Object.keys(body).forEach(k => { if (body[k] === "") body[k] = undefined; });
      const validated = insertTimesheetPeriodSchema.parse(body);
      const period = await storage.createTimesheetPeriod(validated);
      res.status(201).json(period);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Failed to create timesheet period" });
    }
  });

  app.put("/api/resources/timesheets/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const validated = insertTimesheetPeriodSchema.partial().parse(req.body);
      const period = await storage.updateTimesheetPeriod(Number(req.params.id), validated);
      if (!period) return res.status(404).json({ message: "Timesheet period not found" });
      res.json(period);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Invalid data" });
    }
  });

  // Timesheet Entries (must be before /api/resources/:id)
  app.get("/api/resources/timesheets/:periodId/entries", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const entries = await storage.getTimesheetEntries(Number(req.params.periodId));
    res.json(entries);
  });

  app.post("/api/resources/timesheets/:periodId/entries", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const body = { ...req.body, timesheetPeriodId: Number(req.params.periodId) };
      Object.keys(body).forEach(k => { if (body[k] === "") body[k] = undefined; });
      const validated = insertTimesheetEntrySchema.parse(body);
      const entry = await storage.createTimesheetEntry(validated);
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Failed to create timesheet entry" });
    }
  });

  app.put("/api/resources/timesheets/:periodId/entries/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const validated = insertTimesheetEntrySchema.partial().parse(req.body);
      const entry = await storage.updateTimesheetEntry(Number(req.params.id), validated);
      if (!entry) return res.status(404).json({ message: "Timesheet entry not found" });
      res.json(entry);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Invalid data" });
    }
  });

  app.delete("/api/resources/timesheets/:periodId/entries/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteTimesheetEntry(Number(req.params.id));
    res.status(204).send();
  });

  // Project Codes (must be before /api/resources/:id)
  app.get("/api/resources/project-codes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const codes = await storage.getProjectCodes(tenantId);
    res.json(codes);
  });

  app.post("/api/resources/project-codes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const validated = insertProjectCodeSchema.parse({ ...req.body, tenantId });
      const code = await storage.createProjectCode(validated);
      res.status(201).json(code);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Failed to create project code" });
    }
  });

  app.put("/api/resources/project-codes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const validated = insertProjectCodeSchema.partial().parse(req.body);
      const code = await storage.updateProjectCode(Number(req.params.id), validated);
      if (!code) return res.status(404).json({ message: "Project code not found" });
      res.json(code);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Invalid data" });
    }
  });

  app.delete("/api/resources/project-codes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteProjectCode(Number(req.params.id));
    res.status(204).send();
  });

  // Resource by ID (must be after all /api/resources/* routes)
  app.get("/api/resources/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const resource = await storage.getResource(Number(req.params.id));
    if (!resource) return res.status(404).json({ message: "Resource not found" });
    res.json(resource);
  });

  app.post("/api/resources", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const body = { ...req.body, tenantId };
      Object.keys(body).forEach(k => { if (body[k] === "") body[k] = undefined; });
      const validated = insertResourceSchema.parse(body);
      const resource = await storage.createResource(validated);
      res.status(201).json(resource);
    } catch (err: any) {
      console.error("Resource create error:", err);
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Failed to create resource" });
    }
  });

  app.put("/api/resources/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const body = { ...req.body };
      Object.keys(body).forEach(k => { if (body[k] === "") body[k] = undefined; });
      const validated = insertResourceSchema.partial().parse(body);
      const resource = await storage.updateResource(Number(req.params.id), validated);
      if (!resource) return res.status(404).json({ message: "Resource not found" });
      res.json(resource);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Invalid data" });
    }
  });

  app.delete("/api/resources/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteResource(Number(req.params.id));
    res.status(204).send();
  });

  // Resource Skills
  app.get("/api/resources/:resourceId/skills", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const resourceSkillsList = await storage.getResourceSkills(Number(req.params.resourceId));
    res.json(resourceSkillsList);
  });

  app.post("/api/resources/:resourceId/skills", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const validated = insertResourceSkillSchema.parse({ ...req.body, resourceId: Number(req.params.resourceId) });
      const resourceSkill = await storage.addResourceSkill(validated);
      res.status(201).json(resourceSkill);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Failed to add resource skill" });
    }
  });

  app.put("/api/resources/:resourceId/skills/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const validated = insertResourceSkillSchema.partial().parse(req.body);
      const resourceSkill = await storage.updateResourceSkill(Number(req.params.id), validated);
      if (!resourceSkill) return res.status(404).json({ message: "Resource skill not found" });
      res.json(resourceSkill);
    } catch (err: any) {
      res.status(400).json({ message: err.issues ? err.issues[0].message : "Invalid data" });
    }
  });

  app.delete("/api/resources/:resourceId/skills/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.removeResourceSkill(Number(req.params.id));
    res.status(204).send();
  });

  // ========================
  // BPM Module Routes
  // ========================

  // BPM Diagrams
  app.get("/api/bpm/diagrams", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const diagrams = await storage.getBpmDiagrams(tenantId);
    res.json(diagrams);
  });

  app.get("/api/bpm/diagrams/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const diagram = await storage.getBpmDiagram(Number(req.params.id));
    if (!diagram) return res.status(404).json({ message: "Diagram not found" });
    res.json(diagram);
  });

  app.post("/api/bpm/diagrams", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertBpmDiagramSchema.parse({ ...req.body, ownerId: userId });
      const diagram = await storage.createBpmDiagram(data);
      res.status(201).json(diagram);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/bpm/diagrams/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const diagram = await storage.updateBpmDiagram(Number(req.params.id), req.body);
      if (!diagram) return res.status(404).json({ message: "Diagram not found" });
      res.json(diagram);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/bpm/diagrams/:id/duplicate", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const source = await storage.getBpmDiagram(Number(req.params.id));
      if (!source) return res.status(404).json({ message: "Diagram not found" });
      const newName = req.body.name?.trim() || `${source.name} (Copy)`;
      const newDiagram = await storage.createBpmDiagram({
        tenantId: source.tenantId,
        name: newName,
        description: source.description,
        type: source.type,
        status: "draft",
        version: 1,
        canvasData: source.canvasData,
        metadata: source.metadata,
        libraryId: source.libraryId,
        ownerId: userId,
      });
      const sourceNodes = await storage.getBpmNodes(source.id);
      const sourceEdges = await storage.getBpmEdges(source.id);
      for (const node of sourceNodes) {
        await storage.createBpmNode({
          diagramId: newDiagram.id,
          nodeId: node.nodeId,
          type: node.type,
          label: node.label,
          positionX: node.positionX,
          positionY: node.positionY,
          width: node.width,
          height: node.height,
          data: node.data,
          parentNodeId: node.parentNodeId,
        });
      }
      for (const edge of sourceEdges) {
        await storage.createBpmEdge({
          diagramId: newDiagram.id,
          edgeId: edge.edgeId,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          type: edge.type,
          label: edge.label,
          data: edge.data,
        });
      }
      const sourceSwimlanes = await storage.getBpmSwimlanes(source.id);
      for (const sl of sourceSwimlanes) {
        await storage.createBpmSwimlane({
          diagramId: newDiagram.id,
          label: sl.label,
          orientation: sl.orientation,
          order: sl.order,
          color: sl.color,
          width: sl.width,
          height: sl.height,
        });
      }
      res.status(201).json(newDiagram);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/bpm/diagrams/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteBpmDiagram(Number(req.params.id));
    res.status(204).send();
  });

  // BPM Nodes
  app.get("/api/bpm/diagrams/:diagramId/nodes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const nodes = await storage.getBpmNodes(Number(req.params.diagramId));
    res.json(nodes);
  });

  app.post("/api/bpm/diagrams/:diagramId/nodes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertBpmNodeSchema.parse({ ...req.body, diagramId: Number(req.params.diagramId) });
      const node = await storage.createBpmNode(data);
      res.status(201).json(node);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/bpm/nodes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const node = await storage.updateBpmNode(Number(req.params.id), req.body);
      if (!node) return res.status(404).json({ message: "Node not found" });
      res.json(node);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/bpm/nodes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteBpmNode(Number(req.params.id));
    res.status(204).send();
  });

  // BPM Edges
  app.get("/api/bpm/diagrams/:diagramId/edges", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const edges = await storage.getBpmEdges(Number(req.params.diagramId));
    res.json(edges);
  });

  app.post("/api/bpm/diagrams/:diagramId/edges", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertBpmEdgeSchema.parse({ ...req.body, diagramId: Number(req.params.diagramId) });
      const edge = await storage.createBpmEdge(data);
      res.status(201).json(edge);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/bpm/edges/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteBpmEdge(Number(req.params.id));
    res.status(204).send();
  });

  // BPM Swimlanes
  app.get("/api/bpm/diagrams/:diagramId/swimlanes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const swimlanes = await storage.getBpmSwimlanes(Number(req.params.diagramId));
    res.json(swimlanes);
  });

  app.post("/api/bpm/diagrams/:diagramId/swimlanes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertBpmSwimlaneSchema.parse({ ...req.body, diagramId: Number(req.params.diagramId) });
      const swimlane = await storage.createBpmSwimlane(data);
      res.status(201).json(swimlane);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/bpm/swimlanes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const swimlane = await storage.updateBpmSwimlane(Number(req.params.id), req.body);
      if (!swimlane) return res.status(404).json({ message: "Swimlane not found" });
      res.json(swimlane);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/bpm/swimlanes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteBpmSwimlane(Number(req.params.id));
    res.status(204).send();
  });

  // BPM Libraries
  app.get("/api/bpm/libraries", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const libraries = await storage.getBpmLibraries(tenantId);
    res.json(libraries);
  });

  app.get("/api/bpm/libraries/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const library = await storage.getBpmLibrary(Number(req.params.id));
    if (!library) return res.status(404).json({ message: "Library not found" });
    res.json(library);
  });

  app.post("/api/bpm/libraries", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertBpmLibrarySchema.parse(req.body);
      const library = await storage.createBpmLibrary(data);
      res.status(201).json(library);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/bpm/libraries/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const library = await storage.updateBpmLibrary(Number(req.params.id), req.body);
      if (!library) return res.status(404).json({ message: "Library not found" });
      res.json(library);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/bpm/libraries/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await storage.deleteBpmLibrary(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // BPM Templates
  app.get("/api/bpm/templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const templates = await storage.getBpmTemplates();
    res.json(templates);
  });

  app.get("/api/bpm/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const template = await storage.getBpmTemplate(Number(req.params.id));
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.post("/api/bpm/templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertBpmTemplateSchema.parse(req.body);
      const template = await storage.createBpmTemplate(data);
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/bpm/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const template = await storage.getBpmTemplate(Number(req.params.id));
      if (!template) return res.status(404).json({ message: "Template not found" });
      if (template.isSystem) return res.status(403).json({ message: "Cannot delete system templates" });
      await db.delete(bpmTemplates).where(eq(bpmTemplates.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // BPM Attachments
  app.get("/api/bpm/diagrams/:diagramId/attachments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const nodeId = req.query.nodeId ? Number(req.query.nodeId) : undefined;
    const attachments = await storage.getBpmAttachments(Number(req.params.diagramId), nodeId);
    res.json(attachments);
  });

  app.post("/api/bpm/diagrams/:diagramId/attachments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertBpmAttachmentSchema.parse({ ...req.body, diagramId: Number(req.params.diagramId) });
      const attachment = await storage.createBpmAttachment(data);
      res.status(201).json(attachment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/bpm/attachments/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteBpmAttachment(Number(req.params.id));
    res.status(204).send();
  });

  // BPM Save Canvas (bulk save - nodes, edges, swimlanes in one call)
  app.put("/api/bpm/diagrams/:id/canvas", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const diagramId = Number(req.params.id);
      const { canvasData, nodes, edges, swimlanes } = req.body;

      // Update diagram canvas data
      await storage.updateBpmDiagram(diagramId, { canvasData });

      // Clear existing and re-insert nodes and edges
      await storage.deleteBpmNodesByDiagram(diagramId);
      await storage.deleteBpmEdgesByDiagram(diagramId);

      if (nodes && Array.isArray(nodes)) {
        for (const node of nodes) {
          await storage.createBpmNode({ ...node, diagramId });
        }
      }

      if (edges && Array.isArray(edges)) {
        for (const edge of edges) {
          await storage.createBpmEdge({ ...edge, diagramId });
        }
      }

      const diagram = await storage.getBpmDiagram(diagramId);
      res.json(diagram);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Portal Menu Nodes
  app.get("/api/portal/menu-nodes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const nodes = await storage.getPortalMenuNodes(tenantId);
    res.json(nodes);
  });

  app.post("/api/portal/menu-nodes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const node = await storage.createPortalMenuNode(req.body);
      res.status(201).json(node);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/portal/menu-nodes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const node = await storage.updatePortalMenuNode(Number(req.params.id), req.body);
      if (!node) return res.status(404).json({ message: "Menu node not found" });
      res.json(node);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/portal/menu-nodes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePortalMenuNode(Number(req.params.id));
    res.status(204).send();
  });

  // Portal Diagram Assignments
  app.get("/api/portal/assignments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const menuNodeId = req.query.menuNodeId ? Number(req.query.menuNodeId) : undefined;
    if (menuNodeId) {
      const assignments = await storage.getPortalDiagramAssignments(menuNodeId);
      res.json(assignments);
    } else {
      const assignments = await storage.getAllPortalDiagramAssignments(tenantId);
      res.json(assignments);
    }
  });

  app.post("/api/portal/assignments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const assignment = await storage.createPortalDiagramAssignment(req.body);
      res.status(201).json(assignment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/portal/assignments/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePortalDiagramAssignment(Number(req.params.id));
    res.status(204).send();
  });

  // BPM Diagram Publish Toggle
  app.patch("/api/bpm/diagrams/:id/publish", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { published } = req.body;
      const diagram = await storage.updateBpmDiagram(Number(req.params.id), { published: !!published });
      if (!diagram) return res.status(404).json({ message: "Diagram not found" });
      res.json(diagram);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Process Resources
  app.get("/api/process-resources", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const entryId = req.query.entryId ? Number(req.query.entryId) : undefined;
    const menuNodeId = req.query.menuNodeId ? Number(req.query.menuNodeId) : undefined;
    if (entryId) {
      const resources = await storage.getProcessResourcesByEntry(entryId);
      res.json(resources);
    } else if (menuNodeId) {
      const resources = await storage.getProcessResourcesByMenuNode(menuNodeId);
      res.json(resources);
    } else {
      const resources = await storage.getProcessResources(tenantId);
      res.json(resources);
    }
  });

  app.post("/api/process-resources", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const resource = await storage.createProcessResource(req.body);
      res.status(201).json(resource);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/process-resources/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const resource = await storage.updateProcessResource(Number(req.params.id), req.body);
      if (!resource) return res.status(404).json({ message: "Resource not found" });
      res.json(resource);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/process-resources/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteProcessResource(Number(req.params.id));
    res.status(204).send();
  });

  // Portal Menu Nodes Bulk Seed
  app.post("/api/portal/menu-nodes/seed", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { nodes, tenantId } = req.body;
      const created: any[] = [];
      const idMap: Record<string, number> = {};
      for (const node of nodes) {
        const parentId = node.parentKey ? idMap[node.parentKey] : null;
        const result = await storage.createPortalMenuNode({
          tenantId: getApiTenantIdWithFallback(req),
          name: node.name,
          parentId,
          sortOrder: node.sortOrder || 0,
          icon: node.icon || null,
          description: node.description || null,
        });
        idMap[node.key] = result.id;
        created.push(result);
      }
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Frameworks
  app.get("/api/frameworks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const fws = await storage.getFrameworks(tenantId);
    res.json(fws);
  });

  app.get("/api/frameworks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const fw = await storage.getFramework(Number(req.params.id));
    if (!fw) return res.status(404).json({ message: "Framework not found" });
    res.json(fw);
  });

  app.post("/api/frameworks/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { rows, mode = "append" } = req.body;
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await storage.bulkImportFrameworks(tenantId, rows, mode);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/frameworks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const fw = await storage.createFramework(req.body);
      res.status(201).json(fw);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/frameworks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const fw = await storage.updateFramework(Number(req.params.id), req.body);
      if (!fw) return res.status(404).json({ message: "Framework not found" });
      res.json(fw);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/frameworks/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await storage.deleteFramework(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== BPML Routes ====================

  app.get("/api/bpml/templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const templates = await storage.getBpmlTemplates(tenantId);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/bpml/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const template = await storage.getBpmlTemplate(Number(req.params.id));
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/bpml/templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const template = await storage.createBpmlTemplate(req.body);
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/bpml/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const template = await storage.updateBpmlTemplate(Number(req.params.id), req.body);
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/bpml/templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await storage.deleteBpmlTemplate(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/bpml/entries", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const templateId = Number(req.query.templateId);
      const tenantId = getApiTenantIdWithFallback(req);
      if (!templateId) return res.status(400).json({ message: "templateId required" });
      const entries = await storage.getBpmlEntries(templateId, tenantId);
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/bpml/entries/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const entry = await storage.getBpmlEntry(Number(req.params.id));
      if (!entry) return res.status(404).json({ message: "Entry not found" });
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/bpml/entries", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const entry = await storage.createBpmlEntry(req.body);
      res.status(201).json(entry);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/bpml/entries/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { rows, mode = "append", templateId } = req.body;
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await storage.bulkImportBpmlEntries(Number(templateId), tenantId, rows, mode);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/bpml/entries/bulk", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const entries = await storage.createBpmlEntries(req.body.entries || []);
      res.status(201).json(entries);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/bpml/entries/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const entry = await storage.updateBpmlEntry(Number(req.params.id), req.body);
      if (!entry) return res.status(404).json({ message: "Entry not found" });
      res.json(entry);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/bpml/entries/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await storage.deleteBpmlEntry(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/bpml/entries/bulk-delete", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await storage.deleteBpmlEntries(req.body.ids || []);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== Org Chart Template Routes ====================

  app.get("/api/org-chart-templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const templates = await storage.getOrgChartTemplates(tenantId);
    res.json(templates);
  });

  app.get("/api/org-chart-templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const template = await storage.getOrgChartTemplate(Number(req.params.id));
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.post("/api/org-chart-templates", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertOrgChartTemplateSchema.parse(req.body);
      const template = await storage.createOrgChartTemplate(data);
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/org-chart-templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertOrgChartTemplateSchema.partial().parse(req.body);
      const template = await storage.updateOrgChartTemplate(Number(req.params.id), data);
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/org-chart-templates/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteOrgChartTemplate(Number(req.params.id));
    res.status(204).send();
  });

  // ==================== Org Chart Routes ====================

  app.get("/api/org-charts", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const charts = await storage.getOrgCharts(tenantId);
    res.json(charts);
  });

  app.get("/api/org-charts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const chart = await storage.getOrgChart(Number(req.params.id));
    if (!chart) return res.status(404).json({ message: "Org chart not found" });
    res.json(chart);
  });

  app.post("/api/org-charts", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertOrgChartSchema.parse(req.body);
      const chart = await storage.createOrgChart(data);
      res.status(201).json(chart);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/org-charts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertOrgChartSchema.partial().parse(req.body);
      const chart = await storage.updateOrgChart(Number(req.params.id), data);
      if (!chart) return res.status(404).json({ message: "Org chart not found" });
      res.json(chart);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/org-charts/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await storage.deleteOrgChart(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/org-charts/:id/duplicate", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ message: "Name is required" });
      const sourceChart = await storage.getOrgChart(Number(req.params.id));
      if (!sourceChart) return res.status(404).json({ message: "Source org chart not found" });
      const newChart = await storage.createOrgChart({
        tenantId: sourceChart.tenantId,
        name: name.trim(),
        description: sourceChart.description,
        chartType: sourceChart.chartType,
        showPhotos: sourceChart.showPhotos,
        templateId: sourceChart.templateId,
        chartTitle: sourceChart.chartTitle,
        metadata: sourceChart.metadata,
      });
      const sourceMembers = await storage.getOrgChartMembers(sourceChart.id);
      const oldToNewId = new Map<number, number>();
      const membersWithoutParent = sourceMembers.filter(m => !m.parentMemberId);
      const membersWithParent = sourceMembers.filter(m => m.parentMemberId);
      for (const m of membersWithoutParent) {
        const newMember = await storage.createOrgChartMember({
          chartId: newChart.id,
          name: m.name,
          title: m.title,
          department: m.department,
          email: m.email,
          phone: m.phone,
          photoUrl: m.photoUrl,
          positionX: m.positionX,
          positionY: m.positionY,
          parentMemberId: null,
          layoutDirection: m.layoutDirection,
        });
        oldToNewId.set(m.id, newMember.id);
      }
      const queue = [...membersWithParent];
      let maxIterations = queue.length * 2;
      while (queue.length > 0 && maxIterations-- > 0) {
        const m = queue.shift()!;
        const newParentId = oldToNewId.get(m.parentMemberId!);
        if (newParentId === undefined) {
          queue.push(m);
          continue;
        }
        const newMember = await storage.createOrgChartMember({
          chartId: newChart.id,
          name: m.name,
          title: m.title,
          department: m.department,
          email: m.email,
          phone: m.phone,
          photoUrl: m.photoUrl,
          positionX: m.positionX,
          positionY: m.positionY,
          parentMemberId: newParentId,
          layoutDirection: m.layoutDirection,
        });
        oldToNewId.set(m.id, newMember.id);
      }
      res.status(201).json(newChart);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Org Chart Members
  app.get("/api/org-charts/:chartId/members", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const members = await storage.getOrgChartMembers(Number(req.params.chartId));
    res.json(members);
  });

  app.post("/api/org-charts/:chartId/members", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertOrgChartMemberSchema.parse({
        ...req.body,
        chartId: Number(req.params.chartId),
      });
      const member = await storage.createOrgChartMember(data);
      res.status(201).json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/org-charts/members/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertOrgChartMemberSchema.partial().parse(req.body);
      const member = await storage.updateOrgChartMember(Number(req.params.id), data);
      if (!member) return res.status(404).json({ message: "Member not found" });
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/org-charts/members/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await storage.deleteOrgChartMember(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/org-charts/:chartId/members/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { rows, mode = "append" } = req.body;
      const chartId = Number(req.params.chartId);
      const result = await storage.bulkImportOrgChartMembers(chartId, rows, mode);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/resources/bulk-import", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { rows, mode = "append" } = req.body;
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await storage.bulkImportResources(tenantId, rows, mode);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // === WORKSPACE ROUTES ===

  // Workspaces CRUD
  app.get("/api/workspaces", async (req, res) => {
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const results = await storage.getWorkspaces(tenantId);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/workspaces/:id", async (req, res) => {
    try {
      const result = await storage.getWorkspace(Number(req.params.id));
      if (!result) return res.status(404).json({ message: "Workspace not found" });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspaces", async (req, res) => {
    try {
      const result = await storage.createWorkspace(req.body);
      const userId = req.body.createdBy || req.user?.claims?.sub;
      if (userId) {
        try {
          await storage.addWorkspaceMember({
            workspaceId: result.id,
            userId,
            role: "owner",
          });
        } catch (e) {
        }
      }
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/workspaces/:id", async (req, res) => {
    try {
      const result = await storage.updateWorkspace(Number(req.params.id), req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/workspaces/:id", async (req, res) => {
    try {
      await storage.deleteWorkspace(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Workspace Members
  app.get("/api/workspaces/:id/members", async (req, res) => {
    try {
      const members = await storage.getWorkspaceMembers(Number(req.params.id));
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspaces/:id/members", async (req, res) => {
    try {
      const member = await storage.addWorkspaceMember({
        workspaceId: Number(req.params.id),
        userId: req.body.userId,
        role: req.body.role || "member",
      });
      res.status(201).json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/workspace-members/:id", async (req, res) => {
    try {
      await storage.removeWorkspaceMember(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/workspaces/:id/favorite", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const workspace = await storage.getWorkspace(id);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });
      const updated = await storage.updateWorkspace(id, { isFavorite: !workspace.isFavorite });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Workspace Pages CRUD
  app.get("/api/workspaces/:workspaceId/pages", async (req, res) => {
    try {
      const results = await storage.getWorkspacePages(Number(req.params.workspaceId));
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/workspace-pages/favorites", async (req, res) => {
    try {
      const results = await storage.getAllFavoritePages();
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspace-pages/reorder", async (req, res) => {
    try {
      const { updates } = req.body;
      await storage.reorderWorkspacePages(updates);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/workspace-pages/:id", async (req, res) => {
    try {
      const result = await storage.getWorkspacePage(Number(req.params.id));
      if (!result) return res.status(404).json({ message: "Page not found" });
      let createdByName: string | null = null;
      let updatedByName: string | null = null;
      if (result.createdBy) {
        const [creator] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable).where(eq(usersTable.id, result.createdBy));
        if (creator) createdByName = [creator.firstName, creator.lastName].filter(Boolean).join(" ") || null;
      }
      if ((result as any).updatedBy) {
        const [updater] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable).where(eq(usersTable.id, (result as any).updatedBy));
        if (updater) updatedByName = [updater.firstName, updater.lastName].filter(Boolean).join(" ") || null;
      }
      res.json({ ...result, createdByName, updatedByName });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspaces/:workspaceId/pages", async (req, res) => {
    try {
      const result = await storage.createWorkspacePage({
        ...req.body,
        workspaceId: Number(req.params.workspaceId),
      });

      if (req.body.pageType === "database" && !req.body.skipDefaultTemplate) {
        const db = await storage.createWorkspaceDatabase({
          pageId: result.id,
          name: req.body.title || "Board",
        });
        const defaultColumns = [
          { databaseId: db.id, name: "Task", type: "text", sortOrder: 0, options: {} },
          { databaseId: db.id, name: "Owner", type: "text", sortOrder: 1, options: {} },
          { databaseId: db.id, name: "Status", type: "select", sortOrder: 2, options: { choices: ["Not Started", "In Progress", "Delayed", "Done"] } },
          { databaseId: db.id, name: "Priority", type: "select", sortOrder: 3, options: { choices: ["Low", "Medium", "High", "Critical"] } },
          { databaseId: db.id, name: "Due Date", type: "date", sortOrder: 4, options: {} },
          { databaseId: db.id, name: "Commentary", type: "text", sortOrder: 5, options: {} },
        ];
        const createdCols: any[] = [];
        for (const col of defaultColumns) {
          const c = await storage.createWorkspaceDatabaseColumn(col);
          createdCols.push(c);
        }
        const taskCol = createdCols.find(c => c.name === "Task");
        const statusCol = createdCols.find(c => c.name === "Status");
        const priorityCol = createdCols.find(c => c.name === "Priority");
        if (taskCol && statusCol && priorityCol) {
          await storage.createWorkspaceDatabaseRow({
            databaseId: db.id,
            data: { [taskCol.id]: "Sample task 1", [statusCol.id]: "Not Started", [priorityCol.id]: "Medium" },
          });
          await storage.createWorkspaceDatabaseRow({
            databaseId: db.id,
            data: { [taskCol.id]: "Sample task 2", [statusCol.id]: "In Progress", [priorityCol.id]: "High" },
          });
        }
      }

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/workspace-pages/:id", async (req, res) => {
    try {
      const userId = req.user?.claims?.sub as string | undefined;
      const updates = { ...req.body };
      if (userId) {
        updates.updatedBy = userId;
      }
      const result = await storage.updateWorkspacePage(Number(req.params.id), updates);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/workspace-pages/:id", async (req, res) => {
    try {
      await storage.deleteWorkspacePage(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Workspace Databases CRUD
  app.get("/api/workspace-pages/:pageId/databases", async (req, res) => {
    try {
      const results = await storage.getWorkspaceDatabases(Number(req.params.pageId));
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspace-pages/:pageId/databases", async (req, res) => {
    try {
      const result = await storage.createWorkspaceDatabase({
        ...req.body,
        pageId: Number(req.params.pageId),
      });

      const defaultColumns = [
        { name: "Task", type: "text", options: null, sortOrder: 0, width: null },
        { name: "Owner", type: "text", options: null, sortOrder: 1, width: null },
        { name: "Status", type: "select", options: ["Not Started", "In Progress", "Delayed", "Done"], sortOrder: 2, width: null },
        { name: "Priority", type: "select", options: ["Low", "Medium", "High", "Critical"], sortOrder: 3, width: null },
        { name: "Due Date", type: "date", options: null, sortOrder: 4, width: null },
        { name: "Commentary", type: "text", options: null, sortOrder: 5, width: null },
      ];

      const columnIdMap: Record<string, number> = {};
      for (const col of defaultColumns) {
        const created = await storage.createWorkspaceDatabaseColumn({
          databaseId: result.id,
          name: col.name,
          type: col.type,
          options: col.options,
          sortOrder: col.sortOrder,
          width: col.width,
        });
        columnIdMap[col.name] = created.id;
      }

      const sampleRows = [
        { Task: "Sample task 1", Owner: "", Status: "Not Started", Priority: "Medium", "Due Date": "", Commentary: "" },
        { Task: "Sample task 2", Owner: "", Status: "In Progress", Priority: "High", "Due Date": "", Commentary: "" },
      ];

      for (let i = 0; i < sampleRows.length; i++) {
        const rowData: Record<string, any> = {};
        for (const [colName, value] of Object.entries(sampleRows[i])) {
          if (columnIdMap[colName] !== undefined) {
            rowData[String(columnIdMap[colName])] = value;
          }
        }
        await storage.createWorkspaceDatabaseRow({
          databaseId: result.id,
          data: rowData,
          sortOrder: i,
        });
      }

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspace-pages/:pageId/databases/from-template", async (req, res) => {
    try {
      const pageId = Number(req.params.pageId);
      if (isNaN(pageId)) return res.status(400).json({ error: "Invalid page ID" });
      const { name, columns, rows } = req.body;
      if (!columns || !Array.isArray(columns) || columns.length === 0) {
        return res.status(400).json({ error: "Template must include at least one column" });
      }
      const validColumnTypes = ["text", "number", "select", "multi_select", "date", "checkbox", "person", "url", "rag"];
      for (const col of columns) {
        if (!col.name || typeof col.name !== "string") {
          return res.status(400).json({ error: "Each column must have a name" });
        }
        if (col.type && !validColumnTypes.includes(col.type)) {
          return res.status(400).json({ error: `Invalid column type: ${col.type}` });
        }
      }

      const database = await storage.createWorkspaceDatabase({ name: name || "Untitled Board", pageId });

      const columnIdMap: Record<string, number> = {};
      if (columns && Array.isArray(columns)) {
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          const created = await storage.createWorkspaceDatabaseColumn({
            databaseId: database.id,
            name: col.name,
            type: col.type || "text",
            options: col.options || null,
            sortOrder: i,
            width: col.width || null,
          });
          columnIdMap[col.name] = created.id;
        }
      }

      if (rows && Array.isArray(rows)) {
        for (let i = 0; i < rows.length; i++) {
          const rowData: Record<string, any> = {};
          for (const [colName, value] of Object.entries(rows[i])) {
            if (columnIdMap[colName] !== undefined) {
              rowData[String(columnIdMap[colName])] = value;
            }
          }
          await storage.createWorkspaceDatabaseRow({
            databaseId: database.id,
            data: rowData,
            sortOrder: i,
          });
        }
      }

      res.json(database);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspace-databases/:id/apply-template", async (req, res) => {
    try {
      const dbId = Number(req.params.id);
      if (isNaN(dbId)) return res.status(400).json({ error: "Invalid database ID" });
      const { name, columns, rows } = req.body;
      if (!columns || !Array.isArray(columns) || columns.length === 0) {
        return res.status(400).json({ error: "Template must include at least one column" });
      }
      const validColumnTypes = ["text", "number", "select", "multi_select", "date", "checkbox", "person", "url", "rag"];
      for (const col of columns) {
        if (!col.name || typeof col.name !== "string") {
          return res.status(400).json({ error: "Each column must have a name" });
        }
        if (col.type && !validColumnTypes.includes(col.type)) {
          return res.status(400).json({ error: `Invalid column type: ${col.type}` });
        }
      }

      if (name) {
        await storage.updateWorkspaceDatabase(dbId, { name });
      }

      const columnIdMap: Record<string, number> = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const created = await storage.createWorkspaceDatabaseColumn({
          databaseId: dbId,
          name: col.name,
          type: col.type || "text",
          options: col.options || null,
          sortOrder: i,
          width: col.width || null,
        });
        columnIdMap[col.name] = created.id;
      }

      if (rows && Array.isArray(rows)) {
        for (let i = 0; i < rows.length; i++) {
          const rowData: Record<string, any> = {};
          for (const [colName, value] of Object.entries(rows[i])) {
            if (columnIdMap[colName] !== undefined) {
              rowData[String(columnIdMap[colName])] = value;
            }
          }
          await storage.createWorkspaceDatabaseRow({
            databaseId: dbId,
            data: rowData,
            sortOrder: i,
          });
        }
      }

      const updated = await storage.getWorkspaceDatabase(dbId);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/workspace-databases/:id", async (req, res) => {
    try {
      const result = await storage.updateWorkspaceDatabase(Number(req.params.id), req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/workspace-databases/:id", async (req, res) => {
    try {
      await storage.deleteWorkspaceDatabase(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Workspace Database Columns
  app.get("/api/workspace-databases/:databaseId/columns", async (req, res) => {
    try {
      const results = await storage.getWorkspaceDatabaseColumns(Number(req.params.databaseId));
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspace-databases/:databaseId/columns", async (req, res) => {
    try {
      const result = await storage.createWorkspaceDatabaseColumn({
        ...req.body,
        databaseId: Number(req.params.databaseId),
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/workspace-database-columns/:id", async (req, res) => {
    try {
      const result = await storage.updateWorkspaceDatabaseColumn(Number(req.params.id), req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/workspace-database-columns/:id", async (req, res) => {
    try {
      await storage.deleteWorkspaceDatabaseColumn(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Workspace Database Rows
  app.get("/api/workspace-databases/:databaseId/rows", async (req, res) => {
    try {
      const results = await storage.getWorkspaceDatabaseRows(Number(req.params.databaseId));
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspace-databases/:databaseId/rows", async (req, res) => {
    try {
      const result = await storage.createWorkspaceDatabaseRow({
        ...req.body,
        databaseId: Number(req.params.databaseId),
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/workspace-database-rows/:id", async (req, res) => {
    try {
      const result = await storage.updateWorkspaceDatabaseRow(Number(req.params.id), req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspace-database-rows/reorder", async (req, res) => {
    try {
      const { updates } = req.body as { updates: { id: number; sortOrder: number }[] };
      if (!Array.isArray(updates)) {
        return res.status(400).json({ message: "updates array required" });
      }
      for (const u of updates) {
        await storage.updateWorkspaceDatabaseRow(u.id, { sortOrder: u.sortOrder });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/workspace-database-rows/:id", async (req, res) => {
    try {
      await storage.deleteWorkspaceDatabaseRow(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Workspace Saved Views
  app.get("/api/workspace-databases/:databaseId/views", async (req, res) => {
    try {
      const results = await storage.getWorkspaceSavedViews(Number(req.params.databaseId));
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspace-databases/:databaseId/views", async (req, res) => {
    try {
      const result = await storage.createWorkspaceSavedView({
        ...req.body,
        databaseId: Number(req.params.databaseId),
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/workspace-saved-views/:id", async (req, res) => {
    try {
      const result = await storage.updateWorkspaceSavedView(Number(req.params.id), req.body);
      if (!result) return res.status(404).json({ message: "Saved view not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/workspace-saved-views/:id", async (req, res) => {
    try {
      await storage.deleteWorkspaceSavedView(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // === TEST MANAGEMENT ROUTES ===

  // Test Suites
  // TM Projects
  app.get("/api/tm/projects", async (req, res) => {
    try { res.json(await storage.getTmProjects(1)); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/tm/projects", async (req, res) => {
    try { res.json(await storage.createTmProject({ ...req.body, tenantId: 1 })); }
    catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/tm/projects/:id", async (req, res) => {
    try { res.json(await storage.updateTmProject(Number(req.params.id), req.body)); }
    catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/tm/projects/:id", async (req, res) => {
    try { await storage.deleteTmProject(Number(req.params.id)); res.json({ success: true }); }
    catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/tm/suites", async (req, res) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      const suites = await storage.getTmTestSuites(1, projectId);
      res.json(suites);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });
  app.post("/api/tm/suites", async (req, res) => {
    try {
      const suite = await storage.createTmTestSuite({ ...req.body, tenantId: 1 });
      res.json(suite);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });
  app.patch("/api/tm/suites/:id", async (req, res) => {
    try {
      const suite = await storage.updateTmTestSuite(Number(req.params.id), req.body);
      res.json(suite);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });
  app.delete("/api/tm/suites/:id", async (req, res) => {
    try {
      await storage.deleteTmTestSuite(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  // Test Cases
  app.get("/api/tm/cases", async (req, res) => {
    try {
      const suiteId = req.query.suiteId ? Number(req.query.suiteId) : undefined;
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      const cases = await storage.getTmTestCases(1, suiteId, projectId);
      res.json(cases);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });
  app.get("/api/tm/cases/:id", async (req, res) => {
    try {
      const tc = await storage.getTmTestCase(Number(req.params.id));
      if (!tc) return res.status(404).json({ message: "Not found" });
      res.json(tc);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });
  app.post("/api/tm/cases", async (req, res) => {
    try {
      const tc = await storage.createTmTestCase({ ...req.body, tenantId: 1 });
      res.json(tc);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });
  app.patch("/api/tm/cases/:id", async (req, res) => {
    try {
      const tc = await storage.updateTmTestCase(Number(req.params.id), req.body);
      res.json(tc);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });
  app.delete("/api/tm/cases/:id", async (req, res) => {
    try {
      await storage.deleteAllTmTestSteps(Number(req.params.id));
      await storage.deleteTmTestCase(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  // Test Steps
  app.get("/api/tm/cases/:caseId/steps", async (req, res) => {
    try {
      const steps = await storage.getTmTestSteps(Number(req.params.caseId));
      res.json(steps);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });
  app.post("/api/tm/cases/:caseId/steps/bulk", async (req, res) => {
    try {
      const caseId = Number(req.params.caseId);
      await storage.deleteAllTmTestSteps(caseId);
      const steps = Array.isArray(req.body) ? req.body : [];
      const created = await Promise.all(
        steps.map((s: any, i: number) => storage.createTmTestStep({ ...s, testCaseId: caseId, stepOrder: i + 1 }))
      );
      res.json(created);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  // Test Runs
  app.get("/api/tm/runs", async (req, res) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      const runs = await storage.getTmTestRuns(1, projectId);
      res.json(runs);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });
  app.post("/api/tm/runs", async (req, res) => {
    try {
      const run = await storage.createTmTestRun({ ...req.body, tenantId: 1 });
      res.json(run);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });
  app.patch("/api/tm/runs/:id", async (req, res) => {
    try {
      const run = await storage.updateTmTestRun(Number(req.params.id), req.body);
      res.json(run);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });
  app.delete("/api/tm/runs/:id", async (req, res) => {
    try {
      await storage.deleteTmTestRun(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  // Test Results (Execution)
  app.get("/api/tm/runs/:id/results", async (req, res) => {
    try {
      const results = await storage.getTmTestResults(parseInt(req.params.id));
      res.json(results);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/tm/runs/:id/results", async (req, res) => {
    try {
      const existing = await storage.getTmTestResults(parseInt(req.params.id));
      const { caseIds } = req.body; // array of testCaseIds
      const added: any[] = [];
      for (const caseId of (caseIds as number[])) {
        if (!existing.some(r => r.testCaseId === caseId)) {
          const r = await storage.createTmTestResult({ testRunId: parseInt(req.params.id), testCaseId: caseId, status: "not_run" });
          added.push(r);
        }
      }
      res.json(added);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/tm/results/:id", async (req, res) => {
    try {
      const result = await storage.updateTmTestResult(parseInt(req.params.id), req.body);
      res.json(result);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/tm/results/:id", async (req, res) => {
    try {
      await storage.deleteTmTestResult(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Demo seed
  app.post("/api/tm/seed-demo", async (req, res) => {
    try {
      const existing = await storage.getTmTestSuites(1);
      if (existing.length > 0) {
        return res.status(409).json({ message: "Demo data already loaded. Clear existing suites first." });
      }

      // ── Suites ──────────────────────────────────────────────────────────
      const suiteData = [
        { name: "Order Management",    description: "End-to-end tests for customer order creation, modification, and cancellation", sortOrder: 1 },
        { name: "Finance & Accounting",description: "GL posting, invoice creation, vendor payments and reconciliation", sortOrder: 2 },
        { name: "Procurement",         description: "Purchase order lifecycle, goods receipt, and supplier management", sortOrder: 3 },
        { name: "Customer Management", description: "Customer master data, credit management and account hierarchy", sortOrder: 4 },
        { name: "Billing",             description: "Billing runs, payment terms, dunning and statement generation", sortOrder: 5 },
        { name: "Integrations",        description: "API and middleware integration points between ERP and external systems", sortOrder: 6 },
      ];
      const suites: any[] = [];
      for (const s of suiteData) {
        suites.push(await storage.createTmTestSuite({ tenantId: 1, ...s }));
      }
      const [sOrd, sFin, sPro, sCus, sBil, sInt] = suites;

      // ── Test Cases with Steps ────────────────────────────────────────────
      const caseRows = [
        // Order Management
        {
          suiteId: sOrd.id, title: "Create Customer Order — Valid Data", priority: "high", status: "active", caseType: "manual",
          tags: ["UAT","smoke"], estimatedDuration: 15,
          description: "Verify that a valid customer order can be created with all mandatory fields populated, correct pricing applied, and order confirmation generated.",
          preconditions: "Customer master data exists. User logged in with Order Entry role. Test data set ORD-TEST-01 loaded.",
          steps: [
            { action: "Login to system with Order Entry credentials", expectedResult: "Dashboard loads successfully. User role confirmed." },
            { action: "Navigate to Order Management > Create New Order", expectedResult: "New Order form displayed with all mandatory fields." },
            { action: "Enter Customer ID: CUST-0042 and press Tab", expectedResult: "Customer name and address auto-populate correctly." },
            { action: "Add line item: PROD-100, Qty 10. Press Add.", expectedResult: "Line item added. Unit price $45.00, total $450.00 shown." },
            { action: "Click Submit Order", expectedResult: "Order confirmation screen displays with Order ID (e.g. ORD-10042). Confirmation email triggered." },
            { action: "Navigate to Order List and search for ORD-10042", expectedResult: "Order appears in list with status 'Confirmed'. All data matches entry." },
          ],
        },
        {
          suiteId: sOrd.id, title: "Create Order with Missing Mandatory Field", priority: "medium", status: "active", caseType: "manual",
          tags: ["SIT","negative"], estimatedDuration: 10,
          description: "Verify that the system prevents order creation when a mandatory field is omitted and displays an appropriate validation message.",
          preconditions: "User logged in with Order Entry role.",
          steps: [
            { action: "Navigate to Order Management > Create New Order", expectedResult: "New Order form is displayed." },
            { action: "Leave Customer ID field blank and attempt to submit", expectedResult: "System highlights Customer ID field in red and shows 'Customer is required' message." },
            { action: "Leave Product field blank with Customer populated and submit", expectedResult: "System shows 'At least one line item is required' validation error." },
          ],
        },
        {
          suiteId: sOrd.id, title: "Create Order with Invalid Customer", priority: "high", status: "active", caseType: "manual",
          tags: ["SIT","negative"], estimatedDuration: 10,
          description: "Verify that the system rejects order creation for a customer ID that does not exist in the master data.",
          preconditions: "User logged in with Order Entry role.",
          steps: [
            { action: "Enter Customer ID: CUST-9999 (non-existent)", expectedResult: "System shows 'Customer not found' error. Fields do not auto-populate." },
            { action: "Attempt to submit the order", expectedResult: "Submit is blocked. Error message remains visible." },
          ],
        },
        {
          suiteId: sOrd.id, title: "Update Order Quantity Post-Confirmation", priority: "medium", status: "active", caseType: "automated",
          tags: ["SIT","regression"], estimatedDuration: 8, automationStatus: "automated",
          description: "Verify that an order's line item quantity can be updated after initial confirmation and that totals recalculate correctly.",
          preconditions: "Order ORD-10042 exists in Confirmed status.",
          steps: [
            { action: "Open order ORD-10042 and click Edit", expectedResult: "Order opens in edit mode." },
            { action: "Change Qty for PROD-100 from 10 to 15", expectedResult: "Line total updates to $675.00. Order total recalculates." },
            { action: "Click Save Changes", expectedResult: "Order saved with updated quantity. Audit log entry created." },
          ],
        },
        {
          suiteId: sOrd.id, title: "Cancel Order Before Dispatch", priority: "medium", status: "active", caseType: "manual",
          tags: ["UAT"], estimatedDuration: 12,
          description: "Verify that an order can be cancelled before it has been dispatched and that stock is correctly returned to available inventory.",
          preconditions: "Order ORD-10042 in Confirmed status with no dispatch note raised.",
          steps: [
            { action: "Open order ORD-10042 and click Cancel Order", expectedResult: "Cancellation confirmation dialog appears." },
            { action: "Confirm cancellation with reason 'Customer request'", expectedResult: "Order status changes to 'Cancelled'. Cancellation reason recorded." },
            { action: "Check inventory for PROD-100", expectedResult: "Available stock increased by 10 units (quantity from cancelled order)." },
          ],
        },
        // Finance & Accounting
        {
          suiteId: sFin.id, title: "Post Journal Entry — Standard", priority: "high", status: "active", caseType: "manual",
          tags: ["SIT"], estimatedDuration: 20,
          description: "Verify that a standard GL journal entry can be posted with debit and credit balancing correctly.",
          preconditions: "User has GL Posting role. Period is open.",
          steps: [
            { action: "Navigate to Finance > General Ledger > Create Journal Entry", expectedResult: "Journal Entry form opens." },
            { action: "Enter debit line: Account 1100, Amount $5,000", expectedResult: "Debit line added. Running balance shows $5,000 DR." },
            { action: "Enter credit line: Account 2100, Amount $5,000", expectedResult: "Credit line added. Journal balances to zero." },
            { action: "Click Post Journal", expectedResult: "Journal posted with reference JE-20260309-001. Period updated." },
          ],
        },
        {
          suiteId: sFin.id, title: "Invoice Creation from Purchase Order", priority: "high", status: "active", caseType: "automated",
          tags: ["SIT","regression"], estimatedDuration: 15, automationStatus: "automated",
          description: "Verify that a vendor invoice can be matched to and created from an approved purchase order.",
          preconditions: "PO-5042 in Approved status. Goods receipt GR-5042 completed.",
          steps: [
            { action: "Navigate to Accounts Payable > Create Invoice > Match to PO", expectedResult: "PO lookup screen opens." },
            { action: "Search for PO-5042 and select", expectedResult: "PO lines loaded. GR-5042 matched. Invoice amount $12,500." },
            { action: "Enter vendor invoice number and click Post", expectedResult: "Invoice INV-5042 created and posted. Payment due date calculated." },
          ],
        },
        {
          suiteId: sFin.id, title: "Vendor Payment Run", priority: "high", status: "active", caseType: "manual",
          tags: ["UAT"], estimatedDuration: 25,
          description: "Verify that the automatic payment run selects the correct invoices due for payment and generates the correct payment advice.",
          preconditions: "At least 3 vendor invoices due for payment within selection date range.",
          steps: [
            { action: "Navigate to Accounts Payable > Payment Run > Create New Run", expectedResult: "Payment run parameters form displayed." },
            { action: "Set payment date to today, bank account BANK-01, click Propose", expectedResult: "System proposes 3 invoices totalling $28,350." },
            { action: "Review proposed payments and click Execute", expectedResult: "Payments posted. Payment advices generated. Bank file ready for download." },
          ],
        },
        // Procurement
        {
          suiteId: sPro.id, title: "Create Purchase Requisition", priority: "medium", status: "active", caseType: "manual",
          tags: ["SIT"], estimatedDuration: 12,
          description: "Verify a purchase requisition can be raised and routed for approval.",
          preconditions: "User has Requisitioner role. Supplier SUPP-0010 active in master data.",
          steps: [
            { action: "Navigate to Procurement > Purchase Requisition > New", expectedResult: "Requisition form displayed." },
            { action: "Enter item details: PROD-200, Qty 5, estimated cost $250", expectedResult: "Line item added with estimated total $1,250." },
            { action: "Submit for approval", expectedResult: "Requisition PR-1042 created. Approval notification sent to line manager." },
          ],
        },
        {
          suiteId: sPro.id, title: "Convert Approved Requisition to PO", priority: "high", status: "active", caseType: "automated",
          tags: ["regression"], estimatedDuration: 10, automationStatus: "planned",
          description: "Verify that an approved purchase requisition can be converted to a purchase order.",
          preconditions: "PR-1042 in Approved status.",
          steps: [
            { action: "Open PR-1042 and click Convert to PO", expectedResult: "PO creation dialog opens with PR data pre-populated." },
            { action: "Select supplier SUPP-0010 and confirm", expectedResult: "PO-5043 created and emailed to supplier." },
          ],
        },
        // Customer Management
        {
          suiteId: sCus.id, title: "Create New Customer Account", priority: "high", status: "active", caseType: "manual",
          tags: ["SIT","smoke"], estimatedDuration: 18,
          description: "Verify that a new customer account can be created with full contact, credit, and billing information.",
          preconditions: "User has Customer Master Admin role.",
          steps: [
            { action: "Navigate to Customer Management > New Customer", expectedResult: "Customer creation wizard opens on Step 1." },
            { action: "Enter company name, address, country, and industry", expectedResult: "Step 1 validated. Proceed to Step 2." },
            { action: "Set credit limit $50,000, payment terms NET-30", expectedResult: "Credit settings saved." },
            { action: "Click Finish", expectedResult: "Customer CUST-0055 created. Welcome notification scheduled." },
          ],
        },
        // Billing
        {
          suiteId: sBil.id, title: "Generate Monthly Billing Statement", priority: "high", status: "active", caseType: "manual",
          tags: ["UAT"], estimatedDuration: 20,
          description: "Verify that the billing run generates accurate monthly statements for all active customers.",
          preconditions: "Month-end billing period open. At least 5 customers with outstanding invoices.",
          steps: [
            { action: "Navigate to Billing > Billing Run > Monthly Statement", expectedResult: "Billing run parameters form displayed." },
            { action: "Set period to March 2026 and click Preview", expectedResult: "Preview shows 5 customers, total outstanding $142,800." },
            { action: "Click Generate and Dispatch", expectedResult: "Statements generated as PDF. Emails dispatched. Run log shows all successful." },
          ],
        },
        // Integrations
        {
          suiteId: sInt.id, title: "ERP to Logistics API Handshake", priority: "critical", status: "active", caseType: "automated",
          tags: ["regression","integration"], estimatedDuration: 5, automationStatus: "automated",
          description: "Verify that the ERP system can successfully authenticate and exchange order data with the logistics provider API.",
          preconditions: "Logistics API sandbox environment online. API credentials configured.",
          steps: [
            { action: "Trigger order dispatch event for ORD-10042", expectedResult: "API call sent to logistics endpoint. HTTP 200 response received." },
            { action: "Check logistics provider portal", expectedResult: "Shipment SHP-9988 created in logistics system with correct order details." },
            { action: "Verify webhook callback received in ERP", expectedResult: "ERP order ORD-10042 status updated to 'Dispatched'." },
          ],
        },
      ];

      const createdCases: any[] = [];
      for (const c of caseRows) {
        const { steps, ...caseFields } = c;
        const tc = await storage.createTmTestCase({ tenantId: 1, ...caseFields });
        createdCases.push(tc);
        for (let i = 0; i < steps.length; i++) {
          await storage.createTmTestStep({ testCaseId: tc.id, stepOrder: i + 1, ...steps[i] });
        }
      }

      // ── Test Runs ────────────────────────────────────────────────────────
      const sitRun = await storage.createTmTestRun({
        tenantId: 1, name: "SIT Cycle 2 — ERP Implementation", status: "in_progress",
        description: "System Integration Testing cycle 2. Covers Order Mgmt, Finance, and Procurement modules.",
        startDate: "2026-03-01", endDate: "2026-03-14",
      });
      const uatRun = await storage.createTmTestRun({
        tenantId: 1, name: "UAT Cycle 1 — ERP Implementation", status: "planned",
        description: "User Acceptance Testing cycle 1. Business users validate end-to-end flows.",
        startDate: "2026-03-17", endDate: "2026-03-28",
      });
      const regRun = await storage.createTmTestRun({
        tenantId: 1, name: "Regression — Billing Module v4.2", status: "completed",
        description: "Regression suite after billing module hotfix patch v4.2.1.",
        startDate: "2026-02-20", endDate: "2026-02-22",
      });

      // ── Test Results (seed execution data) ──────────────────────────────
      // SIT Cycle 2: cases 0-7 (Order Mgmt + Finance)
      const sitCaseResults = [
        { idx: 0, status: "pass",    comment: "All steps passed. Order created and confirmed correctly.", executedBy: "sarah.k" },
        { idx: 1, status: "pass",    comment: "Validation errors shown as expected.", executedBy: "sarah.k" },
        { idx: 2, status: "fail",    comment: "System accepted invalid customer without error — BUG raised as DEF-233.", executedBy: "sarah.k" },
        { idx: 3, status: "pass",    comment: "Automated test passed on all 3 environments.", executedBy: "autobot" },
        { idx: 4, status: "not_run", comment: null, executedBy: null },
        { idx: 5, status: "pass",    comment: "Journal balanced correctly. Period updated.", executedBy: "john.p" },
        { idx: 6, status: "fail",    comment: "GL accounts swapped on invoice posting. Critical bug DEF-301 raised.", executedBy: "john.p" },
        { idx: 7, status: "blocked", comment: "Cannot test — UAT environment vendor payment module not deployed.", executedBy: "john.p" },
      ];
      for (const r of sitCaseResults) {
        await storage.createTmTestResult({
          testRunId: sitRun.id,
          testCaseId: createdCases[r.idx].id,
          status: r.status,
          comment: r.comment ?? undefined,
          executedBy: r.executedBy ?? undefined,
          executedAt: r.status !== "not_run" ? new Date("2026-03-09") : undefined,
        });
      }

      // UAT Cycle 1: first 5 cases added, all not_run (planned)
      for (let i = 0; i < 5; i++) {
        await storage.createTmTestResult({
          testRunId: uatRun.id,
          testCaseId: createdCases[i].id,
          status: "not_run",
        });
      }

      // Regression Billing: case index 10 (billing), 11 (integrations)
      const regResults = [
        { idx: 10, status: "pass", comment: "Monthly billing statement generated correctly. All 5 customers processed.", executedBy: "peter.m" },
        { idx: 11, status: "pass", comment: "API handshake successful. Shipment created in logistics portal.", executedBy: "autobot" },
      ];
      for (const r of regResults) {
        if (createdCases[r.idx]) {
          await storage.createTmTestResult({
            testRunId: regRun.id,
            testCaseId: createdCases[r.idx].id,
            status: r.status,
            comment: r.comment,
            executedBy: r.executedBy,
            executedAt: new Date("2026-02-21"),
          });
        }
      }

      // ── Defects ──────────────────────────────────────────────────────────
      const defectData = [
        { title: "Order creation fails on duplicate SKU", severity: "critical", priority: "critical", status: "open",
          description: "When a line item with a duplicate SKU is added to an order, the system throws an unhandled exception and the order cannot be saved. Reproducible 100% of the time.", tags: ["Order Management"] },
        { title: "Invoice posting GL mismatch", severity: "critical", priority: "critical", status: "in_progress",
          description: "On posting an invoice matched to a PO, the GL debit and credit accounts are swapped causing incorrect financial reporting. Only affects invoices over $10,000.", tags: ["Finance"] },
        { title: "Approval workflow timeout after 48h", severity: "high", priority: "high", status: "open",
          description: "Purchase requisitions that remain in the approval queue for more than 48 hours are automatically rejected without notification to the requester.", tags: ["Procurement"] },
        { title: "Payment terms not inherited from customer", severity: "high", priority: "high", status: "open",
          description: "When creating a new order, payment terms are not automatically inherited from the customer master record. User must manually set them each time.", tags: ["Order Management"] },
        { title: "Billing statement shows incorrect period dates", severity: "medium", priority: "medium", status: "new",
          description: "Monthly billing statements show the previous month's date range instead of the current period. Cosmetic issue but causes customer confusion.", tags: ["Billing"] },
        { title: "Logistics API handshake fails on retry", severity: "high", priority: "high", status: "open",
          description: "If the first API call to the logistics provider times out and a retry is attempted, the retry returns a 401 unauthorised. Token refresh logic has a bug.", tags: ["Integrations"] },
        { title: "GL account lookup slow (>8s) on large chart of accounts", severity: "medium", priority: "medium", status: "in_progress",
          description: "Searching for GL accounts in the journal entry form takes 8-12 seconds when the chart of accounts has more than 2,000 accounts. Pagination not implemented.", tags: ["Finance","Performance"] },
        { title: "Customer credit limit not enforced on order save", severity: "critical", priority: "critical", status: "open",
          description: "Orders that exceed a customer's credit limit are accepted and saved without any warning. The credit check endpoint is not being called on the order save event.", tags: ["Order Management","Customer Management"] },
        { title: "Order total rounds incorrectly for 3dp currencies", severity: "high", priority: "high", status: "resolved",
          description: "For currencies with 3 decimal places (KWD, BHD), order totals are rounded to 2dp instead of 3dp causing rounding discrepancies.", tags: ["Finance","Order Management"] },
        { title: "Login page shows error in IE11", severity: "low", priority: "low", status: "closed",
          description: "The login page displays a JavaScript error in Internet Explorer 11. As IE11 is not a supported browser this is low priority.", tags: ["UI"] },
      ];

      for (const d of defectData) {
        await storage.createTmDefect({ tenantId: 1, ...d });
      }

      // ── Requirements ────────────────────────────────────────────────────────
      // Get the created cases so we can reference them by index
      const allCreatedCases = await storage.getTmTestCases(1);
      const caseIdsByIndex = (indices: number[]) => indices.map(i => allCreatedCases[i]?.id).filter(Boolean) as number[];

      const reqData = [
        { reqId: "REQ-001", title: "Customer Order Lifecycle Management", priority: "high", source: "BRD v2.1",
          description: "The system shall support end-to-end order lifecycle: creation, modification, cancellation, and fulfilment tracking.",
          linkedCaseIds: caseIdsByIndex([0, 1, 2, 3, 4]) },
        { reqId: "REQ-002", title: "Financial Posting Accuracy", priority: "critical", source: "FRD v1.4",
          description: "All financial transactions must post to the correct GL accounts with balanced debit and credit entries.",
          linkedCaseIds: caseIdsByIndex([5, 6]) },
        { reqId: "REQ-003", title: "Vendor Payment Processing", priority: "high", source: "FRD v1.4",
          description: "Vendor invoices must be matched to approved purchase orders before payment is authorised.",
          linkedCaseIds: caseIdsByIndex([7]) },
        { reqId: "REQ-004", title: "Customer Account Management", priority: "medium", source: "CRM-BRD v1.0",
          description: "Customer master data must be maintained with credit limits, account status, and contact hierarchy.",
          linkedCaseIds: caseIdsByIndex([8, 9]) },
        { reqId: "REQ-005", title: "Billing Statement Generation", priority: "high", source: "Billing Spec v1.1",
          description: "The system must generate accurate billing statements with correct payment terms and dunning triggers.",
          linkedCaseIds: caseIdsByIndex([10]) },
        { reqId: "REQ-006", title: "External System API Integration", priority: "medium", source: "Integration Spec v2.0",
          description: "The ERP system must expose RESTful API endpoints for real-time data exchange with external platforms.",
          linkedCaseIds: caseIdsByIndex([11]) },
        { reqId: "REQ-007", title: "Multi-Currency Order Support", priority: "medium", source: "BRD v2.1",
          description: "The system must handle orders in multiple currencies with accurate conversion and rounding to currency decimal places.",
          linkedCaseIds: caseIdsByIndex([0, 5]) },
        { reqId: "REQ-008", title: "Data Validation & Error Messaging", priority: "low", source: "UX Spec v1.0",
          description: "All user inputs must be validated with clear, actionable error messages displayed inline.",
          linkedCaseIds: caseIdsByIndex([1, 2]) },
      ];

      for (const r of reqData) {
        await storage.createTmRequirement({ tenantId: 1, ...r });
      }

      // ── Demo Scenarios ────────────────────────────────────────────────────
      const scenarioData = [
        {
          scenarioId: "SCN-001", title: "End-to-End Customer Order Fulfilment",
          description: "A customer places an order online, the order is confirmed, picked, packed, dispatched, and a billing statement is generated.",
          functionalArea: "Order Management", process: "Order-to-Cash",
          priority: "critical", status: "active",
          linkedCaseIds: caseIdsByIndex([0, 1, 2, 3, 4]),
        },
        {
          scenarioId: "SCN-002", title: "Procure-to-Pay Cycle — Standard PO",
          description: "Purchasing raises a standard purchase order, goods are received, invoice is matched and payment is processed.",
          functionalArea: "Procurement", process: "Procure-to-Pay",
          priority: "high", status: "active",
          linkedCaseIds: caseIdsByIndex([5, 6, 7]),
        },
        {
          scenarioId: "SCN-003", title: "Finance Month-End Close",
          description: "GL postings are validated, inter-company reconciliations completed, and trial balance extracted at period end.",
          functionalArea: "Finance", process: "Record-to-Report",
          priority: "high", status: "active",
          linkedCaseIds: caseIdsByIndex([7, 8]),
        },
        {
          scenarioId: "SCN-004", title: "New Customer Onboarding",
          description: "A new customer is created in the system with credit limit, contact hierarchy, and account status configured.",
          functionalArea: "CRM", process: "Lead-to-Opportunity",
          priority: "medium", status: "active",
          linkedCaseIds: caseIdsByIndex([8, 9]),
        },
        {
          scenarioId: "SCN-005", title: "Billing Statement — Overdue Dunning",
          description: "Verify that overdue accounts trigger dunning notices at the correct intervals and escalation thresholds.",
          functionalArea: "Billing", process: "Order-to-Cash",
          priority: "medium", status: "draft",
          linkedCaseIds: caseIdsByIndex([10]),
        },
        {
          scenarioId: "SCN-006", title: "ERP to CRM Data Sync via API",
          description: "Customer and order data created in ERP is synchronised in real-time to the CRM system via REST API.",
          functionalArea: "Integration", process: "Order-to-Cash",
          priority: "high", status: "active",
          linkedCaseIds: caseIdsByIndex([11]),
        },
      ];
      for (const s of scenarioData) {
        await storage.createTmScenario({ tenantId: 1, ...s });
      }

      res.json({ message: "Demo data loaded successfully", suites: suites.length, cases: caseRows.length, defects: defectData.length, requirements: reqData.length, scenarios: scenarioData.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // All results (cross-run) — used by RTM, Digital Twin, Test Navigator
  app.get("/api/tm/results/all", async (req, res) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      const runs = await storage.getTmTestRuns(1, projectId);
      const all: any[] = [];
      for (const run of runs) {
        const results = await storage.getTmTestResults(run.id);
        all.push(...results);
      }
      res.json(all);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Migrate existing TM data to a project (idempotent — safe to call multiple times)
  app.post("/api/tm/migrate-project", async (req, res) => {
    try {
      const projects = await storage.getTmProjects(1);
      let project = projects[0];
      if (!project) {
        project = await storage.createTmProject({
          tenantId: 1,
          name: "ERP Implementation — Phase 1",
          description: "End-to-end ERP system implementation covering Order Management, Finance, Procurement, CRM, Billing, and Integrations.",
          status: "active",
          environment: "SIT, UAT, Regression",
          color: "#6366f1",
        });
      }
      // Update any records with no projectId
      const { db } = await import("./db");
      const { tmTestSuites: tSuites, tmTestCases: tCases, tmTestRuns: tRuns, tmDefects: tDefs, tmRequirements: tReqs } = await import("@shared/schema");
      const { isNull, eq } = await import("drizzle-orm");
      await db.update(tSuites).set({ projectId: project.id }).where(isNull(tSuites.projectId));
      await db.update(tCases).set({ projectId: project.id }).where(isNull(tCases.projectId));
      await db.update(tRuns).set({ projectId: project.id }).where(isNull(tRuns.projectId));
      await db.update(tDefs).set({ projectId: project.id }).where(isNull(tDefs.projectId));
      await db.update(tReqs).set({ projectId: project.id }).where(isNull(tReqs.projectId));
      res.json({ success: true, project });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Audit Trail — derives events from existing data
  app.get("/api/tm/audit", async (req, res) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      const runs = await storage.getTmTestRuns(1, projectId);
      const cases = await storage.getTmTestCases(1, undefined, projectId);
      const defects = await storage.getTmDefects(1, projectId);
      const events: any[] = [];

      // Execution events from test results
      for (const run of runs) {
        const results = await storage.getTmTestResults(run.id);
        for (const r of results) {
          const tc = cases.find(c => c.id === r.testCaseId);
          events.push({
            id: `exec-${r.id}`,
            eventType: "execution",
            actor: r.executedBy ?? "System",
            entity: tc?.title ?? `Test Case #${r.testCaseId}`,
            detail: `Result: ${(r.status ?? "not_run").replace("_", " ")} in run "${run.name}"${r.comment ? ` — ${r.comment}` : ""}`,
            timestamp: r.executedAt ?? run.createdAt,
          });
        }
        // Run creation event
        events.push({
          id: `run-${run.id}`,
          eventType: "run_created",
          actor: run.createdBy ?? "System",
          entity: `Run: ${run.name}`,
          detail: `Test run created with environment "${run.environment ?? "N/A"}" and status "${run.status}"`,
          timestamp: run.createdAt,
        });
      }

      // Test case creation events
      for (const c of cases) {
        events.push({
          id: `case-${c.id}`,
          eventType: "case_created",
          actor: "System",
          entity: c.title,
          detail: `Test case created — priority: ${c.priority}, type: ${c.caseType}`,
          timestamp: c.createdAt,
        });
      }

      // Defect events
      for (const d of defects) {
        events.push({
          id: `defect-${d.id}`,
          eventType: "defect_raised",
          actor: d.reportedBy ?? "System",
          entity: `[${d.defectId}] ${d.title}`,
          detail: `Severity: ${d.severity}, Priority: ${d.priority}, Status: ${d.status}`,
          timestamp: d.createdAt,
        });
        if (d.status === "resolved" || d.status === "closed") {
          events.push({
            id: `defect-resolved-${d.id}`,
            eventType: "defect_resolved",
            actor: d.assignedTo ?? "System",
            entity: `[${d.defectId}] ${d.title}`,
            detail: `Defect marked as ${d.status}`,
            timestamp: d.updatedAt ?? d.createdAt,
          });
        }
      }

      // Sort newest first
      events.sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());
      res.json(events);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Requirements (RTM)
  app.get("/api/tm/requirements", async (req, res) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      res.json(await storage.getTmRequirements(1, projectId));
    }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/tm/requirements", async (req, res) => {
    try { res.json(await storage.createTmRequirement({ ...req.body, tenantId: 1 })); }
    catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/tm/requirements/:id", async (req, res) => {
    try { res.json(await storage.updateTmRequirement(parseInt(req.params.id), req.body)); }
    catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/tm/requirements/:id", async (req, res) => {
    try { await storage.deleteTmRequirement(parseInt(req.params.id)); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Seed demo scenarios (idempotent — skips if any exist)
  app.post("/api/tm/seed-scenarios", async (req, res) => {
    try {
      const existing = await storage.getTmScenarios(1);
      if (existing.length > 0) {
        return res.json({ skipped: true, count: existing.length });
      }
      const cases = await storage.getTmTestCases(1);
      function caseIdsByIndex(indices: number[]) {
        return indices.map(i => cases[i]?.id).filter(Boolean) as number[];
      }
      const demoScenarios = [
        {
          scenarioId: "SCN-001", title: "End-to-End Customer Order Fulfilment",
          description: "A customer places an order online, the order is confirmed, picked, packed, dispatched, and a billing statement is generated.",
          functionalArea: "Order Management", process: "Order-to-Cash",
          priority: "critical", status: "active",
          linkedCaseIds: caseIdsByIndex([0, 1, 2, 3, 4]),
        },
        {
          scenarioId: "SCN-002", title: "Procure-to-Pay Cycle — Standard PO",
          description: "Purchasing raises a standard purchase order, goods are received, invoice is matched and payment is processed.",
          functionalArea: "Procurement", process: "Procure-to-Pay",
          priority: "high", status: "active",
          linkedCaseIds: caseIdsByIndex([5, 6, 7]),
        },
        {
          scenarioId: "SCN-003", title: "Finance Month-End Close",
          description: "GL postings are validated, inter-company reconciliations completed, and trial balance extracted at period end.",
          functionalArea: "Finance", process: "Record-to-Report",
          priority: "high", status: "active",
          linkedCaseIds: caseIdsByIndex([7, 8]),
        },
        {
          scenarioId: "SCN-004", title: "New Customer Onboarding",
          description: "A new customer is created in the system with credit limit, contact hierarchy, and account status configured.",
          functionalArea: "CRM", process: "Lead-to-Opportunity",
          priority: "medium", status: "active",
          linkedCaseIds: caseIdsByIndex([8, 9]),
        },
        {
          scenarioId: "SCN-005", title: "Billing Statement — Overdue Dunning",
          description: "Verify that overdue accounts trigger dunning notices at the correct intervals and escalation thresholds.",
          functionalArea: "Billing", process: "Order-to-Cash",
          priority: "medium", status: "draft",
          linkedCaseIds: caseIdsByIndex([10]),
        },
        {
          scenarioId: "SCN-006", title: "ERP to CRM Data Sync via API",
          description: "Customer and order data created in ERP is synchronised in real-time to the CRM system via REST API.",
          functionalArea: "Integration", process: "Order-to-Cash",
          priority: "high", status: "active",
          linkedCaseIds: caseIdsByIndex([11]),
        },
      ];
      // Get current project ID and link scenarios
      const projects = await storage.getTmProjects(1);
      const projectId = projects[0]?.id;
      for (const s of demoScenarios) {
        await storage.createTmScenario({ tenantId: 1, projectId, ...s });
      }
      res.json({ seeded: true, count: demoScenarios.length });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Test Scenarios
  app.get("/api/tm/scenarios", async (req, res) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      res.json(await storage.getTmScenarios(1, projectId));
    }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/tm/scenarios", async (req, res) => {
    try { res.json(await storage.createTmScenario({ ...req.body, tenantId: 1 })); }
    catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/tm/scenarios/:id", async (req, res) => {
    try { res.json(await storage.updateTmScenario(parseInt(req.params.id), req.body)); }
    catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/tm/scenarios/:id", async (req, res) => {
    try { await storage.deleteTmScenario(parseInt(req.params.id)); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Defects
  app.get("/api/tm/defects", async (req, res) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      const defects = await storage.getTmDefects(1, projectId);
      res.json(defects);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });
  app.post("/api/tm/defects", async (req, res) => {
    try {
      const defect = await storage.createTmDefect({ ...req.body, tenantId: 1 });
      res.json(defect);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });
  app.patch("/api/tm/defects/:id", async (req, res) => {
    try {
      const defect = await storage.updateTmDefect(Number(req.params.id), req.body);
      res.json(defect);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });
  app.delete("/api/tm/defects/:id", async (req, res) => {
    try {
      await storage.deleteTmDefect(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  // ════════════════════════════════════════════════════════════
  //  SIGN-OFF MODULE
  // ════════════════════════════════════════════════════════════

  // List all requests for tenant
  app.get("/api/signoff", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const requests = await storage.getSignoffRequests(1);
      res.json(requests);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Get Jiganto documents list (for source selection in compose) — must be before /:id
  app.get("/api/signoff/jiganto-docs", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { documents: docs } = await import("@shared/models/documents");
      const { eq: eqD } = await import("drizzle-orm");
      const results = await db.select({ id: docs.id, title: docs.title, type: docs.type, status: docs.status })
        .from(docs)
        .where(eqD(docs.tenantId, 1));
      res.json(results);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── PUBLIC SIGNING ENDPOINTS (must be before /:id to avoid shadowing) ──

  // Get request details by token (for signing portal)
  app.get("/api/signoff/sign/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const signer = await storage.getSignoffSignerByToken(token);
      if (!signer) return res.status(404).json({ message: "Invalid or expired link" });
      if (signer.tokenExpiresAt && new Date() > signer.tokenExpiresAt) {
        return res.status(410).json({ message: "This signing link has expired" });
      }
      if (signer.status === "signed") return res.status(409).json({ message: "already_signed", signer });
      if (signer.status === "declined") return res.status(409).json({ message: "already_declined", signer });
      const request = await storage.getSignoffRequest(signer.requestId);
      if (!request) return res.status(404).json({ message: "Document not found" });
      if (request.status === "cancelled") return res.status(410).json({ message: "This sign-off request has been cancelled" });
      const { fileData, ...requestWithoutFile } = request;
      res.json({ request: requestWithoutFile, signer });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Mark document as viewed
  app.post("/api/signoff/sign/:token/view", async (req, res) => {
    try {
      const signer = await storage.getSignoffSignerByToken(req.params.token);
      if (!signer) return res.status(404).json({ message: "Not found" });
      if (!signer.viewedAt) {
        await storage.updateSignoffSigner(signer.id, { viewedAt: new Date(), status: "viewed", ipAddress: req.ip });
        await storage.createSignoffAuditLog({
          requestId: signer.requestId,
          event: "viewed",
          actorName: signer.name,
          actorEmail: signer.email,
          ipAddress: req.ip,
        });
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Submit signature
  app.post("/api/signoff/sign/:token/sign", async (req, res) => {
    try {
      const { signatureName } = req.body;
      if (!signatureName || signatureName.trim().length < 2) {
        return res.status(400).json({ message: "Please enter your full name" });
      }
      const signer = await storage.getSignoffSignerByToken(req.params.token);
      if (!signer) return res.status(404).json({ message: "Invalid link" });
      if (signer.tokenExpiresAt && new Date() > signer.tokenExpiresAt) {
        return res.status(410).json({ message: "This signing link has expired" });
      }
      if (signer.status === "signed") return res.status(409).json({ message: "Already signed" });
      await storage.updateSignoffSigner(signer.id, {
        status: "signed",
        signedAt: new Date(),
        signatureName: signatureName.trim(),
        ipAddress: req.ip,
      });
      await storage.createSignoffAuditLog({
        requestId: signer.requestId,
        event: "signed",
        actorName: signer.name,
        actorEmail: signer.email,
        ipAddress: req.ip,
        metadata: { signatureName: signatureName.trim() },
      });
      const request = await storage.getSignoffRequest(signer.requestId);
      if (request) {
        const allSigned = request.signers.every(s => s.id === signer.id ? true : s.status === "signed");
        if (allSigned) {
          await storage.updateSignoffRequest(signer.requestId, { status: "completed", completedAt: new Date() } as any);
          await storage.createSignoffAuditLog({
            requestId: signer.requestId,
            event: "completed",
            actorName: "System",
            metadata: { message: "All signers have signed. Document fully executed." },
          });
        }
      }
      res.json({ success: true, signedAt: new Date().toISOString() });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Decline signing
  app.post("/api/signoff/sign/:token/decline", async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason || reason.trim().length < 3) {
        return res.status(400).json({ message: "Please provide a reason for declining" });
      }
      const signer = await storage.getSignoffSignerByToken(req.params.token);
      if (!signer) return res.status(404).json({ message: "Invalid link" });
      await storage.updateSignoffSigner(signer.id, {
        status: "declined",
        declinedAt: new Date(),
        declineReason: reason.trim(),
        ipAddress: req.ip,
      });
      await storage.createSignoffAuditLog({
        requestId: signer.requestId,
        event: "declined",
        actorName: signer.name,
        actorEmail: signer.email,
        ipAddress: req.ip,
        metadata: { reason: reason.trim() },
      });
      await storage.updateSignoffRequest(signer.requestId, { status: "declined" } as any);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Pending sign-offs for the currently authenticated user (matched by email)
  app.get("/api/signoff/my-pending", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const userId = (req.user as any)?.claims?.sub;
      const sessionUser = (req.session as any)?.user as { email?: string } | undefined;
      let userEmail: string | undefined = sessionUser?.email;
      if (!userEmail && userId) {
        const [userRecord] = await db.select({ email: usersTable.email }).from(usersTable)
          .where(eq(usersTable.id, userId)).limit(1);
        userEmail = userRecord?.email || undefined;
      }
      if (!userEmail) return res.json([]);
      const results = await storage.getSignoffRequestsForSigner(userEmail);
      res.json(results);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Get single request with details — must be after static routes above
  app.get("/api/signoff/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const req2 = await storage.getSignoffRequest(Number(req.params.id));
      if (!req2) return res.status(404).json({ message: "Not found" });
      // Strip file data from listing for performance — only return metadata
      res.json(req2);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Serve the raw file (returns base64 data for the client to display)
  app.get("/api/signoff/:id/file", async (req, res) => {
    try {
      const request = await storage.getSignoffRequest(Number(req.params.id));
      if (!request) return res.status(404).json({ message: "Not found" });
      // Allow if authenticated OR if called from a valid token context (token in query)
      const token = req.query.token as string | undefined;
      if (!isRequestAuthenticated(req) && token) {
        const signer = await storage.getSignoffSignerByToken(token);
        if (!signer || signer.requestId !== request.id) return res.status(403).json({ message: "Forbidden" });
      } else if (!isRequestAuthenticated(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!request.fileData) return res.status(404).json({ message: "No file attached" });
      const buf = Buffer.from(request.fileData, "base64");
      const mimeMap: Record<string, string> = {
        pdf: "application/pdf",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      };
      const ct = mimeMap[request.fileType || ""] || "application/octet-stream";
      res.setHeader("Content-Type", ct);
      res.setHeader("Content-Disposition", `inline; filename="${request.fileName || "document"}"`);
      res.send(buf);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Create new request (draft)
  app.post("/api/signoff", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const user = req.user as any;
      const { signers, ...requestData } = req.body;
      const created = await storage.createSignoffRequest({
        ...requestData,
        tenantId: 1,
        createdBy: user.id,
        createdByName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.email || "Unknown"),
        status: "draft",
      });
      // Create signers if provided
      if (Array.isArray(signers)) {
        for (let i = 0; i < signers.length; i++) {
          await storage.createSignoffSigner({
            requestId: created.id,
            signerOrder: i + 1,
            name: signers[i].name,
            email: signers[i].email,
            isInternal: signers[i].isInternal || false,
            userId: signers[i].userId || null,
            status: "pending",
          });
        }
      }
      // Audit log
      await storage.createSignoffAuditLog({
        requestId: created.id,
        event: "created",
        actorName: created.createdByName || "Unknown",
        actorEmail: user.email,
        ipAddress: req.ip,
      });
      res.json(created);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Update request (title, message, deadline, add/replace file, etc.)
  app.patch("/api/signoff/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = Number(req.params.id);
      const { signers, ...updates } = req.body;
      const updated = await storage.updateSignoffRequest(id, updates);
      if (!updated) return res.status(404).json({ message: "Not found" });
      // Replace signers if provided
      if (Array.isArray(signers)) {
        // Delete existing and re-create
        const existing = await storage.getSignoffRequest(id);
        if (existing) {
          for (const s of existing.signers) {
            await storage.updateSignoffSigner(s.id, { status: "pending" });
          }
        }
        // We'll just let the front-end manage signers via separate add/delete endpoints
      }
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Delete request
  app.delete("/api/signoff/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      await storage.deleteSignoffRequest(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Add a signer to an existing request
  app.post("/api/signoff/:id/signers", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { name, email, isInternal, userId } = req.body;
      const request = await storage.getSignoffRequest(Number(req.params.id));
      if (!request) return res.status(404).json({ message: "Not found" });
      const order = request.signers.length + 1;
      const signer = await storage.createSignoffSigner({
        requestId: Number(req.params.id),
        signerOrder: order,
        name, email,
        isInternal: isInternal || false,
        userId: userId || null,
        status: "pending",
      });
      res.json(signer);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Update a signer's name / email (draft only)
  app.patch("/api/signoff/signers/:signerId", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { name, email } = req.body;
      const updated = await storage.updateSignoffSigner(Number(req.params.signerId), { name, email });
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Remove a signer (draft only)
  app.delete("/api/signoff/signers/:signerId", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      await storage.deleteSignoffSigner(Number(req.params.signerId));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Send the request (generate tokens, change status to pending)
  app.post("/api/signoff/:id/send", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const request = await storage.getSignoffRequest(id);
      if (!request) return res.status(404).json({ message: "Not found" });
      // Generate tokens for each signer
      const deadline = request.deadline ? new Date(request.deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      deadline.setHours(23, 59, 59, 999);
      for (const signer of request.signers) {
        const token = crypto.randomBytes(32).toString("hex");
        await storage.updateSignoffSigner(signer.id, { token, tokenExpiresAt: deadline, status: "pending" });
      }
      await storage.updateSignoffRequest(id, { status: "pending", sentAt: new Date() } as any);
      await storage.createSignoffAuditLog({
        requestId: id,
        event: "sent",
        actorName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.email || "System"),
        actorEmail: user.email,
        ipAddress: req.ip,
        metadata: { signerCount: request.signers.length },
      });
      const updated = await storage.getSignoffRequest(id);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Send reminder to pending signers
  app.post("/api/signoff/:id/remind", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const request = await storage.getSignoffRequest(id);
      if (!request) return res.status(404).json({ message: "Not found" });
      const pending = request.signers.filter(s => s.status === "pending");
      await storage.createSignoffAuditLog({
        requestId: id,
        event: "reminder_sent",
        actorName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.email || "System"),
        actorEmail: user.email,
        ipAddress: req.ip,
        metadata: { reminderSentTo: pending.map(s => s.email) },
      });
      res.json({ success: true, reminderSentTo: pending.length });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Surveys ─────────────────────────────────────────────────────────────

  // Public: get survey by token (respondent portal)
  app.get("/api/surveys/by-token/:token", async (req, res) => {
    try {
      const survey = await storage.getSurveyByToken(req.params.token);
      if (!survey) return res.status(404).json({ message: "Survey not found" });
      if (survey.status !== "active") return res.status(410).json({ message: "Survey is not active" });
      const { createdBy, ...publicSurvey } = survey as any;
      res.json(publicSurvey);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Public: submit a response
  app.post("/api/surveys/by-token/:token/respond", async (req, res) => {
    try {
      const survey = await storage.getSurveyByToken(req.params.token);
      if (!survey) return res.status(404).json({ message: "Survey not found" });
      if (survey.status !== "active") return res.status(410).json({ message: "Survey is closed" });
      const { respondentName, respondentEmail, answers, timeSeconds } = req.body;
      const response = await storage.createSurveyResponse({
        surveyId: survey.id,
        respondentName: survey.anonymous ? null : (respondentName || null),
        respondentEmail: survey.anonymous ? null : (respondentEmail || null),
        ipAddress: req.ip,
      });
      if (Array.isArray(answers)) {
        for (const a of answers) {
          if (a.questionId && a.value !== undefined) {
            await storage.createSurveyAnswer({ responseId: response.id, questionId: a.questionId, value: a.value });
          }
        }
      }
      await storage.completeSurveyResponse(response.id, timeSeconds || 0);
      res.json({ success: true, responseId: response.id });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Authenticated routes
  app.get("/api/surveys", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const user = req.user as any;
      const tenantId = user.tenantId || 1;
      const surveys = await storage.getSurveys(tenantId);
      res.json(surveys);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/surveys/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const survey = await storage.getSurvey(Number(req.params.id));
      if (!survey) return res.status(404).json({ message: "Not found" });
      res.json(survey);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/surveys", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const user = req.user as any;
      const token = crypto.randomBytes(16).toString("hex");
      const survey = await storage.createSurvey({
        ...req.body,
        tenantId: getApiTenantIdWithFallback(req),
        token,
        createdBy: user.id,
        createdByName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.email || "Unknown"),
      });
      res.json(survey);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/surveys/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const survey = await storage.updateSurvey(Number(req.params.id), req.body);
      if (!survey) return res.status(404).json({ message: "Not found" });
      res.json(survey);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/surveys/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      await storage.deleteSurvey(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/surveys/:id/activate", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const survey = await storage.updateSurvey(Number(req.params.id), { status: "active", sentAt: new Date() as any });
      res.json(survey);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/surveys/:id/close", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const survey = await storage.updateSurvey(Number(req.params.id), { status: "closed", closedAt: new Date() as any });
      res.json(survey);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // AI-powered survey generation
  app.post("/api/surveys/ai-generate", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { getOpenAIConfig } = await import("./lib/openai");
      const { apiKey, baseURL } = getOpenAIConfig();
      if (!apiKey) {
        return res.status(503).json({ message: "OpenAI is not configured. Set OPENAI_API_KEY." });
      }
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey, baseURL });
      const { description, count = 8 } = req.body;
      if (!description?.trim()) return res.status(400).json({ message: "Description is required" });
      const prompt = `You are a professional survey designer. Generate ${count} high-quality survey questions based on this brief:

"${description}"

Return a JSON array only — no explanation, no markdown. Each item must be an object with:
- "text": the question text (string, clear and professional)
- "type": one of: "mc" (multiple choice), "scale" (1-10 scale), "nps" (0-10 NPS), "text" (short text), "para" (paragraph), "yn" (yes/no), "sc" (star rating 1-5)
- "options": array of strings if type is "mc" (3-5 options), otherwise empty array []
- "required": true or false
- "helpText": a short clarifying sub-text or null

Use a mix of question types appropriate to the topic. For satisfaction/rating topics include at least one NPS or scale question. For open feedback include at least one "para" question.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      const raw = completion.choices[0].message.content || "{}";
      let questions: any[] = [];
      try {
        const parsed = JSON.parse(raw);
        questions = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.items || []);
      } catch { return res.status(500).json({ message: "AI returned invalid JSON" }); }
      res.json({ questions });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Bulk question creation (for template/AI paths)
  app.post("/api/surveys/:id/questions/bulk", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const surveyId = Number(req.params.id);
      const { questions } = req.body;
      if (!Array.isArray(questions)) return res.status(400).json({ message: "questions must be an array" });
      const existing = await storage.getSurveyQuestions(surveyId);
      let order = existing.length;
      const created = [];
      for (const q of questions) {
        order += 1;
        const created_q = await storage.createSurveyQuestion({
          surveyId, type: q.type || "text", text: q.text || "Question",
          helpText: q.helpText || null, options: q.options || [],
          required: q.required ?? true, allowOther: false,
          randomizeOptions: false, questionOrder: order,
          scaleMin: q.type === "nps" ? 0 : 1,
          scaleMax: q.type === "nps" ? 10 : q.type === "scale" ? 10 : q.type === "sc" ? 5 : 10,
          matrixRows: [], matrixCols: [],
        });
        created.push(created_q);
      }
      res.json({ created: created.length });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Duplicate survey
  app.post("/api/surveys/:id/duplicate", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const original = await storage.getSurvey(Number(req.params.id));
      if (!original) return res.status(404).json({ message: "Not found" });
      const crypto = await import("crypto");
      const copy = await storage.createSurvey({
        tenantId: original.tenantId, title: `${original.title} (copy)`,
        description: original.description, status: "draft",
        category: original.category, anonymous: original.anonymous,
        showProgress: original.showProgress, onePerPage: original.onePerPage,
        randomizeQuestions: original.randomizeQuestions,
        thankYouMessage: original.thankYouMessage,
        token: crypto.randomBytes(16).toString("hex"),
        createdBy: (req.user as any)?.id || null,
        createdByName: (req.user as any)?.firstName ? `${(req.user as any).firstName} ${(req.user as any).lastName || ""}`.trim() : "Unknown",
      });
      const origQuestions = await storage.getSurveyQuestions(original.id);
      for (let i = 0; i < origQuestions.length; i++) {
        const q = origQuestions[i];
        await storage.createSurveyQuestion({ ...q, id: undefined as any, surveyId: copy.id, questionOrder: i + 1 });
      }
      const fullCopy = await storage.getSurvey(copy.id);
      res.json(fullCopy);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Questions
  app.post("/api/surveys/:id/questions", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const surveyId = Number(req.params.id);
      const existing = await storage.getSurveyQuestions(surveyId);
      const question = await storage.createSurveyQuestion({
        ...req.body,
        surveyId,
        questionOrder: existing.length + 1,
      });
      res.json(question);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/surveys/questions/:qid", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const q = await storage.updateSurveyQuestion(Number(req.params.qid), req.body);
      if (!q) return res.status(404).json({ message: "Not found" });
      res.json(q);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/surveys/questions/:qid", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      await storage.deleteSurveyQuestion(Number(req.params.qid));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/surveys/:id/questions/reorder", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { orderedIds } = req.body;
      await storage.reorderSurveyQuestions(Number(req.params.id), orderedIds);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Responses
  app.get("/api/surveys/:id/responses", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const responses = await storage.getSurveyResponses(Number(req.params.id));
      res.json(responses);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Seed Data
  seedDatabase().catch(console.error);

  return httpServer;
}

async function seedDatabase() {
  const existingModules = await storage.getModules();
  if (existingModules.length === 0) {
    console.log("Seeding modules...");
    const modulesToSeed = [
      { key: "business-mgmt", name: "Business Management", icon: "Briefcase", description: "Strategic planning, business operations, and organizational management" },
      { key: "crm", name: "CRM", icon: "Contact", description: "Customer relationship management and sales pipeline tracking" },
      { key: "doc-mgmt", name: "Document Management", icon: "FileText", description: "Document storage, version control, and collaboration" },
      { key: "task-mgmt", name: "Task Management", icon: "CheckSquare", description: "Task tracking, assignments, and workflow management" },
      { key: "portfolio-mgmt", name: "Portfolio Management", icon: "PieChart", description: "Project portfolio oversight and resource allocation" },
      { key: "project-mgmt", name: "Project/Program Management", icon: "Kanban", description: "Full project lifecycle management and program delivery" },
      { key: "finance-mgmt", name: "Finance Management", icon: "DollarSign", description: "Budgeting, invoicing, and financial reporting" },
      { key: "resource-mgmt", name: "Resource Management", icon: "Users", description: "Team capacity planning and resource allocation" },
      { key: "test-mgmt", name: "Test Management", icon: "TestTube", description: "Test case management, execution, and defect tracking" },
      { key: "bpm", name: "BPM Business Process Management", icon: "Workflow", description: "Process modeling, automation, and optimization" },
      { key: "help-desk", name: "Help Desk / Service Management", icon: "Headphones", description: "IT service desk, ticketing, and support management" },
      { key: "utilities", name: "Utilities", icon: "Wrench", description: "Chat, Whiteboarding, Templates, Surveys, eSign" },
    ];

    for (const m of modulesToSeed) {
      await storage.createModule(m);
    }
    console.log("Module catalogue seeded.");
  }

  if (process.env.SEED_DEMO_TENANT !== "true") {
    return;
  }

  const existingTenants = await storage.getTenants();
  if (existingTenants.length > 0) {
    return;
  }

  console.log("Seeding demo tenant (SEED_DEMO_TENANT=true)...");
  // Optional dev sample tenant — not created on a normal first-time setup.
  const tenant = await storage.createTenant({
      name: "Demo Corp",
      slug: "demo",
      country: "USA",
    });
    const { ensureCommercialProfileForTenant } = await import(
      "./customer-management/provision"
    );
    await ensureCommercialProfileForTenant(tenant);

    // Create a demo board
    const demoModule = (await storage.getModules()).find(m => m.key === "project-mgmt")!;
    const board = await storage.createBoard({
      tenantId: tenant.id,
      moduleId: demoModule.id,
      name: "Q1 Strategic Initiatives",
      type: "project",
    });

    // Create columns
    await storage.createColumn({ boardId: board.id, title: "Task Name", key: "title", type: "text", order: 0 });
    await storage.createColumn({ boardId: board.id, title: "Status", key: "status", type: "status", order: 1, options: ["To Do", "In Progress", "Done"] });
    await storage.createColumn({ boardId: board.id, title: "Owner", key: "owner", type: "person", order: 2 });
    await storage.createColumn({ boardId: board.id, title: "Due Date", key: "dueDate", type: "date", order: 3 });

    // Create items
    await storage.createItem({ 
      boardId: board.id, 
      values: { title: "Stakeholder Analysis", status: "Done", owner: "Alice", dueDate: "2024-02-15" } 
    });
    await storage.createItem({ 
      boardId: board.id, 
      values: { title: "Communication Plan", status: "In Progress", owner: "Bob", dueDate: "2024-03-01" } 
    });
    
    // Create default chat channels
    await storage.createChannel({
      tenantId: tenant.id,
      name: "general",
      description: "General company-wide discussions",
      type: "public",
      isDefault: true,
    });
    await storage.createChannel({
      tenantId: tenant.id,
      name: "announcements",
      description: "Important company announcements",
      type: "public",
    });
    await storage.createChannel({
      tenantId: tenant.id,
      name: "random",
      description: "Off-topic conversations and fun",
      type: "public",
    });

    // Create default CRM opportunity stages
    const stages = [
      { name: "Qualification", order: 0, probability: 10, color: "#6366f1", isClosed: false, isWon: false },
      { name: "Needs Analysis", order: 1, probability: 20, color: "#8b5cf6", isClosed: false, isWon: false },
      { name: "Proposal", order: 2, probability: 50, color: "#a855f7", isClosed: false, isWon: false },
      { name: "Negotiation", order: 3, probability: 75, color: "#d946ef", isClosed: false, isWon: false },
      { name: "Closed Won", order: 4, probability: 100, color: "#22c55e", isClosed: true, isWon: true },
      { name: "Closed Lost", order: 5, probability: 0, color: "#ef4444", isClosed: true, isWon: false },
    ];
    for (const stage of stages) {
      await storage.createCrmOpportunityStage({ ...stage, tenantId: tenant.id });
    }

    // Seed RACI Types
    console.log("Seeding RACI types...");
    const raciTypes = [
      { code: "R", name: "Responsible", description: "Performs the work to complete the task", color: "#3b82f6", sortOrder: 1 },
      { code: "A", name: "Accountable", description: "Ultimate accountability for task completion", color: "#ef4444", sortOrder: 2 },
      { code: "C", name: "Consulted", description: "Provides input and expertise", color: "#f59e0b", sortOrder: 3 },
      { code: "I", name: "Informed", description: "Kept informed of progress", color: "#22c55e", sortOrder: 4 },
    ];
    for (const raciType of raciTypes) {
      await storage.createPmRaciType({ ...raciType, tenantId: tenant.id });
    }

    // Seed Projects Module Data
    console.log("Seeding Projects Module data...");
    
    // Create a Portfolio
    const portfolio1 = await storage.createPmPortfolio({
      tenantId: tenant.id,
      name: "Digital Transformation Portfolio",
      description: "Strategic initiatives for enterprise digital transformation",
      status: "active",
      ragStatus: "green",
      budget: "5000000",
      startDate: "2024-01-01",
      endDate: "2025-12-31",
    });

    // Create Programs under the portfolio
    const program1 = await storage.createPmProgram({
      tenantId: tenant.id,
      portfolioId: portfolio1.id,
      name: "Cloud Migration Program",
      description: "Migrate on-premises infrastructure to cloud",
      status: "active",
      ragStatus: "amber",
      budget: "2000000",
      startDate: "2024-01-15",
      endDate: "2024-12-31",
    });

    const program2 = await storage.createPmProgram({
      tenantId: tenant.id,
      portfolioId: portfolio1.id,
      name: "Customer Experience Program",
      description: "Improve customer-facing digital experiences",
      status: "active",
      ragStatus: "green",
      budget: "1500000",
      startDate: "2024-03-01",
      endDate: "2025-06-30",
    });

    // Create Projects
    const project1 = await storage.createPmProject({
      tenantId: tenant.id,
      portfolioId: portfolio1.id,
      programId: program1.id,
      code: "PRJ-001",
      name: "AWS Migration Phase 1",
      description: "Migrate core business applications to AWS",
      projectType: "large_project",
      methodology: "hybrid",
      status: "active",
      ragStatus: "green",
      priority: "high",
      progress: 45,
      budget: "800000",
      spentBudget: "360000",
      startDate: "2024-02-01",
      endDate: "2024-08-31",
      enableRisks: true,
      enableIssues: true,
      enableDependencies: true,
    });

    const project2 = await storage.createPmProject({
      tenantId: tenant.id,
      portfolioId: portfolio1.id,
      programId: program1.id,
      code: "PRJ-002",
      name: "Database Modernization",
      description: "Upgrade legacy databases to cloud-native solutions",
      projectType: "large_project",
      methodology: "waterfall",
      status: "planning",
      ragStatus: "amber",
      priority: "high",
      progress: 15,
      budget: "500000",
      startDate: "2024-04-01",
      endDate: "2024-10-31",
      enableRisks: true,
      enableAssumptions: true,
    });

    const project3 = await storage.createPmProject({
      tenantId: tenant.id,
      portfolioId: portfolio1.id,
      programId: program2.id,
      code: "PRJ-003",
      name: "Mobile App Redesign",
      description: "Complete redesign of customer mobile application",
      projectType: "large_project",
      methodology: "agile",
      status: "active",
      ragStatus: "green",
      priority: "critical",
      progress: 65,
      budget: "600000",
      spentBudget: "390000",
      startDate: "2024-01-15",
      endDate: "2024-06-30",
      enableRisks: true,
      enableDecisions: true,
    });

    // Create a standalone project not in any program
    await storage.createPmProject({
      tenantId: tenant.id,
      code: "PRJ-004",
      name: "Office IT Refresh",
      description: "Replace aging office IT equipment",
      projectType: "small_project",
      methodology: "waterfall",
      status: "active",
      ragStatus: "green",
      priority: "medium",
      progress: 30,
      budget: "150000",
      startDate: "2024-03-01",
      endDate: "2024-05-31",
    });

    // Create project phases for project 1 (Wagile - some waterfall, some agile)
    await storage.createPmProjectPhase({
      tenantId: 1,
      projectId: project1.id,
      name: "Discovery & Planning",
      phaseNumber: 1,
      description: "Initial discovery and detailed planning",
      methodology: "waterfall",
      status: "completed",
      progress: 100,
      plannedStartDate: "2024-02-01",
      plannedEndDate: "2024-02-28",
      order: 1,
    });

    await storage.createPmProjectPhase({
      tenantId: 1,
      projectId: project1.id,
      name: "Infrastructure Setup",
      phaseNumber: 2,
      description: "AWS infrastructure provisioning",
      methodology: "waterfall",
      status: "completed",
      progress: 100,
      plannedStartDate: "2024-03-01",
      plannedEndDate: "2024-03-31",
      order: 2,
    });

    await storage.createPmProjectPhase({
      tenantId: 1,
      projectId: project1.id,
      name: "Application Migration Sprint 1",
      phaseNumber: 3,
      description: "Migrate first batch of applications",
      methodology: "agile",
      status: "in_progress",
      progress: 60,
      plannedStartDate: "2024-04-01",
      plannedEndDate: "2024-05-15",
      order: 3,
    });

    // Create RAIDD items for project 1
    await storage.createPmRaiddItem({
      tenantId: 1,
      projectId: project1.id,
      type: "risk",
      title: "Data migration complexity",
      description: "Legacy data formats may require extensive transformation",
      status: "open",
      impact: "high",
      likelihood: "medium",
      mitigation: "Conduct detailed data profiling before migration",
    });

    await storage.createPmRaiddItem({
      tenantId: 1,
      projectId: project1.id,
      type: "issue",
      title: "Network bandwidth constraints",
      description: "Current network capacity may slow data transfer",
      status: "open",
      impact: "medium",
      response: "Upgrade network link before major data migration phase",
    });

    await storage.createPmRaiddItem({
      tenantId: 1,
      projectId: project1.id,
      type: "dependency",
      title: "Security team approval",
      description: "Cloud security review required before go-live",
      status: "open",
    });

    // Create phases for project 3 (Agile sprints)
    for (let i = 1; i <= 6; i++) {
      await storage.createPmProjectPhase({
        tenantId: 1,
        projectId: project3.id,
        name: `Sprint ${i}`,
        phaseNumber: i,
        description: `Two-week development sprint ${i}`,
        methodology: "agile",
        status: i <= 4 ? "completed" : i === 5 ? "in_progress" : "not_started",
        progress: i <= 4 ? 100 : i === 5 ? 50 : 0,
        plannedStartDate: `2024-0${Math.floor((i - 1) / 2) + 2}-${((i - 1) % 2) * 15 + 1 < 10 ? '0' : ''}${((i - 1) % 2) * 15 + 1}`,
        plannedEndDate: `2024-0${Math.floor((i - 1) / 2) + 2}-${((i - 1) % 2) * 15 + 14}`,
        order: i,
      });
    }
    
    console.log("Demo tenant seeding complete.");
}
