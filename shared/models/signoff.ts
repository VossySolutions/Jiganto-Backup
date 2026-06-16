import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants } from "../schema";
import { documents } from "./documents";
import { pmProjects } from "./projects";

export const signoffStatusEnum = [
  "draft", "pending", "partially_signed", "completed", "declined", "expired", "voided", "cancelled",
] as const;

export const signoffSourceTypeEnum = [
  "upload", "jiganto_doc", "inline_doc", "template", "crm_contract", "timesheet_period", "test_cycle",
] as const;

export const signoffSigningOrderEnum = ["sequential", "parallel"] as const;

export const signerStatusEnum = ["pending", "notified", "viewed", "signed", "declined"] as const;

export const signatureMethodEnum = ["draw", "type", "upload"] as const;

export const signoffRequests = pgTable("signoff_requests", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  workspaceId: integer("workspace_id"),
  projectId: integer("project_id").references(() => pmProjects.id, { onDelete: "set null" }),
  deliverableId: integer("deliverable_id"),
  title: text("title").notNull(),
  description: text("description"),
  sourceType: text("source_type").notNull().default("upload"),
  sourceDocumentId: integer("source_document_id").references(() => documents.id, { onDelete: "set null" }),
  templateId: integer("template_id"),
  crmContractId: integer("crm_contract_id"),
  timesheetPeriodId: integer("timesheet_period_id"),
  testCycleId: integer("test_cycle_id"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileData: text("file_data"),
  contentHtml: text("content_html"),
  message: text("message"),
  signingOrder: text("signing_order").notNull().default("sequential"),
  deadline: text("deadline"),
  allowDecline: boolean("allow_decline").default(true),
  sendCopyOnCompletion: boolean("send_copy_on_completion").default(true),
  requireAcknowledgement: boolean("require_acknowledgement").default(false),
  acknowledgementText: text("acknowledgement_text"),
  requireReadToBottom: boolean("require_read_to_bottom").default(false),
  requireOtpVerification: boolean("require_otp_verification").default(false),
  requireEidasConsent: boolean("require_eidas_consent").default(false),
  eidasConsentText: text("eidas_consent_text"),
  signatureLevel: text("signature_level").notNull().default("ses"),
  status: text("status").notNull().default("draft"),
  signedPdfData: text("signed_pdf_data"),
  voidReason: text("void_reason"),
  createdBy: varchar("created_by").references(() => users.id),
  createdByName: text("created_by_name"),
  completedAt: timestamp("completed_at"),
  voidedAt: timestamp("voided_at"),
  expiredAt: timestamp("expired_at"),
  sentAt: timestamp("sent_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const signoffSigners = pgTable("signoff_signers", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => signoffRequests.id, { onDelete: "cascade" }),
  signerOrder: integer("signer_order").notNull().default(1),
  name: text("name").notNull(),
  email: text("email").notNull(),
  roleTitle: text("role_title"),
  isInternal: boolean("is_internal").default(false),
  userId: varchar("user_id").references(() => users.id),
  token: text("token").unique(),
  tokenExpiresAt: timestamp("token_expires_at"),
  tokenUsedAt: timestamp("token_used_at"),
  status: text("status").notNull().default("pending"),
  signingDeadline: text("signing_deadline"),
  privateMessage: text("private_message"),
  signedAt: timestamp("signed_at"),
  viewedAt: timestamp("viewed_at"),
  notifiedAt: timestamp("notified_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  signatureName: text("signature_name"),
  signatureMethod: text("signature_method"),
  signatureData: text("signature_data"),
  otpVerifiedAt: timestamp("otp_verified_at"),
  eidasConsentAt: timestamp("eidas_consent_at"),
  addedBy: varchar("added_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const signoffAuditLog = pgTable("signoff_audit_log", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => signoffRequests.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  actorName: text("actor_name").notNull(),
  actorEmail: text("actor_email"),
  signerId: integer("signer_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Phase 2 — field-level signature placement (spec addendum v1.1) */
export const signoffSignatureFields = pgTable("esign_signature_fields", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => signoffRequests.id, { onDelete: "cascade" }),
  signerEmail: text("signer_email").notNull(),
  fieldType: text("field_type").notNull(),
  pageNumber: integer("page_number").notNull().default(1),
  xPercent: text("x_percent").notNull().default("10"),
  yPercent: text("y_percent").notNull().default("80"),
  widthPercent: text("width_percent").notNull().default("25"),
  heightPercent: text("height_percent").notNull().default("8"),
  isRequired: boolean("is_required").default(true),
  label: text("label"),
  completedAt: timestamp("completed_at"),
  value: text("value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const signoffOtpCodes = pgTable("signoff_otp_codes", {
  id: serial("id").primaryKey(),
  signerId: integer("signer_id").notNull().references(() => signoffSigners.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const signoffTemplates = pgTable("signoff_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  tier: text("tier").notNull().default("customer"),
  sourceType: text("source_type").notNull().default("inline_doc"),
  contentHtml: text("content_html"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileData: text("file_data"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const signoffRequestsRelations = relations(signoffRequests, ({ many }) => ({
  signers: many(signoffSigners),
  auditLog: many(signoffAuditLog),
  signatureFields: many(signoffSignatureFields),
}));

export const signoffSignersRelations = relations(signoffSigners, ({ one }) => ({
  request: one(signoffRequests, { fields: [signoffSigners.requestId], references: [signoffRequests.id] }),
}));

export const signoffAuditLogRelations = relations(signoffAuditLog, ({ one }) => ({
  request: one(signoffRequests, { fields: [signoffAuditLog.requestId], references: [signoffRequests.id] }),
}));

export const insertSignoffRequestSchema = createInsertSchema(signoffRequests).omit({
  id: true, createdAt: true, updatedAt: true, completedAt: true, sentAt: true, voidedAt: true, expiredAt: true,
});
export const insertSignoffSignerSchema = createInsertSchema(signoffSigners).omit({
  id: true, createdAt: true, token: true, tokenExpiresAt: true, tokenUsedAt: true,
  signedAt: true, viewedAt: true, notifiedAt: true, declinedAt: true,
});
export const insertSignoffAuditLogSchema = createInsertSchema(signoffAuditLog).omit({ id: true, createdAt: true });
export const insertSignoffTemplateSchema = createInsertSchema(signoffTemplates).omit({ id: true, createdAt: true, updatedAt: true });

export type SignoffRequest = typeof signoffRequests.$inferSelect;
export type InsertSignoffRequest = z.infer<typeof insertSignoffRequestSchema>;
export type SignoffSigner = typeof signoffSigners.$inferSelect;
export type InsertSignoffSigner = z.infer<typeof insertSignoffSignerSchema>;
export type SignoffAuditLog = typeof signoffAuditLog.$inferSelect;
export type InsertSignoffAuditLog = z.infer<typeof insertSignoffAuditLogSchema>;
export type SignoffTemplate = typeof signoffTemplates.$inferSelect;
export type SignoffSignatureField = typeof signoffSignatureFields.$inferSelect;

export type SignoffRequestWithDetails = SignoffRequest & {
  signers: SignoffSigner[];
  auditLog: SignoffAuditLog[];
  signatureFields?: SignoffSignatureField[];
  sourceDocument?: { id: number; title: string; content: string | null } | null;
  project?: { id: number; name: string } | null;
  deliverable?: { id: number; name: string } | null;
};
