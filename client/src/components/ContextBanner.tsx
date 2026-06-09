import { X } from "lucide-react";
import { useClientContext } from "@/hooks/use-client-context";
import { Button } from "@/components/ui/button";
import { contrastSafeColor } from "@/lib/client-workspace-utils";

export function ContextBanner() {
  const { activeClient, setActiveClient, isArchivedWorkspace } = useClientContext();

  if (!activeClient) return null;

  const accent = contrastSafeColor(activeClient.color);
  const bgColor = accent + "18";
  const borderColor = accent + "55";
  const textColor = accent;

  return (
    <div
      className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 text-sm border-b flex-shrink-0 min-h-10"
      style={{ backgroundColor: bgColor, borderColor }}
      data-testid="context-banner"
    >
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: activeClient.color }}
      />
      <span
        className="font-medium truncate max-w-[40vw] sm:max-w-none"
        style={{ color: textColor }}
        data-testid="context-banner-name"
      >
        {activeClient.name}
      </span>
      <span className="hidden sm:inline text-muted-foreground text-xs">
        · {isArchivedWorkspace ? "Read-only archived workspace" : "All modules scoped to this workspace"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => setActiveClient(null)}
        data-testid="context-banner-exit"
      >
        <X className="h-3 w-3" />
        <span className="hidden sm:inline">Exit workspace</span>
      </Button>
    </div>
  );
}
