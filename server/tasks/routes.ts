import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  insertTaskSchema,
  insertTaskSubtaskSchema,
  insertTaskViewSchema,
  taskStatusEnum,
  taskPriorityEnum,
  taskSourceEnum,
} from "@shared/models/tasks";
import { storage } from "../storage";
import { getApiTenantIdWithFallback } from "../lib/api-tenant-id";
import {
  listAggregatedTasks,
  getAggregatedTask,
  createPersonalTask,
  updateNativeTaskFields,
  deleteNativeTask,
  summarizeTasks,
  updateAggregatedTaskFields,
  listAccessibleWorkspaces,
  listAccessibleProjects,
  detectDueDateFromTitle,
  getTaskComments,
  addTaskComment,
  getTaskTimeLogs,
  addTaskTimeLog,
  getTaskAttachments,
  addTaskAttachment,
  deleteTaskAttachment,
  type TaskListFilters,
  type TaskScope,
} from "./service";
import { prioritizeTasks, summariseWeek, createTasksFromText } from "./ai";

function getUserId(req: Request): string | undefined {
  return (req as any).user?.claims?.sub ?? undefined;
}

function buildScope(req: Request): TaskScope | null {
  const userId = getUserId(req);
  if (!userId) return null;
  return {
    userId,
    tenantId: getApiTenantIdWithFallback(req),
    platformRole: req.permissions?.platformRole,
    isJigantoStaff: req.permissions?.isJigantoStaff,
    lockedWorkspaceId: req.workspace?.clientId ?? req.permissions?.lockedWorkspaceId ?? null,
  };
}

function parseFilters(req: Request): TaskListFilters {
  return {
    source: req.query.source ? String(req.query.source) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
    priority: req.query.priority ? String(req.query.priority) : undefined,
    dueDatePreset: req.query.dueDatePreset ? String(req.query.dueDatePreset) : undefined,
    projectId: req.query.projectId ? Number(req.query.projectId) : undefined,
    workspaceId: req.query.workspaceId ? Number(req.query.workspaceId) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
  };
}

function parseNativeId(compositeId: string): number | null {
  if (compositeId.startsWith("native:")) return Number(compositeId.slice(7));
  if (/^\d+$/.test(compositeId)) return Number(compositeId);
  return null;
}

export function registerTasksRoutes(app: Express) {
  app.get("/api/tasks", async (req, res) => {
    try {
      const scope = buildScope(req);
      if (!scope) return res.status(401).json({ message: "Not authenticated" });
      const items = await listAggregatedTasks(scope, parseFilters(req));
      res.json(items);
    } catch (err: any) {
      console.error("[tasks] GET /api/tasks failed:", err);
      res.status(500).json({ message: err?.message ?? "Failed to load tasks" });
    }
  });

  app.get("/api/tasks/summary", async (req, res) => {
    try {
      const scope = buildScope(req);
      if (!scope) return res.status(401).json({ message: "Not authenticated" });
      const filters = parseFilters(req);
      const items = await listAggregatedTasks(scope, filters);
      res.json(summarizeTasks(items));
    } catch (err: any) {
      console.error("[tasks] GET /api/tasks/summary failed:", err);
      res.status(500).json({ message: err?.message ?? "Failed to load summary" });
    }
  });

  app.get("/api/tasks/meta/workspaces", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    res.json(await listAccessibleWorkspaces(scope));
  });

  app.get("/api/tasks/meta/projects", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    res.json(await listAccessibleProjects(scope));
  });

  app.get("/api/tasks/views", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    res.json(await storage.getTaskViews(scope.tenantId, scope.userId));
  });

  app.post("/api/tasks/views", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const input = insertTaskViewSchema.parse({ ...req.body, userId: scope.userId, tenantId: scope.tenantId });
    res.status(201).json(await storage.createTaskView(input));
  });

  app.delete("/api/tasks/views/:id", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteTaskView(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/tasks/boards", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    res.json(await storage.getTaskBoards(scope.tenantId, clientId));
  });

  app.post("/api/tasks/ai/prioritize", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    res.json(await prioritizeTasks(scope));
  });

  app.post("/api/tasks/ai/summarise-week", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    res.json(await summariseWeek(scope));
  });

  app.post("/api/tasks/ai/from-text", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const body = z.object({ text: z.string().min(1) }).parse(req.body);
    res.json(await createTasksFromText(scope, body.text));
  });

  app.post("/api/tasks/ai/detect-due-date", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const body = z.object({ title: z.string() }).parse(req.body);
    res.json({ dueDate: detectDueDateFromTitle(body.title) });
  });

  app.get("/api/tasks/:id", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const id = String(req.params.id);
    const task = await getAggregatedTask(scope, id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  });

  app.post("/api/tasks", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    try {
      const body = req.body as Record<string, unknown>;
      const title = String(body.title ?? "").trim();
      if (!title) return res.status(400).json({ message: "Title is required" });
      let dueDate = body.dueDate ? String(body.dueDate) : undefined;
      if (!dueDate && body.title) {
        dueDate = detectDueDateFromTitle(String(body.title)) ?? undefined;
      }
      const task = await createPersonalTask(scope, {
        title,
        description: body.description ? String(body.description) : undefined,
        priority: body.priority as any,
        status: body.status as any,
        dueDate,
        startDate: body.startDate ? String(body.startDate) : undefined,
        source: body.source as any,
        assigneeId: body.assigneeId ? String(body.assigneeId) : scope.userId,
        clientId: body.clientId != null ? Number(body.clientId) : body.workspaceId != null ? Number(body.workspaceId) : undefined,
        projectId: body.projectId != null ? Number(body.projectId) : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        isPersonal: body.isPersonal != null ? Boolean(body.isPersonal) : undefined,
      });
      const aggregated = await getAggregatedTask(scope, `native:${task.id}`);
      res.status(201).json(aggregated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const id = String(req.params.id);
    const body = req.body as Record<string, unknown>;

    try {
      const nativeId = parseNativeId(id);
      if (nativeId && (body.title || body.description || body.tags || body.assigneeId)) {
        const updated = await updateNativeTaskFields(scope, nativeId, {
          title: body.title ? String(body.title) : undefined,
          description: body.description != null ? String(body.description) : undefined,
          status: body.status as any,
          priority: body.priority as any,
          dueDate: body.dueDate != null ? String(body.dueDate) : undefined,
          startDate: body.startDate != null ? String(body.startDate) : undefined,
          tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
          assigneeId: body.assigneeId ? String(body.assigneeId) : undefined,
        });
        if (!updated) return res.status(404).json({ message: "Task not found" });
        return res.json(await getAggregatedTask(scope, `native:${nativeId}`));
      }

      const updated = await updateAggregatedTaskFields(scope, id, {
        status: body.status as any,
        priority: body.priority as any,
        dueDate: body.dueDate !== undefined ? (body.dueDate ? String(body.dueDate) : null) : undefined,
      });
      if (!updated) return res.status(404).json({ message: "Task not found" });
      res.json(updated);
    } catch (err: any) {
      console.error("[tasks] PUT /api/tasks/:id failed:", err);
      res.status(400).json({ message: err?.message ?? "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const nativeId = parseNativeId(String(req.params.id));
    if (!nativeId) return res.status(400).json({ message: "Only native tasks can be deleted here" });
    const ok = await deleteNativeTask(scope, nativeId);
    if (!ok) return res.status(404).json({ message: "Task not found" });
    res.status(204).send();
  });

  app.post("/api/tasks/bulk-import", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { rows, mode = "append" } = req.body;
      const result = await storage.bulkImportTasks(scope.tenantId, rows, mode);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/tasks/:taskId/subtasks", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const nativeId = parseNativeId(String(req.params.taskId));
    if (!nativeId) return res.json([]);
    res.json(await storage.getTaskSubtasks(nativeId));
  });

  app.post("/api/tasks/:taskId/subtasks", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const nativeId = parseNativeId(String(req.params.taskId));
    if (!nativeId) return res.status(400).json({ message: "Subtasks only on native tasks" });
    const input = insertTaskSubtaskSchema.parse({ ...req.body, taskId: nativeId });
    res.status(201).json(await storage.createTaskSubtask(input));
  });

  app.put("/api/tasks/subtasks/:id", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const subtask = await storage.updateTaskSubtask(Number(req.params.id), req.body);
    if (!subtask) return res.status(404).json({ message: "Subtask not found" });
    res.json(subtask);
  });

  app.delete("/api/tasks/subtasks/:id", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteTaskSubtask(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/tasks/:taskId/comments", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const nativeId = parseNativeId(String(req.params.taskId));
    if (!nativeId) return res.json([]);
    res.json(await getTaskComments(nativeId));
  });

  app.post("/api/tasks/:taskId/comments", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const nativeId = parseNativeId(String(req.params.taskId));
    if (!nativeId) return res.status(400).json({ message: "Comments only on native tasks" });
    const body = z.object({ body: z.string().min(1), parentId: z.number().optional() }).parse(req.body);
    res.status(201).json(await addTaskComment(nativeId, scope.userId, body.body, body.parentId));
  });

  app.get("/api/tasks/:taskId/time-logs", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const nativeId = parseNativeId(String(req.params.taskId));
    if (!nativeId) return res.json([]);
    res.json(await getTaskTimeLogs(nativeId));
  });

  app.post("/api/tasks/:taskId/time-logs", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const nativeId = parseNativeId(String(req.params.taskId));
    if (!nativeId) return res.status(400).json({ message: "Time logs only on native tasks" });
    const body = z.object({ hours: z.number().positive(), notes: z.string().optional() }).parse(req.body);
    res.status(201).json(await addTaskTimeLog(nativeId, scope.userId, body.hours, body.notes));
  });

  app.get("/api/tasks/:taskId/attachments", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const nativeId = parseNativeId(String(req.params.taskId));
    if (!nativeId) return res.json([]);
    res.json(await getTaskAttachments(nativeId));
  });

  app.post("/api/tasks/:taskId/attachments", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const nativeId = parseNativeId(String(req.params.taskId));
    if (!nativeId) return res.status(400).json({ message: "Attachments only on native tasks" });
    const body = z
      .object({
        fileName: z.string(),
        fileUrl: z.string(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
      })
      .parse(req.body);
    res.status(201).json(await addTaskAttachment(nativeId, scope.userId, body));
  });

  app.delete("/api/tasks/attachments/:id", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    await deleteTaskAttachment(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/tasks/:taskId/links", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const nativeId = parseNativeId(String(req.params.taskId));
    if (!nativeId) return res.json([]);
    res.json(await storage.getTaskLinks(nativeId));
  });

  app.post("/api/tasks/:taskId/links", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const nativeId = parseNativeId(String(req.params.taskId));
    if (!nativeId) return res.status(400).json({ message: "Links only on native tasks" });
    const { insertTaskLinkSchema } = await import("@shared/models/tasks");
    const input = insertTaskLinkSchema.parse({ ...req.body, taskId: nativeId });
    res.status(201).json(await storage.createTaskLink(input));
  });

  app.delete("/api/tasks/links/:id", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteTaskLink(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/tasks/boards", async (req, res) => {
    const scope = buildScope(req);
    if (!scope) return res.status(401).json({ message: "Not authenticated" });
    const { insertTaskBoardSchema } = await import("@shared/models/tasks");
    const input = insertTaskBoardSchema.parse({ ...req.body, tenantId: scope.tenantId });
    res.status(201).json(await storage.createTaskBoard(input));
  });
}
