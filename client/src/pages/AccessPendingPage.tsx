import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { getPendingInviteToken, inviteAcceptPath } from "@/lib/pending-invite";

type AccessState = {
  granted: boolean;
  bootstrapAvailable?: boolean;
};

export function AccessPendingPage() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [organisationName, setOrganisationName] = useState("");
  const pendingInvite = getPendingInviteToken();

  const accessQuery = useQuery<AccessState>({
    queryKey: ["/api/auth/access"],
    staleTime: 60_000,
  });

  const bootstrapMutation = useMutation({
    mutationFn: async () => {
      const name = organisationName.trim();
      const res = await apiRequest("POST", "/api/auth/bootstrap-admin", {
        organisationName: name || undefined,
      });
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      localStorage.removeItem("jiganto_active_client_id");
      void queryClient.invalidateQueries({ queryKey: ["/api/auth/access"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      window.location.href = "/";
    },
  });

  const bootstrapAvailable = accessQuery.data?.bootstrapAvailable === true;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 space-y-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-amber-500" />
          <h1 className="text-xl font-semibold">Access pending</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your account is signed in, but no organisation role is assigned yet.
        </p>

        {accessQuery.isLoading ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking setup options…
          </p>
        ) : bootstrapAvailable ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-medium">First time setting up Jiganto?</p>
            <p className="text-xs text-muted-foreground">
              No administrator exists yet. Enter your organisation name and become{" "}
              <strong>SI Super Admin</strong> (full access).
            </p>
            <div className="space-y-2">
              <Label htmlFor="organisation-name">Organisation name</Label>
              <Input
                id="organisation-name"
                value={organisationName}
                onChange={(e) => setOrganisationName(e.target.value)}
                placeholder="e.g. Contoso Consulting"
                data-testid="input-organisation-name"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => bootstrapMutation.mutate()}
              disabled={bootstrapMutation.isPending || !organisationName.trim()}
            >
              {bootstrapMutation.isPending ? "Setting up…" : "Set up as first administrator"}
            </Button>
            {bootstrapMutation.error && (
              <p className="text-xs text-destructive">{String(bootstrapMutation.error)}</p>
            )}
          </div>
        ) : pendingInvite ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              You have a pending organisation invitation. Continue to accept it and get access.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                window.location.href = inviteAcceptPath(pendingInvite);
              }}
            >
              Continue to invitation
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ask your administrator to invite you or assign a role. If you have an invite link, open
            it while signed in (same email as the invite).
          </p>
        )}

        <div className="pt-2">
          <Button variant="outline" onClick={() => logout()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
