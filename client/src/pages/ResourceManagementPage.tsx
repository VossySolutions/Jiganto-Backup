import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { cn } from "@/lib/utils";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  Users, BarChart3, Calendar, Clock, Plus, Search, Filter,
  Briefcase, TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  Loader2, Sparkles, Download, MapPin, GripVertical,
  ChevronLeft, ChevronRight, Eye, Grid3X3, List, UserCheck,
  Activity, PieChart, ArrowUpRight, MoreHorizontal, Pencil, Trash2,
  FileText, Timer, Target, Layers, Star, CreditCard, Upload, FileSpreadsheet
} from "lucide-react";
import { RateCardManager } from "@/components/crm/RateCardManager";
import { CapacityBoard } from "@/components/crm/CapacityBoard";
import {
  ResDashboardIcon,
  ResPeopleIcon,
  ResSkillsIcon,
  ResCapacityIcon,
  ResPipelineIcon,
  ResTimesheetsIcon,
  ResApprovalsIcon,
} from "@/components/icons/ModuleIcons";

type ResourceStats = {
  totalResources: number;
  availableResources: number;
  overAllocated: number;
  avgUtilization: number;
  pendingTimesheetApprovals: number;
  activeAllocations: number;
};

type Resource = {
  id: number;
  tenantId: number;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  status: string | null;
  costRate: string | null;
  billRate: string | null;
  weeklyCapacityHours: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type SkillCategory = {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  color: string | null;
  order: number | null;
  createdAt: string;
};

type Skill = {
  id: number;
  tenantId: number;
  categoryId: number | null;
  name: string;
  description: string | null;
  createdAt: string;
};

type ResourceSkill = {
  id: number;
  resourceId: number;
  skillId: number;
  proficiencyLevel: string | null;
  yearsExperience: string | null;
  notes: string | null;
  createdAt: string;
};

type ResourceAllocation = {
  id: number;
  tenantId: number;
  resourceId: number;
  projectId: number | null;
  projectName: string | null;
  allocationType: string | null;
  allocationPercentage: string | null;
  hoursPerWeek: string | null;
  role: string | null;
  startDate: string;
  endDate: string;
  notes: string | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
};

type TimesheetPeriod = {
  id: number;
  tenantId: number;
  resourceId: number;
  weekStartDate: string;
  weekEndDate: string;
  status: string | null;
  totalHours: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type TimesheetEntry = {
  id: number;
  timesheetPeriodId: number;
  resourceId: number;
  projectId: number | null;
  projectName: string | null;
  activityType: string | null;
  departmentCode: string | null;
  dayOfWeek: number;
  hours: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectCode = {
  id: number;
  tenantId: number;
  code: string;
  name: string;
  description: string | null;
  type: string | null;
  isActive: boolean | null;
  departmentCode: string | null;
  createdAt: string;
};

const proficiencyLevels = [
  { value: "beginner", label: "Beginner", color: "bg-status-blue text-status-blue-foreground" },
  { value: "intermediate", label: "Intermediate", color: "bg-status-green text-status-green-foreground" },
  { value: "advanced", label: "Advanced", color: "bg-status-purple text-status-purple-foreground" },
  { value: "expert", label: "Expert", color: "bg-status-amber text-status-amber-foreground" },
];

const statusColors: Record<string, string> = {
  available: "bg-status-green text-status-green-foreground",
  "partially-allocated": "bg-status-amber text-status-amber-foreground",
  "fully-allocated": "bg-status-red text-status-red-foreground",
  "on-leave": "bg-status-blue text-status-blue-foreground",
  inactive: "bg-muted text-muted-foreground",
};

const getInitials = (first: string, last: string) =>
  `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

const getProficiencyConfig = (level: string | null) =>
  proficiencyLevels.find((p) => p.value === level) || proficiencyLevels[1];

function DashboardTab({ stats, resources, allocations }: {
  stats: ResourceStats | undefined;
  resources: Resource[];
  allocations: ResourceAllocation[];
}) {
  const now = new Date();
  const activeAllocations = allocations.filter(
    (a) => a.status === "active" && new Date(a.startDate) <= now && new Date(a.endDate) >= now
  );

  const resourceUtilMap = useMemo(() => {
    const map: Record<number, number> = {};
    activeAllocations.forEach((a) => {
      const pct = Number(a.allocationPercentage) || 0;
      map[a.resourceId] = (map[a.resourceId] || 0) + pct;
    });
    return map;
  }, [activeAllocations]);

  const capacityData = useMemo(() => {
    const weeks: { label: string; available: number; allocated: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() + i * 7 - weekStart.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 4);

      let totalCapacity = 0;
      let totalAllocated = 0;
      resources.forEach((r) => {
        const cap = Number(r.weeklyCapacityHours) || 40;
        totalCapacity += cap;
        const util = resourceUtilMap[r.id] || 0;
        totalAllocated += (cap * util) / 100;
      });

      weeks.push({
        label: `Week ${i + 1}`,
        available: Math.round(totalCapacity - totalAllocated),
        allocated: Math.round(totalAllocated),
      });
    }
    return weeks;
  }, [resources, resourceUtilMap]);

  const burnoutRisks = resources.filter((r) => (resourceUtilMap[r.id] || 0) > 90);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="stat-total-resources">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Resources</p>
                <p className="text-3xl font-bold">{stats?.totalResources || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-avg-utilization">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Utilization</p>
                <p className="text-3xl font-bold">{stats?.avgUtilization || 0}%</p>
              </div>
              <div className="p-3 rounded-xl bg-brand-green/10">
                <Activity className="h-6 w-6 text-brand-green" />
              </div>
            </div>
            <Progress value={stats?.avgUtilization || 0} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card data-testid="stat-overallocated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Over-Allocated</p>
                <p className="text-3xl font-bold">{stats?.overAllocated || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-pending-approvals">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <p className="text-3xl font-bold">{stats?.pendingTimesheetApprovals || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-brand-orange/10">
                <Clock className="h-6 w-6 text-brand-orange" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              4-Week Capacity Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {capacityData.map((week, i) => {
                const total = week.available + week.allocated;
                const utilizationPct = total > 0 ? Math.round((week.allocated / total) * 100) : 0;
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{week.label}</span>
                      <span className="text-muted-foreground">{utilizationPct}% utilized</span>
                    </div>
                    <div className="flex h-6 rounded-md overflow-hidden bg-muted">
                      <div
                        className={cn("transition-all", utilizationPct > 90 ? "bg-destructive" : utilizationPct > 75 ? "bg-brand-orange" : "bg-brand-green")}
                        style={{ width: `${utilizationPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{week.allocated}h allocated</span>
                      <span>{week.available}h available</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-brand-orange" />
              Alerts & Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {burnoutRisks.length > 0 ? (
                burnoutRisks.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-status-red/40 border border-destructive/20" data-testid={`alert-burnout-${r.id}`}>
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Burnout Risk: {r.firstName} {r.lastName}</p>
                      <p className="text-xs text-muted-foreground">{resourceUtilMap[r.id]}% allocated - exceeds safe threshold</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-status-green/40 border border-brand-green/20">
                  <CheckCircle2 className="h-4 w-4 text-brand-green shrink-0" />
                  <p className="text-sm">No burnout risks detected. Team is within healthy utilization.</p>
                </div>
              )}

              {(stats?.pendingTimesheetApprovals || 0) > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-status-amber/40 border border-brand-orange/20">
                  <Clock className="h-4 w-4 text-brand-orange shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{stats?.pendingTimesheetApprovals} timesheets awaiting approval</p>
                    <p className="text-xs text-muted-foreground">Review and approve submitted timesheets</p>
                  </div>
                </div>
              )}

              {resources.length === 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-status-blue/40 border border-primary/20">
                  <Users className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Get started</p>
                    <p className="text-xs text-muted-foreground">Add your first resource in the People tab</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Resource Utilization Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Add resources to see utilization data</p>
          ) : (
            <div className="space-y-3">
              {resources.slice(0, 10).map((r) => {
                const util = resourceUtilMap[r.id] || 0;
                return (
                  <div key={r.id} className="flex items-center gap-3" data-testid={`util-row-${r.id}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={r.photoUrl || undefined} />
                      <AvatarFallback className="text-xs">{getInitials(r.firstName, r.lastName)}</AvatarFallback>
                    </Avatar>
                    <div className="w-32 truncate">
                      <p className="text-sm font-medium">{r.firstName} {r.lastName}</p>
                      <p className="text-xs text-muted-foreground">{r.jobTitle || r.department || "—"}</p>
                    </div>
                    <div className="flex-1">
                      <Progress value={Math.min(util, 100)} className="h-2" />
                    </div>
                    <Badge className={cn("text-xs min-w-[48px] justify-center", util > 100 ? "bg-status-red text-status-red-foreground" : util > 75 ? "bg-status-amber text-status-amber-foreground" : "bg-status-green text-status-green-foreground")}>
                      {util}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PeopleTab({
  resources, skills: allSkills, skillCategories: categories, searchTerm,
  onCreateResource, onUpdateResource, onDeleteResource,
  onAddSkill, onRemoveSkill,
}: {
  resources: Resource[];
  skills: Skill[];
  skillCategories: SkillCategory[];
  searchTerm: string;
  onCreateResource: (data: any) => void;
  onUpdateResource: (id: number, data: any) => void;
  onDeleteResource: (id: number) => void;
  onAddSkill: (data: any) => void;
  onRemoveSkill: (id: number) => void;
}) {
  const { toast } = useToast();
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"list" | "matrix">("list");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showImportSettingsDialog, setShowImportSettingsDialog] = useState(false);
  const [settingsUsers, setSettingsUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isLoadingSettingsUsers, setIsLoadingSettingsUsers] = useState(false);
  const [isImportingUsers, setIsImportingUsers] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "", jobTitle: "",
    department: "", location: "", employmentType: "full-time", status: "available",
    costRate: "", billRate: "", weeklyCapacityHours: "40", notes: "",
  });

  const { data: allResourceSkills = {} } = useQuery<Record<number, ResourceSkill[]>>({
    queryKey: ["/api/resources/all-skills-map"],
    queryFn: async () => {
      const map: Record<number, ResourceSkill[]> = {};
      for (const r of resources) {
        const resp = await fetch(`/api/resources/${r.id}/skills`, { credentials: "include" });
        if (resp.ok) map[r.id] = await resp.json();
      }
      return map;
    },
    enabled: resources.length > 0,
  });

  const filtered = resources.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.firstName.toLowerCase().includes(term) ||
      r.lastName.toLowerCase().includes(term) ||
      (r.email || "").toLowerCase().includes(term) ||
      (r.jobTitle || "").toLowerCase().includes(term) ||
      (r.department || "").toLowerCase().includes(term)
    );
  });

  const resetForm = () => {
    setFormData({
      firstName: "", lastName: "", email: "", phone: "", jobTitle: "",
      department: "", location: "", employmentType: "full-time", status: "available",
      costRate: "", billRate: "", weeklyCapacityHours: "40", notes: "",
    });
  };

  const handleCreate = () => {
    onCreateResource(formData);
    setShowCreateDialog(false);
    resetForm();
  };

  const handleOpenImportSettings = async () => {
    setIsLoadingSettingsUsers(true);
    setShowImportSettingsDialog(true);
    setSelectedUserIds(new Set());
    try {
      const resp = await fetch("/api/admin/users", { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to fetch users");
      const users = await resp.json();
      const existingEmails = new Set(resources.map((r) => r.email?.toLowerCase()).filter(Boolean));
      const filtered = users.filter((u: any) => u.email && !existingEmails.has(u.email.toLowerCase()));
      setSettingsUsers(filtered);
    } catch {
      toast({ title: "Failed to load users from settings", variant: "destructive" });
      setShowImportSettingsDialog(false);
    } finally {
      setIsLoadingSettingsUsers(false);
    }
  };

  const handleImportSelectedUsers = async () => {
    if (selectedUserIds.size === 0) return;
    setIsImportingUsers(true);
    let successCount = 0;
    let failCount = 0;
    for (const userId of Array.from(selectedUserIds)) {
      const user = settingsUsers.find((u) => u.id === userId);
      if (!user) continue;
      try {
        await apiRequest("POST", "/api/resources", {
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email || "",
          jobTitle: user.jobTitle || "",
          department: user.department || "",
        });
        successCount++;
      } catch {
        failCount++;
      }
    }
    setIsImportingUsers(false);
    setShowImportSettingsDialog(false);
    queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
    queryClient.invalidateQueries({ queryKey: ["/api/resources/stats"] });
    toast({
      title: `Imported ${successCount} resource${successCount !== 1 ? "s" : ""}`,
      description: failCount > 0 ? `${failCount} failed to import.` : undefined,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAllUsers = () => {
    if (selectedUserIds.size === settingsUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(settingsUsers.map((u) => u.id)));
    }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        toast({ title: "CSV file is empty or has no data rows", variant: "destructive" });
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
      const firstNameIdx = headers.findIndex((h) => h === "first name" || h === "firstname");
      const lastNameIdx = headers.findIndex((h) => h === "last name" || h === "lastname");
      const emailIdx = headers.findIndex((h) => h === "email");
      const jobTitleIdx = headers.findIndex((h) => h === "job title" || h === "jobtitle");
      const departmentIdx = headers.findIndex((h) => h === "department");

      if (firstNameIdx === -1 || lastNameIdx === -1) {
        toast({ title: "CSV must have 'First Name' and 'Last Name' columns", variant: "destructive" });
        return;
      }

      let successCount = 0;
      let failCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
        const firstName = cols[firstNameIdx] || "";
        const lastName = cols[lastNameIdx] || "";
        if (!firstName && !lastName) continue;
        try {
          await apiRequest("POST", "/api/resources", {
            firstName,
            lastName,
            email: emailIdx >= 0 ? cols[emailIdx] || "" : "",
            jobTitle: jobTitleIdx >= 0 ? cols[jobTitleIdx] || "" : "",
            department: departmentIdx >= 0 ? cols[departmentIdx] || "" : "",
          });
          successCount++;
        } catch {
          failCount++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resources/stats"] });
      toast({
        title: `Imported ${successCount} resource${successCount !== 1 ? "s" : ""} from CSV`,
        description: failCount > 0 ? `${failCount} failed to import.` : undefined,
        variant: failCount > 0 ? "destructive" : "default",
      });
    };
    reader.readAsText(file);
    if (csvFileInputRef.current) csvFileInputRef.current.value = "";
  };

  const handleExportCsv = () => {
    const headers = ["First Name", "Last Name", "Email", "Job Title", "Department", "Location", "Status", "Employment Type"];
    const rows = resources.map((r) => [
      r.firstName, r.lastName, r.email || "", r.jobTitle || "", r.department || "",
      r.location || "", r.status || "", r.employmentType || "",
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.map((v) => `"${(v || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resources-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Resources exported to CSV" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            data-testid="button-view-list"
          >
            <List className="h-4 w-4 mr-1" />
            Resource List
          </Button>
          <Button
            variant={viewMode === "matrix" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("matrix")}
            data-testid="button-view-matrix"
          >
            <Grid3X3 className="h-4 w-4 mr-1" />
            Skills Matrix
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleOpenImportSettings} data-testid="button-import-settings">
            <UserCheck className="h-4 w-4 mr-1" />
            Import from Settings
          </Button>
          <Button variant="outline" onClick={() => csvFileInputRef.current?.click()} data-testid="button-import-csv">
            <Upload className="h-4 w-4 mr-1" />
            Import CSV
          </Button>
          <Button variant="outline" onClick={handleExportCsv} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-resource">
            <Plus className="h-4 w-4 mr-1" />
            Add Resource
          </Button>
          <input
            ref={csvFileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvImport}
            data-testid="input-csv-file"
          />
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-lg font-medium">No resources yet</p>
                <p className="text-sm text-muted-foreground mb-4">Add your first team member to get started</p>
                <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-first-resource">
                  <Plus className="h-4 w-4 mr-1" /> Add Resource
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/20 bg-muted/30">
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role / Dept</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Skills</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Rate</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => {
                        const rSkills = allResourceSkills[r.id] || [];
                        return (
                          <tr
                            key={r.id}
                            className="border-b border-border/30 hover-elevate cursor-pointer"
                            onClick={() => { setSelectedResource(r); setShowProfilePanel(true); }}
                            data-testid={`resource-row-${r.id}`}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={r.photoUrl || undefined} />
                                  <AvatarFallback className="text-xs">{getInitials(r.firstName, r.lastName)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{r.firstName} {r.lastName}</p>
                                  <p className="text-xs text-muted-foreground">{r.email || "—"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <p className="text-sm">{r.jobTitle || "—"}</p>
                              <p className="text-xs text-muted-foreground">{r.department || "—"}</p>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {r.location || "—"}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {rSkills.slice(0, 3).map((rs) => {
                                  const skill = allSkills.find((s) => s.id === rs.skillId);
                                  const prof = getProficiencyConfig(rs.proficiencyLevel);
                                  return (
                                    <Badge key={rs.id} variant="outline" className={cn("text-xs", prof.color)}>
                                      {skill?.name || "Unknown"}
                                    </Badge>
                                  );
                                })}
                                {rSkills.length > 3 && (
                                  <Badge variant="outline" className="text-xs">+{rSkills.length - 3}</Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge className={cn("text-xs", statusColors[r.status || "available"])}>
                                {(r.status || "available").replace("-", " ")}
                              </Badge>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {r.billRate ? `$${Number(r.billRate).toFixed(0)}/hr` : "—"}
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); onDeleteResource(r.id); }}
                                data-testid={`button-delete-resource-${r.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <SkillsMatrixView resources={filtered} skills={allSkills} categories={categories} resourceSkills={allResourceSkills} />
      )}

      {showProfilePanel && selectedResource && (
        <ResourceProfilePanel
          resource={selectedResource}
          skills={allSkills}
          resourceSkills={allResourceSkills[selectedResource.id] || []}
          onClose={() => { setShowProfilePanel(false); setSelectedResource(null); }}
          onAddSkill={onAddSkill}
          onRemoveSkill={onRemoveSkill}
        />
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <SubmitForm onSubmit={handleCreate} disabled={!formData.firstName || !formData.lastName}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Add Resource
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} data-testid="input-first-name" />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} data-testid="input-last-name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} data-testid="input-email" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} data-testid="input-phone" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Job Title</Label>
                <Input value={formData.jobTitle} onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })} data-testid="input-job-title" />
              </div>
              <div>
                <Label>Department</Label>
                <Input value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} data-testid="input-department" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Location</Label>
                <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} data-testid="input-location" />
              </div>
              <div>
                <Label>Employment Type</Label>
                <Select value={formData.employmentType} onValueChange={(v) => setFormData({ ...formData, employmentType: v })}>
                  <SelectTrigger data-testid="select-employment-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Cost Rate ($/hr)</Label>
                <Input type="number" value={formData.costRate} onChange={(e) => setFormData({ ...formData, costRate: e.target.value })} data-testid="input-cost-rate" />
              </div>
              <div>
                <Label>Bill Rate ($/hr)</Label>
                <Input type="number" value={formData.billRate} onChange={(e) => setFormData({ ...formData, billRate: e.target.value })} data-testid="input-bill-rate" />
              </div>
              <div>
                <Label>Weekly Hours</Label>
                <Input type="number" value={formData.weeklyCapacityHours} onChange={(e) => setFormData({ ...formData, weeklyCapacityHours: e.target.value })} data-testid="input-weekly-hours" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} data-testid="input-notes" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" data-testid="button-save-resource">
              Add Resource
            </Button>
          </DialogFooter>
          </SubmitForm>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportSettingsDialog} onOpenChange={setShowImportSettingsDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Import from Settings
            </DialogTitle>
            <DialogDescription>
              Select users from your organisation settings to import as resources.
            </DialogDescription>
          </DialogHeader>
          {isLoadingSettingsUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : settingsUsers.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No new users found to import. All settings users are already added as resources.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                <Checkbox
                  checked={selectedUserIds.size === settingsUsers.length && settingsUsers.length > 0}
                  onCheckedChange={toggleAllUsers}
                  data-testid="checkbox-select-all-users"
                />
                <span className="text-sm font-medium">Select All ({settingsUsers.length} users)</span>
              </div>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {settingsUsers.map((user: any) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                      onClick={() => toggleUserSelection(user.id)}
                      data-testid={`import-user-row-${user.id}`}
                    >
                      <Checkbox
                        checked={selectedUserIds.has(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {`${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {user.firstName || ""} {user.lastName || ""}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user.email || ""}</p>
                      </div>
                      {user.department && (
                        <Badge variant="secondary" className="text-xs">{user.department}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleImportSelectedUsers}
              disabled={selectedUserIds.size === 0 || isImportingUsers}
              data-testid="button-confirm-import-settings"
            >
              {isImportingUsers && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Import {selectedUserIds.size > 0 ? `${selectedUserIds.size} User${selectedUserIds.size !== 1 ? "s" : ""}` : "Selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkillsMatrixView({ resources, skills, categories, resourceSkills }: {
  resources: Resource[];
  skills: Skill[];
  categories: SkillCategory[];
  resourceSkills: Record<number, ResourceSkill[]>;
}) {
  const skillsByCategory = useMemo(() => {
    const map: Record<number, Skill[]> = {};
    const uncategorized: Skill[] = [];
    skills.forEach((s) => {
      if (s.categoryId) {
        if (!map[s.categoryId]) map[s.categoryId] = [];
        map[s.categoryId].push(s);
      } else {
        uncategorized.push(s);
      }
    });
    return { categorized: map, uncategorized };
  }, [skills]);

  const allSkillsFlat = [...skills];

  if (allSkillsFlat.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-lg font-medium">No skills defined</p>
          <p className="text-sm text-muted-foreground">Create skill categories and skills to build the matrix</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider sticky left-0 bg-muted z-10 min-w-[200px]">Resource</th>
                {allSkillsFlat.map((s) => (
                  <th key={s.id} className="p-2 text-xs font-medium text-muted-foreground text-center min-w-[80px]">
                    <div className="transform -rotate-45 origin-center whitespace-nowrap">{s.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => {
                const rSkills = resourceSkills[r.id] || [];
                return (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="p-3 sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">{getInitials(r.firstName, r.lastName)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{r.firstName} {r.lastName}</span>
                      </div>
                    </td>
                    {allSkillsFlat.map((s) => {
                      const match = rSkills.find((rs) => rs.skillId === s.id);
                      const prof = match ? getProficiencyConfig(match.proficiencyLevel) : null;
                      return (
                        <td key={s.id} className="p-2 text-center">
                          {prof ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <div className={cn("w-6 h-6 mx-auto rounded-full flex items-center justify-center text-[10px] font-bold", prof.color)}>
                                  {prof.label[0]}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>{prof.label}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <div className="w-6 h-6 mx-auto rounded-full bg-muted/50" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceProfilePanel({ resource, skills, resourceSkills, onClose, onAddSkill, onRemoveSkill }: {
  resource: Resource;
  skills: Skill[];
  resourceSkills: ResourceSkill[];
  onClose: () => void;
  onAddSkill: (data: any) => void;
  onRemoveSkill: (id: number) => void;
}) {
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkillId, setNewSkillId] = useState("");
  const [newProficiency, setNewProficiency] = useState("intermediate");

  const availableSkills = skills.filter((s) => !resourceSkills.some((rs) => rs.skillId === s.id));

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] bg-background border-l border-border/30 shadow-xl z-50 flex flex-col" data-testid="resource-profile-panel">
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Resource Profile
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-profile">
          <XCircle className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={resource.photoUrl || undefined} />
              <AvatarFallback className="text-xl">{getInitials(resource.firstName, resource.lastName)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{resource.firstName} {resource.lastName}</h2>
              <p className="text-sm text-muted-foreground">{resource.jobTitle || "No title"}</p>
              <Badge className={cn("text-xs mt-1", statusColors[resource.status || "available"])}>
                {(resource.status || "available").replace("-", " ")}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{resource.email || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p className="font-medium">{resource.phone || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Department</p>
              <p className="font-medium">{resource.department || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Location</p>
              <p className="font-medium">{resource.location || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Employment</p>
              <p className="font-medium capitalize">{resource.employmentType || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Weekly Capacity</p>
              <p className="font-medium">{resource.weeklyCapacityHours || "40"}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cost Rate</p>
              <p className="font-medium">{resource.costRate ? `$${Number(resource.costRate).toFixed(2)}/hr` : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Bill Rate</p>
              <p className="font-medium">{resource.billRate ? `$${Number(resource.billRate).toFixed(2)}/hr` : "—"}</p>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                Skills
              </h4>
              <Button variant="outline" size="sm" onClick={() => setShowAddSkill(!showAddSkill)} data-testid="button-toggle-add-skill">
                <Plus className="h-3 w-3 mr-1" />
                Add Skill
              </Button>
            </div>

            {showAddSkill && (
              <div className="flex items-end gap-2 mb-3 p-3 rounded-lg bg-muted/30">
                <div className="flex-1">
                  <Label className="text-xs">Skill</Label>
                  <Select value={newSkillId} onValueChange={setNewSkillId}>
                    <SelectTrigger data-testid="select-new-skill"><SelectValue placeholder="Select skill" /></SelectTrigger>
                    <SelectContent>
                      {availableSkills.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-36">
                  <Label className="text-xs">Proficiency</Label>
                  <Select value={newProficiency} onValueChange={setNewProficiency}>
                    <SelectTrigger data-testid="select-proficiency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {proficiencyLevels.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  disabled={!newSkillId}
                  onClick={() => {
                    onAddSkill({ resourceId: resource.id, skillId: Number(newSkillId), proficiencyLevel: newProficiency });
                    setNewSkillId("");
                    setShowAddSkill(false);
                  }}
                  data-testid="button-save-skill"
                >
                  Add
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {resourceSkills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No skills assigned yet</p>
              ) : (
                resourceSkills.map((rs) => {
                  const skill = skills.find((s) => s.id === rs.skillId);
                  const prof = getProficiencyConfig(rs.proficiencyLevel);
                  return (
                    <div key={rs.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30" data-testid={`skill-item-${rs.id}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{skill?.name || "Unknown"}</span>
                        <Badge className={cn("text-xs", prof.color)}>{prof.label}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => onRemoveSkill(rs.id)} data-testid={`button-remove-skill-${rs.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function AllocationsTab({ resources, allocations, onCreateAllocation, onUpdateAllocation, onDeleteAllocation }: {
  resources: Resource[];
  allocations: ResourceAllocation[];
  onCreateAllocation: (data: any) => void;
  onUpdateAllocation: (id: number, data: any) => void;
  onDeleteAllocation: (id: number) => void;
}) {
  const [viewMode, setViewMode] = useState<"by-project" | "by-resource">("by-resource");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    resourceId: "", projectName: "", allocationType: "hard",
    allocationPercentage: "100", hoursPerWeek: "", role: "",
    startDate: "", endDate: "", notes: "",
  });

  const now = new Date();

  const activeAllocations = allocations.filter(
    (a) => a.status === "active"
  );

  const byResource = useMemo(() => {
    const map: Record<number, ResourceAllocation[]> = {};
    activeAllocations.forEach((a) => {
      if (!map[a.resourceId]) map[a.resourceId] = [];
      map[a.resourceId].push(a);
    });
    return map;
  }, [activeAllocations]);

  const byProject = useMemo(() => {
    const map: Record<string, ResourceAllocation[]> = {};
    activeAllocations.forEach((a) => {
      const key = a.projectName || "Unassigned";
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [activeAllocations]);

  const timelineStart = new Date();
  timelineStart.setDate(timelineStart.getDate() - timelineStart.getDay() + 1);
  const weeks: Date[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(timelineStart);
    d.setDate(d.getDate() + i * 7);
    weeks.push(d);
  }

  const getBarStyle = (allocation: ResourceAllocation) => {
    const start = new Date(allocation.startDate);
    const end = new Date(allocation.endDate);
    const timelineEndDate = new Date(timelineStart);
    timelineEndDate.setDate(timelineEndDate.getDate() + 12 * 7);

    const totalDays = 12 * 7;
    const startOffset = Math.max(0, Math.floor((start.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
    const endOffset = Math.min(totalDays, Math.ceil((end.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));

    if (startOffset >= totalDays || endOffset <= 0) return null;

    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${((endOffset - startOffset) / totalDays) * 100}%`,
    };
  };

  const handleCreate = () => {
    onCreateAllocation({
      ...formData,
      resourceId: Number(formData.resourceId),
    });
    setShowCreateDialog(false);
    setFormData({
      resourceId: "", projectName: "", allocationType: "hard",
      allocationPercentage: "100", hoursPerWeek: "", role: "",
      startDate: "", endDate: "", notes: "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "by-resource" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("by-resource")}
            data-testid="button-view-by-resource"
          >
            <Users className="h-4 w-4 mr-1" />
            By Resource
          </Button>
          <Button
            variant={viewMode === "by-project" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("by-project")}
            data-testid="button-view-by-project"
          >
            <Briefcase className="h-4 w-4 mr-1" />
            By Project
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span>Confirmed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary/40 border border-dashed border-primary" />
              <span>Tentative</span>
            </div>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-allocation">
            <Plus className="h-4 w-4 mr-1" />
            Add Allocation
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="flex border-b border-border/20 bg-muted/30">
                <div className="w-[240px] shrink-0 p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {viewMode === "by-resource" ? "Resource" : "Project"}
                </div>
                <div className="flex-1 flex">
                  {weeks.map((w, i) => (
                    <div key={i} className="flex-1 p-2 text-center text-xs text-muted-foreground border-l border-border/20">
                      {w.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  ))}
                </div>
              </div>

              {viewMode === "by-resource" ? (
                resources.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No resources added yet</div>
                ) : (
                  resources.map((r) => {
                    const rAllocs = byResource[r.id] || [];
                    const totalPct = rAllocs.reduce((sum, a) => sum + (Number(a.allocationPercentage) || 0), 0);
                    return (
                      <div key={r.id} className="flex border-b border-border/30" data-testid={`alloc-resource-row-${r.id}`}>
                        <div className="w-[240px] shrink-0 p-3 flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">{getInitials(r.firstName, r.lastName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.firstName} {r.lastName}</p>
                            <p className="text-xs text-muted-foreground">{totalPct}% allocated</p>
                          </div>
                          {totalPct > 100 && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>Over-allocated ({totalPct}%)</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="flex-1 relative min-h-[48px]">
                          {weeks.map((_, i) => (
                            <div key={i} className="absolute top-0 bottom-0 border-l border-border/20" style={{ left: `${(i / 12) * 100}%` }} />
                          ))}
                          {rAllocs.map((a) => {
                            const style = getBarStyle(a);
                            if (!style) return null;
                            return (
                              <Tooltip key={a.id}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "absolute top-2 h-7 rounded-md flex items-center px-2 text-xs font-medium text-primary-foreground cursor-pointer",
                                      a.allocationType === "hard"
                                        ? "bg-primary"
                                        : "bg-primary/40 border border-dashed border-primary text-primary"
                                    )}
                                    style={style}
                                    data-testid={`alloc-bar-${a.id}`}
                                  >
                                    <span className="truncate">{a.projectName || "Unnamed"} ({a.allocationPercentage}%)</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs space-y-1">
                                    <p className="font-medium">{a.projectName || "Unnamed"}</p>
                                    <p>{a.allocationPercentage}% - {a.allocationType}</p>
                                    <p>{new Date(a.startDate).toLocaleDateString()} - {new Date(a.endDate).toLocaleDateString()}</p>
                                    {a.role && <p>Role: {a.role}</p>}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                Object.keys(byProject).length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No allocations yet</div>
                ) : (
                  Object.entries(byProject).map(([projectName, allocs]) => (
                    <div key={projectName}>
                      <div className="flex border-b border-border/20 bg-muted/10">
                        <div className="w-[240px] shrink-0 p-3">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-primary" />
                            {projectName}
                          </p>
                          <p className="text-xs text-muted-foreground">{allocs.length} resource{allocs.length !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="flex-1 relative min-h-[20px]">
                          {weeks.map((_, i) => (
                            <div key={i} className="absolute top-0 bottom-0 border-l border-border/20" style={{ left: `${(i / 12) * 100}%` }} />
                          ))}
                        </div>
                      </div>
                      {allocs.map((a) => {
                        const r = resources.find((res) => res.id === a.resourceId);
                        const style = getBarStyle(a);
                        return (
                          <div key={a.id} className="flex border-b border-border/30" data-testid={`alloc-project-row-${a.id}`}>
                            <div className="w-[240px] shrink-0 p-3 pl-8 flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px]">{r ? getInitials(r.firstName, r.lastName) : "?"}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm truncate">{r ? `${r.firstName} ${r.lastName}` : "Unknown"}</p>
                                <p className="text-xs text-muted-foreground">{a.role || "—"} / {a.allocationPercentage}%</p>
                              </div>
                            </div>
                            <div className="flex-1 relative min-h-[40px]">
                              {weeks.map((_, i) => (
                                <div key={i} className="absolute top-0 bottom-0 border-l border-border/20" style={{ left: `${(i / 12) * 100}%` }} />
                              ))}
                              {style && (
                                <div
                                  className={cn(
                                    "absolute top-1.5 h-6 rounded-md flex items-center px-2 text-xs font-medium text-primary-foreground",
                                    a.allocationType === "hard" ? "bg-primary" : "bg-primary/40 border border-dashed border-primary text-primary"
                                  )}
                                  style={style}
                                >
                                  <span className="truncate">{a.allocationPercentage}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Create Allocation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Resource *</Label>
              <Select value={formData.resourceId} onValueChange={(v) => setFormData({ ...formData, resourceId: v })}>
                <SelectTrigger data-testid="select-allocation-resource"><SelectValue placeholder="Select resource" /></SelectTrigger>
                <SelectContent>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.firstName} {r.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project Name *</Label>
              <Input value={formData.projectName} onChange={(e) => setFormData({ ...formData, projectName: e.target.value })} data-testid="input-project-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={formData.allocationType} onValueChange={(v) => setFormData({ ...formData, allocationType: v })}>
                  <SelectTrigger data-testid="select-alloc-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hard">Confirmed</SelectItem>
                    <SelectItem value="soft">Tentative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Allocation %</Label>
                <Input type="number" value={formData.allocationPercentage} onChange={(e) => setFormData({ ...formData, allocationPercentage: e.target.value })} data-testid="input-allocation-pct" />
              </div>
            </div>
            <div>
              <Label>Role</Label>
              <Input value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} data-testid="input-allocation-role" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} data-testid="input-start-date" />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} data-testid="input-end-date" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} data-testid="input-allocation-notes" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleCreate} disabled={!formData.resourceId || !formData.projectName || !formData.startDate || !formData.endDate} data-testid="button-save-allocation">
              Create Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimesheetsTab({ resources, timesheetPeriods, allocations, onCreatePeriod, onUpdatePeriod, onCreateEntry, onUpdateEntry }: {
  resources: Resource[];
  timesheetPeriods: TimesheetPeriod[];
  allocations: ResourceAllocation[];
  onCreatePeriod: (data: any) => void;
  onUpdatePeriod: (id: number, data: any) => void;
  onCreateEntry: (periodId: number, data: any) => void;
  onUpdateEntry: (id: number, data: any) => void;
}) {
  const [viewMode, setViewMode] = useState<"entry" | "approval">("entry");
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

  const { data: periodEntries = [] } = useQuery<TimesheetEntry[]>({
    queryKey: ["/api/resources/timesheets", selectedPeriodId, "entries"],
    queryFn: async () => {
      if (!selectedPeriodId) return [];
      const resp = await fetch(`/api/resources/timesheets/${selectedPeriodId}/entries`, { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!selectedPeriodId,
  });

  const selectedResource = resources.find((r) => String(r.id) === selectedResourceId);
  const resourcePeriods = timesheetPeriods.filter((p) => String(p.resourceId) === selectedResourceId);
  const selectedPeriod = timesheetPeriods.find((p) => p.id === selectedPeriodId);

  const pendingApprovals = timesheetPeriods.filter((p) => p.status === "submitted");

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const getWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split("T")[0];
  };

  const handleCreateCurrentWeek = () => {
    if (!selectedResourceId) return;
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    onCreatePeriod({
      tenantId: 1,
      resourceId: Number(selectedResourceId),
      weekStartDate: weekStart,
      weekEndDate: weekEnd.toISOString().split("T")[0],
      status: "draft",
    });
  };

  const entriesByProject = useMemo(() => {
    const map: Record<string, TimesheetEntry[]> = {};
    periodEntries.forEach((e) => {
      const key = e.projectName || "General";
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [periodEntries]);

  const projectTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(entriesByProject).forEach(([project, entries]) => {
      totals[project] = entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
    });
    return totals;
  }, [entriesByProject]);

  const dayTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (let i = 0; i < 7; i++) totals[i] = 0;
    periodEntries.forEach((e) => {
      totals[e.dayOfWeek] = (totals[e.dayOfWeek] || 0) + (Number(e.hours) || 0);
    });
    return totals;
  }, [periodEntries]);

  const grandTotal = periodEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "entry" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("entry")}
            data-testid="button-timesheet-entry"
          >
            <Timer className="h-4 w-4 mr-1" />
            Time Entry
          </Button>
          <Button
            variant={viewMode === "approval" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("approval")}
            data-testid="button-timesheet-approval"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Approvals
            {pendingApprovals.length > 0 && (
              <Badge className="ml-1 bg-status-red text-status-red-foreground">{pendingApprovals.length}</Badge>
            )}
          </Button>
        </div>
      </div>

      {viewMode === "entry" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-64">
              <Select value={selectedResourceId} onValueChange={(v) => { setSelectedResourceId(v); setSelectedPeriodId(null); }}>
                <SelectTrigger data-testid="select-timesheet-resource"><SelectValue placeholder="Select resource" /></SelectTrigger>
                <SelectContent>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.firstName} {r.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedResourceId && (
              <>
                <div className="w-64">
                  <Select value={selectedPeriodId ? String(selectedPeriodId) : ""} onValueChange={(v) => setSelectedPeriodId(Number(v))}>
                    <SelectTrigger data-testid="select-timesheet-period"><SelectValue placeholder="Select week" /></SelectTrigger>
                    <SelectContent>
                      {resourcePeriods.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {new Date(p.weekStartDate).toLocaleDateString()} - {new Date(p.weekEndDate).toLocaleDateString()}
                          {p.status !== "draft" && ` (${p.status})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={handleCreateCurrentWeek} data-testid="button-create-timesheet">
                  <Plus className="h-4 w-4 mr-1" />
                  Current Week
                </Button>
              </>
            )}
          </div>

          {selectedPeriod ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Timer className="h-4 w-4 text-primary" />
                    Timesheet: {new Date(selectedPeriod.weekStartDate).toLocaleDateString()} - {new Date(selectedPeriod.weekEndDate).toLocaleDateString()}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-xs",
                      selectedPeriod.status === "approved" ? "bg-status-green text-status-green-foreground" :
                      selectedPeriod.status === "submitted" ? "bg-status-blue text-status-blue-foreground" :
                      selectedPeriod.status === "rejected" ? "bg-status-red text-status-red-foreground" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {selectedPeriod.status}
                    </Badge>
                    {selectedPeriod.status === "draft" && (
                      <Button size="sm" onClick={() => onUpdatePeriod(selectedPeriod.id, { status: "submitted", submittedAt: new Date().toISOString(), totalHours: String(grandTotal) })} data-testid="button-submit-timesheet">
                        Submit for Approval
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/20 bg-muted/30">
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase w-[200px]">Project</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase w-[100px]">Type</th>
                        {dayNames.map((d, i) => (
                          <th key={i} className="text-center p-3 text-xs font-medium text-muted-foreground uppercase w-[70px]">{d}</th>
                        ))}
                        <th className="text-center p-3 text-xs font-medium text-muted-foreground uppercase w-[70px]">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(entriesByProject).map(([project, entries]) => (
                        <tr key={project} className="border-b border-border/20" data-testid={`timesheet-row-${project}`}>
                          <td className="p-3 text-sm font-medium">{project}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{entries[0]?.activityType || "billable"}</Badge>
                          </td>
                          {dayNames.map((_, dayIdx) => {
                            const entry = entries.find((e) => e.dayOfWeek === dayIdx);
                            return (
                              <td key={dayIdx} className="p-1 text-center">
                                <Input
                                  type="number"
                                  className="w-14 h-8 text-center text-sm mx-auto"
                                  value={entry ? Number(entry.hours) || "" : ""}
                                  onChange={(e) => {
                                    const hours = e.target.value;
                                    if (entry) {
                                      onUpdateEntry(entry.id, { hours });
                                    } else {
                                      onCreateEntry(selectedPeriod.id, {
                                        timesheetPeriodId: selectedPeriod.id,
                                        resourceId: Number(selectedResourceId),
                                        projectName: project,
                                        activityType: entries[0]?.activityType || "billable",
                                        dayOfWeek: dayIdx,
                                        hours,
                                      });
                                    }
                                  }}
                                  disabled={selectedPeriod.status !== "draft"}
                                  data-testid={`input-hours-${project}-${dayIdx}`}
                                />
                              </td>
                            );
                          })}
                          <td className="p-3 text-center text-sm font-semibold">{projectTotals[project] || 0}</td>
                        </tr>
                      ))}

                      {Object.keys(entriesByProject).length === 0 && (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-sm text-muted-foreground">
                            No time entries yet. Add a project row to start tracking time.
                          </td>
                        </tr>
                      )}

                      <tr className="bg-muted/30 font-semibold">
                        <td className="p-3 text-sm" colSpan={2}>Daily Total</td>
                        {dayNames.map((_, dayIdx) => (
                          <td key={dayIdx} className="p-3 text-center text-sm">{dayTotals[dayIdx] || 0}</td>
                        ))}
                        <td className="p-3 text-center text-sm">{grandTotal}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : selectedResourceId ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Timer className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-lg font-medium">Select or create a timesheet</p>
                <p className="text-sm text-muted-foreground mb-4">Choose a week from the dropdown or create a new one for the current week</p>
                <Button onClick={handleCreateCurrentWeek} data-testid="button-create-first-timesheet">
                  <Plus className="h-4 w-4 mr-1" /> Create Current Week Timesheet
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-lg font-medium">Select a resource</p>
                <p className="text-sm text-muted-foreground">Choose a team member to view or enter their timesheet</p>
              </CardContent>
            </Card>
          )}

          {selectedPeriod && selectedPeriod.status === "draft" && (
            <AddTimesheetRowForm
              periodId={selectedPeriod.id}
              resourceId={Number(selectedResourceId)}
              allocations={allocations.filter((a) => a.resourceId === Number(selectedResourceId))}
              existingProjects={Object.keys(entriesByProject)}
              onAddRow={(projectName, activityType) => {
                dayNames.forEach((_, dayIdx) => {
                  onCreateEntry(selectedPeriod.id, {
                    timesheetPeriodId: selectedPeriod.id,
                    resourceId: Number(selectedResourceId),
                    projectName,
                    activityType,
                    dayOfWeek: dayIdx,
                    hours: "0",
                  });
                });
              }}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Pending Approvals ({pendingApprovals.length})
          </h3>

          {pendingApprovals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-brand-green/40 mb-4" />
                <p className="text-lg font-medium">All caught up</p>
                <p className="text-sm text-muted-foreground">No timesheets pending approval</p>
              </CardContent>
            </Card>
          ) : (
            pendingApprovals.map((p) => {
              const r = resources.find((res) => res.id === p.resourceId);
              return (
                <Card key={p.id} data-testid={`approval-card-${p.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{r ? getInitials(r.firstName, r.lastName) : "?"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{r ? `${r.firstName} ${r.lastName}` : "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(p.weekStartDate).toLocaleDateString()} - {new Date(p.weekEndDate).toLocaleDateString()}
                          </p>
                          <p className="text-sm">{p.totalHours || "0"} hours total</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onUpdatePeriod(p.id, { status: "rejected", rejectionReason: "Needs revision" })}
                          data-testid={`button-reject-${p.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Return
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onUpdatePeriod(p.id, { status: "approved", approvedAt: new Date().toISOString() })}
                          data-testid={`button-approve-${p.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function AddTimesheetRowForm({ periodId, resourceId, allocations, existingProjects, onAddRow }: {
  periodId: number;
  resourceId: number;
  allocations: ResourceAllocation[];
  existingProjects: string[];
  onAddRow: (projectName: string, activityType: string) => void;
}) {
  const [projectName, setProjectName] = useState("");
  const [activityType, setActivityType] = useState("billable");

  const suggestedProjects = allocations
    .map((a) => a.projectName || "")
    .filter((name) => name && !existingProjects.includes(name));

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs">Add Project Row</Label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              data-testid="input-add-project-row"
            />
            {suggestedProjects.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestedProjects.map((name) => (
                  <Badge
                    key={name}
                    variant="outline"
                    className="text-xs cursor-pointer hover-elevate"
                    onClick={() => setProjectName(name)}
                  >
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="w-40">
            <Label className="text-xs">Activity Type</Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger data-testid="select-activity-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="billable">Billable</SelectItem>
                <SelectItem value="non-billable">Non-billable</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!projectName}
            onClick={() => { onAddRow(projectName, activityType); setProjectName(""); }}
            data-testid="button-add-project-row"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Row
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportsTab({ resources, allocations, timesheetPeriods }: {
  resources: Resource[];
  allocations: ResourceAllocation[];
  timesheetPeriods: TimesheetPeriod[];
}) {
  const [reportType, setReportType] = useState<"utilization" | "capacity" | "timesheets">("utilization");

  const now = new Date();
  const activeAllocations = allocations.filter(
    (a) => a.status === "active" && new Date(a.startDate) <= now && new Date(a.endDate) >= now
  );

  const resourceUtilMap = useMemo(() => {
    const map: Record<number, number> = {};
    activeAllocations.forEach((a) => {
      const pct = Number(a.allocationPercentage) || 0;
      map[a.resourceId] = (map[a.resourceId] || 0) + pct;
    });
    return map;
  }, [activeAllocations]);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    resources.forEach((r) => { if (r.department) depts.add(r.department); });
    return Array.from(depts);
  }, [resources]);

  const deptUtilization = useMemo(() => {
    return departments.map((dept) => {
      const deptResources = resources.filter((r) => r.department === dept);
      const avgUtil = deptResources.length > 0
        ? deptResources.reduce((sum, r) => sum + (resourceUtilMap[r.id] || 0), 0) / deptResources.length
        : 0;
      return { department: dept, count: deptResources.length, avgUtilization: Math.round(avgUtil) };
    });
  }, [departments, resources, resourceUtilMap]);

  const handleExportCSV = () => {
    let csvContent = "";
    if (reportType === "utilization") {
      csvContent = "Name,Department,Job Title,Utilization %\n";
      resources.forEach((r) => {
        csvContent += `"${r.firstName} ${r.lastName}","${r.department || ""}","${r.jobTitle || ""}",${resourceUtilMap[r.id] || 0}\n`;
      });
    } else if (reportType === "capacity") {
      csvContent = "Name,Weekly Capacity (hrs),Allocated %,Available Hours\n";
      resources.forEach((r) => {
        const cap = Number(r.weeklyCapacityHours) || 40;
        const util = resourceUtilMap[r.id] || 0;
        const available = Math.max(0, cap - (cap * util) / 100);
        csvContent += `"${r.firstName} ${r.lastName}",${cap},${util},${available.toFixed(1)}\n`;
      });
    } else {
      csvContent = "Name,Week,Status,Total Hours\n";
      timesheetPeriods.forEach((p) => {
        const r = resources.find((res) => res.id === p.resourceId);
        csvContent += `"${r ? `${r.firstName} ${r.lastName}` : "Unknown"}","${new Date(p.weekStartDate).toLocaleDateString()}","${p.status}",${p.totalHours || 0}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant={reportType === "utilization" ? "default" : "outline"} size="sm" onClick={() => setReportType("utilization")} data-testid="button-report-utilization">
            <Activity className="h-4 w-4 mr-1" /> Utilization
          </Button>
          <Button variant={reportType === "capacity" ? "default" : "outline"} size="sm" onClick={() => setReportType("capacity")} data-testid="button-report-capacity">
            <BarChart3 className="h-4 w-4 mr-1" /> Capacity
          </Button>
          <Button variant={reportType === "timesheets" ? "default" : "outline"} size="sm" onClick={() => setReportType("timesheets")} data-testid="button-report-timesheets">
            <FileText className="h-4 w-4 mr-1" /> Timesheets
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {reportType === "utilization" && (
        <div className="space-y-4">
          {deptUtilization.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {deptUtilization.map((d) => (
                <Card key={d.department}>
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium">{d.department}</p>
                    <p className="text-2xl font-bold">{d.avgUtilization}%</p>
                    <p className="text-xs text-muted-foreground">{d.count} resource{d.count !== 1 ? "s" : ""}</p>
                    <Progress value={d.avgUtilization} className="mt-2 h-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Individual Utilization</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/30">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Name</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Department</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Role</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Utilization</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => {
                    const util = resourceUtilMap[r.id] || 0;
                    return (
                      <tr key={r.id} className="border-b border-border/30" data-testid={`report-util-row-${r.id}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px]">{getInitials(r.firstName, r.lastName)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{r.firstName} {r.lastName}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{r.department || "—"}</td>
                        <td className="p-3 text-sm text-muted-foreground">{r.jobTitle || "—"}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(util, 100)} className="h-2 w-20" />
                            <span className="text-sm font-medium">{util}%</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge className={cn("text-xs", util > 100 ? "bg-status-red text-status-red-foreground" : util > 75 ? "bg-status-amber text-status-amber-foreground" : util > 0 ? "bg-status-green text-status-green-foreground" : "bg-muted text-muted-foreground")}>
                            {util > 100 ? "Over" : util > 75 ? "High" : util > 0 ? "Normal" : "Available"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {reportType === "capacity" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capacity Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/20 bg-muted/30">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Name</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Weekly Capacity</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Allocated</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Available</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Capacity</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => {
                  const cap = Number(r.weeklyCapacityHours) || 40;
                  const util = resourceUtilMap[r.id] || 0;
                  const allocatedHrs = (cap * util) / 100;
                  const available = Math.max(0, cap - allocatedHrs);
                  return (
                    <tr key={r.id} className="border-b border-border/30" data-testid={`report-cap-row-${r.id}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">{getInitials(r.firstName, r.lastName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{r.firstName} {r.lastName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm">{cap}h</td>
                      <td className="p-3 text-sm">{allocatedHrs.toFixed(1)}h ({util}%)</td>
                      <td className="p-3 text-sm font-medium text-brand-green">{available.toFixed(1)}h</td>
                      <td className="p-3">
                        <div className="w-full h-4 rounded-md overflow-hidden bg-muted flex">
                          <div className={cn("transition-all", util > 100 ? "bg-destructive" : util > 75 ? "bg-brand-orange" : "bg-brand-green")} style={{ width: `${Math.min(util, 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {reportType === "timesheets" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timesheet Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/20 bg-muted/30">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Resource</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Week</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Total Hours</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {timesheetPeriods.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">No timesheet data yet</td></tr>
                ) : (
                  timesheetPeriods.map((p) => {
                    const r = resources.find((res) => res.id === p.resourceId);
                    return (
                      <tr key={p.id} className="border-b border-border/30" data-testid={`report-ts-row-${p.id}`}>
                        <td className="p-3 text-sm font-medium">{r ? `${r.firstName} ${r.lastName}` : "Unknown"}</td>
                        <td className="p-3 text-sm">{new Date(p.weekStartDate).toLocaleDateString()} - {new Date(p.weekEndDate).toLocaleDateString()}</td>
                        <td className="p-3 text-sm font-medium">{p.totalHours || 0}h</td>
                        <td className="p-3">
                          <Badge className={cn("text-xs",
                            p.status === "approved" ? "bg-status-green text-status-green-foreground" :
                            p.status === "submitted" ? "bg-status-blue text-status-blue-foreground" :
                            p.status === "rejected" ? "bg-status-red text-status-red-foreground" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {p.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ResourceManagementPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [rateCardManagerOpen, setRateCardManagerOpen] = useState(false);
  const [capacityViewMode, setCapacityViewMode] = useState<"basic" | "enhanced">("basic");
  const { toast } = useToast();
  const { mainOffset, mobileTopOffset } = useShellLayout();

  const { data: stats } = useQuery<ResourceStats>({
    queryKey: ["/api/resources/stats"],
  });

  const { data: resources = [], isLoading: resourcesLoading } = useQuery<Resource[]>({
    queryKey: ["/api/resources"],
  });

  const { data: skillCategoriesList = [] } = useQuery<SkillCategory[]>({
    queryKey: ["/api/resources/skill-categories"],
  });

  const { data: skillsList = [] } = useQuery<Skill[]>({
    queryKey: ["/api/resources/skills"],
  });

  const { data: allocations = [] } = useQuery<ResourceAllocation[]>({
    queryKey: ["/api/resources/allocations"],
  });

  const { data: timesheetPeriods = [] } = useQuery<TimesheetPeriod[]>({
    queryKey: ["/api/resources/timesheets"],
  });

  const createResourceMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/resources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resources/stats"] });
      toast({ title: "Resource created successfully" });
    },
    onError: () => toast({ title: "Failed to create resource", variant: "destructive" }),
  });

  const updateResourceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/resources/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resources/stats"] });
      toast({ title: "Resource updated" });
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/resources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resources/stats"] });
      toast({ title: "Resource deleted" });
    },
  });

  const addSkillMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/resources/${data.resourceId}/skills`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/all-skills-map"] });
      toast({ title: "Skill added" });
    },
  });

  const removeSkillMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/resources/0/skills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/all-skills-map"] });
      toast({ title: "Skill removed" });
    },
  });

  const createAllocationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/resources/allocations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resources/stats"] });
      toast({ title: "Allocation created" });
    },
    onError: () => toast({ title: "Failed to create allocation", variant: "destructive" }),
  });

  const updateAllocationMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/resources/allocations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resources/stats"] });
    },
  });

  const deleteAllocationMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/resources/allocations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resources/stats"] });
      toast({ title: "Allocation deleted" });
    },
  });

  const createTimesheetPeriodMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/resources/timesheets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/timesheets"] });
      toast({ title: "Timesheet created" });
    },
    onError: () => toast({ title: "Failed to create timesheet", variant: "destructive" }),
  });

  const updateTimesheetPeriodMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/resources/timesheets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resources/stats"] });
      toast({ title: "Timesheet updated" });
    },
  });

  const createTimesheetEntryMutation = useMutation({
    mutationFn: ({ periodId, data }: { periodId: number; data: any }) => apiRequest("POST", `/api/resources/timesheets/${periodId}/entries`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/timesheets", variables.periodId, "entries"] });
    },
  });

  const updateTimesheetEntryMutation = useMutation({
    mutationFn: ({ id, data, periodId }: { id: number; data: any; periodId: number }) => apiRequest("PUT", `/api/resources/timesheets/0/entries/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/timesheets", variables.periodId, "entries"] });
    },
  });

  if (resourcesLoading) {
    return (
      <div className="h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className={cn("transition-all duration-300 h-full flex items-center justify-center overflow-hidden", mainOffset, mobileTopOffset)}>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className={cn("transition-all duration-300 h-full flex flex-col overflow-hidden", mainOffset, mobileTopOffset)}>
        <div className="px-4 pt-4">
          <ModuleWelcomeBanner moduleKey="resource-mgmt" features={["Skills matrix", "Allocation tracking", "Timesheets", "Utilisation reports"]} />
        </div>
        <div className="border-b border-border/30 bg-card backdrop-blur-sm sticky top-0 z-50">
          <ModuleHeader
            icon={Users}
            title="Resources"
            subtitle="Skills, capacity and time management"
            searchPlaceholder="Search resources..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchTestId="input-resource-search"
            titleTestId="text-module-title"
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
            <TabsList className="h-12 bg-transparent border-0 gap-1">
              <TabsTrigger value="dashboard" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-dashboard">
                <ResDashboardIcon className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="people" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-project-users">
                <ResPeopleIcon className="h-4 w-4" />
                Project Users
              </TabsTrigger>
              <TabsTrigger value="skills" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-skills-matrix">
                <ResSkillsIcon className="h-4 w-4" />
                Skills Matrix
              </TabsTrigger>
              <TabsTrigger value="allocations" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-capacity-planning">
                <ResCapacityIcon className="h-4 w-4" />
                Capacity Planning
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-pipeline">
                <ResPipelineIcon className="h-4 w-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="timesheets" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-timesheets">
                <ResTimesheetsIcon className="h-4 w-4" />
                Timesheets
              </TabsTrigger>
              <TabsTrigger value="approvals" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-approvals">
                <ResApprovalsIcon className="h-4 w-4" />
                Approvals
              </TabsTrigger>
              <TabsTrigger value="rate-cards" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-rate-cards">
                <CreditCard className="h-4 w-4" />
                Rate Cards
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} className="flex-1">
            <TabsContent value="dashboard" className="p-6 m-0">
              <DashboardTab stats={stats} resources={resources} allocations={allocations} />
            </TabsContent>

            <TabsContent value="people" className="p-6 m-0">
              <PeopleTab
                resources={resources}
                skills={skillsList}
                skillCategories={skillCategoriesList}
                searchTerm={searchTerm}
                onCreateResource={(data) => createResourceMutation.mutate(data)}
                onUpdateResource={(id, data) => updateResourceMutation.mutate({ id, data })}
                onDeleteResource={(id) => deleteResourceMutation.mutate(id)}
                onAddSkill={(data) => addSkillMutation.mutate(data)}
                onRemoveSkill={(id) => removeSkillMutation.mutate(id)}
              />
            </TabsContent>

            <TabsContent value="skills" className="p-6 m-0">
              <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="skills-matrix-placeholder">
                <div className="p-4 rounded-2xl bg-status-teal/10 mb-4">
                  <Grid3X3 className="h-10 w-10 text-status-teal-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Skills Matrix</h3>
                <p className="text-muted-foreground max-w-md">
                  View and manage the skills matrix for all team members. Track competencies, certifications, and skill levels across your organization.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="allocations" className="p-6 m-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={capacityViewMode === "basic" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCapacityViewMode("basic")}
                      data-testid="button-basic-view"
                    >
                      <List className="h-4 w-4 mr-1" />
                      Basic View
                    </Button>
                    <Button
                      variant={capacityViewMode === "enhanced" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCapacityViewMode("enhanced")}
                      data-testid="button-enhanced-view"
                    >
                      <BarChart3 className="h-4 w-4 mr-1" />
                      Enhanced View
                    </Button>
                  </div>
                </div>
                {capacityViewMode === "basic" ? (
                  <AllocationsTab
                    resources={resources}
                    allocations={allocations}
                    onCreateAllocation={(data) => createAllocationMutation.mutate(data)}
                    onUpdateAllocation={(id, data) => updateAllocationMutation.mutate({ id, data })}
                    onDeleteAllocation={(id) => deleteAllocationMutation.mutate(id)}
                  />
                ) : (
                  <CapacityBoard />
                )}
              </div>
            </TabsContent>

            <TabsContent value="pipeline" className="p-6 m-0">
              <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="pipeline-placeholder">
                <div className="p-4 rounded-2xl bg-status-red/10 mb-4">
                  <TrendingUp className="h-10 w-10 text-status-red-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Resource Pipeline</h3>
                <p className="text-muted-foreground max-w-md">
                  Understand future resource requirements based on CRM pipeline data. Plan ahead for upcoming projects and initiatives.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="timesheets" className="p-6 m-0">
              <TimesheetsTab
                resources={resources}
                timesheetPeriods={timesheetPeriods}
                allocations={allocations}
                onCreatePeriod={(data) => createTimesheetPeriodMutation.mutate(data)}
                onUpdatePeriod={(id, data) => updateTimesheetPeriodMutation.mutate({ id, data })}
                onCreateEntry={(periodId, data) => createTimesheetEntryMutation.mutate({ periodId, data })}
                onUpdateEntry={(id, data) => {
                  const entry = timesheetPeriods.find(p => p.id);
                  updateTimesheetEntryMutation.mutate({ id, data, periodId: 0 });
                }}
              />
            </TabsContent>

            <TabsContent value="approvals" className="p-6 m-0">
              <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="approvals-placeholder">
                <div className="p-4 rounded-2xl bg-status-green/10 mb-4">
                  <CheckCircle2 className="h-10 w-10 text-status-green-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Approvals</h3>
                <p className="text-muted-foreground max-w-md">
                  Manage timesheet approval workflows. Review, approve, or reject timesheets submitted by team members and contractors.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="rate-cards" className="p-6 m-0">
              <div className="space-y-4" data-testid="rate-cards-tab">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg font-bold">Rate Cards</h3>
                    <p className="text-sm text-muted-foreground">Manage daily rate cards for roles across opportunities and projects.</p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-[#0ea5e9] hover:bg-[#0284c7]"
                    onClick={() => setRateCardManagerOpen(true)}
                    data-testid="button-open-rate-card-manager"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Manage Rate Cards
                  </Button>
                </div>
              </div>
              <RateCardManager
                open={rateCardManagerOpen}
                onClose={() => setRateCardManagerOpen(false)}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
