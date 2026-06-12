import { useState, useMemo } from "react";
import { useCrmPagination } from "@/hooks/use-crm-pagination";
import { CrmTablePagination } from "./CrmTablePagination";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Search, Mail, Phone, Plus, MoreHorizontal, Globe, MapPin, Users,
  Clock, AlertTriangle, ChevronRight, ExternalLink, Pencil, Trash2,
  MessageSquare, CalendarDays, FileText, Briefcase, Headphones
} from "lucide-react";
import { useCrmUsers } from "./CrmUsersProvider";
import { CrmOwnerSelect } from "./CrmOwnerSelect";

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

type CrmOpportunity = {
  id: number;
  tenantId: number;
  accountId: number | null;
  stageId: number | null;
  name: string;
  amount: string | null;
  probability: number | null;
  expectedCloseDate: string | null;
  ownerUserId: string | null;
  createdAt: string;
};

type CrmOpportunityStage = {
  id: number;
  name: string;
  order: number;
  probability: number | null;
  color: string | null;
  isClosed: boolean | null;
  isWon: boolean | null;
};

type CrmContract = {
  id: number;
  tenantId: number;
  accountId: number | null;
  name: string;
  type: string | null;
  status: string | null;
  value: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerUserId: string | null;
  createdAt: string;
};

type CrmLead = {
  id: number;
  tenantId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  company: string | null;
  source: string | null;
  status: string;
  score: number | null;
  convertedAccountId: number | null;
  createdAt: string;
};

type CrmActivity = {
  id: number;
  tenantId: number;
  type: string;
  subject: string;
  description: string | null;
  status: string | null;
  accountId: number | null;
  contactId: number | null;
  opportunityId: number | null;
  ownerUserId: string | null;
  createdAt: string;
};

type CrmNote = {
  id: number;
  tenantId: number;
  entityType: string;
  entityId: number;
  content: string;
  createdByUserId: string | null;
  createdAt: string;
};

interface Crm360ViewTabProps {
  accounts: CrmAccount[];
  contacts: CrmContact[];
  opportunities: CrmOpportunity[];
  stages: CrmOpportunityStage[];
  contracts: CrmContract[];
  leads: CrmLead[];
  searchTerm: string;
}

const VIBRANT_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#8b5cf6",
  "#ec4899", "#06b6d4", "#eab308", "#ef4444",
  "#14b8a6", "#6366f1",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return VIBRANT_COLORS[Math.abs(hash) % VIBRANT_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `£${Math.round(value / 1000)}K`;
  return `£${Math.round(value)}`;
}

function getRoleInfo(role: string | null): { label: string; color: string; bg: string } {
  switch (role) {
    case "primary": return { label: "Primary", color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
    case "decision_maker": return { label: "Decision Maker", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" };
    case "champion": return { label: "Champion", color: "#ec4899", bg: "rgba(236,72,153,0.1)" };
    case "technical": return { label: "Technical", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" };
    case "influencer": return { label: "Influencer", color: "#f97316", bg: "rgba(249,115,22,0.1)" };
    case "contact": return { label: "Contact", color: "#6b7280", bg: "rgba(107,114,128,0.1)" };
    default: return { label: role || "Contact", color: "#6b7280", bg: "rgba(107,114,128,0.1)" };
  }
}

function getTypeInfo(type: string): { label: string; color: string; bg: string } {
  switch (type) {
    case "enterprise": return { label: "Enterprise", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" };
    case "customer": return { label: "Customer", color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
    case "prospect": return { label: "Prospect", color: "#f97316", bg: "rgba(249,115,22,0.1)" };
    case "partner": return { label: "Partner", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" };
    default: return { label: type, color: "#6b7280", bg: "rgba(107,114,128,0.1)" };
  }
}

function getAccountHealth(
  opps: CrmOpportunity[],
  contacts: CrmContact[],
  activities: CrmActivity[],
  daysSinceTouch: number
): { score: number; label: string; color: string; segments: { label: string; value: number; color: string }[] } {
  let engagementScore = 0;
  if (activities.length >= 5) engagementScore = 100;
  else if (activities.length >= 3) engagementScore = 75;
  else if (activities.length >= 1) engagementScore = 50;
  else engagementScore = 10;

  let dealScore = 0;
  const openOpps = opps.filter(o => (o.probability ?? 0) > 0 && (o.probability ?? 0) < 100);
  if (openOpps.length > 0) {
    const avgProb = openOpps.reduce((s, o) => s + (o.probability ?? 0), 0) / openOpps.length;
    dealScore = Math.round(avgProb);
  }

  let contactScore = 0;
  if (contacts.length >= 3) contactScore = 100;
  else if (contacts.length >= 2) contactScore = 70;
  else if (contacts.length >= 1) contactScore = 40;

  let touchScore = daysSinceTouch <= 7 ? 100 : daysSinceTouch <= 14 ? 75 : daysSinceTouch <= 30 ? 50 : daysSinceTouch <= 60 ? 25 : 0;

  const overall = Math.round((engagementScore * 0.3 + dealScore * 0.3 + contactScore * 0.2 + touchScore * 0.2));

  let label = "At Risk";
  let color = "#ef4444";
  if (overall >= 75) { label = "Strong"; color = "#22c55e"; }
  else if (overall >= 50) { label = "Good"; color = "#3b82f6"; }
  else if (overall >= 30) { label = "Fair"; color = "#f97316"; }

  return {
    score: overall,
    label,
    color,
    segments: [
      { label: "Engagement", value: engagementScore, color: engagementScore >= 50 ? "#22c55e" : engagementScore >= 25 ? "#f97316" : "#ef4444" },
      { label: "Deal Momentum", value: dealScore, color: dealScore >= 50 ? "#22c55e" : dealScore >= 25 ? "#f97316" : "#ef4444" },
      { label: "Contacts", value: contactScore, color: contactScore >= 50 ? "#22c55e" : contactScore >= 25 ? "#f97316" : "#ef4444" },
      { label: "Recency", value: touchScore, color: touchScore >= 50 ? "#22c55e" : touchScore >= 25 ? "#f97316" : "#ef4444" },
    ],
  };
}

const SUB_TABS = [
  { value: "overview", label: "Overview" },
  { value: "leads", label: "Leads" },
  { value: "opportunities", label: "Opportunities" },
  { value: "pipeline", label: "Pipeline" },
  { value: "contracts", label: "Contracts" },
  { value: "contacts", label: "Contacts" },
  { value: "forecast", label: "Forecast" },
  { value: "notes", label: "Notes" },
  { value: "activities", label: "Activities" },
  { value: "projects", label: "Projects" },
  { value: "tasks", label: "Tasks" },
  { value: "tickets", label: "Tickets" },
  { value: "documents", label: "Documents" },
];

const SUB_TAB_COLORS: Record<string, string> = {
  overview: "#3b82f6", leads: "#ef4444", opportunities: "#f97316",
  pipeline: "#22c55e", contracts: "#8b5cf6", contacts: "#06b6d4",
  forecast: "#eab308", notes: "#ec4899", activities: "#14b8a6",
  projects: "#6366f1", tasks: "#f97316", tickets: "#ef4444", documents: "#06b6d4",
};

export function Crm360ViewTab({
  accounts, contacts, opportunities, stages, contracts, leads, searchTerm,
}: Crm360ViewTabProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem("crm-360-account-id");
    return saved ? parseInt(saved) : null;
  });

  const selectAccount = (id: number | null) => {
    setSelectedAccountId(id);
    if (id) sessionStorage.setItem("crm-360-account-id", String(id));
    else sessionStorage.removeItem("crm-360-account-id");
  };
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [subTab, setSubTab] = useState("overview");
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteTag, setNewNoteTag] = useState("");
  const [newNoteSentiment, setNewNoteSentiment] = useState("");
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountEditForm, setAccountEditForm] = useState({ name: "", type: "customer", industry: "", website: "", city: "", country: "", ownerUserId: "" });
  const { toast } = useToast();
  const { resolveOwner } = useCrmUsers();

  const sortedAccounts = useMemo(() => {
    let filtered = [...accounts];
    const search = sidebarSearch || searchTerm;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(a => a.name.toLowerCase().includes(s) || a.industry?.toLowerCase().includes(s));
    }
    return filtered.sort((a, b) => {
      const aRev = opportunities.filter(o => o.accountId === a.id).reduce((s, o) => s + parseFloat(o.amount || "0"), 0);
      const bRev = opportunities.filter(o => o.accountId === b.id).reduce((s, o) => s + parseFloat(o.amount || "0"), 0);
      return bRev - aRev;
    });
  }, [accounts, opportunities, sidebarSearch, searchTerm]);

  const selectedAccount = useMemo(() => {
    if (selectedAccountId) return accounts.find(a => a.id === selectedAccountId) || null;
    return sortedAccounts[0] || null;
  }, [selectedAccountId, accounts, sortedAccounts]);

  const accountContacts = useMemo(() =>
    selectedAccount ? contacts.filter(c => c.accountId === selectedAccount.id) : [],
    [contacts, selectedAccount]
  );

  const accountOpps = useMemo(() =>
    selectedAccount ? opportunities.filter(o => o.accountId === selectedAccount.id) : [],
    [opportunities, selectedAccount]
  );

  const oppsPagination = useTablePagination(accountOpps, {
    resetKey: `${selectedAccount?.id ?? 0}-${accountOpps.length}`,
  });

  const accountContracts = useMemo(() =>
    selectedAccount ? contracts.filter(c => c.accountId === selectedAccount.id) : [],
    [contracts, selectedAccount]
  );

  const accountLeads = useMemo(() => {
    if (!selectedAccount) return [];
    return leads.filter(l =>
      l.convertedAccountId === selectedAccount.id ||
      l.company?.toLowerCase() === selectedAccount.name.toLowerCase()
    );
  }, [leads, selectedAccount]);

  const { data: accountNotes = [] } = useQuery<CrmNote[]>({
    queryKey: selectedAccount
      ? [`/api/crm/notes?entityType=account&entityId=${selectedAccount.id}`]
      : ["/api/crm/notes?disabled=1"],
    enabled: !!selectedAccount,
  });

  const { data: accountActivities = [] } = useQuery<CrmActivity[]>({
    queryKey: selectedAccount
      ? [`/api/crm/activities?entityType=account&entityId=${selectedAccount.id}`]
      : ["/api/crm/activities?disabled=1"],
    enabled: !!selectedAccount,
  });

  const { data: accountProjects = [] } = useQuery<Array<{ id: number; name: string; status: string | null }>>({
    queryKey: ["/api/projects", "account", selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount) return [];
      const res = await fetchWithAuth("/api/projects");
      if (!res.ok) return [];
      const all = await res.json();
      const acctOpps = opportunities.filter(o => o.accountId === selectedAccount.id);
      const oppProjectIds = new Set(acctOpps.map(o => (o as CrmOpportunity & { projectId?: number }).projectId).filter(Boolean));
      return all.filter((p: { id: number }) => oppProjectIds.has(p.id));
    },
    enabled: !!selectedAccount,
  });

  const { data: accountTasks = [] } = useQuery<Array<{ id: number; subject: string; status: string | null; priority: string | null; dueDate: string | null; createdAt: string }>>({
    queryKey: selectedAccount
      ? [`/api/crm/tasks?accountId=${selectedAccount.id}`]
      : ["/api/crm/tasks?disabled=1"],
    enabled: !!selectedAccount,
  });

  const { data: accountTickets = [] } = useQuery<Array<{
    id: number;
    subject: string;
    status: string | null;
    priority: string | null;
    createdAt: string;
    dueDate: string | null;
    source: "task" | "activity";
  }>>({
    queryKey: selectedAccount
      ? [`/api/crm/accounts/${selectedAccount.id}/tickets`]
      : ["/api/crm/accounts/0/tickets?disabled=1"],
    enabled: !!selectedAccount,
  });

  const { data: accountDocuments = [] } = useQuery<Array<{
    id: number;
    title: string;
    type: string | null;
    status: string | null;
    updatedAt: string;
    ownerName: string | null;
  }>>({
    queryKey: selectedAccount
      ? [`/api/crm/accounts/${selectedAccount.id}/documents`]
      : ["/api/crm/accounts/0/documents?disabled=1"],
    enabled: !!selectedAccount,
  });

  const primaryContact = useMemo(() => {
    if (!accountContacts.length) return null;
    return accountContacts.find(c => c.role === "primary") || accountContacts[0];
  }, [accountContacts]);

  const contactEmail = primaryContact?.email || selectedAccount?.email || null;
  const contactPhone = primaryContact?.phone || selectedAccount?.phone || null;

  const logActivityMutation = useMutation({
    mutationFn: (data: { type: string; subject: string; contactId?: number | null }) =>
      apiRequest("POST", "/api/crm/activities", {
        type: data.type,
        subject: data.subject,
        accountId: selectedAccount?.id,
        contactId: data.contactId ?? primaryContact?.id ?? null,
        status: "completed",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities", "account", selectedAccount?.id] });
    },
  });

  const handleEmail = () => {
    if (!contactEmail) {
      toast({ title: "No email address", description: "Add an email to the account or a primary contact.", variant: "destructive" });
      return;
    }
    window.location.href = `mailto:${contactEmail}`;
    logActivityMutation.mutate({
      type: "email",
      subject: `Email to ${selectedAccount?.name}`,
      contactId: primaryContact?.id,
    });
    toast({ title: "Opening email client" });
  };

  const handleCall = () => {
    if (!contactPhone) {
      toast({ title: "No phone number", description: "Add a phone number to the account or a primary contact.", variant: "destructive" });
      return;
    }
    window.location.href = `tel:${contactPhone.replace(/\s/g, "")}`;
    logActivityMutation.mutate({
      type: "call",
      subject: `Call with ${selectedAccount?.name}`,
      contactId: primaryContact?.id,
    });
    toast({ title: "Initiating call" });
  };

  const updateAccountMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/crm/accounts/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      setEditingAccount(false);
      toast({ title: "Account updated" });
    },
    onError: () => toast({ title: "Failed to update account", variant: "destructive" }),
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: { content: string; tag?: string; sentiment?: string }) => {
      const noteContent = [
        data.content,
        data.tag ? `[TAG:${data.tag}]` : "",
        data.sentiment ? `[SENTIMENT:${data.sentiment}]` : "",
      ].filter(Boolean).join("\n");
      return apiRequest("POST", "/api/crm/notes", {
        entityType: "account",
        entityId: selectedAccount?.id,
        content: noteContent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notes", "account", selectedAccount?.id] });
      toast({ title: "Note added" });
      setNoteDialogOpen(false);
      setNewNoteContent("");
      setNewNoteTag("");
      setNewNoteSentiment("");
    },
    onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notes", "account", selectedAccount?.id] });
      toast({ title: "Note deleted" });
    },
  });

  const openOpps = accountOpps.filter(o => (o.probability ?? 0) > 0 && (o.probability ?? 0) < 100);
  const closedWonOpps = accountOpps.filter(o => {
    const stage = stages.find(s => s.id === o.stageId);
    return stage?.isWon;
  });
  const closedLostOpps = accountOpps.filter(o => {
    const stage = stages.find(s => s.id === o.stageId);
    return stage?.isClosed && !stage?.isWon;
  });

  const totalRevenue = accountOpps.reduce((s, o) => s + parseFloat(o.amount || "0"), 0);
  const openTotal = openOpps.reduce((s, o) => s + parseFloat(o.amount || "0"), 0);
  const wonTotal = closedWonOpps.reduce((s, o) => s + parseFloat(o.amount || "0"), 0);

  const daysSinceLastTouch = useMemo(() => {
    const allDates: Date[] = [];
    for (const a of accountActivities) allDates.push(new Date(a.createdAt));
    for (const n of accountNotes) allDates.push(new Date(n.createdAt));
    if (allDates.length === 0) {
      if (selectedAccount) allDates.push(new Date(selectedAccount.updatedAt));
    }
    if (allDates.length === 0) return 999;
    const latest = new Date(Math.max(...allDates.map(d => d.getTime())));
    return Math.floor((Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24));
  }, [accountActivities, accountNotes, selectedAccount]);

  const healthData = useMemo(() =>
    getAccountHealth(accountOpps, accountContacts, accountActivities, daysSinceLastTouch),
    [accountOpps, accountContacts, accountActivities, daysSinceLastTouch]
  );

  const customerSince = useMemo(() => {
    if (!selectedAccount) return null;
    const year = new Date(selectedAccount.createdAt).getFullYear();
    return year;
  }, [selectedAccount]);

  function parseNoteExtras(content: string): { text: string; tag?: string; sentiment?: string } {
    let text = content;
    let tag: string | undefined;
    let sentiment: string | undefined;
    const tagMatch = text.match(/\[TAG:([^\]]+)\]/);
    if (tagMatch) { tag = tagMatch[1]; text = text.replace(tagMatch[0], "").trim(); }
    const sentMatch = text.match(/\[SENTIMENT:([^\]]+)\]/);
    if (sentMatch) { sentiment = sentMatch[1]; text = text.replace(sentMatch[0], "").trim(); }
    return { text, tag, sentiment };
  }

  const sentimentColors: Record<string, { bg: string; color: string }> = {
    "Positive": { bg: "rgba(34,197,94,0.1)", color: "#22c55e" },
    "Neutral": { bg: "rgba(59,130,246,0.1)", color: "#3b82f6" },
    "Watch": { bg: "rgba(249,115,22,0.1)", color: "#f97316" },
    "Negative": { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
  };

  const tagColors: Record<string, { bg: string; color: string }> = {
    "QBR Meeting": { bg: "rgba(139,92,246,0.1)", color: "#8b5cf6" },
    "Discovery Call": { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
    "Follow-up": { bg: "rgba(59,130,246,0.1)", color: "#3b82f6" },
    "Renewal": { bg: "rgba(34,197,94,0.1)", color: "#22c55e" },
    "Escalation": { bg: "rgba(249,115,22,0.1)", color: "#f97316" },
    "General": { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
  };

  const activityTypeIcons: Record<string, { icon: typeof Mail; color: string }> = {
    "call": { icon: Phone, color: "#22c55e" },
    "email": { icon: Mail, color: "#3b82f6" },
    "meeting": { icon: CalendarDays, color: "#8b5cf6" },
    "task": { icon: FileText, color: "#f97316" },
    "note": { icon: MessageSquare, color: "#ec4899" },
  };

  if (!selectedAccount) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <div className="text-center">
          <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No accounts available</p>
          <p className="text-sm mt-1">Create accounts in the Customers tab to use the 360° View</p>
        </div>
      </div>
    );
  }

  const typeInfo = getTypeInfo(selectedAccount.type);

  const sidebarPagination = useCrmPagination(sortedAccounts, {
    resetKey: `${sidebarSearch}|${searchTerm}|${sortedAccounts.length}`,
  });

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-160px)] min-h-0" data-testid="crm-360-view">
      <div className="md:hidden p-3 border-b border-border/40 bg-card shrink-0">
        <Select
          value={selectedAccount?.id ? String(selectedAccount.id) : ""}
          onValueChange={(v) => { selectAccount(parseInt(v)); setSubTab("overview"); }}
        >
          <SelectTrigger className="w-full" data-testid="select-360-account-mobile">
            <SelectValue placeholder="Select customer" />
          </SelectTrigger>
          <SelectContent>
            {sortedAccounts.map(account => (
              <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="hidden md:flex w-[240px] border-r border-border/40 flex-col bg-white dark:bg-card shrink-0" data-testid="360-account-sidebar">
        <div className="p-3 border-b border-border/30">
          <h3 className="text-sm font-semibold mb-2">All Customers</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring/30"
              data-testid="input-360-sidebar-search"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto lg:overflow-y-auto overflow-x-auto lg:overflow-x-hidden min-h-0">
          {sidebarPagination.paginatedItems.map(account => {
            const color = getColorForName(account.name);
            const initials = getInitials(account.name);
            const accRevenue = opportunities.filter(o => o.accountId === account.id).reduce((s, o) => s + parseFloat(o.amount || "0"), 0);
            const isSelected = selectedAccount?.id === account.id;
            return (
              <button
                key={account.id}
                onClick={() => { selectAccount(account.id); setSubTab("overview"); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-l-3 transition-colors hover:bg-muted/40",
                  isSelected ? "bg-blue-50/50 dark:bg-blue-950/20 border-l-[#3b82f6]" : "border-l-transparent"
                )}
                data-testid={`360-account-${account.id}`}
              >
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{account.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {account.type} · {account.industry || "General"}
                  </div>
                </div>
                {accRevenue > 0 && (
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0">{formatCompact(accRevenue)}</span>
                )}
              </button>
            );
          })}
        </div>
        <CrmTablePagination
          page={sidebarPagination.page}
          totalPages={sidebarPagination.totalPages}
          total={sidebarPagination.total}
          startIndex={sidebarPagination.startIndex}
          endIndex={sidebarPagination.endIndex}
          pageSize={sidebarPagination.pageSize}
          onPageChange={sidebarPagination.setPage}
          onPageSizeChange={sidebarPagination.setPageSize}
          className="border-t border-border/30"
        />
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f8f9fc] dark:bg-background min-h-0 min-w-0">
        <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-4 bg-white dark:bg-card border-b border-border/30" data-testid="360-account-header">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0"
              style={{ backgroundColor: getColorForName(selectedAccount.name) }}
            >
              {getInitials(selectedAccount.name)}
            </div>
            <div className="flex-1 min-w-0">
              {editingAccount ? (
                <div className="space-y-3" data-testid="360-account-inline-edit">
                  <Input value={accountEditForm.name} onChange={e => setAccountEditForm(p => ({ ...p, name: e.target.value }))} className="text-lg font-bold h-10" data-testid="input-360-edit-name" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <Select value={accountEditForm.type} onValueChange={v => setAccountEditForm(p => ({ ...p, type: v }))}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-360-edit-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={accountEditForm.industry} onChange={e => setAccountEditForm(p => ({ ...p, industry: e.target.value }))} placeholder="Industry" className="h-8 text-xs" data-testid="input-360-edit-industry" />
                    <Input value={accountEditForm.website} onChange={e => setAccountEditForm(p => ({ ...p, website: e.target.value }))} placeholder="Website" className="h-8 text-xs" data-testid="input-360-edit-website" />
                    <Input value={accountEditForm.city} onChange={e => setAccountEditForm(p => ({ ...p, city: e.target.value }))} placeholder="City" className="h-8 text-xs" data-testid="input-360-edit-city" />
                    <Input value={accountEditForm.country} onChange={e => setAccountEditForm(p => ({ ...p, country: e.target.value }))} placeholder="Country" className="h-8 text-xs" data-testid="input-360-edit-country" />
                    <CrmOwnerSelect value={accountEditForm.ownerUserId} onChange={v => setAccountEditForm(p => ({ ...p, ownerUserId: v }))} testId="select-360-edit-owner" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateAccountMutation.mutate({ id: selectedAccount.id, updates: accountEditForm })} disabled={!accountEditForm.name.trim() || updateAccountMutation.isPending} data-testid="button-360-save-account">Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingAccount(false)} data-testid="button-360-cancel-edit">Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold" data-testid="text-360-account-name">{selectedAccount.name}</h2>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      {typeInfo.label}
                    </span>
                    {selectedAccount.website && (
                      <a href={selectedAccount.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        <Globe className="h-3.5 w-3.5" />
                        {selectedAccount.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                    {(selectedAccount.city || selectedAccount.country) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-red-400" />
                        {[selectedAccount.city, selectedAccount.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {selectedAccount.ownerUserId && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {resolveOwner(selectedAccount.ownerUserId).name}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {accountContacts.length} contacts
                    </span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: typeInfo.bg, color: typeInfo.color }}
                    >
                      {selectedAccount.type === "customer" ? "Active" : typeInfo.label}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
              {!editingAccount && (
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted transition-colors"
                  onClick={() => {
                    setAccountEditForm({
                      name: selectedAccount.name,
                      type: selectedAccount.type,
                      industry: selectedAccount.industry || "",
                      website: selectedAccount.website || "",
                      city: selectedAccount.city || "",
                      country: selectedAccount.country || "",
                      ownerUserId: selectedAccount.ownerUserId || "",
                    });
                    setEditingAccount(true);
                  }}
                  data-testid="button-360-edit-account"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              <button
                type="button"
                onClick={handleEmail}
                disabled={!contactEmail}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
                data-testid="button-360-email"
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </button>
              <button
                type="button"
                onClick={handleCall}
                disabled={!contactPhone}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
                data-testid="button-360-call"
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </button>
              <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white transition-colors" data-testid="button-360-add-note">
                    <Plus className="h-3.5 w-3.5" /> Add Note
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <SubmitForm
                    onSubmit={() => createNoteMutation.mutate({ content: newNoteContent, tag: newNoteTag, sentiment: newNoteSentiment })}
                    disabled={!newNoteContent.trim() || createNoteMutation.isPending}
                  >
                  <DialogHeader>
                    <DialogTitle>Add Note — {selectedAccount.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-3">
                    <div>
                      <Label>Note</Label>
                      <Textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Write your note..."
                        className="min-h-[120px]"
                        data-testid="input-360-note-content"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Tag</Label>
                        <Select value={newNoteTag} onValueChange={setNewNoteTag}>
                          <SelectTrigger data-testid="select-360-note-tag">
                            <SelectValue placeholder="Select tag..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="QBR Meeting">QBR Meeting</SelectItem>
                            <SelectItem value="Discovery Call">Discovery Call</SelectItem>
                            <SelectItem value="Follow-up">Follow-up</SelectItem>
                            <SelectItem value="Renewal">Renewal</SelectItem>
                            <SelectItem value="Escalation">Escalation</SelectItem>
                            <SelectItem value="General">General</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Sentiment</Label>
                        <Select value={newNoteSentiment} onValueChange={setNewNoteSentiment}>
                          <SelectTrigger data-testid="select-360-note-sentiment">
                            <SelectValue placeholder="Select sentiment..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Positive">Positive</SelectItem>
                            <SelectItem value="Neutral">Neutral</SelectItem>
                            <SelectItem value="Watch">Watch</SelectItem>
                            <SelectItem value="Negative">Negative</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button
                      type="submit"
                      disabled={!newNoteContent.trim() || createNoteMutation.isPending}
                      data-testid="button-save-360-note"
                    >
                      {createNoteMutation.isPending ? "Saving..." : "Save Note"}
                    </Button>
                  </DialogFooter>
                  </SubmitForm>
                </DialogContent>
              </Dialog>
              <button className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-background hover:bg-muted transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-end gap-10 mt-5">
            <div data-testid="kpi-total-revenue">
              <div className="text-2xl font-bold tracking-tight">{formatCompact(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Total Revenue</div>
            </div>
            <div data-testid="kpi-open-deals">
              <div className="text-2xl font-bold tracking-tight">{openOpps.length}</div>
              <div className="text-xs text-muted-foreground">Open Deals</div>
            </div>
            <div data-testid="kpi-contacts-count">
              <div className="text-2xl font-bold tracking-tight">{accountContacts.length}</div>
              <div className="text-xs text-muted-foreground">Contacts</div>
            </div>
            <div data-testid="kpi-customer-since">
              <div className="text-2xl font-bold tracking-tight">Since {customerSince}</div>
              <div className="text-xs text-muted-foreground">Customer Since</div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4" data-testid="health-score">
            <span className="text-xs text-muted-foreground">Health:</span>
            <div className="flex items-center gap-1">
              {healthData.segments.map((seg, i) => (
                <div key={i} className="w-6 h-2.5 rounded-sm" style={{ backgroundColor: seg.color }} title={`${seg.label}: ${seg.value}%`} />
              ))}
            </div>
            <span className="text-xs font-semibold" style={{ color: healthData.color }}>{healthData.label}</span>
            {daysSinceLastTouch > 14 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-orange-500 ml-2">
                <AlertTriangle className="h-3 w-3" />
                {daysSinceLastTouch}d since last touch
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 mt-4 border-t border-border/30 pt-3 overflow-x-auto scrollbar-none -mx-1 px-1" data-testid="360-sub-tabs">
            {SUB_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setSubTab(tab.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors relative shrink-0 whitespace-nowrap",
                  subTab === tab.value
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`360-subtab-${tab.value}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SUB_TAB_COLORS[tab.value] }} />
                  {tab.label}
                </span>
                {subTab === tab.value && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ backgroundColor: SUB_TAB_COLORS[tab.value] }} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 sm:p-6">
          {subTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-open-opps">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Open Opportunities</h3>
                    <button className="text-xs text-[#3b82f6] font-medium hover:underline" onClick={() => setSubTab("opportunities")}>+ Add</button>
                  </div>
                  {openOpps.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No open opportunities</p>
                  ) : (
                    <div className="space-y-3">
                      {openOpps.slice(0, 5).map(opp => {
                        const stage = stages.find(s => s.id === opp.stageId);
                        return (
                          <div key={opp.id} className="flex items-center justify-between" data-testid={`360-opp-${opp.id}`}>
                            <span className="text-sm font-medium">{opp.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: stage?.color ? `${stage.color}20` : "#ddd", color: stage?.color || "#666" }}>
                                {stage?.name || "Unknown"}
                              </span>
                              <span className="text-sm font-semibold">{formatCompact(parseFloat(opp.amount || "0"))}</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 border-t border-border/30 text-xs text-muted-foreground">
                        Total open: <span className="font-semibold text-foreground">{formatCompact(openTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-key-contacts">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Key Contacts</h3>
                    <button className="text-xs text-[#3b82f6] font-medium hover:underline" onClick={() => setSubTab("contacts")}>+ Add</button>
                  </div>
                  {accountContacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No contacts linked</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {accountContacts.slice(0, 6).map(contact => {
                        const name = `${contact.firstName} ${contact.lastName}`;
                        const color = getColorForName(name);
                        const roleInfo = getRoleInfo(contact.role);
                        return (
                          <div key={contact.id} className="flex items-center gap-2.5" data-testid={`360-contact-${contact.id}`}>
                            <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0" style={{ backgroundColor: color }}>
                              {getInitials(name)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">{name}</div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {contact.title || "—"} · <span style={{ color: roleInfo.color }}>{roleInfo.label}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-past-deals">
                  <h3 className="text-sm font-semibold mb-4">Past Deals</h3>
                  {(closedWonOpps.length + closedLostOpps.length) === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No closed deals</p>
                  ) : (
                    <div className="space-y-2.5">
                      {closedWonOpps.map(opp => (
                        <div key={opp.id} className="flex items-center justify-between" data-testid={`360-past-deal-${opp.id}`}>
                          <span className="text-sm">{opp.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-[#22c55e]">Won</span>
                            <span className="text-sm font-semibold">{formatCompact(parseFloat(opp.amount || "0"))}</span>
                          </div>
                        </div>
                      ))}
                      {closedLostOpps.map(opp => (
                        <div key={opp.id} className="flex items-center justify-between" data-testid={`360-past-deal-${opp.id}`}>
                          <span className="text-sm">{opp.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-[#ef4444]">Lost</span>
                            <span className="text-sm font-semibold">{formatCompact(parseFloat(opp.amount || "0"))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-revenue-forecast">
                  <h3 className="text-sm font-semibold mb-4">Revenue Forecast</h3>
                  {openOpps.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No forecast data</p>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const now = new Date();
                        const quarters: { label: string; value: number }[] = [];
                        for (let i = 0; i < 3; i++) {
                          const q = Math.ceil((now.getMonth() + 1) / 3) + i;
                          const year = now.getFullYear() + Math.floor((q - 1) / 4);
                          const actualQ = ((q - 1) % 4) + 1;
                          const qOpps = openOpps.filter(o => {
                            if (!o.expectedCloseDate) return i === 0;
                            const cd = new Date(o.expectedCloseDate);
                            const oQ = Math.ceil((cd.getMonth() + 1) / 3);
                            return oQ === actualQ && cd.getFullYear() === year;
                          });
                          const weighted = qOpps.reduce((s, o) => s + parseFloat(o.amount || "0") * ((o.probability ?? 0) / 100), 0);
                          quarters.push({ label: `Q${actualQ} ${year}`, value: weighted });
                        }
                        const maxVal = Math.max(...quarters.map(q => q.value), 1);
                        return quarters.map((q, i) => (
                          <div key={i} className="flex items-center gap-3" data-testid={`360-forecast-q-${i}`}>
                            <span className="text-xs text-muted-foreground w-16 shrink-0">{q.label}</span>
                            <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                              <div
                                className="h-full rounded transition-all"
                                style={{
                                  width: `${Math.max(5, (q.value / maxVal) * 100)}%`,
                                  backgroundColor: VIBRANT_COLORS[i % VIBRANT_COLORS.length],
                                }}
                              />
                            </div>
                            <span className="text-xs font-semibold w-14 text-right shrink-0">{formatCompact(q.value)}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {subTab === "leads" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-leads-tab">
              <h3 className="text-sm font-semibold mb-4">Leads from {selectedAccount.name}</h3>
              {accountLeads.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No leads associated with this account</p>
              ) : (
                <div className="space-y-2">
                  {accountLeads.map(lead => (
                    <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors" data-testid={`360-lead-${lead.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-[10px]" style={{ backgroundColor: getColorForName(`${lead.firstName} ${lead.lastName}`) }}>
                          {getInitials(`${lead.firstName} ${lead.lastName}`)}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{lead.firstName} {lead.lastName}</div>
                          <div className="text-[10px] text-muted-foreground">{lead.email} · {lead.source || "Unknown source"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", lead.status === "new" ? "bg-blue-100 text-blue-700" : lead.status === "converted" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700")}>
                          {lead.status}
                        </span>
                        {lead.score && <span className="text-xs font-medium">{lead.score}pts</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subTab === "opportunities" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-opps-tab">
              <h3 className="text-sm font-semibold mb-4">All Opportunities — {selectedAccount.name}</h3>
              {accountOpps.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No opportunities for this account</p>
              ) : (
                <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase px-3 py-2">Deal</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase px-3 py-2">Stage</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase px-3 py-2">Value</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase px-3 py-2">Prob</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase px-3 py-2">Close Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oppsPagination.paginatedItems.map(opp => {
                      const stage = stages.find(s => s.id === opp.stageId);
                      return (
                        <tr key={opp.id} className="border-b border-border/20 hover:bg-muted/20" data-testid={`360-opp-row-${opp.id}`}>
                          <td className="px-3 py-2.5 text-sm font-medium">{opp.name}</td>
                          <td className="px-3 py-2.5">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: stage?.color ? `${stage.color}20` : "#ddd", color: stage?.color || "#666" }}>
                              {stage?.name || "Unknown"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-sm font-semibold text-right">{formatCompact(parseFloat(opp.amount || "0"))}</td>
                          <td className="px-3 py-2.5 text-sm text-right text-muted-foreground">{opp.probability ?? 0}%</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <TablePagination
                  page={oppsPagination.page}
                  totalPages={oppsPagination.totalPages}
                  total={oppsPagination.total}
                  startIndex={oppsPagination.startIndex}
                  endIndex={oppsPagination.endIndex}
                  pageSize={oppsPagination.pageSize}
                  onPageChange={oppsPagination.setPage}
                  onPageSizeChange={oppsPagination.setPageSize}
                />
                </>
              )}
            </div>
          )}

          {subTab === "pipeline" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-pipeline-tab">
              <h3 className="text-sm font-semibold mb-4">Pipeline — {selectedAccount.name}</h3>
              {openOpps.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No active pipeline</p>
              ) : (
                <div className="space-y-3">
                  {stages.filter(s => !s.isClosed).sort((a, b) => a.order - b.order).map(stage => {
                    const stageOpps = openOpps.filter(o => o.stageId === stage.id);
                    if (stageOpps.length === 0) return null;
                    const stageVal = stageOpps.reduce((s, o) => s + parseFloat(o.amount || "0"), 0);
                    return (
                      <div key={stage.id} className="flex items-center gap-4" data-testid={`360-pipeline-stage-${stage.id}`}>
                        <div className="w-28 text-xs text-muted-foreground text-right shrink-0">{stage.name}</div>
                        <div className="flex-1 h-7 bg-muted/20 rounded overflow-hidden relative">
                          <div className="absolute inset-y-0 left-0 rounded flex items-center px-3" style={{ width: `${Math.max(15, (stageVal / openTotal) * 100)}%`, backgroundColor: stage.color || "#3b82f6" }}>
                            <span className="text-white text-[10px] font-medium whitespace-nowrap">{stageOpps.length} deal{stageOpps.length !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold w-14 text-right shrink-0">{formatCompact(stageVal)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {subTab === "contracts" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-contracts-tab">
              <h3 className="text-sm font-semibold mb-4">Contracts — {selectedAccount.name}</h3>
              {accountContracts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No contracts for this account</p>
              ) : (
                <div className="space-y-2">
                  {accountContracts.map(c => {
                    const statusColors: Record<string, { bg: string; color: string }> = {
                      active: { bg: "rgba(34,197,94,0.1)", color: "#22c55e" },
                      draft: { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
                      expired: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
                    };
                    const sc = statusColors[c.status || "draft"] || statusColors.draft;
                    return (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors" data-testid={`360-contract-${c.id}`}>
                        <div>
                          <div className="text-sm font-medium">{c.name}</div>
                          <div className="text-[10px] text-muted-foreground">{c.type || "General"} · {c.startDate ? new Date(c.startDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"} – {c.endDate ? new Date(c.endDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.color }}>{c.status || "draft"}</span>
                          <span className="text-sm font-semibold">{c.value ? formatCompact(parseFloat(c.value)) : "—"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {subTab === "contacts" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-contacts-tab">
              <h3 className="text-sm font-semibold mb-4">Contacts — {selectedAccount.name}</h3>
              {accountContacts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No contacts linked</p>
              ) : (
                <div className="space-y-2">
                  {accountContacts.map(contact => {
                    const name = `${contact.firstName} ${contact.lastName}`;
                    const color = getColorForName(name);
                    const roleInfo = getRoleInfo(contact.role);
                    return (
                      <div key={contact.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors" data-testid={`360-contact-row-${contact.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ backgroundColor: color }}>
                            {getInitials(name)}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{name}</div>
                            <div className="text-[10px] text-muted-foreground">{contact.title || "—"} · {contact.email || "—"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: roleInfo.bg, color: roleInfo.color }}>{roleInfo.label}</span>
                          {contact.phone && <span className="text-xs text-muted-foreground">{contact.phone}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {subTab === "forecast" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-forecast-tab">
              <h3 className="text-sm font-semibold mb-4">Revenue Forecast — {selectedAccount.name}</h3>
              {openOpps.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No open opportunities for forecast</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/20 rounded-lg p-4">
                      <div className="text-lg font-bold">{formatCompact(openTotal)}</div>
                      <div className="text-[10px] text-muted-foreground">Total Pipeline</div>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-4">
                      <div className="text-lg font-bold text-[#22c55e]">{formatCompact(openOpps.reduce((s, o) => s + parseFloat(o.amount || "0") * ((o.probability ?? 0) / 100), 0))}</div>
                      <div className="text-[10px] text-muted-foreground">Weighted Forecast</div>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-4">
                      <div className="text-lg font-bold text-[#3b82f6]">{Math.round(openOpps.reduce((s, o) => s + (o.probability ?? 0), 0) / openOpps.length)}%</div>
                      <div className="text-[10px] text-muted-foreground">Avg Probability</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const now = new Date();
                      const quarters: { label: string; value: number; weighted: number }[] = [];
                      for (let i = 0; i < 4; i++) {
                        const q = Math.ceil((now.getMonth() + 1) / 3) + i;
                        const year = now.getFullYear() + Math.floor((q - 1) / 4);
                        const actualQ = ((q - 1) % 4) + 1;
                        const qOpps = openOpps.filter(o => {
                          if (!o.expectedCloseDate) return i === 0;
                          const cd = new Date(o.expectedCloseDate);
                          return Math.ceil((cd.getMonth() + 1) / 3) === actualQ && cd.getFullYear() === year;
                        });
                        quarters.push({
                          label: `Q${actualQ} ${year}`,
                          value: qOpps.reduce((s, o) => s + parseFloat(o.amount || "0"), 0),
                          weighted: qOpps.reduce((s, o) => s + parseFloat(o.amount || "0") * ((o.probability ?? 0) / 100), 0),
                        });
                      }
                      const maxVal = Math.max(...quarters.map(q => q.value), 1);
                      return quarters.map((q, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">{q.label}</span>
                          <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden">
                            <div className="h-full rounded" style={{ width: `${Math.max(3, (q.value / maxVal) * 100)}%`, backgroundColor: VIBRANT_COLORS[i] }} />
                          </div>
                          <div className="flex gap-3 shrink-0">
                            <span className="text-[10px] text-muted-foreground w-14 text-right">{formatCompact(q.value)}</span>
                            <span className="text-xs font-semibold w-14 text-right">{formatCompact(q.weighted)}</span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {subTab === "notes" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-notes-tab">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Notes — {selectedAccount.name}</h3>
                <button
                  onClick={() => setNoteDialogOpen(true)}
                  className="text-xs text-[#3b82f6] font-medium hover:underline"
                  data-testid="button-360-add-note-inline"
                >
                  + Add Note
                </button>
              </div>
              {accountNotes.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground opacity-30 mb-2" />
                  <p className="text-xs text-muted-foreground">No notes yet</p>
                  <button
                    onClick={() => setNoteDialogOpen(true)}
                    className="text-xs text-[#3b82f6] font-medium mt-2 hover:underline"
                  >
                    Add the first note
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {accountNotes.map(note => {
                    const { text, tag, sentiment } = parseNoteExtras(note.content);
                    const authorName = note.createdByUserId || "Unknown";
                    const authorColor = getColorForName(authorName);
                    return (
                      <div key={note.id} className="flex gap-3 group" data-testid={`360-note-${note.id}`}>
                        <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0 mt-0.5" style={{ backgroundColor: authorColor }}>
                          {getInitials(authorName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold">{authorName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(note.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                            <button
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                              className="opacity-0 group-hover:opacity-100 ml-auto transition-opacity"
                              data-testid={`button-delete-note-${note.id}`}
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                            </button>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                          {(tag || sentiment) && (
                            <div className="flex items-center gap-2 mt-2">
                              {tag && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ backgroundColor: tagColors[tag]?.bg || "#f3f4f6", color: tagColors[tag]?.color || "#6b7280" }}>
                                  {tag}
                                </span>
                              )}
                              {sentiment && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ backgroundColor: sentimentColors[sentiment]?.bg || "#f3f4f6", color: sentimentColors[sentiment]?.color || "#6b7280" }}>
                                  {sentiment}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {subTab === "activities" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-activities-tab">
              <h3 className="text-sm font-semibold mb-4">Activities — {selectedAccount.name}</h3>
              {accountActivities.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground opacity-30 mb-2" />
                  <p className="text-xs text-muted-foreground">No activities logged yet</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[18px] top-4 bottom-4 w-px bg-border/40" />
                  <div className="space-y-4">
                    {accountActivities.map(activity => {
                      const typeInfo = activityTypeIcons[activity.type] || activityTypeIcons.note;
                      const IconComp = typeInfo.icon;
                      return (
                        <div key={activity.id} className="flex gap-3 relative" data-testid={`360-activity-${activity.id}`}>
                          <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-background" style={{ backgroundColor: `${typeInfo.color}15` }}>
                            <IconComp className="h-4 w-4" style={{ color: typeInfo.color }} />
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-semibold">{activity.subject}</span>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${typeInfo.color}15`, color: typeInfo.color }}>
                                {activity.type}
                              </span>
                              {activity.status && (
                                <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", activity.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                                  {activity.status}
                                </span>
                              )}
                            </div>
                            {activity.description && (
                              <p className="text-xs text-muted-foreground leading-relaxed">{activity.description}</p>
                            )}
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {new Date(activity.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              {activity.ownerUserId && <span className="ml-2">by {resolveOwner(activity.ownerUserId).name}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {subTab === "projects" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-projects-tab">
              <h3 className="text-sm font-semibold mb-4">Projects — {selectedAccount.name}</h3>
              {accountProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No linked projects</p>
              ) : (
                <div className="space-y-2">
                  {accountProjects.map(p => (
                    <div key={p.id} className="flex justify-between text-sm border-b border-border/30 pb-2">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.status || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subTab === "tasks" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-tasks-tab">
              <h3 className="text-sm font-semibold mb-4">Tasks — {selectedAccount.name}</h3>
              {accountTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No open tasks</p>
              ) : (
                <div className="space-y-2">
                  {accountTasks.map(t => (
                    <div key={t.id} className="flex justify-between text-sm border-b border-border/30 pb-2">
                      <span className="font-medium">{t.subject}</span>
                      <span className="text-xs text-muted-foreground">{t.status} {t.dueDate ? `· ${new Date(t.dueDate).toLocaleDateString()}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subTab === "tickets" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-tickets-tab">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Support Tickets — {selectedAccount.name}</h3>
                <a href="/modules/help-desk" className="text-xs text-[#0ea5e9] hover:underline">Open Help Desk</a>
              </div>
              {accountTickets.length === 0 ? (
                <div className="text-center py-8">
                  <Headphones className="h-8 w-8 mx-auto text-muted-foreground opacity-30 mb-2" />
                  <p className="text-xs text-muted-foreground">No support tickets linked to this account</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Ticket activities and open high-priority support tasks linked to this account</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {accountTickets.map(ticket => (
                    <div key={`${ticket.source}-${ticket.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border/30 hover:bg-muted/20" data-testid={`360-ticket-${ticket.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Headphones className="h-4 w-4 text-[#ef4444] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{ticket.subject}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(ticket.createdAt).toLocaleDateString()}
                            {ticket.dueDate && <span className="ml-1">· due {new Date(ticket.dueDate).toLocaleDateString()}</span>}
                            <span className="ml-1 text-muted-foreground">· {ticket.source === "task" ? "Help desk task" : "Ticket activity"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ticket.priority && (
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full",
                            ticket.priority === "high" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                          )}>{ticket.priority}</span>
                        )}
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">{ticket.status || "open"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subTab === "documents" && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-5 shadow-sm" data-testid="360-documents-tab">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Documents — {selectedAccount.name}</h3>
                <a href="/modules/documents" className="text-xs text-[#0ea5e9] hover:underline">Open Documents</a>
              </div>
              {accountDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground opacity-30 mb-2" />
                  <p className="text-xs text-muted-foreground">No documents in this account&apos;s workspace</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {accountDocuments.map(doc => (
                    <a
                      key={doc.id}
                      href={`/modules/documents?doc=${doc.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors"
                      data-testid={`360-document-${doc.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-[#06b6d4] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{doc.title}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {doc.type || "Document"} · {doc.ownerName || "Unknown owner"} · {new Date(doc.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted capitalize shrink-0">{doc.status || "draft"}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
