import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CrmInlineEditCellProps = {
  value: string;
  displayValue?: ReactNode;
  onSave: (value: string) => void | Promise<void>;
  type?: "text" | "number";
  className?: string;
  testId?: string;
  disabled?: boolean;
};

export function CrmInlineEditCell({
  value,
  displayValue,
  onSave,
  type = "text",
  className,
  testId,
  disabled,
}: CrmInlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if (draft !== value) await onSave(draft);
  };

  if (disabled) {
    return <span className={className}>{displayValue ?? (value || "—")}</span>;
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn("h-8 text-sm", className)}
        data-testid={testId}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className={cn(
        "group text-left w-full rounded px-1.5 py-0.5 -mx-1 min-h-[28px]",
        "border border-transparent hover:border-dashed hover:border-primary/35 hover:bg-muted/50",
        "transition-colors flex items-center gap-1.5 min-w-0",
        className,
      )}
      title="Click to edit"
      data-testid={testId}
    >
      <span className="flex-1 truncate">{displayValue ?? (value || "—")}</span>
      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-70" aria-hidden />
    </button>
  );
}
