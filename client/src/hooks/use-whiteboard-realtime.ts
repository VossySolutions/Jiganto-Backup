import { useEffect } from "react";
import { supabase, supabaseAuthEnabled } from "@/lib/supabase";

/** Postgres changes on sticky_notes for collaborative sync. */
export function useWhiteboardNotesRealtime(
  whiteboardId: number | null,
  enabled: boolean,
  onChange: (payload: { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => void,
) {
  useEffect(() => {
    if (!enabled || !whiteboardId || !supabaseAuthEnabled || !supabase) return;

    const sub = supabase
      .channel(`whiteboard-notes-${whiteboardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sticky_notes",
          filter: `whiteboard_id=eq.${whiteboardId}`,
        },
        (payload) => {
          onChange({
            eventType: payload.eventType,
            new: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          });
        },
      )
      .subscribe();

    return () => {
      if (!supabase) return;
      void supabase.removeChannel(sub);
    };
  }, [whiteboardId, enabled, onChange]);
}

export type RemoteCursor = { userId: string; userName: string; x: number; y: number; ts: number };
export type PresenceUser = { userId: string; userName: string; lastActive: number };

export function useWhiteboardWebSocket(
  whiteboardId: number | null,
  userId: string | undefined,
  userName: string,
  enabled: boolean,
  handlers: {
    onCursor?: (c: RemoteCursor) => void;
    onPresence?: (users: PresenceUser[]) => void;
    onNoteEvent?: (type: string, payload: Record<string, unknown>) => void;
    onConnectionChange?: (connected: boolean) => void;
  },
) {
  useEffect(() => {
    if (!enabled || !whiteboardId || !userId) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const params = new URLSearchParams({ userId, userName });
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/whiteboard?${params}`);

      ws.onopen = () => {
        handlers.onConnectionChange?.(true);
        ws?.send(JSON.stringify({ type: "join", payload: { whiteboardId } }));
      };

      ws.onclose = () => {
        handlers.onConnectionChange?.(false);
        if (!closed) reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          switch (data.type) {
            case "cursor:moved":
              handlers.onCursor?.({
                userId: data.payload.userId,
                userName: data.payload.userName,
                x: data.payload.x,
                y: data.payload.y,
                ts: Date.now(),
              });
              break;
            case "presence:snapshot":
              handlers.onPresence?.(data.payload.users ?? []);
              break;
            case "presence:joined":
            case "presence:left":
              break;
            case "note:created":
            case "note:updated":
            case "note:moved":
            case "note:deleted":
              handlers.onNoteEvent?.(data.type, data.payload);
              break;
            default:
              break;
          }
        } catch { /* ignore */ }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave", payload: { whiteboardId } }));
      }
      ws?.close();
    };
  }, [whiteboardId, userId, userName, enabled]);
}

export function sendCursorMove(wsRef: React.MutableRefObject<WebSocket | null>, x: number, y: number) {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify({ type: "cursor:moved", payload: { x, y } }));
  }
}
