import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { tenants } from "../schema";

export const surveyStatusEnum = ["draft", "active", "closed", "archived"] as const;
export const questionTypeEnum = ["mc", "yn", "cb", "dd", "sc", "scale", "nps", "text", "para", "date", "matrix"] as const;

export const surveys = pgTable("surveys", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  category: text("category"),
  projectId: integer("project_id"),
  anonymous: boolean("anonymous").default(false),
  showProgress: boolean("show_progress").default(true),
  onePerPage: boolean("one_per_page").default(true),
  randomizeQuestions: boolean("randomize_questions").default(false),
  thankYouMessage: text("thank_you_message"),
  closedAt: timestamp("closed_at"),
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
  matrixRows: jsonb("matrix_rows").$type<string[]>().default([]),
  matrixCols: jsonb("matrix_cols").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const surveyResponses = pgTable("survey_responses", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  respondentName: text("respondent_name"),
  respondentEmail: text("respondent_email"),
  ipAddress: text("ip_address"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  timeSeconds: integer("time_seconds"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const surveyAnswers = pgTable("survey_answers", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id").notNull().references(() => surveyResponses.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => surveyQuestions.id, { onDelete: "cascade" }),
  value: jsonb("value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const surveysRelations = relations(surveys, ({ many }) => ({
  questions: many(surveyQuestions),
  responses: many(surveyResponses),
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

export const insertSurveySchema = createInsertSchema(surveys).omit({ id: true, createdAt: true, updatedAt: true, sentAt: true, closedAt: true });
export const insertSurveyQuestionSchema = createInsertSchema(surveyQuestions).omit({ id: true, createdAt: true });
export const insertSurveyResponseSchema = createInsertSchema(surveyResponses).omit({ id: true, createdAt: true, completedAt: true });
export const insertSurveyAnswerSchema = createInsertSchema(surveyAnswers).omit({ id: true, createdAt: true });

export type Survey = typeof surveys.$inferSelect;
export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type SurveyQuestion = typeof surveyQuestions.$inferSelect;
export type InsertSurveyQuestion = z.infer<typeof insertSurveyQuestionSchema>;
export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type InsertSurveyResponse = z.infer<typeof insertSurveyResponseSchema>;
export type SurveyAnswer = typeof surveyAnswers.$inferSelect;
export type InsertSurveyAnswer = z.infer<typeof insertSurveyAnswerSchema>;

export type SurveyWithDetails = Survey & {
  questions: SurveyQuestion[];
  responseCount: number;
};

export type SurveyResponseWithAnswers = SurveyResponse & {
  answers: SurveyAnswer[];
};
