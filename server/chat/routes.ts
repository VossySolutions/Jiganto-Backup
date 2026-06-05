import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { getOpenAIConfig } from "../lib/openai";
import { chatStorage } from "./storage";

function createOpenAIClient(): OpenAI | null {
  const { apiKey, baseURL } = getOpenAIConfig();
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL });
}

export function registerChatRoutes(app: Express): void {
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const openai = createOpenAIClient();
      if (!openai) {
        return res.status(503).json({
          error: "OpenAI is not configured. Set OPENAI_API_KEY in your environment.",
        });
      }

      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      const userId = (req as Request & { user?: { claims?: { sub?: string } } }).user?.claims
        ?.sub;
      const orgId = (req as Request & { permissions?: { orgId?: number } }).permissions?.orgId;
      if (userId && orgId) {
        const { checkAiTokenAllowance } = await import("../lib/ai-tokens");
        const check = await checkAiTokenAllowance({
          orgId,
          userId,
          module: "chat",
          estimatedTokens: Math.max(100, Math.ceil(String(content).length / 4)),
        });
        if (!check.allowed) {
          return res.status(429).json({ error: check.reason });
        }
      }

      await chatStorage.createMessage(conversationId, "user", content);

      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 2048,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const chunkContent = chunk.choices[0]?.delta?.content || "";
        if (chunkContent) {
          fullResponse += chunkContent;
          res.write(`data: ${JSON.stringify({ content: chunkContent })}\n\n`);
        }
      }

      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      if (userId && orgId) {
        const estimatedTokens = Math.max(
          1,
          Math.ceil((content.length + fullResponse.length) / 4),
        );
        try {
          const { recordAiTokenUsage } = await import("../lib/ai-tokens");
          await recordAiTokenUsage({
            orgId,
            userId,
            module: "chat",
            featureName: "assistant_stream",
            tokensConsumed: estimatedTokens,
          });
        } catch {
          /* tables may not exist yet */
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}
