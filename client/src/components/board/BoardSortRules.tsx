import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { BoardSortFieldDef, BoardSortRule } from "@/lib/board-filters";

type BoardSortRulesProps = {
  rules: BoardSortRule[];
  fields: BoardSortFieldDef[];
  onToggle: (field: string) => void;
  onAdd: (field: string) => void;
  onRemove: (field: string) => void;
};

export function BoardSortRules({ rules, fields, onToggle, onAdd, onRemove }: BoardSortRulesProps) {
  return (
    <>
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Active sorts</div>
      {rules.map((rule, idx) => {
        const meta = fields.find((f) => f.field === rule.field);
        return (
          <div key={rule.field} className="flex items-center gap-1 px-2 py-1">
            <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
            <button
              type="button"
              className="flex-1 text-left text-sm hover:underline"
              onClick={() => onToggle(rule.field)}
            >
              {meta?.label || rule.field} ({rule.dir})
            </button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemove(rule.field)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
      <DropdownMenuSeparator />
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Add sort</div>
      {fields
        .filter((f) => !rules.some((r) => r.field === f.field))
        .map((f) => (
          <DropdownMenuItem key={f.field} onClick={() => onAdd(f.field)}>
            {f.label}
          </DropdownMenuItem>
        ))}
    </>
  );
}
