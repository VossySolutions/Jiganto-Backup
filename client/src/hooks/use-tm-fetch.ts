import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { tmFetchJson } from "@/lib/tm-api";
import { useTmProject } from "@/contexts/TmProjectContext";

type Options<T> = Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn"> & {
  /** When true, query waits until a project is selected (default true for project-scoped APIs). */
  requireProject?: boolean;
};

/**
 * Authenticated fetch for Test Management APIs (includes bearer + cookies).
 */
export function useTmFetch<T>(
  queryKey: readonly unknown[],
  path: string,
  options?: Options<T>,
) {
  const { qsParam, activeProjectId } = useTmProject();
  const requireProject = options?.requireProject ?? true;
  const url = qsParam(path);
  const enabled = (options?.enabled ?? true) && (!requireProject || activeProjectId != null);

  return useQuery<T, Error>({
    ...options,
    queryKey: [...queryKey, activeProjectId],
    queryFn: () => tmFetchJson<T>(url),
    enabled,
    staleTime: options?.staleTime ?? 30_000,
  });
}

/** Build path with explicit id (no qsParam duplication). */
export function useTmFetchById<T>(
  queryKey: readonly unknown[],
  path: string | null,
  options?: Omit<Options<T>, "requireProject">,
) {
  const { activeProjectId } = useTmProject();
  return useQuery<T, Error>({
    ...options,
    queryKey: [...queryKey, activeProjectId],
    queryFn: () => tmFetchJson<T>(path!),
    enabled: (options?.enabled ?? true) && !!path,
    staleTime: options?.staleTime ?? 30_000,
  });
}
