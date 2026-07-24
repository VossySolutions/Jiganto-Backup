import { Eye } from "lucide-react";
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
  className?: string;
};

export function CrmColumnVisibilityMenu({
  columns,
  visibility,
  onChange,
  testId = "button-column-visibility",
  className,
}: CrmColumnVisibilityMenuProps) {
  const hiddenCount = columns.filter((c) => visibility[c.id] === false).length;
  const active = hiddenCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] font-medium transition-colors",
            "text-foreground hover:bg-muted",
            active && "bg-primary/15 text-primary hover:bg-primary/15",
            className,
          )}
          data-testid={testId}
        >
          <Eye className="h-3.5 w-3.5" />
          Hide
          {active && (
            <span className="h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {hiddenCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 max-h-[min(70vh,420px)] overflow-y-auto">
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
