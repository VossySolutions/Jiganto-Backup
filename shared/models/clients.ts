import { pgTable, text, serial, integer, timestamp, varchar, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { tenants } from "../schema";

export const CLIENT_STATUS = ["active", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUS)[number];

export const CLIENT_USER_ROLES = ["client_admin", "client_viewer"] as const;
export type ClientUserRole = (typeof CLIENT_USER_ROLES)[number];

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  /** URL segment for /ws/[slug] deep links (Section 4.2). */
  slug: text("slug"),
  shortCode: varchar("short_code", { length: 4 }).notNull(),
  color: text("color").notNull().default("#534AB7"),
  logoUrl: text("logo_url"),
  industry: text("industry"),
  status: text("status").notNull().default("active"),
  contractValue: decimal("contract_value", { precision: 12, scale: 2 }),
  contractStart: text("contract_start"),
  contractEnd: text("contract_end"),
  website: text("website"),
  notes: text("notes"),
  crmAccountId: integer("crm_account_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clientUsers = pgTable("client_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("client_viewer"),
  invitedAt: timestamp("invited_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at"),
});

export const clientsRelations = relations(clients, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [clients.tenantId],
    references: [tenants.id],
  }),
  users: many(clientUsers),
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

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertClientUserSchema = createInsertSchema(clientUsers).omit({
  id: true,
  invitedAt: true,
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type ClientUser = typeof clientUsers.$inferSelect;
export type InsertClientUser = z.infer<typeof insertClientUserSchema>;
