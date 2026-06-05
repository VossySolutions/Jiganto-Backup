import { useEffect, useRef } from "react";
import { supabase, supabaseAuthEnabled } from "@/lib/supabase";
import { syncAppUserToDatabase } from "@/lib/sync-app-user";

/**
 * Keeps `public.users` in sync with Supabase Auth on sign-in and token refresh.
 * Standard pattern: auth.users (login) + public.users (FKs), same UUID.
 */
export function SupabaseAuthSync({ children }: { children: React.ReactNode }) {
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabaseAuthEnabled || !supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const token = session?.access_token;
      if (
        !token ||
        !(
          event === "INITIAL_SESSION" ||
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        )
      ) {
        return;
      }

      if (syncedRef.current === token && event !== "USER_UPDATED") return;
      syncedRef.current = token;
      await syncAppUserToDatabase(token);
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
