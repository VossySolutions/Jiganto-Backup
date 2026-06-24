import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { parseOptionsInput } from "@/lib/crm-custom-fields";

type CustomField = {
  id: number;
  entityType: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  position: number;
  isRequired: boolean;
};

const ENTITY_TYPES = [
  { value: "lead", label: "Leads" },
  { value: "opportunity", label: "Opportunities" },
  { value: "account", label: "Customers" },
  { value: "contact", label: "Contacts" },
];

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multi-select", label: "Multi-Select" },
  { value: "person", label: "Person" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
];

export function CrmCustomFieldsSettings() {
  const [entityType, setEntityType] = useState("opportunity");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [fieldOptions, setFieldOptions] = useState("Option A\nOption B\nOption C");
  const { toast } = useToast();

  const { data: fields = [] } = useQuery<CustomField[]>({
    queryKey: [`/api/crm/custom-fields?entityType=${entityType}`],
  });

  const createMutation = useMutation({
    mutationFn: (data: { entityType: string; fieldName: string; fieldLabel: string; fieldType: string; options?: string[] }) =>
      apiRequest("POST", "/api/crm/custom-fields", { ...data, position: fields.length, isRequired: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/custom-fields?entityType=${entityType}`] });
      setDialogOpen(false);
      setFieldLabel("");
      setFieldName("");
      toast({ title: "Custom field created" });
    },
    onError: () => toast({ title: "Failed to create field", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/custom-fields/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/custom-fields?entityType=${entityType}`] });
      toast({ title: "Field deleted" });
    },
    onError: () => toast({ title: "Failed to delete field", variant: "destructive" }),
  });

  return (
    <div className="space-y-4 p-6" data-testid="crm-custom-fields-settings">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-[#0ea5e9]" />
          <h3 className="text-lg font-semibold">CRM Custom Fields</h3>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)} disabled={fields.length >= 20} data-testid="button-add-custom-field">
          <Plus className="h-4 w-4" /> Add Field
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Configure up to 20 custom fields per entity type. Fields appear in record forms, list tables, and import/export.</p>

      <Select value={entityType} onValueChange={setEntityType}>
        <SelectTrigger className="w-48" data-testid="select-custom-field-entity">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ENTITY_TYPES.map(e => (
            <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No custom fields for this entity yet</p>
      ) : (
        <div className="border rounded-xl divide-y">
          {fields.map(f => (
            <div key={f.id} className="flex items-center justify-between px-4 py-3" data-testid={`custom-field-${f.id}`}>
              <div>
                <span className="font-medium text-sm">{f.fieldLabel}</span>
                <span className="text-xs text-muted-foreground ml-2">({f.fieldName}) · {f.fieldType}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(f.id)} data-testid={`delete-custom-field-${f.id}`}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <FormDialogShell
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add Custom Field"
        subtitle="Create a new CRM custom field"
        saveLabel="Create"
        onCancel={() => setDialogOpen(false)}
        onSubmit={() => createMutation.mutate({ entityType, fieldName: fieldName || fieldLabel.toLowerCase().replace(/\s+/g, "_"), fieldLabel, fieldType })}
        saving={createMutation.isPending}
        disabled={!fieldLabel}
      >
            <div className="space-y-4 py-1">
              <div>
                <Label>Label</Label>
                <Input value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} data-testid="input-custom-field-label" />
              </div>
              <div>
                <Label>Field Name (API key)</Label>
                <Input value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="auto-generated from label" data-testid="input-custom-field-name" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={fieldType} onValueChange={setFieldType}>
                  <SelectTrigger data-testid="select-custom-field-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(fieldType === "dropdown" || fieldType === "multi-select") && (
                <div>
                  <Label>Options (one per line or comma-separated)</Label>
                  <Textarea
                    value={fieldOptions}
                    onChange={e => setFieldOptions(e.target.value)}
                    rows={4}
                    data-testid="input-custom-field-options"
                  />
                </div>
              )}
            </div>
      </FormDialogShell>
    </div>
  );
}
