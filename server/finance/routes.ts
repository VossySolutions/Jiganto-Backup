import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import { effectiveUserId } from "../auth/impersonationRoutes";
import { requireApiTenantId } from "../lib/api-tenant-id";
import { resolveListClientId } from "../lib/list-client-id";
import { generateInvoicePdf } from "./invoice-pdf";
import { pushToErp } from "./erp";
import {
  addExpenseItem,
  addRateCardItem,
  approveExpenseReport,
  approveTimesheetPm,
  approveTimesheetRm,
  createCreditNote,
  createErpIntegration,
  createExchangeRate,
  createExpenseReport,
  createInvoice,
  createProjectBudget,
  createRateCard,
  deleteErpIntegration,
  deleteExchangeRate,
  deleteExpenseItem,
  deleteExpenseReport,
  deleteRateCard,
  deleteRateCardItem,
  getExpenseReportDetail,
  getInvoiceDetail,
  getInvoicePdfData,
  getOrCreateFinanceSettings,
  getProjectBudgetDetail,
  getRateCardDetail,
  getTimesheetPeriod,
  listErpIntegrations,
  listErpSyncLog,
  listExchangeRates,
  listExpenseReports,
  listInvoices,
  listProjectBudgets,
  listRateCards,
  listTimesheetEntries,
  listTimesheetPeriods,
  loadFinanceDashboard,
  recordInvoicePayment,
  recalculateBudgetActuals,
  rejectExpenseReport,
  rejectTimesheetPeriod,
  resolveRateForProject,
  createTimesheetPeriod,
  upsertTimesheetEntry,
  deleteTimesheetEntry,
  copyTimesheetProjectsFromLastWeek,
  getUtilisationReport,
  getMissingTimesheetsReport,
  calculateMileageAmount,
  sendInvoice,
  sendInvoiceWithEmail,
  setExpenseItemReceipt,
  submitExpenseReport,
  submitTimesheetPeriod,
  updateErpIntegration,
  updateExchangeRate,
  updateExpenseItem,
  updateExpenseReport,
  updateFinanceSettings,
  updateInvoice,
  updateProjectBudget,
  updateRateCard,
  updateRateCardItem,
} from "./repository";
import { createBudgetFromResourcePlan, previewBudgetFromResourcePlan } from "./resource-plan-budget";

function getUserId(req: Request): string | null {
  return effectiveUserId(req);
}

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function zodBadRequest(res: Response, err: unknown): boolean {
  if (err instanceof z.ZodError) {
    res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
    return true;
  }
  return false;
}

function requireAuth(req: Request, res: Response): boolean {
  if (!isRequestAuthenticated(req)) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  return true;
}

function requireTenant(req: Request, res: Response): number | null {
  return requireApiTenantId(req, res);
}

const settingsPatchSchema = z.object({
  baseCurrency: z.string().min(3).max(3).optional(),
  timesheetApprovalMode: z.enum(["both", "pm_only", "rm_only"]).optional(),
  invoicePrefix: z.string().min(1).max(10).optional(),
  defaultPaymentTerms: z.string().optional(),
  orgAddress: z.string().nullable().optional(),
  orgBankDetails: z.string().nullable().optional(),
  mileageRateCar: z.union([z.string(), z.number()]).optional(),
  mileageRateMotorcycle: z.union([z.string(), z.number()]).optional(),
  mileageRateBicycle: z.union([z.string(), z.number()]).optional(),
});

const exchangeRateSchema = z.object({
  fromCurrency: z.string().min(3).max(3),
  toCurrency: z.string().min(3).max(3),
  rate: z.union([z.string(), z.number()]),
  rateDate: z.string(),
  source: z.string().optional(),
});

const budgetCreateSchema = z.object({
  projectId: z.number().int().positive(),
  clientId: z.number().int().positive().nullable().optional(),
  contractType: z.enum(["fixed_price", "time_materials", "retainer", "mixed"]).optional(),
  contractValue: z.union([z.string(), z.number()]).nullable().optional(),
  budgetCurrency: z.string().optional(),
  billingCurrency: z.string().optional(),
  labourBudget: z.union([z.string(), z.number()]).optional(),
  expenseBudget: z.union([z.string(), z.number()]).optional(),
  targetMarginPct: z.union([z.string(), z.number()]).nullable().optional(),
  rateCardId: z.number().int().positive().nullable().optional(),
  exchangeRate: z.union([z.string(), z.number()]).nullable().optional(),
  evmEnabled: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  labourLines: z.array(z.object({
    phase: z.string().nullable().optional(),
    roleName: z.string(),
    budgetedDays: z.union([z.string(), z.number()]).optional(),
    budgetedCost: z.union([z.string(), z.number()]).optional(),
  })).optional(),
  expenseLines: z.array(z.object({
    category: z.string(),
    budgetedAmount: z.union([z.string(), z.number()]).optional(),
  })).optional(),
  milestoneLines: z.array(z.object({
    milestoneId: z.number().int().positive().nullable().optional(),
    name: z.string(),
    value: z.union([z.string(), z.number()]),
    dueDate: z.string().nullable().optional(),
    status: z.string().optional(),
  })).optional(),
});

const rateCardItemSchema = z.object({
  roleName: z.string(),
  level: z.string().nullable().optional(),
  dailyRate: z.union([z.string(), z.number()]),
  costRate: z.union([z.string(), z.number()]).nullable().optional(),
  hourlyChargeRate: z.union([z.string(), z.number()]).nullable().optional(),
  hourlyCostRate: z.union([z.string(), z.number()]).nullable().optional(),
});

const rateCardSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  cardType: z.enum(["standard", "client", "project"]).optional(),
  clientId: z.number().int().positive().nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  currency: z.string().optional(),
  effectiveFrom: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(rateCardItemSchema).optional(),
});

const expenseReportSchema = z.object({
  projectId: z.number().int().positive(),
  name: z.string().min(1),
  currency: z.string().optional(),
  exchangeRate: z.union([z.string(), z.number()]).nullable().optional(),
  items: z.array(z.object({
    itemDate: z.string(),
    category: z.string(),
    description: z.string(),
    amount: z.union([z.string(), z.number()]),
    isBillable: z.boolean().optional(),
    vatAmount: z.union([z.string(), z.number()]).nullable().optional(),
    paymentMethod: z.string().optional(),
    mileageDistance: z.union([z.string(), z.number()]).nullable().optional(),
    mileageVehicleType: z.string().nullable().optional(),
  })).optional(),
});

const fromResourcePlanSchema = z.object({
  planId: z.number().int().positive(),
  projectId: z.number().int().positive().optional(),
  expenseLines: z.array(z.object({
    category: z.string(),
    budgetedAmount: z.union([z.string(), z.number()]),
  })).optional(),
});

const expenseItemSchema = z.object({
  itemDate: z.string(),
  category: z.string(),
  description: z.string(),
  amount: z.union([z.string(), z.number()]),
  isBillable: z.boolean().optional(),
  vatAmount: z.union([z.string(), z.number()]).nullable().optional(),
  paymentMethod: z.string().optional(),
  mileageDistance: z.union([z.string(), z.number()]).nullable().optional(),
  mileageVehicleType: z.string().nullable().optional(),
});

const invoiceCreateSchema = z.object({
  projectId: z.number().int().positive(),
  clientId: z.number().int().positive().nullable().optional(),
  contractType: z.enum(["fixed_price", "time_materials", "retainer", "mixed"]),
  issueDate: z.string().optional(),
  paymentTerms: z.string().optional(),
  currency: z.string().optional(),
  exchangeRate: z.union([z.string(), z.number()]).nullable().optional(),
  notes: z.string().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  milestoneLineIds: z.array(z.number().int().positive()).optional(),
  includeTimesheets: z.boolean().optional(),
  includeExpenses: z.boolean().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  manualLines: z.array(z.object({
    lineType: z.string().optional(),
    description: z.string(),
    quantity: z.number().optional(),
    unitRate: z.number().optional(),
    amount: z.number(),
  })).optional(),
  taxAmount: z.union([z.string(), z.number()]).nullable().optional(),
  vatAmount: z.union([z.string(), z.number()]).nullable().optional(),
});

const paymentSchema = z.object({
  paymentDate: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.string().optional(),
  reference: z.string().nullable().optional(),
});

const rejectSchema = z.object({ reason: z.string().min(1) });

const erpIntegrationSchema = z.object({
  system: z.string().min(1),
  credentialsJson: z.record(z.unknown()).nullable().optional(),
  fieldMappingJson: z.record(z.unknown()).nullable().optional(),
  webhookUrl: z.string().nullable().optional(),
  webhookAuthHeader: z.string().nullable().optional(),
  autoSync: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const erpSyncSchema = z.object({
  entityType: z.enum(["invoice", "expense"]),
  entityId: z.number().int().positive(),
  payload: z.record(z.unknown()).optional(),
});

export function registerFinanceRoutes(app: Express): void {
  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  app.get("/api/finance/settings", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    res.json(await getOrCreateFinanceSettings(tenantId));
  });

  app.put("/api/finance/settings", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    try {
      const body = settingsPatchSchema.parse(req.body);
      res.json(await updateFinanceSettings(tenantId, body as Parameters<typeof updateFinanceSettings>[1]));
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------

  app.get("/api/finance/dashboard", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const clientId = resolveListClientId(req);
    res.json(await loadFinanceDashboard(tenantId, clientId));
  });

  // -------------------------------------------------------------------------
  // Exchange rates
  // -------------------------------------------------------------------------

  app.get("/api/finance/exchange-rates", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    res.json(await listExchangeRates(tenantId));
  });

  app.post("/api/finance/exchange-rates", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    try {
      const body = exchangeRateSchema.parse(req.body);
      res.status(201).json(await createExchangeRate(tenantId, {
        ...body,
        rate: String(body.rate),
      } as Parameters<typeof createExchangeRate>[1]));
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to create exchange rate" });
    }
  });

  app.put("/api/finance/exchange-rates/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = exchangeRateSchema.partial().parse(req.body);
      const updated = await updateExchangeRate(tenantId, id, {
        ...body,
        rate: body.rate != null ? String(body.rate) : undefined,
      } as Parameters<typeof updateExchangeRate>[2]);
      if (!updated) return res.status(404).json({ message: "Exchange rate not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to update exchange rate" });
    }
  });

  app.delete("/api/finance/exchange-rates/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const ok = await deleteExchangeRate(tenantId, id);
    if (!ok) return res.status(404).json({ message: "Exchange rate not found" });
    res.json({ success: true });
  });

  // -------------------------------------------------------------------------
  // Project budgets
  // -------------------------------------------------------------------------

  app.get("/api/finance/budgets", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const clientId = resolveListClientId(req) ?? (req.query.clientId ? Number(req.query.clientId) : undefined);
    res.json(await listProjectBudgets(tenantId, {
      projectId: Number.isFinite(projectId) ? projectId : undefined,
      clientId: Number.isFinite(clientId) ? clientId : undefined,
    }));
  });

  app.get("/api/finance/budgets/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const budget = await getProjectBudgetDetail(tenantId, id);
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    res.json(budget);
  });

  app.post("/api/finance/budgets", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const userId = getUserId(req);
    try {
      const body = budgetCreateSchema.parse(req.body);
      const created = await createProjectBudget(tenantId, { ...body, createdBy: userId } as Parameters<typeof createProjectBudget>[1]);
      res.status(201).json(created);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  app.get("/api/finance/budgets/from-resource-plan/:planId/preview", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const planId = parseId(req.params.planId);
    if (!planId) return res.status(400).json({ message: "Invalid plan id" });
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const preview = await previewBudgetFromResourcePlan(
      tenantId,
      planId,
      Number.isFinite(projectId) && projectId! > 0 ? projectId : undefined,
    );
    if (!preview) return res.status(404).json({ message: "Resource plan not found" });
    res.json(preview);
  });

  app.post("/api/finance/budgets/from-resource-plan", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const userId = getUserId(req);
    try {
      const body = fromResourcePlanSchema.parse(req.body);
      const created = await createBudgetFromResourcePlan(tenantId, body.planId, {
        projectId: body.projectId,
        userId,
        expenseLines: body.expenseLines,
      });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof Error && err.message.includes("project")) {
        return res.status(400).json({ message: err.message });
      }
      if (err instanceof Error && err.message.includes("already exists")) {
        return res.status(409).json({ message: err.message });
      }
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to create budget from resource plan" });
    }
  });

  app.put("/api/finance/budgets/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = budgetCreateSchema.partial().parse(req.body);
      const updated = await updateProjectBudget(tenantId, id, body as Parameters<typeof updateProjectBudget>[2]);
      if (!updated) return res.status(404).json({ message: "Budget not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  app.post("/api/finance/budgets/:id/recalculate", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const budget = await getProjectBudgetDetail(tenantId, id);
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    const updated = await recalculateBudgetActuals(tenantId, budget.projectId);
    res.json(updated);
  });

  // -------------------------------------------------------------------------
  // Rate cards
  // -------------------------------------------------------------------------

  app.get("/api/finance/rate-cards", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const cardType = req.query.cardType as "standard" | "client" | "project" | undefined;
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    res.json(await listRateCards(tenantId, {
      cardType,
      clientId: Number.isFinite(clientId) ? clientId : undefined,
      projectId: Number.isFinite(projectId) ? projectId : undefined,
    }));
  });

  app.get("/api/finance/rate-cards/resolve", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const projectId = Number(req.query.projectId);
    const roleName = String(req.query.roleName ?? "");
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    if (!Number.isFinite(projectId) || !roleName) {
      return res.status(400).json({ message: "projectId and roleName are required" });
    }
    const rate = await resolveRateForProject(tenantId, projectId, clientId, roleName);
    res.json(rate ?? null);
  });

  app.get("/api/finance/rate-cards/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const card = await getRateCardDetail(tenantId, id);
    if (!card) return res.status(404).json({ message: "Rate card not found" });
    res.json(card);
  });

  app.post("/api/finance/rate-cards", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    try {
      const body = rateCardSchema.parse(req.body);
      res.status(201).json(await createRateCard(tenantId, body as Parameters<typeof createRateCard>[1]));
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to create rate card" });
    }
  });

  app.put("/api/finance/rate-cards/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = rateCardSchema.partial().parse(req.body);
      const updated = await updateRateCard(tenantId, id, body as Parameters<typeof updateRateCard>[2]);
      if (!updated) return res.status(404).json({ message: "Rate card not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to update rate card" });
    }
  });

  app.delete("/api/finance/rate-cards/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const ok = await deleteRateCard(tenantId, id);
    if (!ok) return res.status(404).json({ message: "Rate card not found" });
    res.json({ success: true });
  });

  app.post("/api/finance/rate-cards/:id/items", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = rateCardItemSchema.parse(req.body);
      const item = await addRateCardItem(tenantId, id, body as Parameters<typeof addRateCardItem>[2]);
      if (!item) return res.status(404).json({ message: "Rate card not found" });
      res.status(201).json(item);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to add rate card item" });
    }
  });

  app.put("/api/finance/rate-card-items/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = rateCardItemSchema.partial().parse(req.body);
      const updated = await updateRateCardItem(tenantId, id, body as Parameters<typeof updateRateCardItem>[2]);
      if (!updated) return res.status(404).json({ message: "Rate card item not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to update rate card item" });
    }
  });

  app.delete("/api/finance/rate-card-items/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const ok = await deleteRateCardItem(tenantId, id);
    if (!ok) return res.status(404).json({ message: "Rate card item not found" });
    res.json({ success: true });
  });

  // -------------------------------------------------------------------------
  // Timesheets
  // -------------------------------------------------------------------------

  app.get("/api/finance/timesheets/periods", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const resourceId = req.query.resourceId ? Number(req.query.resourceId) : undefined;
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    res.json(await listTimesheetPeriods(tenantId, {
      resourceId: Number.isFinite(resourceId) ? resourceId : undefined,
      projectId: Number.isFinite(projectId) ? projectId : undefined,
      status,
    }));
  });

  app.get("/api/finance/timesheets/periods/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const period = await getTimesheetPeriod(tenantId, id);
    if (!period) return res.status(404).json({ message: "Timesheet period not found" });
    const entries = await listTimesheetEntries(id);
    res.json({ ...period, entries });
  });

  app.get("/api/finance/timesheets/periods/:id/entries", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const period = await getTimesheetPeriod(tenantId, id);
    if (!period) return res.status(404).json({ message: "Timesheet period not found" });
    res.json(await listTimesheetEntries(id));
  });

  app.get("/api/finance/timesheets/projects/:projectId/entries", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const projectId = parseId(req.params.projectId);
    if (!projectId) return res.status(400).json({ message: "Invalid project id" });
    const { storage } = await import("../storage");
    res.json(await storage.getTimesheetEntriesByProject(tenantId, projectId));
  });

  app.post("/api/finance/timesheets/periods/:id/submit", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const updated = await submitTimesheetPeriod(tenantId, id);
    if (!updated) return res.status(404).json({ message: "Timesheet period not found" });
    res.json(updated);
  });

  app.post("/api/finance/timesheets/periods/:id/approve-pm", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const updated = await approveTimesheetPm(tenantId, id, userId);
    if (!updated) return res.status(404).json({ message: "Timesheet not found or not submitted" });
    res.json(updated);
  });

  app.post("/api/finance/timesheets/periods/:id/approve-rm", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const updated = await approveTimesheetRm(tenantId, id, userId);
    if (!updated) return res.status(404).json({ message: "Timesheet not found or not submitted" });
    res.json(updated);
  });

  app.post("/api/finance/timesheets/periods/:id/reject", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const { reason } = rejectSchema.parse(req.body);
      const updated = await rejectTimesheetPeriod(tenantId, id, reason);
      if (!updated) return res.status(404).json({ message: "Timesheet period not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to reject timesheet" });
    }
  });

  app.post("/api/finance/timesheets/periods", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    try {
      const body = z.object({
        resourceId: z.number().int().positive(),
        weekStartDate: z.string(),
        weekEndDate: z.string().optional(),
      }).parse(req.body);
      res.status(201).json(await createTimesheetPeriod(tenantId, body));
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to create timesheet period" });
    }
  });

  app.post("/api/finance/timesheets/periods/:id/entries", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const periodId = parseId(req.params.id);
    if (!periodId) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = z.object({
        id: z.number().int().positive().optional(),
        resourceId: z.number().int().positive(),
        projectId: z.number().int().positive().nullable().optional(),
        projectName: z.string().nullable().optional(),
        dayOfWeek: z.number().int().min(1).max(7),
        hours: z.union([z.string(), z.number()]),
        activityType: z.string().optional(),
        role: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      }).parse(req.body);
      const entry = await upsertTimesheetEntry(tenantId, periodId, body);
      if (!entry) return res.status(400).json({ message: "Cannot edit submitted timesheet" });
      res.json(entry);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to save entry" });
    }
  });

  app.delete("/api/finance/timesheets/entries/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const ok = await deleteTimesheetEntry(tenantId, id);
    if (!ok) return res.status(400).json({ message: "Cannot delete entry" });
    res.json({ success: true });
  });

  app.post("/api/finance/timesheets/periods/:id/copy-last-week", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    res.json(await copyTimesheetProjectsFromLastWeek(tenantId, id));
  });

  app.get("/api/finance/timesheets/reports/utilisation", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const fromDate = String(req.query.fromDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
    const toDate = String(req.query.toDate ?? new Date().toISOString().slice(0, 10));
    res.json(await getUtilisationReport(tenantId, fromDate, toDate));
  });

  app.get("/api/finance/timesheets/reports/missing", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const weekStartDate = String(req.query.weekStartDate ?? new Date().toISOString().slice(0, 10));
    res.json(await getMissingTimesheetsReport(tenantId, weekStartDate));
  });

  app.post("/api/finance/expenses/mileage/calculate", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    try {
      const body = z.object({
        distance: z.number().positive(),
        vehicleType: z.enum(["car", "motorcycle", "bicycle"]),
      }).parse(req.body);
      const settings = await getOrCreateFinanceSettings(tenantId);
      res.json({ amount: calculateMileageAmount(settings, body.distance, body.vehicleType) });
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Mileage calculation failed" });
    }
  });

  app.post("/api/finance/invoices/:id/send-email", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const result = await sendInvoiceWithEmail(tenantId, id, email);
      if (!result.invoice) return res.status(404).json({ message: result.emailError ?? "Invoice not found" });
      res.json(result);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to send invoice email" });
    }
  });

  // -------------------------------------------------------------------------
  // Expenses
  // -------------------------------------------------------------------------

  app.get("/api/finance/expenses/reports", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    res.json(await listExpenseReports(tenantId, {
      projectId: Number.isFinite(projectId) ? projectId : undefined,
      userId,
      status,
    }));
  });

  app.get("/api/finance/expenses/reports/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const report = await getExpenseReportDetail(tenantId, id);
    if (!report) return res.status(404).json({ message: "Expense report not found" });
    res.json(report);
  });

  app.post("/api/finance/expenses/reports", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const body = expenseReportSchema.parse(req.body);
      res.status(201).json(await createExpenseReport(tenantId, { ...body, userId } as Parameters<typeof createExpenseReport>[1]));
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to create expense report" });
    }
  });

  app.put("/api/finance/expenses/reports/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = expenseReportSchema.partial().parse(req.body);
      const updated = await updateExpenseReport(tenantId, id, body as Parameters<typeof updateExpenseReport>[2]);
      if (!updated) return res.status(404).json({ message: "Expense report not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to update expense report" });
    }
  });

  app.delete("/api/finance/expenses/reports/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const ok = await deleteExpenseReport(tenantId, id);
    if (!ok) return res.status(404).json({ message: "Expense report not found" });
    res.json({ success: true });
  });

  app.post("/api/finance/expenses/reports/:id/submit", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const updated = await submitExpenseReport(tenantId, id);
    if (!updated) return res.status(404).json({ message: "Expense report not found or not draft" });
    res.json(updated);
  });

  app.post("/api/finance/expenses/reports/:id/approve", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const updated = await approveExpenseReport(tenantId, id, userId);
    if (!updated) return res.status(404).json({ message: "Expense report not found or not submitted" });
    res.json(updated);
  });

  app.post("/api/finance/expenses/reports/:id/reject", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const { reason } = rejectSchema.parse(req.body);
      const updated = await rejectExpenseReport(tenantId, id, reason);
      if (!updated) return res.status(404).json({ message: "Expense report not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to reject expense report" });
    }
  });

  app.post("/api/finance/expenses/reports/:id/items", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = expenseItemSchema.parse(req.body);
      const item = await addExpenseItem(tenantId, id, body as Parameters<typeof addExpenseItem>[2]);
      if (!item) return res.status(404).json({ message: "Expense report not found or not editable" });
      res.status(201).json(item);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to add expense item" });
    }
  });

  app.put("/api/finance/expenses/items/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = expenseItemSchema.partial().parse(req.body);
      const updated = await updateExpenseItem(tenantId, id, body as Parameters<typeof updateExpenseItem>[2]);
      if (!updated) return res.status(404).json({ message: "Expense item not found or not editable" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to update expense item" });
    }
  });

  app.delete("/api/finance/expenses/items/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const ok = await deleteExpenseItem(tenantId, id);
    if (!ok) return res.status(404).json({ message: "Expense item not found" });
    res.json({ success: true });
  });

  // Receipt upload (multer)
  void (async () => {
    const multer = (await import("multer")).default;
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const receiptUpload = multer({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadsDir),
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    });

    app.post("/api/finance/expenses/items/:id/receipt", (req, res, next) => {
      if (!requireAuth(req, res)) return;
      if (requireTenant(req, res) == null) return;
      next();
    }, receiptUpload.single("receipt"), async (req, res) => {
      try {
        const tenantId = requireApiTenantId(req, res);
        if (tenantId == null) return;
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ message: "Invalid id" });
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });
        const url = `/uploads/${req.file.filename}`;
        const updated = await setExpenseItemReceipt(tenantId, id, url);
        if (!updated) return res.status(404).json({ message: "Expense item not found" });
        res.json(updated);
      } catch {
        res.status(500).json({ message: "Failed to upload receipt" });
      }
    });
  })();

  // -------------------------------------------------------------------------
  // Invoices
  // -------------------------------------------------------------------------

  app.get("/api/finance/invoices", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const clientId = resolveListClientId(req) ?? (req.query.clientId ? Number(req.query.clientId) : undefined);
    const status = req.query.status ? String(req.query.status) : undefined;
    const fromDate = req.query.fromDate ? String(req.query.fromDate) : undefined;
    const toDate = req.query.toDate ? String(req.query.toDate) : undefined;
    res.json(await listInvoices(tenantId, {
      projectId: Number.isFinite(projectId) ? projectId : undefined,
      clientId: Number.isFinite(clientId) ? clientId : undefined,
      status,
      fromDate,
      toDate,
    }));
  });

  app.get("/api/finance/invoices/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const invoice = await getInvoiceDetail(tenantId, id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  });

  app.post("/api/finance/invoices", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const userId = getUserId(req);
    try {
      const body = invoiceCreateSchema.parse(req.body);
      res.status(201).json(await createInvoice(tenantId, { ...body, createdBy: userId }));
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.put("/api/finance/invoices/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = invoiceCreateSchema.partial().extend({
        lines: z.array(z.object({
          lineType: z.string().optional(),
          description: z.string(),
          quantity: z.union([z.string(), z.number()]).optional(),
          unitRate: z.union([z.string(), z.number()]).optional(),
          amount: z.union([z.string(), z.number()]),
        })).optional(),
      }).parse(req.body);
      const updated = await updateInvoice(tenantId, id, body as Parameters<typeof updateInvoice>[2]);
      if (!updated) return res.status(404).json({ message: "Invoice not found or not draft" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  app.post("/api/finance/invoices/:id/send", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const updated = await sendInvoice(tenantId, id);
    if (!updated) return res.status(404).json({ message: "Invoice not found or not draft" });
    res.json(updated);
  });

  app.post("/api/finance/invoices/:id/payments", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const userId = getUserId(req);
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = paymentSchema.parse(req.body);
      const updated = await recordInvoicePayment(tenantId, id, { ...body, createdBy: userId });
      if (!updated) return res.status(404).json({ message: "Invoice not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to record payment" });
    }
  });

  app.post("/api/finance/invoices/:id/credit-note", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const userId = getUserId(req);
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const credit = await createCreditNote(tenantId, id, userId);
    if (!credit) return res.status(404).json({ message: "Invoice not found" });
    res.status(201).json(credit);
  });

  app.get("/api/finance/invoices/:id/pdf", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const data = await getInvoicePdfData(tenantId, id);
    if (!data) return res.status(404).json({ message: "Invoice not found" });

    if (req.query.format === "json") {
      return res.json(data);
    }

    const pdf = generateInvoicePdf(
      data.invoice,
      data.invoice.lines,
      data.orgName,
      data.orgAddress,
      data.bankDetails,
      data.invoice.clientName ?? undefined,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${data.invoice.invoiceNumber}.pdf"`);
    res.send(pdf);
  });

  // -------------------------------------------------------------------------
  // ERP
  // -------------------------------------------------------------------------

  app.get("/api/finance/erp/integrations", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    res.json(await listErpIntegrations(tenantId));
  });

  app.post("/api/finance/erp/integrations", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    try {
      const body = erpIntegrationSchema.parse(req.body);
      res.status(201).json(await createErpIntegration(tenantId, body));
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to create ERP integration" });
    }
  });

  app.put("/api/finance/erp/integrations/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    try {
      const body = erpIntegrationSchema.partial().parse(req.body);
      const updated = await updateErpIntegration(tenantId, id, body);
      if (!updated) return res.status(404).json({ message: "ERP integration not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "Failed to update ERP integration" });
    }
  });

  app.delete("/api/finance/erp/integrations/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const ok = await deleteErpIntegration(tenantId, id);
    if (!ok) return res.status(404).json({ message: "ERP integration not found" });
    res.json({ success: true });
  });

  app.get("/api/finance/erp/sync-log", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    const integrationId = req.query.integrationId ? Number(req.query.integrationId) : undefined;
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    res.json(await listErpSyncLog(tenantId, {
      integrationId: Number.isFinite(integrationId) ? integrationId : undefined,
      entityType,
      status,
    }));
  });

  app.post("/api/finance/erp/sync", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tenantId = requireTenant(req, res);
    if (tenantId == null) return;
    try {
      const body = erpSyncSchema.parse(req.body);
      const result = await pushToErp(tenantId, body.entityType, body.entityId, body.payload ?? {});
      if (!result.success) return res.status(502).json(result);
      res.json(result);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      res.status(500).json({ message: "ERP sync failed" });
    }
  });
}
