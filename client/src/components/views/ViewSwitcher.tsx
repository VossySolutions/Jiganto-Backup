import { 
  Columns3, 
  Table2, 
  Calendar, 
  GanttChart, 
  List, 
  FileText, 
  BarChart3,
  ClipboardList,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ViewType = "columns" | "table" | "calendar" | "gantt" | "list" | "form" | "document" | "chart";

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const views: { type: ViewType; icon: typeof Columns3; label: string; description: string }[] = [
  { type: "columns", icon: Columns3, label: "Columns", description: "Kanban board view" },
  { type: "table", icon: Table2, label: "Table", description: "Spreadsheet view" },
  { type: "calendar", icon: Calendar, label: "Calendar", description: "Date-based view" },
  { type: "gantt", icon: GanttChart, label: "Gantt", description: "Timeline view" },
  { type: "list", icon: List, label: "List", description: "Simple list view" },
  { type: "form", icon: ClipboardList, label: "Form", description: "Data collection form" },
  { type: "document", icon: FileText, label: "Document", description: "Wiki/documentation" },
  { type: "chart", icon: BarChart3, label: "Chart", description: "Data visualization" },
];

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const currentViewInfo = views.find(v => v.type === currentView) || views[1];
  const CurrentIcon = currentViewInfo.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 rounded-xl" 
          data-testid="view-switcher-dropdown"
        >
          <CurrentIcon className="h-4 w-4" />
          <span className="font-medium">{currentViewInfo.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {views.map((view) => (
          <DropdownMenuItem
            key={view.type}
            onClick={() => onViewChange(view.type)}
            className="gap-2 cursor-pointer"
            data-testid={`view-${view.type}`}
          >
            <view.icon className="h-4 w-4" />
            <div className="flex flex-col">
              <span className="font-medium">{view.label}</span>
              <span className="text-xs text-muted-foreground">{view.description}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
