import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { slugifyLabelValue } from "@/lib/board-labels";
import {
  boardCustomFieldsQueryKey,
  useBoardCustomFields,
} from "@/hooks/use-board-custom-fields";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "status", label: "Status (colored)" },
  { value: "multi-select", label: "Multi-Select" },
  { value: "person", label: "Person" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
];

const OPTION_TYPES = ["dropdown", "multi-select", "status"];
const DEFAULT_OPTIONS_TEXT = "Option A\nOption B\nOption C";

type BoardAddColumnDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityLabel?: string;
  existingCount: number;
  onCreated?: (fieldName: string) => void;
};

/** monday.com "Add column" — same modal for every board, only entityType differs. */
export function BoardAddColumnDialog({
  open,
  onOpenChange,
  entityType,
  entityLabel,
  existingCount,
  onCreated,
}: BoardAddColumnDialogProps) {
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [optionsText, setOptionsText] = useState(DEFAULT_OPTIONS_TEXT);
  const { toast } = useToast();
  const { fields } = useBoardCustomFields(entityType);

  const resetForm = () => {
    setLabel("");
    setFieldType("text");
    setOptionsText(DEFAULT_OPTIONS_TEXT);
  };

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const needsOptions = OPTION_TYPES.includes(fieldType);
      const options = needsOptions
        ? (() => {
            const seen = new Set<string>();
            const unique: string[] = [];
            for (const part of optionsText.split(/[\n,]/)) {
              const trimmed = part.trim();
              if (!trimmed) continue;
              const key = trimmed.toLowerCase();
              if (seen.has(key)) continue;
              seen.add(key);
              unique.push(trimmed);
            }
            return unique;
          })()
        : undefined;
      return apiRequest("POST", "/api/crm/custom-fields", {
        entityType,
        fieldName: slugifyLabelValue(label),
        fieldLabel: label.trim(),
        fieldType: fieldType === "status" ? "dropdown" : fieldType,
        options,
        position: existingCount,
        isRequired: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardCustomFieldsQueryKey(entityType) });
      toast({ title: "Column added" });
      onCreated?.(slugifyLabelValue(label));
      resetForm();
      onOpenChange(false);
    },
    onError: () => toast({ title: "Failed to add column", variant: "destructive" }),
  });

  const needsOptions = OPTION_TYPES.includes(fieldType);

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add column"
      subtitle={`Choose an attribute type — the column appears on the ${entityLabel || entityType} table`}
      saveLabel="Add column"
      onCancel={() => onOpenChange(false)}
      onSubmit={() => {
        if (!label.trim()) {
          toast({ title: "Enter a column name", variant: "destructive" });
          return;
        }
        const fieldName = slugifyLabelValue(label);
        if (fields.some((f) => f.fieldName === fieldName)) {
          toast({ title: "A column with this name already exists", variant: "destructive" });
          return;
        }
        createMutation.mutate();
      }}
      saving={createMutation.isPending}
      disabled={!label.trim() || existingCount >= 20}
      size="sm"
      saveTestId="button-confirm-add-column"
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Column name</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Region"
            data-testid="input-add-column-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={fieldType} onValueChange={setFieldType}>
            <SelectTrigger data-testid="select-add-column-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {needsOptions && (
          <div className="space-y-1.5">
            <Label>Dropdown values (one per line)</Label>
            <Textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              rows={4}
              className="text-sm"
              data-testid="input-add-column-options"
            />
          </div>
        )}
      </div>
    </FormDialogShell>
  );
}
