import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CrmCustomFieldsForm } from "./CrmCustomFieldsForm";
import { ContactRelationshipsPanel } from "./ContactRelationshipsPanel";
import { AccountDetailFormOverlay } from "./AccountDetailFormOverlay";
import { Button } from "@/components/ui/button";
import type { CrmCustomFieldDef } from "@/lib/crm-custom-fields";
import {
  CrmFieldGrid,
  CrmFieldLabel,
  CrmFormDivider,
  CrmFormSection,
  formatCrmRecordMeta,
} from "@/lib/crm-form-layout";
import { Building2, Settings2, Sparkles, UserRound, Users } from "lucide-react";
import type { CrmAccountPicklist } from "./types";

export type ContactFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  accountId: string;
  role: string;
};

export const EMPTY_CONTACT_FORM: ContactFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  title: "",
  accountId: "",
  role: "contact",
};

type ContactRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  accountId: number | null;
  role: string | null;
  customData?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

const ROLE_OPTIONS = [
  { value: "primary", label: "Primary contact" },
  { value: "decision_maker", label: "Decision maker" },
  { value: "technical", label: "Technical" },
  { value: "contact", label: "Contact" },
];

function contactToForm(c: ContactRecord): ContactFormData {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email || "",
    phone: c.phone || "",
    title: c.title || "",
    accountId: c.accountId ? String(c.accountId) : "",
    role: c.role || "contact",
  };
}

function formToPayload(data: ContactFormData, customData: Record<string, unknown>) {
  return {
    ...data,
    accountId: data.accountId ? parseInt(data.accountId, 10) : null,
    customData,
  };
}

function previewColor(name: string): string {
  const colors = ["#0ea5e9", "#6366f1", "#22c55e", "#f97316", "#ec4899"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(first: string, last: string): string {
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase() || "C";
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing: ContactRecord | null;
  accounts: CrmAccountPicklist[];
  contacts?: ContactRecord[];
  initialAccountId?: string;
  onOpenCustomFieldsSettings?: () => void;
  stacked?: boolean;
}

export function ContactFormDialog({
  open,
  onClose,
  editing,
  accounts,
  contacts = [],
  initialAccountId,
  onOpenCustomFieldsSettings,
  stacked,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<ContactFormData>(EMPTY_CONTACT_FORM);
  const [customData, setCustomData] = useState<Record<string, unknown>>({});

  const { data: customFields = [] } = useQuery<CrmCustomFieldDef[]>({
    queryKey: ["/api/crm/custom-fields?entityType=contact"],
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm(contactToForm(editing));
      setCustomData((editing.customData as Record<string, unknown>) || {});
    } else {
      setForm({ ...EMPTY_CONTACT_FORM, accountId: initialAccountId || "" });
      setCustomData({});
    }
  }, [open, editing, initialAccountId]);

  const createMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof formToPayload>) => {
      const res = await apiRequest("POST", "/api/crm/contacts", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Contact created successfully" });
      onClose();
    },
    onError: () => toast({ title: "Failed to create contact", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ReturnType<typeof formToPayload> }) => {
      const res = await apiRequest("PUT", `/api/crm/contacts/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Contact updated" });
      onClose();
    },
    onError: () => toast({ title: "Failed to update contact", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSubmit = !!form.firstName.trim() && !!form.lastName.trim();
  const previewName = `${form.firstName} ${form.lastName}`.trim() || "New contact";
  const accountName = accounts.find((a) => String(a.id) === form.accountId)?.name;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const payload = formToPayload(form, customData);
    if (editing) updateMutation.mutate({ id: editing.id, payload });
    else createMutation.mutate(payload);
  };

  const set = (key: keyof ContactFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const formBody = (
    <div className="space-y-0">
      <div className="rounded-xl border bg-gradient-to-br from-[#0ea5e9]/10 via-background to-background p-4 mb-5 flex items-center gap-3">
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md"
          style={{ background: `linear-gradient(135deg, ${previewColor(previewName)}, ${previewColor(previewName)}99)` }}
        >
          {getInitials(form.firstName, form.lastName)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{previewName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {form.title || "No title"}
            {accountName ? ` · ${accountName}` : ""}
          </p>
        </div>
      </div>

      <CrmFormSection icon={<UserRound className="h-3.5 w-3.5 text-blue-600" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Contact details">
        <CrmFieldGrid className="mb-3.5">
          <div className="space-y-1.5">
            <CrmFieldLabel required>First name</CrmFieldLabel>
            <Input
              id="contact-firstName"
              placeholder="Jane"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              data-testid="input-contact-firstName"
            />
          </div>
          <div className="space-y-1.5">
            <CrmFieldLabel required>Last name</CrmFieldLabel>
            <Input
              id="contact-lastName"
              placeholder="Smith"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              data-testid="input-contact-lastName"
            />
          </div>
        </CrmFieldGrid>
        <CrmFieldGrid className="mb-3.5">
          <div className="space-y-1.5">
            <CrmFieldLabel>Email</CrmFieldLabel>
            <Input
              id="contact-email"
              type="email"
              placeholder="jane@company.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              data-testid="input-contact-email"
            />
          </div>
          <div className="space-y-1.5">
            <CrmFieldLabel>Phone</CrmFieldLabel>
            <Input
              id="contact-phone"
              placeholder="+44 7700 900123"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              data-testid="input-contact-phone"
            />
          </div>
        </CrmFieldGrid>
        <div className="space-y-1.5">
          <CrmFieldLabel>Job title</CrmFieldLabel>
          <Input
            id="contact-title"
            placeholder="e.g. IT Manager"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            data-testid="input-contact-title"
          />
        </div>
      </CrmFormSection>

      <CrmFormDivider />

      <CrmFormSection icon={<Building2 className="h-3.5 w-3.5 text-emerald-600" />} iconClassName="bg-emerald-50 dark:bg-emerald-950/40" title="Account & role">
        <CrmFieldGrid>
          <div className="space-y-1.5">
            <CrmFieldLabel>Account</CrmFieldLabel>
            <Select value={form.accountId || "none"} onValueChange={(v) => set("accountId", v === "none" ? "" : v)}>
              <SelectTrigger data-testid="select-contact-account">
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
          <div className="space-y-1.5">
            <CrmFieldLabel>Role</CrmFieldLabel>
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger data-testid="select-contact-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CrmFieldGrid>
      </CrmFormSection>

      <CrmFormDivider />

      <CrmFormSection
        icon={<Sparkles className="h-3.5 w-3.5 text-amber-600" />}
        iconClassName="bg-amber-50 dark:bg-amber-950/40"
        title="Custom fields"
        tag={customFields.length > 0 ? `${customFields.filter((f) => customData[f.fieldName] != null && customData[f.fieldName] !== "").length} of ${customFields.length} used` : undefined}
      >
        {customFields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-blue-300/60 bg-blue-50/50 dark:bg-blue-950/20 p-6 text-center">
            <p className="text-sm font-semibold mb-1">No custom fields yet</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
              Add user-defined fields for contacts in Settings → CRM Fields.
            </p>
            {onOpenCustomFieldsSettings && (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onOpenCustomFieldsSettings}>
                <Settings2 className="h-3.5 w-3.5" />
                Open CRM field settings
              </Button>
            )}
          </div>
        ) : (
          <CrmCustomFieldsForm
            entityType="contact"
            values={customData}
            onChange={(k, v) => setCustomData((prev) => ({ ...prev, [k]: v }))}
            embedded
          />
        )}
      </CrmFormSection>

      {editing && (
        <>
          <CrmFormDivider />
          <CrmFormSection icon={<Users className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />} iconClassName="bg-violet-50 dark:bg-violet-950/40" title="Relationships">
            <p className="text-xs text-muted-foreground mb-3">
              Reporting lines and stakeholder links must stay within the same account.
            </p>
            <ContactRelationshipsPanel
              contactId={editing.id}
              contacts={contacts}
              accounts={accounts}
              embedded
            />
          </CrmFormSection>
        </>
      )}
    </div>
  );

  const shell = (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={editing ? "Edit contact" : "Create new contact"}
      subtitle={[previewName, form.title || "", accountName || ""].filter(Boolean).join(" · ")}
      meta={
        editing
          ? formatCrmRecordMeta(editing.createdAt, editing.updatedAt) || (canSubmit ? "Ready to save" : "First and last name required")
          : canSubmit ? "Ready to save" : "First and last name required"
      }
      saveLabel={editing ? "Save changes" : "Create contact"}
      onCancel={onClose}
      onSubmit={handleSubmit}
      saving={isPending}
      disabled={!canSubmit}
      saveTestId="button-save-contact"
      size="md"
      bodyClassName="max-h-[72vh]"
      testId={stacked ? "contact-form-overlay" : undefined}
    >
      {formBody}
    </FormDialogShell>
  );

  if (stacked) {
    return (
      <AccountDetailFormOverlay open={open} onClose={onClose} title="" hideHeader testId="contact-form-overlay">
        {shell}
      </AccountDetailFormOverlay>
    );
  }

  return shell;
}
