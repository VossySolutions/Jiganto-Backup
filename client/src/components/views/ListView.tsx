import { type Column, type Item } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, MoreHorizontal, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ListViewProps {
  columns: Column[];
  items: Item[];
  onItemClick?: (item: Item) => void;
  onToggleComplete?: (item: Item) => void;
}

const statusColors: Record<string, string> = {
  "Done": "bg-status-green text-status-green-foreground",
  "In Progress": "bg-status-blue text-status-blue-foreground",
  "To Do": "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function ListView({ columns: columnsData, items, onItemClick, onToggleComplete }: ListViewProps) {
  const titleColumn = columnsData.find(col => col.key === "title" || col.type === "text");
  const statusColumn = columnsData.find(col => col.type === "status");
  const dateColumn = columnsData.find(col => col.type === "date");
  const ownerColumn = columnsData.find(col => col.type === "person" || col.key === "owner");

  return (
    <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No items yet. Create one to get started.</p>
        </div>
      ) : (
        items.map((item) => {
          const values = item.values as Record<string, any>;
          const title = titleColumn ? values[titleColumn.key] : `Item ${item.id}`;
          const status = statusColumn ? values[statusColumn.key] : null;
          const dueDate = dateColumn ? values[dateColumn.key] : null;
          const owner = ownerColumn ? values[ownerColumn.key] : null;
          const isComplete = status === "Done";

          return (
            <div
              key={item.id}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
              data-testid={`list-item-${item.id}`}
            >
              <Checkbox 
                checked={isComplete}
                onCheckedChange={() => onToggleComplete?.(item)}
                className="h-5 w-5 rounded-md"
                data-testid={`checkbox-${item.id}`}
              />
              
              <div 
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => onItemClick?.(item)}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "font-medium text-sm truncate",
                    isComplete && "line-through text-muted-foreground"
                  )}>
                    {title}
                  </span>
                  {status && (
                    <Badge 
                      variant="secondary" 
                      className={cn("rounded-md text-xs", statusColors[status])}
                    >
                      {status}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {dueDate && (
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    <span>{new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                )}
                {owner && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[80px]">{owner}</span>
                  </div>
                )}
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          );
        })
      )}
    </div>
  );
}
