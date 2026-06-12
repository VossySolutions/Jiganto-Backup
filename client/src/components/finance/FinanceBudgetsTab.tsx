import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { FinanceTableSkeleton, FinanceEmptyState, FinanceTableWrap, FinanceButtonSpinner } from "./FinanceUi";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
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
}

export function FinanceBudgetsTab({ budgets: budgetsProp, isLoading: isLoadingProp, searchTerm = "" }: FinanceBudgetsTabProps) {
  const { toast } = useToast();
  const [ragFilter, setRagFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newContractType, setNewContractType] = useState("fixed_price");
  const [newLabourBudget, setNewLabourBudget] = useState("");
  const [newExpenseBudget, setNewExpenseBudget] = useState("");

  const { data: projects = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/pm/projects"],
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
    },
    onError: () => toast({ title: "Failed to create budget", variant: "destructive" }),
  });

  const { data: fetchedBudgets = [], isLoading: fetchLoading } = useQuery<BudgetListItem[]>({
    queryKey: ["/api/finance/budgets"],
    enabled: budgetsProp === undefined,
  });
  const budgets = budgetsProp ?? fetchedBudgets;
  const isLoading = isLoadingProp ?? fetchLoading;

  const { data: detail, isLoading: detailLoading } = useQuery<BudgetDetail>({
    queryKey: [`/api/finance/budgets/${selectedId}`],
    enabled: selectedId != null,
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
    const q = searchTerm.toLowerCase();
    return enrichedBudgets.filter((b) => {
      if (ragFilter !== "all" && b.ragStatus !== ragFilter) return false;
      if (contractFilter !== "all" && b.contractType !== contractFilter) return false;
      if (q && !`${b.projectName ?? ""} ${b.clientName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enrichedBudgets, searchTerm, ragFilter, contractFilter]);

  const pagination = useTablePagination(filteredBudgets, {
    resetKey: `${searchTerm}-${ragFilter}-${contractFilter}`,
  });

  return (
    <div className="space-y-4" data-testid="finance-budgets-tab">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <Select value={ragFilter} onValueChange={setRagFilter}>
          <SelectTrigger className="w-[140px]" data-testid="filter-rag">
            <SelectValue placeholder="RAG status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All RAG</SelectItem>
            <SelectItem value="green">Green</SelectItem>
            <SelectItem value="amber">Amber</SelectItem>
            <SelectItem value="red">Red</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-[160px]" data-testid="filter-contract">
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
        <span className="text-sm text-muted-foreground">{filteredBudgets.length} budgets</span>
        <Button size="sm" className="sm:ml-auto w-full sm:w-auto" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Budget
        </Button>
      </div>

      {isLoading ? (
        <FinanceTableSkeleton rows={8} cols={7} />
      ) : filteredBudgets.length === 0 ? (
        <FinanceEmptyState
          icon={budgets.length === 0 ? Wallet : Search}
          title={budgets.length === 0 ? "No project budgets yet" : "No budgets match your filters"}
          description={budgets.length === 0 ? "Create a budget to track labour, expenses, and margins per project." : "Try adjusting your search or filter criteria."}
          action={budgets.length === 0 ? (
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> New Budget</Button>
          ) : undefined}
        />
      ) : (
        <Card className="rounded-xl border-border/50 overflow-hidden shadow-sm">
          <FinanceTableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>RAG</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map((b) => (
                  <TableRow
                    key={b.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedId(b.id)}
                    data-testid={`budget-row-${b.id}`}
                  >
                    <TableCell className="font-medium">{b.projectName ?? `Project #${b.projectId}`}</TableCell>
                    <TableCell>{b.clientName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{b.contractType.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(b.totalBudget, b.budgetCurrency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(b.actualCost, b.budgetCurrency)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={cn("inline-flex items-center gap-1", (b.marginPct ?? 0) >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {(b.marginPct ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {b.marginPct ?? 0}%
                      </span>
                    </TableCell>
                    <TableCell>{ragBadge(b.ragStatus)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </FinanceTableWrap>
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </Card>
      )}

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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Project Budget</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contract type</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Labour budget</Label>
                <Input type="number" value={newLabourBudget} onChange={(e) => setNewLabourBudget(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expense budget</Label>
                <Input type="number" value={newExpenseBudget} onChange={(e) => setNewExpenseBudget(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newProjectId || createMutation.isPending}>
              {createMutation.isPending ? <FinanceButtonSpinner /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
