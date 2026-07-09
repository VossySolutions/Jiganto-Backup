import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell, FormSection, FieldLabel } from "@/components/ui/form-dialog-shell";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DEFAULT_PORTAL_ASSET_FILTERS } from "@shared/models/bpm-extensions";
import type { ProcessResource } from "@shared/models/bpm";
import {
  Plus, Trash2, ExternalLink, Workflow, FileText, Video, BookOpen,
  FileQuestion, Database, Link2, Eye, Loader2,
} from "lucide-react";

const RESOURCE_TYPE_OPTIONS = [
  { value: "process_flow", label: "Process Flow Diagram", icon: Workflow },
  { value: "user_guide", label: "User Guide", icon: FileText },
  { value: "quick_reference", label: "Quick Reference Guide", icon: FileQuestion },
  { value: "sop", label: "SOP", icon: BookOpen },
  { value: "simulation", label: "Simulation Video", icon: Video },
  { value: "video", label: "Video", icon: Video },
  { value: "training_material", label: "Training Material", icon: BookOpen },
  { value: "data_entry_guide", label: "Data Entry Guide", icon: Database },
  { value: "external_link", label: "External Link", icon: Link2 },
  { value: "custom", label: "Custom Asset", icon: FileText },
];

const TYPE_ICON: Record<string, typeof FileText> = Object.fromEntries(
  RESOURCE_TYPE_OPTIONS.map(o => [o.value, o.icon]),
);

type Props = {
  entryIds: number[];
  entryLabel: string;
  resources: ProcessResource[];
  resourcesLoading?: boolean;
  diagramId?: number | null;
  onViewDiagram?: () => void;
  onPlayVideo?: (url: string) => void;
};

export function PortalAssetPanel({ entryIds, entryLabel, resources, resourcesLoading, diagramId, onViewDiagram, onPlayVideo }: Props) {
  const { toast } = useToast();
  const [assetFilter, setAssetFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState("user_guide");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const entryResources = useMemo(() =>
    resources.filter(r => r.entryId && entryIds.includes(r.entryId)),
    [resources, entryIds],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: entryResources.length + (diagramId ? 1 : 0) };
    for (const f of DEFAULT_PORTAL_ASSET_FILTERS) {
      if (f.key === "all") continue;
      counts[f.key] = entryResources.filter(r =>
        r.resourceType === f.key || (f.key === "video" && (r.resourceType === "simulation" || r.resourceType === "video")),
      ).length;
    }
    if (diagramId) counts.process_flow = (counts.process_flow || 0) + 1;
    return counts;
  }, [entryResources, diagramId]);

  const filtered = useMemo(() => {
    if (assetFilter === "all") return entryResources;
    if (assetFilter === "video") return entryResources.filter(r => r.resourceType === "video" || r.resourceType === "simulation");
    return entryResources.filter(r => r.resourceType === assetFilter);
  }, [entryResources, assetFilter]);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/process-resources", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/process-resources"] });
      setShowAdd(false);
      setNewTitle(""); setNewUrl(""); setNewDesc("");
      toast({ title: "Asset added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/process-resources/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/process-resources"] }),
  });

  return (
    <div className="space-y-4" data-testid="portal-asset-panel">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Assets — {entryLabel}</h4>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} data-testid="button-add-asset">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Asset
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5" data-testid="asset-filter-chips">
        {DEFAULT_PORTAL_ASSET_FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setAssetFilter(f.key)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs border transition-colors",
              assetFilter === f.key
                ? "bg-primary/10 border-primary text-primary"
                : "border-border text-muted-foreground hover-elevate",
            )}
            data-testid={`filter-chip-${f.key}`}
          >
            {f.label} ({filterCounts[f.key] ?? 0})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {resourcesLoading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading assets…
          </div>
        ) : (
        <>
        {(assetFilter === "all" || assetFilter === "process_flow") && diagramId && onViewDiagram && (
          <div className="flex items-center gap-2 p-2.5 rounded-md border hover-elevate cursor-pointer" onClick={onViewDiagram} data-testid="asset-process-flow">
            <Workflow className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm flex-1">Process Flow Diagram</span>
            <Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5" /></Button>
          </div>
        )}
        {filtered.map(res => {
          const Icon = TYPE_ICON[res.resourceType] || FileText;
          const isVideo = res.resourceType === "video" || res.resourceType === "simulation";
          return (
            <div key={res.id} className="flex items-center gap-2 p-2.5 rounded-md border group" data-testid={`asset-item-${res.id}`}>
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{res.title}</p>
                {res.description && <p className="text-xs text-muted-foreground truncate">{res.description}</p>}
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{res.resourceType.replace(/_/g, " ")}</Badge>
              {res.url && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                  if (isVideo && onPlayVideo) onPlayVideo(res.url!);
                  else window.open(res.url!, "_blank");
                }} data-testid={`button-open-asset-${res.id}`}>
                  {isVideo ? <Video className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteMutation.mutate(res.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          );
        })}
        {filtered.length === 0 && !diagramId && (
          <p className="text-xs text-muted-foreground text-center py-4">No assets for this filter</p>
        )}
        </>
        )}
      </div>

      <FormDialogShell
        open={showAdd}
        onOpenChange={setShowAdd}
        title="Add Asset"
        saveLabel="Add"
        onCancel={() => setShowAdd(false)}
        onSubmit={() => createMutation.mutate({
          entryId: entryIds[0], resourceType: newType,
          title: newTitle.trim(), url: newUrl.trim() || null,
          description: newDesc.trim() || null, sortOrder: entryResources.length,
        })}
        saving={createMutation.isPending}
        disabled={!newTitle.trim()}
        testId="dialog-add-asset"
        saveTestId="button-confirm-add-asset"
      >
        <FormSection title="Asset details">
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel>Asset Type</FieldLabel>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger data-testid="select-asset-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel required>Title</FieldLabel>
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} data-testid="input-asset-title" />
          </div>
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel>URL / Link</FieldLabel>
            <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https:// or document link" data-testid="input-asset-url" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Description</FieldLabel>
            <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
          </div>
        </FormSection>
      </FormDialogShell>
    </div>
  );
}
