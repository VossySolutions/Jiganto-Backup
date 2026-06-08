import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Variant = "page" | "dashboard" | "table" | "panel" | "inline";

interface BusinessLoadingStateProps {
  variant?: Variant;
  label?: string;
  className?: string;
}

export function BusinessLoadingState({
  variant = "table",
  label = "Loading…",
  className,
}: BusinessLoadingStateProps) {
  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center", className)}>
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>{label}</span>
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 py-24", className)}>
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    );
  }

  if (variant === "dashboard") {
    return (
      <div className={cn("space-y-6", className)} data-testid="business-loading-dashboard">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} data-testid="business-loading-table">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg ml-auto" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none border-t border-border" />
        ))}
      </div>
    </div>
  );
}
