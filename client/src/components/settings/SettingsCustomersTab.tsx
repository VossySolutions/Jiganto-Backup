import { useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { coerceArray } from "@/lib/coerce-array";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { MondayTable, type ColumnDef, type StatusOption } from "@/components/MondayTable";
import { TablePagination } from "@/components/TablePagination";
import { useTablePagination } from "@/hooks/use-table-pagination";
import {
  Plus,
  Trash2,
  UserPlus,
  Save,
  RefreshCw,
  Search,
  AlertTriangle,
  FolderKanban,
  Upload,
  Building2,
  SlidersHorizontal,
  Eye,
  EyeOff
} from "lucide-react";
import BulkAssignmentDialog from "@/components/settings/BulkAssignmentDialog";
import type { Profile, UserRole, UserModulePermission, UserProjectAssignment } from "@shared/schema";
import { ACCESS_LEVELS, USER_TYPES, USER_TYPE_LABELS } from "@shared/schema";

type ProfileWithUser = Profile & {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    profileImageUrl: string | null;
  };
};

interface SettingsCustomersTabProps {
  profiles: ProfileWithUser[];
  roles: UserRole[];
  tenantId: number;
}

const availableModules = [
  { key: "dashboard", name: "Dashboard" },
  { key: "chat", name: "Chat" },
  { key: "business-mgmt", name: "Business Management" },
  { key: "crm", name: "CRM" },
  { key: "documents", name: "Documents" },
  { key: "tasks", name: "Tasks" },
  { key: "portfolio-mgmt", name: "Portfolio" },
  { key: "project-mgmt", name: "Projects" },
  { key: "finance-mgmt", name: "Finance" },
  { key: "resource-mgmt", name: "Resources" },
  { key: "bpm", name: "BPM" },
  { key: "workspaces", name: "Workspaces" },
];

type PermissionRow = {
  moduleKey: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export default function SettingsCustomersTab({ profiles, roles, tenantId }: SettingsCustomersTabProps) {
  const { toast } = useToast();

  const customerProfiles = useMemo(() => profiles.filter(p => p.userType === "customer"), [profiles]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<(number | string)[]>([]);
  const allColumnIds = ["department", "user", "jobTitle", "roleId", "assignments", "email", "phone", "status"] as const;
  const columnLabels: Record<string, string> = {
    department: "Organisation", user: "User", jobTitle: "Job Title", roleId: "Role",
    assignments: "Assignments", email: "Email", phone: "Phone", status: "Status",
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
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ProfileWithUser | null>(null);
  const [detailForm, setDetailForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    department: "",
    jobTitle: "",
    phone: "",
    bio: "",
    photoUrl: "",
    roleId: "",
    userType: "customer",
    isActive: true,
  });
  const [detailPermissions, setDetailPermissions] = useState<PermissionRow[]>([]);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ assignmentType: "project", projectId: "", programId: "", accessLevel: "view" });
  const photoUploadInputRef = useRef<HTMLInputElement>(null);

  const [addCustomerForm, setAddCustomerForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    jobTitle: "",
    phone: "",
    roleId: "",
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
      toast({ title: "Customer updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update customer.", variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/settings/users`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/users?tenantId=${tenantId}`] });
      setIsAddCustomerOpen(false);
      setAddCustomerForm({ firstName: "", lastName: "", email: "", company: "", jobTitle: "", phone: "", roleId: "" });
      toast({ title: "Customer added", description: "New customer user has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create customer.", variant: "destructive" });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/settings/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/users?tenantId=${tenantId}`] });
      toast({ title: "Customer removed" });
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

  let filteredProfiles = [...customerProfiles];

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
      const dept = (p.department || "").toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }

  const openDetailPanel = (profile: ProfileWithUser) => {
    setSelectedProfile(profile);
    setDetailForm({
      firstName: profile.user.firstName || "",
      lastName: profile.user.lastName || "",
      email: profile.user.email || "",
      department: profile.department || "",
      jobTitle: profile.jobTitle || "",
      phone: profile.phone || "",
      bio: profile.bio || "",
      photoUrl: profile.photoUrl || "",
      roleId: profile.roleId ? String(profile.roleId) : "",
      userType: profile.userType || "customer",
      isActive: profile.isActive !== false,
    });
    setShowAssignmentForm(true);
    setNewAssignment({ assignmentType: "project", projectId: "", programId: "", accessLevel: "view" });
  };

  const initPermissionsFromData = (perms: UserModulePermission[]) => {
    return availableModules.map(mod => {
      const existing = perms.find(p => p.moduleKey === mod.key);
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
      toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
    }
  };

  const handleSaveDetail = () => {
    if (!selectedProfile) return;
    updateProfileMutation.mutate({
      id: selectedProfile.id,
      data: {
        firstName: detailForm.firstName || null,
        lastName: detailForm.lastName || null,
        email: detailForm.email || null,
        department: detailForm.department || null,
        jobTitle: detailForm.jobTitle || null,
        phone: detailForm.phone || null,
        bio: detailForm.bio || null,
        photoUrl: detailForm.photoUrl || null,
        roleId: detailForm.roleId ? Number(detailForm.roleId) : null,
        userType: detailForm.userType || "customer",
        isActive: detailForm.isActive,
      } as any,
    });
    if (detailPermissions.length > 0) {
      savePermissionsMutation.mutate({
        profileId: selectedProfile.id,
        permissions: detailPermissions,
      });
    }
  };

  const handleAddCustomer = () => {
    if (!addCustomerForm.email) return;
    createUserMutation.mutate({
      tenantId,
      userType: "customer",
      department: addCustomerForm.company || null,
      jobTitle: addCustomerForm.jobTitle || null,
      phone: addCustomerForm.phone || null,
      roleId: addCustomerForm.roleId ? Number(addCustomerForm.roleId) : null,
      firstName: addCustomerForm.firstName || null,
      lastName: addCustomerForm.lastName || null,
      email: addCustomerForm.email,
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

  const handlePermToggle = (moduleKey: string, field: keyof PermissionRow, value: boolean) => {
    const current = detailPermissions.length > 0 ? detailPermissions : initPermissionsFromData(userPermissions);
    const updated = current.map((p) =>
      p.moduleKey === moduleKey ? { ...p, [field]: value } : p
    );
    setDetailPermissions(updated);
  };

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

  const roleOptions: StatusOption[] = useMemo(() =>
    roles.map(r => ({ value: String(r.id), label: r.name, color: "" })),
    [roles]
  );

  const customersTableColumns: ColumnDef<ProfileWithUser>[] = useMemo(() => [
    {
      id: "department",
      header: "Organisation",
      type: "text" as const,
      accessor: "department" as keyof ProfileWithUser,
      width: "180px",
      editable: true,
    },
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
      width: "240px",
      editable: false,
    },
    {
      id: "jobTitle",
      header: "Job Title",
      type: "text" as const,
      accessor: "jobTitle" as keyof ProfileWithUser,
      width: "160px",
      editable: true,
    },
    {
      id: "roleId",
      header: "Role",
      type: "select" as const,
      accessor: (row: ProfileWithUser) => row.roleId ? String(row.roleId) : "",
      width: "140px",
      editable: true,
      options: roleOptions,
    },
    {
      id: "assignments",
      header: "Assignments",
      type: "text" as const,
      accessor: (row: ProfileWithUser) => {
        const count = assignmentCounts[String(row.id)] || 0;
        return count > 0 ? `${count} assigned` : "None";
      },
      width: "130px",
      editable: false,
    },
    {
      id: "email",
      header: "Email",
      type: "text" as const,
      accessor: (row: ProfileWithUser) => row.user.email || "",
      width: "220px",
      editable: false,
    },
    {
      id: "phone",
      header: "Phone",
      type: "text" as const,
      accessor: "phone" as keyof ProfileWithUser,
      width: "140px",
      editable: true,
    },
    {
      id: "status",
      header: "Status",
      type: "status" as const,
      accessor: (row: ProfileWithUser) => row.isActive ? "active" : "inactive",
      width: "100px",
      editable: false,
      options: [
        { value: "active", label: "Active", color: "bg-status-green text-status-green-foreground" },
        { value: "inactive", label: "Inactive", color: "bg-status-red text-status-red-foreground" },
      ],
    },
  ], [roleOptions, assignmentCounts]);

  const visibleColumns = useMemo(() => 
    customersTableColumns.filter(col => !hiddenColumns.has(col.id)),
    [customersTableColumns, hiddenColumns]
  );

  const handleTableCellEdit = useCallback((rowId: number | string, columnId: string, value: unknown) => {
    const profileId = typeof rowId === "string" ? Number(rowId) : rowId;
    const strValue = value != null ? String(value) : null;

    switch (columnId) {
      case "department":
        updateProfileMutation.mutate({ id: profileId, data: { department: strValue || null } });
        break;
      case "roleId":
        updateProfileMutation.mutate({ id: profileId, data: { roleId: strValue ? Number(strValue) : null } as any });
        break;
      case "jobTitle":
        updateProfileMutation.mutate({ id: profileId, data: { jobTitle: strValue || null } });
        break;
      case "phone":
        updateProfileMutation.mutate({ id: profileId, data: { phone: strValue || null } });
        break;
    }
  }, [updateProfileMutation]);

  const assignmentsPagination = useTablePagination(userAssignments, {
    resetKey: `${selectedProfile?.id ?? 0}-${userAssignments.length}`,
    enabled: !!selectedProfile,
  });
  const modulePermissionsPagination = useTablePagination(availableModules, {
    resetKey: availableModules.length,
    enabled: !!selectedProfile,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-customers-title">Customer Users</h2>
          <p className="text-sm text-muted-foreground">Manage customer access to projects and programmes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-customer">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <SubmitForm
                onSubmit={handleAddCustomer}
                disabled={!addCustomerForm.email || createUserMutation.isPending}
              >
              <DialogHeader>
                <DialogTitle>Add Customer User</DialogTitle>
                <DialogDescription>Create a new customer user and assign them to projects</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={addCustomerForm.firstName}
                      onChange={(e) => setAddCustomerForm({ ...addCustomerForm, firstName: e.target.value })}
                      placeholder="First name"
                      data-testid="input-add-customer-firstname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={addCustomerForm.lastName}
                      onChange={(e) => setAddCustomerForm({ ...addCustomerForm, lastName: e.target.value })}
                      placeholder="Last name"
                      data-testid="input-add-customer-lastname"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={addCustomerForm.email}
                    onChange={(e) => setAddCustomerForm({ ...addCustomerForm, email: e.target.value })}
                    placeholder="customer@company.com"
                    data-testid="input-add-customer-email"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input
                      value={addCustomerForm.company}
                      onChange={(e) => setAddCustomerForm({ ...addCustomerForm, company: e.target.value })}
                      placeholder="Company name"
                      data-testid="input-add-customer-company"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={addCustomerForm.roleId} onValueChange={(v) => setAddCustomerForm({ ...addCustomerForm, roleId: v })}>
                      <SelectTrigger data-testid="select-add-customer-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    <Input
                      value={addCustomerForm.jobTitle}
                      onChange={(e) => setAddCustomerForm({ ...addCustomerForm, jobTitle: e.target.value })}
                      placeholder="Job title"
                      data-testid="input-add-customer-jobtitle"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={addCustomerForm.phone}
                      onChange={(e) => setAddCustomerForm({ ...addCustomerForm, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      data-testid="input-add-customer-phone"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddCustomerOpen(false)} data-testid="button-cancel-add-customer">Cancel</Button>
                <Button
                  type="submit"
                  data-testid="button-submit-add-customer"
                >
                  {createUserMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-2" />Add Customer</>
                  )}
                </Button>
              </DialogFooter>
              </SubmitForm>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-customers"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-customer-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-customer-column-visibility">
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
                data-testid={`toggle-customer-column-${colId}`}
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
                data-testid="button-customer-show-all-columns"
              >
                <Eye className="h-4 w-4" />
                <span className="font-medium">Show All</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto text-sm text-muted-foreground" data-testid="text-customer-count">
          {filteredProfiles.length} customer{filteredProfiles.length !== 1 ? "s" : ""}
        </div>
      </div>

      {customerProfiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-3 rounded-full bg-muted mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No customer users yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Customer users are external users from your client organisations. Add them here and assign them to specific projects to control what they can access.
            </p>
            <Button onClick={() => setIsAddCustomerOpen(true)} data-testid="button-add-customer-empty">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Your First Customer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <MondayTable
          columns={visibleColumns}
          data={filteredProfiles}
          onRowClick={openDetailPanel}
          onCellEdit={handleTableCellEdit}
          onEditItem={openDetailPanel}
          onDeleteItems={(ids) => {
            ids.forEach(id => deleteProfileMutation.mutate(typeof id === "string" ? Number(id) : id));
          }}
          selectable
          gridLines
          emptyMessage="No customers match your search"
          totalCount={customerProfiles.length}
          className="border rounded-md"
          columnWidthStorageKey="jiganto-customers-col-widths"
          onRowSelect={(ids) => setBulkSelectedIds(ids)}
          renderBulkActions={(_ids) => (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAssignOpen(true)}
              data-testid="button-bulk-assign-customers"
            >
              <FolderKanban className="h-4 w-4 mr-1" />
              Assign to Project
            </Button>
          )}
        />
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
                    {selectedProfile.department && (
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedProfile.department}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="bg-status-purple text-status-purple-foreground">Customer</Badge>
                    {selectedProfile.isActive ? (
                      <Badge variant="secondary" className="bg-status-green text-status-green-foreground">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-status-red text-status-red-foreground">Inactive</Badge>
                    )}
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  {userAssignments.length === 0 && (
                    <div className="flex items-start gap-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="banner-customer-no-assignments">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No project assignments</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">This customer needs to be assigned to specific projects or programmes to control what they can access. Without assignments, they may have unrestricted visibility.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
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
                            <p className="text-xs text-muted-foreground">All {newAssignment.assignmentType === "project" ? "projects" : "programmes"} have already been assigned to this customer.</p>
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
                      <>
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
                            {assignmentsPagination.paginatedItems.map((assignment) => (
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
                      <TablePagination
                        page={assignmentsPagination.page}
                        totalPages={assignmentsPagination.totalPages}
                        total={assignmentsPagination.total}
                        startIndex={assignmentsPagination.startIndex}
                        endIndex={assignmentsPagination.endIndex}
                        pageSize={assignmentsPagination.pageSize}
                        onPageChange={assignmentsPagination.setPage}
                        onPageSizeChange={assignmentsPagination.setPageSize}
                      />
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No assignments yet. Add project or programme assignments to control this customer's access.</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Profile Details</h3>
                    <div className="flex flex-col items-center gap-3">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={detailForm.photoUrl || selectedProfile.user.profileImageUrl || undefined} />
                        <AvatarFallback className="text-lg">
                          {selectedProfile.user.firstName?.[0]}{selectedProfile.user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-2 w-full">
                        <Input
                          value={detailForm.photoUrl}
                          onChange={(e) => setDetailForm({ ...detailForm, photoUrl: e.target.value })}
                          placeholder="Photo URL"
                          className="flex-1"
                          data-testid="input-customer-photourl"
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
                          data-testid="button-upload-customer-photo"
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input
                          value={detailForm.firstName}
                          onChange={(e) => setDetailForm({ ...detailForm, firstName: e.target.value })}
                          placeholder="First name"
                          data-testid="input-customer-firstname"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input
                          value={detailForm.lastName}
                          onChange={(e) => setDetailForm({ ...detailForm, lastName: e.target.value })}
                          placeholder="Last name"
                          data-testid="input-customer-lastname"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input
                        value={detailForm.email}
                        onChange={(e) => setDetailForm({ ...detailForm, email: e.target.value })}
                        placeholder="Email address"
                        data-testid="input-customer-email"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company</Label>
                        <Input
                          value={detailForm.department}
                          onChange={(e) => setDetailForm({ ...detailForm, department: e.target.value })}
                          placeholder="Company name"
                          data-testid="input-customer-company"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={detailForm.roleId} onValueChange={(v) => setDetailForm({ ...detailForm, roleId: v === "none" ? "" : v })}>
                          <SelectTrigger data-testid="select-customer-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Job Title</Label>
                        <Input
                          value={detailForm.jobTitle}
                          onChange={(e) => setDetailForm({ ...detailForm, jobTitle: e.target.value })}
                          placeholder="Job title"
                          data-testid="input-customer-jobtitle"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={detailForm.phone}
                          onChange={(e) => setDetailForm({ ...detailForm, phone: e.target.value })}
                          placeholder="Phone"
                          data-testid="input-customer-phone"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>User Type</Label>
                        <Select value={detailForm.userType} onValueChange={(v) => setDetailForm({ ...detailForm, userType: v })}>
                          <SelectTrigger data-testid="select-customer-usertype">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {USER_TYPES.map((ut) => (
                              <SelectItem key={ut} value={ut}>{USER_TYPE_LABELS[ut]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={detailForm.isActive ? "active" : "inactive"} onValueChange={(v) => setDetailForm({ ...detailForm, isActive: v === "active" })}>
                          <SelectTrigger data-testid="select-customer-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Bio</Label>
                      <Textarea
                        value={detailForm.bio}
                        onChange={(e) => setDetailForm({ ...detailForm, bio: e.target.value })}
                        placeholder="Short bio..."
                        className="resize-none"
                        data-testid="input-customer-bio"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Module Permissions</h3>
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Module</TableHead>
                            <TableHead className="text-center w-16">Create</TableHead>
                            <TableHead className="text-center w-16">Read</TableHead>
                            <TableHead className="text-center w-16">Update</TableHead>
                            <TableHead className="text-center w-16">Delete</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {modulePermissionsPagination.paginatedItems.map((mod) => {
                            const perms = detailPermissions.length > 0 ? detailPermissions : initPermissionsFromData(userPermissions);
                            const perm = perms.find(p => p.moduleKey === mod.key) || { moduleKey: mod.key, canCreate: false, canRead: true, canUpdate: false, canDelete: false };
                            return (
                              <TableRow key={mod.key}>
                                <TableCell className="font-medium text-sm">{mod.name}</TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={perm.canCreate}
                                    onCheckedChange={(v) => handlePermToggle(mod.key, "canCreate", !!v)}
                                    data-testid={`checkbox-customer-perm-${mod.key}-create`}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={perm.canRead}
                                    onCheckedChange={(v) => handlePermToggle(mod.key, "canRead", !!v)}
                                    data-testid={`checkbox-customer-perm-${mod.key}-read`}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={perm.canUpdate}
                                    onCheckedChange={(v) => handlePermToggle(mod.key, "canUpdate", !!v)}
                                    data-testid={`checkbox-customer-perm-${mod.key}-update`}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={perm.canDelete}
                                    onCheckedChange={(v) => handlePermToggle(mod.key, "canDelete", !!v)}
                                    data-testid={`checkbox-customer-perm-${mod.key}-delete`}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <TablePagination
                      page={modulePermissionsPagination.page}
                      totalPages={modulePermissionsPagination.totalPages}
                      total={modulePermissionsPagination.total}
                      startIndex={modulePermissionsPagination.startIndex}
                      endIndex={modulePermissionsPagination.endIndex}
                      pageSize={modulePermissionsPagination.pageSize}
                      onPageChange={modulePermissionsPagination.setPage}
                      onPageSizeChange={modulePermissionsPagination.setPageSize}
                    />
                  </div>
                </div>
              </ScrollArea>

              <div className="p-6 pt-4 border-t">
                <Button
                  className="w-full"
                  onClick={handleSaveDetail}
                  disabled={updateProfileMutation.isPending || savePermissionsMutation.isPending}
                  data-testid="button-save-customer-detail"
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
          const p = customerProfiles.find(pr => pr.id === Number(id));
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
