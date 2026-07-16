import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModulePageLoading } from "@/components/ModulePageChrome";
import { cn } from "@/lib/utils";

interface Props {
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

export function TmScreenShell({ loading, error, onRetry, label = "Loading…", className, children }: Props) {
  if (loading) {
    return (
      <ModulePageLoading
        label={label}
        className={cn("min-h-[280px] p-6", className)}
      />
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center min-h-[280px] gap-3 p-6 text-center", className)}>
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium text-destructive">Could not load data</p>
        <p className="text-xs text-muted-foreground max-w-md">{error.message}</p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-2 mt-1">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

/** Inline skeleton for panels */
export function TmPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-muted/60 rounded-lg" style={{ width: `${90 - i * 8}%` }} />
      ))}
    </div>
  );
}
