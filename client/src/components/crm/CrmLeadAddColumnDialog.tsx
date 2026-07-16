import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { slugifyLabelValue } from "@/lib/crm-lead-labels";

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

type CrmLeadAddColumnDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCount: number;
  onCreated?: (fieldName: string) => void;
};

export function CrmLeadAddColumnDialog({
  open,
  onOpenChange,
  existingCount,
  onCreated,
}: CrmLeadAddColumnDialogProps) {
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [optionsText, setOptionsText] = useState("Option A\nOption B\nOption C");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const fieldName = slugifyLabelValue(label);
      const needsOptions = fieldType === "dropdown" || fieldType === "multi-select" || fieldType === "status";
      const apiType = fieldType === "status" ? "dropdown" : fieldType;
      return apiRequest("POST", "/api/crm/custom-fields", {
        entityType: "lead",
        fieldName,
        fieldLabel: label.trim(),
        fieldType: apiType,
        options: needsOptions
          ? optionsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
          : undefined,
        position: existingCount,
        isRequired: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/custom-fields?entityType=lead"] });
      const fieldName = slugifyLabelValue(label);
      toast({ title: "Column added" });
      onCreated?.(fieldName);
      setLabel("");
      setFieldType("text");
      onOpenChange(false);
    },
    onError: () => toast({ title: "Failed to add column", variant: "destructive" }),
  });

  const needsOptions = fieldType === "dropdown" || fieldType === "multi-select" || fieldType === "status";

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add column"
      subtitle="Choose an attribute type — the column appears on the Leads table"
      saveLabel="Add column"
      onCancel={() => onOpenChange(false)}
      onSubmit={() => {
        if (!label.trim()) {
          toast({ title: "Enter a column name", variant: "destructive" });
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
