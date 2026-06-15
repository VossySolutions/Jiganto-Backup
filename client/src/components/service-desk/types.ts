export type TicketType = "incident" | "service_request" | "change_request" | "question";
export type TicketPriority = "p1" | "p2" | "p3" | "p4";
export type SlaState = "within" | "at_risk" | "breached" | "none";

export interface ServiceDeskDashboard {
  kpis: {
    openTickets: number;
    slaBreached: number;
    slaAtRisk: number;
    avgResolutionHours: number;
    p1p2Open: number;
    pendingApproval: number;
  };
  volumeByType: { type: string; count: number }[];
  slaPerformance: { withinPct: number; target: number };
  volumeTrend: { day: string; count: number }[];
  breachedTable: {
    id: number;
    ref: string;
    title: string;
    type: string;
    priority: string;
    clientName: string | null;
    agentName: string | null;
    slaDeadline: string | null;
    slaState: SlaState;
    overdueHours: number;
  }[];
}

export interface ServiceItem {
  id: number;
  name: string;
  description: string | null;
  categoryId: number | null;
  categoryName?: string | null;
  ownerTeamId: number | null;
  teamName?: string | null;
  availability: string;
  costModel: string | null;
  costNotes: string | null;
  requestFormFields: FormField[];
  visibility: string;
  visibleClientIds: number[];
  isActive?: boolean;
  slas: { priority: string; responseHours: string; resolutionHours: string }[];
}

export interface FormField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export interface ServiceCategory {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number | null;
}

export interface TicketRow {
  id: number;
  ref: string;
  title: string;
  type: TicketType;
  priority: TicketPriority;
  status: string;
  serviceName?: string | null;
  teamName?: string | null;
  clientName?: string | null;
  agentName?: string | null;
  slaState: { response: SlaState; resolution: SlaState };
  effectiveResolutionDeadline: string | null;
  createdAt: string;
  changeImplementationDate?: string | null;
  totalTimeLogged?: number;
}

export interface TicketDetail extends TicketRow {
  description: unknown;
  category: string | null;
  serviceId: number | null;
  customFields: Record<string, unknown>;
  internalNotes: string | null;
  assignedAgentId: string | null;
  assignedTeamId: number | null;
  clientId: number | null;
  projectId: number | null;
  changeJustification: string | null;
  changeRiskAssessment: string | null;
  changeRollbackPlan: string | null;
  changePostReview: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  slaResponseDeadline: string | null;
  comments: { id: number; authorId: string | null; body: unknown; isInternal: boolean; createdAt: string }[];
  attachments: { id: number; fileName: string; fileUrl: string }[];
  timeLogs: { id: number; logDate: string; hours: string; description: string | null; isBillable: boolean; rate: string | null; financeTimesheetEntryId?: number | null }[];
  statusHistory: { id: number; fromStatus: string | null; toStatus: string; reason: string | null; createdAt: string }[];
  cabReviews: { id: number; reviewerId: string; decision: string | null; comments: string | null }[];
}

export interface AgentTeam {
  id: number;
  name: string;
  description: string | null;
  leadUserId: string | null;
  roundRobinEnabled: boolean | null;
  memberIds: string[];
}

export interface RoutingRule {
  id: number;
  name: string;
  sortOrder: number | null;
  isActive: boolean | null;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
}

export interface SlaConfigRow {
  config: {
    id: number;
    clientId: number | null;
    priority: string;
    responseHours: string;
    resolutionHours: string;
  };
  clientName: string | null;
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  p1: "P1 Critical",
  p2: "P2 High",
  p3: "P3 Medium",
  p4: "P4 Low",
};

export const TYPE_LABELS: Record<TicketType, string> = {
  incident: "Incident",
  service_request: "Service Request",
  change_request: "Change Request",
  question: "Question",
};

export function slaBadgeClass(state: SlaState): string {
  if (state === "breached") return "bg-red-500/15 text-red-700 dark:text-red-300";
  if (state === "at_risk") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (state === "within") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  return "bg-muted text-muted-foreground";
}
