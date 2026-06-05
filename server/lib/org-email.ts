import nodemailer from "nodemailer";
import type { Tenant } from "@shared/schema";

export type OrgSmtpConfig = {
  host?: string;
  port?: string;
  username?: string;
  encryption?: "tls" | "ssl" | "none";
};

export type SendEmailResult = {
  sent: boolean;
  method: "smtp" | "resend" | "console" | "disabled";
  error?: string;
};

function getSmtpFromTenant(tenant: Tenant | null | undefined): OrgSmtpConfig | null {
  const cfg = (tenant?.brandingConfig as { integrations?: { smtp?: OrgSmtpConfig } })?.integrations
    ?.smtp;
  if (!cfg?.host?.trim()) return null;
  return cfg;
}

function smtpTransport(smtp: OrgSmtpConfig, password: string) {
  const port = Number(smtp.port) || 587;
  const secure = smtp.encryption === "ssl";
  return nodemailer.createTransport({
    host: smtp.host!.trim(),
    port,
    secure,
    auth: smtp.username?.trim()
      ? { user: smtp.username.trim(), pass: password }
      : undefined,
    requireTLS: smtp.encryption === "tls",
  });
}

/** Send via tenant SMTP when configured; otherwise Resend; dev falls back to console. */
export async function sendOrgEmail(params: {
  tenant: Tenant | null | undefined;
  to: string;
  subject: string;
  html: string;
  smtpPassword?: string;
}): Promise<SendEmailResult> {
  const smtp = getSmtpFromTenant(params.tenant);
  const password =
    params.smtpPassword?.trim() || process.env.SMTP_PASSWORD?.trim() || "";

  if (smtp && password) {
    try {
      const from =
        process.env.SMTP_FROM?.trim() ||
        smtp.username?.trim() ||
        "noreply@jiganto.local";
      const transport = smtpTransport(smtp, password);
      await transport.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      return { sent: true, method: "smtp" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[org-email] SMTP failed:", message);
      return { sent: false, method: "smtp", error: message };
    }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.INVITE_EMAIL_FROM?.trim();
  if (apiKey && from) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { sent: false, method: "resend", error: text };
      }
      return { sent: true, method: "resend" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { sent: false, method: "resend", error: message };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[org-email] Dev — email not sent:");
    console.log(`  To: ${params.to}`);
    console.log(`  Subject: ${params.subject}`);
    return { sent: false, method: "console" };
  }

  return {
    sent: false,
    method: "disabled",
    error: "Configure SMTP (host + SMTP_PASSWORD) or RESEND_API_KEY + INVITE_EMAIL_FROM",
  };
}
