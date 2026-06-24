export type CrmAccountTypeDef = {
  value: string;
  label: string;
  color: string;
  bg: string;
};

export const CRM_ACCOUNT_TYPES: CrmAccountTypeDef[] = [
  { value: "prospect", label: "Prospect", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  { value: "customer", label: "Active Customer", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  { value: "partner", label: "Partner", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  { value: "vendor", label: "Vendor", color: "#06b6d4", bg: "rgba(6,182,212,0.1)" },
  { value: "inactive", label: "Inactive", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  { value: "churned", label: "Churned", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
];

const TYPE_BY_VALUE = new Map(CRM_ACCOUNT_TYPES.map((t) => [t.value, t]));

export function getAccountTypeInfo(type: string): CrmAccountTypeDef {
  return TYPE_BY_VALUE.get(type) ?? {
    value: type,
    label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " "),
    color: "#6b7280",
    bg: "rgba(107,114,128,0.1)",
  };
}

/** Status options for filters — includes any types present in live data. */
export function accountTypeFilterOptions(existingTypes: string[] = []): CrmAccountTypeDef[] {
  const seen = new Set<string>();
  const result: CrmAccountTypeDef[] = [];
  for (const t of CRM_ACCOUNT_TYPES) {
    if (!seen.has(t.value)) {
      seen.add(t.value);
      result.push(t);
    }
  }
  for (const type of existingTypes) {
    if (!seen.has(type)) {
      seen.add(type);
      result.push(getAccountTypeInfo(type));
    }
  }
  return result;
}
