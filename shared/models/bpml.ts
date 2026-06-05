import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { tenants } from "../schema";

export const bpmlTemplateTypeEnum = ["standard", "customer", "project", "erp", "industry"] as const;
export const bpmlTemplateStatusEnum = ["draft", "active", "archived"] as const;
export const bpmlErpPlatformEnum = ["SAP", "Oracle", "Microsoft", "NetSuite", "Workday", "Multi", "Other"] as const;
export const bpmlProcessAreaEnum = ["OTC", "PTP", "RTR", "HTR", "WMS", "APM", "PLM", "CRM", "SCM", "FSM", "Other"] as const;
export const bpmlStatusEnum = ["not_started", "in_progress", "completed", "approved", "on_hold", "at_risk", "delayed", "not_applicable"] as const;
export const bpmlFitGapEnum = ["fit", "gap", "workaround", "custom_dev", "not_assessed"] as const;
export const bpmlPriorityEnum = ["critical", "high", "medium", "low"] as const;
export const bpmlComplexityEnum = ["simple", "medium", "complex"] as const;
export const bpmlControlTypeEnum = ["preventive", "detective", "corrective"] as const;
export const bpmlControlFrequencyEnum = ["continuous", "daily", "weekly", "monthly", "quarterly", "annually"] as const;

export const bpmlFieldSectionEnum = [
  "core", "erp_mapping", "ownership", "design", "build",
  "unit_testing", "sit_testing", "e2e_testing", "uat_testing",
  "roles_auth", "controls_sox", "change_release",
  "data_migration", "cutover", "training", "custom"
] as const;

export const bpmlCustomFieldTypeEnum = ["text", "number", "date", "boolean", "enum", "url", "textarea"] as const;

export const bpmlTemplates = pgTable("bpml_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  templateType: text("template_type").notNull().default("standard"),
  erpPlatform: text("erp_platform"),
  processArea: text("process_area"),
  version: text("version").default("1.0"),
  status: text("status").notNull().default("active"),
  visibleSections: jsonb("visible_sections").default(["core", "ownership"]),
  visibleFields: jsonb("visible_fields"),
  customFields: jsonb("custom_fields").default([]),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bpmlTemplatesRelations = relations(bpmlTemplates, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [bpmlTemplates.tenantId],
    references: [tenants.id],
  }),
  entries: many(bpmlEntries),
}));

export const bpmlEntries = pgTable("bpml_entries", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => bpmlTemplates.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),

  bpmlId: text("bpml_id"),
  processCode: text("process_code"),
  processName: text("process_name").notNull(),
  processDescription: text("process_description"),

  level1: text("level_1"),
  level2: text("level_2"),
  level3: text("level_3"),
  level4: text("level_4"),
  level5: text("level_5"),
  parentId: integer("parent_id"),
  sequenceOrder: integer("sequence_order").default(0),

  erpPlatform: text("erp_platform"),
  sapModule: text("sap_module"),
  oracleModule: text("oracle_module"),
  msModule: text("ms_module"),
  application: text("application"),
  transactionCodes: text("transaction_codes"),
  fioriApp: text("fiori_app"),

  processOwner: text("process_owner"),
  businessOwner: text("business_owner"),
  itOwner: text("it_owner"),
  raciRole: text("raci_role"),
  department: text("department"),

  fitGapStatus: text("fit_gap_status").default("not_assessed"),
  priority: text("priority"),
  complexity: text("complexity"),
  countryScope: text("country_scope"),
  legalEntity: text("legal_entity"),
  overallStatus: text("overall_status").default("not_started"),

  designStatus: text("design_status").default("not_started"),
  designDocumentLink: text("design_document_link"),
  designVersion: text("design_version"),
  designSignoffDate: timestamp("design_signoff_date"),

  buildStatus: text("build_status").default("not_started"),
  configurationComplete: boolean("configuration_complete").default(false),
  configObjectIds: text("config_object_ids"),
  transportIds: text("transport_ids"),
  buildNotes: text("build_notes"),

  unitTestRequired: boolean("unit_test_required").default(false),
  unitTestStatus: text("unit_test_status").default("not_started"),
  unitTestScriptId: text("unit_test_script_id"),
  unitTestPassed: boolean("unit_test_passed").default(false),

  sitRequired: boolean("sit_required").default(false),
  sitStatus: text("sit_status").default("not_started"),
  sitTestCaseIds: text("sit_test_case_ids"),

  e2eTestRequired: boolean("e2e_test_required").default(false),
  e2eStatus: text("e2e_status").default("not_started"),
  e2eScenarioId: text("e2e_scenario_id"),

  uatRequired: boolean("uat_required").default(false),
  uatStatus: text("uat_status").default("not_started"),
  uatSignoff: boolean("uat_signoff").default(false),
  uatSignoffDate: timestamp("uat_signoff_date"),

  roleRequired: boolean("role_required").default(false),
  roleNames: text("role_names"),
  segregationOfDutiesFlag: boolean("segregation_of_duties_flag").default(false),
  securityReviewStatus: text("security_review_status").default("not_started"),

  soxRelevant: boolean("sox_relevant").default(false),
  controlId: text("control_id"),
  controlDescription: text("control_description"),
  controlType: text("control_type"),
  controlOwner: text("control_owner"),
  controlFrequency: text("control_frequency"),
  controlTested: boolean("control_tested").default(false),

  changeRequestId: text("change_request_id"),
  releaseVersion: text("release_version"),
  deploymentStatus: text("deployment_status").default("not_started"),

  dataMigrationRequired: boolean("data_migration_required").default(false),
  migrationStatus: text("migration_status").default("not_started"),
  migrationObjectId: text("migration_object_id"),

  cutoverRelevant: boolean("cutover_relevant").default(false),
  cutoverSequence: integer("cutover_sequence"),
  goLiveReadinessStatus: text("go_live_readiness_status").default("not_started"),

  trainingMaterialLink: text("training_material_link"),
  trainingStatus: text("training_status").default("not_started"),
  endUserDocLink: text("end_user_doc_link"),

  customFieldValues: jsonb("custom_field_values").default({}),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bpmlEntriesRelations = relations(bpmlEntries, ({ one }) => ({
  template: one(bpmlTemplates, {
    fields: [bpmlEntries.templateId],
    references: [bpmlTemplates.id],
  }),
  tenant: one(tenants, {
    fields: [bpmlEntries.tenantId],
    references: [tenants.id],
  }),
}));

export const insertBpmlTemplateSchema = createInsertSchema(bpmlTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBpmlEntrySchema = createInsertSchema(bpmlEntries).omit({ id: true, createdAt: true, updatedAt: true });

export type BpmlTemplate = typeof bpmlTemplates.$inferSelect;
export type InsertBpmlTemplate = z.infer<typeof insertBpmlTemplateSchema>;
export type BpmlEntry = typeof bpmlEntries.$inferSelect;
export type InsertBpmlEntry = z.infer<typeof insertBpmlEntrySchema>;

export interface BpmlCustomFieldDef {
  id: string;
  label: string;
  type: typeof bpmlCustomFieldTypeEnum[number];
  section: string;
  required?: boolean;
  defaultValue?: any;
  options?: string[];
  hidden?: boolean;
}

export const BPML_FIELD_SECTIONS = [
  { id: "core", label: "Core Identity", alwaysVisible: true },
  { id: "erp_mapping", label: "ERP Mapping" },
  { id: "ownership", label: "Ownership & Governance" },
  { id: "design", label: "Process Design" },
  { id: "build", label: "Process Build / Configuration" },
  { id: "unit_testing", label: "Unit Testing" },
  { id: "sit_testing", label: "Integration Testing (SIT)" },
  { id: "e2e_testing", label: "End-to-End Testing" },
  { id: "uat_testing", label: "User Acceptance Testing (UAT)" },
  { id: "roles_auth", label: "Roles & Authorisations" },
  { id: "controls_sox", label: "Controls & SOX" },
  { id: "change_release", label: "Change & Release" },
  { id: "data_migration", label: "Data Migration" },
  { id: "cutover", label: "Cutover & Go-Live" },
  { id: "training", label: "Training & Documentation" },
  { id: "custom", label: "Custom Fields" },
] as const;

export const BPML_CORE_FIELDS: { id: string; label: string; section: string; type: string; required?: boolean; options?: { value: string; label: string }[] }[] = [
  { id: "bpmlId", label: "BPML ID", section: "core", type: "text" },
  { id: "processCode", label: "Process Code", section: "core", type: "text" },
  { id: "processName", label: "Process Name", section: "core", type: "text", required: true },
  { id: "processDescription", label: "Description", section: "core", type: "textarea" },
  { id: "level1", label: "L1 - End-to-End", section: "core", type: "text" },
  { id: "level2", label: "L2 - Process Group", section: "core", type: "text" },
  { id: "level3", label: "L3 - Business Process", section: "core", type: "text" },
  { id: "level4", label: "L4 - Subprocess", section: "core", type: "text" },
  { id: "level5", label: "L5 - Task", section: "core", type: "text" },
  { id: "sequenceOrder", label: "Sequence", section: "core", type: "number" },
  { id: "fitGapStatus", label: "Fit/Gap", section: "core", type: "enum", options: [
    { value: "fit", label: "Fit" }, { value: "gap", label: "Gap" },
    { value: "workaround", label: "Workaround" }, { value: "custom_dev", label: "Custom Dev" },
    { value: "not_assessed", label: "Not Assessed" },
  ]},
  { id: "priority", label: "Priority", section: "core", type: "enum", options: [
    { value: "critical", label: "Critical" }, { value: "high", label: "High" },
    { value: "medium", label: "Medium" }, { value: "low", label: "Low" },
  ]},
  { id: "complexity", label: "Complexity", section: "core", type: "enum", options: [
    { value: "simple", label: "Simple" }, { value: "medium", label: "Medium" }, { value: "complex", label: "Complex" },
  ]},
  { id: "overallStatus", label: "Overall Status", section: "core", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "on_hold", label: "On Hold" }, { value: "at_risk", label: "At Risk" },
    { value: "delayed", label: "Delayed" }, { value: "not_applicable", label: "N/A" },
  ]},
  { id: "countryScope", label: "Country Scope", section: "core", type: "text" },
  { id: "legalEntity", label: "Legal Entity", section: "core", type: "text" },

  { id: "erpPlatform", label: "ERP Platform", section: "erp_mapping", type: "enum", options: [
    { value: "SAP", label: "SAP" }, { value: "Oracle", label: "Oracle" },
    { value: "Microsoft", label: "Microsoft" }, { value: "NetSuite", label: "NetSuite" },
    { value: "Workday", label: "Workday" }, { value: "Multi", label: "Multi-Platform" },
    { value: "Other", label: "Other" },
  ]},
  { id: "sapModule", label: "SAP Module", section: "erp_mapping", type: "text" },
  { id: "oracleModule", label: "Oracle Module", section: "erp_mapping", type: "text" },
  { id: "msModule", label: "MS Module", section: "erp_mapping", type: "text" },
  { id: "application", label: "Application", section: "erp_mapping", type: "text" },
  { id: "transactionCodes", label: "Transaction Codes", section: "erp_mapping", type: "text" },
  { id: "fioriApp", label: "Fiori App", section: "erp_mapping", type: "text" },

  { id: "processOwner", label: "Process Owner", section: "ownership", type: "text" },
  { id: "businessOwner", label: "Business Owner", section: "ownership", type: "text" },
  { id: "itOwner", label: "IT Owner", section: "ownership", type: "text" },
  { id: "raciRole", label: "RACI Role", section: "ownership", type: "text" },
  { id: "department", label: "Department", section: "ownership", type: "text" },

  { id: "designStatus", label: "Design Status", section: "design", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "at_risk", label: "At Risk" }, { value: "delayed", label: "Delayed" },
  ]},
  { id: "designDocumentLink", label: "Design Document Link", section: "design", type: "url" },
  { id: "designVersion", label: "Design Version", section: "design", type: "text" },
  { id: "designSignoffDate", label: "Design Sign-off Date", section: "design", type: "date" },

  { id: "buildStatus", label: "Build Status", section: "build", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "at_risk", label: "At Risk" }, { value: "delayed", label: "Delayed" },
  ]},
  { id: "configurationComplete", label: "Configuration Complete", section: "build", type: "boolean" },
  { id: "configObjectIds", label: "Config Object IDs", section: "build", type: "text" },
  { id: "transportIds", label: "Transport IDs", section: "build", type: "text" },
  { id: "buildNotes", label: "Build Notes", section: "build", type: "textarea" },

  { id: "unitTestRequired", label: "Unit Test Required", section: "unit_testing", type: "boolean" },
  { id: "unitTestStatus", label: "Unit Test Status", section: "unit_testing", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "at_risk", label: "At Risk" }, { value: "delayed", label: "Delayed" },
  ]},
  { id: "unitTestScriptId", label: "Test Script ID", section: "unit_testing", type: "text" },
  { id: "unitTestPassed", label: "Unit Test Passed", section: "unit_testing", type: "boolean" },

  { id: "sitRequired", label: "SIT Required", section: "sit_testing", type: "boolean" },
  { id: "sitStatus", label: "SIT Status", section: "sit_testing", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "at_risk", label: "At Risk" }, { value: "delayed", label: "Delayed" },
  ]},
  { id: "sitTestCaseIds", label: "SIT Test Case IDs", section: "sit_testing", type: "text" },

  { id: "e2eTestRequired", label: "E2E Test Required", section: "e2e_testing", type: "boolean" },
  { id: "e2eStatus", label: "E2E Status", section: "e2e_testing", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "at_risk", label: "At Risk" }, { value: "delayed", label: "Delayed" },
  ]},
  { id: "e2eScenarioId", label: "E2E Scenario ID", section: "e2e_testing", type: "text" },

  { id: "uatRequired", label: "UAT Required", section: "uat_testing", type: "boolean" },
  { id: "uatStatus", label: "UAT Status", section: "uat_testing", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "at_risk", label: "At Risk" }, { value: "delayed", label: "Delayed" },
  ]},
  { id: "uatSignoff", label: "UAT Sign-off", section: "uat_testing", type: "boolean" },
  { id: "uatSignoffDate", label: "UAT Sign-off Date", section: "uat_testing", type: "date" },

  { id: "roleRequired", label: "Role Required", section: "roles_auth", type: "boolean" },
  { id: "roleNames", label: "Role Names", section: "roles_auth", type: "text" },
  { id: "segregationOfDutiesFlag", label: "Segregation of Duties", section: "roles_auth", type: "boolean" },
  { id: "securityReviewStatus", label: "Security Review Status", section: "roles_auth", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "at_risk", label: "At Risk" }, { value: "delayed", label: "Delayed" },
  ]},

  { id: "soxRelevant", label: "SOX Relevant", section: "controls_sox", type: "boolean" },
  { id: "controlId", label: "Control ID", section: "controls_sox", type: "text" },
  { id: "controlDescription", label: "Control Description", section: "controls_sox", type: "textarea" },
  { id: "controlType", label: "Control Type", section: "controls_sox", type: "enum", options: [
    { value: "preventive", label: "Preventive" }, { value: "detective", label: "Detective" }, { value: "corrective", label: "Corrective" },
  ]},
  { id: "controlOwner", label: "Control Owner", section: "controls_sox", type: "text" },
  { id: "controlFrequency", label: "Control Frequency", section: "controls_sox", type: "enum", options: [
    { value: "continuous", label: "Continuous" }, { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" }, { value: "annually", label: "Annually" },
  ]},
  { id: "controlTested", label: "Control Tested", section: "controls_sox", type: "boolean" },

  { id: "changeRequestId", label: "Change Request ID", section: "change_release", type: "text" },
  { id: "releaseVersion", label: "Release Version", section: "change_release", type: "text" },
  { id: "deploymentStatus", label: "Deployment Status", section: "change_release", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "at_risk", label: "At Risk" }, { value: "delayed", label: "Delayed" },
  ]},

  { id: "dataMigrationRequired", label: "Data Migration Required", section: "data_migration", type: "boolean" },
  { id: "migrationStatus", label: "Migration Status", section: "data_migration", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "at_risk", label: "At Risk" }, { value: "delayed", label: "Delayed" },
  ]},
  { id: "migrationObjectId", label: "Migration Object ID", section: "data_migration", type: "text" },

  { id: "cutoverRelevant", label: "Cutover Relevant", section: "cutover", type: "boolean" },
  { id: "cutoverSequence", label: "Cutover Sequence", section: "cutover", type: "number" },
  { id: "goLiveReadinessStatus", label: "Go-Live Readiness", section: "cutover", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "at_risk", label: "At Risk" }, { value: "delayed", label: "Delayed" },
  ]},

  { id: "trainingMaterialLink", label: "Training Material Link", section: "training", type: "url" },
  { id: "trainingStatus", label: "Training Status", section: "training", type: "enum", options: [
    { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" }, { value: "approved", label: "Approved" },
    { value: "at_risk", label: "At Risk" }, { value: "delayed", label: "Delayed" },
  ]},
  { id: "endUserDocLink", label: "End User Doc Link", section: "training", type: "url" },
];
