import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TmDefect } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, ArrowRight, Loader2, Bug } from "lucide-react";
import { useTmProject } from "@/contexts/TmProjectContext";

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: "new",         label: "New",              color: "bg-slate-500" },
  { id: "open",        label: "Triaged / Open",   color: "bg-blue-500" },
  { id: "in_progress", label: "In Progress",      color: "bg-violet-500" },
  { id: "resolved",    label: "Ready to Retest",  color: "bg-amber-500" },
  { id: "closed",      label: "Closed",           color: "bg-green-500" },
  { id: "wont_fix",    label: "Won't Fix",        color: "bg-slate-400" },
];

const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const NEXT_STATUS: Record<string, string | null> = {
  new: "open", open: "in_progress", in_progress: "resolved", resolved: "closed", closed: null, wont_fix: null,
};

interface DefectForm {
  title: string;
  description: string;
  severity: string;
  priority: string;
}

function DefectCard({
  defect, onMove, onSelect,
}: {
  defect: TmDefect;
  onMove: (id: number, status: string) => void;
  onSelect: (d: TmDefect) => void;
}) {
  const next = NEXT_STATUS[defect.status ?? "new"];
  return (
    <div
      className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/40 transition-colors space-y-2"
      onClick={() => onSelect(defect)}
      data-testid={`defect-card-${defect.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-mono text-muted-foreground">DEF-{String(defect.id).padStart(3, "0")}</span>
        <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase", SEV_BADGE[defect.severity ?? "medium"])}>
          {defect.severity}
        </span>
      </div>
      <p className="text-xs font-medium leading-tight">{defect.title}</p>
      {defect.assignedTo && (
        <div className="text-[10px] text-muted-foreground">→ {defect.assignedTo}</div>
      )}
      {next && (
        <button
          onClick={e => { e.stopPropagation(); onMove(defect.id, next); }}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
          data-testid={`defect-move-${defect.id}`}
        >
          <ArrowRight className="h-3 w-3" />
          Move to {COLUMNS.find(c => c.id === next)?.label}
        </button>
      )}
    </div>
  );
}

export function DefectBoardScreen() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<TmDefect | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<DefectForm>({ title: "", description: "", severity: "medium", priority: "medium" });

  const { activeProjectId, qsParam } = useTmProject();
  const { data: defects = [], isLoading } = useQuery<TmDefect[]>({
    queryKey: ["/api/tm/defects", activeProjectId],
    queryFn: async () => { const r = await fetch(qsParam("/api/tm/defects")); return r.ok ? r.json() : []; },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiRequest("PATCH", `/api/tm/defects/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tm/defects"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/tm/defects/${id}`, data),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/tm/defects"] });
      setSelected(updated as any);
      toast({ title: "Defect updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tm/defects", { ...data, tenantId: 1, projectId: activeProjectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/defects"] });
      setCreating(false);
      setForm({ title: "", description: "", severity: "medium", priority: "medium" });
      toast({ title: "Defect raised" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tm/defects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/defects"] });
      setSelected(null);
    },
  });

  if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="h-full flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
            <h2 className="text-sm font-semibold">Defect Board</h2>
            <span className="text-xs text-muted-foreground">{defects.length} defects total</span>
            <Button size="sm" className="ml-auto gap-1 h-7 text-xs" onClick={() => setCreating(true)} data-testid="btn-raise-defect">
              <Plus className="h-3.5 w-3.5" /> Raise Defect
            </Button>
          </div>

          {/* Create form */}
          {creating && (
            <div className="px-6 py-4 bg-muted/30 border-b border-border flex gap-3 items-start flex-wrap flex-shrink-0">
              <input
                className="border border-border rounded px-2.5 py-1.5 text-sm bg-background flex-1 min-w-[200px]"
                placeholder="Defect title..."
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                data-testid="input-defect-title"
              />
              <select className="border border-border rounded px-2 py-1.5 text-sm bg-background"
                value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                <option value="low">Low</option><option value="medium">Medium</option>
                <option value="high">High</option><option value="critical">Critical</option>
              </select>
              <select className="border border-border rounded px-2 py-1.5 text-sm bg-background"
                value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">P-Low</option><option value="medium">P-Medium</option>
                <option value="high">P-High</option><option value="critical">P-Critical</option>
              </select>
              <Button size="sm" className="h-8" onClick={() => createMutation.mutate(form)}
                disabled={!form.title.trim() || createMutation.isPending} data-testid="btn-save-defect">
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          )}

          {/* Columns */}
          <div className="flex-1 flex gap-4 px-6 py-4 overflow-x-auto overflow-y-hidden">
            {COLUMNS.map(col => {
              const colDefects = defects.filter(d => (d.status ?? "new") === col.id);
              return (
                <div key={col.id} className="flex flex-col min-w-[200px] max-w-[240px] flex-shrink-0 h-full">
                  <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                    <div className={cn("w-2.5 h-2.5 rounded-full", col.color)} />
                    <span className="text-xs font-semibold">{col.label}</span>
                    <span className="ml-auto text-xs font-mono text-muted-foreground bg-muted px-1.5 rounded">
                      {colDefects.length}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {colDefects.length === 0 ? (
                      <div className="border border-dashed border-border rounded-xl p-3 text-center text-[10px] text-muted-foreground">
                        No defects
                      </div>
                    ) : colDefects.map(d => (
                      <DefectCard
                        key={d.id}
                        defect={d}
                        onMove={(id, status) => moveMutation.mutate({ id, status })}
                        onSelect={setSelected}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="w-[360px] min-w-[320px] border-l border-border flex flex-col overflow-hidden bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-primary" />
              <span className="font-mono text-sm font-semibold">DEF-{String(selected.id).padStart(3, "0")}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                onClick={() => deleteMutation.mutate(selected.id)} data-testid="btn-delete-defect">
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm font-medium bg-background"
              value={selected.title}
              onChange={e => setSelected(s => s ? { ...s, title: e.target.value } : s)}
            />
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px] resize-none"
              placeholder="Description..."
              value={selected.description ?? ""}
              onChange={e => setSelected(s => s ? { ...s, description: e.target.value } : s)}
            />
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Severity", key: "severity", opts: ["low","medium","high","critical"] },
                { label: "Priority", key: "priority", opts: ["low","medium","high","critical"] },
                { label: "Status", key: "status", opts: ["new","open","in_progress","resolved","closed","wont_fix"] },
              ].map(({ label, key, opts }) => (
                <div key={key}>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{label}</label>
                  <select
                    className="w-full border border-border rounded px-2 py-1.5 text-xs bg-background"
                    value={(selected as any)[key] ?? ""}
                    onChange={e => setSelected(s => s ? { ...s, [key]: e.target.value } : s)}
                  >
                    {opts.map(o => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Assigned To</label>
                <input
                  className="w-full border border-border rounded px-2 py-1.5 text-xs bg-background"
                  placeholder="Name..."
                  value={selected.assignedTo ?? ""}
                  onChange={e => setSelected(s => s ? { ...s, assignedTo: e.target.value } : s)}
                />
              </div>
            </div>
            <Button className="w-full" size="sm" onClick={() => updateMutation.mutate({ id: selected.id, data: selected })}
              disabled={updateMutation.isPending} data-testid="btn-update-defect">
              {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
