import { useMemo, useState } from "react";
import { type Column, type Item } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  columns: Column[];
  items: Item[];
  onItemClick?: (item: Item) => void;
  onDateClick?: (date: Date) => void;
}

export function CalendarView({ columns: columnsData, items, onItemClick, onDateClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const dateColumn = columnsData.find(col => col.type === "date");
  const titleColumn = columnsData.find(col => col.key === "title" || col.type === "text");

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];
    
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    const endPadding = 42 - days.length;
    for (let i = 1; i <= endPadding; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  }, [currentDate]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, Item[]> = {};
    
    if (!dateColumn) return map;
    
    items.forEach(item => {
      const dateValue = (item.values as any)[dateColumn.key];
      if (dateValue) {
        const dateKey = new Date(dateValue).toDateString();
        if (!map[dateKey]) {
          map[dateKey] = [];
        }
        map[dateKey].push(item);
      }
    });
    
    return map;
  }, [items, dateColumn]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-lg">
          {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} data-testid="calendar-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentDate(new Date())}
            data-testid="calendar-today"
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth} data-testid="calendar-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {weekDays.map(day => (
          <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground border-b bg-muted/30">
            {day}
          </div>
        ))}
        
        {daysInMonth.map((date, i) => {
          const dateItems = itemsByDate[date.toDateString()] || [];
          
          return (
            <div
              key={i}
              className={cn(
                "min-h-[100px] p-2 border-b border-r cursor-pointer hover:bg-muted/30 transition-colors",
                !isCurrentMonth(date) && "bg-muted/10 text-muted-foreground/50"
              )}
              onClick={() => onDateClick?.(date)}
              data-testid={`calendar-day-${date.getDate()}`}
            >
              <div className={cn(
                "text-sm font-medium mb-1 h-7 w-7 flex items-center justify-center rounded-full",
                isToday(date) && "bg-primary text-primary-foreground"
              )}>
                {date.getDate()}
              </div>
              
              <div className="space-y-1">
                {dateItems.slice(0, 3).map((item) => {
                  const values = item.values as Record<string, any>;
                  const title = titleColumn ? values[titleColumn.key] : `Item ${item.id}`;
                  
                  return (
                    <div
                      key={item.id}
                      className="text-xs p-1 rounded bg-primary/10 text-primary truncate cursor-pointer hover:bg-primary/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemClick?.(item);
                      }}
                      data-testid={`calendar-item-${item.id}`}
                    >
                      {title}
                    </div>
                  );
                })}
                {dateItems.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{dateItems.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
