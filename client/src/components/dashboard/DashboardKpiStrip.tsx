import { Link } from "wouter";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, AlertCircle, DollarSign, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/queryClient";
import type { DashboardKpiStrip as KpiData } from "@shared/models/dashboard";

const KPI_CONFIG = [
  { key: "activeItems" as const, label: "Active Items", icon: Activity, tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  { key: "atRisk" as const, label: "At Risk", icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
  { key: "critical" as const, label: "Critical", icon: AlertCircle, tone: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
  { key: "portfolioBudgetLabel" as const, label: "Portfolio Budget", icon: DollarSign, tone: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", valueKey: "portfolioBudgetLabel" as const },
  { key: "teamMembers" as const, label: "Team Members", icon: Users, tone: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
];

function buildQuery(clientId?: number | null, projectId?: number | null) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", String(clientId));
  if (projectId) params.set("projectId", String(projectId));
  const q = params.toString();
  return q ? `/api/dashboard/kpi-strip?${q}` : "/api/dashboard/kpi-strip";
}

function buildStreamQuery(clientId?: number | null, projectId?: number | null) {
  return buildQuery(clientId, projectId).replace("/kpi-strip", "/kpi-strip/stream");
}

export function DashboardKpiStrip({
  clientId,
  projectId,
}: {
  clientId?: number | null;
  projectId?: number | null;
}) {
  const url = buildQuery(clientId, projectId);
  const streamUrl = buildStreamQuery(clientId, projectId);
  const [liveData, setLiveData] = useState<KpiData | null>(null);

  const { data: initialData, isLoading } = useQuery({
    queryKey: [url],
    queryFn: async () => {
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("Failed to load KPIs");
      return (await res.json()) as KpiData;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    setLiveData(null);
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetchWithAuth(streamUrl, { signal: controller.signal });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              const parsed = JSON.parse(line.slice(6)) as KpiData;
              if (!cancelled) setLiveData(parsed);
            } catch {
              /* ignore malformed chunk */
            }
          }
        }
      } catch {
        /* stream unavailable — polling via initial query remains */
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [streamUrl]);

  const data = liveData ?? initialData;

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto">
        {KPI_CONFIG.map((k) => (
          <Skeleton key={k.key} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-1 md:grid md:grid-cols-3 lg:grid-cols-5 md:overflow-visible">
      {KPI_CONFIG.map((metric, i) => {
        const value =
          metric.valueKey === "portfolioBudgetLabel"
            ? data?.portfolioBudgetLabel ?? "—"
            : String(data?.[metric.key] ?? "—");
        const href = data?.links?.[metric.key === "portfolioBudgetLabel" ? "portfolioBudget" : metric.key];

        const card = (
          <Card className={cn("rounded-xl border-border/50 shadow-sm min-w-[160px] shrink-0 md:min-w-0", href && "hover:border-primary/30 hover:shadow-md transition-all cursor-pointer")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", metric.bg)}>
                <metric.icon className={cn("h-5 w-5", metric.tone)} />
              </div>
              <div>
                <div className="text-xl font-bold font-display">{value}</div>
                <div className="text-xs text-muted-foreground">{metric.label}</div>
              </div>
            </CardContent>
          </Card>
        );

        return (
          <motion.div
            key={metric.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            {href ? <Link href={href}>{card}</Link> : card}
          </motion.div>
        );
      })}
    </div>
  );
}
