import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EXPENSE_CATEGORIES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel, FormDivider } from "@/components/ui/form-dialog-shell";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, CheckCircle2, XCircle, Receipt, Trash2 } from "lucide-react";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import { matchBoardFilterValue } from "@/lib/board-filters";
import { useDebouncedValue, downloadBoardCsv, downloadImportTemplateCsv } from "@/lib/crm-monday-chrome";
import { FinanceTableSkeleton, FinanceEmptyState, FinanceButtonSpinner } from "./FinanceUi";
import type { ExpenseReportRow } from "./types";
import type { ExpenseItem } from "@shared/schema";

type DraftExpenseLine = {
  key: string;
  itemDate: string;
  category: string;
  description: string;
  amount: string;
  isBillable: boolean;
  vatAmount: string;
  paymentMethod: string;
};

function makeDraftLine(): DraftExpenseLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemDate: new Date().toISOString().slice(0, 10),
    category: EXPENSE_CATEGORIES[0],
    description: "",
    amount: "",
    isBillable: true,
    vatAmount: "",
    paymentMethod: "personal_card",
  };
}

function statusBadge(status: string) {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline",
    submitted: "secondary",
    approved: "default",
    rejected: "destructive",
    paid: "default",
  };
  return <Badge variant={map[status] ?? "outline"} className="capitalize">{status}</Badge>;
}

function formatCurrency(v: string | number | null | undefined) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return `£${Number.isFinite(n) ? n.toLocaleString("en-GB", { minimumFractionDigits: 2 }) : "0.00"}`;
}

interface FinanceExpensesTabProps {
  reports?: ExpenseReportRow[];
  isLoading?: boolean;
  searchTerm?: string;
}

export function FinanceExpensesTab({ reports: reportsProp, isLoading: isLoadingProp, searchTerm = "" }: FinanceExpensesTabProps) {
  const { toast } = useToast();
  const [localSearch, setLocalSearch] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm || localSearch);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [pinName, setPinName] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("finance-expenses-pin-name") !== "0";
  });
  const receiptRef = useRef<HTMLInputElement>(null);

  const [formName, setFormName] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [draftLines, setDraftLines] = useState<DraftExpenseLine[]>([makeDraftLine()]);
  const [mileageDistance, setMileageDistance] = useState("");
  const [mileageVehicle, setMileageVehicle] = useState<"car" | "motorcycle" | "bicycle">("car");
  const [useMileage, setUseMileage] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [detailLine, setDetailLine] = useState(makeDraftLine());

  useEffect(() => {
    setDetailLine(makeDraftLine());
  }, [selectedReportId]);

  const { data: fetchedReports = [], isLoading: fetchLoading } = useQuery<ExpenseReportRow[]>({
    queryKey: ["/api/finance/expenses/reports"],
    enabled: reportsProp === undefined,
    staleTime: 30_000,
  });
  const reports = reportsProp ?? fetchedReports;
  const isLoading = isLoadingProp ?? fetchLoading;

  const { data: projects = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/pm/projects"],
    staleTime: 60_000,
  });

  const { data: reportDetail, isLoading: detailLoading } = useQuery<ExpenseReportRow>({
    queryKey: selectedReportId ? [`/api/finance/expenses/reports/${selectedReportId}`] : ["/api/finance/expenses/reports/0?disabled"],
    enabled: selectedReportId != null,
    staleTime: 10_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses/reports"] });
    if (selectedReportId != null) {
      queryClient.invalidateQueries({ queryKey: [`/api/finance/expenses/reports/${selectedReportId}`] });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/finance/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/budgets"] });
  };

  const updateDraftLine = (key: string, patch: Partial<DraftExpenseLine>) => {
    setDraftLines((lines) => lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const mileageMutation = useMutation({
    mutationFn: async () => {
      const dist = parseFloat(mileageDistance);
      if (!dist) throw new Error("Enter distance");
      const res = await apiRequest("POST", "/api/finance/expenses/mileage/calculate", {
        distance: dist,
        vehicleType: mileageVehicle,
      });
      return res.json() as Promise<{ amount: number }>;
    },
    onSuccess: (data) => {
      setDraftLines((lines) => {
        const next = lines.length ? [...lines] : [makeDraftLine()];
        next[0] = { ...next[0], amount: String(data.amount), category: "Travel" };
        return next;
      });
    },
    onError: () => toast({ title: "Failed to calculate mileage", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const items = draftLines
        .filter((line) => line.amount)
        .map((line) => {
          const isFirstLine = line.key === draftLines[0]?.key;
          return {
            itemDate: line.itemDate,
            category: line.category,
            description: line.description || formName,
            amount: line.amount,
            isBillable: line.isBillable,
            vatAmount: line.vatAmount || null,
            paymentMethod: line.paymentMethod,
            mileageDistance: useMileage && isFirstLine ? mileageDistance : null,
            mileageVehicleType: useMileage && isFirstLine ? mileageVehicle : null,
          };
        });
      const res = await apiRequest("POST", "/api/finance/expenses/reports", {
        name: formName,
        projectId: Number(formProjectId),
        currency: "GBP",
        items,
      });
      const report = await res.json() as { id: number; items?: ExpenseItem[] };
      const firstItemId = report.items?.[0]?.id;
      if (receiptFile && firstItemId) {
        const fd = new FormData();
        fd.append("receipt", receiptFile);
        const uploadRes = await fetch(`/api/finance/expenses/items/${firstItemId}/receipt`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!uploadRes.ok) {
          throw new Error("Receipt upload failed");
        }
      }
      return report;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Expense report created" });
      setShowCreate(false);
      resetForm();
    },
    onError: (err: Error) => toast({
      title: err.message === "Receipt upload failed" ? "Receipt upload failed" : "Failed to create expense report",
      variant: "destructive",
    }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/finance/expenses/reports/${id}/submit`),
    onSuccess: () => { invalidate(); toast({ title: "Report submitted for approval" }); },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/finance/expenses/reports/${id}/approve`),
    onSuccess: () => { invalidate(); toast({ title: "Expense report approved" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/finance/expenses/reports/${id}/reject`, { reason: "Needs revision" }),
    onSuccess: () => { invalidate(); toast({ title: "Expense report returned" }); },
  });

  const addItemMutation = useMutation({
    mutationFn: async (reportId: number) => {
      return apiRequest("POST", `/api/finance/expenses/reports/${reportId}/items`, {
        itemDate: detailLine.itemDate,
        category: detailLine.category,
        description: detailLine.description || reportDetail?.name || "Expense",
        amount: detailLine.amount,
        isBillable: detailLine.isBillable,
        vatAmount: detailLine.vatAmount || null,
        paymentMethod: detailLine.paymentMethod,
      });
    },
    onSuccess: () => {
      invalidate();
      setDetailLine(makeDraftLine());
      toast({ title: "Line item added" });
    },
    onError: () => toast({ title: "Failed to add line item", variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => apiRequest("DELETE", `/api/finance/expenses/items/${itemId}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Line item removed" });
    },
    onError: () => toast({ title: "Failed to remove line item", variant: "destructive" }),
  });

  const resetForm = () => {
    setFormName("");
    setFormProjectId("");
    setDraftLines([makeDraftLine()]);
    setReceiptFile(null);
    setMileageDistance("");
    setUseMileage(false);
  };

  const hasValidLines = draftLines.some((line) => line.amount && parseFloat(line.amount) > 0);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !`${r.name} ${r.projectName ?? ""} ${r.userName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [reports, debouncedSearch, statusFilter]);

  const mondayColumns: MondayColumnDef<ExpenseReportRow>[] = useMemo(() => [
    {
      id: "name",
      header: "Report",
      type: "text",
      accessor: "name",
      width: "220px",
      sticky: pinName,
      editable: true,
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      id: "project",
      header: "Project",
      type: "text",
      accessor: (row) => row.projectName,
      width: "180px",
      editable: false,
      render: (r) => <span className="text-sm">{r.projectName ?? `Project #${r.projectId}`}</span>,
    },
    {
      id: "submitter",
      header: "Submitter",
      type: "person",
      accessor: (row) => row.userName,
      width: "160px",
      editable: false,
      render: (r) => <span className="text-sm">{r.userName ?? "—"}</span>,
    },
    {
      id: "amount",
      header: "Amount",
      type: "currency",
      accessor: "totalAmount",
      width: "120px",
      editable: false,
      render: (r) => <span className="text-sm tabular-nums">{formatCurrency(r.totalAmount)}</span>,
    },
    {
      id: "status",
      header: "Status",
      type: "status",
      accessor: "status",
      width: "120px",
      editable: false,
      render: (r) => statusBadge(r.status),
    },
  ], [pinName]);

  const updateExpenseMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/finance/expenses/reports/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses/reports"] });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const paginationResetKey = `${debouncedSearch}|${statusFilter}`;

  const EXPENSE_CSV_HEADERS = ["Report", "Project", "Submitter", "Amount", "Status"];

  const exportExpenses = () => {
    const rows = filtered.map((r) => [
      r.name || "",
      r.projectName ?? `Project #${r.projectId}`,
      r.userName ?? "",
      String(r.totalAmount ?? ""),
      r.status || "",
    ]);
    downloadBoardCsv(`expenses-${new Date().toISOString().split("T")[0]}.csv`, EXPENSE_CSV_HEADERS, rows);
    toast({ title: "Expenses exported to CSV" });
  };

  const downloadExpensesTemplate = () => {
    downloadImportTemplateCsv("expenses-import-template.csv", EXPENSE_CSV_HEADERS, EXPENSE_CSV_HEADERS.map(() => ""));
    toast({ title: "Import template downloaded" });
  };

  const importUnavailable = () => toast({ title: "Import is not available for this table yet" });

  return (
    <div className="space-y-4" data-testid="finance-expenses-tab">
      <MondayBoardShell.Legacy
        storageKey="jiganto-finance-expenses"
        entityType="finance_expense"
        stateHook={useMondayBoardShellState}
        filterMatcher={matchBoardFilterValue}
      >
      <MondayBoardShell.Toolbar
        newLabel="New Expense Report"
        onNew={() => setShowCreate(true)}
        newTestId="button-create-expense"
        searchValue={localSearch || searchTerm}
        onSearchChange={setLocalSearch}
        filterActive={statusFilter !== "all"}
        filterCount={statusFilter !== "all" ? 1 : 0}
        filterContent={
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        pinActive={pinName}
        onPinToggle={() => {
          setPinName((v) => {
            const next = !v;
            localStorage.setItem("finance-expenses-pin-name", next ? "1" : "0");
            return next;
          });
        }}
        pinTitle={pinName ? "Unpin Report column" : "Pin Report column"}
        onExport={exportExpenses}
        onDownloadTemplate={downloadExpensesTemplate}
        onPaste={importUnavailable}
        onImport={importUnavailable}
        testId="finance-expenses-toolbar"
      />

      {isLoading ? (
        <FinanceTableSkeleton rows={7} cols={6} />
      ) : filtered.length === 0 ? (
        <FinanceEmptyState
          icon={Receipt}
          title="No expense reports"
          description={reports.length === 0 ? "Submit expense reports for project reimbursement and invoicing." : "No reports match your current filters."}
          action={reports.length === 0 ? (
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> New Expense Report</Button>
          ) : undefined}
        />
      ) : (
        <MondayBoardShell.Table
          columns={mondayColumns}
          data={filtered}
          emptyMessage="No reports match your current filters."
          addItemLabel="New Expense Report"
          onAddItem={() => setShowCreate(true)}
          onRowClick={(r) => setSelectedReportId(r.id)}
          onCellEdit={(rowId, columnId, value) => {
            updateExpenseMut.mutate({
              id: Number(rowId),
              payload: { [columnId]: value === "" ? null : value },
            });
          }}
          searchHighlightTerm={debouncedSearch}
          columnWidthStorageKey="jiganto-finance-expenses-col-widths"
          paginationResetKey={paginationResetKey}
          totalCount={reports.length}
          renderRowActions={(r) => (
            <div className="flex justify-end gap-1">
              {r.status === "draft" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => submitMutation.mutate(r.id)}
                  disabled={submitMutation.isPending && submitMutation.variables === r.id}
                >
                  {submitMutation.isPending && submitMutation.variables === r.id
                    ? <FinanceButtonSpinner />
                    : "Submit"}
                </Button>
              )}
              {r.status === "submitted" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectMutation.mutate(r.id)}
                    disabled={rejectMutation.isPending && rejectMutation.variables === r.id}
                  >
                    {rejectMutation.isPending && rejectMutation.variables === r.id
                      ? <FinanceButtonSpinner />
                      : <XCircle className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(r.id)}
                    disabled={approveMutation.isPending && approveMutation.variables === r.id}
                  >
                    {approveMutation.isPending && approveMutation.variables === r.id
                      ? <FinanceButtonSpinner />
                      : <CheckCircle2 className="h-3 w-3" />}
                  </Button>
                </>
              )}
            </div>
          )}
        />
      )}
      </MondayBoardShell.Legacy>

      <FormDialogShell
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) resetForm();
        }}
        title="Create expense report"
        subtitle="Submit project expenses for approval"
        saveLabel="Create report"
        onCancel={() => { setShowCreate(false); resetForm(); }}
        onSubmit={() => createMutation.mutate()}
        saving={createMutation.isPending}
        disabled={!formName || !formProjectId || !hasValidLines}
        testId="expense-create-dialog"
      >
        <FormSection icon={<Receipt className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Report details">
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel required>Report name</FieldLabel>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Client visit — March" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel required>Project</FieldLabel>
            <Select value={formProjectId} onValueChange={setFormProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormSection>

        <FormDivider />

        <FormSection icon={<Receipt className="h-3.5 w-3.5 text-emerald-600" />} iconClassName="bg-emerald-50 dark:bg-emerald-950/40" title="Line items">
          <div className="flex items-center gap-2 mb-3">
            <input type="checkbox" id="mileage" checked={useMileage} onChange={(e) => setUseMileage(e.target.checked)} />
            <Label htmlFor="mileage" className="text-xs font-semibold">Apply mileage to first line</Label>
          </div>
          {useMileage ? (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Input placeholder="Distance (miles)" value={mileageDistance} onChange={(e) => setMileageDistance(e.target.value)} />
              <Select value={mileageVehicle} onValueChange={(v) => setMileageVehicle(v as typeof mileageVehicle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="motorcycle">Motorcycle</SelectItem>
                  <SelectItem value="bicycle">Bicycle</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => mileageMutation.mutate()} disabled={!mileageDistance || mileageMutation.isPending}>
                {mileageMutation.isPending ? <FinanceButtonSpinner /> : "Calculate"}
              </Button>
            </div>
          ) : null}
          <div className="space-y-3">
            {draftLines.map((line, index) => (
              <div key={line.key} className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Line {index + 1}</span>
                  {draftLines.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setDraftLines((lines) => lines.filter((l) => l.key !== line.key))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <FieldGrid>
                  <div className="space-y-1.5">
                    <FieldLabel>Date</FieldLabel>
                    <Input type="date" value={line.itemDate} onChange={(e) => updateDraftLine(line.key, { itemDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Category</FieldLabel>
                    <Select value={line.category} onValueChange={(v) => updateDraftLine(line.key, { category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </FieldGrid>
                <FieldGrid>
                  <div className="space-y-1.5">
                    <FieldLabel required={index === 0}>Amount (£)</FieldLabel>
                    <Input type="number" step="0.01" value={line.amount} onChange={(e) => updateDraftLine(line.key, { amount: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>VAT (£)</FieldLabel>
                    <Input type="number" step="0.01" value={line.vatAmount} onChange={(e) => updateDraftLine(line.key, { vatAmount: e.target.value })} />
                  </div>
                </FieldGrid>
                <FieldGrid>
                  <div className="space-y-1.5">
                    <FieldLabel>Description</FieldLabel>
                    <Input value={line.description} onChange={(e) => updateDraftLine(line.key, { description: e.target.value })} placeholder="Brief description" />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Payment method</FieldLabel>
                    <Select value={line.paymentMethod} onValueChange={(v) => updateDraftLine(line.key, { paymentMethod: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal_card">Personal card</SelectItem>
                        <SelectItem value="company_card">Company card</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </FieldGrid>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={line.isBillable} onChange={(e) => updateDraftLine(line.key, { isBillable: e.target.checked })} />
                  Billable to client
                </label>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setDraftLines((lines) => [...lines, makeDraftLine()])}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add another line
          </Button>
        </FormSection>

        <FormDivider />

        <FormSection icon={<Upload className="h-3.5 w-3.5 text-muted-foreground" />} title="Receipt (first line)">
          <input ref={receiptRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
          <Button type="button" variant="outline" size="sm" onClick={() => receiptRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Upload receipt
          </Button>
          {receiptFile && (
            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-2">
              <Receipt className="h-3 w-3" /> {receiptFile.name}
            </p>
          )}
        </FormSection>
      </FormDialogShell>

      <Sheet open={selectedReportId != null} onOpenChange={(open) => {
        if (!open) {
          setSelectedReportId(null);
          setDetailLine(makeDraftLine());
        }
      }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{reportDetail?.name ?? "Expense report"}</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <p className="text-sm text-muted-foreground py-6">Loading report…</p>
          ) : reportDetail ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>{reportDetail.projectName ?? `Project #${reportDetail.projectId}`}</span>
                <span>·</span>
                {statusBadge(reportDetail.status)}
                <span>·</span>
                <span className="font-medium text-foreground">{formatCurrency(reportDetail.totalAmount)}</span>
              </div>
              <ScrollArea className="max-h-[40vh] rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reportDetail.items ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6">No line items yet</TableCell>
                      </TableRow>
                    ) : (
                      (reportDetail.items ?? []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">{item.itemDate?.slice(0, 10) ?? "—"}</TableCell>
                          <TableCell>
                            <div className="text-sm">{item.category}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]">{item.description}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="tabular-nums">{formatCurrency(item.amount)}</span>
                              {reportDetail.status === "draft" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => deleteItemMutation.mutate(item.id)}
                                  disabled={deleteItemMutation.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {reportDetail.status === "draft" && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-medium">Add line item</p>
                  <FieldGrid>
                    <Input type="date" value={detailLine.itemDate} onChange={(e) => setDetailLine((l) => ({ ...l, itemDate: e.target.value }))} />
                    <Select value={detailLine.category} onValueChange={(v) => setDetailLine((l) => ({ ...l, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldGrid>
                  <FieldGrid>
                    <Input type="number" step="0.01" placeholder="Amount" value={detailLine.amount} onChange={(e) => setDetailLine((l) => ({ ...l, amount: e.target.value }))} />
                    <Input placeholder="Description" value={detailLine.description} onChange={(e) => setDetailLine((l) => ({ ...l, description: e.target.value }))} />
                  </FieldGrid>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!detailLine.amount || addItemMutation.isPending}
                    onClick={() => selectedReportId && addItemMutation.mutate(selectedReportId)}
                  >
                    {addItemMutation.isPending ? <FinanceButtonSpinner /> : <><Plus className="h-3.5 w-3.5 mr-1" /> Add line</>}
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
