import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useClientContext } from "@/hooks/use-client-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

type ModRow = { key: string; label: string; locked: boolean; isVisible: boolean };

export default function SettingsClientWorkspaceTab() {
  const { toast } = useToast();
  const { activeClient } = useClientContext();
  const { platformRole, isJigantoStaff } = usePermissions();
  const canEdit = isJigantoStaff || platformRole === "si_super_admin";

  const { data: modules = [] } = useQuery<ModRow[]>({
    queryKey: ["/api/clients", activeClient?.id, "module-visibility"],
    enabled: !!activeClient?.id,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/clients/${activeClient!.id}/module-visibility`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const saveMut = useMutation({
    mutationFn: (next: ModRow[]) =>
      apiRequest("PUT", `/api/clients/${activeClient!.id}/module-visibility`, {
        modules: next.map((m) => ({ key: m.key, isVisible: m.isVisible })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", activeClient?.id, "module-visibility"] });
      toast({ title: "Module visibility saved" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!activeClient) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground text-center">
          Enter a client workspace to configure module visibility.
        </CardContent>
      </Card>
    );
  }

  const toggle = (key: string) => {
    if (!canEdit) return;
    const next = modules.map((m) => (m.key === key ? { ...m, isVisible: !m.isVisible } : m));
    queryClient.setQueryData(["/api/clients", activeClient.id, "module-visibility"], next);
    saveMut.mutate(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace settings — {activeClient.name}</CardTitle>
        <CardDescription>
          Module visibility for this client workspace. Business, CRM, Finance, and Clients are always hidden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {modules.map((m) => (
          <div key={m.key} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="flex items-center gap-2">
              <Label>{m.label}</Label>
              {m.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
            </div>
            <Switch
              checked={m.isVisible}
              onCheckedChange={() => toggle(m.key)}
              disabled={!canEdit || m.locked}
            />
          </div>
        ))}
        {!canEdit && (
          <p className="text-xs text-muted-foreground">Only SI Super Admins can change these settings.</p>
        )}
      </CardContent>
    </Card>
  );
}
