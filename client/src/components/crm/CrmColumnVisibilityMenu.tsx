import { Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CrmColumnDef } from "@/lib/crm-list-columns";

type CrmColumnVisibilityMenuProps = {
  columns: CrmColumnDef[];
  visibility: Record<string, boolean>;
  onChange: (columnId: string, visible: boolean) => void;
  testId?: string;
};

export function CrmColumnVisibilityMenu({
  columns,
  visibility,
  onChange,
  testId = "button-column-visibility",
}: CrmColumnVisibilityMenuProps) {
  const hiddenCount = columns.filter((c) => visibility[c.id] === false).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            hiddenCount > 0
              ? "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400"
              : "bg-background border-border text-foreground hover:bg-muted",
          )}
          data-testid={testId}
        >
          <Columns3 className="h-3.5 w-3.5" />
          Show/Hide Fields
          {hiddenCount > 0 && <span className="text-xs opacity-70">({columns.length - hiddenCount}/{columns.length})</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Show / hide columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={visibility[col.id] !== false}
            onCheckedChange={(checked) => onChange(col.id, checked === true)}
            onSelect={(e) => e.preventDefault()}
            data-testid={`column-toggle-${col.id}`}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
