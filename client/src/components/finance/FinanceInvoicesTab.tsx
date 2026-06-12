import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { CONTRACT_TYPES, INVOICE_STATUSES } from "@shared/schema";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Download, Send, CreditCard, FileText } from "lucide-react";
import { FinanceTableSkeleton, FinanceEmptyState, FinanceTableWrap, FinanceButtonSpinner } from "./FinanceUi";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import type { FinanceInvoiceRow } from "./types";

function invoiceStatusBadge(status: string) {
  const colors: Record<string, string> = {
    draft: "outline",
    sent: "secondary",
    partially_paid: "secondary",
    paid: "default",
    overdue: "destructive",
    void: "outline",
    credit_note: "outline",
  };
  return <Badge variant={(colors[status] ?? "outline") as "default" | "secondary" | "destructive" | "outline"} className="capitalize">{status.replace(/_/g, " ")}</Badge>;
}

function formatCurrency(v: string | number | null | undefined, currency = "GBP") {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  return `${sym}${Number.isFinite(n) ? n.toLocaleString("en-GB", { minimumFractionDigits: 2 }) : "0.00"}`;
}

interface FinanceInvoicesTabProps {
  invoices?: FinanceInvoiceRow[];
  isLoading?: boolean;
  searchTerm?: string;
}

export function FinanceInvoicesTab({ invoices: invoicesProp, isLoading: isLoadingProp, searchTerm = "" }: FinanceInvoicesTabProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showPayment, setShowPayment] = useState<number | null>(null);
  const [showEmail, setShowEmail] = useState<number | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);

  const [formProjectId, setFormProjectId] = useState("");
  const [formContractType, setFormContractType] = useState<string>("fixed_price");
  const [formIssueDate, setFormIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formLines, setFormLines] = useState([{ description: "", quantity: "1", unitRate: "", lineType: "fixed_fee" }]);

  const { data: fetchedInvoices = [], isLoading: fetchLoading } = useQuery<FinanceInvoiceRow[]>({
    queryKey: ["/api/finance/invoices"],
    enabled: invoicesProp === undefined,
  });
  const invoices = invoicesProp ?? fetchedInvoices;
  const isLoading = isLoadingProp ?? fetchLoading;

  const { data: projects = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/pm/projects"],
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/finance/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/dashboard"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/finance/invoices", {
        projectId: Number(formProjectId),
        contractType: formContractType,
        issueDate: formIssueDate,
        dueDate: formDueDate || formIssueDate,
        notes: formNotes || null,
        includeTimesheets: formContractType === "time_materials" || formContractType === "mixed",
        includeExpenses: formContractType === "time_materials" || formContractType === "mixed",
        manualLines: formLines.filter((l) => l.description).map((l) => ({
          description: l.description,
          quantity: parseFloat(l.quantity || "1"),
          unitRate: parseFloat(l.unitRate || "0"),
          amount: parseFloat(l.quantity || "1") * parseFloat(l.unitRate || "0"),
          lineType: l.lineType,
        })),
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Invoice created" });
      setShowCreate(false);
    },
    onError: () => toast({ title: "Failed to create invoice", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/finance/invoices/${id}/send`),
    onSuccess: () => { invalidate(); toast({ title: "Invoice sent" }); },
    onError: () => toast({ title: "Failed to send invoice", variant: "destructive" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: ({ id, email }: { id: number; email: string }) =>
      apiRequest("POST", `/api/finance/invoices/${id}/send-email`, { email }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Invoice sent by email" });
      setShowEmail(null);
      setEmailTo("");
    },
    onError: () => toast({ title: "Failed to send email", variant: "destructive" }),
  });

  const creditNoteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/finance/invoices/${id}/credit-note`),
    onSuccess: () => { invalidate(); toast({ title: "Credit note created" }); },
    onError: () => toast({ title: "Failed to create credit note", variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      return apiRequest("POST", `/api/finance/invoices/${invoiceId}/payments`, {
        paymentDate,
        amount: paymentAmount,
        paymentMethod: "bank_transfer",
      });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Payment recorded" });
      setShowPayment(null);
      setPaymentAmount("");
    },
    onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
  });

  const downloadPdf = async (id: number, invoiceNumber: string) => {
    setDownloadingPdfId(id);
    try {
      const res = await fetchWithAuth(`/api/finance/invoices/${id}/pdf`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "PDF download failed", variant: "destructive" });
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (q && !`${inv.invoiceNumber} ${inv.projectName ?? ""} ${inv.clientName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [invoices, searchTerm, statusFilter]);

  const pagination = useTablePagination(filtered, {
    resetKey: `${searchTerm}-${statusFilter}`,
  });

  return (
    <div className="space-y-4" data-testid="finance-invoices-tab">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="filter-invoice-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {INVOICE_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreate(true)} className="sm:ml-auto w-full sm:w-auto" data-testid="button-create-invoice">
          <Plus className="h-4 w-4 mr-1" />
          Create Invoice
        </Button>
      </div>

      {isLoading ? (
        <FinanceTableSkeleton rows={7} cols={8} />
      ) : filtered.length === 0 ? (
        <FinanceEmptyState
          icon={FileText}
          title="No invoices"
          description={invoices.length === 0 ? "Create invoices from approved timesheets and expenses." : "No invoices match your current filters."}
          action={invoices.length === 0 ? (
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Create Invoice</Button>
          ) : undefined}
        />
      ) : (
        <Card className="rounded-xl border-border/50 overflow-hidden shadow-sm">
          <FinanceTableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map((inv) => (
                  <TableRow key={inv.id} data-testid={`invoice-row-${inv.id}`}>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.projectName ?? `Project #${inv.projectId}`}</TableCell>
                    <TableCell>{inv.clientName ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{inv.contractType.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>{inv.dueDate}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(inv.total, inv.currency)}</TableCell>
                    <TableCell>{invoiceStatusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadPdf(inv.id, inv.invoiceNumber)}
                          title="Download PDF"
                          disabled={downloadingPdfId === inv.id}
                        >
                          {downloadingPdfId === inv.id ? <FinanceButtonSpinner className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                        </Button>
                        {inv.status === "draft" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => sendMutation.mutate(inv.id)}
                              title="Mark sent"
                              disabled={sendMutation.isPending && sendMutation.variables === inv.id}
                            >
                              {sendMutation.isPending && sendMutation.variables === inv.id
                                ? <FinanceButtonSpinner className="h-3.5 w-3.5" />
                                : <Send className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setShowEmail(inv.id)} title="Send email">
                              <Send className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                          </>
                        )}
                        {inv.status !== "void" && inv.status !== "credit_note" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => creditNoteMutation.mutate(inv.id)}
                            title="Credit note"
                            disabled={creditNoteMutation.isPending && creditNoteMutation.variables === inv.id}
                          >
                            {creditNoteMutation.isPending && creditNoteMutation.variables === inv.id
                              ? <FinanceButtonSpinner className="h-3.5 w-3.5" />
                              : "CN"}
                          </Button>
                        )}
                        {inv.status !== "paid" && inv.status !== "void" && (
                          <Button size="sm" variant="ghost" onClick={() => { setShowPayment(inv.id); setPaymentAmount(String(inv.total)); }} title="Record payment">
                            <CreditCard className="h-3.5 w-3.5" />
                          </Button>
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="invoice-create-dialog">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={formProjectId} onValueChange={setFormProjectId}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contract type</Label>
                <Select value={formContractType} onValueChange={setFormContractType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Issue date</Label>
                <Input type="date" value={formIssueDate} onChange={(e) => setFormIssueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Line items</Label>
              {formLines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => {
                        const next = [...formLines];
                        next[idx] = { ...line, description: e.target.value };
                        setFormLines(next);
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => {
                        const next = [...formLines];
                        next[idx] = { ...line, quantity: e.target.value };
                        setFormLines(next);
                      }}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="Rate"
                      value={line.unitRate}
                      onChange={(e) => {
                        const next = [...formLines];
                        next[idx] = { ...line, unitRate: e.target.value };
                        setFormLines(next);
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <Select
                      value={line.lineType}
                      onValueChange={(v) => {
                        const next = [...formLines];
                        next[idx] = { ...line, lineType: v };
                        setFormLines(next);
                      }}
                    >
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed_fee">Fixed</SelectItem>
                        <SelectItem value="time_materials">T&amp;M</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setFormLines([...formLines, { description: "", quantity: "1", unitRate: "", lineType: "fixed_fee" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add line
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!formProjectId || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmail != null} onOpenChange={(open) => !open && setShowEmail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Invoice by Email</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Recipient email</Label>
            <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="client@example.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmail(null)}>Cancel</Button>
            <Button
              onClick={() => showEmail && sendEmailMutation.mutate({ id: showEmail, email: emailTo })}
              disabled={!emailTo || sendEmailMutation.isPending}
            >
              {sendEmailMutation.isPending ? <FinanceButtonSpinner /> : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPayment != null} onOpenChange={(open) => !open && setShowPayment(null)}>
        <DialogContent data-testid="invoice-payment-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Payment date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(null)}>Cancel</Button>
            <Button onClick={() => showPayment && paymentMutation.mutate(showPayment)} disabled={!paymentAmount || paymentMutation.isPending}>
              {paymentMutation.isPending ? <FinanceButtonSpinner /> : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
