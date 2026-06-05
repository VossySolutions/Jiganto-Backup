import { buildInviteUrl } from "./invite-email";

export type WebhookDeliveryResult = {
  delivered: boolean;
  skipped?: boolean;
  reason?: string;
  statusCode?: number;
  error?: string;
};

function getWebhookUrl(brandingConfig: unknown): string | null {
  const cfg = brandingConfig as { integrations?: { webhookUrl?: string } } | null;
  const url = cfg?.integrations?.webhookUrl?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

/** POST JSON payload to tenant-configured webhook (fire-and-forget safe). */
export async function dispatchTenantWebhook(
  brandingConfig: unknown,
  event: string,
  payload: Record<string, unknown>,
): Promise<WebhookDeliveryResult> {
  const url = getWebhookUrl(brandingConfig);
  if (!url) {
    return { delivered: false, skipped: true, reason: "no_webhook_url" };
  }

  const body = {
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Jiganto-Webhook/1.0",
  };
  const secret = process.env.WEBHOOK_SIGNING_SECRET?.trim();
  if (secret) {
    const crypto = await import("crypto");
    const sig = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(body))
      .digest("hex");
    headers["X-Jiganto-Signature"] = `sha256=${sig}`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[webhook]", event, res.status, text.slice(0, 200));
      return { delivered: false, statusCode: res.status, error: text || res.statusText };
    }
    return { delivered: true, statusCode: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[webhook]", event, message);
    return { delivered: false, error: message };
  }
}

export function invitationWebhookPayload(invitation: {
  id: number;
  email: string;
  tenantId: number;
  token: string;
  platformRole?: string | null;
  roleId?: number | null;
  invitedBy?: string;
}) {
  return {
    invitationId: invitation.id,
    email: invitation.email,
    tenantId: invitation.tenantId,
    platformRole: invitation.platformRole ?? null,
    roleId: invitation.roleId ?? null,
    invitedBy: invitation.invitedBy ?? null,
    inviteUrl: buildInviteUrl(invitation.token),
  };
}
