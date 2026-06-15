import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function BpmLoadingState({ label = "Loading…", className, size = "md" }: Props) {
  const iconSize = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const padding = size === "sm" ? "py-8" : size === "lg" ? "py-20" : "py-16";
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", padding, className)} data-testid="bpm-loading">
      <Loader2 className={cn(iconSize, "text-primary animate-spin")} />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
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
