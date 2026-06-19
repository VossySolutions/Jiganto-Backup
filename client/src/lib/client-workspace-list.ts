import type { ClientSortDir, ClientSortKey } from "@/components/clients/ClientTable";
import type { ClientWorkspace } from "@/components/clients/types";
import { userDisplayName } from "@/components/clients/types";

export type ClientListFilters = {
  tab: "active" | "archived" | "all";
  search: string;
  accountManagerId: string;
  engagementStatus: string;
  tag: string;
};

export function parseClientTags(tags?: string | null): string[] {
  return (tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function collectUniqueTags(clients: ClientWorkspace[]): string[] {
  const set = new Set<string>();
  for (const client of clients) {
    for (const tag of parseClientTags(client.tags)) {
      set.add(tag);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function filterClientWorkspaces(
  clients: ClientWorkspace[],
  filters: ClientListFilters,
): ClientWorkspace[] {
  const q = filters.search.trim().toLowerCase();

  return clients.filter((c) => {
    if (filters.tab === "active" && c.status !== "active") return false;
    if (
      filters.tab === "archived" &&
      c.status !== "archived" &&
      c.status !== "pending_delete"
    ) {
      return false;
    }

    if (filters.accountManagerId !== "all") {
      if (filters.accountManagerId === "__unassigned__") {
        if (c.accountManagerId) return false;
      } else if (c.accountManagerId !== filters.accountManagerId) {
        return false;
      }
    }

    if (filters.engagementStatus !== "all") {
      const status = (c.engagementStatus ?? c.status ?? "").toLowerCase();
      if (status !== filters.engagementStatus) return false;
    }

    if (filters.tag !== "all") {
      const tags = parseClientTags(c.tags).map((t) => t.toLowerCase());
      if (!tags.includes(filters.tag.toLowerCase())) return false;
    }

    if (q) {
      const haystack = [
        c.name,
        c.shortCode,
        c.industry ?? "",
        c.tags ?? "",
        userDisplayName(c.accountManagerUser),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function sortClientWorkspaces(
  clients: ClientWorkspace[],
  sortKey: ClientSortKey,
  sortDir: ClientSortDir,
): ClientWorkspace[] {
  const dir = sortDir === "asc" ? 1 : -1;

  const sorted = [...clients].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "industry":
        cmp = (a.industry ?? "").localeCompare(b.industry ?? "");
        break;
      case "engagementStatus":
        cmp = (a.engagementStatus ?? a.status ?? "").localeCompare(
          b.engagementStatus ?? b.status ?? "",
        );
        break;
      case "accountManager":
        cmp = userDisplayName(a.accountManagerUser).localeCompare(
          userDisplayName(b.accountManagerUser),
        );
        break;
      case "projects":
        cmp = (a.projectCount ?? 0) - (b.projectCount ?? 0);
        break;
      case "atRisk":
        cmp = (a.atRiskCount ?? 0) - (b.atRiskCount ?? 0);
        break;
    }
    return cmp * dir;
  });

  return sorted;
}
