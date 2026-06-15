import { supabase, supabaseAuthEnabled } from "./supabase";

/** Bearer token for API calls, or undefined if signed out / Supabase disabled. */
export async function getSupabaseAccessToken(): Promise<string | undefined> {
  if (!supabaseAuthEnabled || !supabase) return undefined;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

/**
 * Wait until Supabase has finished loading the session from browser storage.
 * `getSession()` alone can resolve before `_recoverAndRefresh` completes.
 */
export function waitForSupabaseSession(): Promise<void> {
  if (!supabaseAuthEnabled || !supabase) return Promise.resolve();

  const client = supabase;
  if (!client) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      resolve();
    };

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") done();
    });

    void client.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) done();
    });

    setTimeout(done, 5000);
  });
}
