import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const recruitmentRecommendations = pgTable("recruitment_recommendations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  skillOrRole: text("skill_or_role").notNull(),
  grade: text("grade"),
  headcount: integer("headcount").default(1).notNull(),
  targetMonth: text("target_month"),
  latestStartDate: timestamp("latest_start_date"),
  goLiveDate: timestamp("go_live_date"),
  timeToHireWeeks: integer("time_to_hire_weeks").default(8),
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
  currency: text("currency").default("GBP"),
  status: text("status").default("open"),
  priority: text("priority").default("medium"),
  recommendationType: text("recommendation_type").default("shortage"),
  actionText: text("action_text"),
  sourceDemandId: integer("source_demand_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const resourcePlanningScenarios = pgTable("resource_planning_scenarios", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  scenarioType: text("scenario_type").default("expected"),
  probabilityMultiplier: decimal("probability_multiplier", { precision: 4, scale: 2 }).default("1.0"),
  revenueForecast: decimal("revenue_forecast", { precision: 15, scale: 2 }),
  demandFte: decimal("demand_fte", { precision: 8, scale: 1 }),
  utilisationForecast: integer("utilisation_forecast"),
  shortfallFte: decimal("shortfall_fte", { precision: 8, scale: 1 }),
  assumptions: jsonb("assumptions"),
  actions: jsonb("actions"),
  isDefault: boolean("is_default").default(false),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const resourcePlanningAuditLog = pgTable("resource_planning_audit_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  action: text("action").notNull(),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  details: jsonb("details"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertRecruitmentRecommendationSchema = createInsertSchema(recruitmentRecommendations)
  .omit({ id: true, createdAt: true, updatedAt: true });
export const insertResourcePlanningScenarioSchema = createInsertSchema(resourcePlanningScenarios)
  .omit({ id: true, createdAt: true, updatedAt: true });
export const insertResourcePlanningAuditLogSchema = createInsertSchema(resourcePlanningAuditLog)
  .omit({ id: true, createdAt: true });

export type RecruitmentRecommendation = typeof recruitmentRecommendations.$inferSelect;
export type ResourcePlanningScenario = typeof resourcePlanningScenarios.$inferSelect;
export type ResourcePlanningAuditLog = typeof resourcePlanningAuditLog.$inferSelect;
export type InsertRecruitmentRecommendation = z.infer<typeof insertRecruitmentRecommendationSchema>;
export type InsertResourcePlanningScenario = z.infer<typeof insertResourcePlanningScenarioSchema>;
export type InsertResourcePlanningAuditLog = z.infer<typeof insertResourcePlanningAuditLogSchema>;
