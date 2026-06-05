import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { getSupabaseAccessToken } from "@/lib/supabase-session";
import { supabase, supabaseAuthEnabled } from "@/lib/supabase";

async function fetchUser(): Promise<User | null> {
  const token = await getSupabaseAccessToken();
  if (supabaseAuthEnabled && !token) return null;

  const response = await fetch("/api/auth/user", {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  if (supabaseAuthEnabled && supabase) {
    await supabase.auth.signOut();
    window.location.href = "/";
    return;
  }
  window.location.href = "/api/logout";
}

let devSessionCleared = false;

export function useAuth() {
  const queryClient = useQueryClient();
  const [sessionReady, setSessionReady] = useState(!supabaseAuthEnabled);
  const sessionReadyRef = useRef(false);

  useEffect(() => {
    if (!supabaseAuthEnabled || !supabase) return;

    let cancelled = false;

    const finishReady = () => {
      if (!cancelled && !sessionReadyRef.current) {
        sessionReadyRef.current = true;
        setSessionReady(true);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        finishReady();
        if (session?.access_token) void clearStaleDevSessionCookieOnce();
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        finishReady();
        void queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/auth/access"] });
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      finishReady();
      if (data.session?.access_token) void clearStaleDevSessionCookieOnce();
    });

    const timeout = setTimeout(finishReady, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const { data: user, isLoading: userLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    enabled: sessionReady,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = !sessionReady || userLoading;

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading,
    sessionReady,
    isAuthenticated: sessionReady && !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}

async function clearStaleDevSessionCookieOnce(): Promise<void> {
  if (devSessionCleared) return;
  devSessionCleared = true;
  try {
    await fetch("/api/auth/clear-dev-session", { method: "POST", credentials: "include" });
  } catch {
    devSessionCleared = false;
  }
}
