import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Props {
  tenantId: number;
}

export default function SettingsImpersonationTab({ tenantId }: Props) {
  const { permissions } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");

  const { data: users = [] } = useQuery<
    { user: { id: string; email: string | null; firstName: string | null; lastName: string | null } }[]
  >({
    queryKey: [`/api/settings/users?tenantId=${tenantId}`],
    enabled: permissions?.isJigantoStaff === true,
  });

  const startMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/auth/impersonation/start", {
        targetUserId,
        orgId: tenantId,
        reason,
      }),
    onSuccess: () => {
      toast({ title: "Impersonation started", description: "Reloading session…" });
      queryClient.invalidateQueries();
      window.location.reload();
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!permissions?.isJigantoStaff) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Staff impersonation</CardTitle>
          <CardDescription>Only Jiganto staff can impersonate users for support.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff impersonation</CardTitle>
        <CardDescription>
          View the app as another user. All actions are logged in staff_impersonation_logs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label>Target user</Label>
          <Select value={targetUserId} onValueChange={setTargetUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((row) => (
                <SelectItem key={row.user.id} value={row.user.id}>
                  {row.user.email ?? row.user.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Reason (audit log)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Support ticket #…" />
        </div>
        <Button
          onClick={() => startMutation.mutate()}
          disabled={!targetUserId || startMutation.isPending}
        >
          Start impersonation
        </Button>
      </CardContent>
    </Card>
  );
}
