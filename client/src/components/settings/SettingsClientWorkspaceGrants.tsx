import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2, Building2 } from "lucide-react";
import type { PlatformRole } from "@shared/models/permissions";

type GrantRow = {
  id: number;
  tenantId: number;
  userId: string;
  clientId: number;
};

type MembershipRow = {
  userId: string;
  platformRole: PlatformRole;
  user?: { email: string | null; firstName: string | null; lastName: string | null };
};

interface Props {
  tenantId: number;
  clients: { id: number; name: string }[];
}

const GRANTABLE_ROLES: PlatformRole[] = ["si_consultant_pm", "si_super_admin"];

export default function SettingsClientWorkspaceGrants({ tenantId, clients }: Props) {
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [clientId, setClientId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/org-memberships", tenantId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/org-memberships?orgId=${tenantId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        memberships: MembershipRow[];
        workspaceGrants: GrantRow[];
      }>;
    },
  });

  const createMut = useMutation({
    mutationFn: (body: { tenantId: number; userId: string; clientId: number }) =>
      apiRequest("POST", "/api/client-workspace-grants", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-memberships", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      setUserId("");
      setClientId("");
      toast({ title: "Workspace access granted" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/client-workspace-grants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-memberships", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
    },
  });

  const grants = data?.workspaceGrants ?? [];
  const siUsers =
    data?.memberships.filter((m) => GRANTABLE_ROLES.includes(m.platformRole)) ?? [];

  const userLabel = (uid: string) => {
    const m = siUsers.find((u) => u.userId === uid);
    if (!m) return uid;
    const name = [m.user?.firstName, m.user?.lastName].filter(Boolean).join(" ");
    return name ? `${m.user?.email ?? uid} (${name})` : (m.user?.email ?? uid);
  };

  return (
    <Card data-testid="client-workspace-grants">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Client workspace grants
        </CardTitle>
        <CardDescription>
          Restrict SI consultants to specific client workspaces. Users with no grants can access all
          clients (when their platform role allows switching).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="space-y-2 flex-1 min-w-0">
            <Label>SI user</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger data-testid="grant-user-select">
                <SelectValue placeholder="Select consultant / PM" />
              </SelectTrigger>
              <SelectContent>
                {siUsers.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {userLabel(m.userId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <Label>Client company</Label>
            {clients.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-md border p-3">
                No client companies yet. Add one under <strong>Clients</strong>, then assign consultant
                access here.
              </p>
            ) : (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger data-testid="grant-client-select">
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
          <Button
            className="shrink-0"
            disabled={!userId || !clientId || clients.length === 0 || createMut.isPending}
            onClick={() =>
              createMut.mutate({
                tenantId,
                userId,
                clientId: Number(clientId),
              })
            }
            data-testid="button-add-grant"
          >
            <Plus className="h-4 w-4 mr-1" />
            Grant access
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading grants…</p>
        ) : grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workspace grants — all SI users see every client.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Client workspace</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {grants.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="text-sm">{userLabel(g.userId)}</TableCell>
                  <TableCell>
                    {clients.find((c) => c.id === g.clientId)?.name ?? `#${g.clientId}`}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMut.mutate(g.id)}
                      data-testid={`delete-grant-${g.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
