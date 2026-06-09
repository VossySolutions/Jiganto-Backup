import {

  createContext,

  useContext,

  useState,

  useEffect,

  useCallback,

  useRef,

  type ReactNode,

} from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useLocation } from "wouter";

import { DASHBOARD_PATH } from "@shared/app-routes";

import { usePermissions } from "@/hooks/use-permissions";

import {

  parseWorkspaceSlug,

  workspacePathFromClient,

} from "@/lib/workspace-scope";

import { getSupabaseAccessToken } from "@/lib/supabase-session";

import { setActiveWorkspaceClientId, setApiReadOnly, apiRequest, fetchWithAuth } from "@/lib/queryClient";



export interface Client {

  id: number;

  tenantId: number;

  name: string;

  slug?: string | null;

  shortCode: string;

  color: string;

  logoUrl?: string | null;

  industry?: string | null;

  status: string;

  engagementStatus?: string | null;

  contractValue?: string | null;

  contractStart?: string | null;

  contractEnd?: string | null;

  website?: string | null;

  notes?: string | null;

  crmAccountId?: number | null;

  projectCount?: number;

  atRiskCount?: number;

  createdAt?: string;

  updatedAt?: string;

}



interface ClientMembership {

  client: Client;

  role: string;

}



interface WorkspaceSession {

  clientId: number | null;

  workspaceId?: number | null;

  client?: Client | null;

}



interface ClientContextValue {

  clients: Client[];

  clientsLoading: boolean;

  activeClient: Client | null;

  setActiveClient: (client: Client | null) => void | Promise<void>;

  isMasterView: boolean;

  clientParam: string;

  isClientUser: boolean;

  myClientRole: string | null;

  showContextSwitcher: boolean;

  isReadOnly: boolean;

  canViewPmoMaster: boolean;

  isArchivedWorkspace: boolean;

}



const ClientContext = createContext<ClientContextValue>({

  clients: [],

  clientsLoading: false,

  activeClient: null,

  setActiveClient: () => {},

  isMasterView: true,

  clientParam: "",

  isClientUser: false,

  myClientRole: null,

  showContextSwitcher: false,

  isReadOnly: false,

  canViewPmoMaster: false,

  isArchivedWorkspace: false,

});



export function ClientContextProvider({ children }: { children: ReactNode }) {

  const [activeClient, setActiveClientState] = useState<Client | null>(null);

  const [location] = useLocation();

  const queryClient = useQueryClient();

  const {

    showContextSwitcher,

    isReadOnly,

    platformRole,

    permissions,

    workspace: authWorkspace,

    isAuthenticated,

    sessionReady,

  } = usePermissions();

  const { data: access } = useQuery<{ granted: boolean }>({

    queryKey: ["/api/auth/access"],

    enabled: sessionReady && isAuthenticated,

    staleTime: 60_000,

  });

  const accessGranted = access?.granted === true;

  const scopedClientIdRef = useRef<number | null | undefined>(undefined);

  // Workspace slug from /ws/:slug routes
  const slugFromUrl = parseWorkspaceSlug(location);

  const { data: membership = null } = useQuery<ClientMembership | null>({
    queryKey: ["/api/clients/me"],
    enabled: sessionReady && isAuthenticated && accessGranted,
  });

  const isClientUser =
    !!membership ||
    platformRole === "client_project_user" ||
    platformRole === "client_executive" ||
    platformRole === "client_jiganto_user";
  const myClientRole = membership?.role ?? null;

  const workspaceBootstrapPending =
    !!slugFromUrl &&
    !isClientUser &&
    activeClient == null &&
    !(authWorkspace?.mode === "client" && authWorkspace.client);

  const apiQueriesEnabled =
    sessionReady && isAuthenticated && accessGranted && !workspaceBootstrapPending;

  const canViewPmoMaster =
    permissions?.canViewPmoMaster ??
    authWorkspace?.canViewPmoMaster ??
    false;

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: apiQueriesEnabled,
  });

  const { data: sessionContext } = useQuery<WorkspaceSession>({
    queryKey: ["/api/clients/workspace-context"],
    enabled: sessionReady && isAuthenticated && accessGranted && showContextSwitcher && !isClientUser,
    staleTime: 30_000,
  });

  const sessionWorkspaceId = sessionContext?.workspaceId ?? sessionContext?.clientId ?? null;

  const { data: sessionClient } = useQuery<Client | null>({
    queryKey: ["/api/clients", "session", sessionWorkspaceId],
    enabled:
      apiQueriesEnabled &&
      showContextSwitcher &&
      !isClientUser &&
      sessionWorkspaceId != null &&
      sessionWorkspaceId > 0 &&
      !sessionContext?.client,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/clients/${sessionWorkspaceId}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: clientBySlug } = useQuery<Client | null>({
    queryKey: ["/api/clients/by-slug", slugFromUrl],
    enabled: !!slugFromUrl && showContextSwitcher && sessionReady && isAuthenticated && accessGranted,
    queryFn: async () => {
      const token = await getSupabaseAccessToken();
      const res = await fetch(`/api/clients/by-slug/${slugFromUrl}?allowArchived=true`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  const applyWorkspaceScope = useCallback(
    (client: Client | null) => {
      const nextId = client?.id ?? null;
      const prevId = scopedClientIdRef.current;
      if (prevId === nextId) return;
      scopedClientIdRef.current = nextId;
      setActiveClientState(client);
      setActiveWorkspaceClientId(nextId);
      if (prevId !== undefined && prevId !== nextId) {
        void queryClient.invalidateQueries({
          predicate: (q) => {
            const key = q.queryKey[0];
            return typeof key === "string" && key.startsWith("/api/") && !key.startsWith("/api/auth/");
          },
        });
      }
    },
    [queryClient],
  );

  const syncSessionWorkspace = useCallback(async (clientId: number | null) => {
    await apiRequest("PUT", "/api/clients/workspace-context", {
      clientId,
      workspaceId: clientId,
    });
  }, []);

  useEffect(() => {
    if (isClientUser) return;
    if (authWorkspace?.mode === "client" && authWorkspace.client) {
      applyWorkspaceScope(authWorkspace.client as Client);
    }
  }, [authWorkspace, isClientUser, applyWorkspaceScope]);

  useEffect(() => {
    if (isClientUser) return;

    if (slugFromUrl) {
      const resolved =
        clientBySlug ??
        sessionContext?.client ??
        clients.find((c) => c.slug === slugFromUrl) ??
        sessionClient ??
        null;
      if (resolved) {
        applyWorkspaceScope(resolved);
        if (sessionWorkspaceId !== resolved.id) {
          void syncSessionWorkspace(resolved.id);
        }
      }
      return;
    }

    if (sessionWorkspaceId == null || sessionWorkspaceId <= 0) {
      if (scopedClientIdRef.current != null) applyWorkspaceScope(null);
      return;
    }

    const resolved =
      sessionContext?.client ??
      clients.find((c) => c.id === sessionWorkspaceId) ??
      sessionClient ??
      null;
    if (resolved) applyWorkspaceScope(resolved);
  }, [
    clients,
    sessionClient,
    sessionContext?.client,
    sessionWorkspaceId,
    isClientUser,
    slugFromUrl,
    clientBySlug,
    applyWorkspaceScope,
    syncSessionWorkspace,
  ]);

  useEffect(() => {
    if (membership?.client) {
      applyWorkspaceScope(membership.client);
    }
  }, [membership, applyWorkspaceScope]);

  const setActiveClient = useCallback(
    (client: Client | null) => {
      if (isClientUser || !showContextSwitcher) return Promise.resolve();

      if (client) {
        return syncSessionWorkspace(client.id).then(() => {
          window.location.assign(workspacePathFromClient(client));
        });
      }

      return syncSessionWorkspace(null).then(() => {
        const dest = location.startsWith("/ws/")
          ? DASHBOARD_PATH
          : window.location.pathname + window.location.search;
        window.location.assign(dest);
      });
    },
    [isClientUser, showContextSwitcher, location, syncSessionWorkspace],
  );


  const isMasterView = !activeClient && !isClientUser;

  const isArchivedWorkspace =

    activeClient?.status === "archived" || activeClient?.status === "pending_delete";



  useEffect(() => {

    const readOnly = isReadOnly || isArchivedWorkspace;

    setApiReadOnly(accessGranted ? readOnly : false);

  }, [isReadOnly, isArchivedWorkspace, accessGranted]);



  useEffect(() => {

    if (activeClient) {

      const base = document.title.replace(/ — .*$/, "");

      document.title = `${base} — ${activeClient.name}`;

      return () => {

        document.title = base;

      };

    }

  }, [activeClient?.id, activeClient?.name]);



  const lastClientRef = useRef<Client | null>(null);

  useEffect(() => {

    if (activeClient) lastClientRef.current = activeClient;

  }, [activeClient]);



  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.key.toLowerCase() !== "w") return;

      if (!showContextSwitcher || isClientUser) return;

      e.preventDefault();

      if (activeClient) {

        setActiveClient(null);

      } else if (lastClientRef.current) {

        setActiveClient(lastClientRef.current);

      }

    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [activeClient, showContextSwitcher, isClientUser, setActiveClient]);



  return (

    <ClientContext.Provider

      value={{

        clients,

        clientsLoading,

        activeClient,

        setActiveClient,

        isMasterView,

        clientParam: "",

        isClientUser,

        myClientRole,

        showContextSwitcher,

        isReadOnly: isReadOnly || isArchivedWorkspace,

        canViewPmoMaster,

        isArchivedWorkspace,

      }}

    >

      {children}

    </ClientContext.Provider>

  );

}



export function useClientContext() {

  return useContext(ClientContext);

}


