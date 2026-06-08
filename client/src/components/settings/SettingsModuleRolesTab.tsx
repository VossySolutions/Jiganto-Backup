import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Plus, Shield, Edit, Trash2, ChevronDown, Layers } from "lucide-react";
import type { UserRole, ModulePermissions } from "@shared/schema";
import SettingsModulePermissionsMatrix from "@/components/settings/SettingsModulePermissionsMatrix";

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
  { key: "test-mgmt", name: "Testing" },
  { key: "bpm", name: "BPM" },
];

interface Props {
  tenantId: number;
}

export default function SettingsModuleRolesTab({ tenantId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRoleIsAdmin, setNewRoleIsAdmin] = useState(false);
  const [newRolePermissions, setNewRolePermissions] = useState<ModulePermissions>({});

  const { data: roles = [], isLoading } = useQuery<UserRole[]>({
    queryKey: [`/api/settings/roles?tenantId=${tenantId}`],
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      isAdmin: boolean;
      permissions: ModulePermissions;
    }) => {
      const res = await apiRequest("POST", `/api/settings/roles`, { ...data, tenantId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/roles?tenantId=${tenantId}`] });
      setIsRoleDialogOpen(false);
      resetRoleForm();
      toast({ title: "Module role created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create role.", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<UserRole> }) => {
      const res = await apiRequest("PUT", `/api/settings/roles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/roles?tenantId=${tenantId}`] });
      setEditingRole(null);
      resetRoleForm();
      toast({ title: "Module role updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/settings/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/settings/roles?tenantId=${tenantId}`] });
      toast({ title: "Module role deleted" });
    },
  });

  const resetRoleForm = () => {
    setEditingRole(null);
    setNewRoleName("");
    setNewRoleDescription("");
    setNewRoleIsAdmin(false);
    setNewRolePermissions({});
  };

  const handlePermissionChange = (
    moduleKey: string,
    permission: "read" | "write" | "share",
    value: boolean,
  ) => {
    setNewRolePermissions((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [permission]: value,
      },
    }));
  };

  const getRolePermissions = (role: UserRole): ModulePermissions => {
    return (role.permissions as ModulePermissions) || {};
  };

  return (
    <div className="space-y-6">
      <SettingsModulePermissionsMatrix />
    <Collapsible open={open} onOpenChange={setOpen} data-testid="module-roles-section">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="gap-2 px-0 hover:bg-transparent">
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            />
            <Layers className="h-4 w-4" />
            <span className="text-lg font-semibold">Module roles (legacy)</span>
            <Badge variant="outline" className="font-normal">
              {roles.length} role{roles.length !== 1 ? "s" : ""}
            </Badge>
          </Button>
        </CollapsibleTrigger>
        <Dialog
          open={isRoleDialogOpen}
          onOpenChange={(next) => {
            setIsRoleDialogOpen(next);
            if (!next) resetRoleForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-create-role">
              <Plus className="h-4 w-4 mr-2" />
              Create module role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <SubmitForm
              className="flex flex-col flex-1 min-h-0"
              onSubmit={() => {
                if (editingRole) {
                  updateRoleMutation.mutate({
                    id: editingRole.id,
                    data: {
                      name: newRoleName,
                      description: newRoleDescription,
                      isAdmin: newRoleIsAdmin,
                      permissions: newRolePermissions,
                    },
                  });
                } else {
                  createRoleMutation.mutate({
                    name: newRoleName,
                    description: newRoleDescription,
                    isAdmin: newRoleIsAdmin,
                    permissions: newRolePermissions,
                  });
                }
              }}
              disabled={
                !newRoleName.trim() ||
                createRoleMutation.isPending ||
                updateRoleMutation.isPending
              }
            >
            <DialogHeader>
              <DialogTitle>{editingRole ? "Edit module role" : "Create module role"}</DialogTitle>
              <DialogDescription>
                Legacy per-module permission template assigned to user profiles
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role name</Label>
                  <Input
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g., Manager"
                    data-testid="input-role-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    placeholder="Brief description"
                    data-testid="input-role-description"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-admin"
                  checked={newRoleIsAdmin}
                  onCheckedChange={setNewRoleIsAdmin}
                />
                <Label htmlFor="is-admin">Administrator (full access to all modules)</Label>
              </div>
              {!newRoleIsAdmin && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Module</TableHead>
                        <TableHead className="text-center w-20">Read</TableHead>
                        <TableHead className="text-center w-20">Write</TableHead>
                        <TableHead className="text-center w-20">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableModules.map((mod) => (
                        <TableRow key={mod.key}>
                          <TableCell className="font-medium">{mod.name}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={newRolePermissions[mod.key]?.read || false}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(mod.key, "read", !!checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={newRolePermissions[mod.key]?.write || false}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(mod.key, "write", !!checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={newRolePermissions[mod.key]?.share || false}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(mod.key, "share", !!checked)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRoleDialogOpen(false);
                  resetRoleForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="button-save-role"
              >
                {editingRole ? "Update role" : "Create role"}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        Optional templates for profile module permissions. Does not replace platform roles.
      </p>

      <CollapsibleContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading module roles…</p>
        ) : (
          <div className="grid gap-4">
            {roles.map((role) => (
              <Card key={role.id} data-testid={`role-card-${role.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "p-2 rounded-lg shrink-0",
                          role.isAdmin ? "bg-status-purple" : "bg-status-blue",
                        )}
                      >
                        <Shield
                          className={cn(
                            "h-5 w-5",
                            role.isAdmin
                              ? "text-status-purple-foreground"
                              : "text-status-blue-foreground",
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{role.name}</h3>
                          {role.isAdmin && <Badge variant="secondary">Admin</Badge>}
                          {role.isDefault && <Badge variant="outline">Default</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {role.description || "No description"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingRole(role);
                          setNewRoleName(role.name);
                          setNewRoleDescription(role.description || "");
                          setNewRoleIsAdmin(role.isAdmin || false);
                          setNewRolePermissions(getRolePermissions(role));
                          setIsRoleDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      {!role.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteRoleMutation.mutate(role.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                  {!role.isAdmin && Object.keys(getRolePermissions(role)).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Permissions:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(getRolePermissions(role)).map(([moduleKey, perms]) => {
                          const mod = availableModules.find((m) => m.key === moduleKey);
                          if (!mod) return null;
                          const permList = [];
                          if (perms.read) permList.push("R");
                          if (perms.write) permList.push("W");
                          if (perms.share) permList.push("S");
                          if (permList.length === 0) return null;
                          return (
                            <Badge key={moduleKey} variant="outline" className="text-xs">
                              {mod.name}: {permList.join("/")}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
    </div>
  );
}
