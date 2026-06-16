import { useEffect } from "react";
import { supabase, supabaseAuthEnabled } from "@/lib/supabase";

/** Supabase Realtime for module polls (Module 17 §6.2). Falls back to polling when disabled. */
export function useModulePollRealtime(pollId: number | null, enabled: boolean, onChange: () => void) {
  useEffect(() => {
    if (!enabled || !pollId || !supabaseAuthEnabled || !supabase) return;

    const sub = supabase
      .channel(`module-poll-${pollId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "module_poll_votes",
          filter: `poll_id=eq.${pollId}`,
        },
        () => onChange(),
      )
      .subscribe();

    return () => {
      if (!supabase) return;
      void supabase.removeChannel(sub);
    };
  }, [pollId, enabled, onChange]);
}

/** Supabase Realtime for inline chat poll cards. */
export function useChatPollRealtime(chatPollId: number | null, enabled: boolean, onChange: () => void) {
  useEffect(() => {
    if (!enabled || !chatPollId || !supabaseAuthEnabled || !supabase) return;

    const sub = supabase
      .channel(`chat-poll-${chatPollId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_poll_votes",
          filter: `poll_id=eq.${chatPollId}`,
        },
        () => onChange(),
      )
      .subscribe();

    return () => {
      if (!supabase) return;
      void supabase.removeChannel(sub);
    };
  }, [chatPollId, enabled, onChange]);
}
