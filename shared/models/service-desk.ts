import {
  pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, decimal, date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
import { users } from "./auth";
import { clients } from "./clients";
import { pmProjects } from "./projects";

export const TICKET_SOURCES = ["service_desk", "help_desk"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

export const TICKET_TYPES = ["incident", "service_request", "change_request", "question", "defect"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const DEFECT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type DefectSeverity = (typeof DEFECT_SEVERITIES)[number];

export const DEFECT_ENVIRONMENTS = ["dev", "sit", "uat", "staging", "production"] as const;
export type DefectEnvironment = (typeof DEFECT_ENVIRONMENTS)[number];

export const DEFECT_STATUSES = [
  "open", "assigned", "in_progress", "fix_ready", "retesting", "fixed", "wont_fix", "closed",
] as const;

export const TICKET_PRIORITIES = ["p1", "p2", "p3", "p4"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const SERVICE_AVAILABILITY = ["24_7", "business_hours", "on_request"] as const;
export type ServiceAvailability = (typeof SERVICE_AVAILABILITY)[number];

export const SERVICE_VISIBILITY = ["all_clients", "specific_clients", "internal_only"] as const;
export type ServiceVisibility = (typeof SERVICE_VISIBILITY)[number];

export const SERVICE_COST_MODELS = ["included", "per_incident", "fixed_monthly"] as const;
export type ServiceCostModel = (typeof SERVICE_COST_MODELS)[number];

export const CAB_DECISIONS = ["approved", "rejected", "more_info"] as const;
export type CabDecision = (typeof CAB_DECISIONS)[number];

export const INCIDENT_STATUSES = ["open", "assigned", "in_progress", "pending", "resolved", "closed"] as const;
export const SERVICE_REQUEST_STATUSES = ["open", "assigned", "in_progress", "pending", "completed", "closed"] as const;
export const CHANGE_STATUSES = [
  "draft", "submitted", "under_review", "cab_approved", "cab_rejected",
  "scheduled", "implementing", "implemented", "closed",
] as const;
export const QUESTION_STATUSES = ["open", "assigned", "answered", "closed"] as const;

export const DEFAULT_INCIDENT_SLA_HOURS: Record<TicketPriority, { response: number; resolution: number }> = {
  p1: { response: 1, resolution: 4 },
  p2: { response: 4, resolution: 8 },
  p3: { response: 8, resolution: 24 },
  p4: { response: 24, resolution: 72 },
};

export const DEFAULT_DEFECT_SLA_HOURS: Record<TicketPriority, { response: number; resolution: number }> = {
  p1: { response: 2, resolution: 8 },
  p2: { response: 4, resolution: 16 },
  p3: { response: 8, resolution: 48 },
  p4: { response: 24, resolution: 120 },
};

export const sdSettings = pgTable("sd_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().unique(),
  sdRefPrefix: text("sd_ref_prefix").notNull().default("SD"),
  hdRefPrefix: text("hd_ref_prefix").notNull().default("HD"),
  nextSdNumber: integer("next_sd_number").notNull().default(1),
  nextHdNumber: integer("next_hd_number").notNull().default(1),
  defaultTeamId: integer("default_team_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdServiceCategories = pgTable("sd_service_categories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdServices = pgTable("sd_services", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  categoryId: integer("category_id").references(() => sdServiceCategories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  ownerTeamId: integer("owner_team_id"),
  availability: text("availability").notNull().default("business_hours"),
  costModel: text("cost_model").default("included"),
  costNotes: text("cost_notes"),
  requestFormFields: jsonb("request_form_fields").default([]),
  visibility: text("visibility").notNull().default("all_clients"),
  visibleClientIds: jsonb("visible_client_ids").default([]),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdServiceSlas = pgTable("sd_service_slas", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull().references(() => sdServices.id, { onDelete: "cascade" }),
  priority: text("priority").notNull(),
  responseHours: decimal("response_hours", { precision: 8, scale: 2 }).notNull(),
  resolutionHours: decimal("resolution_hours", { precision: 8, scale: 2 }).notNull(),
});

export const sdAgentTeams = pgTable("sd_agent_teams", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  leadUserId: varchar("lead_user_id").references(() => users.id),
  roundRobinEnabled: boolean("round_robin_enabled").default(false),
  roundRobinIndex: integer("round_robin_index").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdAgentTeamMembers = pgTable("sd_agent_team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => sdAgentTeams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdRoutingRules = pgTable("sd_routing_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  conditions: jsonb("conditions").notNull().default({}),
  actions: jsonb("actions").notNull().default({}),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdSlaConfigs = pgTable("sd_sla_configs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
  priority: text("priority").notNull(),
  responseHours: decimal("response_hours", { precision: 8, scale: 2 }).notNull(),
  resolutionHours: decimal("resolution_hours", { precision: 8, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdTickets = pgTable("sd_tickets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  source: text("source").notNull().default("service_desk"),
  ref: text("ref").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  priority: text("priority").notNull().default("p3"),
  status: text("status").notNull().default("open"),
  description: jsonb("description"),
  category: text("category"),
  serviceId: integer("service_id").references(() => sdServices.id, { onDelete: "set null" }),
  customFields: jsonb("custom_fields").default({}),
  reporterId: varchar("reporter_id").references(() => users.id),
  reporterEmail: text("reporter_email"),
  assignedAgentId: varchar("assigned_agent_id").references(() => users.id),
  assignedTeamId: integer("assigned_team_id").references(() => sdAgentTeams.id, { onDelete: "set null" }),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => pmProjects.id, { onDelete: "set null" }),
  slaResponseDeadline: timestamp("sla_response_deadline"),
  slaResolutionDeadline: timestamp("sla_resolution_deadline"),
  slaPausedAt: timestamp("sla_paused_at"),
  slaPausedMs: integer("sla_paused_ms").default(0),
  firstResponseAt: timestamp("first_response_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  changeJustification: text("change_justification"),
  changeRiskAssessment: text("change_risk_assessment"),
  changeRollbackPlan: text("change_rollback_plan"),
  changeImplementationDate: timestamp("change_implementation_date"),
  changePostReview: text("change_post_review"),
  internalNotes: text("internal_notes"),
  tags: jsonb("tags").default([]),
  linkedTestCaseId: integer("linked_test_case_id"),
  linkedTestResultId: integer("linked_test_result_id"),
  sprintPhase: text("sprint_phase"),
  defectSeverity: text("defect_severity"),
  defectStepsToReproduce: text("defect_steps_to_reproduce"),
  defectExpectedResult: text("defect_expected_result"),
  defectActualResult: text("defect_actual_result"),
  defectEnvironment: text("defect_environment"),
  defectBuildVersion: text("defect_build_version"),
  defectWorkaround: text("defect_workaround"),
  defectFixVersion: text("defect_fix_version"),
  csatScore: integer("csat_score"),
  csatSurveySentAt: timestamp("csat_survey_sent_at"),
  csatSurveyToken: text("csat_survey_token"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const hdPortalConfigs = pgTable("hd_portal_configs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  allowedEmailDomains: jsonb("allowed_email_domains").default([]),
  allowedEmails: jsonb("allowed_emails").default([]),
  isActive: boolean("is_active").default(true),
  customBranding: jsonb("custom_branding").default({}),
  portalName: text("portal_name"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const hdPortalSessions = pgTable("hd_portal_sessions", {
  id: serial("id").primaryKey(),
  portalConfigId: integer("portal_config_id").notNull().references(() => hdPortalConfigs.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  verificationCode: text("verification_code"),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  ipAddress: text("ip_address"),
  csatOptedOut: boolean("csat_opted_out").default(false),
  sessionToken: text("session_token"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const hdPortalActivityLog = pgTable("hd_portal_activity_log", {
  id: serial("id").primaryKey(),
  portalConfigId: integer("portal_config_id").notNull().references(() => hdPortalConfigs.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  action: text("action").notNull(),
  ticketId: integer("ticket_id"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const hdSlaContractedHours = pgTable("hd_sla_contracted_hours", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
  monthlyHours: decimal("monthly_hours", { precision: 8, scale: 2 }).notNull(),
  overageRate: decimal("overage_rate", { precision: 10, scale: 2 }),
  currency: text("currency").default("GBP"),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const hdMaintenanceWindows = pgTable("hd_maintenance_windows", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdTicketComments = pgTable("sd_ticket_comments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => sdTickets.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").references(() => users.id),
  body: jsonb("body"),
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdTicketAttachments = pgTable("sd_ticket_attachments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => sdTickets.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdTicketTimeLogs = pgTable("sd_ticket_time_logs", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => sdTickets.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").notNull().references(() => users.id),
  logDate: date("log_date").notNull(),
  hours: decimal("hours", { precision: 6, scale: 2 }).notNull(),
  description: text("description"),
  isBillable: boolean("is_billable").default(true),
  rate: decimal("rate", { precision: 10, scale: 2 }),
  financeTimesheetEntryId: integer("finance_timesheet_entry_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdTicketStatusHistory = pgTable("sd_ticket_status_history", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => sdTickets.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: varchar("changed_by").references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdCabReviews = pgTable("sd_cab_reviews", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => sdTickets.id, { onDelete: "cascade" }),
  reviewerId: varchar("reviewer_id").notNull().references(() => users.id),
  decision: text("decision"),
  comments: text("comments"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdCabMembers = pgTable("sd_cab_members", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  isRequired: boolean("is_required").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sdTicketsRelations = relations(sdTickets, ({ one, many }) => ({
  service: one(sdServices, { fields: [sdTickets.serviceId], references: [sdServices.id] }),
  assignedTeam: one(sdAgentTeams, { fields: [sdTickets.assignedTeamId], references: [sdAgentTeams.id] }),
  comments: many(sdTicketComments),
  attachments: many(sdTicketAttachments),
  timeLogs: many(sdTicketTimeLogs),
  statusHistory: many(sdTicketStatusHistory),
  cabReviews: many(sdCabReviews),
}));

export const insertSdSettingsSchema = createInsertSchema(sdSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSdServiceCategorySchema = createInsertSchema(sdServiceCategories).omit({ id: true, createdAt: true });
export const insertSdServiceSchema = createInsertSchema(sdServices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSdTicketSchema = createInsertSchema(sdTickets).omit({ id: true, createdAt: true, updatedAt: true, ref: true });
export const insertSdAgentTeamSchema = createInsertSchema(sdAgentTeams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSdRoutingRuleSchema = createInsertSchema(sdRoutingRules).omit({ id: true, createdAt: true, updatedAt: true });

export type SdSettings = typeof sdSettings.$inferSelect;
export type SdService = typeof sdServices.$inferSelect;
export type SdServiceCategory = typeof sdServiceCategories.$inferSelect;
export type SdTicket = typeof sdTickets.$inferSelect;
export type SdAgentTeam = typeof sdAgentTeams.$inferSelect;
export type SdRoutingRule = typeof sdRoutingRules.$inferSelect;
export type SdTicketComment = typeof sdTicketComments.$inferSelect;
export type SdTicketTimeLog = typeof sdTicketTimeLogs.$inferSelect;
export type SdCabReview = typeof sdCabReviews.$inferSelect;
export type HdPortalConfig = typeof hdPortalConfigs.$inferSelect;
export type HdPortalSession = typeof hdPortalSessions.$inferSelect;
export type HdSlaContractedHours = typeof hdSlaContractedHours.$inferSelect;
export type HdMaintenanceWindow = typeof hdMaintenanceWindows.$inferSelect;
