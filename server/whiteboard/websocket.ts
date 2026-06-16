import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

interface WbClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  whiteboardId?: number;
  lastActive: number;
}

export interface WhiteboardEvent {
  type: string;
  payload: Record<string, unknown>;
}

class WhiteboardWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WbClient> = new Map();
  private boardSubscriptions: Map<number, Set<string>> = new Map();

  constructor(server: HttpServer) {
    // noServer: avoid ws aborting unrelated upgrades (e.g. Vite /vite-hmr)
    this.wss = new WebSocketServer({ noServer: true });
    this.setupHandlers();

    server.on("upgrade", (req, socket, head) => {
      const pathname = new URL(req.url || "", `http://${req.headers.host}`).pathname;
      if (pathname !== "/ws/whiteboard") return;

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit("connection", ws, req);
      });
    });

    setInterval(() => this.pruneInactive(), 10_000);
    console.log("WebSocket server initialized on /ws/whiteboard");
  }

  private setupHandlers() {
    this.wss.on("connection", (ws, req) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const userId = url.searchParams.get("userId");
      const userName = url.searchParams.get("userName") ?? "User";

      if (!userId) {
        ws.close(1008, "User ID required");
        return;
      }

      const clientId = `${userId}-${Date.now()}`;
      const client: WbClient = { ws, userId, userName, lastActive: Date.now() };
      this.clients.set(clientId, client);

      ws.on("message", (data) => {
        try {
          const event = JSON.parse(data.toString()) as WhiteboardEvent & { type: string };
          this.handleEvent(clientId, event);
        } catch (err) {
          console.error("Whiteboard WS message error:", err);
        }
      });

      ws.on("close", () => {
        const c = this.clients.get(clientId);
        if (c?.whiteboardId) {
          this.leaveBoard(clientId, c.whiteboardId, c.userId);
        }
        this.clients.delete(clientId);
      });
    });
  }

  private handleEvent(clientId: string, event: WhiteboardEvent) {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.lastActive = Date.now();

    switch (event.type) {
      case "join":
        this.joinBoard(clientId, event.payload.whiteboardId as number, client.userId, client.userName);
        break;
      case "leave":
        if (client.whiteboardId) this.leaveBoard(clientId, client.whiteboardId, client.userId);
        break;
      case "cursor:moved":
        if (client.whiteboardId) {
          this.broadcastToBoard(client.whiteboardId, {
            type: "cursor:moved",
            payload: {
              userId: client.userId,
              userName: client.userName,
              x: event.payload.x,
              y: event.payload.y,
            },
          }, clientId);
        }
        break;
      case "presence:ping":
        client.lastActive = Date.now();
        break;
      default:
        break;
    }
  }

  private joinBoard(clientId: string, whiteboardId: number, userId: string, userName: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.whiteboardId && client.whiteboardId !== whiteboardId) {
      this.leaveBoard(clientId, client.whiteboardId, userId);
    }

    client.whiteboardId = whiteboardId;
    if (!this.boardSubscriptions.has(whiteboardId)) {
      this.boardSubscriptions.set(whiteboardId, new Set());
    }
    this.boardSubscriptions.get(whiteboardId)!.add(clientId);

    this.broadcastToBoard(whiteboardId, {
      type: "presence:joined",
      payload: { userId, userName, joinedAt: Date.now() },
    }, clientId);

    // Send current presence list to joiner
    const present = this.getPresentUsers(whiteboardId);
    client.ws.send(JSON.stringify({ type: "presence:snapshot", payload: { users: present } }));
  }

  private leaveBoard(clientId: string, whiteboardId: number, userId: string) {
    const subs = this.boardSubscriptions.get(whiteboardId);
    subs?.delete(clientId);
    const client = this.clients.get(clientId);
    if (client) client.whiteboardId = undefined;

    this.broadcastToBoard(whiteboardId, {
      type: "presence:left",
      payload: { userId },
    });
  }

  private getPresentUsers(whiteboardId: number) {
    const subs = this.boardSubscriptions.get(whiteboardId);
    if (!subs) return [];
    const seen = new Map<string, { userId: string; userName: string; lastActive: number }>();
    subs.forEach((cid) => {
      const c = this.clients.get(cid);
      if (c && Date.now() - c.lastActive < 10_000) {
        seen.set(c.userId, { userId: c.userId, userName: c.userName, lastActive: c.lastActive });
      }
    });
    return [...seen.values()];
  }

  private pruneInactive() {
    const now = Date.now();
    this.clients.forEach((client, clientId) => {
      if (client.whiteboardId && now - client.lastActive > 10_000) {
        this.leaveBoard(clientId, client.whiteboardId, client.userId);
      }
    });
  }

  broadcastToBoard(whiteboardId: number, event: WhiteboardEvent, excludeClientId?: string) {
    const subs = this.boardSubscriptions.get(whiteboardId);
    if (!subs) return;
    const message = JSON.stringify(event);
    subs.forEach((clientId) => {
      if (clientId === excludeClientId) return;
      const client = this.clients.get(clientId);
      if (client?.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  sendToBoard(whiteboardId: number, event: WhiteboardEvent) {
    this.broadcastToBoard(whiteboardId, event);
  }
}

let wbWss: WhiteboardWebSocketServer | null = null;

export function initializeWhiteboardWebSocket(server: HttpServer): WhiteboardWebSocketServer {
  if (!wbWss) wbWss = new WhiteboardWebSocketServer(server);
  return wbWss;
}

export function getWhiteboardWebSocket(): WhiteboardWebSocketServer | null {
  return wbWss;
}
