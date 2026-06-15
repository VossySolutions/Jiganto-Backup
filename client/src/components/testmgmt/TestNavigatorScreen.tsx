import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TmTestSuite, TmTestCase, TmTestStep, TmTestResult } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  ChevronRight, FlaskConical, FolderOpen, Folder, Filter,
  Clock, CheckCircle2, XCircle, MinusCircle, Loader2,
  Pencil, Save, X, Plus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useTmFetch, useTmFetchById } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";

const STATUS_ICON: Record<string, JSX.Element> = {
  pass:    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />,
  fail:    <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />,
  blocked: <MinusCircle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />,
  not_run: <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />,
};

const PRI_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

type StepDraft = { id?: number; stepOrder: number; action: string; expectedResult: string; testData: string };

export function TestNavigatorScreen() {
  const { toast } = useToast();
  const [expandedSuites, setExpandedSuites] = useState<Set<number>>(new Set());
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [filterPri, setFilterPri] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  // Editing state
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editStatus, setEditStatus] = useState("draft");
  const [editDescription, setEditDescription] = useState("");
  const [editPreconditions, setEditPreconditions] = useState("");
  const [editSteps, setEditSteps] = useState<StepDraft[]>([]);

  const suitesQuery = useTmFetch<TmTestSuite[]>(["/api/tm/suites"], "/api/tm/suites");
  const casesQuery = useTmFetch<TmTestCase[]>(["/api/tm/cases"], "/api/tm/cases");
  const resultsQuery = useTmFetch<TmTestResult[]>(["/api/tm/results/all"], "/api/tm/results/all");

  const suites = suitesQuery.data ?? [];
  const allCases = casesQuery.data ?? [];
  const allResults = resultsQuery.data ?? [];

  const selectedCase = allCases.find(c => c.id === selectedCaseId);
  const stepsQuery = useTmFetchById<TmTestStep[]>(
    ["/api/tm/cases", selectedCaseId, "steps"],
    selectedCaseId ? `/api/tm/cases/${selectedCaseId}/steps` : null,
    { enabled: !!selectedCaseId },
  );
  const stepsData = stepsQuery.data;
  const steps = stepsData ?? [];
  const refetchSteps = stepsQuery.refetch;
  const casesData = casesQuery.data;
  const isLoading = suitesQuery.isLoading || casesQuery.isLoading || resultsQuery.isLoading;
  const firstError = suitesQuery.error ?? casesQuery.error ?? resultsQuery.error ?? null;

  // Sync edit form when selection changes
  useEffect(() => {
    if (!selectedCaseId || !casesData) return;
    const c = casesData.find(x => x.id === selectedCaseId);
    if (!c) return;
    setEditTitle(c.title);
    setEditPriority(c.priority ?? "medium");
    setEditStatus(c.status ?? "draft");
    setEditDescription(c.description ?? "");
    setEditPreconditions(c.preconditions ?? "");
    setEditMode(false);
  }, [selectedCaseId, casesData]);

  useEffect(() => {
    if (!selectedCaseId) {
      setEditSteps([]);
      return;
    }
    if (!stepsData) return;
    setEditSteps(stepsData.map(s => ({
      id: s.id,
      stepOrder: s.stepOrder,
      action: s.action,
      expectedResult: s.expectedResult ?? "",
      testData: s.testData ?? "",
    })));
  }, [selectedCaseId, stepsData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/tm/cases/${selectedCaseId}`, {
        title: editTitle,
        priority: editPriority,
        status: editStatus,
        description: editDescription,
        preconditions: editPreconditions,
      });
      await apiRequest("POST", `/api/tm/cases/${selectedCaseId}/steps/bulk`,
        editSteps.map((s, i) => ({ action: s.action, expectedResult: s.expectedResult, testData: s.testData, stepOrder: i + 1 }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cases", selectedCaseId, "steps"] });
      refetchSteps();
      setEditMode(false);
      toast({ title: "Test case updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function getLastResult(caseId: number): string {
    const results = allResults.filter(r => r.testCaseId === caseId);
    if (!results.length) return "not_run";
    return results.sort((a, b) => new Date(b.executedAt ?? 0).getTime() - new Date(a.executedAt ?? 0).getTime())[0]?.status ?? "not_run";
  }

  function toggleSuite(id: number) {
    setExpandedSuites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function matchesFilters(c: TmTestCase): boolean {
    if (filterPri !== "all" && c.priority !== filterPri) return false;
    const result = getLastResult(c.id);
    if (filterStatus !== "all" && result !== filterStatus) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }

  const filteredSuites = suites.map(suite => ({
    ...suite,
    cases: allCases.filter(c => c.suiteId === suite.id && matchesFilters(c)),
  })).filter(s => s.cases.length > 0 || (!search && filterPri === "all" && filterStatus === "all"));

  const unsuitedCases = allCases.filter(c => !c.suiteId && matchesFilters(c));

  const caseHistory = selectedCaseId
    ? allResults.filter(r => r.testCaseId === selectedCaseId).sort((a, b) =>
        new Date(b.executedAt ?? 0).getTime() - new Date(a.executedAt ?? 0).getTime()
      )
    : [];

  const historyPagination = useTablePagination(caseHistory, { resetKey: selectedCaseId ?? 0 });

  function addEditStep() {
    setEditSteps(s => [...s, { stepOrder: s.length + 1, action: "", expectedResult: "", testData: "" }]);
  }

  function updateEditStep(idx: number, field: keyof StepDraft, value: string) {
    setEditSteps(s => s.map((step, i) => i === idx ? { ...step, [field]: value } : step));
  }

  function removeEditStep(idx: number) {
    setEditSteps(s => s.filter((_, i) => i !== idx).map((step, i) => ({ ...step, stepOrder: i + 1 })));
  }

  function cancelEdit() {
    if (selectedCase) {
      setEditTitle(selectedCase.title);
      setEditPriority(selectedCase.priority ?? "medium");
      setEditStatus(selectedCase.status ?? "draft");
      setEditDescription(selectedCase.description ?? "");
      setEditPreconditions(selectedCase.preconditions ?? "");
      setEditSteps(steps.map(s => ({ id: s.id, stepOrder: s.stepOrder, action: s.action, expectedResult: s.expectedResult ?? "", testData: s.testData ?? "" })));
    }
    setEditMode(false);
  }

  return (
    <TmScreenShell
      loading={isLoading}
      error={firstError}
      onRetry={() => {
        void suitesQuery.refetch();
        void casesQuery.refetch();
        void resultsQuery.refetch();
      }}
      label="Loading test navigator..."
    >
      <div className="flex h-full overflow-hidden">
      {/* Tree Panel */}
      <div className="w-[320px] min-w-[280px] border-r border-border flex flex-col overflow-hidden">
        {/* Filters */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0 space-y-2">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <input className="flex-1 border border-border rounded px-2 py-1 text-xs bg-background"
              placeholder="Search test cases..." value={search} onChange={e => setSearch(e.target.value)}
              data-testid="input-navigator-search" />
          </div>
          <div className="flex gap-2">
            <select className="flex-1 border border-border rounded px-1.5 py-1 text-xs bg-background"
              value={filterPri} onChange={e => setFilterPri(e.target.value)} data-testid="filter-nav-priority">
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option><option value="high">High</option>
              <option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <select className="flex-1 border border-border rounded px-1.5 py-1 text-xs bg-background"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)} data-testid="filter-nav-status">
              <option value="all">All Results</option>
              <option value="pass">Pass</option><option value="fail">Fail</option>
              <option value="blocked">Blocked</option><option value="not_run">Not Run</option>
            </select>
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto">
          {filteredSuites.map(suite => {
            const isExpanded = expandedSuites.has(suite.id);
            return (
              <div key={suite.id}>
                <button className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors border-b border-border/50"
                  onClick={() => toggleSuite(suite.id)} data-testid={`suite-node-${suite.id}`}>
                  <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform", isExpanded && "rotate-90")} />
                  {isExpanded ? <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" /> : <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  <span className="text-xs font-medium flex-1 text-left truncate">{suite.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 rounded flex-shrink-0">{suite.cases.length}</span>
                </button>
                {isExpanded && suite.cases.map(c => {
                  const result = getLastResult(c.id);
                  const isSelected = selectedCaseId === c.id;
                  return (
                    <button key={c.id}
                      className={cn(
                        "w-full flex items-center gap-2 pl-10 pr-4 py-2 border-b border-border/30 transition-colors text-left",
                        isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/30 text-foreground",
                      )}
                      onClick={() => setSelectedCaseId(c.id)} data-testid={`case-node-${c.id}`}>
                      {STATUS_ICON[result] ?? STATUS_ICON.not_run}
                      <span className="text-xs flex-1 truncate">{c.title}</span>
                      <span className={cn("text-[9px] font-mono px-1 py-0.5 rounded uppercase flex-shrink-0", PRI_BADGE[c.priority ?? "medium"])}>
                        {(c.priority ?? "med").slice(0, 3)}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {unsuitedCases.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b border-border/50">
                <Folder className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Ungrouped</span>
              </div>
              {unsuitedCases.map(c => {
                const result = getLastResult(c.id);
                const isSelected = selectedCaseId === c.id;
                return (
                  <button key={c.id}
                    className={cn(
                      "w-full flex items-center gap-2 pl-10 pr-4 py-2 border-b border-border/30 transition-colors text-left",
                      isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/30",
                    )}
                    onClick={() => setSelectedCaseId(c.id)}>
                    {STATUS_ICON[result] ?? STATUS_ICON.not_run}
                    <span className="text-xs flex-1 truncate">{c.title}</span>
                  </button>
                );
              })}
            </div>
          )}
          {filteredSuites.length === 0 && unsuitedCases.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">No test cases match the current filters.</div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCase ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <FlaskConical className="h-8 w-8" />
            <div className="text-sm">Select a test case from the tree to view its details</div>
          </div>
        ) : (
          <div className="p-6 max-w-3xl space-y-5">
            {/* Header with edit controls */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {editMode ? (
                  <input
                    className="w-full border border-border rounded-lg px-3 py-2 text-xl font-semibold bg-background mb-2"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    data-testid="input-edit-case-title"
                  />
                ) : (
                  <h2 className="text-xl font-semibold mb-2">{selectedCase.title}</h2>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {editMode ? (
                    <>
                      <select className="border border-border rounded px-2 py-1 text-xs bg-background"
                        value={editPriority} onChange={e => setEditPriority(e.target.value)} data-testid="select-edit-priority">
                        <option value="low">Low</option><option value="medium">Medium</option>
                        <option value="high">High</option><option value="critical">Critical</option>
                      </select>
                      <select className="border border-border rounded px-2 py-1 text-xs bg-background"
                        value={editStatus} onChange={e => setEditStatus(e.target.value)} data-testid="select-edit-status">
                        <option value="draft">Draft</option><option value="active">Active</option>
                        <option value="deprecated">Deprecated</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <span className={cn("text-xs px-2 py-0.5 rounded font-semibold", PRI_BADGE[selectedCase.priority ?? "medium"])}>
                        {selectedCase.priority?.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{selectedCase.status}</span>
                      <span className="text-xs text-muted-foreground capitalize">{selectedCase.caseType}</span>
                      {(selectedCase.tags ?? []).map((tag: string) => (
                        <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{tag}</span>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {editMode ? (
                  <>
                    <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!editTitle.trim() || saveMutation.isPending}
                      className="gap-1.5 h-7 text-xs" data-testid="btn-save-case-edit">
                      {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs gap-1" data-testid="btn-cancel-case-edit">
                      <X className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditMode(true)} className="gap-1 h-7 text-xs" data-testid="btn-edit-case">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Description */}
            {editMode ? (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</div>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none"
                  rows={2} value={editDescription} onChange={e => setEditDescription(e.target.value)}
                  placeholder="Case description…" data-testid="textarea-edit-description" />
              </div>
            ) : selectedCase.description ? (
              <p className="text-sm text-muted-foreground">{selectedCase.description}</p>
            ) : null}

            {/* Preconditions */}
            {editMode ? (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Preconditions</div>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none"
                  rows={2} value={editPreconditions} onChange={e => setEditPreconditions(e.target.value)}
                  placeholder="Preconditions…" data-testid="textarea-edit-preconditions" />
              </div>
            ) : selectedCase.preconditions ? (
              <div className="bg-muted/40 rounded-xl p-4">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Preconditions</div>
                <div className="text-sm">{selectedCase.preconditions}</div>
              </div>
            ) : null}

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{editMode ? "Test Steps" : `Test Steps (${editSteps.length})`}</h3>
                {editMode && (
                  <Button size="sm" variant="ghost" onClick={addEditStep} className="gap-1 h-7 text-xs" data-testid="btn-add-step">
                    <Plus className="h-3.5 w-3.5" /> Add Step
                  </Button>
                )}
              </div>
              {editMode ? (
                <div className="space-y-2">
                  {editSteps.map((step, idx) => (
                    <div key={idx} className="border border-border rounded-xl p-3 flex gap-3 items-start">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 mt-1">{idx + 1}</div>
                      <div className="flex-1 space-y-1.5">
                        <input className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
                          placeholder="Action…" value={step.action} onChange={e => updateEditStep(idx, "action", e.target.value)}
                          data-testid={`input-step-action-${idx}`} />
                        <input className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
                          placeholder="Expected result…" value={step.expectedResult} onChange={e => updateEditStep(idx, "expectedResult", e.target.value)}
                          data-testid={`input-step-expected-${idx}`} />
                        <input className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
                          placeholder="Test data (optional)…" value={step.testData} onChange={e => updateEditStep(idx, "testData", e.target.value)} />
                      </div>
                      <button onClick={() => removeEditStep(idx)} className="text-muted-foreground hover:text-red-500 mt-1 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {editSteps.length === 0 && (
                    <div className="text-xs text-muted-foreground py-2 text-center">No steps yet. Click "Add Step" to add the first one.</div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {steps.map(step => (
                    <div key={step.id} className="border border-border rounded-xl p-4 flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono font-bold flex-shrink-0">{step.stepOrder}</div>
                      <div className="flex-1">
                        <div className="text-sm">{step.action}</div>
                        {step.expectedResult && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-semibold">Expected: </span>{step.expectedResult}
                          </div>
                        )}
                        {step.testData && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <span className="font-semibold">Test data: </span>{step.testData}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {steps.length === 0 && (
                    <div className="text-xs text-muted-foreground">No steps defined. Click Edit to add test steps.</div>
                  )}
                </div>
              )}
            </div>

            {/* Execution History (read-only) */}
            {!editMode && caseHistory.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">Execution History</h3>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold">Result</th>
                        <th className="text-left px-4 py-2 font-semibold">Executed By</th>
                        <th className="text-left px-4 py-2 font-semibold">Date</th>
                        <th className="text-left px-4 py-2 font-semibold">Comment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {historyPagination.paginatedItems.map(r => (
                        <tr key={r.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              {STATUS_ICON[r.status ?? "not_run"] ?? STATUS_ICON.not_run}
                              <span className="capitalize">{(r.status ?? "not_run").replace("_", " ")}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2">{r.executedBy ?? "—"}</td>
                          <td className="px-4 py-2 font-mono">{r.executedAt ? new Date(r.executedAt).toLocaleDateString() : "—"}</td>
                          <td className="px-4 py-2 max-w-[200px] truncate text-muted-foreground">{r.comment ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <TablePagination
                    page={historyPagination.page}
                    totalPages={historyPagination.totalPages}
                    total={historyPagination.total}
                    startIndex={historyPagination.startIndex}
                    endIndex={historyPagination.endIndex}
                    pageSize={historyPagination.pageSize}
                    onPageChange={historyPagination.setPage}
                    onPageSizeChange={historyPagination.setPageSize}
                  />
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
