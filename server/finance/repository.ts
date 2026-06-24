import {
  and, asc, desc, eq, gte, inArray, isNull, lte, or, sql,
} from "drizzle-orm";
import { db } from "../db";
import {
  budgetExpenseLines,
  budgetLabourLines,
  budgetMilestoneLines,
  crmAccounts,
  erpIntegrations,
  erpSyncLog,
  exchangeRates,
  expenseItems,
  expenseReports,
  financeInvoiceLines,
  financeInvoicePayments,
  financeInvoices,
  financeSettings,
  pmProjects,
  projectBudgets,
  rateCardItems,
  rateCards,
  tenants,
  timesheetEntries,
  timesheetPeriods,
  resources,
  type BudgetExpenseLine,
  type BudgetLabourLine,
  type BudgetMilestoneLine,
  type ExchangeRate,
  type ExpenseItem,
  type ExpenseReport,
  type FinanceInvoice,
  type FinanceInvoiceLine,
  type FinanceInvoicePayment,
  type FinanceSettings,
  type ProjectBudget,
  type RateCard,
  type RateCardItem,
  type TimesheetEntry,
  type TimesheetPeriod,
} from "@shared/schema";
import {
  budgetRagStatus,
  computeEvm,
  dueDateFromTerms,
  invoiceAgeBucket,
  nextInvoiceNumber,
  parseMoney,
  projectMarginPct,
  utilisationPct,
} from "./calculations";
import { resourceWeeklyCapacityHours } from "../resources/service";

function workingDaysBetweenIso(fromDate: string, toDate: string): number {
  let count = 0;
  const d = new Date(fromDate);
  const endD = new Date(toDate);
  while (d <= endD) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(count, 1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinanceDashboard {
  kpis: {
    revenueThisMonth: number;
    outstandingInvoices: number;
    totalBilledYtd: number;
    totalBilledYtdYoYPct: number;
    avgProjectMarginPct: number;
    unapprovedTimesheets: number;
    unapprovedExpenses: number;
  };
  revenueVsBudget: { month: string; budget: number; actual: number; isFuture?: boolean }[];
  projectFinancialHealth: {
    projectId: number;
    projectName: string;
    clientName: string | null;
    budget: number;
    actualCost: number;
    billedToDate: number;
    marginPct: number;
    ragStatus: "green" | "amber" | "red";
    evm?: ReturnType<typeof computeEvm>;
  }[];
  invoiceAgeing: { bucket: string; count: number; amount: number }[];
  utilisation: {
    billableHours: number;
    nonBillableHours: number;
    availableHours: number;
    pct: number;
  };
}

export interface BudgetDetail extends ProjectBudget {
  labourLines: BudgetLabourLine[];
  expenseLines: BudgetExpenseLine[];
  milestoneLines: BudgetMilestoneLine[];
  projectName: string | null;
  clientName: string | null;
}

export interface ExpenseReportDetail extends ExpenseReport {
  items: ExpenseItem[];
  projectName: string | null;
}

export interface InvoiceDetail extends FinanceInvoice {
  lines: FinanceInvoiceLine[];
  payments: FinanceInvoicePayment[];
  projectName: string | null;
  clientName: string | null;
}

export interface RateCardDetail extends RateCard {
  items: RateCardItem[];
}

type RateCardType = "standard" | "client" | "project";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function moneyStr(n: number): string {
  return n.toFixed(2);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return d.toLocaleString("en-GB", { month: "short", year: "2-digit" });
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function hourlyFromDaily(daily: number): number {
  return Math.round((daily / 8) * 100) / 100;
}

function computeItemHourlyRates(item: {
  dailyRate: string | number | null;
  costRate?: string | number | null;
  hourlyChargeRate?: string | number | null;
  hourlyCostRate?: string | number | null;
}): { hourlyCharge: number; hourlyCost: number } {
  const daily = parseMoney(item.dailyRate);
  const costDaily = parseMoney(item.costRate);
  const hourlyCharge = item.hourlyChargeRate != null
    ? parseMoney(item.hourlyChargeRate)
    : hourlyFromDaily(daily);
  const hourlyCost = item.hourlyCostRate != null
    ? parseMoney(item.hourlyCostRate)
    : hourlyFromDaily(costDaily);
  return { hourlyCharge, hourlyCost };
}

async function getProjectClientId(projectId: number): Promise<number | null> {
  const [proj] = await db
    .select({ clientId: pmProjects.clientId })
    .from(pmProjects)
    .where(eq(pmProjects.id, projectId))
    .limit(1);
  return proj?.clientId ?? null;
}

function isTimesheetFullyApproved(mode: string, period: TimesheetPeriod): boolean {
  if (mode === "pm_only") return Boolean(period.approvedByPmId);
  if (mode === "rm_only") return Boolean(period.approvedByRmId);
  return Boolean(period.approvedByPmId && period.approvedByRmId);
}

async function nextInvoiceSeq(tenantId: number, prefix: string, year: number): Promise<number> {
  const pattern = `${prefix}-${year}-%`;
  const rows = await db
    .select({ invoiceNumber: financeInvoices.invoiceNumber })
    .from(financeInvoices)
    .where(and(eq(financeInvoices.tenantId, tenantId), sql`${financeInvoices.invoiceNumber} LIKE ${pattern}`));
  let max = 0;
  for (const row of rows) {
    const parts = row.invoiceNumber.split("-");
    const seq = parseInt(parts[parts.length - 1] ?? "0", 10);
    if (seq > max) max = seq;
  }
  return max + 1;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getOrCreateFinanceSettings(tenantId: number): Promise<FinanceSettings> {
  const [existing] = await db
    .select()
    .from(financeSettings)
    .where(eq(financeSettings.tenantId, tenantId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(financeSettings)
    .values({ tenantId })
    .returning();
  return created;
}

export async function updateFinanceSettings(
  tenantId: number,
  updates: Partial<Omit<FinanceSettings, "id" | "tenantId" | "createdAt">>,
): Promise<FinanceSettings> {
  await getOrCreateFinanceSettings(tenantId);
  const [updated] = await db
    .update(financeSettings)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(financeSettings.tenantId, tenantId))
    .returning();
  return updated;
}

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

export async function listExchangeRates(tenantId: number): Promise<ExchangeRate[]> {
  return db
    .select()
    .from(exchangeRates)
    .where(eq(exchangeRates.tenantId, tenantId))
    .orderBy(desc(exchangeRates.rateDate));
}

export async function createExchangeRate(
  tenantId: number,
  data: Omit<typeof exchangeRates.$inferInsert, "id" | "tenantId" | "createdAt">,
): Promise<ExchangeRate> {
  const [created] = await db
    .insert(exchangeRates)
    .values({ ...data, tenantId })
    .returning();
  return created;
}

export async function updateExchangeRate(
  tenantId: number,
  id: number,
  updates: Partial<Omit<ExchangeRate, "id" | "tenantId" | "createdAt">>,
): Promise<ExchangeRate | null> {
  const [updated] = await db
    .update(exchangeRates)
    .set(updates)
    .where(and(eq(exchangeRates.id, id), eq(exchangeRates.tenantId, tenantId)))
    .returning();
  return updated ?? null;
}

export async function deleteExchangeRate(tenantId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(exchangeRates)
    .where(and(eq(exchangeRates.id, id), eq(exchangeRates.tenantId, tenantId)))
    .returning({ id: exchangeRates.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Project budgets
// ---------------------------------------------------------------------------

export async function listProjectBudgets(
  tenantId: number,
  filters?: { projectId?: number; clientId?: number },
): Promise<(ProjectBudget & { projectName: string | null })[]> {
  const conds = [eq(projectBudgets.tenantId, tenantId)];
  if (filters?.projectId) conds.push(eq(projectBudgets.projectId, filters.projectId));
  if (filters?.clientId) conds.push(eq(projectBudgets.clientId, filters.clientId));

  const rows = await db
    .select({
      budget: projectBudgets,
      projectName: pmProjects.name,
    })
    .from(projectBudgets)
    .leftJoin(pmProjects, eq(projectBudgets.projectId, pmProjects.id))
    .where(and(...conds))
    .orderBy(desc(projectBudgets.updatedAt));

  return rows.map((r) => ({ ...r.budget, projectName: r.projectName }));
}

export async function getProjectBudgetDetail(tenantId: number, id: number): Promise<BudgetDetail | null> {
  const [row] = await db
    .select({
      budget: projectBudgets,
      projectName: pmProjects.name,
      clientName: crmAccounts.name,
    })
    .from(projectBudgets)
    .leftJoin(pmProjects, eq(projectBudgets.projectId, pmProjects.id))
    .leftJoin(crmAccounts, eq(projectBudgets.clientId, crmAccounts.id))
    .where(and(eq(projectBudgets.id, id), eq(projectBudgets.tenantId, tenantId)))
    .limit(1);

  if (!row) return null;

  const [labourLines, expenseLines, milestoneLines] = await Promise.all([
    db.select().from(budgetLabourLines).where(eq(budgetLabourLines.budgetId, id)),
    db.select().from(budgetExpenseLines).where(eq(budgetExpenseLines.budgetId, id)),
    db.select().from(budgetMilestoneLines).where(eq(budgetMilestoneLines.budgetId, id)),
  ]);

  return {
    ...row.budget,
    projectName: row.projectName,
    clientName: row.clientName,
    labourLines,
    expenseLines,
    milestoneLines,
  };
}

export async function createProjectBudget(
  tenantId: number,
  data: {
    projectId: number;
    clientId?: number | null;
    contractType?: string;
    contractValue?: string | number | null;
    budgetCurrency?: string;
    billingCurrency?: string;
    labourBudget?: string | number | null;
    expenseBudget?: string | number | null;
    targetMarginPct?: string | number | null;
    rateCardId?: number | null;
    exchangeRate?: string | number | null;
    evmEnabled?: boolean;
    notes?: string | null;
    createdBy?: string | null;
    labourLines?: Omit<typeof budgetLabourLines.$inferInsert, "id" | "budgetId" | "createdAt">[];
    expenseLines?: Omit<typeof budgetExpenseLines.$inferInsert, "id" | "budgetId" | "createdAt">[];
    milestoneLines?: Omit<typeof budgetMilestoneLines.$inferInsert, "id" | "budgetId" | "createdAt">[];
  },
): Promise<BudgetDetail> {
  const labour = parseMoney(data.labourBudget);
  const expense = parseMoney(data.expenseBudget);
  const totalBudget = labour + expense;

  const [budget] = await db
    .insert(projectBudgets)
    .values({
      tenantId,
      projectId: data.projectId,
      clientId: data.clientId ?? (await getProjectClientId(data.projectId)),
      contractType: data.contractType ?? "fixed_price",
      contractValue: data.contractValue != null ? moneyStr(parseMoney(data.contractValue)) : null,
      budgetCurrency: data.budgetCurrency ?? "GBP",
      billingCurrency: data.billingCurrency ?? "GBP",
      labourBudget: moneyStr(labour),
      expenseBudget: moneyStr(expense),
      totalBudget: moneyStr(totalBudget),
      targetMarginPct: data.targetMarginPct != null ? moneyStr(parseMoney(data.targetMarginPct)) : null,
      rateCardId: data.rateCardId ?? null,
      exchangeRate: data.exchangeRate != null ? String(data.exchangeRate) : null,
      evmEnabled: data.evmEnabled ?? false,
      notes: data.notes ?? null,
      createdBy: data.createdBy ?? null,
    })
    .returning();

  if (data.labourLines?.length) {
    await db.insert(budgetLabourLines).values(
      data.labourLines.map((l) => ({ ...l, budgetId: budget.id })),
    );
  }
  if (data.expenseLines?.length) {
    await db.insert(budgetExpenseLines).values(
      data.expenseLines.map((l) => ({ ...l, budgetId: budget.id })),
    );
  }
  if (data.milestoneLines?.length) {
    await db.insert(budgetMilestoneLines).values(
      data.milestoneLines.map((l) => ({ ...l, budgetId: budget.id })),
    );
  }

  return (await getProjectBudgetDetail(tenantId, budget.id))!;
}

export async function updateProjectBudget(
  tenantId: number,
  id: number,
  updates: Partial<Omit<ProjectBudget, "id" | "tenantId" | "createdAt">> & {
    labourLines?: Omit<typeof budgetLabourLines.$inferInsert, "id" | "budgetId" | "createdAt">[];
    expenseLines?: Omit<typeof budgetExpenseLines.$inferInsert, "id" | "budgetId" | "createdAt">[];
    milestoneLines?: Omit<typeof budgetMilestoneLines.$inferInsert, "id" | "budgetId" | "createdAt">[];
  },
): Promise<BudgetDetail | null> {
  const existing = await getProjectBudgetDetail(tenantId, id);
  if (!existing) return null;

  const { labourLines, expenseLines, milestoneLines, ...budgetUpdates } = updates;
  const labour = budgetUpdates.labourBudget != null ? parseMoney(budgetUpdates.labourBudget) : parseMoney(existing.labourBudget);
  const expense = budgetUpdates.expenseBudget != null ? parseMoney(budgetUpdates.expenseBudget) : parseMoney(existing.expenseBudget);

  const [updated] = await db
    .update(projectBudgets)
    .set({
      ...budgetUpdates,
      labourBudget: moneyStr(labour),
      expenseBudget: moneyStr(expense),
      totalBudget: moneyStr(labour + expense),
      updatedAt: new Date(),
    })
    .where(and(eq(projectBudgets.id, id), eq(projectBudgets.tenantId, tenantId)))
    .returning();

  if (!updated) return null;

  if (labourLines) {
    await db.delete(budgetLabourLines).where(eq(budgetLabourLines.budgetId, id));
    if (labourLines.length) {
      await db.insert(budgetLabourLines).values(labourLines.map((l) => ({ ...l, budgetId: id })));
    }
  }
  if (expenseLines) {
    await db.delete(budgetExpenseLines).where(eq(budgetExpenseLines.budgetId, id));
    if (expenseLines.length) {
      await db.insert(budgetExpenseLines).values(expenseLines.map((l) => ({ ...l, budgetId: id })));
    }
  }
  if (milestoneLines) {
    await db.delete(budgetMilestoneLines).where(eq(budgetMilestoneLines.budgetId, id));
    if (milestoneLines.length) {
      await db.insert(budgetMilestoneLines).values(milestoneLines.map((l) => ({ ...l, budgetId: id })));
    }
  }

  return getProjectBudgetDetail(tenantId, id);
}

export async function recalculateBudgetActuals(tenantId: number, projectId: number): Promise<ProjectBudget | null> {
  const [budget] = await db
    .select()
    .from(projectBudgets)
    .where(and(eq(projectBudgets.tenantId, tenantId), eq(projectBudgets.projectId, projectId)))
    .limit(1);

  if (!budget) return null;

  const approvedPeriods = await db
    .select({ id: timesheetPeriods.id })
    .from(timesheetPeriods)
    .where(and(
      eq(timesheetPeriods.tenantId, tenantId),
      eq(timesheetPeriods.approvalStatus, "fully_approved"),
    ));

  const periodIds = approvedPeriods.map((p) => p.id);
  let labourCost = 0;
  let labourDays = 0;

  if (periodIds.length) {
    const entries = await db
      .select()
      .from(timesheetEntries)
      .where(and(
        inArray(timesheetEntries.timesheetPeriodId, periodIds),
        eq(timesheetEntries.projectId, projectId),
      ));

    for (const e of entries) {
      labourCost += parseMoney(e.calculatedCost);
      labourDays += parseMoney(e.hours) / 8;
    }
  }

  const approvedReports = await db
    .select({ id: expenseReports.id })
    .from(expenseReports)
    .where(and(
      eq(expenseReports.tenantId, tenantId),
      eq(expenseReports.projectId, projectId),
      eq(expenseReports.status, "approved"),
    ));

  let expenseCost = 0;
  if (approvedReports.length) {
    const reportIds = approvedReports.map((r) => r.id);
    const items = await db
      .select()
      .from(expenseItems)
      .where(inArray(expenseItems.reportId, reportIds));

    for (const item of items) {
      expenseCost += parseMoney(item.amount);
    }
  }

  const actualCost = labourCost + expenseCost;

  const labourLines = await db
    .select()
    .from(budgetLabourLines)
    .where(eq(budgetLabourLines.budgetId, budget.id));

  for (const line of labourLines) {
    const roleEntries = periodIds.length
      ? await db
          .select()
          .from(timesheetEntries)
          .where(and(
            inArray(timesheetEntries.timesheetPeriodId, periodIds),
            eq(timesheetEntries.projectId, projectId),
            eq(timesheetEntries.role, line.roleName),
          ))
      : [];

    let lineCost = 0;
    let lineDays = 0;
    for (const e of roleEntries) {
      lineCost += parseMoney(e.calculatedCost);
      lineDays += parseMoney(e.hours) / 8;
    }
    await db
      .update(budgetLabourLines)
      .set({ actualCost: moneyStr(lineCost), actualDays: String(lineDays) })
      .where(eq(budgetLabourLines.id, line.id));
  }

  const expenseLines = await db
    .select()
    .from(budgetExpenseLines)
    .where(eq(budgetExpenseLines.budgetId, budget.id));

  for (const line of expenseLines) {
    const catItems = approvedReports.length
      ? await db
          .select({ amount: expenseItems.amount })
          .from(expenseItems)
          .innerJoin(expenseReports, eq(expenseItems.reportId, expenseReports.id))
          .where(and(
            eq(expenseReports.projectId, projectId),
            eq(expenseReports.status, "approved"),
            eq(expenseItems.category, line.category),
          ))
      : [];

    const catTotal = catItems.reduce((s, i) => s + parseMoney(i.amount), 0);
    await db
      .update(budgetExpenseLines)
      .set({ actualAmount: moneyStr(catTotal) })
      .where(eq(budgetExpenseLines.id, line.id));
  }

  const [updated] = await db
    .update(projectBudgets)
    .set({ actualCost: moneyStr(actualCost), updatedAt: new Date() })
    .where(eq(projectBudgets.id, budget.id))
    .returning();

  await db
    .update(pmProjects)
    .set({ spentBudget: moneyStr(actualCost), updatedAt: new Date() })
    .where(and(eq(pmProjects.id, projectId), eq(pmProjects.tenantId, tenantId)));

  return updated;
}

// ---------------------------------------------------------------------------
// Rate cards
// ---------------------------------------------------------------------------

async function closePreviousRateCards(
  tenantId: number,
  cardType: RateCardType,
  effectiveFrom: Date,
  clientId?: number | null,
  projectId?: number | null,
): Promise<void> {
  const conds = [
    eq(rateCards.tenantId, tenantId),
    eq(rateCards.cardType, cardType),
    or(isNull(rateCards.effectiveTo), gte(rateCards.effectiveTo, effectiveFrom)),
  ];
  if (cardType === "client" && clientId) conds.push(eq(rateCards.clientId, clientId));
  if (cardType === "project" && projectId) conds.push(eq(rateCards.projectId, projectId));

  const previous = await db.select().from(rateCards).where(and(...conds));
  const closeDate = new Date(effectiveFrom);
  closeDate.setDate(closeDate.getDate() - 1);

  for (const card of previous) {
    await db
      .update(rateCards)
      .set({ effectiveTo: closeDate, updatedAt: new Date() })
      .where(eq(rateCards.id, card.id));
  }
}

export async function listRateCards(
  tenantId: number,
  filters?: { cardType?: RateCardType; clientId?: number; projectId?: number },
): Promise<RateCard[]> {
  const conds = [eq(rateCards.tenantId, tenantId)];
  if (filters?.cardType) conds.push(eq(rateCards.cardType, filters.cardType));
  if (filters?.clientId) conds.push(eq(rateCards.clientId, filters.clientId));
  if (filters?.projectId) conds.push(eq(rateCards.projectId, filters.projectId));

  return db
    .select()
    .from(rateCards)
    .where(and(...conds))
    .orderBy(desc(rateCards.effectiveFrom));
}

export async function getRateCardDetail(tenantId: number, id: number): Promise<RateCardDetail | null> {
  const [card] = await db
    .select()
    .from(rateCards)
    .where(and(eq(rateCards.id, id), eq(rateCards.tenantId, tenantId)))
    .limit(1);
  if (!card) return null;

  const items = await db
    .select()
    .from(rateCardItems)
    .where(eq(rateCardItems.rateCardId, id))
    .orderBy(asc(rateCardItems.roleName));

  return { ...card, items };
}

export async function createRateCard(
  tenantId: number,
  data: {
    name: string;
    description?: string | null;
    cardType?: RateCardType;
    clientId?: number | null;
    projectId?: number | null;
    currency?: string;
    effectiveFrom?: Date | string | null;
    isDefault?: boolean;
    notes?: string | null;
    items?: Omit<typeof rateCardItems.$inferInsert, "id" | "rateCardId" | "createdAt">[];
  },
): Promise<RateCardDetail> {
  const cardType = (data.cardType ?? "standard") as RateCardType;
  const effectiveFrom = data.effectiveFrom ? new Date(data.effectiveFrom) : new Date();

  await closePreviousRateCards(tenantId, cardType, effectiveFrom, data.clientId, data.projectId);

  const [card] = await db
    .insert(rateCards)
    .values({
      tenantId,
      name: data.name,
      description: data.description ?? null,
      cardType,
      clientId: cardType === "client" ? (data.clientId ?? null) : null,
      projectId: cardType === "project" ? (data.projectId ?? null) : null,
      currency: data.currency ?? "GBP",
      effectiveFrom,
      isDefault: data.isDefault ?? cardType === "standard",
      notes: data.notes ?? null,
    })
    .returning();

  if (data.items?.length) {
    await db.insert(rateCardItems).values(
      data.items.map((item) => {
        const daily = parseMoney(item.dailyRate);
        const cost = parseMoney(item.costRate);
        return {
          ...item,
          rateCardId: card.id,
          hourlyChargeRate: item.hourlyChargeRate ?? moneyStr(hourlyFromDaily(daily)),
          hourlyCostRate: item.hourlyCostRate ?? moneyStr(hourlyFromDaily(cost)),
        };
      }),
    );
  }

  return (await getRateCardDetail(tenantId, card.id))!;
}

export async function updateRateCard(
  tenantId: number,
  id: number,
  updates: Partial<Omit<RateCard, "id" | "tenantId" | "createdAt">>,
): Promise<RateCard | null> {
  const [updated] = await db
    .update(rateCards)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(rateCards.id, id), eq(rateCards.tenantId, tenantId)))
    .returning();
  return updated ?? null;
}

export async function deleteRateCard(tenantId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(rateCards)
    .where(and(eq(rateCards.id, id), eq(rateCards.tenantId, tenantId)))
    .returning({ id: rateCards.id });
  return result.length > 0;
}

export async function addRateCardItem(
  tenantId: number,
  rateCardId: number,
  item: Omit<typeof rateCardItems.$inferInsert, "id" | "rateCardId" | "createdAt">,
): Promise<RateCardItem | null> {
  const card = await getRateCardDetail(tenantId, rateCardId);
  if (!card) return null;

  const daily = parseMoney(item.dailyRate);
  const cost = parseMoney(item.costRate);
  const [created] = await db
    .insert(rateCardItems)
    .values({
      ...item,
      rateCardId,
      hourlyChargeRate: item.hourlyChargeRate ?? moneyStr(hourlyFromDaily(daily)),
      hourlyCostRate: item.hourlyCostRate ?? moneyStr(hourlyFromDaily(cost)),
    })
    .returning();
  return created;
}

export async function updateRateCardItem(
  tenantId: number,
  itemId: number,
  updates: Partial<Omit<RateCardItem, "id" | "rateCardId" | "createdAt">>,
): Promise<RateCardItem | null> {
  const [existing] = await db
    .select({ item: rateCardItems, card: rateCards })
    .from(rateCardItems)
    .innerJoin(rateCards, eq(rateCardItems.rateCardId, rateCards.id))
    .where(and(eq(rateCardItems.id, itemId), eq(rateCards.tenantId, tenantId)))
    .limit(1);

  if (!existing) return null;

  const daily = updates.dailyRate != null ? parseMoney(updates.dailyRate) : parseMoney(existing.item.dailyRate);
  const cost = updates.costRate != null ? parseMoney(updates.costRate) : parseMoney(existing.item.costRate);

  const [updated] = await db
    .update(rateCardItems)
    .set({
      ...updates,
      hourlyChargeRate: updates.hourlyChargeRate
        ?? (updates.dailyRate != null ? moneyStr(hourlyFromDaily(daily)) : undefined),
      hourlyCostRate: updates.hourlyCostRate
        ?? (updates.costRate != null ? moneyStr(hourlyFromDaily(cost)) : undefined),
    })
    .where(eq(rateCardItems.id, itemId))
    .returning();
  return updated ?? null;
}

export async function deleteRateCardItem(tenantId: number, itemId: number): Promise<boolean> {
  const [existing] = await db
    .select({ id: rateCardItems.id })
    .from(rateCardItems)
    .innerJoin(rateCards, eq(rateCardItems.rateCardId, rateCards.id))
    .where(and(eq(rateCardItems.id, itemId), eq(rateCards.tenantId, tenantId)))
    .limit(1);
  if (!existing) return false;

  await db.delete(rateCardItems).where(eq(rateCardItems.id, itemId));
  return true;
}

async function findActiveRateCard(
  tenantId: number,
  cardType: RateCardType,
  clientId?: number | null,
  projectId?: number | null,
): Promise<RateCard | null> {
  const now = new Date();
  const conds = [
    eq(rateCards.tenantId, tenantId),
    eq(rateCards.cardType, cardType),
    or(isNull(rateCards.effectiveFrom), lte(rateCards.effectiveFrom, now)),
    or(isNull(rateCards.effectiveTo), gte(rateCards.effectiveTo, now)),
  ];
  if (cardType === "client" && clientId) conds.push(eq(rateCards.clientId, clientId));
  if (cardType === "project" && projectId) conds.push(eq(rateCards.projectId, projectId));
  if (cardType === "standard") conds.push(eq(rateCards.isDefault, true));

  const [card] = await db
    .select()
    .from(rateCards)
    .where(and(...conds))
    .orderBy(desc(rateCards.effectiveFrom))
    .limit(1);
  return card ?? null;
}

export async function resolveRateForProject(
  tenantId: number,
  projectId: number,
  clientId: number | null | undefined,
  roleName: string,
): Promise<RateCardItem | null> {
  const resolvedClientId = clientId ?? (await getProjectClientId(projectId));

  const lookupOrder: { type: RateCardType; clientId?: number | null; projectId?: number | null }[] = [
    { type: "project", projectId },
    { type: "client", clientId: resolvedClientId },
    { type: "standard" },
  ];

  for (const scope of lookupOrder) {
    const card = await findActiveRateCard(
      tenantId,
      scope.type,
      scope.clientId,
      scope.projectId,
    );
    if (!card) continue;

    const [item] = await db
      .select()
      .from(rateCardItems)
      .where(and(
        eq(rateCardItems.rateCardId, card.id),
        eq(rateCardItems.roleName, roleName),
      ))
      .limit(1);
    if (item) return item;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Timesheets (ADR-004 dual approval)
// ---------------------------------------------------------------------------

export async function listTimesheetPeriods(
  tenantId: number,
  filters?: { resourceId?: number; status?: string; projectId?: number },
): Promise<TimesheetPeriod[]> {
  const conds = [eq(timesheetPeriods.tenantId, tenantId)];
  if (filters?.resourceId) conds.push(eq(timesheetPeriods.resourceId, filters.resourceId));
  if (filters?.status) conds.push(eq(timesheetPeriods.status, filters.status));

  let periods = await db
    .select()
    .from(timesheetPeriods)
    .where(and(...conds))
    .orderBy(desc(timesheetPeriods.weekStartDate));

  if (filters?.projectId) {
    const periodIds = new Set<number>();
    const entries = await db
      .select({ periodId: timesheetEntries.timesheetPeriodId })
      .from(timesheetEntries)
      .where(eq(timesheetEntries.projectId, filters.projectId));
    for (const e of entries) periodIds.add(e.periodId);
    periods = periods.filter((p) => periodIds.has(p.id));
  }

  return periods;
}

export async function getTimesheetPeriod(tenantId: number, id: number): Promise<TimesheetPeriod | null> {
  const [period] = await db
    .select()
    .from(timesheetPeriods)
    .where(and(eq(timesheetPeriods.id, id), eq(timesheetPeriods.tenantId, tenantId)))
    .limit(1);
  return period ?? null;
}

export async function listTimesheetEntries(periodId: number): Promise<TimesheetEntry[]> {
  return db
    .select()
    .from(timesheetEntries)
    .where(eq(timesheetEntries.timesheetPeriodId, periodId))
    .orderBy(asc(timesheetEntries.dayOfWeek));
}

async function applyRatesToPeriodEntries(tenantId: number, periodId: number): Promise<void> {
  const entries = await listTimesheetEntries(periodId);

  for (const entry of entries) {
    if (!entry.projectId) continue;
    const roleName = entry.role ?? "Consultant";
    const clientId = await getProjectClientId(entry.projectId);
    const rateItem = await resolveRateForProject(tenantId, entry.projectId, clientId, roleName);

    const hours = parseMoney(entry.hours);
    let chargeRate = 0;
    let costRate = 0;

    if (rateItem) {
      const { hourlyCharge, hourlyCost } = computeItemHourlyRates(rateItem);
      chargeRate = hourlyCharge;
      costRate = hourlyCost;
    }

    await db
      .update(timesheetEntries)
      .set({
        chargeRate: moneyStr(chargeRate),
        costRate: moneyStr(costRate),
        calculatedCharge: moneyStr(hours * chargeRate),
        calculatedCost: moneyStr(hours * costRate),
        updatedAt: new Date(),
      })
      .where(eq(timesheetEntries.id, entry.id));
  }
}

async function recomputePeriodEntryStatus(periodId: number): Promise<boolean> {
  const entries = await listTimesheetEntries(periodId);
  if (entries.length === 0) return true;
  return entries.every((e) => e.approvalStatus === "approved" || e.approvalStatus == null);
}

async function finalizeTimesheetApproval(tenantId: number, periodId: number): Promise<TimesheetPeriod | null> {
  // Period-level approval: pending entries inherit approved status (entry-level rejections remain rejected)
  await db
    .update(timesheetEntries)
    .set({ approvalStatus: "approved", approvedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(timesheetEntries.timesheetPeriodId, periodId),
        or(eq(timesheetEntries.approvalStatus, "pending"), isNull(timesheetEntries.approvalStatus)),
      ),
    );

  const entriesApproved = await recomputePeriodEntryStatus(periodId);
  if (!entriesApproved) return null;

  await applyRatesToPeriodEntries(tenantId, periodId);

  const [updated] = await db
    .update(timesheetPeriods)
    .set({
      approvalStatus: "fully_approved",
      status: "approved",
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(timesheetPeriods.id, periodId))
    .returning();

  if (updated) {
    const entries = await listTimesheetEntries(periodId);
    const projectIds = Array.from(
      new Set(entries.map((e) => e.projectId).filter((id): id is number => id != null)),
    );
    for (const pid of projectIds) {
      await recalculateBudgetActuals(tenantId, pid);
    }

    try {
      const { deliverOnTimesheetApproval } = await import("../resources/jobs");
      await deliverOnTimesheetApproval(tenantId, periodId);
    } catch (err) {
      console.warn("[timesheet] integration delivery failed:", err);
    }

    try {
      const { dispatchTenantWebhook } = await import("../lib/integration-webhook");
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      await dispatchTenantWebhook(tenant?.brandingConfig, "timesheet.approved", {
        tenantId,
        periodId,
        resourceId: updated.resourceId,
      });
    } catch (err) {
      console.warn("[timesheet] webhook dispatch failed:", err);
    }
  }

  return updated ?? null;
}

export async function submitTimesheetPeriod(tenantId: number, periodId: number): Promise<TimesheetPeriod | null> {
  const period = await getTimesheetPeriod(tenantId, periodId);
  if (!period) return null;

  await db
    .update(timesheetEntries)
    .set({ approvalStatus: "pending", rejectionReason: null, approvedById: null, approvedAt: null })
    .where(eq(timesheetEntries.timesheetPeriodId, periodId));

  const [updated] = await db
    .update(timesheetPeriods)
    .set({
      status: "submitted",
      approvalStatus: "pending_pm",
      submittedAt: new Date(),
      approvedByPmId: null,
      approvedByPmAt: null,
      approvedByRmId: null,
      approvedByRmAt: null,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(timesheetPeriods.id, periodId))
    .returning();

  return updated ?? null;
}

export async function approveTimesheetPm(
  tenantId: number,
  periodId: number,
  approverId: string,
): Promise<TimesheetPeriod | null> {
  const period = await getTimesheetPeriod(tenantId, periodId);
  if (!period || period.status !== "submitted") return null;

  const settings = await getOrCreateFinanceSettings(tenantId);

  const [partial] = await db
    .update(timesheetPeriods)
    .set({
      approvedByPmId: approverId,
      approvedByPmAt: new Date(),
      approvalStatus: settings.timesheetApprovalMode === "pm_only" ? "fully_approved" : "pending_rm",
      updatedAt: new Date(),
    })
    .where(eq(timesheetPeriods.id, periodId))
    .returning();

  if (!partial) return null;

  if (isTimesheetFullyApproved(settings.timesheetApprovalMode, partial)) {
    return finalizeTimesheetApproval(tenantId, periodId);
  }
  return partial;
}

export async function approveTimesheetRm(
  tenantId: number,
  periodId: number,
  approverId: string,
): Promise<TimesheetPeriod | null> {
  const period = await getTimesheetPeriod(tenantId, periodId);
  if (!period || period.status !== "submitted") return null;

  const settings = await getOrCreateFinanceSettings(tenantId);

  const [partial] = await db
    .update(timesheetPeriods)
    .set({
      approvedByRmId: approverId,
      approvedByRmAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(timesheetPeriods.id, periodId))
    .returning();

  if (!partial) return null;

  if (isTimesheetFullyApproved(settings.timesheetApprovalMode, partial)) {
    return finalizeTimesheetApproval(tenantId, periodId);
  }
  return partial;
}

export async function rejectTimesheetPeriod(
  tenantId: number,
  periodId: number,
  reason: string,
): Promise<TimesheetPeriod | null> {
  const period = await getTimesheetPeriod(tenantId, periodId);
  if (!period) return null;

  const [updated] = await db
    .update(timesheetPeriods)
    .set({
      status: "rejected",
      approvalStatus: "rejected",
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(timesheetPeriods.id, periodId))
    .returning();

  return updated ?? null;
}

export async function approveTimesheetEntry(
  tenantId: number,
  entryId: number,
  approverId: string,
): Promise<TimesheetEntry | null> {
  const [entry] = await db.select().from(timesheetEntries).where(eq(timesheetEntries.id, entryId)).limit(1);
  if (!entry) return null;

  const period = await getTimesheetPeriod(tenantId, entry.timesheetPeriodId);
  if (!period) return null;

  const [updated] = await db
    .update(timesheetEntries)
    .set({
      approvalStatus: "approved",
      rejectionReason: null,
      approvedById: approverId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(timesheetEntries.id, entryId))
    .returning();

  if (updated) {
    const allApproved = await recomputePeriodEntryStatus(entry.timesheetPeriodId);
    if (allApproved) {
      await finalizeTimesheetApproval(tenantId, entry.timesheetPeriodId);
    } else if (entry.projectId != null) {
      await recalculateBudgetActuals(tenantId, entry.projectId);
    }
  }

  return updated ?? null;
}

export async function rejectTimesheetEntry(
  tenantId: number,
  entryId: number,
  reason: string,
  approverId: string,
): Promise<TimesheetEntry | null> {
  const [entry] = await db.select().from(timesheetEntries).where(eq(timesheetEntries.id, entryId)).limit(1);
  if (!entry) return null;

  const period = await getTimesheetPeriod(tenantId, entry.timesheetPeriodId);
  if (!period) return null;

  const [updated] = await db
    .update(timesheetEntries)
    .set({
      approvalStatus: "rejected",
      rejectionReason: reason,
      approvedById: approverId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(timesheetEntries.id, entryId))
    .returning();

  return updated ?? null;
}

export async function bulkApproveTimesheets(
  tenantId: number,
  periodIds: number[],
  role: "pm" | "rm",
  approverId: string,
): Promise<TimesheetPeriod[]> {
  const results: TimesheetPeriod[] = [];
  for (const periodId of periodIds) {
    const period = role === "pm"
      ? await approveTimesheetPm(tenantId, periodId, approverId)
      : await approveTimesheetRm(tenantId, periodId, approverId);
    if (period) results.push(period);
  }
  return results;
}

function weekDateFromStart(weekStart: Date, dayOfWeek: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + (dayOfWeek - 1));
  return d.toISOString().slice(0, 10);
}

export async function createTimesheetPeriod(
  tenantId: number,
  data: { resourceId: number; weekStartDate: string; weekEndDate?: string },
): Promise<TimesheetPeriod> {
  const start = new Date(data.weekStartDate);
  const end = data.weekEndDate
    ? new Date(data.weekEndDate)
    : new Date(start.getTime() + 6 * 86400000);

  const [period] = await db.insert(timesheetPeriods).values({
    tenantId,
    resourceId: data.resourceId,
    weekStartDate: start,
    weekEndDate: end,
    status: "draft",
    approvalStatus: "draft",
  }).returning();
  return period;
}

export async function upsertTimesheetEntry(
  tenantId: number,
  periodId: number,
  data: {
    id?: number;
    resourceId: number;
    projectId?: number | null;
    projectName?: string | null;
    dayOfWeek: number;
    hours: number | string;
    activityType?: string;
    role?: string | null;
    description?: string | null;
  },
): Promise<TimesheetEntry | null> {
  const period = await getTimesheetPeriod(tenantId, periodId);
  if (!period || period.status !== "draft") return null;

  const hours = String(data.hours);
  const entryDate = weekDateFromStart(new Date(period.weekStartDate), data.dayOfWeek);
  const payload = {
    timesheetPeriodId: periodId,
    resourceId: data.resourceId,
    projectId: data.projectId ?? null,
    projectName: data.projectName ?? null,
    dayOfWeek: data.dayOfWeek,
    entryDate,
    hours,
    activityType: data.activityType ?? "billable",
    role: data.role ?? null,
    description: data.description ?? null,
    updatedAt: new Date(),
  };

  if (data.id) {
    const [updated] = await db.update(timesheetEntries).set(payload).where(eq(timesheetEntries.id, data.id)).returning();
    await recalcTimesheetPeriodTotal(periodId);
    return updated ?? null;
  }

  const [created] = await db.insert(timesheetEntries).values(payload).returning();
  await recalcTimesheetPeriodTotal(periodId);
  return created;
}

export async function deleteTimesheetEntry(tenantId: number, entryId: number): Promise<boolean> {
  const [entry] = await db.select().from(timesheetEntries).where(eq(timesheetEntries.id, entryId)).limit(1);
  if (!entry) return false;
  const period = await getTimesheetPeriod(tenantId, entry.timesheetPeriodId);
  if (!period || period.status !== "draft") return false;
  await db.delete(timesheetEntries).where(eq(timesheetEntries.id, entryId));
  await recalcTimesheetPeriodTotal(entry.timesheetPeriodId);
  return true;
}

async function recalcTimesheetPeriodTotal(periodId: number): Promise<void> {
  const entries = await listTimesheetEntries(periodId);
  const total = entries.reduce((s, e) => s + parseMoney(e.hours), 0);
  await db.update(timesheetPeriods).set({ totalHours: String(total), updatedAt: new Date() }).where(eq(timesheetPeriods.id, periodId));
}

export async function copyTimesheetProjectsFromLastWeek(
  tenantId: number,
  periodId: number,
): Promise<TimesheetEntry[]> {
  const period = await getTimesheetPeriod(tenantId, periodId);
  if (!period || period.status !== "draft") return [];

  const prevStart = new Date(period.weekStartDate);
  prevStart.setDate(prevStart.getDate() - 7);

  const [prevPeriod] = await db.select().from(timesheetPeriods).where(and(
    eq(timesheetPeriods.tenantId, tenantId),
    eq(timesheetPeriods.resourceId, period.resourceId),
    eq(timesheetPeriods.weekStartDate, prevStart),
  )).limit(1);

  if (!prevPeriod) return [];

  const prevEntries = await listTimesheetEntries(prevPeriod.id);
  const projects = new Map<string, { projectId: number | null; projectName: string | null; role: string | null; activityType: string }>();
  for (const e of prevEntries) {
    const key = e.projectName ?? `project-${e.projectId}`;
    if (!projects.has(key)) {
      projects.set(key, {
        projectId: e.projectId,
        projectName: e.projectName,
        role: e.role,
        activityType: e.activityType ?? "billable",
      });
    }
  }

  const created: TimesheetEntry[] = [];
  for (const [, proj] of projects) {
    const [row] = await db.insert(timesheetEntries).values({
      timesheetPeriodId: periodId,
      resourceId: period.resourceId,
      projectId: proj.projectId,
      projectName: proj.projectName,
      dayOfWeek: 1,
      entryDate: weekDateFromStart(new Date(period.weekStartDate), 1),
      hours: "0",
      activityType: proj.activityType,
      role: proj.role,
    }).returning();
    created.push(row);
  }
  return created;
}

export async function getUtilisationReport(tenantId: number, fromDate: string, toDate: string) {
  const approved = await db.select({ id: timesheetPeriods.id }).from(timesheetPeriods).where(and(
    eq(timesheetPeriods.tenantId, tenantId),
    eq(timesheetPeriods.approvalStatus, "fully_approved"),
  ));
  const periodIds = approved.map((p) => p.id);
  if (!periodIds.length) return { billableHours: 0, nonBillableHours: 0, availableHours: 0, pct: 0, byResource: [] as { resourceId: number; billable: number; total: number; pct: number }[] };

  const entries = await db.select().from(timesheetEntries).where(and(
    inArray(timesheetEntries.timesheetPeriodId, periodIds),
    gte(timesheetEntries.entryDate, fromDate),
    lte(timesheetEntries.entryDate, toDate),
  ));

  let billable = 0;
  let nonBillable = 0;
  const byRes = new Map<number, { billable: number; total: number }>();
  for (const e of entries) {
    const h = parseMoney(e.hours);
    if (e.activityType === "billable") billable += h;
    else nonBillable += h;
    const agg = byRes.get(e.resourceId) ?? { billable: 0, total: 0 };
    agg.total += h;
    if (e.activityType === "billable") agg.billable += h;
    byRes.set(e.resourceId, agg);
  }
  const workingDays = workingDaysBetweenIso(fromDate, toDate);
  const activeResources = await db
    .select()
    .from(resources)
    .where(and(
      eq(resources.tenantId, tenantId),
      or(eq(resources.status, "active"), eq(resources.status, "available")),
    ));

  let available = 0;
  for (const r of activeResources) {
    available += (resourceWeeklyCapacityHours(r) / 5) * workingDays;
  }

  return {
    billableHours: billable,
    nonBillableHours: nonBillable,
    availableHours: available,
    pct: utilisationPct(billable, available),
    byResource: Array.from(byRes.entries()).map(([resourceId, v]) => {
      const res = activeResources.find((r) => r.id === resourceId);
      const resAvailable = res
        ? (resourceWeeklyCapacityHours(res) / 5) * workingDays
        : v.total;
      return {
        resourceId,
        billable: v.billable,
        total: v.total,
        pct: utilisationPct(v.billable, resAvailable),
      };
    }),
  };
}

export async function getMissingTimesheetsReport(tenantId: number, weekStartDate: string) {
  const allResources = await db.select({ id: resources.id, firstName: resources.firstName, lastName: resources.lastName })
    .from(resources).where(eq(resources.tenantId, tenantId));

  const submitted = await db.select({ resourceId: timesheetPeriods.resourceId }).from(timesheetPeriods).where(and(
    eq(timesheetPeriods.tenantId, tenantId),
    sql`DATE(${timesheetPeriods.weekStartDate}) = ${weekStartDate}`,
    or(eq(timesheetPeriods.status, "submitted"), eq(timesheetPeriods.approvalStatus, "fully_approved")),
  ));
  const submittedIds = new Set(submitted.map((s) => s.resourceId));
  return allResources.filter((r) => !submittedIds.has(r.id)).map((r) => ({
    resourceId: r.id,
    name: `${r.firstName} ${r.lastName}`,
  }));
}

export function calculateMileageAmount(
  settings: FinanceSettings,
  distance: number,
  vehicleType: string,
): number {
  const rates: Record<string, number> = {
    car: parseMoney(settings.mileageRateCar),
    motorcycle: parseMoney(settings.mileageRateMotorcycle),
    bicycle: parseMoney(settings.mileageRateBicycle),
  };
  return distance * (rates[vehicleType] ?? rates.car);
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

async function recalcExpenseReportTotal(reportId: number): Promise<void> {
  const items = await db.select().from(expenseItems).where(eq(expenseItems.reportId, reportId));
  const total = items.reduce((s, i) => s + parseMoney(i.amount), 0);
  await db
    .update(expenseReports)
    .set({ totalAmount: moneyStr(total), updatedAt: new Date() })
    .where(eq(expenseReports.id, reportId));
}

export async function listExpenseReports(
  tenantId: number,
  filters?: { projectId?: number; userId?: string; status?: string },
): Promise<(ExpenseReport & { projectName: string | null })[]> {
  const conds = [eq(expenseReports.tenantId, tenantId)];
  if (filters?.projectId) conds.push(eq(expenseReports.projectId, filters.projectId));
  if (filters?.userId) conds.push(eq(expenseReports.userId, filters.userId));
  if (filters?.status) conds.push(eq(expenseReports.status, filters.status));

  const rows = await db
    .select({ report: expenseReports, projectName: pmProjects.name })
    .from(expenseReports)
    .leftJoin(pmProjects, eq(expenseReports.projectId, pmProjects.id))
    .where(and(...conds))
    .orderBy(desc(expenseReports.updatedAt));

  return rows.map((r) => ({ ...r.report, projectName: r.projectName }));
}

export async function getExpenseReportDetail(tenantId: number, id: number): Promise<ExpenseReportDetail | null> {
  const [row] = await db
    .select({ report: expenseReports, projectName: pmProjects.name })
    .from(expenseReports)
    .leftJoin(pmProjects, eq(expenseReports.projectId, pmProjects.id))
    .where(and(eq(expenseReports.id, id), eq(expenseReports.tenantId, tenantId)))
    .limit(1);

  if (!row) return null;

  const items = await db
    .select()
    .from(expenseItems)
    .where(eq(expenseItems.reportId, id))
    .orderBy(asc(expenseItems.itemDate));

  return { ...row.report, projectName: row.projectName, items };
}

export async function createExpenseReport(
  tenantId: number,
  data: {
    userId: string;
    projectId: number;
    name: string;
    currency?: string;
    exchangeRate?: string | number | null;
    items?: Omit<typeof expenseItems.$inferInsert, "id" | "reportId" | "createdAt">[];
  },
): Promise<ExpenseReportDetail> {
  const [report] = await db
    .insert(expenseReports)
    .values({
      tenantId,
      userId: data.userId,
      projectId: data.projectId,
      name: data.name,
      currency: data.currency ?? "GBP",
      exchangeRate: data.exchangeRate != null ? String(data.exchangeRate) : null,
    })
    .returning();

  if (data.items?.length) {
    await db.insert(expenseItems).values(data.items.map((i) => ({ ...i, reportId: report.id })));
    await recalcExpenseReportTotal(report.id);
  }

  return (await getExpenseReportDetail(tenantId, report.id))!;
}

export async function updateExpenseReport(
  tenantId: number,
  id: number,
  updates: Partial<Omit<ExpenseReport, "id" | "tenantId" | "createdAt">>,
): Promise<ExpenseReport | null> {
  const [updated] = await db
    .update(expenseReports)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(expenseReports.id, id), eq(expenseReports.tenantId, tenantId)))
    .returning();
  return updated ?? null;
}

export async function deleteExpenseReport(tenantId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(expenseReports)
    .where(and(eq(expenseReports.id, id), eq(expenseReports.tenantId, tenantId)))
    .returning({ id: expenseReports.id });
  return result.length > 0;
}

export async function addExpenseItem(
  tenantId: number,
  reportId: number,
  item: Omit<typeof expenseItems.$inferInsert, "id" | "reportId" | "createdAt">,
): Promise<ExpenseItem | null> {
  const report = await getExpenseReportDetail(tenantId, reportId);
  if (!report || report.status !== "draft") return null;

  const [created] = await db.insert(expenseItems).values({ ...item, reportId }).returning();
  await recalcExpenseReportTotal(reportId);
  return created;
}

export async function updateExpenseItem(
  tenantId: number,
  itemId: number,
  updates: Partial<Omit<ExpenseItem, "id" | "reportId" | "createdAt">>,
): Promise<ExpenseItem | null> {
  const [existing] = await db
    .select({ item: expenseItems, report: expenseReports })
    .from(expenseItems)
    .innerJoin(expenseReports, eq(expenseItems.reportId, expenseReports.id))
    .where(and(eq(expenseItems.id, itemId), eq(expenseReports.tenantId, tenantId)))
    .limit(1);

  if (!existing || existing.report.status === "approved") return null;

  const [updated] = await db
    .update(expenseItems)
    .set(updates)
    .where(eq(expenseItems.id, itemId))
    .returning();

  if (updated) await recalcExpenseReportTotal(existing.report.id);
  return updated ?? null;
}

export async function deleteExpenseItem(tenantId: number, itemId: number): Promise<boolean> {
  const [existing] = await db
    .select({ item: expenseItems, report: expenseReports })
    .from(expenseItems)
    .innerJoin(expenseReports, eq(expenseItems.reportId, expenseReports.id))
    .where(and(eq(expenseItems.id, itemId), eq(expenseReports.tenantId, tenantId)))
    .limit(1);

  if (!existing) return false;
  await db.delete(expenseItems).where(eq(expenseItems.id, itemId));
  await recalcExpenseReportTotal(existing.report.id);
  return true;
}

export async function setExpenseItemReceipt(
  tenantId: number,
  itemId: number,
  receiptUrl: string,
): Promise<ExpenseItem | null> {
  return updateExpenseItem(tenantId, itemId, { receiptUrl });
}

export async function submitExpenseReport(tenantId: number, id: number): Promise<ExpenseReport | null> {
  const report = await getExpenseReportDetail(tenantId, id);
  if (!report || report.status !== "draft") return null;

  const [updated] = await db
    .update(expenseReports)
    .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(expenseReports.id, id))
    .returning();
  return updated ?? null;
}

export async function approveExpenseReport(
  tenantId: number,
  id: number,
  approverId: string,
): Promise<ExpenseReport | null> {
  const report = await getExpenseReportDetail(tenantId, id);
  if (!report || report.status !== "submitted") return null;

  const [updated] = await db
    .update(expenseReports)
    .set({
      status: "approved",
      approvedBy: approverId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(expenseReports.id, id))
    .returning();

  if (updated) await recalculateBudgetActuals(tenantId, updated.projectId);
  return updated ?? null;
}

export async function rejectExpenseReport(
  tenantId: number,
  id: number,
  reason: string,
): Promise<ExpenseReport | null> {
  const report = await getExpenseReportDetail(tenantId, id);
  if (!report) return null;

  const [updated] = await db
    .update(expenseReports)
    .set({
      status: "rejected",
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(expenseReports.id, id))
    .returning();
  return updated ?? null;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function listInvoices(
  tenantId: number,
  filters?: {
    projectId?: number;
    clientId?: number;
    status?: string;
    fromDate?: string;
    toDate?: string;
  },
): Promise<(FinanceInvoice & { projectName: string | null; clientName: string | null })[]> {
  const conds = [eq(financeInvoices.tenantId, tenantId)];
  if (filters?.projectId) conds.push(eq(financeInvoices.projectId, filters.projectId));
  if (filters?.clientId) conds.push(eq(financeInvoices.clientId, filters.clientId));
  if (filters?.status) conds.push(eq(financeInvoices.status, filters.status));
  if (filters?.fromDate) conds.push(gte(financeInvoices.issueDate, filters.fromDate));
  if (filters?.toDate) conds.push(lte(financeInvoices.issueDate, filters.toDate));

  const rows = await db
    .select({
      invoice: financeInvoices,
      projectName: pmProjects.name,
      clientName: crmAccounts.name,
    })
    .from(financeInvoices)
    .leftJoin(pmProjects, eq(financeInvoices.projectId, pmProjects.id))
    .leftJoin(crmAccounts, eq(financeInvoices.clientId, crmAccounts.id))
    .where(and(...conds))
    .orderBy(desc(financeInvoices.issueDate));

  return rows.map((r) => ({ ...r.invoice, projectName: r.projectName, clientName: r.clientName }));
}

export async function getInvoiceDetail(tenantId: number, id: number): Promise<InvoiceDetail | null> {
  const [row] = await db
    .select({
      invoice: financeInvoices,
      projectName: pmProjects.name,
      clientName: crmAccounts.name,
    })
    .from(financeInvoices)
    .leftJoin(pmProjects, eq(financeInvoices.projectId, pmProjects.id))
    .leftJoin(crmAccounts, eq(financeInvoices.clientId, crmAccounts.id))
    .where(and(eq(financeInvoices.id, id), eq(financeInvoices.tenantId, tenantId)))
    .limit(1);

  if (!row) return null;

  const [lines, payments] = await Promise.all([
    db.select().from(financeInvoiceLines).where(eq(financeInvoiceLines.invoiceId, id)),
    db.select().from(financeInvoicePayments).where(eq(financeInvoicePayments.invoiceId, id)),
  ]);

  return { ...row.invoice, projectName: row.projectName, clientName: row.clientName, lines, payments };
}

export async function createInvoice(
  tenantId: number,
  data: {
    projectId: number;
    clientId?: number | null;
    contractType: string;
    issueDate?: string;
    paymentTerms?: string;
    currency?: string;
    exchangeRate?: string | number | null;
    notes?: string | null;
    poNumber?: string | null;
    createdBy?: string | null;
    taxAmount?: string | number | null;
    vatAmount?: string | number | null;
    milestoneLineIds?: number[];
    includeTimesheets?: boolean;
    includeExpenses?: boolean;
    periodStart?: string;
    periodEnd?: string;
    manualLines?: {
      lineType?: string;
      description: string;
      quantity?: number;
      unitRate?: number;
      amount: number;
    }[];
  },
): Promise<InvoiceDetail> {
  const settings = await getOrCreateFinanceSettings(tenantId);
  const issueDate = data.issueDate ?? todayIso();
  const paymentTerms = data.paymentTerms ?? settings.defaultPaymentTerms ?? "net_30";
  const dueDate = dueDateFromTerms(issueDate, paymentTerms);
  const year = new Date(issueDate).getFullYear();
  const prefix = settings.invoicePrefix ?? "INV";
  const seq = await nextInvoiceSeq(tenantId, prefix, year);
  const invoiceNumber = nextInvoiceNumber(prefix, year, seq);

  const clientId = data.clientId ?? (await getProjectClientId(data.projectId));
  const contractType = data.contractType;
  const lines: Omit<typeof financeInvoiceLines.$inferInsert, "id" | "invoiceId" | "createdAt">[] = [];

  if (contractType === "fixed_price" || contractType === "mixed") {
    const budget = await db
      .select()
      .from(projectBudgets)
      .where(and(eq(projectBudgets.tenantId, tenantId), eq(projectBudgets.projectId, data.projectId)))
      .limit(1);

    if (budget[0]) {
      const milestoneConds = [
        eq(budgetMilestoneLines.budgetId, budget[0].id),
        eq(budgetMilestoneLines.isInvoiced, false),
      ];
      if (data.milestoneLineIds?.length) {
        milestoneConds.push(inArray(budgetMilestoneLines.id, data.milestoneLineIds));
      }

      const milestones = await db
        .select()
        .from(budgetMilestoneLines)
        .where(and(...milestoneConds));

      for (const m of milestones) {
        const amount = parseMoney(m.value);
        lines.push({
          lineType: "fixed_fee",
          description: m.name,
          quantity: "1",
          unitRate: moneyStr(amount),
          amount: moneyStr(amount),
          milestoneId: m.milestoneId ?? null,
        });
      }
    }
  }

  if (contractType === "time_materials" || contractType === "mixed") {
    if (data.includeTimesheets !== false) {
      const approvedPeriods = await db
        .select({ id: timesheetPeriods.id })
        .from(timesheetPeriods)
        .where(and(eq(timesheetPeriods.tenantId, tenantId), eq(timesheetPeriods.approvalStatus, "fully_approved")));

      const periodIds = approvedPeriods.map((p) => p.id);
      if (periodIds.length) {
        const entryConds = [
          inArray(timesheetEntries.timesheetPeriodId, periodIds),
          eq(timesheetEntries.projectId, data.projectId),
          eq(timesheetEntries.isInvoiced, false),
          eq(timesheetEntries.activityType, "billable"),
        ];
        if (data.periodStart) entryConds.push(gte(timesheetEntries.entryDate, data.periodStart));
        if (data.periodEnd) entryConds.push(lte(timesheetEntries.entryDate, data.periodEnd));

        const entries = await db
          .select()
          .from(timesheetEntries)
          .where(and(...entryConds));

        const byRole = new Map<string, { hours: number; charge: number; ids: number[] }>();
        for (const e of entries) {
          const role = e.role ?? "Consultant";
          const existing = byRole.get(role) ?? { hours: 0, charge: 0, ids: [] };
          existing.hours += parseMoney(e.hours);
          existing.charge += parseMoney(e.calculatedCharge);
          existing.ids.push(e.id);
          byRole.set(role, existing);
        }

        for (const [role, agg] of Array.from(byRole.entries())) {
          const unitRate = agg.hours > 0 ? agg.charge / agg.hours : 0;
          lines.push({
            lineType: "timesheet",
            description: `${role} — ${agg.hours.toFixed(1)} hours`,
            quantity: moneyStr(agg.hours),
            unitRate: moneyStr(unitRate),
            amount: moneyStr(agg.charge),
            timesheetEntryIds: agg.ids,
          });
        }
      }
    }

    if (data.includeExpenses !== false) {
      const billableItems = await db
        .select({ item: expenseItems, report: expenseReports })
        .from(expenseItems)
        .innerJoin(expenseReports, eq(expenseItems.reportId, expenseReports.id))
        .where(and(
          eq(expenseReports.tenantId, tenantId),
          eq(expenseReports.projectId, data.projectId),
          eq(expenseReports.status, "approved"),
          eq(expenseItems.isBillable, true),
          eq(expenseItems.isInvoiced, false),
        ));

      for (const { item } of billableItems) {
        const amount = parseMoney(item.amount);
        lines.push({
          lineType: "expense",
          description: item.description,
          quantity: "1",
          unitRate: moneyStr(amount),
          amount: moneyStr(amount),
          expenseItemIds: [item.id],
        });
      }
    }
  }

  if (data.manualLines?.length) {
    for (const ml of data.manualLines) {
      lines.push({
        lineType: ml.lineType ?? "fixed_fee",
        description: ml.description,
        quantity: moneyStr(ml.quantity ?? 1),
        unitRate: moneyStr(ml.unitRate ?? ml.amount),
        amount: moneyStr(ml.amount),
      });
    }
  }

  const subtotal = lines.reduce((s, l) => s + parseMoney(l.amount), 0);
  const taxAmount = parseMoney(data.taxAmount ?? 0) + parseMoney(data.vatAmount ?? 0);
  const total = subtotal + taxAmount;

  const [invoice] = await db
    .insert(financeInvoices)
    .values({
      tenantId,
      projectId: data.projectId,
      clientId,
      invoiceNumber,
      contractType,
      issueDate,
      dueDate,
      paymentTerms,
      currency: data.currency ?? settings.baseCurrency ?? "GBP",
      exchangeRate: data.exchangeRate != null ? String(data.exchangeRate) : null,
      subtotal: moneyStr(subtotal),
      taxAmount: moneyStr(taxAmount),
      total: moneyStr(total),
      notes: data.notes ?? null,
      poNumber: data.poNumber ?? null,
      createdBy: data.createdBy ?? null,
    })
    .returning();

  if (lines.length) {
    await db.insert(financeInvoiceLines).values(lines.map((l) => ({ ...l, invoiceId: invoice.id })));
  }

  return (await getInvoiceDetail(tenantId, invoice.id))!;
}

export async function updateInvoice(
  tenantId: number,
  id: number,
  updates: Partial<Omit<FinanceInvoice, "id" | "tenantId" | "createdAt">> & {
    lines?: Omit<typeof financeInvoiceLines.$inferInsert, "id" | "invoiceId" | "createdAt">[];
    vatAmount?: string | number | null;
  },
): Promise<InvoiceDetail | null> {
  const existing = await getInvoiceDetail(tenantId, id);
  if (!existing || existing.status !== "draft") return null;

  const { lines, vatAmount: vatInput, ...invoiceUpdates } = updates;
  const [updated] = await db
    .update(financeInvoices)
    .set({ ...invoiceUpdates, updatedAt: new Date() })
    .where(and(eq(financeInvoices.id, id), eq(financeInvoices.tenantId, tenantId)))
    .returning();

  if (!updated) return null;

  if (lines) {
    await db.delete(financeInvoiceLines).where(eq(financeInvoiceLines.invoiceId, id));
    if (lines.length) {
      await db.insert(financeInvoiceLines).values(lines.map((l) => ({ ...l, invoiceId: id })));
    }
    const subtotal = lines.reduce((s, l) => s + parseMoney(l.amount), 0);
    const taxAmount = parseMoney(invoiceUpdates.taxAmount ?? existing.taxAmount ?? 0)
      + parseMoney(vatInput ?? 0);
    const total = subtotal + taxAmount;
    await db
      .update(financeInvoices)
      .set({
        subtotal: moneyStr(subtotal),
        taxAmount: moneyStr(taxAmount),
        total: moneyStr(total),
        updatedAt: new Date(),
      })
      .where(eq(financeInvoices.id, id));
  } else if (invoiceUpdates.taxAmount != null || vatInput != null) {
    const subtotal = parseMoney(updated.subtotal);
    const taxAmount = parseMoney(invoiceUpdates.taxAmount ?? updated.taxAmount ?? 0)
      + parseMoney(vatInput ?? 0);
    await db
      .update(financeInvoices)
      .set({
        taxAmount: moneyStr(taxAmount),
        total: moneyStr(subtotal + taxAmount),
        updatedAt: new Date(),
      })
      .where(eq(financeInvoices.id, id));
  }

  return getInvoiceDetail(tenantId, id);
}

async function markInvoiceLineSourcesInvoiced(lines: FinanceInvoiceLine[]): Promise<void> {
  for (const line of lines) {
    const tsIds = (line.timesheetEntryIds as number[] | null) ?? [];
    if (tsIds.length) {
      await db
        .update(timesheetEntries)
        .set({ isInvoiced: true, updatedAt: new Date() })
        .where(inArray(timesheetEntries.id, tsIds));
    }

    const expIds = (line.expenseItemIds as number[] | null) ?? [];
    if (expIds.length) {
      await db
        .update(expenseItems)
        .set({ isInvoiced: true })
        .where(inArray(expenseItems.id, expIds));
    }

    if (line.milestoneId) {
      await db
        .update(budgetMilestoneLines)
        .set({ isInvoiced: true })
        .where(eq(budgetMilestoneLines.milestoneId, line.milestoneId));
    }
  }
}

async function unmarkInvoiceLineSourcesInvoiced(lines: FinanceInvoiceLine[]): Promise<void> {
  for (const line of lines) {
    const tsIds = (line.timesheetEntryIds as number[] | null) ?? [];
    if (tsIds.length) {
      await db
        .update(timesheetEntries)
        .set({ isInvoiced: false, updatedAt: new Date() })
        .where(inArray(timesheetEntries.id, tsIds));
    }

    const expIds = (line.expenseItemIds as number[] | null) ?? [];
    if (expIds.length) {
      await db
        .update(expenseItems)
        .set({ isInvoiced: false })
        .where(inArray(expenseItems.id, expIds));
    }

    if (line.milestoneId) {
      await db
        .update(budgetMilestoneLines)
        .set({ isInvoiced: false })
        .where(eq(budgetMilestoneLines.milestoneId, line.milestoneId));
    }
  }
}

export async function sendInvoice(tenantId: number, id: number): Promise<InvoiceDetail | null> {
  const detail = await getInvoiceDetail(tenantId, id);
  if (!detail || detail.status !== "draft") return null;

  await markInvoiceLineSourcesInvoiced(detail.lines);

  const [updated] = await db
    .update(financeInvoices)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(eq(financeInvoices.id, id))
    .returning();

  if (updated) {
    const budget = await db
      .select()
      .from(projectBudgets)
      .where(and(eq(projectBudgets.tenantId, tenantId), eq(projectBudgets.projectId, updated.projectId)))
      .limit(1);

    if (budget[0]) {
      const newBilled = parseMoney(budget[0].billedToDate) + parseMoney(updated.total);
      await db
        .update(projectBudgets)
        .set({ billedToDate: moneyStr(newBilled), updatedAt: new Date() })
        .where(eq(projectBudgets.id, budget[0].id));
    }
  }

  return getInvoiceDetail(tenantId, id);
}

export async function sendInvoiceWithEmail(
  tenantId: number,
  id: number,
  recipientEmail: string,
): Promise<{ invoice: InvoiceDetail | null; emailSent: boolean; emailError?: string }> {
  const sent = await sendInvoice(tenantId, id);
  if (!sent) return { invoice: null, emailSent: false, emailError: "Invoice not found or not draft" };

  try {
    const { sendOrgEmail } = await import("../lib/org-email");
    const { generateInvoicePdf } = await import("./invoice-pdf");
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const pdfData = await getInvoicePdfData(tenantId, id);
    if (!pdfData) return { invoice: sent, emailSent: false, emailError: "PDF data unavailable" };

    const pdf = generateInvoicePdf(
      pdfData.invoice,
      pdfData.invoice.lines ?? [],
      pdfData.orgName,
      pdfData.orgAddress,
      pdfData.bankDetails,
      pdfData.invoice.clientName ?? undefined,
    );

    const result = await sendOrgEmail({
      tenant,
      to: recipientEmail,
      subject: `Invoice ${sent.invoiceNumber} from ${pdfData.orgName}`,
      html: `<p>Invoice <strong>${sent.invoiceNumber}</strong> for ${sent.currency} ${sent.total} is ready.</p><p>Due date: ${sent.dueDate}</p><p>Download the PDF from your Finance module.</p>`,
    });

    return { invoice: sent, emailSent: result.sent, emailError: result.error };
  } catch (err) {
    return {
      invoice: sent,
      emailSent: false,
      emailError: err instanceof Error ? err.message : "Email failed",
    };
  }
}

export async function recordInvoicePayment(
  tenantId: number,
  invoiceId: number,
  data: {
    paymentDate: string;
    amount: number;
    paymentMethod?: string;
    reference?: string | null;
    createdBy?: string | null;
  },
): Promise<InvoiceDetail | null> {
  const invoice = await getInvoiceDetail(tenantId, invoiceId);
  if (!invoice || invoice.status === "void" || invoice.status === "credit_note") return null;

  await db.insert(financeInvoicePayments).values({
    invoiceId,
    paymentDate: data.paymentDate,
    amount: moneyStr(data.amount),
    paymentMethod: data.paymentMethod ?? "bank_transfer",
    reference: data.reference ?? null,
    createdBy: data.createdBy ?? null,
  });

  const newPaid = parseMoney(invoice.amountPaid) + data.amount;
  const total = parseMoney(invoice.total);
  const status = newPaid >= total ? "paid" : "partially_paid";

  await db
    .update(financeInvoices)
    .set({
      amountPaid: moneyStr(newPaid),
      status,
      paidDate: status === "paid" ? data.paymentDate : invoice.paidDate,
      updatedAt: new Date(),
    })
    .where(eq(financeInvoices.id, invoiceId));

  return getInvoiceDetail(tenantId, invoiceId);
}

export async function createCreditNote(
  tenantId: number,
  invoiceId: number,
  createdBy?: string | null,
): Promise<InvoiceDetail | null> {
  const original = await getInvoiceDetail(tenantId, invoiceId);
  if (!original || original.status === "credit_note" || original.status === "void") return null;

  const settings = await getOrCreateFinanceSettings(tenantId);
  const issueDate = todayIso();
  const year = new Date(issueDate).getFullYear();
  const prefix = settings.invoicePrefix ?? "INV";
  const seq = await nextInvoiceSeq(tenantId, prefix, year);
  const invoiceNumber = nextInvoiceNumber(prefix, year, seq);

  const creditLines = original.lines.map((l) => ({
    lineType: l.lineType,
    description: `Credit: ${l.description}`,
    quantity: l.quantity,
    unitRate: moneyStr(-parseMoney(l.unitRate)),
    amount: moneyStr(-parseMoney(l.amount)),
    timesheetEntryIds: l.timesheetEntryIds,
    expenseItemIds: l.expenseItemIds,
    milestoneId: l.milestoneId,
  }));

  const subtotal = creditLines.reduce((s, l) => s + parseMoney(l.amount), 0);

  const [credit] = await db
    .insert(financeInvoices)
    .values({
      tenantId,
      projectId: original.projectId,
      clientId: original.clientId,
      invoiceNumber,
      contractType: original.contractType,
      issueDate,
      dueDate: issueDate,
      paymentTerms: original.paymentTerms,
      currency: original.currency,
      subtotal: moneyStr(subtotal),
      total: moneyStr(subtotal),
      status: "credit_note",
      notes: `Credit note for invoice ${original.invoiceNumber}`,
      createdBy: createdBy ?? null,
    })
    .returning();

  if (creditLines.length) {
    await db.insert(financeInvoiceLines).values(creditLines.map((l) => ({ ...l, invoiceId: credit.id })));
  }

  const sentStatuses = new Set(["sent", "partially_paid", "paid", "overdue"]);
  if (sentStatuses.has(original.status)) {
    await unmarkInvoiceLineSourcesInvoiced(original.lines);

    const budget = await db
      .select()
      .from(projectBudgets)
      .where(and(eq(projectBudgets.tenantId, tenantId), eq(projectBudgets.projectId, original.projectId)))
      .limit(1);

    if (budget[0]) {
      const newBilled = Math.max(0, parseMoney(budget[0].billedToDate) - parseMoney(original.total));
      await db
        .update(projectBudgets)
        .set({ billedToDate: moneyStr(newBilled), updatedAt: new Date() })
        .where(eq(projectBudgets.id, budget[0].id));
    }
  }

  await db
    .update(financeInvoices)
    .set({ status: "void", updatedAt: new Date() })
    .where(eq(financeInvoices.id, invoiceId));

  return getInvoiceDetail(tenantId, credit.id);
}

export async function getInvoicePdfData(tenantId: number, id: number): Promise<{
  invoice: InvoiceDetail;
  orgName: string;
  orgAddress: string | null;
  bankDetails: string | null;
} | null> {
  const invoice = await getInvoiceDetail(tenantId, id);
  if (!invoice) return null;

  const [tenant, settings] = await Promise.all([
    db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1),
    getOrCreateFinanceSettings(tenantId),
  ]);

  return {
    invoice,
    orgName: tenant[0]?.name ?? "Organisation",
    orgAddress: settings.orgAddress ?? tenant[0]?.address ?? null,
    bankDetails: settings.orgBankDetails ?? null,
  };
}

// ---------------------------------------------------------------------------
// ERP
// ---------------------------------------------------------------------------

export async function listErpIntegrations(tenantId: number) {
  return db
    .select()
    .from(erpIntegrations)
    .where(eq(erpIntegrations.tenantId, tenantId))
    .orderBy(desc(erpIntegrations.updatedAt));
}

export async function createErpIntegration(
  tenantId: number,
  data: Omit<typeof erpIntegrations.$inferInsert, "id" | "tenantId" | "createdAt" | "updatedAt">,
) {
  const [created] = await db.insert(erpIntegrations).values({ ...data, tenantId }).returning();
  return created;
}

export async function updateErpIntegration(
  tenantId: number,
  id: number,
  updates: Partial<Omit<typeof erpIntegrations.$inferInsert, "id" | "tenantId" | "createdAt">>,
) {
  const [updated] = await db
    .update(erpIntegrations)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(erpIntegrations.id, id), eq(erpIntegrations.tenantId, tenantId)))
    .returning();
  return updated ?? null;
}

export async function deleteErpIntegration(tenantId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(erpIntegrations)
    .where(and(eq(erpIntegrations.id, id), eq(erpIntegrations.tenantId, tenantId)))
    .returning({ id: erpIntegrations.id });
  return result.length > 0;
}

export async function listErpSyncLog(
  tenantId: number,
  filters?: { integrationId?: number; entityType?: string; status?: string },
) {
  const conds = [eq(erpSyncLog.tenantId, tenantId)];
  if (filters?.integrationId) conds.push(eq(erpSyncLog.integrationId, filters.integrationId));
  if (filters?.entityType) conds.push(eq(erpSyncLog.entityType, filters.entityType));
  if (filters?.status) conds.push(eq(erpSyncLog.status, filters.status));

  return db
    .select()
    .from(erpSyncLog)
    .where(and(...conds))
    .orderBy(desc(erpSyncLog.syncedAt))
    .limit(200);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function resolveProjectBudgetTimeline(
  projectStart: string | null | undefined,
  projectEnd: string | null | undefined,
  budgetCreatedAt?: Date | string | null,
): { start: Date; end: Date } | null {
  if (projectStart && projectEnd) {
    const start = new Date(projectStart);
    const end = new Date(projectEnd);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
      return { start, end };
    }
  }
  if (projectStart) {
    const start = new Date(projectStart);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      return { start, end };
    }
  }
  if (projectEnd) {
    const end = new Date(projectEnd);
    if (!Number.isNaN(end.getTime())) {
      const start = new Date(end);
      start.setFullYear(start.getFullYear() - 1);
      return { start, end };
    }
  }
  if (budgetCreatedAt) {
    const created = new Date(budgetCreatedAt);
    if (!Number.isNaN(created.getTime())) {
      return {
        start: new Date(created.getFullYear(), 0, 1),
        end: new Date(created.getFullYear(), 11, 31),
      };
    }
  }
  return null;
}

function monthBudgetForProject(
  budgetTotal: number,
  projectStart: string | null | undefined,
  projectEnd: string | null | undefined,
  year: number,
  month: number,
  budgetCreatedAt?: Date | string | null,
): number {
  if (budgetTotal <= 0) return 0;
  const timeline = resolveProjectBudgetTimeline(projectStart, projectEnd, budgetCreatedAt);
  if (!timeline) return 0;
  const { start, end } = timeline;
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  if (monthEnd < start || monthStart > end) return 0;
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  const overlapStart = start > monthStart ? start : monthStart;
  const overlapEnd = end < monthEnd ? end : monthEnd;
  const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1);
  return budgetTotal * (overlapDays / totalDays);
}

export async function loadFinanceDashboard(
  tenantId: number,
  clientId?: number,
): Promise<FinanceDashboard> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const { start: monthStart, end: monthEnd } = monthRange(year, month);
  const { start: ytdStart, end: ytdEnd } = { start: `${year}-01-01`, end: monthEnd };
  const { start: prevYtdStart, end: prevYtdEnd } = {
    start: `${year - 1}-01-01`,
    end: `${year - 1}-${String(month + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  };

  const invoiceConds = [eq(financeInvoices.tenantId, tenantId)];
  if (clientId) invoiceConds.push(eq(financeInvoices.clientId, clientId));

  const allInvoices = await db
    .select()
    .from(financeInvoices)
    .where(and(...invoiceConds));

  const sentStatuses = new Set(["sent", "partially_paid", "paid", "overdue"]);
  let revenueThisMonth = 0;
  let outstandingInvoices = 0;
  let totalBilledYtd = 0;
  let totalBilledPrevYtd = 0;

  const ageingBuckets: Record<string, { count: number; amount: number }> = {
    current: { count: 0, amount: 0 },
    "1-30": { count: 0, amount: 0 },
    "31-60": { count: 0, amount: 0 },
    "60+": { count: 0, amount: 0 },
  };

  const today = todayIso();

  for (const inv of allInvoices) {
    const total = parseMoney(inv.total);
    const paid = parseMoney(inv.amountPaid);
    const outstanding = total - paid;

    if (sentStatuses.has(inv.status) && inv.issueDate >= monthStart && inv.issueDate <= monthEnd) {
      revenueThisMonth += total;
    }
    if (inv.status === "credit_note" && inv.issueDate >= monthStart && inv.issueDate <= monthEnd) {
      revenueThisMonth += total;
    }

    if (sentStatuses.has(inv.status) && outstanding > 0) {
      outstandingInvoices += outstanding;
      const bucket = invoiceAgeBucket(inv.dueDate, today);
      ageingBuckets[bucket].count += 1;
      ageingBuckets[bucket].amount += outstanding;
    }

    if (sentStatuses.has(inv.status) && inv.issueDate >= ytdStart && inv.issueDate <= ytdEnd) {
      totalBilledYtd += total;
    }
    if (inv.status === "credit_note" && inv.issueDate >= ytdStart && inv.issueDate <= ytdEnd) {
      totalBilledYtd += total;
    }
    if (sentStatuses.has(inv.status) && inv.issueDate >= prevYtdStart && inv.issueDate <= prevYtdEnd) {
      totalBilledPrevYtd += total;
    }
    if (inv.status === "credit_note" && inv.issueDate >= prevYtdStart && inv.issueDate <= prevYtdEnd) {
      totalBilledPrevYtd += total;
    }
  }

  const totalBilledYtdYoYPct = totalBilledPrevYtd > 0
    ? Math.round(((totalBilledYtd - totalBilledPrevYtd) / totalBilledPrevYtd) * 100)
    : totalBilledYtd > 0 ? 100 : 0;

  const budgetConds = [eq(projectBudgets.tenantId, tenantId)];
  if (clientId) budgetConds.push(eq(projectBudgets.clientId, clientId));

  const budgets = await db
    .select({
      budget: projectBudgets,
      projectName: pmProjects.name,
      clientName: crmAccounts.name,
      projectStart: pmProjects.startDate,
      projectEnd: pmProjects.endDate,
    })
    .from(projectBudgets)
    .innerJoin(pmProjects, eq(projectBudgets.projectId, pmProjects.id))
    .leftJoin(crmAccounts, eq(projectBudgets.clientId, crmAccounts.id))
    .where(and(...budgetConds));

  const margins: number[] = [];
  const projectFinancialHealth: FinanceDashboard["projectFinancialHealth"] = [];

  for (const row of budgets) {
    const revenue = parseMoney(row.budget.billedToDate);
    const cost = parseMoney(row.budget.actualCost);
    const budgetTotal = parseMoney(row.budget.totalBudget);
    const margin = projectMarginPct(revenue, cost);
    margins.push(margin);

    let timelineElapsedPct = 50;
    if (row.projectStart && row.projectEnd) {
      const start = Date.parse(String(row.projectStart));
      const end = Date.parse(String(row.projectEnd));
      if (end > start) {
        timelineElapsedPct = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
      }
    }

    projectFinancialHealth.push({
      projectId: row.budget.projectId,
      projectName: row.projectName,
      clientName: row.clientName,
      budget: budgetTotal,
      actualCost: cost,
      billedToDate: revenue,
      marginPct: margin,
      ragStatus: budgetRagStatus(cost, budgetTotal),
      evm: row.budget.evmEnabled ? computeEvm(row.budget, timelineElapsedPct) : undefined,
    });
  }

  const avgProjectMarginPct = margins.length
    ? Math.round(margins.reduce((s, m) => s + m, 0) / margins.length)
    : 0;

  const tsConds = [
    eq(timesheetPeriods.tenantId, tenantId),
    or(eq(timesheetPeriods.status, "submitted"), eq(timesheetPeriods.approvalStatus, "pending")),
  ];
  const unapprovedTsRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(timesheetPeriods)
    .where(and(...tsConds));
  const unapprovedTimesheets = unapprovedTsRows[0]?.count ?? 0;

  const expConds = [eq(expenseReports.tenantId, tenantId), eq(expenseReports.status, "submitted")];
  if (clientId) {
    const clientProjects = await db
      .select({ id: pmProjects.id })
      .from(pmProjects)
      .where(and(eq(pmProjects.tenantId, tenantId), eq(pmProjects.clientId, clientId)));
    const projectIds = clientProjects.map((p) => p.id);
    expConds.push(projectIds.length ? inArray(expenseReports.projectId, projectIds) : sql`false`);
  }
  const unapprovedExpRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(expenseReports)
    .where(and(...expConds));
  const unapprovedExpenses = unapprovedExpRows[0]?.count ?? 0;

  const revenueVsBudget: FinanceDashboard["revenueVsBudget"] = [];
  for (let offset = -5; offset <= 3; offset++) {
    const d = new Date(year, month + offset, 1);
    const { start, end } = monthRange(d.getFullYear(), d.getMonth());
    const isFuture = offset > 0;

    let actual = 0;
    if (!isFuture) {
      for (const inv of allInvoices) {
        if (sentStatuses.has(inv.status) && inv.issueDate >= start && inv.issueDate <= end) {
          actual += parseMoney(inv.total);
        }
        if (inv.status === "credit_note" && inv.issueDate >= start && inv.issueDate <= end) {
          actual += parseMoney(inv.total);
        }
      }
    }

    const monthBudget = budgets.reduce((s, b) => {
      const total = parseMoney(b.budget.totalBudget);
      return s + monthBudgetForProject(
        total,
        b.projectStart,
        b.projectEnd,
        d.getFullYear(),
        d.getMonth(),
        b.budget.createdAt,
      );
    }, 0);

    revenueVsBudget.push({
      month: monthKey(d),
      budget: Math.round(monthBudget),
      actual: Math.round(actual),
      isFuture,
    });
  }

  const approvedPeriodIds = await db
    .select({ id: timesheetPeriods.id })
    .from(timesheetPeriods)
    .where(and(eq(timesheetPeriods.tenantId, tenantId), eq(timesheetPeriods.approvalStatus, "fully_approved")));

  let billableHours = 0;
  let nonBillableHours = 0;

  if (approvedPeriodIds.length) {
    const periodIds = approvedPeriodIds.map((p) => p.id);
    const entries = await db
      .select({ entry: timesheetEntries })
      .from(timesheetEntries)
      .where(and(
        inArray(timesheetEntries.timesheetPeriodId, periodIds),
        gte(timesheetEntries.entryDate, monthStart),
        lte(timesheetEntries.entryDate, monthEnd),
      ));

    for (const { entry: e } of entries) {
      const hours = parseMoney(e.hours);
      if (e.activityType === "billable") billableHours += hours;
      else nonBillableHours += hours;
    }
  }

  const workingDays = workingDaysBetweenIso(monthStart, monthEnd);
  const activeResources = await db
    .select()
    .from(resources)
    .where(and(
      eq(resources.tenantId, tenantId),
      or(eq(resources.status, "active"), eq(resources.status, "available")),
    ));

  const availableHours = activeResources.reduce(
    (sum, r) => sum + (resourceWeeklyCapacityHours(r) / 5) * workingDays,
    0,
  );
  const pct = utilisationPct(billableHours, availableHours);

  return {
    kpis: {
      revenueThisMonth,
      outstandingInvoices,
      totalBilledYtd,
      totalBilledYtdYoYPct,
      avgProjectMarginPct,
      unapprovedTimesheets,
      unapprovedExpenses,
    },
    revenueVsBudget,
    projectFinancialHealth,
    invoiceAgeing: Object.entries(ageingBuckets).map(([bucket, v]) => ({
      bucket,
      count: v.count,
      amount: v.amount,
    })),
    utilisation: {
      billableHours,
      nonBillableHours,
      availableHours,
      pct,
    },
  };
}
