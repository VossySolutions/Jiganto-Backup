import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plug, RefreshCw, Zap, Mail } from "lucide-react";
import type { Tenant } from "@shared/schema";
import SettingsApiKeysSection from "@/components/settings/SettingsApiKeysSection";

type IntegrationCatalogItem = {
  id: string;
  name: string;
  description: string;
  status: "available" | "planned";
};

const CATALOG: IntegrationCatalogItem[] = [
  {
    id: "microsoft",
    name: "Microsoft Entra ID (SSO)",
    description: "Single sign-on for your organisation",
    status: "planned",
  },
  {
    id: "google",
    name: "Google Workspace",
    description: "Sign in with Google for your team",
    status: "planned",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Post workflow notifications to channels",
    status: "planned",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Alerts and deep links into Jiganto modules",
    status: "planned",
  },
  {
    id: "webhook",
    name: "Outbound webhooks",
    description: "HTTP callbacks for invites and workflow events",
    status: "available",
  },
];

interface Props {
  tenantId: number;
  tenant: Tenant | null | undefined;
}

export default function SettingsIntegrationsTab({ tenantId, tenant }: Props) {
  const { toast } = useToast();
  type IntegrationsConfig = {
    webhookUrl?: string;
    smtp?: {
      host?: string;
      port?: string;
      username?: string;
      encryption?: "tls" | "ssl" | "none";
    };
  };
  const branding = (tenant?.brandingConfig as {
    integrations?: IntegrationsConfig;
    sso?: { entityId?: string; acsUrl?: string; idpMetadataUrl?: string };
  }) ?? {};
  const [ssoEntityId, setSsoEntityId] = useState(branding.sso?.entityId ?? "");
  const [ssoAcsUrl, setSsoAcsUrl] = useState(branding.sso?.acsUrl ?? "");
  const [ssoMetadataUrl, setSsoMetadataUrl] = useState(branding.sso?.idpMetadataUrl ?? "");
  const [smtpTestPassword, setSmtpTestPassword] = useState("");
  const [webhookUrl, setWebhookUrl] = useState(branding.integrations?.webhookUrl ?? "");
  const [smtpHost, setSmtpHost] = useState(branding.integrations?.smtp?.host ?? "");
  const [smtpPort, setSmtpPort] = useState(branding.integrations?.smtp?.port ?? "587");
  const [smtpUser, setSmtpUser] = useState(branding.integrations?.smtp?.username ?? "");
  const [smtpEncryption, setSmtpEncryption] = useState<"tls" | "ssl" | "none">(
    branding.integrations?.smtp?.encryption ?? "tls",
  );

  useEffect(() => {
    setWebhookUrl(branding.integrations?.webhookUrl ?? "");
    setSmtpHost(branding.integrations?.smtp?.host ?? "");
    setSmtpPort(branding.integrations?.smtp?.port ?? "587");
    setSmtpUser(branding.integrations?.smtp?.username ?? "");
    setSmtpEncryption(branding.integrations?.smtp?.encryption ?? "tls");
  }, [tenant?.brandingConfig]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const current = (tenant?.brandingConfig as Record<string, unknown>) || {};
      const res = await apiRequest("PUT", `/api/tenants/${tenantId}`, {
        brandingConfig: {
          ...current,
          integrations: {
            webhookUrl: webhookUrl.trim() || undefined,
            smtp: smtpHost.trim()
              ? {
                  host: smtpHost.trim(),
                  port: smtpPort.trim() || "587",
                  username: smtpUser.trim() || undefined,
                  encryption: smtpEncryption,
                }
              : undefined,
          },
          sso:
            ssoEntityId.trim() || ssoAcsUrl.trim() || ssoMetadataUrl.trim()
              ? {
                  entityId: ssoEntityId.trim() || undefined,
                  acsUrl: ssoAcsUrl.trim() || undefined,
                  idpMetadataUrl: ssoMetadataUrl.trim() || undefined,
                }
              : undefined,
        },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", tenantId] });
      toast({ title: "Integration settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const testWebhookMut = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth("/api/settings/webhook-test", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Test failed");
      }
      return res.json() as Promise<{
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
      const d = data.webhookDelivery;
      if (d?.skipped && d.reason === "no_webhook_url") {
        toast({
          title: "No webhook URL",
          description: "Save a webhook URL first, then test again.",
          variant: "destructive",
        });
        return;
      }
      if (d?.delivered) {
        toast({
          title: "Test webhook delivered",
          description: d.statusCode ? `Endpoint responded ${d.statusCode}.` : undefined,
        });
        return;
      }
      toast({
        title: "Webhook delivery failed",
        description:
          d?.error?.slice(0, 120) ||
          (d?.statusCode ? `HTTP ${d.statusCode}` : "Check the URL and server logs."),
        variant: "destructive",
      });
    },
    onError: (e: Error) => {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    },
  });

  const testSmtpMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/smtp-test", {
        password: smtpTestPassword || undefined,
      });
      return res.json() as Promise<{ sent: boolean; method: string; error?: string }>;
    },
    onSuccess: (r) => {
      if (r.sent) toast({ title: "Test email sent", description: `Via ${r.method}` });
      else
        toast({
          title: "Email not sent",
          description: r.error || "Check SMTP host and SMTP_PASSWORD on server",
          variant: "destructive",
        });
    },
    onError: () => toast({ title: "SMTP test failed", variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-integrations-tab">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Integrations
          </CardTitle>
          <CardDescription>
            Connect identity providers and notification channels. Catalog items marked planned are
            on the product roadmap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CATALOG.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-lg border p-4"
              data-testid={`integration-${item.id}`}
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Badge variant={item.status === "available" ? "secondary" : "outline"}>
                {item.status === "available" ? "Configurable" : "Coming soon"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom SMTP</CardTitle>
          <CardDescription>
            When configured, notification email should use this server instead of Jiganto default
            (delivery wiring is server-side; save settings here for your runbook).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SMTP host</Label>
              <Input
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.example.com"
                data-testid="input-smtp-host"
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                data-testid="input-smtp-port"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Username</Label>
              <Input
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                data-testid="input-smtp-user"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Encryption</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={smtpEncryption}
                onChange={(e) => setSmtpEncryption(e.target.value as "tls" | "ssl" | "none")}
                data-testid="select-smtp-encryption"
              >
                <option value="tls">TLS</option>
                <option value="ssl">SSL</option>
                <option value="none">None</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Set <code className="text-xs">SMTP_PASSWORD</code> on the server, or enter a
                one-time password below for testing only.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Test password (optional)</Label>
              <Input
                type="password"
                value={smtpTestPassword}
                onChange={(e) => setSmtpTestPassword(e.target.value)}
                autoComplete="off"
                data-testid="input-smtp-test-password"
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => testSmtpMut.mutate()}
            disabled={testSmtpMut.isPending || !smtpHost.trim()}
            data-testid="button-test-smtp"
          >
            {testSmtpMut.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Sending…</>
            ) : (
              <><Mail className="h-4 w-4 mr-2" />Send test email to me</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SAML 2.0 (SSO)</CardTitle>
          <CardDescription>
            Store IdP metadata for your runbook. Live SAML login flow is not enabled yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Entity ID</Label>
            <Input value={ssoEntityId} onChange={(e) => setSsoEntityId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>ACS URL</Label>
            <Input value={ssoAcsUrl} onChange={(e) => setSsoAcsUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>IdP metadata URL</Label>
            <Input value={ssoMetadataUrl} onChange={(e) => setSsoMetadataUrl(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <SettingsApiKeysSection />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outbound webhook</CardTitle>
          <CardDescription>
            Receives POST requests for <code className="text-xs">invitation.created</code>,{" "}
            <code className="text-xs">invitation.accepted</code>, and{" "}
            <code className="text-xs">invitation.revoked</code>. Optional HMAC via{" "}
            <code className="text-xs">WEBHOOK_SIGNING_SECRET</code> in server env.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-service.com/webhooks/jiganto"
              data-testid="input-webhook-url"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              data-testid="button-save-integrations"
            >
              {saveMut.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              ) : (
                "Save integrations"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => testWebhookMut.mutate()}
              disabled={testWebhookMut.isPending || !webhookUrl.trim()}
              data-testid="button-test-webhook"
            >
              {testWebhookMut.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Sending…</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" />Send test event</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
