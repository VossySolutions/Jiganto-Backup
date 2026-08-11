import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

type PresenceStatus = "online" | "away" | "offline";

interface ChatClient {
  ws: WebSocket;
  userId: string;
  channelId?: number;
  lastActive: number;
}

interface ChatEvent {
  type:
    | "message"
    | "delete"
    | "typing"
    | "presence"
    | "presence_snapshot"
    | "presence_ping"
    | "join"
    | "leave"
    | "reaction"
    | "poll_vote";
  payload: Record<string, any>;
}

const AWAY_AFTER_MS = 2 * 60 * 1000;

class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ChatClient> = new Map();
  private channelSubscriptions: Map<number, Set<string>> = new Map();
  private typingUsers: Map<number, Map<string, NodeJS.Timeout>> = new Map();
  /** Latest known status per user (while they have at least one socket). */
  private userStatus: Map<string, PresenceStatus> = new Map();

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupHandlers();

    server.on("upgrade", (req, socket, head) => {
      const pathname = new URL(req.url || "", `http://${req.headers.host}`).pathname;
      if (pathname !== "/ws/chat") return;

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit("connection", ws, req);
      });
    });

    setInterval(() => this.recomputeAwayStatuses(), 30_000);
    console.log("WebSocket server initialized on /ws/chat");
  }

  private setupHandlers() {
    this.wss.on("connection", (ws, req) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const userId = url.searchParams.get("userId");

      if (!userId) {
        ws.close(1008, "User ID required");
        return;
      }

      const clientId = `${userId}-${Date.now()}`;
      const client: ChatClient = { ws, userId, lastActive: Date.now() };
      this.clients.set(clientId, client);

      // Snapshot of who is currently online/away for the new client
      this.sendPresenceSnapshot(ws);
      this.setUserStatus(userId, "online");

      ws.on("message", async (data) => {
        try {
          const event: ChatEvent = JSON.parse(data.toString());
          await this.handleEvent(clientId, event);
        } catch (err) {
          console.error("WebSocket message error:", err);
        }
      });

      ws.on("close", () => {
        const c = this.clients.get(clientId);
        if (c) {
          this.channelSubscriptions.forEach((subscribers) => {
            subscribers.delete(clientId);
          });
          this.typingUsers.forEach((typingMap) => {
            const timeout = typingMap.get(userId);
            if (timeout) clearTimeout(timeout);
            typingMap.delete(userId);
          });
          this.clients.delete(clientId);
          if (!this.hasOpenClient(userId)) {
            this.setUserStatus(userId, "offline");
            this.userStatus.delete(userId);
          }
        }
      });

      ws.on("error", (err) => {
        console.error("WebSocket error:", err);
      });
    });
  }

  private hasOpenClient(userId: string): boolean {
    for (const c of this.clients.values()) {
      if (c.userId === userId && c.ws.readyState === WebSocket.OPEN) return true;
    }
    return false;
  }

  private async handleEvent(clientId: string, event: ChatEvent) {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.lastActive = Date.now();

    switch (event.type) {
      case "join":
        this.handleJoin(clientId, event.payload.channelId as number);
        break;
      case "typing":
        if (this.userStatus.get(client.userId) !== "online") {
          this.setUserStatus(client.userId, "online");
        }
        await this.handleTyping(
          client.userId,
          event.payload.channelId as number,
          typeof event.payload.displayName === "string" ? event.payload.displayName : undefined,
        );
        break;
      case "presence_ping":
        if (this.userStatus.get(client.userId) === "away") {
          this.setUserStatus(client.userId, "online");
        } else if (!this.userStatus.has(client.userId)) {
          this.setUserStatus(client.userId, "online");
        }
        break;
      default:
        break;
    }
  }

  private handleJoin(clientId: string, channelId: number) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.channelId && client.channelId !== channelId) {
      this.handleLeave(clientId, client.channelId);
    }

    client.channelId = channelId;

    if (!this.channelSubscriptions.has(channelId)) {
      this.channelSubscriptions.set(channelId, new Set());
    }
    this.channelSubscriptions.get(channelId)!.add(clientId);

    this.broadcastToChannel(
      channelId,
      {
        type: "join",
        payload: { userId: client.userId, channelId },
      },
      clientId,
    );
  }

  private handleLeave(clientId: string, channelId: number) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const subscribers = this.channelSubscriptions.get(channelId);
    if (subscribers) {
      subscribers.delete(clientId);
    }

    const typingMap = this.typingUsers.get(channelId);
    if (typingMap) {
      const timeout = typingMap.get(client.userId);
      if (timeout) clearTimeout(timeout);
      typingMap.delete(client.userId);
    }

    this.broadcastToChannel(
      channelId,
      {
        type: "leave",
        payload: { userId: client.userId, channelId },
      },
      clientId,
    );
  }

  private async handleTyping(userId: string, channelId: number, displayName?: string) {
    if (!this.typingUsers.has(channelId)) {
      this.typingUsers.set(channelId, new Map());
    }
    const typingMap = this.typingUsers.get(channelId)!;

    const existingTimeout = typingMap.get(userId);
    if (existingTimeout) clearTimeout(existingTimeout);

    let resolvedName = displayName?.trim() || "";
    if (!resolvedName) {
      try {
        const { storage } = await import("./storage");
        const members = await storage.getChannelMembers(channelId);
        const member = members.find((m) => m.userId === userId);
        const full = [member?.user.firstName, member?.user.lastName].filter(Boolean).join(" ");
        resolvedName = full || "Someone";
      } catch {
        resolvedName = "Someone";
      }
    }

    const timeout = setTimeout(() => {
      typingMap.delete(userId);
      const stopEvent: ChatEvent = {
        type: "typing",
        payload: { userId, channelId, displayName: resolvedName, isTyping: false },
      };
      this.broadcastToChannel(channelId, stopEvent);
      void this.notifyChannelMembers(channelId, stopEvent);
    }, 3000);

    typingMap.set(userId, timeout);

    const startEvent: ChatEvent = {
      type: "typing",
      payload: { userId, channelId, displayName: resolvedName, isTyping: true },
    };
    this.broadcastToChannel(channelId, startEvent);
    await this.notifyChannelMembers(channelId, startEvent);
  }

  private async notifyChannelMembers(channelId: number, event: ChatEvent) {
    try {
      const { storage } = await import("./storage");
      const members = await storage.getChannelMembers(channelId);
      this.sendToUsers(
        members.map((m) => m.userId),
        event,
      );
    } catch {
      /* non-fatal */
    }
  }

  private broadcastToChannel(channelId: number, event: ChatEvent, excludeClientId?: string) {
    const subscribers = this.channelSubscriptions.get(channelId);
    if (!subscribers) return;

    const message = JSON.stringify(event);
    subscribers.forEach((id) => {
      if (id === excludeClientId) return;
      const client = this.clients.get(id);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  private setUserStatus(userId: string, status: PresenceStatus) {
    const prev = this.userStatus.get(userId);
    if (prev === status) return;
    this.userStatus.set(userId, status);
    this.broadcastPresence(userId, status);
  }

  private recomputeAwayStatuses() {
    const now = Date.now();
    const seen = new Set<string>();
    for (const client of this.clients.values()) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      if (seen.has(client.userId)) continue;
      seen.add(client.userId);
      let latest = 0;
      for (const c of this.clients.values()) {
        if (c.userId === client.userId && c.ws.readyState === WebSocket.OPEN) {
          latest = Math.max(latest, c.lastActive);
        }
      }
      const next: PresenceStatus = now - latest > AWAY_AFTER_MS ? "away" : "online";
      this.setUserStatus(client.userId, next);
    }
  }

  private sendPresenceSnapshot(ws: WebSocket) {
    const users: Array<{ userId: string; status: PresenceStatus }> = [];
    this.userStatus.forEach((status, userId) => {
      if (status !== "offline") users.push({ userId, status });
    });
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "presence_snapshot", payload: { users } }));
    }
  }

  private broadcastPresence(userId: string, status: PresenceStatus) {
    const event: ChatEvent = {
      type: "presence",
      payload: { userId, status },
    };
    const message = JSON.stringify(event);

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  public sendToChannel(channelId: number, event: ChatEvent) {
    this.broadcastToChannel(channelId, event);
  }

  /** Notify connected clients by user id (e.g. DM recipient not viewing that channel yet). */
  public sendToUsers(userIds: string[], event: ChatEvent) {
    if (!userIds.length) return;
    const targets = new Set(userIds);
    const message = JSON.stringify(event);
    this.clients.forEach((client) => {
      if (targets.has(client.userId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }
}

let chatWss: ChatWebSocketServer | null = null;

export function initializeChatWebSocket(server: HttpServer): ChatWebSocketServer {
  if (!chatWss) {
    chatWss = new ChatWebSocketServer(server);
  }
  return chatWss;
}

export function getChatWebSocket(): ChatWebSocketServer | null {
  return chatWss;
}
