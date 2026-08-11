import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { modulesInDiscoveryOrder } from "@/lib/module-metadata";
import { apiRequest, fetchWithAuth } from "@/lib/queryClient";
import type { DashboardUserPreferences, BespokeDashboardPayload } from "@shared/models/dashboard";
import type { BuiltInDashboardType, DashboardOption, DashboardType } from "@/hooks/use-dashboard-selector";
import { customDashboardId as toCustomDashboardId, parseCustomDashboardId } from "@/hooks/use-dashboard-selector";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, Plus } from "lucide-react";
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
  customDashboards?: DashboardOption[];
  onSelectCustomDashboard?: (id: DashboardType) => void;
  onCreateDashboard?: () => void;
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
  customDashboards = [],
  onSelectCustomDashboard,
  onCreateDashboard,
  contextClientId,
  contextProjectId,
}: DashboardConfigDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingsCustomId, setSettingsCustomId] = useState<number | null>(customDashboardId ?? null);

  const activeCustomId = settingsCustomId ?? customDashboardId ?? null;

  useEffect(() => {
    if (customDashboardId != null) setSettingsCustomId(customDashboardId);
  }, [customDashboardId, open]);

  const bespokeUrl =
    activeCustomId != null
      ? `/api/dashboards/${activeCustomId}${contextClientId ? `?clientId=${contextClientId}` : ""}${contextProjectId ? `${contextClientId ? "&" : "?"}projectId=${contextProjectId}` : ""}`
      : null;

  const { data: bespokeDetail, isLoading: bespokeLoading } = useQuery({
    queryKey: bespokeUrl ? [bespokeUrl] : ["no-bespoke"],
    queryFn: async () => {
      const res = await fetchWithAuth(bespokeUrl!);
      if (!res.ok) throw new Error("Failed to load dashboard");
      return (await res.json()) as BespokeDashboardPayload;
    },
    enabled: open && activeCustomId != null && !!bespokeUrl,
    staleTime: 0,
    refetchOnMount: "always",
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
    onToggleModuleVisibility(key);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Dashboard configuration</DialogTitle>
          <DialogDescription>
            Settings controls which dashboards appear and your default home screen. Modules controls
            visibility in the All Modules grid only — sidebar access is unchanged.
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
            <p className="text-xs text-muted-foreground">
              Enable built-in dashboards, set your default, and manage custom dashboards (rename, layout, delete).
            </p>
            {onCreateDashboard && (
              <Button
                size="sm"
                className="gap-1.5 w-full sm:w-auto"
                onClick={() => {
                  onOpenChange(false);
                  onCreateDashboard();
                }}
                data-testid="config-create-dashboard"
              >
                <Plus className="h-4 w-4" />
                Create custom dashboard
              </Button>
            )}
            {customDashboards.length === 0 && (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border/60 p-3">
                You have no custom dashboards yet. Create one to add your own widgets, then rename or delete it from here or from the dashboard toolbar.
              </p>
            )}
            {customDashboards.length > 0 && (
              <div className="space-y-2">
                <Label>Custom dashboard to manage</Label>
                <Select
                  value={activeCustomId != null ? String(activeCustomId) : ""}
                  onValueChange={(v) => {
                    const id = Number(v);
                    setSettingsCustomId(id);
                    onSelectCustomDashboard?.(toCustomDashboardId(id));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a custom dashboard…" />
                  </SelectTrigger>
                  <SelectContent>
                    {customDashboards.map((d) => {
                      const parsed = parseCustomDashboardId(d.id);
                      if (parsed == null) return null;
                      return (
                        <SelectItem key={d.id} value={String(parsed)}>
                          {d.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeCustomId != null && bespokeLoading && (
              <p className="text-sm text-muted-foreground">Loading dashboard settings…</p>
            )}
            {activeCustomId != null && bespokeDetail && (
              <BespokeDashboardSettings
                key={activeCustomId}
                dashboardId={activeCustomId}
                name={bespokeDetail.name}
                layout={bespokeDetail.layout}
                clientId={contextClientId}
                projectId={contextProjectId}
                onDeleted={() => {
                  setSettingsCustomId(null);
                  onOpenChange(false);
                }}
              />
            )}
            {customDashboards.length > 0 && activeCustomId == null && (
              <p className="text-sm text-muted-foreground">
                Select a custom dashboard above to rename, change layout, or delete it.
              </p>
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
          <TabsContent value="widgets" className="mt-4 text-sm text-muted-foreground space-y-3 overflow-y-auto max-h-80">
            <p>
              Built-in dashboards use fixed layouts. On a custom dashboard, use{" "}
              <strong>Edit widgets</strong> to add, remove, or reorder.
            </p>
          </TabsContent>
          <TabsContent value="history" className="mt-4 overflow-y-auto max-h-80">
            {activeCustomId != null ? (
              <DashboardHistoryPanel
                dashboardId={activeCustomId}
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
