/** Module 01 — Dashboard & Platform Home */

import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "../schema";
import { users } from "./auth";
import { clients } from "./clients";

export type DashboardLayout = "1-col" | "2-col" | "3-col";
export type DashboardRecordType = "system" | "module" | "bespoke";

export interface DashboardKpiStrip {
  activeItems: number;
  atRisk: number;
  critical: number;
  portfolioBudgetPence: number;
  portfolioBudgetLabel: string;
  teamMembers: number;
  links: {
    activeItems: string;
    atRisk: string;
    critical: string;
    portfolioBudget: string;
    teamMembers: string;
  };
}

export interface DashboardHealthSlice {
  label: string;
  count: number;
  color: string;
}

export interface DashboardProjectRow {
  id: number;
  name: string;
  customer: string | null;
  lead: string | null;
  progress: number;
  health: string;
  dueDate: string | null;
}

export interface DashboardTimelineBar {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  health: string;
}

export interface ProjectsModuleDashboard {
  kpis: {
    activeProjects: number;
    atRiskBehind: number;
    portfolioValuePence: number;
    portfolioValueLabel: string;
    milestonesDue: number;
  };
  healthDistribution: DashboardHealthSlice[];
  timeline: DashboardTimelineBar[];
  activeProjects: DashboardProjectRow[];
}

export interface TasksModuleDashboard {
  kpis: {
    myOpenTasks: number;
    overdue: number;
    completedThisWeek: number;
    teamOpenTasks: number;
  };
  byStatus: { week: string; todo: number; inProgress: number; done: number }[];
  byPriority: DashboardHealthSlice[];
  dueSoon: {
    id: number;
    title: string;
    dueDate: string | null;
    priority: string;
    status: string;
  }[];
}

export interface CrmModuleDashboard {
  kpis: {
    pipelineValue: number;
    pipelineLabel: string;
    openOpportunities: number;
    winRate90d: number;
    overdueFollowUps: number;
  };
  pipelineByStage: { name: string; value: number; count: number; color: string }[];
  revenueForecast: { month: string; value: number }[];
  hotOpportunities: {
    id: number;
    name: string;
    owner: string | null;
    amount: number;
    closeDate: string | null;
  }[];
}

export interface HelpDeskModuleDashboard {
  kpis: {
    openTickets: number;
    slaBreached: number;
    avgResolutionHours: number;
    csatScore: number;
  };
  byStatus: DashboardHealthSlice[];
  volumeTrend: { day: string; count: number }[];
  recentTickets: {
    id: number;
    subject: string;
    status: string;
    priority: string;
    dueDate: string | null;
  }[];
}

export interface FinanceModuleDashboard {
  kpis: {
    revenueYtdLabel: string;
    revenueYtdPence: number;
    outstandingInvoicesLabel: string;
    outstandingPence: number;
    budgetUtilisationPercent: number;
    overduePayments: number;
  };
  revenueVsBudget: { month: string; budget: number; actual: number }[];
  expenseBreakdown: DashboardHealthSlice[];
  unpaidInvoices: {
    id: number;
    label: string;
    client: string;
    amountPence: number;
    dueDate: string;
    daysOverdue: number;
  }[];
}

export interface BusinessModuleDashboard {
  kpis: {
    activeStrategies: number;
    okrsOnTrackPercent: number;
    overdueReviews: number;
    avgStrategyProgress: number;
  };
  strategyHealth: DashboardHealthSlice[];
  initiativeProgress: { name: string; progress: number }[];
  overdueGovernance: {
    name: string;
    owner: string | null;
    layer: string;
    daysOverdue: number;
  }[];
}

export interface DashboardBriefingItem {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warn" | "critical";
  href?: string;
}

export interface DashboardBriefing {
  healthScore: number;
  healthLabel: string;
  items: DashboardBriefingItem[];
}

export interface WidgetCatalogEntry {
  type: string;
  module: string;
  name: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
}

export interface BespokeDashboardPayload {
  id: number;
  name: string;
  description: string | null;
  layout: DashboardLayout;
  widgets: Array<{
    id: number;
    widgetType: string;
    widgetModule: string | null;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    config: Record<string, unknown>;
  }>;
}

export interface DashboardHistoryEntry {
  id: number;
  version: number;
  changeType: string;
  summary: string | null;
  userId: string | null;
  createdAt: string;
}

export interface DashboardHistoryDetail extends DashboardHistoryEntry {
  snapshot: BespokeDashboardPayload;
}

export const DASHBOARD_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { type: "kpi_strip", module: "platform", name: "KPI strip", description: "Cross-module summary metrics", defaultWidth: 4, defaultHeight: 1 },
  { type: "projects_kpi", module: "projects", name: "Projects KPIs", description: "Active, at risk, portfolio value", defaultWidth: 4, defaultHeight: 1 },
  { type: "projects_health", module: "projects", name: "Project health", description: "RAG distribution donut", defaultWidth: 2, defaultHeight: 2 },
  { type: "projects_table", module: "projects", name: "Active projects", description: "Top projects table", defaultWidth: 2, defaultHeight: 2 },
  { type: "tasks_kpi", module: "tasks", name: "Tasks KPIs", description: "Open, overdue, completed", defaultWidth: 4, defaultHeight: 1 },
  { type: "tasks_due", module: "tasks", name: "Tasks due soon", description: "Upcoming assignments", defaultWidth: 2, defaultHeight: 2 },
  { type: "crm_pipeline", module: "crm", name: "CRM pipeline", description: "Pipeline by stage", defaultWidth: 2, defaultHeight: 2 },
  { type: "crm_hot", module: "crm", name: "Hot opportunities", description: "Highest value deals", defaultWidth: 2, defaultHeight: 2 },
  { type: "helpdesk_kpi", module: "helpdesk", name: "Help desk KPIs", description: "Tickets and SLA", defaultWidth: 4, defaultHeight: 1 },
  { type: "helpdesk_volume", module: "helpdesk", name: "Ticket volume", description: "Daily ticket trend", defaultWidth: 2, defaultHeight: 2 },
  { type: "finance_kpi", module: "finance", name: "Finance KPIs", description: "Revenue and invoices", defaultWidth: 4, defaultHeight: 1 },
  { type: "finance_revenue", module: "finance", name: "Revenue vs budget", description: "Monthly comparison", defaultWidth: 2, defaultHeight: 2 },
  { type: "business_kpi", module: "business", name: "Business KPIs", description: "Strategies and OKRs", defaultWidth: 4, defaultHeight: 1 },
  { type: "business_initiatives", module: "business", name: "Initiative progress", description: "Top initiatives bar chart", defaultWidth: 2, defaultHeight: 2 },
  { type: "text_note", module: "platform", name: "Text note", description: "Markdown notes block", defaultWidth: 2, defaultHeight: 1 },
];

export interface DashboardUserPreferences {
  defaultDashboard: string;
  hiddenModuleKeys: string[];
  enabledDashboardIds: string[];
  lastDashboard?: string;
}

export interface ModuleEntitlements {
  /** null = all platform modules licensed for this org */
  licensedModuleKeys: string[] | null;
}

export const dashboards = pgTable("dashboards", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id").references(() => clients.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("bespoke"),
  module: text("module"),
  layout: text("layout").notNull().default("2-col"),
  isDefault: boolean("is_default").default(false),
  isShared: boolean("is_shared").default(false),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dashboardWidgets = pgTable("dashboard_widgets", {
  id: serial("id").primaryKey(),
  dashboardId: integer("dashboard_id")
    .notNull()
    .references(() => dashboards.id, { onDelete: "cascade" }),
  widgetType: text("widget_type").notNull(),
  widgetModule: text("widget_module"),
  positionX: integer("position_x").notNull().default(0),
  positionY: integer("position_y").notNull().default(0),
  width: integer("width").notNull().default(1),
  height: integer("height").notNull().default(1),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dashboardShares = pgTable("dashboard_shares", {
  id: serial("id").primaryKey(),
  dashboardId: integer("dashboard_id")
    .notNull()
    .references(() => dashboards.id, { onDelete: "cascade" }),
  sharedWithUserId: varchar("shared_with_user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  sharedWithWorkspaceId: integer("shared_with_workspace_id").references(() => clients.id, {
    onDelete: "cascade",
  }),
  permission: text("permission").notNull().default("view"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const widgetCache = pgTable("widget_cache", {
  id: serial("id").primaryKey(),
  dashboardId: integer("dashboard_id").references(() => dashboards.id, { onDelete: "cascade" }),
  widgetId: integer("widget_id").references(() => dashboardWidgets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  cachedAt: timestamp("cached_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const dashboardHistory = pgTable("dashboard_history", {
  id: serial("id").primaryKey(),
  dashboardId: integer("dashboard_id")
    .notNull()
    .references(() => dashboards.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  changeType: text("change_type").notNull(),
  summary: text("summary"),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type DashboardRow = typeof dashboards.$inferSelect;
export type DashboardWidgetRow = typeof dashboardWidgets.$inferSelect;
export type DashboardHistoryRow = typeof dashboardHistory.$inferSelect;

export function formatDashboardCurrency(pence: number, symbol = "£"): string {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return `${symbol}${(pounds / 1_000_000).toFixed(1)}M`;
  if (pounds >= 1_000) return `${symbol}${(pounds / 1_000).toFixed(1)}K`;
  return `${symbol}${pounds.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Keys used in module discovery grid and billing.modules tenant config */
export const PLATFORM_MODULE_KEYS = [
  "chat",
  "documents",
  "portfolio",
  "projects",
  "tasks",
  "workspaces",
  "business-mgmt",
  "crm",
  "finance-mgmt",
  "resource-mgmt",
  "test-mgmt",
  "bpm",
  "help-desk",
  "service-desk",
  "surveys",
  "esign",
  "whiteboarding",
  "templates",
  "customer-mgmt",
] as const;
