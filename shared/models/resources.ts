import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, decimal, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";
import { tenants } from "../schema";
import { users } from "./auth";

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  userId: varchar("user_id").references(() => users.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  photoUrl: text("photo_url"),
  jobTitle: text("job_title"),
  department: text("department"),
  location: text("location"),
  languages: text("languages"),
  grade: text("grade"),
  personType: text("person_type").default("employee"),
  employmentType: text("employment_type").default("full-time"),
  status: text("status").default("active"),
  fte: decimal("fte", { precision: 3, scale: 2 }).default("1.0"),
  reportsToId: integer("reports_to_id"),
  timeZone: text("time_zone"),
  costRate: decimal("cost_rate", { precision: 10, scale: 2 }),
  billRate: decimal("bill_rate", { precision: 10, scale: 2 }),
  currency: text("currency").default("GBP"),
  rateCardId: integer("rate_card_id"),
  costCentre: text("cost_centre"),
  payrollId: text("payroll_id"),
  workingDaysPerWeek: decimal("working_days_per_week", { precision: 3, scale: 1 }).default("5"),
  dailyHours: decimal("daily_hours", { precision: 4, scale: 1 }).default("8"),
  weeklyCapacityHours: decimal("weekly_capacity_hours", { precision: 5, scale: 1 }).default("40"),
  holidayEntitlement: integer("holiday_entitlement"),
  noticePeriodDays: integer("notice_period_days"),
  rightToWorkStatus: text("right_to_work_status").default("incomplete"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [resources.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [resources.userId],
    references: [users.id],
  }),
  skills: many(resourceSkills),
  allocations: many(resourceAllocations),
}));

export const skillCategories = pgTable("skill_categories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6366f1"),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const skillCategoriesRelations = relations(skillCategories, ({ many }) => ({
  skills: many(skills),
}));

export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  categoryId: integer("category_id").references(() => skillCategories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  isCertification: boolean("is_certification").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const skillsRelations = relations(skills, ({ one, many }) => ({
  category: one(skillCategories, {
    fields: [skills.categoryId],
    references: [skillCategories.id],
  }),
  resourceSkills: many(resourceSkills),
}));

export const resourceSkills = pgTable("resource_skills", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  skillId: integer("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  proficiencyLevel: text("proficiency_level").default("practitioner"),
  skillLevel: integer("skill_level").default(3),
  yearsExperience: decimal("years_experience", { precision: 4, scale: 1 }),
  lastUsed: timestamp("last_used"),
  certificationName: text("certification_name"),
  certificationExpiry: timestamp("certification_expiry"),
  certificateDocumentId: integer("certificate_document_id"),
  verifiedById: varchar("verified_by_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const resourceSkillsRelations = relations(resourceSkills, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceSkills.resourceId],
    references: [resources.id],
  }),
  skill: one(skills, {
    fields: [resourceSkills.skillId],
    references: [skills.id],
  }),
}));

export const resourceAllocations = pgTable("resource_allocations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  resourceId: integer("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  projectId: integer("project_id"),
  projectName: text("project_name"),
  opportunityRowId: integer("opportunity_row_id"),
  allocationType: text("allocation_type").default("confirmed"),
  allocationPercentage: decimal("allocation_percentage", { precision: 5, scale: 1 }).default("100"),
  daysPerWeek: decimal("days_per_week", { precision: 4, scale: 1 }),
  hoursPerWeek: decimal("hours_per_week", { precision: 5, scale: 1 }),
  role: text("role"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  notes: text("notes"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const resourceAllocationsRelations = relations(resourceAllocations, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceAllocations.resourceId],
    references: [resources.id],
  }),
}));

export const timesheetPeriods = pgTable("timesheet_periods", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  resourceId: integer("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  status: text("status").default("draft"),
  approvalStatus: text("approval_status").default("draft"),
  totalHours: decimal("total_hours", { precision: 6, scale: 1 }).default("0"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
  approvedByPmId: varchar("approved_by_pm_id").references(() => users.id),
  approvedByPmAt: timestamp("approved_by_pm_at"),
  approvedByRmId: varchar("approved_by_rm_id").references(() => users.id),
  approvedByRmAt: timestamp("approved_by_rm_at"),
  rejectionReason: text("rejection_reason"),
  submittedByUserId: varchar("submitted_by_user_id").references(() => users.id),
  managerSubmitted: boolean("manager_submitted").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const timesheetPeriodsRelations = relations(timesheetPeriods, ({ one, many }) => ({
  resource: one(resources, {
    fields: [timesheetPeriods.resourceId],
    references: [resources.id],
  }),
  entries: many(timesheetEntries),
  approver: one(users, {
    fields: [timesheetPeriods.approvedBy],
    references: [users.id],
  }),
}));

export const timesheetEntries = pgTable("timesheet_entries", {
  id: serial("id").primaryKey(),
  timesheetPeriodId: integer("timesheet_period_id").notNull().references(() => timesheetPeriods.id, { onDelete: "cascade" }),
  resourceId: integer("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  projectId: integer("project_id"),
  projectName: text("project_name"),
  activityType: text("activity_type").default("billable"),
  role: text("role"),
  departmentCode: text("department_code"),
  costCentreCode: text("cost_centre_code"),
  entryDate: date("entry_date"),
  dayOfWeek: integer("day_of_week").notNull(),
  hours: decimal("hours", { precision: 4, scale: 1 }).default("0"),
  chargeRate: decimal("charge_rate", { precision: 10, scale: 2 }),
  costRate: decimal("cost_rate", { precision: 10, scale: 2 }),
  calculatedCharge: decimal("calculated_charge", { precision: 15, scale: 2 }),
  calculatedCost: decimal("calculated_cost", { precision: 15, scale: 2 }),
  isInvoiced: boolean("is_invoiced").default(false),
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  approvalStatus: text("approval_status").default("pending"),
  rejectionReason: text("rejection_reason"),
  approvedById: varchar("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
});

export const timesheetEntriesRelations = relations(timesheetEntries, ({ one }) => ({
  timesheetPeriod: one(timesheetPeriods, {
    fields: [timesheetEntries.timesheetPeriodId],
    references: [timesheetPeriods.id],
  }),
  resource: one(resources, {
    fields: [timesheetEntries.resourceId],
    references: [resources.id],
  }),
}));

/** Module 08 — single source of truth for rate cards (ADR-003). CRM has read-only access. */
export const rateCards = pgTable("rate_cards", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  cardType: text("card_type").default("standard"),
  clientId: integer("client_id"),
  projectId: integer("project_id"),
  currency: text("currency").default("GBP"),
  effectiveFrom: timestamp("effective_from"),
  effectiveTo: timestamp("effective_to"),
  isDefault: boolean("is_default").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const rateCardItems = pgTable("rate_card_items", {
  id: serial("id").primaryKey(),
  rateCardId: integer("rate_card_id").notNull().references(() => rateCards.id, { onDelete: "cascade" }),
  roleName: text("role_name").notNull(),
  level: text("level"),
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull(),
  costRate: decimal("cost_rate", { precision: 10, scale: 2 }),
  hourlyChargeRate: decimal("hourly_charge_rate", { precision: 10, scale: 2 }),
  hourlyCostRate: decimal("hourly_cost_rate", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const rateCardRelations = relations(rateCards, ({ many }) => ({
  items: many(rateCardItems),
}));

export const rateCardItemRelations = relations(rateCardItems, ({ one }) => ({
  rateCard: one(rateCards, { fields: [rateCardItems.rateCardId], references: [rateCards.id] }),
}));

export const resourceLeaves = pgTable("resource_leaves", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  resourceId: integer("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  leaveType: text("leave_type").default("annual"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  notes: text("notes"),
  approvedById: varchar("approved_by_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const resourceLeavesRelations = relations(resourceLeaves, ({ one }) => ({
  resource: one(resources, { fields: [resourceLeaves.resourceId], references: [resources.id] }),
}));

export const timesheetIntegrations = pgTable("timesheet_integrations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  endpointUrl: text("endpoint_url").notNull(),
  authType: text("auth_type").default("bearer"),
  authConfig: jsonb("auth_config"),
  trigger: text("trigger").default("on_approval"),
  scheduleCron: text("schedule_cron"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const timesheetIntegrationLog = pgTable("timesheet_integration_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  integrationId: integer("integration_id").references(() => timesheetIntegrations.id, { onDelete: "cascade" }),
  recordsSent: integer("records_sent").default(0),
  status: text("status").default("pending"),
  errorMessage: text("error_message"),
  payload: jsonb("payload"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const timesheetAuditLog = pgTable("timesheet_audit_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  timesheetPeriodId: integer("timesheet_period_id").references(() => timesheetPeriods.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  details: text("details"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const projectCodes = pgTable("project_codes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("external"),
  isActive: boolean("is_active").default(true),
  departmentCode: text("department_code"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const documentResourceLinks = pgTable("document_resource_links", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  documentId: integer("document_id").notNull(),
  resourceId: integer("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  linkType: text("link_type").default("general"),
  notes: text("notes"),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const documentResourceLinksRelations = relations(documentResourceLinks, ({ one }) => ({
  resource: one(resources, { fields: [documentResourceLinks.resourceId], references: [resources.id] }),
}));

export const insertDocumentResourceLinkSchema = createInsertSchema(documentResourceLinks).omit({ id: true, createdAt: true });
export const insertSkillCategorySchema = createInsertSchema(skillCategories).omit({ id: true, createdAt: true });
export const insertSkillSchema = createInsertSchema(skills).omit({ id: true, createdAt: true });
export const insertResourceSkillSchema = createInsertSchema(resourceSkills).omit({ id: true, createdAt: true });
export const insertResourceAllocationSchema = createInsertSchema(resourceAllocations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimesheetPeriodSchema = createInsertSchema(timesheetPeriods).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimesheetEntrySchema = createInsertSchema(timesheetEntries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectCodeSchema = createInsertSchema(projectCodes).omit({ id: true, createdAt: true });
export const insertRateCardSchema = createInsertSchema(rateCards).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRateCardItemSchema = createInsertSchema(rateCardItems).omit({ id: true, createdAt: true });
export const insertResourceLeaveSchema = createInsertSchema(resourceLeaves).omit({ id: true, createdAt: true });
export const insertTimesheetIntegrationSchema = createInsertSchema(timesheetIntegrations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimesheetAuditLogSchema = createInsertSchema(timesheetAuditLog).omit({ id: true, createdAt: true });

export type Resource = typeof resources.$inferSelect;
export type SkillCategory = typeof skillCategories.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type ResourceSkill = typeof resourceSkills.$inferSelect;
export type ResourceAllocation = typeof resourceAllocations.$inferSelect;
export type TimesheetPeriod = typeof timesheetPeriods.$inferSelect;
export type TimesheetEntry = typeof timesheetEntries.$inferSelect;
export type ProjectCode = typeof projectCodes.$inferSelect;
export type RateCard = typeof rateCards.$inferSelect;
export type RateCardItem = typeof rateCardItems.$inferSelect;

export type InsertResource = z.infer<typeof insertResourceSchema>;
export type InsertSkillCategory = z.infer<typeof insertSkillCategorySchema>;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type InsertResourceSkill = z.infer<typeof insertResourceSkillSchema>;
export type InsertResourceAllocation = z.infer<typeof insertResourceAllocationSchema>;
export type InsertTimesheetPeriod = z.infer<typeof insertTimesheetPeriodSchema>;
export type InsertTimesheetEntry = z.infer<typeof insertTimesheetEntrySchema>;
export type InsertProjectCode = z.infer<typeof insertProjectCodeSchema>;
export type InsertRateCard = z.infer<typeof insertRateCardSchema>;
export type InsertRateCardItem = z.infer<typeof insertRateCardItemSchema>;
export type ResourceLeave = typeof resourceLeaves.$inferSelect;
export type TimesheetIntegration = typeof timesheetIntegrations.$inferSelect;
export type TimesheetIntegrationLog = typeof timesheetIntegrationLog.$inferSelect;
export type TimesheetAuditLog = typeof timesheetAuditLog.$inferSelect;
export type DocumentResourceLink = typeof documentResourceLinks.$inferSelect;
export type InsertDocumentResourceLink = z.infer<typeof insertDocumentResourceLinkSchema>;

export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTimesheetIntegration = z.infer<typeof insertTimesheetIntegrationSchema>;
export type InsertTimesheetAuditLog = z.infer<typeof insertTimesheetAuditLogSchema>;

/** Spec skill levels 1–5 */
export const SKILL_LEVELS = [
  { level: 1, value: "awareness", label: "Awareness" },
  { level: 2, value: "foundation", label: "Foundation" },
  { level: 3, value: "practitioner", label: "Practitioner" },
  { level: 4, value: "expert", label: "Expert" },
  { level: 5, value: "thought-leader", label: "Thought Leader" },
] as const;

export const PERSON_TYPES = ["employee", "contractor", "third-party", "customer"] as const;
export const RESOURCE_STATUSES = ["active", "on-leave", "inactive", "bench"] as const;
export const UTILISATION_TARGET_PCT = 75;
