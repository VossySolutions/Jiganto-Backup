import type { EditablePhase } from "@/lib/pm-methodology-presets";
import { METHODOLOGY_PRESETS } from "@/lib/pm-methodology-presets";

export type WorkItemFormData = {
  workType: string;
  name: string;
  description: string;
  code: string;
  strategicObjective: string;
  tags: string[];
  visibility: string;
  leadId: string;
  lead: string;
  pmoOwnerId: string;
  pmoOwner: string;
  customer: string;
  sponsor: string;
  contactPhone: string;
  contactEmail: string;
  teamMemberIds: string[];
  priority: string;
  complexityLevel: string;
  startDate: string;
  endDate: string;
  status: string;
  statusCadence: string;
  reportAudience: string;
  budget: string;
  currency: string;
  contractValue: string;
  portfolioId: string;
  methodologyId: string;
  ragStatus: string;
  financialRag: string;
  scheduleRag: string;
};

export type LoadedProject = Record<string, unknown> & {
  id: number;
  name: string;
  metadata?: Record<string, unknown> | null;
};

export type LoadedTeamRow = {
  id: number;
  userId: string;
  role?: string | null;
};

export function emptyWorkItemForm(): WorkItemFormData {
  return {
    workType: "project",
    name: "",
    description: "",
    code: "",
    strategicObjective: "",
    tags: [],
    visibility: "organisation",
    leadId: "",
    lead: "",
    pmoOwnerId: "",
    pmoOwner: "",
    customer: "",
    sponsor: "",
    contactPhone: "",
    contactEmail: "",
    teamMemberIds: [],
    priority: "medium",
    complexityLevel: "medium",
    startDate: "",
    endDate: "",
    status: "planning",
    statusCadence: "monthly",
    reportAudience: "steering_committee",
    budget: "",
    currency: "GBP",
    contractValue: "",
    portfolioId: "",
    methodologyId: "hybrid",
    ragStatus: "green",
    financialRag: "green",
    scheduleRag: "green",
  };
}

function toDecimalOrNull(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return cleaned;
}

function formatDateInput(value: string | null | undefined) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatMoneyInput(value: string | number | null | undefined) {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(n)) return String(value);
  return Number.isInteger(n) ? String(n) : String(value);
}

export function projectToWorkItemForm(
  project: LoadedProject,
  teamRows: LoadedTeamRow[],
): WorkItemFormData {
  const meta = (project.metadata && typeof project.metadata === "object" ? project.metadata : {}) as Record<string, unknown>;
  const leadId = String(project.managerId || "");
  const teamMemberIds = teamRows
    .filter((m) => m.role === "team_member" || (m.role !== "project_manager" && m.userId !== leadId))
    .map((m) => m.userId);

  return {
    workType: String(project.workType || project.projectType || "project"),
    name: String(project.name || ""),
    description: String(project.description || ""),
    code: String(project.code || ""),
    strategicObjective: String(project.strategicObjective || ""),
    tags: Array.isArray(project.tags) ? (project.tags as string[]) : [],
    visibility: String(meta.visibility || "organisation"),
    leadId,
    lead: String(project.projectManager || meta.leadName || ""),
    pmoOwnerId: String(project.ownerId || ""),
    pmoOwner: String(project.deliveryOwner || ""),
    customer: String(project.customer || ""),
    sponsor: String(project.executiveSponsor || ""),
    contactPhone: String(meta.contactPhone || ""),
    contactEmail: String(meta.contactEmail || ""),
    teamMemberIds,
    priority: String(project.priority || "medium"),
    complexityLevel: String(project.complexityLevel || "medium"),
    startDate: formatDateInput(project.startDate as string | null | undefined),
    endDate: formatDateInput(project.endDate as string | null | undefined),
    status: String(project.status || "planning"),
    statusCadence: String(meta.statusCadence || "monthly"),
    reportAudience: String(meta.reportAudience || "steering_committee"),
    budget: formatMoneyInput(project.budget as string | number | null | undefined),
    currency: String(meta.currency || "GBP"),
    contractValue: formatMoneyInput((meta.contractValue as string | undefined) || (project.forecastBudget as string | number | null | undefined)),
    portfolioId: project.portfolioId != null ? String(project.portfolioId) : "",
    methodologyId: String(project.methodology || project.framework || "hybrid"),
    ragStatus: String(project.ragStatus || "green"),
    financialRag: String(project.financialRag || "green"),
    scheduleRag: String(project.scheduleRag || "green"),
  };
}

export function buildWorkItemPayload(
  data: WorkItemFormData,
  existingMeta: Record<string, unknown> = {},
  phases: EditablePhase[] = [],
) {
  const preset = METHODOLOGY_PRESETS.find((p) => p.id === data.methodologyId) || METHODOLOGY_PRESETS.find((p) => p.id === "hybrid")!;
  const methodologyDocs = phases.map((p) => ({
    phase: p.name,
    docs: p.docs.map((d) => ({ name: d.name, optional: !!d.optional })),
  }));
  const existingDocs = existingMeta.methodologyDocs;
  return {
    name: data.name,
    description: data.description || null,
    code: data.code || null,
    workType: data.workType,
    customer: data.customer || null,
    status: data.status,
    priority: data.priority,
    methodology: data.methodologyId,
    framework: data.methodologyId,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    budget: toDecimalOrNull(data.budget),
    forecastBudget: toDecimalOrNull(data.contractValue),
    portfolioId: data.portfolioId ? Number(data.portfolioId) : null,
    managerId: data.leadId || null,
    ownerId: data.pmoOwnerId || null,
    projectManager: data.lead || null,
    deliveryOwner: data.pmoOwner || null,
    executiveSponsor: data.sponsor || null,
    strategicObjective: data.strategicObjective || null,
    complexityLevel: data.complexityLevel || null,
    tags: data.tags.length ? data.tags : null,
    ragStatus: data.ragStatus || "green",
    financialRag: data.financialRag || "green",
    scheduleRag: data.scheduleRag || "green",
    metadata: {
      ...existingMeta,
      leadName: data.lead || undefined,
      visibility: data.visibility,
      statusCadence: data.statusCadence,
      reportAudience: data.reportAudience,
      currency: data.currency,
      contractValue: data.contractValue || undefined,
      contactPhone: data.contactPhone || undefined,
      contactEmail: data.contactEmail || undefined,
      methodologyDocs: methodologyDocs.length ? methodologyDocs : existingDocs,
      methodologyName: preset.name,
    },
  };
}

export function isValidMoney(raw: string): boolean {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return true;
  return /^-?\d+(\.\d{1,2})?$/.test(cleaned);
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

export function isValidPhone(raw: string): boolean {
  const v = raw.trim();
  if (!v) return true;
  const digits = v.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  return /^[+]?[\d\s()./-]{7,}$/.test(v);
}

export function isValidRefCode(raw: string): boolean {
  if (!raw.trim()) return true;
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(raw.trim());
}

export function looksLikeEmail(raw: string): boolean {
  return raw.includes("@");
}

export function looksLikePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 && /^[+(\d]/.test(raw.trim());
}

export function validateQuickEditForm(data: WorkItemFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.name.trim()) errors.name = "Project name is required.";
  else if (data.name.trim().length < 2) errors.name = "Name must be at least 2 characters.";
  if (!data.description.trim()) errors.description = "Description is required.";
  else if (data.description.trim().length < 10) errors.description = "Description must be at least 10 characters.";
  if (data.code && !isValidRefCode(data.code)) {
    errors.code = "Use letters, numbers, and . _ / - only (max 64 characters).";
  }
  if (!data.leadId) errors.leadId = "Lead is required.";
  if (data.contactEmail && !isValidEmail(data.contactEmail)) errors.contactEmail = "Enter a valid email address.";
  if (data.contactPhone && !isValidPhone(data.contactPhone)) errors.contactPhone = "Enter a valid phone number.";
  if (data.sponsor) {
    if (looksLikeEmail(data.sponsor) && !isValidEmail(data.sponsor)) errors.sponsor = "Enter a valid email or a name.";
    else if (looksLikePhone(data.sponsor) && !isValidPhone(data.sponsor)) errors.sponsor = "Enter a valid phone or a name.";
  }
  if (!data.startDate) errors.startDate = "Start date is required.";
  if (!data.endDate) errors.endDate = "End date is required.";
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    errors.endDate = "End date must be on or after the start date.";
  }
  if (data.budget && !isValidMoney(data.budget)) errors.budget = "Enter a valid amount.";
  if (data.contractValue && !isValidMoney(data.contractValue)) errors.contractValue = "Enter a valid amount.";
  return errors;
}
