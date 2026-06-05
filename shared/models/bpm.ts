import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants } from "../schema";
import { bpmlEntries } from "./bpml";

export const bpmDiagramTypeEnum = ["flowchart", "process_flow", "bpml", "org_chart", "architecture", "network", "database_diagram", "workflow"] as const;
export const bpmDiagramStatusEnum = ["draft", "review", "approved", "published"] as const;
export const bpmNodeTypeEnum = [
  "start", "end", "task", "decision", "gateway_parallel", "gateway_exclusive", "gateway_inclusive",
  "subprocess", "data_object", "document", "system", "manual_task", "automated_task",
  "manual_process", "automated_process", "database", "manual_input", "annotation", "cloud_system", "loop",
  "api_call", "event_trigger", "delay", "display", "predefined_process", "multi_document",
  "internal_storage", "extract", "merge", "sort", "collate", "stored_data", "off_page_ref",
  "terminator", "preparation", "swimlane", "pool", "swimlane_pool", "swimlane_lane"
] as const;
export const bpmEdgeTypeEnum = ["default", "conditional", "association", "message"] as const;
export const bpmSwimlaneOrientationEnum = ["horizontal", "vertical"] as const;
export const bpmAttachmentTypeEnum = ["sop", "training", "video", "guide", "document", "quick_reference", "simulation", "faq"] as const;

export const bpmDiagrams = pgTable("bpm_diagrams", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  libraryId: integer("library_id").references(() => bpmLibraries.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("process_flow"),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  published: boolean("published").default(false),
  ownerId: varchar("owner_id").references(() => users.id),
  canvasData: jsonb("canvas_data"),
  metadata: jsonb("metadata"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bpmDiagramsRelations = relations(bpmDiagrams, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [bpmDiagrams.tenantId],
    references: [tenants.id],
  }),
  owner: one(users, {
    fields: [bpmDiagrams.ownerId],
    references: [users.id],
  }),
  library: one(bpmLibraries, {
    fields: [bpmDiagrams.libraryId],
    references: [bpmLibraries.id],
  }),
  nodes: many(bpmNodes),
  edges: many(bpmEdges),
  swimlanes: many(bpmSwimlanes),
}));

export const bpmNodes = pgTable("bpm_nodes", {
  id: serial("id").primaryKey(),
  diagramId: integer("diagram_id").notNull().references(() => bpmDiagrams.id, { onDelete: "cascade" }),
  nodeId: text("node_id").notNull(),
  nodeType: text("node_type").notNull().default("task"),
  label: text("label").notNull().default(""),
  positionX: decimal("position_x").notNull().default("0"),
  positionY: decimal("position_y").notNull().default("0"),
  width: decimal("width"),
  height: decimal("height"),
  swimlaneId: integer("swimlane_id"),
  parentNodeId: text("parent_node_id"),
  attributes: jsonb("attributes").default({}),
  style: jsonb("style").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bpmNodesRelations = relations(bpmNodes, ({ one }) => ({
  diagram: one(bpmDiagrams, {
    fields: [bpmNodes.diagramId],
    references: [bpmDiagrams.id],
  }),
}));

export const bpmEdges = pgTable("bpm_edges", {
  id: serial("id").primaryKey(),
  diagramId: integer("diagram_id").notNull().references(() => bpmDiagrams.id, { onDelete: "cascade" }),
  edgeId: text("edge_id").notNull(),
  sourceNodeId: text("source_node_id").notNull(),
  targetNodeId: text("target_node_id").notNull(),
  label: text("label"),
  edgeType: text("edge_type").default("default"),
  style: jsonb("style").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bpmEdgesRelations = relations(bpmEdges, ({ one }) => ({
  diagram: one(bpmDiagrams, {
    fields: [bpmEdges.diagramId],
    references: [bpmDiagrams.id],
  }),
}));

export const bpmSwimlanes = pgTable("bpm_swimlanes", {
  id: serial("id").primaryKey(),
  diagramId: integer("diagram_id").notNull().references(() => bpmDiagrams.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  orientation: text("orientation").notNull().default("horizontal"),
  order: integer("order").notNull().default(0),
  color: text("color"),
  width: decimal("width"),
  height: decimal("height"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bpmSwimlanesRelations = relations(bpmSwimlanes, ({ one }) => ({
  diagram: one(bpmDiagrams, {
    fields: [bpmSwimlanes.diagramId],
    references: [bpmDiagrams.id],
  }),
}));

export const bpmLibraries = pgTable("bpm_libraries", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  vendor: text("vendor"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bpmLibrariesRelations = relations(bpmLibraries, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [bpmLibraries.tenantId],
    references: [tenants.id],
  }),
  diagrams: many(bpmDiagrams),
  templates: many(bpmTemplates),
}));

export const bpmTemplates = pgTable("bpm_templates", {
  id: serial("id").primaryKey(),
  libraryId: integer("library_id").references(() => bpmLibraries.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("process_flow"),
  category: text("category"),
  vendor: text("vendor"),
  processType: text("process_type"),
  templateData: jsonb("template_data"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bpmTemplatesRelations = relations(bpmTemplates, ({ one }) => ({
  library: one(bpmLibraries, {
    fields: [bpmTemplates.libraryId],
    references: [bpmLibraries.id],
  }),
}));

export const bpmAttachments = pgTable("bpm_attachments", {
  id: serial("id").primaryKey(),
  nodeId: integer("node_id"),
  diagramId: integer("diagram_id").notNull().references(() => bpmDiagrams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").default("document"),
  url: text("url"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bpmAttachmentsRelations = relations(bpmAttachments, ({ one }) => ({
  diagram: one(bpmDiagrams, {
    fields: [bpmAttachments.diagramId],
    references: [bpmDiagrams.id],
  }),
}));

export const frameworkCategoryEnum = [
  "project_delivery", "customer_lifecycle", "itsm", "pm_standards",
  "quality_testing", "support_ops", "change_risk", "sdlc", "other"
] as const;

export const frameworkStatusEnum = ["draft", "review", "approved", "published", "archived"] as const;

export const frameworks = pgTable("frameworks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("other"),
  vendor: text("vendor"),
  version: text("version").default("1.0"),
  status: text("status").notNull().default("draft"),
  phases: jsonb("phases").default([]),
  metadata: jsonb("metadata"),
  tags: text("tags").array(),
  isBuiltIn: boolean("is_built_in").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const frameworksRelations = relations(frameworks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [frameworks.tenantId],
    references: [tenants.id],
  }),
}));

export const insertBpmDiagramSchema = createInsertSchema(bpmDiagrams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBpmNodeSchema = createInsertSchema(bpmNodes).omit({ id: true, createdAt: true });
export const insertBpmEdgeSchema = createInsertSchema(bpmEdges).omit({ id: true, createdAt: true });
export const insertBpmSwimlaneSchema = createInsertSchema(bpmSwimlanes).omit({ id: true, createdAt: true });
export const insertBpmLibrarySchema = createInsertSchema(bpmLibraries).omit({ id: true, createdAt: true });
export const insertBpmTemplateSchema = createInsertSchema(bpmTemplates).omit({ id: true, createdAt: true });
export const portalMenuNodes = pgTable("portal_menu_nodes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const portalMenuNodesRelations = relations(portalMenuNodes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [portalMenuNodes.tenantId],
    references: [tenants.id],
  }),
  parent: one(portalMenuNodes, {
    fields: [portalMenuNodes.parentId],
    references: [portalMenuNodes.id],
    relationName: "parent_child",
  }),
  children: many(portalMenuNodes, { relationName: "parent_child" }),
  diagramAssignments: many(portalDiagramAssignments),
}));

export const portalDiagramAssignments = pgTable("portal_diagram_assignments", {
  id: serial("id").primaryKey(),
  menuNodeId: integer("menu_node_id").notNull().references(() => portalMenuNodes.id, { onDelete: "cascade" }),
  diagramId: integer("diagram_id").notNull().references(() => bpmDiagrams.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portalDiagramAssignmentsRelations = relations(portalDiagramAssignments, ({ one }) => ({
  menuNode: one(portalMenuNodes, {
    fields: [portalDiagramAssignments.menuNodeId],
    references: [portalMenuNodes.id],
  }),
  diagram: one(bpmDiagrams, {
    fields: [portalDiagramAssignments.diagramId],
    references: [bpmDiagrams.id],
  }),
}));

export const processResourceTypeEnum = ["user_guide", "quick_reference", "simulation", "video", "template", "tool", "faq", "sop"] as const;

export const processResources = pgTable("process_resources", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  entryId: integer("entry_id").references(() => bpmlEntries.id, { onDelete: "cascade" }),
  menuNodeId: integer("menu_node_id").references(() => portalMenuNodes.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"),
  url: text("url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const processResourcesRelations = relations(processResources, ({ one }) => ({
  tenant: one(tenants, {
    fields: [processResources.tenantId],
    references: [tenants.id],
  }),
}));

export const insertBpmAttachmentSchema = createInsertSchema(bpmAttachments).omit({ id: true, createdAt: true });
export const insertFrameworkSchema = createInsertSchema(frameworks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPortalMenuNodeSchema = createInsertSchema(portalMenuNodes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPortalDiagramAssignmentSchema = createInsertSchema(portalDiagramAssignments).omit({ id: true, createdAt: true });
export const insertProcessResourceSchema = createInsertSchema(processResources).omit({ id: true, createdAt: true, updatedAt: true });

export type BpmDiagram = typeof bpmDiagrams.$inferSelect;
export type InsertBpmDiagram = z.infer<typeof insertBpmDiagramSchema>;
export type BpmNode = typeof bpmNodes.$inferSelect;
export type InsertBpmNode = z.infer<typeof insertBpmNodeSchema>;
export type BpmEdge = typeof bpmEdges.$inferSelect;
export type InsertBpmEdge = z.infer<typeof insertBpmEdgeSchema>;
export type BpmSwimlane = typeof bpmSwimlanes.$inferSelect;
export type InsertBpmSwimlane = z.infer<typeof insertBpmSwimlaneSchema>;
export type BpmLibrary = typeof bpmLibraries.$inferSelect;
export type InsertBpmLibrary = z.infer<typeof insertBpmLibrarySchema>;
export type BpmTemplate = typeof bpmTemplates.$inferSelect;
export type InsertBpmTemplate = z.infer<typeof insertBpmTemplateSchema>;
export type BpmAttachment = typeof bpmAttachments.$inferSelect;
export type InsertBpmAttachment = z.infer<typeof insertBpmAttachmentSchema>;
export type Framework = typeof frameworks.$inferSelect;
export type InsertFramework = z.infer<typeof insertFrameworkSchema>;
export type PortalMenuNode = typeof portalMenuNodes.$inferSelect;
export type InsertPortalMenuNode = z.infer<typeof insertPortalMenuNodeSchema>;
export type PortalDiagramAssignment = typeof portalDiagramAssignments.$inferSelect;
export type InsertPortalDiagramAssignment = z.infer<typeof insertPortalDiagramAssignmentSchema>;
export type ProcessResource = typeof processResources.$inferSelect;
export type InsertProcessResource = z.infer<typeof insertProcessResourceSchema>;
