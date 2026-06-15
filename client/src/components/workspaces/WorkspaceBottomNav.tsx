import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WorkspacePageLike {
  id: number;
  title: string;
}

export function WorkspaceBottomNav({
  pages,
  currentPageId,
  onSelectPage,
}: {
  pages: WorkspacePageLike[];
  currentPageId: number | null;
  onSelectPage: (pageId: number) => void;
}) {
  const currentIndex = useMemo(
    () => pages.findIndex((page) => page.id === currentPageId),
    [pages, currentPageId],
  );

  const previousPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
  const nextPage = currentIndex >= 0 && currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;

  return (
    <div className="flex h-11 items-center justify-between gap-2 border-t bg-background/95 px-2 sm:px-3 pb-[env(safe-area-inset-bottom)]" data-testid="workspace-bottom-nav">
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={!previousPage}
          onClick={() => previousPage && onSelectPage(previousPage.id)}
          data-testid="workspace-nav-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={!nextPage}
          onClick={() => nextPage && onSelectPage(nextPage.id)}
          data-testid="workspace-nav-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-w-0 flex-1 max-w-[380px]">
        <Select
          value={currentPageId ? String(currentPageId) : ""}
          onValueChange={(value) => onSelectPage(Number(value))}
          disabled={pages.length === 0}
        >
          <SelectTrigger className="h-8" data-testid="workspace-nav-page-select">
            <SelectValue placeholder="Select page" />
          </SelectTrigger>
          <SelectContent>
            {pages.map((page) => (
              <SelectItem key={page.id} value={String(page.id)}>
                {page.title || "Untitled"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
