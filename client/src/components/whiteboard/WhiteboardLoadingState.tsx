import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModulePageLoading, ModuleTabLoading, modulePageLoadingAccentClass } from "@/components/ModulePageChrome";

type Props = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
};

export function WhiteboardLoadingState({ label = "Loading…", className, size = "md", inline }: Props) {
  if (inline || size === "sm") {
    return (
      <div
        className={cn(
          "flex items-center gap-2",
          !inline && "flex-col justify-center gap-2.5 py-6",
          className,
        )}
        data-testid="wb-loading"
        role="status"
        aria-live="polite"
      >
        <Loader2
          className={cn(modulePageLoadingAccentClass, size === "sm" && "!h-[18px] !w-[18px]")}
          aria-hidden
        />
        {label ? <p className="text-sm text-muted-foreground m-0">{label}</p> : null}
      </div>
    );
  }

  if (size === "lg") {
    return <ModulePageLoading label={label} testId="wb-loading" className={cn("py-16", className)} />;
  }

  return <ModuleTabLoading label={label} testId="wb-loading" className={cn("py-12", className)} />;
}

export function WhiteboardButtonSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin text-[#0ea5e9]" />;
}

export function WhiteboardCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="wb-card-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="wb-skeleton-card rounded-xl border border-border overflow-hidden bg-card">
          <div className="aspect-video wb-skeleton-shimmer bg-muted/60" />
          <div className="p-4 space-y-2">
            <div className="wb-skeleton-shimmer h-4 w-3/5 rounded" />
            <div className="wb-skeleton-shimmer h-3 w-full rounded" />
            <div className="wb-skeleton-shimmer h-3 w-2/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WhiteboardCanvasSkeleton() {
  return (
    <div className="flex flex-col h-full min-h-[60vh]" data-testid="wb-canvas-skeleton">
      <div className="h-14 border-b wb-skeleton-shimmer bg-muted/30" />
      <div className="flex-1 wb-dot-grid relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <WhiteboardLoadingState label="Loading canvas…" size="lg" />
        </div>
      </div>
    </div>
  );
}

export function WhiteboardActivitySkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul className="space-y-3 mt-4" data-testid="wb-activity-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="space-y-1.5 pb-3 border-b border-border">
          <div className="wb-skeleton-shimmer h-4 w-1/3 rounded" />
          <div className="wb-skeleton-shimmer h-3 w-1/2 rounded" />
          <div className="wb-skeleton-shimmer h-3 w-1/4 rounded" />
        </li>
      ))}
    </ul>
  );
}

export function WhiteboardMemberSearchSkeleton() {
  return (
    <div className="space-y-2 mt-2" data-testid="wb-member-search-skeleton">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <div className="wb-skeleton-shimmer h-4 w-2/3 rounded" />
          <div className="wb-skeleton-shimmer h-8 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}
