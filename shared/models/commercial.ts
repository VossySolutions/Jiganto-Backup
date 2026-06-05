import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "../schema";

/** Platform-wide Module 0 settings (singleton row id = 1). */
export const customerMgmtSettings = pgTable("customer_mgmt_settings", {
  id: integer("id").primaryKey().default(1),
  settings: jsonb("settings").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Commercial customer profile — one row per paying/trial organisation.
 * Links to `tenants` when the org exists on the platform.
 */
export const commercialCustomers = pgTable("commercial_customers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  externalId: text("external_id").notNull().unique(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  avatarColor: text("avatar_color").notNull().default("#534AB7"),
  domain: text("domain"),
  userCount: integer("user_count").notNull().default(0),
  plan: text("plan").notNull().default("growth"),
  status: text("status").notNull().default("active"),
  statusLabel: text("status_label").notNull().default("Active"),
  mrrPence: integer("mrr_pence"),
  healthScore: integer("health_score").notNull().default(70),
  healthBand: text("health_band").notNull().default("healthy"),
  csmId: text("csm_id"),
  csmName: text("csm_name"),
  csmInitials: text("csm_initials"),
  nextAction: text("next_action"),
  nextActionUrgent: boolean("next_action_urgent").default(false),
  renewalDate: text("renewal_date"),
  trialExpiresAt: text("trial_expires_at"),
  trialDaysLeft: integer("trial_days_left"),
  rowHighlight: text("row_highlight"),
  activeSince: text("active_since"),
  website: text("website"),
  subscription: jsonb("subscription"),
  usage: jsonb("usage"),
  healthSignals: jsonb("health_signals"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const commercialContacts = pgTable("commercial_contacts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => commercialCustomers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  initials: text("initials").notNull(),
  avatarColor: text("avatar_color").notNull().default("#534AB7"),
  roleLabel: text("role_label").notNull(),
  roleVariant: text("role_variant").default("gray"),
});

export const commercialFeatureFlags = pgTable("commercial_feature_flags", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => commercialCustomers.id, { onDelete: "cascade" }),
  flagKey: text("flag_key").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(false),
});

export const commercialActivityLog = pgTable("commercial_activity_log", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => commercialCustomers.id, { onDelete: "cascade" }),
  entryType: text("entry_type"),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  entryDate: text("entry_date"),
  dotColor: text("dot_color").default("#534AB7"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const commercialAccessGrants = pgTable("commercial_access_grants", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => commercialCustomers.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull().unique(),
  grantType: text("grant_type").notNull(),
  typeLabel: text("type_label").notNull(),
  plan: text("plan").notNull().default("growth"),
  startedAt: text("started_at"),
  expiresAt: text("expires_at"),
  daysLeft: integer("days_left"),
  grantedBy: text("granted_by"),
  reason: text("reason"),
  rowHighlight: text("row_highlight"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const commercialProgrammes = pgTable("commercial_programmes", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  statusLabel: text("status_label").notNull(),
  programmeType: text("programme_type").notNull(),
  description: text("description"),
  slotsFilled: integer("slots_filled").notNull().default(0),
  slotsMax: integer("slots_max").notNull().default(10),
  endsAt: text("ends_at"),
  monthlyCostPence: integer("monthly_cost_pence").notNull().default(0),
  participantInitials: jsonb("participant_initials").$type<string[]>().default([]),
  participantColors: jsonb("participant_colors").$type<string[]>().default([]),
  extraParticipants: integer("extra_participants"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const commercialInvoices = pgTable("commercial_invoices", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  customerId: integer("customer_id").references(() => commercialCustomers.id, {
    onDelete: "set null",
  }),
  customerName: text("customer_name").notNull(),
  amountPence: integer("amount_pence").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("pending"),
  stripeInvoiceId: text("stripe_invoice_id").unique(),
  syncedAt: timestamp("synced_at"),
});

/** Idempotent Stripe webhook event log. */
export const commercialStripeEvents = pgTable("commercial_stripe_events", {
  id: serial("id").primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
});

export const commercialDiscountRules = pgTable("commercial_discount_rules", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  name: text("name").notNull(),
  appliesTo: text("applies_to").notNull(),
  discount: text("discount").notNull(),
  duration: text("duration").notNull(),
  whoCanApply: text("who_can_apply").notNull(),
  automatic: boolean("automatic").notNull().default(false),
});

/** Aggregated dashboard sections not yet derived from live telemetry. */
export const customerMgmtPlatformMetrics = pgTable("customer_mgmt_platform_metrics", {
  id: integer("id").primaryKey().default(1),
  metrics: jsonb("metrics").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const commercialCustomersRelations = relations(commercialCustomers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [commercialCustomers.tenantId],
    references: [tenants.id],
  }),
  contacts: many(commercialContacts),
  featureFlags: many(commercialFeatureFlags),
  activityLog: many(commercialActivityLog),
  accessGrants: many(commercialAccessGrants),
}));

export type CommercialCustomerRow = typeof commercialCustomers.$inferSelect;
export type CommercialCustomerInsert = typeof commercialCustomers.$inferInsert;
