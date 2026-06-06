import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { modulesInDiscoveryOrder } from "@/lib/module-metadata";
import { apiRequest, fetchWithAuth } from "@/lib/queryClient";
import type { DashboardUserPreferences, BespokeDashboardPayload } from "@shared/models/dashboard";
import type { BuiltInDashboardType, DashboardOption, DashboardType } from "@/hooks/use-dashboard-selector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DashboardHistoryPanel } from "./DashboardHistoryPanel";
import { BespokeDashboardSettings } from "./BespokeDashboardSettings";

interface DashboardConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboards: DashboardOption[];
  defaultDashboard: DashboardType;
  hiddenModuleKeys: string[];
  onToggleDashboard: (id: BuiltInDashboardType) => void;
  onSetDefault: (id: DashboardType) => void;
  onToggleModuleVisibility: (key: string) => void;
  customDashboardId?: number | null;
  contextClientId?: number | null;
  contextProjectId?: number | null;
}

export function DashboardConfigDialog({
  open,
  onOpenChange,
  dashboards,
  defaultDashboard,
  hiddenModuleKeys,
  onToggleDashboard,
  onSetDefault,
  onToggleModuleVisibility,
  customDashboardId,
  contextClientId,
  contextProjectId,
}: DashboardConfigDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const bespokeUrl =
    customDashboardId != null
      ? `/api/dashboards/${customDashboardId}${contextClientId ? `?clientId=${contextClientId}` : ""}${contextProjectId ? `${contextClientId ? "&" : "?"}projectId=${contextProjectId}` : ""}`
      : null;

  const { data: bespokeDetail } = useQuery({
    queryKey: bespokeUrl ? [bespokeUrl] : ["no-bespoke"],
    queryFn: async () => {
      const res = await fetchWithAuth(bespokeUrl!);
      if (!res.ok) throw new Error("Failed to load dashboard");
      return (await res.json()) as BespokeDashboardPayload;
    },
    enabled: open && customDashboardId != null && !!bespokeUrl,
  });

  const savePrefs = useMutation({
    mutationFn: async (patch: Partial<DashboardUserPreferences>) => {
      const res = await apiRequest("PATCH", "/api/dashboard/preferences", patch);
      return res.json() as Promise<DashboardUserPreferences>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/dashboard/preferences"] });
      toast({ title: "Dashboard preferences saved" });
    },
  });

  const handleSetDefault = (id: DashboardType) => {
    onSetDefault(id);
    savePrefs.mutate({ defaultDashboard: id });
  };

  const handleToggleModule = (key: string) => {
    const next = hiddenModuleKeys.includes(key)
      ? hiddenModuleKeys.filter((k) => k !== key)
      : [...hiddenModuleKeys, key];
    onToggleModuleVisibility(key);
    savePrefs.mutate({ hiddenModuleKeys: next });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Dashboard configuration</DialogTitle>
          <DialogDescription>
            Manage dashboards, module visibility, and your default home screen.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="settings" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="widgets">Widgets</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="settings" className="overflow-y-auto max-h-80 mt-4 space-y-4">
            {customDashboardId != null && bespokeDetail && (
              <BespokeDashboardSettings
                dashboardId={customDashboardId}
                name={bespokeDetail.name}
                layout={bespokeDetail.layout}
                clientId={contextClientId}
                projectId={contextProjectId}
                onDeleted={() => onOpenChange(false)}
              />
            )}
            {dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={dashboard.enabled}
                    onCheckedChange={() => onToggleDashboard(dashboard.id as BuiltInDashboardType)}
                  />
                  <div>
                    <p className="font-medium text-sm">{dashboard.name}</p>
                    <p className="text-xs text-muted-foreground">{dashboard.description}</p>
                  </div>
                </div>
                <Button
                  variant={defaultDashboard === dashboard.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleSetDefault(dashboard.id)}
                  className="gap-1"
                >
                  <Star className={cn("h-3 w-3", defaultDashboard === dashboard.id && "fill-current")} />
                  {defaultDashboard === dashboard.id ? "Default" : "Set default"}
                </Button>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="widgets" className="mt-4 text-sm text-muted-foreground space-y-2">
            <p>
              Module dashboards use the Jiganto system template with live workspace data. Custom dashboards
              support add/remove widgets in edit mode on the dashboard view.
            </p>
          </TabsContent>
          <TabsContent value="history" className="mt-4 overflow-y-auto max-h-80">
            {customDashboardId != null ? (
              <DashboardHistoryPanel
                dashboardId={customDashboardId}
                clientId={contextClientId}
                projectId={contextProjectId}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Change history is available for custom dashboards. Open a bespoke dashboard and return here to
                view and restore previous versions (up to 30 retained).
              </p>
            )}
          </TabsContent>
          <TabsContent value="modules" className="overflow-y-auto max-h-80 mt-4 space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Show or hide modules in the All Modules grid. This does not affect sidebar access.
            </p>
            {modulesInDiscoveryOrder().map((mod) => {
              const visible = !hiddenModuleKeys.includes(mod.key);
              return (
                <div key={mod.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40">
                  <Label htmlFor={`mod-vis-${mod.key}`} className="text-sm cursor-pointer">
                    {mod.name}
                  </Label>
                  <Switch
                    id={`mod-vis-${mod.key}`}
                    checked={visible}
                    onCheckedChange={() => handleToggleModule(mod.key)}
                  />
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function useDashboardPreferences() {
  return useQuery({
    queryKey: ["/api/dashboard/preferences"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/dashboard/preferences");
      if (!res.ok) throw new Error("Failed to load preferences");
      return (await res.json()) as DashboardUserPreferences;
    },
    staleTime: 60_000,
  });
}
