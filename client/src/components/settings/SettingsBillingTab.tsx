import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Mail, Headphones, RefreshCw } from "lucide-react";
import type { Tenant } from "@shared/schema";

type BillingConfig = {
  planName?: string;
  seatCount?: number;
  renewalDate?: string;
  status?: string;
};

interface Props {
  tenantId: number;
  tenant: Tenant | null | undefined;
}

export default function SettingsBillingTab({ tenantId, tenant }: Props) {
  const { toast } = useToast();
  const saved = (tenant?.brandingConfig as { billing?: BillingConfig })?.billing ?? {};
  const [planName, setPlanName] = useState(saved.planName ?? "Enterprise platform");
  const [seatCount, setSeatCount] = useState(String(saved.seatCount ?? ""));
  const [renewalDate, setRenewalDate] = useState(saved.renewalDate ?? "");
  const [status, setStatus] = useState(saved.status ?? "active");

  useEffect(() => {
    const b = (tenant?.brandingConfig as { billing?: BillingConfig })?.billing;
    if (!b) return;
    setPlanName(b.planName ?? "Enterprise platform");
    setSeatCount(b.seatCount != null ? String(b.seatCount) : "");
    setRenewalDate(b.renewalDate ?? "");
    setStatus(b.status ?? "active");
  }, [tenant?.brandingConfig]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const current = (tenant?.brandingConfig as Record<string, unknown>) || {};
      const res = await apiRequest("PUT", `/api/tenants/${tenantId}`, {
        brandingConfig: {
          ...current,
          billing: {
            planName: planName.trim() || undefined,
            seatCount: seatCount ? Number(seatCount) : undefined,
            renewalDate: renewalDate.trim() || undefined,
            status: status.trim() || "active",
          },
        },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", tenantId] });
      toast({ title: "Billing details saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-billing-tab">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>
            Licence metadata for your organisation. Payment processing is handled offline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold">{planName}</p>
              <p className="text-sm text-muted-foreground">
                {seatCount ? `${seatCount} licensed seats` : "Seat count not set"}
                {renewalDate ? ` · Renews ${renewalDate}` : ""}
              </p>
            </div>
            <Badge variant={status === "active" ? "secondary" : "outline"}>
              {status}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Plan name</Label>
              <Input value={planName} onChange={(e) => setPlanName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Licensed seats</Label>
              <Input
                type="number"
                value={seatCount}
                onChange={(e) => setSeatCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Renewal date</Label>
              <Input
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Input value={status} onChange={(e) => setStatus(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving…</>
            ) : (
              "Save subscription"
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            Online invoices and card payments are not integrated yet. Contact your account manager
            for commercial changes.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing & support contacts</CardTitle>
          <CardDescription>Edit in Settings → Organization.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Licence contact
            </p>
            <p className="font-medium">{tenant?.licenseContactName || "—"}</p>
            <p className="text-sm text-muted-foreground">
              {tenant?.licenseContactEmail || "Not set"}
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              Support contact
            </p>
            <p className="font-medium">{tenant?.supportContactName || "—"}</p>
            <p className="text-sm text-muted-foreground">
              {tenant?.supportContactEmail || "Not set"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
