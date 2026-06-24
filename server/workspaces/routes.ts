import type { Express, Request, Response } from "express";
import { requireApiTenantId } from "../lib/api-tenant-id";
import { storage } from "../storage";
import * as ws from "./service";

function userId(req: Request): string | undefined {
  return req.user?.claims?.sub as string | undefined;
}

export function registerWorkspaceExtendedRoutes(app: Express): void {
  app.get("/api/workspaces/list", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const filter = (req.query.filter as import("./service").WorkspaceFilter | undefined) || "all";
      const list = await ws.getWorkspacesForUser(tenantId, uid, filter);
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspaces/:id/access", async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      await ws.recordWorkspaceAccess(Number(req.params.id), uid);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspaces/:id/duplicate", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const copy = await ws.duplicateWorkspace(Number(req.params.id), uid, tenantId);
      res.json(copy);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspaces/:id/archive", async (req, res) => {
    try {
      const updated = await ws.archiveWorkspace(Number(req.params.id));
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/workspace-templates", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      await ws.seedSystemWorkspaceTemplates(tenantId);
      const templates = await ws.getWorkspaceTemplates(tenantId);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspaces/from-template/:templateId", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const workspace = await ws.createWorkspaceFromTemplate(
        tenantId,
        uid,
        Number(req.params.templateId),
        req.body,
      );
      res.json(workspace);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspaces/:id/save-as-template", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const saved = await ws.saveWorkspaceAsTemplate(Number(req.params.id), uid, tenantId, req.body);
      const { registerFromSource } = await import("../templates/register-helper");
      await registerFromSource({
        tenantId, userId: uid,
        module: "workspace", sourceModule: "workspace", sourceId: saved.id,
        name: saved.name, description: saved.description ?? undefined,
        categoryTags: saved.category ? [saved.category] : undefined,
      });
      res.json(saved);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspace-pages/:id/copy-to-documents", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const result = await ws.copyPageToDocuments(
        Number(req.params.id),
        uid,
        tenantId,
        req.body.folderId,
        req.body.status,
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/workspace-database-rows/:id/detail", async (req, res) => {
    try {
      const detail = await ws.getRowDetail(Number(req.params.id));
      if (!detail) return res.status(404).json({ message: "Row not found" });
      res.json(detail);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/workspace-database-rows/:id/comments", async (req, res) => {
    try {
      const detail = await ws.getRowDetail(Number(req.params.id));
      if (!detail) return res.status(404).json({ message: "Row not found" });
      res.json(detail.comments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/workspace-database-rows/:id/attachments", async (req, res) => {
    try {
      const detail = await ws.getRowDetail(Number(req.params.id));
      if (!detail) return res.status(404).json({ message: "Row not found" });
      res.json(detail.attachments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/workspace-database-rows/:id/activity", async (req, res) => {
    try {
      const detail = await ws.getRowDetail(Number(req.params.id));
      if (!detail) return res.status(404).json({ message: "Row not found" });
      res.json(detail.activity);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspace-database-rows/:id/comments", async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const comment = await ws.addRowComment(Number(req.params.id), uid, req.body.body, req.body.parentId);
      res.status(201).json(comment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspace-database-rows/:id/attachments", async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const attachment = await ws.addRowAttachment(Number(req.params.id), uid, req.body);
      res.status(201).json(attachment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspace-database-rows/:id/lock", async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const row = await ws.lockRow(Number(req.params.id), uid);
      if (!row) return res.status(409).json({ message: "Row is locked by another user" });
      res.json(row);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspace-database-rows/:id/unlock", async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const row = await ws.unlockRow(Number(req.params.id), uid);
      res.json(row);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspaces/:id/presence", async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const presence = await ws.updatePresence(
        Number(req.params.id),
        uid,
        req.body.editingPageId,
        req.body.editingRowId,
      );
      res.json(presence);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/workspaces/:id/presence", async (req, res) => {
    try {
      const list = await ws.getPresence(Number(req.params.id));
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/workspace-pages/:id/versions", async (req, res) => {
    try {
      const versions = await ws.getPageVersions(Number(req.params.id));
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspace-pages/:id/versions", async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const version = await ws.createPageVersion(Number(req.params.id), uid);
      res.status(201).json(version);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspace-page-versions/:id/restore", async (req, res) => {
    try {
      const page = await ws.restorePageVersion(Number(req.params.id));
      if (!page) return res.status(404).json({ message: "Version not found" });
      res.json(page);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/workspace-pages/:id/comments", async (req, res) => {
    try {
      const comments = await ws.getPageComments(Number(req.params.id));
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspace-pages/:id/comments", async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const comment = await ws.addPageComment(Number(req.params.id), uid, req.body.content, req.body.parentId);
      res.status(201).json(comment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/workspace-databases/:id/import-csv", async (req, res) => {
    try {
      const result = await ws.importCsvToDatabase(
        Number(req.params.id),
        req.body.rows || [],
        req.body.mode === "overwrite" ? "overwrite" : "append",
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/workspace-databases/:id/export-csv", async (req, res) => {
    try {
      const data = await ws.exportDatabaseCsv(Number(req.params.id));
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:projectId/tracking-board", async (req, res) => {
    try {
      const board = await ws.getProjectTrackingBoard(Number(req.params.projectId));
      res.json(board);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:projectId/tracking-board", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const board = await ws.createProjectTrackingBoard(
        Number(req.params.projectId),
        tenantId,
        uid,
        req.body.name,
      );
      res.json(board);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const moduleTrackerHandler = (moduleKey: string) => async (req: any, res: any) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const scopeRaw = req.query.scopeId ?? req.params.scopeId;
      const scopeId = scopeRaw != null && scopeRaw !== "" ? Number(scopeRaw) : null;
      const board = await ws.getModuleTrackingBoard(moduleKey, Number.isFinite(scopeId) ? scopeId : null, tenantId);
      res.json(board);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  app.get("/api/service-desk/tracking-board", moduleTrackerHandler("service-desk"));
  app.get("/api/help-desk/tracking-board", moduleTrackerHandler("help-desk"));
  app.get("/api/bpm/tracking-board", moduleTrackerHandler("bpm"));
  app.get("/api/tm/projects/:projectId/tracking-board", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const board = await ws.getModuleTrackingBoard("test-mgmt", Number(req.params.projectId), tenantId);
      res.json(board);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/workspaces/:id/members-with-users", async (req, res) => {
    try {
      const members = await ws.getMembersWithUsers(Number(req.params.id));
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/workspace-members/:id/permission", async (req, res) => {
    try {
      const updated = await ws.updateMemberPermission(Number(req.params.id), req.body.permission);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/workspace-pages/:id/public-token", async (req, res) => {
    try {
      const token = await ws.getPagePublicToken(Number(req.params.id));
      res.json({ token });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspace-pages/:id/public-token", async (req, res) => {
    try {
      const token = await ws.createPagePublicToken(Number(req.params.id));
      res.json({ token });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/workspace-pages/:id/public-token", async (req, res) => {
    try {
      await ws.revokePagePublicToken(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/workspace-database-rows/:id/public-token", async (req, res) => {
    try {
      const token = await ws.getRowPublicToken(Number(req.params.id));
      res.json({ token });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workspace-database-rows/:id/public-token", async (req, res) => {
    try {
      const token = await ws.createRowPublicToken(Number(req.params.id));
      res.json({ token });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/workspace-database-rows/:id/public-token", async (req, res) => {
    try {
      await ws.revokeRowPublicToken(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/workspaces/:id/my-permission", async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const permission = await ws.getMemberPermissionForUser(Number(req.params.id), uid);
      res.json({ permission: permission ?? "admin" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/workspace-databases/:id/export-xlsx", async (req, res) => {
    try {
      const data = await ws.exportDatabaseCsv(Number(req.params.id));
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Data");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="workspace-export.xlsx"');
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}

// Re-export filter type for route handler
export type { WorkspaceFilter } from "./service";
