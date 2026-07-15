export type MethodPhase = {
  name: string;
  duration: string;
  docs: Array<{ name: string; optional?: boolean }>;
};

export type MethodologyPreset = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  custom?: boolean;
  /** Tool IDs suggested when this methodology is selected */
  suggestedTools: string[];
  phases: MethodPhase[];
};

export const METHODOLOGY_PRESETS: MethodologyPreset[] = [
  {
    id: "sap_activate",
    name: "SAP Activate",
    desc: "SAP-recommended implementation methodology",
    icon: "⚙️",
    suggestedTools: [
      "gantt_chart", "milestone_plan", "tracking_board", "status_reporting", "360_report",
      "risk_log", "issues_log", "assumptions_log", "dependencies_log", "change_log", "raci_model",
      "resource_tracker", "timesheets", "finance_tracker", "documentation", "deliverables_tracker",
      "test_tracker", "wbs",
    ],
    phases: [
      { name: "Discover", duration: "4 weeks", docs: [{ name: "Business Case" }, { name: "Fit-to-Standard Assessment" }, { name: "System Landscape Design", optional: true }] },
      { name: "Prepare", duration: "3 weeks", docs: [{ name: "Project Charter" }, { name: "RAID Log" }, { name: "Resource Plan" }, { name: "Kickoff Deck", optional: true }] },
      { name: "Explore", duration: "8 weeks", docs: [{ name: "Business Blueprint" }, { name: "Gap Analysis" }, { name: "Configuration Workbook", optional: true }, { name: "Test Strategy", optional: true }] },
      { name: "Realise", duration: "12 weeks", docs: [{ name: "Configuration Documentation" }, { name: "Training Materials", optional: true }] },
      { name: "Deploy", duration: "4 weeks", docs: [{ name: "Go-Live Checklist" }, { name: "Operations Manual", optional: true }] },
      { name: "Run", duration: "Ongoing", docs: [{ name: "Lessons Learned", optional: true }] },
    ],
  },
  {
    id: "prince2",
    name: "PRINCE2",
    desc: "Stage-gate with strong governance",
    icon: "👑",
    suggestedTools: ["gantt_chart", "milestone_plan", "status_reporting", "360_report", "risk_log", "issues_log", "change_log", "raci_model", "documentation"],
    phases: [
      { name: "Starting Up", duration: "2 weeks", docs: [{ name: "Project Brief" }, { name: "Business Case" }] },
      { name: "Initiating", duration: "4 weeks", docs: [{ name: "PID" }, { name: "Risk Register" }] },
      { name: "Delivery Stages", duration: "Variable", docs: [{ name: "Stage Plans" }, { name: "Highlight Reports" }] },
      { name: "Closing", duration: "2 weeks", docs: [{ name: "End Project Report" }, { name: "Lessons Log" }] },
    ],
  },
  {
    id: "agile_scrum",
    name: "Agile / Scrum",
    desc: "Iterative delivery in sprints",
    icon: "🔄",
    suggestedTools: ["sprint_board", "scrum_board", "backlog", "epics", "stories", "sprints", "kanban_board", "project_dashboard", "status_reporting", "360_report", "defects"],
    phases: [
      { name: "Discover", duration: "2 weeks", docs: [{ name: "Product Vision" }, { name: "Backlog Seed" }] },
      { name: "Build", duration: "Ongoing sprints", docs: [{ name: "Sprint Goals" }, { name: "Definition of Done" }] },
      { name: "Release", duration: "Per release", docs: [{ name: "Release Notes" }, { name: "Retro Summary", optional: true }] },
    ],
  },
  {
    id: "safe",
    name: "SAFe",
    desc: "Scaled Agile Framework",
    icon: "🏗️",
    suggestedTools: ["roadmap", "milestone_plan", "sprint_board", "backlog", "epics", "status_reporting", "360_report", "risk_log", "dependencies_log"],
    phases: [
      { name: "PI Planning", duration: "2 weeks", docs: [{ name: "PI Objectives" }, { name: "Program Board" }] },
      { name: "Execution", duration: "8–12 weeks", docs: [{ name: "Iteration Plans" }, { name: "System Demo Notes" }] },
      { name: "IP / Inspect", duration: "1 week", docs: [{ name: "Inspect & Adapt" }] },
    ],
  },
  {
    id: "waterfall",
    name: "Waterfall",
    desc: "Sequential phases with sign-off gates",
    icon: "💧",
    suggestedTools: ["gantt_chart", "milestone_plan", "wbs", "status_reporting", "360_report", "risk_log", "issues_log", "change_log", "documentation", "deliverables_tracker"],
    phases: [
      { name: "Requirements", duration: "4 weeks", docs: [{ name: "Requirements Spec" }, { name: "Scope Statement" }] },
      { name: "Design", duration: "4 weeks", docs: [{ name: "Solution Design" }] },
      { name: "Build", duration: "8 weeks", docs: [{ name: "Build Spec" }, { name: "Unit Test Plan", optional: true }] },
      { name: "Test", duration: "4 weeks", docs: [{ name: "Test Plan" }, { name: "UAT Sign-off" }] },
      { name: "Deploy", duration: "2 weeks", docs: [{ name: "Go-Live Checklist" }] },
    ],
  },
  {
    id: "itil_v4",
    name: "ITIL v4",
    desc: "IT service management",
    icon: "🎯",
    suggestedTools: ["milestone_plan", "status_reporting", "360_report", "change_log", "issues_log", "risk_log", "documentation"],
    phases: [
      { name: "Engage", duration: "2 weeks", docs: [{ name: "Service Brief" }] },
      { name: "Design & Transition", duration: "6 weeks", docs: [{ name: "Service Design Package" }, { name: "Change Records" }] },
      { name: "Deliver & Support", duration: "Ongoing", docs: [{ name: "Operations Runbook" }] },
    ],
  },
  {
    id: "hybrid",
    name: "Hybrid",
    desc: "Waterfall governance + agile delivery",
    icon: "⚡",
    suggestedTools: [
      "gantt_chart", "milestone_plan", "tracking_board", "sprint_board", "kanban_board",
      "status_reporting", "360_report", "risk_log", "issues_log", "assumptions_log",
      "dependencies_log", "change_log", "raci_model", "deliverables_tracker", "wbs",
    ],
    phases: [
      { name: "Initiate", duration: "2 weeks", docs: [{ name: "Charter" }, { name: "Governance Model" }] },
      { name: "Plan", duration: "3 weeks", docs: [{ name: "Plan" }, { name: "RAID Log" }] },
      { name: "Deliver (Agile)", duration: "Variable", docs: [{ name: "Sprint Reviews" }, { name: "Status Reports" }] },
      { name: "Close", duration: "2 weeks", docs: [{ name: "Handover" }, { name: "Lessons Learned" }] },
    ],
  },
  {
    id: "workday_accelerate",
    name: "Workday Accelerate",
    desc: "Workday HCM & Finance deployment",
    icon: "☁️",
    suggestedTools: ["gantt_chart", "milestone_plan", "status_reporting", "360_report", "risk_log", "issues_log", "change_log", "raci_model", "deliverables_tracker", "test_tracker"],
    phases: [
      { name: "Plan", duration: "3 weeks", docs: [{ name: "Project Plan" }, { name: "Tenant Strategy" }] },
      { name: "Architect", duration: "4 weeks", docs: [{ name: "Architecture Decisions" }] },
      { name: "Configure & Prototype", duration: "8 weeks", docs: [{ name: "Config Workbooks" }, { name: "Prototype Feedback" }] },
      { name: "Test", duration: "4 weeks", docs: [{ name: "Test Scripts" }, { name: "UAT Sign-off" }] },
      { name: "Deploy", duration: "3 weeks", docs: [{ name: "Cutover Plan" }, { name: "Training Pack" }] },
    ],
  },
  {
    id: "kanban",
    name: "Kanban",
    desc: "Continuous flow · no fixed sprints",
    icon: "📋",
    suggestedTools: ["kanban_board", "tracking_board", "project_dashboard", "status_reporting", "360_report", "defects"],
    phases: [
      { name: "Flow Setup", duration: "1 week", docs: [{ name: "Board Policies" }, { name: "WIP Limits" }] },
      { name: "Delivery", duration: "Ongoing", docs: [{ name: "Flow Metrics", optional: true }] },
    ],
  },
  {
    id: "custom",
    name: "Custom / Company methodology",
    desc: "Define your own phases, documents and naming",
    icon: "🏷️",
    custom: true,
    suggestedTools: ["gantt_chart", "milestone_plan", "status_reporting", "360_report", "risk_log", "issues_log"],
    phases: [],
  },
];

/** Recommended methodology by work type */
export function recommendedMethodologyId(workType: string): string {
  if (workType === "project" || workType === "programme") return "sap_activate";
  if (workType === "sprint" || workType === "poc" || workType === "prototype") return "agile_scrum";
  if (workType === "campaign") return "kanban";
  return "hybrid";
}

export type EditablePhase = {
  id: string;
  name: string;
  duration: string;
  docs: Array<{ id: string; name: string; optional?: boolean }>;
};

export function presetToEditablePhases(preset: MethodologyPreset): EditablePhase[] {
  return preset.phases.map((p, i) => ({
    id: `phase-${i}-${p.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: p.name,
    duration: p.duration,
    docs: p.docs.map((d, j) => ({
      id: `doc-${i}-${j}`,
      name: d.name,
      optional: d.optional,
    })),
  }));
}
