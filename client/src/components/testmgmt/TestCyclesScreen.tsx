import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { TmTestRun } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTmProject } from "@/contexts/TmProjectContext";
import { CYCLE_STATUS_COLORS, TEST_PHASES, getTmLabels } from "@/lib/tm-utils";
import type { TmCycleMetrics } from "@/types/testmgmt";
import {
  Plus,
  ShieldCheck,
  Play,
  Calendar,
  FileDown,
  FileSignature,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import {
  MondayBoardProvider,
  MondayBoardTable,
  MondayBoardChromeControls,
} from "@/components/MondayBoardTable";
import { useDebouncedValue } from "@/lib/crm-monday-chrome";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel } from "@/components/ui/form-dialog-shell";
import { useAuth } from "@/hooks/use-auth";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";
import { tmDownloadPdf } from "@/lib/tm-api";
import type { SignoffRequest } from "@/lib/signoff-constants";

type EnrichedCycle = TmTestRun & { metrics: TmCycleMetrics };

export function TestCyclesScreen() {
  const { toast } = useToast();
  const { user } = useAuth();
  const signedOffBy = user?.email ?? user?.id ?? "unknown";
  const [, setLocation] = useLocation();
  const { activeProjectId, activeProject, qsParam } = useTmProject();
  const labels = getTmLabels(activeProject?.methodology);
  const [createOpen, setCreateOpen] = useState(false);
  const [listLayout, setListLayout] = useState<"cards" | "table">("cards");
  const [cycleSearch, setCycleSearch] = useState("");
  const debouncedCycleSearch = useDebouncedValue(cycleSearch);
  const emptyForm = () => ({
    name: "", testPhase: "uat", methodology: activeProject?.methodology ?? "waterfall",
    startDate: "", endDate: "", buildVersion: "", notes: "",
  });
  const [form, setForm] = useState(emptyForm);

  const {
    data: cycles = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTmFetch<EnrichedCycle[]>(["/api/tm/cycles"], "/api/tm/cycles");

  const { data: esignRequests = [] } = useQuery<SignoffRequest[]>({
    queryKey: ["/api/signoff"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/signoff");
      if (!res.ok) throw new Error("Failed to load e-sign requests");
      return res.json();
    },
    staleTime: 30_000,
  });

  function esignForCycle(cycleId: number) {
    return esignRequests.find(
      r => r.testCycleId === cycleId && !["voided", "cancelled", "draft"].includes(r.status),
    );
  }

  function requestEsign(cycle: EnrichedCycle) {
    const m = cycle.metrics;
    const params = new URLSearchParams({
      compose: "1",
      testCycleId: String(cycle.id),
      testCycleName: cycle.name,
      testPhase: cycle.testPhase ?? "uat",
    });
    if (m) {
      params.set("uatTotal", String(m.total));
      params.set("uatPassed", String(m.passed));
      params.set("uatFailed", String(m.failed));
      params.set("uatCompletion", String(m.completionPct));
      params.set("uatPassRate", String(m.passRatePct));
    }
    if (cycle.buildVersion) params.set("buildVersion", cycle.buildVersion);
    setLocation(`/modules/e-sign?${params.toString()}`);
  }

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/tm/runs", {
      ...body,
      projectId: activeProjectId,
      status: "planning",
      startDate: body.startDate || null,
      endDate: body.endDate || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cycles"] });
      setCreateOpen(false);
      setForm(emptyForm());
      toast({ title: "Test cycle created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const setActiveMutation = useMutation({
    mutationFn: (cycleId: number) => apiRequest("PATCH", `/api/tm/cycles/${cycleId}/active`, { projectId: activeProjectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cycles"] });
      toast({ title: "Active cycle updated" });
    },
  });

  const signOffMutation = useMutation({
    mutationFn: (cycleId: number) => apiRequest("POST", `/api/tm/cycles/${cycleId}/sign-off`, { signedOffBy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cycles"] });
      toast({ title: "Test cycle signed off" });
    },
    onError: (e: Error) => toast({ title: "Sign-off failed", description: e.message, variant: "destructive" }),
  });

  async function downloadCyclePdf(cycleId: number, name: string) {
    try {
      const url = qsParam(`/api/tm/sign-offs/pdf?entityType=test_cycle&entityId=${cycleId}&testCycleId=${cycleId}`);
      await tmDownloadPdf(url, `signoff-cycle-${name.replace(/\s+/g, "-")}.pdf`);
      toast({ title: "Sign-off PDF downloaded" });
    } catch (e) {
      toast({ title: "PDF export failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  const filteredCycles = useMemo(() => {
    const q = debouncedCycleSearch.toLowerCase();
    return cycles.filter((c) => {
      if (!q) return true;
      return `${c.name} ${c.testPhase ?? ""} ${c.status ?? ""} ${c.buildVersion ?? ""}`.toLowerCase().includes(q);
    });
  }, [cycles, debouncedCycleSearch]);

  const cycleColumns: MondayColumnDef<EnrichedCycle>[] = useMemo(() => [
    {
      id: "name",
      header: "Cycle",
      type: "text",
      accessor: "name",
      width: "200px",
      sticky: true,
      editable: false,
      render: (cycle) => (
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full shrink-0", CYCLE_STATUS_COLORS[cycle.status ?? "planning"] ?? "bg-muted")} />
          <span className="font-medium">{cycle.name}</span>
          {activeProject?.activeCycleId === cycle.id && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">ACTIVE</span>}
        </div>
      ),
    },
    { id: "phase", header: "Phase", type: "text", accessor: (c) => c.testPhase, width: "80px", editable: false, render: (c) => <span className="text-[10px] font-mono uppercase">{c.testPhase ?? "uat"}</span> },
    { id: "dates", header: "Dates", type: "text", accessor: (c) => `${c.startDate ?? ""}-${c.endDate ?? ""}`, width: "160px", editable: false, render: (c) => c.startDate ? `${c.startDate} → ${c.endDate}` : "—" },
    { id: "status", header: "Status", type: "text", accessor: "status", width: "100px", editable: false, render: (c) => <span className="capitalize text-xs">{c.status?.replace("_", " ")}</span> },
    { id: "completion", header: "Done", type: "text", accessor: (c) => c.metrics?.completionPct, width: "70px", editable: false, render: (c) => c.metrics ? `${c.metrics.completionPct}%` : "—" },
    { id: "passRate", header: "Pass", type: "text", accessor: (c) => c.metrics?.passRatePct, width: "70px", editable: false, render: (c) => c.metrics ? `${c.metrics.passRatePct}%` : "—" },
  ], [activeProject?.activeCycleId]);

  return (
    <TmScreenShell
      loading={isLoading}
      error={isError ? error : null}
      onRetry={() => refetch()}
      label="Loading test cycles..."
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold">Test Cycles</h2>
            <p className="text-sm text-muted-foreground">Organising envelopes for testing windows · {labels.area} methodology</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex border rounded-lg overflow-hidden">
              <Button variant={listLayout === "cards" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-none" onClick={() => setListLayout("cards")}>
                <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Cards
              </Button>
              <Button variant={listLayout === "table" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-none" onClick={() => setListLayout("table")}>
                <LayoutList className="h-3.5 w-3.5 mr-1" /> Table
              </Button>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New Cycle</Button>
          </div>
        </div>

      {listLayout === "table" ? (
        <MondayBoardProvider storageKey="jiganto-tm-test-cycles">
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
          <input
            className="max-w-xs h-8 px-3 text-sm border border-border rounded-md bg-background"
            placeholder="Search cycles…"
            value={cycleSearch}
            onChange={(e) => setCycleSearch(e.target.value)}
            data-testid="cycle-search"
          />
          <MondayBoardChromeControls />
          </div>
          <MondayBoardTable
            columns={cycleColumns}
            data={filteredCycles}
            gridLines
            emptyMessage="No test cycles match your search."
            searchHighlightTerm={debouncedCycleSearch}
            paginationResetKey={`${debouncedCycleSearch}-${activeProjectId}`}
            renderRowActions={(cycle) => {
              const linkedEsign = esignForCycle(cycle.id);
              const isActive = activeProject?.activeCycleId === cycle.id;
              return (
                <div className="flex items-center gap-1">
                  {!isActive && cycle.status !== "signed_off" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setActiveMutation.mutate(cycle.id); }}>Active</Button>
                  )}
                  {cycle.status === "completed" && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); signOffMutation.mutate(cycle.id); }}>Sign off</Button>
                      {linkedEsign ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setLocation(`/modules/e-sign?request=${linkedEsign.id}`); }}>e-Sign</Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); requestEsign(cycle); }}>
                          <FileSignature className="h-3 w-3" /> e-Sign
                        </Button>
                      )}
                    </>
                  )}
                  {cycle.status === "signed_off" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); downloadCyclePdf(cycle.id, cycle.name); }}>
                      <FileDown className="h-3 w-3" /> PDF
                    </Button>
                  )}
                  {linkedEsign && cycle.status !== "completed" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setLocation(`/modules/e-sign?request=${linkedEsign.id}`); }}>e-Sign</Button>
                  )}
                </div>
              );
            }}
            alwaysShowRowActions
          />
        </div>
        </MondayBoardProvider>
      ) : (
      <div className="grid gap-4">
        {cycles.map(cycle => {
          const m = cycle.metrics;
          const isActive = activeProject?.activeCycleId === cycle.id;
          const linkedEsign = esignForCycle(cycle.id);
          return (
            <div key={cycle.id} className={cn("border rounded-xl p-5 bg-card", isActive && "border-primary ring-1 ring-primary/20")}>
              <div className="flex items-start gap-3 mb-4">
                <div className={cn("w-3 h-3 rounded-full mt-1", CYCLE_STATUS_COLORS[cycle.status ?? "planning"] ?? "bg-muted")} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{cycle.name}</h3>
                    {isActive && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">ACTIVE</span>}
                    <span className="text-[10px] font-mono uppercase bg-muted px-2 py-0.5 rounded">{cycle.testPhase ?? "uat"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    {cycle.startDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{cycle.startDate} → {cycle.endDate}</span>}
                    {cycle.buildVersion && <span>Build: {cycle.buildVersion}</span>}
                    <span className="capitalize">{cycle.status?.replace("_", " ")}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isActive && cycle.status !== "signed_off" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setActiveMutation.mutate(cycle.id)}>
                      <Play className="h-3 w-3 mr-1" /> Set Active
                    </Button>
                  )}
                  {cycle.status === "completed" && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => signOffMutation.mutate(cycle.id)}>
                        <ShieldCheck className="h-3 w-3" /> Sign Off Cycle
                      </Button>
                      {linkedEsign ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => setLocation(`/modules/e-sign?request=${linkedEsign.id}`)}>
                          <FileSignature className="h-3 w-3" /> View e-Sign
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => requestEsign(cycle)}>
                          <FileSignature className="h-3 w-3" /> Request e-Sign
                        </Button>
                      )}
                    </>
                  )}
                  {cycle.status === "signed_off" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => downloadCyclePdf(cycle.id, cycle.name)}>
                      <FileDown className="h-3 w-3" /> Export PDF
                    </Button>
                  )}
                </div>
              </div>

              {m && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {[
                    { label: "Total", value: m.total, color: "text-foreground" },
                    { label: "Executed", value: m.executed, color: "text-blue-600" },
                    { label: "Passed", value: m.passed, color: "text-green-600" },
                    { label: "Failed", value: m.failed, color: "text-red-600" },
                    { label: "Blocked", value: m.blocked, color: "text-amber-600" },
                    { label: "Completion", value: `${m.completionPct}%`, color: "text-primary" },
                    { label: "Pass Rate", value: `${m.passRatePct}%`, color: "text-green-600" },
                    { label: "Deferred", value: m.deferred, color: "text-muted-foreground" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-muted/30 rounded-lg p-2 text-center">
                      <div className={cn("text-lg font-bold font-mono", color)}>{value}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {m && m.total > 0 && (
                <div className="mt-3 flex gap-2">
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${m.completionPct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{m.completionPct}% complete</span>
                </div>
              )}
            </div>
          );
        })}
        {cycles.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No test cycles yet. Create one to begin execution.</div>
        )}
      </div>
      )}

        <FormDialogShell
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            setForm(emptyForm());
          }}
          title="Create Test Cycle"
          saveLabel="Create Cycle"
          onCancel={() => { setCreateOpen(false); setForm(emptyForm()); }}
          onSubmit={() => createMutation.mutate(form)}
          saving={createMutation.isPending}
          disabled={!form.name.trim()}
        >
          <FormSection title="Cycle details">
            <div className="space-y-1.5 mb-3.5">
              <FieldLabel required>Cycle name</FieldLabel>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Cycle name (e.g. UAT Sprint 3)"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <FieldGrid className="mb-3.5">
              <div>
                <FieldLabel>Test phase</FieldLabel>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.testPhase}
                  onChange={e => setForm(f => ({ ...f, testPhase: e.target.value }))}>
                  {TEST_PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Methodology</FieldLabel>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.methodology}
                  onChange={e => setForm(f => ({ ...f, methodology: e.target.value }))}>
                  <option value="waterfall">Waterfall</option>
                  <option value="agile">Agile</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </FieldGrid>
            <FieldGrid className="mb-3.5">
              <div>
                <FieldLabel>Start date</FieldLabel>
                <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>End date</FieldLabel>
                <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </FieldGrid>
            <div className="space-y-1.5 mb-3.5">
              <FieldLabel>Build / Version</FieldLabel>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Build / Version"
                value={form.buildVersion} onChange={e => setForm(f => ({ ...f, buildVersion: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Notes</FieldLabel>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm min-h-[60px]" placeholder="Planning notes, entry/exit criteria..."
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </FormSection>
        </FormDialogShell>
      </div>
    </TmScreenShell>
  );
}
