import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel } from "@/components/ui/form-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { Label } from "@/components/ui/label";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import { matchBoardFilterValue } from "@/lib/board-filters";
import { useDebouncedValue, downloadBoardCsv, downloadImportTemplateCsv } from "@/lib/crm-monday-chrome";
import {
  FinanceTableSkeleton,
  FinanceEmptyState,
} from "./FinanceUi";
import type { BudgetDetail, BudgetListItem } from "./types";

function parseMoney(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function computeRag(actual: number, budget: number): "green" | "amber" | "red" {
  if (budget <= 0) return "green";
  const pct = actual / budget;
  if (pct > 0.95) return "red";
  if (pct > 0.8) return "amber";
  return "green";
}

function ragBadge(status?: "green" | "amber" | "red") {
  if (status === "red") return <Badge variant="destructive">Red</Badge>;
  if (status === "amber") return <Badge className="bg-amber-500 hover:bg-amber-500">Amber</Badge>;
  return <Badge className="bg-emerald-500 hover:bg-emerald-500">Green</Badge>;
}

function formatCurrency(v: string | number | null | undefined, currency = "GBP") {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  return `${sym}${Number.isFinite(n) ? n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "0"}`;
}

interface FinanceBudgetsTabProps {
  budgets?: BudgetListItem[];
  isLoading?: boolean;
  searchTerm?: string;
  filterProjectId?: number | null;
}

type EnrichedBudget = BudgetListItem & { ragStatus: "green" | "amber" | "red"; marginPct: number };

export function FinanceBudgetsTab({ budgets: budgetsProp, isLoading: isLoadingProp, searchTerm = "", filterProjectId = null }: FinanceBudgetsTabProps) {
  const { toast } = useToast();
  const [localSearch, setLocalSearch] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm || localSearch);
  const [ragFilter, setRagFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImportPlan, setShowImportPlan] = useState(false);
  const [importPlanId, setImportPlanId] = useState("");
  const [pinProject, setPinProject] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("finance-budgets-pin-project") !== "0";
  });
  const [newProjectId, setNewProjectId] = useState("");
  const [newContractType, setNewContractType] = useState("fixed_price");
  const [newLabourBudget, setNewLabourBudget] = useState("");
  const [newExpenseBudget, setNewExpenseBudget] = useState("");

  const resetCreateForm = () => {
    setNewProjectId("");
    setNewContractType("fixed_price");
    setNewLabourBudget("");
    setNewExpenseBudget("");
  };

  const { data: projects = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/pm/projects"],
    staleTime: 60_000,
  });

  const { data: planSummaries = [] } = useQuery<Array<{
    opportunityId: number;
    primaryPlanId: number;
    primaryPlanName: string | null;
    totalCost: number;
    currency: string;
    rowCount: number;
  }>>({
    queryKey: ["/api/crm/resource-plans/summaries"],
    enabled: showImportPlan,
    staleTime: 30_000,
  });

  const { data: importPreview } = useQuery<{
    planId: number;
    opportunityName: string | null;
    projectId: number | null;
    labourTotal: number;
    rowCount: number;
    existingBudgetId: number | null;
  }>({
    queryKey: importPlanId ? [`/api/finance/budgets/from-resource-plan/${importPlanId}/preview`] : ["/api/finance/budgets/from-resource-plan/0/preview?disabled"],
    enabled: showImportPlan && !!importPlanId,
    staleTime: 10_000,
  });

  const importPlanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/finance/budgets/from-resource-plan", {
        planId: Number(importPlanId),
        projectId: importPreview?.projectId ?? undefined,
      });
      return res.json() as Promise<{ id: number; projectId: number }>;
    },
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/budgets"] });
      toast({ title: "Budget imported from CRM resource plan" });
      setShowImportPlan(false);
      setImportPlanId("");
      setSelectedId(budget.id);
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/finance/budgets", {
      projectId: Number(newProjectId),
      contractType: newContractType,
      labourBudget: newLabourBudget || "0",
      expenseBudget: newExpenseBudget || "0",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/budgets"] });
      toast({ title: "Budget created" });
      setShowCreate(false);
      resetCreateForm();
    },
    onError: () => toast({ title: "Failed to create budget", variant: "destructive" }),
  });

  const recalculateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/finance/budgets/${id}/recalculate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/budgets"] });
      if (selectedId != null) queryClient.invalidateQueries({ queryKey: [`/api/finance/budgets/${selectedId}`] });
      toast({ title: "Budget recalculated from live data" });
    },
    onError: () => toast({ title: "Recalculation failed", variant: "destructive" }),
  });

  const { data: fetchedBudgets = [], isLoading: fetchLoading } = useQuery<BudgetListItem[]>({
    queryKey: ["/api/finance/budgets"],
    enabled: budgetsProp === undefined,
    staleTime: 30_000,
  });
  const budgets = budgetsProp ?? fetchedBudgets;
  const isLoading = isLoadingProp ?? fetchLoading;

  const { data: detail, isLoading: detailLoading } = useQuery<BudgetDetail>({
    queryKey: [`/api/finance/budgets/${selectedId}`],
    enabled: selectedId != null,
    staleTime: 30_000,
  });

  const enrichedBudgets = useMemo(() =>
    budgets.map((b) => {
      const actual = parseMoney(b.actualCost);
      const total = parseMoney(b.totalBudget);
      const revenue = parseMoney(b.contractValue);
      const marginPct = revenue > 0 ? Math.round(((revenue - actual) / revenue) * 100) : 0;
      return {
        ...b,
        ragStatus: computeRag(actual, total),
        marginPct,
      };
    }),
  [budgets]);

  const filteredBudgets = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return enrichedBudgets.filter((b) => {
      if (filterProjectId != null && b.projectId !== filterProjectId) return false;
      if (ragFilter !== "all" && b.ragStatus !== ragFilter) return false;
      if (contractFilter !== "all" && b.contractType !== contractFilter) return false;
      if (q && !`${b.projectName ?? ""} ${b.clientName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enrichedBudgets, debouncedSearch, ragFilter, contractFilter, filterProjectId]);

  const mondayColumns: MondayColumnDef<EnrichedBudget>[] = useMemo(() => [
    {
      id: "project",
      header: "Project",
      type: "text",
      accessor: (row) => row.projectName,
      width: "200px",
      sticky: pinProject,
      editable: false,
      render: (b) => <span className="font-medium">{b.projectName ?? `Project #${b.projectId}`}</span>,
    },
    {
      id: "client",
      header: "Client",
      type: "text",
      accessor: (row) => row.clientName || "",
      width: "160px",
      editable: false,
      render: (b) => <span className="text-sm">{b.clientName ?? "—"}</span>,
    },
    {
      id: "type",
      header: "Type",
      type: "status",
      accessor: "contractType",
      width: "130px",
      editable: true,
      options: [
        { value: "fixed_price", label: "Fixed price", color: "bg-[#579bfc] text-white" },
        { value: "time_materials", label: "Time & materials", color: "bg-[#00c875] text-white" },
        { value: "retainer", label: "Retainer", color: "bg-[#a25ddc] text-white" },
        { value: "mixed", label: "Mixed", color: "bg-[#fdab3d] text-white" },
      ],
      render: (b) => <Badge variant="outline" className="capitalize">{b.contractType.replace(/_/g, " ")}</Badge>,
    },
    {
      id: "budget",
      header: "Budget",
      type: "currency",
      accessor: "totalBudget",
      width: "120px",
      editable: false,
      render: (b) => <span className="text-sm tabular-nums">{formatCurrency(b.totalBudget, b.budgetCurrency)}</span>,
    },
    {
      id: "actual",
      header: "Actual",
      type: "currency",
      accessor: "actualCost",
      width: "120px",
      editable: false,
      render: (b) => <span className="text-sm tabular-nums">{formatCurrency(b.actualCost, b.budgetCurrency)}</span>,
    },
    {
      id: "margin",
      header: "Margin",
      type: "number",
      accessor: (row) => row.marginPct,
      width: "110px",
      editable: false,
      render: (b) => (
        <span className={cn("inline-flex items-center gap-1 text-sm tabular-nums", (b.marginPct ?? 0) >= 0 ? "text-emerald-600" : "text-red-500")}>
          {(b.marginPct ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {b.marginPct ?? 0}%
        </span>
      ),
    },
    {
      id: "rag",
      header: "RAG",
      type: "status",
      accessor: "ragStatus",
      width: "100px",
      editable: false,
      render: (b) => ragBadge(b.ragStatus),
    },
  ], [pinProject]);

  const updateBudgetMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/finance/budgets/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/finance/budgets"] }),
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (filterProjectId == null || selectedId != null) return;
    const match = enrichedBudgets.find((b) => b.projectId === filterProjectId);
    if (match) setSelectedId(match.id);
  }, [filterProjectId, enrichedBudgets, selectedId]);

  const paginationResetKey = `${debouncedSearch}|${ragFilter}|${contractFilter}|${filterProjectId}`;

  const BUDGET_CSV_HEADERS = ["Project", "Client", "Type", "Budget", "Actual", "Margin", "RAG"];

  const exportBudgets = () => {
    const rows = filteredBudgets.map((b) => [
      b.projectName ?? `Project #${b.projectId}`,
      b.clientName ?? "",
      b.contractType.replace(/_/g, " "),
      String(b.totalBudget ?? ""),
      String(b.actualCost ?? ""),
      `${b.marginPct ?? 0}%`,
      b.ragStatus,
    ]);
    downloadBoardCsv(`budgets-${new Date().toISOString().split("T")[0]}.csv`, BUDGET_CSV_HEADERS, rows);
    toast({ title: "Budgets exported to CSV" });
  };

  const downloadBudgetsTemplate = () => {
    downloadImportTemplateCsv("budgets-import-template.csv", BUDGET_CSV_HEADERS, BUDGET_CSV_HEADERS.map(() => ""));
    toast({ title: "Import template downloaded" });
  };

  return (
    <div className="space-y-4" data-testid="finance-budgets-tab">
      <MondayBoardShell.Legacy
        storageKey="jiganto-finance-budgets"
        entityType="finance_budget"
        stateHook={useMondayBoardShellState}
        filterMatcher={matchBoardFilterValue}
      >
      <MondayBoardShell.Toolbar
        newLabel="New Budget"
        onNew={() => setShowCreate(true)}
        searchValue={localSearch || searchTerm}
        onSearchChange={setLocalSearch}
        filterActive={ragFilter !== "all" || contractFilter !== "all"}
        filterCount={(ragFilter !== "all" ? 1 : 0) + (contractFilter !== "all" ? 1 : 0)}
        filterContent={
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">RAG status</Label>
              <Select value={ragFilter} onValueChange={setRagFilter}>
                <SelectTrigger className="h-8 text-xs" data-testid="filter-rag">
                  <SelectValue placeholder="RAG status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All RAG</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="amber">Amber</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contract type</Label>
              <Select value={contractFilter} onValueChange={setContractFilter}>
                <SelectTrigger className="h-8 text-xs" data-testid="filter-contract">
                  <SelectValue placeholder="Contract type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="fixed_price">Fixed price</SelectItem>
                  <SelectItem value="time_materials">T&amp;M</SelectItem>
                  <SelectItem value="retainer">Retainer</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        pinActive={pinProject}
        onPinToggle={() => {
          setPinProject((v) => {
            const next = !v;
            localStorage.setItem("finance-budgets-pin-project", next ? "1" : "0");
            return next;
          });
        }}
        pinTitle={pinProject ? "Unpin Project column" : "Pin Project column"}
        onExport={exportBudgets}
        onDownloadTemplate={downloadBudgetsTemplate}
        onPaste={() => setShowImportPlan(true)}
        onImport={() => setShowImportPlan(true)}
        moreMenuItems={
          <DropdownMenuItem onClick={() => setShowImportPlan(true)} data-testid="button-import-resource-plan-budget">
            Import CRM plan
          </DropdownMenuItem>
        }
        testId="finance-budgets-toolbar"
      />

      {isLoading ? (
        <FinanceTableSkeleton rows={8} cols={7} />
      ) : filteredBudgets.length === 0 ? (
        <FinanceEmptyState
          icon={budgets.length === 0 ? Wallet : Search}
          title={budgets.length === 0 ? "No project budgets yet" : "No budgets match your filters"}
          description={budgets.length === 0 ? "Create a budget to track labour, expenses, and margins per project." : "Try adjusting your search or filter criteria."}
          action={budgets.length === 0 ? (
            <div className="flex flex-wrap gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={() => setShowImportPlan(true)}>Import CRM plan</Button>
              <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> New Budget</Button>
            </div>
          ) : undefined}
        />
      ) : (
        <MondayBoardShell.Table
          columns={mondayColumns}
          data={filteredBudgets}
          emptyMessage="No budgets match your filters."
          addItemLabel="New Budget"
          onAddItem={() => setShowCreate(true)}
          onRowClick={(b) => setSelectedId(b.id)}
          onCellEdit={(rowId, columnId, value) => {
            const field = columnId === "type" ? "contractType" : columnId;
            updateBudgetMut.mutate({
              id: Number(rowId),
              payload: { [field]: value === "" ? null : value },
            });
          }}
          searchHighlightTerm={debouncedSearch}
          columnWidthStorageKey="jiganto-finance-budgets-col-widths"
          paginationResetKey={paginationResetKey}
          totalCount={budgets.length}
        />
      )}
      </MondayBoardShell.Legacy>

      <Sheet open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="budget-detail-drawer">
          <SheetHeader>
            <SheetTitle>{detail?.projectName ?? "Budget Detail"}</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : detail ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Contract value</span><p className="font-medium">{formatCurrency(detail.contractValue, detail.budgetCurrency)}</p></div>
                <div><span className="text-muted-foreground">Total budget</span><p className="font-medium">{formatCurrency(detail.totalBudget, detail.budgetCurrency)}</p></div>
                <div><span className="text-muted-foreground">Actual cost</span><p className="font-medium">{formatCurrency(detail.actualCost, detail.budgetCurrency)}</p></div>
                <div><span className="text-muted-foreground">RAG</span><div className="mt-0.5">{ragBadge(computeRag(parseMoney(detail.actualCost), parseMoney(detail.totalBudget)))}</div></div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={recalculateMutation.isPending}
                  onClick={() => selectedId != null && recalculateMutation.mutate(selectedId)}
                >
                  {recalculateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Recalculate actuals
                </Button>
              </div>

              <Tabs defaultValue="labour">
                <TabsList className="w-full flex flex-wrap h-auto gap-1">
                  <TabsTrigger value="labour">Labour</TabsTrigger>
                  <TabsTrigger value="expense">Expense</TabsTrigger>
                  <TabsTrigger value="milestone">Milestones</TabsTrigger>
                  <TabsTrigger value="revenue">Revenue</TabsTrigger>
                  <TabsTrigger value="forecast">Forecast</TabsTrigger>
                </TabsList>

                <TabsContent value="labour" className="mt-3">
                  <ScrollArea className="h-[280px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role</TableHead>
                          <TableHead>Phase</TableHead>
                          <TableHead className="text-right">Days</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detail.labourLines ?? []).map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>{l.roleName}</TableCell>
                            <TableCell>{l.phase ?? "—"}</TableCell>
                            <TableCell className="text-right">{l.actualDays ?? l.budgetedDays}</TableCell>
                            <TableCell className="text-right">{formatCurrency(l.actualCost ?? l.budgetedCost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="expense" className="mt-3">
                  <ScrollArea className="h-[280px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Budgeted</TableHead>
                          <TableHead className="text-right">Actual</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detail.expenseLines ?? []).map((e) => (
                          <TableRow key={e.id}>
                            <TableCell>{e.category}</TableCell>
                            <TableCell className="text-right">{formatCurrency(e.budgetedAmount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(e.actualAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="milestone" className="mt-3">
                  <ScrollArea className="h-[280px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detail.milestoneLines ?? []).map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>{m.name}</TableCell>
                            <TableCell>{m.dueDate ?? "—"}</TableCell>
                            <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                            <TableCell className="text-right">{formatCurrency(m.value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="revenue" className="mt-3">
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div><span className="text-muted-foreground">Contract</span><p className="font-medium">{formatCurrency(detail.contractValue, detail.budgetCurrency)}</p></div>
                      <div><span className="text-muted-foreground">Billed to date</span><p className="font-medium">{formatCurrency(detail.billedToDate, detail.budgetCurrency)}</p></div>
                      <div><span className="text-muted-foreground">Remaining</span><p className="font-medium">{formatCurrency(parseMoney(detail.contractValue) - parseMoney(detail.billedToDate), detail.budgetCurrency)}</p></div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="forecast" className="mt-3">
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div><span className="text-muted-foreground">Forecast cost</span><p className="font-medium">{formatCurrency(detail.forecastCost ?? detail.actualCost, detail.budgetCurrency)}</p></div>
                      <div><span className="text-muted-foreground">Actual cost</span><p className="font-medium">{formatCurrency(detail.actualCost, detail.budgetCurrency)}</p></div>
                      <div><span className="text-muted-foreground">Target margin</span><p className="font-medium">{detail.targetMarginPct ?? "—"}%</p></div>
                      <div><span className="text-muted-foreground">EVM enabled</span><p className="font-medium">{detail.evmEnabled ? "Yes" : "No"}</p></div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <FormDialogShell
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) resetCreateForm();
        }}
        title="Create project budget"
        subtitle="Set labour and expense budgets for a project"
        saveLabel="Create budget"
        onCancel={() => { setShowCreate(false); resetCreateForm(); }}
        onSubmit={() => createMutation.mutate()}
        saving={createMutation.isPending}
        disabled={!newProjectId}
      >
        <FormSection icon={<Wallet className="h-3.5 w-3.5 text-blue-600" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Budget setup">
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel required>Project</FieldLabel>
            <Select value={newProjectId} onValueChange={setNewProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel>Contract type</FieldLabel>
            <Select value={newContractType} onValueChange={setNewContractType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed_price">Fixed price</SelectItem>
                <SelectItem value="time_materials">Time &amp; materials</SelectItem>
                <SelectItem value="retainer">Retainer</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <FieldGrid>
            <div className="space-y-1.5">
              <FieldLabel>Labour budget</FieldLabel>
              <Input type="number" value={newLabourBudget} onChange={(e) => setNewLabourBudget(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Expense budget</FieldLabel>
              <Input type="number" value={newExpenseBudget} onChange={(e) => setNewExpenseBudget(e.target.value)} />
            </div>
          </FieldGrid>
        </FormSection>
      </FormDialogShell>

      <FormDialogShell
        open={showImportPlan}
        onOpenChange={(open) => {
          setShowImportPlan(open);
          if (!open) setImportPlanId("");
        }}
        title="Import from CRM resource plan"
        subtitle="Create a project budget from an opportunity staffing plan"
        saveLabel="Import budget"
        onCancel={() => { setShowImportPlan(false); setImportPlanId(""); }}
        onSubmit={() => importPlanMutation.mutate()}
        saving={importPlanMutation.isPending}
        disabled={!importPlanId || !!importPreview?.existingBudgetId || !importPreview?.projectId}
        testId="budget-import-plan-dialog"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <FieldLabel required>Resource plan</FieldLabel>
            <Select value={importPlanId} onValueChange={setImportPlanId}>
              <SelectTrigger><SelectValue placeholder="Select CRM resource plan" /></SelectTrigger>
              <SelectContent>
                {planSummaries.map((s) => (
                  <SelectItem key={s.primaryPlanId} value={String(s.primaryPlanId)}>
                    Plan #{s.primaryPlanId}{s.primaryPlanName ? ` — ${s.primaryPlanName}` : ""} · {s.rowCount} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {importPreview && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Opportunity:</span> {importPreview.opportunityName ?? "—"}</p>
              <p><span className="text-muted-foreground">Labour total:</span> £{importPreview.labourTotal.toLocaleString()}</p>
              <p><span className="text-muted-foreground">Rows:</span> {importPreview.rowCount}</p>
              {!importPreview.projectId && (
                <p className="text-amber-600 text-xs">Convert the opportunity to a project before importing.</p>
              )}
              {importPreview.existingBudgetId && (
                <p className="text-destructive text-xs">A budget already exists for this project.</p>
              )}
            </div>
          )}
        </div>
      </FormDialogShell>
    </div>
  );
}
