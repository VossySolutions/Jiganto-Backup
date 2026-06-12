import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, date, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants } from "../schema";
import { initiatives } from "./business";

// Enums for Projects Module
export const pmMethodologyEnum = ["waterfall", "agile", "hybrid"] as const;
export const pmProjectTypeEnum = ["simple_board", "business_initiative", "small_project", "large_project"] as const;
export const pmProjectStatusEnum = ["draft", "planning", "active", "on_hold", "completed", "cancelled"] as const;

export const pmWorkTypeEnum = [
  "project", "programme", "initiative", "campaign", "poc", "user_defined",
  "portfolio", "sub_project", "program_increment", "workstream", "task_force",
  "change_request", "enhancement", "experiment", "pilot", "prototype", "sprint", "improvement"
] as const;

export const pmToolTypeEnum = [
  "gantt_chart", "milestone_plan", "scrum_board", "kanban_board", "epics_stories", "wbs",
  "status_reporting", "project_dashboard", "360_report",
  "risk_log", "issues_log", "assumptions_log", "dependencies_log", "decisions_log", "change_log", "raci_model",
  "resource_tracker", "timesheets", "finance_tracker", "sow_tracker",
  "documentation", "deliverables_tracker", "test_tracker",
  "org_chart", "stakeholder_map", "business_process_model"
] as const;

export const pmToolCategoryEnum = [
  "planning_scheduling", "reporting_dashboards", "raid_governance",
  "resources_finance", "documentation_delivery", "people_organisation"
] as const;
export const pmPhaseMethodologyEnum = ["waterfall", "agile"] as const;
export const pmPhaseStatusEnum = ["not_started", "in_progress", "completed", "on_hold"] as const;
export const pmMilestoneStatusEnum = ["pending", "in_progress", "completed", "missed"] as const;
export const pmTaskStatusEnum = ["todo", "in_progress", "in_review", "done", "blocked"] as const;
export const pmRaiddTypeEnum = ["risk", "assumption", "issue", "dependency", "decision"] as const;
export const pmRaiddStatusEnum = ["open", "in_progress", "resolved", "closed", "escalated"] as const;
export const pmRaiddPriorityEnum = ["low", "medium", "high", "critical"] as const;
export const pmSprintStatusEnum = ["planning", "active", "completed", "cancelled"] as const;
export const pmBacklogItemTypeEnum = ["user_story", "bug", "task", "epic", "feature", "improvement"] as const;
export const pmBacklogItemStatusEnum = ["backlog", "ready", "in_sprint", "in_progress", "in_review", "done", "blocked"] as const;

// Portfolios - Top level container for programs and projects
export const pmPortfolios = pgTable("pm_portfolios", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  status: text("status").default("active"),
  ragStatus: text("rag_status").default("green"),
  budget: decimal("budget"),
  spentBudget: decimal("spent_budget").default("0"),
  colour: text("colour").default("#7C3AED"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Many-to-many: projects can belong to multiple portfolios (spec §2). */
export const pmProjectPortfolios = pgTable("pm_project_portfolios", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").notNull().references(() => pmPortfolios.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pmProjectPortfoliosRelations = relations(pmProjectPortfolios, ({ one }) => ({
  project: one(pmProjects, { fields: [pmProjectPortfolios.projectId], references: [pmProjects.id] }),
  portfolio: one(pmPortfolios, { fields: [pmProjectPortfolios.portfolioId], references: [pmPortfolios.id] }),
}));

export const pmPortfoliosRelations = relations(pmPortfolios, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pmPortfolios.tenantId],
    references: [tenants.id],
  }),
  owner: one(users, {
    fields: [pmPortfolios.ownerId],
    references: [users.id],
  }),
  programs: many(pmPrograms),
  projects: many(pmProjects),
  projectLinks: many(pmProjectPortfolios),
}));

// Programs - Container for related projects within a portfolio
export const pmPrograms = pgTable("pm_programs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  portfolioId: integer("portfolio_id").references(() => pmPortfolios.id),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  status: text("status").default("active"),
  ragStatus: text("rag_status").default("green"),
  budget: decimal("budget"),
  spentBudget: decimal("spent_budget").default("0"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmProgramsRelations = relations(pmPrograms, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pmPrograms.tenantId],
    references: [tenants.id],
  }),
  portfolio: one(pmPortfolios, {
    fields: [pmPrograms.portfolioId],
    references: [pmPortfolios.id],
  }),
  owner: one(users, {
    fields: [pmPrograms.ownerId],
    references: [users.id],
  }),
  projects: many(pmProjects),
}));

// Projects - The main project entity with support for different types and methodologies
export const pmProjects = pgTable("pm_projects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  portfolioId: integer("portfolio_id").references(() => pmPortfolios.id),
  programId: integer("program_id").references(() => pmPrograms.id),
  initiativeId: integer("initiative_id").references(() => initiatives.id),
  parentProjectId: integer("parent_project_id"),
  code: text("code"),
  name: text("name").notNull(),
  shortName: text("short_name"),
  description: text("description"),
  projectType: text("project_type").default("small_project"),
  methodology: text("methodology").default("hybrid"),
  ownerId: varchar("owner_id").references(() => users.id),
  managerId: varchar("manager_id").references(() => users.id),
  status: text("status").default("draft"),
  ragStatus: text("rag_status").default("green"),
  priority: text("priority").default("medium"),
  progress: integer("progress").default(0),
  budget: decimal("budget"),
  spentBudget: decimal("spent_budget").default("0"),
  forecastBudget: decimal("forecast_budget"),
  financialRag: text("financial_rag").default("green"),
  fundingSource: text("funding_source"),
  estimatedHours: decimal("estimated_hours"),
  actualHours: decimal("actual_hours").default("0"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  baselineEndDate: date("baseline_end_date"),
  actualStartDate: date("actual_start_date"),
  actualEndDate: date("actual_end_date"),
  scheduleRag: text("schedule_rag").default("green"),
  sprintCadence: text("sprint_cadence"),
  riskScore: integer("risk_score").default(0),
  enableRisks: boolean("enable_risks").default(true),
  enableAssumptions: boolean("enable_assumptions").default(true),
  enableIssues: boolean("enable_issues").default(true),
  enableDependencies: boolean("enable_dependencies").default(true),
  enableDecisions: boolean("enable_decisions").default(true),
  workType: text("work_type").default("project"),
  customer: text("customer"),
  framework: text("framework"),
  tags: text("tags").array(),
  executiveSponsor: text("executive_sponsor"),
  projectManager: text("project_manager"),
  businessOwner: text("business_owner"),
  deliveryOwner: text("delivery_owner"),
  department: text("department"),
  steeringCommitteeRequired: boolean("steering_committee_required").default(false),
  governanceTier: text("governance_tier"),
  strategicObjective: text("strategic_objective"),
  benefitCategory: text("benefit_category"),
  regulatoryDriver: boolean("regulatory_driver").default(false),
  transformationTheme: text("transformation_theme"),
  complexityLevel: text("complexity_level").default("medium"),
  crossFunctional: boolean("cross_functional").default(false),
  contractType: text("contract_type"),
  sowSigned: boolean("sow_signed").default(false),
  metadata: jsonb("metadata"),
  clientId: integer("client_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmProjectsRelations = relations(pmProjects, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pmProjects.tenantId],
    references: [tenants.id],
  }),
  portfolio: one(pmPortfolios, {
    fields: [pmProjects.portfolioId],
    references: [pmPortfolios.id],
  }),
  program: one(pmPrograms, {
    fields: [pmProjects.programId],
    references: [pmPrograms.id],
  }),
  initiative: one(initiatives, {
    fields: [pmProjects.initiativeId],
    references: [initiatives.id],
  }),
  owner: one(users, {
    fields: [pmProjects.ownerId],
    references: [users.id],
  }),
  manager: one(users, {
    fields: [pmProjects.managerId],
    references: [users.id],
  }),
  phases: many(pmProjectPhases),
  milestones: many(pmMilestones),
  tasks: many(pmTasks),
  members: many(pmTeamMembers),
  raiddItems: many(pmRaiddItems),
  tools: many(pmProjectTools),
}));

export const pmProjectTools = pgTable("pm_project_tools", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  toolType: text("tool_type").notNull(),
  toolCategory: text("tool_category").notNull(),
  label: text("label"),
  isEnabled: boolean("is_enabled").default(true),
  sortOrder: integer("sort_order").default(0),
  config: jsonb("config"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pmProjectToolsRelations = relations(pmProjectTools, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmProjectTools.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmProjectTools.projectId],
    references: [pmProjects.id],
  }),
}));

// Project Phases - Wagile support with methodology per phase
export const pmProjectPhases = pgTable("pm_project_phases", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  phaseNumber: integer("phase_number").notNull(),
  methodology: text("methodology").default("waterfall"),
  status: text("status").default("not_started"),
  ragStatus: text("rag_status").default("green"),
  progress: integer("progress").default(0),
  plannedStartDate: date("planned_start_date"),
  plannedEndDate: date("planned_end_date"),
  actualStartDate: date("actual_start_date"),
  actualEndDate: date("actual_end_date"),
  estimatedHours: decimal("estimated_hours"),
  actualHours: decimal("actual_hours").default("0"),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmProjectPhasesRelations = relations(pmProjectPhases, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pmProjectPhases.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmProjectPhases.projectId],
    references: [pmProjects.id],
  }),
  tasks: many(pmTasks),
  milestones: many(pmMilestones),
}));

// Project Milestones
export const pmMilestones = pgTable("pm_milestones", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").references(() => pmProjects.id, { onDelete: "cascade" }),
  phaseId: integer("phase_id").references(() => pmProjectPhases.id),
  ref: text("ref"),
  name: text("name").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  completedDate: date("completed_date"),
  status: text("status").default("pending"),
  isCritical: boolean("is_critical").default(false),
  ownerId: varchar("owner_id").references(() => users.id),
  order: integer("order").default(0),
  projectName: text("project_name"),
  phase: text("phase"),
  workstream: text("workstream"),
  ragStatus: text("rag_status").default("Green"),
  commentary: text("commentary"),
  targetDate: date("target_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmMilestonesRelations = relations(pmMilestones, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmMilestones.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmMilestones.projectId],
    references: [pmProjects.id],
  }),
  phase: one(pmProjectPhases, {
    fields: [pmMilestones.phaseId],
    references: [pmProjectPhases.id],
  }),
  owner: one(users, {
    fields: [pmMilestones.ownerId],
    references: [users.id],
  }),
}));

// Project Tasks - For Gantt charts and task management
export const pmTasks = pgTable("pm_tasks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  phaseId: integer("phase_id").references(() => pmProjectPhases.id),
  milestoneId: integer("milestone_id").references(() => pmMilestones.id),
  parentTaskId: integer("parent_task_id"),
  name: text("name").notNull(),
  description: text("description"),
  assigneeId: varchar("assignee_id").references(() => users.id),
  status: text("status").default("todo"),
  priority: text("priority").default("medium"),
  progress: integer("progress").default(0),
  estimatedHours: decimal("estimated_hours"),
  actualHours: decimal("actual_hours").default("0"),
  plannedStartDate: date("planned_start_date"),
  plannedEndDate: date("planned_end_date"),
  actualStartDate: date("actual_start_date"),
  actualEndDate: date("actual_end_date"),
  predecessorIds: integer("predecessor_ids").array(),
  successorIds: integer("successor_ids").array(),
  isSummary: boolean("is_summary").default(false),
  ganttType: text("gantt_type").default("task"),
  wbsCode: text("wbs_code"),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmTasksRelations = relations(pmTasks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmTasks.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmTasks.projectId],
    references: [pmProjects.id],
  }),
  phase: one(pmProjectPhases, {
    fields: [pmTasks.phaseId],
    references: [pmProjectPhases.id],
  }),
  milestone: one(pmMilestones, {
    fields: [pmTasks.milestoneId],
    references: [pmMilestones.id],
  }),
  assignee: one(users, {
    fields: [pmTasks.assigneeId],
    references: [users.id],
  }),
}));

// Project Team Members
export const pmTeamMembers = pgTable("pm_team_members", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").default("team_member"),
  allocation: integer("allocation").default(100),
  startDate: date("start_date"),
  endDate: date("end_date"),
  hourlyRate: decimal("hourly_rate"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pmTeamMembersRelations = relations(pmTeamMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmTeamMembers.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmTeamMembers.projectId],
    references: [pmProjects.id],
  }),
  user: one(users, {
    fields: [pmTeamMembers.userId],
    references: [users.id],
  }),
}));

// RAIDD Items - Risks, Assumptions, Issues, Dependencies, Decisions
export const pmRaiddItems = pgTable("pm_raidd_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  code: text("code"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("open"),
  priority: text("priority").default("medium"),
  category: text("category"),
  workstream: text("workstream"),
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name"),
  assigneeId: varchar("assignee_id").references(() => users.id),
  dueDate: date("due_date"),
  resolvedDate: date("resolved_date"),
  impact: text("impact"),
  likelihood: text("likelihood"),
  score: integer("score"),
  mitigation: text("mitigation"),
  contingency: text("contingency"),
  response: text("response"),
  basis: text("basis"),
  validationMethod: text("validation_method"),
  validationDueDate: date("validation_due_date"),
  timelineImpact: text("timeline_impact"),
  issueType: text("issue_type"),
  resolution: text("resolution"),
  resolutionTarget: text("resolution_target"),
  dependentOn: text("dependent_on"),
  requiredByDate: date("required_by_date"),
  providerConfirmed: boolean("provider_confirmed").default(false),
  decisionBody: text("decision_body"),
  decisionDate: text("decision_date"),
  rationale: text("rationale"),
  escalated: boolean("escalated").default(false),
  escalationLevel: text("escalation_level"),
  escalationTo: text("escalation_to"),
  escalationReason: text("escalation_reason"),
  escalationResponse: text("escalation_response"),
  escalationDays: integer("escalation_days"),
  archived: boolean("archived").default(false),
  closed: boolean("closed").default(false),
  linkedItemId: integer("linked_item_id"),
  linkedItemType: text("linked_item_type"),
  linkedItems: jsonb("linked_items").$type<Array<{id: string; label: string}>>(),
  activityLog: jsonb("activity_log").$type<Array<{dot: string; text: string; time: string; type: string}>>(),
  tags: text("tags").array(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmRaiddItemsRelations = relations(pmRaiddItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmRaiddItems.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmRaiddItems.projectId],
    references: [pmProjects.id],
  }),
  owner: one(users, {
    fields: [pmRaiddItems.ownerId],
    references: [users.id],
  }),
  assignee: one(users, {
    fields: [pmRaiddItems.assigneeId],
    references: [users.id],
  }),
}));

// Business Requirements - formal requirements for project scope
export const pmBusinessRequirementStatusEnum = ["draft", "in_review", "approved", "rejected", "deferred"] as const;
export const pmBusinessRequirementPriorityEnum = ["low", "medium", "high", "critical"] as const;
export const pmBusinessRequirementCategoryEnum = ["functional", "non_functional", "security", "usability", "performance", "integration", "compliance", "other"] as const;

export const pmBusinessRequirements = pgTable("pm_business_requirements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  code: text("code"),
  title: text("title").notNull(),
  description: text("description"),
  acceptanceCriteria: text("acceptance_criteria"),
  status: text("status").default("draft"),
  priority: text("priority").default("medium"),
  category: text("category").default("functional"),
  ownerId: varchar("owner_id").references(() => users.id),
  reviewerId: varchar("reviewer_id").references(() => users.id),
  approvedDate: date("approved_date"),
  version: integer("version").default(1),
  parentRequirementId: integer("parent_requirement_id"),
  linkedUserStoryIds: integer("linked_user_story_ids").array(),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmBusinessRequirementsRelations = relations(pmBusinessRequirements, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmBusinessRequirements.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmBusinessRequirements.projectId],
    references: [pmProjects.id],
  }),
  owner: one(users, {
    fields: [pmBusinessRequirements.ownerId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [pmBusinessRequirements.reviewerId],
    references: [users.id],
  }),
}));

export const insertPmBusinessRequirementSchema = createInsertSchema(pmBusinessRequirements).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertPmBusinessRequirement = z.infer<typeof insertPmBusinessRequirementSchema>;
export type PmBusinessRequirement = typeof pmBusinessRequirements.$inferSelect;

// Phase Templates for common project structures
export const pmPhaseTemplates = pgTable("pm_phase_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  methodology: text("methodology").default("hybrid"),
  phases: jsonb("phases").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pmPhaseTemplatesRelations = relations(pmPhaseTemplates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmPhaseTemplates.tenantId],
    references: [tenants.id],
  }),
}));

// Workstreams - For organizing work within phases (WBS)
// Workstream types for hierarchy: workstream → activity → sub-activity
export const pmWorkstreamTypeEnum = ["workstream", "activity", "sub_activity"] as const;

export const pmWorkstreams = pgTable("pm_workstreams", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  phaseId: integer("phase_id").references(() => pmProjectPhases.id),
  parentWorkstreamId: integer("parent_workstream_id"),
  type: text("type").default("workstream"), // workstream, activity, sub_activity
  name: text("name").notNull(),
  description: text("description"),
  wbsCode: text("wbs_code"),
  ownerId: varchar("owner_id").references(() => users.id),
  status: text("status").default("not_started"),
  ragStatus: text("rag_status").default("green"),
  progress: integer("progress").default(0),
  estimatedHours: decimal("estimated_hours"),
  actualHours: decimal("actual_hours").default("0"),
  plannedStartDate: date("planned_start_date"),
  plannedEndDate: date("planned_end_date"),
  actualStartDate: date("actual_start_date"),
  actualEndDate: date("actual_end_date"),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmWorkstreamsRelations = relations(pmWorkstreams, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pmWorkstreams.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmWorkstreams.projectId],
    references: [pmProjects.id],
  }),
  phase: one(pmProjectPhases, {
    fields: [pmWorkstreams.phaseId],
    references: [pmProjectPhases.id],
  }),
  owner: one(users, {
    fields: [pmWorkstreams.ownerId],
    references: [users.id],
  }),
  tasks: many(pmTasks),
}));

// Sprints - For Agile/Scrum methodology
export const pmSprints = pgTable("pm_sprints", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  phaseId: integer("phase_id").references(() => pmProjectPhases.id),
  name: text("name").notNull(),
  sprintNumber: integer("sprint_number").notNull(),
  goal: text("goal"),
  status: text("status").default("planning"),
  durationDays: integer("duration_days").default(14),
  startDate: date("start_date"),
  endDate: date("end_date"),
  plannedCapacity: decimal("planned_capacity"),
  totalPoints: integer("total_points").default(0),
  completedPoints: integer("completed_points").default(0),
  velocity: decimal("velocity"),
  scrumMasterId: varchar("scrum_master_id").references(() => users.id),
  retrospectiveNotes: text("retrospective_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmSprintsRelations = relations(pmSprints, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pmSprints.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmSprints.projectId],
    references: [pmProjects.id],
  }),
  phase: one(pmProjectPhases, {
    fields: [pmSprints.phaseId],
    references: [pmProjectPhases.id],
  }),
  scrumMaster: one(users, {
    fields: [pmSprints.scrumMasterId],
    references: [users.id],
  }),
  backlogItems: many(pmBacklogItems),
}));

// Backlog Items - User stories, bugs, tasks for Scrum
export const pmBacklogItems = pgTable("pm_backlog_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  sprintId: integer("sprint_id").references(() => pmSprints.id),
  parentItemId: integer("parent_item_id"),
  epicId: integer("epic_id"),
  code: text("code"),
  title: text("title").notNull(),
  description: text("description"),
  acceptanceCriteria: text("acceptance_criteria"),
  itemType: text("item_type").default("user_story"),
  status: text("status").default("backlog"),
  priority: text("priority").default("medium"),
  storyPoints: integer("story_points"),
  estimatedHours: decimal("estimated_hours"),
  actualHours: decimal("actual_hours").default("0"),
  assigneeId: varchar("assignee_id").references(() => users.id),
  reporterId: varchar("reporter_id").references(() => users.id),
  labels: text("labels").array(),
  dueDate: date("due_date"),
  completedDate: date("completed_date"),
  backlogOrder: integer("backlog_order").default(0),
  sprintOrder: integer("sprint_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmBacklogItemsRelations = relations(pmBacklogItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmBacklogItems.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmBacklogItems.projectId],
    references: [pmProjects.id],
  }),
  sprint: one(pmSprints, {
    fields: [pmBacklogItems.sprintId],
    references: [pmSprints.id],
  }),
  assignee: one(users, {
    fields: [pmBacklogItems.assigneeId],
    references: [users.id],
  }),
  reporter: one(users, {
    fields: [pmBacklogItems.reporterId],
    references: [users.id],
  }),
}));

// ============================================
// RACI MODULE TABLES
// ============================================

// RACI Role Categories
export const pmRaciRoleCategoryEnum = ["business", "it", "vendor", "change_pmo"] as const;
export const pmRaciActivityTypeEnum = ["phase", "task", "deliverable"] as const;
export const pmRaciTemplateStatusEnum = ["draft", "reviewed", "approved", "active", "archived"] as const;

// RACI Roles - Define who can appear in the RACI matrix
export const pmRaciRoles = pgTable("pm_raci_roles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").references(() => pmProjects.id),
  templateId: integer("template_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("business"),
  workstreamId: integer("workstream_id").references(() => pmWorkstreams.id),
  module: text("module"),
  defaultRaciType: text("default_raci_type"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// RACI Activities - Define what the RACI applies to
export const pmRaciActivities = pgTable("pm_raci_activities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").references(() => pmProjects.id),
  templateId: integer("template_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  activityType: text("activity_type").default("task"),
  phaseId: integer("phase_id").references(() => pmProjectPhases.id),
  workstreamId: integer("workstream_id").references(() => pmWorkstreams.id),
  parentActivityId: integer("parent_activity_id"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// RACI Types - Define how responsibility is expressed (R, A, C, I, custom)
export const pmRaciTypes = pgTable("pm_raci_types", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6366f1"),
  sortOrder: integer("sort_order").default(0),
  isDefault: boolean("is_default").default(false),
  allowMultiple: boolean("allow_multiple").default(true),
  isRequired: boolean("is_required").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// RACI Assignments - The actual RACI matrix (activity × role = type)
export const pmRaciAssignments = pgTable("pm_raci_assignments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").references(() => pmProjects.id),
  templateId: integer("template_id"),
  activityId: integer("activity_id").notNull().references(() => pmRaciActivities.id),
  roleId: integer("role_id").notNull().references(() => pmRaciRoles.id),
  raciTypeId: integer("raci_type_id").notNull().references(() => pmRaciTypes.id),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// RACI Templates - Reusable RACI configurations
export const pmRaciTemplates = pgTable("pm_raci_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  templateType: text("template_type").default("project"),
  methodology: text("methodology"),
  version: text("version").default("1.0"),
  status: text("status").default("draft"),
  isGlobal: boolean("is_global").default(false),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// RACI Relations
export const pmRaciRolesRelations = relations(pmRaciRoles, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmRaciRoles.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmRaciRoles.projectId],
    references: [pmProjects.id],
  }),
  workstream: one(pmWorkstreams, {
    fields: [pmRaciRoles.workstreamId],
    references: [pmWorkstreams.id],
  }),
}));

export const pmRaciActivitiesRelations = relations(pmRaciActivities, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmRaciActivities.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmRaciActivities.projectId],
    references: [pmProjects.id],
  }),
  phase: one(pmProjectPhases, {
    fields: [pmRaciActivities.phaseId],
    references: [pmProjectPhases.id],
  }),
  workstream: one(pmWorkstreams, {
    fields: [pmRaciActivities.workstreamId],
    references: [pmWorkstreams.id],
  }),
}));

export const pmRaciTypesRelations = relations(pmRaciTypes, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmRaciTypes.tenantId],
    references: [tenants.id],
  }),
}));

export const pmRaciAssignmentsRelations = relations(pmRaciAssignments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmRaciAssignments.tenantId],
    references: [tenants.id],
  }),
  project: one(pmProjects, {
    fields: [pmRaciAssignments.projectId],
    references: [pmProjects.id],
  }),
  activity: one(pmRaciActivities, {
    fields: [pmRaciAssignments.activityId],
    references: [pmRaciActivities.id],
  }),
  role: one(pmRaciRoles, {
    fields: [pmRaciAssignments.roleId],
    references: [pmRaciRoles.id],
  }),
  raciType: one(pmRaciTypes, {
    fields: [pmRaciAssignments.raciTypeId],
    references: [pmRaciTypes.id],
  }),
  creator: one(users, {
    fields: [pmRaciAssignments.createdBy],
    references: [users.id],
  }),
}));

export const pmRaciTemplatesRelations = relations(pmRaciTemplates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pmRaciTemplates.tenantId],
    references: [tenants.id],
  }),
  approver: one(users, {
    fields: [pmRaciTemplates.approvedBy],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [pmRaciTemplates.createdBy],
    references: [users.id],
  }),
}));

// ============================================================
// AGILE BOARD TABLES
// ============================================================

// Agile Workstreams — flat delivery lanes (Order to Cash, P2P, etc.) distinct from WBS workstreams
export const pmAgileWorkstreams = pgTable("pm_agile_workstreams", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#2563EB"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmAgileWorkstreamsRelations = relations(pmAgileWorkstreams, ({ one, many }) => ({
  project: one(pmProjects, { fields: [pmAgileWorkstreams.projectId], references: [pmProjects.id] }),
  tenant: one(tenants, { fields: [pmAgileWorkstreams.tenantId], references: [tenants.id] }),
  epics: many(pmEpics),
  sprints: many(pmAgileSprints),
  stories: many(pmAgileStories),
  defects: many(pmAgileDefects),
}));

// Epics — large work items within an Agile Workstream
export const pmEpics = pgTable("pm_epics", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  agileWorkstreamId: integer("agile_workstream_id").references(() => pmAgileWorkstreams.id, { onDelete: "cascade" }),
  code: text("code"),
  title: text("title").notNull(),
  description: text("description"),
  initiative: text("initiative"),
  status: text("status").default("planning"),
  priority: text("priority").default("medium"),
  tshirt: text("tshirt").default("M"),
  color: text("color").default("#2563EB"),
  owner: text("owner"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  progress: integer("progress").default(0),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmEpicsRelations = relations(pmEpics, ({ one, many }) => ({
  project: one(pmProjects, { fields: [pmEpics.projectId], references: [pmProjects.id] }),
  agileWorkstream: one(pmAgileWorkstreams, { fields: [pmEpics.agileWorkstreamId], references: [pmAgileWorkstreams.id] }),
  tenant: one(tenants, { fields: [pmEpics.tenantId], references: [tenants.id] }),
  stories: many(pmAgileStories),
}));

// Agile Sprints — time-boxed iterations per workstream
export const pmAgileSprints = pgTable("pm_agile_sprints", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  agileWorkstreamId: integer("agile_workstream_id").references(() => pmAgileWorkstreams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  goal: text("goal"),
  status: text("status").default("Planned"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  totalPoints: integer("total_points").default(0),
  donePoints: integer("done_points").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmAgileSprintsRelations = relations(pmAgileSprints, ({ one, many }) => ({
  project: one(pmProjects, { fields: [pmAgileSprints.projectId], references: [pmProjects.id] }),
  agileWorkstream: one(pmAgileWorkstreams, { fields: [pmAgileSprints.agileWorkstreamId], references: [pmAgileWorkstreams.id] }),
  tenant: one(tenants, { fields: [pmAgileSprints.tenantId], references: [tenants.id] }),
  stories: many(pmAgileStories),
}));

// Agile Stories — user stories linked to epics and sprints
export const pmAgileStories = pgTable("pm_agile_stories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  agileWorkstreamId: integer("agile_workstream_id").references(() => pmAgileWorkstreams.id, { onDelete: "cascade" }),
  epicId: integer("epic_id").references(() => pmEpics.id, { onDelete: "set null" }),
  sprintId: integer("sprint_id").references(() => pmAgileSprints.id, { onDelete: "set null" }),
  sprintName: text("sprint_name"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("Backlog"),
  priority: text("priority").default("Medium"),
  points: integer("points"),
  tshirt: text("tshirt").default("M"),
  assignee: text("assignee"),
  creator: text("creator"),
  tags: text("tags").array(),
  acceptanceCriteria: text("acceptance_criteria").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmAgileStoriesRelations = relations(pmAgileStories, ({ one }) => ({
  project: one(pmProjects, { fields: [pmAgileStories.projectId], references: [pmProjects.id] }),
  agileWorkstream: one(pmAgileWorkstreams, { fields: [pmAgileStories.agileWorkstreamId], references: [pmAgileWorkstreams.id] }),
  epic: one(pmEpics, { fields: [pmAgileStories.epicId], references: [pmEpics.id] }),
  sprint: one(pmAgileSprints, { fields: [pmAgileStories.sprintId], references: [pmAgileSprints.id] }),
  tenant: one(tenants, { fields: [pmAgileStories.tenantId], references: [tenants.id] }),
}));

// Agile Defects — bugs linked to stories and workstreams
export const pmAgileDefects = pgTable("pm_agile_defects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  agileWorkstreamId: integer("agile_workstream_id").references(() => pmAgileWorkstreams.id, { onDelete: "cascade" }),
  storyId: integer("story_id").references(() => pmAgileStories.id, { onDelete: "set null" }),
  sprintId: integer("sprint_id").references(() => pmAgileSprints.id, { onDelete: "set null" }),
  code: text("code"),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").default("Minor"),
  priority: text("priority").default("Medium"),
  status: text("status").default("New"),
  assignee: text("assignee"),
  reporter: text("reporter"),
  environment: text("environment").default("Dev"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmAgileDefectsRelations = relations(pmAgileDefects, ({ one }) => ({
  project: one(pmProjects, { fields: [pmAgileDefects.projectId], references: [pmProjects.id] }),
  agileWorkstream: one(pmAgileWorkstreams, { fields: [pmAgileDefects.agileWorkstreamId], references: [pmAgileWorkstreams.id] }),
  story: one(pmAgileStories, { fields: [pmAgileDefects.storyId], references: [pmAgileStories.id] }),
  tenant: one(tenants, { fields: [pmAgileDefects.tenantId], references: [tenants.id] }),
}));

// Insert Schemas
export const insertPmPortfolioSchema = createInsertSchema(pmPortfolios).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmProgramSchema = createInsertSchema(pmPrograms).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmProjectSchema = createInsertSchema(pmProjects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmProjectPhaseSchema = createInsertSchema(pmProjectPhases).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmMilestoneSchema = createInsertSchema(pmMilestones).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmTaskSchema = createInsertSchema(pmTasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmTeamMemberSchema = createInsertSchema(pmTeamMembers).omit({ id: true, createdAt: true });
export const insertPmRaiddItemSchema = createInsertSchema(pmRaiddItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmPhaseTemplateSchema = createInsertSchema(pmPhaseTemplates).omit({ id: true, createdAt: true });
export const insertPmWorkstreamSchema = createInsertSchema(pmWorkstreams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmSprintSchema = createInsertSchema(pmSprints).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmBacklogItemSchema = createInsertSchema(pmBacklogItems).omit({ id: true, createdAt: true, updatedAt: true });

// Agile Board Insert Schemas
export const insertPmAgileWorkstreamSchema = createInsertSchema(pmAgileWorkstreams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmEpicSchema = createInsertSchema(pmEpics).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmAgileSprintSchema = createInsertSchema(pmAgileSprints).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmAgileStorySchema = createInsertSchema(pmAgileStories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmAgileDefectSchema = createInsertSchema(pmAgileDefects).omit({ id: true, createdAt: true, updatedAt: true });

// ── Deliverable Phases ──
export const pmDeliverablePhases = pgTable("pm_deliverable_phases", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b6cf4"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pmDeliverablePhasesRelations = relations(pmDeliverablePhases, ({ one }) => ({
  project: one(pmProjects, { fields: [pmDeliverablePhases.projectId], references: [pmProjects.id] }),
  tenant: one(tenants, { fields: [pmDeliverablePhases.tenantId], references: [tenants.id] }),
}));

// ── Deliverables ──
export const pmDeliverables = pgTable("pm_deliverables", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  phaseId: integer("phase_id").references(() => pmDeliverablePhases.id, { onDelete: "set null" }),
  phaseName: text("phase_name"),
  name: text("name").notNull(),
  type: text("type").notNull().default("Document"),
  status: text("status").notNull().default("Not Started"),
  ragStatus: text("rag_status").notNull().default("Green"),
  progress: integer("progress").notNull().default(0),
  dueDate: text("due_date"),
  version: integer("version").notNull().default(1),
  notes: text("notes"),
  owners: jsonb("owners").$type<string[]>().default([]),
  reviewers: jsonb("reviewers").$type<string[]>().default([]),
  approvers: jsonb("approvers").$type<string[]>().default([]),
  auditLog: jsonb("audit_log").$type<{ who: string; action: string; comment: string; time: string }[]>().default([]),
  createdBy: text("created_by"),
  archived: boolean("archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmDeliverablesRelations = relations(pmDeliverables, ({ one }) => ({
  project: one(pmProjects, { fields: [pmDeliverables.projectId], references: [pmProjects.id] }),
  phase: one(pmDeliverablePhases, { fields: [pmDeliverables.phaseId], references: [pmDeliverablePhases.id] }),
  tenant: one(tenants, { fields: [pmDeliverables.tenantId], references: [tenants.id] }),
}));

export const insertPmDeliverablePhaseSchema = createInsertSchema(pmDeliverablePhases).omit({ id: true, createdAt: true });
export const insertPmDeliverableSchema = createInsertSchema(pmDeliverables).omit({ id: true, createdAt: true, updatedAt: true });

/** Scheduled portfolio / project reports (spec §8.2, §9.1). */
export const pmReportSchedules = pgTable("pm_report_schedules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  reportType: text("report_type").notNull(),
  projectId: integer("project_id").references(() => pmProjects.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => pmPortfolios.id, { onDelete: "cascade" }),
  frequency: text("frequency").notNull().default("weekly"),
  dayOfWeek: integer("day_of_week"),
  timeOfDay: text("time_of_day").default("09:00"),
  recipientIds: jsonb("recipient_ids").$type<string[]>().default([]),
  format: text("format").default("pdf"),
  lastRunAt: timestamp("last_run_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pmReportSnapshots = pgTable("pm_report_snapshots", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  reportType: text("report_type").notNull(),
  projectId: integer("project_id").references(() => pmProjects.id, { onDelete: "set null" }),
  portfolioId: integer("portfolio_id").references(() => pmPortfolios.id, { onDelete: "set null" }),
  contentJson: jsonb("content_json").notNull(),
  generatedAt: timestamp("generated_at").defaultNow(),
  generatedBy: varchar("generated_by").references(() => users.id),
});

export const insertPmReportScheduleSchema = createInsertSchema(pmReportSchedules).omit({ id: true, createdAt: true, updatedAt: true, lastRunAt: true });
export const insertPmReportSnapshotSchema = createInsertSchema(pmReportSnapshots).omit({ id: true, generatedAt: true });
export const insertPmProjectPortfolioSchema = createInsertSchema(pmProjectPortfolios).omit({ id: true, createdAt: true });

/** Weekly health matrix snapshots for trend charts (spec §6.2). */
export const pmHealthMatrixSnapshots = pgTable("pm_health_matrix_snapshots", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  projectId: integer("project_id").notNull().references(() => pmProjects.id, { onDelete: "cascade" }),
  snapshotWeek: date("snapshot_week").notNull(),
  overall: text("overall").default("green"),
  schedule: text("schedule").default("green"),
  budget: text("budget").default("green"),
  quality: text("quality").default("green"),
  delivery: text("delivery").default("green"),
  risk: text("risk").default("green"),
  resources: text("resources").default("green"),
  stakeholders: text("stakeholders").default("green"),
  healthScore: integer("health_score").default(100),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Saved custom report definitions (spec §8.3). */
export const pmCustomReports = pgTable("pm_custom_reports", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  dataSource: text("data_source").notNull().default("projects"),
  config: jsonb("config").notNull().$type<{
    fields: string[];
    filters?: Record<string, string>;
    groupBy?: string | null;
    sortBy?: { field: string; direction: "asc" | "desc" };
  }>(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPmHealthMatrixSnapshotSchema = createInsertSchema(pmHealthMatrixSnapshots).omit({ id: true, createdAt: true });
export const insertPmCustomReportSchema = createInsertSchema(pmCustomReports).omit({ id: true, createdAt: true, updatedAt: true });

// Project Tools Insert Schema
export const insertPmProjectToolSchema = createInsertSchema(pmProjectTools).omit({ id: true, createdAt: true });

// RACI Insert Schemas
export const insertPmRaciRoleSchema = createInsertSchema(pmRaciRoles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmRaciActivitySchema = createInsertSchema(pmRaciActivities).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmRaciTypeSchema = createInsertSchema(pmRaciTypes).omit({ id: true, createdAt: true });
export const insertPmRaciAssignmentSchema = createInsertSchema(pmRaciAssignments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmRaciTemplateSchema = createInsertSchema(pmRaciTemplates).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type PmPortfolio = typeof pmPortfolios.$inferSelect;
export type PmProgram = typeof pmPrograms.$inferSelect;
export type PmProject = typeof pmProjects.$inferSelect;
export type PmProjectPhase = typeof pmProjectPhases.$inferSelect;
export type PmMilestone = typeof pmMilestones.$inferSelect;
export type PmTask = typeof pmTasks.$inferSelect;
export type PmTeamMember = typeof pmTeamMembers.$inferSelect;
export type PmRaiddItem = typeof pmRaiddItems.$inferSelect;
export type PmPhaseTemplate = typeof pmPhaseTemplates.$inferSelect;
export type PmWorkstream = typeof pmWorkstreams.$inferSelect;
export type PmSprint = typeof pmSprints.$inferSelect;
export type PmBacklogItem = typeof pmBacklogItems.$inferSelect;

export type InsertPmPortfolio = z.infer<typeof insertPmPortfolioSchema>;
export type InsertPmProgram = z.infer<typeof insertPmProgramSchema>;
export type InsertPmProject = z.infer<typeof insertPmProjectSchema>;
export type InsertPmProjectPhase = z.infer<typeof insertPmProjectPhaseSchema>;
export type InsertPmMilestone = z.infer<typeof insertPmMilestoneSchema>;
export type InsertPmTask = z.infer<typeof insertPmTaskSchema>;
export type InsertPmTeamMember = z.infer<typeof insertPmTeamMemberSchema>;
export type InsertPmRaiddItem = z.infer<typeof insertPmRaiddItemSchema>;
export type InsertPmPhaseTemplate = z.infer<typeof insertPmPhaseTemplateSchema>;
export type InsertPmWorkstream = z.infer<typeof insertPmWorkstreamSchema>;
export type InsertPmSprint = z.infer<typeof insertPmSprintSchema>;
export type InsertPmBacklogItem = z.infer<typeof insertPmBacklogItemSchema>;
export type PmProjectPortfolio = typeof pmProjectPortfolios.$inferSelect;
export type PmReportSchedule = typeof pmReportSchedules.$inferSelect;
export type PmReportSnapshot = typeof pmReportSnapshots.$inferSelect;
export type InsertPmReportSchedule = z.infer<typeof insertPmReportScheduleSchema>;
export type InsertPmReportSnapshot = z.infer<typeof insertPmReportSnapshotSchema>;
export type InsertPmProjectPortfolio = z.infer<typeof insertPmProjectPortfolioSchema>;
export type PmHealthMatrixSnapshot = typeof pmHealthMatrixSnapshots.$inferSelect;
export type PmCustomReport = typeof pmCustomReports.$inferSelect;
export type InsertPmHealthMatrixSnapshot = z.infer<typeof insertPmHealthMatrixSnapshotSchema>;
export type InsertPmCustomReport = z.infer<typeof insertPmCustomReportSchema>;

export type PmDeliverablePhase = typeof pmDeliverablePhases.$inferSelect;
export type PmDeliverable = typeof pmDeliverables.$inferSelect;

export type InsertPmDeliverablePhase = z.infer<typeof insertPmDeliverablePhaseSchema>;
export type InsertPmDeliverable = z.infer<typeof insertPmDeliverableSchema>;

export type PmProjectTool = typeof pmProjectTools.$inferSelect;
export type InsertPmProjectTool = z.infer<typeof insertPmProjectToolSchema>;

// RACI Types
export type PmRaciRole = typeof pmRaciRoles.$inferSelect;
export type PmRaciActivity = typeof pmRaciActivities.$inferSelect;
export type PmRaciType = typeof pmRaciTypes.$inferSelect;
export type PmRaciAssignment = typeof pmRaciAssignments.$inferSelect;
export type PmRaciTemplate = typeof pmRaciTemplates.$inferSelect;

export type InsertPmRaciRole = z.infer<typeof insertPmRaciRoleSchema>;
export type InsertPmRaciActivity = z.infer<typeof insertPmRaciActivitySchema>;
export type InsertPmRaciType = z.infer<typeof insertPmRaciTypeSchema>;
export type InsertPmRaciAssignment = z.infer<typeof insertPmRaciAssignmentSchema>;
export type InsertPmRaciTemplate = z.infer<typeof insertPmRaciTemplateSchema>;

// Agile Board Types
export type PmAgileWorkstream = typeof pmAgileWorkstreams.$inferSelect;
export type PmEpic = typeof pmEpics.$inferSelect;
export type PmAgileSprint = typeof pmAgileSprints.$inferSelect;
export type PmAgileStory = typeof pmAgileStories.$inferSelect;
export type PmAgileDefect = typeof pmAgileDefects.$inferSelect;

export type InsertPmAgileWorkstream = z.infer<typeof insertPmAgileWorkstreamSchema>;
export type InsertPmEpic = z.infer<typeof insertPmEpicSchema>;
export type InsertPmAgileSprint = z.infer<typeof insertPmAgileSprintSchema>;
export type InsertPmAgileStory = z.infer<typeof insertPmAgileStorySchema>;
export type InsertPmAgileDefect = z.infer<typeof insertPmAgileDefectSchema>;
