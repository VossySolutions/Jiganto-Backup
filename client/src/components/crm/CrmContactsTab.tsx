import { useState, useMemo, useEffect } from "react";
import { useCrmPagination } from "@/hooks/use-crm-pagination";
import { CrmTablePagination } from "./CrmTablePagination";
import { SavedViewsDropdown, type FilterConfig, type SortConfig } from "./SavedViewsDropdown";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/ui/metric-card";
import { ContactFormDialog } from "./ContactFormDialog";
import {
  Plus,
  Download,
  Upload,
  Search,
  ArrowUpDown,
  Layers,
  X,
  Trash2,
  Paintbrush,
  MoreHorizontal,
  Pencil,
  Users,
  Maximize2,
  Minimize2
} from "lucide-react";
import { ImportModal, type ImportMode } from "@/components/ImportModal";
import { ConditionalFormattingPanel } from "@/components/ConditionalFormattingPanel";
import { evaluateConditionalFormatting, type ConditionalFormatRule } from "@/lib/conditionalFormatting";
import type { ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { ContactOrgChartView } from "@/components/crm/ContactOrgChartView";
import { ContactRelationshipsPanel } from "@/components/crm/ContactRelationshipsPanel";
import { CrmCustomFieldTableHeaders, CrmCustomFieldTableCells } from "./CrmCustomFieldTableCells";
import { useCrmCustomFields } from "@/hooks/use-crm-custom-fields";
import type { CrmAccountDetail, CrmContact } from "./types";
import { CrmColumnVisibilityMenu } from "./CrmColumnVisibilityMenu";
import { CrmInlineEditCell } from "./CrmInlineEditCell";
import { CrmInlineEditSelect } from "./CrmInlineEditSelect";
import { loadColumnVisibility, saveColumnVisibility, type CrmColumnDef } from "@/lib/crm-list-columns";

const CONTACT_ROLE_OPTIONS = [
  { value: "primary", label: "Primary" },
  { value: "decision_maker", label: "Decision Maker" },
  { value: "technical", label: "Technical" },
  { value: "champion", label: "Champion" },
  { value: "contact", label: "Contact" },
];

const CONTACT_TABLE_COLUMNS: CrmColumnDef[] = [
  { id: "account", label: "Account" },
  { id: "role", label: "Role" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "created", label: "Created" },
];

interface CrmContactsTabProps {
  contacts: CrmContact[];
  accounts: CrmAccountDetail[];
  searchTerm: string;
}

const VIBRANT_LOGO_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#8b5cf6",
  "#ec4899", "#06b6d4", "#eab308", "#ef4444",
  "#14b8a6", "#6366f1",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return VIBRANT_LOGO_COLORS[Math.abs(hash) % VIBRANT_LOGO_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function getRoleInfo(role: string | null): { label: string; color: string; bg: string } {
  switch (role) {
    case "primary": return { label: "Primary", color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
    case "decision_maker": return { label: "Decision Maker", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" };
    case "technical": return { label: "Technical", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" };
    case "contact": return { label: "Contact", color: "#6b7280", bg: "rgba(107,114,128,0.1)" };
    default: return { label: role || "Contact", color: "#6b7280", bg: "rgba(107,114,128,0.1)" };
  }
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

export function CrmContactsTab({ contacts, accounts, searchTerm }: CrmContactsTabProps) {
  const { fields: customFields } = useCrmCustomFields("contact");
  const tableColSpan = 8 + customFields.length;
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [localSearch, setLocalSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "account" | "role" | "email" | "created">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "role" | "account">("none");
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [formatRules, setFormatRules] = useState<ConditionalFormatRule[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [subView, setSubView] = useState<"list" | "orgchart">("list");
  const [orgChartAccountId, setOrgChartAccountId] = useState<number | null>(null);
  const [detailContactId, setDetailContactId] = useState<number | null>(null);
  const [listExpanded, setListExpanded] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    loadColumnVisibility("crm-contacts", CONTACT_TABLE_COLUMNS),
  );
  const { toast } = useToast();

  const isColVisible = (id: string) => columnVisibility[id] !== false;
  const setColVisible = (id: string, visible: boolean) => {
    setColumnVisibility((prev) => {
      const next = { ...prev, [id]: visible };
      saveColumnVisibility("crm-contacts", next);
      return next;
    });
  };

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
      setSelectedIds(new Set());
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

  const accountNames = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => {
      const acc = accounts.find(a => a.id === c.accountId);
      if (acc) set.add(acc.name);
    });
    return Array.from(set).sort();
  }, [contacts, accounts]);

  const enrichedContacts = useMemo(() => {
    let result = contacts.map(c => {
      const account = accounts.find(a => a.id === c.accountId);
      const fullName = `${c.firstName} ${c.lastName}`.trim();
      return {
        ...c,
        accountName: account?.name || "",
        fullName,
      };
    });

    const search = localSearch || searchTerm;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        c.fullName.toLowerCase().includes(s) ||
        c.accountName.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.title?.toLowerCase().includes(s)
      );
    }

    if (roleFilter !== "all") {
      result = result.filter(c => c.role === roleFilter);
    }

    if (accountFilter !== "all") {
      result = result.filter(c => c.accountName === accountFilter);
    }

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") return dir * a.fullName.localeCompare(b.fullName);
      if (sortField === "account") return dir * a.accountName.localeCompare(b.accountName);
      if (sortField === "role") return dir * (a.role || "").localeCompare(b.role || "");
      if (sortField === "email") return dir * (a.email || "").localeCompare(b.email || "");
      return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    return result;
  }, [contacts, accounts, localSearch, searchTerm, roleFilter, accountFilter, sortField, sortDir]);

  const accountSelectOptions = useMemo(
    () => accounts.map((a) => ({ value: String(a.id), label: a.name })),
    [accounts],
  );

  const pagination = useCrmPagination(enrichedContacts, {
    resetKey: `${localSearch}|${searchTerm}|${roleFilter}|${accountFilter}|${sortField}|${sortDir}|${groupBy}`,
    enabled: subView === "list" && groupBy === "none",
  });

  const currentFilters = useMemo((): FilterConfig[] => {
    const filters: FilterConfig[] = [];
    if (roleFilter !== "all") filters.push({ columnId: "role", operator: "equals", value: roleFilter });
    if (accountFilter !== "all") filters.push({ columnId: "account", operator: "equals", value: accountFilter });
    return filters;
  }, [roleFilter, accountFilter]);

  const currentSorts = useMemo((): SortConfig[] => (
    [{ columnId: sortField, direction: sortDir }]
  ), [sortField, sortDir]);

  const applySavedView = (filters: FilterConfig[], sorts?: SortConfig[]) => {
    setRoleFilter("all");
    setAccountFilter("all");
    for (const f of filters) {
      if (f.columnId === "role") setRoleFilter(f.value);
      if (f.columnId === "account") setAccountFilter(f.value);
    }
    if (sorts?.[0]) {
      setSortField(sorts[0].columnId as typeof sortField);
      setSortDir(sorts[0].direction);
    }
  };

  const formatColumns: MondayColumnDef<any>[] = [
    { id: "fullName", header: "Name", type: "text", accessor: "fullName" },
    { id: "title", header: "Title", type: "text", accessor: "title" },
    { id: "accountName", header: "Account", type: "text", accessor: "accountName" },
    { id: "role", header: "Role", type: "text", accessor: "role" },
    { id: "email", header: "Email", type: "text", accessor: "email" },
  ];

  const cellFormatMap = useMemo(() => {
    if (formatRules.length === 0) return {};
    return evaluateConditionalFormatting(enrichedContacts as any[], formatColumns, formatRules);
  }, [formatRules, enrichedContacts]);

  function getCellStyle(rowId: number | string, columnId: string): Record<string, string> {
    const rowFormat = cellFormatMap[rowId];
    if (!rowFormat) return {};
    const style: Record<string, string> = {};
    if (rowFormat.row) {
      if (rowFormat.row.bgColor) style.backgroundColor = rowFormat.row.bgColor;
      if (rowFormat.row.textColor) style.color = rowFormat.row.textColor;
    }
    const cellFormat = rowFormat.cells?.[columnId];
    if (cellFormat) {
      if (cellFormat.bgColor) style.backgroundColor = cellFormat.bgColor;
      if (cellFormat.textColor) style.color = cellFormat.textColor;
    }
    return style;
  }

  function getCellClasses(rowId: number | string, columnId: string): string {
    const rowFormat = cellFormatMap[rowId];
    if (!rowFormat) return "";
    const classes: string[] = [];
    if (rowFormat.row?.bold || rowFormat.cells?.[columnId]?.bold) classes.push("font-bold");
    if (rowFormat.row?.italic || rowFormat.cells?.[columnId]?.italic) classes.push("italic");
    return classes.join(" ");
  }

  const uniqueAccounts = new Set(enrichedContacts.filter(c => c.accountName).map(c => c.accountName));
  const primaryCount = contacts.filter(c => c.role === "primary").length;
  const recentCount = contacts.filter(c => {
    const d = new Date(c.createdAt);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
  }).length;

  const roleCounts = {
    all: contacts.length,
    primary: primaryCount,
    decision_maker: contacts.filter(c => c.role === "decision_maker").length,
    technical: contacts.filter(c => c.role === "technical").length,
    contact: contacts.filter(c => c.role === "contact" || !c.role).length,
  };

  const groupedData = useMemo(() => {
    if (groupBy === "none") return null;
    const groups: Record<string, typeof enrichedContacts> = {};
    for (const c of enrichedContacts) {
      let key: string;
      if (groupBy === "role") key = getRoleInfo(c.role).label;
      else key = c.accountName || "No Account";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return groups;
  }, [enrichedContacts, groupBy]);

  const groupColors: Record<string, string> = {
    "Primary": "#22c55e", "Decision Maker": "#8b5cf6", "Technical": "#3b82f6", "Contact": "#6b7280",
  };

  const allSelected = enrichedContacts.length > 0 && selectedIds.size === enrichedContacts.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(enrichedContacts.map(c => c.id)));
  };
  const toggleSelectOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const exportToCSV = () => {
    const headers = ["Name", "Title", "Account", "Role", "Email", "Phone", "Created"];
    const rows = enrichedContacts.map(c => [
      c.fullName, c.title || "", c.accountName,
      getRoleInfo(c.role).label, c.email || "", c.phone || "",
      new Date(c.createdAt).toISOString().split("T")[0],
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contacts-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Contacts exported to CSV" });
  };

  const handleEdit = (c: typeof enrichedContacts[0]) => {
    setEditingContact(c);
    setFormOpen(true);
  };

  const renderRow = (c: typeof enrichedContacts[0]) => {
    const color = getColorForName(c.fullName);
    const initials = getInitials(c.fullName);
    const roleInfo = getRoleInfo(c.role);

    return (
      <tr
        key={c.id}
        className={cn(
          "border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer",
          selectedIds.has(c.id) && "bg-blue-50/50 dark:bg-blue-950/20"
        )}
        data-testid={`contact-row-${c.id}`}
        onClick={() => setDetailContactId(c.id)}
      >
        <td className="px-3 py-2.5 align-middle w-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.has(c.id)}
            onCheckedChange={() => toggleSelectOne(c.id)}
            data-testid={`checkbox-contact-${c.id}`}
          />
        </td>
        <td className={cn("px-3 py-2.5 align-middle whitespace-nowrap", getCellClasses(c.id, "fullName"))} style={getCellStyle(c.id, "fullName")} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
            <div className="flex flex-col min-w-0">
              <CrmInlineEditCell
                value={c.fullName}
                onSave={(v) => {
                  const parts = v.trim().split(/\s+/);
                  const firstName = parts[0] || "";
                  const lastName = parts.slice(1).join(" ") || "";
                  updateContactMutation.mutate({ id: c.id, updates: { firstName, lastName } });
                }}
                className="text-sm font-semibold"
                testId={`inline-contact-name-${c.id}`}
              />
              {c.title && (
                <CrmInlineEditCell
                  value={c.title}
                  displayValue={c.title}
                  onSave={(v) => updateContactMutation.mutate({ id: c.id, updates: { title: v || null } })}
                  className="text-xs text-muted-foreground"
                  testId={`inline-contact-title-${c.id}`}
                />
              )}
            </div>
          </div>
        </td>
        {isColVisible("account") && (
        <td className={cn("px-3 py-2.5 align-middle whitespace-nowrap", getCellClasses(c.id, "accountName"))} style={getCellStyle(c.id, "accountName")} onClick={(e) => e.stopPropagation()}>
          <CrmInlineEditSelect
            value={c.accountId ? String(c.accountId) : ""}
            displayValue={<span className={cn("text-sm text-muted-foreground", listExpanded ? "whitespace-nowrap" : "truncate max-w-[180px] block")}>{c.accountName || "—"}</span>}
            options={accountSelectOptions}
            onSave={(v) => updateContactMutation.mutate({ id: c.id, updates: { accountId: v ? parseInt(v, 10) : null } })}
            testId={`inline-contact-account-${c.id}`}
          />
        </td>
        )}
        {isColVisible("role") && (
        <td className={cn("px-3 py-2.5 align-middle whitespace-nowrap", getCellClasses(c.id, "role"))} style={getCellStyle(c.id, "role")} onClick={(e) => e.stopPropagation()}>
          <CrmInlineEditSelect
            value={c.role || "contact"}
            displayValue={
              <span
                className="text-xs font-medium px-2 py-1 rounded-full"
                style={{ backgroundColor: roleInfo.bg, color: roleInfo.color }}
              >
                {roleInfo.label}
              </span>
            }
            options={CONTACT_ROLE_OPTIONS}
            onSave={(v) => updateContactMutation.mutate({ id: c.id, updates: { role: v } })}
            testId={`inline-contact-role-${c.id}`}
          />
        </td>
        )}
        {isColVisible("email") && (
        <td className={cn("px-3 py-2.5 align-middle", listExpanded ? "whitespace-nowrap" : "truncate max-w-[200px]", getCellClasses(c.id, "email"))} style={getCellStyle(c.id, "email")} onClick={(e) => e.stopPropagation()}>
          <CrmInlineEditCell
            value={c.email || ""}
            displayValue={c.email || "—"}
            onSave={(v) => updateContactMutation.mutate({ id: c.id, updates: { email: v || null } })}
            className="text-sm text-muted-foreground"
            testId={`inline-contact-email-${c.id}`}
          />
        </td>
        )}
        {isColVisible("phone") && (
        <td className={cn("px-3 py-2.5 align-middle", listExpanded ? "whitespace-nowrap" : "truncate max-w-[160px]")} onClick={(e) => e.stopPropagation()}>
          <CrmInlineEditCell
            value={c.phone || ""}
            displayValue={c.phone || "—"}
            onSave={(v) => updateContactMutation.mutate({ id: c.id, updates: { phone: v || null } })}
            className="text-sm text-muted-foreground"
            testId={`inline-contact-phone-${c.id}`}
          />
        </td>
        )}
        {isColVisible("created") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">
          <span className="text-sm text-muted-foreground">
            {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </td>
        )}
        <CrmCustomFieldTableCells fields={customFields} customData={c.customData} />
        <td className="px-3 py-2.5 align-middle text-right whitespace-nowrap">
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
                onClick={() => deleteMutation.mutate(c.id)}
                className="text-red-600 focus:text-red-700"
                data-testid={`action-delete-contact-${c.id}`}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Total Contacts" value={enrichedContacts.length} subtitle="Matching filters" helpText="All contacts visible in the list after search and filter rules." icon={ContactsIcon} testId="card-total-contacts" />
        <MetricCard title="Linked Accounts" value={uniqueAccounts.size} subtitle="Unique accounts" helpText="Number of distinct customer accounts linked to at least one contact." icon={AccountsIcon} borderColor="#22c55e" valueClassName="text-[#22c55e]" testId="card-accounts-linked" />
        <MetricCard title="Key Contacts" value={primaryCount + roleCounts.decision_maker} subtitle="Primary + decision maker" helpText="Contacts flagged as primary or decision maker on their account." icon={RolesIcon} borderColor="#8b5cf6" valueClassName="text-[#8b5cf6]" testId="card-key-contacts" />
        <MetricCard title="Added (30d)" value={recentCount} subtitle="New this month" helpText="Contacts created in the last 30 calendar days." icon={RecentIcon} borderColor="#f97316" valueClassName="text-[#f97316]" testId="card-recent-contacts" />
      </div>

      <div className="flex gap-2 items-center">
        <button onClick={() => setSubView("list")} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border", subView === "list" ? "bg-[#0ea5e9] text-white border-[#0ea5e9]" : "border-border")} data-testid="contacts-list-view">List</button>
        <button onClick={() => setSubView("orgchart")} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border", subView === "orgchart" ? "bg-[#0ea5e9] text-white border-[#0ea5e9]" : "border-border")} data-testid="contacts-orgchart-view">Org Chart</button>
        {subView === "list" && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5 text-xs"
            onClick={() => setListExpanded((v) => !v)}
            data-testid="button-contacts-maximize"
          >
            {listExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {listExpanded ? "Compact" : "Maximize"}
          </Button>
        )}
      </div>

      {subView === "orgchart" && accounts.length > 0 && orgChartAccountId != null && (
        <div className="border rounded-xl p-4 bg-card space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-xs font-semibold text-muted-foreground shrink-0">Account</Label>
            <Select value={String(orgChartAccountId)} onValueChange={(v) => setOrgChartAccountId(parseInt(v))}>
              <SelectTrigger className="w-64 h-8 text-xs" data-testid="select-orgchart-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
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
                  <p className="text-xs text-muted-foreground">{accounts.find(a => a.id === c.accountId)?.name || "No account"}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDetailContactId(null)}>Close</Button>
              </div>
            ) : null;
          })()}
          <ContactRelationshipsPanel contactId={detailContactId} contacts={contacts} accounts={accounts} embedded />
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl" data-testid="bulk-actions-contacts">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{selectedIds.size} selected</span>
          <button
            onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/60 transition-colors"
            data-testid="button-bulk-delete-contacts"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-background border border-border hover:bg-muted transition-colors"
            data-testid="button-clear-selection-contacts"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" data-testid="contacts-toolbar">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger
            className={cn(
              "h-9 w-auto min-w-[140px] rounded-lg text-sm font-medium border transition-colors gap-1.5",
              roleFilter !== "all"
                ? "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400"
                : "bg-background border-border text-foreground"
            )}
            data-testid="select-role-filter"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles ({roleCounts.all})</SelectItem>
            <SelectItem value="primary">Primary ({roleCounts.primary})</SelectItem>
            <SelectItem value="decision_maker">Decision Maker ({roleCounts.decision_maker})</SelectItem>
            <SelectItem value="technical">Technical ({roleCounts.technical})</SelectItem>
            <SelectItem value="contact">Contact ({roleCounts.contact})</SelectItem>
          </SelectContent>
        </Select>

        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger
            className={cn(
              "h-9 w-auto min-w-[140px] rounded-lg text-sm font-medium border transition-colors gap-1.5",
              accountFilter !== "all"
                ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                : "bg-background border-border text-foreground"
            )}
            data-testid="select-account-filter"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accountNames.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                sortField !== "name" || sortDir !== "asc"
                  ? "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400"
                  : "bg-background border-border text-foreground hover:bg-muted"
              )}
              data-testid="button-sort-contacts"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort: {sortField === "name" ? "Name" : sortField === "account" ? "Account" : sortField === "role" ? "Role" : sortField === "email" ? "Email" : "Created"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleSort("name")} data-testid="sort-contacts-name">Name</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("account")} data-testid="sort-contacts-account">Account</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("role")} data-testid="sort-contacts-role">Role</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("email")} data-testid="sort-contacts-email">Email</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("created")} data-testid="sort-contacts-created">Created</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors",
                groupBy !== "none"
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                  : "bg-background border-border text-foreground hover:bg-muted"
              )}
              title={groupBy === "none" ? "Group" : `Grouped by ${groupBy}`}
              aria-label={groupBy === "none" ? "Group contacts" : `Grouped by ${groupBy}`}
              data-testid="button-group-contacts"
            >
              <Layers className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-contacts-none">None</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("role")} data-testid="group-contacts-role">Role</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("account")} data-testid="group-contacts-account">Account</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <CrmColumnVisibilityMenu
          columns={CONTACT_TABLE_COLUMNS}
          visibility={columnVisibility}
          onChange={setColVisible}
          testId="button-contact-fields"
        />

        <button
          onClick={() => setFormatPanelOpen(true)}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            formatRules.length > 0
              ? "bg-[#8b5cf6]/10 border-[#8b5cf6]/30 text-[#8b5cf6]"
              : "bg-background border-border text-foreground hover:bg-muted"
          )}
          data-testid="button-format-contacts"
        >
          <Paintbrush className="h-3.5 w-3.5" />
          Format{formatRules.length > 0 ? ` (${formatRules.length})` : ""}
        </button>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 w-[200px]"
            data-testid="input-search-contacts"
          />
        </div>

        <button
          onClick={exportToCSV}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          data-testid="button-export-contacts"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>

        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          onClick={() => setImportOpen(true)}
          data-testid="button-import-contacts"
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </button>
        <ImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          entityName="Contacts"
          templateHeaders={["firstName","lastName","email","phone","mobile","title","department","role","accountName","notes"]}
          exampleRow={{ firstName:"John",lastName:"Doe",email:"john.doe@acme.com",phone:"+44 7700 900001",mobile:"+44 7911 234567",title:"Director",department:"Operations",role:"contact",accountName:"Acme Ltd",notes:"Key stakeholder" }}
          currentCount={contacts.length}
          onImport={async (rows, mode) => { await importMutation.mutateAsync({ rows, mode }); }}
        />

        <SavedViewsDropdown
          entityType="contacts"
          currentFilters={currentFilters}
          currentSorts={currentSorts}
          onApplyView={applySavedView}
        />

        {enrichedContacts.length > 0 && (
        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white transition-colors"
          onClick={openCreateForm}
          data-testid="button-add-contact"
        >
          <Plus className="h-4 w-4" />
          New Contact
        </button>
        )}

        <ContactFormDialog
          open={formOpen}
          onClose={closeForm}
          editing={editingContact}
          accounts={accounts}
          contacts={contacts}
        />
      </div>

      {subView === "list" && <div className={cn(
        "bg-white dark:bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden w-full",
        listExpanded && "fixed inset-4 z-50 flex flex-col",
      )} data-testid="contacts-table">
        {listExpanded && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
            <span className="text-sm font-semibold">Contacts — expanded list view</span>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setListExpanded(false)}>
              <Minimize2 className="h-3.5 w-3.5" />
              Compact
            </Button>
          </div>
        )}
        <div className={cn("overflow-x-auto", listExpanded && "flex-1 overflow-auto")}>
          <table className={cn("w-full text-sm text-gray-700 dark:text-foreground", listExpanded && "min-w-full")}>
            <thead>
              <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                <th className="px-3 py-2.5 align-middle w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all-contacts"
                  />
                </th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("name")}>
                  Contact {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                {isColVisible("account") && (
                <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("account")}>
                  Account {sortField === "account" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                )}
                {isColVisible("role") && (
                <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("role")}>
                  Role {sortField === "role" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                )}
                {isColVisible("email") && (
                <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("email")}>
                  Email {sortField === "email" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                )}
                {isColVisible("phone") && (
                <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">
                  Phone
                </th>
                )}
                {isColVisible("created") && (
                <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("created")}>
                  Created {sortField === "created" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                )}
                <CrmCustomFieldTableHeaders fields={customFields} />
                <th className="px-3 py-2.5 text-right align-middle font-semibold whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrichedContacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ContactsIcon className="h-10 w-10 opacity-30" />
                      <p className="text-sm">No contacts yet. Add contacts to track your relationships.</p>
                      <Button
                        size="sm"
                        className="mt-2 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
                        onClick={openCreateForm}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        New Contact
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : groupedData ? (
                Object.entries(groupedData).flatMap(([groupName, groupContacts]) => [
                  <tr key={`group-header-${groupName}`} className="bg-muted/40 border-b border-border/40" data-testid={`group-contacts-header-${groupName}`}>
                    <td colSpan={tableColSpan} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: groupColors[groupName] || getColorForName(groupName) }}
                        />
                        <span className="text-sm font-semibold">{groupName}</span>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          {groupContacts.length}
                        </Badge>
                      </div>
                    </td>
                  </tr>,
                  ...groupContacts.map(renderRow)
                ])
              ) : (
                pagination.paginatedItems.map(renderRow)
              )}
            </tbody>
          </table>
        </div>
        {groupBy !== "none" && enrichedContacts.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground" data-testid="contacts-count-footer">
            {enrichedContacts.length} of {contacts.length} contacts
            {selectedIds.size > 0 && <span className="ml-2 text-[#0ea5e9]">({selectedIds.size} selected)</span>}
          </div>
        )}
        {groupBy === "none" && (
          <CrmTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
            extra={selectedIds.size > 0 ? <span className="text-[#0ea5e9]">({selectedIds.size} selected)</span> : undefined}
          />
        )}
      </div>}

      <ConditionalFormattingPanel
        open={formatPanelOpen}
        onOpenChange={setFormatPanelOpen}
        rules={formatRules}
        onRulesChange={setFormatRules}
        columns={formatColumns}
        data={enrichedContacts as any[]}
      />
    </div>
  );
}
