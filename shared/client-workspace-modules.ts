/** Module keys always hidden when any user is inside a client workspace (Docs §5). */
export const CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS = new Set([
  "business-mgmt",
  "clients",
  "crm",
  "finance-mgmt",
  "customer-mgmt",
]);

/** Per-workspace configurable modules (Docs §5.2). */
export const CLIENT_WORKSPACE_CONFIGURABLE_KEYS = [
  { key: "resource-mgmt", label: "Resources", defaultVisible: false, locked: false },
  { key: "service-desk", label: "Service Desk", defaultVisible: false, locked: false },
  { key: "test-mgmt", label: "Test Management", defaultVisible: false, locked: false },
  { key: "bpm", label: "BPM", defaultVisible: false, locked: false },
] as const;

export type ClientWorkspaceConfigurableKey =
  (typeof CLIENT_WORKSPACE_CONFIGURABLE_KEYS)[number]["key"];

export const CLIENT_INDUSTRY_OPTIONS = [
  "Financial Services",
  "Healthcare",
  "Retail",
  "Manufacturing",
  "Technology",
  "Public Sector",
  "Energy",
  "Professional Services",
  "Education",
  "Other",
] as const;

export const CLIENT_PRESET_COLORS = [
  "#185FA5", "#0F6E56", "#993C1D", "#7C3AED",
  "#0EA5E9", "#EC4899", "#F97316", "#10B981",
  "#6366F1", "#EF4444", "#14B8A6", "#F59E0B",
  "#8B5CF6",
] as const;
