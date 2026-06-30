import { Copy, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  compact?: boolean;
  showReorder?: boolean;
  className?: string;
};

export function SurveyQuestionToolbar({
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  isFirst = false,
  isLast = false,
  compact = false,
  showReorder = true,
  className,
}: Props) {
  return (
    <div
      className={cn("survey-card-actions", className)}
      onClick={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="Question actions"
    >
      <Button type="button" variant="outline" size="sm" onClick={onDuplicate} className="h-8">
        <Copy className="h-3.5 w-3.5 shrink-0" />
        {!compact && <span className="ml-1.5">Duplicate</span>}
      </Button>
      {showReorder && (
        <>
      <Button type="button" variant="outline" size="sm" onClick={onMoveUp} disabled={isFirst} className="h-8">
        <ChevronUp className="h-3.5 w-3.5 shrink-0" />
        {!compact && <span className="ml-1.5">Up</span>}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onMoveDown} disabled={isLast} className="h-8">
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        {!compact && <span className="ml-1.5">Down</span>}
      </Button>
        </>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onDelete}
        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
      >
        <Trash2 className="h-3.5 w-3.5 shrink-0" />
        {!compact && <span className="ml-1.5">Delete</span>}
      </Button>
    </div>
  );
}
