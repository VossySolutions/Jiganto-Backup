import type { ReactNode } from "react";
import { GripVertical, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export type BoardColumnMenuItem = {
  id: string;
  label: string;
  kind?: "builtin" | "custom";
  visible: boolean;
};

type BoardColumnsMenuProps = {
  items: BoardColumnMenuItem[];
  onToggleVisible: (id: string, visible: boolean) => void;
  onMove?: (id: string, direction: -1 | 1) => void;
  /** Extra items above the column list (Add column, manage fields, …) */
  headerActions?: ReactNode;
};

export function BoardColumnsMenu({
  items,
  onToggleVisible,
  onMove,
  headerActions,
}: BoardColumnsMenuProps) {
  return (
    <>
      {headerActions}
      {headerActions != null && <DropdownMenuSeparator />}
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
        Columns{onMove ? " · use arrows to reorder headers" : ""}
      </div>
      {items.map((col, idx) => (
        <div
          key={col.id}
          className="flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-accent/60 rounded-sm"
          data-testid={`column-menu-row-${col.id}`}
        >
          {onMove && (
            <>
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
              <button
                type="button"
                className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
                disabled={idx === 0}
                title="Move column earlier"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMove(col.id, -1);
                }}
                data-testid={`column-move-up-${col.id}`}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
                disabled={idx >= items.length - 1}
                title="Move column later"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMove(col.id, 1);
                }}
                data-testid={`column-move-down-${col.id}`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <label className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer px-1 py-1 text-sm">
            <Checkbox
              checked={col.visible}
              onCheckedChange={(checked) => onToggleVisible(col.id, checked === true)}
              data-testid={`add-column-${col.id}`}
            />
            <span className="truncate">
              {col.label}
              {col.kind === "custom" ? (
                <span className="text-[10px] text-muted-foreground ml-1">custom</span>
              ) : null}
            </span>
          </label>
        </div>
      ))}
    </>
  );
}

export function BoardColumnsAddAction({
  onClick,
  label = "Add column (choose type)…",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <DropdownMenuItem onClick={onClick} data-testid="button-add-column-type">
      <Plus className="h-3.5 w-3.5 mr-2" />
      {label}
    </DropdownMenuItem>
  );
}
