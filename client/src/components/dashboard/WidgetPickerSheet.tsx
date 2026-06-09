import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isModuleLicensed, useModuleEntitlements } from "@/hooks/use-module-entitlements";
import type { WidgetCatalogEntry } from "@shared/models/dashboard";
import { invalidateDashboardDetail } from "./dashboard-utils";

const WIDGET_MODULE_TO_LICENSE_KEY: Record<string, string> = {
  helpdesk: "help-desk",
  finance: "finance-mgmt",
  business: "business-mgmt",
  projects: "projects",
  tasks: "tasks",
  crm: "crm",
};

function isWidgetLicensed(entry: WidgetCatalogEntry, entitlements: ReturnType<typeof useModuleEntitlements>["data"]) {
  if (entry.module === "platform") return true;
  const key = WIDGET_MODULE_TO_LICENSE_KEY[entry.module] ?? entry.module;
  return isModuleLicensed(key, entitlements);
}

export function WidgetPickerSheet({
  open,
  onOpenChange,
  dashboardId,
  clientId,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: number;
  clientId?: number | null;
  projectId?: number | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: entitlements } = useModuleEntitlements();

  const { data: catalog = [], isLoading: catalogLoading } = useQuery({
    queryKey: ["/api/dashboard/widget-catalog"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/dashboard/widget-catalog");
      if (!res.ok) throw new Error("Failed to load catalog");
      return (await res.json()) as WidgetCatalogEntry[];
    },
    staleTime: Infinity,
  });

  const addMutation = useMutation({
    mutationFn: async (entry: WidgetCatalogEntry) => {
      const params = new URLSearchParams();
      if (clientId) params.set("clientId", String(clientId));
      if (projectId) params.set("projectId", String(projectId));
      const q = params.toString();
      const url = q ? `/api/dashboards/${dashboardId}/widgets?${q}` : `/api/dashboards/${dashboardId}/widgets`;
      const res = await fetchWithAuth(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetType: entry.type,
          widgetModule: entry.module,
          width: entry.defaultWidth,
          height: entry.defaultHeight,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Failed to add widget");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateDashboardDetail(queryClient, dashboardId);
      toast({ title: "Widget added" });
    },
    onError: (err: Error) => toast({ title: "Could not add widget", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.module.toLowerCase().includes(q),
    );
  }, [catalog, search]);

  const grouped = filtered.reduce<Record<string, WidgetCatalogEntry[]>>((acc, entry) => {
    (acc[entry.module] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add widget</SheetTitle>
          <SheetDescription>Pick a module widget to add to your dashboard.</SheetDescription>
        </SheetHeader>
        <div className="relative mt-4">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search widgets…"
            className="pl-8 h-9"
          />
        </div>
        <div className="mt-6 space-y-6">
          {catalogLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">Loading widget catalog…</p>
          )}
          {!catalogLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-xl">
              No widgets match your search.
            </p>
          )}
          {Object.entries(grouped).map(([module, entries]) => (
            <div key={module}>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{module}</h4>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const licensed = isWidgetLicensed(entry, entitlements);
                  return (
                    <div
                      key={entry.type}
                      className={`flex items-center justify-between gap-2 rounded-lg border border-border/50 p-3 ${!licensed ? "opacity-50 bg-muted/20" : ""}`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{entry.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                        {!licensed && (
                          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Upgrade module to add this widget
                          </p>
                        )}
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {entry.defaultWidth}×{entry.defaultHeight}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={addMutation.isPending || !licensed}
                        onClick={() => addMutation.mutate(entry)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
