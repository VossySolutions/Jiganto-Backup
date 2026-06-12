import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import type { ResourceScope } from "@/types/resources-scope";

export type { ResourceScope };

/** Resource access scope (manager / consultant / contractor portal). Prefer session payload; falls back to API. */
export function useResourceScope() {
  const { resourceScope: fromSession, isLoading: sessionLoading } = usePermissions();

  const fallback = useQuery<ResourceScope>({
    queryKey: ["/api/resources/scope"],
    enabled: fromSession === undefined && !sessionLoading,
    staleTime: 60_000,
  });

  if (fromSession !== undefined) {
    return { data: fromSession, isLoading: sessionLoading, isError: false, refetch: () => {} };
  }

  return fallback;
}
