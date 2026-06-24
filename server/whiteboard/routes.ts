import type { Express, Request } from "express";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import { requireApiTenantId } from "../lib/api-tenant-id";
import { resolveListClientId } from "../lib/list-client-id";
import * as wb from "./service";
import { getWhiteboardWebSocket } from "./websocket";

function isAuth(req: Request) {
  return isRequestAuthenticated(req);
}

function getUser(req: Request) {
  return req.user as { id?: string; claims?: { sub?: string }; firstName?: string; lastName?: string; email?: string };
}

function userId(req: Request) {
  const u = getUser(req);
  return u.id ?? u.claims?.sub ?? "";
}

function userName(req: Request) {
  const u = getUser(req);
  return u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email ?? "Unknown");
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function broadcastNoteEvent(whiteboardId: number, type: string, payload: Record<string, unknown>) {
  const wss = getWhiteboardWebSocket();
  wss?.sendToBoard(whiteboardId, { type, payload });
}

export function registerWhiteboardRoutes(app: Express) {
  // Public share link access
  app.get("/api/whiteboard/share/:token", async (req, res) => {
    try {
      const result = await wb.getWhiteboardByShareToken(req.params.token);
      if (!result) return res.status(404).json({ message: "Link not found or expired" });
      const { board, share } = result;
      res.json({
        id: board.id,
        name: board.name,
        description: board.description,
        permission: share.permission,
        allowAnonymous: share.allowAnonymous,
      });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/whiteboard/share/:token/detail", async (req, res) => {
    try {
      const detail = await wb.getWhiteboardDetailByShareToken(req.params.token);
      if (!detail) return res.status(404).json({ message: "Link not found or expired" });
      res.json(detail);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/whiteboard", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const list = await wb.listWhiteboards(tenantId, userId(req), {
        filter: req.query.filter as string | undefined,
        sort: req.query.sort as string | undefined,
        search: req.query.search as string | undefined,
        projectId: req.query.projectId ? Number(req.query.projectId) : undefined,
      });
      res.json(list);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/whiteboard", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const workspaceId = resolveListClientId(req);
      const { name, description, projectId } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
      const board = await wb.createWhiteboard(tenantId, userId(req), userName(req), {
        name: name.trim().slice(0, 80),
        description: description?.trim().slice(0, 300),
        projectId: projectId ?? null,
        workspaceId,
      });
      res.status(201).json(board);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/whiteboard/users/search", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const q = String(req.query.q ?? "");
      if (q.length < 2) return res.json([]);
      const users = await wb.searchOrgUsers(tenantId, q);
      res.json(users);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/whiteboard/:id", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });
      const detail = await wb.getWhiteboardDetail(id, userId(req));
      if (!detail) return res.status(404).json({ message: "Not found or access denied" });
      await wb.logUserJoined(id, userId(req), userName(req));
      res.json(detail);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.patch("/api/whiteboard/:id", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });
      const updated = await wb.updateWhiteboard(id, userId(req), userName(req), req.body);
      res.json(updated);
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });

  app.delete("/api/whiteboard/:id", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });
      await wb.deleteWhiteboard(id, userId(req));
      res.json({ success: true });
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });

  app.post("/api/whiteboard/:id/notes", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });
      const note = await wb.createNote(id, userId(req), userName(req), req.body);
      broadcastNoteEvent(id, "note:created", { note });
      res.status(201).json(note);
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });

  app.patch("/api/whiteboard/notes/:noteId", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const noteId = parseId(req.params.noteId);
      if (!noteId) return res.status(400).json({ message: "Invalid id" });
      const note = await wb.updateNote(noteId, userId(req), userName(req), req.body);
      const eventType = req.body.xPosition != null || req.body.yPosition != null ? "note:moved" : "note:updated";
      broadcastNoteEvent(note.whiteboardId, eventType, { note_id: note.id, ...req.body, note });
      res.json(note);
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });

  app.delete("/api/whiteboard/notes/:noteId", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const noteId = parseId(req.params.noteId);
      if (!noteId) return res.status(400).json({ message: "Invalid id" });
      const { eq } = await import("drizzle-orm");
      const { stickyNotes } = await import("@shared/models/whiteboard");
      const { db } = await import("../db");
      const [existing] = await db.select().from(stickyNotes).where(eq(stickyNotes.id, noteId)).limit(1);
      const boardId = existing?.whiteboardId;
      await wb.deleteNote(noteId, userId(req), userName(req));
      if (boardId) broadcastNoteEvent(boardId, "note:deleted", { note_id: noteId });
      res.json({ success: true });
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });

  app.post("/api/whiteboard/notes/:noteId/duplicate", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const noteId = parseId(req.params.noteId);
      if (!noteId) return res.status(400).json({ message: "Invalid id" });
      const note = await wb.duplicateNote(noteId, userId(req), userName(req));
      broadcastNoteEvent(note.whiteboardId, "note:created", { note });
      res.status(201).json(note);
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });

  app.post("/api/whiteboard/notes/bulk-delete", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { noteIds, whiteboardId } = req.body;
      if (!Array.isArray(noteIds) || !noteIds.length) return res.status(400).json({ message: "noteIds required" });
      await wb.bulkDeleteNotes(noteIds, userId(req), userName(req));
      if (whiteboardId) {
        for (const nid of noteIds) broadcastNoteEvent(whiteboardId, "note:deleted", { note_id: nid });
      }
      res.json({ success: true });
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });

  app.get("/api/whiteboard/:id/activity", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });
      const activity = await wb.listActivity(id, userId(req), {
        userId: req.query.userId as string | undefined,
        eventType: req.query.eventType as string | undefined,
      });
      res.json(activity);
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });

  app.get("/api/whiteboard/:id/members", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });
      const detail = await wb.listMembers(id, userId(req));
      res.json(detail);
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });

  app.post("/api/whiteboard/:id/members", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });
      const { userId: targetUserId, permission } = req.body;
      const member = await wb.addMember(id, userId(req), targetUserId, permission ?? "edit");
      res.status(201).json(member);
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });

  app.delete("/api/whiteboard/:id/members/:memberUserId", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });
      await wb.removeMember(id, userId(req), req.params.memberUserId);
      res.json({ success: true });
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });

  app.post("/api/whiteboard/:id/share-token", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });
      const { permission, allowAnonymous } = req.body;
      const token = await wb.createShareToken(id, userId(req), permission ?? "view", !!allowAnonymous);
      res.status(201).json(token);
    } catch (e: unknown) { res.status(403).json({ message: (e as Error).message }); }
  });
}
