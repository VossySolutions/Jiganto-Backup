import { useEffect, useState } from "react";
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

/**
 * monday.com “Edit Labels” modal:
 * label text is edited on the saturated color bar; color chips sit underneath.
 */
export function CrmLeadLabelEditorDialog({
  open,
  onOpenChange,
  title,
  options,
  onSave,
  lockedValues = [],
}: CrmLeadLabelEditorDialogProps) {
  const [draft, setDraft] = useState<StatusOption[]>(() => options.map((o) => ({ ...o })));

  useEffect(() => {
    if (open) setDraft(options.map((o) => ({ ...o })));
  }, [open]);

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
      subtitle="Click a label to rename · pick a color below each bar"
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
      size="sm"
      saveTestId="button-save-lead-labels"
      bodyClassName="px-5 py-4"
    >
      <div className="space-y-3" data-testid="lead-label-editor">
        {draft.map((opt, index) => {
          const locked = lockedValues.includes(opt.value);
          const isDarkText = (opt.color ?? "").includes("text-[#323338]");
          return (
            <div key={opt.value} className="space-y-1.5" data-testid={`lead-label-row-${opt.value}`}>
              <div className="flex items-stretch gap-1.5">
                <div
                  className={cn(
                    "flex-1 min-h-[36px] rounded-[4px] flex items-center px-3",
                    opt.color,
                  )}
                >
                  <input
                    value={opt.label}
                    onChange={(e) => updateLabel(index, e.target.value)}
                    className={cn(
                      "w-full bg-transparent border-0 outline-none text-[14px] font-medium text-center",
                      "placeholder:opacity-70",
                      isDarkText ? "text-[#323338] placeholder:text-[#323338]/60" : "text-white placeholder:text-white/70",
                    )}
                    placeholder="Label name"
                    data-testid={`input-label-${opt.value}`}
                  />
                </div>
                <button
                  type="button"
                  className={cn(
                    "h-9 w-9 rounded-[4px] flex items-center justify-center shrink-0",
                    "text-[#676879] hover:bg-[#dcdfec]/60 hover:text-[#e2445c]",
                    locked && "opacity-40 pointer-events-none",
                  )}
                  disabled={locked}
                  onClick={() => removeAt(index)}
                  title={locked ? "This label can’t be removed" : "Delete label"}
                  data-testid={`button-remove-label-${opt.value}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 pl-0.5">
                {LABEL_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.id}
                    className={cn(
                      "h-4 w-4 rounded-[2px] transition-transform",
                      opt.color === preset.className
                        ? "ring-2 ring-[#323338] ring-offset-1 scale-110"
                        : "hover:scale-110",
                    )}
                    style={{ backgroundColor: preset.swatch }}
                    onClick={() => updateColor(index, preset.className)}
                    data-testid={`color-${opt.value}-${preset.id}`}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addLabel}
          className="inline-flex items-center gap-1.5 h-8 text-[14px] font-medium text-[#0073ea] hover:text-[#0060b9]"
          data-testid="button-add-label"
        >
          <Plus className="h-4 w-4" />
          New label
        </button>
      </div>
    </FormDialogShell>
  );
}
