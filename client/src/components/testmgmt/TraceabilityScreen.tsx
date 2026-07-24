import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TmRequirement, TmTestCase, TmTestResult } from "@shared/schema";
import type { TmHdDefect } from "@/types/testmgmt";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Link, CheckCircle2, XCircle, MinusCircle, Clock, Loader2, Pencil, Save, X, Bug } from "lucide-react";
import { useTmProject } from "@/contexts/TmProjectContext";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import {
  MondayBoardProvider,
  MondayBoardTable,
  MondayBoardChromeControls,
} from "@/components/MondayBoardTable";
import { useDebouncedValue } from "@/lib/crm-monday-chrome";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";

const PRI_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  must:     "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const IMPL_BADGE: Record<string, string> = {
  draft:       "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  implemented: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  verified:    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  deprecated:  "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const RESULT_ICON: Record<string, JSX.Element> = {
  pass:    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  fail:    <XCircle className="h-3.5 w-3.5 text-red-500" />,
  blocked: <MinusCircle className="h-3.5 w-3.5 text-orange-500" />,
  not_run: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  skipped: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
};

const FUNC_AREAS = ["Order Management", "Finance", "Procurement", "CRM", "HR", "Inventory", "Billing", "Integration", "Reporting", "Administration", "Other"];
const PROCESSES  = ["Order-to-Cash", "Procure-to-Pay", "Record-to-Report", "Hire-to-Retire", "Plan-to-Inventory", "Lead-to-Opportunity", "Other"];

type ReqForm = {
  reqId: string; title: string; priority: string; source: string; description: string;
  functionalArea: string; process: string; linkedFeature: string; implementationStatus: string;
};

const DEFAULT_FORM: ReqForm = {
  reqId: "", title: "", priority: "medium", source: "", description: "",
  functionalArea: "", process: "", linkedFeature: "", implementationStatus: "draft",
};

export function TraceabilityScreen() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ReqForm>(DEFAULT_FORM);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [filterArea, setFilterArea] = useState("all");
  const [filterImpl, setFilterImpl] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const { activeProjectId } = useTmProject();
  const reqsQuery = useTmFetch<TmRequirement[]>(["/api/tm/requirements"], "/api/tm/requirements");
  const casesQuery = useTmFetch<TmTestCase[]>(["/api/tm/cases"], "/api/tm/cases");
  const resultsQuery = useTmFetch<TmTestResult[]>(["/api/tm/results/all"], "/api/tm/results/all");
  const defectsQuery = useTmFetch<TmHdDefect[]>(["/api/tm/defects/hd"], "/api/tm/defects/hd");

  const reqs = reqsQuery.data ?? [];
  const cases = casesQuery.data ?? [];
  const allResults = resultsQuery.data ?? [];
  const allDefects = defectsQuery.data ?? [];
  const isLoading = reqsQuery.isLoading || casesQuery.isLoading || resultsQuery.isLoading || defectsQuery.isLoading;
  const firstError = reqsQuery.error ?? casesQuery.error ?? resultsQuery.error ?? defectsQuery.error ?? null;

  const selected = reqs.find(r => r.id === selectedId);
  const linkedCases = selected ? cases.filter(c => (selected.linkedCaseIds ?? []).includes(c.id)) : [];
  const linkedDefects = selected
    ? allDefects.filter((d) =>
        (selected.linkedDefectIds ?? []).includes(d.id)
        || (d.linkedTestCaseId != null && (selected.linkedCaseIds ?? []).includes(d.linkedTestCaseId)),
      )
    : [];

  function getLastResult(caseId: number) {
    const results = allResults.filter(r => r.testCaseId === caseId);
    if (!results.length) return "not_run";
    return results.sort((a, b) => new Date(b.executedAt ?? 0).getTime() - new Date(a.executedAt ?? 0).getTime())[0]?.status ?? "not_run";
  }

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tm/requirements", { ...data, projectId: activeProjectId });
      return res.json() as Promise<TmRequirement>;
    },
    onSuccess: (created: TmRequirement) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/requirements"] });
      setCreating(false);
      setForm(DEFAULT_FORM);
      setSelectedId(created.id);
      toast({ title: "Requirement added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/tm/requirements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/requirements"] });
      setEditing(false);
      toast({ title: "Requirement updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tm/requirements/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tm/requirements"] }); setSelectedId(null); },
  });

  function toggleLink(req: TmRequirement, caseId: number) {
    const current = req.linkedCaseIds ?? [];
    const next = current.includes(caseId) ? current.filter(id => id !== caseId) : [...current, caseId];
    updateMutation.mutate({ id: req.id, data: { linkedCaseIds: next } });
  }

  function openEdit(req: TmRequirement) {
    setForm({
      reqId: req.reqId,
      title: req.title,
      priority: req.priority ?? "medium",
      source: req.source ?? "",
      description: req.description ?? "",
      functionalArea: req.functionalArea ?? "",
      process: (req as any).process ?? "",
      linkedFeature: (req as any).linkedFeature ?? "",
      implementationStatus: (req as any).implementationStatus ?? "draft",
    });
    setEditing(true);
    setCreating(false);
  }

  function submitForm() {
    if (creating) {
      createMutation.mutate(form);
    } else if (editing && selected) {
      updateMutation.mutate({ id: selected.id, data: form });
    }
  }

  // Stats
  const coveredReqs = reqs.filter(r => (r.linkedCaseIds?.length ?? 0) > 0).length;
  const implementedCount = reqs.filter(r => (r as any).implementationStatus === "implemented" || (r as any).implementationStatus === "verified").length;
  const areas = Array.from(new Set(reqs.map(r => r.functionalArea).filter(Boolean)));

  const filtered = reqs.filter(r => {
    if (filterArea !== "all" && r.functionalArea !== filterArea) return false;
    if (filterImpl !== "all" && (r as any).implementationStatus !== filterImpl) return false;
    if (debouncedSearch && !r.title.toLowerCase().includes(debouncedSearch.toLowerCase()) && !r.reqId.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  });

  const reqColumns: MondayColumnDef<TmRequirement>[] = useMemo(() => [
    { id: "reqId", header: "ID", type: "text", accessor: "reqId", width: "90px", editable: false, render: (r) => <span className="font-mono text-xs text-primary font-semibold">{r.reqId}</span> },
    { id: "title", header: "Title", type: "text", accessor: "title", width: "160px", sticky: true, editable: false, render: (r) => <span className="text-xs font-medium truncate">{r.title}</span> },
    { id: "priority", header: "Pri", type: "text", accessor: "priority", width: "70px", editable: false, render: (r) => <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold", PRI_BADGE[r.priority ?? "medium"])}>{r.priority}</span> },
    { id: "impl", header: "Impl", type: "text", accessor: (r) => (r as any).implementationStatus, width: "90px", editable: false, render: (r) => { const implSt = (r as any).implementationStatus ?? "draft"; return <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded capitalize", IMPL_BADGE[implSt])}>{implSt.replace("_", " ")}</span>; } },
    { id: "cases", header: "Cases", type: "number", accessor: (r) => r.linkedCaseIds?.length ?? 0, width: "60px", editable: false },
  ], []);

  return (
    <TmScreenShell
      loading={isLoading}
      error={firstError}
      onRetry={() => {
        void reqsQuery.refetch();
        void casesQuery.refetch();
        void resultsQuery.refetch();
        void defectsQuery.refetch();
      }}
      label="Loading traceability..."
    >
      <div className="flex h-full overflow-hidden">
      {/* Requirements List */}
      <div className="w-[340px] min-w-[280px] border-r border-border flex flex-col overflow-hidden">
        <MondayBoardProvider storageKey="jiganto-tm-traceability">
        {/* Header + Stats */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Requirements (RTM)</div>
            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => {
              if (creating) {
                setCreating(false);
                setForm(DEFAULT_FORM);
              } else {
                setForm(DEFAULT_FORM);
                setEditing(false);
                setCreating(true);
              }
            }}
              data-testid="btn-add-req">
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Total", val: reqs.length, cls: "text-primary" },
              { label: "Covered", val: coveredReqs, cls: "text-green-600" },
              { label: "Implemented", val: implementedCount, cls: "text-teal-600" },
            ].map(s => (
              <div key={s.label} className="bg-muted/40 rounded-lg px-2 py-1.5 text-center">
                <div className={cn("text-lg font-bold font-mono", s.cls)}>{s.val}</div>
                <div className="text-[9px] text-muted-foreground uppercase">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="px-3 py-2 border-b border-border flex-shrink-0 space-y-1.5">
          <input className="w-full border border-border rounded px-2.5 py-1.5 text-xs bg-background"
            placeholder="Search requirements…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-req-search" />
          <div className="flex gap-2">
            <select className="flex-1 border border-border rounded px-2 py-1 text-xs bg-background"
              value={filterArea} onChange={e => setFilterArea(e.target.value)}>
              <option value="all">All areas</option>
              {areas.map(a => <option key={a} value={a!}>{a}</option>)}
            </select>
            <select className="flex-1 border border-border rounded px-2 py-1 text-xs bg-background"
              value={filterImpl} onChange={e => setFilterImpl(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="implemented">Implemented</option>
              <option value="verified">Verified</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </div>
          <div className="flex justify-end pt-1">
            <MondayBoardChromeControls />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <MondayBoardTable
            columns={reqColumns}
            data={filtered}
            gridLines
            emptyMessage={reqs.length === 0 ? "No requirements yet. Click Add to create your first requirement." : "No requirements match your filters."}
            onRowClick={(r) => { setSelectedId(r.id); setEditing(false); setCreating(false); }}
            searchHighlightTerm={debouncedSearch}
            paginationResetKey={`${filterArea}-${filterImpl}-${debouncedSearch}`}
            className="border-0 rounded-none"
          />
        </div>
        </MondayBoardProvider>
      </div>

      {/* Right Panel: Create / Edit form OR Detail */}
      <div className="flex-1 overflow-y-auto">
        {(creating || editing) ? (
          /* ── Create / Edit Form ── */
          <div className="p-6 max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{creating ? "New Requirement" : "Edit Requirement"}</h3>
              <button onClick={() => { setCreating(false); setEditing(false); setForm(DEFAULT_FORM); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Req ID</label>
                <input className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background font-mono"
                  value={form.reqId} onChange={e => setForm(f => ({ ...f, reqId: e.target.value }))}
                  placeholder="e.g. REQ-FI-001" data-testid="input-req-id" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</label>
                <select className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                  value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option><option value="medium">Medium</option>
                  <option value="high">High</option><option value="critical">Critical</option><option value="must">Must Have</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</label>
              <input className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Requirement title…" data-testid="input-req-title" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
              <textarea className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background resize-none"
                rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the requirement…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Functional Area</label>
                <select className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                  value={form.functionalArea} onChange={e => setForm(f => ({ ...f, functionalArea: e.target.value }))}>
                  <option value="">— Select —</option>
                  {FUNC_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Business Process</label>
                <select className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                  value={form.process} onChange={e => setForm(f => ({ ...f, process: e.target.value }))}>
                  <option value="">— Select —</option>
                  {PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Linked Feature</label>
                <input className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                  value={form.linkedFeature} onChange={e => setForm(f => ({ ...f, linkedFeature: e.target.value }))}
                  placeholder="e.g. AP Automation" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source Document</label>
                <input className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                  value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  placeholder="e.g. BRD v1.2" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Implementation Status</label>
              <select className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                value={form.implementationStatus} onChange={e => setForm(f => ({ ...f, implementationStatus: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="in_progress">In Progress</option>
                <option value="implemented">Implemented</option>
                <option value="verified">Verified</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={submitForm}
                disabled={!form.reqId || !form.title || createMutation.isPending || updateMutation.isPending}
                data-testid="btn-save-req" className="gap-1.5">
                {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {creating ? "Create Requirement" : "Save Changes"}
              </Button>
              <Button variant="ghost" onClick={() => { setCreating(false); setEditing(false); setForm(DEFAULT_FORM); }}>Cancel</Button>
            </div>
          </div>
        ) : !selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Link className="h-8 w-8" />
            <div className="text-sm">Select a requirement to view its traceability details</div>
          </div>
        ) : (
          <div className="p-6 max-w-4xl space-y-5">
            {/* Req header */}
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-primary font-bold text-sm">{selected.reqId}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded font-semibold", PRI_BADGE[selected.priority ?? "medium"])}>
                    {selected.priority?.toUpperCase()}
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded capitalize", IMPL_BADGE[(selected as any).implementationStatus ?? "draft"])}>
                    {((selected as any).implementationStatus ?? "draft").replace("_", " ")}
                  </span>
                  {selected.source && <span className="text-xs text-muted-foreground">· {selected.source}</span>}
                </div>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                {selected.description && <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => openEdit(selected)} data-testid="btn-edit-req">
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm("Delete this requirement?")) deleteMutation.mutate(selected.id); }} data-testid="btn-delete-req">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Functional Area", value: selected.functionalArea },
                { label: "Business Process", value: (selected as any).process },
                { label: "Linked Feature", value: (selected as any).linkedFeature },
              ].filter(f => f.value).map(f => (
                <div key={f.label} className="bg-muted/30 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{f.label}</div>
                  <div className="text-sm font-medium">{f.value}</div>
                </div>
              ))}
            </div>

            {/* Coverage summary */}
            {linkedCases.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {(["pass","fail","blocked","not_run"] as const).map(s => {
                  const count = linkedCases.filter(c => getLastResult(c.id) === s).length;
                  const labels: Record<string, string> = { pass: "Passed", fail: "Failed", blocked: "Blocked", not_run: "Not Run" };
                  const colors: Record<string, string> = {
                    pass: "text-green-600", fail: "text-red-600", blocked: "text-orange-600", not_run: "text-muted-foreground"
                  };
                  return (
                    <div key={s} className="bg-card border border-border rounded-xl p-3 text-center">
                      <div className={cn("text-2xl font-bold font-mono", colors[s])}>{count}</div>
                      <div className="text-xs text-muted-foreground">{labels[s]}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Linked test cases */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Linked Test Cases ({linkedCases.length})</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => setLinkingId(linkingId === selected.id ? null : selected.id)}
                  data-testid="btn-link-cases">
                  <Link className="h-3 w-3" /> Manage Links
                </Button>
              </div>

              {linkingId === selected.id && (
                <div className="border border-border rounded-xl mb-4 overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground">
                    Click checkbox to link/unlink test cases
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
                    {cases.map(c => {
                      const isLinked = (selected.linkedCaseIds ?? []).includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted/40">
                          <input type="checkbox" checked={isLinked} onChange={() => toggleLink(selected, c.id)} className="rounded" />
                          <span className="text-xs flex-1 truncate">{c.title}</span>
                          <span className="text-[10px] font-mono text-muted-foreground capitalize">{c.priority}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {linkedCases.length === 0 ? (
                <div className="text-xs text-muted-foreground py-3">No test cases linked yet. Click "Manage Links" to connect test cases to this requirement.</div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-gray-700 dark:text-foreground">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                        <th className="px-3 py-2.5 text-left align-middle font-semibold">Test Case</th>
                        <th className="px-3 py-2.5 text-left align-middle font-semibold w-20">Priority</th>
                        <th className="px-3 py-2.5 text-left align-middle font-semibold w-28">Last Result</th>
                        <th className="px-3 py-2.5 text-right align-middle font-semibold w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {linkedCases.map(c => {
                        const result = getLastResult(c.id);
                        return (
                          <tr key={c.id} className="border-b border-border/40 hover:bg-muted/30 group">
                            <td className="px-3 py-2.5 align-middle font-medium">{c.title}</td>
                            <td className="px-3 py-2.5 align-middle capitalize">{c.priority}</td>
                            <td className="px-3 py-2.5 align-middle">
                              <div className="flex items-center gap-1.5">
                                {RESULT_ICON[result] ?? RESULT_ICON.not_run}
                                <span className="capitalize">{result?.replace("_", " ")}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 align-middle">
                              <button onClick={() => toggleLink(selected, c.id)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Linked Defects */}
            {linkedDefects.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Bug className="h-4 w-4 text-red-500" /> Linked Defects ({linkedDefects.length})
                </h3>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-gray-700 dark:text-foreground">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                        <th className="px-3 py-2.5 text-left align-middle font-semibold">Defect</th>
                        <th className="px-3 py-2.5 text-left align-middle font-semibold w-20">Severity</th>
                        <th className="px-3 py-2.5 text-left align-middle font-semibold w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedDefects.map(d => (
                        <tr key={d.id} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="px-3 py-2.5 align-middle font-medium">
                            <span className="font-mono text-[10px] text-muted-foreground mr-2">{d.ref}</span>
                            {d.title}
                          </td>
                          <td className="px-3 py-2.5 align-middle capitalize">{d.severity}</td>
                          <td className="px-3 py-2.5 align-middle capitalize">{d.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </TmScreenShell>
  );
}
