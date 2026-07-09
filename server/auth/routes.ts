import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./setupAuth";
import { isDevLoginEnabled, listDevPresets } from "./devLogin";
import { authMode, isSupabaseAuthEnabled } from "./supabaseAuth";
import {
  countActiveOrgMemberships,
  hasActiveOrgMembership,
} from "../lib/permissions";
import { permissionCache } from "../lib/permissions-cache";
import { bootstrapFirstOrganisationAdmin } from "./devLogin";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { userRoles } from "@shared/schema";
import { orgMemberships, PLATFORM_ROLES, type PlatformRole } from "@shared/models/permissions";
import { storage } from "../storage";
import { logOrgAuditEvent } from "../lib/org-audit";
import {
  dispatchTenantWebhook,
  invitationWebhookPayload,
} from "../lib/integration-webhook";
import { applyRoleModulePermissionsToProfile } from "../lib/module-access";

export function registerAuthRoutes(app: Express): void {
  /** Drop legacy passport dev-session cookie (Supabase JWT is the real session). */
  app.post("/api/auth/clear-dev-session", (req, res) => {
    req.logout(() => {
      req.session?.destroy(() => {
        res.status(204).end();
      });
    });
  });

  app.get("/api/auth/config", (_req, res) => {
    const mode = authMode();
    res.json({
      loginPath: "/api/login",
      mode,
      supabaseAuth: isSupabaseAuthEnabled(),
      devLogin: mode === "dev-session" && isDevLoginEnabled(),
      presets: mode === "dev-session" && isDevLoginEnabled() ? listDevPresets() : [],
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/auth/access", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const granted = await hasActiveOrgMembership(userId);
      const activeMemberships = await countActiveOrgMemberships();
      res.json({
        granted,
        bootstrapAvailable: !granted && activeMemberships === 0,
      });
    } catch (error) {
      console.error("Error resolving access:", error);
      res.status(500).json({ message: "Failed to resolve access" });
    }
  });

  app.post("/api/auth/bootstrap-admin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub as string;
      if (await hasActiveOrgMembership(userId)) {
        return res.status(400).json({ message: "You already have organisation access" });
      }
      if ((await countActiveOrgMemberships()) > 0) {
        return res.status(403).json({
          message: "An organisation administrator already exists. Ask them to invite you.",
        });
      }

      const user = await authStorage.getUser(userId);
      const organisationName =
        typeof req.body?.organisationName === "string"
          ? req.body.organisationName
          : undefined;

      const result = await bootstrapFirstOrganisationAdmin({
        userId,
        email: user?.email ?? req.user.claims?.email ?? "admin@example.com",
        firstName: user?.firstName ?? req.user.claims?.first_name ?? "Admin",
        lastName: user?.lastName ?? req.user.claims?.last_name ?? "User",
        organisationName,
      });

      permissionCache.invalidate(userId);
      res.json({ success: true, tenantId: 1, platformRole: result.platformRole });
    } catch (error) {
      console.error("Error bootstrapping admin:", error);
      res.status(500).json({ message: "Failed to set up first administrator" });
    }
  });

  /** Public: token is the secret; used to pre-fill sign-in email on the welcome page. */
  app.get("/api/auth/invitations/:token/preview", async (req, res) => {
    try {
      const token = decodeURIComponent(String(req.params.token));
      const invitation = await storage.getUserInvitationByToken(token);
      if (!invitation) return res.status(404).json({ message: "Invitation not found" });
      if (invitation.status !== "pending") {
        return res.status(400).json({
          message: "Invitation already used or cancelled",
          status: invitation.status,
        });
      }
      if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
        return res.status(400).json({ message: "Invitation expired" });
      }
      res.json({
        email: invitation.email,
        status: invitation.status,
        platformRole: invitation.platformRole ?? null,
      });
    } catch (error) {
      console.error("Error loading invitation preview:", error);
      res.status(500).json({ message: "Failed to load invitation" });
    }
  });

  app.get("/api/auth/invitations/:token", isAuthenticated, async (req: any, res) => {
    try {
      const token = decodeURIComponent(String(req.params.token));
      const invitation = await storage.getUserInvitationByToken(token);
      if (!invitation) return res.status(404).json({ message: "Invitation not found" });
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation already used or cancelled" });
      }
      if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
        return res.status(400).json({ message: "Invitation expired" });
      }
      res.json({
        email: invitation.email,
        tenantId: invitation.tenantId,
        roleId: invitation.roleId,
        platformRole: invitation.platformRole ?? null,
        lockedWorkspaceId: invitation.lockedWorkspaceId ?? null,
        status: invitation.status,
      });
    } catch (error) {
      console.error("Error loading invitation:", error);
      res.status(500).json({ message: "Failed to load invitation" });
    }
  });

  app.post("/api/auth/invitations/:token/accept", isAuthenticated, async (req: any, res) => {
    try {
      const token = decodeURIComponent(String(req.params.token));
      const userId = req.user.claims.sub as string;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const invitation = await storage.getUserInvitationByToken(token);
      if (!invitation) return res.status(404).json({ message: "Invitation not found" });
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation already used or cancelled" });
      }
      if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
        return res.status(400).json({ message: "Invitation expired" });
      }
      if (user.email && invitation.email.toLowerCase() !== user.email.toLowerCase()) {
        return res.status(403).json({ message: "Invitation email does not match signed-in user" });
      }

      // Prefer explicit platform role on invitation; fall back to legacy module role name heuristics.
      let platformRole: PlatformRole = "si_consultant_pm";
      if (invitation.platformRole && (PLATFORM_ROLES as readonly string[]).includes(invitation.platformRole)) {
        platformRole = invitation.platformRole as PlatformRole;
      } else if (invitation.roleId) {
        const [role] = await db
          .select()
          .from(userRoles)
          .where(eq(userRoles.id, invitation.roleId))
          .limit(1);
        if (role?.isAdmin) {
          platformRole = "si_super_admin";
        } else if (role?.name?.toLowerCase().includes("executive")) {
          platformRole = "client_executive";
        } else if (role?.name?.toLowerCase().includes("client")) {
          platformRole = "client_project_user";
        }
      }

      const lockedWorkspaceId = invitation.lockedWorkspaceId ?? null;

      const [existing] = await db
        .select()
        .from(orgMemberships)
        .where(and(eq(orgMemberships.userId, userId), eq(orgMemberships.orgId, invitation.tenantId)))
        .limit(1);

      if (existing) {
        await db
          .update(orgMemberships)
          .set({
            platformRole,
            lockedWorkspaceId,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(orgMemberships.id, existing.id));
      } else {
        await db.insert(orgMemberships).values({
          userId,
          orgId: invitation.tenantId,
          platformRole,
          lockedWorkspaceId,
          isActive: true,
        });
      }

      let profile = await storage.getProfileByUserId(userId, invitation.tenantId);
      if (!profile) {
        profile = await storage.createProfile({
          userId,
          tenantId: invitation.tenantId,
          roleId: invitation.roleId ?? null,
          role: platformRole === "si_super_admin" ? "admin" : "user",
          jobTitle: "Invited User",
          isActive: true,
        });
      } else if (invitation.roleId) {
        await storage.updateProfile(profile.id, { roleId: invitation.roleId });
        profile = { ...profile, roleId: invitation.roleId };
      }

      if (invitation.roleId && profile) {
        await applyRoleModulePermissionsToProfile(
          profile.id,
          invitation.tenantId,
          invitation.roleId,
        );
      }

      await storage.updateUserInvitation(invitation.id, { status: "accepted" });
      const tenant = await storage.getTenant(invitation.tenantId);
      await dispatchTenantWebhook(tenant?.brandingConfig, "invitation.accepted", {
        ...invitationWebhookPayload({
          id: invitation.id,
          email: invitation.email,
          tenantId: invitation.tenantId,
          token: invitation.token,
          platformRole: invitation.platformRole,
          roleId: invitation.roleId,
        }),
        acceptedByUserId: userId,
        platformRole,
      });
      await logOrgAuditEvent({
        orgId: invitation.tenantId,
        actorUserId: userId,
        action: "invitation.accepted",
        targetUserId: userId,
        targetEmail: invitation.email,
        metadata: { platformRole, invitationId: invitation.id },
      });
      permissionCache.invalidate(userId);
      res.json({ success: true, tenantId: invitation.tenantId, platformRole });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });
}
