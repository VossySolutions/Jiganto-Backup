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
    progress?: number;
  }[];
  milestoneMarkers: { id: number; name: string; projectName: string | null; date: string | null; ragStatus: string | null; projectId: number | null }[];
}

export interface Report360Data {
  generatedAt: string;
  executiveSummary: {
    projectName: string;
    client: string | null;
    pm: string | null;
    programmeManager?: string | null;
    pmo?: string | null;
    methodology?: string | null;
    framework?: string | null;
    currentPhase?: string | null;
    progress?: number;
    healthScore?: number;
    status?: string | null;
    overallRag: string | null;
    narrative: string;
    narrativeSource?: "ai" | "template" | "manual";
    startDate: string | null;
    plannedEnd: string | null;
    revisedEnd: string | null;
  };
  healthDashboard: HealthMatrixRow | null;
  /** Prior-week RAG from health matrix snapshots (DB), if available */
  lastWeekRag?: Record<string, string> | null;
  level1Plan: { id?: number; name: string; rag: string | null; progress: number; plannedStart: string | null; plannedEnd: string | null }[];
  /** Built from phases/milestones or saved metadata.report360 */
  level1PlanRows?: unknown[];
  /** Built from workstreams or saved metadata.report360 */
  activityPlan?: unknown[];
  milestones: { id?: number; name: string; targetDate: string | null; rag: string | null; status: string | null; overdue: boolean }[];
  workstreamUpdates: {
    id?: number;
    name: string;
    owner: string | null;
    rag: string | null;
    progress: number;
    note: string | null;
    status?: string | null;
    updatedAt?: string | null;
  }[];
  raidSummary: {
    topRisks: {
      id?: number;
      ref: string | null;
      description: string;
      owner: string | null;
      severity: string | null;
      mitigation: string;
      category?: string | null;
      likelihood?: string | null;
      impact?: string | null;
      status?: string | null;
      due?: string | null;
      dateRaised?: string | null;
      contingency?: string | null;
      escalated?: boolean;
    }[];
    topIssues: {
      id?: number;
      ref: string | null;
      description: string;
      owner: string | null;
      priority: string | null;
      targetResolution: string | null;
      impact?: string | null;
      resolution?: string | null;
      status?: string | null;
      dateRaised?: string | null;
    }[];
    openDependencies: {
      id?: number;
      ref: string | null;
      description: string;
      direction: string;
      requiredBy: string | null;
      status: string | null;
      type?: string | null;
      source?: string | null;
      impact?: string | null;
      owner?: string | null;
      dateIdentified?: string | null;
    }[];
    decisions?: {
      id?: number;
      ref: string | null;
      text: string;
      owner: string;
      decisionDate?: string | null;
      rationale?: string;
      forum?: string | null;
      impact?: string | null;
      status?: string | null;
    }[];
    actions?: {
      id?: number;
      ref: string | null;
      text: string;
      owner: string;
      due: string;
      status?: string | null;
      raisedFrom?: string | null;
      raised?: string | null;
    }[];
  };
  deliverablesTracker: {
    id?: number;
    name: string;
    dueDate: string | null;
    owner: string | undefined;
    owners?: string[];
    status: string;
    phase?: string | null;
    type?: string | null;
    approvalRequired?: boolean;
    approver?: string | null;
    approvers?: string[];
  }[];
  nextPhasePreview: string;
  financialSummary: { budget: number; spent: number; remaining: number; forecast: number };
  budgetBreakdown?: { category: string; budgeted: number; actual: number }[];
  resourceSummary: {
    id?: number;
    name: string;
    role: string | null;
    allocation: number;
    risk: string | null;
    startDate?: string | null;
    endDate?: string | null;
    isActive?: boolean;
    userId?: string;
    organisation?: string | null;
    memberType?: string | null;
    workstream?: string | null;
  }[];
  /** Presentation fields from pm_projects.metadata.report360 */
  report360?: {
    highlights: string[];
    lowlights: string[];
    ragCommentary: string;
    ragComments: { schedule?: string; cost?: string; qualityRisk?: string };
    indicators: { id: string; label: string; pct: number; rag: RagLevel }[] | null;
    readinessItems: {
      id: string;
      phase: string;
      activity: string;
      criteria: string;
      rag: string;
      owner: string;
      commentary: string;
    }[];
    lastWeekRagOverride: Record<string, string> | null;
  };
  projectId: number;
  /** Legacy snapshot overlay (also written to metadata.report360 on save) */
  sectionOverrides?: {
    ragCommentary?: string;
    ragComments?: { schedule?: string; cost?: string; qualityRisk?: string };
    indicators?: { id: string; label: string; pct: number; rag: RagLevel }[];
    activeSection?: string;
    decisions?: { id: string; text: string; owner: string; impact?: string; requiredBy?: string; status?: string; forum?: string }[];
    actions?: { id: string; text: string; owner: string; due: string; status?: string; raisedFrom?: string; raised?: string }[];
    highlights?: string[];
    lowlights?: string[];
    lastWeekRag?: Record<string, string>;
    level1PlanRows?: unknown[];
    activityPlan?: unknown[];
    activityLibrary?: { code: string; name: string; color: string }[];
    readinessItems?: {
      id: string;
      phase: string;
      activity: string;
      criteria: string;
      rag: string;
      owner: string;
      commentary: string;
    }[];
    showResources?: boolean;
    showRisk?: boolean;
    teamView?: string;
  };
}
