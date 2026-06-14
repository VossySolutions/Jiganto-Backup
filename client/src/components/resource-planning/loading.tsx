import type { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function RpKpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={cn("grid gap-3 sm:gap-4", count === 5 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4")}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/50 p-4 space-y-2 bg-card">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function RpTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
      <div className="p-3 border-b"><Skeleton className="h-4 w-40" /></div>
      <div className="p-3 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

export function RpCardGridSkeleton() {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <RpTableSkeleton />
      <RpTableSkeleton rows={4} />
    </div>
  );
}

export function RpTabError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-destructive font-medium">{message ?? "Failed to load data"}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}

export function RpInlineLoading({ label = "Loading…" }: { label?: string }) {
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

export function RpQueryShell({
  query,
  children,
  skeleton = "kpi",
  kpiCount = 4,
}: {
  query: QueryLike;
  children: ReactNode;
  skeleton?: "kpi" | "table" | "grid" | "minimal";
  kpiCount?: number;
}) {
  if (query.isLoading && !query.data) {
    if (skeleton === "kpi") return <RpKpiSkeleton count={kpiCount} />;
    if (skeleton === "table") return <RpTableSkeleton />;
    if (skeleton === "grid") return <><RpKpiSkeleton count={kpiCount} /><RpCardGridSkeleton /></>;
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }
  if (query.isError) {
    return <RpTabError message={query.error?.message} onRetry={() => query.refetch()} />;
  }
  if (!query.data) return <RpTabError message="No data returned" onRetry={() => query.refetch()} />;
  return (
    <>
      {query.isFetching && !query.isLoading && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-1.5 rounded-full bg-background border px-3 py-1 text-[10px] text-muted-foreground shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin" /> Updating…
        </div>
      )}
      {children}
    </>
  );
}
