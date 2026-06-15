import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceGridSkeleton } from "./loading";
import type { Workspace } from "@shared/schema";

export function WorkspaceKpiStrip({
  workspaces,
  loading,
  onTabChange,
  activeTab,
}: {
  workspaces: Workspace[];
  loading?: boolean;
  onTabChange: (tab: "all" | "favorites" | "recent" | "shared" | "mine") => void;
  activeTab: string;
}) {
  if (loading && workspaces.length === 0) {
    return <WorkspaceGridSkeleton count={4} />;
  }

  const total = workspaces.length;
  const favorites = workspaces.filter((w) => w.isFavorite).length;
  const active = workspaces.filter((w) => (w.status || "active") === "active").length;
  const archived = workspaces.filter((w) => w.status === "archived").length;
  const shared = workspaces.filter((w) => Boolean((w as any).isShared)).length;

  const items = [
    { key: "all", label: "All workspaces", value: total, tab: "all" as const, color: "text-primary" },
    { key: "favorites", label: "Favorites", value: favorites, tab: "favorites" as const, color: "text-amber-600" },
    { key: "active", label: "Active", value: active, tab: "all" as const, color: "text-emerald-600" },
    { key: "shared", label: "Shared with me", value: shared, tab: "shared" as const, color: "text-blue-600" },
    { key: "archived", label: "Archived", value: archived, tab: "all" as const, color: "text-muted-foreground" },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-visible md:pb-0">
      {items.map((kpi) => (
        <Card
          key={kpi.key}
          className={cn(
            "min-w-[128px] snap-start shrink-0 cursor-pointer hover-elevate border-border/40 md:min-w-0",
            activeTab === kpi.tab && kpi.key !== "active" && kpi.key !== "archived" && "ring-1 ring-primary/30",
          )}
          onClick={() => onTabChange(kpi.tab)}
          data-testid={`workspace-kpi-${kpi.key}`}
        >
          <CardContent className="p-3 text-center">
            <p className={cn("text-2xl font-bold leading-none", kpi.color)}>{kpi.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{kpi.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
