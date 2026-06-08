import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Building2, Users, Target, TrendingUp, Phone, Mail, Calendar, 
  Plus, Globe, MapPin, DollarSign, Clock, FileText, MessageSquare,
  CheckCircle2, XCircle, ChevronLeft, X, Edit2, Trash2, Activity, Loader2,
  Briefcase, ExternalLink, User, MoreHorizontal
} from "lucide-react";

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
  accountId: number | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  title: string | null;
  department: string | null;
  role: string | null;
  isPrimary: boolean | null;
  linkedInUrl: string | null;
  notes: string | null;
  createdAt: string;
};

type CrmOpportunity = {
  id: number;
  accountId: number | null;
  stageId: number | null;
  name: string;
  amount: string | null;
  probability: number | null;
  expectedCloseDate: string | null;
  type: string | null;
  source: string | null;
  nextStep: string | null;
  createdAt: string;
};

type CrmActivity = {
  id: number;
  type: string;
  subject: string;
  description: string | null;
  dueDate: string | null;
  completedAt: string | null;
  status: string | null;
  priority: string | null;
  accountId: number | null;
  createdAt: string;
};

type CrmNote = {
  id: number;
  entityType: string;
  entityId: number;
  content: string;
  createdAt: string;
};

type CrmTask = {
  id: number;
  subject: string;
  description: string | null;
  dueDate: string | null;
  status: string | null;
  priority: string | null;
  accountId: number | null;
  createdAt: string;
};

type CrmOpportunityStage = {
  id: number;
  name: string;
  probability: number | null;
  color: string | null;
  isClosed: boolean | null;
  isWon: boolean | null;
};

interface AccountDetailPanelProps {
  account: CrmAccount;
  onClose: () => void;
}

export function AccountDetailPanel({ account, onClose }: AccountDetailPanelProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [contactFormData, setContactFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", title: "" });
  const [leadFormData, setLeadFormData] = useState({ firstName: "", lastName: "", email: "", source: "referral" });
  const [noteContent, setNoteContent] = useState("");
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

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<CrmContact[]>({
    queryKey: [`/api/crm/contacts?accountId=${account.id}`],
  });

  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery<CrmOpportunity[]>({
    queryKey: [`/api/crm/opportunities?accountId=${account.id}`],
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<CrmActivity[]>({
    queryKey: [`/api/crm/activities?accountId=${account.id}`],
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<CrmNote[]>({
    queryKey: [`/api/crm/notes?entityType=account&entityId=${account.id}`],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<CrmTask[]>({
    queryKey: [`/api/crm/tasks?accountId=${account.id}`],
  });

  const { data: stages = [] } = useQuery<CrmOpportunityStage[]>({
    queryKey: ["/api/crm/stages"],
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
    mutationFn: (content: string) => 
      apiRequest("POST", "/api/crm/notes", { entityType: "account", entityId: account.id, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/notes?entityType=account&entityId=${account.id}`] });
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

  const createLeadMutation = useMutation({
    mutationFn: (data: typeof leadFormData) => 
      apiRequest("POST", "/api/crm/leads", { ...data, company: account.name, status: "new" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      setIsAddLeadOpen(false);
      setLeadFormData({ firstName: "", lastName: "", email: "", source: "referral" });
      toast({ title: "Lead created successfully" });
    },
    onError: () => toast({ title: "Failed to create lead", variant: "destructive" }),
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

  return (
    <div className="h-full flex flex-col bg-background" data-testid="account-detail-panel">
      <div className="border-b bg-card/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-detail">
              <X className="h-5 w-5" />
            </Button>
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold" data-testid="account-detail-name">{account.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="capitalize">{account.type}</Badge>
                {account.industry && <span>{account.industry}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isAddLeadOpen} onOpenChange={setIsAddLeadOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-add-lead-from-account">
                  <Plus className="h-4 w-4 mr-1" />
                  Lead
                </Button>
              </DialogTrigger>
              <DialogContent>
                <SubmitForm
                  onSubmit={() => createLeadMutation.mutate(leadFormData)}
                  disabled={!leadFormData.firstName || !leadFormData.lastName || createLeadMutation.isPending}
                >
                <DialogHeader>
                  <DialogTitle>Add Lead from {account.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>First Name *</Label>
                      <Input 
                        value={leadFormData.firstName}
                        onChange={(e) => setLeadFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Last Name *</Label>
                      <Input 
                        value={leadFormData.lastName}
                        onChange={(e) => setLeadFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={leadFormData.email}
                      onChange={(e) => setLeadFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Source</Label>
                    <Select value={leadFormData.source} onValueChange={(v) => setLeadFormData(prev => ({ ...prev, source: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="social">Social Media</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button 
                    type="submit"
                    disabled={!leadFormData.firstName || !leadFormData.lastName || createLeadMutation.isPending}
                  >
                    {createLeadMutation.isPending ? "Creating..." : "Create Lead"}
                  </Button>
                </DialogFooter>
                </SubmitForm>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={() => setIsAddContactOpen(true)} data-testid="button-add-contact-quick">
              <Plus className="h-4 w-4 mr-1" />
              Contact
            </Button>
            <Button size="sm" onClick={() => setIsEditMode(true)} data-testid="button-edit-account">
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b px-4">
            <TabsList className="h-11 bg-transparent border-0 gap-1">
              <TabsTrigger value="overview" className="gap-2 rounded-lg data-[state=active]:bg-primary/10" data-testid="detail-tab-overview">
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
              <TabsTrigger value="notes" className="gap-2 rounded-lg data-[state=active]:bg-primary/10" data-testid="detail-tab-notes">
                <MessageSquare className="h-3.5 w-3.5" />
                Notes
                <Badge variant="secondary" className="text-xs ml-1">{notes.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value="overview" className="p-6 m-0 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Account Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="font-medium capitalize truncate">{account.type}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Industry</p>
                        <p className="font-medium truncate">{account.industry || "—"}</p>
                      </div>
                      <div className="min-w-0 col-span-2">
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
                      <div className="min-w-0 col-span-2">
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
                </div>

                <div className="space-y-6">
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        Pipeline Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-2xl font-bold">${totalOpportunityValue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total pipeline value</p>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-lg font-semibold text-status-blue-foreground">{openOpportunities.length}</p>
                          <p className="text-xs text-muted-foreground">Open deals</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-status-green-foreground">{wonOpportunities.length}</p>
                          <p className="text-xs text-muted-foreground">Won deals</p>
                        </div>
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
                        <div className="space-y-3">
                          {allTimelineItems.slice(0, 5).map((item, idx) => (
                            <div key={`${item.itemType}-${idx}`} className="flex items-start gap-3 text-sm">
                              <div className={cn(
                                "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0",
                                item.itemType === 'activity' && "bg-status-blue/10 text-status-blue-foreground",
                                item.itemType === 'note' && "bg-status-amber/10 text-status-amber-foreground",
                                item.itemType === 'task' && "bg-status-purple/10 text-status-purple-foreground",
                              )}>
                                {item.itemType === 'activity' && <Activity className="h-3.5 w-3.5" />}
                                {item.itemType === 'note' && <MessageSquare className="h-3.5 w-3.5" />}
                                {item.itemType === 'task' && <CheckCircle2 className="h-3.5 w-3.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {item.itemType === 'activity' && (item as CrmActivity).subject}
                                  {item.itemType === 'note' && "Note added"}
                                  {item.itemType === 'task' && (item as CrmTask).subject}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.date.toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
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
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created</span>
                        <span className="font-medium">{new Date(account.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Updated</span>
                        <span className="font-medium">{new Date(account.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="p-6 m-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Contacts ({contacts.length})</h3>
                <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-contact-detail">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Contact
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <SubmitForm
                      onSubmit={() => createContactMutation.mutate(contactFormData)}
                      disabled={!contactFormData.firstName || !contactFormData.lastName || createContactMutation.isPending}
                    >
                    <DialogHeader>
                      <DialogTitle>Add Contact to {account.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>First Name *</Label>
                          <Input 
                            value={contactFormData.firstName}
                            onChange={(e) => setContactFormData(prev => ({ ...prev, firstName: e.target.value }))}
                            data-testid="input-new-contact-firstname"
                          />
                        </div>
                        <div>
                          <Label>Last Name *</Label>
                          <Input 
                            value={contactFormData.lastName}
                            onChange={(e) => setContactFormData(prev => ({ ...prev, lastName: e.target.value }))}
                            data-testid="input-new-contact-lastname"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input 
                          type="email"
                          value={contactFormData.email}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, email: e.target.value }))}
                          data-testid="input-new-contact-email"
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input 
                          value={contactFormData.phone}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Title</Label>
                        <Input 
                          value={contactFormData.title}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, title: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button 
                        type="submit"
                        disabled={!contactFormData.firstName || !contactFormData.lastName || createContactMutation.isPending}
                        data-testid="button-save-new-contact"
                      >
                        {createContactMutation.isPending ? "Adding..." : "Add Contact"}
                      </Button>
                    </DialogFooter>
                    </SubmitForm>
                  </DialogContent>
                </Dialog>
              </div>

              {contactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : contacts.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No contacts for this account yet.</p>
                    <Button className="mt-4" onClick={() => setIsAddContactOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add First Contact
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contacts.map(contact => (
                    <Card key={contact.id} className="hover-elevate" data-testid={`contact-card-${contact.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                            {contact.firstName[0]}{contact.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{contact.firstName} {contact.lastName}</h4>
                              {contact.isPrimary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{contact.title || "—"}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {contact.phone}
                                </span>
                              )}
                            </div>
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
                <Dialog open={isAddActivityOpen} onOpenChange={setIsAddActivityOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-log-activity-detail">
                      <Plus className="h-4 w-4 mr-1" />
                      Log Activity
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <SubmitForm
                      onSubmit={() => createActivityMutation.mutate(activityFormData)}
                      disabled={!activityFormData.subject || createActivityMutation.isPending}
                    >
                    <DialogHeader>
                      <DialogTitle>Log Activity for {account.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Activity Type</Label>
                        <Select value={activityFormData.type} onValueChange={(v) => setActivityFormData(prev => ({ ...prev, type: v }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
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
                        <Input 
                          value={activityFormData.subject}
                          onChange={(e) => setActivityFormData(prev => ({ ...prev, subject: e.target.value }))}
                          data-testid="input-activity-subject-detail"
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea 
                          value={activityFormData.description}
                          onChange={(e) => setActivityFormData(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Due Date</Label>
                        <Input 
                          type="date"
                          value={activityFormData.dueDate}
                          onChange={(e) => setActivityFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button 
                        type="submit"
                        disabled={!activityFormData.subject || createActivityMutation.isPending}
                        data-testid="button-save-activity-detail"
                      >
                        {createActivityMutation.isPending ? "Logging..." : "Log Activity"}
                      </Button>
                    </DialogFooter>
                    </SubmitForm>
                  </DialogContent>
                </Dialog>
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
                        ? getActivityIcon((item as CrmActivity).type)
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
                                      <p className="font-medium">{(item as CrmActivity).subject}</p>
                                      <Badge variant="secondary" className="text-xs capitalize mt-1">{(item as CrmActivity).type}</Badge>
                                      {(item as CrmActivity).description && (
                                        <p className="text-sm text-muted-foreground mt-2">{(item as CrmActivity).description}</p>
                                      )}
                                    </>
                                  )}
                                  {item.itemType === 'note' && (
                                    <>
                                      <p className="font-medium">Note</p>
                                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{(item as CrmNote).content}</p>
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

            <TabsContent value="notes" className="p-6 m-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Notes ({notes.length})</h3>
                <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-note-detail">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Note
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <SubmitForm
                      onSubmit={() => createNoteMutation.mutate(noteContent)}
                      disabled={!noteContent.trim() || createNoteMutation.isPending}
                    >
                    <DialogHeader>
                      <DialogTitle>Add Note to {account.name}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <Textarea 
                        placeholder="Enter your note..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        className="min-h-[150px]"
                        data-testid="input-note-content"
                      />
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button 
                        type="submit"
                        disabled={!noteContent.trim() || createNoteMutation.isPending}
                        data-testid="button-save-note"
                      >
                        {createNoteMutation.isPending ? "Saving..." : "Add Note"}
                      </Button>
                    </DialogFooter>
                    </SubmitForm>
                  </DialogContent>
                </Dialog>
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
                <div className="space-y-3">
                  {notes.map(note => (
                    <Card key={note.id} data-testid={`note-card-${note.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(note.createdAt).toLocaleString()}
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

      <Dialog open={isEditMode} onOpenChange={setIsEditMode}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <SubmitForm
            onSubmit={() => updateAccountMutation.mutate(editFormData)}
            disabled={!editFormData.name || updateAccountMutation.isPending}
          >
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account Name *</Label>
                <Input 
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-edit-account-name"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={editFormData.type} onValueChange={(v) => setEditFormData(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Industry</Label>
                <Input 
                  value={editFormData.industry}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, industry: e.target.value }))}
                />
              </div>
              <div>
                <Label>Website</Label>
                <Input 
                  value={editFormData.website}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, website: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input 
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input 
                value={editFormData.address}
                onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>City</Label>
                <Input 
                  value={editFormData.city}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div>
                <Label>State/Province</Label>
                <Input 
                  value={editFormData.state}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div>
                <Label>Country</Label>
                <Input 
                  value={editFormData.country}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, country: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Annual Revenue ($)</Label>
                <Input 
                  type="number"
                  value={editFormData.annualRevenue}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, annualRevenue: e.target.value }))}
                />
              </div>
              <div>
                <Label>Employee Count</Label>
                <Input 
                  type="number"
                  value={editFormData.employeeCount}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, employeeCount: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea 
                value={editFormData.description}
                onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              type="submit"
              disabled={!editFormData.name || updateAccountMutation.isPending}
              data-testid="button-save-account-edit"
            >
              {updateAccountMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
          </SubmitForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
