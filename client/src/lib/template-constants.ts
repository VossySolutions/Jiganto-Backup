import type { TemplateModule } from "@shared/models/templates";

export const TEMPLATE_MODULES: {
  key: TemplateModule;
  label: string;
  description: string;
  createPath: string;
  phase?: number;
}[] = [
  { key: "bpm_framework", label: "BPM — Frameworks", description: "Implementation methodology frameworks", createPath: "/modules/bpm" },
  { key: "bpm_diagram", label: "BPM — Process Diagrams", description: "Starter process flow diagrams", createPath: "/modules/bpm" },
  { key: "bpm_orgchart", label: "BPM — Org Charts", description: "Team and stakeholder org chart starters", createPath: "/modules/bpm" },
  { key: "project", label: "Projects", description: "Project setup with tools and workstreams", createPath: "/modules/projects" },
  { key: "survey", label: "Surveys", description: "Question sets for research and feedback", createPath: "/modules/surveys" },
  { key: "esign", label: "eSign Documents", description: "NDAs, SOWs, charters and more", createPath: "/modules/e-sign" },
  { key: "workspace", label: "Workspaces", description: "Meeting notes, sprint planning, trackers", createPath: "/modules/workspaces" },
  { key: "test_mgmt", label: "Test Management", description: "Pre-built test scenario hierarchies", createPath: "/modules/test-mgmt" },
  { key: "bpml", label: "BPML", description: "ERP process master lists", createPath: "/modules/bpm" },
  { key: "whiteboard", label: "Whiteboard", description: "Workshop and retrospective layouts", createPath: "/modules/whiteboarding" },
];

export const CATEGORY_TAGS = [
  "SAP", "Salesforce", "Workday", "Oracle", "Agile", "Generic IT", "Management Consulting", "Custom",
] as const;

export const TIER_LABELS: Record<string, string> = {
  system: "Jiganto",
  customer: "Your organisation",
  submitted: "Submitted",
};

export const SORT_OPTIONS = [
  { value: "most_used", label: "Most used" },
  { value: "newest", label: "Newest" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "recently_updated", label: "Recently updated" },
] as const;

export const AI_GENERATE_MODULES = ["bpm_framework", "survey", "project", "bpml", "esign"] as const;

export function moduleLabel(key: string) {
  return TEMPLATE_MODULES.find(m => m.key === key)?.label ?? key;
}

export function moduleColor(key: string) {
  const colors: Record<string, string> = {
    bpm_framework: "#7C3AED", bpm_diagram: "#8B5CF6", bpm_orgchart: "#A78BFA",
    project: "#3B82F6", survey: "#06B6D4", esign: "#EC4899",
    workspace: "#10B981", test_mgmt: "#F59E0B", bpml: "#6366F1", whiteboard: "#A855F7",
  };
  return colors[key] ?? "#6B7280";
}
