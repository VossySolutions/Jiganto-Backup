
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export * from "./models/auth";
export * from "./models/chat";
export * from "./models/crm";
export * from "./models/business";
export * from "./models/documents";
export * from "./models/tasks";
export * from "./models/projects";
export * from "./models/resources";
export * from "./models/bpm";
export * from "./models/bpml";
export * from "./models/orgchart";
export * from "./models/workspaces";
export * from "./models/testmgmt";
export * from "./models/signoff";
export * from "./models/surveys";
export * from "./models/clients";
export * from "./models/permissions";
export * from "./models/org-notifications";
export * from "./models/ai-tokens";

import { users } from "./models/auth";

// Tenants (Companies/Organizations)
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  country: text("country").notNull().default("USA"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  phone: text("phone"),
  website: text("website"),
  industry: text("industry"),
  timezone: text("timezone").default("UTC"),
  ownerId: varchar("owner_id"),
  licenseContactName: text("license_contact_name"),
  licenseContactEmail: text("license_contact_email"),
  supportContactName: text("support_contact_name"),
  supportContactEmail: text("support_contact_email"),
  brandingConfig: jsonb("branding_config"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Roles with permissions
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  isAdmin: boolean("is_admin").default(false),
  permissions: jsonb("permissions").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Invitations
export const userInvitations = pgTable("user_invitations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  email: text("email").notNull(),
  roleId: integer("role_id").references(() => userRoles.id),
  platformRole: text("platform_role"),
  lockedWorkspaceId: integer("locked_workspace_id"),
  invitedBy: varchar("invited_by").notNull(),
  token: text("token").notNull().unique(),
  status: text("status").default("pending"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications for alerts, workflow notifications, etc.
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  tenantId: integer("tenant_id").references(() => tenants.id),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type").default("info"), // info, warning, success, error, workflow, system
  source: text("source"), // workflow, system, crm, task, etc.
  sourceId: text("source_id"), // ID of the related entity
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Feedback (bugs, suggestions, improvements)
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  tenantId: integer("tenant_id").references(() => tenants.id),
  type: text("type").notNull(), // bug, feature, improvement, general
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: text("priority").default("medium"), // low, medium, high, critical
  status: text("status").default("open"), // open, in-review, planned, closed
  pageUrl: text("page_url"), // URL where feedback was submitted
  userAgent: text("user_agent"), // Browser info for bug reports
  screenshotUrl: text("screenshot_url"), // Optional screenshot
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Organization Units - flexible parent-child hierarchy (Group > Company > Division/Brand > Department)
export const ORG_UNIT_TYPES = ["group", "company", "division", "brand", "department"] as const;
export type OrgUnitType = typeof ORG_UNIT_TYPES[number];
export const ORG_UNIT_TYPE_LABELS: Record<OrgUnitType, string> = {
  group: "Group",
  company: "Company",
  division: "Division",
  brand: "Brand",
  department: "Department",
};

export const orgUnits = pgTable("org_units", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  type: text("type").notNull().default("department"),
  description: text("description"),
  code: text("code"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orgUnitsRelations = relations(orgUnits, ({ one }) => ({
  tenant: one(tenants, {
    fields: [orgUnits.tenantId],
    references: [tenants.id],
  }),
  parent: one(orgUnits, {
    fields: [orgUnits.parentId],
    references: [orgUnits.id],
  }),
}));

// Cost Centres - hierarchical cost centre structure
export const costCentres = pgTable("cost_centres", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const costCentresRelations = relations(costCentres, ({ one }) => ({
  tenant: one(tenants, {
    fields: [costCentres.tenantId],
    references: [tenants.id],
  }),
  parent: one(costCentres, {
    fields: [costCentres.parentId],
    references: [costCentres.id],
  }),
}));

// Users relation to Tenant (One tenant per user for MVP, or Many-to-Many later)
// For MVP, let's just add tenantId to a profile table or assume single tenant.
// Since users table is from auth blueprint and locked, we can create a `profiles` table.

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  tenantId: integer("tenant_id").references(() => tenants.id),
  roleId: integer("role_id").references(() => userRoles.id),
  orgUnitId: integer("org_unit_id").references(() => orgUnits.id),
  costCentreId: integer("cost_centre_id"),
  managerId: integer("manager_id"),
  photoUrl: text("photo_url"),
  role: text("role").default("user"),
  userType: text("user_type").default("internal").notNull(),
  department: text("department"),
  jobTitle: text("job_title"),
  phone: text("phone"),
  bio: text("bio"),
  isActive: boolean("is_active").default(true),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  lastLoginAt: timestamp("last_login_at"),
});

export const userModulePermissions = pgTable("user_module_permissions", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").references(() => tenants.id),
  moduleKey: text("module_key").notNull(),
  canCreate: boolean("can_create").default(false).notNull(),
  canRead: boolean("can_read").default(true).notNull(),
  canUpdate: boolean("can_update").default(false).notNull(),
  canDelete: boolean("can_delete").default(false).notNull(),
});

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [profiles.tenantId],
    references: [tenants.id],
  }),
  orgUnit: one(orgUnits, {
    fields: [profiles.orgUnitId],
    references: [orgUnits.id],
  }),
  projectAssignments: many(userProjectAssignments),
}));

// User Project/Programme Assignments - scoped access for customers/contractors
export const ASSIGNMENT_TYPES = ["project", "programme"] as const;
export type AssignmentType = typeof ASSIGNMENT_TYPES[number];
export const ACCESS_LEVELS = ["view", "contribute", "manage"] as const;
export type AccessLevel = typeof ACCESS_LEVELS[number];

export const userProjectAssignments = pgTable("user_project_assignments", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").references(() => tenants.id),
  assignmentType: text("assignment_type").notNull().default("project"),
  projectId: integer("project_id"),
  programId: integer("program_id"),
  accessLevel: text("access_level").notNull().default("view"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userProjectAssignmentsRelations = relations(userProjectAssignments, ({ one }) => ({
  profile: one(profiles, {
    fields: [userProjectAssignments.profileId],
    references: [profiles.id],
  }),
  tenant: one(tenants, {
    fields: [userProjectAssignments.tenantId],
    references: [tenants.id],
  }),
}));

// Modules (The 12 fixed modules + custom ones)
export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // e.g., 'professional-services', 'erp'
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"), // lucide icon name
});

// Boards (Containers for data within modules)
export const boards = pgTable("boards", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  /** workspace_id — scope boards to a client workspace when applicable (Section 3.1). */
  workspaceId: integer("workspace_id"),
  moduleId: integer("module_id").references(() => modules.id),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("project"), // project, list, crm, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

export const boardsRelations = relations(boards, ({ one, many }) => ({
  module: one(modules, {
    fields: [boards.moduleId],
    references: [modules.id],
  }),
  tenant: one(tenants, {
    fields: [boards.tenantId],
    references: [tenants.id],
  }),
  columns: many(columns),
  items: many(items),
}));

// Columns (Structure of a board)
export const columns = pgTable("columns", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  key: text("key").notNull(), // internal key for the column
  type: text("type").notNull(), // text, number, date, status, person, etc.
  order: integer("order").notNull().default(0),
  options: jsonb("options"), // For select/status columns
});

export const columnsRelations = relations(columns, ({ one }) => ({
  board: one(boards, {
    fields: [columns.boardId],
    references: [boards.id],
  }),
}));

// Items (Rows in a board)
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  values: jsonb("values").notNull(), // Key-value store matching column keys: { "status": "Done", "due_date": "2024-01-01" }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const itemsRelations = relations(items, ({ one }) => ({
  board: one(boards, {
    fields: [items.boardId],
    references: [boards.id],
  }),
}));


// === SCHEMAS ===

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true });
export const insertUserModulePermissionSchema = createInsertSchema(userModulePermissions).omit({ id: true });
export const insertOrgUnitSchema = createInsertSchema(orgUnits).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserProjectAssignmentSchema = createInsertSchema(userProjectAssignments).omit({ id: true, createdAt: true });
export const insertModuleSchema = createInsertSchema(modules).omit({ id: true });
export const insertBoardSchema = createInsertSchema(boards).omit({ id: true, createdAt: true });
export const insertColumnSchema = createInsertSchema(columns).omit({ id: true });
export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, createdAt: true });
export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({ id: true, createdAt: true });

// === TYPES ===
export type Tenant = typeof tenants.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type Board = typeof boards.$inferSelect;
export type Column = typeof columns.$inferSelect;
export type Item = typeof items.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type UserInvitation = typeof userInvitations.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true, updatedAt: true, status: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertModule = z.infer<typeof insertModuleSchema>;
export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type InsertColumn = z.infer<typeof insertColumnSchema>;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;

export type UserModulePermission = typeof userModulePermissions.$inferSelect;
export type InsertUserModulePermission = z.infer<typeof insertUserModulePermissionSchema>;

export type OrgUnit = typeof orgUnits.$inferSelect;
export type InsertOrgUnit = z.infer<typeof insertOrgUnitSchema>;

export const insertCostCentreSchema = createInsertSchema(costCentres).omit({ id: true, createdAt: true, updatedAt: true });
export type CostCentre = typeof costCentres.$inferSelect;
export type InsertCostCentre = z.infer<typeof insertCostCentreSchema>;

export type UserProjectAssignment = typeof userProjectAssignments.$inferSelect;
export type InsertUserProjectAssignment = z.infer<typeof insertUserProjectAssignmentSchema>;

export type ModulePermissions = {
  [moduleKey: string]: {
    read: boolean;
    write: boolean;
    share: boolean;
  };
};

export const USER_TYPES = ["internal", "external", "customer"] as const;
export type UserType = typeof USER_TYPES[number];
export const USER_TYPE_LABELS: Record<UserType, string> = {
  internal: "Employee",
  external: "Contractor",
  customer: "Customer",
};
