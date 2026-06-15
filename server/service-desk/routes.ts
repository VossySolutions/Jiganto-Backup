import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import { effectiveUserId } from "../auth/impersonationRoutes";
import { requireApiTenantId } from "../lib/api-tenant-id";
import { resolveListClientId } from "../lib/list-client-id";
import * as sd from "./service";

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

function sdHandler(
  fn: (req: Request, res: Response) => Promise<unknown>,
): RequestHandler {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error("[service-desk]", err);
      if (!res.headersSent) {
        res.status(500).json({ message: (err as Error).message ?? "Service desk error" });
      }
    }
  };
}

const createTicketSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["incident", "service_request", "change_request", "question", "defect"]),
  priority: z.enum(["p1", "p2", "p3", "p4"]).optional(),
  description: z.unknown().optional(),
  category: z.string().optional(),
  serviceId: z.number().optional(),
  customFields: z.record(z.unknown()).optional(),
  clientId: z.number().nullable().optional(),
  projectId: z.number().nullable().optional(),
  source: z.enum(["service_desk", "help_desk"]).optional(),
  changeJustification: z.string().optional(),
  changeRiskAssessment: z.string().optional(),
  changeRollbackPlan: z.string().optional(),
  changeImplementationDate: z.string().optional(),
});

export function registerServiceDeskRoutes(app: Express): void {
  app.get("/api/service-desk/dashboard", sdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const clientId = resolveListClientId(req);
    res.json(await sd.loadServiceDeskDashboard(tid, clientId));
  }));

  app.get("/api/service-desk/tickets", sdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    res.json(
      await sd.listTickets(tid, {
        source: "service_desk",
        type: (req.query.type as sd.TicketFilters["type"]) ?? "all",
        priority: (req.query.priority as sd.TicketFilters["priority"]) ?? "all",
        status: (req.query.status as string) ?? "all",
        slaFilter: (req.query.slaFilter as sd.TicketFilters["slaFilter"]) ?? "all",
        agentFilter: (req.query.agentFilter as sd.TicketFilters["agentFilter"]) ?? "all",
        clientId: resolveListClientId(req),
        search: req.query.search as string | undefined,
        view: req.query.view as "list" | "calendar" | undefined,
        userId: uid ?? undefined,
      }),
    );
  }));

  app.get("/api/service-desk/tickets/:id", sdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const detail = await sd.getTicketDetail(tid, id);
    if (!detail) return res.status(404).json({ message: "Ticket not found" });
    res.json(detail);
  }));

  app.post("/api/service-desk/tickets", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    try {
      const body = createTicketSchema.parse(req.body);
      const clientId = body.clientId ?? resolveListClientId(req) ?? undefined;
      const ticket = await sd.createTicket(tid, uid, {
        title: body.title,
        type: body.type,
        priority: body.priority,
        description: body.description,
        category: body.category,
        serviceId: body.serviceId,
        customFields: body.customFields,
        clientId,
        projectId: body.projectId ?? undefined,
        source: "service_desk",
        changeJustification: body.changeJustification,
        changeRiskAssessment: body.changeRiskAssessment,
        changeRollbackPlan: body.changeRollbackPlan,
        changeImplementationDate: body.changeImplementationDate,
      });
      res.status(201).json(ticket);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0]?.message });
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.post("/api/service-desk/services/:serviceId/request", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const serviceId = parseId(req.params.serviceId);
    if (!serviceId) return res.status(400).json({ message: "Invalid service id" });
    try {
      const { title, description, priority, customFields } = req.body;
      const ticket = await sd.createTicket(tid, uid, {
        title: title ?? "Service request",
        type: "service_request",
        priority: priority ?? "p3",
        description,
        serviceId,
        customFields,
        clientId: resolveListClientId(req) ?? undefined,
        source: "service_desk",
      });
      res.status(201).json(ticket);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.patch("/api/service-desk/tickets/:id", async (req, res) => {
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

  app.post("/api/service-desk/tickets/:id/status", async (req, res) => {
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

  app.post("/api/service-desk/tickets/:id/comments", async (req, res) => {
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

  app.post("/api/service-desk/tickets/:id/time-logs", async (req, res) => {
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

  app.post("/api/service-desk/tickets/:id/cab-review", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const result = await sd.submitCabReview(tid, id, uid, req.body.decision, req.body.comments);
    if (!result) return res.status(404).json({ message: "Ticket not found" });
    res.json(result);
  });

  app.post("/api/service-desk/tickets/:id/attachments", sdHandler(async (req, res) => {
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

  app.get("/api/service-desk/catalogue", sdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await sd.listServices(tid, resolveListClientId(req), { admin: req.query.admin === "1" }));
  }));

  app.post("/api/service-desk/categories", sdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.status(201).json(await sd.upsertCategory(tid, req.body));
  }));

  app.patch("/api/service-desk/categories/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    res.json(await sd.upsertCategory(tid, req.body, id));
  });

  app.post("/api/service-desk/services", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    res.status(201).json(await sd.upsertService(tid, uid, req.body));
  });

  app.patch("/api/service-desk/services/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const uid = userId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    res.json(await sd.upsertService(tid, uid, req.body, id));
  });

  app.get("/api/service-desk/teams", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await sd.listTeams(tid));
  });

  app.post("/api/service-desk/teams", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.status(201).json(await sd.upsertTeam(tid, req.body));
  });

  app.patch("/api/service-desk/teams/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    res.json(await sd.upsertTeam(tid, req.body, id));
  });

  app.get("/api/service-desk/routing-rules", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await sd.listRoutingRules(tid));
  });

  app.post("/api/service-desk/routing-rules", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.status(201).json(await sd.upsertRoutingRule(tid, req.body));
  });

  app.patch("/api/service-desk/routing-rules/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    res.json(await sd.upsertRoutingRule(tid, req.body, id));
  });

  app.delete("/api/service-desk/routing-rules/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    await sd.deleteRoutingRule(tid, id);
    res.status(204).send();
  });

  app.get("/api/service-desk/sla-configs", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await sd.listSlaConfigs(tid));
  });

  app.post("/api/service-desk/sla-configs", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.status(201).json(await sd.upsertSlaConfig(tid, req.body));
  });

  app.delete("/api/service-desk/sla-configs/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    await sd.deleteSlaConfig(tid, id);
    res.status(204).send();
  });

  app.get("/api/service-desk/cab-members", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await sd.listCabMembers(tid));
  });

  app.put("/api/service-desk/cab-members", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await sd.setCabMembers(tid, req.body.memberIds ?? []));
  });

  app.get("/api/service-desk/reports/time-analysis", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await sd.getTimeAnalysisReport(tid, resolveListClientId(req)));
  });

  app.get("/api/service-desk/reports/billable-time", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const ids = req.query.ticketIds
      ? String(req.query.ticketIds).split(",").map(Number).filter(Boolean)
      : undefined;
    res.json(await sd.getBillableTimeForInvoicing(tid, ids));
  });

  app.get("/api/service-desk/settings", sdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    res.json(await sd.getOrCreateSettings(tid));
  }));

  app.post("/api/service-desk/time-logs/sync-finance", sdHandler(async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tid = tenantId(req, res);
    if (tid == null) return;
    const { syncAllUnlinkedBillableTime, syncTicketTimeLogToFinance } = await import("./finance-sync");
    if (req.body?.logId) {
      res.json(await syncTicketTimeLogToFinance(tid, Number(req.body.logId)));
    } else {
      res.json(await syncAllUnlinkedBillableTime(tid));
    }
  }));
}
