import { useState, useMemo, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/ui/metric-card";
import { ContactFormDialog } from "./ContactFormDialog";
import {
  Trash2,
  MoreHorizontal,
  Pencil,
  Users,
  Maximize2,
  Minimize2,
  Network,
} from "lucide-react";
import { ImportModal, type ImportMode } from "@/components/ImportModal";
import { type ConditionalFormatRule } from "@/lib/conditionalFormatting";
import { type ColumnDef as MondayColumnDef, type StatusOption } from "@/components/MondayTable";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import {
  matchBoardFilterValue,
  type BoardFilterFieldDef,
  type BoardSortFieldDef,
} from "@/lib/board-filters";
import { type FilterConfig, type SortConfig } from "./SavedViewsDropdown";
import { ContactOrgChartView } from "@/components/crm/ContactOrgChartView";
import { ContactRelationshipsPanel } from "@/components/crm/ContactRelationshipsPanel";
import { useCrmCustomFields } from "@/hooks/use-crm-custom-fields";
import { useCrmUsers } from "./CrmUsersProvider";
import {
  useDebouncedValue,
  buildCrmCustomFieldColumns,
  recordToMondayGroups,
  downloadBoardCsv,
  downloadImportTemplateCsv,
} from "@/lib/crm-monday-chrome";
import type { CrmAccountDetail, CrmContact } from "./types";
import type { CrmColumnDef } from "@/lib/crm-list-columns";

const CONTACT_IMPORT_HEADERS = [
  "firstName", "lastName", "email", "phone", "mobile",
  "title", "department", "role", "accountName", "notes",
] as const;

const CONTACT_IMPORT_EXAMPLE: Record<string, string> = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@acme.com",
  phone: "+44 7700 900001",
  mobile: "+44 7911 234567",
  title: "Director",
  department: "Operations",
  role: "contact",
  accountName: "Acme Ltd",
  notes: "Key stakeholder",
};

const CONTACT_ROLE_OPTIONS: StatusOption[] = [
  { value: "primary", label: "Primary", color: "#22c55e" },
  { value: "decision_maker", label: "Decision Maker", color: "#8b5cf6" },
  { value: "technical", label: "Technical", color: "#3b82f6" },
  { value: "champion", label: "Champion", color: "#f97316" },
  { value: "contact", label: "Contact", color: "#6b7280" },
];

const CONTACT_TABLE_COLUMNS: CrmColumnDef[] = [
  { id: "account", label: "Account" },
  { id: "role", label: "Role" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "created", label: "Created" },
];

const CONTACT_FILTER_FIELDS: BoardFilterFieldDef[] = [
  { field: "name", label: "Name", textInput: true },
  { field: "role", label: "Role" },
  { field: "account", label: "Account", textInput: true },
  { field: "email", label: "Email", textInput: true },
  { field: "title", label: "Title", textInput: true },
  { field: "phone", label: "Phone", textInput: true },
  { field: "owner", label: "Owner" },
];

const CONTACT_SORT_FIELDS: BoardSortFieldDef[] = [
  { field: "name", label: "Name" },
  { field: "account", label: "Account" },
  { field: "role", label: "Role" },
  { field: "email", label: "Email" },
  { field: "created", label: "Created" },
];

interface CrmContactsTabProps {
  contacts: CrmContact[];
  accounts: CrmAccountDetail[];
  searchTerm: string;
}

type ContactRow = CrmContact & {
  ownerUserId?: string | null;
  mobile?: string | null;
  department?: string | null;
  notes?: string | null;
};

function getRoleInfo(role: string | null): { label: string; color: string; bg: string } {
  switch (role) {
    case "primary": return { label: "Primary", color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
    case "decision_maker": return { label: "Decision Maker", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" };
    case "technical": return { label: "Technical", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" };
    case "champion": return { label: "Champion", color: "#f97316", bg: "rgba(249,115,22,0.1)" };
    case "contact": return { label: "Contact", color: "#6b7280", bg: "rgba(107,114,128,0.1)" };
    default: return { label: role || "Contact", color: "#6b7280", bg: "rgba(107,114,128,0.1)" };
  }
}

function getColorForName(name: string): string {
  const colors = [
    "#3b82f6", "#22c55e", "#f97316", "#8b5cf6",
    "#ec4899", "#06b6d4", "#eab308", "#ef4444",
    "#14b8a6", "#6366f1",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function ContactsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="18" height="20" rx="2" fill="#3b82f6" opacity="0.12"/>
      <circle cx="12" cy="9" r="3.5" fill="#3b82f6" opacity="0.7"/>
      <path d="M6 19v-1a6 6 0 0 1 12 0v1" fill="#3b82f6" opacity="0.3"/>
      <line x1="1" y1="7" x2="3" y2="7" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1" y1="12" x2="3" y2="12" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1" y1="17" x2="3" y2="17" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function AccountsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="14" rx="2" fill="#22c55e" opacity="0.15"/>
      <rect x="7" y="2" width="10" height="6" rx="1" fill="#22c55e" opacity="0.4"/>
      <path d="M8 12h8M8 16h5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function RolesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="4" fill="#8b5cf6" opacity="0.6"/>
      <circle cx="16" cy="8" r="4" fill="#8b5cf6" opacity="0.4"/>
      <path d="M2 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" fill="#8b5cf6" opacity="0.2"/>
      <path d="M14 20v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2" fill="#8b5cf6" opacity="0.15"/>
    </svg>
  );
}

function RecentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#f97316" opacity="0.15"/>
      <circle cx="12" cy="12" r="7" fill="none" stroke="#f97316" strokeWidth="1.5"/>
      <path d="M12 8v4l3 2" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5 4l2 2M19 4l-2 2" stroke="#f97316" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function getContactFilterFieldValue(
  c: {
    fullName: string;
    accountName: string;
    role: string | null;
    email: string | null;
    title: string | null;
    phone: string | null;
    ownerUserId: string | null;
  },
  field: string,
): string {
  switch (field) {
    case "name":
      return c.fullName || "";
    case "account":
      return c.accountName || "";
    case "role":
      return c.role || "";
    case "email":
      return c.email || "";
    case "title":
      return c.title || "";
    case "phone":
      return c.phone || "";
    case "owner":
      return c.ownerUserId || "__unassigned__";
    default:
      return "";
  }
}

function compareContactsByRules<T extends {
  fullName: string;
  accountName: string;
  role: string | null;
  email: string | null;
  createdAt: string;
}>(a: T, b: T, rules: { field: string; dir: "asc" | "desc" }[]): number {
  for (const rule of rules) {
    const dir = rule.dir === "asc" ? 1 : -1;
    let cmp = 0;
    if (rule.field === "name") cmp = a.fullName.localeCompare(b.fullName);
    else if (rule.field === "account") cmp = a.accountName.localeCompare(b.accountName);
    else if (rule.field === "role") cmp = (a.role || "").localeCompare(b.role || "");
    else if (rule.field === "email") cmp = (a.email || "").localeCompare(b.email || "");
    else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (cmp !== 0) return dir * cmp;
  }
  return 0;
}

export function CrmContactsTab({ contacts, accounts, searchTerm }: CrmContactsTabProps) {
  const { users, resolveOwner } = useCrmUsers();
  const { fields: customFields } = useCrmCustomFields("contact");
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);
  const [formatRules, setFormatRules] = useState<ConditionalFormatRule[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [subView, setSubView] = useState<"list" | "orgchart">("list");
  const [orgChartAccountId, setOrgChartAccountId] = useState<number | null>(null);
  const [detailContactId, setDetailContactId] = useState<number | null>(null);
  const [listExpanded, setListExpanded] = useState(false);
  const { toast } = useToast();

  const shell = useMondayBoardShellState({
    storageKey: "jiganto-crm-contacts",
    columnDefs: CONTACT_TABLE_COLUMNS,
    defaultSortField: "name",
    defaultSortDir: "asc",
    defaultGroupBy: "none",
  });
  const {
    localSearch,
    setLocalSearch,
    filterRules,
    setFilterRules,
    filterOpen,
    setFilterOpen,
    sortRules,
    onSortToggle,
    onSortAdd,
    onSortRemove,
    groupBy,
    setGroupBy,
    ownerFilter,
    setOwnerFilter,
    viewMode,
    setViewModePersist,
    pinActive,
    togglePin,
    isColVisible,
    setColVisible,
    moveColumn,
    columnMenuItems,
    columnOrderIds,
    viewSnapshot,
    applyViewSnapshot,
  } = shell;
  const debouncedLocalSearch = useDebouncedValue(localSearch);

  useEffect(() => {
    if (accounts.length > 0 && orgChartAccountId == null) {
      setOrgChartAccountId(accounts[0].id);
    }
  }, [accounts, orgChartAccountId]);

  const importMutation = useMutation({
    mutationFn: ({ rows, mode }: { rows: Record<string, string>[]; mode: ImportMode }) =>
      apiRequest("POST", "/api/crm/contacts/bulk-import", { rows, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Contacts imported successfully" });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => apiRequest("POST", "/api/crm/contacts/bulk-delete", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Contacts deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete contacts", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Contact deleted" });
    },
    onError: () => toast({ title: "Failed to delete contact", variant: "destructive" }),
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<CrmContact> }) =>
      apiRequest("PUT", `/api/crm/contacts/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
    },
    onError: () => toast({ title: "Failed to update contact", variant: "destructive" }),
  });

  function openCreateForm() {
    setEditingContact(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingContact(null);
  }

  const personUsers = useMemo(
    () =>
      users.map((u) => {
        const o = resolveOwner(u.id);
        return { id: u.id, name: o.name, initials: o.initials, color: o.color };
      }),
    [users, resolveOwner],
  );

  const accountSelectOptions: StatusOption[] = useMemo(
    () => accounts.map((a) => ({ value: String(a.id), label: a.name, color: "#64748b" })),
    [accounts],
  );

  const enrichedContacts = useMemo(() => {
    let result = (contacts as ContactRow[]).map((c) => {
      const account = accounts.find((a) => a.id === c.accountId);
      const fullName = `${c.firstName} ${c.lastName}`.trim();
      return {
        ...c,
        accountName: account?.name || "",
        fullName,
        ownerUserId: c.ownerUserId ?? null,
      };
    });

    const search = searchTerm || debouncedLocalSearch;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.fullName.toLowerCase().includes(s) ||
          c.accountName.toLowerCase().includes(s) ||
          c.email?.toLowerCase().includes(s) ||
          c.title?.toLowerCase().includes(s),
      );
    }

    if (ownerFilter === "__unassigned__") {
      result = result.filter((c) => !c.ownerUserId);
    } else if (ownerFilter !== "all") {
      result = result.filter((c) => c.ownerUserId === ownerFilter);
    }

    for (const rule of filterRules) {
      if (
        (rule.operator === "is" ||
          rule.operator === "is_not" ||
          rule.operator === "contains" ||
          rule.operator === "not_contains" ||
          rule.operator === "gt" ||
          rule.operator === "lt") &&
        !rule.value
      ) {
        continue;
      }
      result = result.filter((c) => {
        const raw = getContactFilterFieldValue(c, rule.field);
        const forEmpty = rule.field === "owner" ? c.ownerUserId || "" : raw;
        const fieldVal =
          rule.operator === "is_empty" || rule.operator === "is_not_empty" ? forEmpty : raw;
        return matchBoardFilterValue(fieldVal, rule.operator, rule.value);
      });
    }

    return [...result].sort((a, b) => compareContactsByRules(a, b, sortRules));
  }, [
    contacts,
    accounts,
    debouncedLocalSearch,
    searchTerm,
    ownerFilter,
    filterRules,
    sortRules,
  ]);

  type EnrichedContact = (typeof enrichedContacts)[number];

  const uniqueAccounts = new Set(enrichedContacts.filter((c) => c.accountName).map((c) => c.accountName));
  const primaryCount = contacts.filter((c) => c.role === "primary").length;
  const recentCount = contacts.filter((c) => {
    const d = new Date(c.createdAt);
    const now = new Date();
    return now.getTime() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
  }).length;
  const decisionMakerCount = contacts.filter((c) => c.role === "decision_maker").length;

  const groupedData = useMemo(() => {
    if (groupBy === "none") return null;
    const groups: Record<string, EnrichedContact[]> = {};
    for (const c of enrichedContacts) {
      const key = groupBy === "role" ? getRoleInfo(c.role).label : c.accountName || "No Account";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return groups;
  }, [enrichedContacts, groupBy]);

  const groupColors: Record<string, string> = {
    Primary: "#22c55e",
    "Decision Maker": "#8b5cf6",
    Technical: "#3b82f6",
    Champion: "#f97316",
    Contact: "#6b7280",
  };

  const tableGroups = useMemo(() => {
    if (!groupedData) return undefined;
    const colors = { ...groupColors };
    for (const key of Object.keys(groupedData)) {
      if (!colors[key]) colors[key] = getColorForName(key);
    }
    return recordToMondayGroups(groupedData, colors);
  }, [groupedData]);

  const mondayColumns: MondayColumnDef<EnrichedContact>[] = useMemo(() => {
    const byId: Record<string, MondayColumnDef<EnrichedContact>> = {
      name: {
        id: "name",
        header: "Contact",
        type: "text",
        accessor: "fullName",
        width: "240px",
        sticky: pinActive,
        editable: true,
      },
      account: {
        id: "account",
        header: "Account",
        type: "select",
        accessor: (row) => (row.accountId != null ? String(row.accountId) : ""),
        width: "160px",
        hidden: !isColVisible("account"),
        editable: true,
        options: accountSelectOptions,
      },
      role: {
        id: "role",
        header: "Role",
        type: "status",
        accessor: (row) => row.role || "contact",
        width: "140px",
        hidden: !isColVisible("role"),
        editable: true,
        options: CONTACT_ROLE_OPTIONS,
      },
      email: {
        id: "email",
        header: "Email",
        type: "text",
        accessor: "email",
        width: "180px",
        hidden: !isColVisible("email"),
        editable: true,
      },
      phone: {
        id: "phone",
        header: "Phone",
        type: "text",
        accessor: "phone",
        width: "140px",
        hidden: !isColVisible("phone"),
        editable: true,
      },
      created: {
        id: "created",
        header: "Created",
        type: "date",
        accessor: "createdAt",
        width: "110px",
        hidden: !isColVisible("created"),
        editable: false,
      },
    };

    const order = ["name", ...(columnOrderIds.length ? columnOrderIds : CONTACT_TABLE_COLUMNS.map((c) => c.id))];
    const customCols = buildCrmCustomFieldColumns<EnrichedContact>(customFields, (id) => isColVisible(id), {
      editable: true,
    });
    for (const col of customCols) byId[col.id] = col;
    const seen = new Set<string>();
    const ordered: MondayColumnDef<EnrichedContact>[] = [];
    for (const id of order) {
      if (seen.has(id) || !byId[id]) continue;
      seen.add(id);
      ordered.push(byId[id]);
    }
    for (const id of Object.keys(byId)) {
      if (!seen.has(id)) ordered.push(byId[id]);
    }

    return ordered;
  }, [customFields, isColVisible, accountSelectOptions, pinActive, columnOrderIds]);

  const handleCellEdit = useCallback(
    (rowId: number | string, columnId: string, value: unknown) => {
      const id = typeof rowId === "string" ? Number(rowId) : rowId;
      const updates: Partial<CrmContact> & { customData?: Record<string, unknown> } = {};

      switch (columnId) {
        case "name": {
          const parts = String(value || "").trim().split(/\s+/);
          updates.firstName = parts[0] || "";
          updates.lastName = parts.slice(1).join(" ") || "";
          break;
        }
        case "account":
          updates.accountId = value ? parseInt(String(value), 10) : null;
          break;
        case "role":
          updates.role = String(value || "") || "contact";
          break;
        case "email":
          updates.email = value ? String(value) : null;
          break;
        case "phone":
          updates.phone = value ? String(value) : null;
          break;
        default: {
          if (columnId.startsWith("custom_")) {
            const fieldName = columnId.replace(/^custom_/, "");
            const field = customFields.find((f) => f.fieldName === fieldName);
            const contact = contacts.find((c) => c.id === id);
            const prev =
              contact?.customData && typeof contact.customData === "object"
                ? { ...contact.customData }
                : {};
            if (field?.fieldType === "number") {
              const n = value === "" || value == null ? null : Number(value);
              prev[fieldName] = Number.isFinite(n as number) ? n : null;
            } else {
              prev[fieldName] = value === "" || value == null ? null : String(value);
            }
            updates.customData = prev;
            break;
          }
          return;
        }
      }

      updateContactMutation.mutate({ id, updates });
    },
    [updateContactMutation, customFields, contacts],
  );

  const getFilterFieldOptions = useCallback(
    (field: string) => {
      switch (field) {
        case "role":
          return CONTACT_ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
        case "owner":
          return [
            { value: "__unassigned__", label: "Unassigned" },
            ...users.map((u) => ({ value: u.id, label: resolveOwner(u.id).name })),
          ];
        case "account":
          return Array.from(
            new Set(enrichedContacts.map((c) => c.accountName).filter(Boolean)),
          ).map((v) => ({ value: v, label: v }));
        default:
          return [];
      }
    },
    [users, resolveOwner, enrichedContacts],
  );

  const currentFilters = useMemo(
    (): FilterConfig[] =>
      filterRules.map((r) => ({
        columnId: r.field,
        operator: (r.operator === "contains" || r.operator === "not_contains"
          ? "contains"
          : r.operator === "gt"
            ? "greaterThan"
            : r.operator === "lt"
              ? "lessThan"
              : "equals") as FilterConfig["operator"],
        value: r.value,
      })),
    [filterRules],
  );

  const currentSorts = useMemo(
    (): SortConfig[] => sortRules.map((r) => ({ columnId: r.field, direction: r.dir })),
    [sortRules],
  );

  const applySavedView = (
    filters: FilterConfig[],
    sorts?: SortConfig[],
    _columns?: unknown,
    extras?: { viewMode?: string; groupBy?: string },
  ) => {
    const nextRules = filters.map((f, i) => ({
      id: `sv-${i}-${f.columnId}`,
      field: f.columnId,
      operator: (f.operator === "contains"
        ? "contains"
        : f.operator === "greaterThan"
          ? "gt"
          : f.operator === "lessThan"
            ? "lt"
            : "is") as "is" | "contains" | "gt" | "lt",
      value: f.value,
    }));
    setFilterRules(nextRules);
    if (sorts?.length) {
      applyViewSnapshot({
        ...viewSnapshot,
        filters: nextRules,
        sorts: sorts.map((s) => ({ field: s.columnId, dir: s.direction })),
        viewMode: extras?.viewMode || viewMode,
        groupBy: extras?.groupBy || groupBy,
      });
    }
    if (extras?.viewMode) setViewModePersist(extras.viewMode as typeof viewMode);
    if (extras?.groupBy) setGroupBy(extras.groupBy);
  };

  const exportToCSV = () => {
    const headers = [...CONTACT_IMPORT_HEADERS];
    const rows = enrichedContacts.map((c) =>
      headers.map((h) => {
        switch (h) {
          case "firstName": return c.firstName || "";
          case "lastName": return c.lastName || "";
          case "email": return c.email || "";
          case "phone": return c.phone || "";
          case "mobile": return c.mobile || "";
          case "title": return c.title || "";
          case "department": return c.department || "";
          case "role": return c.role || "";
          case "accountName": return c.accountName || "";
          case "notes": return c.notes || "";
          default: return "";
        }
      }),
    );
    downloadBoardCsv(`contacts-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast({ title: "Contacts exported to CSV", description: "File uses the same columns as Import." });
  };

  const downloadImportTemplate = () => {
    downloadImportTemplateCsv("contacts-import-template.csv", [...CONTACT_IMPORT_HEADERS], CONTACT_IMPORT_EXAMPLE);
    toast({ title: "Import template downloaded" });
  };

  const handleEdit = (c: EnrichedContact) => {
    setEditingContact(c);
    setFormOpen(true);
  };

  const groupContent = (
    <>
      <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-contacts-none">
        None
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("role")} data-testid="group-contacts-role">
        Role
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("account")} data-testid="group-contacts-account">
        Account
      </DropdownMenuItem>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Total Contacts" value={enrichedContacts.length} subtitle="Matching filters" helpText="All contacts visible in the list after search and filter rules." icon={ContactsIcon} testId="card-total-contacts" />
        <MetricCard title="Linked Accounts" value={uniqueAccounts.size} subtitle="Unique accounts" helpText="Number of distinct customer accounts linked to at least one contact." icon={AccountsIcon} borderColor="#22c55e" valueClassName="text-[#22c55e]" testId="card-accounts-linked" />
        <MetricCard title="Key Contacts" value={primaryCount + decisionMakerCount} subtitle="Primary + decision maker" helpText="Contacts flagged as primary or decision maker on their account." icon={RolesIcon} borderColor="#8b5cf6" valueClassName="text-[#8b5cf6]" testId="card-key-contacts" />
        <MetricCard title="Added (30d)" value={recentCount} subtitle="New this month" helpText="Contacts created in the last 30 calendar days." icon={RecentIcon} borderColor="#f97316" valueClassName="text-[#f97316]" testId="card-recent-contacts" />
      </div>

      {subView === "list" && (
        <div
          className={cn(
            listExpanded && "fixed inset-4 z-50 flex flex-col bg-background rounded-xl border border-border/40 shadow-lg overflow-hidden",
          )}
          data-testid="contacts-table"
        >
          {listExpanded && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
              <span className="text-sm font-semibold">Contacts — expanded list view</span>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setListExpanded(false)}>
                <Minimize2 className="h-3.5 w-3.5" />
                Compact
              </Button>
            </div>
          )}
          <div className={cn(listExpanded && "flex-1 min-h-0 overflow-auto")}>
            <MondayBoardShell<EnrichedContact>
              storageKey="jiganto-crm-contacts"
              entityType="contacts"
              customFieldEntityType="contact"
              ownsCustomColumns
              isColumnVisible={isColVisible}
              testId="contacts-board"
              viewSnapshot={viewSnapshot}
              onApplyViewSnapshot={applyViewSnapshot}
              mainTableSorts={[{ field: "name", dir: "asc" }]}
              newLabel="New Contact"
              onNew={openCreateForm}
              newTestId="button-add-contact"
              searchValue={localSearch}
              onSearchChange={setLocalSearch}
              searchTestId="input-search-contacts"
              personUsers={personUsers}
              personValue={ownerFilter}
              onPersonChange={setOwnerFilter}
              viewMode={viewMode}
              onViewModeChange={setViewModePersist}
              filterRules={filterRules}
              onFilterRulesChange={setFilterRules}
              filterFields={CONTACT_FILTER_FIELDS}
              getFilterFieldOptions={getFilterFieldOptions}
              filterOpen={filterOpen}
              onFilterOpenChange={setFilterOpen}
              sortRules={sortRules}
              sortFields={CONTACT_SORT_FIELDS}
              onSortToggle={onSortToggle}
              onSortAdd={onSortAdd}
              onSortRemove={onSortRemove}
              defaultSortField="name"
              groupContent={groupContent}
              groupActive={groupBy !== "none"}
              groupLabel={groupBy === "none" ? "Group by" : `Group by ${groupBy}`}
              grouped={groupBy !== "none"}
              afterGroupSlot={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs px-2.5"
                  onClick={() => setListExpanded((v) => !v)}
                  data-testid="button-contacts-maximize"
                >
                  {listExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  {listExpanded ? "Compact" : "Maximize"}
                </Button>
              }
              pinActive={pinActive}
              onPinToggle={togglePin}
              pinTitle={pinActive ? "Unpin Contact column" : "Pin Contact column"}
              columnMenuItems={columnMenuItems}
              onColumnVisible={setColVisible}
              onColumnMove={moveColumn}
              savedViewFilters={currentFilters}
              savedViewSorts={currentSorts}
              onApplySavedViewDropdown={applySavedView}
              onExport={exportToCSV}
              onDownloadTemplate={downloadImportTemplate}
              onPaste={() => setImportOpen(true)}
              onImport={() => setImportOpen(true)}
              moreMenuItems={
                <DropdownMenuItem onClick={() => setSubView("orgchart")} data-testid="contacts-orgchart-view">
                  <Network className="h-3.5 w-3.5 mr-2" />
                  Org Chart
                </DropdownMenuItem>
              }
              tableProps={{
                columns: mondayColumns,
                data: enrichedContacts,
                groups: tableGroups,
                conditionalFormatRules: formatRules,
                onConditionalFormatRulesChange: setFormatRules,
                emptyMessage: "No contacts yet. Add contacts to track your relationships.",
                addItemLabel: "New Contact",
                onAddItem: openCreateForm,
                onRowClick: (c) => setDetailContactId(c.id),
                onEditItem: handleEdit,
                onCellEdit: handleCellEdit,
                onDeleteItems: (ids) => {
                  const n = ids.length;
                  if (!window.confirm(n === 1 ? "Delete this contact?" : `Delete ${n} contacts?`)) return;
                  if (ids.length === 1) {
                    deleteMutation.mutate(Number(ids[0]));
                  } else {
                    bulkDeleteMutation.mutate(ids.map(Number));
                  }
                },
                searchHighlightTerm: searchTerm || debouncedLocalSearch,
                columnWidthStorageKey: "jiganto-crm-contacts-col-widths",
                paginationResetKey: `${searchTerm}|${debouncedLocalSearch}|${ownerFilter}|${JSON.stringify(filterRules)}|${JSON.stringify(sortRules)}|${groupBy}`,
                totalCount: contacts.length,
                className: cn(listExpanded && "border-0 rounded-none shadow-none"),
                renderRowActions: (c) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()} data-testid={`button-actions-contact-${c.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDetailContactId(c.id)} data-testid={`action-relationships-contact-${c.id}`}>
                        <Users className="h-3.5 w-3.5 mr-2" />
                        Manage relationships
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(c)} data-testid={`action-edit-contact-${c.id}`}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (!window.confirm("Delete this contact?")) return;
                          deleteMutation.mutate(c.id);
                        }}
                        className="text-red-600 focus:text-red-700"
                        data-testid={`action-delete-contact-${c.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              }}
            />
          </div>
        </div>
      )}

      {subView === "orgchart" && (
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/80 px-2 py-1.5 mb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] font-medium text-foreground hover:bg-muted">
                <Network className="h-3.5 w-3.5" />
                Org Chart
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => setSubView("list")} data-testid="contacts-list-view">List</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSubView("orgchart")} data-testid="contacts-orgchart-view">Org Chart</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        entityName="Contacts"
        templateHeaders={[...CONTACT_IMPORT_HEADERS]}
        exampleRow={{ ...CONTACT_IMPORT_EXAMPLE }}
        currentCount={contacts.length}
        onImport={async (rows, mode) => { await importMutation.mutateAsync({ rows, mode }); }}
      />

      <ContactFormDialog
        open={formOpen}
        onClose={closeForm}
        editing={editingContact}
        accounts={accounts}
        contacts={contacts}
      />

      {subView === "orgchart" && accounts.length > 0 && orgChartAccountId != null && (
        <div className="border rounded-xl p-4 bg-card space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-xs font-semibold text-muted-foreground shrink-0">Account</Label>
            <Select value={String(orgChartAccountId)} onValueChange={(v) => setOrgChartAccountId(parseInt(v))}>
              <SelectTrigger className="w-64 h-8 text-xs" data-testid="select-orgchart-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ContactOrgChartView accountId={orgChartAccountId} contacts={contacts} />
        </div>
      )}

      {detailContactId && (
        <div className="border rounded-xl p-4 bg-card space-y-3">
          {(() => {
            const c = contacts.find((x) => x.id === detailContactId);
            return c ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{c.firstName} {c.lastName}</p>
                  <p className="text-xs text-muted-foreground">{accounts.find((a) => a.id === c.accountId)?.name || "No account"}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDetailContactId(null)}>Close</Button>
              </div>
            ) : null;
          })()}
          <ContactRelationshipsPanel contactId={detailContactId} contacts={contacts} accounts={accounts} embedded />
        </div>
      )}
    </div>
  );
}
