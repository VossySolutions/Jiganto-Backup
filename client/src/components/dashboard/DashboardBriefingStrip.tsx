import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAuth } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { DashboardBriefing } from "@shared/models/dashboard";

function buildQuery(clientId?: number | null, projectId?: number | null) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", String(clientId));
  if (projectId) params.set("projectId", String(projectId));
  const q = params.toString();
  return q ? `/api/dashboard/briefing?${q}` : "/api/dashboard/briefing";
}

const SEVERITY = {
  info: { icon: Info, className: "text-blue-600 dark:text-blue-400" },
  warn: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
  critical: { icon: AlertCircle, className: "text-red-600 dark:text-red-400" },
} as const;

export function DashboardBriefingStrip({
  clientId,
  projectId,
}: {
  clientId?: number | null;
  projectId?: number | null;
}) {
  const url = buildQuery(clientId, projectId);
  const { data, isLoading } = useQuery({
    queryKey: [url],
    queryFn: async () => {
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("Failed to load briefing");
      return (await res.json()) as DashboardBriefing;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-2xl" />;
  }

  if (!data || data.items.length === 0) return null;

  const healthTone =
    data.healthScore >= 80
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
      : data.healthScore >= 60
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";

  return (
    <Card className="rounded-2xl border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={cn("text-sm font-semibold px-3 py-1", healthTone)}>
            Health {data.healthScore} · {data.healthLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">Platform briefing</span>
        </div>
        <div className="flex flex-col gap-2">
          {data.items.slice(0, 5).map((item) => {
            const cfg = SEVERITY[item.severity];
            const Icon = cfg.icon;
            const row = (
              <div className="flex items-start gap-2 text-sm">
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.className)} />
                <div>
                  <span className="font-medium">{item.title}</span>
                  <span className="text-muted-foreground"> — {item.detail}</span>
                </div>
              </div>
            );
            return item.href ? (
              <Link key={item.id} href={item.href} className="hover:text-primary transition-colors">
                {row}
              </Link>
            ) : (
              <div key={item.id}>{row}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
