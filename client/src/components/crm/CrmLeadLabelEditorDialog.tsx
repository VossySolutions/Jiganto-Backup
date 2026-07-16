import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import type { StatusOption } from "@/components/MondayTable";
import { LABEL_COLOR_PRESETS, slugifyLabelValue } from "@/lib/crm-lead-labels";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

type CrmLeadLabelEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  options: StatusOption[];
  onSave: (options: StatusOption[]) => void;
  lockedValues?: string[];
};

export function CrmLeadLabelEditorDialog({
  open,
  onOpenChange,
  title,
  options,
  onSave,
  lockedValues = [],
}: CrmLeadLabelEditorDialogProps) {
  const [draft, setDraft] = useState<StatusOption[]>(() => options.map((o) => ({ ...o })));

  const resetFromProps = (nextOpen: boolean) => {
    if (nextOpen) setDraft(options.map((o) => ({ ...o })));
    onOpenChange(nextOpen);
  };

  const updateLabel = (index: number, label: string) => {
    setDraft((prev) => prev.map((o, i) => (i === index ? { ...o, label } : o)));
  };

  const updateColor = (index: number, color: string) => {
    setDraft((prev) => prev.map((o, i) => (i === index ? { ...o, color } : o)));
  };

  const removeAt = (index: number) => {
    const value = draft[index]?.value;
    if (value && lockedValues.includes(value)) return;
    setDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const addLabel = () => {
    const label = `Label ${draft.length + 1}`;
    let value = slugifyLabelValue(label);
    const existing = new Set(draft.map((o) => o.value));
    if (existing.has(value)) value = `${value}_${Date.now()}`;
    setDraft((prev) => [
      ...prev,
      {
        value,
        label,
        color: LABEL_COLOR_PRESETS[prev.length % LABEL_COLOR_PRESETS.length].className,
      },
    ]);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={resetFromProps}
      title={title}
      subtitle="Rename labels, change colors, or add new ones (monday.com style)"
      saveLabel="Apply"
      onCancel={() => onOpenChange(false)}
      onSubmit={() => {
        const cleaned = draft
          .map((o) => ({
            ...o,
            label: o.label.trim() || o.value,
            value: o.value.trim() || slugifyLabelValue(o.label),
          }))
          .filter((o) => o.value);
        onSave(cleaned);
        onOpenChange(false);
      }}
      size="md"
      saveTestId="button-save-lead-labels"
    >
      <div className="space-y-3 py-2" data-testid="lead-label-editor">
        {draft.map((opt, index) => {
          const locked = lockedValues.includes(opt.value);
          return (
            <div
              key={opt.value}
              className="flex items-center gap-2"
              data-testid={`lead-label-row-${opt.value}`}
            >
              <span
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium shrink-0 min-w-[72px] text-center",
                  opt.color,
                )}
              >
                Preview
              </span>
              <Input
                value={opt.label}
                onChange={(e) => updateLabel(index, e.target.value)}
                className="h-8"
                data-testid={`input-label-${opt.value}`}
              />
              <div className="flex items-center gap-1 shrink-0">
                {LABEL_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.id}
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition-transform",
                      opt.color === preset.className
                        ? "border-foreground scale-110"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: preset.swatch }}
                    onClick={() => updateColor(index, preset.className)}
                    data-testid={`color-${opt.value}-${preset.id}`}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                disabled={locked}
                onClick={() => removeAt(index)}
                data-testid={`button-remove-label-${opt.value}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={addLabel}
          data-testid="button-add-label"
        >
          <Plus className="h-3.5 w-3.5" />
          Add label
        </Button>
      </div>
    </FormDialogShell>
  );
}
