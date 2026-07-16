import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ModulePageLoading, ModuleTabLoading } from "@/components/ModulePageChrome";

type Props = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function BpmLoadingState({ label = "Loading…", className, size = "md" }: Props) {
  if (size === "sm") {
    return <ModuleTabLoading label={label} testId="bpm-loading" className={cn("py-8", className)} />;
  }
  if (size === "lg") {
    return <ModulePageLoading label={label} testId="bpm-loading" className={cn("py-20", className)} />;
  }
  return <ModuleTabLoading label={label} testId="bpm-loading" className={className} />;
}

export function BpmCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="bpm-skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function BpmTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" data-testid="bpm-skeleton-table">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
