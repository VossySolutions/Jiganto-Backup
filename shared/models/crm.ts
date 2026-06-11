import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";
import { tenants } from "../schema";
import { users } from "./auth";
import {
  rateCards,
  rateCardItems,
  rateCardRelations,
  rateCardItemRelations,
  insertRateCardSchema,
  insertRateCardItemSchema,
} from "./resources";

export {
  rateCards,
  rateCardItems,
  rateCardRelations,
  rateCardItemRelations,
  insertRateCardSchema,
  insertRateCardItemSchema,
};

export const crmAccounts = pgTable("crm_accounts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  parentAccountId: integer("parent_account_id"),
  name: text("name").notNull(),
  type: text("type").notNull().default("prospect"),
  industry: text("industry"),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  postalCode: text("postal_code"),
  ownerUserId: varchar("owner_user_id"),
  description: text("description"),
  annualRevenue: decimal("annual_revenue", { precision: 15, scale: 2 }),
  employeeCount: integer("employee_count"),
  clientId: integer("client_id"),
  customData: jsonb("custom_data").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmAccountsRelations = relations(crmAccounts, ({ one, many }) => ({
  parent: one(crmAccounts, {
    fields: [crmAccounts.parentAccountId],
    references: [crmAccounts.id],
    relationName: "accountHierarchy",
  }),
  children: many(crmAccounts, { relationName: "accountHierarchy" }),
  contacts: many(crmContacts),
  opportunities: many(crmOpportunities),
  owner: one(users, {
    fields: [crmAccounts.ownerUserId],
    references: [users.id],
  }),
}));

export const crmContacts = pgTable("crm_contacts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  accountId: integer("account_id").references(() => crmAccounts.id, { onDelete: "set null" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  title: text("title"),
  department: text("department"),
  role: text("role").default("contact"),
  isPrimary: boolean("is_primary").default(false),
  linkedInUrl: text("linkedin_url"),
  notes: text("notes"),
  ownerUserId: varchar("owner_user_id"),
  customData: jsonb("custom_data").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmContactsRelations = relations(crmContacts, ({ one }) => ({
  account: one(crmAccounts, {
    fields: [crmContacts.accountId],
    references: [crmAccounts.id],
  }),
  owner: one(users, {
    fields: [crmContacts.ownerUserId],
    references: [users.id],
  }),
}));

export const crmContactRelationships = pgTable("crm_contact_relationships", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  contactId: integer("contact_id").notNull().references(() => crmContacts.id, { onDelete: "cascade" }),
  relatedContactId: integer("related_contact_id").notNull().references(() => crmContacts.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull(),
  reverseRelationshipType: text("reverse_relationship_type"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmContactRelationshipsRelations = relations(crmContactRelationships, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmContactRelationships.contactId],
    references: [crmContacts.id],
    relationName: "contactRelationships",
  }),
  relatedContact: one(crmContacts, {
    fields: [crmContactRelationships.relatedContactId],
    references: [crmContacts.id],
    relationName: "relatedContactRelationships",
  }),
}));

export const crmLeads = pgTable("crm_leads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  title: text("title"),
  source: text("source"),
  status: text("status").notNull().default("new"),
  score: integer("score").default(0),
  rating: text("rating"),
  industry: text("industry"),
  website: text("website"),
  description: text("description"),
  ownerUserId: varchar("owner_user_id"),
  convertedAccountId: integer("converted_account_id").references(() => crmAccounts.id),
  convertedContactId: integer("converted_contact_id").references(() => crmContacts.id),
  convertedOpportunityId: integer("converted_opportunity_id"),
  convertedAt: timestamp("converted_at"),
  customData: jsonb("custom_data").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmLeadsRelations = relations(crmLeads, ({ one }) => ({
  owner: one(users, {
    fields: [crmLeads.ownerUserId],
    references: [users.id],
  }),
  convertedAccount: one(crmAccounts, {
    fields: [crmLeads.convertedAccountId],
    references: [crmAccounts.id],
  }),
  convertedContact: one(crmContacts, {
    fields: [crmLeads.convertedContactId],
    references: [crmContacts.id],
  }),
}));

// CRM Pipelines for multiple pipeline support
export const crmPipelines = pgTable("crm_pipelines", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  isArchived: boolean("is_archived").default(false),
  color: text("color").default("#6366f1"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmPipelinesRelations = relations(crmPipelines, ({ many }) => ({
  stages: many(crmOpportunityStages),
}));

export const crmOpportunityStages = pgTable("crm_opportunity_stages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  pipelineId: integer("pipeline_id").references(() => crmPipelines.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
  probability: integer("probability").default(0),
  isClosed: boolean("is_closed").default(false),
  isWon: boolean("is_won").default(false),
  color: text("color").default("#6366f1"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmOpportunityStagesRelations = relations(crmOpportunityStages, ({ one }) => ({
  pipeline: one(crmPipelines, {
    fields: [crmOpportunityStages.pipelineId],
    references: [crmPipelines.id],
  }),
}));

export const crmOpportunities = pgTable("crm_opportunities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  accountId: integer("account_id").references(() => crmAccounts.id, { onDelete: "set null" }),
  contactId: integer("contact_id").references(() => crmContacts.id, { onDelete: "set null" }),
  stageId: integer("stage_id").references(() => crmOpportunityStages.id),
  name: text("name").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  recurringAmount: decimal("recurring_amount", { precision: 15, scale: 2 }),
  recurringFrequency: text("recurring_frequency"),
  probability: integer("probability").default(0),
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  type: text("type"),
  source: text("source"),
  nextStep: text("next_step"),
  winReason: text("win_reason"),
  lossReason: text("loss_reason"),
  competitorId: integer("competitor_id"),
  ownerUserId: varchar("owner_user_id"),
  projectId: integer("project_id"),
  revenue: decimal("revenue", { precision: 15, scale: 2 }),
  grossProfit: decimal("gross_profit", { precision: 15, scale: 2 }),
  isArchived: boolean("is_archived").default(false),
  customData: jsonb("custom_data").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmOpportunitiesRelations = relations(crmOpportunities, ({ one, many }) => ({
  account: one(crmAccounts, {
    fields: [crmOpportunities.accountId],
    references: [crmAccounts.id],
  }),
  contact: one(crmContacts, {
    fields: [crmOpportunities.contactId],
    references: [crmContacts.id],
  }),
  stage: one(crmOpportunityStages, {
    fields: [crmOpportunities.stageId],
    references: [crmOpportunityStages.id],
  }),
  owner: one(users, {
    fields: [crmOpportunities.ownerUserId],
    references: [users.id],
  }),
  resourceRequirements: many(crmResourceRequirements),
}));

export const crmResourceRequirements = pgTable("crm_resource_requirements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  opportunityId: integer("opportunity_id").notNull().references(() => crmOpportunities.id, { onDelete: "cascade" }),
  skillName: text("skill_name").notNull(),
  skillLevel: text("skill_level"),
  namedResourceUserId: varchar("named_resource_user_id"),
  estimatedHours: decimal("estimated_hours", { precision: 10, scale: 2 }),
  estimatedDuration: text("estimated_duration"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmResourceRequirementsRelations = relations(crmResourceRequirements, ({ one }) => ({
  opportunity: one(crmOpportunities, {
    fields: [crmResourceRequirements.opportunityId],
    references: [crmOpportunities.id],
  }),
  namedResource: one(users, {
    fields: [crmResourceRequirements.namedResourceUserId],
    references: [users.id],
  }),
}));

export const crmActivities = pgTable("crm_activities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  type: text("type").notNull(),
  subject: text("subject").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  duration: integer("duration"),
  location: text("location"),
  outcome: text("outcome"),
  reminderDate: timestamp("reminder_date"),
  reminderSent: boolean("reminder_sent").default(false),
  completedAt: timestamp("completed_at"),
  status: text("status").default("pending"),
  priority: text("priority").default("normal"),
  accountId: integer("account_id").references(() => crmAccounts.id, { onDelete: "set null" }),
  contactId: integer("contact_id").references(() => crmContacts.id, { onDelete: "set null" }),
  opportunityId: integer("opportunity_id").references(() => crmOpportunities.id, { onDelete: "set null" }),
  leadId: integer("lead_id").references(() => crmLeads.id, { onDelete: "set null" }),
  projectId: integer("project_id"),
  ownerUserId: varchar("owner_user_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmActivitiesRelations = relations(crmActivities, ({ one }) => ({
  account: one(crmAccounts, {
    fields: [crmActivities.accountId],
    references: [crmAccounts.id],
  }),
  contact: one(crmContacts, {
    fields: [crmActivities.contactId],
    references: [crmContacts.id],
  }),
  opportunity: one(crmOpportunities, {
    fields: [crmActivities.opportunityId],
    references: [crmOpportunities.id],
  }),
  lead: one(crmLeads, {
    fields: [crmActivities.leadId],
    references: [crmLeads.id],
  }),
  owner: one(users, {
    fields: [crmActivities.ownerUserId],
    references: [users.id],
  }),
}));

export const crmTasks = pgTable("crm_tasks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  subject: text("subject").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  reminderDate: timestamp("reminder_date"),
  completedAt: timestamp("completed_at"),
  status: text("status").default("pending"),
  priority: text("priority").default("normal"),
  accountId: integer("account_id").references(() => crmAccounts.id, { onDelete: "set null" }),
  contactId: integer("contact_id").references(() => crmContacts.id, { onDelete: "set null" }),
  opportunityId: integer("opportunity_id").references(() => crmOpportunities.id, { onDelete: "set null" }),
  leadId: integer("lead_id").references(() => crmLeads.id, { onDelete: "set null" }),
  projectId: integer("project_id"),
  ownerUserId: varchar("owner_user_id"),
  assignedToUserId: varchar("assigned_to_user_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmTasksRelations = relations(crmTasks, ({ one }) => ({
  account: one(crmAccounts, {
    fields: [crmTasks.accountId],
    references: [crmAccounts.id],
  }),
  contact: one(crmContacts, {
    fields: [crmTasks.contactId],
    references: [crmContacts.id],
  }),
  opportunity: one(crmOpportunities, {
    fields: [crmTasks.opportunityId],
    references: [crmOpportunities.id],
  }),
  lead: one(crmLeads, {
    fields: [crmTasks.leadId],
    references: [crmLeads.id],
  }),
  owner: one(users, {
    fields: [crmTasks.ownerUserId],
    references: [users.id],
  }),
  assignedTo: one(users, {
    fields: [crmTasks.assignedToUserId],
    references: [users.id],
  }),
}));

export const crmNotes = pgTable("crm_notes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  content: text("content").notNull(),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmNotesRelations = relations(crmNotes, ({ one }) => ({
  createdBy: one(users, {
    fields: [crmNotes.createdByUserId],
    references: [users.id],
  }),
}));

export const crmContracts = pgTable("crm_contracts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  accountId: integer("account_id").references(() => crmAccounts.id, { onDelete: "set null" }),
  opportunityId: integer("opportunity_id").references(() => crmOpportunities.id, { onDelete: "set null" }),
  projectId: integer("project_id"),
  name: text("name").notNull(),
  type: text("type"),
  status: text("status").default("draft"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  value: decimal("value", { precision: 15, scale: 2 }),
  recurringValue: decimal("recurring_value", { precision: 15, scale: 2 }),
  terms: text("terms"),
  signedDate: timestamp("signed_date"),
  signedByContactId: integer("signed_by_contact_id").references(() => crmContacts.id),
  ownerUserId: varchar("owner_user_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmContractsRelations = relations(crmContracts, ({ one }) => ({
  account: one(crmAccounts, {
    fields: [crmContracts.accountId],
    references: [crmAccounts.id],
  }),
  opportunity: one(crmOpportunities, {
    fields: [crmContracts.opportunityId],
    references: [crmOpportunities.id],
  }),
  signedBy: one(crmContacts, {
    fields: [crmContracts.signedByContactId],
    references: [crmContacts.id],
  }),
  owner: one(users, {
    fields: [crmContracts.ownerUserId],
    references: [users.id],
  }),
}));

export const crmCustomerSystems = pgTable("crm_customer_systems", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  accountId: integer("account_id").notNull().references(() => crmAccounts.id, { onDelete: "cascade" }),
  contractId: integer("contract_id").references(() => crmContracts.id, { onDelete: "set null" }),
  projectId: integer("project_id"),
  name: text("name").notNull(),
  type: text("type").notNull(),
  vendor: text("vendor"),
  version: text("version"),
  environment: text("environment"),
  status: text("status").default("active"),
  implementedDate: timestamp("implemented_date"),
  lastUpdated: timestamp("last_updated"),
  supportLevel: text("support_level"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmCustomerSystemsRelations = relations(crmCustomerSystems, ({ one }) => ({
  account: one(crmAccounts, {
    fields: [crmCustomerSystems.accountId],
    references: [crmAccounts.id],
  }),
  contract: one(crmContracts, {
    fields: [crmCustomerSystems.contractId],
    references: [crmContracts.id],
  }),
}));

export const crmAttachments = pgTable("crm_attachments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileUrl: text("file_url"),
  uploadedByUserId: varchar("uploaded_by_user_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmAttachmentsRelations = relations(crmAttachments, ({ one }) => ({
  uploadedBy: one(users, {
    fields: [crmAttachments.uploadedByUserId],
    references: [users.id],
  }),
}));

// Saved Views for CRM filters
export const crmSavedViews = pgTable("crm_saved_views", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  userId: varchar("user_id"),
  name: text("name").notNull(),
  entityType: text("entity_type").notNull(), // accounts, contacts, leads, opportunities, activities
  filters: jsonb("filters").notNull(), // JSON array of filter conditions
  columns: jsonb("columns"), // Optional: which columns to show
  sortBy: text("sort_by"),
  sortOrder: text("sort_order").default("asc"),
  isDefault: boolean("is_default").default(false),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmSavedViewsRelations = relations(crmSavedViews, ({ one }) => ({
  user: one(users, {
    fields: [crmSavedViews.userId],
    references: [users.id],
  }),
}));

// Email Templates for CRM
export const crmEmailTemplates = pgTable("crm_email_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  category: text("category"), // follow-up, introduction, proposal, etc.
  variables: jsonb("variables"), // Available merge fields
  isActive: boolean("is_active").default(true),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmEmailTemplatesRelations = relations(crmEmailTemplates, ({ one }) => ({
  createdBy: one(users, {
    fields: [crmEmailTemplates.createdByUserId],
    references: [users.id],
  }),
}));

// Email Logs for tracking sent emails
export const crmEmailLogs = pgTable("crm_email_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  templateId: integer("template_id").references(() => crmEmailTemplates.id),
  entityType: text("entity_type"), // contact, lead, account
  entityId: integer("entity_id"),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").default("sent"), // sent, opened, clicked, bounced
  sentByUserId: varchar("sent_by_user_id"),
  sentAt: timestamp("sent_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
});

export const crmEmailLogsRelations = relations(crmEmailLogs, ({ one }) => ({
  template: one(crmEmailTemplates, {
    fields: [crmEmailLogs.templateId],
    references: [crmEmailTemplates.id],
  }),
  sentBy: one(users, {
    fields: [crmEmailLogs.sentByUserId],
    references: [users.id],
  }),
}));

// Sales Forecasts
export const crmForecasts = pgTable("crm_forecasts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  userId: varchar("user_id"),
  forecastPeriod: text("forecast_period").notNull(), // monthly, quarterly
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  quotaAmount: decimal("quota_amount", { precision: 15, scale: 2 }),
  forecastAmount: decimal("forecast_amount", { precision: 15, scale: 2 }),
  closedAmount: decimal("closed_amount", { precision: 15, scale: 2 }).default("0"),
  pipelineAmount: decimal("pipeline_amount", { precision: 15, scale: 2 }).default("0"),
  weightedAmount: decimal("weighted_amount", { precision: 15, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmForecastsRelations = relations(crmForecasts, ({ one }) => ({
  user: one(users, {
    fields: [crmForecasts.userId],
    references: [users.id],
  }),
}));

// Territories for account assignment
export const crmTerritories = pgTable("crm_territories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  parentId: integer("parent_id"),
  managerUserId: varchar("manager_user_id"),
  criteria: jsonb("criteria"), // Rules for auto-assignment (e.g., by region, industry)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmTerritoriesRelations = relations(crmTerritories, ({ one, many }) => ({
  parent: one(crmTerritories, {
    fields: [crmTerritories.parentId],
    references: [crmTerritories.id],
    relationName: "territoryHierarchy",
  }),
  children: many(crmTerritories, { relationName: "territoryHierarchy" }),
  manager: one(users, {
    fields: [crmTerritories.managerUserId],
    references: [users.id],
  }),
}));

// User-defined custom fields per CRM entity
export const crmCustomFields = pgTable("crm_custom_fields", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  entityType: text("entity_type").notNull(),
  fieldName: text("field_name").notNull(),
  fieldLabel: text("field_label").notNull(),
  fieldType: text("field_type").notNull(),
  options: jsonb("options"),
  position: integer("position").default(0),
  isRequired: boolean("is_required").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Workflow Automation Rules
export const crmAutomationRules = pgTable("crm_automation_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  entityType: text("entity_type").notNull(), // lead, contact, opportunity, account
  triggerType: text("trigger_type").notNull(), // on_create, on_update, on_field_change, scheduled
  triggerConditions: jsonb("trigger_conditions"), // When to trigger
  actions: jsonb("actions").notNull(), // What actions to take
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmAutomationRulesRelations = relations(crmAutomationRules, ({ one }) => ({
  createdBy: one(users, {
    fields: [crmAutomationRules.createdByUserId],
    references: [users.id],
  }),
}));

// ═══ RESOURCE PLAN TEMPLATES ═══
export const resourcePlanTemplates = pgTable("resource_plan_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  phases: jsonb("phases").default(sql`'["Discovery","Design","Build","UAT","Go Live","Hypercare"]'::jsonb`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const resourcePlanTemplateRows = pgTable("resource_plan_template_rows", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => resourcePlanTemplates.id, { onDelete: "cascade" }),
  phase: text("phase").notNull(),
  roleName: text("role_name").notNull(),
  daysPerWeek: decimal("days_per_week", { precision: 3, scale: 1 }).default("5"),
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }),
  defaultDurationWeeks: integer("default_duration_weeks").default(12),
  sortOrder: integer("sort_order").default(0),
});

export const resourcePlanTemplateRelations = relations(resourcePlanTemplates, ({ many }) => ({
  rows: many(resourcePlanTemplateRows),
}));

export const resourcePlanTemplateRowRelations = relations(resourcePlanTemplateRows, ({ one }) => ({
  template: one(resourcePlanTemplates, { fields: [resourcePlanTemplateRows.templateId], references: [resourcePlanTemplates.id] }),
}));

// ═══ OPPORTUNITY RESOURCE PLANS ═══
export const opportunityResourcePlans = pgTable("opportunity_resource_plans", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  opportunityId: integer("opportunity_id").notNull().references(() => crmOpportunities.id, { onDelete: "cascade" }),
  planName: text("plan_name"),
  templateName: text("template_name"),
  rateCardId: integer("rate_card_id").references(() => rateCards.id, { onDelete: "set null" }),
  currency: text("currency").default("GBP"),
  notes: text("notes"),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const opportunityResourceRows = pgTable("opportunity_resource_rows", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => opportunityResourcePlans.id, { onDelete: "cascade" }),
  phase: text("phase").notNull(),
  roleName: text("role_name").notNull(),
  resourceId: integer("resource_id"),
  namedResourceLabel: text("named_resource_label"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  daysPerWeek: decimal("days_per_week", { precision: 3, scale: 1 }).default("5"),
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).default("0"),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
  status: text("status").default("Open"),
  sortOrder: integer("sort_order").default(0),
  breaks: jsonb("breaks").default(sql`'[]'::jsonb`),
  weekOverrides: jsonb("week_overrides").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const opportunityResourcePlanRelations = relations(opportunityResourcePlans, ({ one, many }) => ({
  opportunity: one(crmOpportunities, { fields: [opportunityResourcePlans.opportunityId], references: [crmOpportunities.id] }),
  rateCard: one(rateCards, { fields: [opportunityResourcePlans.rateCardId], references: [rateCards.id] }),
  rows: many(opportunityResourceRows),
}));

export const opportunityResourceRowRelations = relations(opportunityResourceRows, ({ one }) => ({
  plan: one(opportunityResourcePlans, { fields: [opportunityResourceRows.planId], references: [opportunityResourcePlans.id] }),
}));

export const insertCrmAccountSchema = createInsertSchema(crmAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmContactSchema = createInsertSchema(crmContacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmContactRelationshipSchema = createInsertSchema(crmContactRelationships).omit({ id: true, createdAt: true });
export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({ id: true, createdAt: true, updatedAt: true, convertedAt: true });
export const insertCrmPipelineSchema = createInsertSchema(crmPipelines).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmOpportunityStageSchema = createInsertSchema(crmOpportunityStages).omit({ id: true, createdAt: true });
export const insertCrmOpportunitySchema = createInsertSchema(crmOpportunities).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmResourceRequirementSchema = createInsertSchema(crmResourceRequirements).omit({ id: true, createdAt: true });
export const insertCrmActivitySchema = createInsertSchema(crmActivities).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmTaskSchema = createInsertSchema(crmTasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmNoteSchema = createInsertSchema(crmNotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmContractSchema = createInsertSchema(crmContracts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmCustomerSystemSchema = createInsertSchema(crmCustomerSystems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmAttachmentSchema = createInsertSchema(crmAttachments).omit({ id: true, createdAt: true });
export const insertCrmSavedViewSchema = createInsertSchema(crmSavedViews).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmEmailTemplateSchema = createInsertSchema(crmEmailTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmEmailLogSchema = createInsertSchema(crmEmailLogs).omit({ id: true, sentAt: true });
export const insertCrmForecastSchema = createInsertSchema(crmForecasts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmTerritorySchema = createInsertSchema(crmTerritories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmAutomationRuleSchema = createInsertSchema(crmAutomationRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmCustomFieldSchema = createInsertSchema(crmCustomFields).omit({ id: true, createdAt: true });
export const insertResourcePlanTemplateSchema = createInsertSchema(resourcePlanTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertResourcePlanTemplateRowSchema = createInsertSchema(resourcePlanTemplateRows).omit({ id: true });
export const insertOpportunityResourcePlanSchema = createInsertSchema(opportunityResourcePlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOpportunityResourceRowSchema = createInsertSchema(opportunityResourceRows).omit({ id: true, createdAt: true });

export type CrmAccount = typeof crmAccounts.$inferSelect;
export type CrmContact = typeof crmContacts.$inferSelect;
export type CrmContactRelationship = typeof crmContactRelationships.$inferSelect;
export type CrmLead = typeof crmLeads.$inferSelect;
export type CrmPipeline = typeof crmPipelines.$inferSelect;
export type CrmOpportunityStage = typeof crmOpportunityStages.$inferSelect;
export type CrmOpportunity = typeof crmOpportunities.$inferSelect;
export type CrmResourceRequirement = typeof crmResourceRequirements.$inferSelect;
export type CrmActivity = typeof crmActivities.$inferSelect;
export type CrmTask = typeof crmTasks.$inferSelect;
export type CrmNote = typeof crmNotes.$inferSelect;
export type CrmContract = typeof crmContracts.$inferSelect;
export type CrmCustomerSystem = typeof crmCustomerSystems.$inferSelect;
export type CrmAttachment = typeof crmAttachments.$inferSelect;
export type CrmSavedView = typeof crmSavedViews.$inferSelect;
export type CrmEmailTemplate = typeof crmEmailTemplates.$inferSelect;
export type CrmEmailLog = typeof crmEmailLogs.$inferSelect;
export type CrmForecast = typeof crmForecasts.$inferSelect;
export type CrmTerritory = typeof crmTerritories.$inferSelect;
export type CrmAutomationRule = typeof crmAutomationRules.$inferSelect;
export type CrmCustomField = typeof crmCustomFields.$inferSelect;

export type InsertCrmAccount = z.infer<typeof insertCrmAccountSchema>;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;
export type InsertCrmContactRelationship = z.infer<typeof insertCrmContactRelationshipSchema>;
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;
export type InsertCrmPipeline = z.infer<typeof insertCrmPipelineSchema>;
export type InsertCrmOpportunityStage = z.infer<typeof insertCrmOpportunityStageSchema>;
export type InsertCrmOpportunity = z.infer<typeof insertCrmOpportunitySchema>;
export type InsertCrmResourceRequirement = z.infer<typeof insertCrmResourceRequirementSchema>;
export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;
export type InsertCrmTask = z.infer<typeof insertCrmTaskSchema>;
export type InsertCrmNote = z.infer<typeof insertCrmNoteSchema>;
export type InsertCrmContract = z.infer<typeof insertCrmContractSchema>;
export type InsertCrmCustomerSystem = z.infer<typeof insertCrmCustomerSystemSchema>;
export type InsertCrmAttachment = z.infer<typeof insertCrmAttachmentSchema>;
export type InsertCrmSavedView = z.infer<typeof insertCrmSavedViewSchema>;
export type InsertCrmEmailTemplate = z.infer<typeof insertCrmEmailTemplateSchema>;
export type InsertCrmEmailLog = z.infer<typeof insertCrmEmailLogSchema>;
export type InsertCrmForecast = z.infer<typeof insertCrmForecastSchema>;
export type InsertCrmTerritory = z.infer<typeof insertCrmTerritorySchema>;
export type InsertCrmAutomationRule = z.infer<typeof insertCrmAutomationRuleSchema>;
export type InsertCrmCustomField = z.infer<typeof insertCrmCustomFieldSchema>;
export type { RateCard, RateCardItem, InsertRateCard, InsertRateCardItem } from "./resources";
export type ResourcePlanTemplate = typeof resourcePlanTemplates.$inferSelect;
export type ResourcePlanTemplateRow = typeof resourcePlanTemplateRows.$inferSelect;
export type OpportunityResourcePlan = typeof opportunityResourcePlans.$inferSelect;
export type OpportunityResourceRow = typeof opportunityResourceRows.$inferSelect;
export type InsertResourcePlanTemplate = z.infer<typeof insertResourcePlanTemplateSchema>;
export type InsertResourcePlanTemplateRow = z.infer<typeof insertResourcePlanTemplateRowSchema>;
export type InsertOpportunityResourcePlan = z.infer<typeof insertOpportunityResourcePlanSchema>;
export type InsertOpportunityResourceRow = z.infer<typeof insertOpportunityResourceRowSchema>;
