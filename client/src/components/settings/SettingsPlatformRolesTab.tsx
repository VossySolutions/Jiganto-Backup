import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Shield } from "lucide-react";
import type { PlatformRole } from "@shared/models/permissions";
import {
  PLATFORM_ROLE_LABELS,
  isImmutablePlatformRole,
} from "@shared/models/permissions";

type MembershipRow = {
  id: number;
  userId: string;
  orgId: number;
  platformRole: PlatformRole;
  lockedWorkspaceId: number | null;
  isActive: boolean;
  user?: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  };
};

interface Props {
  tenantId: number;
  clients: { id: number; name: string }[];
}

export default function SettingsPlatformRolesTab({ tenantId, clients }: Props) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [platformRole, setPlatformRole] = useState<PlatformRole>("si_consultant_pm");
  const [lockedWorkspaceId, setLockedWorkspaceId] = useState<string>("none");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/org-memberships", tenantId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/org-memberships?orgId=${tenantId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        memberships: MembershipRow[];
        platformRoles: PlatformRole[];
      }>;
    },
  });

  const { data: users = [] } = useQuery<
    { user: { id: string; email: string | null; firstName: string | null; lastName: string | null } }[]
  >({
    queryKey: [`/api/settings/users?tenantId=${tenantId}`],
  });

  const createMut = useMutation({
    mutationFn: (body: unknown) => apiRequest("POST", "/api/org-memberships", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-memberships", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      setDialogOpen(false);
      toast({ title: "Platform role assigned" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/org-memberships/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-memberships", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
    },
  });

  const memberships = data?.memberships ?? [];
  const roles = data?.platformRoles ?? (Object.keys(PLATFORM_ROLE_LABELS) as PlatformRole[]);

  const usersWithoutMembership = users.filter(
    (p) => !memberships.some((m) => m.userId === p.user.id),
  );

  return (
    <Card data-testid="platform-roles-tab">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Platform roles
        </CardTitle>
        <CardDescription>
          Assign one platform role per user for this organisation. Organisation owners (SI Super
          Admin) are protected and cannot be removed or changed here. Users without a row may
          still get a role when they accept an invitation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => setDialogOpen(true)} className="gap-2" data-testid="add-platform-role">
          <Plus className="h-4 w-4" />
          Assign platform role
        </Button>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Platform role</TableHead>
                <TableHead>Locked workspace</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((m) => {
                const protectedRole = isImmutablePlatformRole(m.platformRole);
                return (
                <TableRow key={m.id} data-testid={`membership-${m.id}`}>
                  <TableCell>
                    <div className="font-medium">
                      {[m.user?.firstName, m.user?.lastName].filter(Boolean).join(" ") ||
                        m.user?.email ||
                        m.userId}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.user?.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{PLATFORM_ROLE_LABELS[m.platformRole]}</Badge>
                      {protectedRole && (
                        <Badge variant="secondary" className="text-[10px]">
                          Protected
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.lockedWorkspaceId
                      ? clients.find((c) => c.id === m.lockedWorkspaceId)?.name ??
                        `#${m.lockedWorkspaceId}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {protectedRole ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMut.mutate(m.id)}
                        data-testid={`delete-membership-${m.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign platform role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger data-testid="platform-role-user">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {usersWithoutMembership.map((p) => (
                    <SelectItem key={p.user.id} value={p.user.id}>
                      {p.user.email} — {[p.user.firstName, p.user.lastName].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Platform role</Label>
              <Select value={platformRole} onValueChange={(v) => setPlatformRole(v as PlatformRole)}>
                <SelectTrigger data-testid="platform-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {PLATFORM_ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(platformRole === "client_project_user" || platformRole === "client_executive") && (
              <div className="space-y-2">
                <Label>Locked client company</Label>
                {clients.length === 0 ? (
                  <p className="text-xs text-muted-foreground rounded-md border p-3">
                    No client companies yet. Add one under <strong>Clients</strong> in the main menu,
                    then return here to assign access.
                  </p>
                ) : (
                  <Select value={lockedWorkspaceId} onValueChange={setLockedWorkspaceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client company" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!userId || createMut.isPending}
              onClick={() =>
                createMut.mutate({
                  userId,
                  orgId: tenantId,
                  platformRole,
                  isActive: true,
                  lockedWorkspaceId:
                    lockedWorkspaceId !== "none" ? Number(lockedWorkspaceId) : null,
                })
              }
              data-testid="save-platform-role"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
