import { useQuery } from "@tanstack/react-query";
import type { CrmCustomFieldDef } from "@/lib/crm-custom-fields";

export type CrmCustomFieldEntityType = "lead" | "opportunity" | "account" | "contact";

export function useCrmCustomFields(entityType: CrmCustomFieldEntityType) {
  const { data: fields = [], isLoading } = useQuery<CrmCustomFieldDef[]>({
    queryKey: [`/api/crm/custom-fields?entityType=${entityType}`],
  });

  const sortedFields = [...fields].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return { fields: sortedFields, isLoading };
}
