import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { CONTRACT_TYPES, INVOICE_STATUSES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel, FormDivider } from "@/components/ui/form-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Download,
  Send,
  CreditCard,
  FileText
} from "lucide-react";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { Label } from "@/components/ui/label";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import { matchBoardFilterValue } from "@/lib/board-filters";
import { useDebouncedValue, downloadBoardCsv, downloadImportTemplateCsv } from "@/lib/crm-monday-chrome";
import { FinanceTableSkeleton, FinanceEmptyState, FinanceButtonSpinner } from "./FinanceUi";
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
  const [localSearch, setLocalSearch] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm || localSearch);
  const [statusFilter, setStatusFilter] = useState("all");
  const [pinInvoice, setPinInvoice] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("finance-invoices-pin-number") !== "0";
  });
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
  const [formTaxPct, setFormTaxPct] = useState("0");
  const [formLines, setFormLines] = useState([{ description: "", quantity: "1", unitRate: "", lineType: "fixed_fee" }]);

  const resetCreateForm = () => {
    setFormProjectId("");
    setFormContractType("fixed_price");
    setFormIssueDate(new Date().toISOString().slice(0, 10));
    setFormDueDate("");
    setFormNotes("");
    setFormTaxPct("0");
    setFormLines([{ description: "", quantity: "1", unitRate: "", lineType: "fixed_fee" }]);
  };

  const { data: fetchedInvoices = [], isLoading: fetchLoading } = useQuery<FinanceInvoiceRow[]>({
    queryKey: ["/api/finance/invoices"],
    enabled: invoicesProp === undefined,
    staleTime: 30_000,
  });
  const invoices = invoicesProp ?? fetchedInvoices;
  const isLoading = isLoadingProp ?? fetchLoading;

  const { data: projects = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/pm/projects"],
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/finance/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/dashboard"] });
  };

  const formSubtotal = formLines.reduce((s, l) => {
    const qty = parseFloat(l.quantity || "1") || 0;
    const rate = parseFloat(l.unitRate || "0") || 0;
    return s + qty * rate;
  }, 0);
  const formTaxAmount = formSubtotal * (parseFloat(formTaxPct || "0") || 0) / 100;
  const formTotal = formSubtotal + formTaxAmount;

  const createMutation = useMutation({
    mutationFn: async () => {
      const manualLines = formLines
        .filter((l) => l.description)
        .map((l) => {
          const quantity = Number(l.quantity);
          const unitRate = Number(l.unitRate);
          return { description: l.description, quantity, unitRate, amount: quantity * unitRate, lineType: l.lineType };
        })
        .filter((l) => Number.isFinite(l.quantity) && Number.isFinite(l.unitRate));
      if (formLines.some((l) => l.description) && manualLines.length === 0) {
        throw new Error("Invalid line quantities or rates");
      }
      const res = await apiRequest("POST", "/api/finance/invoices", {
        projectId: Number(formProjectId),
        contractType: formContractType,
        issueDate: formIssueDate,
        dueDate: formDueDate || formIssueDate,
        notes: formNotes || null,
        taxAmount: formTaxAmount || null,
        includeTimesheets: formContractType === "time_materials" || formContractType === "mixed",
        includeExpenses: formContractType === "time_materials" || formContractType === "mixed",
        manualLines,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Invoice created" });
      setShowCreate(false);
      resetCreateForm();
    },
    onError: (err: Error) => toast({
      title: err.message === "Invalid line quantities or rates" ? err.message : "Failed to create invoice",
      variant: "destructive",
    }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/finance/invoices/${id}/send`),
    onSuccess: () => { invalidate(); toast({ title: "Invoice sent" }); },
    onError: () => toast({ title: "Failed to send invoice", variant: "destructive" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({ id, email }: { id: number; email: string }) => {
      const res = await apiRequest("POST", `/api/finance/invoices/${id}/send-email`, { email });
      return res.json() as Promise<{ emailSent?: boolean; emailError?: string }>;
    },
    onSuccess: (data) => {
      if (data.emailSent === false) {
        toast({
          title: "Invoice email failed to send",
          description: data.emailError,
          variant: "destructive",
        });
        return;
      }
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
        amount: Number(paymentAmount),
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
    const q = debouncedSearch.toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (q && !`${inv.invoiceNumber} ${inv.projectName ?? ""} ${inv.clientName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [invoices, debouncedSearch, statusFilter]);

  const mondayColumns: MondayColumnDef<FinanceInvoiceRow>[] = useMemo(() => [
    {
      id: "invoiceNumber",
      header: "Invoice #",
      type: "text",
      accessor: "invoiceNumber",
      width: "130px",
      sticky: pinInvoice,
      editable: false,
      render: (inv) => <span className="font-medium">{inv.invoiceNumber}</span>,
    },
    {
      id: "project",
      header: "Project",
      type: "text",
      accessor: (row) => row.projectName,
      width: "180px",
      editable: false,
      render: (inv) => <span className="text-sm">{inv.projectName ?? `Project #${inv.projectId}`}</span>,
    },
    {
      id: "client",
      header: "Client",
      type: "text",
      accessor: (row) => row.clientName || "",
      width: "160px",
      editable: false,
      render: (inv) => <span className="text-sm">{inv.clientName ?? "—"}</span>,
    },
    {
      id: "type",
      header: "Type",
      type: "status",
      accessor: "contractType",
      width: "120px",
      editable: true,
      options: [
        { value: "fixed_price", label: "Fixed price", color: "bg-[#579bfc] text-white" },
        { value: "time_materials", label: "Time & materials", color: "bg-[#00c875] text-white" },
        { value: "retainer", label: "Retainer", color: "bg-[#a25ddc] text-white" },
        { value: "mixed", label: "Mixed", color: "bg-[#fdab3d] text-white" },
      ],
      render: (inv) => <Badge variant="outline" className="capitalize">{inv.contractType.replace(/_/g, " ")}</Badge>,
    },
    {
      id: "dueDate",
      header: "Due",
      type: "date",
      accessor: "dueDate",
      width: "110px",
      editable: true,
      render: (inv) => <span className="text-sm">{inv.dueDate}</span>,
    },
    {
      id: "total",
      header: "Total",
      type: "currency",
      accessor: "total",
      width: "120px",
      editable: false,
      render: (inv) => <span className="text-sm tabular-nums">{formatCurrency(inv.total, inv.currency)}</span>,
    },
    {
      id: "status",
      header: "Status",
      type: "status",
      accessor: "status",
      width: "130px",
      editable: false,
      render: (inv) => invoiceStatusBadge(inv.status),
    },
  ], [pinInvoice]);

  const updateInvoiceMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/finance/invoices/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/dashboard"] });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const paginationResetKey = `${debouncedSearch}|${statusFilter}`;

  const INVOICE_CSV_HEADERS = ["Invoice #", "Project", "Client", "Type", "Due", "Total", "Status"];

  const exportInvoices = () => {
    const rows = filtered.map((inv) => [
      inv.invoiceNumber || "",
      inv.projectName ?? `Project #${inv.projectId}`,
      inv.clientName ?? "",
      inv.contractType.replace(/_/g, " "),
      inv.dueDate || "",
      String(inv.total ?? ""),
      inv.status || "",
    ]);
    downloadBoardCsv(`invoices-${new Date().toISOString().split("T")[0]}.csv`, INVOICE_CSV_HEADERS, rows);
    toast({ title: "Invoices exported to CSV" });
  };

  const downloadInvoicesTemplate = () => {
    downloadImportTemplateCsv("invoices-import-template.csv", INVOICE_CSV_HEADERS, INVOICE_CSV_HEADERS.map(() => ""));
    toast({ title: "Import template downloaded" });
  };

  const importUnavailable = () => toast({ title: "Import is not available for this table yet" });

  return (
    <div className="space-y-4" data-testid="finance-invoices-tab">
      <MondayBoardShell.Legacy
        storageKey="jiganto-finance-invoices"
        entityType="finance_invoice"
        stateHook={useMondayBoardShellState}
        filterMatcher={matchBoardFilterValue}
      >
      <MondayBoardShell.Toolbar
        newLabel="Create Invoice"
        onNew={() => setShowCreate(true)}
        newTestId="button-create-invoice"
        searchValue={localSearch || searchTerm}
        onSearchChange={setLocalSearch}
        filterActive={statusFilter !== "all"}
        filterCount={statusFilter !== "all" ? 1 : 0}
        filterContent={
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-invoice-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {INVOICE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        pinActive={pinInvoice}
        onPinToggle={() => {
          setPinInvoice((v) => {
            const next = !v;
            localStorage.setItem("finance-invoices-pin-number", next ? "1" : "0");
            return next;
          });
        }}
        pinTitle={pinInvoice ? "Unpin Invoice # column" : "Pin Invoice # column"}
        onExport={exportInvoices}
        onDownloadTemplate={downloadInvoicesTemplate}
        onPaste={importUnavailable}
        onImport={importUnavailable}
        testId="finance-invoices-toolbar"
      />

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
        <MondayBoardShell.Table
          columns={mondayColumns}
          data={filtered}
          emptyMessage="No invoices match your current filters."
          addItemLabel="Create Invoice"
          onAddItem={() => setShowCreate(true)}
          onCellEdit={(rowId, columnId, value) => {
            const inv = filtered.find((i) => String(i.id) === String(rowId));
            if (inv && inv.status !== "draft") {
              toast({ title: "Only draft invoices can be edited", variant: "destructive" });
              return;
            }
            const field = columnId === "type" ? "contractType" : columnId;
            updateInvoiceMut.mutate({
              id: Number(rowId),
              payload: { [field]: value === "" ? null : value },
            });
          }}
          searchHighlightTerm={debouncedSearch}
          columnWidthStorageKey="jiganto-finance-invoices-col-widths"
          paginationResetKey={paginationResetKey}
          totalCount={invoices.length}
          renderRowActions={(inv) => (
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const outstanding = Math.max(0, parseFloat(String(inv.total ?? 0)) - parseFloat(String(inv.amountPaid ?? 0)));
                    setShowPayment(inv.id);
                    setPaymentAmount(String(Number.isFinite(outstanding) ? outstanding : 0));
                  }}
                  title="Record payment"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                </Button>
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
          if (!open) resetCreateForm();
        }}
        title="Create invoice"
        subtitle="Bill a project with line items and due dates"
        meta="Invoice will be created as draft"
        saveLabel="Create invoice"
        onCancel={() => { setShowCreate(false); resetCreateForm(); }}
        onSubmit={() => createMutation.mutate()}
        saving={createMutation.isPending}
        disabled={!formProjectId}
        size="lg"
        testId="invoice-create-dialog"
      >
        <FormSection icon={<FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Invoice details">
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
              <FieldLabel>Contract type</FieldLabel>
              <Select value={formContractType} onValueChange={setFormContractType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FieldGrid>
          <FieldGrid>
            <div className="space-y-1.5">
              <FieldLabel>Issue date</FieldLabel>
              <Input type="date" value={formIssueDate} onChange={(e) => setFormIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Due date</FieldLabel>
              <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
            </div>
          </FieldGrid>
        </FormSection>

        <FormDivider />

        <FormSection icon={<CreditCard className="h-3.5 w-3.5 text-emerald-600" />} iconClassName="bg-emerald-50 dark:bg-emerald-950/40" title="Line items">
          {formLines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end mb-2">
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
                  type="number"
                  min="0"
                  step="any"
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
                  type="number"
                  min="0"
                  step="0.01"
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
          <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FieldLabel>Tax %</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className="w-20 h-7 text-xs"
                  value={formTaxPct}
                  onChange={(e) => setFormTaxPct(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="text-xs text-right space-y-0.5">
                <div className="text-muted-foreground">Subtotal: {formatCurrency(formSubtotal)}</div>
                {formTaxAmount > 0 && <div className="text-muted-foreground">Tax: {formatCurrency(formTaxAmount)}</div>}
                <div className="font-semibold">Total: {formatCurrency(formTotal)}</div>
              </div>
            </div>
          </div>
        </FormSection>

        <FormDivider />

        <FormSection icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />} title="Notes">
          <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} placeholder="Payment terms or client notes…" />
        </FormSection>
      </FormDialogShell>

      <FormDialogShell
        open={showEmail != null}
        onOpenChange={(open) => {
          if (!open) {
            setShowEmail(null);
            setEmailTo("");
          }
        }}
        title="Send Invoice by Email"
        saveLabel="Send"
        onCancel={() => { setShowEmail(null); setEmailTo(""); }}
        onSubmit={() => showEmail && sendEmailMutation.mutate({ id: showEmail, email: emailTo })}
        saving={sendEmailMutation.isPending}
        disabled={!emailTo}
      >
        <FormSection title="Recipient">
          <div className="space-y-1.5">
            <FieldLabel required>Recipient email</FieldLabel>
            <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="client@example.com" />
          </div>
        </FormSection>
      </FormDialogShell>

      <FormDialogShell
        open={showPayment != null}
        onOpenChange={(open) => !open && setShowPayment(null)}
        title="Record Payment"
        saveLabel="Record"
        onCancel={() => setShowPayment(null)}
        onSubmit={() => showPayment && paymentMutation.mutate(showPayment)}
        saving={paymentMutation.isPending}
        disabled={!paymentAmount}
        testId="invoice-payment-dialog"
      >
        <FormSection icon={<FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Payment details">
          <FieldGrid>
            <div className="space-y-1.5">
              <FieldLabel>Payment date</FieldLabel>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Amount</FieldLabel>
              <Input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
          </FieldGrid>
        </FormSection>
      </FormDialogShell>
    </div>
  );
}
