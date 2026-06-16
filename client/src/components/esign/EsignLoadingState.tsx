import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
};

export function EsignLoadingState({ label = "Loading…", className, size = "md", inline }: Props) {
  const iconSize = size === "sm" ? 18 : size === "lg" ? 40 : 28;
  const padding = inline ? "" : size === "sm" ? "py-6" : size === "lg" ? "py-16" : "py-12";
  return (
    <div
      className={cn("esign-loading flex flex-col items-center justify-center gap-2.5", padding, className)}
      data-testid="esign-loading"
      role="status"
      aria-live="polite"
    >
      <Loader2 style={{ width: iconSize, height: iconSize }} className="animate-spin text-primary" />
      {label && <p className="text-sm text-muted-foreground m-0">{label}</p>}
    </div>
  );
}

export function EsignButtonSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}

export function EsignKpiSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="esign-kpi-skeleton">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="esign-skeleton-kpi bg-card border border-border rounded-xl px-4 py-3">
          <div className="esign-skeleton-line h-7 w-10" />
          <div className="esign-skeleton-line h-3 w-16 mt-2" />
        </div>
      ))}
    </div>
  );
}

export function EsignTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div data-testid="esign-table-skeleton" className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="esign-skeleton-line h-4 flex-1 max-w-[180px]" />
          <div className="esign-skeleton-line h-5 w-20 rounded-full" />
          <div className="hidden md:flex gap-1">
            {[0, 1, 2].map(j => <div key={j} className="esign-skeleton-avatar" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EsignTemplateSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3" data-testid="esign-template-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="esign-skeleton-card bg-card border border-border rounded-xl p-5 flex gap-3">
          <div className="esign-skeleton-avatar shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="esign-skeleton-line h-4 w-2/5" />
            <div className="esign-skeleton-line h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EsignDetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6" data-testid="esign-detail-skeleton">
      <div className="esign-skeleton-line h-16 w-full rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="esign-skeleton-line h-[420px] w-full rounded-xl" />
        <div className="esign-skeleton-line h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function EsignErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="esign-error flex flex-col items-center justify-center py-12 px-6 text-center" data-testid="esign-error">
      <div className="text-3xl mb-3">⚠️</div>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">
          Try again
        </button>
      )}
    </div>
  );
}
