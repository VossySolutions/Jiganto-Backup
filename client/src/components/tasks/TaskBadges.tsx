import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SOURCE_COLORS } from "./constants";
import type { TaskSource } from "@shared/models/tasks";

export function TaskSourceBadge({ source }: { source: TaskSource }) {
  return (
    <Badge variant="secondary" className={cn("text-[10px] capitalize font-medium", SOURCE_COLORS[source])}>
      {source}
    </Badge>
  );
}

export function TaskWorkspaceBadge({
  name,
  color,
}: {
  name?: string | null;
  color?: string | null;
}) {
  const label = name ?? "Internal";
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-medium border-transparent"
      style={{ backgroundColor: `${color ?? "#6366f1"}20`, color: color ?? "#6366f1" }}
    >
      {label}
    </Badge>
  );
}
