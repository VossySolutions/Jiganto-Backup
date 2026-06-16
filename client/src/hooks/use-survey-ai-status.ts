import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";

export const SURVEY_AI_EMPTY_BANNER =
  "Your organisation's AI token balance is empty. Contact your administrator to replenish the balance.";

export type SurveyAiStatus = {
  balance: number;
  monthlyAllocation: number;
  allowed: boolean;
  empty: boolean;
};

export function useSurveyAiStatus() {
  return useQuery<SurveyAiStatus>({
    queryKey: ["/api/surveys/ai-status"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/surveys/ai-status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load AI status");
      return res.json();
    },
    staleTime: 30_000,
  });
}
