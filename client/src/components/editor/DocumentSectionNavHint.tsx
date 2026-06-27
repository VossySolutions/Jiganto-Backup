import { ListTree } from "lucide-react";

/** Shown in the document editor when the page has no headings yet. */
export function DocumentSectionNavHint() {
  return (
    <div
      className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2.5 text-xs text-muted-foreground flex items-start gap-2"
      data-testid="document-section-nav-hint"
    >
      <ListTree className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-70" />
      <p>
        Add <strong className="font-medium text-foreground">Heading 1</strong> or{" "}
        <strong className="font-medium text-foreground">Heading 2</strong> styles in the editor to enable{" "}
        <span className="text-foreground">On this page</span> section navigation (sidebar on wide screens).
      </p>
    </div>
  );
}
