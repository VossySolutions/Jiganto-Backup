import type { Express } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { storage } from "../storage";
import { isAuthenticated } from "./setupAuth";
import {
  orgMemberships,
  clientWorkspaceGrants,
  insertOrgMembershipSchema,
  PLATFORM_ROLES,
  isImmutablePlatformRole,
  type PlatformRole,
} from "@shared/models/permissions";
import { users } from "@shared/models/auth";
import { requireOrgAdmin } from "../lib/workspace-access";
import { permissionCache } from "../lib/permissions-cache";
import { logOrgAuditEvent } from "../lib/org-audit";

const grantSchema = z.object({
  tenantId: z.number().int().positive(),
  userId: z.string().min(1),
  clientId: z.number().int().positive(),
});

export function registerOrgMembershipRoutes(app: Express): void {
  /** List platform role memberships for an org (admin only). */
  app.get("/api/org-memberships", isAuthenticated, async (req, res) => {
    if (!requireOrgAdmin(req, res)) return;
    try {
      const orgId = Number(req.query.orgId ?? req.query.tenantId) || 1;
      const rows = await db
        .select({
          membership: orgMemberships,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(orgMemberships)
        .leftJoin(users, eq(orgMemberships.userId, users.id))
        .where(eq(orgMemberships.orgId, orgId));

      const grants = await db
        .select()
        .from(clientWorkspaceGrants)
        .where(eq(clientWorkspaceGrants.tenantId, orgId));

      res.json({
        memberships: rows.map((r) => ({
          ...r.membership,
          user: {
            id: r.membership.userId,
            email: r.email,
            firstName: r.firstName,
            lastName: r.lastName,
          },
        })),
        workspaceGrants: grants,
        platformRoles: PLATFORM_ROLES,
      });
    } catch (e: unknown) {
      res.status(500).json({ message: (e as Error).message });
    }
  });

  app.post("/api/org-memberships", isAuthenticated, async (req, res) => {
    if (!requireOrgAdmin(req, res)) return;
    try {
      const parsed = insertOrgMembershipSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message });
      }
      if (!(PLATFORM_ROLES as readonly string[]).includes(parsed.data.platformRole)) {
        return res.status(400).json({ message: "Invalid platform role" });
      }
      const [row] = await db.insert(orgMemberships).values(parsed.data).returning();
      permissionCache.invalidate(parsed.data.userId);
      const actorUserId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
      if (actorUserId) {
        await logOrgAuditEvent({
          orgId: parsed.data.orgId,
          actorUserId,
          action: "membership.created",
          targetUserId: parsed.data.userId,
          metadata: {
            platformRole: parsed.data.platformRole,
            lockedWorkspaceId: parsed.data.lockedWorkspaceId,
          },
        });
      }
      res.status(201).json(row);
    } catch (e: unknown) {
      res.status(500).json({ message: (e as Error).message });
    }
  });

  app.patch("/api/org-memberships/:id", isAuthenticated, async (req, res) => {
    if (!requireOrgAdmin(req, res)) return;
    try {
      const id = Number(req.params.id);
      const [existing] = await db
        .select()
        .from(orgMemberships)
        .where(eq(orgMemberships.id, id))
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Membership not found" });

      const updates: Record<string, unknown> = {};
      if (req.body.platformRole !== undefined) {
        if (!(PLATFORM_ROLES as readonly string[]).includes(req.body.platformRole)) {
          return res.status(400).json({ message: "Invalid platform role" });
        }
        const nextRole = req.body.platformRole as PlatformRole;
        if (
          isImmutablePlatformRole(existing.platformRole as PlatformRole) ||
          isImmutablePlatformRole(nextRole)
        ) {
          return res.status(403).json({
            message: "This organisation administrator role cannot be changed.",
          });
        }
        updates.platformRole = nextRole;
      }
      if (req.body.lockedWorkspaceId !== undefined) {
        updates.lockedWorkspaceId = req.body.lockedWorkspaceId;
      }
      if (req.body.isActive !== undefined) updates.isActive = !!req.body.isActive;

      const [row] = await db
        .update(orgMemberships)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(orgMemberships.id, id))
        .returning();
      if (!row) return res.status(404).json({ message: "Membership not found" });
      permissionCache.invalidate(row.userId);
      const actorUserId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
      if (actorUserId) {
        await logOrgAuditEvent({
          orgId: row.orgId,
          actorUserId,
          action: "membership.updated",
          targetUserId: row.userId,
          metadata: updates,
        });
      }
      res.json(row);
    } catch (e: unknown) {
      res.status(500).json({ message: (e as Error).message });
    }
  });

  app.delete("/api/org-memberships/:id", isAuthenticated, async (req, res) => {
    if (!requireOrgAdmin(req, res)) return;
    try {
      const id = Number(req.params.id);
      const [existing] = await db
        .select()
        .from(orgMemberships)
        .where(eq(orgMemberships.id, id))
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Membership not found" });

      if (isImmutablePlatformRole(existing.platformRole as PlatformRole)) {
        return res.status(403).json({
          message: "This organisation administrator role cannot be removed.",
        });
      }

      const [row] = await db
        .delete(orgMemberships)
        .where(eq(orgMemberships.id, id))
        .returning();
      if (!row) return res.status(404).json({ message: "Membership not found" });
      permissionCache.invalidate(row.userId);
      const actorUserId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
      if (actorUserId) {
        await logOrgAuditEvent({
          orgId: row.orgId,
          actorUserId,
          action: "membership.deleted",
          targetUserId: row.userId,
          metadata: { platformRole: row.platformRole },
        });
      }
      res.status(204).send();
    } catch (e: unknown) {
      res.status(500).json({ message: (e as Error).message });
    }
  });

  /** Grant SI user access to a specific client workspace. */
  app.post("/api/client-workspace-grants", isAuthenticated, async (req, res) => {
    if (!requireOrgAdmin(req, res)) return;
    try {
      const parsed = grantSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message });
      }
      const client = await storage.getClientById(parsed.data.clientId, parsed.data.tenantId);
      if (!client) return res.status(404).json({ message: "Client workspace not found" });

      const [existing] = await db
        .select()
        .from(clientWorkspaceGrants)
        .where(
          and(
            eq(clientWorkspaceGrants.userId, parsed.data.userId),
            eq(clientWorkspaceGrants.clientId, parsed.data.clientId),
          ),
        )
        .limit(1);
      if (existing) return res.status(409).json({ message: "Grant already exists" });

      const [row] = await db.insert(clientWorkspaceGrants).values(parsed.data).returning();
      permissionCache.invalidate(parsed.data.userId);
      res.status(201).json(row);
    } catch (e: unknown) {
      res.status(500).json({ message: (e as Error).message });
    }
  });

  app.delete("/api/client-workspace-grants/:id", isAuthenticated, async (req, res) => {
    if (!requireOrgAdmin(req, res)) return;
    try {
      const [row] = await db
        .delete(clientWorkspaceGrants)
        .where(eq(clientWorkspaceGrants.id, Number(req.params.id)))
        .returning();
      if (!row) return res.status(404).json({ message: "Grant not found" });
      permissionCache.invalidate(row.userId);
      const actorUserId = (req.user as { claims?: { sub?: string } })?.claims?.sub;
      if (actorUserId) {
        await logOrgAuditEvent({
          orgId: row.tenantId,
          actorUserId,
          action: "workspace_grant.deleted",
          targetUserId: row.userId,
          metadata: { clientId: row.clientId },
        });
      }
      res.status(204).send();
    } catch (e: unknown) {
      res.status(500).json({ message: (e as Error).message });
    }
  });
}
