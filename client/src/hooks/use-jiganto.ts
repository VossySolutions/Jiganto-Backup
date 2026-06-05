import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { 
  type InsertTenant, type InsertBoard, type InsertColumn, type InsertItem, 
  type Tenant, type Module, type Board, type Column, type Item 
} from "@shared/schema";
import { fetchWithAuth } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";

function tenantsQueryEnabled(
  sessionReady: boolean,
  isAuthenticated: boolean,
  orgId: number | undefined,
) {
  return sessionReady && isAuthenticated && orgId != null;
}

// Tenants
export function useTenants() {
  const { sessionReady, isAuthenticated } = useAuth();
  const { permissions } = usePermissions();
  const orgId = permissions?.orgId;

  return useQuery({
    queryKey: [api.tenants.list.path, orgId],
    queryFn: async () => {
      const res = await fetchWithAuth(api.tenants.list.path);
      if (!res.ok) throw new Error("Failed to fetch tenants");
      return api.tenants.list.responses[200].parse(await res.json());
    },
    enabled: tenantsQueryEnabled(sessionReady, isAuthenticated, orgId),
    staleTime: 60_000,
  });
}

/** Current user's organisation (tenant) — name shown in the sidebar switcher. */
export function useCurrentOrganisation() {
  const { sessionReady, isAuthenticated } = useAuth();
  const { permissions } = usePermissions();
  const orgId = permissions?.orgId;

  return useQuery({
    queryKey: ["/api/tenants", orgId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/tenants/${orgId}`);
      if (!res.ok) throw new Error("Failed to fetch organisation");
      return (await res.json()) as Tenant;
    },
    enabled: tenantsQueryEnabled(sessionReady, isAuthenticated, orgId),
    staleTime: 60_000,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertTenant) => {
      const res = await fetch(api.tenants.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create tenant");
      return api.tenants.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.tenants.list.path] }),
  });
}

// Modules
export function useModules() {
  return useQuery({
    queryKey: [api.modules.list.path],
    queryFn: async () => {
      const res = await fetch(api.modules.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch modules");
      return api.modules.list.responses[200].parse(await res.json());
    },
  });
}

// Boards
export function useBoards(tenantId?: string, moduleId?: string) {
  return useQuery({
    queryKey: [api.boards.list.path, tenantId, moduleId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantId) params.append("tenantId", tenantId);
      if (moduleId) params.append("moduleId", moduleId);
      
      const url = `${api.boards.list.path}?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch boards");
      return api.boards.list.responses[200].parse(await res.json());
    },
    enabled: !!tenantId, // Wait for tenant to be selected
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertBoard) => {
      const res = await fetch(api.boards.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create board");
      return api.boards.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.boards.list.path] }),
  });
}

export function useBoard(id: number) {
  return useQuery({
    queryKey: [api.boards.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.boards.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch board");
      return api.boards.get.responses[200].parse(await res.json());
    },
  });
}

// Columns
export function useColumns(boardId: number) {
  return useQuery({
    queryKey: [api.columns.list.path, boardId],
    queryFn: async () => {
      const url = buildUrl(api.columns.list.path, { boardId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch columns");
      return api.columns.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ boardId, ...data }: InsertColumn) => {
      const url = buildUrl(api.columns.create.path, { boardId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create column");
      return api.columns.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, { boardId }) => queryClient.invalidateQueries({ queryKey: [api.columns.list.path, boardId] }),
  });
}

// Items
export function useItems(boardId: number) {
  return useQuery({
    queryKey: [api.items.list.path, boardId],
    queryFn: async () => {
      const url = buildUrl(api.items.list.path, { boardId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      return api.items.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ boardId, ...data }: InsertItem) => {
      const url = buildUrl(api.items.create.path, { boardId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create item");
      return api.items.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, { boardId }) => queryClient.invalidateQueries({ queryKey: [api.items.list.path, boardId] }),
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertItem>) => {
      const url = buildUrl(api.items.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update item");
      return api.items.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => queryClient.invalidateQueries({ queryKey: [api.items.list.path, data.boardId] }),
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.items.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.items.list.path] }), // Note: this might need more specific invalidation if we knew boardId
  });
}
