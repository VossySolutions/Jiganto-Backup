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
import { setActiveWorkspaceClientId, setApiReadOnly } from "@/lib/queryClient";
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

interface ClientContextValue {
  clients: Client[];
  clientsLoading: boolean;
  activeClient: Client | null;
  setActiveClient: (client: Client | null) => void;
  /** Master org (PMO) view — no client workspace selected. */
  isMasterView: boolean;
  clientParam: string;
  isClientUser: boolean;
  myClientRole: string | null;
  showContextSwitcher: boolean;
  isReadOnly: boolean;
  canViewPmoMaster: boolean;
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
});

const STORAGE_KEY = "jiganto_active_client_id";

export function ClientContextProvider({ children }: { children: ReactNode }) {
  const [activeClient, setActiveClientState] = useState<Client | null>(null);
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const {
    showContextSwitcher,
    isReadOnly,
    platformRole,
    permissions,
    workspace,
    isAuthenticated,
    sessionReady,
  } = usePermissions();
  const { data: access } = useQuery<{ granted: boolean }>({
    queryKey: ["/api/auth/access"],
    enabled: sessionReady && isAuthenticated,
    staleTime: 60_000,
  });
  const accessGranted = access?.granted === true;
  const apiQueriesEnabled = sessionReady && isAuthenticated && accessGranted;
  const scopedClientIdRef = useRef<number | null | undefined>(undefined);

  const canViewPmoMaster =
    permissions?.canViewPmoMaster ??
    workspace?.canViewPmoMaster ??
    false;

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: apiQueriesEnabled,
  });

  const { data: membership = null } = useQuery<ClientMembership | null>({
    queryKey: ["/api/clients/me"],
    enabled: apiQueriesEnabled,
  });

  const slugFromUrl = parseWorkspaceSlug(location);

  const { data: clientBySlug } = useQuery<Client | null>({
    queryKey: ["/api/clients/by-slug", slugFromUrl],
    enabled: !!slugFromUrl && showContextSwitcher,
    queryFn: async () => {
      const token = await getSupabaseAccessToken();
      const res = await fetch(`/api/clients/by-slug/${slugFromUrl}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  const isClientUser =
    !!membership ||
    platformRole === "client_project_user" ||
    platformRole === "client_executive" ||
    platformRole === "client_jiganto_user";
  const myClientRole = membership?.role ?? null;

  const applyWorkspaceScope = useCallback(
    (client: Client | null) => {
      const nextId = client?.id ?? null;
      if (scopedClientIdRef.current === nextId) return;
      scopedClientIdRef.current = nextId;
      setActiveClientState(client);
      setActiveWorkspaceClientId(nextId);
      void queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/") && !key.startsWith("/api/auth/");
        },
      });
    },
    [queryClient],
  );

  useEffect(() => {
    if (isClientUser) return;
    if (clients.length === 0) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && !slugFromUrl) {
      const found = clients.find((c) => c.id === Number(saved));
      if (found) applyWorkspaceScope(found);
      else localStorage.removeItem(STORAGE_KEY);
    }
  }, [clients, isClientUser, slugFromUrl, applyWorkspaceScope]);

  useEffect(() => {
    if (membership?.client) {
      applyWorkspaceScope(membership.client);
    }
  }, [membership, applyWorkspaceScope]);

  useEffect(() => {
    if (!slugFromUrl || !clientBySlug || isClientUser) return;
    applyWorkspaceScope(clientBySlug);
  }, [slugFromUrl, clientBySlug, isClientUser, applyWorkspaceScope]);

  const setActiveClient = (client: Client | null) => {
    if (isClientUser || !showContextSwitcher) return;

    applyWorkspaceScope(client);
    if (client) {
      localStorage.setItem(STORAGE_KEY, String(client.id));
      navigate(workspacePathFromClient(client));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      if (location.startsWith("/ws/")) {
        navigate(DASHBOARD_PATH);
      }
    }
  };

  const clientParam = activeClient ? `?clientId=${activeClient.id}` : "";
  const isMasterView = !activeClient && !isClientUser;

  useEffect(() => {
    setApiReadOnly(accessGranted ? isReadOnly : false);
  }, [isReadOnly, accessGranted]);

  return (
    <ClientContext.Provider
      value={{
        clients,
        clientsLoading,
        activeClient,
        setActiveClient,
        isMasterView,
        clientParam,
        isClientUser,
        myClientRole,
        showContextSwitcher,
        isReadOnly,
        canViewPmoMaster,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  return useContext(ClientContext);
}
