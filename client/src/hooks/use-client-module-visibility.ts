import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import { CLIENT_WORKSPACE_CONFIGURABLE_KEYS } from "@shared/client-workspace-modules";

type ModRow = { key: string; label: string; locked: boolean; isVisible: boolean };

export function useClientModuleVisibility(clientId: number | null | undefined) {
  const { data: modules = [] } = useQuery<ModRow[]>({
    queryKey: ["/api/clients", clientId, "module-visibility"],
    enabled: !!clientId,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/clients/${clientId}/module-visibility`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 30_000,
  });

  const visibilityMap = new Map(modules.map((m) => [m.key, m.isVisible]));

  function isModuleVisibleInWorkspace(moduleKey: string | null): boolean {
    if (!moduleKey || !clientId) return true;
    const configurable = CLIENT_WORKSPACE_CONFIGURABLE_KEYS.find((m) => m.key === moduleKey);
    if (!configurable) return true;
    return visibilityMap.get(moduleKey) ?? configurable.defaultVisible;
  }

  return { modules, isModuleVisibleInWorkspace };
}
