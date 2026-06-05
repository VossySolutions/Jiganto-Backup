import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const aiTokenBalance = pgTable("ai_token_balance", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  balance: integer("balance").notNull().default(0),
  monthlyAllocation: integer("monthly_allocation").notNull().default(100_000),
  lastResetAt: timestamp("last_reset_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiTokenUsage = pgTable("ai_token_usage", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  module: text("module").notNull(),
  featureName: text("feature_name").notNull(),
  tokensConsumed: integer("tokens_consumed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiTokenLimits = pgTable("ai_token_limits", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  module: text("module"),
  userId: varchar("user_id").references(() => users.id),
  monthlyLimit: integer("monthly_limit").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AiTokenBalance = typeof aiTokenBalance.$inferSelect;
export type AiTokenUsage = typeof aiTokenUsage.$inferSelect;
export type AiTokenLimit = typeof aiTokenLimits.$inferSelect;
