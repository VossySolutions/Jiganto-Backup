import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { CRM_ACCOUNT_TYPES, getAccountTypeInfo } from "@/lib/crm-account-types";
import { cn } from "@/lib/utils";
import { LeadFormDialog } from "./LeadFormDialog";
import { AccountDetailFormOverlay } from "./AccountDetailFormOverlay";
import { ContactOrgChartView } from "./ContactOrgChartView";
import { ContactRelationshipsPanel } from "./ContactRelationshipsPanel";
import { useCrmUsers } from "./CrmUsersProvider";
import {
  Building2,
  Users,
  TrendingUp,
  Phone,
  Mail,
  Calendar,
  Plus,
  DollarSign,
  Clock,
  MessageSquare,
  CheckCircle2,
  X,
  Edit2,
  Activity,
  Loader2,
  ExternalLink,
  LayoutGrid,
  List,
  GitBranch,
  Inbox,
  Send,
  Maximize2,
  Minimize2,
  Wallet
} from "lucide-react";
import type {
  CrmAccountDetail,
  CrmContactDetail,
  CrmOpportunityDetail,
  CrmActivityRecord,
  CrmNoteRecord,
  CrmTask,
  CrmOpportunityStageSummary,
  CrmEmailLog,
} from "./types";

const CRM_DETAIL_STALE_MS = 30_000;

type CorrespondenceItem = {
  id: string;
  source: "log" | "activity";
  subject: string;
  body: string | null;
  recipientOrFrom: string | null;
  status: string | null;
  date: Date;
};

interface AccountDetailPanelProps {
  account: CrmAccountDetail;
  onClose: () => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

type ContactsViewMode = "list" | "cards" | "hierarchy";

function getInitials(first: string, last: string): string {
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase();
}

export function AccountDetailPanel({ account, onClose, expanded = false, onToggleExpanded }: AccountDetailPanelProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [contactsView, setContactsView] = useState<ContactsViewMode>("list");
  const [contactsExpanded, setContactsExpanded] = useState(false);
  const [selectedContactForRelationships, setSelectedContactForRelationships] = useState<number | null>(null);
  const [contactFormData, setContactFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", title: "" });
  const [activityFormData, setActivityFormData] = useState({ type: "call", subject: "", description: "", dueDate: "" });
  const [editFormData, setEditFormData] = useState({
    name: account.name,
    type: account.type,
    industry: account.industry || "",
    website: account.website || "",
    phone: account.phone || "",
    email: account.email || "",
    address: account.address || "",
    city: account.city || "",
    state: account.state || "",
    country: account.country || "",
    annualRevenue: account.annualRevenue || "",
    employeeCount: account.employeeCount?.toString() || "",
    description: account.description || "",
  });
  const { toast } = useToast();
  const { resolveOwner } = useCrmUsers();

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<CrmContactDetail[]>({
    queryKey: [`/api/crm/contacts?accountId=${account.id}`],
    staleTime: CRM_DETAIL_STALE_MS,
  });

  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery<CrmOpportunityDetail[]>({
    queryKey: [`/api/crm/opportunities?accountId=${account.id}`],
    staleTime: CRM_DETAIL_STALE_MS,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<CrmActivityRecord[]>({
    queryKey: [`/api/crm/activities?accountId=${account.id}`],
    staleTime: CRM_DETAIL_STALE_MS,
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<CrmNoteRecord[]>({
    queryKey: [`/api/crm/notes?entityType=account&entityId=${account.id}`],
    staleTime: CRM_DETAIL_STALE_MS,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<CrmTask[]>({
    queryKey: [`/api/crm/tasks?accountId=${account.id}`],
    staleTime: CRM_DETAIL_STALE_MS,
  });

  const { data: stages = [] } = useQuery<CrmOpportunityStageSummary[]>({
    queryKey: ["/api/crm/stages"],
    staleTime: CRM_DETAIL_STALE_MS,
  });

  const { data: emailLogs = [], isLoading: emailLogsLoading } = useQuery<CrmEmailLog[]>({
    queryKey: [`/api/crm/email-logs?accountId=${account.id}`],
    staleTime: CRM_DETAIL_STALE_MS,
  });

  const createContactMutation = useMutation({
    mutationFn: (data: typeof contactFormData) => 
      apiRequest("POST", "/api/crm/contacts", { ...data, accountId: account.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts?accountId=${account.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setIsAddContactOpen(false);
      setContactFormData({ firstName: "", lastName: "", email: "", phone: "", title: "" });
      toast({ title: "Contact added successfully" });
    },
    onError: () => toast({ title: "Failed to add contact", variant: "destructive" }),
  });

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/crm/notes", { entityType: "account", entityId: account.id, content });
      return res.json() as Promise<CrmNoteRecord>;
    },
    onSuccess: (note) => {
      const key = [`/api/crm/notes?entityType=account&entityId=${account.id}`];
      queryClient.setQueryData<CrmNoteRecord[]>(key, (prev) => {
        const list = prev ?? [];
        if (list.some((n) => n.id === note.id)) return list;
        return [note, ...list];
      });
      setIsAddNoteOpen(false);
      setNoteContent("");
      toast({ title: "Note added successfully" });
    },
    onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const createActivityMutation = useMutation({
    mutationFn: (data: typeof activityFormData) => 
      apiRequest("POST", "/api/crm/activities", { ...data, accountId: account.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/activities?accountId=${account.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      setIsAddActivityOpen(false);
      setActivityFormData({ type: "call", subject: "", description: "", dueDate: "" });
      toast({ title: "Activity logged successfully" });
    },
    onError: () => toast({ title: "Failed to log activity", variant: "destructive" }),
  });

  const updateAccountMutation = useMutation({
    mutationFn: (data: typeof editFormData) => 
      apiRequest("PUT", `/api/crm/accounts/${account.id}`, {
        ...data,
        annualRevenue: data.annualRevenue || null,
        employeeCount: data.employeeCount ? parseInt(data.employeeCount) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      setIsEditMode(false);
      toast({ title: "Account updated successfully" });
    },
    onError: () => toast({ title: "Failed to update account", variant: "destructive" }),
  });

  const totalOpportunityValue = opportunities.reduce((sum, opp) => sum + parseFloat(opp.amount || "0"), 0);
  const openOpportunities = opportunities.filter(opp => {
    const stage = stages.find(s => s.id === opp.stageId);
    return !stage?.isClosed;
  });
  const wonOpportunities = opportunities.filter(opp => {
    const stage = stages.find(s => s.id === opp.stageId);
    return stage?.isWon;
  });

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'call': return Phone;
      case 'email': return Mail;
      case 'meeting': return Calendar;
      default: return Activity;
    }
  };

  const allTimelineItems = [
    ...activities.map(a => ({ ...a, itemType: 'activity' as const, date: new Date(a.createdAt) })),
    ...notes.map(n => ({ ...n, itemType: 'note' as const, date: new Date(n.createdAt) })),
    ...tasks.map(t => ({ ...t, itemType: 'task' as const, date: new Date(t.createdAt) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const getTimelineTitle = (item: (typeof allTimelineItems)[number]) => {
    if (item.itemType === "activity") return (item as CrmActivityRecord).subject;
    if (item.itemType === "note") {
      const preview = (item as CrmNoteRecord).content.trim().split("\n")[0];
      return preview
        ? `Note: ${preview.length > 100 ? `${preview.slice(0, 100)}…` : preview}`
        : "Note added";
    }
    return (item as CrmTask).subject;
  };

  const getTimelineAuthor = (item: (typeof allTimelineItems)[number]) => {
    if (item.itemType === "note") {
      const note = item as CrmNoteRecord;
      return note.createdByUserId ? resolveOwner(note.createdByUserId).name : "Unknown user";
    }
    if (item.itemType === "activity") {
      const act = item as CrmActivityRecord;
      return act.ownerUserId ? resolveOwner(act.ownerUserId).name : "Unknown user";
    }
    return null;
  };

  const correspondenceItems = useMemo<CorrespondenceItem[]>(() => {
    const logItems: CorrespondenceItem[] = emailLogs.map((log) => ({
      id: `log-${log.id}`,
      source: "log",
      subject: log.subject,
      body: log.body ?? null,
      recipientOrFrom: log.recipientEmail,
      status: log.status,
      date: new Date(log.sentAt),
    }));
    const activityEmails: CorrespondenceItem[] = activities
      .filter((a) => a.type === "email")
      .map((a) => ({
        id: `activity-${a.id}`,
        source: "activity",
        subject: a.subject,
        body: a.description,
        recipientOrFrom: null,
        status: a.status,
        date: new Date(a.createdAt),
      }));
    return [...logItems, ...activityEmails].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [emailLogs, activities]);

  const typeInfo = getAccountTypeInfo(account.type);

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-[#f8f9fc] dark:bg-background" data-testid="account-detail-panel">
      <div className="shrink-0 bg-gradient-to-br from-[#0ea5e9]/10 via-violet-500/5 to-background border-b border-border/50 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={onClose} data-testid="button-close-detail">
              <X className="h-5 w-5" />
            </Button>
            <div
              className="h-12 w-12 rounded-[14px] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md"
              style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}
            >
              {getInitials(account.name.split(" ")[0] || account.name, account.name.split(" ")[1] || "")}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight truncate" data-testid="account-detail-name">{account.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-sm">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: typeInfo.bg, color: typeInfo.color }}
                >
                  {typeInfo.label}
                </span>
                {account.industry && (
                  <span className="text-muted-foreground">{account.industry}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {onToggleExpanded && (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleExpanded}
                data-testid="button-panel-maximize"
              >
                {expanded ? <Minimize2 className="h-4 w-4 mr-1" /> : <Maximize2 className="h-4 w-4 mr-1" />}
                {expanded ? "Compact" : "Maximize"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsAddLeadOpen(true)} data-testid="button-add-lead-from-account">
              <Plus className="h-4 w-4 mr-1" />
              Lead
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsAddContactOpen(true)} data-testid="button-add-contact-quick">
              <Plus className="h-4 w-4 mr-1" />
              Contact
            </Button>
            <Button size="sm" className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90" onClick={() => setIsEditMode(true)} data-testid="button-edit-account">
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b border-border/40 px-4 bg-background/80 overflow-x-auto">
            <TabsList className="h-11 bg-transparent border-0 gap-1 p-0 w-max min-w-full">
              <TabsTrigger value="overview" className="gap-2 rounded-lg data-[state=active]:bg-[#0ea5e9]/10 data-[state=active]:text-[#0ea5e9] data-[state=active]:shadow-none border border-transparent data-[state=active]:border-[#0ea5e9]/20" data-testid="detail-tab-overview">
                <Building2 className="h-3.5 w-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="contacts" className="gap-2 rounded-lg data-[state=active]:bg-primary/10" data-testid="detail-tab-contacts">
                <Users className="h-3.5 w-3.5" />
                Contacts
                <Badge variant="secondary" className="text-xs ml-1">{contacts.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="opportunities" className="gap-2 rounded-lg data-[state=active]:bg-primary/10" data-testid="detail-tab-opportunities">
                <TrendingUp className="h-3.5 w-3.5" />
                Opportunities
                <Badge variant="secondary" className="text-xs ml-1">{opportunities.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="activities" className="gap-2 rounded-lg data-[state=active]:bg-primary/10" data-testid="detail-tab-activities">
                <Activity className="h-3.5 w-3.5" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 shrink-0" data-testid="detail-tab-notes">
                <MessageSquare className="h-3.5 w-3.5" />
                Notes
                <Badge variant="secondary" className="text-xs ml-1">{notes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="correspondence" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 shrink-0" data-testid="detail-tab-correspondence">
                <Inbox className="h-3.5 w-3.5" />
                Correspondence
                {correspondenceItems.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">{correspondenceItems.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value="overview" className="p-6 m-0 space-y-6">
              <div className="space-y-6 max-w-3xl">
                  <Card className="rounded-xl border-border/40 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Account Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="font-medium capitalize truncate">{account.type}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Industry</p>
                        <p className="font-medium truncate">{account.industry || "—"}</p>
                      </div>
                      <div className="min-w-0 sm:col-span-2">
                        <p className="text-xs text-muted-foreground">Website</p>
                        {account.website ? (
                          <a href={account.website} target="_blank" rel="noopener noreferrer" className="font-medium text-primary flex items-center gap-1 hover:underline truncate">
                            <span className="truncate">{account.website}</span> <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : <p className="font-medium">—</p>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium truncate">{account.phone || "—"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium truncate">{account.email || "—"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Annual Revenue</p>
                        <p className="font-medium">{account.annualRevenue ? `$${parseFloat(account.annualRevenue).toLocaleString()}` : "—"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Employees</p>
                        <p className="font-medium">{account.employeeCount?.toLocaleString() || "—"}</p>
                      </div>
                      <div className="min-w-0 sm:col-span-2">
                        <p className="text-xs text-muted-foreground">Location</p>
                        <p className="font-medium break-words">
                          {[account.address, account.city, account.state, account.country].filter(Boolean).join(", ") || "—"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {account.description && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Description</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{account.description}</p>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Key Contacts</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("contacts")}>
                        View All
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {contactsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : contacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No contacts yet</p>
                      ) : (
                        <div className="space-y-3">
                          {contacts.slice(0, 3).map(contact => (
                            <div key={contact.id} className="flex items-center gap-3 p-2 rounded-lg hover-elevate">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                                {contact.firstName[0]}{contact.lastName[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{contact.firstName} {contact.lastName}</p>
                                <p className="text-xs text-muted-foreground truncate">{contact.title || contact.email || "—"}</p>
                              </div>
                              {contact.isPrimary && (
                                <Badge variant="secondary" className="text-xs">Primary</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        Pipeline Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-2xl font-bold">${totalOpportunityValue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total pipeline value</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-status-blue-foreground">{openOpportunities.length}</p>
                        <p className="text-xs text-muted-foreground">Open deals</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-status-green-foreground">{wonOpportunities.length}</p>
                        <p className="text-xs text-muted-foreground">Won deals</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Recent Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {activitiesLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : allTimelineItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                      ) : (
                        <div className="space-y-4">
                          {allTimelineItems.slice(0, 5).map((item, idx) => {
                            const author = getTimelineAuthor(item);
                            return (
                            <div key={`${item.itemType}-${idx}`} className="flex items-start gap-3 text-sm">
                              <div className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                                item.itemType === 'activity' && "bg-status-blue/10 text-status-blue-foreground",
                                item.itemType === 'note' && "bg-status-amber/10 text-status-amber-foreground",
                                item.itemType === 'task' && "bg-status-purple/10 text-status-purple-foreground",
                              )}>
                                {item.itemType === 'activity' && <Activity className="h-4 w-4" />}
                                {item.itemType === 'note' && <MessageSquare className="h-4 w-4" />}
                                {item.itemType === 'task' && <CheckCircle2 className="h-4 w-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium leading-snug break-words">
                                  {getTimelineTitle(item)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {author && <span className="font-medium text-foreground/80">{author}</span>}
                                  {author && " · "}
                                  {item.date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                                </p>
                              </div>
                            </div>
                          );})}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Account Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Created</span>
                        <span className="font-medium">{new Date(account.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Last Updated</span>
                        <span className="font-medium">{new Date(account.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="p-6 m-0 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-semibold">Contacts ({contacts.length})</h3>
                <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">View</span>
                    <div className="flex border border-border/60 rounded-lg overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => setContactsView("list")}
                      className={cn("px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1", contactsView === "list" ? "bg-[#0ea5e9] text-white" : "bg-background hover:bg-muted")}
                      data-testid="contacts-view-list"
                    >
                      <List className="h-3.5 w-3.5" /> List
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactsView("cards")}
                      className={cn("px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1 border-l", contactsView === "cards" ? "bg-[#0ea5e9] text-white" : "bg-background hover:bg-muted")}
                      data-testid="contacts-view-cards"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" /> Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactsView("hierarchy")}
                      className={cn("px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1 border-l", contactsView === "hierarchy" ? "bg-[#0ea5e9] text-white" : "bg-background hover:bg-muted")}
                      data-testid="contacts-view-hierarchy"
                    >
                      <GitBranch className="h-3.5 w-3.5" /> Hierarchy
                    </button>
                  </div>
                  </div>
                  {contactsView === "list" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => setContactsExpanded((v) => !v)}
                      data-testid="contacts-view-maximize"
                    >
                      {contactsExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      {contactsExpanded ? "Compact" : "Maximize"}
                    </Button>
                  )}
                  {contacts.length > 0 && (
                    <Button size="sm" onClick={() => setIsAddContactOpen(true)} data-testid="button-add-contact-detail">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Contact
                    </Button>
                  )}
                </div>
              </div>

              {contactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : contacts.length === 0 ? (
                <Card className="rounded-xl border-border/40 shadow-sm">
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No contacts for this account yet.</p>
                    <Button className="mt-4" onClick={() => setIsAddContactOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add First Contact
                    </Button>
                  </CardContent>
                </Card>
              ) : contactsView === "list" ? (
                <div
                  className={cn(
                    "rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden overflow-x-auto",
                    contactsExpanded && "fixed inset-4 z-50 bg-background shadow-2xl flex flex-col",
                  )}
                >
                  {contactsExpanded && (
                    <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                      <h3 className="font-semibold">Contacts — {account.name}</h3>
                      <Button variant="ghost" size="sm" onClick={() => setContactsExpanded(false)}>
                        <Minimize2 className="h-4 w-4 mr-1" /> Close
                      </Button>
                    </div>
                  )}
                  <div className={cn(contactsExpanded && "flex-1 overflow-auto")}>
                  <table className={cn("w-full text-sm text-gray-700 dark:text-foreground", contactsExpanded || expanded ? "min-w-full" : "min-w-[520px]")}>
                    <thead>
                      <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                        <th className="px-3 py-2.5 text-left align-middle font-semibold">Name</th>
                        <th className="px-3 py-2.5 text-left align-middle font-semibold">Title</th>
                        <th className="px-3 py-2.5 text-left align-middle font-semibold">Email</th>
                        <th className="px-3 py-2.5 text-left align-middle font-semibold">Phone</th>
                        <th className="px-3 py-2.5 text-left align-middle font-semibold">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact) => (
                        <tr key={contact.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30" data-testid={`contact-row-${contact.id}`}>
                          <td className="px-3 py-2.5 align-middle font-medium whitespace-nowrap">
                            {contact.firstName} {contact.lastName}
                            {contact.isPrimary && <Badge variant="secondary" className="text-[10px] ml-2">Primary</Badge>}
                          </td>
                          <td className="px-3 py-2.5 align-middle text-muted-foreground">{contact.title || "—"}</td>
                          <td className={cn("px-3 py-2.5 align-middle text-muted-foreground", contactsExpanded || expanded ? "whitespace-nowrap" : "truncate max-w-[160px]")}>{contact.email || "—"}</td>
                          <td className={cn("px-3 py-2.5 align-middle text-muted-foreground tabular-nums", contactsExpanded || expanded ? "whitespace-nowrap" : "truncate max-w-[140px]")}>{contact.phone || contact.mobile || "—"}</td>
                          <td className="px-3 py-2.5 align-middle capitalize text-muted-foreground">{(contact.role || "contact").replace(/_/g, " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              ) : contactsView === "hierarchy" ? (
                <div className="space-y-4">
                  <ContactOrgChartView accountId={account.id} contacts={contacts} />
                  <p className="text-xs text-muted-foreground px-1">
                    Select a contact below to add, edit, or remove reporting relationships. Links are restricted to this account only.
                  </p>
                  <div className="rounded-xl border border-border/40 bg-card shadow-sm divide-y divide-border/30">
                    {contacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => setSelectedContactForRelationships(contact.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors",
                          selectedContactForRelationships === contact.id && "bg-[#0ea5e9]/5",
                        )}
                        data-testid={`contact-hierarchy-select-${contact.id}`}
                      >
                        <div className="h-9 w-9 rounded-full bg-[#0ea5e9]/10 flex items-center justify-center text-[#0ea5e9] font-semibold text-xs shrink-0">
                          {getInitials(contact.firstName, contact.lastName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{contact.firstName} {contact.lastName}</p>
                          <p className="text-xs text-muted-foreground truncate">{contact.title || "—"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedContactForRelationships && (
                    <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
                      <ContactRelationshipsPanel
                        contactId={selectedContactForRelationships}
                        contacts={contacts}
                        accounts={[{ id: account.id, name: account.name }]}
                        embedded
                      />
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSelectedContactForRelationships(null)}>
                        Close
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {contacts.map(contact => (
                    <Card key={contact.id} className="rounded-xl border-border/40 shadow-sm overflow-hidden hover:shadow-md transition-shadow" data-testid={`contact-card-${contact.id}`}>
                      <CardContent className="p-4 overflow-hidden">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-11 w-11 rounded-full bg-[#0ea5e9]/10 flex items-center justify-center text-[#0ea5e9] font-semibold shrink-0">
                            {getInitials(contact.firstName, contact.lastName)}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <h4 className="font-semibold truncate">{contact.firstName} {contact.lastName}</h4>
                              {contact.isPrimary && <Badge variant="secondary" className="text-xs shrink-0">Primary</Badge>}
                            </div>
                            {(contact.title || contact.role) && (
                              <p className="text-sm text-muted-foreground truncate">
                                {[contact.title, contact.role ? (contact.role || "contact").replace(/_/g, " ") : null].filter(Boolean).join(" · ")}
                              </p>
                            )}
                            {(contact.email || contact.phone || contact.mobile) && (
                              <div className="space-y-1.5 pt-1 border-t border-border/30">
                                {contact.email && (
                                  <div className="flex items-center gap-2 min-w-0 text-sm">
                                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate text-muted-foreground">{contact.email}</span>
                                  </div>
                                )}
                                {(contact.phone || contact.mobile) && (
                                  <div className="flex items-center gap-2 min-w-0 text-sm">
                                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate tabular-nums text-muted-foreground">{contact.phone || contact.mobile}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="opportunities" className="p-6 m-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Opportunities ({opportunities.length})</h3>
              </div>

              {opportunitiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : opportunities.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No opportunities for this account yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {opportunities.map(opp => {
                    const stage = stages.find(s => s.id === opp.stageId);
                    return (
                      <Card key={opp.id} className="hover-elevate" data-testid={`opportunity-card-${opp.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: stage?.color || '#6366f1' }}
                              />
                              <div>
                                <h4 className="font-medium">{opp.name}</h4>
                                <p className="text-sm text-muted-foreground">{stage?.name || "—"}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-lg text-green-600 dark:text-green-400">
                                ${parseFloat(opp.amount || "0").toLocaleString()}
                              </p>
                              {opp.expectedCloseDate && (
                                <p className="text-xs text-muted-foreground">
                                  Close: {new Date(opp.expectedCloseDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          {opp.nextStep && (
                            <p className="text-sm text-muted-foreground mt-2">
                              Next: {opp.nextStep}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                sessionStorage.setItem("crm-resource-plan-opp-id", String(opp.id));
                                setLocation("/modules/crm?tab=resourceplan");
                              }}
                              data-testid={`opp-resource-plan-${opp.id}`}
                            >
                              <Users className="h-3.5 w-3.5 mr-1" />
                              Resource Plan
                            </Button>
                            {opp.projectId && (
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/modules/finance-mgmt?tab=budgets&projectId=${opp.projectId}`}>
                                  <Wallet className="h-3.5 w-3.5 mr-1" />
                                  Budget
                                </Link>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activities" className="p-6 m-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Activity Timeline</h3>
                <Button size="sm" onClick={() => setIsAddActivityOpen(true)} data-testid="button-log-activity-detail">
                  <Plus className="h-4 w-4 mr-1" />
                  Log Activity
                </Button>
              </div>

              {activitiesLoading || notesLoading || tasksLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : allTimelineItems.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No activity recorded yet.</p>
                    <Button className="mt-4" onClick={() => setIsAddActivityOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Log First Activity
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {allTimelineItems.map((item, idx) => {
                      const Icon = item.itemType === 'activity' 
                        ? getActivityIcon((item as CrmActivityRecord).type)
                        : item.itemType === 'note' ? MessageSquare : CheckCircle2;
                      return (
                        <div key={`${item.itemType}-${idx}`} className="flex gap-4 relative">
                          <div className={cn(
                            "relative z-10 h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                            item.itemType === 'activity' && "bg-status-blue text-status-blue-foreground",
                            item.itemType === 'note' && "bg-status-amber text-status-amber-foreground",
                            item.itemType === 'task' && "bg-status-purple text-status-purple-foreground",
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <Card className="flex-1">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  {item.itemType === 'activity' && (
                                    <>
                                      <p className="font-medium">{(item as CrmActivityRecord).subject}</p>
                                      <Badge variant="secondary" className="text-xs capitalize mt-1">{(item as CrmActivityRecord).type}</Badge>
                                      {(item as CrmActivityRecord).description && (
                                        <p className="text-sm text-muted-foreground mt-2">{(item as CrmActivityRecord).description}</p>
                                      )}
                                    </>
                                  )}
                                  {item.itemType === 'note' && (
                                    <>
                                      <p className="font-medium">Note</p>
                                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{(item as CrmNoteRecord).content}</p>
                                    </>
                                  )}
                                  {item.itemType === 'task' && (
                                    <>
                                      <p className="font-medium">{(item as CrmTask).subject}</p>
                                      <Badge variant="secondary" className="text-xs capitalize mt-1">{(item as CrmTask).status}</Badge>
                                    </>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {item.date.toLocaleDateString()}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="p-6 m-0 space-y-4 relative min-h-[280px]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Notes ({notes.length})</h3>
                <Button size="sm" onClick={() => setIsAddNoteOpen(true)} data-testid="button-add-note-detail">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Note
                </Button>
              </div>

              {notesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : notes.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No notes for this account yet.</p>
                    <Button className="mt-4" onClick={() => setIsAddNoteOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add First Note
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3 pb-16">
                  {notes.map(note => {
                    const authorName = note.createdByUserId
                      ? resolveOwner(note.createdByUserId).name
                      : "Unknown user";
                    return (
                    <Card key={note.id} data-testid={`note-card-${note.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-foreground">{authorName}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(note.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );})}
                </div>
              )}

              <Button
                size="lg"
                className="absolute bottom-4 right-4 z-10 h-11 rounded-full shadow-lg gap-2 px-4 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
                onClick={() => setIsAddNoteOpen(true)}
                data-testid="button-add-note-floating"
              >
                <Plus className="h-5 w-5" />
                Add Note
              </Button>
            </TabsContent>

            <TabsContent value="correspondence" className="p-6 m-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Correspondence ({correspondenceItems.length})</h3>
              </div>

              <div className="rounded-xl border border-[#0ea5e9]/20 bg-[#0ea5e9]/5 px-4 py-3 text-sm">
                <p className="font-medium text-[#0ea5e9]">Gmail &amp; Outlook sync</p>
                <p className="text-muted-foreground mt-1">
                  Connect your mailbox in Settings to automatically import email threads with this account and its contacts.
                  Until then, logged sends and email activities appear below.
                </p>
                <Link href="/settings?tab=integrations">
                  <Button variant="link" className="h-auto p-0 mt-2 text-[#0ea5e9]" data-testid="link-correspondence-integrations">
                    Open Integrations settings
                  </Button>
                </Link>
              </div>

              {emailLogsLoading || activitiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : correspondenceItems.length === 0 ? (
                <Card className="rounded-xl border-border/40 shadow-sm">
                  <CardContent className="py-12 text-center">
                    <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No correspondence recorded for this account yet.</p>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                      Emails sent from Jiganto or synced from Gmail/Outlook will appear here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {correspondenceItems.map((item) => (
                    <Card key={item.id} className="rounded-xl border-border/40 shadow-sm overflow-hidden" data-testid={`correspondence-item-${item.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-[#0ea5e9]/10 flex items-center justify-center shrink-0">
                            {item.source === "log" ? (
                              <Send className="h-4 w-4 text-[#0ea5e9]" />
                            ) : (
                              <Mail className="h-4 w-4 text-[#0ea5e9]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{item.subject}</p>
                                {item.recipientOrFrom && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">To: {item.recipientOrFrom}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {item.date.toLocaleDateString()}
                                </span>
                                {item.status && (
                                  <Badge variant="secondary" className="text-[10px] capitalize block mt-1 ml-auto w-fit">
                                    {item.status}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {item.body && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap break-words">
                                {item.body}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground/70 mt-2 uppercase tracking-wide">
                              {item.source === "log" ? "Logged email" : "Email activity"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>

      <LeadFormDialog
        open={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
        editing={null}
        stacked
        initialValues={{
          company: account.name,
          industry: account.industry || "",
          website: account.website || "",
        }}
      />

      <AccountDetailFormOverlay
        open={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        title="Add contact"
        description={account.name}
        testId="account-add-contact-panel"
        headerActions={
          <Button
            size="sm"
            className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
            disabled={!contactFormData.firstName || !contactFormData.lastName || createContactMutation.isPending}
            onClick={() => createContactMutation.mutate(contactFormData)}
            data-testid="button-save-new-contact"
          >
            {createContactMutation.isPending ? "Adding…" : "Add contact"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First name *</Label>
              <Input value={contactFormData.firstName} onChange={(e) => setContactFormData(prev => ({ ...prev, firstName: e.target.value }))} data-testid="input-new-contact-firstname" />
            </div>
            <div>
              <Label>Last name *</Label>
              <Input value={contactFormData.lastName} onChange={(e) => setContactFormData(prev => ({ ...prev, lastName: e.target.value }))} data-testid="input-new-contact-lastname" />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={contactFormData.email} onChange={(e) => setContactFormData(prev => ({ ...prev, email: e.target.value }))} data-testid="input-new-contact-email" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={contactFormData.phone} onChange={(e) => setContactFormData(prev => ({ ...prev, phone: e.target.value }))} />
          </div>
          <div>
            <Label>Title</Label>
            <Input value={contactFormData.title} onChange={(e) => setContactFormData(prev => ({ ...prev, title: e.target.value }))} />
          </div>
        </div>
      </AccountDetailFormOverlay>

      <AccountDetailFormOverlay
        open={isEditMode}
        onClose={() => setIsEditMode(false)}
        title="Edit account"
        description={account.name}
        testId="account-edit-panel"
        headerActions={
          <Button
            size="sm"
            className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
            disabled={!editFormData.name || updateAccountMutation.isPending}
            onClick={() => updateAccountMutation.mutate(editFormData)}
            data-testid="button-save-account-edit"
          >
            {updateAccountMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Account name *</Label>
              <Input value={editFormData.name} onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))} data-testid="input-edit-account-name" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={editFormData.type} onValueChange={(v) => setEditFormData(prev => ({ ...prev, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Industry</Label>
              <Input value={editFormData.industry} onChange={(e) => setEditFormData(prev => ({ ...prev, industry: e.target.value }))} />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={editFormData.website} onChange={(e) => setEditFormData(prev => ({ ...prev, website: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input value={editFormData.phone} onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={editFormData.email} onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Address</Label>
            <Input value={editFormData.address} onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>City</Label>
              <Input value={editFormData.city} onChange={(e) => setEditFormData(prev => ({ ...prev, city: e.target.value }))} />
            </div>
            <div>
              <Label>State / region</Label>
              <Input value={editFormData.state} onChange={(e) => setEditFormData(prev => ({ ...prev, state: e.target.value }))} />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={editFormData.country} onChange={(e) => setEditFormData(prev => ({ ...prev, country: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Annual revenue ($)</Label>
              <Input type="number" value={editFormData.annualRevenue} onChange={(e) => setEditFormData(prev => ({ ...prev, annualRevenue: e.target.value }))} />
            </div>
            <div>
              <Label>Employees</Label>
              <Input type="number" value={editFormData.employeeCount} onChange={(e) => setEditFormData(prev => ({ ...prev, employeeCount: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={editFormData.description} onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))} className="min-h-[100px]" />
          </div>
        </div>
      </AccountDetailFormOverlay>

      <AccountDetailFormOverlay
        open={isAddNoteOpen}
        onClose={() => setIsAddNoteOpen(false)}
        title="Add note"
        description={account.name}
        testId="account-add-note-panel"
        headerActions={
          <Button
            size="sm"
            className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
            disabled={!noteContent.trim() || createNoteMutation.isPending}
            onClick={() => createNoteMutation.mutate(noteContent)}
            data-testid="button-save-note"
          >
            {createNoteMutation.isPending ? "Saving…" : "Add note"}
          </Button>
        }
      >
        <Textarea
          placeholder="Enter your note…"
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          className="min-h-[200px]"
          data-testid="input-note-content"
        />
      </AccountDetailFormOverlay>

      <AccountDetailFormOverlay
        open={isAddActivityOpen}
        onClose={() => setIsAddActivityOpen(false)}
        title="Log activity"
        description={account.name}
        testId="account-add-activity-panel"
        headerActions={
          <Button
            size="sm"
            className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
            disabled={!activityFormData.subject || createActivityMutation.isPending}
            onClick={() => createActivityMutation.mutate(activityFormData)}
            data-testid="button-save-activity-detail"
          >
            {createActivityMutation.isPending ? "Logging…" : "Log activity"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Activity type</Label>
            <Select value={activityFormData.type} onValueChange={(v) => setActivityFormData(prev => ({ ...prev, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="task">Task</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject *</Label>
            <Input value={activityFormData.subject} onChange={(e) => setActivityFormData(prev => ({ ...prev, subject: e.target.value }))} data-testid="input-activity-subject-detail" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={activityFormData.description} onChange={(e) => setActivityFormData(prev => ({ ...prev, description: e.target.value }))} />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={activityFormData.dueDate} onChange={(e) => setActivityFormData(prev => ({ ...prev, dueDate: e.target.value }))} />
          </div>
        </div>
      </AccountDetailFormOverlay>
    </div>
  );
}
