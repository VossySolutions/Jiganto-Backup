import { useEffect, useMemo, useRef } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  PLATFORM_ROLE_LABELS,
  type PlatformRole,
} from "@shared/models/permissions";
import { fetchWithAuth, queryClient } from "@/lib/queryClient";
import {
  clearAutoAcceptInvite,
  clearPendingInviteToken,
  goToInviteSignIn,
  savePendingInviteToken,
  shouldAutoAcceptInvite,
} from "@/lib/pending-invite";

async function parseErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { message?: string };
    return json.message ?? text;
  } catch {
    return text || res.statusText;
  }
}

export function AcceptInvitationPage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ? decodeURIComponent(params.token) : null;
  const { user, isLoading: authLoading, sessionReady } = useAuth();
  const autoAcceptAttempted = useRef(false);

  useEffect(() => {
    if (token) savePendingInviteToken(token);
  }, [token]);

  const previewQuery = useQuery({
    queryKey: ["/api/auth/invitations/preview", token],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`/api/auth/invitations/${encodeURIComponent(token!)}/preview`);
      if (!res.ok) throw new Error(await parseErrorMessage(res));
      return res.json() as Promise<{
        email: string;
        platformRole: string | null;
      }>;
    },
  });

  const invitationQuery = useQuery({
    queryKey: ["/api/auth/invitations", token],
    enabled: !!token && sessionReady && !!user,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/auth/invitations/${encodeURIComponent(token!)}`);
      if (!res.ok) throw new Error(await parseErrorMessage(res));
      return res.json() as Promise<{
        email: string;
        tenantId: number;
        platformRole?: string | null;
      }>;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(`/api/auth/invitations/${encodeURIComponent(token!)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(await parseErrorMessage(res));
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: async () => {
      clearPendingInviteToken();
      clearAutoAcceptInvite();
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/access"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      window.location.href = "/";
    },
  });

  const emailMismatch = useMemo(() => {
    const invited = invitationQuery.data?.email ?? previewQuery.data?.email;
    if (!user?.email || !invited) return false;
    return user.email.toLowerCase() !== invited.toLowerCase();
  }, [user?.email, invitationQuery.data?.email, previewQuery.data?.email]);

  useEffect(() => {
    if (!shouldAutoAcceptInvite()) return;
    if (!user || !invitationQuery.data || emailMismatch) return;
    if (acceptMutation.isPending || acceptMutation.isSuccess) return;
    if (autoAcceptAttempted.current) return;
    autoAcceptAttempted.current = true;
    clearAutoAcceptInvite();
    acceptMutation.mutate();
  }, [
    user,
    invitationQuery.data,
    emailMismatch,
    acceptMutation.isPending,
    acceptMutation.isSuccess,
  ]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-sm">
        Invalid invitation link.
      </div>
    );
  }

  if (!sessionReady || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking sign-in status…
      </div>
    );
  }

  if (!user) {
    const invitedEmail = previewQuery.data?.email;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 space-y-4">
          <h1 className="text-lg font-semibold">Join your organisation</h1>
          <p className="text-sm text-muted-foreground">
            To accept this invitation, sign in or create an account
            {invitedEmail ? (
              <>
                {" "}
                with <strong className="text-foreground">{invitedEmail}</strong>
              </>
            ) : (
              " using the same email address that received the invite"
            )}
            . You will return here automatically after sign-in.
          </p>
          {previewQuery.isLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading invitation details...
            </p>
          )}
          {previewQuery.error && (
            <p className="text-xs text-destructive">{String(previewQuery.error)}</p>
          )}
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
            <li>Sign in or create an account (use the invited email)</li>
            <li>Your invitation will be accepted automatically after sign-in</li>
          </ol>
          <Button
            className="w-full"
            onClick={() => goToInviteSignIn(token, previewQuery.data?.email)}
          >
            Sign in or create account
          </Button>
        </div>
      </div>
    );
  }

  if (invitationQuery.isLoading || (shouldAutoAcceptInvite() && !acceptMutation.error)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {acceptMutation.isPending ? "Accepting invitation…" : "Loading invitation…"}
      </div>
    );
  }

  if (invitationQuery.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3 text-sm">
          <p className="text-destructive font-medium">Could not load invitation</p>
          <p className="text-muted-foreground">{String(invitationQuery.error)}</p>
          {user?.email && previewQuery.data?.email && (
            <p className="text-xs flex items-start gap-2">
              <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Signed in as <strong>{user.email}</strong>
              {user.email.toLowerCase() !== previewQuery.data.email.toLowerCase() && (
                <>
                  {" "}
                  — this invite was sent to <strong>{previewQuery.data.email}</strong>. Sign out and
                  use that email.
                </>
              )}
            </p>
          )}
          <Button variant="outline" onClick={() => { window.location.href = "/"; }}>
            Go to home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 space-y-4">
        <h1 className="text-lg font-semibold">Accept invitation</h1>
        <p className="text-sm text-muted-foreground">
          You are invited as <strong>{invitationQuery.data?.email}</strong>
          {invitationQuery.data?.platformRole && (
            <>
              {" "}
              with platform role{" "}
              <strong>
                {PLATFORM_ROLE_LABELS[invitationQuery.data.platformRole as PlatformRole]}
              </strong>
            </>
          )}
          . Click accept to join the organisation.
        </p>
        {emailMismatch && (
          <p className="text-xs text-destructive">
            You are signed in as {user.email}. Sign out and sign in with{" "}
            {invitationQuery.data?.email} to accept.
          </p>
        )}
        <div className="flex gap-2">
          <Button
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending || emailMismatch}
          >
            {acceptMutation.isPending ? "Accepting..." : "Accept invitation"}
          </Button>
          <Button variant="outline" onClick={() => { window.location.href = "/"; }}>
            Cancel
          </Button>
        </div>
        {acceptMutation.error && (
          <p className="text-xs text-destructive">{String(acceptMutation.error)}</p>
        )}
      </div>
    </div>
  );
}
