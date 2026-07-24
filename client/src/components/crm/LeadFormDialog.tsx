import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import { CrmCustomFieldsForm } from "./CrmCustomFieldsForm";
import { CrmOwnerSelect } from "./CrmOwnerSelect";
import type { CrmCustomFieldDef } from "@/lib/crm-custom-fields";
import {
  CrmFieldGrid,
  CrmFieldLabel,
  CrmFormDivider,
  CrmFormSection,
  CrmScoreBar,
  formatCrmRecordMeta,
  MONDAY_FIELD_CONTROL,
} from "@/lib/crm-form-layout";
import { Building2, Clock, Settings2, StickyNote, Target, UserRound } from "lucide-react";
import { AccountDetailFormOverlay } from "./AccountDetailFormOverlay";
import { Button } from "@/components/ui/button";
import { loadLeadStatusOptions, loadLeadSourceOptions, loadLeadRatingOptions } from "@/lib/crm-lead-labels";

export type LeadFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  industry: string;
  website: string;
  description: string;
  source: string;
  status: string;
  score: string;
  rating: string;
  ownerUserId: string;
};

const EMPTY_FORM: LeadFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  title: "",
  industry: "",
  website: "",
  description: "",
  source: "",
  status: "new",
  score: "",
  rating: "",
  ownerUserId: "",
};

interface Props {
  open: boolean;
  onClose: () => void;
  editing: (Omit<LeadFormData, "score"> & {
    id: number;
    score?: number | null;
    customData?: Record<string, unknown> | null;
    createdAt?: string;
    updatedAt?: string;
  }) | null;
  onOpenCustomFieldsSettings?: () => void;
  stacked?: boolean;
  initialValues?: Partial<LeadFormData>;
  /** Called after a new lead is created (with the created lead payload). */
  onCreated?: (lead: { id: number }) => void;
}

export function LeadFormDialog({ open, onClose, editing, onOpenCustomFieldsSettings, stacked, initialValues, onCreated }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<LeadFormData>(EMPTY_FORM);
  const [customData, setCustomData] = useState<Record<string, unknown>>({});

  const { data: customFields = [] } = useQuery<CrmCustomFieldDef[]>({
    queryKey: ["/api/crm/custom-fields?entityType=lead"],
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        firstName: editing.firstName,
        lastName: editing.lastName,
        email: editing.email || "",
        phone: editing.phone || "",
        company: editing.company || "",
        title: editing.title || "",
        industry: editing.industry || "",
        website: editing.website || "",
        description: editing.description || "",
        source: editing.source || "",
        status: editing.status,
        score: editing.score != null ? String(editing.score) : "",
        rating: editing.rating || "",
        ownerUserId: editing.ownerUserId || "",
      });
      setCustomData((editing.customData as Record<string, unknown>) || {});
    } else {
      setForm({ ...EMPTY_FORM, ...initialValues });
      setCustomData({});
    }
  }, [open, editing, initialValues]);

  const createMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const res = await apiRequest("POST", "/api/crm/leads", {
        ...data,
        score: data.score ? parseInt(data.score, 10) : 0,
        rating: data.rating || null,
        customData,
      });
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Lead created successfully" });
      onCreated?.(lead);
      onClose();
    },
    onError: () => toast({ title: "Failed to create lead", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: LeadFormData) =>
      apiRequest("PUT", `/api/crm/leads/${editing!.id}`, {
        ...data,
        score: data.score ? parseInt(data.score, 10) : 0,
        rating: data.rating || null,
        customData,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Lead updated" });
      onClose();
    },
    onError: () => toast({ title: "Failed to update lead", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSubmit = !!form.firstName.trim() && !!form.lastName.trim();
  const subtitle = [form.firstName, form.lastName].filter(Boolean).join(" ") + (form.company ? ` · ${form.company}` : "");
  const numericScore = form.score ? Math.min(100, Math.max(0, parseInt(form.score, 10) || 0)) : 0;
  const nextFollowUp = String(customData._followUpDate || customData._nextFollowUpDate || "");
  const nextStep = String(customData._nextStep || "");

  const handleSubmit = () => {
    if (!canSubmit) return;
    editing ? updateMutation.mutate(form) : createMutation.mutate(form);
  };

  const setScore = (value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    setForm((f) => ({
      ...f,
      score: String(clamped),
      rating: clamped >= 80 ? "hot" : clamped >= 40 ? "warm" : clamped > 0 ? "cold" : f.rating,
    }));
  };

  const setCustom = (key: string, value: unknown) =>
    setCustomData((prev) => ({ ...prev, [key]: value }));

  const formBody = (
    <div className="space-y-0 [&_input]:h-9 [&_button[role=combobox]]:h-9">
        <CrmFormSection title="Contact" icon={<UserRound className="h-3 w-3" />} iconClassName="bg-[#f5f6f8] text-[#676879]">
          <CrmFieldGrid className="mb-3">
            <div className="space-y-1">
              <CrmFieldLabel required>First name</CrmFieldLabel>
              <Input id="firstName" placeholder="Jane" className={MONDAY_FIELD_CONTROL} value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} data-testid="input-lead-firstName" />
            </div>
            <div className="space-y-1">
              <CrmFieldLabel required>Last name</CrmFieldLabel>
              <Input id="lastName" placeholder="Smith" className={MONDAY_FIELD_CONTROL} value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} data-testid="input-lead-lastName" />
            </div>
          </CrmFieldGrid>
          <CrmFieldGrid className="mb-3">
            <div className="space-y-1">
              <CrmFieldLabel>Title</CrmFieldLabel>
              <Input id="title" placeholder="Chief Digital Officer" className={MONDAY_FIELD_CONTROL} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} data-testid="input-lead-title" />
            </div>
            <div className="space-y-1">
              <CrmFieldLabel required>Company</CrmFieldLabel>
              <Input id="company" placeholder="Global Retail Corp" className={MONDAY_FIELD_CONTROL} value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} data-testid="input-lead-company" />
            </div>
          </CrmFieldGrid>
          <CrmFieldGrid>
            <div className="space-y-1">
              <CrmFieldLabel required>Email</CrmFieldLabel>
              <Input id="email" type="email" placeholder="jane@company.com" className={MONDAY_FIELD_CONTROL} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} data-testid="input-lead-email" />
            </div>
            <div className="space-y-1">
              <CrmFieldLabel>Phone</CrmFieldLabel>
              <Input id="phone" placeholder="+44 7700 900123" className={MONDAY_FIELD_CONTROL} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} data-testid="input-lead-phone" />
            </div>
          </CrmFieldGrid>
        </CrmFormSection>

        <CrmFormDivider />

        <CrmFormSection title="Qualification" icon={<Target className="h-3 w-3" />} iconClassName="bg-[#f5f6f8] text-[#676879]">
          <CrmFieldGrid cols={3} className="mb-3">
            <div className="space-y-1">
              <CrmFieldLabel>Rating</CrmFieldLabel>
              <Select value={form.rating || "none"} onValueChange={(v) => setForm((f) => ({ ...f, rating: v === "none" ? "" : v }))}>
                <SelectTrigger className={cn(MONDAY_FIELD_CONTROL, "w-full")} data-testid="select-lead-rating">
                  <SelectValue placeholder="Select rating…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No rating</SelectItem>
                  {loadLeadRatingOptions().map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className={cn("inline-flex min-h-[22px] px-2 rounded-[4px] text-[12px] font-medium", o.color)}>
                        {o.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <CrmFieldLabel>Lead score</CrmFieldLabel>
              <CrmScoreBar value={numericScore} onChange={setScore} />
            </div>
            <div className="space-y-1">
              <CrmFieldLabel>Status</CrmFieldLabel>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className={cn(MONDAY_FIELD_CONTROL, "w-full")} data-testid="select-lead-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {loadLeadStatusOptions()
                    .filter((s) => s.value !== "converted")
                    .map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className={cn("inline-flex min-h-[22px] px-2 rounded-[4px] text-[12px] font-medium", s.color)}>
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CrmFieldGrid>
          <CrmFieldGrid>
            <div className="space-y-1">
              <CrmFieldLabel>Lead source</CrmFieldLabel>
              <Select value={form.source || "none"} onValueChange={(v) => setForm((f) => ({ ...f, source: v === "none" ? "" : v }))}>
                <SelectTrigger className={cn(MONDAY_FIELD_CONTROL, "w-full")} data-testid="select-lead-source"><SelectValue placeholder="Select source…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select source…</SelectItem>
                  {loadLeadSourceOptions().map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <CrmFieldLabel>Tags</CrmFieldLabel>
              <Input
                placeholder="e.g. Enterprise, Renewal risk"
                className={MONDAY_FIELD_CONTROL}
                value={String(customData._tags || "")}
                onChange={(e) => setCustom("_tags", e.target.value || undefined)}
              />
            </div>
          </CrmFieldGrid>
        </CrmFormSection>

        <CrmFormDivider />

        <CrmFormSection title="Company details" icon={<Building2 className="h-3 w-3" />} iconClassName="bg-[#f5f6f8] text-[#676879]">
          <CrmFieldGrid className="mb-3">
            <div className="space-y-1">
              <CrmFieldLabel>Industry</CrmFieldLabel>
              <Input id="industry" placeholder="Retail" className={MONDAY_FIELD_CONTROL} value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} data-testid="input-lead-industry" />
            </div>
            <div className="space-y-1">
              <CrmFieldLabel>Company size</CrmFieldLabel>
              <Select
                value={String(customData._companySize || "none")}
                onValueChange={(v) => setCustom("_companySize", v === "none" ? undefined : v)}
              >
                <SelectTrigger className={cn(MONDAY_FIELD_CONTROL, "w-full")}><SelectValue placeholder="Select size…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select size…</SelectItem>
                  <SelectItem value="1-10">1–10</SelectItem>
                  <SelectItem value="11-50">11–50</SelectItem>
                  <SelectItem value="51-200">51–200</SelectItem>
                  <SelectItem value="201-1000">201–1,000</SelectItem>
                  <SelectItem value="1001-5000">1,001–5,000</SelectItem>
                  <SelectItem value="5000+">5,000+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CrmFieldGrid>
          <CrmFieldGrid>
            <div className="space-y-1">
              <CrmFieldLabel>Website</CrmFieldLabel>
              <Input id="website" placeholder="https://company.com" className={MONDAY_FIELD_CONTROL} value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} data-testid="input-lead-website" />
            </div>
            <div className="space-y-1">
              <CrmFieldLabel>Country / region</CrmFieldLabel>
              <Input
                placeholder="e.g. United States"
                className={MONDAY_FIELD_CONTROL}
                value={String(customData._country || "")}
                onChange={(e) => setCustom("_country", e.target.value || undefined)}
              />
            </div>
          </CrmFieldGrid>
        </CrmFormSection>

        <CrmFormDivider />

        <CrmFormSection title="Ownership & follow-up" icon={<Clock className="h-3 w-3" />} iconClassName="bg-[#f5f6f8] text-[#676879]">
          <CrmFieldGrid className="mb-3">
            <div className="space-y-1">
              <CrmOwnerSelect
                value={form.ownerUserId}
                onChange={(v) => setForm((f) => ({ ...f, ownerUserId: v }))}
                testId="select-lead-owner"
                className={cn(!form.ownerUserId && "[&_button]:border-[#fdab3d]")}
              />
              {!form.ownerUserId && (
                <p className="text-[12px] text-[#fdab3d] flex items-center gap-1">
                  This lead has no owner assigned
                </p>
              )}
            </div>
            <div className="space-y-1">
              <CrmFieldLabel>Last contacted</CrmFieldLabel>
              <Input
                type="date"
                className={MONDAY_FIELD_CONTROL}
                value={String(customData._lastContacted || "")}
                onChange={(e) => setCustom("_lastContacted", e.target.value || undefined)}
              />
            </div>
          </CrmFieldGrid>
          <div className="rounded-[4px] border border-[#d0d4e4] bg-[#f5f6f8] p-3 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1">
              <CrmFieldLabel>
                Next follow-up{" "}
                <span className="ml-1 text-[10px] font-medium text-white bg-[#0073ea] px-1.5 py-0.5 rounded-[3px]">Recommended</span>
              </CrmFieldLabel>
              <Input
                type="date"
                className={MONDAY_FIELD_CONTROL}
                value={nextFollowUp}
                onChange={(e) => {
                  const v = e.target.value || undefined;
                  setCustomData((prev) => {
                    const next = { ...prev };
                    if (v) next._followUpDate = v;
                    else delete next._followUpDate;
                    // Migrate away from legacy key so table/board/gantt stay in sync
                    delete next._nextFollowUpDate;
                    return next;
                  });
                }}
              />
            </div>
            <div className="flex-1 space-y-1">
              <CrmFieldLabel>Next step</CrmFieldLabel>
              <Input className={MONDAY_FIELD_CONTROL} placeholder="e.g. Send proposal, schedule demo" value={nextStep} onChange={(e) => setCustom("_nextStep", e.target.value || undefined)} />
            </div>
          </div>
        </CrmFormSection>

        <CrmFormDivider />

        <CrmFormSection title="Notes" icon={<StickyNote className="h-3 w-3" />} iconClassName="bg-[#f5f6f8] text-[#676879]">
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
            placeholder="Context, next steps, or relationship history…"
            className="rounded-[4px] border-[#c5c7d0] text-[14px] focus-visible:ring-1 focus-visible:ring-[#0073ea] focus-visible:border-[#0073ea]"
            data-testid="input-lead-description"
          />
        </CrmFormSection>

        <CrmFormDivider />

        <CrmFormSection
          title="Custom fields"
          icon={<Settings2 className="h-3 w-3" />}
          iconClassName="bg-[#f5f6f8] text-[#676879]"
          tag={customFields.length > 0 ? `${customFields.filter((f) => customData[f.fieldName] != null && customData[f.fieldName] !== "").length} of ${customFields.length} used` : undefined}
        >
          {customFields.length === 0 ? (
            <div className="rounded-[4px] border border-dashed border-[#c5c7d0] bg-[#f5f6f8] p-5 text-center">
              <p className="text-[14px] font-medium text-[#323338] mb-1">No custom fields yet</p>
              <p className="text-[13px] text-[#676879] mb-3 max-w-sm mx-auto">
                Add user-defined fields for leads in Settings → CRM Fields.
              </p>
              {onOpenCustomFieldsSettings && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 border-[#c5c7d0] text-[#0073ea]" onClick={onOpenCustomFieldsSettings}>
                  <Settings2 className="h-3.5 w-3.5" />
                  Open CRM field settings
                </Button>
              )}
            </div>
          ) : (
            <CrmCustomFieldsForm
              entityType="lead"
              values={customData}
              onChange={(k, v) => setCustomData((prev) => ({ ...prev, [k]: v }))}
              embedded
            />
          )}
        </CrmFormSection>
    </div>
  );

  if (stacked) {
    return (
      <AccountDetailFormOverlay open={open} onClose={onClose} title="" hideHeader testId="lead-form-overlay">
        <FormDialogShell
          open={open}
          onOpenChange={(v) => !v && onClose()}
          title={editing ? "Edit lead" : "Create new lead"}
          subtitle={subtitle.trim() || undefined}
          meta={
            editing
              ? formatCrmRecordMeta(editing.createdAt, editing.updatedAt) || (canSubmit ? "Ready to save" : "First and last name required")
              : canSubmit ? "Ready to save" : "First and last name required"
          }
          saveLabel={editing ? "Update lead" : "Create lead"}
          onCancel={onClose}
          onSubmit={handleSubmit}
          saving={isPending}
          disabled={!canSubmit}
          saveTestId="button-save-lead"
          size="md"
          bodyClassName="max-h-[72vh]"
          testId="lead-form-overlay"
        >
          {formBody}
        </FormDialogShell>
      </AccountDetailFormOverlay>
    );
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={editing ? "Edit lead" : "Create new lead"}
      subtitle={subtitle.trim() || undefined}
      meta={
        editing
          ? formatCrmRecordMeta(editing.createdAt, editing.updatedAt) || (canSubmit ? "Ready to save" : "First and last name required")
          : canSubmit ? "Ready to save" : "First and last name required"
      }
      saveLabel={editing ? "Update lead" : "Create lead"}
      onCancel={onClose}
      onSubmit={handleSubmit}
      saving={isPending}
      disabled={!canSubmit}
      saveTestId="button-save-lead"
      size="md"
      bodyClassName="max-h-[72vh]"
    >
      {formBody}
    </FormDialogShell>
  );
}
