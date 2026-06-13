import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DashboardLayout } from "@shared/models/dashboard";
import { customDashboardId, useDashboardSelector } from "@/hooks/use-dashboard-selector";
import { invalidateDashboardDetail, scopeQuery } from "./dashboard-utils";

export function BespokeDashboardSettings({
  dashboardId,
  name,
  layout,
  clientId,
  projectId,
  onDeleted,
}: {
  dashboardId: number;
  name: string;
  layout: DashboardLayout;
  clientId?: number | null;
  projectId?: number | null;
  onDeleted?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentDashboard, refreshCustomDashboards } = useDashboardSelector();
  const [dashName, setDashName] = useState(name);
  const [dashLayout, setDashLayout] = useState(layout);

  useEffect(() => {
    setDashName(name);
    setDashLayout(layout);
  }, [dashboardId, name, layout]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(scopeQuery(`/api/dashboards/${dashboardId}`, clientId, projectId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: dashName.trim(), layout: dashLayout }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: (updated) => {
      refreshCustomDashboards();
      invalidateDashboardDetail(queryClient, dashboardId);
      if (updated && typeof updated === "object" && "name" in updated) {
        setDashName(String((updated as { name: string }).name));
        if ("layout" in updated) {
          setDashLayout((updated as { layout: DashboardLayout }).layout);
        }
      }
      toast({ title: "Dashboard updated" });
    },
    onError: () => {
      toast({ title: "Could not update dashboard", description: "You may not have permission to edit this dashboard.", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(scopeQuery(`/api/dashboards/${dashboardId}/duplicate`, clientId, projectId), {
        method: "POST",
      });
      if (!res.ok) throw new Error("Duplicate failed");
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: (copy) => {
      refreshCustomDashboards();
      setCurrentDashboard(customDashboardId(copy.id));
      toast({ title: "Dashboard duplicated" });
    },
    onError: () => {
      toast({ title: "Could not duplicate dashboard", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(scopeQuery(`/api/dashboards/${dashboardId}`, clientId, projectId), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: async () => {
      await refreshCustomDashboards();
      setCurrentDashboard("modules");
      onDeleted?.();
      toast({ title: "Dashboard deleted" });
    },
    onError: () => {
      toast({ title: "Could not delete dashboard", description: "You may not have permission to delete this dashboard.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4 rounded-xl border border-border/50 p-4">
      <p className="text-sm font-medium">Custom dashboard settings</p>
      <div className="space-y-2">
        <Label htmlFor="bespoke-name">Name</Label>
        <Input id="bespoke-name" value={dashName} onChange={(e) => setDashName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Layout</Label>
        <Select value={dashLayout} onValueChange={(v) => setDashLayout(v as DashboardLayout)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1-col">Single column</SelectItem>
            <SelectItem value="2-col">Two columns</SelectItem>
            <SelectItem value="3-col">Three columns</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={dashName.trim().length < 2 || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Save changes
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={duplicateMutation.isPending}
          onClick={() => duplicateMutation.mutate()}
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicate
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (window.confirm(`Delete "${dashName}"? This cannot be undone.`)) {
              deleteMutation.mutate();
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}
