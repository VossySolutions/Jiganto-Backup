import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isNumericId } from "@/lib/pm-agile-mappers";

export function usePmAgileMutations(projectId?: number, activeWs?: string) {
  const queryClient = useQueryClient();
  const isDbMode = !!projectId;

  const invalidateWs = useCallback(() => {
    if (!projectId) return;
    queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "agile/workstreams"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "agile/dashboard"] });
    if (activeWs && isNumericId(activeWs)) {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/agile/workstreams", activeWs, "epics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/agile/workstreams", activeWs, "stories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/agile/workstreams", activeWs, "sprints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/agile/workstreams", activeWs, "defects"] });
    }
  }, [queryClient, projectId, activeWs]);

  const updateStory = useCallback(async (id: string, payload: Record<string, unknown>) => {
    if (!isDbMode || !isNumericId(id)) return;
    await apiRequest("PUT", `/api/pm/agile/stories/${id}`, payload);
    invalidateWs();
  }, [isDbMode, invalidateWs]);

  const deleteStory = useCallback(async (id: string) => {
    if (!isDbMode || !isNumericId(id)) return;
    await apiRequest("DELETE", `/api/pm/agile/stories/${id}`);
    invalidateWs();
  }, [isDbMode, invalidateWs]);

  const assignStoryToSprint = useCallback(async (
    storyId: string,
    sprint: { id: string; name: string } | null,
    status = "To Do",
  ) => {
    if (!isDbMode || !isNumericId(storyId)) return;
    await apiRequest("PUT", `/api/pm/agile/stories/${storyId}`, {
      sprintId: sprint && isNumericId(sprint.id) ? Number(sprint.id) : null,
      sprintName: sprint?.name ?? null,
      status,
    });
    invalidateWs();
  }, [isDbMode, invalidateWs]);

  const updateEpic = useCallback(async (id: string, payload: Record<string, unknown>) => {
    if (!isDbMode || !isNumericId(id)) return;
    await apiRequest("PUT", `/api/pm/agile/epics/${id}`, payload);
    invalidateWs();
  }, [isDbMode, invalidateWs]);

  const deleteEpic = useCallback(async (id: string) => {
    if (!isDbMode || !isNumericId(id)) return;
    await apiRequest("DELETE", `/api/pm/agile/epics/${id}`);
    invalidateWs();
  }, [isDbMode, invalidateWs]);

  const updateSprint = useCallback(async (id: string, payload: Record<string, unknown>) => {
    if (!isDbMode || !isNumericId(id)) return;
    await apiRequest("PUT", `/api/pm/agile/sprints/${id}`, payload);
    invalidateWs();
  }, [isDbMode, invalidateWs]);

  const deleteSprint = useCallback(async (id: string) => {
    if (!isDbMode || !isNumericId(id)) return;
    await apiRequest("DELETE", `/api/pm/agile/sprints/${id}`);
    invalidateWs();
  }, [isDbMode, invalidateWs]);

  const completeSprint = useCallback(async (sprintId: string, donePoints: number) => {
    if (!isDbMode || !isNumericId(sprintId)) return;
    await apiRequest("PUT", `/api/pm/agile/sprints/${sprintId}`, {
      status: "Closed",
      donePoints,
    });
    invalidateWs();
  }, [isDbMode, invalidateWs]);

  const activateSprint = useCallback(async (sprintId: string, allSprintIds: string[]) => {
    if (!isDbMode || !isNumericId(sprintId)) return;
    for (const id of allSprintIds) {
      if (isNumericId(id) && id !== sprintId) {
        await apiRequest("PUT", `/api/pm/agile/sprints/${id}`, { status: "Planned" }).catch(() => {});
      }
    }
    await apiRequest("PUT", `/api/pm/agile/sprints/${sprintId}`, { status: "Active" });
    invalidateWs();
  }, [isDbMode, invalidateWs]);

  const updateDefect = useCallback(async (id: string, payload: Record<string, unknown>) => {
    if (!isDbMode || !isNumericId(id)) return;
    await apiRequest("PUT", `/api/pm/agile/defects/${id}`, payload);
    invalidateWs();
  }, [isDbMode, invalidateWs]);

  const deleteDefect = useCallback(async (id: string) => {
    if (!isDbMode || !isNumericId(id)) return;
    await apiRequest("DELETE", `/api/pm/agile/defects/${id}`);
    invalidateWs();
  }, [isDbMode, invalidateWs]);

  return {
    isDbMode,
    invalidateWs,
    updateStory,
    deleteStory,
    assignStoryToSprint,
    updateEpic,
    deleteEpic,
    updateSprint,
    deleteSprint,
    completeSprint,
    activateSprint,
    updateDefect,
    deleteDefect,
  };
}
