import { useCallback, useEffect, useMemo, useState } from "react";
import { ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DocumentSectionNav } from "@/components/editor/DocumentSectionNav";
import { DocumentSectionNavHint } from "@/components/editor/DocumentSectionNavHint";
import { useDocumentSectionScrollSpy } from "@/hooks/use-document-section-scroll-spy";
import {
  extractHeadingsFromHtml,
  scrollToDocumentHeading,
} from "@/lib/tiptap-document-extensions";

export const SECTION_NAV_STORAGE_KEY = "jiganto-document-section-sidebar-open";

const SECTION_NAV_TOGGLE_EVENT = "jiganto-section-nav-toggle";

function readSectionSidebarOpen(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SECTION_NAV_STORAGE_KEY) !== "false";
}

export function useDocumentSectionSidebarOpen() {
  const [open, setOpenState] = useState(readSectionSidebarOpen);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SECTION_NAV_STORAGE_KEY) {
        setOpenState(event.newValue !== "false");
      }
    };
    const onToggle = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setOpenState(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SECTION_NAV_TOGGLE_EVENT, onToggle);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SECTION_NAV_TOGGLE_EVENT, onToggle);
    };
  }, []);

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    localStorage.setItem(SECTION_NAV_STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent(SECTION_NAV_TOGGLE_EVENT, { detail: value }));
  }, []);

  return [open, setOpen] as const;
}

/** Desktop toggle — visible in the content toolbar row on wide screens. */
export function DocumentSectionSidebarToggle({
  content,
}: {
  content: string;
}) {
  const [open, setOpen] = useDocumentSectionSidebarOpen();
  const headings = useMemo(() => extractHeadingsFromHtml(content), [content]);

  if (headings.length === 0) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="hidden xl:inline-flex h-7 text-xs gap-1.5 shrink-0"
      onClick={() => setOpen(!open)}
      data-testid="document-section-sidebar-toggle"
    >
      <ListTree className="h-3.5 w-3.5" />
      {open ? "Hide sections" : "Show sections"}
    </Button>
  );
}

/** Right column wrapper — only shown when the document has headings. */
export function DocumentPageSectionAside({ content }: { content: string }) {
  const [open] = useDocumentSectionSidebarOpen();
  const headings = useMemo(() => extractHeadingsFromHtml(content), [content]);

  if (headings.length === 0) {
    return (
      <aside className="hidden xl:block w-56 2xl:w-60 shrink-0 self-stretch" data-testid="document-section-aside-hint">
        <DocumentSectionNavHint />
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "hidden xl:flex xl:flex-col xl:min-h-0 xl:shrink-0 xl:overflow-y-auto self-stretch transition-[width] duration-200",
        open ? "w-56 2xl:w-60" : "w-12",
      )}
      data-testid="document-section-aside-scroll"
    >
      <DocumentPageSectionSidebar content={content} />
    </aside>
  );
}

function DocumentPageSectionSidebar({ content }: { content: string }) {
  const [open, setOpen] = useDocumentSectionSidebarOpen();
  const headings = useMemo(() => extractHeadingsFromHtml(content), [content]);
  const activeHeadingId = useDocumentSectionScrollSpy(headings);

  if (headings.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="w-full rounded-lg border border-border/70 bg-muted/15 px-2 py-3 flex flex-col items-center gap-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors shadow-sm"
        onClick={() => setOpen(true)}
        title="Show On this page"
        data-testid="document-section-sidebar-show"
      >
        <ListTree className="h-4 w-4 shrink-0" />
        <span className="text-[10px] font-medium leading-tight text-center">Sections</span>
      </button>
    );
  }

  return (
    <DocumentSectionNav
      headings={headings}
      open
      onToggle={() => setOpen(false)}
      onJump={(heading) => scrollToDocumentHeading(heading)}
      activeHeadingId={activeHeadingId}
      variant="sidebar"
      className="w-full"
      sticky
    />
  );
}

/** Top jump panel (mobile / tablet). */
export function DocumentPageSectionNavTop({
  content,
}: {
  content: string;
}) {
  const [open, setOpen] = useState(true);
  const headings = useMemo(() => extractHeadingsFromHtml(content), [content]);
  const activeHeadingId = useDocumentSectionScrollSpy(headings);

  if (headings.length === 0) {
    return (
      <div className="xl:hidden shrink-0 mb-2">
        <DocumentSectionNavHint />
      </div>
    );
  }

  return (
    <div className="xl:hidden shrink-0">
      <DocumentSectionNav
        headings={headings}
        open={open}
        onToggle={() => setOpen((value) => !value)}
        onJump={(heading) => scrollToDocumentHeading(heading)}
        activeHeadingId={activeHeadingId}
        variant="inline"
      />
    </div>
  );
}
