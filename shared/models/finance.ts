import {
  pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, decimal, date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
import { users } from "./auth";
import { pmProjects } from "./projects";
import { crmAccounts } from "./crm";

/** Org-level finance settings (base currency, timesheet approval mode per ADR-004). */
export const financeSettings = pgTable("finance_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().unique(),
  baseCurrency: text("base_currency").notNull().default("GBP"),
  timesheetApprovalMode: text("timesheet_approval_mode").notNull().default("both"),
  invoicePrefix: text("invoice_prefix").default("INV"),
  defaultPaymentTerms: text("default_payment_terms").default("net_30"),
  orgAddress: text("org_address"),
  orgBankDetails: text("org_bank_details"),
  mileageRateCar: decimal("mileage_rate_car", { precision: 6, scale: 2 }).default("0.45"),
  mileageRateMotorcycle: decimal("mileage_rate_motorcycle", { precision: 6, scale: 2 }).default("0.24"),
  mileageRateBicycle: decimal("mileage_rate_bicycle", { precision: 6, scale: 2 }).default("0.20"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  rate: decimal("rate", { precision: 12, scale: 6 }).notNull(),
  rateDate: date("rate_date").notNull(),
  source: text("source").default("manual"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const projectBudgets = pgTable("project_budgets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  clientId: integer("client_id"),
  contractType: text("contract_type").notNull().default("fixed_price"),
  contractValue: decimal("contract_value", { precision: 15, scale: 2 }),
  budgetCurrency: text("budget_currency").notNull().default("GBP"),
  billingCurrency: text("billing_currency").notNull().default("GBP"),
  labourBudget: decimal("labour_budget", { precision: 15, scale: 2 }).default("0"),
  expenseBudget: decimal("expense_budget", { precision: 15, scale: 2 }).default("0"),
  totalBudget: decimal("total_budget", { precision: 15, scale: 2 }).default("0"),
  targetMarginPct: decimal("target_margin_pct", { precision: 5, scale: 2 }),
  rateCardId: integer("rate_card_id"),
  exchangeRate: decimal("exchange_rate", { precision: 12, scale: 6 }),
  billedToDate: decimal("billed_to_date", { precision: 15, scale: 2 }).default("0"),
  actualCost: decimal("actual_cost", { precision: 15, scale: 2 }).default("0"),
  forecastCost: decimal("forecast_cost", { precision: 15, scale: 2 }),
  evmEnabled: boolean("evm_enabled").default(false),
  deliverableProgressPct: decimal("deliverable_progress_pct", { precision: 5, scale: 2 }).default("0"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const budgetLabourLines = pgTable("budget_labour_lines", {
  id: serial("id").primaryKey(),
  budgetId: integer("budget_id").notNull().references(() => projectBudgets.id, { onDelete: "cascade" }),
  phase: text("phase"),
  roleName: text("role_name").notNull(),
  budgetedDays: decimal("budgeted_days", { precision: 8, scale: 1 }).default("0"),
  budgetedCost: decimal("budgeted_cost", { precision: 15, scale: 2 }).default("0"),
  actualDays: decimal("actual_days", { precision: 8, scale: 1 }).default("0"),
  actualCost: decimal("actual_cost", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const budgetExpenseLines = pgTable("budget_expense_lines", {
  id: serial("id").primaryKey(),
  budgetId: integer("budget_id").notNull().references(() => projectBudgets.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  budgetedAmount: decimal("budgeted_amount", { precision: 15, scale: 2 }).default("0"),
  actualAmount: decimal("actual_amount", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const budgetMilestoneLines = pgTable("budget_milestone_lines", {
  id: serial("id").primaryKey(),
  budgetId: integer("budget_id").notNull().references(() => projectBudgets.id, { onDelete: "cascade" }),
  milestoneId: integer("milestone_id"),
  name: text("name").notNull(),
  value: decimal("value", { precision: 15, scale: 2 }).notNull(),
  dueDate: date("due_date"),
  status: text("status").default("pending"),
  isInvoiced: boolean("is_invoiced").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const expenseReports = pgTable("expense_reports", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  currency: text("currency").notNull().default("GBP"),
  exchangeRate: decimal("exchange_rate", { precision: 12, scale: 6 }),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0"),
  submittedAt: timestamp("submitted_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  paidAt: timestamp("paid_at"),
  reimbursedAt: timestamp("reimbursed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const expenseItems = pgTable("expense_items", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull().references(() => expenseReports.id, { onDelete: "cascade" }),
  itemDate: date("item_date").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  receiptUrl: text("receipt_url"),
  isBillable: boolean("is_billable").default(true),
  vatAmount: decimal("vat_amount", { precision: 15, scale: 2 }),
  paymentMethod: text("payment_method").default("personal_card"),
  isInvoiced: boolean("is_invoiced").default(false),
  mileageDistance: decimal("mileage_distance", { precision: 8, scale: 1 }),
  mileageVehicleType: text("mileage_vehicle_type"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const financeInvoices = pgTable("finance_invoices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id").notNull().references(() => pmProjects.id),
  clientId: integer("client_id").references(() => crmAccounts.id),
  invoiceNumber: text("invoice_number").notNull(),
  contractType: text("contract_type").notNull().default("fixed_price"),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  paymentTerms: text("payment_terms").default("net_30"),
  currency: text("currency").notNull().default("GBP"),
  exchangeRate: decimal("exchange_rate", { precision: 12, scale: 6 }),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0"),
  total: decimal("total", { precision: 15, scale: 2 }).default("0"),
  status: text("status").notNull().default("draft"),
  sentAt: timestamp("sent_at"),
  paidDate: date("paid_date"),
  amountPaid: decimal("amount_paid", { precision: 15, scale: 2 }).default("0"),
  notes: text("notes"),
  poNumber: text("po_number"),
  erpReference: text("erp_reference"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const financeInvoiceLines = pgTable("finance_invoice_lines", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => financeInvoices.id, { onDelete: "cascade" }),
  lineType: text("line_type").notNull().default("fixed_fee"),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
  unitRate: decimal("unit_rate", { precision: 15, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  timesheetEntryIds: jsonb("timesheet_entry_ids"),
  expenseItemIds: jsonb("expense_item_ids"),
  milestoneId: integer("milestone_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const financeInvoicePayments = pgTable("finance_invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => financeInvoices.id, { onDelete: "cascade" }),
  paymentDate: date("payment_date").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("bank_transfer"),
  reference: text("reference"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const erpIntegrations = pgTable("erp_integrations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  system: text("system").notNull(),
  credentialsJson: jsonb("credentials_json"),
  fieldMappingJson: jsonb("field_mapping_json"),
  webhookUrl: text("webhook_url"),
  webhookAuthHeader: text("webhook_auth_header"),
  autoSync: boolean("auto_sync").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const erpSyncLog = pgTable("erp_sync_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  integrationId: integer("integration_id").references(() => erpIntegrations.id),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  direction: text("direction").notNull().default("outbound"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  syncedAt: timestamp("synced_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Relations
export const projectBudgetsRelations = relations(projectBudgets, ({ many }) => ({
  labourLines: many(budgetLabourLines),
  expenseLines: many(budgetExpenseLines),
  milestoneLines: many(budgetMilestoneLines),
}));

export const expenseReportsRelations = relations(expenseReports, ({ many }) => ({
  items: many(expenseItems),
}));

export const financeInvoicesRelations = relations(financeInvoices, ({ many }) => ({
  lines: many(financeInvoiceLines),
  payments: many(financeInvoicePayments),
}));

// Insert schemas
export const insertFinanceSettingsSchema = createInsertSchema(financeSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({ id: true, createdAt: true });
export const insertProjectBudgetSchema = createInsertSchema(projectBudgets).omit({ id: true, createdAt: true, updatedAt: true, totalBudget: true, actualCost: true, billedToDate: true });
export const insertBudgetLabourLineSchema = createInsertSchema(budgetLabourLines).omit({ id: true, createdAt: true });
export const insertBudgetExpenseLineSchema = createInsertSchema(budgetExpenseLines).omit({ id: true, createdAt: true });
export const insertBudgetMilestoneLineSchema = createInsertSchema(budgetMilestoneLines).omit({ id: true, createdAt: true });
export const insertExpenseReportSchema = createInsertSchema(expenseReports).omit({ id: true, createdAt: true, updatedAt: true, totalAmount: true });
export const insertExpenseItemSchema = createInsertSchema(expenseItems).omit({ id: true, createdAt: true });
export const insertFinanceInvoiceSchema = createInsertSchema(financeInvoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFinanceInvoiceLineSchema = createInsertSchema(financeInvoiceLines).omit({ id: true, createdAt: true });
export const insertFinanceInvoicePaymentSchema = createInsertSchema(financeInvoicePayments).omit({ id: true, createdAt: true });
export const insertErpIntegrationSchema = createInsertSchema(erpIntegrations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertErpSyncLogSchema = createInsertSchema(erpSyncLog).omit({ id: true, syncedAt: true });

export type FinanceSettings = typeof financeSettings.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type ProjectBudget = typeof projectBudgets.$inferSelect;
export type BudgetLabourLine = typeof budgetLabourLines.$inferSelect;
export type BudgetExpenseLine = typeof budgetExpenseLines.$inferSelect;
export type BudgetMilestoneLine = typeof budgetMilestoneLines.$inferSelect;
export type ExpenseReport = typeof expenseReports.$inferSelect;
export type ExpenseItem = typeof expenseItems.$inferSelect;
export type FinanceInvoice = typeof financeInvoices.$inferSelect;
export type FinanceInvoiceLine = typeof financeInvoiceLines.$inferSelect;
export type FinanceInvoicePayment = typeof financeInvoicePayments.$inferSelect;
export type ErpIntegration = typeof erpIntegrations.$inferSelect;
export type ErpSyncLog = typeof erpSyncLog.$inferSelect;

export const EXPENSE_CATEGORIES = [
  "Travel", "Accommodation", "Meals & Subsistence", "Software & Subscriptions",
  "Equipment", "Training & Certification", "Telecoms", "Other",
] as const;

export const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "overdue", "void", "credit_note"] as const;
export const CONTRACT_TYPES = ["fixed_price", "time_materials", "retainer", "mixed"] as const;
export const RATE_CARD_TYPES = ["standard", "client", "project"] as const;
