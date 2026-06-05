import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, decimal } from "drizzle-orm/pg-core";
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
  employmentType: text("employment_type").default("full-time"),
  status: text("status").default("available"),
  costRate: decimal("cost_rate", { precision: 10, scale: 2 }),
  billRate: decimal("bill_rate", { precision: 10, scale: 2 }),
  weeklyCapacityHours: decimal("weekly_capacity_hours", { precision: 5, scale: 1 }).default("40"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  notes: text("notes"),
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
  proficiencyLevel: text("proficiency_level").default("intermediate"),
  yearsExperience: decimal("years_experience", { precision: 4, scale: 1 }),
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
  allocationType: text("allocation_type").default("hard"),
  allocationPercentage: decimal("allocation_percentage", { precision: 5, scale: 1 }).default("100"),
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
  totalHours: decimal("total_hours", { precision: 6, scale: 1 }).default("0"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
  rejectionReason: text("rejection_reason"),
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
  departmentCode: text("department_code"),
  dayOfWeek: integer("day_of_week").notNull(),
  hours: decimal("hours", { precision: 4, scale: 1 }).default("0"),
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
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

export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSkillCategorySchema = createInsertSchema(skillCategories).omit({ id: true, createdAt: true });
export const insertSkillSchema = createInsertSchema(skills).omit({ id: true, createdAt: true });
export const insertResourceSkillSchema = createInsertSchema(resourceSkills).omit({ id: true, createdAt: true });
export const insertResourceAllocationSchema = createInsertSchema(resourceAllocations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimesheetPeriodSchema = createInsertSchema(timesheetPeriods).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimesheetEntrySchema = createInsertSchema(timesheetEntries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectCodeSchema = createInsertSchema(projectCodes).omit({ id: true, createdAt: true });

export type Resource = typeof resources.$inferSelect;
export type SkillCategory = typeof skillCategories.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type ResourceSkill = typeof resourceSkills.$inferSelect;
export type ResourceAllocation = typeof resourceAllocations.$inferSelect;
export type TimesheetPeriod = typeof timesheetPeriods.$inferSelect;
export type TimesheetEntry = typeof timesheetEntries.$inferSelect;
export type ProjectCode = typeof projectCodes.$inferSelect;

export type InsertResource = z.infer<typeof insertResourceSchema>;
export type InsertSkillCategory = z.infer<typeof insertSkillCategorySchema>;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type InsertResourceSkill = z.infer<typeof insertResourceSkillSchema>;
export type InsertResourceAllocation = z.infer<typeof insertResourceAllocationSchema>;
export type InsertTimesheetPeriod = z.infer<typeof insertTimesheetPeriodSchema>;
export type InsertTimesheetEntry = z.infer<typeof insertTimesheetEntrySchema>;
export type InsertProjectCode = z.infer<typeof insertProjectCodeSchema>;
