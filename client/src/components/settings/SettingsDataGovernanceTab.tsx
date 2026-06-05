import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Shield, RefreshCw, Trash2, Calendar } from "lucide-react";
import SettingsErasureRequests from "@/components/settings/SettingsErasureRequests";
import type { Tenant } from "@shared/schema";

type DataGovernanceConfig = {
  dataRetentionDays?: number;
  privacyPolicyUrl?: string;
  dpoEmail?: string;
  allowSelfServiceExport?: boolean;
};

interface Props {
  tenantId: number;
  tenant: Tenant | null | undefined;
}

export default function SettingsDataGovernanceTab({ tenantId, tenant }: Props) {
  const { toast } = useToast();
  const branding = (tenant?.brandingConfig as { dataGovernance?: DataGovernanceConfig }) ?? {};
  const saved = branding.dataGovernance ?? {};

  const [dataRetentionDays, setDataRetentionDays] = useState(
    String(saved.dataRetentionDays ?? 365),
  );
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState(saved.privacyPolicyUrl ?? "");
  const [dpoEmail, setDpoEmail] = useState(saved.dpoEmail ?? "");
  const [allowSelfServiceExport, setAllowSelfServiceExport] = useState(
    saved.allowSelfServiceExport ?? false,
  );

  useEffect(() => {
    const dg = (tenant?.brandingConfig as { dataGovernance?: DataGovernanceConfig })?.dataGovernance;
    if (!dg) return;
    setDataRetentionDays(String(dg.dataRetentionDays ?? 365));
    setPrivacyPolicyUrl(dg.privacyPolicyUrl ?? "");
    setDpoEmail(dg.dpoEmail ?? "");
    setAllowSelfServiceExport(!!dg.allowSelfServiceExport);
  }, [tenant?.brandingConfig]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const current = (tenant?.brandingConfig as Record<string, unknown>) || {};
      const days = Math.max(30, Math.min(3650, Number(dataRetentionDays) || 365));
      const res = await apiRequest("PUT", `/api/tenants/${tenantId}`, {
        brandingConfig: {
          ...current,
          dataGovernance: {
            dataRetentionDays: days,
            privacyPolicyUrl: privacyPolicyUrl.trim() || undefined,
            dpoEmail: dpoEmail.trim() || undefined,
            allowSelfServiceExport,
          },
        },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", tenantId] });
      toast({ title: "Data & privacy settings saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const runRetention = async () => {
    try {
      const res = await fetchWithAuth("/api/settings/retention-run", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const body = await res.json();
      toast({
        title: "Retention completed",
        description: `Removed ${body.notificationsDeleted} notifications, ${body.auditEventsDeleted} audit events.`,
      });
    } catch {
      toast({ title: "Retention run failed", variant: "destructive" });
    }
  };

  const importHolidays = async () => {
    try {
      const res = await apiRequest("POST", "/api/settings/holidays/import", {});
      const body = await res.json();
      toast({
        title: "Holidays imported",
        description: `${body.count} dates for ${body.region}`,
      });
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-data-governance-tab">
      <SettingsErasureRequests />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data & privacy
          </CardTitle>
          <CardDescription>
            Organisation-level retention and privacy contacts. Full GDPR export and deletion
            workflows are planned; these settings document your policy for users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default data retention (days)</Label>
            <Input
              type="number"
              min={30}
              max={3650}
              value={dataRetentionDays}
              onChange={(e) => setDataRetentionDays(e.target.value)}
              data-testid="input-data-retention"
            />
            <p className="text-xs text-muted-foreground">
              Deletes organisation notifications and audit events older than this period when you run
              retention below.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Privacy policy URL</Label>
            <Input
              value={privacyPolicyUrl}
              onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
              placeholder="https://yourcompany.com/privacy"
              data-testid="input-privacy-url"
            />
          </div>
          <div className="space-y-2">
            <Label>Data protection contact (DPO)</Label>
            <Input
              type="email"
              value={dpoEmail}
              onChange={(e) => setDpoEmail(e.target.value)}
              placeholder="dpo@yourcompany.com"
              data-testid="input-dpo-email"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="allow-export">Allow self-service export requests</Label>
              <p className="text-xs text-muted-foreground">
                When on, users see a data export option on their Profile tab
              </p>
            </div>
            <Switch
              id="allow-export"
              checked={allowSelfServiceExport}
              onCheckedChange={setAllowSelfServiceExport}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              data-testid="button-save-data-governance"
            >
              {saveMut.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              ) : (
                "Save settings"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={runRetention}
              data-testid="button-run-retention"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Run retention now
            </Button>
            <Button variant="outline" onClick={importHolidays} data-testid="button-import-holidays">
              <Calendar className="h-4 w-4 mr-2" />
              Import public holidays
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Uses the public holidays region from Organization settings. SLA calculations use
            business hours and imported holidays via <code className="text-xs">business-calendar</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
