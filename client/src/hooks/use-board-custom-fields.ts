import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CrmCustomFieldDef } from "@/lib/crm-custom-fields";

export type BoardFieldValueRow = {
  id: number;
  entityType: string;
  entityId: string;
  fieldName: string;
  value: string | null;
};

export function boardCustomFieldsQueryKey(entityType: string) {
  return [`/api/crm/custom-fields?entityType=${entityType}`];
}

export function boardFieldValuesQueryKey(entityType: string) {
  return [`/api/board-field-values?entityType=${entityType}`];
}

/** Custom column definitions for any board entity (shares CRM custom-field storage). */
export function useBoardCustomFields(entityType: string) {
  const { data = [], isLoading } = useQuery<CrmCustomFieldDef[]>({
    queryKey: boardCustomFieldsQueryKey(entityType),
    enabled: !!entityType,
  });
  const fields = useMemo(
    () => [...data].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [data],
  );
  return { fields, isLoading };
}

/**
 * Per-row values for board custom columns, keyed `${entityId}:${fieldName}`.
 * Only used by boards whose rows don't already carry a `customData` blob.
 */
export function useBoardFieldValues(entityType: string, enabled = true) {
  const { data = [] } = useQuery<BoardFieldValueRow[]>({
    queryKey: boardFieldValuesQueryKey(entityType),
    enabled: enabled && !!entityType,
  });

  const map = useMemo(() => {
    const next = new Map<string, string | null>();
    for (const row of data) next.set(`${row.entityId}:${row.fieldName}`, row.value);
    return next;
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (input: {
      entityId: number | string;
      fieldName: string;
      value: unknown;
    }) =>
      apiRequest("PUT", "/api/board-field-values", {
        entityType,
        entityId: String(input.entityId),
        fieldName: input.fieldName,
        value:
          input.value == null
            ? null
            : typeof input.value === "boolean"
              ? input.value
                ? "true"
                : "false"
              : String(input.value),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardFieldValuesQueryKey(entityType) });
    },
  });

  const getValue = useCallback(
    (entityId: number | string, fieldName: string) =>
      map.get(`${entityId}:${fieldName}`) ?? null,
    [map],
  );

  const setValue = useCallback(
    (entityId: number | string, fieldName: string, value: unknown) =>
      saveMutation.mutateAsync({ entityId, fieldName, value }),
    [saveMutation],
  );

  return { getValue, setValue };
}
