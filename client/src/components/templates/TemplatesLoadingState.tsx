import { Loader2, LayoutTemplate } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function TemplatesPageSkeleton() {
  return (
    <div className="space-y-8" data-testid="templates-page-skeleton" aria-busy="true">
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="min-w-[260px] h-[220px] rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
      <TemplatesGridSkeleton count={6} />
    </div>
  );
}

export function TemplatesGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="templates-grid-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="h-28 bg-muted animate-pulse" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            <div className="h-3 bg-muted rounded animate-pulse w-full" />
            <div className="h-3 bg-muted rounded animate-pulse w-5/6" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TemplatesNavSkeleton() {
  return (
    <div className="p-2 space-y-1" data-testid="templates-nav-skeleton">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}

export function TemplatesInlineLoading({ label = "Loading templates…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground", className)} role="status">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function TemplatesErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="text-center py-16 px-4" data-testid="templates-error-state">
      <LayoutTemplate className="h-12 w-12 mx-auto mb-3 text-destructive/50" />
      <p className="font-medium text-destructive">Could not load templates</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 text-sm font-medium text-primary hover:underline"
        data-testid="templates-retry"
      >
        Try again
      </button>
    </div>
  );
}

export function TemplatesEmptyState({ filtered }: { filtered?: boolean }) {
  return (
    <div className="text-center py-16 px-4 text-muted-foreground" data-testid="templates-empty-state">
      <LayoutTemplate className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium text-foreground">
        {filtered ? "No templates match your filters" : "No templates yet"}
      </p>
      <p className="text-sm mt-1 max-w-sm mx-auto">
        {filtered
          ? "Try adjusting filters or search, or create content in a module and save it as a template."
          : "Create content in any module and use Save as Template, or generate one with AI."}
      </p>
    </div>
  );
}
