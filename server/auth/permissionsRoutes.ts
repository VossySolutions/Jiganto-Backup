import type { Express } from "express";
import { isAuthenticated } from "./setupAuth";
import {
  resolveUserPermissions,
  resolveSessionOrgId,
  parseRequestedOrgId,
} from "../lib/permissions";
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLE_DESCRIPTIONS,
} from "@shared/models/permissions";
import { storage } from "../storage";
import { resolveVisibleModuleKeys } from "../lib/module-access";
import { workspaceClientId } from "../lib/workspace-access";

export function registerPermissionsRoutes(app: Express): void {
  /** Role catalogue for admin UI (Section 3). */
  app.get("/api/auth/roles", (_req, res) => {
    res.json(
      PLATFORM_ROLES.map((id) => ({
        id,
        label: PLATFORM_ROLE_LABELS[id],
        description: PLATFORM_ROLE_DESCRIPTIONS[id],
      })),
    );
  });

  /** Session permissions for navigation & API (Section 3.1). */
  app.get("/api/auth/session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requested = parseRequestedOrgId(req.query);
      const orgId = await resolveSessionOrgId(userId, requested);
      if (orgId == null) {
        return res.status(403).json({
          message: "No organisation linked to this account.",
          code: "ACCESS_PENDING",
        });
      }

      const permissions = await resolveUserPermissions(userId, orgId);
      let resourceScope: Awaited<ReturnType<typeof import("../resources/permissions").resolveResourceScope>> | undefined;
      try {
        const { resolveResourceScope } = await import("../resources/permissions");
        resourceScope = await resolveResourceScope(userId, orgId, permissions.platformRole);
      } catch {
        /* resources tables may not exist yet */
      }
      res.json({
        permissions,
        resourceScope,
        workspace: req.workspace
          ? {
              mode: req.workspace.mode,
              clientId: req.workspace.clientId,
              workspaceId: req.workspace.clientId,
              canViewPmoMaster: req.workspace.canViewPmoMaster,
              client: req.workspace.client
                ? {
                    id: req.workspace.client.id,
                    name: req.workspace.client.name,
                    slug: req.workspace.client.slug,
                    shortCode: req.workspace.client.shortCode,
                    color: req.workspace.client.color,
                    status: req.workspace.client.status,
                  }
                : null,
            }
          : undefined,
      });
    } catch (error) {
      console.error("Error resolving session permissions:", error);
      res.status(500).json({ message: "Failed to resolve permissions" });
    }
  });

  /** Legacy module ACL — `modules: null` means no per-module restriction. */
  app.get("/api/auth/session/modules", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requested = parseRequestedOrgId(req.query);
      const orgId = await resolveSessionOrgId(userId, requested);
      if (orgId == null) {
        return res.json({ modules: [] });
      }
      const permissions = await resolveUserPermissions(userId, orgId);
      const profile = await storage.getProfileByUserId(userId, orgId);
      if (!profile) {
        return res.json({ modules: null });
      }
      const modules = await resolveVisibleModuleKeys(
        profile.id,
        orgId,
        permissions.platformRole,
        workspaceClientId(req),
      );
      res.json({ modules });
    } catch (error) {
      console.error("Error resolving module access:", error);
      res.status(500).json({ message: "Failed to resolve module access" });
    }
  });
}
