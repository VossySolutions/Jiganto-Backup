import { ReactNode } from "react";
import { Loader2, AlertCircle, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModulePageLoading, ModuleTabLoading } from "@/components/ModulePageChrome";
import { cn } from "@/lib/utils";
import { getInitials, getTypeConfig, peopleUtilColor } from "./constants";
import type { Resource } from "@shared/models/resources";

export const RESOURCES_ACCENT = "#F97316";

/* ── Shared visual atoms (used across People, Skills, Org views) ── */

export function TypeBadge({ type }: { type?: string | null }) {
  const c = getTypeConfig(type);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

export function PersonAvatar({ r, className }: { r: Pick<Resource, "firstName" | "lastName" | "personType" | "photoUrl">; className?: string }) {
  const c = getTypeConfig(r.personType);
  return (
    <Avatar className={className}>
      <AvatarImage src={r.photoUrl ?? undefined} />
      <AvatarFallback className="text-xs font-bold text-white" style={{ background: c.gradient }}>
        {getInitials(r.firstName, r.lastName)}
      </AvatarFallback>
    </Avatar>
  );
}

export function UtilBar({ util, width = 60 }: { util: number; width?: number }) {
  const col = peopleUtilColor(util);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" style={{ width }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(util, 100)}%`, background: col }} />
      </div>
      <span className="text-[11px] font-bold tabular-nums" style={{ color: col, minWidth: 28 }}>{util}%</span>
    </div>
  );
}

export function ResourcesPageLoading({ label = "Loading Resources..." }: { label?: string }) {
  return <ModulePageLoading label={label} testId="resources-page-loading" className="py-20 sm:py-28" />;
}

export function ResourcesTabLoading({ label = "Loading..." }: { label?: string }) {
  return <ModuleTabLoading label={label} testId="resources-tab-loading" className="py-14 sm:py-20" />;
}

export function ResourcesKpiSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="rounded-xl border-border/50 overflow-hidden">
          <div className="h-1 bg-orange-500/20" />
          <CardContent className="p-4 sm:p-6 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ResourcesTableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Card className="rounded-xl border-border/50 overflow-hidden">
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex gap-2 sm:gap-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-2 sm:gap-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-10 sm:h-12 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ResourcesChartSkeleton() {
  return (
    <Card className="rounded-xl border-border/50">
      <CardContent className="p-4 sm:p-6">
        <Skeleton className="h-5 w-44 mb-4" />
        <Skeleton className="h-48 sm:h-64 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function ResourcesErrorState({
  message = "Failed to load data",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="rounded-xl border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-10 sm:py-12 px-4 text-center">
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

export function ResourcesEmptyState({
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
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 sm:py-14 px-4 text-center">
        <Icon className="h-12 w-12 text-muted-foreground/30" />
        <div>
          <p className="font-medium text-foreground">{title}</p>
          {description && <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function ResourcesButtonSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function ResourcesSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div>
        <h3 className="text-lg sm:text-xl font-bold tracking-tight">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2 shrink-0">{action}</div>}
    </div>
  );
}
