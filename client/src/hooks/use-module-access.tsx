import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { navPathToModuleKey } from "@shared/models/module-access";

type ModuleAccessPayload = {
  /** `null` = no legacy module ACL (show all modules allowed by platform role). */
  modules: string[] | null;
};

export function useModuleAccess() {
  const { sessionReady, isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/session/modules"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/auth/session/modules");
      if (!res.ok) throw new Error("Failed to load module access");
      return (await res.json()) as ModuleAccessPayload;
    },
    enabled: sessionReady && isAuthenticated,
    staleTime: 60_000,
  });

  const allowedKeys = data?.modules;

  function canAccessNavPath(href: string): boolean {
    if (allowedKeys === null || allowedKeys === undefined) return true;
    const key = navPathToModuleKey(href);
    if (!key) return true;
    return allowedKeys.includes(key);
  }

  return {
    allowedModuleKeys: allowedKeys,
    canAccessNavPath,
    isLoading,
  };
}
