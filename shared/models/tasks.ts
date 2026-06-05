import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants, boards, items } from "../schema";

export const taskStatusEnum = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;
export const taskPriorityEnum = ["low", "medium", "high", "critical"] as const;
export const taskSourceEnum = ["personal", "meeting", "project", "initiative", "email", "crm"] as const;
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
  clientId: integer("client_id"),
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
export const insertTaskRecurrenceSchema = createInsertSchema(taskRecurrence).omit({ id: true, createdAt: true });
export const insertTaskReminderSchema = createInsertSchema(taskReminders).omit({ id: true, createdAt: true });
export const insertTaskViewSchema = createInsertSchema(taskViews).omit({ id: true, createdAt: true, updatedAt: true });

export type TaskBoard = typeof taskBoards.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskLink = typeof taskLinks.$inferSelect;
export type TaskSubtask = typeof taskSubtasks.$inferSelect;
export type TaskRecurrence = typeof taskRecurrence.$inferSelect;
export type TaskReminder = typeof taskReminders.$inferSelect;
export type TaskView = typeof taskViews.$inferSelect;

export type InsertTaskBoard = z.infer<typeof insertTaskBoardSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertTaskLink = z.infer<typeof insertTaskLinkSchema>;
export type InsertTaskSubtask = z.infer<typeof insertTaskSubtaskSchema>;
export type InsertTaskRecurrence = z.infer<typeof insertTaskRecurrenceSchema>;
export type InsertTaskReminder = z.infer<typeof insertTaskReminderSchema>;
export type InsertTaskView = z.infer<typeof insertTaskViewSchema>;
