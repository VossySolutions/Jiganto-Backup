import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Download, Upload, Search, ArrowUpDown, Layers,
  ChevronDown, X, Trash2, Paintbrush, Bookmark, MoreHorizontal, Pencil
} from "lucide-react";
import { ImportModal, type ImportMode } from "@/components/ImportModal";
import { ConditionalFormattingPanel } from "@/components/ConditionalFormattingPanel";
import { evaluateConditionalFormatting, type ConditionalFormatRule } from "@/lib/conditionalFormatting";
import type { ColumnDef as MondayColumnDef } from "@/components/MondayTable";

type CrmAccount = {
  id: number;
  tenantId: number;
  parentAccountId: number | null;
  name: string;
  type: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  ownerUserId: string | null;
  description: string | null;
  annualRevenue: string | null;
  employeeCount: number | null;
  createdAt: string;
  updatedAt: string;
};

type CrmContact = {
  id: number;
  tenantId: number;
  accountId: number | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  role: string | null;
  createdAt: string;
};

interface CrmContactsTabProps {
  contacts: CrmContact[];
  accounts: CrmAccount[];
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
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [localSearch, setLocalSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "account" | "role" | "email" | "created">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "role" | "account">("none");
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [formatRules, setFormatRules] = useState<ConditionalFormatRule[]>([]);
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "", title: "", accountId: "", role: "contact",
  });
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: ({ rows, mode }: { rows: Record<string, string>[]; mode: ImportMode }) =>
      apiRequest("POST", "/api/crm/contacts/bulk-import", { rows, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Contacts imported successfully" });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("POST", "/api/crm/contacts", {
        ...data,
        accountId: data.accountId ? parseInt(data.accountId) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setIsOpen(false);
      setEditingId(null);
      setFormData({ firstName: "", lastName: "", email: "", phone: "", title: "", accountId: "", role: "contact" });
      toast({ title: "Contact created successfully" });
    },
    onError: () => toast({ title: "Failed to create contact", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/crm/contacts/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Contact updated" });
    },
    onError: () => toast({ title: "Failed to update contact", variant: "destructive" }),
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

  const resetForm = () => {
    setEditingId(null);
    setFormData({ firstName: "", lastName: "", email: "", phone: "", title: "", accountId: "", role: "contact" });
  };

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
    setEditingId(c.id);
    setFormData({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email || "",
      phone: c.phone || "",
      title: c.title || "",
      accountId: c.accountId ? String(c.accountId) : "",
      role: c.role || "contact",
    });
    setIsOpen(true);
  };

  const renderRow = (c: typeof enrichedContacts[0]) => {
    const color = getColorForName(c.fullName);
    const initials = getInitials(c.fullName);
    const roleInfo = getRoleInfo(c.role);

    return (
      <tr
        key={c.id}
        className={cn(
          "border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer",
          selectedIds.has(c.id) && "bg-blue-50/50 dark:bg-blue-950/20"
        )}
        data-testid={`contact-row-${c.id}`}
      >
        <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.has(c.id)}
            onCheckedChange={() => toggleSelectOne(c.id)}
            data-testid={`checkbox-contact-${c.id}`}
          />
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(c.id, "fullName"))} style={getCellStyle(c.id, "fullName")}>
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{c.fullName}</span>
              {c.title && <span className="text-xs text-muted-foreground">{c.title}</span>}
            </div>
          </div>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(c.id, "accountName"))} style={getCellStyle(c.id, "accountName")}>
          <span className="text-sm text-muted-foreground">{c.accountName || "—"}</span>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(c.id, "role"))} style={getCellStyle(c.id, "role")}>
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{ backgroundColor: roleInfo.bg, color: roleInfo.color }}
          >
            {roleInfo.label}
          </span>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(c.id, "email"))} style={getCellStyle(c.id, "email")}>
          <span className="text-sm text-muted-foreground">{c.email || "—"}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-muted-foreground">{c.phone || "—"}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-muted-foreground">
            {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()} data-testid={`button-actions-contact-${c.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(c)} data-testid={`action-edit-contact-${c.id}`}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteMutation.mutate(c.id)}
                className="text-red-600 focus:text-red-600"
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
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-total-contacts">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <ContactsIcon className="h-5 w-5" />
            Total Contacts
          </div>
          <div className="text-2xl font-bold" data-testid="text-total-contacts">{enrichedContacts.length}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-accounts-linked">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <AccountsIcon className="h-5 w-5" />
            Linked Accounts
          </div>
          <div className="text-2xl font-bold text-[#22c55e]" data-testid="text-accounts-linked">{uniqueAccounts.size}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-key-contacts">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <RolesIcon className="h-5 w-5" />
            Key Contacts
          </div>
          <div className="text-2xl font-bold text-[#8b5cf6]" data-testid="text-key-contacts">{primaryCount + roleCounts.decision_maker}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-recent-contacts">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <RecentIcon className="h-5 w-5" />
            Added (30d)
          </div>
          <div className="text-2xl font-bold text-[#f97316]" data-testid="text-recent-contacts">{recentCount}</div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl" data-testid="bulk-actions-contacts">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{selectedIds.size} selected</span>
          <button
            onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
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
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                groupBy !== "none"
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                  : "bg-background border-border text-foreground hover:bg-muted"
              )}
              data-testid="button-group-contacts"
            >
              <Layers className="h-3.5 w-3.5" />
              Group
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-contacts-none">None</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("role")} data-testid="group-contacts-role">Role</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("account")} data-testid="group-contacts-account">Account</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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

        <button
          onClick={() => toast({ title: "View saved", description: "Current filters and layout saved" })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          data-testid="button-save-view-contacts"
        >
          <Bookmark className="h-3.5 w-3.5" />
          Save View
        </button>

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white transition-colors"
              data-testid="button-add-contact"
            >
              <Plus className="h-4 w-4" />
              New Contact
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Contact" : "Create New Contact"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact-firstName">First Name *</Label>
                  <Input
                    id="contact-firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    data-testid="input-contact-firstName"
                  />
                </div>
                <div>
                  <Label htmlFor="contact-lastName">Last Name *</Label>
                  <Input
                    id="contact-lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    data-testid="input-contact-lastName"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact-email">Email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="input-contact-email"
                  />
                </div>
                <div>
                  <Label htmlFor="contact-phone">Phone</Label>
                  <Input
                    id="contact-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="input-contact-phone"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="contact-title">Title</Label>
                <Input
                  id="contact-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  data-testid="input-contact-title"
                />
              </div>
              <div>
                <Label htmlFor="contact-account">Account</Label>
                <Select value={formData.accountId} onValueChange={(v) => setFormData(prev => ({ ...prev, accountId: v }))}>
                  <SelectTrigger data-testid="select-contact-account">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id.toString()}>{account.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="contact-role">Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData(prev => ({ ...prev, role: v }))}>
                  <SelectTrigger data-testid="select-contact-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary Contact</SelectItem>
                    <SelectItem value="decision_maker">Decision Maker</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                onClick={() => {
                  if (editingId) {
                    updateMutation.mutate({
                      id: editingId,
                      updates: {
                        ...formData,
                        accountId: formData.accountId ? parseInt(formData.accountId) : null,
                      },
                    });
                    setIsOpen(false);
                    resetForm();
                  } else {
                    createMutation.mutate(formData);
                  }
                }}
                disabled={!formData.firstName || !formData.lastName || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-contact"
              >
                {editingId
                  ? (updateMutation.isPending ? "Updating..." : "Update Contact")
                  : (createMutation.isPending ? "Creating..." : "Create Contact")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden max-w-[95%]" data-testid="contacts-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all-contacts"
                  />
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("name")}>
                  Contact {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("account")}>
                  Account {sortField === "account" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("role")}>
                  Role {sortField === "role" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("email")}>
                  Email {sortField === "email" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                  Phone
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("created")}>
                  Created {sortField === "created" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Actions</th>
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
                        onClick={() => { resetForm(); setIsOpen(true); }}
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
                    <td colSpan={8} className="px-4 py-2">
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
                enrichedContacts.map(renderRow)
              )}
            </tbody>
          </table>
        </div>
        {enrichedContacts.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground" data-testid="contacts-count-footer">
            {enrichedContacts.length} of {contacts.length} contacts
            {selectedIds.size > 0 && <span className="ml-2 text-[#0ea5e9]">({selectedIds.size} selected)</span>}
          </div>
        )}
      </div>

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
