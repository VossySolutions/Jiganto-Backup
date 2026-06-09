import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Matches DashboardLoadingPanel — KPI row + main content block. */
export function ClientsLoadingPanel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="min-h-[160px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function ClientsKpiLoading() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}

export function ClientsCardGridLoading() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="min-h-[160px] rounded-xl" />
      ))}
    </div>
  );
}

export function ClientsDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export function ClientsSheetLoading() {
  return <Skeleton className="h-32 w-full rounded-xl" />;
}

export function ClientsAdminLoading() {
  return <Skeleton className="h-24 w-full rounded-2xl" />;
}

export function ClientsPanelState({
  isLoading,
  isError,
  error,
  onRetry,
  children,
  loadingFallback,
  errorTitle = "Could not load client workspaces",
}: {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
  errorTitle?: string;
}) {
  if (isLoading) return <>{loadingFallback ?? <ClientsLoadingPanel />}</>;
  if (isError) {
    return (
      <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
        <CardContent className="py-14 text-center space-y-4">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive/70" />
          <div>
            <p className="font-medium text-sm">{errorTitle}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {error?.message?.replace(/^\d+:\s*/, "") ?? "Something went wrong. Please try again."}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <>{children}</>;
}
