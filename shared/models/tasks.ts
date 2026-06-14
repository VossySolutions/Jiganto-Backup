import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, date, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants, boards, items } from "../schema";

/** Module 11 — mutually exclusive task sources */
export const taskSourceEnum = ["project", "team", "meeting", "personal", "helpdesk", "approval"] as const;
export type TaskSource = (typeof taskSourceEnum)[number];

export const taskStatusEnum = ["todo", "in_progress", "completed", "cancelled"] as const;
export type TaskStatus = (typeof taskStatusEnum)[number];

export const taskPriorityEnum = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof taskPriorityEnum)[number];

export const linkedEntityTypeEnum = ["crm_account", "crm_opportunity", "crm_contact", "initiative", "goal", "meeting", "document", "project"] as const;
export const recurrencePatternEnum = ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"] as const;

export const taskBoards = pgTable("task_boards", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  boardId: integer("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  source: text("source").default("personal"),
  isDefault: boolean("is_default").default(false),
  viewPreferences: jsonb("view_preferences"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const taskBoardsRelations = relations(taskBoards, ({ one }) => ({
  tenant: one(tenants, {
    fields: [taskBoards.tenantId],
    references: [tenants.id],
  }),
  board: one(boards, {
    fields: [taskBoards.boardId],
    references: [boards.id],
  }),
}));

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  boardId: integer("board_id").references(() => boards.id, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => items.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  source: text("source").default("personal"),
  assigneeId: varchar("assignee_id").references(() => users.id),
  creatorId: varchar("creator_id").references(() => users.id),
  dueDate: date("due_date"),
  startDate: date("start_date"),
  completedAt: timestamp("completed_at"),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours"),
  tags: text("tags").array(),
  order: integer("order").default(0),
  parentTaskId: integer("parent_task_id"),
  /** Client workspace scope (`clients.id`) */
  clientId: integer("client_id"),
  projectId: integer("project_id"),
  isPersonal: boolean("is_personal").default(false),
  meetingRef: text("meeting_ref"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tasks.tenantId],
    references: [tenants.id],
  }),
  board: one(boards, {
    fields: [tasks.boardId],
    references: [boards.id],
  }),
  item: one(items, {
    fields: [tasks.itemId],
    references: [items.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [tasks.creatorId],
    references: [users.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
  }),
  subtasks: many(taskSubtasks),
  links: many(taskLinks),
  reminders: many(taskReminders),
  comments: many(taskComments),
  timeLogs: many(taskTimeLogs),
  attachments: many(taskAttachments),
}));

export const taskLinks = pgTable("task_links", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskLinksRelations = relations(taskLinks, ({ one }) => ({
  task: one(tasks, {
    fields: [taskLinks.taskId],
    references: [tasks.id],
  }),
}));

export const taskSubtasks = pgTable("task_subtasks", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isCompleted: boolean("is_completed").default(false),
  order: integer("order").default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskSubtasksRelations = relations(taskSubtasks, ({ one }) => ({
  task: one(tasks, {
    fields: [taskSubtasks.taskId],
    references: [tasks.id],
  }),
}));

export const taskComments = pgTable("task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskComments.userId],
    references: [users.id],
  }),
}));

export const taskTimeLogs = pgTable("task_time_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  hours: decimal("hours", { precision: 6, scale: 2 }).notNull(),
  notes: text("notes"),
  loggedAt: timestamp("logged_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskTimeLogsRelations = relations(taskTimeLogs, ({ one }) => ({
  task: one(tasks, {
    fields: [taskTimeLogs.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskTimeLogs.userId],
    references: [users.id],
  }),
}));

export const taskAttachments = pgTable("task_attachments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAttachments.taskId],
    references: [tasks.id],
  }),
}));

export const taskRecurrence = pgTable("task_recurrence", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  pattern: text("pattern").notNull(),
  interval: integer("interval").default(1),
  daysOfWeek: integer("days_of_week").array(),
  dayOfMonth: integer("day_of_month"),
  endDate: date("end_date"),
  occurrences: integer("occurrences"),
  lastGenerated: timestamp("last_generated"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskRecurrenceRelations = relations(taskRecurrence, ({ one }) => ({
  task: one(tasks, {
    fields: [taskRecurrence.taskId],
    references: [tasks.id],
  }),
}));

export const taskReminders = pgTable("task_reminders", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  reminderTime: timestamp("reminder_time").notNull(),
  isSent: boolean("is_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskRemindersRelations = relations(taskReminders, ({ one }) => ({
  task: one(tasks, {
    fields: [taskReminders.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskReminders.userId],
    references: [users.id],
  }),
}));

export const taskViews = pgTable("task_views", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  viewType: text("view_type").notNull().default("list"),
  filters: jsonb("filters"),
  sortOrder: jsonb("sort_order"),
  groupBy: text("group_by"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const taskViewsRelations = relations(taskViews, ({ one }) => ({
  tenant: one(tenants, {
    fields: [taskViews.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [taskViews.userId],
    references: [users.id],
  }),
}));

export const insertTaskBoardSchema = createInsertSchema(taskBoards).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskLinkSchema = createInsertSchema(taskLinks).omit({ id: true, createdAt: true });
export const insertTaskSubtaskSchema = createInsertSchema(taskSubtasks).omit({ id: true, createdAt: true });
export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({ id: true, createdAt: true });
export const insertTaskTimeLogSchema = createInsertSchema(taskTimeLogs).omit({ id: true, createdAt: true, loggedAt: true });
export const insertTaskAttachmentSchema = createInsertSchema(taskAttachments).omit({ id: true, createdAt: true });
export const insertTaskRecurrenceSchema = createInsertSchema(taskRecurrence).omit({ id: true, createdAt: true });
export const insertTaskReminderSchema = createInsertSchema(taskReminders).omit({ id: true, createdAt: true });
export const insertTaskViewSchema = createInsertSchema(taskViews).omit({ id: true, createdAt: true, updatedAt: true });

export type TaskBoard = typeof taskBoards.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskLink = typeof taskLinks.$inferSelect;
export type TaskSubtask = typeof taskSubtasks.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;
export type TaskTimeLog = typeof taskTimeLogs.$inferSelect;
export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type TaskRecurrence = typeof taskRecurrence.$inferSelect;
export type TaskReminder = typeof taskReminders.$inferSelect;
export type TaskView = typeof taskViews.$inferSelect;

export type InsertTaskBoard = z.infer<typeof insertTaskBoardSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertTaskLink = z.infer<typeof insertTaskLinkSchema>;
export type InsertTaskSubtask = z.infer<typeof insertTaskSubtaskSchema>;
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type InsertTaskTimeLog = z.infer<typeof insertTaskTimeLogSchema>;
export type InsertTaskAttachment = z.infer<typeof insertTaskAttachmentSchema>;
export type InsertTaskRecurrence = z.infer<typeof insertTaskRecurrenceSchema>;
export type InsertTaskReminder = z.infer<typeof insertTaskReminderSchema>;
export type InsertTaskView = z.infer<typeof insertTaskViewSchema>;

/** Unified task row returned by the Module 11 aggregator API */
export interface AggregatedTask {
  id: string;
  nativeId?: number;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  assigneeId?: string | null;
  assignee?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
  dueDate?: string | null;
  startDate?: string | null;
  workspaceId?: number | null;
  workspaceName?: string | null;
  workspaceColor?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  contextLabel?: string | null;
  contextHref?: string | null;
  isPersonal?: boolean;
  isOverdue?: boolean;
  isReadOnly?: boolean;
  tags?: string[];
  subtaskTotal?: number;
  subtaskCompleted?: number;
  externalKind: "native" | "pm" | "crm" | "signoff" | "timesheet" | "meeting" | "business";
  externalId: number | string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TaskSummaryCounts {
  todo: number;
  inProgress: number;
  completed: number;
  overdue: number;
  bySource: Record<TaskSource, number>;
}
