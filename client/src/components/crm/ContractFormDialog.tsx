import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentLinkSelect } from "./DocumentLinkSelect";
import {
  CrmFieldGrid,
  CrmFieldLabel,
  CrmFormDivider,
  CrmFormSection,
  formatCrmRecordMeta,
} from "@/lib/crm-form-layout";
import { Building2, Calendar, FileText, ScrollText } from "lucide-react";
import type { CrmAccountPicklist } from "./types";

export type ContractFormData = {
  name: string;
  accountId: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  value: string;
  terms: string;
  documentId: string;
};

export const EMPTY_CONTRACT_FORM: ContractFormData = {
  name: "",
  accountId: "",
  type: "service",
  status: "draft",
  startDate: "",
  endDate: "",
  value: "",
  terms: "",
  documentId: "",
};

type ContractRecord = {
  id: number;
  name: string;
  accountId: number | null;
  type: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  value: string | null;
  terms: string | null;
  documentId: number | null;
  createdAt?: string;
  updatedAt?: string;
};

function contractToForm(c: ContractRecord): ContractFormData {
  return {
    name: c.name,
    accountId: c.accountId ? String(c.accountId) : "",
    type: c.type || "service",
    status: c.status || "draft",
    startDate: c.startDate ? c.startDate.split("T")[0] : "",
    endDate: c.endDate ? c.endDate.split("T")[0] : "",
    value: c.value || "",
    terms: c.terms || "",
    documentId: c.documentId ? String(c.documentId) : "",
  };
}

function formToPayload(data: ContractFormData) {
  return {
    name: data.name,
    accountId: data.accountId ? parseInt(data.accountId, 10) : null,
    type: data.type,
    status: data.status,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    value: data.value || null,
    terms: data.terms || null,
    documentId: data.documentId ? parseInt(data.documentId, 10) : null,
  };
}

function previewColor(name: string): string {
  const colors = ["#0ea5e9", "#6366f1", "#22c55e", "#f97316", "#ec4899"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "C";
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing: ContractRecord | null;
  accounts: CrmAccountPicklist[];
}

export function ContractFormDialog({ open, onClose, editing, accounts }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<ContractFormData>(EMPTY_CONTRACT_FORM);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? contractToForm(editing) : { ...EMPTY_CONTRACT_FORM });
  }, [open, editing]);

  const createMutation = useMutation({
    mutationFn: async (data: ContractFormData) => {
      const res = await apiRequest("POST", "/api/crm/contracts", formToPayload(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
      toast({ title: "Contract created successfully" });
      onClose();
    },
    onError: () => toast({ title: "Failed to create contract", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ContractFormData }) => {
      const res = await apiRequest("PUT", `/api/crm/contracts/${id}`, formToPayload(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
      toast({ title: "Contract updated" });
      onClose();
    },
    onError: () => toast({ title: "Failed to update contract", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSubmit = !!form.name.trim();
  const previewName = form.name.trim() || "New contract";
  const accountName = accounts.find((a) => String(a.id) === form.accountId)?.name;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const set = (key: keyof ContractFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={editing ? "Edit contract" : "Create new contract"}
      subtitle={[previewName, accountName || ""].filter(Boolean).join(" · ")}
      meta={
        editing
          ? formatCrmRecordMeta(editing.createdAt, editing.updatedAt) || (canSubmit ? "Ready to save" : "Contract name required")
          : canSubmit ? "Ready to save" : "Contract name required"
      }
      saveLabel={editing ? "Save changes" : "Create contract"}
      onCancel={onClose}
      onSubmit={handleSubmit}
      saving={isPending}
      disabled={!canSubmit}
      saveTestId="button-save-contract"
      size="md"
      bodyClassName="max-h-[72vh]"
    >
      <div className="space-y-0">
        <div className="rounded-xl border bg-gradient-to-br from-[#0ea5e9]/10 via-background to-background p-4 mb-5 flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md"
            style={{ background: `linear-gradient(135deg, ${previewColor(previewName)}, ${previewColor(previewName)}99)` }}
          >
            {getInitials(previewName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{previewName}</p>
            <p className="text-xs text-muted-foreground truncate">{accountName || "No account selected"}</p>
          </div>
        </div>

        <CrmFormSection icon={<ScrollText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Contract details">
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <CrmFieldLabel required>Contract name</CrmFieldLabel>
              <Input
                id="contract-name"
                placeholder="Master services agreement"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                data-testid="input-contract-name"
              />
            </div>
            <div className="space-y-1.5">
              <CrmFieldLabel>Account</CrmFieldLabel>
              <Select value={form.accountId || "none"} onValueChange={(v) => set("accountId", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-contract-account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CrmFieldGrid>
              <div className="space-y-1.5">
                <CrmFieldLabel>Type</CrmFieldLabel>
                <Select value={form.type} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger data-testid="select-contract-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="license">License</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <CrmFieldLabel>Status</CrmFieldLabel>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger data-testid="select-contract-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CrmFieldGrid>
          </div>
        </CrmFormSection>

        <CrmFormDivider />

        <CrmFormSection icon={<Calendar className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />} iconClassName="bg-violet-50 dark:bg-violet-950/40" title="Dates & value">
          <CrmFieldGrid className="mb-3.5">
            <div className="space-y-1.5">
              <CrmFieldLabel>Start date</CrmFieldLabel>
              <Input
                id="contract-start"
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                data-testid="input-contract-start-date"
              />
            </div>
            <div className="space-y-1.5">
              <CrmFieldLabel>End date</CrmFieldLabel>
              <Input
                id="contract-end"
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                data-testid="input-contract-end-date"
              />
            </div>
          </CrmFieldGrid>
          <div className="space-y-1.5">
            <CrmFieldLabel>Contract value (£)</CrmFieldLabel>
            <Input
              id="contract-value"
              type="number"
              placeholder="0"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              data-testid="input-contract-value"
            />
          </div>
        </CrmFormSection>

        <CrmFormDivider />

        <CrmFormSection icon={<Building2 className="h-3.5 w-3.5 text-muted-foreground" />} title="Terms & notes">
          <Textarea
            id="contract-terms"
            value={form.terms}
            onChange={(e) => set("terms", e.target.value)}
            rows={4}
            placeholder="Payment terms, renewal clauses, scope summary…"
            data-testid="input-contract-terms"
          />
        </CrmFormSection>

        <CrmFormDivider />

        <CrmFormSection
          icon={<FileText className="h-3.5 w-3.5 text-emerald-600" />}
          iconClassName="bg-emerald-50 dark:bg-emerald-950/40"
          title="Linked document"
          tag={form.documentId ? "Linked" : undefined}
        >
          <p className="text-xs text-muted-foreground mb-3">
            Link the signed agreement from the Documents module to enable sign-off workflows.
          </p>
          <DocumentLinkSelect
            value={form.documentId}
            onChange={(v) => set("documentId", v)}
            disabled={isPending}
            testId="contract-document-link"
          />
        </CrmFormSection>
      </div>
    </FormDialogShell>
  );
}
