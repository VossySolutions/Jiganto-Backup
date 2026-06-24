import type { Express, Request } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireApiTenantId } from "../lib/api-tenant-id";
import { resolveListClientId } from "../lib/list-client-id";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import { storage } from "../storage";
import * as surveyService from "./service";

function isAuth(req: Request) {
  return isRequestAuthenticated(req);
}

function getUser(req: Request) {
  return req.user as { id?: string; claims?: { sub?: string }; firstName?: string; lastName?: string; email?: string; tenantId?: number };
}

function userId(req: Request) {
  const u = getUser(req);
  return u.id ?? u.claims?.sub ?? "";
}

function userName(req: Request) {
  const u = getUser(req);
  return u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email ?? "Unknown");
}

function workspaceId(req: Request) {
  return resolveListClientId(req) ?? null;
}

async function handleSurveyFileUpload(req: any, res: any) {
  const multer = (await import("multer")).default;
  const dir = path.join(process.cwd(), "uploads", "surveys");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_r, _f, cb) => cb(null, dir),
      filename: (_r, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_r, file, cb) => {
      const ok = /\.(pdf|png|jpe?g|gif|webp|docx?|xlsx?)$/i.test(file.originalname);
      cb(null, ok);
    },
  }).single("file");
  upload(req, res, (err: unknown) => {
    if (err) return res.status(400).json({ message: err instanceof Error ? err.message : "Upload failed" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({ url: `/uploads/surveys/${req.file.filename}`, name: req.file.originalname });
  });
}

export function registerSurveyRoutes(app: Express) {
  // File upload for survey responses (authenticated)
  app.post("/api/surveys/upload", async (req: any, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    await handleSurveyFileUpload(req, res);
  });

  // Public file upload scoped to survey token
  app.post("/api/surveys/by-token/:token/upload", async (req: any, res) => {
    try {
      const survey = await surveyService.getSurveyByToken(req.params.token);
      if (!survey) return res.status(404).json({ message: "Survey not found" });
      if (survey.status !== "active") return res.status(410).json({ message: "Survey is closed" });
      try {
        await surveyService.assertSurveyPortalAccess(survey, {
          userId: isAuth(req) ? userId(req) : null,
        });
      } catch (e: unknown) {
        return res.status(403).json({ message: (e as Error).message });
      }
      await handleSurveyFileUpload(req, res);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  // ── Public survey portal ────────────────────────────────────────────────────
  app.get("/api/surveys/by-token/:token", async (req, res) => {
    try {
      const survey = await surveyService.getSurveyByToken(req.params.token);
      if (!survey) return res.status(404).json({ message: "Survey not found" });
      if (survey.status !== "active") return res.status(410).json({ message: "Survey is not active" });
      try {
        await surveyService.assertSurveyPortalAccess(survey, {
          userId: isAuth(req) ? userId(req) : null,
        });
      } catch (e: unknown) {
        return res.status(403).json({ message: (e as Error).message });
      }
      const { createdBy, distributions: _d, ...pub } = survey as Record<string, unknown>;
      res.json(pub);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/surveys/by-token/:token/results", async (req, res) => {
    try {
      const survey = await surveyService.getSurveyByToken(req.params.token);
      if (!survey) return res.status(404).json({ message: "Not found" });
      if (!survey.showResultsToRespondents) return res.status(403).json({ message: "Results not shared" });
      try {
        await surveyService.assertSurveyPortalAccess(survey, {
          userId: isAuth(req) ? userId(req) : null,
        });
      } catch (e: unknown) {
        return res.status(403).json({ message: (e as Error).message });
      }
      const summary = await surveyService.getSurveyResultsSummary(survey.id);
      res.json(summary);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/by-token/:token/respond", async (req, res) => {
    try {
      const survey = await surveyService.getSurveyByToken(req.params.token);
      if (!survey) return res.status(404).json({ message: "Survey not found" });
      if (survey.status !== "active") return res.status(410).json({ message: "Survey is closed" });
      const { respondentName, respondentEmail, answers, timeSeconds } = req.body;
      try {
        await surveyService.assertSurveyPortalAccess(survey, {
          userId: isAuth(req) ? userId(req) : null,
          email: respondentEmail,
        });
      } catch (e: unknown) {
        return res.status(403).json({ message: (e as Error).message });
      }
      const response = await surveyService.submitResponse({
        survey,
        respondentName,
        respondentEmail,
        respondentUserId: isAuth(req) ? userId(req) : null,
        answers: answers ?? [],
        timeSeconds: timeSeconds ?? 0,
        ipAddress: req.ip,
      });
      try {
        const { processCsatSurveyResponse } = await import("../help-desk/csat");
        await processCsatSurveyResponse(survey.id, survey.category);
      } catch { /* optional hook */ }
      res.json({ success: true, responseId: response.id });
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  // ── Public poll portal ──────────────────────────────────────────────────────
  app.get("/api/polls/by-token/:token", async (req, res) => {
    try {
      const voterSession = typeof req.query.voterSession === "string" ? req.query.voterSession : undefined;
      const poll = await surveyService.getPollByToken(
        req.params.token,
        isAuth(req) ? userId(req) : undefined,
        voterSession,
      );
      if (!poll) return res.status(404).json({ message: "Poll not found" });
      res.json(poll);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/polls/by-token/:token/vote", async (req, res) => {
    try {
      const voterSession = typeof req.body.voterSession === "string" ? req.body.voterSession : undefined;
      const authed = isAuth(req);
      const poll = await surveyService.getPollByToken(req.params.token);
      if (!poll) return res.status(404).json({ message: "Poll not found" });
      if (!authed && !poll.anonymous) return res.status(401).json({ message: "Sign in to vote on this poll" });
      if (!authed && poll.anonymous && !voterSession) {
        return res.status(400).json({ message: "voterSession required for anonymous polls" });
      }
      const { optionIndexes } = req.body;
      const indexes = Array.isArray(optionIndexes) ? optionIndexes : [Number(req.body.optionIndex)];
      const updated = await surveyService.castPollVote({
        pollId: poll.id,
        voterId: authed ? userId(req) : undefined,
        voterName: authed ? userName(req) : undefined,
        voterSession: authed ? undefined : voterSession,
        optionIndexes: indexes,
      });
      res.json(updated);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  // ── Authenticated survey CRUD ─────────────────────────────────────────────
  app.get("/api/surveys", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const wsId = workspaceId(req);
      const list = await surveyService.listSurveys(tenantId, wsId);
      res.json(list);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/surveys/templates", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const templates = await surveyService.listTemplates(tenantId);
      res.json(templates);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  // Module polls (must register before /api/surveys/:id)
  app.get("/api/surveys/polls", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      const polls = await surveyService.listPolls(tenantId, workspaceId(req), projectId);
      res.json(polls);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/surveys/ai-status", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      const { ensureAiTokenBalance, checkAiTokenAllowance } = await import("../lib/ai-tokens");
      const balance = await ensureAiTokenBalance(tenantId);
      const check = await checkAiTokenAllowance({ orgId: tenantId, userId: uid, module: "surveys", estimatedTokens: 1 });
      res.json({
        balance: balance.balance,
        monthlyAllocation: balance.monthlyAllocation,
        allowed: check.allowed,
        empty: balance.balance <= 0,
      });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/surveys/polls/:id", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const poll = await surveyService.getPollById(Number(req.params.id), userId(req));
      if (!poll) return res.status(404).json({ message: "Not found" });
      res.json(poll);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/polls", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const { question, options, pollType, durationMinutes, anonymous, showResultsToVoters, allowVoteChange, projectId, workspaceId: wsId } = req.body;
      const closeAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60000) : req.body.closeAt ? new Date(req.body.closeAt) : null;
      const poll = await surveyService.createPoll({
        tenantId,
        workspaceId: wsId ?? workspaceId(req),
        projectId: projectId ?? null,
        question,
        options,
        pollType: pollType ?? "single",
        anonymous: anonymous ?? false,
        showResultsToVoters: showResultsToVoters ?? true,
        allowVoteChange: allowVoteChange ?? false,
        closeAt,
        createdBy: userId(req),
        createdByName: userName(req),
      });
      res.json(poll);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/polls/:id/vote", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const indexes = Array.isArray(req.body.optionIndexes) ? req.body.optionIndexes : [Number(req.body.optionIndex)];
      const updated = await surveyService.castPollVote({
        pollId: Number(req.params.id),
        voterId: userId(req),
        voterName: userName(req),
        optionIndexes: indexes,
      });
      res.json(updated);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/polls/:id/close", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const [poll] = await surveyService.closePoll(Number(req.params.id));
      res.json(poll);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/ai-generate", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      const { checkAiTokenAllowance, recordAiTokenUsage } = await import("../lib/ai-tokens");
      const check = await checkAiTokenAllowance({ orgId: tenantId, userId: uid, module: "surveys", estimatedTokens: 800 });
      if (!check.allowed) return res.status(402).json({ message: check.reason });

      const { getOpenAIConfig } = await import("../lib/openai");
      const { apiKey, baseURL } = getOpenAIConfig();
      if (!apiKey) return res.status(503).json({ message: "AI not configured" });
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey, baseURL });
      const { description, count = 8 } = req.body;
      if (!description?.trim()) return res.status(400).json({ message: "Description required" });

      const prompt = `Generate ${count} professional survey questions for: "${description}"
Return JSON: { "questions": [{ "text", "type" (mc|scale|nps|text|para|yn|sc|likert|cb|date), "options" (array if mc/cb), "required", "helpText" }] }`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      const raw = completion.choices[0].message.content ?? "{}";
      const parsed = JSON.parse(raw);
      const questions = Array.isArray(parsed) ? parsed : (parsed.questions ?? parsed.items ?? []);
      const tokens = completion.usage?.total_tokens ?? 500;
      await recordAiTokenUsage({ orgId: tenantId, userId: uid, module: "surveys", featureName: "survey_generate", tokensConsumed: tokens });
      res.json({ questions });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/from-template/:id", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const survey = await surveyService.createSurveyFromTemplate({
        templateId: Number(req.params.id),
        tenantId,
        userId: userId(req),
        userName: userName(req),
        workspaceId: workspaceId(req) ?? req.body.workspaceId ?? null,
      });
      res.json(survey);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/surveys/:id", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const survey = await surveyService.getSurveyById(Number(req.params.id));
      if (!survey) return res.status(404).json({ message: "Not found" });
      res.json(survey);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/surveys/:id/results-summary", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const summary = await surveyService.getSurveyResultsSummary(Number(req.params.id));
      if (!summary) return res.status(404).json({ message: "Not found" });
      res.json(summary);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/:id/ai-analyze", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = Number(req.params.id);
      const summary = await surveyService.getSurveyResultsSummary(id);
      if (!summary) return res.status(404).json({ message: "Not found" });
      if (summary.completed < 10) return res.status(400).json({ message: "At least 10 responses required for AI analysis" });

      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      const { checkAiTokenAllowance, recordAiTokenUsage } = await import("../lib/ai-tokens");
      const check = await checkAiTokenAllowance({ orgId: tenantId, userId: uid, module: "surveys", estimatedTokens: 1200 });
      if (!check.allowed) return res.status(402).json({ message: check.reason });

      const { getOpenAIConfig } = await import("../lib/openai");
      const { apiKey, baseURL } = getOpenAIConfig();
      if (!apiKey) return res.status(503).json({ message: "AI not configured" });
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey, baseURL });

      const aggregate = summary.survey.questions.map(q => {
        const answers = summary.responses.flatMap(r => r.answers.filter(a => a.questionId === q.id).map(a => a.value));
        return { question: q.text, type: q.type, answers };
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: `Analyse this survey aggregate data and provide: 1) Executive summary 2) Key findings 3) Priority concerns (especially low Likert/rating scores). Data: ${JSON.stringify(aggregate).slice(0, 12000)}`,
        }],
        temperature: 0.5,
      });
      const analysis = completion.choices[0].message.content ?? "";
      const tokens = completion.usage?.total_tokens ?? 800;
      await recordAiTokenUsage({ orgId: tenantId, userId: uid, module: "surveys", featureName: "survey_analyze", tokensConsumed: tokens });
      res.json({ analysis });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const survey = await surveyService.createSurvey({
        ...req.body,
        tenantId,
        workspaceId: workspaceId(req) ?? req.body.workspaceId ?? null,
        createdBy: userId(req),
        createdByName: userName(req),
      });
      res.json(survey);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.patch("/api/surveys/:id", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const survey = await surveyService.updateSurvey(Number(req.params.id), req.body);
      if (!survey) return res.status(404).json({ message: "Not found" });
      res.json(survey);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.delete("/api/surveys/:id", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      await surveyService.deleteSurvey(Number(req.params.id));
      res.json({ success: true });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/:id/activate", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const survey = await surveyService.updateSurvey(Number(req.params.id), { status: "active", sentAt: new Date() } as never);
      res.json(survey);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/:id/close", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const survey = await surveyService.updateSurvey(Number(req.params.id), { status: "closed", closedAt: new Date() } as never);
      res.json(survey);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/:id/archive", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { archive = true } = req.body;
      const survey = await surveyService.archiveSurvey(Number(req.params.id), archive);
      res.json(survey);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/:id/duplicate", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const copy = await surveyService.duplicateSurvey(Number(req.params.id), userId(req), userName(req));
      if (!copy) return res.status(404).json({ message: "Not found" });
      res.json(copy);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/:id/save-template", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const tpl = await surveyService.saveAsTemplate({
        surveyId: Number(req.params.id),
        tenantId,
        userId: userId(req),
        title: req.body.title,
      });
      const { registerFromSource } = await import("../templates/register-helper");
      await registerFromSource({
        tenantId, userId: userId(req), userName: userName(req),
        module: "survey", sourceModule: "survey", sourceId: tpl.id,
        name: tpl.title, description: tpl.description ?? undefined,
        categoryTags: tpl.category ? [tpl.category] : undefined,
      });
      res.json(tpl);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/:id/distribute", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const result = await surveyService.distributeSurvey({
        surveyId: Number(req.params.id),
        type: req.body.type ?? "link",
        userId: userId(req),
        tenantId,
        targetUserIds: req.body.targetUserIds,
        targetEmails: req.body.targetEmails,
        reminderDays: req.body.reminderDays,
        workspaceId: workspaceId(req) ?? req.body.workspaceId ?? undefined,
      });
      res.json(result);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/:id/questions/bulk", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const created = await surveyService.bulkCreateQuestions(Number(req.params.id), req.body.questions ?? []);
      res.json({ created: created.length, questions: created });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/:id/questions", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const q = await surveyService.createQuestion(Number(req.params.id), req.body);
      res.json(q);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/questions/:qid/duplicate", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const q = await surveyService.duplicateQuestion(Number(req.params.qid));
      if (!q) return res.status(404).json({ message: "Not found" });
      res.json(q);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.patch("/api/surveys/questions/:qid", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const q = await storage.updateSurveyQuestion(Number(req.params.qid), req.body);
      if (!q) return res.status(404).json({ message: "Not found" });
      res.json(q);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.delete("/api/surveys/questions/:qid", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const surveyId = req.query.surveyId ? Number(req.query.surveyId) : undefined;
      if (surveyId) {
        const responses = await storage.getSurveyResponses(surveyId);
        if (responses.length > 0) {
          return res.status(409).json({ message: "Survey has responses — deleting questions may affect data integrity." });
        }
      }
      await storage.deleteSurveyQuestion(Number(req.params.qid));
      res.json({ success: true });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/surveys/:id/questions/reorder", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      await storage.reorderSurveyQuestions(Number(req.params.id), req.body.orderedIds);
      res.json({ success: true });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/surveys/:id/responses", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const responses = await storage.getSurveyResponses(Number(req.params.id));
      res.json(responses);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/survey-templates/:id/submit", async (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const tpl = await surveyService.submitTemplateForReview(Number(req.params.id));
      res.json(tpl);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });
}
