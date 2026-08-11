import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { storage } from "../storage";
import { forwardMessageToBridge } from "./bridges";
import { summarizeMessages, answerJigantoQuery } from "./ai-summary";
import {
  chatAiEnabled,
  chatBridgeIncomingSecret,
  chatMaxAttachmentBytes,
  chatMaxAttachmentsPerMessage,
  chatUseSupabaseRealtime,
  jigantoBotUserId,
} from "./config";
import type { ChannelBridgeConfig, ChatNotificationPref } from "@shared/models/chat";
import {
  assertCanAccessChannel,
  assertCanAccessMessage,
} from "./access";
import { db } from "../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

type GetUserId = (req: Request) => string | null;
type GetTenantId = (req: Request) => number;

async function ensureJigantoBotUser(): Promise<void> {
  const id = jigantoBotUserId();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
  if (!existing) {
    await db
      .insert(users)
      .values({
        id,
        email: "jiganto-bot@system.local",
        firstName: "Jiganto",
        lastName: "AI",
      })
      .onConflictDoNothing();
  }
}

async function broadcastChannel(channelId: number, type: string, payload: Record<string, unknown>) {
  const { getChatWebSocket } = await import("../websocket");
  const wss = getChatWebSocket();
  if (!wss) return;
  const event = { type: type as never, payload: { ...payload, channelId } };
  wss.sendToChannel(channelId, event);
  // Also ping every channel member so inbox updates even if they haven't joined the channel
  try {
    const members = await storage.getChannelMembers(channelId);
    wss.sendToUsers(
      members.map((m) => m.userId),
      event,
    );
  } catch {
    // non-fatal — channel subscribers still got the event
  }
}

export async function registerExtendedChatRoutes(
  app: Express,
  getUserId: GetUserId,
  getApiTenantIdWithFallback: GetTenantId,
): Promise<void> {
  await ensureJigantoBotUser();

  app.get("/api/chat/config", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    res.json({
      aiEnabled: chatAiEnabled(),
      supabaseRealtime: chatUseSupabaseRealtime(),
      maxAttachmentMb: Math.round(chatMaxAttachmentBytes() / 1024 / 1024),
      maxAttachmentsPerMessage: chatMaxAttachmentsPerMessage(),
    });
  });

  app.post("/api/chat/ai-insights", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const { generateChatAiInsights } = await import("./ai-insights");
      res.json(await generateChatAiInsights(userId, tenantId));
    } catch (err) {
      console.error("Chat AI insights error:", err);
      res.status(500).json({ message: "Failed to generate chat insights" });
    }
  });

  const multer = (await import("multer")).default;
  const uploadsDir = path.join(process.cwd(), "uploads", "chat");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const chatUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${Date.now()}-${safe}`);
      },
    }),
    limits: { fileSize: chatMaxAttachmentBytes() },
  });

  app.post("/api/chat/channels/:id/attachments", (req: Request, res: Response, next) => {
    chatUpload.array("files", chatMaxAttachmentsPerMessage())(req, res, (err) => {
      if (err) return res.status(400).json({ message: String(err) });
      next();
    });
  }, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const channelId = Number(req.params.id);
    const access = await assertCanAccessChannel(channelId, userId);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    const files = (req as Request & { files?: Express.Multer.File[] }).files ?? [];
    if (files.length === 0) return res.status(400).json({ message: "No files uploaded" });

    const created = await Promise.all(
      files.map((file) =>
        storage.createMessageAttachment({
          channelId,
          userId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          url: `/uploads/chat/${file.filename}`,
          messageId: null,
        }),
      ),
    );
    res.status(201).json(created);
  });

  app.get("/api/chat/channels/:id/pins", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const channelId = Number(req.params.id);
    const access = await assertCanAccessChannel(channelId, userId);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    const pins = await storage.getPinnedMessages(channelId);
    res.json(pins);
  });

  app.post("/api/chat/channels/:id/pins/:messageId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const channelId = Number(req.params.id);
    const messageId = Number(req.params.messageId);
    const access = await assertCanAccessChannel(channelId, userId);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    const message = await storage.getMessage(messageId);
    if (!message || message.channelId !== channelId) {
      return res.status(404).json({ message: "Message not found in channel" });
    }
    const pin = await storage.pinMessage(channelId, messageId, userId);
    await broadcastChannel(channelId, "pin", { channelId, messageId });
    res.status(201).json(pin);
  });

  app.delete("/api/chat/channels/:id/pins/:messageId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const channelId = Number(req.params.id);
    const messageId = Number(req.params.messageId);
    const access = await assertCanAccessChannel(channelId, userId);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    await storage.unpinMessage(channelId, messageId);
    await broadcastChannel(channelId, "pin", { channelId, messageId });
    res.status(204).send();
  });

  app.patch("/api/chat/channels/:id/bridge", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const channelId = Number(req.params.id);
    const isAdmin = await storage.isChannelAdmin(channelId, userId);
    if (!isAdmin) return res.status(403).json({ message: "Admin only" });

    const bridgeConfig = req.body as ChannelBridgeConfig | null;
    const channel = await storage.updateChannelBridge(channelId, bridgeConfig);
    res.json(channel);
  });

  app.patch("/api/chat/channels/:id/notifications", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const channelId = Number(req.params.id);
    const pref = req.body.pref as ChatNotificationPref;
    if (!["all", "mentions", "nothing", "muted"].includes(pref)) {
      return res.status(400).json({ message: "Invalid preference" });
    }
    const channel = await storage.getChannel(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    const member = await storage.getChannelMemberRecord(channelId, userId);
    if (!member) {
      if (channel.type === "private" || channel.type === "direct") {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.addChannelMember({ channelId, userId, role: "member", notificationPref: pref });
    } else {
      await storage.updateChannelNotificationPref(channelId, userId, pref);
    }
    res.json({ success: true, pref });
  });

  app.post("/api/chat/channels/:id/summarize-unread", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    if (!chatAiEnabled()) return res.status(503).json({ message: "AI not configured (OPENAI_API_KEY)" });

    const channelId = Number(req.params.id);
    const access = await assertCanAccessChannel(channelId, userId);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    const channel = access.channel;

    const messages = await storage.getMessages(channelId, 100);
    const member = await storage.getChannelMemberRecord(channelId, userId);
    const lastRead = member?.lastReadAt;
    const unread = messages.filter(
      (m) => m.userId !== userId && (!lastRead || new Date(m.createdAt) > new Date(lastRead)),
    );
    if (unread.length === 0) return res.status(400).json({ message: "No unread messages" });

    const summary = await summarizeMessages(
      unread.map((m) => ({
        author: [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || "User",
        content: m.content,
        time: new Date(m.createdAt).toISOString(),
      })),
      `Unread summary for #${channel.name}`,
    );
    if (!summary) return res.status(503).json({ message: "Failed to generate summary" });

    const message = await storage.createMessage({
      channelId,
      userId: jigantoBotUserId(),
      content: summary,
      messageType: "summary",
      authorSource: "jiganto",
    });
    await storage.pinMessage(channelId, message.id, userId);
    await broadcastChannel(channelId, "message", { channelId });
    res.json({ summary, messageId: message.id });
  });

  app.post("/api/chat/messages/:id/summarize-thread", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    if (!chatAiEnabled()) return res.status(503).json({ message: "AI not configured" });

    const parentId = Number(req.params.id);
    const access = await assertCanAccessMessage(parentId, userId);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    const parent = await storage.getMessageWithUser(parentId);
    if (!parent) return res.status(404).json({ message: "Not found" });
    const replies = await storage.getThreadReplies(parentId);
    const lines = [
      { author: "Original", content: parent.content },
      ...replies.map((r) => ({
        author: [r.user.firstName, r.user.lastName].filter(Boolean).join(" ") || "User",
        content: r.content,
      })),
    ];
    const summary = await summarizeMessages(lines, "Thread summary");
    if (!summary) return res.status(503).json({ message: "Failed to generate summary" });
    res.json({ summary });
  });

  app.post("/api/chat/bridges/incoming", async (req, res) => {
    const secret = req.headers["x-jiganto-bridge-secret"] ?? req.query.secret;
    if (!chatBridgeIncomingSecret() || secret !== chatBridgeIncomingSecret()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { channelId, authorName, content, source } = req.body as {
      channelId: number;
      authorName: string;
      content: string;
      source?: "slack" | "teams";
    };
    if (!channelId || !content) return res.status(400).json({ message: "channelId and content required" });

    const channel = await storage.getChannel(Number(channelId));
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    const message = await storage.createMessage({
      channelId: channel.id,
      userId: jigantoBotUserId(),
      content: `[${source === "teams" ? "Teams" : "Slack"}] ${authorName}: ${content}`,
      authorSource: source ?? "slack",
    });
    await broadcastChannel(channel.id, "message", { channelId: channel.id });
    res.status(201).json(message);
  });
}

/** Post-send hooks: bridge forward, @jiganto reply, attachment linking */
export async function afterChatMessageCreated(opts: {
  channelId: number;
  userId: string;
  content: string;
  messageId: number;
  attachmentIds?: number[];
  authorName: string;
}): Promise<void> {
  const channel = await storage.getChannel(opts.channelId);
  if (!channel) return;

  if (opts.attachmentIds?.length) {
    await storage.linkAttachmentsToMessage(opts.messageId, opts.attachmentIds, opts.channelId, opts.userId);
  }

  const bridgeResult = await forwardMessageToBridge(channel, {
    authorName: opts.authorName,
    content: opts.content,
  });
  if (channel.bridgeConfig) {
    const cfg = channel.bridgeConfig as ChannelBridgeConfig;
    await storage.updateChannelBridge(opts.channelId, {
      ...cfg,
      lastSyncedAt: bridgeResult.ok ? new Date().toISOString() : cfg.lastSyncedAt ?? null,
      lastError: bridgeResult.ok ? null : bridgeResult.error ?? "Bridge error",
      active: bridgeResult.ok ? cfg.active : cfg.active,
    });
  }

  if (/@jiganto\b/i.test(opts.content) && chatAiEnabled()) {
    const question = opts.content.replace(/@jiganto/gi, "").trim();
    const answer = await answerJigantoQuery(question || "How can I help?");
    if (answer) {
      const reply = await storage.createMessage({
        channelId: opts.channelId,
        userId: jigantoBotUserId(),
        content: answer,
        messageType: "summary",
        authorSource: "jiganto",
      });
      await broadcastChannel(opts.channelId, "message", { channelId: opts.channelId, messageId: reply.id });
    }
  }

  await broadcastChannel(opts.channelId, "message", { channelId: opts.channelId, messageId: opts.messageId });
}
