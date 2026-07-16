import {
  useState,
  useMemo
} from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  List,
  FileText,
  Clock,
  Loader2,
  Check,
  Maximize2,
  Minimize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

function TableOfContents({
  content,
  visible,
}: {
  content: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const headings = useMemo(() => {
    if (!content) return [];
    const items: HeadingItem[] = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    const elements = doc.querySelectorAll("h1, h2, h3");
    elements.forEach((el, idx) => {
      const text = el.textContent?.trim();
      if (text) {
        const level = parseInt(el.tagName.charAt(1));
        items.push({ id: `heading-${idx}`, text, level });
      }
    });
    return items;
  }, [content]);

  const scrollToHeading = (heading: HeadingItem) => {
    const editor = document.querySelector(".ProseMirror");
    if (!editor) return;
    const headingEls = editor.querySelectorAll("h1, h2, h3");
    const idx = parseInt(heading.id.split("-")[1]);
    if (headingEls[idx]) {
      headingEls[idx].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!visible) return null;

  return (
    <div className="w-56 flex-shrink-0 border-r overflow-y-auto p-3 bg-muted/10" data-testid="toc-panel">
      <div className="flex items-center gap-1.5 mb-3">
        <List className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contents</span>
      </div>
      {headings.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic">
          Add headings to see the table of contents
        </p>
      ) : (
        <div className="space-y-0.5">
          {headings.map((heading) => (
            <button
              key={heading.id}
              onClick={() => scrollToHeading(heading)}
              className={cn(
                "w-full text-left text-xs py-1 px-2 rounded hover:bg-muted truncate block",
                heading.level === 1 && "font-medium",
                heading.level === 2 && "pl-4",
                heading.level === 3 && "pl-6 text-muted-foreground"
              )}
              data-testid={`toc-item-${heading.id}`}
            >
              {heading.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DOCUMENT_STATUSES = [
  { value: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  { value: "Under Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { value: "Awaiting Approval", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  { value: "Published", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
];

function getStatusStyle(status: string) {
  return DOCUMENT_STATUSES.find((s) => s.value === status)?.color || DOCUMENT_STATUSES[0].color;
}

export function DocumentMetadataBar({
  createdByName,
  updatedByName,
  createdAt,
  updatedAt,
  documentStatus,
  onStatusChange,
}: {
  createdByName?: string | null;
  updatedByName?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  documentStatus?: string | null;
  onStatusChange?: (status: string) => void;
}) {
  const formattedCreated = createdAt
    ? new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const formattedUpdated = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  const currentStatus = documentStatus || "Draft";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4 px-1" data-testid="document-metadata-bar">
      {formattedCreated && (
        <span className="flex items-center gap-1" data-testid="metadata-created">
          <FileText className="h-3 w-3" />
          Created {formattedCreated}{createdByName ? ` by ${createdByName}` : ""}
        </span>
      )}
      {formattedUpdated && (
        <span className="flex items-center gap-1" data-testid="metadata-updated">
          <Clock className="h-3 w-3" />
          Updated {formattedUpdated}{updatedByName ? ` by ${updatedByName}` : ""}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
              getStatusStyle(currentStatus)
            )}
            data-testid="metadata-status"
          >
            {currentStatus}
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {DOCUMENT_STATUSES.map((status) => (
            <DropdownMenuItem
              key={status.value}
              onClick={() => onStatusChange?.(status.value)}
              className="flex items-center gap-2 text-xs"
              data-testid={`status-option-${status.value.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", status.color.split(" ")[0])} />
              {status.value}
              {status.value === currentStatus && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function StatusBar({
  content,
  isSaving,
}: {
  content: string;
  isSaving: boolean;
}) {
  const stats = useMemo(() => {
    if (!content) return { words: 0, chars: 0, readingTime: 0 };
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    const text = doc.body.textContent || "";
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readingTime };
  }, [content]);

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t bg-muted/20 text-xs text-muted-foreground" data-testid="document-status-bar">
      <div className="flex items-center gap-4">
        <span data-testid="word-count">{stats.words} words</span>
        <span data-testid="char-count">{stats.chars} characters</span>
        <span>{stats.readingTime} min read</span>
      </div>
      <div className="flex items-center gap-1.5">
        {isSaving ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Saving...</span>
          </>
        ) : (
          <>
            <Check className="h-3 w-3 text-green-500" />
            <span data-testid="save-status">Saved</span>
          </>
        )}
      </div>
    </div>
  );
}

export function DocumentEditorChrome({
  content,
  isSaving,
  children,
  isExpanded,
  onToggleExpand,
}: {
  content: string;
  isSaving: boolean;
  children: React.ReactNode;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const [tocVisible, setTocVisible] = useState(false);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="document-editor-chrome">
      <div className="flex items-center justify-between gap-2 px-4 py-1 border-b bg-muted/10">
        <div className="flex items-center gap-2">
          <Button
            variant={tocVisible ? "secondary" : "ghost"}
            size="sm"
            className="gap-1 text-xs h-7"
            onClick={() => setTocVisible(!tocVisible)}
            data-testid="toggle-toc-button"
          >
            <List className="h-3.5 w-3.5" />
            Contents
          </Button>
        </div>
        {onToggleExpand && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs h-7"
            onClick={onToggleExpand}
            title={isExpanded ? "Exit full screen (Ctrl+Shift+F)" : "Full screen (Ctrl+Shift+F)"}
            data-testid="toggle-expand-document"
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        )}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <TableOfContents content={content} visible={tocVisible} onToggle={() => setTocVisible(!tocVisible)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 pt-3 min-w-0">
            <div className="w-full min-w-0">
              {children}
            </div>
          </div>
          <StatusBar content={content} isSaving={isSaving} />
        </div>
      </div>
    </div>
  );
}
