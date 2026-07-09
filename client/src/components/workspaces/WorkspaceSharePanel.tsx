import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, fetchWithAuth } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { WorkspaceQueryShell } from "@/components/workspaces/loading";
import {
  fetchOrgMemberCandidates,
  formatOrgMemberLabel,
  getOrgMemberUserId,
} from "@/components/workspaces/orgMembers";
import type { WorkspaceMember } from "@shared/schema";

type PermissionValue = "view" | "edit" | "admin";

interface MemberWithUser extends WorkspaceMember {
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
}

export function WorkspaceSharePanel({
  workspaceId,
  open,
  onOpenChange,
  readOnly = false,
}: {
  workspaceId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [manualUserId, setManualUserId] = useState("");

  const membersQuery = useQuery<MemberWithUser[]>({
    queryKey: ["/api/workspaces", workspaceId, "members-with-users"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/members-with-users`);
      if (!res.ok) throw new Error("Failed to load members");
      const raw = await res.json();
      return Array.isArray(raw)
        ? raw.map((entry: any) => ({ ...(entry.member || entry), user: entry.user }))
        : [];
    },
    enabled: open && workspaceId > 0,
  });
  const members = membersQuery.data ?? [];

  const { data: orgMembers = [] } = useQuery({
    queryKey: ["/api/chat/users", "workspace-share", workspaceId],
    enabled: open && workspaceId > 0,
    queryFn: fetchOrgMemberCandidates,
    staleTime: 30000,
  });

  const memberPermissions = useMemo<Record<number, PermissionValue>>(() => {
    const next: Record<number, PermissionValue> = {};
    for (const member of members) {
      const value = (member.permission || "edit") as PermissionValue;
      next[member.id] = value === "view" || value === "edit" || value === "admin" ? value : "edit";
    }
    return next;
  }, [members]);

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/workspaces/${workspaceId}/members`, { userId, role: "member" });
      return res.json();
    },
    onSuccess: () => {
      setSelectedUserId("");
      setManualUserId("");
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members-with-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members"] });
      toast({ title: "Member added" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to add member",
        description: err?.message || "Please check the user id and try again.",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      await apiRequest("DELETE", `/api/workspace-members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members-with-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members"] });
      toast({ title: "Member removed" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to remove member",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ memberId, permission }: { memberId: number; permission: PermissionValue }) => {
      await apiRequest("PATCH", `/api/workspace-members/${memberId}/permission`, { permission });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members-with-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members"] });
    },
    onError: () => {
      toast({
        title: "Permission update unavailable",
        description: "This environment does not expose a member permission endpoint yet.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members-with-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members"] });
    },
  });

  const candidateOptions = orgMembers
    .map((m) => ({
      value: getOrgMemberUserId(m),
      label: formatOrgMemberLabel(m),
    }))
    .filter((option) => option.value);

  const canSubmit = !readOnly && !addMemberMutation.isPending && (selectedUserId || manualUserId.trim());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Share workspace
          </SheetTitle>
          <SheetDescription>
            Add collaborators and control access level for this workspace.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="rounded-md border p-3 text-xs text-muted-foreground">
            Share scope: members can access all pages and databases in this workspace according to their permission.
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Add member</label>
            {candidateOptions.length > 0 ? (
              <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={readOnly}>
                <SelectTrigger data-testid="share-member-select">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {candidateOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={manualUserId}
                onChange={(e) => setManualUserId(e.target.value)}
                placeholder="Enter user id"
                disabled={readOnly}
                data-testid="share-member-userid-input"
              />
            )}
            <Button
              size="sm"
              disabled={!canSubmit}
              onClick={() => addMemberMutation.mutate((selectedUserId || manualUserId).trim())}
              className="gap-1"
              data-testid="share-add-member"
            >
              {addMemberMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add member
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Members</h4>
              <Badge variant="secondary">{members.length}</Badge>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              <WorkspaceQueryShell query={membersQuery} skeleton="share">
              {members.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No members added yet.
                </div>
              )}
              {members.map((member) => {
                const userLabel = formatOrgMemberLabel({
                  id: member.userId,
                  firstName: member.user?.firstName ?? null,
                  lastName: member.user?.lastName ?? null,
                  email: member.user?.email ?? null,
                });
                const initials = userLabel.slice(0, 2).toUpperCase();
                return (
                  <div key={member.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{userLabel}</p>
                      {member.role && <p className="text-xs text-muted-foreground">Role: {member.role}</p>}
                    </div>
                    <Select
                      defaultValue={memberPermissions[member.id] || "edit"}
                      onValueChange={(value) =>
                        updatePermissionMutation.mutate({ memberId: member.id, permission: value as PermissionValue })
                      }
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-8 w-[110px]" data-testid={`member-permission-${member.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">View</SelectItem>
                        <SelectItem value="edit">Edit</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("h-8 w-8 text-muted-foreground", readOnly && "pointer-events-none opacity-40")}
                      disabled={readOnly || removeMemberMutation.isPending}
                      onClick={() => removeMemberMutation.mutate(member.id)}
                      data-testid={`remove-member-${member.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
              </WorkspaceQueryShell>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
