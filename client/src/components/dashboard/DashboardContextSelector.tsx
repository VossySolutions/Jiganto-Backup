import { useQuery } from "@tanstack/react-query";
import { useClientContext } from "@/hooks/use-client-context";
import { fetchWithAuth } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DashboardContextValue {
  clientId: number | null;
  projectId: number | null;
}

export function DashboardContextSelector({
  dashboardId,
  clientId,
  projectId,
  onClientChange,
  onProjectChange,
}: {
  dashboardId: string;
  clientId: number | null;
  projectId: number | null;
  onClientChange: (id: number | null) => void;
  onProjectChange: (id: number | null) => void;
}) {
  const { clients, activeClient, setActiveClient, isMasterView, showContextSwitcher, isClientUser } =
    useClientContext();

  const needsContext =
    ["projects", "portfolio", "crm", "tasks", "finance", "resources", "helpdesk", "business"].includes(
      dashboardId,
    ) || dashboardId.startsWith("custom-");
  if (!needsContext) return null;

  const projectsUrl =
    clientId != null ? `/api/dashboard/projects?clientId=${clientId}` : "/api/dashboard/projects";

  const { data: projects = [] } = useQuery({
    queryKey: [projectsUrl],
    queryFn: async () => {
      const res = await fetchWithAuth(projectsUrl);
      if (!res.ok) return [];
      return (await res.json()) as { id: number; name: string }[];
    },
    enabled: dashboardId === "projects",
    staleTime: 60_000,
  });

  const showClient =
    showContextSwitcher && !isClientUser && clients.length > 0 && isMasterView;
  const showProject = dashboardId === "projects" && projects.length > 1;

  if (!showClient && !showProject) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showClient && (
        <Select
          value={clientId != null ? String(clientId) : "all"}
          onValueChange={(v) => {
            if (v === "all") {
              onClientChange(null);
              setActiveClient(null);
            } else {
              const id = Number(v);
              onClientChange(id);
              const client = clients.find((c) => c.id === id) ?? null;
              setActiveClient(client);
            }
          }}
        >
          <SelectTrigger className="w-[200px] h-9" data-testid="dashboard-context-client">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {showProject && (
        <Select
          value={projectId != null ? String(projectId) : "all"}
          onValueChange={(v) => onProjectChange(v === "all" ? null : Number(v))}
        >
          <SelectTrigger className="w-[200px] h-9" data-testid="dashboard-context-project">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
