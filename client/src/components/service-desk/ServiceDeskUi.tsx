import { ReactNode } from "react";
import { Loader2, AlertCircle, RefreshCw, Inbox, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const SD_ACCENT = "#14B8A6";

export function ServiceDeskTabLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 sm:py-20" data-testid="sd-tab-loading">
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: SD_ACCENT }} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function ServiceDeskKpiSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="rounded-xl border-border/50 overflow-hidden">
          <div className="h-1 w-full" style={{ backgroundColor: `${SD_ACCENT}30` }} />
          <CardContent className="p-3 sm:p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ServiceDeskChartSkeleton({ cols = 3 }: { cols?: number }) {
  return (
    <div className={cn("grid gap-4 sm:gap-6", cols === 3 ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-2")}>
      {Array.from({ length: cols }).map((_, i) => (
        <Card key={i} className="rounded-xl border-border/50">
          <CardContent className="p-4 sm:p-6">
            <Skeleton className="h-5 w-36 mb-4" />
            <Skeleton className="h-48 sm:h-56 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ServiceDeskTableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Card className="rounded-xl border-border/50 overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="hidden sm:flex gap-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <Skeleton key={r} className="h-14 sm:h-10 w-full rounded-lg" />
        ))}
      </div>
    </Card>
  );
}

export function ServiceDeskCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="rounded-xl border-border/50">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-9 w-full rounded-lg mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ServiceDeskErrorState({
  message = "Something went wrong",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center px-4" data-testid="sd-error">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="rounded-xl">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function ServiceDeskEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4" data-testid="sd-empty">
      <div className="p-3 rounded-2xl" style={{ backgroundColor: `${SD_ACCENT}15` }}>
        <Icon className="h-8 w-8" style={{ color: SD_ACCENT }} />
      </div>
      <h3 className="font-medium">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

/** Horizontal scroll wrapper for data tables on small screens */
export function ServiceDeskTableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 overflow-x-auto -mx-1 px-1">
      <div className="min-w-[640px] sm:min-w-0">{children}</div>
    </div>
  );
}

export function ServiceDeskModuleIcon({ className }: { className?: string }) {
  return <Headphones className={className} />;
}
