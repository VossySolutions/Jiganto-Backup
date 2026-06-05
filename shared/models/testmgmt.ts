import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { tenants } from "../schema";
import { users } from "./auth";

// ─── TM PROJECTS ─────────────────────────────────────────────────────────────
export const tmProjects = pgTable("tm_projects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"),       // active | archived | completed
  environment: text("environment"),               // e.g. "SIT, UAT, Regression"
  startDate: date("start_date"),
  endDate: date("end_date"),
  color: text("color").default("#6366f1"),        // accent color for project badge
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmProjectSchema = createInsertSchema(tmProjects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmProject = z.infer<typeof insertTmProjectSchema>;
export type TmProject = typeof tmProjects.$inferSelect;

// ─── TEST SUITES ─────────────────────────────────────────────────────────────
// Folders/groups that organise test cases (can be nested)
export const tmTestSuites = pgTable("tm_test_suites", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),           // phase 4: FK to pm_projects
  parentId: integer("parent_id"),             // self-ref nesting
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"),   // active | archived
  ownerId: varchar("owner_id"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmTestSuiteSchema = createInsertSchema(tmTestSuites).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmTestSuite = z.infer<typeof insertTmTestSuiteSchema>;
export type TmTestSuite = typeof tmTestSuites.$inferSelect;

// ─── TEST CASES ──────────────────────────────────────────────────────────────
export const tmTestCases = pgTable("tm_test_cases", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  suiteId: integer("suite_id"),               // FK to tmTestSuites
  title: text("title").notNull(),
  description: text("description"),
  preconditions: text("preconditions"),
  priority: text("priority").default("medium"),           // low | medium | high | critical
  status: text("status").default("draft"),                // draft | active | deprecated
  caseType: text("case_type").default("manual"),          // manual | automated
  automationStatus: text("automation_status").default("none"), // none | planned | automated
  tags: text("tags").array().default([]),
  ownerId: varchar("owner_id"),
  estimatedDuration: integer("estimated_duration"),       // minutes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmTestCaseSchema = createInsertSchema(tmTestCases).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmTestCase = z.infer<typeof insertTmTestCaseSchema>;
export type TmTestCase = typeof tmTestCases.$inferSelect;

// ─── TEST STEPS ──────────────────────────────────────────────────────────────
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

// ─── TEST RUNS ───────────────────────────────────────────────────────────────
export const tmTestRuns = pgTable("tm_test_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("planned"),  // planned | in_progress | completed | aborted
  startDate: date("start_date"),
  endDate: date("end_date"),
  assignedTo: varchar("assigned_to"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmTestRunSchema = createInsertSchema(tmTestRuns).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmTestRun = z.infer<typeof insertTmTestRunSchema>;
export type TmTestRun = typeof tmTestRuns.$inferSelect;

// ─── TEST RESULTS ────────────────────────────────────────────────────────────
// One row per test case per test run
export const tmTestResults = pgTable("tm_test_results", {
  id: serial("id").primaryKey(),
  testRunId: integer("test_run_id").notNull(),
  testCaseId: integer("test_case_id").notNull(),
  status: text("status").default("not_run"),  // not_run | pass | fail | blocked | skipped
  executedBy: varchar("executed_by"),
  executedAt: timestamp("executed_at"),
  comment: text("comment"),
  duration: integer("duration"),              // seconds
  stepResults: jsonb("step_results").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmTestResultSchema = createInsertSchema(tmTestResults).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmTestResult = z.infer<typeof insertTmTestResultSchema>;
export type TmTestResult = typeof tmTestResults.$inferSelect;

// ─── DEFECTS ─────────────────────────────────────────────────────────────────
export const tmDefects = pgTable("tm_defects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").default("medium"),   // low | medium | high | critical
  priority: text("priority").default("medium"),
  status: text("status").default("new"),           // new | open | in_progress | resolved | closed | wont_fix
  assignedTo: varchar("assigned_to"),
  testResultId: integer("test_result_id"),
  testCaseId: integer("test_case_id"),
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
  reqId: text("req_id").notNull(),            // e.g. REQ-FI-001
  title: text("title").notNull(),
  description: text("description"),
  functionalArea: text("functional_area"),    // e.g. "Finance", "Procurement"
  process: text("process"),                   // e.g. "Procure-to-Pay"
  linkedFeature: text("linked_feature"),      // e.g. "Accounts Payable Automation"
  priority: text("priority").default("medium"), // low | medium | high | critical | must
  status: text("status").default("active"),     // active | deprecated
  implementationStatus: text("implementation_status").default("draft"), // draft | in_progress | implemented | verified | deprecated
  source: text("source"),                       // e.g. "BRD v1.2"
  linkedCaseIds: integer("linked_case_ids").array().default([]),
  linkedDefectIds: integer("linked_defect_ids").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmRequirementSchema = createInsertSchema(tmRequirements).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmRequirement = z.infer<typeof insertTmRequirementSchema>;
export type TmRequirement = typeof tmRequirements.$inferSelect;

// ─── TEST SCENARIOS ───────────────────────────────────────────────────────────
// High-level business scenarios that group related test cases
export const tmScenarios = pgTable("tm_scenarios", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id"),
  scenarioId: text("scenario_id").notNull(),   // e.g. SCN-001
  title: text("title").notNull(),
  description: text("description"),
  functionalArea: text("functional_area"),     // e.g. "Finance", "Order Management"
  process: text("process"),                    // e.g. "Order-to-Cash"
  priority: text("priority").default("medium"), // low | medium | high | critical
  status: text("status").default("draft"),      // draft | active | completed | deprecated
  linkedCaseIds: integer("linked_case_ids").array().default([]),
  ownerId: varchar("owner_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTmScenarioSchema = createInsertSchema(tmScenarios).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTmScenario = z.infer<typeof insertTmScenarioSchema>;
export type TmScenario = typeof tmScenarios.$inferSelect;
