import {
  Table2,
  List,
  Columns3,
  Calendar,
  GanttChart,
  FileText,
  BarChart3,
  FormInput,
  LayoutDashboard,
  Clock,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { crmToolBtn } from "@/lib/crm-monday-chrome";
import type { BoardViewMode } from "@/lib/board-filters";
import { BOARD_VIEW_MODES } from "@/lib/board-filters";

const ICONS: Record<BoardViewMode, typeof Table2> = {
  table: Table2,
  list: List,
  board: Columns3,
  calendar: Calendar,
  gantt: GanttChart,
  document: FileText,
  chart: BarChart3,
  form: FormInput,
  dashboard: LayoutDashboard,
  timesheet: Clock,
};

const LABELS: Record<BoardViewMode, string> = {
  table: "Table",
  list: "List",
  board: "Board",
  calendar: "Calendar",
  gantt: "Gantt",
  document: "Document",
  chart: "Chart",
  form: "Form",
  dashboard: "Dashboard",
  timesheet: "Timesheet",
};

type BoardViewSwitcherProps = {
  value: BoardViewMode;
  onChange: (mode: BoardViewMode) => void;
  modes?: BoardViewMode[];
};

export function BoardViewSwitcher({
  value,
  onChange,
  modes = BOARD_VIEW_MODES,
}: BoardViewSwitcherProps) {
  const CurrentIcon = ICONS[value] || Table2;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={crmToolBtn()} data-testid="board-view-switcher">
          <CurrentIcon className="h-3.5 w-3.5" />
          {LABELS[value] || "Table"}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {modes.map((id) => {
          const Icon = ICONS[id];
          return (
            <DropdownMenuItem
              key={id}
              onClick={() => onChange(id)}
              className="gap-2"
              data-testid={`board-view-${id}`}
            >
              <Icon className="h-4 w-4" />
              {LABELS[id]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
