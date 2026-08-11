import { pgTable, serial, integer, text, timestamp, boolean, varchar, unique, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql, relations } from "drizzle-orm";
import { users } from "./auth";

export type ChatBridgeProvider = "slack" | "teams";

export type ChannelBridgeConfig = {
  provider: ChatBridgeProvider;
  externalChannelName?: string;
  webhookUrl?: string;
  slackChannelId?: string;
  active: boolean;
  lastError?: string | null;
  lastSyncedAt?: string | null;
};

export type ChatNotificationPref = "all" | "mentions" | "nothing" | "muted";

export type ChatAuthorSource = "jiganto" | "slack" | "teams";

// Projects - Container for project-level chat
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"), // active, archived, completed
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Customers - External entities (companies) that can access specific projects
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  company: text("company"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Project Members - Links users to projects (both internal and customer users)
export const projectMembers = pgTable("project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }), // null for internal users
  role: text("role").default("member"), // owner, admin, member, viewer
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userProjectUnique: unique().on(table.userId, table.projectId),
  projectIdx: index("project_members_project_idx").on(table.projectId),
  userIdx: index("project_members_user_idx").on(table.userId),
}));

// Channels - Chat channels (company-level or project-level)
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }), // null = company-level channel
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("public"), // public, private, direct, announcement
  isDefault: boolean("is_default").default(false),
  bridgeConfig: jsonb("bridge_config").$type<ChannelBridgeConfig | null>(),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  tenantIdx: index("channels_tenant_idx").on(table.tenantId),
  projectIdx: index("channels_project_idx").on(table.projectId),
}));

// Channel Members - User membership in channels
export const channelMembers = pgTable("channel_members", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("member"), // admin, member
  notificationPref: text("notification_pref").default("mentions").notNull(), // all, mentions, nothing, muted
  lastReadAt: timestamp("last_read_at"),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userChannelUnique: unique().on(table.userId, table.channelId),
  channelIdx: index("channel_members_channel_idx").on(table.channelId),
  userIdx: index("channel_members_user_idx").on(table.userId),
}));

// Chat Messages - Messages in channels
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  parentId: integer("parent_id"), // For threaded replies
  messageType: text("message_type").default("text").notNull(), // text | poll | system | summary
  authorSource: text("author_source").default("jiganto").notNull(),
  pollId: integer("poll_id"),
  isEdited: boolean("is_edited").default(false),
  isDeleted: boolean("is_deleted").default(false),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  channelIdx: index("chat_messages_channel_idx").on(table.channelId),
  userIdx: index("chat_messages_user_idx").on(table.userId),
  parentIdx: index("chat_messages_parent_idx").on(table.parentId),
  createdAtIdx: index("chat_messages_created_at_idx").on(table.createdAt),
  // Compound index — covers the most common query: messages in a channel, top-level only, newest first
  channelCreatedIdx: index("chat_messages_channel_created_idx").on(table.channelId, table.createdAt),
  // Compound index — covers thread reply queries: replies under a parent in a channel
  channelParentIdx: index("chat_messages_channel_parent_idx").on(table.channelId, table.parentId, table.createdAt),
}));

export const messageAttachments = pgTable("message_attachments", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  messageId: integer("message_id").references(() => chatMessages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  messageIdx: index("message_attachments_message_idx").on(table.messageId),
  channelIdx: index("message_attachments_channel_idx").on(table.channelId),
}));

export const pinnedMessages = pgTable("pinned_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  messageId: integer("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
  pinnedByUserId: varchar("pinned_by_user_id").notNull().references(() => users.id),
  pinnedAt: timestamp("pinned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  channelMessageUnique: unique().on(table.channelId, table.messageId),
  channelIdx: index("pinned_messages_channel_idx").on(table.channelId),
}));

// Chat Polls - Polls created in channels
export const chatPolls = pgTable("chat_polls", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  question: text("question").notNull(),
  options: text("options").notNull(), // JSON array of strings
  durationMinutes: integer("duration_minutes").default(1440),
  anonymous: boolean("anonymous").default(false),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  channelIdx: index("chat_polls_channel_idx").on(table.channelId),
}));

// Chat Poll Votes - One vote per user per poll (upsertable)
export const chatPollVotes = pgTable("chat_poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull().references(() => chatPolls.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  optionIndex: integer("option_index").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userPollUnique: unique().on(table.userId, table.pollId),
  pollIdx: index("chat_poll_votes_poll_idx").on(table.pollId),
}));

// User Favorites - Users marked as favorites for quick access in chat
export const userFavorites = pgTable("user_favorites", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  favoriteUserId: varchar("favorite_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userFavoriteUnique: unique().on(table.userId, table.favoriteUserId),
  userIdx: index("user_favorites_user_idx").on(table.userId),
  tenantIdx: index("user_favorites_tenant_idx").on(table.tenantId),
}));

/** Starred channels / DMs in the conversations sidebar (spec §2.1 Favourites). */
export const channelFavorites = pgTable("channel_favorites", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userChannelUnique: unique().on(table.userId, table.channelId),
  userIdx: index("channel_favorites_user_idx").on(table.userId),
  channelIdx: index("channel_favorites_channel_idx").on(table.channelId),
}));

// Message Reactions - Emoji reactions on messages
export const messageReactions = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userMessageEmojiUnique: unique().on(table.userId, table.messageId, table.emoji),
  messageIdx: index("message_reactions_message_idx").on(table.messageId),
}));

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  members: many(projectMembers),
  channels: many(channels),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  projectMembers: many(projectMembers),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [projectMembers.customerId],
    references: [customers.id],
  }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  project: one(projects, {
    fields: [channels.projectId],
    references: [projects.id],
  }),
  createdBy: one(users, {
    fields: [channels.createdById],
    references: [users.id],
  }),
  members: many(channelMembers),
  messages: many(chatMessages),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, {
    fields: [channelMembers.channelId],
    references: [channels.id],
  }),
  user: one(users, {
    fields: [channelMembers.userId],
    references: [users.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one, many }) => ({
  channel: one(channels, {
    fields: [chatMessages.channelId],
    references: [channels.id],
  }),
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
  parent: one(chatMessages, {
    fields: [chatMessages.parentId],
    references: [chatMessages.id],
    relationName: "thread",
  }),
  replies: many(chatMessages, { relationName: "thread" }),
  reactions: many(messageReactions),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(chatMessages, {
    fields: [messageReactions.messageId],
    references: [chatMessages.id],
  }),
  user: one(users, {
    fields: [messageReactions.userId],
    references: [users.id],
  }),
}));

export const chatPollsRelations = relations(chatPolls, ({ one, many }) => ({
  channel: one(channels, { fields: [chatPolls.channelId], references: [channels.id] }),
  createdBy: one(users, { fields: [chatPolls.createdByUserId], references: [users.id] }),
  votes: many(chatPollVotes),
}));

export const chatPollVotesRelations = relations(chatPollVotes, ({ one }) => ({
  poll: one(chatPolls, { fields: [chatPollVotes.pollId], references: [chatPolls.id] }),
  user: one(users, { fields: [chatPollVotes.userId], references: [users.id] }),
}));

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(users, {
    fields: [userFavorites.userId],
    references: [users.id],
  }),
  favoriteUser: one(users, {
    fields: [userFavorites.favoriteUserId],
    references: [users.id],
  }),
}));

// Insert Schemas
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChannelMemberSchema = createInsertSchema(channelMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  isEdited: true,
  isDeleted: true,
  editedAt: true,
  deletedAt: true,
  createdAt: true,
});

export const insertMessageReactionSchema = createInsertSchema(messageReactions).omit({
  id: true,
  createdAt: true,
});

export const insertUserFavoriteSchema = createInsertSchema(userFavorites).omit({
  id: true,
  createdAt: true,
});

export const insertChannelFavoriteSchema = createInsertSchema(channelFavorites).omit({
  id: true,
  createdAt: true,
});

export const insertChatPollSchema = createInsertSchema(chatPolls).omit({
  id: true,
  closedAt: true,
  createdAt: true,
});

export const insertChatPollVoteSchema = createInsertSchema(chatPollVotes).omit({
  id: true,
  createdAt: true,
});

export const insertMessageAttachmentSchema = createInsertSchema(messageAttachments).omit({
  id: true,
  createdAt: true,
});

export const insertPinnedMessageSchema = createInsertSchema(pinnedMessages).omit({
  id: true,
  pinnedAt: true,
});

// Types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;

export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;

export type ChannelMember = typeof channelMembers.$inferSelect;
export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export type MessageReaction = typeof messageReactions.$inferSelect;
export type InsertMessageReaction = z.infer<typeof insertMessageReactionSchema>;

export type UserFavorite = typeof userFavorites.$inferSelect;
export type InsertUserFavorite = z.infer<typeof insertUserFavoriteSchema>;

export type ChannelFavorite = typeof channelFavorites.$inferSelect;
export type InsertChannelFavorite = z.infer<typeof insertChannelFavoriteSchema>;

export type ChatPoll = typeof chatPolls.$inferSelect;
export type InsertChatPoll = z.infer<typeof insertChatPollSchema>;
export type ChatPollVote = typeof chatPollVotes.$inferSelect;
export type InsertChatPollVote = z.infer<typeof insertChatPollVoteSchema>;

export type MessageAttachment = typeof messageAttachments.$inferSelect;
export type InsertMessageAttachment = z.infer<typeof insertMessageAttachmentSchema>;

export type PinnedMessage = typeof pinnedMessages.$inferSelect;
export type InsertPinnedMessage = z.infer<typeof insertPinnedMessageSchema>;

/** Sidebar conversation row with unread + preview (Module 02 §3). */
export type ChatInboxItem = {
  channelId: number;
  name: string;
  displayName: string;
  description?: string | null;
  type: string;
  projectId: number | null;
  projectName: string | null;
  unreadCount: number;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  lastReadAt?: string | null;
  isFavorite: boolean;
  bridge?: ChannelBridgeConfig | null;
  notificationPref?: ChatNotificationPref;
  memberRole?: string;
  canPost?: boolean;
  otherUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    email?: string | null;
  };
};

export type ChatMessageReactionGroup = {
  emoji: string;
  count: number;
  userIds: string[];
  reactedByMe: boolean;
};

export type ChatAttachmentMeta = {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

export type ChatMessageWithMeta = ChatMessage & {
  user: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null };
  reactions: ChatMessageReactionGroup[];
  threadReplyCount: number;
  threadLastReplyAt: string | null;
  attachments: ChatAttachmentMeta[];
  isPinned?: boolean;
};

export type ChatSearchHit = {
  messageId: number;
  channelId: number;
  channelName: string;
  content: string;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null };
};

// Legacy exports for AI conversations (keeping backward compatibility)
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
