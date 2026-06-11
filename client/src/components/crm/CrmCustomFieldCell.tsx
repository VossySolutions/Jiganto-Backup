import { Badge } from "@/components/ui/badge";
import { formatCustomFieldDisplayValue, normalizeMultiSelectValue, type CrmCustomFieldDef } from "@/lib/crm-custom-fields";
import { useCrmUsers } from "./CrmUsersProvider";

interface CrmCustomFieldCellProps {
  field: CrmCustomFieldDef;
  value: unknown;
}

export function CrmCustomFieldCell({ field, value }: CrmCustomFieldCellProps) {
  const { resolveOwner } = useCrmUsers();

  if (field.fieldType === "multi-select") {
    const items = normalizeMultiSelectValue(value);
    if (!items.length) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="flex flex-wrap gap-1 max-w-[160px]">
        {items.map(item => (
          <Badge key={item} variant="secondary" className="text-[10px] font-normal">{item}</Badge>
        ))}
      </div>
    );
  }

  if (field.fieldType === "url" && typeof value === "string" && value) {
    return (
      <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-[#0ea5e9] hover:underline truncate max-w-[140px] inline-block">
        {value.replace(/^https?:\/\//, "")}
      </a>
    );
  }

  const text = formatCustomFieldDisplayValue(field, value, resolveOwner);
  return <span className="truncate max-w-[140px] inline-block">{text}</span>;
}
