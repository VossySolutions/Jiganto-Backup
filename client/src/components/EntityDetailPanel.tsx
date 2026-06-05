import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  X, Save, Trash2, ExternalLink, User, Calendar, Target, Flag, 
  Crosshair, Zap, TrendingUp, BarChart3, CheckSquare, Loader2,
  ChevronRight, Link2
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
};

const entityLabels: Record<string, string> = {
  strategy: "Strategy",
  goal: "Goal",
  objective: "Objective",
  initiative: "Initiative",
  okr: "OKR",
  kpi: "KPI",
  execution: "Task",
};

const ragColors: Record<string, string> = {
  green: "bg-status-green text-status-green-foreground",
  amber: "bg-status-amber text-status-amber-foreground",
  red: "bg-status-red text-status-red-foreground",
};

const statusOptions = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_track", label: "On Track" },
  { value: "at_risk", label: "At Risk" },
  { value: "off_track", label: "Off Track" },
  { value: "completed", label: "Completed" },
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

export function EntityDetailPanel({ open, onClose, entityType, entity }: EntityDetailPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  const [editedEntity, setEditedEntity] = useState<Record<string, unknown> | null>(null);

  const Icon = entityIcons[entityType] || Target;
  const label = entityLabels[entityType] || "Entity";

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
      default: return "";
    }
  };

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
            <div className="flex-1">
              <SheetTitle className="text-lg" data-testid="detail-panel-title">{title}</SheetTitle>
              <SheetDescription className="text-sm">
                {label} Details
              </SheetDescription>
            </div>
            <Badge variant="outline" className={cn(ragColors[ragStatus], "text-xs")}>
              {ragStatus.toUpperCase()}
            </Badge>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-4 justify-start bg-muted/50">
            <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
            <TabsTrigger value="progress" data-testid="tab-progress">Progress</TabsTrigger>
            <TabsTrigger value="links" data-testid="tab-links">Links</TabsTrigger>
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

            <TabsContent value="links" className="m-0 space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Related entities in the strategy chain:</p>
              </div>
              
              <div className="space-y-2">
                {entityType !== "strategy" && (
                  <div className="flex items-center gap-2 p-3 border rounded-lg text-sm">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Parent Strategy</span>
                    <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                  </div>
                )}
                {entityType !== "execution" && (
                  <div className="flex items-center gap-2 p-3 border rounded-lg text-sm">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Child Items</span>
                    <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                  </div>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <SheetFooter className="px-6 py-4 border-t bg-muted/30 gap-2">
          <Button
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
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending || !editedEntity}
            data-testid="button-save"
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
