import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants } from "../schema";
import { documents } from "./documents";

export const signoffStatusEnum = ["draft", "pending", "completed", "declined", "cancelled", "expired"] as const;
export const signoffSourceTypeEnum = ["upload", "jiganto_doc", "crm_contract"] as const;
export const signerStatusEnum = ["pending", "viewed", "signed", "declined"] as const;

export const signoffRequests = pgTable("signoff_requests", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  sourceType: text("source_type").notNull().default("upload"),
  sourceDocumentId: integer("source_document_id").references(() => documents.id, { onDelete: "set null" }),
  crmContractId: integer("crm_contract_id"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileData: text("file_data"),
  message: text("message"),
  deadline: text("deadline"),
  status: text("status").notNull().default("draft"),
  createdBy: varchar("created_by").references(() => users.id),
  createdByName: text("created_by_name"),
  completedAt: timestamp("completed_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const signoffSigners = pgTable("signoff_signers", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => signoffRequests.id, { onDelete: "cascade" }),
  signerOrder: integer("signer_order").notNull().default(1),
  name: text("name").notNull(),
  email: text("email").notNull(),
  isInternal: boolean("is_internal").default(false),
  userId: varchar("user_id").references(() => users.id),
  token: text("token").unique(),
  tokenExpiresAt: timestamp("token_expires_at"),
  status: text("status").notNull().default("pending"),
  signedAt: timestamp("signed_at"),
  viewedAt: timestamp("viewed_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  ipAddress: text("ip_address"),
  signatureName: text("signature_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const signoffAuditLog = pgTable("signoff_audit_log", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => signoffRequests.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  actorName: text("actor_name").notNull(),
  actorEmail: text("actor_email"),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const signoffRequestsRelations = relations(signoffRequests, ({ many }) => ({
  signers: many(signoffSigners),
  auditLog: many(signoffAuditLog),
}));

export const signoffSignersRelations = relations(signoffSigners, ({ one }) => ({
  request: one(signoffRequests, { fields: [signoffSigners.requestId], references: [signoffRequests.id] }),
}));

export const signoffAuditLogRelations = relations(signoffAuditLog, ({ one }) => ({
  request: one(signoffRequests, { fields: [signoffAuditLog.requestId], references: [signoffRequests.id] }),
}));

export const insertSignoffRequestSchema = createInsertSchema(signoffRequests).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true, sentAt: true });
export const insertSignoffSignerSchema = createInsertSchema(signoffSigners).omit({ id: true, createdAt: true, token: true, tokenExpiresAt: true, signedAt: true, viewedAt: true, declinedAt: true });
export const insertSignoffAuditLogSchema = createInsertSchema(signoffAuditLog).omit({ id: true, createdAt: true });

export type SignoffRequest = typeof signoffRequests.$inferSelect;
export type InsertSignoffRequest = z.infer<typeof insertSignoffRequestSchema>;
export type SignoffSigner = typeof signoffSigners.$inferSelect;
export type InsertSignoffSigner = z.infer<typeof insertSignoffSignerSchema>;
export type SignoffAuditLog = typeof signoffAuditLog.$inferSelect;
export type InsertSignoffAuditLog = z.infer<typeof insertSignoffAuditLogSchema>;

export type SignoffRequestWithDetails = SignoffRequest & {
  signers: SignoffSigner[];
  auditLog: SignoffAuditLog[];
  sourceDocument?: { id: number; title: string; content: string | null } | null;
};
