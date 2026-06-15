import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import { supabase, supabaseAuthEnabled } from "@/lib/supabase";

type ChatConfig = {
  aiEnabled: boolean;
  supabaseRealtime: boolean;
  maxAttachmentMb: number;
  maxAttachmentsPerMessage: number;
};

export function useChatConfig() {
  return useQuery({
    queryKey: ["/api/chat/config"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/chat/config");
      if (!res.ok) throw new Error("Failed to load chat config");
      return (await res.json()) as ChatConfig;
    },
    staleTime: 60_000,
  });
}

/** Supabase Realtime when enabled; falls back to WebSocket in ChatPage. */
export function useChatSupabaseRealtime(
  channelId: number | null,
  enabled: boolean,
  onChange: () => void,
) {
  useEffect(() => {
    if (!enabled || !channelId || !supabaseAuthEnabled || !supabase) return;

    const sub = supabase
      .channel(`chat-messages-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        () => onChange(),
      )
      .subscribe();

    return () => {
      if (!supabase) return;
      void supabase.removeChannel(sub);
    };
  }, [channelId, enabled, onChange]);
}
