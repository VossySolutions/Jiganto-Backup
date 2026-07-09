import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  jsonb,
  varchar
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { tenants } from "../schema";
import { users } from "./auth";
import { bpmlEntries, bpmlTemplates } from "./bpml";
import { bpmDiagrams } from "./bpm";

export const bpmTemplateTierEnum = ["system", "customer", "submitted"] as const;
export const bpmSubmissionStatusEnum = ["pending", "approved", "rejected"] as const;
export const portalAccessModelEnum = ["open", "tag_based"] as const;
export const bpmStepLinkTypeEnum = ["test_scenario", "help_desk_incident", "document"] as const;

export const architectureDiagramTypeEnum = [
  "system_landscape", "integration_architecture", "data_flow", "network",
  "raci_matrix", "deployment", "custom",
] as const;

export const processPortalSettings = pgTable("process_portal_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  libraryId: integer("library_id").references(() => bpmlTemplates.id, { onDelete: "cascade" }),
  accessModel: text("access_model").notNull().default("open"),
  businessAreaColors: jsonb("business_area_colors").default({}),
  userAreaTags: jsonb("user_area_tags").default({}),
  customAssetTypes: jsonb("custom_asset_types").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bpmlEntryHistory = pgTable("bpml_entry_history", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull().references(() => bpmlEntries.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: varchar("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at").defaultNow(),
});

export const bpmStepLinks = pgTable("bpm_step_links", {
  id: serial("id").primaryKey(),
  diagramId: integer("diagram_id").notNull().references(() => bpmDiagrams.id, { onDelete: "cascade" }),
  nodeId: text("node_id").notNull(),
  linkType: text("link_type").notNull(),
  targetId: integer("target_id").notNull(),
  label: text("label"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bpmTemplateSubmissions = pgTable("bpm_template_submissions", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  submittedBy: varchar("submitted_by").references(() => users.id),
  status: text("status").notNull().default("pending"),
  reviewFeedback: text("review_feedback"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const processPortalSettingsRelations = relations(processPortalSettings, ({ one }) => ({
  tenant: one(tenants, { fields: [processPortalSettings.tenantId], references: [tenants.id] }),
  library: one(bpmlTemplates, { fields: [processPortalSettings.libraryId], references: [bpmlTemplates.id] }),
}));

export const bpmlEntryHistoryRelations = relations(bpmlEntryHistory, ({ one }) => ({
  entry: one(bpmlEntries, { fields: [bpmlEntryHistory.entryId], references: [bpmlEntries.id] }),
}));

export const bpmStepLinksRelations = relations(bpmStepLinks, ({ one }) => ({
  diagram: one(bpmDiagrams, { fields: [bpmStepLinks.diagramId], references: [bpmDiagrams.id] }),
}));

export const insertProcessPortalSettingsSchema = createInsertSchema(processPortalSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBpmlEntryHistorySchema = createInsertSchema(bpmlEntryHistory).omit({ id: true, changedAt: true });
export const insertBpmStepLinkSchema = createInsertSchema(bpmStepLinks).omit({ id: true, createdAt: true });
export const insertBpmTemplateSubmissionSchema = createInsertSchema(bpmTemplateSubmissions).omit({ id: true, createdAt: true });

export type ProcessPortalSettings = typeof processPortalSettings.$inferSelect;
export type InsertProcessPortalSettings = z.infer<typeof insertProcessPortalSettingsSchema>;
export type BpmlEntryHistory = typeof bpmlEntryHistory.$inferSelect;
export type InsertBpmlEntryHistory = z.infer<typeof insertBpmlEntryHistorySchema>;
export type BpmStepLink = typeof bpmStepLinks.$inferSelect;
export type InsertBpmStepLink = z.infer<typeof insertBpmStepLinkSchema>;
export type BpmTemplateSubmission = typeof bpmTemplateSubmissions.$inferSelect;

export type PortalCustomAssetType = { id: string; label: string; icon: string };
export type PortalBusinessAreaColor = { area: string; color: string };

export const DEFAULT_PORTAL_ASSET_FILTERS = [
  { key: "all", label: "All" },
  { key: "process_flow", label: "Process Flow" },
  { key: "quick_reference", label: "QRG" },
  { key: "sop", label: "SOP" },
  { key: "video", label: "Video" },
  { key: "user_guide", label: "Guide" },
  { key: "external_link", label: "Link" },
] as const;

export const CHART_TYPE_THEME_COLORS: Record<string, { header: string; edge: string }> = {
  project_team: { header: "#4F46E5", edge: "#6366F1" },
  steering_committee: { header: "#0D9488", edge: "#14B8A6" },
  stakeholder_map: { header: "#7C3AED", edge: "#8B5CF6" },
};

export const ENGAGEMENT_LEVELS = ["champion", "supporter", "neutral", "resistant", "blocker"] as const;
