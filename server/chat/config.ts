/** Chat module environment configuration (Module 02 extended features). */

export function chatAiEnabled(): boolean {
  if (process.env.CHAT_AI_ENABLED === "false") return false;
  return Boolean(process.env.OPENAI_API_KEY);
}

export function chatUseSupabaseRealtime(): boolean {
  return process.env.CHAT_USE_SUPABASE_REALTIME !== "false";
}

export function chatMaxAttachmentBytes(): number {
  const mb = Number(process.env.CHAT_MAX_ATTACHMENT_MB ?? "50");
  return Math.min(Math.max(mb, 1), 100) * 1024 * 1024;
}

export function chatMaxAttachmentsPerMessage(): number {
  return Number(process.env.CHAT_MAX_ATTACHMENTS_PER_MESSAGE ?? "5");
}

export function slackBotToken(): string | undefined {
  return process.env.SLACK_BOT_TOKEN?.trim() || undefined;
}

export function slackSigningSecret(): string | undefined {
  return process.env.SLACK_SIGNING_SECRET?.trim() || undefined;
}

export function teamsDefaultWebhookUrl(): string | undefined {
  return process.env.TEAMS_INCOMING_WEBHOOK_URL?.trim() || undefined;
}

export function chatBridgeIncomingSecret(): string | undefined {
  return process.env.CHAT_BRIDGE_INCOMING_SECRET?.trim() || undefined;
}

export function jigantoBotUserId(): string {
  return process.env.CHAT_JIGANTO_BOT_USER_ID ?? "jiganto-bot";
}
