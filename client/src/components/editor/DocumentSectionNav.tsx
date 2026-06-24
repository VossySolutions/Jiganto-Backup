import { ChevronDown, ListTree, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentTocHeading } from "@/lib/tiptap-document-extensions";

export function DocumentSectionNav({
  headings,
  open,
  onToggle,
  onJump,
  className,
  variant = "inline",
  activeHeadingId = null,
  sticky = true,
}: {
  headings: DocumentTocHeading[];
  open: boolean;
  onToggle: () => void;
  onJump: (heading: DocumentTocHeading) => void;
  className?: string;
  variant?: "inline" | "sidebar";
  activeHeadingId?: string | null;
  sticky?: boolean;
}) {
  if (headings.length === 0) return null;

  const isSidebar = variant === "sidebar";
  const topLevel = headings.filter((h) => h.level <= 2);
  const showList = isSidebar || open;

  const linkClass = (h: DocumentTocHeading, isActive: boolean) =>
    cn(
      "block w-full text-left text-sm transition-colors truncate rounded-sm py-1",
      isSidebar ? "px-2 border-l-2 border-transparent" : "px-1",
      isActive
        ? "text-primary font-medium bg-primary/10 border-primary"
        : "text-primary hover:text-primary/80 hover:underline underline-offset-2",
      !isActive && h.level === 1 && "font-semibold",
      !isActive && h.level === 2 && "font-medium",
    );

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-muted/15",
        isSidebar && "shadow-sm",
        !isSidebar && "z-10",
        isSidebar && "sticky top-4",
        className,
      )}
      data-testid={isSidebar ? "document-section-sidebar" : "document-section-nav"}
    >
      {isSidebar ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border/60">
          <span className="flex items-center gap-2 min-w-0">
            <ListTree className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">On this page</span>
          </span>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
            onClick={onToggle}
            title="Hide section navigation"
            aria-label="Hide section navigation"
            data-testid="document-section-sidebar-hide"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 min-w-0">
            <ListTree className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">On this page</span>
            <span className="text-xs text-muted-foreground">
              ({headings.length} section{headings.length === 1 ? "" : "s"})
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      )}

      {!isSidebar && topLevel.length > 0 && (
        <div className="border-t border-border/60 px-3 py-2 flex flex-wrap gap-x-1 gap-y-1.5 items-center">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mr-1 shrink-0">
            Jump to
          </span>
          {topLevel.map((h, i) => (
            <span key={`quick-${h.id}-${i}`} className="inline-flex items-center">
              {i > 0 && <span className="text-muted-foreground/60 px-1 select-none">·</span>}
              <button
                type="button"
                className={cn(
                  "text-sm transition-colors max-w-[200px] truncate",
                  activeHeadingId === h.id
                    ? "text-primary font-semibold"
                    : "text-primary hover:text-primary/80 hover:underline underline-offset-2",
                )}
                onClick={() => onJump(h)}
                title={`Jump to ${h.text}`}
                data-testid={`section-quick-${i}`}
              >
                {h.text}
              </button>
            </span>
          ))}
        </div>
      )}

      {showList && (
        <nav
          className={cn(
            "px-3 py-2.5 space-y-0.5",
            !isSidebar && "border-t border-border/60",
          )}
          aria-label="Document sections"
        >
          {headings.map((h, i) => (
            <button
              key={`section-${h.id}-${i}`}
              type="button"
              className={linkClass(h, activeHeadingId === h.id)}
              style={{ paddingLeft: `${(h.level - 1) * (isSidebar ? 12 : 16) + (isSidebar ? 8 : 4)}px` }}
              onClick={() => onJump(h)}
              data-testid={isSidebar ? `sidebar-section-${i}` : `section-nav-${i}`}
              title={`Jump to ${h.text}`}
              aria-current={activeHeadingId === h.id ? "location" : undefined}
            >
              {h.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
