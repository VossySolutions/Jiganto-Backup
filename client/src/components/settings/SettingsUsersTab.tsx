import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { coerceArray } from "@/lib/coerce-array";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { MondayTable, type ColumnDef, type StatusOption } from "@/components/MondayTable";
import {
  Plus, MoreHorizontal, Trash2, Mail, UserPlus, Clock, CheckCircle, XCircle,
  Save, RefreshCw, Upload, Download, AlertCircle, FileSpreadsheet, Briefcase, Search,
  Table2, Network, AlertTriangle, FolderKanban, SlidersHorizontal, Eye, EyeOff, Copy
} from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import BulkAssignmentDialog from "@/components/settings/BulkAssignmentDialog";
import SettingsUserModulePermissionsGrid, {
  type PermissionRow,
} from "@/components/settings/SettingsUserModulePermissionsGrid";
import { TablePagination } from "@/components/TablePagination";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { SETTINGS_MODULE_KEYS } from "@shared/models/module-access";
import type { Profile, UserRole, UserInvitation, UserModulePermission, OrgUnit, UserProjectAssignment } from "@shared/schema";
import { PLATFORM_ROLE_LABELS, PLATFORM_ROLES, type PlatformRole } from "@shared/models/permissions";
import { USER_TYPE_LABELS, USER_TYPES, ORG_UNIT_TYPE_LABELS, ASSIGNMENT_TYPES, ACCESS_LEVELS } from "@shared/schema";

type ProfileWithUser = Profile & {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    profileImageUrl: string | null;
  };
};

interface SettingsUsersTabProps {
  profiles: ProfileWithUser[];
  roles: UserRole[];
  invitations: UserInvitation[];
  tenantId: number;
  clients?: { id: number; name: string }[];
}

function inviteAcceptUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

function invitationPlatformLabel(inv: UserInvitation): string | null {
  if (!inv.platformRole) return null;
  const role = inv.platformRole as PlatformRole;
  return PLATFORM_ROLE_LABELS[role] ?? inv.platformRole;
}

type BulkUploadUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  userType?: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
  roleId?: string;
  roleName?: string;
  orgUnitName?: string;
  orgUnitId?: number;
  costCentreName?: string;
  costCentreId?: number;
  reportsToEmail?: string;
  isValid: boolean;
  error?: string;
};

type UserTypeFilter = "all" | "internal" | "external";

const userTypeBadgeClasses: Record<string, string> = {
  internal: "bg-status-blue text-status-blue-foreground",
  external: "bg-status-amber text-status-amber-foreground",
  customer: "bg-status-purple text-status-purple-foreground",
};


function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function OrgTreeNode({ profile, childMap, allProfiles }: {
  profile: ProfileWithUser;
  childMap: Map<number, ProfileWithUser[]>;
  allProfiles: ProfileWithUser[];
}) {
  const [expanded, setExpanded] = useState(true);
  const children = childMap.get(profile.id) || [];
  const name = `${profile.user.firstName || ''} ${profile.user.lastName || ''}`.trim() || profile.user.email || 'Unknown';

  return (
    <div className="flex flex-col items-center">
      <div
        className="border rounded-md p-3 bg-card shadow-sm w-[180px] cursor-pointer hover-elevate text-center overflow-visible"
        onClick={() => children.length > 0 && setExpanded(!expanded)}
        data-testid={`org-node-${profile.id}`}
      >
        <Avatar className="h-10 w-10 mx-auto mb-1">
          <AvatarImage src={profile.photoUrl || profile.user.profileImageUrl || undefined} />
          <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
        </Avatar>
        <p className="text-xs font-medium truncate">{name}</p>
        {profile.jobTitle && <p className="text-[10px] text-muted-foreground truncate">{profile.jobTitle}</p>}
        {children.length > 0 && (
          <Badge variant="secondary" className="mt-1 text-[10px]">
            {children.length} report{children.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>
      {expanded && children.length > 0 && (
        <div className="mt-0">
          <div className="w-px h-4 bg-border mx-auto" />
          {children.length === 1 ? (
            <OrgTreeNode profile={children[0]} childMap={childMap} allProfiles={allProfiles} />
          ) : (
            <div className="flex gap-6 relative">
              <div className="absolute top-0 h-px bg-border" style={{ left: '90px', right: '90px' }} />
              {children.map(child => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-px h-4 bg-border" />
                  <OrgTreeNode profile={child} childMap={childMap} allProfiles={allProfiles} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamMemberMobileCard({
  profile,
  roles,
  platformRoleLabel,
  onOpen,
}: {
  profile: ProfileWithUser;
  roles: UserRole[];
  platformRoleLabel?: string;
  onOpen: (profile: ProfileWithUser) => void;
}) {
  const name =
    `${profile.user.firstName || ""} ${profile.user.lastName || ""}`.trim() ||
    profile.user.email ||
    "Unknown";
  const roleName = roles.find((r) => r.id === profile.roleId)?.name;
  const userType = profile.userType || "internal";

  return (
    <Card
      className="cursor-pointer hover-elevate active:opacity-90 transition-opacity"
      onClick={() => onOpen(profile)}
      data-testid={`user-mobile-card-${profile.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={profile.photoUrl || profile.user.profileImageUrl || undefined} />
            <AvatarFallback className="text-sm">{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{name}</p>
            <p className="text-sm text-muted-foreground truncate">{profile.user.email}</p>
            {profile.jobTitle && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{profile.jobTitle}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Badge
                variant="secondary"
                className={cn("text-[10px]", userTypeBadgeClasses[userType])}
              >
                {USER_TYPE_LABELS[userType as keyof typeof USER_TYPE_LABELS] || userType}
              </Badge>
              {platformRoleLabel && (
                <Badge variant="secondary" className="text-[10px] max-w-[160px] truncate">
                  {platformRoleLabel}
                </Badge>
              )}
              {roleName && (
                <Badge variant="outline" className="text-[10px] max-w-[140px] truncate">
                  {roleName}
                </Badge>
              )}
              {profile.isActive ? (
                <Badge variant="secondary" className="text-[10px] bg-status-green text-status-green-foreground">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] bg-status-red text-status-red-foreground">
                  Inactive
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrgChartFromReportsTo({ profiles, orgUnits }: { profiles: ProfileWithUser[]; orgUnits: OrgUnit[] }) {
  const childMap = new Map<number, ProfileWithUser[]>();
  const rootProfiles: ProfileWithUser[] = [];

  profiles.forEach(p => {
    if (p.managerId && profiles.some(m => m.id === p.managerId)) {
      const children = childMap.get(p.managerId) || [];
      children.push(p);
      childMap.set(p.managerId, children);
    } else {
      rootProfiles.push(p);
    }
  });

  if (rootProfiles.length === 0 && profiles.length > 0) {
    rootProfiles.push(...profiles);
  }

  const hasReportingRelationships = profiles.some(p => p.managerId);

  if (!hasReportingRelationships) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Network className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm font-medium">No reporting relationships defined</p>
        <p className="text-xs mt-1">Set "Reports To" on user profiles to generate an org chart</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[min(60vh,600px)] w-full">
      <div className="p-4 sm:p-6 flex flex-col items-center gap-6 min-w-max mx-auto">
        {rootProfiles.map(root => (
          <OrgTreeNode key={root.id} profile={root} childMap={childMap} allProfiles={profiles} />
        ))}
      </div>
    </ScrollArea>
  );
}

export default function SettingsUsersTab({
  profiles,
  roles,
  invitations,
  tenantId,
  clients = [],
}: SettingsUsersTabProps) {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<"table" | "org">("table");
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<(number | string)[]>([]);
  const allColumnIds = ["user", "userType", "platformRole", "roleId", "department", "orgUnit", "costCentre", "assignments", "managerId", "jobTitle", "phone", "status"] as const;
  const columnLabels: Record<string, string> = {
    user: "User", userType: "Type", platformRole: "Platform role", roleId: "Module role (legacy)", department: "Department",
    orgUnit: "Org Unit", costCentre: "Cost Centre", assignments: "Assignments",
    managerId: "Reports To", jobTitle: "Job Title", phone: "Phone", status: "Status",
  };
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const toggleColumnVisibility = useCallback((colId: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  }, []);
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [orgUnitFilter, setOrgUnitFilter] = useState<string>("all");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  useEffect(() => {
    if (!isAddUserOpen) return;
    void queryClient.invalidateQueries({
      queryKey: [`/api/settings/roles?tenantId=${tenantId}`],
    });
  }, [isAddUserOpen, tenantId]);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkUploadUsers, setBulkUploadUsers] = useState<BulkUploadUser[]>([]);
  const [bulkUploadRoleId, setBulkUploadRoleId] = useState<string>("");
  const [bulkSendInvite, setBulkSendInvite] = useState(true);
  const [bulkInvitePlatformRole, setBulkInvitePlatformRole] = useState<PlatformRole>("si_consultant_pm");
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const [selectedProfile, setSelectedProfile] = useState<ProfileWithUser | null>(null);
  const [detailForm, setDetailForm] = useState({
    firstName: "",
    lastName: "",
    department: "",
    jobTitle: "",
    phone: "",
    userType: "internal",
    bio: "",
    startDate: "",
    endDate: "",
    photoUrl: "",
    costCentreId: "",
    managerId: "",
  });
  const [detailPermissions, setDetailPermissions] = useState<PermissionRow[]>([]);


  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ assignmentType: "project", projectId: "", programId: "", accessLevel: "view" });

  const photoUploadInputRef = useRef<HTMLInputElement>(null);

  const [addUserForm, setAddUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    userType: "internal",
    department: "",
    jobTitle: "",
    phone: "",
    roleId: "",
    startDate: "",
    endDate: "",
    sendInvite: true,
    invitePlatformRole: "si_consultant_pm" as PlatformRole,
    inviteLockedWorkspaceId: "",
  });

  const { data: membershipData } = useQuery({
    queryKey: ["/api/org-memberships", tenantId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/org-memberships?orgId=${tenantId}`);
      if (res.status === 403) return { memberships: [] as { userId: string; platformRole: PlatformRole }[] };
      if (!res.ok) throw new Error("Failed to load platform roles");
      return res.json() as Promise<{ memberships: { userId: string; platformRole: PlatformRole }[] }>;
    },
  });

  const platformRoleByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of membershipData?.memberships ?? []) {
      map.set(m.userId, PLATFORM_ROLE_LABELS[m.platformRole] ?? m.platformRole);
    }
    return map;
  }, [membershipData]);

  const { data: orgUnitsList = [] } = useQuery<OrgUnit[]>({
    queryKey: [`/api/settings/org-units?tenantId=${tenantId}`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/settings/org-units?tenantId=${tenantId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: userPermissions = [] } = useQuery<UserModulePermission[]>({
    queryKey: ["/api/settings/users", selectedProfile?.id, "permissions"],
    queryFn: async () => {
      const res = await fetchWithAuth(
        `/api/settings/users/${selectedProfile!.id}/permissions`,
      );
      if (!res.ok) throw new Error("Failed to fetch permissions");
      return res.json();
    },
    enabled: !!selectedProfile,
  });

  const { data: userAssignments = [] } = useQuery<UserProjectAssignment[]>({
    queryKey: ["/api/settings/users", selectedProfile?.id, "assignments"],
    queryFn: async () => {
      const res = await fetchWithAuth(
        `/api/settings/users/${selectedProfile!.id}/assignments`,
      );
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
    enabled: !!selectedProfile,
  });

  const { data: projectsList = [] } = useQuery<any[]>({
    queryKey: [`/api/pm/projects?tenantId=${tenantId}`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/pm/projects?tenantId=${tenantId}`);
      if (!res.ok) throw new Error("Failed");
      return coerceArray(await res.json());
    },
  });

  const { data: programmesList = [] } = useQuery<any[]>({
    queryKey: [`/api/pm/programs?tenantId=${tenantId}`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/pm/programs?tenantId=${tenantId}`);
      if (!res.ok) throw new Error("Failed");
      return coerceArray(await res.json());
    },
  });

  const { data: costCentresList = [] } = useQuery<any[]>({
    queryKey: [`/api/settings/cost-centres?tenantId=${tenantId}`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/settings/cost-centres?tenantId=${tenantId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: assignmentCounts = {} } = useQuery<Record<string, number>>({
    queryKey: [`/api/settings/assignment-counts?tenantId=${tenantId}`],
    queryFn: async () => {
      const res = await fetchWithAuth(
        `/api/settings/assignment-counts?tenantId=${tenantId}`,
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Profile> }) => {
      const res = await apiRequest("PUT", `/api/settings/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/users?tenantId=${tenantId}`] });
      toast({ title: "User updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user.", variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/settings/users`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/users?tenantId=${tenantId}`] });
      setIsAddUserOpen(false);
      resetAddUserForm();
      toast({ title: "User created", description: "New user has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create user.", variant: "destructive" });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/settings/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/users?tenantId=${tenantId}`] });
      toast({ title: "User deleted" });
    },
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      platformRole: PlatformRole;
      roleId?: number | null;
      lockedWorkspaceId?: number | null;
    }) => {
      const res = await apiRequest("POST", `/api/settings/invitations`, {
        ...data,
        tenantId,
        invitedBy: authUser?.id,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Failed to create invitation");
      }
      return res.json() as Promise<{
        emailDelivery?: { sent: boolean; method: string };
        webhookDelivery?: {
          delivered: boolean;
          skipped?: boolean;
          reason?: string;
          statusCode?: number;
          error?: string;
        };
      }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/invitations?tenantId=${tenantId}`] });
      const delivery = data?.emailDelivery;
      const webhook = data?.webhookDelivery;
      let description: string | undefined;
      if (delivery?.sent) {
        description = "The user should receive the invite link shortly.";
      } else if (delivery?.method === "console") {
        description =
          "Copy the invite link from Pending invitations below (email not configured).";
      } else {
        description = "Copy the invite link from Pending invitations below.";
      }
      if (webhook?.delivered) {
        description = [description, "Integration webhook delivered."].filter(Boolean).join(" ");
      } else if (webhook && !webhook.skipped) {
        const hint =
          webhook.error?.slice(0, 60) ||
          (webhook.statusCode ? `HTTP ${webhook.statusCode}` : "delivery failed");
        description = [description, `Webhook ${hint}.`].filter(Boolean).join(" ");
      }
      if (delivery?.sent) {
        toast({ title: "Invitation emailed", description });
      } else {
        toast({ title: "Invitation created", description });
      }
    },
    onError: (e: Error) => {
      toast({ title: "Invitation failed", description: e.message, variant: "destructive" });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/settings/invitations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/invitations?tenantId=${tenantId}`] });
      toast({ title: "Invitation revoked" });
    },
  });

  const savePermissionsMutation = useMutation({
    mutationFn: async ({ profileId, permissions }: { profileId: number; permissions: PermissionRow[] }) => {
      const res = await apiRequest("PUT", `/api/settings/users/${profileId}/permissions`, {
        tenantId,
        permissions: permissions.map(p => ({
          moduleKey: p.moduleKey,
          canCreate: p.canCreate,
          canRead: p.canRead,
          canUpdate: p.canUpdate,
          canDelete: p.canDelete,
        })),
      });
      return res.json();
    },
    onSuccess: () => {
      if (selectedProfile) {
        queryClient.invalidateQueries({ queryKey: ["/api/settings/users", selectedProfile.id, "permissions"] });
      }
      toast({ title: "Permissions saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save permissions.", variant: "destructive" });
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/settings/users/${data.profileId}/assignments`, data);
      return res.json();
    },
    onSuccess: () => {
      if (selectedProfile) {
        queryClient.invalidateQueries({ queryKey: ["/api/settings/users", selectedProfile.id, "assignments"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/settings/assignment-counts", tenantId] });
      setShowAssignmentForm(false);
      setNewAssignment({ assignmentType: "project", projectId: "", programId: "", accessLevel: "view" });
      toast({ title: "Assignment added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add assignment.", variant: "destructive" });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/settings/assignments/${id}`);
    },
    onSuccess: () => {
      if (selectedProfile) {
        queryClient.invalidateQueries({ queryKey: ["/api/settings/users", selectedProfile.id, "assignments"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/settings/assignment-counts", tenantId] });
      toast({ title: "Assignment removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove assignment.", variant: "destructive" });
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PUT", `/api/settings/assignments/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      if (selectedProfile) {
        queryClient.invalidateQueries({ queryKey: ["/api/settings/users", selectedProfile.id, "assignments"] });
      }
      toast({ title: "Assignment updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update assignment.", variant: "destructive" });
    },
  });

  const resetAddUserForm = () => {
    setAddUserForm({
      firstName: "",
      lastName: "",
      email: "",
      userType: "internal",
      department: "",
      jobTitle: "",
      phone: "",
      roleId: "",
      startDate: "",
      endDate: "",
      sendInvite: true,
      invitePlatformRole: "si_consultant_pm",
      inviteLockedWorkspaceId: "",
    });
  };

  const copyInviteLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteAcceptUrl(token));
      toast({ title: "Invite link copied", description: "Share with the invited user." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };


  const internalProfiles = useMemo(() => profiles.filter(p => p.userType !== "customer"), [profiles]);

  let filteredProfiles = userTypeFilter === "all"
    ? internalProfiles
    : internalProfiles.filter(p => p.userType === userTypeFilter);

  if (statusFilter === "active") {
    filteredProfiles = filteredProfiles.filter(p => p.isActive);
  } else if (statusFilter === "inactive") {
    filteredProfiles = filteredProfiles.filter(p => !p.isActive);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredProfiles = filteredProfiles.filter(p => {
      const name = `${p.user.firstName || ""} ${p.user.lastName || ""}`.toLowerCase();
      const email = (p.user.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }

  if (orgUnitFilter !== "all") {
    filteredProfiles = filteredProfiles.filter(p => p.orgUnitId === Number(orgUnitFilter));
  }

  const counts = {
    all: internalProfiles.length,
    internal: internalProfiles.filter(p => p.userType === "internal").length,
    external: internalProfiles.filter(p => p.userType === "external").length,
  };

  const openDetailPanel = (profile: ProfileWithUser) => {
    setSelectedProfile(profile);
    setDetailForm({
      firstName: profile.user.firstName || "",
      lastName: profile.user.lastName || "",
      department: profile.department || "",
      jobTitle: profile.jobTitle || "",
      phone: profile.phone || "",
      userType: profile.userType || "internal",
      bio: profile.bio || "",
      startDate: profile.startDate ? new Date(profile.startDate).toISOString().split("T")[0] : "",
      endDate: profile.endDate ? new Date(profile.endDate).toISOString().split("T")[0] : "",
      photoUrl: profile.photoUrl || "",
      costCentreId: profile.costCentreId ? String(profile.costCentreId) : "",
      managerId: profile.managerId ? String(profile.managerId) : "",
    });
    setShowAssignmentForm(profile.userType === "customer");
    setNewAssignment({ assignmentType: "project", projectId: "", programId: "", accessLevel: "view" });
  };

  const initPermissionsFromData = (perms: UserModulePermission[]) => {
    return SETTINGS_MODULE_KEYS.map((mod) => {
      const existing = perms.find((p) => p.moduleKey === mod.key);
      return {
        moduleKey: mod.key,
        canCreate: existing?.canCreate ?? false,
        canRead: existing?.canRead ?? true,
        canUpdate: existing?.canUpdate ?? false,
        canDelete: existing?.canDelete ?? false,
      };
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch("/api/org-charts/upload-photo", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setDetailForm({ ...detailForm, photoUrl: data.url });
      toast({ title: "Photo uploaded" });
    } catch {
      toast({ title: "Error", description: "Failed to upload photo.", variant: "destructive" });
    }
    if (photoUploadInputRef.current) {
      photoUploadInputRef.current.value = "";
    }
  };

  const handleSaveDetail = () => {
    if (!selectedProfile) return;
    updateProfileMutation.mutate({
      id: selectedProfile.id,
      data: {
        firstName: detailForm.firstName || null,
        lastName: detailForm.lastName || null,
        department: detailForm.department || null,
        jobTitle: detailForm.jobTitle || null,
        phone: detailForm.phone || null,
        userType: detailForm.userType,
        bio: detailForm.bio || null,
        startDate: detailForm.startDate ? new Date(detailForm.startDate) : null,
        endDate: detailForm.endDate ? new Date(detailForm.endDate) : null,
        photoUrl: detailForm.photoUrl || null,
        costCentreId: detailForm.costCentreId && detailForm.costCentreId !== "none" ? Number(detailForm.costCentreId) : null,
        managerId: detailForm.managerId && detailForm.managerId !== "none" ? Number(detailForm.managerId) : null,
      } as any,
    });
    if (detailPermissions.length > 0) {
      savePermissionsMutation.mutate({
        profileId: selectedProfile.id,
        permissions: detailPermissions,
      });
    }
  };

  const handleAddUser = () => {
    if (!addUserForm.email) return;
    if (addUserForm.sendInvite) {
      const needsWorkspace =
        addUserForm.invitePlatformRole === "client_project_user" ||
        addUserForm.invitePlatformRole === "client_executive";
      if (needsWorkspace && !addUserForm.inviteLockedWorkspaceId) {
        toast({
          title: "Client workspace required",
          description: "Select a locked client workspace for this platform role.",
          variant: "destructive",
        });
        return;
      }
      createInvitationMutation.mutate(
        {
          email: addUserForm.email.trim(),
          platformRole: addUserForm.invitePlatformRole,
          roleId: addUserForm.roleId ? Number(addUserForm.roleId) : null,
          lockedWorkspaceId: addUserForm.inviteLockedWorkspaceId
            ? Number(addUserForm.inviteLockedWorkspaceId)
            : null,
        },
        {
          onSuccess: () => {
            setIsAddUserOpen(false);
            resetAddUserForm();
          },
        },
      );
      return;
    }
    createUserMutation.mutate({
      tenantId,
      userType: addUserForm.userType,
      department: addUserForm.department || null,
      jobTitle: addUserForm.jobTitle || null,
      phone: addUserForm.phone || null,
      roleId: addUserForm.roleId ? Number(addUserForm.roleId) : null,
      startDate: addUserForm.startDate || null,
      endDate: addUserForm.endDate || null,
      firstName: addUserForm.firstName || null,
      lastName: addUserForm.lastName || null,
      email: addUserForm.email,
    });
  };

  const handleAddAssignment = () => {
    if (!selectedProfile) return;
    createAssignmentMutation.mutate({
      profileId: selectedProfile.id,
      tenantId,
      assignmentType: newAssignment.assignmentType,
      projectId: newAssignment.assignmentType === "project" && newAssignment.projectId ? Number(newAssignment.projectId) : null,
      programId: newAssignment.assignmentType === "programme" && newAssignment.programId ? Number(newAssignment.programId) : null,
      accessLevel: newAssignment.accessLevel,
      isActive: true,
    });
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const parseUploadedFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processUploadedData(results.data as Record<string, string>[]);
        },
        error: () => {
          toast({ title: "Error", description: "Failed to parse CSV file", variant: "destructive" });
        },
      });
    } else if (extension === "xlsx" || extension === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);
          processUploadedData(jsonData);
        } catch {
          toast({ title: "Error", description: "Failed to parse Excel file", variant: "destructive" });
        }
      };
      reader.readAsBinaryString(file);
    } else {
      toast({ title: "Error", description: "Please upload a CSV or Excel file", variant: "destructive" });
    }
  };

  const findField = (row: Record<string, string>, ...keys: string[]): string => {
    for (const key of keys) {
      for (const rowKey of Object.keys(row)) {
        if (rowKey.toLowerCase().replace(/[_\s]/g, "") === key.toLowerCase().replace(/[_\s]/g, "")) {
          return (row[rowKey] || "").trim();
        }
      }
    }
    return "";
  };

  const normalizeUserType = (raw: string): string => {
    const lower = raw.toLowerCase().trim();
    if (lower === "employee" || lower === "internal") return "internal";
    if (lower === "contractor" || lower === "external") return "external";
    if (lower === "customer") return "customer";
    return raw;
  };

  const processUploadedData = (data: Record<string, string>[]) => {
    const users: BulkUploadUser[] = data.map((row) => {
      const email = findField(row, "email", "Email", "EMAIL");
      const firstName = findField(row, "firstName", "firstname", "first_name", "FirstName");
      const lastName = findField(row, "lastName", "lastname", "last_name", "LastName");
      const rawUserType = findField(row, "userType", "usertype", "user_type", "UserType", "type");
      const userType = rawUserType ? normalizeUserType(rawUserType) : undefined;
      const department = findField(row, "department", "Department");
      const jobTitle = findField(row, "jobTitle", "jobtitle", "job_title", "JobTitle");
      const phone = findField(row, "phone", "Phone");
      const roleName = findField(row, "role", "Role", "roleName", "role_name");
      const orgUnitName = findField(row, "orgUnit", "orgunit", "org_unit", "OrgUnit", "organisationUnit");
      const costCentreName = findField(row, "costCentre", "costcentre", "cost_centre", "CostCentre", "costCenter");
      const reportsToEmail = findField(row, "reportsTo", "reportsto", "reports_to", "ReportsTo", "manager", "managerEmail");

      const matchedRole = roleName ? roles.find(r => r.name.toLowerCase() === roleName.toLowerCase()) : null;
      const matchedOrgUnit = orgUnitName ? orgUnitsList.find(ou => ou.name.toLowerCase() === orgUnitName.toLowerCase()) : null;
      const matchedCostCentre = costCentreName ? costCentresList.find((cc: any) => cc.name.toLowerCase() === costCentreName.toLowerCase()) : null;

      const isValid = validateEmail(email);
      return {
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        userType: userType || undefined,
        department: department || undefined,
        jobTitle: jobTitle || undefined,
        phone: phone || undefined,
        roleName: roleName || undefined,
        roleId: matchedRole ? String(matchedRole.id) : undefined,
        orgUnitName: orgUnitName || undefined,
        orgUnitId: matchedOrgUnit?.id,
        costCentreName: costCentreName || undefined,
        costCentreId: matchedCostCentre?.id,
        reportsToEmail: reportsToEmail || undefined,
        isValid,
        error: !email ? "Email is required" : !isValid ? "Invalid email format" : undefined,
      };
    }).filter((u) => u.email);

    if (users.length === 0) {
      toast({ title: "Error", description: "No valid emails found in file. Make sure your file has an 'email' column.", variant: "destructive" });
      return;
    }

    setBulkUploadUsers(users);
    setIsBulkUploadOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseUploadedFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleBulkImport = async () => {
    const validUsers = bulkUploadUsers.filter((u) => u.isValid);
    if (validUsers.length === 0) {
      toast({ title: "Error", description: "No valid users to import", variant: "destructive" });
      return;
    }

    setIsProcessingBulk(true);
    let successCount = 0;
    let errorCount = 0;
    const createdUsers: { email: string; profileId: number }[] = [];
    const usersWithManager: { profileId: number; reportsToEmail: string }[] = [];

    for (const user of validUsers) {
      try {
        const effectiveRoleId = user.roleId ? Number(user.roleId) : (bulkUploadRoleId ? Number(bulkUploadRoleId) : null);
        if (bulkSendInvite) {
          const invRes = await apiRequest("POST", "/api/settings/invitations", {
            tenantId,
            email: user.email,
            platformRole: bulkInvitePlatformRole,
            roleId: effectiveRoleId,
            invitedBy: authUser?.id,
          });
          if (!invRes.ok) throw new Error("Invitation failed");
        } else {
          const res = await apiRequest("POST", "/api/settings/users", {
            tenantId,
            userType: user.userType || "internal",
            department: user.department || null,
            jobTitle: user.jobTitle || null,
            phone: user.phone || null,
            roleId: effectiveRoleId,
            orgUnitId: user.orgUnitId || null,
            costCentreId: user.costCentreId || null,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            email: user.email,
          });
          const created = await res.json();
          createdUsers.push({ email: user.email, profileId: created.id });
          if (user.reportsToEmail) {
            usersWithManager.push({ profileId: created.id, reportsToEmail: user.reportsToEmail });
          }
        }
        successCount++;
      } catch {
        errorCount++;
      }
    }

    if (usersWithManager.length > 0) {
      await queryClient.invalidateQueries({ queryKey: [`/api/settings/users?tenantId=${tenantId}`] });
      const freshRes = await fetchWithAuth(`/api/settings/users?tenantId=${tenantId}`);
      const allProfiles: ProfileWithUser[] = freshRes.ok ? await freshRes.json() : [];

      let managerUpdated = 0;
      for (const um of usersWithManager) {
        const managerProfile = allProfiles.find(p => p.user.email?.toLowerCase() === um.reportsToEmail.toLowerCase());
        if (managerProfile) {
          try {
            await apiRequest("PUT", `/api/settings/users/${um.profileId}`, { managerId: managerProfile.id });
            managerUpdated++;
          } catch { /* skip */ }
        }
      }
    }

    setIsProcessingBulk(false);
    queryClient.invalidateQueries({ queryKey: [`/api/settings/users?tenantId=${tenantId}`] });
    if (bulkSendInvite) {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/invitations?tenantId=${tenantId}`] });
    }
    setIsBulkUploadOpen(false);
    setBulkUploadUsers([]);
    setBulkUploadRoleId("");
    setBulkSendInvite(true);
    setBulkInvitePlatformRole("si_consultant_pm");

    toast({
      title: bulkSendInvite ? "Bulk invitations complete" : "Bulk import complete",
      description: `Successfully processed ${successCount}${errorCount > 0 ? `, ${errorCount} failed` : ""}${
        bulkSendInvite && !bulkUploadRoleId ? " (rows need a role column or default module role)" : ""
      }`,
    });
  };

  const downloadTemplate = () => {
    const roleNames = roles.map(r => r.name).join(", ");
    const orgUnitNames = orgUnitsList.map(ou => ou.name).join(", ");
    const costCentreNames = costCentresList.map((cc: any) => cc.name).join(", ");
    const ws = XLSX.utils.aoa_to_sheet([
      ["email", "firstName", "lastName", "userType", "role", "department", "orgUnit", "costCentre", "reportsTo", "jobTitle", "phone"],
      ["john@company.com", "John", "Doe", "Employee", "", "Engineering", "", "", "", "Developer", "+1234567890"],
      ["jane@company.com", "Jane", "Smith", "Contractor", "", "Design", "", "", "john@company.com", "Consultant", "+0987654321"],
      ["client@example.com", "Bob", "Wilson", "Customer", "", "Sales", "", "", "", "Account Manager", "+1122334455"],
    ]);
    const notesWs = XLSX.utils.aoa_to_sheet([
      ["Field", "Description", "Valid Values"],
      ["email", "Required. User's email address", ""],
      ["firstName", "User's first name", ""],
      ["lastName", "User's last name", ""],
      ["userType", "Type of user", "Employee, Contractor, Customer"],
      ["role", "Role name (must match existing role)", roleNames || "Create roles in Settings > Roles & Permissions"],
      ["department", "Department name", ""],
      ["orgUnit", "Org Unit name (must match existing)", orgUnitNames || "Create org units in Settings > Organization"],
      ["costCentre", "Cost Centre name (must match existing)", costCentreNames || "Create cost centres in Settings > Cost Centres"],
      ["reportsTo", "Email of the manager this user reports to", "Must be an existing user email"],
      ["jobTitle", "User's job title", ""],
      ["phone", "User's phone number", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.utils.book_append_sheet(wb, notesWs, "Field Reference");
    XLSX.writeFile(wb, "user_import_template.xlsx");
  };

  const handleExport = () => {
    const exportData = filteredProfiles.map((p) => {
      const managerProfile = p.managerId ? profiles.find(m => m.id === p.managerId) : null;
      const managerName = managerProfile ? `${managerProfile.user.firstName || ""} ${managerProfile.user.lastName || ""}`.trim() : "";
      const orgUnit = p.orgUnitId ? orgUnitsList.find(ou => ou.id === p.orgUnitId) : null;
      const costCentre = p.costCentreId ? costCentresList.find((cc: any) => cc.id === p.costCentreId) : null;
      return {
        "First Name": p.user.firstName || "",
        "Last Name": p.user.lastName || "",
        "Email": p.user.email || "",
        "User Type": USER_TYPE_LABELS[(p.userType as keyof typeof USER_TYPE_LABELS) || "internal"],
        "Role": roles.find((r) => r.id === p.roleId)?.name || "",
        "Department": p.department || "",
        "Org Unit": orgUnit?.name || "",
        "Cost Centre": costCentre?.name || "",
        "Reports To": managerProfile?.user.email || "",
        "Reports To Name": managerName,
        "Job Title": p.jobTitle || "",
        "Phone": p.phone || "",
        "Status": p.isActive ? "Active" : "Inactive",
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "users_export.xlsx");
  };

  const permissionsForPanel = selectedProfile
    ? (detailPermissions.length > 0 ? detailPermissions : initPermissionsFromData(userPermissions))
    : [];

  const getAssignmentName = (assignment: UserProjectAssignment) => {
    if (assignment.assignmentType === "project" && assignment.projectId) {
      const proj = projectsList.find((p: any) => p.id === assignment.projectId);
      return proj?.name || `Project #${assignment.projectId}`;
    }
    if (assignment.assignmentType === "programme" && assignment.programId) {
      const prog = programmesList.find((p: any) => p.id === assignment.programId);
      return prog?.name || `Programme #${assignment.programId}`;
    }
    return "-";
  };

  const userTypeOptions: StatusOption[] = useMemo(() =>
    USER_TYPES.map(ut => ({ value: ut, label: USER_TYPE_LABELS[ut], color: userTypeBadgeClasses[ut] || "bg-muted text-muted-foreground" })),
    []
  );

  const roleOptions: StatusOption[] = useMemo(() =>
    roles.map(r => ({ value: String(r.id), label: r.name, color: "" })),
    [roles]
  );

  const orgUnitOptions: StatusOption[] = useMemo(() =>
    orgUnitsList.map(ou => ({ value: String(ou.id), label: ou.name, color: "" })),
    [orgUnitsList]
  );

  const costCentreOptions: StatusOption[] = useMemo(() =>
    costCentresList.map((cc: any) => ({ value: String(cc.id), label: cc.name, color: "" })),
    [costCentresList]
  );

  const managerOptions: StatusOption[] = useMemo(() =>
    profiles.map(p => ({
      value: String(p.id),
      label: `${p.user.firstName || ""} ${p.user.lastName || ""}`.trim() || p.user.email || `Profile #${p.id}`,
      color: "",
    })),
    [profiles]
  );

  const usersTableColumns: ColumnDef<ProfileWithUser>[] = useMemo(() => [
    {
      id: "user",
      header: "User",
      type: "person" as const,
      accessor: (row: ProfileWithUser) => ({
        id: row.user.id,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        email: row.user.email,
        profileImageUrl: row.photoUrl || row.user.profileImageUrl,
      }),
      width: "220px",
      editable: false,
    },
    {
      id: "userType",
      header: "Type",
      type: "select" as const,
      accessor: (row: ProfileWithUser) => row.userType || "internal",
      width: "110px",
      editable: true,
      options: userTypeOptions,
    },
    {
      id: "platformRole",
      header: "Platform role",
      type: "text" as const,
      accessor: (row: ProfileWithUser) => platformRoleByUserId.get(row.user.id) || "",
      width: "150px",
      editable: false,
    },
    {
      id: "roleId",
      header: "Module role (legacy)",
      type: "select" as const,
      accessor: (row: ProfileWithUser) => row.roleId ? String(row.roleId) : "",
      width: "120px",
      editable: true,
      options: roleOptions,
    },
    {
      id: "department",
      header: "Department",
      type: "text" as const,
      accessor: "department" as keyof ProfileWithUser,
      width: "130px",
      editable: true,
    },
    {
      id: "orgUnit",
      header: "Org Unit",
      type: "select" as const,
      accessor: (row: ProfileWithUser) => row.orgUnitId ? String(row.orgUnitId) : "",
      width: "130px",
      editable: true,
      options: orgUnitOptions,
    },
    {
      id: "costCentre",
      header: "Cost Centre",
      type: "select" as const,
      accessor: (row: ProfileWithUser) => row.costCentreId ? String(row.costCentreId) : "",
      width: "120px",
      editable: true,
      options: costCentreOptions,
    },
    {
      id: "assignments",
      header: "Assignments",
      type: "text" as const,
      accessor: (row: ProfileWithUser) => {
        const count = assignmentCounts[String(row.id)] || 0;
        return count > 0 ? `${count} assigned` : "";
      },
      width: "110px",
      editable: false,
    },
    {
      id: "managerId",
      header: "Reports To",
      type: "select" as const,
      accessor: (row: ProfileWithUser) => row.managerId ? String(row.managerId) : "",
      width: "140px",
      editable: true,
      editableCondition: (row: ProfileWithUser) => row.userType !== "customer",
      options: managerOptions,
    },
    {
      id: "jobTitle",
      header: "Job Title",
      type: "text" as const,
      accessor: "jobTitle" as keyof ProfileWithUser,
      width: "130px",
      editable: true,
    },
    {
      id: "phone",
      header: "Phone",
      type: "text" as const,
      accessor: "phone" as keyof ProfileWithUser,
      width: "120px",
      editable: true,
    },
    {
      id: "status",
      header: "Status",
      type: "status" as const,
      accessor: (row: ProfileWithUser) => row.isActive ? "active" : "inactive",
      width: "90px",
      editable: false,
      options: [
        { value: "active", label: "Active", color: "bg-status-green text-status-green-foreground" },
        { value: "inactive", label: "Inactive", color: "bg-status-red text-status-red-foreground" },
      ],
    },
  ], [userTypeOptions, roleOptions, orgUnitOptions, costCentreOptions, managerOptions, assignmentCounts, platformRoleByUserId]);

  const visibleColumns = useMemo(() => 
    usersTableColumns.filter(col => !hiddenColumns.has(col.id)),
    [usersTableColumns, hiddenColumns]
  );

  const handleTableCellEdit = useCallback((rowId: number | string, columnId: string, value: unknown) => {
    const profileId = typeof rowId === "string" ? Number(rowId) : rowId;
    const strValue = value != null ? String(value) : null;

    switch (columnId) {
      case "userType":
        updateProfileMutation.mutate({ id: profileId, data: { userType: strValue || "internal" } });
        break;
      case "roleId":
        updateProfileMutation.mutate({ id: profileId, data: { roleId: strValue ? Number(strValue) : null } as any });
        break;
      case "department":
        updateProfileMutation.mutate({ id: profileId, data: { department: strValue || null } });
        break;
      case "orgUnit":
        updateProfileMutation.mutate({ id: profileId, data: { orgUnitId: strValue ? Number(strValue) : null } as any });
        break;
      case "costCentre":
        updateProfileMutation.mutate({ id: profileId, data: { costCentreId: strValue ? Number(strValue) : null } as any });
        break;
      case "managerId":
        updateProfileMutation.mutate({ id: profileId, data: { managerId: strValue ? Number(strValue) : null } as any });
        break;
      case "jobTitle":
        updateProfileMutation.mutate({ id: profileId, data: { jobTitle: strValue || null } });
        break;
      case "phone":
        updateProfileMutation.mutate({ id: profileId, data: { phone: strValue || null } });
        break;
    }
  }, [updateProfileMutation]);

  const pendingInvitations = useMemo(
    () => invitations.filter((inv) => inv.status === "pending"),
    [invitations],
  );
  const bulkUploadPreviewPagination = useTablePagination(bulkUploadUsers, {
    resetKey: `${bulkUploadUsers.length}-${bulkSendInvite ? "invite" : "import"}`,
    enabled: isBulkUploadOpen,
  });
  const pendingInvitationsPagination = useTablePagination(pendingInvitations, {
    resetKey: pendingInvitations.length,
  });


  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold" data-testid="text-users-title">Team Members</h2>
          <p className="text-sm text-muted-foreground">Manage users and their access</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            data-testid="input-bulk-upload-file"
          />
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={handleExport}
            data-testid="button-export-users"
          >
            <FileSpreadsheet className="h-4 w-4 sm:mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-bulk-upload"
          >
            <Upload className="h-4 w-4 sm:mr-2" />
            Import
          </Button>
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-none" data-testid="button-add-user">
                <UserPlus className="h-4 w-4 sm:mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
              <SubmitForm
                onSubmit={handleAddUser}
                disabled={
                  !addUserForm.email ||
                  createUserMutation.isPending ||
                  createInvitationMutation.isPending
                }
              >
              <DialogHeader>
                <DialogTitle>Add team member</DialogTitle>
                <DialogDescription>
                  {addUserForm.sendInvite
                    ? "Email them a link to join. They create their own sign-in password when they accept."
                    : "Adds them to your team list only. They cannot sign in until you invite them or they register."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="send-invite">Send invitation</Label>
                    <p className="text-xs text-muted-foreground">
                      Off = add to team list only. On = email a link to join and sign in.
                    </p>
                  </div>
                  <Switch
                    id="send-invite"
                    checked={addUserForm.sendInvite}
                    onCheckedChange={(checked) =>
                      setAddUserForm({ ...addUserForm, sendInvite: checked })
                    }
                    data-testid="switch-send-invite"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={addUserForm.firstName}
                      onChange={(e) => setAddUserForm({ ...addUserForm, firstName: e.target.value })}
                      placeholder="First name"
                      data-testid="input-add-firstname"
                      disabled={addUserForm.sendInvite}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={addUserForm.lastName}
                      onChange={(e) => setAddUserForm({ ...addUserForm, lastName: e.target.value })}
                      placeholder="Last name"
                      data-testid="input-add-lastname"
                      disabled={addUserForm.sendInvite}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email address *</Label>
                  <Input
                    type="email"
                    value={addUserForm.email}
                    onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })}
                    placeholder="user@example.com"
                    data-testid="input-add-email"
                  />
                </div>
                {addUserForm.sendInvite && (
                  <>
                    <div className="space-y-2">
                      <Label>Platform role *</Label>
                      <Select
                        value={addUserForm.invitePlatformRole}
                        onValueChange={(v) =>
                          setAddUserForm({
                            ...addUserForm,
                            invitePlatformRole: v as PlatformRole,
                            inviteLockedWorkspaceId: "",
                          })
                        }
                      >
                        <SelectTrigger data-testid="select-invite-platform-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[200]">
                          {PLATFORM_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {PLATFORM_ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(addUserForm.invitePlatformRole === "client_project_user" ||
                      addUserForm.invitePlatformRole === "client_executive") && (
                      <div className="space-y-2">
                        <Label>Locked client workspace *</Label>
                        <Select
                          value={addUserForm.inviteLockedWorkspaceId}
                          onValueChange={(v) =>
                            setAddUserForm({ ...addUserForm, inviteLockedWorkspaceId: v })
                          }
                        >
                          <SelectTrigger data-testid="select-invite-workspace">
                            <SelectValue placeholder="Select workspace" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {!addUserForm.sendInvite && (
                    <div className="space-y-2">
                      <Label>User type</Label>
                      <Select value={addUserForm.userType} onValueChange={(v) => setAddUserForm({ ...addUserForm, userType: v })}>
                        <SelectTrigger data-testid="select-add-usertype">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {USER_TYPES.map((ut) => (
                            <SelectItem key={ut} value={ut}>{USER_TYPE_LABELS[ut]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Module role (legacy)</Label>
                    <Select
                      value={addUserForm.roleId || undefined}
                      onValueChange={(v) => setAddUserForm({ ...addUserForm, roleId: v })}
                    >
                      <SelectTrigger data-testid="select-add-role">
                        <SelectValue placeholder={roles.length ? "Optional template" : "No roles available"} />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {roles.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            No module roles — open Settings → Roles & Permissions
                          </SelectItem>
                        ) : (
                          roles.map((role) => (
                            <SelectItem key={role.id} value={String(role.id)}>
                              {role.name}
                              {role.isAdmin ? " (Admin)" : ""}
                              {role.isDefault ? " (Default)" : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {roles.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Legacy module roles are created automatically on first load. Close and reopen this dialog, or visit Roles &amp; Permissions.
                      </p>
                    )}
                  </div>
                </div>
                {!addUserForm.sendInvite && (
                  <>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground space-y-1.5">
                  <p className="font-medium text-foreground">No sign-in password here</p>
                  <p>
                    This option only adds the person to your team directory. To let them sign in, turn on{" "}
                    <strong>Send invitation</strong> so they can choose a password when they join, or ask them to
                    register with this email address and give them access from <strong>Roles &amp; Permissions</strong>.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input
                      value={addUserForm.department}
                      onChange={(e) => setAddUserForm({ ...addUserForm, department: e.target.value })}
                      placeholder="Department"
                      data-testid="input-add-department"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    <Input
                      value={addUserForm.jobTitle}
                      onChange={(e) => setAddUserForm({ ...addUserForm, jobTitle: e.target.value })}
                      placeholder="Job title"
                      data-testid="input-add-jobtitle"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={addUserForm.phone}
                    onChange={(e) => setAddUserForm({ ...addUserForm, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    data-testid="input-add-phone"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={addUserForm.startDate}
                      onChange={(e) => setAddUserForm({ ...addUserForm, startDate: e.target.value })}
                      data-testid="input-add-startdate"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={addUserForm.endDate}
                      onChange={(e) => setAddUserForm({ ...addUserForm, endDate: e.target.value })}
                      data-testid="input-add-enddate"
                    />
                  </div>
                </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)} data-testid="button-cancel-add">Cancel</Button>
                <Button
                  type="submit"
                  data-testid="button-submit-add-user"
                >
                  {createUserMutation.isPending || createInvitationMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{addUserForm.sendInvite ? "Sending…" : "Creating…"}</>
                  ) : addUserForm.sendInvite ? (
                    <><Mail className="h-4 w-4 mr-2" />Send invitation</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-2" />Create user</>
                  )}
                </Button>
              </DialogFooter>
              </SubmitForm>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}>
          <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={orgUnitFilter} onValueChange={setOrgUnitFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-orgunit">
            <SelectValue placeholder="Org Unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Org Units</SelectItem>
            {orgUnitsList.map((ou) => (
              <SelectItem key={ou.id} value={String(ou.id)}>{ou.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center border rounded-md overflow-visible w-full sm:w-auto">
          <Button
            size="sm"
            variant="ghost"
            className={cn("rounded-r-none toggle-elevate", viewMode === "table" && "toggle-elevated")}
            onClick={() => setViewMode("table")}
            data-testid="button-view-table"
          >
            <Table2 className="h-4 w-4 mr-1" />
            Table
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn("rounded-l-none toggle-elevate", viewMode === "org" && "toggle-elevated")}
            onClick={() => setViewMode("org")}
            data-testid="button-view-org"
          >
            <Network className="h-4 w-4 mr-1" />
            Org View
          </Button>
        </div>
        {viewMode === "table" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-column-visibility">
                <SlidersHorizontal className="h-4 w-4 mr-1" />
                Columns
                {hiddenColumns.size > 0 && (
                  <Badge variant="secondary" className="ml-1">{allColumnIds.length - hiddenColumns.size}/{allColumnIds.length}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              {allColumnIds.map(colId => (
                <DropdownMenuItem
                  key={colId}
                  onSelect={(e) => { e.preventDefault(); toggleColumnVisibility(colId); }}
                  className="gap-2 cursor-pointer"
                  data-testid={`toggle-column-${colId}`}
                >
                  {hiddenColumns.has(colId) ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-primary" />
                  )}
                  <span className={cn(hiddenColumns.has(colId) && "text-muted-foreground")}>{columnLabels[colId]}</span>
                </DropdownMenuItem>
              ))}
              {hiddenColumns.size > 0 && (
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); setHiddenColumns(new Set()); }}
                  className="gap-2 cursor-pointer border-t mt-1 pt-1"
                  data-testid="button-show-all-columns"
                >
                  <Eye className="h-4 w-4" />
                  <span className="font-medium">Show All</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        </div>
        <p className="text-sm text-muted-foreground w-full sm:w-auto sm:ml-auto sm:text-right" data-testid="text-user-count">
          {filteredProfiles.length} member{filteredProfiles.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Tabs value={userTypeFilter} onValueChange={(v) => setUserTypeFilter(v as UserTypeFilter)}>
        <TabsList className="bg-muted/50 w-full justify-start overflow-x-auto flex-nowrap h-auto p-1" data-testid="tabs-user-type-filter">
          <TabsTrigger value="all" data-testid="tab-filter-all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="internal" data-testid="tab-filter-internal">Employees ({counts.internal})</TabsTrigger>
          <TabsTrigger value="external" data-testid="tab-filter-external">Contractors ({counts.external})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Users</DialogTitle>
            <DialogDescription>Review and import users from your uploaded file</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm text-muted-foreground">
                {bulkUploadUsers.filter((u) => u.isValid).length} valid of {bulkUploadUsers.length} entries found
              </div>
              <Button variant="ghost" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="bulk-send-invite">Send invitations</Label>
                <p className="text-xs text-muted-foreground">
                  On = create pending invites. Off = create profiles directly.
                </p>
              </div>
              <Switch
                id="bulk-send-invite"
                checked={bulkSendInvite}
                onCheckedChange={setBulkSendInvite}
                data-testid="switch-bulk-send-invite"
              />
            </div>

            {bulkSendInvite && (
              <div className="space-y-2">
                <Label>Platform role for all invites *</Label>
                <Select
                  value={bulkInvitePlatformRole}
                  onValueChange={(v) => setBulkInvitePlatformRole(v as PlatformRole)}
                >
                  <SelectTrigger data-testid="select-bulk-platform-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {PLATFORM_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Default module role (legacy)</Label>
              <Select value={bulkUploadRoleId} onValueChange={setBulkUploadRoleId}>
                <SelectTrigger data-testid="select-bulk-role">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>
                      {role.name}
                      {role.isAdmin ? " (Admin)" : ""}
                      {role.isDefault ? " (Default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[250px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkUploadPreviewPagination.paginatedItems.map((user, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{user.email}</TableCell>
                      <TableCell className="text-sm">
                        {[user.firstName, user.lastName].filter(Boolean).join(" ") || "-"}
                      </TableCell>
                      <TableCell className="text-sm">{user.userType || "-"}</TableCell>
                      <TableCell>
                        {user.isValid ? (
                          <Badge variant="secondary" className="bg-status-green text-status-green-foreground">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {user.error}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <TablePagination
              page={bulkUploadPreviewPagination.page}
              totalPages={bulkUploadPreviewPagination.totalPages}
              total={bulkUploadPreviewPagination.total}
              startIndex={bulkUploadPreviewPagination.startIndex}
              endIndex={bulkUploadPreviewPagination.endIndex}
              pageSize={bulkUploadPreviewPagination.pageSize}
              onPageChange={bulkUploadPreviewPagination.setPage}
              onPageSizeChange={bulkUploadPreviewPagination.setPageSize}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkUploadOpen(false)} data-testid="button-cancel-bulk">
              Cancel
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={
                isProcessingBulk || bulkUploadUsers.filter((u) => u.isValid).length === 0
              }
              data-testid="button-submit-bulk-import"
            >
              {isProcessingBulk ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Processing...</>
              ) : bulkSendInvite ? (
                <><Mail className="h-4 w-4 mr-2" />Invite {bulkUploadUsers.filter((u) => u.isValid).length} users</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" />Import {bulkUploadUsers.filter((u) => u.isValid).length} users</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewMode === "org" && (
        <div className="min-w-0 overflow-x-auto rounded-md border">
          <OrgChartFromReportsTo profiles={filteredProfiles} orgUnits={orgUnitsList} />
        </div>
      )}

      {viewMode === "table" && (
        <>
          <div className="md:hidden space-y-3" data-testid="users-mobile-list">
            {filteredProfiles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No users found
                </CardContent>
              </Card>
            ) : (
              filteredProfiles.map((profile) => (
                <TeamMemberMobileCard
                  key={profile.id}
                  profile={profile}
                  roles={roles}
                  platformRoleLabel={platformRoleByUserId.get(profile.user.id)}
                  onOpen={openDetailPanel}
                />
              ))
            )}
          </div>
          <div className="hidden md:block w-full max-w-full min-w-0">
            <MondayTable
              columns={visibleColumns}
              data={filteredProfiles}
              columnWidthStorageKey="jiganto-settings-users-col-widths"
              onRowClick={openDetailPanel}
              onCellEdit={handleTableCellEdit}
              onEditItem={openDetailPanel}
              onDeleteItems={(ids) => {
                ids.forEach(id => deleteProfileMutation.mutate(typeof id === "string" ? Number(id) : id));
              }}
              selectable
              gridLines
              emptyMessage="No users found"
              totalCount={profiles.length}
              className="w-full min-w-0"
              onRowSelect={(ids) => setBulkSelectedIds(ids)}
              renderBulkActions={(ids) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkAssignOpen(true)}
                  data-testid="button-bulk-assign"
                >
                  <FolderKanban className="h-4 w-4 mr-1" />
                  Assign to Project
                </Button>
              )}
            />
          </div>
        </>
      )}

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <Clock className="h-4 w-4" />
              Pending Invitations
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Copy each link and share it, or configure{" "}
              <code className="text-[11px]">RESEND_API_KEY</code> +{" "}
              <code className="text-[11px]">INVITE_EMAIL_FROM</code> to send email automatically.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="md:hidden divide-y">
              {pendingInvitationsPagination.paginatedItems.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`invitation-mobile-${inv.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{inv.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {invitationPlatformLabel(inv) ?? "Platform role pending"} ·{" "}
                      {roles.find((r) => r.id === inv.roleId)?.name || "No module role"} ·{" "}
                      {new Date(inv.createdAt!).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => copyInviteLink(inv.token)}
                      data-testid={`button-copy-invitation-${inv.id}`}
                    >
                      <Copy className="h-4 w-4 mr-1" /> Copy link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => deleteInvitationMutation.mutate(inv.id)}
                      data-testid={`button-revoke-invitation-${inv.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Email</TableHead>
                    <TableHead>Platform role</TableHead>
                    <TableHead>Module role (legacy)</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitationsPagination.paginatedItems.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell>{invitationPlatformLabel(inv) ?? "—"}</TableCell>
                      <TableCell>{roles.find((r) => r.id === inv.roleId)?.name || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(inv.createdAt!).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInviteLink(inv.token)}
                          data-testid={`button-copy-invitation-${inv.id}`}
                        >
                          <Copy className="h-4 w-4 mr-1" /> Copy link
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          onClick={() => deleteInvitationMutation.mutate(inv.id)}
                          data-testid={`button-revoke-invitation-${inv.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              page={pendingInvitationsPagination.page}
              totalPages={pendingInvitationsPagination.totalPages}
              total={pendingInvitationsPagination.total}
              startIndex={pendingInvitationsPagination.startIndex}
              endIndex={pendingInvitationsPagination.endIndex}
              pageSize={pendingInvitationsPagination.pageSize}
              onPageChange={pendingInvitationsPagination.setPage}
              onPageSizeChange={pendingInvitationsPagination.setPageSize}
            />
          </CardContent>
        </Card>
      )}

      <Sheet open={!!selectedProfile} onOpenChange={(open) => { if (!open) { setSelectedProfile(null); setDetailPermissions([]); setShowAssignmentForm(false); } }}>
        <SheetContent className="w-[90vw] sm:w-[500px] md:w-[600px] sm:max-w-[600px] p-0 flex flex-col" side="right">
          {selectedProfile && (
            <>
              <SheetHeader className="p-6 pb-4 border-b">
                <div className="flex items-center gap-4 flex-wrap">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedProfile.user.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {selectedProfile.user.firstName?.[0]}{selectedProfile.user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-left">
                      {selectedProfile.user.firstName} {selectedProfile.user.lastName}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground">{selectedProfile.user.email}</p>
                  </div>
                  {selectedProfile.isActive ? (
                    <Badge variant="secondary" className="bg-status-green text-status-green-foreground">Active</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-status-red text-status-red-foreground">Inactive</Badge>
                  )}
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Profile</h3>
                    <div className="flex flex-col items-center gap-3">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={detailForm.photoUrl || selectedProfile.user.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xl">
                          {selectedProfile.user.firstName?.[0]}{selectedProfile.user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-2 w-full">
                        <Input
                          value={detailForm.photoUrl}
                          onChange={(e) => setDetailForm({ ...detailForm, photoUrl: e.target.value })}
                          placeholder="Photo URL"
                          className="flex-1"
                          data-testid="input-detail-photourl"
                        />
                        <input
                          ref={photoUploadInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => photoUploadInputRef.current?.click()}
                          data-testid="button-upload-photo"
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input
                          value={detailForm.firstName}
                          onChange={(e) => setDetailForm({ ...detailForm, firstName: e.target.value })}
                          placeholder="First name"
                          data-testid="input-detail-firstname"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input
                          value={detailForm.lastName}
                          onChange={(e) => setDetailForm({ ...detailForm, lastName: e.target.value })}
                          placeholder="Last name"
                          data-testid="input-detail-lastname"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Input
                          value={detailForm.department}
                          onChange={(e) => setDetailForm({ ...detailForm, department: e.target.value })}
                          placeholder="Department"
                          data-testid="input-detail-department"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Job Title</Label>
                        <Input
                          value={detailForm.jobTitle}
                          onChange={(e) => setDetailForm({ ...detailForm, jobTitle: e.target.value })}
                          placeholder="Job title"
                          data-testid="input-detail-jobtitle"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={detailForm.phone}
                          onChange={(e) => setDetailForm({ ...detailForm, phone: e.target.value })}
                          placeholder="Phone"
                          data-testid="input-detail-phone"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>User Type</Label>
                        <Select value={detailForm.userType} onValueChange={(v) => setDetailForm({ ...detailForm, userType: v })}>
                          <SelectTrigger data-testid="select-detail-usertype">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {USER_TYPES.map((ut) => (
                              <SelectItem key={ut} value={ut}>{USER_TYPE_LABELS[ut]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cost Centre</Label>
                        <Select value={detailForm.costCentreId} onValueChange={(v) => setDetailForm({ ...detailForm, costCentreId: v })}>
                          <SelectTrigger data-testid="select-detail-costcentre">
                            <SelectValue placeholder="Select cost centre" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {costCentresList.map((cc: any) => (
                              <SelectItem key={cc.id} value={String(cc.id)}>{cc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Reports To</Label>
                        <Select value={detailForm.managerId} onValueChange={(v) => setDetailForm({ ...detailForm, managerId: v })}>
                          <SelectTrigger data-testid="select-detail-manager">
                            <SelectValue placeholder="Select manager" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {profiles
                              .filter(p => p.id !== selectedProfile.id)
                              .filter(p => p.managerId !== selectedProfile.id)
                              .map(p => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {`${p.user.firstName || ""} ${p.user.lastName || ""}`.trim() || p.user.email || `Profile #${p.id}`}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input
                          type="date"
                          value={detailForm.startDate}
                          onChange={(e) => setDetailForm({ ...detailForm, startDate: e.target.value })}
                          data-testid="input-detail-startdate"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input
                          type="date"
                          value={detailForm.endDate}
                          onChange={(e) => setDetailForm({ ...detailForm, endDate: e.target.value })}
                          data-testid="input-detail-enddate"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Bio</Label>
                      <Textarea
                        value={detailForm.bio}
                        onChange={(e) => setDetailForm({ ...detailForm, bio: e.target.value })}
                        placeholder="Short bio..."
                        className="resize-none"
                        data-testid="input-detail-bio"
                      />
                    </div>
                  </div>

                  <SettingsUserModulePermissionsGrid
                    permissions={permissionsForPanel}
                    onChange={setDetailPermissions}
                    roles={roles}
                    disabled={updateProfileMutation.isPending || savePermissionsMutation.isPending}
                  />

                  <div className="space-y-4">
                    {selectedProfile?.userType === "customer" && userAssignments.length === 0 && (
                      <div className="flex items-start gap-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="banner-customer-no-assignments">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No project assignments</p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Customer users need to be assigned to specific projects or programmes to control what they can access. Without assignments, they may have unrestricted visibility.</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Project & Programme Assignments</h3>
                        {userAssignments.length > 0 && (
                          <Badge variant="secondary" className="text-xs">{userAssignments.length}</Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAssignmentForm(!showAssignmentForm)}
                        data-testid="button-add-assignment"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Assignment
                      </Button>
                    </div>

                    {showAssignmentForm && (() => {
                      const assignedProjectIds = new Set(
                        userAssignments
                          .filter((a) => a.assignmentType === "project" && a.projectId)
                          .map((a) => a.projectId)
                      );
                      const assignedProgramIds = new Set(
                        userAssignments
                          .filter((a) => a.assignmentType === "programme" && a.programId)
                          .map((a) => a.programId)
                      );
                      const availableProjects = projectsList.filter((p: any) => !assignedProjectIds.has(p.id));
                      const availableProgrammes = programmesList.filter((p: any) => !assignedProgramIds.has(p.id));
                      const programmeProjectCounts: Record<number, number> = {};
                      for (const proj of projectsList) {
                        if (proj.programId) {
                          programmeProjectCounts[proj.programId] = (programmeProjectCounts[proj.programId] || 0) + 1;
                        }
                      }
                      const noItemsAvailable = newAssignment.assignmentType === "project" ? availableProjects.length === 0 : availableProgrammes.length === 0;

                      return (
                        <div className="border rounded-md p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Assignment Type</Label>
                              <Select value={newAssignment.assignmentType} onValueChange={(v) => setNewAssignment({ ...newAssignment, assignmentType: v, projectId: "", programId: "" })}>
                                <SelectTrigger data-testid="select-assignment-type">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="project">Project</SelectItem>
                                  <SelectItem value="programme">Programme</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Access Level</Label>
                              <Select value={newAssignment.accessLevel} onValueChange={(v) => setNewAssignment({ ...newAssignment, accessLevel: v })}>
                                <SelectTrigger data-testid="select-assignment-access">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ACCESS_LEVELS.map((al) => (
                                    <SelectItem key={al} value={al}>{al.charAt(0).toUpperCase() + al.slice(1)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{newAssignment.assignmentType === "project" ? "Project" : "Programme"}</Label>
                            {newAssignment.assignmentType === "project" ? (
                              <Select value={newAssignment.projectId} onValueChange={(v) => setNewAssignment({ ...newAssignment, projectId: v })}>
                                <SelectTrigger data-testid="select-assignment-project">
                                  <SelectValue placeholder={availableProjects.length === 0 ? "All projects already assigned" : "Select a project"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableProjects.map((p: any) => (
                                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Select value={newAssignment.programId} onValueChange={(v) => setNewAssignment({ ...newAssignment, programId: v })}>
                                <SelectTrigger data-testid="select-assignment-programme">
                                  <SelectValue placeholder={availableProgrammes.length === 0 ? "All programmes already assigned" : "Select a programme"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableProgrammes.map((p: any) => (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                      {p.name}
                                      {programmeProjectCounts[p.id] ? ` (${programmeProjectCounts[p.id]} projects)` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          {noItemsAvailable && (
                            <p className="text-xs text-muted-foreground">All {newAssignment.assignmentType === "project" ? "projects" : "programmes"} have already been assigned to this user.</p>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowAssignmentForm(false)} data-testid="button-cancel-assignment">
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleAddAssignment}
                              disabled={noItemsAvailable || createAssignmentMutation.isPending || (newAssignment.assignmentType === "project" ? !newAssignment.projectId : !newAssignment.programId)}
                              data-testid="button-submit-assignment"
                            >
                              {createAssignmentMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Add"}
                            </Button>
                          </div>
                        </div>
                      );
                    })()}

                    {userAssignments.length > 0 ? (
                      <div className="border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Access</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userAssignments.map((assignment) => (
                              <TableRow key={assignment.id} data-testid={`assignment-row-${assignment.id}`}>
                                <TableCell>
                                  <Badge variant="secondary" className="text-xs">
                                    {assignment.assignmentType === "project" ? "Project" : "Programme"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{getAssignmentName(assignment)}</TableCell>
                                <TableCell>
                                  <Select
                                    value={assignment.accessLevel || "view"}
                                    onValueChange={(v) => updateAssignmentMutation.mutate({ id: assignment.id, data: { accessLevel: v } })}
                                  >
                                    <SelectTrigger className="h-7 text-xs w-[100px]" data-testid={`select-assignment-access-${assignment.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ACCESS_LEVELS.map((al) => (
                                        <SelectItem key={al} value={al}>{al.charAt(0).toUpperCase() + al.slice(1)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  {assignment.isActive ? (
                                    <Badge variant="secondary" className="bg-status-green text-status-green-foreground text-xs">Active</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-status-red text-status-red-foreground text-xs">Inactive</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                    onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                                    data-testid={`button-delete-assignment-${assignment.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No assignments yet. Add project or programme assignments to control this user's access.</p>
                    )}
                  </div>
                </div>
              </ScrollArea>

              <div className="p-6 pt-4 border-t">
                <Button
                  className="w-full"
                  onClick={handleSaveDetail}
                  disabled={updateProfileMutation.isPending || savePermissionsMutation.isPending}
                  data-testid="button-save-detail"
                >
                  {(updateProfileMutation.isPending || savePermissionsMutation.isPending) ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" />Save Changes</>
                  )}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <BulkAssignmentDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        selectedProfileIds={bulkSelectedIds}
        selectedUserNames={bulkSelectedIds.map(id => {
          const p = profiles.find(pr => pr.id === Number(id));
          return p ? `${p.user.firstName || ""} ${p.user.lastName || ""}`.trim() || p.user.email || String(id) : String(id);
        })}
        tenantId={tenantId}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/settings/assignment-counts", tenantId] });
        }}
      />
    </div>
  );
}
