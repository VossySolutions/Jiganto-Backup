import { pgTable, text, serial, integer, timestamp, varchar, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { tenants } from "../schema";
import { users } from "./auth";

export const CLIENT_STATUS = ["active", "archived", "pending_delete"] as const;
export type ClientStatus = (typeof CLIENT_STATUS)[number];

export const ENGAGEMENT_STATUS = ["active", "on_hold", "completed", "archived"] as const;
export type EngagementStatus = (typeof ENGAGEMENT_STATUS)[number];

export const CLIENT_USER_ROLES = [
  "workspace_admin",
  "editor",
  "viewer",
  /** @deprecated use workspace_admin */
  "client_admin",
  /** @deprecated use viewer */
  "client_viewer",
] as const;
export type ClientUserRole = (typeof CLIENT_USER_ROLES)[number];

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  slug: text("slug"),
  shortCode: varchar("short_code", { length: 5 }).notNull(),
  color: text("color").notNull().default("#534AB7"),
  logoUrl: text("logo_url"),
  industry: text("industry"),
  status: text("status").notNull().default("active"),
  engagementStatus: text("engagement_status").notNull().default("active"),
  contractValue: decimal("contract_value", { precision: 12, scale: 2 }),
  contractStart: text("contract_start"),
  contractEnd: text("contract_end"),
  website: text("website"),
  notes: text("notes"),
  tags: text("tags"),
  crmAccountId: integer("crm_account_id"),
  accountManagerId: varchar("account_manager_id").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  purgeAt: timestamp("purge_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clientUsers = pgTable("client_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("viewer"),
  memberType: text("member_type").notNull().default("client"),
  invitedBy: text("invited_by"),
  invitedAt: timestamp("invited_at").defaultNow(),
  joinedAt: timestamp("joined_at"),
  lastSeenAt: timestamp("last_seen_at"),
  isActive: integer("is_active").notNull().default(1),
});

export const clientModuleVisibility = pgTable("client_module_visibility", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  moduleKey: text("module_key").notNull(),
  isVisible: integer("is_visible").notNull().default(0),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clientInvitations = pgTable("client_invitations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("viewer"),
  memberType: text("member_type").notNull().default("client"),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientsRelations = relations(clients, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [clients.tenantId],
    references: [tenants.id],
  }),
  users: many(clientUsers),
  moduleVisibility: many(clientModuleVisibility),
  invitations: many(clientInvitations),
}));

export const clientUsersRelations = relations(clientUsers, ({ one }) => ({
  client: one(clients, {
    fields: [clientUsers.clientId],
    references: [clients.id],
  }),
  tenant: one(tenants, {
    fields: [clientUsers.tenantId],
    references: [tenants.id],
  }),
}));

export const clientModuleVisibilityRelations = relations(clientModuleVisibility, ({ one }) => ({
  client: one(clients, {
    fields: [clientModuleVisibility.clientId],
    references: [clients.id],
  }),
}));

export const clientInvitationsRelations = relations(clientInvitations, ({ one }) => ({
  client: one(clients, {
    fields: [clientInvitations.clientId],
    references: [clients.id],
  }),
}));

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  purgeAt: true,
});
export const insertClientUserSchema = createInsertSchema(clientUsers).omit({
  id: true,
  invitedAt: true,
});
export const insertClientInvitationSchema = createInsertSchema(clientInvitations).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type ClientUser = typeof clientUsers.$inferSelect;
export type InsertClientUser = z.infer<typeof insertClientUserSchema>;
export type ClientModuleVisibility = typeof clientModuleVisibility.$inferSelect;
export type ClientInvitation = typeof clientInvitations.$inferSelect;
