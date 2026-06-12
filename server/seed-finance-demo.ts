/**
 * Seed Finance module with demo data for UI testing.
 * Usage: npm run db:seed-finance
 *        FORCE=1 npm run db:seed-finance   (re-seed even if data exists)
 */
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, pmProjects, resources, crmAccounts, projectBudgets, erpSyncLog } from "@shared/schema";
import {
  getOrCreateFinanceSettings,
  updateFinanceSettings,
  createExchangeRate,
  createRateCard,
  createProjectBudget,
  updateProjectBudget,
  recalculateBudgetActuals,
  createTimesheetPeriod,
  upsertTimesheetEntry,
  submitTimesheetPeriod,
  approveTimesheetPm,
  approveTimesheetRm,
  createExpenseReport,
  submitExpenseReport,
  approveExpenseReport,
  createInvoice,
  sendInvoice,
  recordInvoicePayment,
  createErpIntegration,
} from "./finance/repository";
import { financeInvoices } from "@shared/schema";

const TENANT_ID = Number(process.env.SEED_TENANT_ID ?? 1);
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";

function getMonday(d = new Date()): string {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  return x.toISOString().slice(0, 10);
}

function weeksAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return getMonday(d);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function ensureProjects(userId: string | null, clientId: number | null) {
  const existing = await db.select().from(pmProjects).where(eq(pmProjects.tenantId, TENANT_ID)).limit(5);
  if (existing.length >= 2) return existing.slice(0, 3);

  const names = [
    { name: "ERP Modernisation", code: "FIN-ERP-01", contractType: "fixed_price" },
    { name: "Cloud Migration Phase 2", code: "FIN-CLOUD-02", contractType: "time_materials" },
    { name: "Digital Transformation", code: "FIN-DX-03", contractType: "mixed" },
  ];

  const created = [...existing];
  for (const p of names) {
    if (created.find((c) => c.name === p.name)) continue;
    const [row] = await db.insert(pmProjects).values({
      tenantId: TENANT_ID,
      name: p.name,
      code: p.code,
      status: "active",
      clientId,
      managerId: userId,
      ownerId: userId,
      startDate: daysAgo(90),
      endDate: daysFromNow(180),
      budget: "250000",
    }).returning();
    created.push(row);
  }
  return created.slice(0, 3);
}

async function ensureResources(userId: string) {
  const existing = await db.select().from(resources).where(eq(resources.tenantId, TENANT_ID)).limit(5);
  if (existing.length >= 2) return existing.slice(0, 3);

  const people = [
    { firstName: "Alex", lastName: "Morgan", jobTitle: "Senior Consultant", email: "alex.morgan@demo.local" },
    { firstName: "Sam", lastName: "Patel", jobTitle: "Project Manager", email: "sam.patel@demo.local" },
    { firstName: "Jordan", lastName: "Lee", jobTitle: "Business Analyst", email: "jordan.lee@demo.local" },
  ];

  const created = [...existing];
  for (const p of people) {
    if (created.find((c) => c.email === p.email)) continue;
    const [row] = await db.insert(resources).values({
      tenantId: TENANT_ID,
      userId: created.length === 0 ? userId : null,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      jobTitle: p.jobTitle,
      department: "Delivery",
      costRate: "450",
      billRate: "850",
      status: "available",
    }).returning();
    created.push(row);
  }
  return created.slice(0, 3);
}

async function main() {
  console.log(`Seeding Finance demo data for tenant ${TENANT_ID}...`);

  const [existingBudget] = await db
    .select({ id: projectBudgets.id })
    .from(projectBudgets)
    .where(eq(projectBudgets.tenantId, TENANT_ID))
    .limit(1);

  if (existingBudget && !FORCE) {
    console.log("Finance data already exists. Set FORCE=1 to seed again.");
    process.exit(0);
  }

  const userRows = await db.select().from(users).limit(3);
  if (!userRows.length) {
    console.error("No users found. Log in once or run db:seed-crm first.");
    process.exit(1);
  }
  const userId = userRows[0].id;

  const accountRows = await db.select().from(crmAccounts).where(eq(crmAccounts.tenantId, TENANT_ID)).limit(1);
  const clientId = accountRows[0]?.id ?? null;

  const projects = await ensureProjects(userId, clientId);
  const resourceList = await ensureResources(userId);
  const [p1, p2, p3] = projects;

  console.log(`  Projects: ${projects.map((p) => p.name).join(", ")}`);
  console.log(`  Resources: ${resourceList.map((r) => `${r.firstName} ${r.lastName}`).join(", ")}`);

  await updateFinanceSettings(TENANT_ID, {
    baseCurrency: "GBP",
    timesheetApprovalMode: "both",
    invoicePrefix: "INV",
    defaultPaymentTerms: "net_30",
    orgAddress: "42 Finance Street\nLondon EC2A 4NE\nUnited Kingdom",
    orgBankDetails: "Sort code: 12-34-56 | Account: 12345678 | Barclays",
    mileageRateCar: "0.45",
  });

  await createExchangeRate(TENANT_ID, {
    fromCurrency: "USD",
    toCurrency: "GBP",
    rate: "0.79",
    rateDate: daysAgo(1),
    source: "manual",
  });
  await createExchangeRate(TENANT_ID, {
    fromCurrency: "EUR",
    toCurrency: "GBP",
    rate: "0.86",
    rateDate: daysAgo(1),
    source: "manual",
  });

  const rateCard = await createRateCard(TENANT_ID, {
    name: "Standard 2026 Rates",
    cardType: "standard",
    currency: "GBP",
    isDefault: true,
    items: [
      { roleName: "Senior Consultant", dailyRate: "850", costRate: "450", hourlyChargeRate: "106.25", hourlyCostRate: "56.25" },
      { roleName: "Project Manager", dailyRate: "950", costRate: "500", hourlyChargeRate: "118.75", hourlyCostRate: "62.50" },
      { roleName: "Business Analyst", dailyRate: "700", costRate: "380", hourlyChargeRate: "87.50", hourlyCostRate: "47.50" },
      { roleName: "Developer", dailyRate: "750", costRate: "400", hourlyChargeRate: "93.75", hourlyCostRate: "50.00" },
    ],
  });

  const budget1 = await createProjectBudget(TENANT_ID, {
    projectId: p1.id,
    clientId,
    contractType: "fixed_price",
    contractValue: "180000",
    labourBudget: "120000",
    expenseBudget: "15000",
    targetMarginPct: "25",
    rateCardId: rateCard.id,
    labourLines: [
      { roleName: "Senior Consultant", phase: "Discovery", budgetedDays: "20", budgetedCost: "34000", actualDays: "18", actualCost: "8100" },
      { roleName: "Project Manager", phase: "Delivery", budgetedDays: "40", budgetedCost: "38000", actualDays: "12", actualCost: "6000" },
    ],
    expenseLines: [
      { category: "Travel", budgetedAmount: "5000", actualAmount: "1240" },
      { category: "Software", budgetedAmount: "3000", actualAmount: "890" },
    ],
    milestoneLines: [
      { name: "Phase 1 — Discovery", value: "45000", dueDate: daysAgo(30), status: "complete" },
      { name: "Phase 2 — Build", value: "90000", dueDate: daysFromNow(45), status: "in_progress" },
      { name: "Phase 3 — Go-live", value: "45000", dueDate: daysFromNow(120), status: "pending" },
    ],
  });

  await updateProjectBudget(TENANT_ID, budget1.id, {
    actualCost: "98500",
    billedToDate: "45000",
  });

  const budget2 = await createProjectBudget(TENANT_ID, {
    projectId: p2.id,
    clientId,
    contractType: "time_materials",
    contractValue: "95000",
    labourBudget: "80000",
    expenseBudget: "8000",
    targetMarginPct: "18",
    rateCardId: rateCard.id,
    labourLines: [
      { roleName: "Developer", phase: "Migration", budgetedDays: "60", budgetedCost: "45000", actualDays: "35", actualCost: "17500" },
    ],
    expenseLines: [
      { category: "Cloud hosting", budgetedAmount: "4000", actualAmount: "2100" },
    ],
  });

  await updateProjectBudget(TENANT_ID, budget2.id, {
    actualCost: "72000",
    billedToDate: "28000",
  });

  await createProjectBudget(TENANT_ID, {
    projectId: p3.id,
    clientId,
    contractType: "mixed",
    contractValue: "220000",
    labourBudget: "150000",
    expenseBudget: "20000",
    targetMarginPct: "22",
    rateCardId: rateCard.id,
  });

  // Timesheets — current week draft, last week submitted, two weeks ago approved
  const r1 = resourceList[0];
  const r2 = resourceList[1] ?? resourceList[0];

  const draftPeriod = await createTimesheetPeriod(TENANT_ID, {
    resourceId: r1.id,
    weekStartDate: getMonday(),
  });
  for (const day of [1, 2, 3, 4, 5]) {
    await upsertTimesheetEntry(TENANT_ID, draftPeriod.id, {
      resourceId: r1.id,
      projectId: p1.id,
      projectName: p1.name,
      dayOfWeek: day,
      hours: day === 5 ? "6" : "8",
      activityType: "billable",
      role: "Senior Consultant",
    });
  }

  const submittedPeriod = await createTimesheetPeriod(TENANT_ID, {
    resourceId: r2.id,
    weekStartDate: weeksAgo(1),
  });
  for (const day of [1, 2, 3, 4, 5]) {
    await upsertTimesheetEntry(TENANT_ID, submittedPeriod.id, {
      resourceId: r2.id,
      projectId: p2.id,
      projectName: p2.name,
      dayOfWeek: day,
      hours: "7.5",
      activityType: "billable",
      role: "Project Manager",
    });
  }
  await submitTimesheetPeriod(TENANT_ID, submittedPeriod.id);

  const approvedPeriod = await createTimesheetPeriod(TENANT_ID, {
    resourceId: r1.id,
    weekStartDate: weeksAgo(2),
  });
  for (const day of [1, 2, 3, 4, 5]) {
    await upsertTimesheetEntry(TENANT_ID, approvedPeriod.id, {
      resourceId: r1.id,
      projectId: p1.id,
      projectName: p1.name,
      dayOfWeek: day,
      hours: "8",
      activityType: "billable",
      role: "Senior Consultant",
    });
  }
  await submitTimesheetPeriod(TENANT_ID, approvedPeriod.id);
  await approveTimesheetPm(TENANT_ID, approvedPeriod.id, userId);
  await approveTimesheetRm(TENANT_ID, approvedPeriod.id, userId);

  // Expenses
  const expDraft = await createExpenseReport(TENANT_ID, {
    userId,
    projectId: p1.id,
    name: "Client site visit — Manchester",
    items: [{
      itemDate: daysAgo(3),
      category: "Travel",
      description: "Train return + taxi",
      amount: "186.50",
      isBillable: true,
      vatAmount: "37.30",
      paymentMethod: "personal_card",
    }],
  });

  const expSubmitted = await createExpenseReport(TENANT_ID, {
    userId,
    projectId: p2.id,
    name: "AWS re:Invent conference",
    items: [{
      itemDate: daysAgo(10),
      category: "Training",
      description: "Conference ticket",
      amount: "1299.00",
      isBillable: false,
      paymentMethod: "company_card",
    }, {
      itemDate: daysAgo(9),
      category: "Travel",
      description: "Hotel 2 nights",
      amount: "420.00",
      isBillable: true,
      paymentMethod: "personal_card",
    }],
  });
  await submitExpenseReport(TENANT_ID, expSubmitted.id);

  const expApproved = await createExpenseReport(TENANT_ID, {
    userId,
    projectId: p1.id,
    name: "Software licences Q1",
    items: [{
      itemDate: daysAgo(20),
      category: "Software",
      description: "Figma team seats (3 months)",
      amount: "540.00",
      isBillable: true,
      vatAmount: "108.00",
      paymentMethod: "company_card",
    }],
  });
  await submitExpenseReport(TENANT_ID, expApproved.id);
  await approveExpenseReport(TENANT_ID, expApproved.id, userId);

  await recalculateBudgetActuals(TENANT_ID, p1.id);
  await recalculateBudgetActuals(TENANT_ID, p2.id);

  // Invoices
  const invDraft = await createInvoice(TENANT_ID, {
    projectId: p1.id,
    clientId,
    contractType: "fixed_price",
    issueDate: daysAgo(2),
    notes: "Draft invoice for Phase 2 milestone",
    createdBy: userId,
    manualLines: [{
      description: "Phase 2 — Build (50% milestone)",
      quantity: 1,
      unitRate: 45000,
      amount: 45000,
      lineType: "fixed_fee",
    }],
  });

  const invSent = await createInvoice(TENANT_ID, {
    projectId: p2.id,
    clientId,
    contractType: "time_materials",
    issueDate: daysAgo(15),
    createdBy: userId,
    manualLines: [{
      description: "January T&M — Cloud Migration",
      quantity: 120,
      unitRate: 93.75,
      amount: 11250,
      lineType: "timesheet",
    }],
  });
  await sendInvoice(TENANT_ID, invSent.id);

  const invOverdue = await createInvoice(TENANT_ID, {
    projectId: p1.id,
    clientId,
    contractType: "fixed_price",
    issueDate: daysAgo(75),
    createdBy: userId,
    manualLines: [{
      description: "Phase 1 — Discovery (complete)",
      quantity: 1,
      unitRate: 45000,
      amount: 45000,
      lineType: "fixed_fee",
    }],
  });
  await sendInvoice(TENANT_ID, invOverdue.id);
  await db.update(financeInvoices)
    .set({ dueDate: daysAgo(45), status: "overdue", updatedAt: new Date() })
    .where(eq(financeInvoices.id, invOverdue.id));

  const invPaid = await createInvoice(TENANT_ID, {
    projectId: p3.id,
    clientId,
    contractType: "mixed",
    issueDate: daysAgo(45),
    createdBy: userId,
    manualLines: [{
      description: "Discovery & design sprint",
      quantity: 1,
      unitRate: 32000,
      amount: 32000,
      lineType: "fixed_fee",
    }],
  });
  await sendInvoice(TENANT_ID, invPaid.id);
  await recordInvoicePayment(TENANT_ID, invPaid.id, {
    paymentDate: daysAgo(30),
    amount: 32000,
    paymentMethod: "bank_transfer",
    reference: "BACS-REF-88421",
    createdBy: userId,
  });

  // ERP integration + sync log sample
  const erp = await createErpIntegration(TENANT_ID, {
    system: "xero",
    isActive: true,
    autoSync: false,
    fieldMappingJson: {
      invoiceNumber: "InvoiceNumber",
      total: "Total",
      clientName: "ContactName",
    },
  });

  await db.insert(erpSyncLog).values({
    tenantId: TENANT_ID,
    integrationId: erp.id,
    entityType: "invoice",
    entityId: invSent.id,
    direction: "outbound",
    status: "success",
  });

  console.log("\nFinance demo seed complete:");
  console.log(`  • ${projects.length} projects with budgets`);
  console.log(`  • Rate card "${rateCard.name}" with ${rateCard.items?.length ?? 4} roles`);
  console.log(`  • 3 timesheet periods (draft, submitted, approved)`);
  console.log(`  • 3 expense reports (draft, submitted, approved)`);
  console.log(`  • 4 invoices (draft, sent, overdue, paid)`);
  console.log(`  • ERP integration (Xero) + sync log`);
  console.log(`  • Skipped re-seed: expense draft "${expDraft.name}" id=${expDraft.id}`);
  console.log("\nOpen /modules/finance-mgmt to view the data.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Finance seed failed:", err);
  process.exit(1);
});
