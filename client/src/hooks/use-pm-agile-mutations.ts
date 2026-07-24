import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isNumericId } from "@/lib/pm-agile-mappers";

type AgileEntity = "epics" | "stories" | "sprints" | "defects";

export function usePmAgileMutations(projectId?: number, activeWs?: string) {
  const queryClient = useQueryClient();
  const isDbMode = !!projectId;

  const storiesKey = ["/api/pm/agile/workstreams", activeWs, "stories"] as const;
  const epicsKey = ["/api/pm/agile/workstreams", activeWs, "epics"] as const;
  const sprintsKey = ["/api/pm/agile/workstreams", activeWs, "sprints"] as const;
  const defectsKey = ["/api/pm/agile/workstreams", activeWs, "defects"] as const;

  const invalidateEntity = useCallback((entity: AgileEntity) => {
    if (!activeWs || !isNumericId(activeWs)) return;
    queryClient.invalidateQueries({
      queryKey: ["/api/pm/agile/workstreams", activeWs, entity],
    });
  }, [queryClient, activeWs]);

  const invalidateWs = useCallback(() => {
    if (!projectId) return;
    queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "agile/workstreams"] });
    if (activeWs && isNumericId(activeWs)) {
      invalidateEntity("epics");
      invalidateEntity("stories");
      invalidateEntity("sprints");
      invalidateEntity("defects");
    }
  }, [queryClient, projectId, activeWs, invalidateEntity]);

  const removeFromCache = useCallback((key: readonly unknown[], id: string) => {
    queryClient.setQueryData(key as unknown[], (old: unknown) => {
      if (!Array.isArray(old)) return old;
      return old.filter((row: { id?: number | string }) => String(row.id) !== id);
    });
  }, [queryClient]);

  const patchInCache = useCallback((key: readonly unknown[], id: string, payload: Record<string, unknown>) => {
    queryClient.setQueryData(key as unknown[], (old: unknown) => {
      if (!Array.isArray(old)) return old;
      return old.map((row: { id?: number | string }) =>
        String(row.id) === id ? { ...row, ...payload } : row,
      );
    });
  }, [queryClient]);

  const updateStory = useCallback(async (id: string, payload: Record<string, unknown>) => {
    if (!isDbMode || !isNumericId(id)) return;
    patchInCache(storiesKey, id, payload);
    try {
      await apiRequest("PUT", `/api/pm/agile/stories/${id}`, payload);
    } catch (e) {
      invalidateEntity("stories");
      throw e;
    }
  }, [isDbMode, patchInCache, storiesKey, invalidateEntity]);

  const deleteStory = useCallback(async (id: string) => {
    if (!isDbMode || !isNumericId(id)) return;
    removeFromCache(storiesKey, id);
    try {
      await apiRequest("DELETE", `/api/pm/agile/stories/${id}`);
    } catch (e) {
      invalidateEntity("stories");
      throw e;
    }
  }, [isDbMode, removeFromCache, storiesKey, invalidateEntity]);

  const assignStoryToSprint = useCallback(async (
    storyId: string,
    sprint: { id: string; name: string } | null,
    status = "To Do",
  ) => {
    if (!isDbMode || !isNumericId(storyId)) return;
    const payload = {
      sprintId: sprint && isNumericId(sprint.id) ? Number(sprint.id) : null,
      sprintName: sprint?.name ?? null,
      status,
    };
    patchInCache(storiesKey, storyId, payload);
    try {
      await apiRequest("PUT", `/api/pm/agile/stories/${storyId}`, payload);
    } catch (e) {
      invalidateEntity("stories");
      throw e;
    }
  }, [isDbMode, patchInCache, storiesKey, invalidateEntity]);

  const updateEpic = useCallback(async (id: string, payload: Record<string, unknown>) => {
    if (!isDbMode || !isNumericId(id)) return;
    patchInCache(epicsKey, id, payload);
    try {
      await apiRequest("PUT", `/api/pm/agile/epics/${id}`, payload);
    } catch (e) {
      invalidateEntity("epics");
      throw e;
    }
  }, [isDbMode, patchInCache, epicsKey, invalidateEntity]);

  const deleteEpic = useCallback(async (id: string) => {
    if (!isDbMode || !isNumericId(id)) return;
    removeFromCache(epicsKey, id);
    try {
      await apiRequest("DELETE", `/api/pm/agile/epics/${id}`);
    } catch (e) {
      invalidateEntity("epics");
      throw e;
    }
  }, [isDbMode, removeFromCache, epicsKey, invalidateEntity]);

  const updateSprint = useCallback(async (id: string, payload: Record<string, unknown>) => {
    if (!isDbMode || !isNumericId(id)) return;
    patchInCache(sprintsKey, id, payload);
    try {
      await apiRequest("PUT", `/api/pm/agile/sprints/${id}`, payload);
    } catch (e) {
      invalidateEntity("sprints");
      throw e;
    }
  }, [isDbMode, patchInCache, sprintsKey, invalidateEntity]);

  const deleteSprint = useCallback(async (id: string) => {
    if (!isDbMode || !isNumericId(id)) return;
    removeFromCache(sprintsKey, id);
    try {
      await apiRequest("DELETE", `/api/pm/agile/sprints/${id}`);
    } catch (e) {
      invalidateEntity("sprints");
      throw e;
    }
  }, [isDbMode, removeFromCache, sprintsKey, invalidateEntity]);

  const completeSprint = useCallback(async (sprintId: string, donePoints: number) => {
    if (!isDbMode || !isNumericId(sprintId)) return;
    patchInCache(sprintsKey, sprintId, { status: "Closed", donePoints });
    try {
      await apiRequest("PUT", `/api/pm/agile/sprints/${sprintId}`, {
        status: "Closed",
        donePoints,
      });
    } catch (e) {
      invalidateEntity("sprints");
      throw e;
    }
  }, [isDbMode, patchInCache, sprintsKey, invalidateEntity]);

  const activateSprint = useCallback(async (sprintId: string, allSprintIds: string[]) => {
    if (!isDbMode || !isNumericId(sprintId)) return;
    queryClient.setQueryData(sprintsKey as unknown[], (old: unknown) => {
      if (!Array.isArray(old)) return old;
      return old.map((row: { id?: number | string; status?: string }) => {
        const id = String(row.id);
        if (id === sprintId) return { ...row, status: "Active" };
        if (allSprintIds.includes(id) && row.status === "Active") return { ...row, status: "Planned" };
        return row;
      });
    });
    try {
      await Promise.all(
        allSprintIds
          .filter((id) => isNumericId(id) && id !== sprintId)
          .map((id) => apiRequest("PUT", `/api/pm/agile/sprints/${id}`, { status: "Planned" }).catch(() => {})),
      );
      await apiRequest("PUT", `/api/pm/agile/sprints/${sprintId}`, { status: "Active" });
    } catch (e) {
      invalidateEntity("sprints");
      throw e;
    }
  }, [isDbMode, queryClient, sprintsKey, invalidateEntity]);

  const updateDefect = useCallback(async (id: string, payload: Record<string, unknown>) => {
    if (!isDbMode || !isNumericId(id)) return;
    patchInCache(defectsKey, id, payload);
    try {
      await apiRequest("PUT", `/api/pm/agile/defects/${id}`, payload);
    } catch (e) {
      invalidateEntity("defects");
      throw e;
    }
  }, [isDbMode, patchInCache, defectsKey, invalidateEntity]);

  const deleteDefect = useCallback(async (id: string) => {
    if (!isDbMode || !isNumericId(id)) return;
    removeFromCache(defectsKey, id);
    try {
      await apiRequest("DELETE", `/api/pm/agile/defects/${id}`);
    } catch (e) {
      invalidateEntity("defects");
      throw e;
    }
  }, [isDbMode, removeFromCache, defectsKey, invalidateEntity]);

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
