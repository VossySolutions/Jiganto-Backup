import { ReactNode } from "react";
import { Loader2, AlertCircle, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ModulePageLoading, ModuleTabLoading } from "@/components/ModulePageChrome";
import { cn } from "@/lib/utils";

export const FINANCE_ACCENT = "#10B981";

export function FinancePageLoading({ label = "Loading Finance..." }: { label?: string }) {
  return <ModulePageLoading label={label} testId="finance-page-loading" className="py-24" />;
}

export function FinanceTabLoading({ label = "Loading..." }: { label?: string }) {
  return <ModuleTabLoading label={label} testId="finance-tab-loading" className="sm:py-20" />;
}

export function FinanceKpiSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="rounded-xl border-border/50 overflow-hidden">
          <Skeleton className="h-1 w-full" />
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FinanceTableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Card className="rounded-xl border-border/50 overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex gap-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-10 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function FinanceChartSkeleton() {
  return (
    <Card className="rounded-xl border-border/50">
      <CardContent className="p-4 sm:p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-52 sm:h-64 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function FinanceErrorState({
  message = "Failed to load data",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="rounded-xl border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
        <AlertCircle className="h-10 w-10 text-destructive/70" />
        <p className="text-sm font-medium text-destructive">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function FinanceEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="rounded-xl border-dashed border-border/60 bg-muted/20">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-14 px-4 text-center">
        <Icon className="h-12 w-12 text-muted-foreground/30" />
        <div>
          <p className="font-medium text-foreground">{title}</p>
          {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function FinanceSectionCard({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Card className={cn("rounded-xl border-border/50 shadow-sm", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-6 pt-4 sm:pt-5 pb-0">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {description && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <CardContent className="p-4 sm:p-6 pt-4">{children}</CardContent>
    </Card>
  );
}

/** Horizontal scroll wrapper for tables on mobile */
export function FinanceTableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1 scrollbar-thin">
      <div className="min-w-[640px]">{children}</div>
    </div>
  );
}

/** Toolbar row — stacks on mobile */
export function FinanceToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4", className)}>
      {children}
    </div>
  );
}

/** Inline spinner for action buttons */
export function FinanceButtonSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function FinanceFetchingBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-full">
      <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
      Updating
    </span>
  );
}
