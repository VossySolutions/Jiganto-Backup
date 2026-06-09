import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";

export type AiModuleStatus = {
  configured: boolean;
  modules: {
    assistant: boolean;
    chat: boolean;
    dashboard: boolean;
    business: boolean;
    surveys: boolean;
    documents: boolean;
  };
};

export function useAiStatus() {
  return useQuery({
    queryKey: ["/api/ai/status"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/ai/status");
      if (!res.ok) throw new Error("Failed to load AI status");
      return (await res.json()) as AiModuleStatus;
    },
    staleTime: 60_000,
  });
}
