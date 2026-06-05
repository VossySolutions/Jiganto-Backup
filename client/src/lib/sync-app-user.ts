import { getSupabaseAccessToken } from "./supabase-session";
import { supabaseAuthEnabled } from "./supabase";

/** Ensures `public.users` has a row for the current Supabase session (same id as auth.users). */
export async function syncAppUserToDatabase(accessToken?: string): Promise<void> {
  if (!supabaseAuthEnabled) return;

  const token = accessToken ?? (await getSupabaseAccessToken());
  if (!token) return;

  const res = await fetch("/api/auth/user", {
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status !== 401 && res.status !== 403) {
      console.warn("[auth] Failed to sync app user:", res.status, await res.text());
    }
  }
}
