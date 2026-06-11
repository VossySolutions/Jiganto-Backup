export type OpportunityFormData = {
  name: string;
  amount: string;
  recurringAmount: string;
  recurringFrequency: string;
  stageId: string;
  accountId: string;
  contactId: string;
  expectedCloseDate: string;
  actualCloseDate: string;
  probability: string;
  description: string;
  type: string;
  source: string;
  nextStep: string;
  winReason: string;
  lossReason: string;
  revenue: string;
  grossProfit: string;
  ownerUserId: string;
  competitor: string;
};

export const EMPTY_OPPORTUNITY_FORM: OpportunityFormData = {
  name: "",
  amount: "",
  recurringAmount: "",
  recurringFrequency: "",
  stageId: "",
  accountId: "",
  contactId: "",
  expectedCloseDate: "",
  actualCloseDate: "",
  probability: "",
  description: "",
  type: "",
  source: "",
  nextStep: "",
  winReason: "",
  lossReason: "",
  revenue: "",
  grossProfit: "",
  ownerUserId: "",
  competitor: "",
};

export const OPPORTUNITY_TYPES = [
  { value: "new_business", label: "New Business" },
  { value: "expansion", label: "Expansion" },
  { value: "renewal", label: "Renewal" },
  { value: "upsell", label: "Upsell" },
];

export const OPPORTUNITY_SOURCES = [
  { value: "referral", label: "Referral" },
  { value: "web", label: "Web" },
  { value: "event", label: "Event" },
  { value: "cold_call", label: "Cold Call" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

export const RECURRING_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

export function opportunityToForm(opp: Record<string, unknown>): OpportunityFormData {
  return {
    name: String(opp.name || ""),
    amount: opp.amount != null ? String(opp.amount) : "",
    recurringAmount: opp.recurringAmount != null ? String(opp.recurringAmount) : "",
    recurringFrequency: String(opp.recurringFrequency || ""),
    stageId: opp.stageId != null ? String(opp.stageId) : "",
    accountId: opp.accountId != null ? String(opp.accountId) : "",
    contactId: opp.contactId != null ? String(opp.contactId) : "",
    expectedCloseDate: opp.expectedCloseDate ? String(opp.expectedCloseDate).split("T")[0] : "",
    actualCloseDate: opp.actualCloseDate ? String(opp.actualCloseDate).split("T")[0] : "",
    probability: opp.probability != null ? String(opp.probability) : "",
    description: String(opp.description || ""),
    type: String(opp.type || ""),
    source: String(opp.source || ""),
    nextStep: String(opp.nextStep || ""),
    winReason: String(opp.winReason || ""),
    lossReason: String(opp.lossReason || ""),
    revenue: opp.revenue != null ? String(opp.revenue) : "",
    grossProfit: opp.grossProfit != null ? String(opp.grossProfit) : "",
    ownerUserId: String(opp.ownerUserId || ""),
    competitor: String((opp.customData as Record<string, unknown> | undefined)?.competitor || ""),
  };
}

export function formToOpportunityPayload(form: OpportunityFormData, customData: Record<string, unknown> = {}): Record<string, unknown> {
  const revenue = form.revenue ? parseFloat(form.revenue) : null;
  const grossProfit = form.grossProfit ? parseFloat(form.grossProfit) : null;
  const mergedCustomData = { ...customData };
  if (form.competitor) mergedCustomData.competitor = form.competitor;
  else delete mergedCustomData.competitor;
  return {
    name: form.name,
    amount: form.amount || null,
    recurringAmount: form.recurringAmount || null,
    recurringFrequency: form.recurringFrequency || null,
    stageId: form.stageId ? parseInt(form.stageId) : null,
    accountId: form.accountId ? parseInt(form.accountId) : null,
    contactId: form.contactId ? parseInt(form.contactId) : null,
    expectedCloseDate: form.expectedCloseDate || null,
    actualCloseDate: form.actualCloseDate || null,
    probability: form.probability ? parseInt(form.probability) : null,
    description: form.description || null,
    type: form.type || null,
    source: form.source || null,
    nextStep: form.nextStep || null,
    winReason: form.winReason || null,
    lossReason: form.lossReason || null,
    revenue: revenue,
    grossProfit: grossProfit,
    ownerUserId: form.ownerUserId || null,
    customData: mergedCustomData,
  };
}

export function calcGpPercent(revenue: number | null, grossProfit: number | null): number | null {
  if (!revenue || revenue <= 0 || grossProfit == null) return null;
  return Math.round((grossProfit / revenue) * 100);
}
