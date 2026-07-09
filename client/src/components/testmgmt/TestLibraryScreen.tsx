import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTmProject } from "@/contexts/TmProjectContext";
import { getTmLabels } from "@/lib/tm-utils";
import type { TmHierarchyNode } from "@/types/testmgmt";
import {
  ChevronRight, ChevronDown, Plus, CheckCircle2, ShieldCheck, Layers, FileDown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";
import { tmDownloadPdf } from "@/lib/tm-api";

export function TestLibraryScreen() {
  const { toast } = useToast();
  const { user } = useAuth();
  const signedOffBy = user?.email ?? user?.id ?? "unknown";
  const { activeProjectId, activeProject, qsParam } = useTmProject();
  const labels = getTmLabels(activeProject?.methodology);
  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState<"area" | "process" | null>(null);
  const [newName, setNewName] = useState("");
  const [parentAreaId, setParentAreaId] = useState<number | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useTmFetch<{ tree: TmHierarchyNode[]; labels: typeof labels }>(["/api/tm/hierarchy"], "/api/tm/hierarchy");

  const tree = data?.tree ?? [];

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tm/seed-hierarchy", { projectId: activeProjectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/hierarchy"] });
      toast({ title: "Hierarchy seeded from existing data" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createAreaMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/tm/business-areas", { name, projectId: activeProjectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/hierarchy"] });
      setCreating(null);
      setNewName("");
      toast({ title: `${labels.area} created` });
    },
  });

  const createProcessMutation = useMutation({
    mutationFn: ({ name, businessAreaId }: { name: string; businessAreaId: number }) =>
      apiRequest("POST", "/api/tm/business-processes", { name, businessAreaId, projectId: activeProjectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/hierarchy"] });
      setCreating(null);
      setNewName("");
      toast({ title: `${labels.process} created` });
    },
  });

  const signOffMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/tm/sign-offs/entity", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/hierarchy"] });
      toast({ title: "Signed off successfully" });
    },
    onError: (e: Error) => toast({ title: "Sign-off failed", description: e.message, variant: "destructive" }),
  });

  function toggleArea(id: number) {
    setExpandedAreas(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function ragClass(health?: string) {
    if (health === "green") return "bg-green-500";
    if (health === "amber") return "bg-amber-500";
    if (health === "red") return "bg-red-500";
    return "bg-muted-foreground";
  }

  async function downloadPdf(entityType: string, entityId: number, label: string) {
    try {
      const url = qsParam(`/api/tm/sign-offs/pdf?entityType=${entityType}&entityId=${entityId}`);
      await tmDownloadPdf(url, `signoff-${label.replace(/\s+/g, "-")}.pdf`);
      toast({ title: "PDF downloaded" });
    } catch (e) {
      toast({ title: "PDF export failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <TmScreenShell
      loading={isLoading}
      error={isError ? error : null}
      onRetry={() => refetch()}
      label="Loading test library..."
    >
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Test Library</h2>
              <p className="text-xs text-muted-foreground">{labels.area} → {labels.process} → {labels.scenario} → Test Cases</p>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            {tree.length === 0 && (
              <Button size="sm" variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                Seed from existing data
              </Button>
            )}
            <Button size="sm" onClick={() => { setCreating("area"); setNewName(""); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {labels.area}
            </Button>
          </div>
        </div>

        {creating && (
          <div className="px-6 py-3 bg-muted/30 border-b flex gap-2 items-center">
            <input className="border rounded px-2 py-1 text-sm flex-1 max-w-xs" placeholder={`New ${creating === "area" ? labels.area : labels.process} name...`}
              value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
            {creating === "process" && (
              <select className="border rounded px-2 py-1 text-sm" value={parentAreaId ?? ""} onChange={e => setParentAreaId(Number(e.target.value))}>
                <option value="">Select {labels.area}</option>
                {tree.map(n => <option key={n.area.id} value={n.area.id}>{n.area.name}</option>)}
              </select>
            )}
            <Button size="sm" disabled={!newName.trim()} onClick={() => {
              if (creating === "area") createAreaMutation.mutate(newName.trim());
              else if (parentAreaId) createProcessMutation.mutate({ name: newName.trim(), businessAreaId: parentAreaId });
            }}>Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(null)}>Cancel</Button>
          </div>
        )}

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {tree.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No hierarchy yet. Seed from existing suites/scenarios or create {labels.area} manually.
          </div>
        ) : tree.map(node => {
          const areaExpanded = expandedAreas.has(node.area.id);
          return (
            <div key={node.area.id} className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 hover:bg-muted/50">
                <button onClick={() => toggleArea(node.area.id)}>{areaExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                <span className={cn("w-2 h-2 rounded-full", ragClass(node.area.health))} />
                <span className="font-semibold text-sm flex-1">{node.area.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{labels.area}</span>
                {node.area.signOffStatus === "signed_off" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => downloadPdf("business_area", node.area.id, node.area.name)}>
                      <FileDown className="h-3 w-3" /> PDF
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => signOffMutation.mutate({
                    entityType: "business_area", entityId: node.area.id, projectId: activeProjectId, signedOffBy,
                  })}>
                    <ShieldCheck className="h-3 w-3" /> Sign off
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCreating("process"); setParentAreaId(node.area.id); setNewName(""); }}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {areaExpanded && node.processes.map(proc => (
                <div key={proc.process.id} className="border-t border-border/50">
                  <div className="flex items-center gap-2 px-4 py-2 pl-10 bg-card">
                    <span className={cn("w-2 h-2 rounded-full", ragClass(proc.process.health))} />
                    <span className="text-sm font-medium flex-1">{proc.process.name}</span>
                    <span className="text-[10px] text-muted-foreground">{labels.process}</span>
                    {proc.process.signOffStatus !== "signed_off" && (
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => signOffMutation.mutate({
                        entityType: "business_process", entityId: proc.process.id, projectId: activeProjectId, signedOffBy,
                      })}>Sign off</Button>
                    )}
                  </div>
                  {proc.scenarios.map(sc => (
                    <div key={sc.scenario.id} className="border-t border-border/30 px-4 py-2 pl-16">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-1.5 h-1.5 rounded-full", ragClass(sc.scenario.health))} />
                        <span className="text-xs font-mono text-muted-foreground">{sc.scenario.scenarioId}</span>
                        <span className="text-xs flex-1">{sc.scenario.title}</span>
                        <span className="text-[10px] text-muted-foreground">{sc.cases.length} cases</span>
                        {sc.scenario.signOffStatus !== "signed_off" && sc.cases.length > 0 && (
                          <Button size="sm" variant="ghost" className="h-5 text-[9px]" onClick={() => signOffMutation.mutate({
                            entityType: "scenario", entityId: sc.scenario.id, projectId: activeProjectId, signedOffBy,
                          })}>Sign off</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      </div>
    </TmScreenShell>
  );
}
