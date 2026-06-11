import type { CrmCustomFieldDef } from "@/lib/crm-custom-fields";
import { CrmCustomFieldCell } from "./CrmCustomFieldCell";

const thClass = "text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap";
const tdClass = "px-4 py-3 whitespace-nowrap text-sm";

export function CrmCustomFieldTableHeaders({ fields }: { fields: CrmCustomFieldDef[] }) {
  if (!fields.length) return null;
  return (
    <>
      {fields.map(f => (
        <th key={f.id} className={thClass} data-testid={`custom-col-header-${f.fieldName}`}>
          {f.fieldLabel}
        </th>
      ))}
    </>
  );
}

export function CrmCustomFieldTableCells({
  fields,
  customData,
}: {
  fields: CrmCustomFieldDef[];
  customData?: Record<string, unknown> | null;
}) {
  if (!fields.length) return null;
  const data = customData && typeof customData === "object" ? customData : {};
  return (
    <>
      {fields.map(f => (
        <td key={f.id} className={tdClass} data-testid={`custom-col-cell-${f.fieldName}`}>
          <CrmCustomFieldCell field={f} value={data[f.fieldName]} />
        </td>
      ))}
    </>
  );
}
