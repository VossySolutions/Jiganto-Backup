import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants } from "../schema";

export const templateModuleEnum = [
  "bpm_framework",
  "bpm_diagram",
  "bpm_orgchart",
  "project",
  "survey",
  "esign",
  "workspace",
  "test_mgmt",
  "bpml",
  "whiteboard",
] as const;

export const platformTemplateTierEnum = ["system", "customer", "submitted"] as const;
export const templateStatusEnum = ["draft", "active", "archived"] as const;
export const templateSubmissionStatusEnum = ["none", "submitted", "approved", "declined"] as const;

export const templateCategoryTags = [
  "SAP", "Salesforce", "Workday", "Oracle", "Agile", "Generic IT",
  "Management Consulting", "Custom",
] as const;

export type TemplateModule = (typeof templateModuleEnum)[number];
export type TemplateTier = (typeof platformTemplateTierEnum)[number];

export const platformTemplates = pgTable("platform_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  module: text("module").notNull(),
  categoryTags: text("category_tags").array(),
  tier: text("tier").notNull().default("customer"),
  submissionStatus: text("submission_status").notNull().default("none"),
  submissionNote: text("submission_note"),
  reviewerNote: text("reviewer_note"),
  contributorOrgId: integer("contributor_org_id").references(() => tenants.id),
  showContributorCredit: boolean("show_contributor_credit").default(false),
  sourceModule: text("source_module"),
  sourceId: integer("source_id"),
  snapshotJsonb: jsonb("snapshot_jsonb").notNull().default({}),
  thumbnailUrl: text("thumbnail_url"),
  version: text("version").notNull().default("1.0"),
  status: text("status").notNull().default("active"),
  usageCount: integer("usage_count").notNull().default(0),
  isFeatured: boolean("is_featured").default(false),
  isAiGenerated: boolean("is_ai_generated").default(false),
  marketplaceListed: boolean("marketplace_listed").default(false),
  marketplaceFeatured: boolean("marketplace_featured").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const templateUsageLog = pgTable("template_usage_log", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => platformTemplates.id, { onDelete: "cascade" }),
  usedBy: varchar("used_by").references(() => users.id),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  targetModule: text("target_module").notNull(),
  targetId: integer("target_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const templateAiGenerations = pgTable("template_ai_generations", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => platformTemplates.id, { onDelete: "set null" }),
  promptText: text("prompt_text").notNull(),
  modelUsed: text("model_used"),
  tokensConsumed: integer("tokens_consumed").default(0),
  generatedAt: timestamp("generated_at").defaultNow(),
  generatedBy: varchar("generated_by").references(() => users.id),
});

export const platformTemplatesRelations = relations(platformTemplates, ({ one, many }) => ({
  tenant: one(tenants, { fields: [platformTemplates.tenantId], references: [tenants.id] }),
  creator: one(users, { fields: [platformTemplates.createdBy], references: [users.id] }),
  usageLog: many(templateUsageLog),
}));

export const templateUsageLogRelations = relations(templateUsageLog, ({ one }) => ({
  template: one(platformTemplates, { fields: [templateUsageLog.templateId], references: [platformTemplates.id] }),
}));

export const insertPlatformTemplateSchema = createInsertSchema(platformTemplates).omit({
  id: true, createdAt: true, updatedAt: true, usageCount: true,
});

export type PlatformTemplate = typeof platformTemplates.$inferSelect;
export type InsertPlatformTemplate = z.infer<typeof insertPlatformTemplateSchema>;
export type TemplateUsageLog = typeof templateUsageLog.$inferSelect;
export type TemplateAiGeneration = typeof templateAiGenerations.$inferSelect;

export type PlatformTemplateWithMeta = PlatformTemplate & {
  creatorName?: string | null;
  contributorOrgName?: string | null;
};
