import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TmDefect } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Filter } from "lucide-react";
import { useTmProject } from "@/contexts/TmProjectContext";

const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const STATUS_OPTS = ["new","open","in_progress","resolved","closed","wont_fix"];
const SEV_OPTS    = ["low","medium","high","critical"];
const PRI_OPTS    = ["low","medium","high","critical"];

function InlineSelect({ value, options, onChange, testId }: {
  value: string; options: string[]; onChange: (v: string) => void; testId?: string;
}) {
  return (
    <select
      className="border border-transparent hover:border-border rounded px-1.5 py-0.5 text-xs bg-transparent hover:bg-background transition-all cursor-pointer capitalize"
      value={value}
      onChange={e => onChange(e.target.value)}
      data-testid={testId}
    >
      {options.map(o => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
    </select>
  );
}

export function DefectTriageScreen() {
  const { toast } = useToast();
  const [filterSev, setFilterSev] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSev, setNewSev] = useState("medium");
  const [pendingChanges, setPendingChanges] = useState<Record<number, Partial<TmDefect>>>({});

  const { activeProjectId, qsParam } = useTmProject();
  const { data: defects = [], isLoading } = useQuery<TmDefect[]>({
    queryKey: ["/api/tm/defects", activeProjectId],
    queryFn: async () => { const r = await fetch(qsParam("/api/tm/defects")); return r.ok ? r.json() : []; },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TmDefect> }) => apiRequest("PATCH", `/api/tm/defects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/defects"] });
      setPendingChanges({});
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tm/defects", { ...data, tenantId: 1, projectId: activeProjectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/defects"] });
      setCreating(false);
      setNewTitle("");
      setNewSev("medium");
      toast({ title: "Defect raised" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tm/defects/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tm/defects"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function applyChange(id: number, field: string, value: string) {
    const change = { ...pendingChanges[id], [field]: value };
    setPendingChanges(p => ({ ...p, [id]: change }));
    updateMutation.mutate({ id, data: { [field]: value } });
  }

  const filtered = defects.filter(d => {
    if (filterSev !== "all" && d.severity !== filterSev) return false;
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...filtered].sort((a, b) =>
    (sevOrder[a.severity ?? "medium"] ?? 9) - (sevOrder[b.severity ?? "medium"] ?? 9)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <input
          className="border border-border rounded px-2.5 py-1 text-xs bg-background w-48"
          placeholder="Search defects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-search-defects"
        />
        <select
          className="border border-border rounded px-2 py-1 text-xs bg-background"
          value={filterSev} onChange={e => setFilterSev(e.target.value)}
          data-testid="filter-severity"
        >
          <option value="all">All Severities</option>
          {SEV_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select
          className="border border-border rounded px-2 py-1 text-xs bg-background"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          data-testid="filter-status"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTS.map(o => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{sorted.length} defects</span>
        <Button size="sm" className="ml-auto gap-1 h-7 text-xs" onClick={() => setCreating(!creating)} data-testid="btn-raise-defect-triage">
          <Plus className="h-3.5 w-3.5" /> Raise Defect
        </Button>
      </div>

      {/* Create Row */}
      {creating && (
        <div className="flex items-center gap-3 px-6 py-3 bg-muted/30 border-b border-border flex-shrink-0 flex-wrap">
          <input
            className="border border-border rounded px-2.5 py-1.5 text-sm bg-background flex-1 min-w-[240px]"
            placeholder="Defect title..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            data-testid="input-new-defect-title"
            autoFocus
          />
          <select className="border border-border rounded px-2 py-1.5 text-xs bg-background"
            value={newSev} onChange={e => setNewSev(e.target.value)}>
            {SEV_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <Button size="sm" className="h-7" onClick={() => createMutation.mutate({ title: newTitle, severity: newSev })}
            disabled={!newTitle.trim() || createMutation.isPending} data-testid="btn-confirm-raise-defect">
            {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setCreating(false)}>Cancel</Button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <div className="text-sm">No defects match the current filters.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-20">ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Title</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-28">Severity</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-28">Priority</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-36">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-32">Assigned To</th>
                <th className="px-4 py-2.5 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sorted.map(d => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors group" data-testid={`defect-row-${d.id}`}>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground">DEF-{String(d.id).padStart(3, "0")}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs">{d.title}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className={cn("inline-flex items-center")}>
                      <span className={cn("text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase mr-1", SEV_BADGE[d.severity ?? "medium"])}>
                        {d.severity}
                      </span>
                      <InlineSelect
                        value={d.severity ?? "medium"}
                        options={SEV_OPTS}
                        onChange={v => applyChange(d.id, "severity", v)}
                        testId={`select-severity-${d.id}`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <InlineSelect
                      value={d.priority ?? "medium"}
                      options={PRI_OPTS}
                      onChange={v => applyChange(d.id, "priority", v)}
                      testId={`select-priority-${d.id}`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <InlineSelect
                      value={d.status ?? "new"}
                      options={STATUS_OPTS}
                      onChange={v => applyChange(d.id, "status", v)}
                      testId={`select-status-${d.id}`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      className="border border-transparent hover:border-border rounded px-1.5 py-0.5 text-xs bg-transparent hover:bg-background w-full transition-all"
                      placeholder="Unassigned"
                      defaultValue={d.assignedTo ?? ""}
                      onBlur={e => { if (e.target.value !== (d.assignedTo ?? "")) applyChange(d.id, "assignedTo", e.target.value); }}
                      data-testid={`input-assignee-${d.id}`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => deleteMutation.mutate(d.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                      data-testid={`btn-delete-defect-triage-${d.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
