import { Loader2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function PmLoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4" data-testid="pm-loading">
      <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
      {label && <p className="text-sm text-muted-foreground text-center max-w-xs">{label}</p>}
    </div>
  );
}

export function PmLoadingOverlay({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px] rounded-lg">
      <PmLoadingSpinner label={label} />
    </div>
  );
}

export function PmAgileSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-5" data-testid="agile-skeleton">
      <Skeleton className="h-9 w-56 rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[280px] w-full rounded-xl" />
    </div>
  );
}

export function PmErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center" data-testid="pm-error">
      <p className="text-sm text-destructive font-medium">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
