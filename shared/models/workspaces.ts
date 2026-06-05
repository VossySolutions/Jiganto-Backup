import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants } from "../schema";

export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  status: text("status").default("active"),
  isFavorite: boolean("is_favorite").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").default("member"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  creator: one(users, {
    fields: [workspaces.createdBy],
    references: [users.id],
  }),
  pages: many(workspacePages),
  members: many(workspaceMembers),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const workspacePages = pgTable("workspace_pages", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  title: text("title").notNull().default("Untitled"),
  description: text("description"),
  icon: text("icon"),
  coverImage: text("cover_image"),
  content: text("content"),
  pageType: text("page_type").notNull().default("page"),
  documentStatus: text("document_status").default("Draft"),
  isFavorite: boolean("is_favorite").default(false),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workspacePagesRelations = relations(workspacePages, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [workspacePages.workspaceId],
    references: [workspaces.id],
  }),
  parent: one(workspacePages, {
    fields: [workspacePages.parentId],
    references: [workspacePages.id],
    relationName: "pageHierarchy",
  }),
  children: many(workspacePages, {
    relationName: "pageHierarchy",
  }),
  databases: many(workspaceDatabases),
}));

export const workspaceDatabases = pgTable("workspace_databases", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => workspacePages.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled Board"),
  activeView: text("active_view").notNull().default("table"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workspaceDatabasesRelations = relations(workspaceDatabases, ({ one, many }) => ({
  page: one(workspacePages, {
    fields: [workspaceDatabases.pageId],
    references: [workspacePages.id],
  }),
  columns: many(workspaceDatabaseColumns),
  rows: many(workspaceDatabaseRows),
}));

export const workspaceDatabaseColumns = pgTable("workspace_database_columns", {
  id: serial("id").primaryKey(),
  databaseId: integer("database_id").notNull().references(() => workspaceDatabases.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("text"),
  options: jsonb("options"),
  sortOrder: integer("sort_order").default(0),
  width: integer("width"),
});

export const workspaceDatabaseColumnsRelations = relations(workspaceDatabaseColumns, ({ one }) => ({
  database: one(workspaceDatabases, {
    fields: [workspaceDatabaseColumns.databaseId],
    references: [workspaceDatabases.id],
  }),
}));

export const workspaceDatabaseRows = pgTable("workspace_database_rows", {
  id: serial("id").primaryKey(),
  databaseId: integer("database_id").notNull().references(() => workspaceDatabases.id, { onDelete: "cascade" }),
  data: jsonb("data").default({}),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workspaceDatabaseRowsRelations = relations(workspaceDatabaseRows, ({ one }) => ({
  database: one(workspaceDatabases, {
    fields: [workspaceDatabaseRows.databaseId],
    references: [workspaceDatabases.id],
  }),
}));

export const workspaceSavedViews = pgTable("workspace_saved_views", {
  id: serial("id").primaryKey(),
  databaseId: integer("database_id").notNull().references(() => workspaceDatabases.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  viewType: text("view_type").notNull().default("table"),
  config: jsonb("config").default({}),
  isDefault: boolean("is_default").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workspaceSavedViewsRelations = relations(workspaceSavedViews, ({ one }) => ({
  database: one(workspaceDatabases, {
    fields: [workspaceSavedViews.databaseId],
    references: [workspaceDatabases.id],
  }),
}));

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembers).omit({ id: true, createdAt: true });
export const insertWorkspacePageSchema = createInsertSchema(workspacePages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkspaceDatabaseSchema = createInsertSchema(workspaceDatabases).omit({ id: true, createdAt: true });
export const insertWorkspaceDatabaseColumnSchema = createInsertSchema(workspaceDatabaseColumns).omit({ id: true });
export const insertWorkspaceDatabaseRowSchema = createInsertSchema(workspaceDatabaseRows).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkspaceSavedViewSchema = createInsertSchema(workspaceSavedViews).omit({ id: true, createdAt: true });

export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type InsertWorkspaceMember = z.infer<typeof insertWorkspaceMemberSchema>;
export type WorkspacePage = typeof workspacePages.$inferSelect;
export type WorkspaceDatabase = typeof workspaceDatabases.$inferSelect;
export type WorkspaceDatabaseColumn = typeof workspaceDatabaseColumns.$inferSelect;
export type WorkspaceDatabaseRow = typeof workspaceDatabaseRows.$inferSelect;
export type WorkspaceSavedView = typeof workspaceSavedViews.$inferSelect;

export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type InsertWorkspacePage = z.infer<typeof insertWorkspacePageSchema>;
export type InsertWorkspaceDatabase = z.infer<typeof insertWorkspaceDatabaseSchema>;
export type InsertWorkspaceDatabaseColumn = z.infer<typeof insertWorkspaceDatabaseColumnSchema>;
export type InsertWorkspaceDatabaseRow = z.infer<typeof insertWorkspaceDatabaseRowSchema>;
export type InsertWorkspaceSavedView = z.infer<typeof insertWorkspaceSavedViewSchema>;
