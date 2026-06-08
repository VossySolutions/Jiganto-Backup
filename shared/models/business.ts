import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, date, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants } from "../schema";

export const strategyStatusEnum = ["not_started", "on_track", "at_risk", "completed"] as const;
export const reviewCadenceEnum = ["monthly", "quarterly", "annually"] as const;
export const goalStatusEnum = ["on_track", "at_risk", "off_track", "completed"] as const;
export const priorityEnum = ["low", "medium", "high", "critical"] as const;
export const indicatorTypeEnum = ["leading", "lagging"] as const;
export const ragStatusEnum = ["green", "amber", "red"] as const;
export const trendEnum = ["improving", "stable", "deteriorating"] as const;
export const timeframeEnum = ["q1", "q2", "q3", "q4", "h1", "h2", "annual"] as const;

export const strategyItems = pgTable("strategy_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  templateType: text("template_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  content: jsonb("content"),
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name"),
  departmentId: integer("department_id").references(() => departments.id),
  status: text("status").notNull().default("not_started"),
  ragStatus: text("rag_status").default("green"),
  progress: integer("progress").default(0),
  trend: text("trend").default("stable"),
  timeframe: text("timeframe"),
  fiscalYear: integer("fiscal_year"),
  reviewCadence: text("review_cadence").default("quarterly"),
  lastReviewDate: date("last_review_date"),
  nextReviewDate: date("next_review_date"),
  targetDate: text("target_date"),
  notes: text("notes"),
  order: integer("order").default(0),
  clientId: integer("client_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const strategyItemsRelations = relations(strategyItems, ({ one, many }) => ({
  owner: one(users, {
    fields: [strategyItems.ownerId],
    references: [users.id],
  }),
  goals: many(goals),
  risks: many(risks),
}));

export const risks = pgTable("risks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  strategyItemId: integer("strategy_item_id").references(() => strategyItems.id),
  type: text("type").notNull().default("risk"),
  title: text("title").notNull(),
  description: text("description"),
  likelihood: text("likelihood"),
  impact: text("impact"),
  mitigation: text("mitigation"),
  ownerId: varchar("owner_id").references(() => users.id),
  status: text("status").default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const risksRelations = relations(risks, ({ one }) => ({
  strategyItem: one(strategyItems, {
    fields: [risks.strategyItemId],
    references: [strategyItems.id],
  }),
  owner: one(users, {
    fields: [risks.ownerId],
    references: [users.id],
  }),
}));

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  headId: varchar("head_id").references(() => users.id),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  head: one(users, {
    fields: [departments.headId],
    references: [users.id],
  }),
  processes: many(processes),
}));

export const processes = pgTable("processes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  departmentId: integer("department_id").references(() => departments.id),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  status: text("status").default("active"),
  isCritical: boolean("is_critical").default(false),
  documentationUrl: text("documentation_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const processesRelations = relations(processes, ({ one }) => ({
  department: one(departments, {
    fields: [processes.departmentId],
    references: [departments.id],
  }),
  owner: one(users, {
    fields: [processes.ownerId],
    references: [users.id],
  }),
}));

export const tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  vendor: text("vendor"),
  url: text("url"),
  ownerId: varchar("owner_id").references(() => users.id),
  status: text("status").default("active"),
  cost: text("cost"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const toolsRelations = relations(tools, ({ one }) => ({
  owner: one(users, {
    fields: [tools.ownerId],
    references: [users.id],
  }),
}));

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  strategyItemId: integer("strategy_item_id").references(() => strategyItems.id),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name"),
  departmentId: integer("department_id").references(() => departments.id),
  status: text("status").notNull().default("on_track"),
  ragStatus: text("rag_status").default("green"),
  progress: integer("progress").default(0),
  trend: text("trend").default("stable"),
  timeframe: text("timeframe"),
  fiscalYear: integer("fiscal_year"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  targetDate: text("target_date"),
  reviewCadence: text("review_cadence").default("quarterly"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const goalsRelations = relations(goals, ({ one, many }) => ({
  strategyItem: one(strategyItems, {
    fields: [goals.strategyItemId],
    references: [strategyItems.id],
  }),
  owner: one(users, {
    fields: [goals.ownerId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [goals.departmentId],
    references: [departments.id],
  }),
  objectives: many(objectives),
}));

export const objectives = pgTable("objectives", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  goalId: integer("goal_id").references(() => goals.id),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name"),
  departmentId: integer("department_id").references(() => departments.id),
  status: text("status").notNull().default("on_track"),
  ragStatus: text("rag_status").default("green"),
  progress: integer("progress").default(0),
  trend: text("trend").default("stable"),
  timeframe: text("timeframe"),
  fiscalYear: integer("fiscal_year"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  targetDate: text("target_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const objectivesRelations = relations(objectives, ({ one, many }) => ({
  goal: one(goals, {
    fields: [objectives.goalId],
    references: [goals.id],
  }),
  owner: one(users, {
    fields: [objectives.ownerId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [objectives.departmentId],
    references: [departments.id],
  }),
  initiatives: many(initiatives),
}));

export const initiatives = pgTable("initiatives", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  objectiveId: integer("objective_id").references(() => objectives.id),
  goalId: integer("goal_id").references(() => goals.id),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name"),
  departmentId: integer("department_id").references(() => departments.id),
  status: text("status").default("not_started"),
  ragStatus: text("rag_status").default("green"),
  progress: integer("progress").default(0),
  trend: text("trend").default("stable"),
  priority: text("priority").default("medium"),
  timeframe: text("timeframe"),
  fiscalYear: integer("fiscal_year"),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  targetDate: text("target_date"),
  projectId: integer("project_id"),
  deliveryType: text("delivery_type"),
  linkedRecordRef: text("linked_record_ref"),
  clientId: integer("client_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const initiativesRelations = relations(initiatives, ({ one, many }) => ({
  objective: one(objectives, {
    fields: [initiatives.objectiveId],
    references: [objectives.id],
  }),
  goal: one(goals, {
    fields: [initiatives.goalId],
    references: [goals.id],
  }),
  owner: one(users, {
    fields: [initiatives.ownerId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [initiatives.departmentId],
    references: [departments.id],
  }),
  okrs: many(okrs),
  tasks: many(businessTasks),
}));

export const okrs = pgTable("okrs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  initiativeId: integer("initiative_id").references(() => initiatives.id),
  objectiveId: integer("objective_id").references(() => objectives.id),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name"),
  departmentId: integer("department_id").references(() => departments.id),
  status: text("status").notNull().default("on_track"),
  ragStatus: text("rag_status").default("green"),
  progress: integer("progress").default(0),
  trend: text("trend").default("stable"),
  timeframe: text("timeframe"),
  fiscalYear: integer("fiscal_year"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  targetDate: text("target_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const okrsRelations = relations(okrs, ({ one, many }) => ({
  initiative: one(initiatives, {
    fields: [okrs.initiativeId],
    references: [initiatives.id],
  }),
  objective: one(objectives, {
    fields: [okrs.objectiveId],
    references: [objectives.id],
  }),
  owner: one(users, {
    fields: [okrs.ownerId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [okrs.departmentId],
    references: [departments.id],
  }),
  keyResults: many(keyResults),
  kpis: many(kpis),
}));

export const keyResults = pgTable("key_results", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  okrId: integer("okr_id").references(() => okrs.id, { onDelete: "cascade" }),
  goalId: integer("goal_id").references(() => goals.id),
  title: text("title").notNull(),
  description: text("description"),
  targetValue: decimal("target_value"),
  currentValue: decimal("current_value").default("0"),
  unit: text("unit"),
  ownerId: varchar("owner_id").references(() => users.id),
  status: text("status").default("on_track"),
  ragStatus: text("rag_status").default("green"),
  progress: integer("progress").default(0),
  trend: text("trend").default("stable"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const keyResultsRelations = relations(keyResults, ({ one }) => ({
  okr: one(okrs, {
    fields: [keyResults.okrId],
    references: [okrs.id],
  }),
  goal: one(goals, {
    fields: [keyResults.goalId],
    references: [goals.id],
  }),
  owner: one(users, {
    fields: [keyResults.ownerId],
    references: [users.id],
  }),
}));

export const kpis = pgTable("kpis", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  okrId: integer("okr_id").references(() => okrs.id),
  initiativeId: integer("initiative_id").references(() => initiatives.id),
  goalId: integer("goal_id").references(() => goals.id),
  name: text("name").notNull(),
  description: text("description"),
  targetValue: decimal("target_value"),
  currentValue: decimal("current_value").default("0"),
  unit: text("unit"),
  indicatorType: text("indicator_type").default("lagging"),
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name"),
  departmentId: integer("department_id").references(() => departments.id),
  status: text("status").default("on_track"),
  ragStatus: text("rag_status").default("green"),
  progress: integer("progress").default(0),
  trend: text("trend").default("stable"),
  targetDate: text("target_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const kpisRelations = relations(kpis, ({ one }) => ({
  okr: one(okrs, {
    fields: [kpis.okrId],
    references: [okrs.id],
  }),
  initiative: one(initiatives, {
    fields: [kpis.initiativeId],
    references: [initiatives.id],
  }),
  goal: one(goals, {
    fields: [kpis.goalId],
    references: [goals.id],
  }),
  owner: one(users, {
    fields: [kpis.ownerId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [kpis.departmentId],
    references: [departments.id],
  }),
}));

export const businessTasks = pgTable("business_tasks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  initiativeId: integer("initiative_id").references(() => initiatives.id),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: varchar("assignee_id").references(() => users.id),
  ownerName: text("owner_name"),
  departmentId: integer("department_id").references(() => departments.id),
  status: text("status").default("todo"),
  ragStatus: text("rag_status").default("green"),
  progress: integer("progress").default(0),
  priority: text("priority").default("medium"),
  dueDate: date("due_date"),
  targetDate: text("target_date"),
  itemType: text("item_type").default("task"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const businessTasksRelations = relations(businessTasks, ({ one }) => ({
  initiative: one(initiatives, {
    fields: [businessTasks.initiativeId],
    references: [initiatives.id],
  }),
  assignee: one(users, {
    fields: [businessTasks.assigneeId],
    references: [users.id],
  }),
}));

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  initiativeId: integer("initiative_id").references(() => initiatives.id),
  title: text("title").notNull(),
  description: text("description"),
  organizerId: varchar("organizer_id").references(() => users.id),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  location: text("location"),
  attendees: jsonb("attendees"),
  notes: text("notes"),
  status: text("status").default("scheduled"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetingsRelations = relations(meetings, ({ one }) => ({
  initiative: one(initiatives, {
    fields: [meetings.initiativeId],
    references: [initiatives.id],
  }),
  organizer: one(users, {
    fields: [meetings.organizerId],
    references: [users.id],
  }),
}));

export const documentLinks = pgTable("document_links", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  documentType: text("document_type").notNull(),
  linkedEntityType: text("linked_entity_type").notNull(),
  linkedEntityId: integer("linked_entity_id").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  documentId: integer("document_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Governance Items (7th layer) ──────────────────────────────────────────────
export const GOV_TYPES = ["board_decision", "review_meeting", "policy", "audit_item", "risk"] as const;
export type GovType = typeof GOV_TYPES[number];

export const governanceItems = pgTable("governance_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  govType: text("gov_type").notNull().default("board_decision"),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name"),
  departmentId: integer("department_id").references(() => departments.id),
  departmentName: text("department_name"),
  ragStatus: text("rag_status").default("green"),
  status: text("status").default("not_started"),
  progress: integer("progress").default(0),
  targetDate: text("target_date"),
  reviewCadence: text("review_cadence").default("quarterly"),
  nextReviewDate: date("next_review_date"),
  lastReviewDate: date("last_review_date"),
  // Board decision fields
  decisionText: text("decision_text"),
  decisionMaker: text("decision_maker"),
  decisionOutcome: text("decision_outcome"),
  // Meeting fields
  meetingDate: date("meeting_date"),
  attendees: jsonb("attendees"),
  agenda: text("agenda"),
  meetingOutcomes: text("meeting_outcomes"),
  actionItems: jsonb("action_items"),
  // Risk/Audit fields
  riskProbability: text("risk_probability"),
  riskImpact: text("risk_impact"),
  riskRating: text("risk_rating"),
  mitigationPlan: text("mitigation_plan"),
  // Policy fields
  policyEffectiveDate: date("policy_effective_date"),
  policyReviewDate: date("policy_review_date"),
  // Cross-links
  linkedStrategyItemId: integer("linked_strategy_item_id").references(() => strategyItems.id),
  linkedGoalId: integer("linked_goal_id").references(() => goals.id),
  clientId: integer("client_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const governanceItemsRelations = relations(governanceItems, ({ one }) => ({
  owner: one(users, { fields: [governanceItems.ownerId], references: [users.id] }),
  department: one(departments, { fields: [governanceItems.departmentId], references: [departments.id] }),
  linkedStrategy: one(strategyItems, { fields: [governanceItems.linkedStrategyItemId], references: [strategyItems.id] }),
}));

// ── Strategy Document Links (link docs/URLs to any layer) ─────────────────────
export const strategyDocumentLinks = pgTable("strategy_document_links", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  layerType: text("layer_type").notNull(), // strategy|goal|objective|initiative|okr|kpi|governance
  layerItemId: integer("layer_item_id").notNull(),
  docType: text("doc_type").notNull().default("external"), // jiganto|external|upload
  jigantoDocumentId: integer("jiganto_document_id"),
  externalUrl: text("external_url"),
  externalTitle: text("external_title"),
  externalDescription: text("external_description"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  addedBy: varchar("added_by"),
  addedByName: text("added_by_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── KPI Time-series Values ─────────────────────────────────────────────────────
export const strategyKpiValues = pgTable("strategy_kpi_values", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  kpiId: integer("kpi_id").notNull().references(() => kpis.id, { onDelete: "cascade" }),
  valueNumeric: decimal("value_numeric"),
  valueText: text("value_text"),
  periodDate: date("period_date").notNull(),
  note: text("note"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Strategy Review Notes ─────────────────────────────────────────────────────
export const strategyReviewNotes = pgTable("strategy_review_notes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  entityType: text("entity_type").notNull(), // "strategy"|"goal"|"objective"|"initiative"|"okr"|"kpi"|"governance"
  entityId: integer("entity_id").notNull(),
  content: text("content").notNull(),
  ragSnapshot: text("rag_snapshot"),
  progressAtCheckin: integer("progress_at_checkin"),
  authorName: text("author_name").notNull(),
  authorId: varchar("author_id"),
  signoffRequestId: integer("signoff_request_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── RAG Change History ────────────────────────────────────────────────────────
export const strategyRagHistory = pgTable("strategy_rag_history", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  entityTitle: text("entity_title"),
  fromRag: text("from_rag"),
  toRag: text("to_rag").notNull(),
  changedByName: text("changed_by_name").notNull(),
  changedById: varchar("changed_by_id"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Ref Counters (per-tenant, per-layer sequential IDs) ──────────────────────
export const strategyRefCounters = pgTable("strategy_ref_counters", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  layer: text("layer").notNull(),
  lastSeq: integer("last_seq").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const strategyEntityRefs = pgTable("strategy_entity_refs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  refSeq: integer("ref_seq").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStrategyReviewNoteSchema = createInsertSchema(strategyReviewNotes).omit({ id: true, createdAt: true });
export const insertStrategyRagHistorySchema = createInsertSchema(strategyRagHistory).omit({ id: true, createdAt: true });
export const insertGovernanceItemSchema = createInsertSchema(governanceItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStrategyDocumentLinkSchema = createInsertSchema(strategyDocumentLinks).omit({ id: true, createdAt: true });
export const insertStrategyKpiValueSchema = createInsertSchema(strategyKpiValues).omit({ id: true, createdAt: true });

export type StrategyReviewNote = typeof strategyReviewNotes.$inferSelect;
export type InsertStrategyReviewNote = z.infer<typeof insertStrategyReviewNoteSchema>;
export type StrategyRagHistory = typeof strategyRagHistory.$inferSelect;
export type InsertStrategyRagHistory = z.infer<typeof insertStrategyRagHistorySchema>;
export type GovernanceItem = typeof governanceItems.$inferSelect;
export type InsertGovernanceItem = z.infer<typeof insertGovernanceItemSchema>;
export type StrategyDocumentLink = typeof strategyDocumentLinks.$inferSelect;
export type InsertStrategyDocumentLink = z.infer<typeof insertStrategyDocumentLinkSchema>;
export type StrategyKpiValue = typeof strategyKpiValues.$inferSelect;
export type InsertStrategyKpiValue = z.infer<typeof insertStrategyKpiValueSchema>;
export type StrategyRefCounter = typeof strategyRefCounters.$inferSelect;
export type StrategyEntityRef = typeof strategyEntityRefs.$inferSelect;

export const insertStrategyItemSchema = createInsertSchema(strategyItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRiskSchema = createInsertSchema(risks).omit({ id: true, createdAt: true });
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true });
export const insertProcessSchema = createInsertSchema(processes).omit({ id: true, createdAt: true });
export const insertToolSchema = createInsertSchema(tools).omit({ id: true, createdAt: true });
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertObjectiveSchema = createInsertSchema(objectives).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInitiativeSchema = createInsertSchema(initiatives).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOkrSchema = createInsertSchema(okrs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKeyResultSchema = createInsertSchema(keyResults).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKpiSchema = createInsertSchema(kpis).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBusinessTaskSchema = createInsertSchema(businessTasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true, createdAt: true });
export const insertDocumentLinkSchema = createInsertSchema(documentLinks).omit({ id: true, createdAt: true });

export type StrategyItem = typeof strategyItems.$inferSelect;
export type Risk = typeof risks.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Process = typeof processes.$inferSelect;
export type Tool = typeof tools.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Objective = typeof objectives.$inferSelect;
export type Initiative = typeof initiatives.$inferSelect;
export type Okr = typeof okrs.$inferSelect;
export type KeyResult = typeof keyResults.$inferSelect;
export type Kpi = typeof kpis.$inferSelect;
export type BusinessTask = typeof businessTasks.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type DocumentLink = typeof documentLinks.$inferSelect;

export type InsertStrategyItem = z.infer<typeof insertStrategyItemSchema>;
export type InsertRisk = z.infer<typeof insertRiskSchema>;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type InsertProcess = z.infer<typeof insertProcessSchema>;
export type InsertTool = z.infer<typeof insertToolSchema>;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type InsertObjective = z.infer<typeof insertObjectiveSchema>;
export type InsertInitiative = z.infer<typeof insertInitiativeSchema>;
export type InsertOkr = z.infer<typeof insertOkrSchema>;
export type InsertKeyResult = z.infer<typeof insertKeyResultSchema>;
export type InsertKpi = z.infer<typeof insertKpiSchema>;
export type InsertBusinessTask = z.infer<typeof insertBusinessTaskSchema>;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type InsertDocumentLink = z.infer<typeof insertDocumentLinkSchema>;

export type StrategyMapRow = {
  id: string;
  strategy: StrategyItem | null;
  goal: Goal | null;
  objective: Objective | null;
  initiative: Initiative | null;
  okr: Okr | null;
  kpi: Kpi | null;
  execution: BusinessTask | null;
};
