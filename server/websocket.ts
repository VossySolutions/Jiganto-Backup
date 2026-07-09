import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

interface ChatClient {
  ws: WebSocket;
  userId: string;
  channelId?: number;
}

interface ChatEvent {
  type: "message" | "edit" | "delete" | "typing" | "presence" | "join" | "leave" | "reaction" | "poll_vote";
  payload: Record<string, any>;
}

class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ChatClient> = new Map();
  private channelSubscriptions: Map<number, Set<string>> = new Map();
  private typingUsers: Map<number, Map<string, NodeJS.Timeout>> = new Map();

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
      const client: ChatClient = { ws, userId };
      this.clients.set(clientId, client);

      console.log(`Client connected: ${clientId}`);

      // Send presence update to all
      this.broadcastPresence(userId, true);

      ws.on("message", async (data) => {
        try {
          const event: ChatEvent = JSON.parse(data.toString());
          await this.handleEvent(clientId, event);
        } catch (err) {
          console.error("WebSocket message error:", err);
        }
      });

      ws.on("close", () => {
        const client = this.clients.get(clientId);
        if (client) {
          // Remove from all channel subscriptions
          this.channelSubscriptions.forEach((subscribers, _channelId) => {
            subscribers.delete(clientId);
          });
          // Clear typing indicators
          this.typingUsers.forEach((typingMap) => {
            const timeout = typingMap.get(userId);
            if (timeout) clearTimeout(timeout);
            typingMap.delete(userId);
          });
          this.clients.delete(clientId);
          this.broadcastPresence(userId, false);
        }
        console.log(`Client disconnected: ${clientId}`);
      });

      ws.on("error", (err) => {
        console.error("WebSocket error:", err);
      });
    });
  }

  private async handleEvent(clientId: string, event: ChatEvent) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (event.type) {
      case "join":
        await this.handleJoin(clientId, event.payload.channelId as number);
        break;
      case "leave":
        this.handleLeave(clientId, event.payload.channelId as number);
        break;
      case "typing":
        this.handleTyping(client.userId, event.payload.channelId as number);
        break;
      // Note: message, edit, delete, reaction are handled via REST API
      // WebSocket only handles broadcasting (via sendToChannel public method)
      // This prevents duplicate message creation and enforces REST authorization
    }
  }

  private async handleJoin(clientId: string, channelId: number) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Leave previous channel if switching
    if (client.channelId && client.channelId !== channelId) {
      this.handleLeave(clientId, client.channelId);
    }

    client.channelId = channelId;
    
    if (!this.channelSubscriptions.has(channelId)) {
      this.channelSubscriptions.set(channelId, new Set());
    }
    this.channelSubscriptions.get(channelId)!.add(clientId);

    // Notify channel of new member
    this.broadcastToChannel(channelId, {
      type: "join",
      payload: { userId: client.userId, channelId },
    }, clientId);
  }

  private handleLeave(clientId: string, channelId: number) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const subscribers = this.channelSubscriptions.get(channelId);
    if (subscribers) {
      subscribers.delete(clientId);
    }

    // Clear typing indicator
    const typingMap = this.typingUsers.get(channelId);
    if (typingMap) {
      const timeout = typingMap.get(client.userId);
      if (timeout) clearTimeout(timeout);
      typingMap.delete(client.userId);
    }

    this.broadcastToChannel(channelId, {
      type: "leave",
      payload: { userId: client.userId, channelId },
    }, clientId);
  }

  private handleTyping(userId: string, channelId: number) {
    if (!this.typingUsers.has(channelId)) {
      this.typingUsers.set(channelId, new Map());
    }
    const typingMap = this.typingUsers.get(channelId)!;

    // Clear existing timeout
    const existingTimeout = typingMap.get(userId);
    if (existingTimeout) clearTimeout(existingTimeout);

    // Set new timeout (typing indicator expires after 3 seconds)
    const timeout = setTimeout(() => {
      typingMap.delete(userId);
      this.broadcastToChannel(channelId, {
        type: "typing",
        payload: { userId, channelId, isTyping: false },
      });
    }, 3000);

    typingMap.set(userId, timeout);

    this.broadcastToChannel(channelId, {
      type: "typing",
      payload: { userId, channelId, isTyping: true },
    });
  }

  private broadcastToChannel(channelId: number, event: ChatEvent, excludeClientId?: string) {
    const subscribers = this.channelSubscriptions.get(channelId);
    if (!subscribers) return;

    const message = JSON.stringify(event);
    subscribers.forEach((clientId) => {
      if (clientId === excludeClientId) return;
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  private broadcastPresence(userId: string, isOnline: boolean) {
    const event: ChatEvent = {
      type: "presence",
      payload: { userId, isOnline },
    };
    const message = JSON.stringify(event);
    
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  // Public method to send a message to a specific channel (for API use)
  public sendToChannel(channelId: number, event: ChatEvent) {
    this.broadcastToChannel(channelId, event);
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
