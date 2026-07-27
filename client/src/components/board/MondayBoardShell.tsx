import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  MondayBoardProvider,
  MondayBoardTable,
  type MondayBoardTableProps,
} from "@/components/MondayBoardTable";
import {
  MondayBoardToolbar,
  type MondayBoardToolbarProps,
} from "@/components/MondayBoardToolbar";
import { BoardSavedViewTabs, type BoardViewSnapshot } from "@/components/board/BoardSavedViewTabs";
import { BoardPersonFilter, type BoardPersonUser } from "@/components/board/BoardPersonFilter";
import { BoardViewSwitcher } from "@/components/board/BoardViewSwitcher";
import { BoardFilterRules } from "@/components/board/BoardFilterRules";
import { BoardSortRules } from "@/components/board/BoardSortRules";
import { BoardColumnsMenu, type BoardColumnMenuItem } from "@/components/board/BoardColumnsMenu";
import {
  SavedViewsDropdown,
  type FilterConfig,
  type SortConfig,
  type ColumnConfig,
} from "@/components/crm/SavedViewsDropdown";
import type {
  BoardFilterFieldDef,
  BoardFilterRule,
  BoardSortFieldDef,
  BoardSortRule,
  BoardViewMode,
} from "@/lib/board-filters";
import { matchBoardFilterValue } from "@/lib/board-filters";
import {
  BoardGenericAlternateViews,
  rowsToBoardItems,
} from "@/components/board/BoardGenericAlternateViews";
import { useBoardColumnExtras } from "@/components/board/useBoardColumnExtras";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";

export type MondayBoardShellProps<T extends { id: number | string }> = {
  storageKey: string;
  entityType: string;

  viewSnapshot: BoardViewSnapshot;
  onApplyViewSnapshot: (snapshot: BoardViewSnapshot) => void;
  mainTableSorts?: BoardSortRule[];

  newLabel: string;
  onNew: () => void;
  newTestId?: string;
  afterNewSlot?: ReactNode;

  searchValue: string;
  onSearchChange: (v: string) => void;
  searchTestId?: string;

  personUsers?: BoardPersonUser[];
  personValue?: string;
  onPersonChange?: (v: string) => void;

  viewMode: BoardViewMode;
  onViewModeChange: (mode: BoardViewMode) => void;
  viewModes?: BoardViewMode[];

  filterRules: BoardFilterRule[];
  onFilterRulesChange: (rules: BoardFilterRule[]) => void;
  filterFields: BoardFilterFieldDef[];
  getFilterFieldOptions: (field: string) => { value: string; label: string }[];
  filterOpen?: boolean;
  onFilterOpenChange?: (open: boolean) => void;

  sortRules: BoardSortRule[];
  sortFields: BoardSortFieldDef[];
  onSortToggle: (field: string) => void;
  onSortAdd: (field: string) => void;
  onSortRemove: (field: string) => void;
  defaultSortField?: string;

  groupContent?: ReactNode;
  groupActive?: boolean;
  groupLabel?: string;
  grouped?: boolean;
  afterGroupSlot?: ReactNode;

  pinActive?: boolean;
  onPinToggle?: () => void;
  pinTitle?: string;

  columnMenuItems: BoardColumnMenuItem[];
  onColumnVisible: (id: string, visible: boolean) => void;
  /** Used when ownsCustomColumns so custom fields appear correctly in the Columns menu. */
  isColumnVisible?: (id: string) => boolean;
  onColumnMove?: (id: string, direction: -1 | 1) => void;
  columnsHeaderActions?: ReactNode;
  /** Set when the screen already renders its own `custom_*` columns. */
  ownsCustomColumns?: boolean;
  /** Custom-field namespace when it differs from `entityType` (e.g. accounts → account). */
  customFieldEntityType?: string;

  savedViewFilters?: FilterConfig[];
  savedViewSorts?: SortConfig[];
  savedViewColumns?: ColumnConfig[];
  onApplySavedViewDropdown?: (
    filters: FilterConfig[],
    sorts?: SortConfig[],
    columns?: ColumnConfig[],
    extras?: { viewMode?: string; groupBy?: string },
  ) => void;

  onExport?: () => void;
  onDownloadTemplate?: () => void;
  onPaste?: () => void;
  onImport?: () => void;
  moreMenuItems?: ReactNode;

  tableProps?: MondayBoardTableProps<T>;
  renderAlternateView?: (mode: BoardViewMode) => ReactNode;

  className?: string;
  testId?: string;
};

/**
 * Full CRM Leads–parity board shell: Main Table tabs + toolbar + MondayTable / alternate views.
 * Every Full Implement inventory table mounts this — only columns/data/actions differ.
 */
function MondayBoardShellRoot<T extends { id: number | string }>(props: MondayBoardShellProps<T>) {
  const activeFilterCount = props.filterRules.length;
  const sortActive =
    props.sortRules.length > 1 ||
    (props.sortRules[0] && props.sortRules[0].field !== (props.defaultSortField || "created"));

  const extras = useBoardColumnExtras<T>({
    entityType: props.customFieldEntityType || props.entityType,
    storageKey: props.storageKey,
    entityLabel: props.entityType.replace(/_/g, " "),
    columns: props.tableProps?.columns || [],
    ownsCustomColumns: props.ownsCustomColumns,
    isHostColumnVisible: props.isColumnVisible,
    onHostColumnVisible: props.onColumnVisible,
  });

  const columnMenuItems = [
    ...props.columnMenuItems,
    ...extras.customMenuItems.filter(
      (item) => !props.columnMenuItems.some((existing) => existing.id === item.id),
    ),
  ];

  const tableProps = props.tableProps
    ? {
        ...props.tableProps,
        columns: (() => {
          const decorated = extras.decorateColumns(
            props.tableProps.columns,
            props.tableProps.data,
          );
          // Controlled Pin (Leads parity): freeze checkbox chrome + first visible column only.
          // When Pin is off, clear sticky so local column.sticky flags cannot leave a column stuck.
          if (props.onPinToggle == null) return decorated;
          if (!props.pinActive) {
            return decorated.map((column) => ({ ...column, sticky: false }));
          }
          const identityIds = new Set(
            decorated
              .filter((column) => !column.hidden)
              .slice(0, 1)
              .map((column) => column.id),
          );
          return decorated.map((column) => ({
            ...column,
            sticky: identityIds.has(column.id),
          }));
        })(),
        onCellEdit: (rowId: number | string, columnId: string, value: unknown) => {
          if (extras.interceptCellEdit(rowId, columnId, value)) return;
          props.tableProps?.onCellEdit?.(rowId, columnId, value);
        },
      }
    : undefined;

  return (
    <div className={props.className} data-testid={props.testId || "monday-board-shell"}>
      <BoardSavedViewTabs
        entityType={props.entityType}
        current={props.viewSnapshot}
        onApply={props.onApplyViewSnapshot}
        mainTableSorts={props.mainTableSorts}
        viewModes={props.viewModes}
      />

      <MondayBoardProvider storageKey={props.storageKey}>
        <MondayBoardToolbar
          newLabel={props.newLabel}
          onNew={props.onNew}
          newTestId={props.newTestId}
          afterNewSlot={props.afterNewSlot}
          searchValue={props.searchValue}
          onSearchChange={props.onSearchChange}
          searchTestId={props.searchTestId}
          personSlot={
            props.personUsers && props.onPersonChange ? (
              <BoardPersonFilter
                users={props.personUsers}
                value={props.personValue || "all"}
                onChange={props.onPersonChange}
              />
            ) : undefined
          }
          viewSwitcher={
            <BoardViewSwitcher
              value={props.viewMode}
              onChange={props.onViewModeChange}
              modes={props.viewModes}
            />
          }
          filterContent={
            <BoardFilterRules
              rules={props.filterRules}
              onChange={props.onFilterRulesChange}
              fields={props.filterFields}
              getFieldOptions={props.getFilterFieldOptions}
            />
          }
          filterCount={activeFilterCount}
          filterOpen={props.filterOpen}
          onFilterOpenChange={props.onFilterOpenChange}
          sortActive={sortActive}
          sortLabel={`Sort${props.sortRules.length > 1 ? ` (${props.sortRules.length})` : ""}`}
          sortContent={
            <BoardSortRules
              rules={props.sortRules}
              fields={props.sortFields}
              onToggle={props.onSortToggle}
              onAdd={props.onSortAdd}
              onRemove={props.onSortRemove}
            />
          }
          groupContent={props.groupContent}
          groupActive={props.groupActive}
          groupLabel={props.groupLabel}
          grouped={props.grouped}
          afterGroupSlot={props.afterGroupSlot}
          pinActive={props.pinActive}
          onPinToggle={props.viewMode === "table" ? props.onPinToggle : undefined}
          pinTitle={props.pinTitle}
          columnsHiddenCount={columnMenuItems.filter((c) => !c.visible).length}
          columnsContent={
            <BoardColumnsMenu
              items={columnMenuItems}
              onToggleVisible={(id, visible) => {
                if (extras.isCustomColumn(id)) extras.setCustomColumnVisible(id, visible);
                else props.onColumnVisible(id, visible);
              }}
              onMove={(id, direction) => {
                if (extras.isCustomColumn(id)) extras.moveCustomColumn(id, direction);
                else props.onColumnMove?.(id, direction);
              }}
              headerActions={
                <>
                  {props.columnsHeaderActions}
                  {props.columnsHeaderActions == null && extras.headerActions}
                </>
              }
            />
          }
          viewsSlot={
            props.onApplySavedViewDropdown ? (
              <SavedViewsDropdown
                entityType={props.entityType}
                currentFilters={props.savedViewFilters || []}
                currentSorts={props.savedViewSorts}
                columns={props.savedViewColumns}
                onApplyView={props.onApplySavedViewDropdown}
                triggerClassName="border-transparent bg-transparent text-foreground hover:bg-muted shadow-none h-8 px-2.5 rounded-md"
              />
            ) : undefined
          }
          onExport={props.onExport}
          onDownloadTemplate={props.onDownloadTemplate}
          onPaste={props.onPaste}
          onImport={props.onImport}
          moreMenuItems={props.moreMenuItems}
          testId={`${props.testId || "monday-board-shell"}-toolbar`}
        />

        {props.viewMode === "table" && tableProps ? (
          <MondayBoardTable {...tableProps} />
        ) : (
          (() => {
            const custom = props.renderAlternateView?.(props.viewMode);
            if (custom != null) return custom;
            const data = (tableProps?.data || []) as T[];
            const columns = tableProps?.columns || [];
            const items = rowsToBoardItems(data, columns);
            return (
              <BoardGenericAlternateViews
                mode={props.viewMode}
                items={items}
                entityLabel={props.entityType.replace(/_/g, " ")}
                onOpenItem={(id) => {
                  const row = data.find((r) => r.id === id);
                  if (row && props.tableProps?.onOpenItem) props.tableProps.onOpenItem(row);
                  else if (row && props.tableProps?.onEditItem) props.tableProps.onEditItem(row);
                }}
                onAdd={props.onNew}
                onStatusChange={async (id, status) => {
                  const statusCol = columns.find((c) => c.type === "status");
                  if (statusCol && tableProps?.onCellEdit) {
                    await tableProps.onCellEdit(id, statusCol.id, status);
                  }
                }}
              />
            );
          })()
        )}
      </MondayBoardProvider>

      {extras.dialogs}
    </div>
  );
}

type LegacyColumn<T extends { id: number | string }> =
  MondayBoardTableProps<T>["columns"][number];
type LegacyShellState = ReturnType<typeof useMondayBoardShellState>;

type LegacyBoardContextValue = {
  entityType: string;
  shell: LegacyShellState;
  columns: LegacyColumn<any>[];
  setColumns: (columns: LegacyColumn<any>[]) => void;
  extras: ReturnType<typeof useBoardColumnExtras<any>>;
  renderAlternateView?: (mode: BoardViewMode) => ReactNode;
  filterMatcher: typeof matchBoardFilterValue;
};

const LegacyBoardContext = createContext<LegacyBoardContextValue | null>(null);

type LegacyMondayBoardShellProps = {
  storageKey: string;
  entityType: string;
  children: ReactNode;
  stateHook?: typeof useMondayBoardShellState;
  renderAlternateView?: (mode: BoardViewMode) => ReactNode;
  filterMatcher?: typeof matchBoardFilterValue;
};

/**
 * Migration bridge for established module tables. It gives existing toolbar/table
 * props the same saved-view and board-state contract as native shell consumers.
 */
function LegacyMondayBoardShell({
  storageKey,
  entityType,
  children,
  stateHook = useMondayBoardShellState,
  renderAlternateView,
  filterMatcher = matchBoardFilterValue,
}: LegacyMondayBoardShellProps) {
  const [columns, setColumns] = useState<LegacyColumn<any>[]>([]);
  const columnDefs = useMemo(
    () =>
      columns.map((column) => ({
        id: column.id,
        label: typeof column.header === "string" ? column.header : column.id,
      })),
    [columns],
  );
  const shell = stateHook({
    storageKey,
    columnDefs,
    defaultSortField: columns[0]?.id || "created",
  });
  const extras = useBoardColumnExtras<any>({
    entityType,
    storageKey,
    entityLabel: entityType.replace(/_/g, " "),
    columns,
  });

  return (
    <LegacyBoardContext.Provider
      value={{
        entityType,
        shell,
        columns,
        setColumns,
        extras,
        renderAlternateView,
        filterMatcher,
      }}
    >
      <BoardSavedViewTabs
        entityType={entityType}
        current={shell.viewSnapshot}
        onApply={shell.applyViewSnapshot}
      />
      <MondayBoardProvider storageKey={storageKey}>{children}</MondayBoardProvider>
      {extras.dialogs}
    </LegacyBoardContext.Provider>
  );
}

function LegacyMondayBoardToolbar(props: MondayBoardToolbarProps) {
  const context = useContext(LegacyBoardContext);
  if (!context) return <MondayBoardToolbar {...props} />;
  const { shell, columns, entityType } = context;
  const filterFields = columns.map((column) => ({
    field: column.id,
    label: typeof column.header === "string" ? column.header : column.id,
    textInput: true,
  }));
  const sortFields = filterFields.map(({ field, label }) => ({ field, label }));
  const sortActive =
    shell.sortRules.length > 1 ||
    (shell.sortRules[0] && shell.sortRules[0].field !== (columns[0]?.id || "created"));
  const columnMenuItems = [
    ...shell.columnMenuItems,
    ...context.extras.customMenuItems.filter(
      (item) => !shell.columnMenuItems.some((existing) => existing.id === item.id),
    ),
  ];
  const firstVisible = columns.find((column) => !column.hidden) || columns[0];
  const firstLabel =
    typeof firstVisible?.header === "string" && firstVisible.header.trim()
      ? firstVisible.header
      : "first";
  const pinTitle = shell.pinActive
    ? `Unpin ${firstLabel} column`
    : `Pin ${firstLabel} column`;

  return (
    <MondayBoardToolbar
      {...props}
      viewSwitcher={
        <BoardViewSwitcher value={shell.viewMode} onChange={shell.setViewModePersist} />
      }
      filterContent={
        <BoardFilterRules
          rules={shell.filterRules}
          onChange={shell.setFilterRules}
          fields={filterFields}
          getFieldOptions={() => []}
        />
      }
      filterCount={shell.filterRules.length}
      filterOpen={shell.filterOpen}
      onFilterOpenChange={shell.setFilterOpen}
      sortActive={sortActive}
      sortLabel={`Sort${shell.sortRules.length > 1 ? ` (${shell.sortRules.length})` : ""}`}
      sortContent={
        <BoardSortRules
          rules={shell.sortRules}
          fields={sortFields}
          onToggle={shell.onSortToggle}
          onAdd={shell.onSortAdd}
          onRemove={shell.onSortRemove}
        />
      }
      pinActive={shell.pinActive}
      onPinToggle={
        shell.viewMode === "table"
          ? () => {
              shell.togglePin();
              // Keep local pin mirrors in sync (Projects/Clients custom tables, etc.).
              props.onPinToggle?.();
            }
          : undefined
      }
      pinTitle={pinTitle}
      columnsHiddenCount={columnMenuItems.filter((column) => !column.visible).length}
      columnsContent={
        <BoardColumnsMenu
          items={columnMenuItems}
          onToggleVisible={(id, visible) => {
            if (context.extras.isCustomColumn(id)) {
              context.extras.setCustomColumnVisible(id, visible);
            } else {
              shell.setColVisible(id, visible);
            }
          }}
          onMove={(id, direction) => {
            if (context.extras.isCustomColumn(id)) {
              context.extras.moveCustomColumn(id, direction);
            } else {
              shell.moveColumn(id, direction);
            }
          }}
          headerActions={context.extras.headerActions}
        />
      }
      viewsSlot={
        <SavedViewsDropdown
          entityType={entityType}
          currentFilters={shell.filterRules.map((rule) => ({
            columnId: rule.field,
            operator: rule.operator === "contains" ? "contains" : "equals",
            value: rule.value,
          }))}
          currentSorts={shell.sortRules.map((rule) => ({
            columnId: rule.field,
            direction: rule.dir,
          }))}
          onApplyView={(filters, sorts, _columns, extras) =>
            shell.applyViewSnapshot({
              ...shell.viewSnapshot,
              filters: filters.map((filter, index) => ({
                id: `saved-${index}-${filter.columnId}`,
                field: filter.columnId,
                operator: filter.operator === "contains" ? "contains" : "is",
                value: filter.value,
              })),
              sorts:
                sorts?.map((sort) => ({
                  field: sort.columnId,
                  dir: sort.direction,
                })) || [],
              viewMode: (extras?.viewMode as BoardViewMode) || shell.viewMode,
              groupBy: extras?.groupBy || shell.groupBy,
            })
          }
        />
      }
    />
  );
}

function readLegacyColumnValue<T extends { id: number | string }>(
  column: LegacyColumn<T>,
  row: T,
): unknown {
  if (typeof column.accessor === "function") return column.accessor(row);
  if (typeof column.accessor === "string") return (row as Record<string, unknown>)[column.accessor];
  return (row as Record<string, unknown>)[column.id];
}

function LegacyMondayBoardTable<T extends { id: number | string }>(
  props: MondayBoardTableProps<T>,
) {
  const context = useContext(LegacyBoardContext);
  useEffect(() => {
    context?.setColumns(props.columns);
  }, [context?.setColumns, props.columns]);
  if (!context) return <MondayBoardTable {...props} />;
  const { shell } = context;
  const onCellEdit = (rowId: number | string, columnId: string, value: unknown) => {
    if (context.extras.interceptCellEdit(rowId, columnId, value)) return;
    props.onCellEdit?.(rowId, columnId, value);
  };
  const decorated = context.extras.decorateColumns(
    props.columns,
    props.data,
  ) as LegacyColumn<T>[];
  if (shell.viewMode !== "table") {
    const custom = context.renderAlternateView?.(shell.viewMode);
    if (custom != null) return <>{custom}</>;
    const items = rowsToBoardItems(props.data, decorated);
    return (
      <BoardGenericAlternateViews
        mode={shell.viewMode}
        items={items}
        entityLabel={context.entityType.replace(/_/g, " ")}
        onOpenItem={(id) => {
          const row = props.data.find((r) => r.id === id);
          if (row && props.onOpenItem) props.onOpenItem(row);
          else if (row && props.onEditItem) props.onEditItem(row);
        }}
        onAdd={undefined}
        onStatusChange={async (id, status) => {
          const statusCol = decorated.find((c) => c.type === "status");
          if (statusCol) {
            await onCellEdit(id, statusCol.id, status);
          }
        }}
      />
    );
  }

  const columnsById = new Map(decorated.map((column) => [column.id, column]));
  const orderedIds = shell.columnOrderIds.length
    ? shell.columnOrderIds
    : decorated.map((column) => column.id);
  const orderedWithVisibility = [
    ...orderedIds.map((id) => columnsById.get(id)).filter(Boolean),
    ...decorated.filter((column) => !orderedIds.includes(column.id)),
  ].map((column) => ({
    ...column!,
    hidden:
      column!.hidden ||
      (!context.extras.isCustomColumn(column!.id) && !shell.isColVisible(column!.id)),
  }));
  // Pin freezes checkbox chrome + the first visible (identity) column — same as Leads / native shell.
  // Do not fall back to column.sticky when pin is off (Legacy tables often keep a stale local pin flag).
  const identityColumnIds = new Set(
    orderedWithVisibility
      .filter((column) => !column.hidden)
      .slice(0, 1)
      .map((column) => column.id),
  );
  const orderedColumns = orderedWithVisibility.map((column) => ({
    ...column,
    sticky: shell.pinActive ? identityColumnIds.has(column.id) : false,
  }));

  let data = props.data.filter((row) =>
    shell.filterRules.every((rule) => {
      const column = columnsById.get(rule.field);
      if (!column) return true;
      const value = readLegacyColumnValue(column, row);
      return context.filterMatcher(
        value == null ? "" : String(value),
        rule.operator,
        rule.value,
      );
    }),
  );
  data = [...data].sort((a, b) => {
    for (const rule of shell.sortRules) {
      const column = columnsById.get(rule.field);
      if (!column) continue;
      const av = readLegacyColumnValue(column, a);
      const bv = readLegacyColumnValue(column, b);
      const comparison = String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (comparison) return rule.dir === "asc" ? comparison : -comparison;
    }
    return 0;
  });

  return (
    <MondayBoardTable {...props} columns={orderedColumns} data={data} onCellEdit={onCellEdit} />
  );
}

export const MondayBoardShell = Object.assign(MondayBoardShellRoot, {
  Legacy: LegacyMondayBoardShell,
  Toolbar: LegacyMondayBoardToolbar,
  Table: LegacyMondayBoardTable,
});
