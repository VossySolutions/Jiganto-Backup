import type { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function WorkspaceGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/40 p-4 bg-card space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function WorkspaceTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border/40 overflow-hidden bg-card">
      <div className="p-2 border-b border-border/30 flex flex-wrap gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 flex-1 min-w-[120px] max-w-xs ml-auto" />
      </div>
      <div className="p-3 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function WorkspaceOverviewSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-48 w-full rounded-md" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    </div>
  );
}

export function WorkspaceDetailSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-6 w-2/3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function WorkspaceShareSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

export function WorkspaceQueryError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
      <p className="text-sm text-destructive font-medium">{message ?? "Failed to load workspace data"}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}

export function WorkspaceInlineLoading({ label = "Loading…" }: { label?: string }) {
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

export function WorkspaceQueryShell({
  query,
  children,
  skeleton = "grid",
  gridCount = 6,
}: {
  query: QueryLike;
  children: ReactNode;
  skeleton?: "grid" | "table" | "overview" | "detail" | "share" | "minimal";
  gridCount?: number;
}) {
  if (query.isLoading && query.data === undefined) {
    if (skeleton === "grid") return <WorkspaceGridSkeleton count={gridCount} />;
    if (skeleton === "table") return <WorkspaceTableSkeleton />;
    if (skeleton === "overview") return <WorkspaceOverviewSkeleton />;
    if (skeleton === "detail") return <WorkspaceDetailSkeleton />;
    if (skeleton === "share") return <WorkspaceShareSkeleton />;
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }
  if (query.isError) {
    return <WorkspaceQueryError message={query.error?.message} onRetry={() => query.refetch()} />;
  }
  return <>{children}</>;
}

/** Combine multiple react-query results into one shell-compatible object. */
export function combineWorkspaceQueries(...queries: QueryLike[]): QueryLike {
  const loading = queries.some((q) => q.isLoading && q.data === undefined);
  const errored = queries.find((q) => q.isError);
  return {
    isLoading: loading,
    isFetching: queries.some((q) => q.isFetching),
    isError: Boolean(errored),
    error: errored?.error ?? null,
    refetch: () => queries.forEach((q) => q.refetch()),
    data: loading ? undefined : queries.map((q) => q.data),
  };
}
