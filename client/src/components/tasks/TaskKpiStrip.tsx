import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/ui/metric-card";
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
  { key: "todo" as const, label: "To Do", filter: { status: "todo" }, color: "text-slate-600 dark:text-slate-300", helpText: "Tasks not yet started." },
  { key: "inProgress" as const, label: "In Progress", filter: { status: "in_progress" }, color: "text-emerald-600 dark:text-emerald-400", helpText: "Tasks currently being worked on." },
  { key: "completed" as const, label: "Completed", filter: { status: "completed" }, color: "text-blue-600 dark:text-blue-400", helpText: "Tasks marked done." },
  { key: "overdue" as const, label: "Overdue", filter: { status: "overdue" }, color: "text-red-600 dark:text-red-400", helpText: "Open tasks past their due date." },
];

export function TaskKpiStrip({ summary, loading, onFilter }: TaskKpiStripProps) {
  if (loading && !summary) return <TaskKpiSkeleton />;

  const sourceEntries = summary
    ? (Object.entries(summary.bySource) as [TaskSource, number][]).filter(([, c]) => c > 0)
    : [];

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory md:grid md:grid-cols-4 lg:grid-cols-6 md:overflow-visible md:pb-0">
        {STATUS_KPI.map((kpi) => (
          <MetricCard
            key={kpi.key}
            title={kpi.label}
            value={summary ? summary[kpi.key] : "—"}
            helpText={kpi.helpText}
            valueClassName={cn("text-center md:text-left", kpi.color)}
            className="min-w-[128px] snap-start shrink-0 md:min-w-0"
            onClick={() => onFilter(kpi.filter)}
            testId={`kpi-task-${kpi.key}`}
          />
        ))}
        {sourceEntries.slice(0, 2).map(([source, count]) => (
          <MetricCard
            key={source}
            title={source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            value={count}
            helpText={`Tasks originating from ${source.replace("_", " ")}.`}
            className="min-w-[128px] snap-start shrink-0 md:min-w-0"
            onClick={() => onFilter({ source })}
            testId={`kpi-task-source-${source}`}
          />
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
