import type { Channel, ChannelBridgeConfig } from "@shared/models/chat";
import { slackBotToken, teamsDefaultWebhookUrl } from "./config";

export async function forwardMessageToBridge(
  channel: Channel,
  payload: { authorName: string; content: string; messageUrl?: string },
): Promise<{ ok: boolean; error?: string }> {
  const bridge = channel.bridgeConfig as ChannelBridgeConfig | null;
  if (!bridge?.active) return { ok: true };

  try {
    if (bridge.provider === "teams") {
      const url = bridge.webhookUrl || teamsDefaultWebhookUrl();
      if (!url) return { ok: false, error: "Teams webhook URL not configured" };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "@type": "MessageCard",
          "@context": "https://schema.org/extensions",
          summary: "Jiganto Chat",
          themeColor: "4338CA",
          title: `#${channel.name}`,
          text: `**${payload.authorName}:** ${payload.content}`,
        }),
      });
      if (!res.ok) return { ok: false, error: `Teams webhook ${res.status}` };
      return { ok: true };
    }

    if (bridge.provider === "slack") {
      const token = slackBotToken();
      const slackChannel = bridge.slackChannelId || bridge.externalChannelName;
      if (!token || !slackChannel) {
        return { ok: false, error: "Slack bot token or channel not configured" };
      }
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: slackChannel,
          text: `*${payload.authorName}:* ${payload.content}`,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) return { ok: false, error: data.error ?? "Slack API error" };
      return { ok: true };
    }

    return { ok: false, error: "Unknown bridge provider" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function formatBridgeAuthorLabel(source: string, name: string): string {
  if (source === "slack") return `[Slack] ${name}`;
  if (source === "teams") return `[Teams] ${name}`;
  return name;
}
