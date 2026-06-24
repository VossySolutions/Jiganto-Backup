import { parseFieldOptions, type CrmCustomFieldDef } from "@/lib/crm-custom-fields";

export const DEFAULT_REVENUE_SEGMENTS = ["Enterprise", "Mid-Market", "SMB"] as const;

export function findSegmentField(fields: CrmCustomFieldDef[]): CrmCustomFieldDef | undefined {
  return fields.find(
    (f) =>
      f.fieldName === "segment" ||
      f.fieldLabel.trim().toLowerCase() === "segment",
  );
}

export function getRevenueSegment(annualRevenue: string | null | undefined): string {
  const rev = parseFloat(annualRevenue || "0");
  if (rev >= 1_000_000) return "Enterprise";
  if (rev >= 100_000) return "Mid-Market";
  return "SMB";
}

export function resolveAccountSegment(
  account: { annualRevenue?: string | null; customData?: Record<string, unknown> | null },
  segmentField?: CrmCustomFieldDef,
): string {
  const key = segmentField?.fieldName ?? "segment";
  const customVal = account.customData?.[key];
  if (customVal != null && customVal !== "") return String(customVal);

  if (!segmentField && account.customData?.segment != null && account.customData.segment !== "") {
    return String(account.customData.segment);
  }

  return getRevenueSegment(account.annualRevenue);
}

export function segmentFilterOptions(
  segmentField: CrmCustomFieldDef | undefined,
  valuesInData: string[],
): string[] {
  if (segmentField && (segmentField.fieldType === "dropdown" || segmentField.fieldType === "multi-select")) {
    const configured = parseFieldOptions(segmentField.options);
    const merged = new Set([...configured, ...valuesInData.filter(Boolean)]);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }

  const merged = new Set([...DEFAULT_REVENUE_SEGMENTS, ...valuesInData.filter(Boolean)]);
  return Array.from(merged).sort((a, b) => a.localeCompare(b));
}

export function getSegmentColor(segment: string): string {
  switch (segment) {
    case "Enterprise":
      return "#8b5cf6";
    case "Mid-Market":
      return "#3b82f6";
    case "SMB":
      return "#6b7280";
    default:
      return "#0ea5e9";
  }
}

export function getSegmentPinColor(segment: string): string {
  switch (segment) {
    case "Enterprise":
      return "#0ea5e9";
    case "Mid-Market":
      return "#8b5cf6";
    default:
      return "#22c55e";
  }
}
