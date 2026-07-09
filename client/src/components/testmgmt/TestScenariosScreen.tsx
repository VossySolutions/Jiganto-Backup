import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TmScenario, TmTestCase } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTmProject } from "@/contexts/TmProjectContext";
import {
  Plus, Pencil, Trash2, BookOpen, Link, X, ChevronRight,
  Loader2, Check, Save, LayoutGrid, Sparkles,
} from "lucide-react";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";

const PRI_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const STATUS_BADGE: Record<string, string> = {
  draft:      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  active:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  completed:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  deprecated: "bg-muted text-muted-foreground",
};

const FUNC_AREAS = ["Order Management", "Finance", "Procurement", "CRM", "HR", "Inventory", "Billing", "Integration", "Reporting", "Administration", "Other"];
const PROCESSES  = ["Order-to-Cash", "Procure-to-Pay", "Record-to-Report", "Hire-to-Retire", "Plan-to-Inventory", "Lead-to-Opportunity", "Other"];

type ScenarioForm = {
  scenarioId: string; title: string; description: string;
  functionalArea: string; process: string;
  priority: string; status: string;
};

const EMPTY_FORM: ScenarioForm = {
  scenarioId: "", title: "", description: "",
  functionalArea: "", process: "",
  priority: "medium", status: "draft",
};

export function TestScenariosScreen() {
  const { toast } = useToast();
  const { activeProjectId } = useTmProject();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ScenarioForm>(EMPTY_FORM);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const scenariosQuery = useTmFetch<TmScenario[]>(["/api/tm/scenarios"], "/api/tm/scenarios");
  const allCasesQuery = useTmFetch<TmTestCase[]>(["/api/tm/cases"], "/api/tm/cases");

  const scenarios = scenariosQuery.data ?? [];
  const allCases = allCasesQuery.data ?? [];
  const isLoading = scenariosQuery.isLoading || allCasesQuery.isLoading;
  const firstError = scenariosQuery.error ?? allCasesQuery.error ?? null;

  const selected = scenarios.find(s => s.id === selectedId);
  const linkedCases = selected ? allCases.filter(c => (selected.linkedCaseIds ?? []).includes(c.id)) : [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tm/scenarios", data);
      return res.json() as Promise<TmScenario>;
    },
    onSuccess: (created: TmScenario) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/scenarios"] });
      setCreating(false);
      setForm(EMPTY_FORM);
      setSelectedId(created.id);
      toast({ title: "Scenario created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/tm/scenarios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/scenarios"] });
      setEditing(false);
      toast({ title: "Scenario updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tm/scenarios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/scenarios"] });
      setSelectedId(null);
      toast({ title: "Scenario deleted" });
    },
  });

  const aiGenerateMutation = useMutation({
    mutationFn: async (scenarioId: number) => {
      const res = await apiRequest("POST", "/api/tm/ai/generate-tests", {
        scenarioId,
        projectId: activeProjectId,
        count: 3,
        create: true,
      });
      return res.json() as Promise<{ createdCount?: number; source?: string; testCases?: unknown[] }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/hierarchy"] });
      toast({
        title: `Generated ${data.createdCount ?? data.testCases?.length ?? 0} test cases`,
        description: data.source === "ai" ? "AI-generated from user story" : "Generated using built-in templates (no AI key)",
      });
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  function toggleCaseLink(caseId: number) {
    if (!selected) return;
    const current = selected.linkedCaseIds ?? [];
    const next = current.includes(caseId) ? current.filter(id => id !== caseId) : [...current, caseId];
    updateMutation.mutate({ id: selected.id, data: { linkedCaseIds: next } });
  }

  function openCreate() {
    setEditing(false);
    setSelectedId(null);
    setForm({ ...EMPTY_FORM, scenarioId: `SCN-${String(scenarios.length + 1).padStart(3, "0")}` });
    setCreating(true);
  }

  function openEdit() {
    if (!selected) return;
    setForm({
      scenarioId: selected.scenarioId,
      title: selected.title,
      description: selected.description ?? "",
      functionalArea: selected.functionalArea ?? "",
      process: selected.process ?? "",
      priority: selected.priority ?? "medium",
      status: selected.status ?? "draft",
    });
    setEditing(true);
    setCreating(false);
  }

  function submitForm() {
    const payload = { ...form, projectId: activeProjectId };
    if (creating) {
      createMutation.mutate(payload);
    } else if (editing && selected) {
      updateMutation.mutate({ id: selected.id, data: form });
    }
  }

  const filtered = scenarios.filter(s => {
    if (filterArea !== "all" && s.functionalArea !== filterArea) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (search && !s.title.toLowerCase().includes(search.toLowerCase()) && !s.scenarioId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const areas = Array.from(new Set(scenarios.map(s => s.functionalArea).filter(Boolean)));
  const draftCount = scenarios.filter(s => s.status === "draft").length;
  const activeCount = scenarios.filter(s => s.status === "active").length;
  const totalLinked = scenarios.reduce((sum, s) => sum + (s.linkedCaseIds?.length ?? 0), 0);

  return (
    <TmScreenShell
      loading={isLoading}
      error={firstError}
      onRetry={() => {
        void scenariosQuery.refetch();
        void allCasesQuery.refetch();
      }}
      label="Loading test scenarios..."
    >
      <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Test Scenarios</h2>
          <p className="text-sm text-muted-foreground mt-0.5">High-level business scenarios that group related test cases</p>
        </div>
        <Button size="sm" onClick={openCreate} data-testid="btn-new-scenario" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Scenario
        </Button>
      </div>

      {/* KPI bar */}
      <div className="flex-shrink-0 grid grid-cols-4 divide-x divide-border border-b border-border bg-muted/20">
        {[
          { label: "Total", value: scenarios.length, cls: "text-primary" },
          { label: "Draft", value: draftCount, cls: "text-slate-500" },
          { label: "Active", value: activeCount, cls: "text-green-600" },
          { label: "Linked Cases", value: totalLinked, cls: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="px-5 py-3 text-center">
            <div className={cn("text-2xl font-bold font-mono", s.cls)}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: scenario list */}
        <div className="w-[340px] min-w-[280px] border-r border-border flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="flex-shrink-0 px-3 py-2 border-b border-border space-y-2">
            <input
              className="w-full border border-border rounded px-2.5 py-1.5 text-xs bg-background"
              placeholder="Search scenarios…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-scenario-search"
            />
            <div className="flex gap-2">
              <select
                className="flex-1 border border-border rounded px-2 py-1 text-xs bg-background"
                value={filterArea}
                onChange={e => setFilterArea(e.target.value)}
                data-testid="select-filter-area"
              >
                <option value="all">All areas</option>
                {areas.map(a => <option key={a} value={a!}>{a}</option>)}
              </select>
              <select
                className="flex-1 border border-border rounded px-2 py-1 text-xs bg-background"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                data-testid="select-filter-status"
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {scenarios.length === 0 ? "No scenarios yet. Create your first one." : "No scenarios match your filters."}
              </div>
            ) : (
              filtered.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedId(s.id); setEditing(false); setCreating(false); }}
                  data-testid={`scenario-row-${s.id}`}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors flex items-start gap-2.5 group",
                    s.id === selectedId ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-muted/40"
                  )}
                >
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0 group-hover:text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-muted-foreground">{s.scenarioId}</span>
                      <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded-full capitalize", STATUS_BADGE[s.status ?? "draft"])}>{s.status}</span>
                    </div>
                    <div className="text-sm font-medium truncate">{s.title}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {s.functionalArea && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{s.functionalArea}</span>}
                      {s.priority && <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded capitalize", PRI_BADGE[s.priority])}>{s.priority}</span>}
                      {(s.linkedCaseIds?.length ?? 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground">{s.linkedCaseIds?.length} case{s.linkedCaseIds?.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-1" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: detail / form */}
        <div className="flex-1 overflow-y-auto">
          {(creating || (editing && selected)) ? (
            /* ── Create / Edit Form ── */
            <div className="p-6 max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{creating ? "New Test Scenario" : "Edit Scenario"}</h3>
                <button onClick={() => { setCreating(false); setEditing(false); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scenario ID</label>
                  <input
                    className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background font-mono"
                    value={form.scenarioId}
                    onChange={e => setForm(f => ({ ...f, scenarioId: e.target.value }))}
                    data-testid="input-form-scenario-id"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</label>
                  <select
                    className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    data-testid="select-form-priority"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</label>
                <input
                  className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Scenario title…"
                  data-testid="input-form-title"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                <textarea
                  className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background resize-none"
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the business scenario…"
                  data-testid="textarea-form-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Functional Area</label>
                  <select
                    className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                    value={form.functionalArea}
                    onChange={e => setForm(f => ({ ...f, functionalArea: e.target.value }))}
                    data-testid="select-form-area"
                  >
                    <option value="">— Select area —</option>
                    {FUNC_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Business Process</label>
                  <select
                    className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                    value={form.process}
                    onChange={e => setForm(f => ({ ...f, process: e.target.value }))}
                    data-testid="select-form-process"
                  >
                    <option value="">— Select process —</option>
                    {PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                <select
                  className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  data-testid="select-form-status"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="deprecated">Deprecated</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={submitForm}
                  disabled={!form.title.trim() || !form.scenarioId.trim() || createMutation.isPending || updateMutation.isPending}
                  data-testid="btn-save-scenario"
                  className="gap-1.5"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {creating ? "Create Scenario" : "Save Changes"}
                </Button>
                <Button variant="ghost" onClick={() => { setCreating(false); setEditing(false); }}>Cancel</Button>
              </div>
            </div>
          ) : selected ? (
            /* ── Scenario Detail ── */
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{selected.scenarioId}</span>
                    <span className={cn("text-xs font-mono px-2 py-0.5 rounded-full capitalize", STATUS_BADGE[selected.status ?? "draft"])}>{selected.status}</span>
                    <span className={cn("text-xs font-mono px-2 py-0.5 rounded-full capitalize", PRI_BADGE[selected.priority ?? "medium"])}>{selected.priority}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{selected.title}</h3>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => aiGenerateMutation.mutate(selected.id)}
                    disabled={aiGenerateMutation.isPending}
                    className="gap-1"
                    data-testid="btn-ai-generate-tests"
                  >
                    {aiGenerateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    AI Generate Tests
                  </Button>
                  <Button size="sm" variant="outline" onClick={openEdit} className="gap-1" data-testid="btn-edit-scenario">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => { if (confirm("Delete this scenario?")) deleteMutation.mutate(selected.id); }}
                    className="gap-1 text-destructive hover:text-destructive"
                    data-testid="btn-delete-scenario"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Functional Area", value: selected.functionalArea },
                  { label: "Business Process", value: selected.process },
                ].map(f => (
                  <div key={f.label} className="bg-muted/30 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{f.label}</div>
                    <div className="text-sm font-medium">{f.value || <span className="text-muted-foreground italic">—</span>}</div>
                  </div>
                ))}
              </div>

              {selected.description && (
                <div className="bg-muted/20 rounded-xl p-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}

              {/* Linked Test Cases */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Linked Test Cases</span>
                    <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{linkedCases.length}</span>
                  </div>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => setLinking(!linking)}
                    className="gap-1 text-xs h-7"
                    data-testid="btn-link-cases"
                  >
                    <Link className="h-3 w-3" /> {linking ? "Done" : "Link Cases"}
                  </Button>
                </div>

                {linking ? (
                  <div className="max-h-52 overflow-y-auto divide-y divide-border">
                    {allCases.map(c => {
                      const isLinked = (selected.linkedCaseIds ?? []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleCaseLink(c.id)}
                          data-testid={`link-case-${c.id}`}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
                        >
                          <div className={cn("w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
                            isLinked ? "bg-primary border-primary" : "border-border"
                          )}>
                            {isLinked && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-foreground truncate">{c.title}</div>
                            <div className="flex gap-1.5 mt-0.5">
                              <span className={cn("text-[9px] font-mono px-1 py-0.5 rounded capitalize", PRI_BADGE[c.priority ?? "medium"])}>{c.priority}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : linkedCases.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No test cases linked yet. Click "Link Cases" to associate test cases with this scenario.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {linkedCases.map(c => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{c.title}</div>
                          <div className="flex gap-1.5 mt-0.5">
                            <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded capitalize", PRI_BADGE[c.priority ?? "medium"])}>{c.priority}</span>
                            <span className="text-[10px] text-muted-foreground capitalize">{c.status}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleCaseLink(c.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          data-testid={`unlink-case-${c.id}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Empty state ── */
            <div className="flex flex-col items-center justify-center h-full text-center p-10 text-muted-foreground">
              <BookOpen className="h-10 w-10 mb-3 text-muted-foreground/50" />
              <div className="text-sm font-medium mb-1">Select a scenario</div>
              <div className="text-xs max-w-xs">Choose a scenario from the list to view its details and linked test cases, or create a new one.</div>
            </div>
          )}
        </div>
      </div>
      </div>
    </TmScreenShell>
  );
}
