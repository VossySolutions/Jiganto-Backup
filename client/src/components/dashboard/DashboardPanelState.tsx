import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAuth } from "@/lib/queryClient";

export function DashboardLoadingPanel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export function DashboardPanelState({
  isLoading,
  isError,
  error,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (isLoading) return <DashboardLoadingPanel />;
  if (isError) {
    return (
      <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
        <CardContent className="py-14 text-center space-y-4">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive/70" />
          <div>
            <p className="font-medium text-sm">Could not load dashboard</p>
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

export function DashboardEmptyTable({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border/60 rounded-xl">
      {message}
    </p>
  );
}

export function DashboardTableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto -mx-1 px-1">{children}</div>;
}

export function ModuleDashboardLoader<T>({
  url,
  children,
}: {
  url: string;
  children: (data: T) => React.ReactNode;
}) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [url],
    queryFn: async () => {
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("Failed to load dashboard data");
      return (await res.json()) as T;
    },
    staleTime: 5 * 60_000,
  });

  return (
    <DashboardPanelState
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => void refetch()}
    >
      {data ? children(data) : null}
    </DashboardPanelState>
  );
}
