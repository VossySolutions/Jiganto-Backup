import type { AvatarColor, DsCell } from "./mock-data";

export type RpKpi = { label: string; value: string; sub: string; accent?: string; valueColor?: string };

export type RpDashboard = {
  kpis: RpKpi[];
  alert: { text: string; severity: string } | null;
  demandSupplyChart: { demand: number[]; supply: number[] };
  utilisation: { current: number; target: number; trend: number[] };
  atRiskResources: Array<{
    id: number; name: string; initials: string; color: string;
    role: string; rolloff: string; bookingStatus?: string; status: string; statusVariant: string;
  }>;
  pipelineDemand: Array<{ role: string; demand: number; supply: number; pct: number }>;
  skillsGaps: Array<{ skill: string; demand: number; supply: number; gap: number; severity: string; action: string }>;
  meta: { resourceCount: number; opportunityCount: number };
};

export type RpDemandSupply = {
  months: string[];
  rows: Array<{
    skill: string; sub: string; supply: number; supplyColor?: string;
    cells: string[]; cellTypes: DsCell[]; trend: number[]; criticalMonths: number;
  }>;
  kpis: { skillsTracked: number; criticalShortages: number; confirmedDemand: number; pipelineDemand: number };
};

export type RpHeatMap = {
  resources: Array<{
    id: number; name: string; initials: string; color: string; role: string;
    weeks: number[]; weekTypes: string[];
  }>;
  monthGroups: Array<{ label: string; weekCount: number }>;
  weekCount: number;
};

export type RpScheduler = RpHeatMap & {
  rows: Array<RpHeatMap["resources"][0] & {
    bars: Array<{
      id?: number; span: number; type: string; label?: string;
      color?: string; soft?: boolean; startWeek?: number; endWeek?: number;
    }>;
  }>;
};

export type RpSkillsInventory = {
  distribution: Array<{ practice: string; count: number; pct: number; color: string }>;
  topDemanded: Array<{ skill: string; supply: number; demand: number; gap: number; status: string; variant: string }>;
  matrix: Array<{
    id: number; name: string; initials: string; color: string; role: string;
    grade: string; location: string; languages: string;
    skills: Array<{ name: string; level: number; maxLevel: number }>;
    util: number; utilColor: string; utilNote?: string;
  }>;
};

export type RpPipeline = {
  kpis: { activeOpportunities: number; softDemand: number; atRiskOpportunities: number; avgProbability: number; totalPipelineValue: number };
  opportunities: Array<{
    id: number; client: string; project: string; value: string;
    tags: Array<{ label: string; variant: string }>;
    roles: Array<{ role: string; count: number; avail: string; availVariant: string }>;
    planId: number | null;
    softBookings?: number;
    confirmedBookings?: number;
  }>;
  probabilityModel: Array<{ label: string; value: string; severity: string }>;
  aiRecommendation: { text: string; opportunityId: number } | null;
};

export type RpRecruitment = {
  alert: { text: string; count: number } | null;
  cards: Array<{
    id: number; month: string; skill: string; type: string;
    rows: Array<{ l: string; v: string; red?: boolean; amber?: boolean }>;
    action: string; primary: string; secondary?: string; status: string;
  }>;
  timeline: Array<{
    id: number; role: string; grade: string; headcount: number; tth: string;
    start: string; goLive: string; cost: string; status: string; statusVariant: string;
  }>;
};

export type RpBench = {
  kpis: { onBench: number; benchPct: number; rollingOff: number; benchCostMonth?: number; redeployable: number };
  resources: Array<{
    id: number; name: string; initials: string; color: string; role: string;
    skills: string; since: string; days: number; daysColor?: string;
    match: string; matchVariant: string; matchOpportunityId?: number | null;
    matchRoleName?: string | null; action: string; actionVariant: string;
  }>;
};

export type RpScenarios = {
  scenarios: Array<{
    id: number; name: string; type: string; revenue: string; demand: string;
    util: string; shortfall: string;
    actions: Array<{ title: string; detail: string; severity: string }>;
  }>;
  comparison: Array<{ metric: string; worst: string; expected: string; best: string }>;
};

export type RpAiInsight = { type: string; text: string; linkTab: string; color: string };
export type RpAiInsights = RpAiInsight[];

export const AI_SUGGESTED_QUERIES = [
  "Show me all SAP consultants available in Q3",
  "Which opportunities are at risk?",
  "What skills should we recruit over the next 6 months?",
  "Who is on the bench and why?",
  "Optimise utilisation above 80%",
  "Model best case scenario for Q4",
  "Find senior BAs with public sector experience",
  "What is the estimated cost of current recruitment needs?",
] as const;

export const AI_QUICK_QUERY_CATEGORIES: Record<string, string[]> = {
  "Find resources": [
    "Show me all SAP consultants available in Q3",
    "Who has Azure skills available next month?",
    "Find senior BAs with public sector experience",
  ],
  "Risk analysis": [
    "Which opportunities are at risk due to capacity?",
    "What resources are rolling off in the next 30 days?",
    "Show over-allocated resources",
  ],
  Recruitment: [
    "What skills should we recruit over the next 6 months?",
    "When should we start hiring SAP consultants?",
    "What is the estimated cost of current recruitment needs?",
  ],
  Utilisation: [
    "Optimise utilisation above 80%",
    "Who is on the bench and why?",
    "Show utilisation by practice area",
  ],
  Scenarios: [
    "Model best case scenario for Q4",
    "What happens if we win all pipeline opportunities?",
    "Compare expected vs worst case headcount",
  ],
};

export type RpAiResponse = {
  reply: string;
  insights: Array<{ type: string; text: string }>;
  configured: boolean;
};

export type RpAutoMatchResponse = {
  matches: Array<{ id: number; name: string; role: string | null; score: number }>;
};

/** Map API hex/id to avatar token for RpAvatar */
export function toAvatarColor(color: string, id?: number): AvatarColor {
  const palette: AvatarColor[] = ["brand", "teal", "green", "amber", "violet", "red"];
  if (color.startsWith("#")) return palette[(id ?? color.charCodeAt(1)) % palette.length];
  if (palette.includes(color as AvatarColor)) return color as AvatarColor;
  return palette[(id ?? 0) % palette.length];
}
