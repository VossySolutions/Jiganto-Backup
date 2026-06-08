import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { SubmitForm } from "@/components/ui/submit-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, Trash2, ExternalLink, Calendar, Target, Flag, 
  Crosshair, Zap, TrendingUp, BarChart3, CheckSquare, Loader2,
  ChevronRight, ChevronUp, Link2, MessageSquare, Send, ShieldCheck, Plus,
  FileText, Globe, X as XIcon
} from "lucide-react";
import { format } from "date-fns";

interface UserProfile {
  id: number;
  userId: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    profileImageUrl: string | null;
  };
}

interface EntityDetailPanelProps {
  open: boolean;
  onClose: () => void;
  entityType: string;
  entity: Record<string, unknown> | null;
}

const entityIcons: Record<string, typeof Target> = {
  strategy: Target,
  goal: Flag,
  objective: Crosshair,
  initiative: Zap,
  okr: TrendingUp,
  kpi: BarChart3,
  execution: CheckSquare,
  governance: ShieldCheck,
};

const entityLabels: Record<string, string> = {
  strategy: "Strategy",
  goal: "Goal",
  objective: "Objective",
  initiative: "Initiative",
  okr: "OKR",
  kpi: "KPI",
  execution: "Task",
  governance: "Governance",
};

const REF_PREFIXES: Record<string, string> = {
  strategy: "S", goal: "G", objective: "OBJ", initiative: "INI",
  okr: "OKR", kpi: "KPI", execution: "TASK", governance: "GOV",
};

const ragColors: Record<string, string> = {
  green: "bg-status-green text-status-green-foreground",
  amber: "bg-status-amber text-status-amber-foreground",
  red: "bg-status-red text-status-red-foreground",
};

const statusOptions = [
  { value: "not_started",  label: "Not Started" },
  { value: "in_progress",  label: "In Progress" },
  { value: "on_track",     label: "On Track" },
  { value: "at_risk",      label: "At Risk" },
  { value: "off_track",    label: "Off Track" },
  { value: "on_hold",      label: "On Hold" },
  { value: "cancelled",    label: "Cancelled" },
  { value: "completed",    label: "Completed" },
];

const ragOptions = [
  { value: "green", label: "Green" },
  { value: "amber", label: "Amber" },
  { value: "red", label: "Red" },
];

function getUserDisplayName(user: UserProfile["user"]): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : user.email || user.id;
}

function getUserInitials(user: UserProfile["user"]): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.firstName) return user.firstName[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return "?";
}

type ReviewNote = {
  id: number; entityType: string; entityId: number; content: string;
  ragSnapshot: string | null; progressAtCheckin: number | null; authorName: string; createdAt: string;
};

type DocLink = {
  id: number; entityType: string; entityId: number; url: string;
  label: string | null; addedByName: string | null; createdAt: string;
};

type InitiativeDoc = {
  id: number; initiativeId: number; filename: string; fileType: string | null;
  fileSize: number | null; uploadedByName: string | null; createdAt: string;
};

export function EntityDetailPanel({ open, onClose, entityType, entity }: EntityDetailPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  const [editedEntity, setEditedEntity] = useState<Record<string, unknown> | null>(null);
  const [checkinContent, setCheckinContent] = useState("");
  const [checkinRag, setCheckinRag] = useState("");
  const [checkinProgress, setCheckinProgress] = useState<string>("");

  const Icon = entityIcons[entityType] || Target;
  const label = entityLabels[entityType] || "Entity";
  const refPrefix = REF_PREFIXES[entityType] ?? entityType.toUpperCase().slice(0, 3);

  const { data: entityRefs } = useQuery<Record<string, number>>({
    queryKey: ["/api/business/entity-refs"],
    enabled: open,
    staleTime: 60_000,
  });

  const entityRefSeq = entity?.id ? (entityRefs?.[`${entityType}-${entity.id}`] ?? null) : null;
  const displayRef = entityRefSeq
    ? `${refPrefix}-${String(entityRefSeq).padStart(3, "0")}`
    : `${refPrefix}-${String(entity?.id ?? 0).padStart(3, "0")}`;

  const ownerField = entityType === "execution" ? "assigneeId" : "ownerId";

  const { data: usersData, isLoading: usersLoading } = useQuery<UserProfile[]>({
    queryKey: ["/api/settings/users"],
    enabled: open,
  });

  const getApiPath = (type: string): string => {
    switch (type) {
      case "strategy": return "/api/business/strategy";
      case "goal": return "/api/business/goals";
      case "objective": return "/api/business/objectives";
      case "initiative": return "/api/business/initiatives";
      case "okr": return "/api/business/okrs";
      case "kpi": return "/api/business/kpis";
      case "execution": return "/api/business/tasks";
      case "governance": return "/api/business/governance";
      default: return "";
    }
  };

  const parentEntityType = (() => {
    if (entityType === "goal") return "strategy";
    if (entityType === "objective") return "goal";
    if (entityType === "initiative") return "objective";
    if (entityType === "okr") return entity?.initiativeId ? "initiative" : (entity?.objectiveId ? "objective" : null);
    if (entityType === "kpi") return entity?.initiativeId ? "initiative" : (entity?.goalId ? "goal" : null);
    return null;
  })();

  const parentEntityId = (() => {
    if (entityType === "goal") return entity?.strategyItemId as number | null;
    if (entityType === "objective") return entity?.goalId as number | null;
    if (entityType === "initiative") return entity?.objectiveId as number | null;
    if (entityType === "okr") return (entity?.initiativeId || entity?.objectiveId) as number | null;
    if (entityType === "kpi") return (entity?.initiativeId || entity?.goalId) as number | null;
    return null;
  })();

  const { data: parentEntity } = useQuery<Record<string, unknown>>({
    queryKey: [parentEntityType && getApiPath(parentEntityType), parentEntityId],
    queryFn: () => {
      if (!parentEntityType || !parentEntityId) return Promise.resolve(null);
      return fetch(`${getApiPath(parentEntityType)}/${parentEntityId}`, { credentials: "include" }).then(r => r.ok ? r.json() : null);
    },
    enabled: open && !!parentEntityType && !!parentEntityId,
  });

  const READONLY_FIELDS = ["ownerName", "assigneeName", "createdByName", "updatedByName", "id", "createdAt", "updatedAt"];

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const path = getApiPath(entityType);
      if (!path || !entity?.id) throw new Error("Invalid entity");
      const sanitized = Object.fromEntries(
        Object.entries(data).filter(([key]) => !READONLY_FIELDS.includes(key))
      );
      return apiRequest("PUT", `${path}/${entity.id}`, sanitized);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/strategy-map"] });
      queryClient.invalidateQueries({ queryKey: [getApiPath(entityType)] });
      toast({ title: `${label} updated successfully` });
      onClose();
    },
    onError: () => {
      toast({ title: `Failed to update ${label.toLowerCase()}`, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const path = getApiPath(entityType);
      if (!path || !entity?.id) throw new Error("Invalid entity");
      return apiRequest("DELETE", `${path}/${entity.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/strategy-map"] });
      queryClient.invalidateQueries({ queryKey: [getApiPath(entityType)] });
      toast({ title: `${label} deleted` });
      onClose();
    },
    onError: () => {
      toast({ title: `Failed to delete ${label.toLowerCase()}`, variant: "destructive" });
    },
  });

  const { data: checkInsRaw } = useQuery<ReviewNote[]>({
    queryKey: ["/api/business/review-notes", entityType, entity?.id],
    queryFn: async () => {
      if (!entity?.id) return [];
      const res = await fetchWithAuth(
        `/api/business/review-notes?entityType=${entityType}&entityId=${entity.id}`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: open && !!entity?.id && activeTab === "checkins",
  });
  const checkIns = Array.isArray(checkInsRaw) ? checkInsRaw : [];

  const { data: docLinks = [], refetch: refetchDocLinks } = useQuery<DocLink[]>({
    queryKey: ["/api/business/doc-links", entityType, entity?.id],
    queryFn: () => {
      if (!entity?.id) return Promise.resolve([]);
      return fetch(`/api/business/doc-links?entityType=${entityType}&entityId=${entity.id}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: open && !!entity?.id && activeTab === "docs",
  });

  const { data: initiativeDocs = [] } = useQuery<InitiativeDoc[]>({
    queryKey: ["/api/business/initiative-documents", entity?.id],
    queryFn: () => {
      if (!entity?.id) return Promise.resolve([]);
      return fetch(`/api/business/initiative-documents?initiativeId=${entity.id}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: open && entityType === "initiative" && !!entity?.id && activeTab === "docs",
  });

  const [newDocUrl, setNewDocUrl] = useState("");
  const [newDocLabel, setNewDocLabel] = useState("");

  const addDocLinkMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/business/doc-links", body),
    onSuccess: () => {
      refetchDocLinks();
      setNewDocUrl("");
      setNewDocLabel("");
      toast({ title: "Link added" });
    },
    onError: () => toast({ title: "Failed to add link", variant: "destructive" }),
  });

  const removeDocLinkMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/business/doc-links/${id}`),
    onSuccess: () => { refetchDocLinks(); },
  });

  const addCheckinMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/business/review-notes", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/review-notes", entityType, entity?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/business/review-notes"] });
      setCheckinContent("");
      setCheckinRag("");
      setCheckinProgress("");
      toast({ title: "Check-in saved" });
    },
    onError: () => toast({ title: "Failed to save check-in", variant: "destructive" }),
  });

  const submitCheckin = () => {
    if (!checkinContent.trim() || !entity?.id) return;
    addCheckinMutation.mutate({
      entityType,
      entityId: Number(entity.id),
      content: checkinContent.trim(),
      ragSnapshot: checkinRag || null,
      progressAtCheckin: checkinProgress !== "" ? Number(checkinProgress) : null,
    });
  };

  const handleSave = () => {
    if (!editedEntity) return;
    updateMutation.mutate(editedEntity);
  };

  const handleOpen = () => {
    if (entity) {
      setEditedEntity({ ...entity });
    }
  };

  const handleFieldChange = (field: string, value: unknown) => {
    setEditedEntity(prev => prev ? { ...prev, [field]: value } : null);
  };

  const data = editedEntity || entity;
  const title = (data?.title || data?.name || data?.objective || "Untitled") as string;
  const description = (data?.description || "") as string;
  const status = (data?.status || "not_started") as string;
  const ragStatus = (data?.ragStatus || "green") as string;
  const progress = (data?.progress || 0) as number;
  const currentOwnerId = (data?.[ownerField] || "") as string;
  const ownerName = (data?.ownerName || data?.assigneeName || "") as string;
  const createdAt = data?.createdAt ? new Date(data.createdAt as string) : null;

  const currentOwnerProfile = usersData?.find(u => u.userId === currentOwnerId);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        className="w-[450px] sm:max-w-[450px] p-0 flex flex-col"
        onOpenAutoFocus={handleOpen}
        data-testid="entity-detail-panel"
      >
        <SubmitForm
          className="flex flex-col flex-1 min-h-0"
          onSubmit={handleSave}
          disabled={updateMutation.isPending || !editedEntity}
        >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              ragStatus === "red" ? "bg-status-red/10" :
              ragStatus === "amber" ? "bg-status-amber/10" : "bg-status-green/10"
            )}>
              <Icon className={cn(
                "h-5 w-5",
                ragStatus === "red" ? "text-status-red" :
                ragStatus === "amber" ? "text-status-amber" : "text-status-green"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                  {displayRef}
                </span>
                <Badge variant="outline" className={cn(ragColors[ragStatus], "text-[10px] shrink-0")}>
                  {ragStatus.toUpperCase()}
                </Badge>
              </div>
              <SheetTitle className="text-base leading-snug mt-0.5 line-clamp-2" data-testid="detail-panel-title">{title}</SheetTitle>
              <SheetDescription className="text-xs">{label} Details</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-4 justify-start bg-muted/50 h-8 overflow-x-auto">
            <TabsTrigger value="details" className="text-xs" data-testid="tab-details">Details</TabsTrigger>
            <TabsTrigger value="progress" className="text-xs" data-testid="tab-progress">Progress</TabsTrigger>
            <TabsTrigger value="checkins" className="text-xs" data-testid="tab-checkins">Activity</TabsTrigger>
            <TabsTrigger value="docs" className="text-xs" data-testid="tab-docs">Docs</TabsTrigger>
            <TabsTrigger value="links" className="text-xs" data-testid="tab-links">Hierarchy</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 py-4">
            <TabsContent value="details" className="m-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={(editedEntity?.title || editedEntity?.name || editedEntity?.objective || title) as string}
                  onChange={(e) => handleFieldChange(
                    entityType === "kpi" ? "name" : entityType === "okr" ? "objective" : "title",
                    e.target.value
                  )}
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={(editedEntity?.description ?? description) as string}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  rows={3}
                  data-testid="input-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={(editedEntity?.status ?? status) as string}
                    onValueChange={(v) => handleFieldChange("status", v)}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>RAG Status</Label>
                  <Select
                    value={(editedEntity?.ragStatus ?? ragStatus) as string}
                    onValueChange={(v) => handleFieldChange("ragStatus", v)}
                  >
                    <SelectTrigger data-testid="select-rag">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ragOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              opt.value === "green" ? "bg-status-green" :
                              opt.value === "amber" ? "bg-status-amber" : "bg-status-red"
                            )} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <Label>{entityType === "execution" ? "Assignee" : "Owner"}</Label>
                {currentOwnerId && currentOwnerProfile && (
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getUserInitials(currentOwnerProfile.user)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm" data-testid="text-current-owner">
                      {getUserDisplayName(currentOwnerProfile.user)}
                    </span>
                  </div>
                )}
                {currentOwnerId && !currentOwnerProfile && ownerName && (
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {ownerName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm" data-testid="text-current-owner">
                      {ownerName}
                    </span>
                  </div>
                )}
                <Select
                  value={((editedEntity?.[ownerField] ?? currentOwnerId) as string) || "__none__"}
                  onValueChange={(v) => handleFieldChange(ownerField, v === "__none__" ? null : v)}
                >
                  <SelectTrigger data-testid="select-owner">
                    <SelectValue placeholder={usersLoading ? "Loading users..." : "Select owner"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">No owner</span>
                    </SelectItem>
                    {usersData?.map((profile) => (
                      <SelectItem key={profile.userId} value={profile.userId}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getUserInitials(profile.user)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{getUserDisplayName(profile.user)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator className="my-4" />

              {parentEntityType && parentEntity && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Parent {entityLabels[parentEntityType] || parentEntityType}</Label>
                  <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-muted/30">
                    {(() => { const PIcon = entityIcons[parentEntityType] || Target; return <PIcon className="h-4 w-4 text-muted-foreground shrink-0" />; })()}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {(parentEntity.title || parentEntity.name || parentEntity.objective || "Untitled") as string}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {(REF_PREFIXES[parentEntityType] ?? parentEntityType.toUpperCase()).slice(0,3)}-{String(parentEntity.id ?? 0).padStart(3,"0")}
                      </p>
                    </div>
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Metadata</Label>
                <div className="grid gap-2 text-sm">
                  {createdAt && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Created: {format(createdAt, "MMM d, yyyy")}</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="progress" className="m-0 space-y-4">
              <div className="space-y-2">
                <Label>Progress</Label>
                <div className="flex items-center gap-3">
                  <Progress value={progress} className="flex-1" />
                  <span className="text-sm font-medium w-12 text-right">{progress}%</span>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={(editedEntity?.progress ?? progress) as number}
                  onChange={(e) => handleFieldChange("progress", Number(e.target.value))}
                  data-testid="input-progress"
                />
              </div>

              <div className="space-y-2">
                <Label>Trend</Label>
                <Select
                  value={(editedEntity?.trend ?? data?.trend ?? "stable") as string}
                  onValueChange={(v) => handleFieldChange("trend", v)}
                >
                  <SelectTrigger data-testid="select-trend">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="improving">Improving</SelectItem>
                    <SelectItem value="stable">Stable</SelectItem>
                    <SelectItem value="declining">Declining</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(entityType === "kpi" || entityType === "okr") && (
                <>
                  <div className="space-y-2">
                    <Label>Target Value</Label>
                    <Input
                      value={(editedEntity?.targetValue ?? data?.targetValue ?? "") as string}
                      onChange={(e) => handleFieldChange("targetValue", e.target.value)}
                      placeholder="Enter target"
                      data-testid="input-target"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Value</Label>
                    <Input
                      value={(editedEntity?.currentValue ?? data?.currentValue ?? "") as string}
                      onChange={(e) => handleFieldChange("currentValue", e.target.value)}
                      placeholder="Enter current value"
                      data-testid="input-current"
                    />
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="checkins" className="m-0 space-y-4">
              {/* Add check-in form */}
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <Label className="text-xs font-semibold">Log a Check-in</Label>
                <Textarea
                  placeholder="What's the latest status? Any blockers or wins?"
                  value={checkinContent}
                  onChange={e => setCheckinContent(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                  data-testid="checkin-content"
                />
                <div className="flex items-center gap-2">
                  <Select value={checkinRag || "none"} onValueChange={v => setCheckinRag(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-7 text-xs flex-1" data-testid="checkin-rag">
                      <SelectValue placeholder="RAG status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No RAG</SelectItem>
                      <SelectItem value="green">🟢 Green</SelectItem>
                      <SelectItem value="amber">🟡 Amber</SelectItem>
                      <SelectItem value="red">🔴 Red</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" min={0} max={100}
                    placeholder="Progress %"
                    value={checkinProgress}
                    onChange={e => setCheckinProgress(e.target.value)}
                    className="h-7 text-xs w-28"
                    data-testid="checkin-progress"
                  />
                  <Button
                    size="sm" className="h-7 text-xs px-3"
                    onClick={submitCheckin}
                    disabled={addCheckinMutation.isPending || !checkinContent.trim()}
                    data-testid="button-submit-checkin"
                  >
                    {addCheckinMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              {/* Check-in feed */}
              {checkIns.length === 0 ? (
                <div className="py-8 text-center">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs text-muted-foreground">No check-ins yet for this item.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {checkIns.map(note => (
                    <div key={note.id} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {note.ragSnapshot && (
                            <span className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                              note.ragSnapshot === "green" ? "bg-green-100 text-green-700" :
                              note.ragSnapshot === "amber" ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            )}>
                              {note.ragSnapshot === "green" ? "🟢" : note.ragSnapshot === "amber" ? "🟡" : "🔴"} {note.ragSnapshot}
                            </span>
                          )}
                          {note.progressAtCheckin != null && (
                            <span className="text-[10px] text-muted-foreground">{note.progressAtCheckin}%</span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(new Date(note.createdAt), "d MMM yyyy")}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{note.content}</p>
                      <p className="text-[10px] text-muted-foreground">— {note.authorName}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="docs" className="m-0 space-y-4">
              {/* Add link form */}
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <Label className="text-xs font-semibold">Add External Link</Label>
                <Input
                  placeholder="https://..."
                  value={newDocUrl}
                  onChange={e => setNewDocUrl(e.target.value)}
                  className="h-8 text-xs"
                  data-testid="doc-link-url"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Label (optional)"
                    value={newDocLabel}
                    onChange={e => setNewDocLabel(e.target.value)}
                    className="h-8 text-xs flex-1"
                    data-testid="doc-link-label"
                  />
                  <Button
                    size="sm" className="h-8 px-3"
                    disabled={!newDocUrl.trim() || addDocLinkMutation.isPending}
                    onClick={() => {
                      if (!entity?.id || !newDocUrl.trim()) return;
                      addDocLinkMutation.mutate({ entityType, entityId: Number(entity.id), url: newDocUrl.trim(), label: newDocLabel.trim() || null });
                    }}
                    data-testid="button-add-doc-link"
                  >
                    {addDocLinkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              {/* External links */}
              {docLinks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">External Links</p>
                  {docLinks.map(link => (
                    <div key={link.id} className="flex items-center gap-2 p-2.5 border rounded-lg">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium text-primary hover:underline truncate block">
                          {link.label || link.url}
                        </a>
                        {link.addedByName && (
                          <p className="text-[10px] text-muted-foreground">Added by {link.addedByName}</p>
                        )}
                      </div>
                      <button
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => removeDocLinkMutation.mutate(link.id)}
                        data-testid={`button-remove-link-${link.id}`}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Initiative documents */}
              {entityType === "initiative" && initiativeDocs.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Uploaded Files</p>
                  {initiativeDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 p-2.5 border rounded-lg">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{doc.filename}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {doc.fileType} {doc.fileSize ? `· ${(doc.fileSize / 1024).toFixed(0)}KB` : ""}
                          {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {docLinks.length === 0 && !(entityType === "initiative" && initiativeDocs.length > 0) && (
                <div className="py-8 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs text-muted-foreground">No documents linked yet.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="links" className="m-0 space-y-4">
              <div className="space-y-2">
                {parentEntityType && parentEntity ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Parent</p>
                    <div className="flex items-center gap-2.5 p-3 border rounded-lg bg-muted/30">
                      {(() => { const PIcon = entityIcons[parentEntityType] || Target; return <PIcon className="h-4 w-4 shrink-0" style={{ color: "#6366f1" }} />; })()}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {(parentEntity.title || parentEntity.name || parentEntity.objective || "Untitled") as string}
                        </p>
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          {entityLabels[parentEntityType] || parentEntityType}
                        </Badge>
                      </div>
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                ) : parentEntityType ? (
                  <div className="p-3 border rounded-lg bg-muted/30 text-xs text-muted-foreground">
                    Loading parent…
                  </div>
                ) : null}

                <Separator className="my-3" />

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Current Item</p>
                  <div className="flex items-center gap-2.5 p-3 border-2 border-primary/30 rounded-lg bg-primary/5">
                    {(() => { const CIcon = entityIcons[entityType] || Target; return <CIcon className="h-4 w-4 shrink-0 text-primary" />; })()}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{title}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{displayRef}</p>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground pt-1">
                  <p>Use the Strategy Map or Goals/Objectives tabs to navigate to child items.</p>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <SheetFooter className="px-6 py-4 border-t bg-muted/30 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="text-destructive hover:text-destructive"
            data-testid="button-delete"
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            data-testid="button-save"
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </SheetFooter>
        </SubmitForm>
      </SheetContent>
    </Sheet>
  );
}
