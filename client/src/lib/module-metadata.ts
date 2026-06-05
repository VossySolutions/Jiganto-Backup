import {
  ChatIcon,
  DocumentsIcon,
  PortfolioIcon,
  ProjectsIcon,
  TasksIcon,
  WorkspacesIcon,
  BusinessIcon,
  CRMIcon,
  FinanceIcon,
  ResourcesIcon,
  ServiceDeskIcon,
  HelpDeskIcon,
  TestManagementIcon,
  BPMIcon,
  SurveysIcon,
  DigitalSigningIcon,
  WhiteboardIcon,
  TemplatesIcon,
} from "@/components/icons/ModuleIcons";

export interface ModuleMetadata {
  key: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  shortDescription: string;
  longDescription: string;
  category: ModuleCategory;
  color: string;
}

export type ModuleCategory = "Collaboration" | "Portfolio" | "Management" | "Service & Support" | "Utilities";

export const categoryColors: Record<ModuleCategory, { bg: string; text: string; border: string }> = {
  "Collaboration": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  "Portfolio": { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  "Management": { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  "Service & Support": { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  "Utilities": { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
};

export const moduleMetadata: ModuleMetadata[] = [
  {
    key: "chat",
    name: "Chat",
    icon: ChatIcon,
    href: "/modules/chat",
    shortDescription: "Team communication",
    longDescription: "Real-time team messaging and channels for seamless collaboration across your organisation.",
    category: "Collaboration",
    color: "#6366F1",
  },
  {
    key: "documents",
    name: "Documents",
    icon: DocumentsIcon,
    href: "/modules/documents",
    shortDescription: "Document management",
    longDescription: "Shared documents and knowledge base with version control, rich text editing, and access management.",
    category: "Collaboration",
    color: "#3B82F6",
  },
  {
    key: "portfolio",
    name: "Portfolio",
    icon: PortfolioIcon,
    href: "/modules/portfolio",
    shortDescription: "Portfolios & programmes",
    longDescription: "Strategic overview of all active work across programmes, projects, and initiatives.",
    category: "Portfolio",
    color: "#7C3AED",
  },
  {
    key: "projects",
    name: "Projects",
    icon: ProjectsIcon,
    href: "/modules/projects",
    shortDescription: "Project delivery",
    longDescription: "Projects, programmes and work items with Kanban, Agile, Waterfall and hybrid methodologies.",
    category: "Portfolio",
    color: "#0EA5E9",
  },
  {
    key: "tasks",
    name: "Tasks",
    icon: TasksIcon,
    href: "/modules/tasks",
    shortDescription: "Task tracking",
    longDescription: "Personal task boards and lightweight tracking for day-to-day work items and to-dos.",
    category: "Portfolio",
    color: "#EC4899",
  },
  {
    key: "workspaces",
    name: "Workspaces",
    icon: WorkspacesIcon,
    href: "/modules/workspaces",
    shortDescription: "Collaborative workspace",
    longDescription: "Notion-inspired collaborative spaces for meeting notes, checklists, quick task boards and wikis.",
    category: "Portfolio",
    color: "#F59E0B",
  },
  {
    key: "business-mgmt",
    name: "Business",
    icon: BusinessIcon,
    href: "/modules/business-mgmt",
    shortDescription: "Strategic planning & operations",
    longDescription: "Company structure, strategic planning, execution maps and operational management.",
    category: "Management",
    color: "#7C3AED",
  },
  {
    key: "crm",
    name: "CRM",
    icon: CRMIcon,
    href: "/modules/crm",
    shortDescription: "Customer relationships",
    longDescription: "Customer relationships, sales pipeline, lead management and deal tracking.",
    category: "Management",
    color: "#22C55E",
  },
  {
    key: "finance-mgmt",
    name: "Finance",
    icon: FinanceIcon,
    href: "/modules/finance-mgmt",
    shortDescription: "Budgeting & invoicing",
    longDescription: "Budgets, actuals, invoicing and financial reporting across projects and departments.",
    category: "Management",
    color: "#10B981",
  },
  {
    key: "resource-mgmt",
    name: "Resources",
    icon: ResourcesIcon,
    href: "/modules/resource-mgmt",
    shortDescription: "Capacity planning",
    longDescription: "Team capacity and resource allocation with skills tracking, timesheets and utilisation reporting.",
    category: "Management",
    color: "#F97316",
  },
  {
    key: "service-desk",
    name: "Service Desk",
    icon: ServiceDeskIcon,
    href: "/modules/service-desk",
    shortDescription: "Customer service management",
    longDescription: "Internal IT and operations service management with ticket routing and SLA tracking.",
    category: "Service & Support",
    color: "#14B8A6",
  },
  {
    key: "help-desk",
    name: "Help Desk",
    icon: HelpDeskIcon,
    href: "/modules/help-desk",
    shortDescription: "Internal support",
    longDescription: "Customer-facing support and SLA management with case tracking and resolution workflows.",
    category: "Service & Support",
    color: "#0EA5E9",
  },
  {
    key: "test-mgmt",
    name: "Test Management",
    icon: TestManagementIcon,
    href: "/modules/test-mgmt",
    shortDescription: "Test management",
    longDescription: "Test plans, cases, defect tracking and QA reports for software quality assurance.",
    category: "Utilities",
    color: "#EF4444",
  },
  {
    key: "bpm",
    name: "BPM Processes",
    icon: BPMIcon,
    href: "/modules/bpm",
    shortDescription: "Process automation",
    longDescription: "Business process modelling and workflow automation with visual canvas editor.",
    category: "Utilities",
    color: "#8B5CF6",
  },
  {
    key: "surveys",
    name: "Surveys",
    icon: SurveysIcon,
    href: "/modules/surveys",
    shortDescription: "Feedback & research",
    longDescription: "Build surveys and analyse responses for customer feedback and market research.",
    category: "Utilities",
    color: "#06B6D4",
  },
  {
    key: "esign",
    name: "Digital Signing",
    icon: DigitalSigningIcon,
    href: "/modules/esign",
    shortDescription: "Digital signatures",
    longDescription: "Secure document signing and approval workflows with audit trails.",
    category: "Utilities",
    color: "#EC4899",
  },
  {
    key: "whiteboarding",
    name: "Whiteboard",
    icon: WhiteboardIcon,
    href: "/modules/whiteboarding",
    shortDescription: "Visual collaboration",
    longDescription: "Visual collaboration and diagramming for brainstorming and planning sessions.",
    category: "Utilities",
    color: "#A855F7",
  },
  {
    key: "templates",
    name: "Templates",
    icon: TemplatesIcon,
    href: "/modules/templates",
    shortDescription: "Global master templates",
    longDescription: "Project and document templates and starter kits for rapid setup.",
    category: "Utilities",
    color: "#F59E0B",
  },
];

export function getModuleByKey(key: string): ModuleMetadata | undefined {
  return moduleMetadata.find(m => m.key === key);
}

export function getModulesByCategory(category: ModuleCategory): ModuleMetadata[] {
  return moduleMetadata.filter(m => m.category === category);
}

export const allCategories: ModuleCategory[] = ["Collaboration", "Portfolio", "Management", "Service & Support", "Utilities"];
