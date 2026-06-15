import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, date, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Constants ───────────────────────────────────────────────────────────────
export const TM_METHODOLOGIES = ["waterfall", "agile", "hybrid"] as const;
export const TM_TEST_PHASES = [
  "unit", "component", "integration", "system", "uat", "regression", "performance", "smoke", "other",
] as const;
export const TM_CYCLE_STATUSES = ["planning", "in_progress", "completed", "signed_off", "abandoned"] as const;
export const TM_EXECUTION_STATUSES = [
  "not_started", "in_progress", "pass", "fail", "blocked", "deferred", "not_applicable", "ready_for_retest",
] as const;
export const TM_TEST_TYPES = ["functional", "regression", "performance", "security", "smoke", "exploratory"] as const;
export const TM_SIGN_OFF_ENTITY_TYPES = ["scenario", "business_process", "business_area", "test_cycle"] as const;

// ─── TM PROJECTS ─────────────────────────────────────────────────────────────
export const tmProjects = pgTable("tm_projects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"),
  methodology: text("methodology").default("waterfall"),
  environment: text("environment"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  color: text("color").default("#6366f1"),
  activeCycleId: integer("active_cycle_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmProjectSchema = createInsertSchema(tmProjects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmProject = z.infer<typeof insertTmProjectSchema>;
export type TmProject = typeof tmProjects.$inferSelect;

// ─── BUSINESS AREAS / EPICS (Level 1) ────────────────────────────────────────
export const tmBusinessAreas = pgTable("tm_business_areas", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id"),
  signOffStatus: text("sign_off_status").default("not_signed_off"),
  signOffBy: varchar("sign_off_by"),
  signOffAt: timestamp("sign_off_at"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmBusinessAreaSchema = createInsertSchema(tmBusinessAreas).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmBusinessArea = z.infer<typeof insertTmBusinessAreaSchema>;
export type TmBusinessArea = typeof tmBusinessAreas.$inferSelect;

// ─── BUSINESS PROCESSES / FEATURES (Level 2) ─────────────────────────────────
export const tmBusinessProcesses = pgTable("tm_business_processes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  businessAreaId: integer("business_area_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id"),
  priority: text("priority").default("medium"),
  signOffStatus: text("sign_off_status").default("not_signed_off"),
  signOffBy: varchar("sign_off_by"),
  signOffAt: timestamp("sign_off_at"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmBusinessProcessSchema = createInsertSchema(tmBusinessProcesses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmBusinessProcess = z.infer<typeof insertTmBusinessProcessSchema>;
export type TmBusinessProcess = typeof tmBusinessProcesses.$inferSelect;

// ─── TEST SUITES (legacy folder org — kept for import/navigator) ─────────────
export const tmTestSuites = pgTable("tm_test_suites", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"),
  ownerId: varchar("owner_id"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmTestSuiteSchema = createInsertSchema(tmTestSuites).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmTestSuite = z.infer<typeof insertTmTestSuiteSchema>;
export type TmTestSuite = typeof tmTestSuites.$inferSelect;

// ─── SCENARIOS / USER STORIES (Level 3) ────────────────────────────────────
export const tmScenarios = pgTable("tm_scenarios", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  businessProcessId: integer("business_process_id"),
  scenarioId: text("scenario_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  functionalArea: text("functional_area"),
  process: text("process"),
  priority: text("priority").default("medium"),
  status: text("status").default("draft"),
  testDataNotes: text("test_data_notes"),
  linkedDocumentId: integer("linked_document_id"),
  linkedCaseIds: integer("linked_case_ids").array().default([]),
  ownerId: varchar("owner_id"),
  signOffStatus: text("sign_off_status").default("not_signed_off"),
  signOffBy: varchar("sign_off_by"),
  signOffAt: timestamp("sign_off_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmScenarioSchema = createInsertSchema(tmScenarios).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmScenario = z.infer<typeof insertTmScenarioSchema>;
export type TmScenario = typeof tmScenarios.$inferSelect;

// ─── TEST CASES (Level 4) ───────────────────────────────────────────────────
export const tmTestCases = pgTable("tm_test_cases", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  scenarioId: integer("scenario_id"),
  suiteId: integer("suite_id"),
  title: text("title").notNull(),
  description: text("description"),
  preconditions: text("preconditions"),
  testData: text("test_data"),
  testType: text("test_type").default("functional"),
  priority: text("priority").default("medium"),
  status: text("status").default("draft"),
  caseType: text("case_type").default("manual"),
  automationStatus: text("automation_status").default("none"),
  tags: text("tags").array().default([]),
  ownerId: varchar("owner_id"),
  createdBy: varchar("created_by"),
  linkedAcceptanceCriterionId: integer("linked_acceptance_criterion_id"),
  estimatedDuration: integer("estimated_duration"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmTestCaseSchema = createInsertSchema(tmTestCases).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmTestCase = z.infer<typeof insertTmTestCaseSchema>;
export type TmTestCase = typeof tmTestCases.$inferSelect;

// ─── TEST STEPS (Level 5) ────────────────────────────────────────────────────
export const tmTestSteps = pgTable("tm_test_steps", {
  id: serial("id").primaryKey(),
  testCaseId: integer("test_case_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  action: text("action").notNull(),
  expectedResult: text("expected_result"),
  testData: text("test_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTmTestStepSchema = createInsertSchema(tmTestSteps).omit({ id: true, createdAt: true });
export type InsertTmTestStep = z.infer<typeof insertTmTestStepSchema>;
export type TmTestStep = typeof tmTestSteps.$inferSelect;

// ─── TEST CYCLES (organising envelope — table name kept as tm_test_runs) ─────
export const tmTestRuns = pgTable("tm_test_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  name: text("name").notNull(),
  description: text("description"),
  testPhase: text("test_phase").default("uat"),
  methodology: text("methodology").default("waterfall"),
  status: text("status").default("planning"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  testManagerId: varchar("test_manager_id"),
  buildVersion: text("build_version"),
  notes: text("notes"),
  assignedTo: varchar("assigned_to"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmTestRunSchema = createInsertSchema(tmTestRuns).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmTestRun = z.infer<typeof insertTmTestRunSchema>;
export type TmTestRun = typeof tmTestRuns.$inferSelect;
export type TmTestCycle = TmTestRun;

// ─── EXECUTIONS (one per test case per cycle) ─────────────────────────────────
export const tmTestResults = pgTable("tm_test_results", {
  id: serial("id").primaryKey(),
  testRunId: integer("test_run_id").notNull(),
  testCaseId: integer("test_case_id").notNull(),
  status: text("status").default("not_started"),
  executedBy: varchar("executed_by"),
  executedAt: timestamp("executed_at"),
  actualResult: text("actual_result"),
  blockedReason: text("blocked_reason"),
  comment: text("comment"),
  notes: text("notes"),
  duration: integer("duration"),
  stepResults: jsonb("step_results").default([]),
  evidence: jsonb("evidence").default([]),
  defectRefId: integer("defect_ref_id"),
  retestOfId: integer("retest_of_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmTestResultSchema = createInsertSchema(tmTestResults).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmTestResult = z.infer<typeof insertTmTestResultSchema>;
export type TmTestResult = typeof tmTestResults.$inferSelect;
export type TmExecution = TmTestResult;

// ─── SIGN-OFFS ───────────────────────────────────────────────────────────────
export const tmSignOffs = pgTable("tm_sign_offs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  testCycleId: integer("test_cycle_id"),
  signedOffBy: varchar("signed_off_by").notNull(),
  signedOffAt: timestamp("signed_off_at").defaultNow(),
  passRateAtSignOff: real("pass_rate_at_sign_off"),
  notes: text("notes"),
  isConditional: boolean("is_conditional").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTmSignOffSchema = createInsertSchema(tmSignOffs).omit({ id: true, createdAt: true });
export type InsertTmSignOff = z.infer<typeof insertTmSignOffSchema>;
export type TmSignOff = typeof tmSignOffs.$inferSelect;

// ─── DEFECTS (legacy local table — Help Desk is primary) ─────────────────────
export const tmDefects = pgTable("tm_defects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").default("medium"),
  priority: text("priority").default("medium"),
  status: text("status").default("new"),
  assignedTo: varchar("assigned_to"),
  testResultId: integer("test_result_id"),
  testCaseId: integer("test_case_id"),
  helpDeskTicketId: integer("help_desk_ticket_id"),
  reportedBy: varchar("reported_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmDefectSchema = createInsertSchema(tmDefects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmDefect = z.infer<typeof insertTmDefectSchema>;
export type TmDefect = typeof tmDefects.$inferSelect;

// ─── REQUIREMENTS (RTM) ───────────────────────────────────────────────────────
export const tmRequirements = pgTable("tm_requirements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  reqId: text("req_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  functionalArea: text("functional_area"),
  process: text("process"),
  linkedFeature: text("linked_feature"),
  priority: text("priority").default("medium"),
  status: text("status").default("active"),
  implementationStatus: text("implementation_status").default("draft"),
  source: text("source"),
  linkedCaseIds: integer("linked_case_ids").array().default([]),
  linkedDefectIds: integer("linked_defect_ids").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmRequirementSchema = createInsertSchema(tmRequirements).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmRequirement = z.infer<typeof insertTmRequirementSchema>;
export type TmRequirement = typeof tmRequirements.$inferSelect;
