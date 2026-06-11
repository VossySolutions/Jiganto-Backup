import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseFieldOptions, normalizeMultiSelectValue, type CrmCustomFieldDef } from "@/lib/crm-custom-fields";
import { useCrmUsers } from "./CrmUsersProvider";

interface CrmCustomFieldsFormProps {
  entityType: "lead" | "opportunity" | "account" | "contact";
  values: Record<string, unknown>;
  onChange: (fieldName: string, value: unknown) => void;
}

export function CrmCustomFieldsForm({ entityType, values, onChange }: CrmCustomFieldsFormProps) {
  const { users, resolveOwner } = useCrmUsers();
  const { data: fields = [] } = useQuery<CrmCustomFieldDef[]>({
    queryKey: [`/api/crm/custom-fields?entityType=${entityType}`],
  });

  if (fields.length === 0) return null;

  return (
    <div className="space-y-3 pt-2 border-t" data-testid={`custom-fields-${entityType}`}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Fields</p>
      {fields.map(field => {
        const val = values[field.fieldName];
        const strVal = val != null ? String(val) : "";
        const options = parseFieldOptions(field.options);

        if (field.fieldType === "checkbox") {
          return (
            <div key={field.id} className="flex items-center gap-2">
              <Checkbox
                id={`cf-${field.fieldName}`}
                checked={!!val}
                onCheckedChange={checked => onChange(field.fieldName, !!checked)}
              />
              <Label htmlFor={`cf-${field.fieldName}`} className="text-sm font-normal">{field.fieldLabel}</Label>
            </div>
          );
        }

        if (field.fieldType === "dropdown") {
          return (
            <div key={field.id}>
              <Label className="text-sm">{field.fieldLabel}{field.isRequired ? " *" : ""}</Label>
              <Select value={strVal} onValueChange={v => onChange(field.fieldName, v)}>
                <SelectTrigger data-testid={`custom-field-${field.fieldName}`}><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {options.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (field.fieldType === "multi-select") {
          const selected = normalizeMultiSelectValue(val);
          return (
            <div key={field.id}>
              <Label className="text-sm">{field.fieldLabel}{field.isRequired ? " *" : ""}</Label>
              <div className="mt-1.5 space-y-1.5 border rounded-lg p-2.5 bg-muted/20" data-testid={`custom-field-${field.fieldName}`}>
                {options.map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <Checkbox
                      id={`cf-ms-${field.fieldName}-${opt}`}
                      checked={selected.includes(opt)}
                      onCheckedChange={checked => {
                        const next = checked
                          ? Array.from(new Set([...selected, opt]))
                          : selected.filter(s => s !== opt);
                        onChange(field.fieldName, next);
                      }}
                    />
                    <Label htmlFor={`cf-ms-${field.fieldName}-${opt}`} className="text-sm font-normal">{opt}</Label>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (field.fieldType === "person") {
          return (
            <div key={field.id}>
              <Label className="text-sm">{field.fieldLabel}{field.isRequired ? " *" : ""}</Label>
              <Select value={strVal || "none"} onValueChange={v => onChange(field.fieldName, v === "none" ? "" : v)}>
                <SelectTrigger data-testid={`custom-field-${field.fieldName}`}><SelectValue placeholder="Select person..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{resolveOwner(u.id).name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        return (
          <div key={field.id}>
            <Label className="text-sm">{field.fieldLabel}{field.isRequired ? " *" : ""}</Label>
            <Input
              type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : field.fieldType === "url" ? "url" : "text"}
              value={strVal}
              onChange={e => onChange(field.fieldName, e.target.value)}
              data-testid={`custom-field-${field.fieldName}`}
            />
          </div>
        );
      })}
    </div>
  );
}
