import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants } from "../schema";

export const documentStatusEnum = ["draft", "published", "archived"] as const;
export const permissionLevelEnum = ["read", "write", "share", "admin"] as const;
export const documentTypeEnum = [
  "document", "wiki", "template", "sop", "policy", "contract",
  "sow", "msa", "user_guide", "training_guide", "proposal", "requirements"
] as const;
export const documentTemplateCategoryEnum = [
  "project_delivery", "legal_contracts", "user_documentation", "training_materials", "proposals", "requirements"
] as const;

export const documentFolders = pgTable("document_folders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  /** Client workspace scope (Section 4) — `clients.id` */
  clientId: integer("client_id"),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  ownerId: varchar("owner_id").references(() => users.id),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentFoldersRelations = relations(documentFolders, ({ one, many }) => ({
  owner: one(users, {
    fields: [documentFolders.ownerId],
    references: [users.id],
  }),
  parent: one(documentFolders, {
    fields: [documentFolders.parentId],
    references: [documentFolders.id],
    relationName: "folderHierarchy",
  }),
  children: many(documentFolders, {
    relationName: "folderHierarchy",
  }),
  documents: many(documents),
}));

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  clientId: integer("client_id"),
  folderId: integer("folder_id").references(() => documentFolders.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"),
  type: text("type").notNull().default("document"),
  status: text("status").notNull().default("draft"),
  ownerId: varchar("owner_id").references(() => users.id),
  currentVersion: integer("current_version").default(1),
  isFavorite: boolean("is_favorite").default(false),
  isPinned: boolean("is_pinned").default(false),
  viewCount: integer("view_count").default(0),
  lastViewedAt: timestamp("last_viewed_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentsRelations = relations(documents, ({ one, many }) => ({
  owner: one(users, {
    fields: [documents.ownerId],
    references: [users.id],
  }),
  folder: one(documentFolders, {
    fields: [documents.folderId],
    references: [documentFolders.id],
  }),
  versions: many(documentVersions),
  tags: many(documentTags),
  comments: many(documentComments),
  acl: many(documentAcl),
}));

export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  changeDescription: text("change_description"),
  authorId: varchar("author_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id],
  }),
  author: one(users, {
    fields: [documentVersions.authorId],
    references: [users.id],
  }),
}));

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  color: text("color"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentTags = pgTable("document_tags", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentTagsRelations = relations(documentTags, ({ one }) => ({
  document: one(documents, {
    fields: [documentTags.documentId],
    references: [documents.id],
  }),
  tag: one(tags, {
    fields: [documentTags.tagId],
    references: [tags.id],
  }),
}));

export const documentAcl = pgTable("document_acl", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => documentFolders.id, { onDelete: "cascade" }),
  subjectType: text("subject_type").notNull(),
  subjectId: varchar("subject_id").notNull(),
  permission: text("permission").notNull().default("read"),
  grantedById: varchar("granted_by_id").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentAclRelations = relations(documentAcl, ({ one }) => ({
  document: one(documents, {
    fields: [documentAcl.documentId],
    references: [documents.id],
  }),
  folder: one(documentFolders, {
    fields: [documentAcl.folderId],
    references: [documentFolders.id],
  }),
  grantedBy: one(users, {
    fields: [documentAcl.grantedById],
    references: [users.id],
  }),
}));

export const documentComments = pgTable("document_comments", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  authorId: varchar("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  position: jsonb("position"),
  isResolved: boolean("is_resolved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentCommentsRelations = relations(documentComments, ({ one, many }) => ({
  document: one(documents, {
    fields: [documentComments.documentId],
    references: [documents.id],
  }),
  author: one(users, {
    fields: [documentComments.authorId],
    references: [users.id],
  }),
  parent: one(documentComments, {
    fields: [documentComments.parentId],
    references: [documentComments.id],
    relationName: "commentReplies",
  }),
  replies: many(documentComments, {
    relationName: "commentReplies",
  }),
}));


export const documentAuditLogs = pgTable("document_audit_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  documentId: integer("document_id").references(() => documents.id, { onDelete: "set null" }),
  folderId: integer("folder_id").references(() => documentFolders.id, { onDelete: "set null" }),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentAuditLogsRelations = relations(documentAuditLogs, ({ one }) => ({
  document: one(documents, {
    fields: [documentAuditLogs.documentId],
    references: [documents.id],
  }),
  folder: one(documentFolders, {
    fields: [documentAuditLogs.folderId],
    references: [documentFolders.id],
  }),
  user: one(users, {
    fields: [documentAuditLogs.userId],
    references: [users.id],
  }),
}));

export const documentTemplateScopeEnum = ["global", "department", "module", "personal"] as const;
export const documentTemplateStatusEnum = ["draft", "active", "archived"] as const;

export const documentTemplates = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("document"),
  content: text("content"),
  category: text("category"),
  icon: text("icon"),
  scope: text("scope").notNull().default("global"),
  department: text("department"),
  module: text("module"),
  status: text("status").notNull().default("active"),
  thumbnail: text("thumbnail"),
  tags: text("tags").array(),
  formatConfig: jsonb("format_config"),
  isDefault: boolean("is_default").default(false),
  isPublished: boolean("is_published").default(false),
  marketplaceStatus: text("marketplace_status"),
  version: integer("version").default(1),
  usageCount: integer("usage_count").default(0),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentTemplatesRelations = relations(documentTemplates, ({ one }) => ({
  createdBy: one(users, {
    fields: [documentTemplates.createdById],
    references: [users.id],
  }),
}));

export const documentInitiativeLinks = pgTable("document_initiative_links", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  initiativeId: integer("initiative_id").notNull(),
  linkType: text("link_type").default("deliverable"),
  notes: text("notes"),
  order: integer("order").default(0),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentInitiativeLinksRelations = relations(documentInitiativeLinks, ({ one }) => ({
  document: one(documents, {
    fields: [documentInitiativeLinks.documentId],
    references: [documents.id],
  }),
  createdBy: one(users, {
    fields: [documentInitiativeLinks.createdById],
    references: [users.id],
  }),
}));

export const documentFiles = pgTable("document_files", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  folderId: integer("folder_id").references(() => documentFolders.id, { onDelete: "set null" }),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  uploadedById: varchar("uploaded_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentFilesRelations = relations(documentFiles, ({ one }) => ({
  folder: one(documentFolders, {
    fields: [documentFiles.folderId],
    references: [documentFolders.id],
  }),
  uploadedBy: one(users, {
    fields: [documentFiles.uploadedById],
    references: [users.id],
  }),
}));

export const insertDocumentFolderSchema = createInsertSchema(documentFolders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentVersionSchema = createInsertSchema(documentVersions).omit({ id: true, createdAt: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true, createdAt: true });
export const insertDocumentTagSchema = createInsertSchema(documentTags).omit({ id: true, createdAt: true });
export const insertDocumentAclSchema = createInsertSchema(documentAcl).omit({ id: true, createdAt: true });
export const insertDocumentCommentSchema = createInsertSchema(documentComments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentAuditLogSchema = createInsertSchema(documentAuditLogs).omit({ id: true, createdAt: true });
export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentInitiativeLinkSchema = createInsertSchema(documentInitiativeLinks).omit({ id: true, createdAt: true });
export const insertDocumentFileSchema = createInsertSchema(documentFiles).omit({ id: true, createdAt: true, updatedAt: true });

export type DocumentFolder = typeof documentFolders.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type DocumentTag = typeof documentTags.$inferSelect;
export type DocumentAcl = typeof documentAcl.$inferSelect;
export type DocumentComment = typeof documentComments.$inferSelect;
export type DocumentAuditLog = typeof documentAuditLogs.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type DocumentInitiativeLink = typeof documentInitiativeLinks.$inferSelect;

export type InsertDocumentFolder = z.infer<typeof insertDocumentFolderSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type InsertDocumentTag = z.infer<typeof insertDocumentTagSchema>;
export type InsertDocumentAcl = z.infer<typeof insertDocumentAclSchema>;
export type InsertDocumentComment = z.infer<typeof insertDocumentCommentSchema>;
export type InsertDocumentAuditLog = z.infer<typeof insertDocumentAuditLogSchema>;
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type InsertDocumentInitiativeLink = z.infer<typeof insertDocumentInitiativeLinkSchema>;
export type DocumentFile = typeof documentFiles.$inferSelect;
export type InsertDocumentFile = z.infer<typeof insertDocumentFileSchema>;
