import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TmTestRun, TmTestCase, TmTestResult, TmTestStep } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Play, CheckCircle2, XCircle, MinusCircle, SkipForward,
  Plus, Trash2, ChevronRight, Clock, Loader2,
} from "lucide-react";
import { useTmProject } from "@/contexts/TmProjectContext";

type StepStatus = "not_run" | "pass" | "fail" | "blocked" | "skipped";

interface StepResult {
  stepId: number;
  stepOrder: number;
  action: string;
  expectedResult: string;
  status: StepStatus;
  comment: string;
}

const STATUS_LABELS: Record<string, string> = {
  not_run: "Not Run", pass: "Pass", fail: "Fail",
  blocked: "Blocked", skipped: "Skipped", planned: "Planned", in_progress: "In Progress",
  completed: "Completed", aborted: "Aborted",
};
const STATUS_COLORS: Record<string, string> = {
  not_run: "bg-muted text-muted-foreground",
  pass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  fail: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  blocked: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  skipped: "bg-muted text-muted-foreground",
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  aborted: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={cn("text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase", STATUS_COLORS[status] ?? "bg-muted text-muted-foreground")}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function StepStatusBtn({ value, active, onClick }: { value: StepStatus; active: boolean; onClick: () => void }) {
  const cfg = {
    pass: { label: "Pass", icon: CheckCircle2, cls: "text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20" },
    fail: { label: "Fail", icon: XCircle, cls: "text-red-600 border-red-300 bg-red-50 dark:bg-red-900/20" },
    blocked: { label: "Blocked", icon: MinusCircle, cls: "text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-900/20" },
    skipped: { label: "Skip", icon: SkipForward, cls: "text-muted-foreground border-border" },
    not_run: { label: "—", icon: Clock, cls: "text-muted-foreground border-border" },
  }[value];
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-all",
        active ? cfg.cls + " opacity-100 ring-2 ring-offset-1 ring-current" : "border-border text-muted-foreground hover:bg-muted/60",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </button>
  );
}

export function ExecutionConsoleScreen() {
  const { toast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
  const [addingCases, setAddingCases] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [overallComment, setOverallComment] = useState("");

  const { activeProjectId, qsParam } = useTmProject();
  const { data: runs = [] } = useQuery<TmTestRun[]>({
    queryKey: ["/api/tm/runs", activeProjectId],
    queryFn: async () => { const r = await fetch(qsParam("/api/tm/runs")); return r.ok ? r.json() : []; },
  });
  const { data: allCases = [] } = useQuery<TmTestCase[]>({
    queryKey: ["/api/tm/cases", activeProjectId],
    queryFn: async () => { const r = await fetch(qsParam("/api/tm/cases")); return r.ok ? r.json() : []; },
  });
  const { data: results = [], isLoading: resultsLoading } = useQuery<TmTestResult[]>({
    queryKey: ["/api/tm/runs", selectedRunId, "results"],
    queryFn: async () => {
      if (!selectedRunId) return [];
      const r = await fetch(`/api/tm/runs/${selectedRunId}/results`);
      return r.json();
    },
    enabled: !!selectedRunId,
  });

  const selectedResult = results.find(r => r.id === selectedResultId) ?? null;
  const selectedCase = selectedResult ? allCases.find(c => c.id === selectedResult.testCaseId) : null;

  const { data: steps = [] } = useQuery<TmTestStep[]>({
    queryKey: ["/api/tm/cases", selectedCase?.id, "steps"],
    queryFn: async () => {
      if (!selectedCase) return [];
      const r = await fetch(`/api/tm/cases/${selectedCase.id}/steps`);
      return r.json();
    },
    enabled: !!selectedCase,
  });

  const addCasesMutation = useMutation({
    mutationFn: (caseIds: number[]) => apiRequest("POST", `/api/tm/runs/${selectedRunId}/results`, { caseIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/runs", selectedRunId, "results"] });
      setAddingCases(false);
      setSelectedCaseIds([]);
      toast({ title: "Test cases added to run" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeResultMutation = useMutation({
    mutationFn: (resultId: number) => apiRequest("DELETE", `/api/tm/results/${resultId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/runs", selectedRunId, "results"] });
      if (selectedResultId) setSelectedResultId(null);
    },
  });

  const submitResultMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/tm/results/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/runs", selectedRunId, "results"] });
      toast({ title: "Result submitted", description: "Test result saved successfully." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openExecution(result: TmTestResult) {
    setSelectedResultId(result.id);
    const existing = (result.stepResults ?? []) as StepResult[];
    setStepResults(existing);
    setOverallComment(result.comment ?? "");
  }

  function initSteps() {
    if (stepResults.length === 0 && steps.length > 0) {
      setStepResults(steps.map(s => ({
        stepId: s.id, stepOrder: s.stepOrder, action: s.action,
        expectedResult: s.expectedResult ?? "", status: "not_run", comment: "",
      })));
    }
  }

  function setStepStatus(stepId: number, status: StepStatus) {
    setStepResults(prev => prev.map(s => s.stepId === stepId ? { ...s, status } : s));
  }

  function submitResult(overallStatus: "pass" | "fail" | "blocked") {
    if (!selectedResultId) return;
    submitResultMutation.mutate({
      id: selectedResultId,
      data: { status: overallStatus, stepResults, comment: overallComment, executedAt: new Date().toISOString() },
    });
  }

  const casesInRun = results.map(r => r.testCaseId);
  const casesNotInRun = allCases.filter(c => !casesInRun.includes(c.id));

  const selectedRun = runs.find(r => r.id === selectedRunId);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Run List */}
      <div className="w-[220px] min-w-[220px] border-r border-border flex flex-col overflow-y-auto bg-muted/20">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Test Runs</div>
        </div>
        {runs.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">No runs yet. Create a run first.</div>
        ) : (
          runs.map(run => (
            <button
              key={run.id}
              onClick={() => { setSelectedRunId(run.id); setSelectedResultId(null); }}
              data-testid={`run-item-${run.id}`}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-border/50 transition-colors",
                selectedRunId === run.id ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-foreground",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", {
                  "bg-green-500": run.status === "completed",
                  "bg-blue-500": run.status === "in_progress",
                  "bg-red-500": run.status === "aborted",
                  "bg-muted-foreground": run.status === "planned",
                })} />
                <StatusChip status={run.status ?? "planned"} />
              </div>
              <div className="text-xs font-medium leading-tight">{run.name}</div>
              {run.startDate && (
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{run.startDate}</div>
              )}
            </button>
          ))
        )}
      </div>

      {/* Case List */}
      <div className="w-[320px] min-w-[300px] border-r border-border flex flex-col overflow-hidden">
        {!selectedRunId ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center p-6 gap-3 text-muted-foreground">
            <Play className="h-8 w-8" />
            <div className="text-sm">Select a test run to begin execution</div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Test Cases</div>
              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setAddingCases(!addingCases)}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>

            {addingCases && (
              <div className="border-b border-border p-3 bg-muted/30">
                <div className="text-xs font-semibold mb-2 text-muted-foreground">Select test cases to add:</div>
                <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
                  {casesNotInRun.length === 0 ? (
                    <div className="text-xs text-muted-foreground">All test cases are already in this run.</div>
                  ) : casesNotInRun.map(tc => (
                    <label key={tc.id} className="flex items-center gap-2 cursor-pointer text-xs hover:bg-muted/50 px-1 py-0.5 rounded">
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.includes(tc.id)}
                        onChange={e => setSelectedCaseIds(prev => e.target.checked ? [...prev, tc.id] : prev.filter(id => id !== tc.id))}
                      />
                      <span className="truncate">{tc.title}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-6 text-xs" disabled={selectedCaseIds.length === 0 || addCasesMutation.isPending}
                    onClick={() => addCasesMutation.mutate(selectedCaseIds)}>
                    {addCasesMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : `Add ${selectedCaseIds.length || ""}`}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAddingCases(false)}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-border/50">
              {resultsLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : results.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground">No test cases added to this run yet. Click "Add" to add some.</div>
              ) : results.map(result => {
                const tc = allCases.find(c => c.id === result.testCaseId);
                const isSelected = selectedResultId === result.id;
                return (
                  <div
                    key={result.id}
                    onClick={() => { openExecution(result); setTimeout(initSteps, 50); }}
                    data-testid={`result-item-${result.id}`}
                    className={cn(
                      "px-4 py-3 cursor-pointer transition-colors flex items-start gap-2",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/40",
                    )}
                  >
                    <ChevronRight className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary transition-transform", isSelected && "rotate-90")} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate mb-1">{tc?.title ?? `Case #${result.testCaseId}`}</div>
                      <StatusChip status={result.status ?? "not_run"} />
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); removeResultMutation.mutate(result.id); }}
                      className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Step Execution Panel */}
      <div className="flex-1 overflow-y-auto">
        {!selectedResult ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-3 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8" />
            <div className="text-sm">
              {selectedRunId ? "Select a test case to execute" : "Select a run, then a test case"}
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-3xl">
            <div className="flex items-start gap-3 mb-6">
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{selectedCase?.title ?? "Executing Test Case"}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusChip status={selectedResult.status ?? "not_run"} />
                  {selectedCase?.priority && (
                    <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded uppercase">{selectedCase.priority}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">Run: {selectedRun?.name}</span>
                </div>
              </div>
            </div>

            {selectedCase?.preconditions && (
              <div className="bg-muted/40 rounded-lg p-3 mb-5 text-xs">
                <div className="font-semibold text-muted-foreground mb-1 uppercase tracking-wider text-[10px]">Preconditions</div>
                <div>{selectedCase.preconditions}</div>
              </div>
            )}

            {/* Steps */}
            <div className="space-y-3 mb-6">
              <div className="text-sm font-semibold">Test Steps</div>
              {steps.length === 0 ? (
                <div className="text-xs text-muted-foreground">No steps defined for this test case.</div>
              ) : steps.map(step => {
                const sr = stepResults.find(s => s.stepId === step.id);
                const currentStatus: StepStatus = sr?.status ?? "not_run";
                return (
                  <div key={step.id} className={cn(
                    "border rounded-xl p-4 transition-colors",
                    currentStatus === "pass" ? "border-green-300 bg-green-50/50 dark:bg-green-900/10" :
                    currentStatus === "fail" ? "border-red-300 bg-red-50/50 dark:bg-red-900/10" :
                    currentStatus === "blocked" ? "border-orange-300 bg-orange-50/50 dark:bg-orange-900/10" :
                    "border-border bg-card",
                  )}>
                    <div className="flex gap-3 mb-3">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono font-bold flex-shrink-0">
                        {step.stepOrder}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium mb-1">{step.action}</div>
                        {step.expectedResult && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-semibold">Expected: </span>{step.expectedResult}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap ml-9">
                      {(["pass", "fail", "blocked", "skipped"] as StepStatus[]).map(s => (
                        <StepStatusBtn
                          key={s}
                          value={s}
                          active={currentStatus === s}
                          onClick={() => setStepStatus(step.id, s)}
                        />
                      ))}
                    </div>
                    {currentStatus === "fail" && (
                      <input
                        className="mt-2 ml-9 w-[calc(100%-2.25rem)] text-xs border border-border rounded px-2 py-1.5 bg-background"
                        placeholder="Failure comment..."
                        value={sr?.comment ?? ""}
                        onChange={e => setStepResults(prev => prev.map(s => s.stepId === step.id ? { ...s, comment: e.target.value } : s))}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Overall comment + submit */}
            <div className="border-t border-border pt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wider">Overall Comment</label>
                <textarea
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[72px] resize-none"
                  placeholder="Add notes, observations, or evidence references..."
                  value={overallComment}
                  onChange={e => setOverallComment(e.target.value)}
                />
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white gap-2"
                  onClick={() => submitResult("pass")}
                  disabled={submitResultMutation.isPending}
                  data-testid="btn-submit-pass"
                >
                  <CheckCircle2 className="h-4 w-4" /> Submit Pass
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => submitResult("fail")}
                  disabled={submitResultMutation.isPending}
                  data-testid="btn-submit-fail"
                >
                  <XCircle className="h-4 w-4" /> Submit Fail
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-orange-400 text-orange-600 hover:bg-orange-50"
                  onClick={() => submitResult("blocked")}
                  disabled={submitResultMutation.isPending}
                  data-testid="btn-submit-blocked"
                >
                  <MinusCircle className="h-4 w-4" /> Blocked
                </Button>
                {submitResultMutation.isPending && <Loader2 className="h-4 w-4 animate-spin self-center" />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
