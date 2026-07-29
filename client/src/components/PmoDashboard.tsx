import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Briefcase, FolderKanban, Users, ArrowRightCircle } from "lucide-react";
import { useClientContext } from "@/hooks/use-client-context";
import { coerceArray } from "@/lib/coerce-array";
import { getQueryFn } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface PmoTotals {
  totalClients: number;
  totalProjects: number;
  totalAtRisk: number;
  internalProjects: number;
}

interface PmoClientCard {
  id: number;
  name: string;
  shortCode: string;
  color: string;
  slug?: string | null;
  projectCount?: number;
  atRiskCount?: number;
  industry?: string | null;
}

interface PmoProjectRow {
  id: number;
  name: string;
  clientId?: number | null;
  ragStatus?: string | null;
  status?: string;
}

export function PmoDashboard() {
  const { setActiveClient, clients: workspaceClients } = useClientContext();

  const {
    data: pmoData,
    isLoading: pmoLoading,
    isError: pmoError,
    error: pmoErrorDetail,
  } = useQuery<{ clients: PmoClientCard[]; totals: PmoTotals }>({
    queryKey: ["/api/clients/pmo-dashboard"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 60_000,
  });

  const { data: projectsRaw, isLoading: projectsLoading } = useQuery<unknown>({
    queryKey: ["/api/pm/projects"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 60_000,
  });

  const allProjects = coerceArray<PmoProjectRow>(projectsRaw);
  const isLoading = pmoLoading || projectsLoading;

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="pmo-loading">
        Loading PMO dashboard…
      </p>
    );
  }

  if (pmoError) {
    return (
      <p className="text-destructive text-sm" data-testid="pmo-error">
        Could not load PMO dashboard: {String(pmoErrorDetail)}
      </p>
    );
  }

  const totals = pmoData?.totals;
  const clients = pmoData?.clients ?? [];

  const metrics = [
    {
      title: "Client workspaces",
      value: String(totals?.totalClients ?? 0),
      icon: Users,
      color: "text-status-blue-foreground bg-status-blue",
    },
    {
      title: "Projects (all clients)",
      value: String(totals?.totalProjects ?? 0),
      icon: FolderKanban,
      color: "text-status-purple-foreground bg-status-purple",
    },
    {
      title: "At risk",
      value: String(totals?.totalAtRisk ?? 0),
      icon: AlertTriangle,
      color: "text-status-amber-foreground bg-status-amber",
    },
    {
      title: "Internal (no client)",
      value: String(totals?.internalProjects ?? 0),
      icon: Briefcase,
      color: "text-status-green-foreground bg-status-green",
    },
  ];

  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));
  const projectPreview = allProjects.slice(0, 20);

  return (
    <div className="space-y-8" data-testid="pmo-dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.title} className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.title}</CardTitle>
              <div className={cn("p-1.5 rounded-lg", m.color)}>
                <m.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Client workspaces</CardTitle>
            <CardDescription>Select a workspace to scope the entire application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No client workspaces yet.</p>
            ) : (
              clients.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/40 transition-colors"
                  data-testid={`pmo-client-${c.id}`}
                >
                  <div
                    className="h-8 w-8 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.shortCode}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.projectCount ?? 0} projects
                      {(c.atRiskCount ?? 0) > 0 && (
                        <span className="text-status-amber-foreground ml-1">
                          · {c.atRiskCount} at risk
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      const full = workspaceClients.find((x) => x.id === c.id);
                      if (full) setActiveClient(full);
                    }}
                    data-testid={`pmo-enter-${c.id}`}
                  >
                    <ArrowRightCircle className="h-3.5 w-3.5" />
                    Open
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Portfolio — all projects</CardTitle>
            <CardDescription>Across every client workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {projectPreview.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              projectPreview.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 py-2 border-b last:border-0 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.clientId
                        ? clientNameById.get(p.clientId) ?? `Client #${p.clientId}`
                        : "Internal"}
                    </p>
                  </div>
                  {p.ragStatus && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize shrink-0",
                        p.ragStatus === "red" && "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400",
                        p.ragStatus === "amber" && "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400",
                        p.ragStatus === "green" && "border-green-300 text-green-700 dark:border-green-800 dark:text-green-400",
                      )}
                    >
                      {p.ragStatus}
                    </Badge>
                  )}
                </div>
              ))
            )}
            {allProjects.length > 20 && (
              <Link href="/modules/projects">
                <Button variant="ghost" className="px-0 text-primary hover:text-primary">
                  View all in Projects →
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
