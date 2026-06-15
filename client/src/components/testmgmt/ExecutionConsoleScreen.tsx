import { useState, useEffect, useCallback, useMemo } from "react";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TmTestRun, TmTestCase, TmTestResult, TmTestStep } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Play, CheckCircle2, XCircle, MinusCircle, SkipForward, Ban,
  ChevronLeft, ChevronRight, Loader2, Bug, Upload, AlertCircle,
} from "lucide-react";
import { useTmProject } from "@/contexts/TmProjectContext";
import { useTmFetch, useTmFetchById } from "@/hooks/use-tm-fetch";
import { tmFetchFormData } from "@/lib/tm-api";
import { normalizeStatus, STATUS_DOT, STATUS_LABELS } from "@/lib/tm-utils";
import type { TmHierarchyNode } from "@/types/testmgmt";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type StepStatus = "not_started" | "pass" | "fail" | "blocked";

interface StepResult {
  stepId: number;
  stepOrder: number;
  action: string;
  expectedResult: string;
  status: StepStatus;
  comment: string;
}

interface FailForm {
  actualResult: string;
  notes: string;
  raiseDefect: boolean;
  defectSeverity: string;
}

interface BlockedForm {
  blockedReason: string;
  notes: string;
}

function StatusDot({ status }: { status: string }) {
  const s = normalizeStatus(status);
  const strike = s === "deferred" || s === "not_applicable";
  return (
    <span className={cn(
      "w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block",
      STATUS_DOT[s] ?? "bg-muted-foreground",
      strike && "line-through opacity-60",
    )} />
  );
}

export function ExecutionConsoleScreen() {
  const { toast } = useToast();
  const { activeProjectId, activeProject, qsParam } = useTmProject();
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [failOpen, setFailOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [failForm, setFailForm] = useState<FailForm>({ actualResult: "", notes: "", raiseDefect: true, defectSeverity: "high" });
  const [blockedForm, setBlockedForm] = useState<BlockedForm>({ blockedReason: "", notes: "" });
  const [evidenceFiles, setEvidenceFiles] = useState<{ name: string; url: string; size?: number }[]>([]);

  const { data: cycles = [], isLoading: cyclesLoading, isError: cyclesError, error: cyclesErr, refetch: refetchCycles } = useTmFetch<TmTestRun[]>(
    ["/api/tm/cycles"], "/api/tm/cycles",
  );

  const { data: cycleDetail, isLoading: cycleLoading, isError: cycleError, error: cycleErr, refetch: refetchCycle } = useTmFetchById<{
    results: TmTestResult[]; metrics: Record<string, number>;
  }>(
    ["/api/tm/cycles/detail", selectedCycleId],
    selectedCycleId ? `/api/tm/cycles/${selectedCycleId}` : null,
  );

  const { data: hierarchy } = useTmFetch<{ tree: TmHierarchyNode[] }>(
    ["/api/tm/hierarchy"], "/api/tm/hierarchy",
  );

  const { data: allCases = [] } = useTmFetch<TmTestCase[]>(
    ["/api/tm/cases"], "/api/tm/cases",
  );

  const results = cycleDetail?.results ?? [];
  const selectedResult = results.find(r => r.id === selectedResultId) ?? null;
  const selectedCase = selectedResult ? allCases.find(c => c.id === selectedResult.testCaseId) : null;
  const selectedCycle = cycles.find(c => c.id === selectedCycleId);

  const { data: steps = [], isLoading: stepsLoading } = useTmFetchById<TmTestStep[]>(
    ["/api/tm/cases/steps", selectedCase?.id],
    selectedCase ? `/api/tm/cases/${selectedCase.id}/steps` : null,
  );

  // Auto-select active cycle
  useEffect(() => {
    if (cycles.length && !selectedCycleId) {
      const active = activeProject?.activeCycleId
        ? cycles.find(c => c.id === activeProject.activeCycleId)
        : cycles.find(c => c.status === "in_progress") ?? cycles[0];
      if (active) setSelectedCycleId(active.id);
    }
  }, [cycles, selectedCycleId, activeProject?.activeCycleId]);

  const submitMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("POST", `/api/tm/executions/${selectedResultId}/submit`, body),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cycles", selectedCycleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cycles", activeProjectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/dashboard", activeProjectId] });
      setFailOpen(false);
      setBlockedOpen(false);
      setEvidenceFiles([]);
      toast({ title: "Execution recorded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openExecution = useCallback((result: TmTestResult) => {
    setSelectedResultId(result.id);
    const existing = (result.stepResults ?? []) as StepResult[];
    setStepResults(existing.length ? existing : []);
    setEvidenceFiles((result.evidence as typeof evidenceFiles) ?? []);
  }, []);

  useEffect(() => {
    if (selectedResult && steps.length && stepResults.length === 0) {
      setStepResults(steps.map(s => ({
        stepId: s.id, stepOrder: s.stepOrder, action: s.action,
        expectedResult: s.expectedResult ?? "", status: "not_started" as StepStatus, comment: "",
      })));
    }
  }, [selectedResult, steps, stepResults.length]);

  // Group queue by area → process
  const groupedQueue = useMemo(() => {
    const tree = hierarchy?.tree ?? [];
    const groups: Array<{ area: string; process: string; items: Array<{ result: TmTestResult; caseTitle: string; status: string }> }> = [];
    const caseMap = new Map(allCases.map(c => [c.id, c]));

    for (const node of tree) {
      for (const proc of node.processes) {
        const items: typeof groups[0]["items"] = [];
        for (const sc of proc.scenarios) {
          for (const tc of sc.cases) {
            const result = results.find(r => r.testCaseId === tc.id);
            if (result) {
              const c = caseMap.get(tc.id);
              items.push({ result, caseTitle: c?.title ?? tc.title, status: normalizeStatus(result.status) });
            }
          }
        }
        if (items.length) {
          groups.push({ area: node.area.name, process: proc.process.name, items });
        }
      }
    }

    // Unassigned cases not in hierarchy
    const inHierarchy = new Set(groups.flatMap(g => g.items.map(i => i.result.id)));
    const orphan = results.filter(r => !inHierarchy.has(r.id)).map(r => ({
      result: r,
      caseTitle: caseMap.get(r.testCaseId)?.title ?? `Case #${r.testCaseId}`,
      status: normalizeStatus(r.status),
    }));
    if (orphan.length) groups.push({ area: "Unassigned", process: "General", items: orphan });

    return groups;
  }, [hierarchy, results, allCases]);

  const flatResults = groupedQueue.flatMap(g => g.items);
  const currentIdx = flatResults.findIndex(i => i.result.id === selectedResultId);
  const executedCount = results.filter(r => !["not_started", "in_progress"].includes(normalizeStatus(r.status))).length;

  function goNext() {
    if (currentIdx >= 0 && currentIdx < flatResults.length - 1) {
      openExecution(flatResults[currentIdx + 1].result);
    }
  }
  function goPrev() {
    if (currentIdx > 0) openExecution(flatResults[currentIdx - 1].result);
  }

  function submitPass() {
    if (!selectedResultId) return;
    submitMutation.mutate({
      status: "pass", stepResults, evidence: evidenceFiles,
      notes: failForm.notes || undefined,
    });
  }

  function submitFail() {
    if (!failForm.actualResult.trim()) {
      toast({ title: "Actual result required", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      status: "fail",
      actualResult: failForm.actualResult,
      notes: failForm.notes,
      raiseDefect: failForm.raiseDefect,
      defectSeverity: failForm.defectSeverity,
      stepResults,
      evidence: evidenceFiles,
    });
  }

  function submitBlocked() {
    if (!blockedForm.blockedReason.trim()) {
      toast({ title: "Blocked reason required", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      status: "blocked",
      blockedReason: blockedForm.blockedReason,
      notes: blockedForm.notes,
      stepResults,
      evidence: evidenceFiles,
    });
  }

  function submitDeferred() {
    submitMutation.mutate({ status: "deferred", notes: blockedForm.notes, stepResults, evidence: evidenceFiles });
  }

  function submitNA() {
    submitMutation.mutate({ status: "not_applicable", notes: blockedForm.notes, stepResults, evidence: evidenceFiles });
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedResultId || failOpen || blockedOpen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "p" || e.key === "P") { e.preventDefault(); submitPass(); }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); setFailOpen(true); }
      if (e.key === "b" || e.key === "B") { e.preventDefault(); setBlockedOpen(true); }
      if (e.key === "n" || e.key === "N") { e.preventDefault(); goNext(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function uploadEvidence(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const data = await tmFetchFormData<{ name: string; url: string; size?: number }>("/api/tm/evidence/upload", fd);
    setEvidenceFiles(prev => [...prev, { name: data.name, url: data.url, size: data.size }]);
  }

  const metrics = cycleDetail?.metrics;

  const isLoading = cyclesLoading || (!!selectedCycleId && cycleLoading);
  const loadError = cyclesError ? cyclesErr : cycleError ? cycleErr : null;

  return (
    <TmScreenShell loading={isLoading} error={loadError} onRetry={() => { refetchCycles(); refetchCycle(); }} label="Loading execution console…">
    <div className="flex flex-col xl:flex-row h-full min-h-[480px] overflow-hidden">
      {/* Cycle selector + queue */}
      <div className="w-full xl:w-[300px] xl:min-w-[280px] border-b xl:border-b-0 xl:border-r border-border flex flex-col overflow-hidden bg-muted/20 max-h-[40vh] xl:max-h-none">
        <div className="px-3 py-3 border-b border-border space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Test Cycle</div>
          <select
            className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-background"
            value={selectedCycleId ?? ""}
            onChange={e => { setSelectedCycleId(Number(e.target.value)); setSelectedResultId(null); }}
          >
            {cycles.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {metrics && (
            <div className="text-[10px] text-muted-foreground font-mono">
              {metrics.executed}/{metrics.total} executed · {metrics.passRatePct}% pass
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selectedCycleId ? (
            <div className="p-4 text-xs text-muted-foreground">Select a test cycle</div>
          ) : groupedQueue.map(group => (
            <div key={`${group.area}-${group.process}`} className="border-b border-border/50">
              <div className="px-3 py-2 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0">
                {group.area} → {group.process}
              </div>
              {group.items.map(({ result, caseTitle, status }) => (
                <button
                  key={result.id}
                  onClick={() => openExecution(result)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors",
                    selectedResultId === result.id && "bg-primary/10",
                  )}
                >
                  <StatusDot status={status} />
                  <span className={cn("flex-1 truncate", (status === "deferred" || status === "not_applicable") && "line-through opacity-60")}>
                    {caseTitle}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Active test case panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {!selectedResult ? (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-3">
            <Play className="h-10 w-10 opacity-40" />
            <p className="text-sm">Select a test case from the queue</p>
            <p className="text-xs">Shortcuts: P Pass · F Fail · B Blocked · N Next</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">{selectedCase?.title}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                  <StatusDot status={selectedResult.status ?? "not_started"} />
                  <span>{STATUS_LABELS[normalizeStatus(selectedResult.status)] ?? selectedResult.status}</span>
                  {selectedCycle && <span>· Cycle: {selectedCycle.name}</span>}
                </div>
              </div>

              {selectedCase?.preconditions && (
                <div className="bg-muted/40 rounded-lg p-3 mb-4 text-xs">
                  <div className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Preconditions</div>
                  {selectedCase.preconditions}
                </div>
              )}

              {selectedCase?.testData && (
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 mb-4 text-xs border border-blue-200 dark:border-blue-800">
                  <div className="font-semibold text-[10px] uppercase tracking-wider mb-1">Test Data</div>
                  {selectedCase.testData}
                </div>
              )}

              {steps.length > 0 && (
                <div className="space-y-2 mb-6">
                  <div className="text-sm font-semibold">Test Steps</div>
                  {steps.map(step => {
                    const sr = stepResults.find(s => s.stepId === step.id);
                    const st = sr?.status ?? "not_started";
                    return (
                      <div key={step.id} className={cn("border rounded-lg p-3 text-xs", st === "pass" && "border-green-300", st === "fail" && "border-red-300")}>
                        <div className="flex gap-2">
                          <span className="font-mono font-bold w-5">{step.stepOrder}</span>
                          <div className="flex-1">
                            <div className="font-medium">{step.action}</div>
                            {step.expectedResult && <div className="text-muted-foreground mt-0.5">Expected: {step.expectedResult}</div>}
                          </div>
                        </div>
                        <div className="flex gap-1 mt-2 ml-7">
                          {(["pass", "fail", "blocked"] as StepStatus[]).map(s => (
                            <button key={s} onClick={() => setStepResults(prev => prev.map(x => x.stepId === step.id ? { ...x, status: s } : x))}
                              className={cn("px-2 py-0.5 rounded border text-[10px] capitalize", st === s ? "bg-primary/10 border-primary" : "border-border")}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Evidence */}
              <div className="mb-4">
                <div className="text-xs font-semibold mb-2 flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5" /> Evidence ({evidenceFiles.length}/10)
                </div>
                <input type="file" multiple accept="image/*,.pdf,.mp4,.webm" className="text-xs"
                  onChange={e => { Array.from(e.target.files ?? []).slice(0, 10 - evidenceFiles.length).forEach(f => uploadEvidence(f).catch(() => toast({ title: "Upload failed", variant: "destructive" }))); e.target.value = ""; }}
                  disabled={evidenceFiles.length >= 10} />
                <div className="flex flex-wrap gap-2 mt-2">
                  {evidenceFiles.map((f, i) => (
                    <span key={i} className="text-[10px] bg-muted px-2 py-1 rounded font-mono">{f.name}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="border-t border-border p-4 bg-card flex-shrink-0 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${results.length ? (executedCount / results.length) * 100 : 0}%` }} />
                </div>
                <span className="font-mono whitespace-nowrap">{executedCount} of {results.length}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button className="bg-green-600 hover:bg-green-700 text-white gap-2 flex-1 min-w-[100px]" onClick={submitPass} disabled={submitMutation.isPending}>
                  <CheckCircle2 className="h-4 w-4" /> Pass <span className="text-[10px] opacity-70">(P)</span>
                </Button>
                <Button variant="destructive" className="gap-2 flex-1 min-w-[100px]" onClick={() => setFailOpen(true)} disabled={submitMutation.isPending}>
                  <XCircle className="h-4 w-4" /> Fail <span className="text-[10px] opacity-70">(F)</span>
                </Button>
                <Button variant="outline" className="gap-2 border-amber-400 text-amber-700" onClick={() => setBlockedOpen(true)}>
                  <MinusCircle className="h-4 w-4" /> Blocked <span className="text-[10px] opacity-70">(B)</span>
                </Button>
                <Button variant="outline" className="gap-2" onClick={submitDeferred}>
                  <SkipForward className="h-4 w-4" /> Deferred
                </Button>
                <Button variant="ghost" className="gap-2" onClick={submitNA}>
                  <Ban className="h-4 w-4" /> N/A
                </Button>
                <div className="flex gap-1 ml-auto">
                  <Button variant="outline" size="icon" onClick={goPrev} disabled={currentIdx <= 0}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={goNext} disabled={currentIdx >= flatResults.length - 1}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fail dialog */}
      <Dialog open={failOpen} onOpenChange={setFailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Failure</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Actual Result *</label>
              <textarea className="w-full border rounded-lg p-2 text-sm mt-1 min-h-[80px]" value={failForm.actualResult}
                onChange={e => setFailForm(f => ({ ...f, actualResult: e.target.value }))} placeholder="Describe what actually happened..." />
            </div>
            <div>
              <label className="text-xs font-medium">Severity</label>
              <select className="w-full border rounded-lg p-2 text-sm mt-1" value={failForm.defectSeverity}
                onChange={e => setFailForm(f => ({ ...f, defectSeverity: e.target.value }))}>
                {["critical", "high", "medium", "low"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={failForm.raiseDefect} onChange={e => setFailForm(f => ({ ...f, raiseDefect: e.target.checked }))} />
              Raise Defect in Help Desk (pre-ticked)
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setFailOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={submitFail} disabled={submitMutation.isPending}>
                {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Fail"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blocked dialog */}
      <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Blocked</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Reason why blocked *</label>
              <textarea className="w-full border rounded-lg p-2 text-sm mt-1 min-h-[60px]" value={blockedForm.blockedReason}
                onChange={e => setBlockedForm(f => ({ ...f, blockedReason: e.target.value }))} placeholder="e.g. Test data not available" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBlockedOpen(false)}>Cancel</Button>
              <Button onClick={submitBlocked} disabled={submitMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                Submit Blocked
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TmScreenShell>
  );
}
