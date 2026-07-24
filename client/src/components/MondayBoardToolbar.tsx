import type { ReactNode } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Layers,
  Columns3,
  MoreHorizontal,
  Paintbrush,
  Download,
  Upload,
  Pin,
  Table2,
  ChevronDown,
  FileText,
  ClipboardPaste,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CRM_TOOLBAR_CLASS,
  CRM_SEARCH_INPUT_CLASS,
  crmToolBtn,
  crmIconBtn,
} from "@/lib/crm-monday-chrome";
import { MondayBoardChromeControls, useMondayBoard } from "@/components/MondayBoardTable";

const toolbarDivider = <div className="h-5 w-px shrink-0 bg-border mx-0.5" aria-hidden />;

export type MondayBoardToolbarProps = {
  /** Primary CTA — same style as Leads "New Lead" */
  newLabel?: string;
  onNew?: () => void;
  newTestId?: string;

  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchTestId?: string;

  /** Optional person/owner strip (Leads-style) */
  personSlot?: ReactNode;

  /** Optional view switcher dropdown content (Table / Cards / …) */
  viewSwitcher?: ReactNode;
  /** When view switcher is a simple label+menu, pass trigger label */
  viewLabel?: string;
  viewIcon?: ReactNode;
  viewMenu?: ReactNode;

  /** Filter popover body (rules UI). If omitted, Filter control is hidden unless filterActive used with empty content. */
  filterContent?: ReactNode;
  filterActive?: boolean;
  filterCount?: number;
  filterOpen?: boolean;
  onFilterOpenChange?: (open: boolean) => void;

  /** Sort dropdown body */
  sortContent?: ReactNode;
  sortActive?: boolean;
  sortLabel?: string;

  /** Group-by dropdown body */
  groupContent?: ReactNode;
  groupActive?: boolean;
  groupLabel?: string;

  /** Pin first/sticky column toggle */
  pinActive?: boolean;
  onPinToggle?: () => void;
  pinTitle?: string;

  /** Columns visibility menu body */
  columnsContent?: ReactNode;
  columnsHiddenCount?: number;

  /** Whether rows are currently grouped (expand/collapse controls) */
  grouped?: boolean;

  /** Saved views control (right side, like Leads "Views") */
  viewsSlot?: ReactNode;

  /**
   * More menu — Leads order:
   * Format → Export CSV → Download import template → ─ → Paste → Import → extras
   */
  moreMenuItems?: ReactNode;
  onExport?: () => void;
  onDownloadTemplate?: () => void;
  onPaste?: () => void;
  onImport?: () => void;
  showFormatInMore?: boolean;

  /** Extra controls after Group / before Columns (entity-specific) */
  afterGroupSlot?: ReactNode;
  /** Extra at far left after New (rare) */
  afterNewSlot?: ReactNode;

  className?: string;
  testId?: string;
};

/**
 * CRM Leads–identical monday.com board toolbar.
 * Same layout, icons, and control chrome for every Full Implement module table.
 * Only column definitions and entity actions differ per screen.
 */
export function MondayBoardToolbar({
  newLabel,
  onNew,
  newTestId = "button-board-new",
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search / Filter Board",
  searchTestId = "input-board-search",
  personSlot,
  viewSwitcher,
  viewLabel = "Table",
  viewIcon,
  viewMenu,
  filterContent,
  filterActive,
  filterCount = 0,
  filterOpen,
  onFilterOpenChange,
  sortContent,
  sortActive,
  sortLabel = "Sort",
  groupContent,
  groupActive,
  groupLabel = "Group by",
  pinActive,
  onPinToggle,
  pinTitle,
  columnsContent,
  columnsHiddenCount = 0,
  grouped = false,
  viewsSlot,
  moreMenuItems,
  onExport,
  onDownloadTemplate,
  onPaste,
  onImport,
  showFormatInMore = true,
  afterGroupSlot,
  afterNewSlot,
  className,
  testId = "monday-board-toolbar",
}: MondayBoardToolbarProps) {
  const board = useMondayBoard();
  const filterIsActive = filterActive ?? filterCount > 0;
  const hasDataActions = !!(onExport || onDownloadTemplate || onPaste || onImport);

  return (
    <div className={cn(CRM_TOOLBAR_CLASS, className)} data-testid={testId}>
      <div className="flex items-center gap-1 shrink-0">
        {onNew && newLabel && (
          <Button
            className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-md text-[13px] font-medium shadow-none px-3"
            data-testid={newTestId}
            onClick={onNew}
          >
            <Plus className="h-4 w-4" />
            {newLabel}
          </Button>
        )}
        {afterNewSlot}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className={CRM_SEARCH_INPUT_CLASS}
            data-testid={searchTestId}
          />
        </div>

        {toolbarDivider}

        {personSlot}

        {personSlot && toolbarDivider}

        {viewSwitcher ??
          (viewMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={crmToolBtn()} data-testid="button-board-view">
                  {viewIcon ?? <Table2 className="h-3.5 w-3.5" />}
                  {viewLabel}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {viewMenu}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button type="button" className={crmToolBtn(true)} data-testid="button-board-view" disabled>
              <Table2 className="h-3.5 w-3.5" />
              Table
            </button>
          ))}

        {filterContent != null && (
          <Popover open={filterOpen} onOpenChange={onFilterOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={crmToolBtn(filterIsActive)}
                data-testid="button-board-filter"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filter
                {filterCount > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold inline-flex items-center justify-center">
                    {filterCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[520px] p-3 space-y-2">
              {filterContent}
            </PopoverContent>
          </Popover>
        )}

        {sortContent != null && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={crmToolBtn(!!sortActive)}
                data-testid="button-board-sort"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sortLabel}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {sortContent}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {groupContent != null && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={crmToolBtn(!!groupActive)}
                title={groupLabel}
                data-testid="button-board-group"
              >
                <Layers className="h-3.5 w-3.5" />
                {groupLabel}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {groupContent}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {afterGroupSlot}

        {onPinToggle && (
          <button
            type="button"
            className={crmToolBtn(!!pinActive)}
            title={pinTitle ?? (pinActive ? "Unpin column" : "Pin column")}
            onClick={onPinToggle}
            data-testid="button-board-pin"
          >
            <Pin className="h-3.5 w-3.5" />
            Pin
          </button>
        )}

        {columnsContent != null && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={crmToolBtn(columnsHiddenCount > 0)}
                data-testid="button-board-columns"
              >
                <Columns3 className="h-3.5 w-3.5" />
                Columns
                {columnsHiddenCount > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold inline-flex items-center justify-center">
                    {columnsHiddenCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 max-h-[min(75vh,560px)] overflow-y-auto">
              {columnsContent}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <MondayBoardChromeControls grouped={grouped} showFormat={false} />
      </div>

      <div className="flex items-center gap-0.5 shrink-0 ml-auto pl-1.5">
        {toolbarDivider}
        {viewsSlot}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={crmIconBtn(board.formatPanelOpen)}
              title="More actions"
              aria-label="More actions"
              data-testid="button-board-more"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {showFormatInMore && (
              <DropdownMenuItem
                className="gap-2"
                onSelect={() => board.setFormatPanelOpen(true)}
                data-testid="button-board-format"
              >
                <Paintbrush className="h-3.5 w-3.5" />
                Format
              </DropdownMenuItem>
            )}
            {onExport && (
              <DropdownMenuItem className="gap-2" onSelect={onExport} data-testid="button-board-export">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </DropdownMenuItem>
            )}
            {onDownloadTemplate && (
              <DropdownMenuItem
                className="gap-2"
                onSelect={onDownloadTemplate}
                data-testid="button-board-download-template"
              >
                <FileText className="h-3.5 w-3.5" />
                Download import template
              </DropdownMenuItem>
            )}
            {(showFormatInMore || onExport || onDownloadTemplate) && (onPaste || onImport) && (
              <DropdownMenuSeparator />
            )}
            {onPaste && (
              <DropdownMenuItem className="gap-2" onSelect={onPaste} data-testid="button-board-paste">
                <ClipboardPaste className="h-3.5 w-3.5" />
                Paste
              </DropdownMenuItem>
            )}
            {onImport && (
              <DropdownMenuItem className="gap-2" onSelect={onImport} data-testid="button-board-import">
                <Upload className="h-3.5 w-3.5" />
                Import
              </DropdownMenuItem>
            )}
            {moreMenuItems && (
              <>
                {(showFormatInMore || hasDataActions) && <DropdownMenuSeparator />}
                {moreMenuItems}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
