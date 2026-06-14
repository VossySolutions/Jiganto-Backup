import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TaskSourceBadge, TaskWorkspaceBadge } from "./TaskBadges";
import { STATUS_COLORS, type TaskFilters } from "./constants";
import type { TaskSummaryCounts, TaskSource } from "@shared/models/tasks";
import { TaskKpiSkeleton } from "./loading";

interface TaskKpiStripProps {
  summary?: TaskSummaryCounts;
  loading?: boolean;
  onFilter: (patch: Partial<TaskFilters>) => void;
}

const STATUS_KPI = [
  { key: "todo", label: "To Do", filter: { status: "todo" }, color: "text-slate-600" },
  { key: "inProgress", label: "In Progress", filter: { status: "in_progress" }, color: "text-emerald-600" },
  { key: "completed", label: "Completed", filter: { status: "completed" }, color: "text-blue-600" },
  { key: "overdue", label: "Overdue", filter: { status: "overdue" }, color: "text-red-600" },
] as const;

export function TaskKpiStrip({ summary, loading, onFilter }: TaskKpiStripProps) {
  if (loading && !summary) return <TaskKpiSkeleton />;

  const sourceEntries = summary
    ? (Object.entries(summary.bySource) as [TaskSource, number][]).filter(([, c]) => c > 0)
    : [];

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory md:grid md:grid-cols-4 lg:grid-cols-6 md:overflow-visible md:pb-0">
        {STATUS_KPI.map((kpi) => (
          <Card
            key={kpi.key}
            className="min-w-[128px] snap-start shrink-0 cursor-pointer hover-elevate border-border/40 md:min-w-0"
            onClick={() => onFilter(kpi.filter)}
          >
            <CardContent className="p-3 text-center">
              <p className={cn("text-2xl font-bold leading-none", kpi.color)}>
                {summary ? summary[kpi.key] : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
        {sourceEntries.slice(0, 2).map(([source, count]) => (
          <Card
            key={source}
            className="min-w-[128px] snap-start shrink-0 cursor-pointer hover-elevate border-border/40 md:min-w-0"
            onClick={() => onFilter({ source })}
          >
            <CardContent className="p-3">
              <p className="text-2xl font-bold leading-none">{count}</p>
              <div className="mt-1">
                <TaskSourceBadge source={source} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TaskMobileCard({
  task,
  onOpen,
}: {
  task: {
    id: string;
    title: string;
    source: TaskSource;
    status: string;
    priority: string;
    dueDate?: string | null;
    isOverdue?: boolean;
    workspaceName?: string | null;
    workspaceColor?: string | null;
    contextLabel?: string | null;
  };
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-xl border border-border/40 bg-card p-3 hover:bg-muted/30 transition-colors active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-snug line-clamp-2">{task.title}</p>
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full shrink-0 capitalize", STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] ?? "bg-muted")}>
          {task.status.replace("_", " ")}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <TaskSourceBadge source={task.source} />
        <TaskWorkspaceBadge name={task.workspaceName} color={task.workspaceColor} />
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground gap-2">
        <span className="truncate">{task.contextLabel ?? "—"}</span>
        <span className={cn("shrink-0", task.isOverdue && "text-destructive font-medium")}>
          {task.dueDate ?? "No due date"}
        </span>
      </div>
    </button>
  );
}
