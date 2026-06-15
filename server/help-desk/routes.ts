import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import { effectiveUserId } from "../auth/impersonationRoutes";
import { requireApiTenantId } from "../lib/api-tenant-id";
import { resolveListClientId } from "../lib/list-client-id";
import * as sd from "../service-desk/service";
import * as hd from "./service";
import * as portal from "./portal";
import * as csat from "./csat";
import * as tm from "./tm-bridge";

function userId(req: Request): string | null {
  return effectiveUserId(req);
}

function tenantId(req: Request, res: Response): number | null {
  return requireApiTenantId(req, res);
}

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function hdHandler(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error("[help-desk]", err);
      if (!res.headersSent) {
        res.status(500).json({ message: (err as Error).message ?? "Help desk error" });
      }
    }
  };
}

const ticketTypeEnum = z.enum(["incident", "service_request", "change_request", "question", "defect"]);

const createTicketSchema = z.object({
  title: z.string().min(1),
  type: ticketTypeEnum,
  priority: z.enum(["p1", "p2", "p3", "p4"]).optional(),
  description: z.unknown().optional(),
  category: z.string().optional(),
  clientId: z.number().nullable().optional(),
  projectId: z.number().nullable().optional(),
  customFields: z.record(z.unknown()).optional(),
  linkedTestCaseId: z.number().nullable().optional(),
  linkedTestResultId: z.number().nullable().optional(),
  sprintPhase: z.string().optional(),
  defectSeverity: z.string().optional(),
  defectStepsToReproduce: z.string().optional(),
  defectExpectedResult: z.string().optional(),
  defectActualResult: z.string().optional(),
  defectEnvironment: z.string().optional(),
  defectBuildVersion: z.string().optional(),
  defectWorkaround: z.string().optional(),
  defectFixVersion: z.string().optional(),
});

export function registerHelpDeskRoutes(app: Express): void {
  // ── Authenticated Help Desk APIs ──────────────────────────────────────────
  app.get("/api/help-desk/dashboard", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await hd.loadHelpDeskDashboard(tid, resolveListClientId(req)));
  }));

  app.get("/api/help-desk/tickets", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    res.json(await sd.listTickets(tid, {
      source: "help_desk",
      type: (req.query.type as sd.TicketFilters["type"]) ?? "all",
      priority: (req.query.priority as sd.TicketFilters["priority"]) ?? "all",
      status: (req.query.status as string) ?? "all",
      slaFilter: (req.query.slaFilter as sd.TicketFilters["slaFilter"]) ?? "all",
      agentFilter: (req.query.agentFilter as sd.TicketFilters["agentFilter"]) ?? "all",
      clientId: resolveListClientId(req),
      search: req.query.search as string | undefined,
      userId: uid ?? undefined,
    }));
  }));

  app.get("/api/help-desk/tickets/:id", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const detail = await sd.getTicketDetail(tid, id);
    if (!detail || detail.source !== "help_desk") return res.status(404).json({ message: "Ticket not found" });
    res.json(detail);
  }));

  app.post("/api/help-desk/tickets", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    try {
      const body = createTicketSchema.parse(req.body);
      const ticket = await sd.createTicket(tid, uid, { ...body, source: "help_desk", clientId: body.clientId ?? resolveListClientId(req) ?? undefined });
      res.status(201).json(ticket);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0]?.message });
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.post("/api/help-desk/tickets/from-test-result", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    try {
      const ticket = await tm.createDefectFromTestResult(tid, uid, Number(req.body.testResultId), req.body);
      res.status(201).json(ticket);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.patch("/api/help-desk/tickets/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const updated = await sd.updateTicket(tid, id, uid, req.body);
    if (!updated) return res.status(404).json({ message: "Ticket not found" });
    res.json(updated);
  });

  app.post("/api/help-desk/tickets/:id/status", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const updated = await sd.updateTicketStatus(tid, id, uid, req.body.status, req.body.reason);
      if (!updated) return res.status(404).json({ message: "Ticket not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.post("/api/help-desk/tickets/:id/convert-to-incident", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const updated = await sd.convertDefectToIncident(tid, id, uid, req.body?.reason);
      if (!updated) return res.status(404).json({ message: "Ticket not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.post("/api/help-desk/tickets/:id/comments", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const comment = await sd.addTicketComment(tid, id, uid, req.body.body, req.body.isInternal);
    if (!comment) return res.status(404).json({ message: "Ticket not found" });
    res.status(201).json(comment);
  });

  app.post("/api/help-desk/tickets/:id/time-logs", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const log = await sd.addTimeLog(tid, id, uid, req.body);
    if (!log) return res.status(404).json({ message: "Ticket not found" });
    res.status(201).json(log);
  });

  app.post("/api/help-desk/tickets/:id/attachments", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const att = await sd.addTicketAttachment(tid, id, uid, req.body);
    if (!att) return res.status(404).json({ message: "Ticket not found" });
    res.status(201).json(att);
  }));

  app.get("/api/help-desk/sla-configs", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await sd.listSlaConfigs(tid));
  });

  app.post("/api/help-desk/sla-configs", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.status(201).json(await sd.upsertSlaConfig(tid, req.body));
  });

  app.delete("/api/help-desk/sla-configs/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    await sd.deleteSlaConfig(tid, id);
    res.status(204).send();
  });

  app.get("/api/help-desk/contracted-hours", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json({ contracts: await hd.listContractedHours(tid), usage: await hd.getContractedHoursUsage(tid, resolveListClientId(req)) });
  }));

  app.post("/api/help-desk/contracted-hours", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.status(201).json(await hd.upsertContractedHours(tid, req.body));
  }));

  app.get("/api/help-desk/maintenance-windows", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await hd.listMaintenanceWindows(tid));
  }));

  app.post("/api/help-desk/maintenance-windows", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.status(201).json(await hd.upsertMaintenanceWindow(tid, req.body));
  }));

  app.delete("/api/help-desk/maintenance-windows/:id", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    await hd.deleteMaintenanceWindow(tid, id);
    res.status(204).send();
  }));

  app.get("/api/help-desk/reports", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const days = Number(req.query.days) || 30;
    res.json(await hd.getHelpDeskReports(tid, resolveListClientId(req), days));
  }));

  app.get("/api/help-desk/reports/pdf", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const days = Number(req.query.days) || 30;
    const data = await hd.getHelpDeskReports(tid, resolveListClientId(req), days);
    const { generateHelpDeskReportPdf } = await import("./pdf-export");
    const tenant = await import("../storage").then((m) => m.storage.getTenant(tid));
    const pdf = generateHelpDeskReportPdf(data, days, tenant?.name ?? "Help Desk");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="help-desk-report-${days}d.pdf"`);
    res.send(pdf);
  }));

  app.get("/api/help-desk/projects/:projectId/tickets", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const projectId = parseId(req.params.projectId);
    if (!projectId) return res.status(400).json({ message: "Invalid project id" });
    res.json(await hd.listProjectTickets(tid, projectId));
  }));

  app.post("/api/help-desk/time-logs/sync-finance", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const { syncAllUnlinkedBillableTime, syncTicketTimeLogToFinance } = await import("../service-desk/finance-sync");
    if (req.body?.logId) {
      res.json(await syncTicketTimeLogToFinance(tid, Number(req.body.logId)));
    } else {
      res.json(await syncAllUnlinkedBillableTime(tid));
    }
  }));

  // ── Portal admin ──────────────────────────────────────────────────────────
  app.get("/api/help-desk/portal/configs", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await portal.listPortalConfigs(tid));
  }));

  app.post("/api/help-desk/portal/configs", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    res.status(201).json(await portal.upsertPortalConfig(tid, uid, req.body));
  }));

  app.patch("/api/help-desk/portal/configs/:id", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    res.json(await portal.upsertPortalConfig(tid, uid, { ...req.body, id }));
  }));

  app.get("/api/help-desk/portal/configs/:id/activity", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    res.json(await portal.getPortalActivityLog(tid, id));
  }));

  app.post("/api/help-desk/portal/configs/:id/send-invite", hdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const { email, message } = req.body ?? {};
    if (!email) return res.status(400).json({ message: "email required" });
    try {
      res.json(await portal.sendPortalAccessInvite(tid, id, email, message));
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  }));

  // ── Public portal (no auth) ───────────────────────────────────────────────
  app.get("/api/portal/:token", hdHandler(async (req, res) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const config = await portal.getPortalByToken(token);
    if (!config) return res.status(404).json({ message: "Portal not found" });
    res.json({
      portalName: config.portalName,
      customBranding: config.customBranding,
      isActive: config.isActive,
    });
  }));

  app.post("/api/portal/:token/request-code", hdHandler(async (req, res) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const result = await portal.requestPortalVerification(token, req.body.email, req.ip);
    res.status(result.ok ? 200 : 400).json(result);
  }));

  app.post("/api/portal/:token/verify", hdHandler(async (req, res) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const result = await portal.verifyPortalCode(token, req.body.email, req.body.code, req.ip);
    res.status(result.ok ? 200 : 400).json(result);
  }));

  app.get("/api/portal/:token/tickets", hdHandler(async (req, res) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const sessionToken = req.headers["x-portal-session"] as string;
    if (!sessionToken) return res.status(401).json({ message: "Session required" });
    res.json(await portal.listPortalTickets(token, sessionToken));
  }));

  app.post("/api/portal/:token/tickets", hdHandler(async (req, res) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const sessionToken = req.headers["x-portal-session"] as string;
    if (!sessionToken) return res.status(401).json({ message: "Session required" });
    try {
      const ticket = await portal.createPortalTicket(token, sessionToken, req.body, req.ip);
      res.status(201).json(ticket);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  }));

  app.get("/api/portal/:token/tickets/:ticketId", hdHandler(async (req, res) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const sessionToken = req.headers["x-portal-session"] as string;
    if (!sessionToken) return res.status(401).json({ message: "Session required" });
    const ticketId = parseId(req.params.ticketId);
    if (!ticketId) return res.status(400).json({ message: "Invalid ticket id" });
    const detail = await portal.getPortalTicketDetail(token, sessionToken, ticketId);
    if (!detail) return res.status(404).json({ message: "Ticket not found" });
    res.json(detail);
  }));

  app.post("/api/portal/:token/tickets/:ticketId/comments", hdHandler(async (req, res) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const sessionToken = req.headers["x-portal-session"] as string;
    if (!sessionToken) return res.status(401).json({ message: "Session required" });
    const ticketId = parseId(req.params.ticketId);
    if (!ticketId) return res.status(400).json({ message: "Invalid ticket id" });
    try {
      const comment = await portal.addPortalTicketComment(token, sessionToken, ticketId, req.body.body, req.ip);
      res.status(201).json(comment);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  }));

  // ── CSAT public ───────────────────────────────────────────────────────────
  app.get("/api/help-desk/csat/:token", hdHandler(async (req, res) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const result = await csat.getCsatSurveyState(token);
    res.status(result.ok ? 200 : 410).json(result);
  }));

  app.post("/api/help-desk/csat/:token", hdHandler(async (req, res) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    if (req.body?.optOut) {
      await csat.optOutCsatByToken(token);
      return res.json({ ok: true });
    }
    const result = await csat.submitCsatScore(token, Number(req.body.score), !!req.body.optOut);
    res.status(result.ok ? 200 : 400).json(result);
  }));

  // ── Test management retest hook ───────────────────────────────────────────
  app.post("/api/help-desk/retest-result", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    await tm.handleRetestResult(tid, Number(req.body.testResultId), req.body.status, uid);
    res.json({ ok: true });
  });
}
