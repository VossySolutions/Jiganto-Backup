import { Loader2 } from "lucide-react";
import { ModulePageLoading, modulePageLoadingAccentClass } from "@/components/ModulePageChrome";
import { cn } from "@/lib/utils";

export function ChatSpinner({ className, label }: { className?: string; label?: string }) {
  if (label) {
    return (
      <ModulePageLoading
        label={label}
        className={cn("py-8", className)}
      />
    );
  }
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-8", className)}>
      <Loader2 className={modulePageLoadingAccentClass} aria-hidden />
    </div>
  );
}

export function ChatButtonSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function ChatSidebarSkeleton() {
  return (
    <div className="p-2 space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-muted rounded w-2/3" />
            <div className="h-2.5 bg-muted rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
