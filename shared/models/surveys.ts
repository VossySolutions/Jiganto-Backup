import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";
import { users } from "./auth";
import { tenants } from "../schema";

export const surveyStatusEnum = ["draft", "active", "closed", "archived"] as const;
export const questionTypeEnum = [
  "mc", "yn", "cb", "dd", "sc", "scale", "nps", "likert", "text", "para", "date", "file", "section", "matrix",
] as const;
export const ratingDisplayEnum = ["numbers", "stars", "emoji"] as const;
export const distributionTypeEnum = ["link", "workspace", "specific_users", "embed", "qr"] as const;
export const templateTierEnum = ["system", "submitted", "customer"] as const;
export const pollTypeEnum = ["single", "multi"] as const;

export type SurveyLogicRule = {
  questionId: number;
  operator: "equals" | "not_equals" | "contains";
  value: string | string[] | number;
  skipToQuestionId: number;
};

export const surveys = pgTable("surveys", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  workspaceId: integer("workspace_id"),
  title: text("title").notNull(),
  description: text("description"),
  surveyType: text("survey_type"),
  status: text("status").notNull().default("draft"),
  category: text("category"),
  projectId: integer("project_id"),
  anonymous: boolean("anonymous").default(false),
  showProgress: boolean("show_progress").default(true),
  onePerPage: boolean("one_per_page").default(true),
  randomizeQuestions: boolean("randomize_questions").default(false),
  allowMultipleResponses: boolean("allow_multiple_responses").default(false),
  showResultsToRespondents: boolean("show_results_to_respondents").default(false),
  allowExternal: boolean("allow_external").default(true),
  thankYouMessage: text("thank_you_message"),
  closeDate: timestamp("close_date"),
  reminderAt: timestamp("reminder_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  invitedCount: integer("invited_count").default(0),
  closedAt: timestamp("closed_at"),
  archivedAt: timestamp("archived_at"),
  sentAt: timestamp("sent_at"),
  token: text("token").unique(),
  createdBy: varchar("created_by").references(() => users.id),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const surveyQuestions = pgTable("survey_questions", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("mc"),
  text: text("text").notNull(),
  helpText: text("help_text"),
  options: jsonb("options").$type<string[]>().default([]),
  required: boolean("required").default(true),
  allowOther: boolean("allow_other").default(false),
  randomizeOptions: boolean("randomize_options").default(false),
  questionOrder: integer("question_order").notNull().default(1),
  scaleMin: integer("scale_min").default(1),
  scaleMax: integer("scale_max").default(10),
  scaleMinLabel: text("scale_min_label"),
  scaleMaxLabel: text("scale_max_label"),
  ratingDisplay: text("rating_display").default("numbers"),
  maxLength: integer("max_length"),
  isSection: boolean("is_section").default(false),
  logicJson: jsonb("logic_json").$type<SurveyLogicRule[]>().default([]),
  matrixRows: jsonb("matrix_rows").$type<string[]>().default([]),
  matrixCols: jsonb("matrix_cols").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const surveyResponses = pgTable("survey_responses", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  respondentUserId: varchar("respondent_user_id").references(() => users.id),
  respondentName: text("respondent_name"),
  respondentEmail: text("respondent_email"),
  sessionToken: text("session_token"),
  ipAddress: text("ip_address"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  isComplete: boolean("is_complete").default(false),
  timeSeconds: integer("time_seconds"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const surveyAnswers = pgTable("survey_answers", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id").notNull().references(() => surveyResponses.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => surveyQuestions.id, { onDelete: "cascade" }),
  value: jsonb("value"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const surveyDistributions = pgTable("survey_distributions", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  distributionType: text("distribution_type").notNull(),
  targetUserIds: jsonb("target_user_ids").$type<string[]>().default([]),
  targetEmails: jsonb("target_emails").$type<string[]>().default([]),
  sentAt: timestamp("sent_at").defaultNow(),
  reminderAt: timestamp("reminder_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const surveyTemplates = pgTable("survey_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  surveyType: text("survey_type"),
  category: text("category"),
  tier: text("tier").notNull().default("customer"),
  submissionStatus: text("submission_status"),
  contributedByOrg: text("contributed_by_org"),
  questionsJson: jsonb("questions_json").$type<Record<string, unknown>[]>().default([]),
  settingsJson: jsonb("settings_json").$type<Record<string, unknown>>().default({}),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const modulePolls = pgTable("module_polls", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  workspaceId: integer("workspace_id"),
  projectId: integer("project_id"),
  chatChannelId: integer("chat_channel_id"),
  chatPollId: integer("chat_poll_id"),
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  pollType: text("poll_type").notNull().default("single"),
  anonymous: boolean("anonymous").default(false),
  showResultsToVoters: boolean("show_results_to_voters").default(true),
  allowVoteChange: boolean("allow_vote_change").default(false),
  status: text("status").notNull().default("active"),
  closeAt: timestamp("close_at"),
  token: text("token").unique(),
  createdBy: varchar("created_by").references(() => users.id),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const modulePollVotes = pgTable("module_poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull().references(() => modulePolls.id, { onDelete: "cascade" }),
  voterId: varchar("voter_id").references(() => users.id),
  voterName: text("voter_name"),
  optionIndexes: jsonb("option_indexes").$type<number[]>().notNull().default([]),
  votedAt: timestamp("voted_at").defaultNow(),
}, (table) => ({
  voterPollUnique: unique().on(table.pollId, table.voterId),
}));

export const surveysRelations = relations(surveys, ({ many }) => ({
  questions: many(surveyQuestions),
  responses: many(surveyResponses),
  distributions: many(surveyDistributions),
}));

export const surveyQuestionsRelations = relations(surveyQuestions, ({ one, many }) => ({
  survey: one(surveys, { fields: [surveyQuestions.surveyId], references: [surveys.id] }),
  answers: many(surveyAnswers),
}));

export const surveyResponsesRelations = relations(surveyResponses, ({ one, many }) => ({
  survey: one(surveys, { fields: [surveyResponses.surveyId], references: [surveys.id] }),
  answers: many(surveyAnswers),
}));

export const surveyAnswersRelations = relations(surveyAnswers, ({ one }) => ({
  response: one(surveyResponses, { fields: [surveyAnswers.responseId], references: [surveyResponses.id] }),
  question: one(surveyQuestions, { fields: [surveyAnswers.questionId], references: [surveyQuestions.id] }),
}));

export const modulePollsRelations = relations(modulePolls, ({ many }) => ({
  votes: many(modulePollVotes),
}));

export const modulePollVotesRelations = relations(modulePollVotes, ({ one }) => ({
  poll: one(modulePolls, { fields: [modulePollVotes.pollId], references: [modulePolls.id] }),
}));

export const insertSurveySchema = createInsertSchema(surveys).omit({
  id: true, createdAt: true, updatedAt: true, sentAt: true, closedAt: true, archivedAt: true, reminderSentAt: true,
});
export const insertSurveyQuestionSchema = createInsertSchema(surveyQuestions).omit({ id: true, createdAt: true });
export const insertSurveyResponseSchema = createInsertSchema(surveyResponses).omit({ id: true, createdAt: true, completedAt: true });
export const insertSurveyAnswerSchema = createInsertSchema(surveyAnswers).omit({ id: true, createdAt: true });
export const insertSurveyTemplateSchema = createInsertSchema(surveyTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertModulePollSchema = createInsertSchema(modulePolls).omit({ id: true, createdAt: true });

export type Survey = typeof surveys.$inferSelect;
export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type SurveyQuestion = typeof surveyQuestions.$inferSelect;
export type InsertSurveyQuestion = z.infer<typeof insertSurveyQuestionSchema>;
export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type InsertSurveyResponse = z.infer<typeof insertSurveyResponseSchema>;
export type SurveyAnswer = typeof surveyAnswers.$inferSelect;
export type InsertSurveyAnswer = z.infer<typeof insertSurveyAnswerSchema>;
export type SurveyDistribution = typeof surveyDistributions.$inferSelect;
export type SurveyTemplate = typeof surveyTemplates.$inferSelect;
export type ModulePoll = typeof modulePolls.$inferSelect;
export type ModulePollVote = typeof modulePollVotes.$inferSelect;

export type SurveyWithDetails = Survey & {
  questions: SurveyQuestion[];
  responseCount: number;
  completedCount?: number;
  distributions?: SurveyDistribution[];
};

export type SurveyResponseWithAnswers = SurveyResponse & {
  answers: SurveyAnswer[];
};

export type ModulePollWithVotes = ModulePoll & {
  voteCounts: number[];
  totalVotes: number;
  votersByOption?: Record<number, { id: string | null; name: string | null }[]>;
};
