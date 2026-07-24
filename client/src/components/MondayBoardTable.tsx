import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Minimize2, Maximize2, Paintbrush, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import MondayTable, { type MondayTableProps } from "@/components/MondayTable";
import { cn } from "@/lib/utils";
import {
  crmIconBtn,
  crmMondayPagination,
  CRM_TOOLBAR_CLASS,
  CRM_SEARCH_INPUT_CLASS,
  crmToolBtn,
} from "@/lib/crm-monday-chrome";

export type MondayBoardDensity = "compact" | "comfortable" | "expanded";

/** Leads-parity chrome class shared by all module tables. */
export const MONDAY_BOARD_TABLE_CLASS = "border rounded-xl border-border/60";

export type MondayBoardChrome = {
  density: MondayBoardDensity;
  setDensity: (d: MondayBoardDensity) => void;
  cycleDensity: () => void;
  formatPanelOpen: boolean;
  setFormatPanelOpen: (open: boolean) => void;
  expandAllSignal: number;
  collapseAllSignal: number;
  expandAll: () => void;
  collapseAll: () => void;
};

const MondayBoardContext = createContext<MondayBoardChrome | null>(null);

export function useMondayBoardChrome(storageKey?: string): MondayBoardChrome {
  const densityKey = storageKey ? `${storageKey}-density` : null;
  const [density, setDensity] = useState<MondayBoardDensity>(() => {
    if (!densityKey || typeof window === "undefined") return "comfortable";
    const saved = localStorage.getItem(densityKey);
    return saved === "compact" || saved === "expanded" || saved === "comfortable"
      ? saved
      : "comfortable";
  });
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [expandAllSignal, setExpandAllSignal] = useState(0);
  const [collapseAllSignal, setCollapseAllSignal] = useState(0);

  const cycleDensity = useCallback(() => {
    setDensity((d) => {
      const next: MondayBoardDensity =
        d === "comfortable" ? "expanded" : d === "expanded" ? "compact" : "comfortable";
      if (densityKey) localStorage.setItem(densityKey, next);
      return next;
    });
  }, [densityKey]);

  return {
    density,
    setDensity,
    cycleDensity,
    formatPanelOpen,
    setFormatPanelOpen,
    expandAllSignal,
    collapseAllSignal,
    expandAll: () => setExpandAllSignal((n) => n + 1),
    collapseAll: () => setCollapseAllSignal((n) => n + 1),
  };
}

export function MondayBoardProvider({
  storageKey,
  children,
}: {
  storageKey: string;
  children: ReactNode;
}) {
  const chrome = useMondayBoardChrome(storageKey);
  return (
    <MondayBoardContext.Provider value={chrome}>{children}</MondayBoardContext.Provider>
  );
}

export function useMondayBoard(): MondayBoardChrome {
  const ctx = useContext(MondayBoardContext);
  if (!ctx) {
    throw new Error("useMondayBoard must be used within MondayBoardProvider");
  }
  return ctx;
}

function useOptionalMondayBoard(): MondayBoardChrome | null {
  return useContext(MondayBoardContext);
}

export type MondayBoardTableProps<T extends { id: number | string }> = Omit<
  MondayTableProps<T>,
  "hideFormatToolbar"
> & {
  /** Pagination reset key — always page size 25 when `pagination` omitted. */
  paginationResetKey?: string;
  /** When true, skip Leads selectable default. */
  disableSelectable?: boolean;
};

/**
 * Monday.com / CRM Leads board table — same chrome for every module.
 * Prefer wrapping the screen section in `<MondayBoardProvider storageKey="…">`.
 * Only columns / data / entity actions should differ between screens.
 */
export function MondayBoardTable<T extends { id: number | string }>(props: MondayBoardTableProps<T>) {
  const {
    paginationResetKey,
    pagination,
    className,
    density: densityProp,
    formatPanelOpen: formatOpenProp,
    onFormatPanelOpenChange,
    expandAllSignal: expandProp,
    collapseAllSignal: collapseProp,
    selectable,
    disableSelectable,
    gridLines = true,
    alwaysShowRowActions = true,
    showColumnSummary = true,
    reorderable,
    onRowReorder,
    ...rest
  } = props;

  const board = useOptionalMondayBoard();
  const density = densityProp ?? board?.density ?? "comfortable";
  const formatPanelOpen = formatOpenProp ?? board?.formatPanelOpen ?? false;
  const handleFormatOpenChange = onFormatPanelOpenChange ?? board?.setFormatPanelOpen;
  const expandAllSignal = expandProp ?? board?.expandAllSignal;
  const collapseAllSignal = collapseProp ?? board?.collapseAllSignal;

  const resolvedPagination =
    pagination === false
      ? false
      : pagination ??
        (paginationResetKey != null
          ? crmMondayPagination(String(paginationResetKey))
          : { defaultPageSize: 25 as const });

  return (
    <MondayTable
      {...rest}
      selectable={disableSelectable ? false : selectable !== false}
      gridLines={gridLines}
      density={density}
      reorderable={reorderable ?? !!onRowReorder}
      onRowReorder={onRowReorder}
      hideFormatToolbar
      formatPanelOpen={formatPanelOpen}
      onFormatPanelOpenChange={handleFormatOpenChange}
      expandAllSignal={expandAllSignal}
      collapseAllSignal={collapseAllSignal}
      showColumnSummary={showColumnSummary}
      alwaysShowRowActions={alwaysShowRowActions}
      pagination={resolvedPagination}
      className={cn(MONDAY_BOARD_TABLE_CLASS, className)}
    />
  );
}

/** Density + Format + expand/collapse — must sit under MondayBoardProvider. */
export function MondayBoardChromeControls({
  grouped = false,
  showFormat = true,
}: {
  grouped?: boolean;
  showFormat?: boolean;
}) {
  const chrome = useMondayBoard();

  return (
    <>
      {grouped && (
        <>
          <button
            type="button"
            className={crmIconBtn()}
            title="Expand all groups"
            aria-label="Expand all groups"
            onClick={chrome.expandAll}
            data-testid="button-expand-all-groups"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={crmIconBtn()}
            title="Collapse all groups"
            aria-label="Collapse all groups"
            onClick={chrome.collapseAll}
            data-testid="button-collapse-all-groups"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      <button
        type="button"
        onClick={chrome.cycleDensity}
        className={crmIconBtn()}
        title={`Density: ${chrome.density}`}
        aria-label={`Table density ${chrome.density}`}
        data-testid="button-density"
      >
        {chrome.density === "compact" ? (
          <Minimize2 className="h-3.5 w-3.5" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5" />
        )}
      </button>
      {showFormat && (
        <button
          type="button"
          className={crmIconBtn(chrome.formatPanelOpen)}
          title="Format"
          aria-label="Conditional formatting"
          onClick={() => chrome.setFormatPanelOpen(true)}
          data-testid="button-conditional-formatting"
        >
          <Paintbrush className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  );
}

export {
  CRM_TOOLBAR_CLASS,
  CRM_SEARCH_INPUT_CLASS,
  crmToolBtn,
  crmIconBtn,
  crmMondayPagination,
};
