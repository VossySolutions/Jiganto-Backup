import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { UserCog } from "lucide-react";

export function ImpersonationBanner() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["/api/auth/impersonation/status"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/auth/impersonation/status");
      if (!res.ok) return { active: false };
      return res.json() as Promise<{
        active: boolean;
        targetUserId?: string;
        targetEmail?: string | null;
      }>;
    },
    retry: false,
    staleTime: 30_000,
  });

  const endMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/impersonation/end"),
    onSuccess: () => {
      queryClient.invalidateQueries();
      window.location.reload();
    },
  });

  if (!data?.active) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-4 text-sm font-medium z-50">
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 shrink-0" />
        <span>
          Impersonating {data.targetEmail ?? data.targetUserId} — actions use their permissions
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0"
        onClick={() => endMutation.mutate()}
        disabled={endMutation.isPending}
      >
        End impersonation
      </Button>
    </div>
  );
}
