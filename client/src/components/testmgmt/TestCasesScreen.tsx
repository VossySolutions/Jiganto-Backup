import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TmTestCase, TmTestSuite, TmTestStep } from "@shared/schema";
import { useTmProject } from "@/contexts/TmProjectContext";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormDialogShell,
  FormSection
} from "@/components/ui/form-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import { matchBoardFilterValue } from "@/lib/board-filters";
import { useDebouncedValue, downloadBoardCsv, downloadImportTemplateCsv } from "@/lib/crm-monday-chrome";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";

const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = ["draft", "active", "deprecated"] as const;
const CASE_TYPES = ["manual", "automated"] as const;

const priorityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const statusIcons: Record<string, React.ReactNode> = {
  draft: <Clock className="h-3.5 w-3.5 text-amber-500" />,
  active: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  deprecated: <XCircle className="h-3.5 w-3.5 text-muted-foreground" />,
};

interface StepDraft {
  action: string;
  expectedResult: string;
  testData: string;
}

interface FormData {
  title: string;
  description: string;
  preconditions: string;
  priority: string;
  status: string;
  caseType: string;
  suiteId: number | null;
  estimatedDuration: number | null;
  tags: string[];
}

const defaultForm = (): FormData => ({
  title: "",
  description: "",
  preconditions: "",
  priority: "medium",
  status: "draft",
  caseType: "manual",
  suiteId: null,
  estimatedDuration: null,
  tags: [],
});

export function TestCasesScreen() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TmTestCase | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [filterSuite, setFilterSuite] = useState<number | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(searchText);
  const [pinName, setPinName] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("tm-cases-pin-title") !== "0";
  });
  // New Run modal state
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runName, setRunName] = useState("");
  const [runStartDate, setRunStartDate] = useState("");
  const [runCaseIds, setRunCaseIds] = useState<Set<number>>(new Set());

  const { activeProjectId } = useTmProject();
  const suitesQuery = useTmFetch<TmTestSuite[]>(["/api/tm/suites"], "/api/tm/suites");
  const casesQuery = useTmFetch<TmTestCase[]>(["/api/tm/cases"], "/api/tm/cases");
  const suites = suitesQuery.data ?? [];
  const allCases = casesQuery.data ?? [];
  const isLoading = suitesQuery.isLoading || casesQuery.isLoading;
  const firstError = suitesQuery.error ?? casesQuery.error ?? null;

  const suiteName = (id: number | null) => suites.find(s => s.id === id)?.name ?? "—";

  const filtered = allCases.filter(tc => {
    if (filterSuite && tc.suiteId !== filterSuite) return false;
    if (filterPriority !== "all" && tc.priority !== filterPriority) return false;
    if (filterStatus !== "all" && tc.status !== filterStatus) return false;
    if (debouncedSearch && !tc.title.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  });

  const mondayColumns: MondayColumnDef<TmTestCase>[] = useMemo(() => [
    {
      id: "title",
      header: "Title",
      type: "text",
      accessor: "title",
      width: "240px",
      sticky: pinName,
      editable: true,
      render: (tc) => (
        <div className="min-w-0 max-w-[240px]">
          <div className="truncate font-medium">{tc.title}</div>
          {tc.description && <div className="text-xs text-muted-foreground truncate">{tc.description}</div>}
        </div>
      ),
    },
    {
      id: "suite",
      header: "Suite",
      type: "text",
      accessor: (row) => suiteName(row.suiteId ?? null),
      width: "140px",
      editable: false,
      render: (tc) => <span className="text-muted-foreground text-xs">{suiteName(tc.suiteId ?? null)}</span>,
    },
    {
      id: "priority",
      header: "Priority",
      type: "status",
      accessor: "priority",
      width: "110px",
      editable: true,
      options: PRIORITIES.map((p) => ({
        value: p,
        label: p.charAt(0).toUpperCase() + p.slice(1),
        color: priorityColors[p],
      })),
      render: (tc) => (
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", priorityColors[tc.priority ?? "medium"])}>
          {tc.priority}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      type: "status",
      accessor: "status",
      width: "120px",
      editable: true,
      options: STATUSES.map((s) => ({
        value: s,
        label: s.charAt(0).toUpperCase() + s.slice(1),
        color:
          s === "active" ? "bg-[#00c875] text-white"
          : s === "draft" ? "bg-[#fdab3d] text-white"
          : "bg-[#c4c4c4] text-white",
      })),
      render: (tc) => (
        <div className="flex items-center gap-1.5">
          {statusIcons[tc.status ?? "draft"]}
          <span className="text-xs capitalize">{tc.status}</span>
        </div>
      ),
    },
    {
      id: "caseType",
      header: "Type",
      type: "text",
      accessor: "caseType",
      width: "100px",
      editable: true,
      render: (tc) => <span className="text-xs text-muted-foreground capitalize">{tc.caseType}</span>,
    },
    {
      id: "tags",
      header: "Tags",
      type: "tags",
      accessor: "tags",
      width: "160px",
      editable: false,
      render: (tc) => (
        <div className="flex flex-wrap gap-1">
          {((tc.tags as string[]) ?? []).slice(0, 3).map(tag => (
            <span key={tag} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{tag}</span>
          ))}
        </div>
      ),
    },
  ], [suites, pinName]);

  const createMutation = useMutation({
    mutationFn: async (data: { tc: FormData; steps: StepDraft[] }) => {
      const res = await apiRequest("POST", "/api/tm/cases", { ...data.tc, projectId: activeProjectId });
      const tc: TmTestCase = await res.json();
      if (data.steps.length > 0) {
        await apiRequest("POST", `/api/tm/cases/${tc.id}/steps/bulk`, data.steps);
      }
      return tc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cases"] });
      setDialogOpen(false);
      toast({ title: "Test case created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; tc: Partial<FormData>; steps: StepDraft[] }) => {
      const tc = await apiRequest("PATCH", `/api/tm/cases/${data.id}`, data.tc);
      await apiRequest("POST", `/api/tm/cases/${data.id}/steps/bulk`, data.steps);
      return tc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cases"] });
      setDialogOpen(false);
      toast({ title: "Test case updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const patchFieldMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/tm/cases/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tm/cases"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tm/cases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cases"] });
      toast({ title: "Test case deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createRunMutation = useMutation({
    mutationFn: async ({ name, startDate, caseIds }: { name: string; startDate: string; caseIds: number[] }) => {
      const runRes = await apiRequest("POST", "/api/tm/runs", {
        name,
        projectId: activeProjectId,
        status: "in_progress",
        startDate: startDate || null,
      });
      const run = await runRes.json() as { id: number };
      if (caseIds.length > 0) {
        await apiRequest("POST", `/api/tm/runs/${run.id}/results`, { caseIds });
      }
      return run;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/cycles"] });
      setRunModalOpen(false);
      setRunName("");
      setRunStartDate("");
      setRunCaseIds(new Set());
      toast({ title: "Test run created", description: `${runCaseIds.size} case${runCaseIds.size !== 1 ? "s" : ""} added to run` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openRunModal() {
    setRunCaseIds(new Set(filtered.map(tc => tc.id)));
    setRunName(`Run — ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`);
    setRunStartDate(new Date().toISOString().slice(0, 10));
    setRunModalOpen(true);
  }

  function toggleRunCase(id: number) {
    setRunCaseIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function openEdit(tc: TmTestCase) {
    const caseId = tc.id;
    setEditing(tc);
    setTagInput("");
    setForm({
      title: tc.title,
      description: tc.description ?? "",
      preconditions: tc.preconditions ?? "",
      priority: tc.priority ?? "medium",
      status: tc.status ?? "draft",
      caseType: tc.caseType ?? "manual",
      suiteId: tc.suiteId ?? null,
      estimatedDuration: tc.estimatedDuration ?? null,
      tags: (tc.tags as string[]) ?? [],
    });
    setDialogOpen(true);
    const stepsRes = await apiRequest("GET", `/api/tm/cases/${caseId}/steps`);
    const fetchedSteps: TmTestStep[] = await stepsRes.json();
    setEditing((current) => {
      if (current?.id === caseId) {
        setSteps(fetchedSteps.map(s => ({ action: s.action, expectedResult: s.expectedResult ?? "", testData: s.testData ?? "" })));
      }
      return current;
    });
  }

  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setSteps([]);
    setTagInput("");
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.title.trim()) return;
    if (editing) {
      updateMutation.mutate({ id: editing.id, tc: form, steps });
    } else {
      createMutation.mutate({ tc: form, steps });
    }
  }

  function addStep() {
    setSteps(s => [...s, { action: "", expectedResult: "", testData: "" }]);
  }

  function updateStep(i: number, field: keyof StepDraft, value: string) {
    setSteps(s => s.map((step, idx) => idx === i ? { ...step, [field]: value } : step));
  }

  function removeStep(i: number) {
    setSteps(s => s.filter((_, idx) => idx !== i));
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t] }));
    }
    setTagInput("");
  }

  function removeTag(t: string) {
    setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));
  }

  return (
    <TmScreenShell
      loading={isLoading}
      error={firstError}
      onRetry={() => {
        void suitesQuery.refetch();
        void casesQuery.refetch();
      }}
      label="Loading test cases..."
    >
      <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Test Cases</h2>
          <p className="text-sm text-muted-foreground">Define and manage individual test cases with steps</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openRunModal} data-testid="button-start-run" className="gap-2">
            <Play className="h-4 w-4" /> Start Test Cycle
          </Button>
          <Button onClick={openCreate} data-testid="button-create-case">
            <Plus className="h-4 w-4 mr-2" /> New Test Case
          </Button>
        </div>
      </div>

      <MondayBoardShell.Legacy
        storageKey="jiganto-tm-test-cases"
        entityType="test_case"
        stateHook={useMondayBoardShellState}
        filterMatcher={matchBoardFilterValue}
      >
      <MondayBoardShell.Toolbar
        newLabel="New Test Case"
        onNew={openCreate}
        newTestId="button-create-case"
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchTestId="input-search-cases"
        filterActive={filterSuite != null || filterPriority !== "all" || filterStatus !== "all"}
        filterCount={(filterSuite != null ? 1 : 0) + (filterPriority !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0)}
        filterContent={
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Suite</Label>
              <Select value={filterSuite?.toString() ?? "all"} onValueChange={(v) => setFilterSuite(v === "all" ? null : Number(v))}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-filter-suite">
                  <SelectValue placeholder="All Suites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suites</SelectItem>
                  {suites.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-filter-priority">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-filter-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        afterNewSlot={
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={openRunModal} data-testid="button-start-run">
            <Play className="h-3.5 w-3.5" /> Start Test Cycle
          </Button>
        }
        pinActive={pinName}
        onPinToggle={() => {
          setPinName((v) => {
            const next = !v;
            localStorage.setItem("tm-cases-pin-title", next ? "1" : "0");
            return next;
          });
        }}
        pinTitle={pinName ? "Unpin Title column" : "Pin Title column"}
        onExport={() => {
          const headers = ["Title", "Suite", "Priority", "Status", "Type", "Tags"];
          const rows = filtered.map((tc) => [
            tc.title || "",
            suiteName(tc.suiteId ?? null),
            tc.priority || "",
            tc.status || "",
            tc.caseType || "",
            ((tc.tags as string[]) ?? []).join("|"),
          ]);
          downloadBoardCsv(`test-cases-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
          toast({ title: "Test cases exported to CSV" });
        }}
        onDownloadTemplate={() => {
          const headers = ["Title", "Suite", "Priority", "Status", "Type", "Tags"];
          downloadImportTemplateCsv("test-cases-import-template.csv", headers, headers.map(() => ""));
          toast({ title: "Import template downloaded" });
        }}
        onPaste={() => toast({ title: "Import is not available for this table yet" })}
        onImport={() => toast({ title: "Import is not available for this table yet" })}
        testId="test-cases-toolbar"
      />

      {/* Table */}
      <MondayBoardShell.Table
        columns={mondayColumns}
        data={filtered}
        gridLines
        emptyMessage={allCases.length === 0 ? "No test cases yet. Create your first one to get started." : "No test cases match your filters."}
        addItemLabel="New Test Case"
        onAddItem={openCreate}
        onEditItem={openEdit}
        onCellEdit={(rowId, columnId, value) => {
          patchFieldMutation.mutate({
            id: Number(rowId),
            payload: { [columnId]: value === "" ? null : value },
          });
        }}
        searchHighlightTerm={debouncedSearch}
        columnWidthStorageKey="jiganto-tm-test-cases-col-widths"
        paginationResetKey={`${filterSuite}-${filterPriority}-${filterStatus}-${debouncedSearch}`}
        alwaysShowRowActions
        renderRowActions={(tc) => (
          <div className="flex items-center gap-1 justify-end">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40" onClick={() => openEdit(tc)} data-testid={`button-edit-case-${tc.id}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40" onClick={() => {
              if (!window.confirm("Delete this test case?")) return;
              deleteMutation.mutate(tc.id);
            }} data-testid={`button-delete-case-${tc.id}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      />
      </MondayBoardShell.Legacy>

      {/* Case Dialog */}
      <FormDialogShell
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit Test Case" : "New Test Case"}
        saveLabel={editing ? "Save Changes" : "Create Test Case"}
        onCancel={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        saving={createMutation.isPending || updateMutation.isPending}
        disabled={!form.title.trim()}
        saveTestId="button-submit-case"
        size="xl"
      >
          <FormSection title="Case details">
          <div className="space-y-5">

            {/* Title */}
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Verify user can login with valid credentials"
                data-testid="input-case-title"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What does this test case verify?"
                rows={2}
                data-testid="input-case-description"
              />
            </div>

            {/* Preconditions */}
            <div>
              <label className="text-sm font-medium mb-1 block">Preconditions</label>
              <Textarea
                value={form.preconditions}
                onChange={e => setForm(f => ({ ...f, preconditions: e.target.value }))}
                placeholder="What must be true before this test can run?"
                rows={2}
                data-testid="input-case-preconditions"
              />
            </div>

            {/* Row: Suite, Priority, Status, Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Suite</label>
                <select
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.suiteId ?? ""}
                  onChange={e => setForm(f => ({ ...f, suiteId: e.target.value ? Number(e.target.value) : null }))}
                  data-testid="select-case-suite"
                >
                  <option value="">— No suite —</option>
                  {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Priority</label>
                <select
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  data-testid="select-case-priority"
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <select
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  data-testid="select-case-status"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <select
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.caseType}
                  onChange={e => setForm(f => ({ ...f, caseType: e.target.value }))}
                  data-testid="select-case-type"
                >
                  {CASE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
            </div>

            {/* Est. Duration */}
            <div>
              <label className="text-sm font-medium mb-1 block">Estimated Duration (minutes)</label>
              <Input
                type="number"
                min={1}
                value={form.estimatedDuration ?? ""}
                onChange={e => setForm(f => ({ ...f, estimatedDuration: e.target.value ? Number(e.target.value) : null }))}
                placeholder="e.g. 15"
                className="max-w-[160px]"
                data-testid="input-case-duration"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium mb-1 block">Tags</label>
              <div className="flex gap-2 flex-wrap mb-2">
                {form.tags.map(t => (
                  <span key={t} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {t}
                    <button type="button" onClick={() => removeTag(t)} className="hover:text-destructive" data-testid={`tag-remove-${t}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Add tag and press Enter"
                  className="max-w-[240px]"
                  data-testid="input-tag"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag} data-testid="button-add-tag">Add</Button>
              </div>
            </div>

            {/* Test Steps */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Test Steps</label>
                <Button type="button" variant="outline" size="sm" onClick={addStep} data-testid="button-add-step">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Step
                </Button>
              </div>
              {steps.length === 0 ? (
                <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
                  No steps yet. Add steps to define how this test should be executed.
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <div key={i} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30" data-testid={`step-row-${i}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-6 text-center">{i + 1}</span>
                        <span className="text-xs font-medium flex-1">Action</span>
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeStep(i)} data-testid={`button-remove-step-${i}`}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <Textarea
                        value={step.action}
                        onChange={e => updateStep(i, "action", e.target.value)}
                        placeholder="Describe the action to perform..."
                        rows={2}
                        className="text-sm"
                        data-testid={`input-step-action-${i}`}
                      />
                      <div className="text-xs font-medium">Expected Result</div>
                      <Textarea
                        value={step.expectedResult}
                        onChange={e => updateStep(i, "expectedResult", e.target.value)}
                        placeholder="What should happen after this action?"
                        rows={2}
                        className="text-sm"
                        data-testid={`input-step-expected-${i}`}
                      />
                      <div className="text-xs font-medium">Test Data (optional)</div>
                      <Input
                        value={step.testData}
                        onChange={e => updateStep(i, "testData", e.target.value)}
                        placeholder="Specific data to use for this step"
                        className="text-sm"
                        data-testid={`input-step-data-${i}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
          </FormSection>
      </FormDialogShell>

      {/* ── Start Test Cycle Modal ── */}
      <FormDialogShell
        open={runModalOpen}
        onOpenChange={setRunModalOpen}
        title="Start Test Cycle"
        saveLabel={`Create Run (${runCaseIds.size} cases)`}
        onCancel={() => setRunModalOpen(false)}
        onSubmit={() => createRunMutation.mutate({ name: runName, startDate: runStartDate, caseIds: Array.from(runCaseIds) })}
        saving={createRunMutation.isPending}
        disabled={!runName.trim() || runCaseIds.size === 0}
        saveTestId="btn-confirm-run"
        size="lg"
      >
          <FormSection title="Run setup">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Run Name</label>
              <input className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                value={runName} onChange={e => setRunName(e.target.value)}
                placeholder="Enter run name…" data-testid="input-run-name" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Date</label>
              <input type="date" className="mt-1 w-full border border-border rounded px-3 py-2 text-sm bg-background"
                value={runStartDate} onChange={e => setRunStartDate(e.target.value)}
                data-testid="input-run-date" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Test Cases ({runCaseIds.size} selected)
                </label>
                <div className="flex gap-2">
                  <button className="text-xs text-primary hover:underline" onClick={() => setRunCaseIds(new Set(filtered.map(tc => tc.id)))}>All</button>
                  <button className="text-xs text-muted-foreground hover:underline" onClick={() => setRunCaseIds(new Set())}>None</button>
                </div>
              </div>
              <div className="border border-border rounded-lg max-h-52 overflow-y-auto divide-y divide-border/50">
                {filtered.map(tc => (
                  <label key={tc.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40">
                    <input type="checkbox" checked={runCaseIds.has(tc.id)}
                      onChange={() => toggleRunCase(tc.id)} className="rounded flex-shrink-0"
                      data-testid={`run-case-check-${tc.id}`} />
                    <span className="text-xs flex-1 truncate">{tc.title}</span>
                    <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded capitalize flex-shrink-0", {
                      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400": tc.priority === "critical",
                      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400": tc.priority === "high",
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400": tc.priority === "medium",
                      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400": tc.priority === "low",
                    })}>{tc.priority}</span>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">No test cases match current filters</div>
                )}
              </div>
            </div>
          </div>
          </FormSection>
      </FormDialogShell>
      </div>
    </TmScreenShell>
  );
}
