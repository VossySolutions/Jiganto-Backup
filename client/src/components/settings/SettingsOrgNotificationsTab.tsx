import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Mail, RefreshCw } from "lucide-react";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  type OrgNotificationSettings,
} from "@shared/models/org-notifications";
import type { Tenant } from "@shared/schema";

interface Props {
  tenantId: number;
  tenant: Tenant | null | undefined;
}

export default function SettingsOrgNotificationsTab({ tenantId, tenant }: Props) {
  const { toast } = useToast();
  const branding = (tenant?.brandingConfig as { orgNotifications?: OrgNotificationSettings }) ?? {};
  const [settings, setSettings] = useState<OrgNotificationSettings>(
    branding.orgNotifications ?? { digestMode: "off", defaults: {} },
  );

  useEffect(() => {
    setSettings(branding.orgNotifications ?? { digestMode: "off", defaults: {} });
  }, [tenant?.brandingConfig]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const current = (tenant?.brandingConfig as Record<string, unknown>) || {};
      const res = await apiRequest("PUT", `/api/tenants/${tenantId}`, {
        brandingConfig: {
          ...current,
          orgNotifications: settings,
        },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", tenantId] });
      toast({ title: "Notification defaults saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const toggleCategory = (
    category: (typeof NOTIFICATION_CATEGORIES)[number],
    channel: "inApp" | "email",
    value: boolean,
  ) => {
    setSettings((s) => ({
      ...s,
      defaults: {
        ...s.defaults,
        [category]: {
          ...s.defaults?.[category],
          [channel]: value,
        },
      },
    }));
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-org-notifications-tab">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications & email
          </CardTitle>
          <CardDescription>
            Organisation defaults for workflow alerts. Users can override channels in Profile →
            Notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 max-w-xs">
            <Label>Email digest</Label>
            <Select
              value={settings.digestMode ?? "off"}
              onValueChange={(v) =>
                setSettings((s) => ({
                  ...s,
                  digestMode: v as OrgNotificationSettings["digestMode"],
                }))
              }
            >
              <SelectTrigger data-testid="select-digest-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off — send per event</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
                <SelectItem value="weekly">Weekly digest</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Digest delivery requires scheduled jobs (not yet automated).
            </p>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium">
              <span>Category</span>
              <span className="text-center flex items-center justify-center gap-1">
                <Bell className="h-3 w-3" /> In-app
              </span>
              <span className="text-center flex items-center justify-center gap-1">
                <Mail className="h-3 w-3" /> Email
              </span>
            </div>
            {NOTIFICATION_CATEGORIES.map((cat) => {
              const row = settings.defaults?.[cat];
              return (
                <div
                  key={cat}
                  className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-3 border-t items-center"
                  data-testid={`org-notif-row-${cat}`}
                >
                  <span className="text-sm">{NOTIFICATION_CATEGORY_LABELS[cat]}</span>
                  <div className="flex justify-center">
                    <Switch
                      checked={row?.inApp !== false}
                      onCheckedChange={(v) => toggleCategory(cat, "inApp", v)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={row?.email !== false}
                      onCheckedChange={(v) => toggleCategory(cat, "email", v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            data-testid="button-save-org-notifications"
          >
            {saveMut.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save defaults"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
