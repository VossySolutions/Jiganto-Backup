import { randomBytes, randomInt } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  hdPortalActivityLog,
  hdPortalConfigs,
  hdPortalSessions,
  sdTickets,
} from "@shared/models/service-desk";
import * as sd from "../service-desk/service";

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export async function listPortalConfigs(tenantId: number) {
  return db
    .select()
    .from(hdPortalConfigs)
    .where(eq(hdPortalConfigs.tenantId, tenantId))
    .orderBy(desc(hdPortalConfigs.createdAt));
}

export async function upsertPortalConfig(
  tenantId: number,
  userId: string,
  data: {
    id?: number;
    clientId?: number | null;
    allowedEmailDomains?: string[];
    allowedEmails?: string[];
    isActive?: boolean;
    customBranding?: Record<string, unknown>;
    portalName?: string;
  },
) {
  if (data.id) {
    const [updated] = await db
      .update(hdPortalConfigs)
      .set({
        clientId: data.clientId,
        allowedEmailDomains: data.allowedEmailDomains ?? [],
        allowedEmails: data.allowedEmails ?? [],
        isActive: data.isActive,
        customBranding: data.customBranding ?? {},
        portalName: data.portalName,
        updatedAt: new Date(),
      })
      .where(and(eq(hdPortalConfigs.id, data.id), eq(hdPortalConfigs.tenantId, tenantId)))
      .returning();
    return updated;
  }
  const token = randomBytes(16).toString("hex");
  const [created] = await db
    .insert(hdPortalConfigs)
    .values({
      tenantId,
      clientId: data.clientId ?? null,
      token,
      allowedEmailDomains: data.allowedEmailDomains ?? [],
      allowedEmails: data.allowedEmails ?? [],
      isActive: data.isActive ?? true,
      customBranding: data.customBranding ?? {},
      portalName: data.portalName,
      createdBy: userId,
    })
    .returning();
  return created;
}

export async function getPortalByToken(token: string) {
  const [config] = await db.select().from(hdPortalConfigs).where(eq(hdPortalConfigs.token, token));
  if (!config || !config.isActive) return null;
  return config;
}

function emailAllowed(email: string, config: typeof hdPortalConfigs.$inferSelect): boolean {
  const lower = email.toLowerCase();
  const allowed = (config.allowedEmails as string[] | null) ?? [];
  if (allowed.some((e) => e.toLowerCase() === lower)) return true;
  const domains = (config.allowedEmailDomains as string[] | null) ?? [];
  if (domains.length === 0) return true;
  const domain = lower.split("@")[1];
  return domains.some((d) => d.toLowerCase() === domain);
}

export async function requestPortalVerification(token: string, email: string, ip?: string) {
  const config = await getPortalByToken(token);
  if (!config) return { ok: false, message: "Portal not found or disabled" };
  if (!emailAllowed(email, config)) return { ok: false, message: "Email not authorised for this portal" };

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(hdPortalSessions).values({
    portalConfigId: config.id,
    email: email.toLowerCase(),
    verificationCode: code,
    expiresAt,
    ipAddress: ip,
  });

  await db.insert(hdPortalActivityLog).values({
    portalConfigId: config.id,
    email: email.toLowerCase(),
    action: "verification_requested",
    ipAddress: ip,
  });

  try {
    const { sendOrgEmail } = await import("../lib/org-email");
    const tenant = await import("../storage").then((m) => m.storage.getTenant(config.tenantId));
    await sendOrgEmail({
      tenant,
      to: email,
      subject: "Your support portal verification code",
      html: `<p>Your verification code is: <strong>${code}</strong></p><p>Expires in 15 minutes.</p>`,
    });
  } catch (err) {
    console.warn("[portal] verification email skipped:", err);
  }

  return { ok: true };
}

export async function verifyPortalCode(token: string, email: string, code: string, ip?: string) {
  const config = await getPortalByToken(token);
  if (!config) return { ok: false, message: "Portal not found" };

  const [session] = await db
    .select()
    .from(hdPortalSessions)
    .where(
      and(
        eq(hdPortalSessions.portalConfigId, config.id),
        eq(hdPortalSessions.email, email.toLowerCase()),
        eq(hdPortalSessions.verificationCode, code),
      ),
    )
    .orderBy(desc(hdPortalSessions.createdAt))
    .limit(1);

  if (!session || !session.expiresAt || session.expiresAt < new Date()) {
    return { ok: false, message: "Invalid or expired code" };
  }

  const sessionToken = randomBytes(24).toString("hex");
  const sessionExpires = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await db
    .update(hdPortalSessions)
    .set({ verifiedAt: new Date(), verificationCode: null, sessionToken, expiresAt: sessionExpires })
    .where(eq(hdPortalSessions.id, session.id));

  await db.insert(hdPortalActivityLog).values({
    portalConfigId: config.id,
    email: email.toLowerCase(),
    action: "login",
    ipAddress: ip,
  });

  return { ok: true, sessionToken, expiresAt: sessionExpires.toISOString(), config };
}

export async function validatePortalSession(token: string, sessionToken: string) {
  const config = await getPortalByToken(token);
  if (!config) return null;
  const [session] = await db
    .select()
    .from(hdPortalSessions)
    .where(
      and(
        eq(hdPortalSessions.portalConfigId, config.id),
        eq(hdPortalSessions.sessionToken, sessionToken),
      ),
    )
    .limit(1);
  if (!session?.verifiedAt || !session.expiresAt || session.expiresAt < new Date()) return null;
  return { config, session };
}

export async function listPortalTickets(token: string, sessionToken: string) {
  const ctx = await validatePortalSession(token, sessionToken);
  if (!ctx) return [];
  const all = await sd.listTickets(ctx.config.tenantId, { source: "help_desk" });
  return all
    .filter((t) => t.reporterEmail === ctx.session.email)
    .map((t) => ({
      id: t.id,
      ref: t.ref,
      title: t.title,
      type: t.type,
      status: t.status,
      priority: t.priority,
      assignedAgentId: t.assignedAgentId,
      agentName: t.agentName,
      updatedAt: t.updatedAt,
    }));
}

export async function createPortalTicket(
  token: string,
  sessionToken: string,
  data: {
    title: string;
    type: string;
    description?: unknown;
    priority?: string;
    contactName?: string;
  },
  ip?: string,
) {
  const ctx = await validatePortalSession(token, sessionToken);
  if (!ctx) throw new Error("Session expired");

  const ticket = await sd.createTicket(ctx.config.tenantId, ctx.config.createdBy ?? "portal", {
    source: "help_desk",
    title: data.title,
    type: data.type as "incident" | "service_request" | "change_request" | "question",
    priority: (data.priority as "p1" | "p2" | "p3" | "p4") ?? "p3",
    description: data.description,
    clientId: ctx.config.clientId,
    reporterEmail: ctx.session.email,
    reporterId: null,
    customFields: data.contactName ? { contactName: data.contactName } : {},
  });

  await db.insert(hdPortalActivityLog).values({
    portalConfigId: ctx.config.id,
    email: ctx.session.email,
    action: "ticket_submitted",
    ticketId: ticket.id,
    ipAddress: ip,
  });

  try {
    const { sendOrgEmail } = await import("../lib/org-email");
    const tenant = await import("../storage").then((m) => m.storage.getTenant(ctx.config.tenantId));
    await sendOrgEmail({
      tenant,
      to: ctx.session.email,
      subject: `[${ticket.ref}] Ticket received`,
      html: `<p>Thank you — your support request <strong>${ticket.ref}</strong> has been received.</p>
        <p>Title: ${data.title}</p>
        <p>We will respond according to your SLA agreement.</p>`,
    });
  } catch { /* */ }

  return ticket;
}

export async function getPortalActivityLog(tenantId: number, portalConfigId: number) {
  const [config] = await db
    .select()
    .from(hdPortalConfigs)
    .where(and(eq(hdPortalConfigs.id, portalConfigId), eq(hdPortalConfigs.tenantId, tenantId)));
  if (!config) return [];
  return db
    .select()
    .from(hdPortalActivityLog)
    .where(eq(hdPortalActivityLog.portalConfigId, portalConfigId))
    .orderBy(desc(hdPortalActivityLog.createdAt))
    .limit(200);
}

export async function sendPortalAccessInvite(
  tenantId: number,
  portalConfigId: number,
  email: string,
  message?: string,
) {
  const [config] = await db
    .select()
    .from(hdPortalConfigs)
    .where(and(eq(hdPortalConfigs.id, portalConfigId), eq(hdPortalConfigs.tenantId, tenantId)));
  if (!config || !config.isActive) throw new Error("Portal not found or disabled");

  const baseUrl = process.env.APP_URL ?? "http://localhost:5000";
  const portalUrl = `${baseUrl}/portal/${config.token}`;
  const branding = (config.customBranding ?? {}) as { subdomain?: string };
  const customUrl = branding.subdomain ? `https://${branding.subdomain}` : portalUrl;

  const { sendOrgEmail } = await import("../lib/org-email");
  const tenant = await import("../storage").then((m) => m.storage.getTenant(tenantId));
  await sendOrgEmail({
    tenant,
    to: email,
    subject: `Access to ${config.portalName ?? "Support Portal"}`,
    html: `<p>You have been invited to the <strong>${config.portalName ?? "Support Portal"}</strong>.</p>
      ${message ? `<p>${message}</p>` : ""}
      <p><a href="${portalUrl}">Open Support Portal</a></p>
      ${branding.subdomain ? `<p>Custom URL: <a href="${customUrl}">${customUrl}</a></p>` : ""}
      <p>Sign in with your work email to submit and track support tickets.</p>`,
  });

  await db.insert(hdPortalActivityLog).values({
    portalConfigId: config.id,
    email: email.toLowerCase(),
    action: "access_invite_sent",
  });

  return { ok: true, portalUrl };
}

export async function getPortalTicketDetail(token: string, sessionToken: string, ticketId: number) {
  const ctx = await validatePortalSession(token, sessionToken);
  if (!ctx) return null;

  const [row] = await db
    .select()
    .from(sdTickets)
    .where(
      and(
        eq(sdTickets.id, ticketId),
        eq(sdTickets.tenantId, ctx.config.tenantId),
        eq(sdTickets.reporterEmail, ctx.session.email),
        eq(sdTickets.source, "help_desk"),
      ),
    );
  if (!row) return null;

  const detail = await sd.getTicketDetail(ctx.config.tenantId, ticketId);
  if (!detail) return null;

  let agentName: string | null = null;
  if (detail.assignedAgentId) {
    const { users } = await import("@shared/schema");
    const [agent] = await db.select().from(users).where(eq(users.id, detail.assignedAgentId)).limit(1);
    if (agent) agentName = `${agent.firstName ?? ""} ${agent.lastName ?? ""}`.trim();
  }

  return {
    id: detail.id,
    ref: detail.ref,
    title: detail.title,
    type: detail.type,
    status: detail.status,
    priority: detail.priority,
    description: detail.description,
    agentName,
    updatedAt: detail.updatedAt,
    comments: (detail.comments ?? []).filter((c) => !c.isInternal),
    attachments: detail.attachments ?? [],
  };
}

export async function addPortalTicketComment(
  token: string,
  sessionToken: string,
  ticketId: number,
  body: unknown,
  ip?: string,
) {
  const ctx = await validatePortalSession(token, sessionToken);
  if (!ctx) throw new Error("Session expired");

  const [row] = await db
    .select()
    .from(sdTickets)
    .where(
      and(
        eq(sdTickets.id, ticketId),
        eq(sdTickets.tenantId, ctx.config.tenantId),
        eq(sdTickets.reporterEmail, ctx.session.email),
      ),
    );
  if (!row) throw new Error("Ticket not found");

  const comment = await sd.addTicketComment(ctx.config.tenantId, ticketId, ctx.config.createdBy ?? "portal", body, false);

  await db.insert(hdPortalActivityLog).values({
    portalConfigId: ctx.config.id,
    email: ctx.session.email,
    action: "comment_added",
    ticketId,
    ipAddress: ip,
  });

  if (row.assignedAgentId) {
    try {
      const { notifyUser } = await import("../lib/user-notify");
      await notifyUser({
        userId: row.assignedAgentId,
        tenantId: ctx.config.tenantId,
        title: `Client comment on ${row.ref}`,
        message: `New portal comment on ticket ${row.ref}`,
        type: "workflow",
        source: "help-desk",
        sourceId: String(ticketId),
        category: "helpDesk",
      });
    } catch { /* */ }
  }

  return comment;
}
