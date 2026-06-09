import {
  AI_INSIGHTS_SYSTEM_PROMPT,
  generateAiInsights,
  type AiInsightItem,
} from "../lib/ai-insights-generator";
import { storage } from "../storage";

function chatRules(summary: Record<string, unknown>): AiInsightItem[] {
  const insights: AiInsightItem[] = [];
  const inbox = summary.inbox as {
    totalChannels?: number;
    unreadTotal?: number;
    channelsWithUnread?: number;
    staleChannels?: number;
  } | undefined;

  if ((inbox?.unreadTotal ?? 0) > 20) {
    insights.push({
      type: "anomaly",
      severity: "medium",
      title: "High unread volume",
      description: `${inbox!.unreadTotal} unread messages across ${inbox!.channelsWithUnread} channel(s). Use Summarise unread or @jiganto for help catching up.`,
    });
  }
  if ((inbox?.staleChannels ?? 0) > 0) {
    insights.push({
      type: "recommendation",
      severity: "low",
      title: "Inactive channels",
      description: `${inbox!.staleChannels} channel(s) have had no activity in 14+ days. Consider archiving or posting a status update.`,
    });
  }
  if ((inbox?.totalChannels ?? 0) === 0) {
    insights.push({
      type: "recommendation",
      severity: "info",
      title: "Get started with Chat",
      description: "Create a channel or start a direct message to collaborate with your team.",
    });
  }
  if (insights.length === 0) {
    insights.push({
      type: "positive",
      severity: "info",
      title: "Inbox under control",
      description: "Unread counts look manageable. Mention @jiganto in any channel for AI assistance.",
    });
  }
  return insights;
}

export async function generateChatAiInsights(userId: string, tenantId: number) {
  const inbox = await storage.getChatInbox(userId, tenantId);
  const now = Date.now();
  const fourteenDays = 14 * 86400000;

  const unreadTotal = inbox.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  const channelsWithUnread = inbox.filter((c) => (c.unreadCount ?? 0) > 0).length;
  const staleChannels = inbox.filter((c) => {
    if (!c.lastMessageAt) return true;
    return now - new Date(c.lastMessageAt).getTime() > fourteenDays;
  }).length;

  const topUnread = inbox
    .filter((c) => (c.unreadCount ?? 0) > 0)
    .sort((a, b) => (b.unreadCount ?? 0) - (a.unreadCount ?? 0))
    .slice(0, 5)
    .map((c) => ({
      name: c.displayName,
      unread: c.unreadCount,
      type: c.type,
      lastPreview: c.lastMessagePreview?.slice(0, 80),
    }));

  const summary = {
    inbox: {
      totalChannels: inbox.length,
      unreadTotal,
      channelsWithUnread,
      staleChannels,
      publicChannels: inbox.filter((c) => c.type === "public").length,
      privateChannels: inbox.filter((c) => c.type === "private").length,
      directMessages: inbox.filter((c) => c.type === "direct").length,
    },
    topUnread,
    recentActivity: inbox
      .filter((c) => c.lastMessageAt)
      .sort((a, b) => new Date(b.lastMessageAt!).getTime() - new Date(a.lastMessageAt!).getTime())
      .slice(0, 5)
      .map((c) => ({
        name: c.displayName,
        preview: c.lastMessagePreview?.slice(0, 60),
        at: c.lastMessageAt,
      })),
  };

  return generateAiInsights({
    summary,
    systemPrompt: `${AI_INSIGHTS_SYSTEM_PROMPT}
Focus on: unread backlog, channel engagement, collaboration gaps, and where @jiganto or summarisation would help.`,
    rulesFallback: () => chatRules(summary),
  });
}
