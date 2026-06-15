import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { sdTickets } from "@shared/models/service-desk";
import { hdPortalSessions } from "@shared/models/service-desk";
import { surveys, surveyQuestions } from "@shared/models/surveys";
import type { SdTicket } from "@shared/models/service-desk";

const CSAT_TEMPLATE_CATEGORY = "hd_csat_template";
const CSAT_SURVEY_PREFIX = "hd_csat:";

async function ensureCsatTemplate(tenantId: number, userId?: string) {
  const [existing] = await db
    .select()
    .from(surveys)
    .where(and(eq(surveys.tenantId, tenantId), eq(surveys.category, CSAT_TEMPLATE_CATEGORY)))
    .limit(1);
  if (existing) return existing;

  const [template] = await db
    .insert(surveys)
    .values({
      tenantId,
      title: "Post-Resolution CSAT",
      description: "System template for Help Desk satisfaction surveys (Module 17)",
      status: "closed",
      category: CSAT_TEMPLATE_CATEGORY,
      anonymous: true,
      showProgress: false,
      onePerPage: false,
      thankYouMessage: "Thank you for your feedback. Your response helps us improve.",
      createdBy: userId ?? null,
    })
    .returning();

  await db.insert(surveyQuestions).values([
    {
      surveyId: template.id,
      type: "scale",
      text: "How satisfied are you with the resolution of your support ticket?",
      required: true,
      questionOrder: 1,
      scaleMin: 1,
      scaleMax: 5,
      scaleMinLabel: "Very dissatisfied",
      scaleMaxLabel: "Very satisfied",
    },
    {
      surveyId: template.id,
      type: "para",
      text: "Any additional comments? (optional)",
      required: false,
      questionOrder: 2,
    },
  ]);

  return template;
}

async function createCsatSurveyInstance(tenantId: number, ticket: SdTicket, userId?: string) {
  await ensureCsatTemplate(tenantId, userId);
  const template = await storage.getSurveys(tenantId);
  const tpl = template.find((s) => s.category === CSAT_TEMPLATE_CATEGORY);
  if (!tpl?.questions?.length) throw new Error("CSAT template not configured");

  const token = randomBytes(24).toString("hex");
  const [survey] = await db
    .insert(surveys)
    .values({
      tenantId,
      title: `CSAT — ${ticket.ref}`,
      description: `Satisfaction survey for ticket ${ticket.ref}`,
      status: "active",
      category: `${CSAT_SURVEY_PREFIX}${ticket.id}`,
      anonymous: true,
      showProgress: true,
      onePerPage: true,
      thankYouMessage: "Thank you for your feedback!",
      token,
      sentAt: new Date(),
      createdBy: userId ?? null,
    })
    .returning();

  for (const q of tpl.questions) {
    await storage.createSurveyQuestion({
      surveyId: survey.id,
      type: q.type,
      text: q.text,
      helpText: q.helpText,
      options: q.options,
      required: q.required,
      questionOrder: q.questionOrder,
      scaleMin: q.scaleMin,
      scaleMax: q.scaleMax,
      scaleMinLabel: q.scaleMinLabel,
      scaleMaxLabel: q.scaleMaxLabel,
    });
  }

  return { survey, token };
}

export async function triggerCsatSurvey(tenantId: number, ticket: SdTicket): Promise<void> {
  if (ticket.csatSurveySentAt || ticket.csatScore != null) return;
  if (!ticket.reporterEmail) return;
  if (ticket.type === "question" && ticket.internalNotes?.includes("internal_only")) return;

  const [session] = await db
    .select()
    .from(hdPortalSessions)
    .where(and(eq(hdPortalSessions.email, ticket.reporterEmail)))
    .limit(1);
  if (session?.csatOptedOut) return;

  const { token } = await createCsatSurveyInstance(tenantId, ticket, ticket.createdBy ?? undefined);

  await db
    .update(sdTickets)
    .set({ csatSurveySentAt: new Date(), csatSurveyToken: token })
    .where(and(eq(sdTickets.id, ticket.id), eq(sdTickets.tenantId, tenantId)));

  try {
    const { sendOrgEmail } = await import("../lib/org-email");
    const tenant = await storage.getTenant(tenantId);
    const baseUrl = process.env.APP_URL ?? "http://localhost:5000";
    await sendOrgEmail({
      tenant,
      to: ticket.reporterEmail,
      subject: `[${ticket.ref}] Rate your support experience`,
      html: `<p>How satisfied are you with the resolution of ticket <strong>${ticket.ref}</strong>?</p>
        <p><a href="${baseUrl}/survey/${token}">Complete our 1–5 star survey (expires in 3 days)</a></p>
        <p><a href="${baseUrl}/help-desk/csat/${token}?optout=1">Opt out of satisfaction surveys</a></p>`,
    });
  } catch (err) {
    console.warn("[help-desk] CSAT email skipped:", err);
  }
}

/** Called after Module 17 survey response is submitted for Help Desk CSAT surveys. */
export async function processCsatSurveyResponse(surveyId: number, category: string | null): Promise<void> {
  if (!category?.startsWith(CSAT_SURVEY_PREFIX)) return;
  const ticketId = Number(category.slice(CSAT_SURVEY_PREFIX.length));
  if (!Number.isFinite(ticketId)) return;

  const responses = await storage.getSurveyResponses(surveyId);
  const latest = responses.find((r) => r.completedAt);
  if (!latest?.answers?.length) return;

  const scaleAnswer = latest.answers.find((a) => typeof a.value === "number" || (typeof a.value === "object" && a.value != null));
  let score: number | null = null;
  for (const a of latest.answers) {
    const v = a.value;
    if (typeof v === "number" && v >= 1 && v <= 5) {
      score = v;
      break;
    }
    if (typeof v === "object" && v != null && "value" in (v as object)) {
      const n = Number((v as { value: unknown }).value);
      if (n >= 1 && n <= 5) { score = n; break; }
    }
  }
  if (score == null) return;

  const [ticket] = await db.select().from(sdTickets).where(eq(sdTickets.id, ticketId));
  if (!ticket || ticket.csatScore != null) return;

  await db.update(sdTickets).set({ csatScore: score, csatSurveyToken: null }).where(eq(sdTickets.id, ticketId));
  await storage.updateSurvey(surveyId, { status: "closed", closedAt: new Date() });
}

export async function getCsatSurveyState(token: string): Promise<{
  ok: boolean;
  message?: string;
  ticketRef?: string;
  expired?: boolean;
  submitted?: boolean;
  surveyUrl?: string;
}> {
  const [ticket] = await db.select().from(sdTickets).where(eq(sdTickets.csatSurveyToken, token));
  if (ticket) {
    if (ticket.csatScore != null) return { ok: true, submitted: true, ticketRef: ticket.ref };
    if (ticket.csatSurveySentAt) {
      const expires = new Date(ticket.csatSurveySentAt);
      expires.setDate(expires.getDate() + 3);
      if (new Date() > expires) return { ok: false, expired: true, message: "Survey expired", ticketRef: ticket.ref };
    }
    return { ok: true, ticketRef: ticket.ref, surveyUrl: `/survey/${token}` };
  }

  const survey = await storage.getSurveyByToken(token);
  if (!survey) return { ok: false, message: "Survey not found" };
  if (survey.category?.startsWith(CSAT_SURVEY_PREFIX)) {
    const ticketId = Number(survey.category.slice(CSAT_SURVEY_PREFIX.length));
    const [t] = await db.select().from(sdTickets).where(eq(sdTickets.id, ticketId));
    if (t?.csatScore != null) return { ok: true, submitted: true, ticketRef: t.ref };
    if (survey.status !== "active") return { ok: false, message: "Survey closed", ticketRef: t?.ref };
    return { ok: true, ticketRef: t?.ref, surveyUrl: `/survey/${token}` };
  }
  return { ok: false, message: "Survey not found" };
}

export async function submitCsatScore(token: string, score: number, optOut = false): Promise<{ ok: boolean; message?: string }> {
  const survey = await storage.getSurveyByToken(token);
  if (survey?.category?.startsWith(CSAT_SURVEY_PREFIX)) {
    return { ok: false, message: "Please use the survey link to submit your rating" };
  }

  const [ticket] = await db.select().from(sdTickets).where(eq(sdTickets.csatSurveyToken, token));
  if (!ticket) return { ok: false, message: "Survey not found" };
  if (ticket.csatScore != null) return { ok: false, message: "Already submitted" };
  if (ticket.csatSurveySentAt) {
    const expires = new Date(ticket.csatSurveySentAt);
    expires.setDate(expires.getDate() + 3);
    if (new Date() > expires) return { ok: false, message: "Survey expired" };
  }
  if (score < 1 || score > 5) return { ok: false, message: "Invalid score" };

  await db.update(sdTickets).set({ csatScore: score, csatSurveyToken: null }).where(eq(sdTickets.id, ticket.id));

  if (optOut && ticket.reporterEmail) {
    await db
      .update(hdPortalSessions)
      .set({ csatOptedOut: true })
      .where(eq(hdPortalSessions.email, ticket.reporterEmail));
  }
  return { ok: true };
}

export async function optOutCsatByToken(token: string): Promise<void> {
  const survey = await storage.getSurveyByToken(token);
  const [ticket] = await db.select().from(sdTickets).where(eq(sdTickets.csatSurveyToken, token));
  const email = ticket?.reporterEmail;
  if (email) {
    await db.update(hdPortalSessions).set({ csatOptedOut: true }).where(eq(hdPortalSessions.email, email));
  }
  if (survey?.category?.startsWith(CSAT_SURVEY_PREFIX)) {
    await storage.updateSurvey(survey.id, { status: "closed", closedAt: new Date() });
  }
}
