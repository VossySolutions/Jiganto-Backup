import type { QueryClient } from "@tanstack/react-query";
import type { AggregatedTask } from "@shared/models/tasks";
import { buildTasksQueryKey, type TaskFilters } from "./constants";

export function patchTasksListCache(
  queryClient: QueryClient,
  filters: TaskFilters,
  taskId: string,
  patch: Partial<AggregatedTask>,
): AggregatedTask[] | undefined {
  const key = buildTasksQueryKey(filters);
  const previous = queryClient.getQueryData<AggregatedTask[]>(key);
  if (previous) {
    queryClient.setQueryData(
      key,
      previous.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    );
  }
  return previous;
}

export function rollbackTasksListCache(
  queryClient: QueryClient,
  filters: TaskFilters,
  previous: AggregatedTask[] | undefined,
) {
  if (previous) {
    queryClient.setQueryData(buildTasksQueryKey(filters), previous);
  }
}
