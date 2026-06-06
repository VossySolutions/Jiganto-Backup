import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import type { ModuleEntitlements } from "@shared/models/dashboard";

export function useModuleEntitlements() {
  return useQuery({
    queryKey: ["/api/dashboard/module-entitlements"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/dashboard/module-entitlements");
      if (!res.ok) throw new Error("Failed to load entitlements");
      return (await res.json()) as ModuleEntitlements;
    },
    staleTime: 5 * 60_000,
  });
}

export function isModuleLicensed(key: string, entitlements?: ModuleEntitlements | null): boolean {
  if (!entitlements || entitlements.licensedModuleKeys === null) return true;
  return entitlements.licensedModuleKeys.includes(key);
}
