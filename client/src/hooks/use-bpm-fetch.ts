import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { bpmFetchJson } from "@/lib/bpm-api";

type Options<T> = Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">;

/** Authenticated BPM API fetch (bearer + cookies). */
export function useBpmFetch<T>(
  queryKey: readonly unknown[],
  path: string,
  options?: Options<T>,
) {
  return useQuery<T, Error>({
    ...options,
    queryKey,
    queryFn: () => bpmFetchJson<T>(path),
  });
}
