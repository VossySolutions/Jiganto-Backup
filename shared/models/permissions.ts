import { pgTable, serial, integer, varchar, text, timestamp, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

/**
 * Platform roles (Section 3 — User Roles & Permission Model).
 * Stored per user per organisation (org_id = tenants.id in this codebase).
 */
export const PLATFORM_ROLES = [
  "jiganto_staff",
  "si_super_admin",
  "si_consultant_pm",
  "client_project_user",
  "client_executive",
  "client_jiganto_user",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PERMISSION_LEVELS = ["none", "read", "write", "admin", "god"] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  jiganto_staff: "Jiganto Staff",
  si_super_admin: "SI Super Admin",
  si_consultant_pm: "SI Consultant / PM",
  client_project_user: "Client Project User",
  client_executive: "Client Executive",
  client_jiganto_user: "Client Jiganto User",
};

export const PLATFORM_ROLE_DESCRIPTIONS: Record<PlatformRole, string> = {
  jiganto_staff:
    "God-mode admin. Full access to all organisations. Impersonation with approval. Never visible to customers.",
  si_super_admin:
    "Organisation owner. Full org access, billing, invites. Sees all client workspaces via context switcher.",
  si_consultant_pm:
    "Cross-workspace SI user. Context switcher visible. Master PMO and client workspaces.",
  client_project_user:
    "Locked to assigned workspace. No context switcher. Own projects, tasks, documents, tickets.",
  client_executive:
    "Read-only dashboards and reports in workspace. No create/edit.",
  client_jiganto_user:
    "Independent client org admin. SI consultants are guests in their system.",
};

/** Numeric rank for additive permissions (highest wins). */
export const PERMISSION_LEVEL_RANK: Record<PermissionLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
  god: 4,
};

export const ROLE_PERMISSION_LEVEL: Record<PlatformRole, PermissionLevel> = {
  jiganto_staff: "god",
  si_super_admin: "admin",
  si_consultant_pm: "write",
  client_project_user: "write",
  client_executive: "read",
  client_jiganto_user: "admin",
};

export function permissionLevelForRole(role: PlatformRole): PermissionLevel {
  return ROLE_PERMISSION_LEVEL[role];
}

export function maxPermissionLevel(a: PermissionLevel, b: PermissionLevel): PermissionLevel {
  return PERMISSION_LEVEL_RANK[a] >= PERMISSION_LEVEL_RANK[b] ? a : b;
}

export function isReadOnlyRole(role: PlatformRole): boolean {
  return ROLE_PERMISSION_LEVEL[role] === "read";
}

/** Organisation owner / internal roles — must not be removed or reassigned via Settings UI. */
export const IMMUTABLE_PLATFORM_ROLES: readonly PlatformRole[] = [
  "jiganto_staff",
  "si_super_admin",
];

export function isImmutablePlatformRole(role: PlatformRole): boolean {
  return (IMMUTABLE_PLATFORM_ROLES as readonly string[]).includes(role);
}

export function showContextSwitcherForRole(role: PlatformRole): boolean {
  return (
    role === "si_super_admin" ||
    role === "si_consultant_pm" ||
    role === "client_jiganto_user"
  );
}

export function canAccessMultipleWorkspaces(role: PlatformRole): boolean {
  return showContextSwitcherForRole(role) || role === "jiganto_staff";
}

/** Section 4.3 — PMO master dashboard across all client workspaces. */
export function canViewPmoMasterForRole(role: PlatformRole): boolean {
  return role === "si_super_admin" || role === "si_consultant_pm" || role === "jiganto_staff";
}

/** Map legacy client_users.role values to platform roles. */
export function mapLegacyClientRole(role: string): PlatformRole {
  if (role === "client_admin") return "client_project_user";
  if (role === "client_viewer") return "client_executive";
  return "client_executive";
}

/** Membership row: role is stored per user per org (Section 3.1). */
export const orgMemberships = pgTable(
  "org_memberships",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** org_id in product spec — maps to tenants.id */
    orgId: integer("org_id").notNull(),
    platformRole: text("platform_role").notNull(),
    /** When set, user is locked to this client workspace (`clients.id`, Section 4). */
  lockedWorkspaceId: integer("locked_workspace_id"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("org_memberships_user_org_idx").on(table.userId, table.orgId),
  ],
);

export const IMPERSONATION_STATUSES = ["pending", "approved", "denied", "active", "ended"] as const;
export type ImpersonationStatus = (typeof IMPERSONATION_STATUSES)[number];

/** Jiganto Staff impersonation audit (Section 3.1 + Section 14). */
export const staffImpersonationLogs = pgTable("staff_impersonation_logs", {
  id: serial("id").primaryKey(),
  staffUserId: varchar("staff_user_id").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id),
  orgId: integer("org_id").notNull(),
  approvalStatus: text("approval_status").notNull().default("pending"),
  approvedBy: varchar("approved_by"),
  reason: text("reason"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrgMembershipSchema = createInsertSchema(orgMemberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrgMembership = typeof orgMemberships.$inferSelect;
export type InsertOrgMembership = z.infer<typeof insertOrgMembershipSchema>;

/** Optional: restrict SI consultants to specific client workspaces (empty = all clients). */
export const clientWorkspaceGrants = pgTable(
  "client_workspace_grants",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientId: integer("client_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("client_workspace_grants_user_idx").on(table.userId, table.tenantId)],
);

export const insertClientWorkspaceGrantSchema = createInsertSchema(clientWorkspaceGrants).omit({
  id: true,
  createdAt: true,
});

/** Organisation admin activity (invites, platform roles, grants). */
export const orgAuditEvents = pgTable(
  "org_audit_events",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull(),
    actorUserId: varchar("actor_user_id").notNull().references(() => users.id),
    action: text("action").notNull(),
    targetUserId: varchar("target_user_id"),
    targetEmail: text("target_email"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("org_audit_events_org_idx").on(table.orgId, table.createdAt)],
);

export const ORG_AUDIT_ACTIONS = [
  "invitation.created",
  "invitation.revoked",
  "invitation.accepted",
  "membership.created",
  "membership.updated",
  "membership.deleted",
  "workspace_grant.created",
  "workspace_grant.deleted",
  "data.export_requested",
] as const;

export type OrgAuditAction = (typeof ORG_AUDIT_ACTIONS)[number];

export const ORG_AUDIT_ACTION_LABELS: Record<OrgAuditAction, string> = {
  "invitation.created": "Invitation sent",
  "invitation.revoked": "Invitation revoked",
  "invitation.accepted": "Invitation accepted",
  "membership.created": "Platform role assigned",
  "membership.updated": "Platform role updated",
  "membership.deleted": "Platform role removed",
  "workspace_grant.created": "Client workspace grant added",
  "workspace_grant.deleted": "Client workspace grant removed",
  "data.export_requested": "Data export requested",
};
