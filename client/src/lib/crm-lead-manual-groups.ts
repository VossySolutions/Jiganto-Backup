export type ManualLeadGroup = {
  id: string;
  title: string;
  color: string;
  leadIds: number[];
};

const KEY = "crm-leads-manual-groups";

/** monday.com group accent colors */
const GROUP_COLORS = [
  "#579bfc",
  "#a25ddc",
  "#00c875",
  "#fdab3d",
  "#e2445c",
  "#ffcb00",
  "#037f4c",
];

const LEGACY_GROUP_CLASS =
  /^(bg-|border-l-|dark:)/;

function migrateGroupColor(color: string, index: number): string {
  if (!color || LEGACY_GROUP_CLASS.test(color) || color.includes(" ")) {
    return GROUP_COLORS[index % GROUP_COLORS.length];
  }
  return color;
}

export function loadManualLeadGroups(): ManualLeadGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ManualLeadGroup[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((g) => g && typeof g.id === "string" && Array.isArray(g.leadIds))
      .map((g, i) => ({
        ...g,
        color: migrateGroupColor(g.color, i),
      }));
  } catch {
    return [];
  }
}

export function saveManualLeadGroups(groups: ManualLeadGroup[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(groups));
}

export function createManualLeadGroup(title: string, leadIds: number[] = [], existingCount = 0): ManualLeadGroup {
  return {
    id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim() || `Group ${existingCount + 1}`,
    color: GROUP_COLORS[existingCount % GROUP_COLORS.length],
    leadIds: [...new Set(leadIds)],
  };
}

/** Remove lead IDs from every group, then add them to the target group. */
export function moveLeadsToGroup(
  groups: ManualLeadGroup[],
  groupId: string,
  leadIds: number[],
): ManualLeadGroup[] {
  const idSet = new Set(leadIds);
  return groups.map((g) => {
    const without = g.leadIds.filter((id) => !idSet.has(id));
    if (g.id === groupId) {
      return { ...g, leadIds: [...new Set([...without, ...leadIds])] };
    }
    return { ...g, leadIds: without };
  });
}

/** Remove lead IDs from all groups (send to Ungrouped). */
export function ungroupLeads(groups: ManualLeadGroup[], leadIds: number[]): ManualLeadGroup[] {
  const idSet = new Set(leadIds);
  return groups.map((g) => ({ ...g, leadIds: g.leadIds.filter((id) => !idSet.has(id)) }));
}

export function deleteManualGroup(groups: ManualLeadGroup[], groupId: string): ManualLeadGroup[] {
  return groups.filter((g) => g.id !== groupId);
}

export type LeadSortField = "date" | "score" | "name" | "status" | "company";
export type LeadSortRule = { field: LeadSortField; dir: "asc" | "desc" };

export const LEAD_SORT_FIELDS: { field: LeadSortField; label: string }[] = [
  { field: "date", label: "Created date" },
  { field: "score", label: "Score" },
  { field: "name", label: "Contact name" },
  { field: "company", label: "Company" },
  { field: "status", label: "Status" },
];

export function compareLeadsByRules<T extends {
  createdAt: string;
  score: number | null;
  firstName: string;
  lastName: string;
  company?: string | null;
  status: string;
}>(a: T, b: T, rules: LeadSortRule[]): number {
  for (const rule of rules) {
    const dir = rule.dir === "asc" ? 1 : -1;
    let cmp = 0;
    if (rule.field === "date") {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (rule.field === "score") {
      cmp = (a.score ?? 0) - (b.score ?? 0);
    } else if (rule.field === "name") {
      cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    } else if (rule.field === "company") {
      cmp = (a.company || `${a.firstName} ${a.lastName}`).localeCompare(b.company || `${b.firstName} ${b.lastName}`);
    } else if (rule.field === "status") {
      cmp = a.status.localeCompare(b.status);
    }
    if (cmp !== 0) return dir * cmp;
  }
  return 0;
}
