import { useEffect, useMemo, useRef, useState } from "react";
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
import { DASHBOARD_PATH } from "@shared/app-routes";

type InviteKind = "org" | "client";

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
  const [inviteKind, setInviteKind] = useState<InviteKind | null>(null);

  useEffect(() => {
    if (token) savePendingInviteToken(token);
  }, [token]);

  const clientPreviewQuery = useQuery({
    queryKey: ["/api/clients/invitations/preview", token],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/clients/invitations/${encodeURIComponent(token!)}/preview`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(await parseErrorMessage(res));
      const data = await res.json() as { email: string; clientName?: string; role?: string };
      setInviteKind("client");
      return data;
    },
  });

  const orgPreviewQuery = useQuery({
    queryKey: ["/api/auth/invitations/preview", token],
    enabled: !!token && clientPreviewQuery.isFetched && clientPreviewQuery.data === null,
    queryFn: async () => {
      const res = await fetch(`/api/auth/invitations/${encodeURIComponent(token!)}/preview`);
      if (!res.ok) throw new Error(await parseErrorMessage(res));
      const data = await res.json() as { email: string; platformRole: string | null };
      setInviteKind("org");
      return data;
    },
  });

  const preview = clientPreviewQuery.data ?? orgPreviewQuery.data;
  const previewLoading = clientPreviewQuery.isLoading || orgPreviewQuery.isLoading;
  const previewError = clientPreviewQuery.error ?? orgPreviewQuery.error;

  const orgInvitationQuery = useQuery({
    queryKey: ["/api/auth/invitations", token],
    enabled: !!token && sessionReady && !!user && inviteKind === "org",
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
      const path =
        inviteKind === "client"
          ? `/api/clients/invitations/${encodeURIComponent(token!)}/accept`
          : `/api/auth/invitations/${encodeURIComponent(token!)}/accept`;
      const res = await fetchWithAuth(path, {
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
      await queryClient.invalidateQueries({ queryKey: ["/api/clients/me"] });
      window.location.href = DASHBOARD_PATH;
    },
  });

  const invitedEmail = preview?.email ?? orgInvitationQuery.data?.email;
  const emailMismatch = useMemo(() => {
    if (!user?.email || !invitedEmail) return false;
    return user.email.toLowerCase() !== invitedEmail.toLowerCase();
  }, [user?.email, invitedEmail]);

  useEffect(() => {
    if (!shouldAutoAcceptInvite()) return;
    if (!user || !inviteKind || emailMismatch) return;
    if (inviteKind === "org" && !orgInvitationQuery.data) return;
    if (acceptMutation.isPending || acceptMutation.isSuccess) return;
    if (autoAcceptAttempted.current) return;
    autoAcceptAttempted.current = true;
    clearAutoAcceptInvite();
    acceptMutation.mutate();
  }, [
    user,
    inviteKind,
    orgInvitationQuery.data,
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 space-y-4">
          <h1 className="text-lg font-semibold">
            {inviteKind === "client" ? "Join client workspace" : "Join your organisation"}
          </h1>
          <p className="text-sm text-muted-foreground">
            To accept this invitation, sign in or create an account
            {invitedEmail ? (
              <> with <strong className="text-foreground">{invitedEmail}</strong></>
            ) : (
              " using the same email address that received the invite"
            )}
            .
          </p>
          {previewLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading invitation details...
            </p>
          )}
          {previewError && (
            <p className="text-xs text-destructive">{String(previewError)}</p>
          )}
          <Button
            className="w-full"
            onClick={() => goToInviteSignIn(token, invitedEmail)}
          >
            Sign in or create account
          </Button>
        </div>
      </div>
    );
  }

  if (previewLoading || (shouldAutoAcceptInvite() && !acceptMutation.error && acceptMutation.isPending)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {acceptMutation.isPending ? "Accepting invitation…" : "Loading invitation…"}
      </div>
    );
  }

  if (previewError && !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3 text-sm">
          <p className="text-destructive font-medium">Could not load invitation</p>
          <p className="text-muted-foreground">{String(previewError)}</p>
          <Button variant="outline" onClick={() => { window.location.href = DASHBOARD_PATH; }}>
            Go to home
          </Button>
        </div>
      </div>
    );
  }

  const clientPreview = clientPreviewQuery.data;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 space-y-4">
        <h1 className="text-lg font-semibold">Accept invitation</h1>
        <p className="text-sm text-muted-foreground">
          {inviteKind === "client" && clientPreview ? (
            <>
              You are invited to <strong>{clientPreview.clientName}</strong> as{" "}
              <strong>{clientPreview.email}</strong>
              {clientPreview.role && (
                <> with role <strong>{clientPreview.role.replace("_", " ")}</strong></>
              )}
              .
            </>
          ) : (
            <>
              You are invited as <strong>{orgInvitationQuery.data?.email ?? invitedEmail}</strong>
              {orgInvitationQuery.data?.platformRole && (
                <>
                  {" "}with platform role{" "}
                  <strong>
                    {PLATFORM_ROLE_LABELS[orgInvitationQuery.data.platformRole as PlatformRole]}
                  </strong>
                </>
              )}
              .
            </>
          )}
        </p>
        {emailMismatch && (
          <p className="text-xs text-destructive flex items-start gap-2">
            <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Signed in as {user.email}. Use {invitedEmail} to accept.
          </p>
        )}
        <div className="flex gap-2">
          <Button
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending || emailMismatch || !inviteKind}
          >
            {acceptMutation.isPending ? "Accepting..." : "Accept invitation"}
          </Button>
          <Button variant="outline" onClick={() => { window.location.href = DASHBOARD_PATH; }}>
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
