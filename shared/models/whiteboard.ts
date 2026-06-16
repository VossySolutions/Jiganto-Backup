import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, real, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants } from "../schema";

export const NOTE_TYPES = [
  "idea", "requirement", "risk", "issue", "action", "opportunity", "decision", "custom",
] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const WHITEBOARD_PERMISSIONS = ["view", "edit", "admin"] as const;
export type WhiteboardPermission = (typeof WHITEBOARD_PERMISSIONS)[number];

export const ACTIVITY_EVENT_TYPES = [
  "note_created", "note_edited", "note_moved", "note_deleted", "user_joined", "user_left",
] as const;
export type WhiteboardActivityEvent = (typeof ACTIVITY_EVENT_TYPES)[number];

export const whiteboards = pgTable("whiteboards", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  workspaceId: integer("workspace_id"),
  projectId: integer("project_id"),
  name: varchar("name", { length: 80 }).notNull(),
  description: varchar("description", { length: 300 }),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const whiteboardMembers = pgTable("whiteboard_members", {
  id: serial("id").primaryKey(),
  whiteboardId: integer("whiteboard_id").notNull().references(() => whiteboards.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  permission: text("permission").notNull().default("edit"),
  invitedBy: varchar("invited_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniq: unique().on(t.whiteboardId, t.userId),
}));

export const whiteboardShareTokens = pgTable("whiteboard_share_tokens", {
  id: serial("id").primaryKey(),
  whiteboardId: integer("whiteboard_id").notNull().references(() => whiteboards.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  permission: text("permission").notNull().default("view"),
  allowAnonymous: boolean("allow_anonymous").default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stickyNotes = pgTable("sticky_notes", {
  id: serial("id").primaryKey(),
  whiteboardId: integer("whiteboard_id").notNull().references(() => whiteboards.id, { onDelete: "cascade" }),
  text: text("text").notNull().default(""),
  noteType: text("note_type").notNull().default("idea"),
  colourHex: text("colour_hex"),
  xPosition: real("x_position").notNull().default(0),
  yPosition: real("y_position").notNull().default(0),
  width: integer("width").notNull().default(200),
  height: integer("height").notNull().default(200),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isDeleted: boolean("is_deleted").default(false),
});

export const whiteboardActivity = pgTable("whiteboard_activity", {
  id: serial("id").primaryKey(),
  whiteboardId: integer("whiteboard_id").notNull().references(() => whiteboards.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  actorId: varchar("actor_id").references(() => users.id),
  actorName: text("actor_name"),
  noteId: integer("note_id"),
  detailJson: jsonb("detail_json").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const whiteboardsRelations = relations(whiteboards, ({ many, one }) => ({
  notes: many(stickyNotes),
  members: many(whiteboardMembers),
  activity: many(whiteboardActivity),
  owner: one(users, { fields: [whiteboards.ownerId], references: [users.id] }),
}));

export const insertWhiteboardSchema = createInsertSchema(whiteboards).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertStickyNoteSchema = createInsertSchema(stickyNotes).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type Whiteboard = typeof whiteboards.$inferSelect;
export type StickyNote = typeof stickyNotes.$inferSelect;
export type WhiteboardMember = typeof whiteboardMembers.$inferSelect;
export type WhiteboardActivity = typeof whiteboardActivity.$inferSelect;
export type WhiteboardShareToken = typeof whiteboardShareTokens.$inferSelect;

export type WhiteboardListItem = Whiteboard & {
  ownerName?: string;
  memberCount: number;
  noteCount: number;
  myPermission: WhiteboardPermission | "owner";
};

export type WhiteboardDetail = Whiteboard & {
  notes: StickyNote[];
  members: (WhiteboardMember & { userName?: string; userEmail?: string })[];
  myPermission: WhiteboardPermission | "owner";
  ownerName?: string;
};

export const createWhiteboardBodySchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  projectId: z.number().optional().nullable(),
});

export const updateWhiteboardBodySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional().nullable(),
  projectId: z.number().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
});

export const upsertNoteBodySchema = z.object({
  text: z.string().optional(),
  noteType: z.enum(NOTE_TYPES).optional(),
  colourHex: z.string().optional().nullable(),
  xPosition: z.number().optional(),
  yPosition: z.number().optional(),
  width: z.number().min(120).max(600).optional(),
  height: z.number().min(120).max(600).optional(),
});
