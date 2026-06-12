export type RagLevel = "green" | "amber" | "red";

export interface PortfolioDashboardData {
  kpis: {
    activeProjects: number;
    atRiskCount: number;
    totalBudget: number;
    totalSpent: number;
    milestonesDue30d: number;
    avgHealth: number;
    avgHealthTrend: number;
    programmeCount: number;
    childProjectCount: number;
    greenCount: number;
    amberCount: number;
    redCount: number;
  };
  portfolioHealth: {
    id: number;
    name: string;
    colour: string;
    green: number;
    amber: number;
    red: number;
    total: number;
    budget: number;
    spent: number;
  }[];
  budgetByPortfolio: { name: string; budget: number; spent: number; colour: string }[];
  milestoneTimeline: { id: number; name: string; projectName: string | null; targetDate: string | null; ragStatus: string | null }[];
  attentionQueue: { id: number; name: string; clientName: string | null; managerName: string | null; ragStatus: string | null; updatedAt: string | null }[];
  programmes: ProgrammeListItem[];
  projects: PortfolioProjectRow[];
  portfolios: { id: number; name: string; colour?: string | null }[];
  resourceUtilisation: { initials: string; name: string; role: string; utilisation: number; color: string }[];
  activityFeed: { id: number; user: string; action: string; target: string; time: string; dot: string }[];
}

export interface PortfolioProjectRow {
  id: number;
  name: string;
  code: string | null;
  status: string | null;
  ragStatus: string | null;
  progress: number;
  budget: number;
  spentBudget: number;
  startDate: string | null;
  endDate: string | null;
  clientName: string | null;
  managerName: string | null;
  portfolioNames: string[];
  programName: string | null;
}

export interface ProgrammeListItem {
  id: number;
  source: "program" | "project";
  name: string;
  description: string | null;
  ownerName: string | null;
  status: string | null;
  ragStatus: string | null;
  progress: number;
  budget: number;
  spentBudget: number;
  startDate: string | null;
  endDate: string | null;
  portfolioName: string | null;
  clientNames: string[];
  childCount: number;
  children: PortfolioProjectRow[];
}

export interface HealthMatrixRow {
  projectId: number;
  projectName: string;
  clientName: string | null;
  managerName: string | null;
  portfolioNames: string[];
  programmeName: string | null;
  overall: RagLevel;
  schedule: RagLevel;
  budget: RagLevel;
  quality: RagLevel;
  delivery: RagLevel;
  risk: RagLevel;
  resources: RagLevel;
  stakeholders: RagLevel;
}

export interface RoadmapData {
  items: {
    id: string;
    entityId: number;
    name: string;
    type: "project" | "programme" | "internal";
    clientName: string | null;
    managerName: string | null;
    startDate: string | null;
    endDate: string | null;
    ragStatus: string | null;
    status: string | null;
    portfolioName: string | null;
    programmeName: string | null;
    colour: string;
    provisional: boolean;
  }[];
  milestoneMarkers: { id: number; name: string; projectName: string | null; date: string | null; ragStatus: string | null; projectId: number | null }[];
}

export interface Report360Data {
  generatedAt: string;
  executiveSummary: {
    projectName: string;
    client: string | null;
    pm: string | null;
    overallRag: string | null;
    narrative: string;
    narrativeSource?: "ai" | "template" | "manual";
    startDate: string | null;
    plannedEnd: string | null;
    revisedEnd: string | null;
  };
  healthDashboard: HealthMatrixRow | null;
  level1Plan: { name: string; rag: string | null; progress: number; plannedStart: string | null; plannedEnd: string | null }[];
  milestones: { name: string; targetDate: string | null; rag: string | null; status: string | null; overdue: boolean }[];
  workstreamUpdates: { name: string; owner: string | null; rag: string | null; progress: number; note: string | null }[];
  raidSummary: {
    topRisks: { ref: string | null; description: string; owner: string | null; severity: string | null; mitigation: string }[];
    topIssues: { ref: string | null; description: string; owner: string | null; priority: string | null; targetResolution: string | null }[];
    openAssumptions: { ref: string | null; assumption: string; owner: string | null; validationDate: string | null }[];
    openDependencies: { ref: string | null; description: string; direction: string; requiredBy: string | null; status: string | null }[];
  };
  deliverablesTracker: { name: string; dueDate: string | null; owner: string | undefined; status: string }[];
  nextPhasePreview: string;
  financialSummary: { budget: number; spent: number; remaining: number; forecast: number };
  resourceSummary: { name: string; role: string | null; allocation: number; risk: string | null }[];
  projectId: number;
}
