import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CrmInlineSelectOption = { value: string; label: string };

type CrmInlineEditSelectProps = {
  value: string;
  displayValue?: React.ReactNode;
  options: CrmInlineSelectOption[];
  onSave: (value: string) => void | Promise<void>;
  className?: string;
  testId?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function CrmInlineEditSelect({
  value,
  displayValue,
  options,
  onSave,
  className,
  testId,
  disabled,
  placeholder = "—",
}: CrmInlineEditSelectProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = async (next: string) => {
    setEditing(false);
    if (next !== value) await onSave(next);
  };

  if (disabled) {
    return <span className={className}>{displayValue ?? options.find((o) => o.value === value)?.label ?? placeholder}</span>;
  }

  if (editing) {
    return (
      <Select
        value={draft || "__empty__"}
        onValueChange={(v) => {
          const next = v === "__empty__" ? "" : v;
          setDraft(next);
          void commit(next);
        }}
        open
        onOpenChange={(open) => {
          if (!open) setEditing(false);
        }}
      >
        <SelectTrigger className={cn("h-8 text-sm", className)} data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">{placeholder}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <button
      type="button"
      onDoubleClick={() => setEditing(true)}
      className={cn(
        "text-left w-full rounded px-1 -mx-1 hover:bg-muted/50 transition-colors truncate",
        className,
      )}
      title="Double-click to edit"
      data-testid={testId}
    >
      {displayValue ?? options.find((o) => o.value === value)?.label ?? placeholder}
    </button>
  );
}

type CrmInlineEditDateProps = {
  value: string;
  displayValue?: string;
  onSave: (value: string) => void | Promise<void>;
  className?: string;
  testId?: string;
  disabled?: boolean;
};

export function CrmInlineEditDate({
  value,
  displayValue,
  onSave,
  className,
  testId,
  disabled,
}: CrmInlineEditDateProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

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
        type="date"
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
        autoFocus
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
