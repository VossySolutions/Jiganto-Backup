import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";
import { tenants } from "../schema";
import { resources } from "./resources";

export const orgChartTypeEnum = ["department", "project_team", "steering_committee", "stakeholder_map", "company", "division", "custom"] as const;

export const orgChartTemplates = pgTable("org_chart_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  nodeHeaderColor: text("node_header_color").notNull().default("#1E88C8"),
  nodeBodyColor: text("node_body_color").notNull().default("#FFFFFF"),
  nodeTextColor: text("node_text_color").notNull().default("#111827"),
  nodeBorderColor: text("node_border_color").notNull().default("#E5E7EB"),
  edgeColor: text("edge_color").notNull().default("#6B7280"),
  badgeColor: text("badge_color").notNull().default("#F3F4F6"),
  badgeTextColor: text("badge_text_color").notNull().default("#374151"),
  titleColor: text("title_color").notNull().default("#111827"),
  titleBgColor: text("title_bg_color"),
  isDefault: boolean("is_default").notNull().default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const orgChartTemplatesRelations = relations(orgChartTemplates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [orgChartTemplates.tenantId],
    references: [tenants.id],
  }),
}));

export const orgCharts = pgTable("org_charts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  chartTitle: text("chart_title"),
  chartType: text("chart_type").notNull().default("department"),
  templateId: integer("template_id"),
  showPhotos: boolean("show_photos").notNull().default(true),
  layoutData: jsonb("layout_data"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const orgChartsRelations = relations(orgCharts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orgCharts.tenantId],
    references: [tenants.id],
  }),
  template: one(orgChartTemplates, {
    fields: [orgCharts.templateId],
    references: [orgChartTemplates.id],
  }),
  members: many(orgChartMembers),
}));

export const orgChartMembers = pgTable("org_chart_members", {
  id: serial("id").primaryKey(),
  chartId: integer("chart_id").notNull().references(() => orgCharts.id, { onDelete: "cascade" }),
  resourceId: integer("resource_id").references(() => resources.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  title: text("title"),
  department: text("department"),
  organisation: text("organisation"),
  email: text("email"),
  phone: text("phone"),
  engagementLevel: text("engagement_level"),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  parentMemberId: integer("parent_member_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  layoutDirection: text("layout_direction").notNull().default("below"),
  positionX: decimal("position_x", { precision: 10, scale: 2 }).default("0"),
  positionY: decimal("position_y", { precision: 10, scale: 2 }).default("0"),
  isCollapsed: boolean("is_collapsed").notNull().default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const orgChartMembersRelations = relations(orgChartMembers, ({ one, many }) => ({
  chart: one(orgCharts, {
    fields: [orgChartMembers.chartId],
    references: [orgCharts.id],
  }),
  resource: one(resources, {
    fields: [orgChartMembers.resourceId],
    references: [resources.id],
  }),
  parent: one(orgChartMembers, {
    fields: [orgChartMembers.parentMemberId],
    references: [orgChartMembers.id],
    relationName: "parentChild",
  }),
  children: many(orgChartMembers, {
    relationName: "parentChild",
  }),
}));

export const insertOrgChartTemplateSchema = createInsertSchema(orgChartTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrgChartSchema = createInsertSchema(orgCharts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrgChartMemberSchema = createInsertSchema(orgChartMembers).omit({ id: true, createdAt: true });

export type OrgChartTemplate = typeof orgChartTemplates.$inferSelect;
export type InsertOrgChartTemplate = z.infer<typeof insertOrgChartTemplateSchema>;
export type OrgChart = typeof orgCharts.$inferSelect;
export type InsertOrgChart = z.infer<typeof insertOrgChartSchema>;
export type OrgChartMember = typeof orgChartMembers.$inferSelect;
export type InsertOrgChartMember = z.infer<typeof insertOrgChartMemberSchema>;
