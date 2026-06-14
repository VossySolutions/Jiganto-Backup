import type { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function TaskKpiSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory md:grid md:grid-cols-3 lg:grid-cols-6 md:overflow-visible md:pb-0">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="min-w-[120px] snap-start shrink-0 rounded-xl border border-border/40 p-3 bg-card md:min-w-0"
        >
          <Skeleton className="h-7 w-10 mx-auto mb-2" />
          <Skeleton className="h-3 w-16 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export function TaskTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border/40 overflow-hidden bg-card">
      <div className="p-3 border-b border-border/30 flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 flex-1 max-w-xs" />
      </div>
      <div className="p-3 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function TaskFilterSkeleton() {
  return (
    <div className="rounded-xl border border-border/40 p-3 bg-muted/20 flex flex-wrap gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-28" />
      ))}
    </div>
  );
}

export function TaskDetailSectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function TaskTabError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
      <p className="text-sm text-destructive font-medium">{message ?? "Failed to load tasks"}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}

export function TaskInlineLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {label}
    </div>
  );
}

type QueryLike = {
  isLoading: boolean;
  isFetching?: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  data?: unknown;
};

export function TaskQueryShell({
  query,
  children,
  skeleton = "table",
  kpiCount = 6,
}: {
  query: QueryLike;
  children: ReactNode;
  skeleton?: "kpi" | "table" | "full" | "minimal";
  kpiCount?: number;
}) {
  if (query.isLoading && query.data === undefined) {
    if (skeleton === "kpi") return <TaskKpiSkeleton count={kpiCount} />;
    if (skeleton === "table") return <TaskTableSkeleton />;
    if (skeleton === "full") {
      return (
        <div className="space-y-4">
          <TaskKpiSkeleton count={kpiCount} />
          <TaskFilterSkeleton />
          <TaskTableSkeleton />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }
  if (query.isError) {
    return <TaskTabError message={query.error?.message} onRetry={() => query.refetch()} />;
  }
  return <>{children}</>;
}
