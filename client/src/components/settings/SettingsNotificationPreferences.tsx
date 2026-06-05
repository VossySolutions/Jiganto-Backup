import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, fetchWithAuth, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Mail, RefreshCw } from "lucide-react";
import type { UserNotificationPreferences } from "@shared/models/auth";

export default function SettingsNotificationPreferences() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<UserNotificationPreferences>({});

  const { data, isLoading } = useQuery({
    queryKey: ["/api/settings/preferences"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/settings/preferences");
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ notifications: UserNotificationPreferences }>;
    },
  });

  useEffect(() => {
    if (data?.notifications) setPrefs(data.notifications);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async (notifications: UserNotificationPreferences) => {
      const res = await apiRequest("PUT", "/api/settings/preferences", { notifications });
      return res.json();
    },
    onSuccess: (body: { notifications: UserNotificationPreferences }) => {
      setPrefs(body.notifications);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/preferences"] });
      toast({ title: "Notification preferences saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const toggle = (key: keyof UserNotificationPreferences, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  return (
    <Card data-testid="settings-notification-preferences">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Notifications
        </CardTitle>
        <CardDescription>
          Choose how you receive workflow alerts and invitations. Email delivery requires Resend
          configuration on the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading preferences…</p>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4" />
                In-app
              </p>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <Label htmlFor="inAppWorkflow">Workflow & module alerts</Label>
                <Switch
                  id="inAppWorkflow"
                  checked={!!prefs.inAppWorkflow}
                  onCheckedChange={(v) => toggle("inAppWorkflow", v)}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <Label htmlFor="inAppMentions">Mentions & assignments</Label>
                <Switch
                  id="inAppMentions"
                  checked={!!prefs.inAppMentions}
                  onCheckedChange={(v) => toggle("inAppMentions", v)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </p>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <Label htmlFor="emailWorkflow">Workflow notifications</Label>
                  <p className="text-xs text-muted-foreground">Task updates, approvals, due dates</p>
                </div>
                <Switch
                  id="emailWorkflow"
                  checked={!!prefs.emailWorkflow}
                  onCheckedChange={(v) => toggle("emailWorkflow", v)}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <Label htmlFor="emailInvitations">Invitations & access</Label>
                  <p className="text-xs text-muted-foreground">Org invites and role changes</p>
                </div>
                <Switch
                  id="emailInvitations"
                  checked={!!prefs.emailInvitations}
                  onCheckedChange={(v) => toggle("emailInvitations", v)}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <Label htmlFor="emailWeeklyDigest">Weekly digest</Label>
                  <p className="text-xs text-muted-foreground">Summary of open items</p>
                </div>
                <Switch
                  id="emailWeeklyDigest"
                  checked={!!prefs.emailWeeklyDigest}
                  onCheckedChange={(v) => toggle("emailWeeklyDigest", v)}
                />
              </div>
            </div>

            <Button
              onClick={() => saveMut.mutate(prefs)}
              disabled={saveMut.isPending}
              data-testid="button-save-notification-prefs"
            >
              {saveMut.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              ) : (
                "Save preferences"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
