import { sendOrgEmail } from "../lib/org-email";
import type { Tenant } from "@shared/schema";
import type { SignoffRequestWithDetails, SignoffSigner } from "@shared/models/signoff";

function signingUrl(token: string): string {
  const base = process.env.APP_URL?.trim() || process.env.PUBLIC_APP_URL?.trim() || "http://localhost:5000";
  return `${base.replace(/\/$/, "")}/sign/${token}`;
}

function fmtDate(d?: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function emailWrap(body: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#111">
    <div style="padding:24px 0;border-bottom:2px solid #e5e7eb;margin-bottom:24px">
      <strong style="font-size:18px">Jiganto</strong>
      <span style="font-size:11px;background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:20px;margin-left:8px;text-transform:uppercase;letter-spacing:.06em">e-Sign</span>
    </div>
    ${body}
    <p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af">
      Secured electronic signature · Jiganto Enterprise Platform
    </p>
  </div>`;
}

export async function sendSignerInviteEmail(params: {
  tenant: Tenant | null;
  to: string;
  signer: SignoffSigner;
  request: SignoffRequestWithDetails;
}): Promise<boolean> {
  const url = signingUrl(params.signer.token!);
  const html = emailWrap(`
    <h2 style="margin:0 0 8px;font-size:20px">Signature requested</h2>
    <p style="color:#4b5563;line-height:1.6">
      <strong>${params.request.createdByName || "A colleague"}</strong> has requested your signature on:
    </p>
    <p style="font-size:16px;font-weight:600;margin:16px 0">${params.request.title}</p>
    ${params.request.message ? `<p style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;color:#1e40af">${params.request.message}</p>` : ""}
    ${params.signer.privateMessage ? `<p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;color:#374151"><em>Private message:</em> ${params.signer.privateMessage}</p>` : ""}
    <p style="color:#6b7280;font-size:14px">Expiry: ${fmtDate(params.request.deadline || params.signer.tokenExpiresAt)}</p>
    <p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Review &amp; Sign</a></p>
    <p style="font-size:12px;color:#9ca3af">Or copy this link: ${url}</p>
  `);
  const result = await sendOrgEmail({
    tenant: params.tenant,
    to: params.to,
    subject: `Signature requested: ${params.request.title}`,
    html,
  });
  return result.sent;
}

export async function sendReminderEmail(params: {
  tenant: Tenant | null;
  to: string;
  signer: SignoffSigner;
  request: SignoffRequestWithDetails;
}): Promise<boolean> {
  const url = signingUrl(params.signer.token!);
  const html = emailWrap(`
    <h2 style="margin:0 0 8px;font-size:20px">Reminder: signature pending</h2>
    <p style="color:#4b5563">This is a reminder to sign <strong>${params.request.title}</strong>.</p>
    <p style="color:#6b7280;font-size:14px">Deadline: ${fmtDate(params.request.deadline || params.signer.tokenExpiresAt)}</p>
    <p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Review &amp; Sign</a></p>
  `);
  const result = await sendOrgEmail({
    tenant: params.tenant,
    to: params.to,
    subject: `Reminder: ${params.request.title}`,
    html,
  });
  return result.sent;
}

export async function sendDeclineNotificationEmail(params: {
  tenant: Tenant | null;
  to: string;
  request: SignoffRequestWithDetails;
  signer: SignoffSigner;
}): Promise<boolean> {
  const html = emailWrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#dc2626">Signature declined</h2>
    <p><strong>${params.signer.name}</strong> has declined to sign <strong>${params.request.title}</strong>.</p>
    ${params.signer.declineReason ? `<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px"><strong>Reason:</strong> ${params.signer.declineReason}</p>` : ""}
  `);
  const result = await sendOrgEmail({
    tenant: params.tenant,
    to: params.to,
    subject: `${params.signer.name} declined to sign: ${params.request.title}`,
    html,
  });
  return result.sent;
}

export async function sendCompletionEmail(params: {
  tenant: Tenant | null;
  to: string;
  request: SignoffRequestWithDetails;
  downloadUrl?: string;
}): Promise<boolean> {
  const html = emailWrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#16a34a">Document fully signed</h2>
    <p>All parties have signed <strong>${params.request.title}</strong>.</p>
    ${params.downloadUrl ? `<p style="margin:24px 0"><a href="${params.downloadUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Download Signed PDF</a></p>` : ""}
  `);
  const result = await sendOrgEmail({
    tenant: params.tenant,
    to: params.to,
    subject: `Completed: ${params.request.title}`,
    html,
  });
  return result.sent;
}

export async function sendExpiredNotificationEmail(params: {
  tenant: Tenant | null;
  to: string;
  request: SignoffRequestWithDetails;
}): Promise<boolean> {
  const html = emailWrap(`
    <h2 style="margin:0 0 8px;font-size:20px">Signing request expired</h2>
    <p>The signing request for <strong>${params.request.title}</strong> expired before all signers completed.</p>
    <p style="color:#6b7280;font-size:14px">You may create a revised request with a new expiry date.</p>
  `);
  const result = await sendOrgEmail({
    tenant: params.tenant,
    to: params.to,
    subject: `Expired: ${params.request.title}`,
    html,
  });
  return result.sent;
}
