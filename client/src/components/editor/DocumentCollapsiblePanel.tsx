import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function readPanelOpen(storageKey: string, defaultOpen: boolean): boolean {
  if (typeof window === "undefined") return defaultOpen;
  const stored = localStorage.getItem(storageKey);
  if (stored === null) return defaultOpen;
  return stored === "true";
}

export function DocumentCollapsiblePanel({
  panelId,
  title,
  children,
  defaultOpen = true,
  className,
  collapsedClassName,
  testId,
}: {
  panelId: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  collapsedClassName?: string;
  testId?: string;
}) {
  const storageKey = `jiganto-doc-panel-${panelId}`;
  const [open, setOpenState] = useState(() => readPanelOpen(storageKey, defaultOpen));

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    localStorage.setItem(storageKey, String(value));
  }, [storageKey]);

  if (!open) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2",
          collapsedClassName,
        )}
        data-testid={testId ? `${testId}-collapsed` : undefined}
      >
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 shrink-0"
          onClick={() => setOpen(true)}
          data-testid={testId ? `${testId}-show` : undefined}
        >
          <ChevronRight className="h-3.5 w-3.5" />
          Show
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-lg border border-border/60 bg-background overflow-hidden", className)}
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 bg-muted/25">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 shrink-0"
          onClick={() => setOpen(false)}
          data-testid={testId ? `${testId}-hide` : undefined}
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Hide
        </Button>
      </div>
      <div className="p-0">{children}</div>
    </div>
  );
}
