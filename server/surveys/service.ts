import crypto from "crypto";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  surveys, surveyQuestions, surveyResponses, surveyAnswers,
  surveyDistributions, surveyTemplates, modulePolls, modulePollVotes,
  type Survey, type SurveyQuestion, type SurveyWithDetails,
  type SurveyResponseWithAnswers, type ModulePollWithVotes,
} from "@shared/models/surveys";
import { workspaceMembers } from "@shared/models/workspaces";
import { SYSTEM_SURVEY_TEMPLATES, LIKERT_OPTIONS } from "./system-templates";
import { notifyUser } from "../lib/user-notify";
import { sendOrgEmail } from "../lib/org-email";
import { tenants } from "@shared/schema";
import { applyLogicSkip as sharedApplyLogicSkip } from "../../shared/survey-logic";

function genToken() {
  return crypto.randomBytes(16).toString("hex");
}

function genShortToken() {
  return crypto.randomBytes(6).toString("base64url").slice(0, 8);
}

async function attachSurveyDetails(rows: Survey[]): Promise<SurveyWithDetails[]> {
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.id);
  const questions = await db.select().from(surveyQuestions)
    .where(inArray(surveyQuestions.surveyId, ids))
    .orderBy(surveyQuestions.questionOrder);
  const responseCounts = await db.select({
    surveyId: surveyResponses.surveyId,
    count: sql<number>`cast(count(*) as int)`,
    completed: sql<number>`cast(count(*) filter (where ${surveyResponses.isComplete} = true) as int)`,
  }).from(surveyResponses).where(inArray(surveyResponses.surveyId, ids)).groupBy(surveyResponses.surveyId);

  const countMap = new Map(responseCounts.map(r => [r.surveyId, r.count]));
  const completedMap = new Map(responseCounts.map(r => [r.surveyId, r.completed]));
  const questionMap = new Map<number, SurveyQuestion[]>();
  for (const q of questions) {
    if (!questionMap.has(q.surveyId)) questionMap.set(q.surveyId, []);
    questionMap.get(q.surveyId)!.push(q);
  }
  return rows.map(r => ({
    ...r,
    questions: questionMap.get(r.id) ?? [],
    responseCount: countMap.get(r.id) ?? 0,
    completedCount: completedMap.get(r.id) ?? 0,
  }));
}

export async function ensureSystemTemplates() {
  for (const tpl of SYSTEM_SURVEY_TEMPLATES) {
    const settingsJson = {
      ...(("settings" in tpl && tpl.settings) ? tpl.settings : {}),
      ...(("locked" in tpl && tpl.locked) ? { locked: true } : {}),
    };
    const [existing] = await db.select().from(surveyTemplates)
      .where(and(eq(surveyTemplates.tier, "system"), eq(surveyTemplates.title, tpl.title)))
      .limit(1);
    if (existing) {
      if ("locked" in tpl && tpl.locked) {
        await db.update(surveyTemplates)
          .set({ settingsJson, description: tpl.description, questionsJson: tpl.questions as unknown as Record<string, unknown>[] })
          .where(eq(surveyTemplates.id, existing.id));
      }
      continue;
    }
    await db.insert(surveyTemplates).values({
      tenantId: null,
      title: tpl.title,
      description: tpl.description,
      surveyType: tpl.surveyType,
      category: tpl.category,
      tier: "system",
      questionsJson: tpl.questions as unknown as Record<string, unknown>[],
      settingsJson,
    });
  }
}

export async function listSurveys(tenantId: number, workspaceId?: number | null) {
  const conditions = workspaceId != null
    ? and(eq(surveys.tenantId, tenantId), or(eq(surveys.workspaceId, workspaceId), isNull(surveys.workspaceId)))
    : eq(surveys.tenantId, tenantId);
  const rows = await db.select().from(surveys).where(conditions).orderBy(desc(surveys.createdAt));
  return attachSurveyDetails(rows);
}

export async function getSurveyById(id: number) {
  const rows = await db.select().from(surveys).where(eq(surveys.id, id));
  if (!rows.length) return undefined;
  const [result] = await attachSurveyDetails(rows);
  const distributions = await db.select().from(surveyDistributions).where(eq(surveyDistributions.surveyId, id));
  return { ...result, distributions };
}

export async function getSurveyByToken(token: string) {
  const rows = await db.select().from(surveys).where(eq(surveys.token, token));
  if (!rows.length) return undefined;
  const [result] = await attachSurveyDetails(rows);
  const distributions = await db.select().from(surveyDistributions).where(eq(surveyDistributions.surveyId, result.id));
  return { ...result, distributions };
}

/** Restrict portal access when allowExternal is false (invited users / org members only). */
export async function assertSurveyPortalAccess(
  survey: SurveyWithDetails & { distributions?: typeof surveyDistributions.$inferSelect[] },
  opts: { userId?: string | null; email?: string | null },
) {
  if (survey.allowExternal !== false) return;

  const userId = opts.userId?.trim() || null;
  const email = opts.email?.trim().toLowerCase() || null;

  if (survey.createdBy && userId === survey.createdBy) return;

  const distributions = survey.distributions ?? await db
    .select()
    .from(surveyDistributions)
    .where(eq(surveyDistributions.surveyId, survey.id));

  for (const d of distributions) {
    const userIds = (d.targetUserIds as string[] | null) ?? [];
    if (userId && userIds.includes(userId)) return;
    const emails = ((d.targetEmails as string[] | null) ?? []).map(e => e.trim().toLowerCase());
    if (email && emails.includes(email)) return;
  }

  throw new Error("This survey is restricted to invited participants. Sign in or use the email address you were invited with.");
}

export async function createSurvey(data: Partial<Survey> & { tenantId: number; token?: string }) {
  const [row] = await db.insert(surveys).values({
    ...data,
    token: data.token ?? genToken(),
  } as typeof surveys.$inferInsert).returning();
  return row;
}

export async function updateSurvey(id: number, data: Partial<Survey>) {
  const [row] = await db.update(surveys).set({ ...data, updatedAt: new Date() }).where(eq(surveys.id, id)).returning();
  return row;
}

export async function deleteSurvey(id: number) {
  await db.delete(surveys).where(eq(surveys.id, id));
}

export async function archiveSurvey(id: number, archive: boolean) {
  return updateSurvey(id, {
    status: archive ? "archived" : "closed",
    archivedAt: archive ? new Date() : null,
  } as Partial<Survey>);
}

export async function duplicateSurvey(id: number, userId?: string, userName?: string) {
  const original = await getSurveyById(id);
  if (!original) return null;
  const copy = await createSurvey({
    tenantId: original.tenantId,
    workspaceId: original.workspaceId,
    title: `${original.title} (copy)`,
    description: original.description,
    surveyType: original.surveyType,
    status: "draft",
    category: original.category,
    projectId: original.projectId,
    anonymous: original.anonymous,
    showProgress: original.showProgress,
    onePerPage: original.onePerPage,
    randomizeQuestions: original.randomizeQuestions,
    allowMultipleResponses: original.allowMultipleResponses,
    showResultsToRespondents: original.showResultsToRespondents,
    allowExternal: original.allowExternal,
    thankYouMessage: original.thankYouMessage,
    closeDate: original.closeDate,
    createdBy: userId ?? null,
    createdByName: userName ?? null,
  });
  for (let i = 0; i < original.questions.length; i++) {
    const { id: _id, createdAt: _c, ...q } = original.questions[i];
    await db.insert(surveyQuestions).values({ ...q, surveyId: copy.id, questionOrder: i + 1 });
  }
  return getSurveyById(copy.id);
}

export async function duplicateQuestion(questionId: number) {
  const [q] = await db.select().from(surveyQuestions).where(eq(surveyQuestions.id, questionId));
  if (!q) return null;
  const existing = await db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, q.surveyId));
  const { id: _id, createdAt: _c, ...data } = q;
  const [created] = await db.insert(surveyQuestions).values({
    ...data,
    text: `${data.text} (copy)`,
    questionOrder: existing.length + 1,
  }).returning();
  return created;
}

export async function createQuestion(surveyId: number, data: Partial<SurveyQuestion>) {
  const existing = await db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, surveyId));
  const type = data.type ?? "mc";
  const defaults: Partial<SurveyQuestion> = {
    type,
    text: data.text ?? "New question",
    options: data.options ?? (type === "likert" ? LIKERT_OPTIONS : type === "mc" ? ["Option 1", "Option 2"] : []),
    matrixCols: type === "likert" ? LIKERT_OPTIONS : data.matrixCols ?? [],
    scaleMin: type === "nps" ? 0 : 1,
    scaleMax: type === "nps" ? 10 : type === "sc" ? 5 : 10,
    maxLength: type === "text" ? 200 : type === "para" ? 2000 : null,
    ratingDisplay: type === "sc" ? "stars" : "numbers",
    required: data.required ?? true,
    questionOrder: existing.length + 1,
    surveyId,
  };
  const [row] = await db.insert(surveyQuestions).values({ ...defaults, ...data, surveyId } as typeof surveyQuestions.$inferInsert).returning();
  return row;
}

export async function bulkCreateQuestions(surveyId: number, questions: Partial<SurveyQuestion>[]) {
  const existing = await db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, surveyId));
  let order = existing.length;
  const created = [];
  for (const q of questions) {
    order += 1;
    const type = q.type ?? "text";
    const [row] = await db.insert(surveyQuestions).values({
      surveyId,
      type,
      text: q.text ?? "Question",
      helpText: q.helpText ?? null,
      options: q.options ?? (type === "likert" ? LIKERT_OPTIONS : []),
      required: q.required ?? true,
      allowOther: false,
      randomizeOptions: false,
      questionOrder: order,
      scaleMin: (q as { scaleMin?: number }).scaleMin ?? (type === "nps" ? 0 : 1),
      scaleMax: (q as { scaleMax?: number }).scaleMax ?? (type === "nps" ? 10 : type === "sc" ? 5 : 10),
      scaleMinLabel: (q as { scaleMinLabel?: string }).scaleMinLabel ?? null,
      scaleMaxLabel: (q as { scaleMaxLabel?: string }).scaleMaxLabel ?? null,
      ratingDisplay: (q as { ratingDisplay?: string }).ratingDisplay ?? (type === "sc" ? "stars" : "numbers"),
      maxLength: type === "text" ? 200 : type === "para" ? 2000 : null,
      isSection: type === "section",
      logicJson: [],
      matrixRows: [],
      matrixCols: type === "likert" ? LIKERT_OPTIONS : [],
    }).returning();
    created.push(row);
  }
  return created;
}

export async function getResponses(surveyId: number): Promise<SurveyResponseWithAnswers[]> {
  return storage.getSurveyResponses(surveyId);
}

export async function submitResponse(params: {
  survey: SurveyWithDetails;
  respondentName?: string | null;
  respondentEmail?: string | null;
  respondentUserId?: string | null;
  answers: { questionId: number; value: unknown; fileUrl?: string }[];
  timeSeconds: number;
  ipAddress?: string;
}) {
  const { survey } = params;
  if (!survey.allowMultipleResponses && params.respondentUserId) {
    const [existing] = await db.select().from(surveyResponses)
      .where(and(
        eq(surveyResponses.surveyId, survey.id),
        eq(surveyResponses.respondentUserId, params.respondentUserId),
        eq(surveyResponses.isComplete, true),
      )).limit(1);
    if (existing) throw new Error("You have already submitted a response to this survey.");
  }
  const [response] = await db.insert(surveyResponses).values({
    surveyId: survey.id,
    respondentName: survey.anonymous ? null : (params.respondentName ?? null),
    respondentEmail: survey.anonymous ? null : (params.respondentEmail ?? null),
    respondentUserId: survey.anonymous ? null : (params.respondentUserId ?? null),
    ipAddress: params.ipAddress ?? null,
    sessionToken: genToken(),
    isComplete: true,
    completedAt: new Date(),
    timeSeconds: params.timeSeconds,
  }).returning();

  for (const a of params.answers) {
    if (a.questionId && a.value !== undefined) {
      await db.insert(surveyAnswers).values({
        responseId: response.id,
        questionId: a.questionId,
        value: a.value,
        fileUrl: a.fileUrl ?? null,
      });
    }
  }
  return response;
}

export async function getSurveyResultsSummary(surveyId: number) {
  const survey = await getSurveyById(surveyId);
  if (!survey) return null;
  const responses = await getResponses(surveyId);
  const completed = responses.filter(r => r.isComplete || r.completedAt);
  const partial = responses.filter(r => !r.isComplete && !r.completedAt && r.startedAt);
  const distributions = await db.select().from(surveyDistributions).where(eq(surveyDistributions.surveyId, surveyId));
  const invitedUserIds = new Set<string>();
  for (const d of distributions) {
    for (const uid of (d.targetUserIds as string[] | null) ?? []) {
      if (uid) invitedUserIds.add(uid);
    }
  }
  const completedUserIds = new Set(completed.map(r => r.respondentUserId).filter(Boolean) as string[]);
  const partialUserIds = new Set(partial.map(r => r.respondentUserId).filter(Boolean) as string[]);
  const invitees = [...invitedUserIds].map(userId => ({
    userId,
    status: completedUserIds.has(userId) ? "completed" as const
      : partialUserIds.has(userId) ? "partial" as const
      : "not_started" as const,
  }));
  return {
    survey,
    totalResponses: responses.length,
    completed: completed.length,
    partial: partial.length,
    notStarted: Math.max(0, (survey.invitedCount ?? 0) - responses.length),
    invited: survey.invitedCount ?? 0,
    responses: completed,
    invitees,
    distributions,
  };
}

export async function createSurveyFromTemplate(params: {
  templateId: number;
  tenantId: number;
  userId: string;
  userName?: string;
  workspaceId?: number | null;
}) {
  const [tpl] = await db.select().from(surveyTemplates).where(eq(surveyTemplates.id, params.templateId));
  if (!tpl) throw new Error("Template not found");

  const settings = (tpl.settingsJson ?? {}) as Record<string, unknown>;
  const survey = await createSurvey({
    tenantId: params.tenantId,
    workspaceId: params.workspaceId ?? null,
    title: tpl.title,
    description: tpl.description,
    surveyType: tpl.surveyType,
    category: tpl.category,
    status: "draft",
    anonymous: Boolean(settings.anonymous),
    showProgress: settings.showProgress !== false,
    onePerPage: settings.onePerPage !== false,
    randomizeQuestions: Boolean(settings.randomizeQuestions),
    allowMultipleResponses: Boolean(settings.allowMultipleResponses),
    showResultsToRespondents: Boolean(settings.showResultsToRespondents),
    createdBy: params.userId,
    createdByName: params.userName ?? null,
  });

  const questions = (tpl.questionsJson ?? []) as Partial<SurveyQuestion>[];
  if (questions.length) {
    await bulkCreateQuestions(survey.id, questions);
  }
  return getSurveyById(survey.id);
}

export async function distributeSurvey(params: {
  surveyId: number;
  type: string;
  userId: string;
  tenantId?: number;
  targetUserIds?: string[];
  targetEmails?: string[];
  reminderDays?: number;
  workspaceId?: number;
}) {
  const survey = await getSurveyById(params.surveyId);
  if (!survey) throw new Error("Survey not found");

  let invited = 0;
  const notifyIds: string[] = [];
  const reminderAt = params.reminderDays && survey.closeDate
    ? new Date(new Date(survey.closeDate).getTime() - params.reminderDays * 86400000)
    : null;
  const link = `/survey/${survey.token}`;

  if (params.type === "workspace") {
    if (!params.workspaceId) {
      throw new Error("Workspace distribution requires a workspace to be selected");
    }
    const members = await db.select().from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, params.workspaceId));
    if (members.length === 0) {
      throw new Error("Selected workspace has no members to invite");
    }
    invited = members.length;
    notifyIds.push(...members.map(m => m.userId));
    await db.insert(surveyDistributions).values({
      surveyId: params.surveyId,
      distributionType: "workspace",
      targetUserIds: members.map(m => m.userId),
      sentAt: new Date(),
      reminderAt,
      createdBy: params.userId,
    });
  } else if (params.type === "specific_users") {
    const userIds = params.targetUserIds ?? [];
    const emails = params.targetEmails ?? [];
    invited = userIds.length + emails.length;
    notifyIds.push(...userIds);
    await db.insert(surveyDistributions).values({
      surveyId: params.surveyId,
      distributionType: "specific_users",
      targetUserIds: userIds,
      targetEmails: emails,
      sentAt: new Date(),
      reminderAt,
      createdBy: params.userId,
    });
  } else {
    await db.insert(surveyDistributions).values({
      surveyId: params.surveyId,
      distributionType: params.type,
      sentAt: new Date(),
      reminderAt,
      createdBy: params.userId,
    });
  }

  if (invited > 0) {
    await updateSurvey(params.surveyId, { invitedCount: (survey.invitedCount ?? 0) + invited } as Partial<Survey>);
  }

  const tenantId = params.tenantId ?? survey.tenantId;
  for (const uid of notifyIds) {
    if (uid === params.userId) continue;
    await notifyUser({
      userId: uid,
      tenantId,
      title: `Survey invitation: ${survey.title}`,
      message: `You have been invited to complete "${survey.title}".`,
      category: "surveys",
      source: "surveys",
      sourceId: String(survey.id),
      emailSubject: `Survey invitation: ${survey.title}`,
    }).catch(() => undefined);
  }

  const emails = params.type === "specific_users" ? (params.targetEmails ?? []) : [];
  if (emails.length > 0) {
    const [tenantRow] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const baseUrl = process.env.APP_URL?.trim() || process.env.PUBLIC_APP_URL?.trim() || "http://localhost:5000";
    const surveyUrl = `${baseUrl.replace(/\/$/, "")}/survey/${survey.token}`;
    const html = `
      <p>You have been invited to complete the survey <strong>${survey.title}</strong>.</p>
      <p><a href="${surveyUrl}">Open survey</a></p>
      <p style="color:#666;font-size:12px">If the link does not work, copy and paste: ${surveyUrl}</p>
    `;
    for (const email of emails) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes("@")) continue;
      await sendOrgEmail({
        tenant: tenantRow ?? null,
        to: trimmed,
        subject: `Survey invitation: ${survey.title}`,
        html,
      }).catch(() => undefined);
    }
  }

  return { success: true, invited, link };
}

export async function listTemplates(tenantId: number) {
  await ensureSystemTemplates();
  return db.select().from(surveyTemplates)
    .where(or(isNull(surveyTemplates.tenantId), eq(surveyTemplates.tenantId, tenantId), eq(surveyTemplates.tier, "system")))
    .orderBy(surveyTemplates.tier, surveyTemplates.title);
}

export async function saveAsTemplate(params: {
  surveyId: number;
  tenantId: number;
  userId: string;
  title?: string;
}) {
  const survey = await getSurveyById(params.surveyId);
  if (!survey) throw new Error("Survey not found");
  const [tpl] = await db.insert(surveyTemplates).values({
    tenantId: params.tenantId,
    title: params.title ?? survey.title,
    description: survey.description,
    surveyType: survey.surveyType,
    category: survey.category,
    tier: "customer",
    questionsJson: survey.questions.map(({ id: _id, surveyId: _s, createdAt: _c, ...q }) => q) as unknown as Record<string, unknown>[],
    settingsJson: {
      anonymous: survey.anonymous,
      showProgress: survey.showProgress,
      onePerPage: survey.onePerPage,
      randomizeQuestions: survey.randomizeQuestions,
    },
    createdBy: params.userId,
  }).returning();
  return tpl;
}

export async function submitTemplateForReview(templateId: number) {
  const [row] = await db.update(surveyTemplates)
    .set({ submissionStatus: "pending", updatedAt: new Date() })
    .where(eq(surveyTemplates.id, templateId))
    .returning();
  return row;
}

// ─── Polls ───────────────────────────────────────────────────────────────────

export async function listPolls(tenantId: number, workspaceId?: number | null, projectId?: number | null) {
  const parts = [eq(modulePolls.tenantId, tenantId)];
  if (workspaceId != null) {
    parts.push(or(eq(modulePolls.workspaceId, workspaceId), isNull(modulePolls.workspaceId))!);
  }
  if (projectId != null) {
    parts.push(eq(modulePolls.projectId, projectId));
  }
  const conditions = parts.length === 1 ? parts[0] : and(...parts);
  return db.select().from(modulePolls).where(conditions).orderBy(desc(modulePolls.createdAt));
}

async function attachPollVotes(
  poll: typeof modulePolls.$inferSelect,
  viewerId?: string,
  voterSession?: string,
): Promise<ModulePollWithVotes & { myVote?: number[] }> {
  const votes = await db.select().from(modulePollVotes).where(eq(modulePollVotes.pollId, poll.id));
  const options = (poll.options as string[]) ?? [];
  const voteCounts = options.map((_, i) => votes.filter(v => (v.optionIndexes as number[]).includes(i)).length);
  const votersByOption: Record<number, { id: string | null; name: string | null }[]> = {};
  if (!poll.anonymous) {
    options.forEach((_, i) => {
      votersByOption[i] = votes
        .filter(v => (v.optionIndexes as number[]).includes(i))
        .map(v => ({ id: v.voterId, name: v.voterName }));
    });
  }
  const sessionKey = voterSession ? `anon:${voterSession}` : null;
  const myVote = viewerId
    ? votes.find(v => v.voterId === viewerId)?.optionIndexes as number[] | undefined
    : sessionKey
      ? votes.find(v => v.voterName === sessionKey)?.optionIndexes as number[] | undefined
      : undefined;
  const isClosed = poll.status === "closed" || (poll.closeAt ? new Date(poll.closeAt) < new Date() : false);
  return {
    ...poll,
    options,
    voteCounts,
    totalVotes: votes.length,
    votersByOption,
    myVote,
    isClosed,
  } as ModulePollWithVotes & { myVote?: number[]; isClosed?: boolean };
}

export async function getPollByToken(token: string, viewerId?: string, voterSession?: string) {
  const [poll] = await db.select().from(modulePolls).where(eq(modulePolls.token, token));
  if (!poll) return undefined;
  return attachPollVotes(poll, viewerId, voterSession);
}

export async function getPollById(id: number, viewerId?: string, voterSession?: string) {
  const [poll] = await db.select().from(modulePolls).where(eq(modulePolls.id, id));
  if (!poll) return undefined;
  return attachPollVotes(poll, viewerId, voterSession);
}

export async function createPoll(data: Partial<typeof modulePolls.$inferInsert> & { tenantId: number; question: string; options: string[] }) {
  const [row] = await db.insert(modulePolls).values({
    ...data,
    question: data.question,
    token: data.token ?? genShortToken(),
    options: data.options,
  }).returning();
  return row;
}

export async function castPollVote(params: {
  pollId: number;
  voterId?: string;
  voterName?: string;
  voterSession?: string;
  optionIndexes: number[];
}) {
  const poll = await getPollById(params.pollId);
  if (!poll) throw new Error("Poll not found");
  if ((poll as { isClosed?: boolean }).isClosed) throw new Error("Poll is closed");

  if (params.voterId) {
    const [existing] = await db.select().from(modulePollVotes)
      .where(and(eq(modulePollVotes.pollId, params.pollId), eq(modulePollVotes.voterId, params.voterId)));
    if (existing && !poll.allowVoteChange) throw new Error("Vote change not allowed");
    if (existing) {
      await db.update(modulePollVotes).set({ optionIndexes: params.optionIndexes, votedAt: new Date() })
        .where(eq(modulePollVotes.id, existing.id));
    } else {
      await db.insert(modulePollVotes).values({
        pollId: params.pollId,
        voterId: params.voterId,
        voterName: poll.anonymous ? null : params.voterName,
        optionIndexes: params.optionIndexes,
      });
    }
  } else if (params.voterSession) {
    const sessionKey = `anon:${params.voterSession}`;
    const [existing] = await db.select().from(modulePollVotes)
      .where(and(eq(modulePollVotes.pollId, params.pollId), eq(modulePollVotes.voterName, sessionKey)));
    if (existing && !poll.allowVoteChange) throw new Error("Vote change not allowed");
    if (existing) {
      await db.update(modulePollVotes).set({ optionIndexes: params.optionIndexes, votedAt: new Date() })
        .where(eq(modulePollVotes.id, existing.id));
    } else {
      await db.insert(modulePollVotes).values({
        pollId: params.pollId,
        voterId: null,
        voterName: sessionKey,
        optionIndexes: params.optionIndexes,
      });
    }
  } else {
    await db.insert(modulePollVotes).values({
      pollId: params.pollId,
      voterId: null,
      voterName: null,
      optionIndexes: params.optionIndexes,
    });
  }
  return getPollById(params.pollId, params.voterId, params.voterSession);
}

export async function postPollCloseSummary(poll: typeof modulePolls.$inferSelect) {
  if (!poll.chatPollId || !poll.chatChannelId) return;
  const full = await attachPollVotes(poll);
  const { chatMessages, chatPolls } = await import("@shared/models/chat");
  const now = new Date();
  await db.update(chatPolls).set({ closedAt: now }).where(eq(chatPolls.id, poll.chatPollId));

  const maxCount = full.voteCounts.length ? Math.max(...full.voteCounts) : 0;
  const winners = full.options.filter((_, i) => full.voteCounts[i] === maxCount && maxCount > 0);
  const winnerText = maxCount === 0
    ? "No votes recorded"
    : winners.length === 1
      ? `"${winners[0]}" won with ${maxCount} vote${maxCount !== 1 ? "s" : ""} (${Math.round((maxCount / (full.totalVotes || 1)) * 100)}%)`
      : `Tie: ${winners.map(w => `"${w}"`).join(", ")} (${maxCount} votes each)`;
  const content = `[Poll closed] ${poll.question} — ${winnerText}`;

  if (!poll.createdBy) return;
  const [message] = await db.insert(chatMessages).values({
    channelId: poll.chatChannelId,
    userId: poll.createdBy,
    content,
    messageType: "system",
  }).returning();

  try {
    const { getChatWebSocket } = await import("../websocket");
    const wss = getChatWebSocket();
    if (wss) wss.sendToChannel(poll.chatChannelId, { type: "message", payload: { channelId: poll.chatChannelId, messageId: message.id } });
  } catch { /* ws optional */ }
}

export async function closePoll(id: number) {
  const [poll] = await db.select().from(modulePolls).where(eq(modulePolls.id, id));
  if (!poll) throw new Error("Poll not found");
  if (poll.status === "closed") return [poll];
  const [closed] = await db.update(modulePolls).set({ status: "closed", closeAt: new Date() }).where(eq(modulePolls.id, id)).returning();
  await postPollCloseSummary(closed);
  return [closed];
}

// ─── Background jobs ─────────────────────────────────────────────────────────

export async function autoCloseExpiredSurveys() {
  const now = new Date();
  const expired = await db.select().from(surveys)
    .where(and(eq(surveys.status, "active"), lte(surveys.closeDate, now)));
  for (const s of expired) {
    await updateSurvey(s.id, { status: "closed", closedAt: now });
  }
  const expiredPolls = await db.select().from(modulePolls)
    .where(and(eq(modulePolls.status, "active"), lte(modulePolls.closeAt, now)));
  for (const p of expiredPolls) {
    try {
      await closePoll(p.id);
    } catch { /* already closed */ }
  }
  return { surveysClosed: expired.length, pollsClosed: expiredPolls.length };
}

export async function sendSurveyReminders() {
  const now = new Date();
  const due = await db.select().from(surveyDistributions)
    .where(and(
      lte(surveyDistributions.reminderAt, now),
      isNull(surveyDistributions.reminderSentAt),
    ));
  for (const d of due) {
    await db.update(surveyDistributions).set({ reminderSentAt: now }).where(eq(surveyDistributions.id, d.id));
    const survey = await getSurveyById(d.surveyId);
    if (!survey || survey.status !== "active") continue;
    const targetIds = (d.targetUserIds as string[] | null) ?? [];
    const responses = await db.select({ userId: surveyResponses.respondentUserId })
      .from(surveyResponses)
      .where(and(eq(surveyResponses.surveyId, survey.id), eq(surveyResponses.isComplete, true)));
    const completed = new Set(responses.map(r => r.userId).filter(Boolean));
    for (const uid of targetIds) {
      if (!uid || completed.has(uid)) continue;
      await notifyUser({
        userId: uid,
        tenantId: survey.tenantId,
        title: `Reminder: ${survey.title}`,
        message: `Please complete the survey "${survey.title}" before it closes.`,
        category: "surveys",
        source: "surveys",
        sourceId: String(survey.id),
        emailSubject: `Reminder: ${survey.title}`,
      }).catch(() => undefined);
    }
  }
  return due.length;
}

/** Mirror a chat poll into module_polls for Surveys → Polls tab visibility. */
export async function syncChatPollToModule(params: {
  chatPollId: number;
  channelId: number;
  tenantId: number;
  question: string;
  options: string[];
  anonymous: boolean;
  closedAt: Date;
  createdBy: string;
  createdByName?: string;
  pollType?: string;
  showResultsToVoters?: boolean;
  allowVoteChange?: boolean;
}) {
  const existing = await db.select().from(modulePolls).where(eq(modulePolls.chatPollId, params.chatPollId)).limit(1);
  if (existing.length) return existing[0];

  return createPoll({
    tenantId: params.tenantId,
    chatChannelId: params.channelId,
    chatPollId: params.chatPollId,
    question: params.question,
    options: params.options,
    anonymous: params.anonymous,
    closeAt: params.closedAt,
    createdBy: params.createdBy,
    createdByName: params.createdByName,
    pollType: params.pollType ?? "single",
    showResultsToVoters: params.showResultsToVoters ?? true,
    allowVoteChange: params.allowVoteChange ?? false,
    status: "active",
  });
}

export function orderQuestionsForRespondent(questions: SurveyQuestion[], randomize: boolean) {
  const ordered = [...questions].sort((a, b) => a.questionOrder - b.questionOrder);
  if (!randomize) return ordered.filter(q => q.type !== "section" || q.isSection);
  const nonSection = ordered.filter(q => q.type !== "section" && !q.isSection);
  for (let i = nonSection.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nonSection[i], nonSection[j]] = [nonSection[j], nonSection[i]];
  }
  return nonSection;
}

export function applyLogicSkip(questions: SurveyQuestion[], answers: Record<number, unknown>, currentIndex: number): number {
  return sharedApplyLogicSkip(questions, answers, currentIndex);
}
