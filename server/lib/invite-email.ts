export type InviteEmailResult = {
  sent: boolean;
  method: "resend" | "smtp" | "console" | "disabled";
  error?: string;
};

function publicAppUrl(): string {
  return (
    process.env.APP_PUBLIC_URL?.replace(/\/$/, "") ||
    `http://localhost:${process.env.PORT || 5000}`
  );
}

export function buildInviteUrl(token: string): string {
  return `${publicAppUrl()}/invite/${token}`;
}

export async function sendInvitationEmail(params: {
  to: string;
  token: string;
  orgName?: string;
  invitedByEmail?: string;
  tenant?: import("@shared/schema").Tenant | null;
}): Promise<InviteEmailResult> {
  const inviteUrl = buildInviteUrl(params.token);
  const orgLabel = params.orgName?.trim() || "your organisation";
  const from = process.env.INVITE_EMAIL_FROM?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();

  const subject = `You're invited to ${orgLabel} on Jiganto`;
  const html = `
    <p>You have been invited to join <strong>${orgLabel}</strong> on Jiganto.</p>
    ${
      params.invitedByEmail
        ? `<p>Invited by: ${params.invitedByEmail}</p>`
        : ""
    }
    <p><a href="${inviteUrl}">Accept invitation</a></p>
    <p style="color:#666;font-size:12px">Sign in with this email address (${params.to}) before accepting. Link expires in 7 days.</p>
    <p style="color:#666;font-size:12px">${inviteUrl}</p>
  `.trim();

  if (params.tenant) {
    const { sendOrgEmail } = await import("./org-email");
    const orgResult = await sendOrgEmail({
      tenant: params.tenant,
      to: params.to,
      subject,
      html,
    });
    if (orgResult.sent) {
      return {
        sent: true,
        method: orgResult.method === "smtp" ? "smtp" : "resend",
      };
    }
    if (orgResult.method === "smtp" && orgResult.error) {
      return { sent: false, method: "smtp", error: orgResult.error };
    }
  }

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
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[invite-email] Resend failed:", res.status, text);
        return { sent: false, method: "resend", error: text };
      }
      return { sent: true, method: "resend" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[invite-email] Resend error:", message);
      return { sent: false, method: "resend", error: message };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[invite-email] Invitation (dev — copy link):");
    console.log(`  To: ${params.to}`);
    console.log(`  URL: ${inviteUrl}`);
    return { sent: false, method: "console" };
  }

  return { sent: false, method: "disabled" };
}
