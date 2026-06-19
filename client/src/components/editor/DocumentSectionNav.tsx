import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentTocHeading } from "@/lib/tiptap-document-extensions";

export function DocumentSectionNav({
  headings,
  open,
  onToggle,
  onJump,
  className,
}: {
  headings: DocumentTocHeading[];
  open: boolean;
  onToggle: () => void;
  onJump: (heading: DocumentTocHeading) => void;
  className?: string;
}) {
  if (headings.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-muted/20",
        className,
      )}
      data-testid="document-section-nav"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        onClick={onToggle}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          On this page
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <nav className="border-t border-border/60 px-3 py-2 space-y-1">
          {headings.map((h, i) => (
            <button
              key={`section-${h.id}-${i}`}
              type="button"
              className={cn(
                "block w-full text-left text-sm text-primary underline underline-offset-2 hover:text-primary/80 transition-colors truncate",
                h.level === 1 && "font-medium",
              )}
              style={{ paddingLeft: `${(h.level - 1) * 14}px` }}
              onClick={() => onJump(h)}
              data-testid={`section-nav-${i}`}
            >
              {h.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
