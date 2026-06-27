import {
  calcResourcePlanRowCost,
  mapResourcePlanRowsToBudgetLabour,
} from "@shared/resource-plan-budget";
import { storage } from "../storage";
import { createProjectBudget, listProjectBudgets } from "./repository";
import type { BudgetDetail } from "./repository";

export type ResourcePlanBudgetPreview = {
  planId: number;
  planName: string | null;
  opportunityId: number;
  opportunityName: string | null;
  projectId: number | null;
  currency: string;
  labourTotal: number;
  expenseTotal: number;
  rowCount: number;
  labourLines: ReturnType<typeof mapResourcePlanRowsToBudgetLabour>;
  existingBudgetId: number | null;
};

export async function previewBudgetFromResourcePlan(
  tenantId: number,
  planId: number,
  projectIdOverride?: number,
): Promise<ResourcePlanBudgetPreview | null> {
  const plan = await storage.getOpportunityResourcePlanById(planId);
  if (!plan || plan.tenantId !== tenantId) return null;

  const rows = await storage.getOpportunityResourceRows(planId);
  const opportunity = await storage.getCrmOpportunity(plan.opportunityId);
  const projectId = projectIdOverride ?? opportunity?.projectId ?? null;

  const labourLines = mapResourcePlanRowsToBudgetLabour(rows);
  const labourTotal = rows.reduce((sum, row) => sum + calcResourcePlanRowCost(row), 0);

  let existingBudgetId: number | null = null;
  if (projectId) {
    const existing = await listProjectBudgets(tenantId, { projectId });
    existingBudgetId = existing[0]?.id ?? null;
  }

  return {
    planId: plan.id,
    planName: plan.planName,
    opportunityId: plan.opportunityId,
    opportunityName: opportunity?.name ?? null,
    projectId,
    currency: plan.currency ?? "GBP",
    labourTotal,
    expenseTotal: 0,
    rowCount: rows.length,
    labourLines,
    existingBudgetId,
  };
}

export async function createBudgetFromResourcePlan(
  tenantId: number,
  planId: number,
  opts: {
    projectId?: number;
    userId?: string | null;
    expenseLines?: Array<{ category: string; budgetedAmount: string | number }>;
    expenseTotal?: number;
  },
): Promise<BudgetDetail> {
  const preview = await previewBudgetFromResourcePlan(tenantId, planId, opts.projectId);
  if (!preview) throw new Error("Resource plan not found");

  if (!preview.projectId) {
    throw new Error("Link this opportunity to a project before creating a budget");
  }

  if (preview.existingBudgetId) {
    throw new Error("A budget already exists for this project");
  }

  const plan = await storage.getOpportunityResourcePlanById(planId);
  if (!plan) throw new Error("Resource plan not found");

  const expenseLines = opts.expenseLines ?? [];
  const expenseTotal = opts.expenseTotal ?? expenseLines.reduce(
    (sum, line) => sum + Number(line.budgetedAmount || 0),
    0,
  );

  return createProjectBudget(tenantId, {
    projectId: preview.projectId,
    labourBudget: preview.labourTotal,
    expenseBudget: expenseTotal,
    budgetCurrency: preview.currency,
    billingCurrency: preview.currency,
    rateCardId: plan.rateCardId,
    notes: `Created from CRM resource plan #${planId}${plan.planName ? ` (${plan.planName})` : ""}`,
    labourLines: preview.labourLines,
    expenseLines: expenseLines.map((line) => ({
      category: line.category,
      budgetedAmount: String(line.budgetedAmount),
    })),
    createdBy: opts.userId ?? null,
  });
}
