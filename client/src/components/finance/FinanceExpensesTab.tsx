import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EXPENSE_CATEGORIES } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel, FormDivider } from "@/components/ui/form-dialog-shell";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Upload, CheckCircle2, XCircle, Receipt } from "lucide-react";
import { FinanceTableSkeleton, FinanceEmptyState, FinanceTableWrap, FinanceButtonSpinner } from "./FinanceUi";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import type { ExpenseReportRow } from "./types";

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
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const receiptRef = useRef<HTMLInputElement>(null);

  const [formName, setFormName] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formCategory, setFormCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formBillable, setFormBillable] = useState(true);
  const [formVat, setFormVat] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("personal_card");
  const [mileageDistance, setMileageDistance] = useState("");
  const [mileageVehicle, setMileageVehicle] = useState<"car" | "motorcycle" | "bicycle">("car");
  const [useMileage, setUseMileage] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses/reports"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/budgets"] });
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
      setFormAmount(String(data.amount));
      setFormCategory("Travel");
    },
    onError: () => toast({ title: "Failed to calculate mileage", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/finance/expenses/reports", {
        name: formName,
        projectId: Number(formProjectId),
        currency: "GBP",
      });
      const report = await res.json() as { id: number };
      const itemRes = await apiRequest("POST", `/api/finance/expenses/reports/${report.id}/items`, {
        itemDate: formDate,
        category: formCategory,
        description: formDescription || formName,
        amount: formAmount,
        isBillable: formBillable,
        vatAmount: formVat || null,
        paymentMethod: formPaymentMethod,
        mileageDistance: useMileage ? mileageDistance : null,
        mileageVehicleType: useMileage ? mileageVehicle : null,
      });
      const item = await itemRes.json() as { id: number };
      if (receiptFile) {
        const fd = new FormData();
        fd.append("receipt", receiptFile);
        await fetch(`/api/finance/expenses/items/${item.id}/receipt`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
      }
      return report;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Expense report created" });
      setShowCreate(false);
      resetForm();
    },
    onError: () => toast({ title: "Failed to create expense report", variant: "destructive" }),
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

  const resetForm = () => {
    setFormName("");
    setFormProjectId("");
    setFormCategory(EXPENSE_CATEGORIES[0]);
    setFormDescription("");
    setFormAmount("");
    setFormVat("");
    setReceiptFile(null);
    setMileageDistance("");
    setUseMileage(false);
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !`${r.name} ${r.projectName ?? ""} ${r.userName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [reports, searchTerm, statusFilter]);

  const pagination = useTablePagination(filtered, {
    resetKey: `${searchTerm}-${statusFilter}`,
  });

  return (
    <div className="space-y-4" data-testid="finance-expenses-tab">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
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
        {reports.length > 0 && (
        <Button onClick={() => setShowCreate(true)} className="sm:ml-auto w-full sm:w-auto" data-testid="button-create-expense">
          <Plus className="h-4 w-4 mr-1" />
          New Expense Report
        </Button>
        )}
      </div>

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
        <Card className="rounded-xl border-border/50 overflow-hidden shadow-sm">
          <FinanceTableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map((r) => (
                  <TableRow key={r.id} data-testid={`expense-row-${r.id}`}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.projectName ?? `Project #${r.projectId}`}</TableCell>
                    <TableCell>{r.userName ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.totalAmount)}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
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

      <FormDialogShell
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Create expense report"
        subtitle="Submit project expenses for approval"
        saveLabel="Create report"
        onCancel={() => setShowCreate(false)}
        onSubmit={() => createMutation.mutate()}
        saving={createMutation.isPending}
        disabled={!formName || !formProjectId || !formAmount}
        testId="expense-create-dialog"
      >
        <FormSection icon={<Receipt className="h-3.5 w-3.5 text-blue-600" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Report details">
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel required>Report name</FieldLabel>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Client visit — March" />
          </div>
          <FieldGrid className="mb-3.5">
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
            <div className="space-y-1.5">
              <FieldLabel>Category</FieldLabel>
              <Select value={formCategory} onValueChange={setFormCategory}>
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
              <FieldLabel>Date</FieldLabel>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Description</FieldLabel>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Brief description" />
            </div>
          </FieldGrid>
        </FormSection>

        <FormDivider />

        <FormSection icon={<Receipt className="h-3.5 w-3.5 text-emerald-600" />} iconClassName="bg-emerald-50 dark:bg-emerald-950/40" title="Amount & payment">
          <div className="flex items-center gap-2 mb-3.5">
            <input type="checkbox" id="mileage" checked={useMileage} onChange={(e) => setUseMileage(e.target.checked)} />
            <Label htmlFor="mileage" className="text-xs font-semibold">Mileage claim</Label>
          </div>
          {useMileage ? (
            <div className="grid grid-cols-3 gap-2 mb-3.5">
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
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5">
              <FieldLabel required>Amount (£)</FieldLabel>
              <Input type="number" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>VAT (£)</FieldLabel>
              <Input type="number" step="0.01" value={formVat} onChange={(e) => setFormVat(e.target.value)} />
            </div>
          </FieldGrid>
          <FieldGrid>
            <div className="space-y-1.5">
              <FieldLabel>Payment method</FieldLabel>
              <Select value={formPaymentMethod} onValueChange={setFormPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal_card">Personal card</SelectItem>
                  <SelectItem value="company_card">Company card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input type="checkbox" id="billable" checked={formBillable} onChange={(e) => setFormBillable(e.target.checked)} />
              <Label htmlFor="billable" className="text-xs font-semibold">Billable to client</Label>
            </div>
          </FieldGrid>
        </FormSection>

        <FormDivider />

        <FormSection icon={<Upload className="h-3.5 w-3.5 text-muted-foreground" />} title="Receipt">
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
    </div>
  );
}
