import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  EMPTY_OPPORTUNITY_FORM,
  OPPORTUNITY_SOURCES,
  RECURRING_FREQUENCIES,
  calcGpPercent,
  formToOpportunityPayload,
  opportunityToForm,
  type OpportunityFormData,
} from "@/lib/crm-form";
import { CrmCustomFieldsForm } from "./CrmCustomFieldsForm";
import { CrmOwnerSelect } from "./CrmOwnerSelect";
import { useCrmCustomFields } from "@/hooks/use-crm-custom-fields";
import { findSegmentField, getSegmentColor, resolveAccountSegment } from "@/lib/crm-segment";
import type { CrmCustomFieldDef } from "@/lib/crm-custom-fields";
import {
  CrmDealTypeToggle,
  CrmFieldGrid,
  CrmFieldLabel,
  CrmForecastCategoryPills,
  CrmForecastZone,
  CrmFormDivider,
  CrmFormSection,
  CrmProbBar,
  CrmStageChips,
  formatCrmRecordMeta,
  formatWeightedForecast,
} from "@/lib/crm-form-layout";
import { BarChart3, Briefcase, Clock, DollarSign, Loader2, Plus, Settings2, Sparkles, StickyNote, Target, Trophy, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

type Stage = { id: number; name: string; probability?: number | null; pipelineId?: number | null; order?: number };
type Account = {
  id: number;
  name: string;
  annualRevenue?: string | null;
  customData?: Record<string, unknown> | null;
};
type Contact = { id: number; firstName: string; lastName: string; accountId: number | null };

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Record<string, unknown> | null;
  stages: Stage[];
  accounts: Account[];
  contacts: Contact[];
  initialStageId?: string;
  initialAccountId?: string;
  onOpenCustomFieldsSettings?: () => void;
  onNavigateToResourcePlan?: (opportunityId: number, planId?: number | null) => void;
}

export function OpportunityFormDialog({
  open,
  onClose,
  editing,
  stages,
  accounts,
  contacts,
  initialStageId,
  initialAccountId,
  onOpenCustomFieldsSettings,
  onNavigateToResourcePlan,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<OpportunityFormData>(EMPTY_OPPORTUNITY_FORM);
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const [dealMode, setDealMode] = useState<"onetime" | "subscription">("onetime");

  const { data: customFields = [] } = useQuery<CrmCustomFieldDef[]>({
    queryKey: ["/api/crm/custom-fields?entityType=opportunity"],
    enabled: open,
  });
  const { fields: accountCustomFields } = useCrmCustomFields("account");
  const segmentField = useMemo(() => findSegmentField(accountCustomFields), [accountCustomFields]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const nextForm = opportunityToForm(editing);
      setForm(nextForm);
      const cd = (editing.customData as Record<string, unknown>) || {};
      setCustomData(cd);
      setDealMode(
        nextForm.recurringAmount || nextForm.recurringFrequency || nextForm.type === "renewal"
          ? "subscription"
          : "onetime",
      );
    } else {
      const base = { ...EMPTY_OPPORTUNITY_FORM };
      if (initialAccountId) base.accountId = initialAccountId;
      if (initialStageId) {
        base.stageId = initialStageId;
        const stage = stages.find((s) => String(s.id) === initialStageId);
        if (stage?.probability != null) base.probability = String(stage.probability);
      } else if (stages.length > 0) {
        base.stageId = String(stages[0].id);
        if (stages[0].probability != null) base.probability = String(stages[0].probability);
      }
      setForm(base);
      setCustomData({});
      setDealMode("onetime");
    }
  }, [open, editing, initialStageId, initialAccountId, stages]);

  const createMutation = useMutation({
    mutationFn: (data: OpportunityFormData) =>
      apiRequest("POST", "/api/crm/opportunities", formToOpportunityPayload(data, customData)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard-stats"] });
      toast({ title: "Opportunity created successfully" });
      onClose();
    },
    onError: () => toast({ title: "Failed to create opportunity", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: OpportunityFormData }) =>
      apiRequest("PUT", `/api/crm/opportunities/${id}`, formToOpportunityPayload(data, customData)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard-stats"] });
      toast({ title: "Opportunity updated" });
      onClose();
    },
    onError: () => toast({ title: "Failed to update opportunity", variant: "destructive" }),
  });

  const addStageMutation = useMutation({
    mutationFn: async (payload: { name: string; probability: number; pipelineId: number | null; order: number }) => {
      const res = await apiRequest("POST", "/api/crm/stages", payload);
      return res.json() as Promise<Stage>;
    },
    onSuccess: (stage: Stage) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stages"] });
      handleStageChange(String(stage.id));
      toast({ title: "Stage added" });
    },
    onError: () => toast({ title: "Failed to add stage", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const editingOppId = editing?.id ? Number(editing.id) : null;

  const { data: resourcePlans = [], isLoading: resourcePlansLoading } = useQuery<Array<{ id: number; planName: string }>>({
    queryKey: editingOppId ? [`/api/crm/opportunities/${editingOppId}/resource-plans`] : ["/api/crm/opportunities/0/resource-plans?disabled=1"],
    enabled: open && !!editingOppId,
  });

  const createResourcePlanMutation = useMutation({
    mutationFn: async () => {
      if (!editingOppId) throw new Error("Save opportunity first");
      const res = await apiRequest("POST", `/api/crm/opportunities/${editingOppId}/resource-plan`, {
        createNew: true,
        planName: `${form.name.trim() || "Opportunity"} — Resource Plan`,
        rows: [],
      });
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/opportunities/${editingOppId}/resource-plans`] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/resource-plans/summaries"] });
      toast({ title: "Resource plan created" });
      onNavigateToResourcePlan?.(editingOppId!, plan.id);
    },
    onError: () => toast({ title: "Failed to create resource plan", variant: "destructive" }),
  });

  const canSubmit = !!form.name.trim();
  const accountName = accounts.find((a) => a.id === parseInt(form.accountId))?.name;
  const selectedAccount = accounts.find((a) => a.id === parseInt(form.accountId));
  const accountSegment = selectedAccount ? resolveAccountSegment(selectedAccount, segmentField) : null;
  const numericProb = form.probability ? Math.min(100, Math.max(0, parseInt(form.probability, 10) || 0)) : 0;
  const gpPct = calcGpPercent(
    form.revenue ? parseFloat(form.revenue) : null,
    form.grossProfit ? parseFloat(form.grossProfit) : null,
  );
  const forecastCategory = String(customData.forecastCategory || "best_case");
  const weightedValue = formatWeightedForecast(form.amount, numericProb);

  const accountContacts = form.accountId
    ? contacts.filter((c) => c.accountId === parseInt(form.accountId))
    : contacts;

  const set = (key: keyof OpportunityFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleStageChange = (stageId: string) => {
    const stage = stages.find((s) => String(s.id) === stageId);
    setForm((prev) => ({
      ...prev,
      stageId,
      probability: stage?.probability != null ? String(stage.probability) : prev.probability,
    }));
  };

  const handleAddStage = (name: string, probability: number) => {
    const pipelineId = stages[0]?.pipelineId ?? null;
    const order = stages.length > 0 ? Math.max(...stages.map((s) => s.order ?? 0)) + 1 : 0;
    addStageMutation.mutate({ name, probability, pipelineId, order });
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (editing?.id) {
      updateMutation.mutate({ id: Number(editing.id), data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const setCustom = (key: string, value: unknown) =>
    setCustomData((prev) => ({ ...prev, [key]: value }));

  const createdMeta = editing
    ? formatCrmRecordMeta(String(editing.createdAt || ""), String(editing.updatedAt || ""))
    : "All forecast figures roll up into Revenue Forecasting reports";

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={editing ? "Edit opportunity" : "Create new opportunity"}
      subtitle={
        editing
          ? [form.name.trim(), accountName].filter(Boolean).join(" · ") || undefined
          : "Fields marked with a section badge can host custom fields"
      }
      meta={createdMeta || (canSubmit ? "Ready to save" : "Opportunity name required")}
      saveLabel={editing ? "Update opportunity" : "Create opportunity"}
      onCancel={onClose}
      onSubmit={handleSubmit}
      saving={isPending}
      disabled={!canSubmit}
      saveTestId="button-save-opp"
      size="lg"
    >
      <div className="space-y-0">
            <div className="space-y-1.5 mb-3">
              <CrmFieldLabel required>Opportunity name</CrmFieldLabel>
              <Input
                id="opp-name"
                placeholder="e.g. Global Retail Corp — Enterprise Platform Rollout"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="text-base font-bold h-12"
                data-testid="input-opp-name"
              />
            </div>

            <CrmFieldGrid className="mb-2">
              <div className="space-y-1.5">
                <CrmFieldLabel required>Account</CrmFieldLabel>
                <Select value={form.accountId || "none"} onValueChange={(v) => setForm((prev) => ({ ...prev, accountId: v === "none" ? "" : v, contactId: "" }))}>
                  <SelectTrigger data-testid="select-opp-account"><SelectValue placeholder="Select account…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select account…</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <CrmFieldLabel>Contact</CrmFieldLabel>
                <Select value={form.contactId || "none"} onValueChange={(v) => set("contactId", v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-opp-contact"><SelectValue placeholder="Select contact…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select contact…</SelectItem>
                    {accountContacts.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CrmFieldGrid>

            {accountSegment && (
              <p className="text-xs mb-3">
                Segment:{" "}
                <span className="font-semibold" style={{ color: getSegmentColor(accountSegment) }}>{accountSegment}</span>
              </p>
            )}

            <CrmFormDivider />

            <CrmDealTypeToggle
              mode={dealMode}
              onChange={(mode) => {
                setDealMode(mode);
                if (mode === "onetime") {
                  setForm((prev) => ({ ...prev, recurringAmount: "", recurringFrequency: "" }));
                }
              }}
            />

            <CrmForecastZone>
              <div className="flex items-center gap-2 mb-3.5">
                <div className="w-[22px] h-[22px] rounded-md bg-white/70 flex items-center justify-center">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-700" />
                </div>
                <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Deal forecast</h3>
                <span className="text-[10px] text-violet-700 dark:text-violet-400 font-semibold ml-auto">Drives revenue forecasting</span>
              </div>

              <CrmFieldGrid cols={3} className="mb-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Deal value *</label>
                  <div className="flex gap-1.5">
                    <Input type="text" readOnly value="$" className="w-14 font-semibold text-center px-1" />
                    <Input
                      id="opp-amount"
                      type="number"
                      placeholder="0"
                      value={form.amount}
                      onChange={(e) => set("amount", e.target.value)}
                      className="font-bold text-[15px] border-indigo-200"
                      data-testid="input-opp-amount"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Win probability</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.probability}
                    onChange={(e) => set("probability", e.target.value)}
                    className="font-bold text-[15px] border-indigo-200"
                    data-testid="input-opp-probability"
                  />
                  <CrmProbBar value={numericProb} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Expected close date</label>
                  <Input
                    id="opp-close"
                    type="date"
                    value={form.expectedCloseDate}
                    onChange={(e) => set("expectedCloseDate", e.target.value)}
                    className="font-bold border-indigo-200"
                    data-testid="input-opp-close-date"
                  />
                </div>
              </CrmFieldGrid>

              <div className="flex items-center justify-between bg-white/60 dark:bg-background/40 rounded-lg px-3.5 py-2.5">
                <span className="text-[11px] font-bold text-violet-800 dark:text-violet-300 uppercase tracking-wide">Weighted forecast value</span>
                <span className="text-lg font-extrabold text-violet-800 dark:text-violet-300 tabular-nums">{weightedValue}</span>
              </div>

              <div className="mt-3.5">
                <label className="text-[11px] font-bold text-violet-800 dark:text-violet-300 uppercase tracking-wide block mb-1.5">Forecast category</label>
                <CrmForecastCategoryPills
                  value={forecastCategory}
                  onChange={(v) => setCustom("forecastCategory", v)}
                />
              </div>
            </CrmForecastZone>

            <CrmFormDivider />

            <CrmFormSection icon={<Clock className="h-3.5 w-3.5 text-teal-600" />} iconClassName="bg-teal-50 dark:bg-teal-950/40" title="Stage" tag="Custom stages supported">
              <CrmStageChips
                stages={stages}
                value={form.stageId}
                onChange={handleStageChange}
                onAddStage={handleAddStage}
                addingStage={addStageMutation.isPending}
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                Stages drive the default win probability shown above.
              </p>
            </CrmFormSection>

            {dealMode === "subscription" && (
              <>
                <CrmFormDivider />
                <CrmFormSection icon={<Target className="h-3.5 w-3.5 text-violet-600" />} iconClassName="bg-violet-50 dark:bg-violet-950/40" title="Subscription details">
                  <CrmFieldGrid>
                    <div className="space-y-1.5">
                      <CrmFieldLabel>Recurring amount</CrmFieldLabel>
                      <Input id="opp-recurring" type="number" value={form.recurringAmount} onChange={(e) => set("recurringAmount", e.target.value)} data-testid="input-opp-recurring" />
                    </div>
                    <div className="space-y-1.5">
                      <CrmFieldLabel>Recurring frequency</CrmFieldLabel>
                      <Select value={form.recurringFrequency || "none"} onValueChange={(v) => set("recurringFrequency", v === "none" ? "" : v)}>
                        <SelectTrigger data-testid="select-opp-recurring-freq"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select</SelectItem>
                          {RECURRING_FREQUENCIES.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CrmFieldGrid>
                </CrmFormSection>
              </>
            )}

            <CrmFormDivider />

            <CrmFormSection icon={<DollarSign className="h-3.5 w-3.5 text-emerald-600" />} iconClassName="bg-emerald-50 dark:bg-emerald-950/40" title="Financials">
              <CrmFieldGrid cols={3}>
                <div className="space-y-1.5">
                  <CrmFieldLabel>Revenue</CrmFieldLabel>
                  <Input id="opp-revenue" type="number" value={form.revenue} onChange={(e) => set("revenue", e.target.value)} data-testid="input-opp-revenue" />
                </div>
                <div className="space-y-1.5">
                  <CrmFieldLabel>Gross profit</CrmFieldLabel>
                  <Input id="opp-gp" type="number" value={form.grossProfit} onChange={(e) => set("grossProfit", e.target.value)} data-testid="input-opp-gross-profit" />
                </div>
                <div className="space-y-1.5">
                  <CrmFieldLabel>GP %</CrmFieldLabel>
                  <Input readOnly value={gpPct != null ? `${gpPct}%` : "—"} className="bg-muted" data-testid="input-opp-gp-pct" />
                </div>
              </CrmFieldGrid>
            </CrmFormSection>

            <CrmFormDivider />

            <CrmFormSection icon={<Target className="h-3.5 w-3.5 text-amber-600" />} iconClassName="bg-amber-50 dark:bg-amber-950/40" title="Source & competitive landscape">
              <CrmFieldGrid className="mb-3.5">
                <div className="space-y-1.5">
                  <CrmFieldLabel>Source</CrmFieldLabel>
                  <Select value={form.source || "none"} onValueChange={(v) => set("source", v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-opp-source"><SelectValue placeholder="Select source…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select source…</SelectItem>
                      {OPPORTUNITY_SOURCES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <CrmFieldLabel>Next step</CrmFieldLabel>
                  <Input id="opp-next-step" value={form.nextStep} onChange={(e) => set("nextStep", e.target.value)} data-testid="input-opp-next-step" />
                </div>
              </CrmFieldGrid>
              <div className="space-y-1.5">
                <CrmFieldLabel>Competitor</CrmFieldLabel>
                <Input id="opp-competitor" placeholder="Competing vendor or solution" value={form.competitor} onChange={(e) => set("competitor", e.target.value)} data-testid="input-opp-competitor" />
              </div>
            </CrmFormSection>

            <CrmFormDivider />

            <CrmFormSection icon={<UserRound className="h-3.5 w-3.5 text-blue-600" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Ownership">
              <CrmFieldGrid>
                <CrmOwnerSelect value={form.ownerUserId} onChange={(v) => set("ownerUserId", v)} testId="select-opp-owner" />
                <div className="space-y-1.5">
                  <CrmFieldLabel>Created</CrmFieldLabel>
                  <Input
                    readOnly
                    value={
                      editing?.createdAt
                        ? new Date(String(editing.createdAt)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "Today"
                    }
                    className="bg-muted text-muted-foreground"
                  />
                </div>
              </CrmFieldGrid>
            </CrmFormSection>

            <CrmFormDivider />

            <CrmFormSection icon={<Trophy className="h-3.5 w-3.5 text-muted-foreground" />} title="Outcome" tag="Complete when deal closes">
              <CrmFieldGrid className="mb-3.5">
                <div className="space-y-1.5">
                  <CrmFieldLabel>Actual close date</CrmFieldLabel>
                  <Input id="opp-actual-close" type="date" value={form.actualCloseDate} onChange={(e) => set("actualCloseDate", e.target.value)} data-testid="input-opp-actual-close" />
                </div>
                <div className="space-y-1.5">
                  <CrmFieldLabel>&nbsp;</CrmFieldLabel>
                  <Input readOnly placeholder="Set automatically when stage = Closed" className="bg-muted text-muted-foreground text-xs" />
                </div>
              </CrmFieldGrid>
              <CrmFieldGrid>
                <div className="space-y-1.5">
                  <CrmFieldLabel>Win reason</CrmFieldLabel>
                  <Input id="opp-win" value={form.winReason} onChange={(e) => set("winReason", e.target.value)} data-testid="input-opp-win-reason" />
                </div>
                <div className="space-y-1.5">
                  <CrmFieldLabel>Loss reason</CrmFieldLabel>
                  <Input id="opp-loss" value={form.lossReason} onChange={(e) => set("lossReason", e.target.value)} data-testid="input-opp-loss-reason" />
                </div>
              </CrmFieldGrid>
            </CrmFormSection>

            <CrmFormDivider />

            <CrmFormSection icon={<Briefcase className="h-3.5 w-3.5 text-sky-600" />} iconClassName="bg-sky-50 dark:bg-sky-950/40" title="Resource plan" tag="Staffing & budget basis">
              {!editingOppId ? (
                <p className="text-sm text-muted-foreground">Save this opportunity first, then create a resource plan with staffing rows. Once approved, export the plan to Finance as the project budget.</p>
              ) : resourcePlansLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading resource plans…
                </div>
              ) : resourcePlans.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">
                    {resourcePlans.length} plan{resourcePlans.length !== 1 ? "s" : ""} linked to this opportunity.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateToResourcePlan?.(editingOppId, resourcePlans[0]?.id ?? null)}
                    data-testid="button-open-resource-plan"
                  >
                    Open resource plan
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">
                    No resource plan yet. Add staffing rows from a template or manually.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
                    disabled={createResourcePlanMutation.isPending}
                    onClick={() => createResourcePlanMutation.mutate()}
                    data-testid="button-create-resource-plan"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create resource plan
                  </Button>
                </div>
              )}
            </CrmFormSection>

            <CrmFormDivider />

            <CrmFormSection icon={<StickyNote className="h-3.5 w-3.5 text-muted-foreground" />} title="Notes">
              <Textarea id="opp-desc" value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Add context for your team — key decisions, stakeholders, things to remember" data-testid="input-opp-description" />
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
                    Add user-defined fields for opportunities in Settings → CRM Fields.
                  </p>
                  {onOpenCustomFieldsSettings && (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onOpenCustomFieldsSettings}>
                      <Settings2 className="h-3.5 w-3.5" />
                      Open CRM field settings
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Custom fields can be placed in any section above, or kept here.
                  </p>
                  <CrmCustomFieldsForm
                    entityType="opportunity"
                    values={customData}
                    onChange={(k, v) => setCustom(k, v)}
                    embedded
                  />
                </>
              )}
            </CrmFormSection>
      </div>
    </FormDialogShell>
  );
}
